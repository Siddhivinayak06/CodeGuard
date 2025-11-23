import sys
import signal
import termios
import tty

# --- Flush stdin helper ---
def flush_stdin():
    """Clear any pending input from stdin buffer"""
    try:
        termios.tcflush(sys.stdin, termios.TCIFLUSH)
    except:
        pass

# --- Custom input that flushes prompt and resets timeout ---
def custom_input(prompt=""):
    if prompt:
        print(prompt, end="", flush=True)
    signal.alarm(0)  # Cancel timeout while waiting for input
    line = sys.stdin.readline().rstrip("\n")
    signal.alarm(5)  # Restart timeout after input received
    return line

__builtins__.input = custom_input

# --- Timeout handler ---
def timeout_handler(signum, frame):
    raise TimeoutError("\n⏱️ Code execution timed out!")

signal.signal(signal.SIGALRM, timeout_handler)

# --- Plot Helper ---
try:
    import matplotlib.pyplot as plt
    import io
    import base64

    def show_plot():
        """Save current plot to base64 and print with delimiters"""
        if plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format='png')
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            print(f"\n__IMAGE_START__{img_str}__IMAGE_END__\n", flush=True)
            plt.close()
    
    # Monkey patch plt.show
    plt.show = show_plot
except ImportError:
    pass

# --- Read code from stdin ---
buffer = []

 

while True:
    line = sys.stdin.readline()
    if not line:  # stdin closed
        break
    line = line.rstrip("\n")

    if line == "__RUN_CODE__":
        # Flush any stray input before executing
        flush_stdin()
        
        # Execute the buffered code
        code = "\n".join(buffer).strip()
        buffer.clear()
        if code:
            try:
                signal.alarm(5)  # Start 5-second timeout
                exec(code, {"__name__": "__main__"})
                signal.alarm(0)  # Cancel alarm on successful completion
            except TimeoutError as e:
                print(e, flush=True)
                signal.alarm(0)  # Cancel alarm after timeout
            except Exception as e:
                print(f"❌ Error: {e}", flush=True)
                signal.alarm(0)  # Cancel alarm after error
        
        # Flush stdin again after execution
        flush_stdin()
        print("\n...Code execution finished.\n", flush=True)
    else:
        buffer.append(line)