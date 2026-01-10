#!/usr/bin/env python3
"""
Multi-Worker Process Pool for Python Code Execution

This script runs multiple worker threads that poll a Redis queue for jobs,
execute Python code in isolated subprocesses, and stream output back.
"""

import os
import sys
import json
import redis
import subprocess
import threading
import tempfile
import time
import signal
from concurrent.futures import ThreadPoolExecutor

# Configuration
REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379')
NUM_WORKERS = int(os.environ.get('WORKERS_PER_CONTAINER', '10'))
QUEUE_NAME = 'queue:python'
EXECUTION_TIMEOUT = 10  # seconds

# Parse Redis URL
def parse_redis_url(url):
    # redis://host:port or redis://redis:6379
    url = url.replace('redis://', '')
    if ':' in url:
        host, port = url.split(':')
        return host, int(port)
    return url, 6379

redis_host, redis_port = parse_redis_url(REDIS_URL)
redis_client = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)

running = True

def signal_handler(sig, frame):
    global running
    print("[Worker] Received shutdown signal, stopping workers...")
    running = False

signal.signal(signal.SIGTERM, signal_handler)
signal.signal(signal.SIGINT, signal_handler)

def execute_python_code(code, stdin='', timeout=10):
    """Execute Python code in a subprocess with timeout"""
    result = {
        'stdout': '',
        'stderr': '',
        'exitCode': 0,
        'error': None
    }
    
    try:
        # Create temp file for code
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        # Execute with timeout
        process = subprocess.Popen(
            ['python3', '-u', temp_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd='/tmp'
        )
        
        try:
            stdout, stderr = process.communicate(input=stdin, timeout=timeout)
            result['stdout'] = stdout
            result['stderr'] = stderr
            result['exitCode'] = process.returncode
        except subprocess.TimeoutExpired:
            process.kill()
            result['error'] = f'Execution timed out after {timeout}s'
            result['exitCode'] = -1
        
        # Cleanup
        os.unlink(temp_file)
        
    except Exception as e:
        result['error'] = str(e)
        result['exitCode'] = -1
    
    return result

def stream_python_code(code, stream_channel, stdin='', timeout=10):
    """Execute Python code and stream output in real-time"""
    try:
        # Create temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        process = subprocess.Popen(
            ['python3', '-u', temp_file],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            cwd='/tmp'
        )
        
        # Write stdin if provided
        if stdin:
            process.stdin.write(stdin)
            process.stdin.close()
        
        # Stream output
        start_time = time.time()
        while True:
            if time.time() - start_time > timeout:
                process.kill()
                redis_client.publish(stream_channel, json.dumps({
                    'type': 'output',
                    'data': f'\n[Execution timed out after {timeout}s]'
                }))
                break
            
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            
            if line:
                redis_client.publish(stream_channel, json.dumps({
                    'type': 'output',
                    'data': line
                }))
        
        # Send done signal
        redis_client.publish(stream_channel, json.dumps({'type': 'done'}))
        
        # Cleanup
        os.unlink(temp_file)
        
        return {'exitCode': process.returncode}
        
    except Exception as e:
        redis_client.publish(stream_channel, json.dumps({
            'type': 'output',
            'data': f'\n[Error: {str(e)}]'
        }))
        redis_client.publish(stream_channel, json.dumps({'type': 'done'}))
        return {'exitCode': -1, 'error': str(e)}

def worker(worker_id):
    """Worker thread that polls Redis queue for jobs"""
    print(f"[Worker {worker_id}] Started")
    
    while running:
        try:
            # Block-wait for job (5 second timeout to check running flag)
            job_data = redis_client.brpop(QUEUE_NAME, timeout=5)
            
            if not job_data:
                continue
            
            _, job_json = job_data
            job = json.loads(job_json)
            
            job_id = job.get('id', 'unknown')
            code = job.get('code', '')
            stdin = job.get('stdin', '')
            timeout = job.get('timeout', EXECUTION_TIMEOUT * 1000) / 1000  # ms to s
            stream_channel = job.get('streamChannel')
            
            print(f"[Worker {worker_id}] Processing job {job_id}")
            
            if stream_channel:
                # Streaming mode
                result = stream_python_code(code, stream_channel, stdin, timeout)
            else:
                # Batch mode
                result = execute_python_code(code, stdin, timeout)
            
            # Publish result
            redis_client.publish('job-results', json.dumps({
                'jobId': job_id,
                'result': result
            }))
            
            print(f"[Worker {worker_id}] Completed job {job_id}")
            
        except redis.ConnectionError as e:
            print(f"[Worker {worker_id}] Redis connection error: {e}")
            time.sleep(1)
        except Exception as e:
            print(f"[Worker {worker_id}] Error: {e}")
            time.sleep(0.5)
    
    print(f"[Worker {worker_id}] Stopped")

def main():
    print(f"[Python Worker Pool] Starting {NUM_WORKERS} workers...")
    print(f"[Python Worker Pool] Redis: {redis_host}:{redis_port}")
    print(f"[Python Worker Pool] Queue: {QUEUE_NAME}")
    
    # Test Redis connection
    try:
        redis_client.ping()
        print("[Python Worker Pool] Redis connection OK")
    except redis.ConnectionError as e:
        print(f"[Python Worker Pool] Redis connection failed: {e}")
        sys.exit(1)
    
    # Start workers
    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [executor.submit(worker, i) for i in range(NUM_WORKERS)]
        
        # Wait for shutdown
        while running:
            time.sleep(1)
    
    print("[Python Worker Pool] All workers stopped")

if __name__ == '__main__':
    main()
