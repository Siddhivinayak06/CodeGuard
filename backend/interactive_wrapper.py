# backend/interactive_wrapper.py
import sys

# --- Custom input that flushes prompt properly ---
def custom_input(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    return sys.stdin.readline().rstrip("\n")

__builtins__.input = custom_input

# --- Read code from stdin (sent by WebSocket server) ---
buffer = []

print("✅ Interactive Python ready. Waiting for code...\n", flush=True)

while True:
    line = sys.stdin.readline()
    if not line:  # stdin closed
        break
    line = line.rstrip("\n")

    if line == "__RUN_CODE__":
        # Execute the buffered code
        code = "\n".join(buffer).strip()
        buffer.clear()
        if code:
            try:
                exec(code, {"__name__": "__main__"})
            except Exception as e:
                print(f"❌ Error: {e}", flush=True)
        print("✅ Code execution finished.\n", flush=True)
    else:
        buffer.append(line)
