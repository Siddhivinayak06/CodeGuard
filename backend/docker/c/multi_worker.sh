#!/bin/bash
# Multi-Worker Process for C/C++ Code Execution
# Polls Redis queue and executes compiled C/C++ code

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
NUM_WORKERS="${WORKERS_PER_CONTAINER:-10}"
COMPILER="${COMPILER:-gcc}"  # gcc or g++
QUEUE_NAME="queue:${LANG_MODE:-c}"

echo "[C/C++ Worker Pool] Starting $NUM_WORKERS workers..."
echo "[C/C++ Worker Pool] Compiler: $COMPILER"
echo "[C/C++ Worker Pool] Queue: $QUEUE_NAME"

# Worker function
worker() {
    local worker_id=$1
    echo "[Worker $worker_id] Started"
    
    while true; do
        # Poll Redis queue (using redis-cli)
        job_json=$(redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" BRPOP "$QUEUE_NAME" 5 2>/dev/null | tail -n1)
        
        if [ -z "$job_json" ]; then
            continue
        fi
        
        # Parse job
        job_id=$(echo "$job_json" | jq -r '.id // "unknown"')
        code=$(echo "$job_json" | jq -r '.code // ""')
        stdin_data=$(echo "$job_json" | jq -r '.stdin // ""')
        timeout_ms=$(echo "$job_json" | jq -r '.timeout // 10000')
        stream_channel=$(echo "$job_json" | jq -r '.streamChannel // ""')
        
        timeout_s=$((timeout_ms / 1000))
        [ $timeout_s -lt 1 ] && timeout_s=1
        
        echo "[Worker $worker_id] Processing job $job_id"
        
        # Create temp directory
        work_dir=$(mktemp -d)
        src_file="$work_dir/main.c"
        exe_file="$work_dir/a.out"
        
        # Write source code
        echo "$code" > "$src_file"
        
        # Compile
        compile_output=$($COMPILER "$src_file" -o "$exe_file" 2>&1)
        compile_status=$?
        
        if [ $compile_status -ne 0 ]; then
            # Compilation failed
            result="{\"stdout\":\"\",\"stderr\":$(echo "$compile_output" | jq -Rs .),\"exitCode\":$compile_status,\"error\":\"Compilation failed\"}"
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "job-results" "{\"jobId\":\"$job_id\",\"result\":$result}" > /dev/null
            rm -rf "$work_dir"
            continue
        fi
        
        # Execute with timeout
        if [ -n "$stream_channel" ]; then
            # Streaming mode
            echo "$stdin_data" | timeout "${timeout_s}s" "$exe_file" 2>&1 | while IFS= read -r line; do
                redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "$stream_channel" "{\"type\":\"output\",\"data\":\"$line\\n\"}" > /dev/null
            done
            redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "$stream_channel" '{"type":"done"}' > /dev/null
            result="{\"exitCode\":0}"
        else
            # Batch mode
            output=$(echo "$stdin_data" | timeout "${timeout_s}s" "$exe_file" 2>&1)
            exit_code=$?
            
            if [ $exit_code -eq 124 ]; then
                result="{\"stdout\":\"\",\"stderr\":\"Execution timed out after ${timeout_s}s\",\"exitCode\":-1,\"error\":\"timeout\"}"
            else
                result="{\"stdout\":$(echo "$output" | jq -Rs .),\"stderr\":\"\",\"exitCode\":$exit_code}"
            fi
        fi
        
        # Publish result
        redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" PUBLISH "job-results" "{\"jobId\":\"$job_id\",\"result\":$result}" > /dev/null
        
        # Cleanup
        rm -rf "$work_dir"
        
        echo "[Worker $worker_id] Completed job $job_id"
    done
}

# Start workers in background
for i in $(seq 1 $NUM_WORKERS); do
    worker $i &
done

# Wait for all workers
wait
echo "[C/C++ Worker Pool] All workers stopped"
