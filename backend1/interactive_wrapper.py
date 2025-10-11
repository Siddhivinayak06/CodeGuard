import sys
import signal

# --- Custom input that flushes prompt properly ---
def custom_input(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    return sys.stdin.readline().rstrip("\n")

__builtins__.input = custom_input

# --- Timeout handler ---
def timeout_handler(signum, frame):
    raise TimeoutError("\n⏱️ Code execution timed out!")

signal.signal(signal.SIGALRM, timeout_handler)

# --- Read code from stdin ---
buffer = []

print("", flush=True)

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
                signal.alarm(7)  # ⏱️ 5-second timeout
                exec(code, {"__name__": "__main__"})
                signal.alarm(0)  # cancel alarm
            except TimeoutError as e:
                print(e, flush=True)
            except Exception as e:
                print(f"❌ Error: {e}", flush=True)
        print("\n...Code execution finished.\n", flush=True)
    else:
        buffer.append(line)