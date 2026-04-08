#!/usr/bin/env python3
"""
Multi-worker process pool for Python code execution.

Workers poll Redis jobs, execute user code in isolated temp directories,
and publish batch or streaming results.
"""

import json
import os
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import redis


REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
NUM_WORKERS = int(os.environ.get("WORKERS_PER_CONTAINER", "10"))
QUEUE_NAME = "queue:python"
DEFAULT_TIMEOUT_SECONDS = int(os.environ.get("EXECUTION_TIMEOUT", "10"))
PYTHON_BIN = os.environ.get("PYTHON_BIN", "python3")

running = True


def parse_redis_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in {"redis", "rediss"}:
        parsed = urlparse(f"redis://{url}")

    host = parsed.hostname or "redis"
    port = parsed.port or 6379
    username = parsed.username
    password = parsed.password
    db = 0

    if parsed.path and parsed.path != "/":
        try:
            db = int(parsed.path.lstrip("/"))
        except ValueError:
            db = 0

    use_ssl = parsed.scheme == "rediss"
    return host, port, username, password, db, use_ssl


def create_redis_client(url):
    host, port, username, password, db, use_ssl = parse_redis_url(url)
    return redis.Redis(
        host=host,
        port=port,
        username=username,
        password=password,
        db=db,
        ssl=use_ssl,
        decode_responses=True,
    )


redis_client = create_redis_client(REDIS_URL)


def signal_handler(_sig, _frame):
    global running
    print("[Worker] Received shutdown signal, stopping workers...")
    running = False


signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)


def safe_timeout_seconds(timeout_ms):
    try:
        timeout = float(timeout_ms) / 1000.0
    except (TypeError, ValueError):
        timeout = float(DEFAULT_TIMEOUT_SECONDS)

    if timeout <= 0:
        return float(DEFAULT_TIMEOUT_SECONDS)
    return timeout


def create_job_workspace(code):
    work_dir = tempfile.mkdtemp(prefix="cg_py_")
    source_file = os.path.join(work_dir, "main.py")
    with open(source_file, "w", encoding="utf-8") as handle:
        handle.write(code or "")
    return work_dir, source_file


def cleanup_workspace(path):
    if not path:
        return
    shutil.rmtree(path, ignore_errors=True)


def build_python_process(source_file, work_dir, merge_stderr=False):
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    stderr_target = subprocess.STDOUT if merge_stderr else subprocess.PIPE
    return subprocess.Popen(
        [PYTHON_BIN, "-u", source_file],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=stderr_target,
        cwd=work_dir,
        env=env,
    )


def execute_python_code(code, stdin="", timeout=DEFAULT_TIMEOUT_SECONDS):
    """Execute Python code and return final stdout/stderr payload."""
    result = {"stdout": "", "stderr": "", "exitCode": 0, "error": None}
    work_dir = None

    try:
        work_dir, source_file = create_job_workspace(code)
        process = build_python_process(source_file, work_dir)

        try:
            stdout, stderr = process.communicate(
                input=(stdin or "").encode("utf-8"), timeout=timeout
            )
            result["stdout"] = stdout.decode("utf-8", errors="replace")
            result["stderr"] = stderr.decode("utf-8", errors="replace")
            result["exitCode"] = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate()
            result["stdout"] = stdout.decode("utf-8", errors="replace")
            result["stderr"] = stderr.decode("utf-8", errors="replace")
            result["error"] = f"Execution timed out after {timeout}s"
            result["exitCode"] = -1
    except Exception as exc:
        result["error"] = str(exc)
        result["exitCode"] = -1
    finally:
        cleanup_workspace(work_dir)

    return result


def publish_stream_output(stream_channel, data):
    redis_client.publish(
        stream_channel,
        json.dumps(
            {
                "type": "output",
                "data": data,
            }
        ),
    )


def stream_python_code(code, stream_channel, stdin="", timeout=DEFAULT_TIMEOUT_SECONDS):
    """Execute Python code and publish output chunks as they arrive."""
    work_dir = None
    process = None
    timed_out = False

    try:
        work_dir, source_file = create_job_workspace(code)
        process = build_python_process(source_file, work_dir, merge_stderr=True)

        if stdin:
            process.stdin.write((stdin or "").encode("utf-8"))
        process.stdin.close()

        selector = selectors.DefaultSelector()
        selector.register(process.stdout, selectors.EVENT_READ)

        start_time = time.monotonic()
        buffer = b""

        while True:
            elapsed = time.monotonic() - start_time
            remaining = timeout - elapsed
            if remaining <= 0:
                timed_out = True
                process.kill()
                break

            events = selector.select(timeout=min(0.2, remaining))

            for key, _ in events:
                reader = key.fileobj
                chunk = reader.read1(4096) if hasattr(reader, "read1") else reader.read(4096)
                if not chunk:
                    continue

                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    publish_stream_output(
                        stream_channel, line.decode("utf-8", errors="replace") + "\n"
                    )

            if process.poll() is not None:
                break

        if buffer:
            publish_stream_output(stream_channel, buffer.decode("utf-8", errors="replace"))

        if timed_out:
            publish_stream_output(
                stream_channel, f"\n[Execution timed out after {timeout}s]"
            )
            exit_code = -1
            error = "timeout"
        else:
            try:
                exit_code = process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                process.kill()
                exit_code = -1
            error = None if exit_code == 0 else "runtime_error"

        return {"exitCode": exit_code, "error": error}
    except Exception as exc:
        publish_stream_output(stream_channel, f"\n[Error: {str(exc)}]")
        return {"exitCode": -1, "error": str(exc)}
    finally:
        redis_client.publish(stream_channel, json.dumps({"type": "done"}))
        cleanup_workspace(work_dir)


def worker(worker_id):
    """Worker thread that polls Redis queue for jobs."""
    print(f"[Worker {worker_id}] Started")

    while running:
        try:
            job_data = redis_client.brpop(QUEUE_NAME, timeout=5)
            if not job_data:
                continue

            _, job_json = job_data

            try:
                job = json.loads(job_json)
            except json.JSONDecodeError:
                print(f"[Worker {worker_id}] Invalid job JSON")
                continue

            job_id = job.get("id", "unknown")
            code = job.get("code", "")
            stdin_data = job.get("stdin", "")
            timeout_seconds = safe_timeout_seconds(
                job.get("timeout", DEFAULT_TIMEOUT_SECONDS * 1000)
            )
            stream_channel = job.get("streamChannel")

            print(f"[Worker {worker_id}] Processing job {job_id}")

            if stream_channel:
                result = stream_python_code(code, stream_channel, stdin_data, timeout_seconds)
            else:
                result = execute_python_code(code, stdin_data, timeout_seconds)

            redis_client.publish(
                "job-results", json.dumps({"jobId": job_id, "result": result})
            )

            print(f"[Worker {worker_id}] Completed job {job_id}")
        except redis.ConnectionError as exc:
            print(f"[Worker {worker_id}] Redis connection error: {exc}")
            time.sleep(1)
        except Exception as exc:
            print(f"[Worker {worker_id}] Error: {exc}")
            time.sleep(0.5)

    print(f"[Worker {worker_id}] Stopped")


def main():
    host, port, _, _, db, use_ssl = parse_redis_url(REDIS_URL)
    print(f"[Python Worker Pool] Starting {NUM_WORKERS} workers...")
    print(
        f"[Python Worker Pool] Redis: {host}:{port} db={db} ssl={'on' if use_ssl else 'off'}"
    )
    print(f"[Python Worker Pool] Queue: {QUEUE_NAME}")

    try:
        redis_client.ping()
        print("[Python Worker Pool] Redis connection OK")
    except redis.ConnectionError as exc:
        print(f"[Python Worker Pool] Redis connection failed: {exc}")
        sys.exit(1)

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        _ = [executor.submit(worker, i) for i in range(NUM_WORKERS)]
        while running:
            time.sleep(1)

    print("[Python Worker Pool] All workers stopped")


if __name__ == "__main__":
    main()
