#!/bin/bash
# Multi-worker process pool for C/C++ code execution.

set -u -o pipefail

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
NUM_WORKERS="${WORKERS_PER_CONTAINER:-10}"
COMPILER="${COMPILER:-gcc}"
QUEUE_NAME="queue:${LANG_MODE:-c}"

normalize_compiler() {
    case "$COMPILER" in
        g++|c++) echo "g++" ;;
        *) echo "gcc" ;;
    esac
}

COMPILER_BIN="$(normalize_compiler)"
SOURCE_EXT="c"
if [ "$COMPILER_BIN" = "g++" ]; then
    SOURCE_EXT="cpp"
fi

require_cmd() {
    local cmd="$1"
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "[C/C++ Worker Pool] Missing required command: $cmd"
        exit 1
    fi
}

publish_json() {
    local channel="$1"
    local payload="$2"
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "$channel" "$payload" >/dev/null
}

publish_result() {
    local job_id="$1"
    local result_json="$2"
    local payload
    payload=$(jq -cn --arg jobId "$job_id" --argjson result "$result_json" '{jobId:$jobId, result:$result}')
    publish_json "job-results" "$payload"
}

handle_shutdown() {
    echo "[C/C++ Worker Pool] Shutdown signal received"
    kill 0 >/dev/null 2>&1 || true
}

trap handle_shutdown SIGTERM SIGINT

echo "[C/C++ Worker Pool] Starting $NUM_WORKERS workers..."
echo "[C/C++ Worker Pool] Compiler: $COMPILER_BIN"
echo "[C/C++ Worker Pool] Queue: $QUEUE_NAME"

require_cmd redis-cli
require_cmd jq
require_cmd timeout
require_cmd "$COMPILER_BIN"

worker() {
    local worker_id="$1"
    echo "[Worker $worker_id] Started"

    while true; do
        local job_json
        job_json=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --raw BRPOP "$QUEUE_NAME" 5 2>/dev/null | tail -n1)

        if [ -z "$job_json" ]; then
            continue
        fi

        if ! echo "$job_json" | jq -e . >/dev/null 2>&1; then
            echo "[Worker $worker_id] Skipping invalid job JSON"
            continue
        fi

        local job_id code stdin_data timeout_ms stream_channel timeout_s
        job_id=$(echo "$job_json" | jq -r '.id // "unknown"')
        code=$(echo "$job_json" | jq -r '.code // ""')
        stdin_data=$(echo "$job_json" | jq -r '.stdin // ""')
        timeout_ms=$(echo "$job_json" | jq -r '.timeout // 10000')
        stream_channel=$(echo "$job_json" | jq -r '.streamChannel // ""')

        if ! [[ "$timeout_ms" =~ ^[0-9]+$ ]]; then
            timeout_ms=10000
        fi
        timeout_s=$((timeout_ms / 1000))
        [ "$timeout_s" -lt 1 ] && timeout_s=1

        echo "[Worker $worker_id] Processing job $job_id"

        local work_dir src_file exe_file
        work_dir=$(mktemp -d)
        src_file="$work_dir/main.$SOURCE_EXT"
        exe_file="$work_dir/a.out"

        printf "%s" "$code" > "$src_file"

        local compile_output compile_status
        compile_output=$("$COMPILER_BIN" -O0 "$src_file" -o "$exe_file" 2>&1)
        compile_status=$?

        if [ "$compile_status" -ne 0 ]; then
            local result
            result=$(jq -cn \
                --arg stderr "$compile_output" \
                --arg error "Compilation failed" \
                --argjson exitCode "$compile_status" \
                '{stdout:"", stderr:$stderr, exitCode:$exitCode, error:$error}')
            publish_result "$job_id" "$result"
            rm -rf "$work_dir"
            continue
        fi

        local result exit_code output
        if [ -n "$stream_channel" ]; then
            printf "%s" "$stdin_data" | timeout "${timeout_s}s" "$exe_file" 2>&1 | while IFS= read -r line || [ -n "$line" ]; do
                local chunk
                chunk=$(jq -cn --arg data "${line}\n" '{type:"output", data:$data}')
                publish_json "$stream_channel" "$chunk"
            done
            exit_code=${PIPESTATUS[1]}

            if [ "$exit_code" -eq 124 ]; then
                local timeout_msg
                timeout_msg=$(jq -cn --arg data "Execution timed out after ${timeout_s}s\n" '{type:"output", data:$data}')
                publish_json "$stream_channel" "$timeout_msg"
                result=$(jq -cn '{exitCode:-1, error:"timeout"}')
            else
                result=$(jq -cn --argjson exitCode "$exit_code" '{exitCode:$exitCode}')
            fi

            publish_json "$stream_channel" '{"type":"done"}'
        else
            output=$(printf "%s" "$stdin_data" | timeout "${timeout_s}s" "$exe_file" 2>&1)
            exit_code=$?

            if [ "$exit_code" -eq 124 ]; then
                result=$(jq -cn \
                    --arg stderr "Execution timed out after ${timeout_s}s" \
                    '{stdout:"", stderr:$stderr, exitCode:-1, error:"timeout"}')
            else
                result=$(jq -cn \
                    --arg stdout "$output" \
                    --argjson exitCode "$exit_code" \
                    '{stdout:$stdout, stderr:"", exitCode:$exitCode}')
            fi
        fi

        publish_result "$job_id" "$result"
        rm -rf "$work_dir"
        echo "[Worker $worker_id] Completed job $job_id"
    done
}

for i in $(seq 1 "$NUM_WORKERS"); do
    worker "$i" &
done

wait
echo "[C/C++ Worker Pool] All workers stopped"
