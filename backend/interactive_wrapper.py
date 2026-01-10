import sys
import signal
import termios
import os

# --- Workspace Setup ---
WORKSPACE = "/app/workspace"
if not os.path.exists(WORKSPACE):
    try:
        os.makedirs(WORKSPACE, exist_ok=True)
    except:
        pass

# Change directory to workspace so relative paths (like 'main.py') work
try:
    os.chdir(WORKSPACE)
except:
    pass

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
    signal.alarm(0)  # Cancel timeout while waiting for input
    line = sys.stdin.readline().rstrip("\n")
    # Debug print
    # print(f"DEBUG: EXECUTION_TIMEOUT={os.environ.get('EXECUTION_TIMEOUT')}", file=sys.stderr)
    timeout_sec = int(os.environ.get("EXECUTION_TIMEOUT", 15))
    signal.alarm(timeout_sec)  # Restart timeout after input received
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
        try:
            if plt.get_fignums():
                buf = io.BytesIO()
                plt.savefig(buf, format='png')
                buf.seek(0)
                img_str = base64.b64encode(buf.read()).decode('utf-8')
                print(f"\n__IMAGE_START__{img_str}__IMAGE_END__\n", flush=True)
                plt.close('all')
        except Exception as e:
            print(f"\n❌ Error displaying plot: {e}", flush=True)
    
    # Monkey patch plt.show
    plt.show = show_plot
except ImportError:
    pass

# --- Terminal Colors ---
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
MAGENTA = "\033[95m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

# --- Execution Logic ---
buffer = []
current_file = None

while True:
    line = sys.stdin.readline()
    if not line:  # stdin closed
        break
    
    raw_line = line.strip()
    
    if raw_line.startswith("__FILE_START__"):
        current_file = raw_line.replace("__FILE_START__", "").strip()
        buffer = []
        continue
    
    if raw_line == "__RUN_CODE__":
        flush_stdin()
        code = "\n".join(buffer).strip()
        buffer = []
        
        if code:
            # If we have a current_file, save it to disk
            if current_file:
                try:
                    with open(current_file, 'w') as f:
                        f.write(code)
                except Exception as e:
                    print(f"{RED}❌ Error saving {current_file}: {e}{RESET}", flush=True)
            
            # Execute the code
            try:
                timeout_sec = int(os.environ.get("EXECUTION_TIMEOUT", 15))
                signal.alarm(timeout_sec)  # Start timeout
                exec(code, globals())
                signal.alarm(0)
            except TimeoutError as e:
                print(f"{YELLOW}{e}{RESET}", flush=True)
                signal.alarm(0)
            except Exception:
                import traceback
                # Get the traceback object
                etype, value, tb = sys.exc_info()
                # Filter out the first frame (this wrapper)
                frames = traceback.extract_tb(tb)
                # We want to skip frames that involve interactive_wrapper.py
                user_frames = [f for f in frames if "interactive_wrapper.py" not in f.filename]
                
                print(f"{RED}{BOLD}Traceback (most recent call last):{RESET}", flush=True)
                for frame in user_frames:
                    print(f"  File \"{frame.filename}\", line {frame.lineno}, in {frame.name}", flush=True)
                    if frame.line:
                        print(f"    {frame.line}", flush=True)
                
                # Print the error message itself colorized
                error_msg = traceback.format_exception_only(etype, value)[0].strip()
                print(f"{RED}{BOLD}{error_msg}{RESET}", flush=True)
                signal.alarm(0)
            finally:
                sys.stdout.flush()
                sys.stderr.flush()
        
        flush_stdin()
        print(f"\n{CYAN}--- Execution Finished ---{RESET}\n", flush=True)
        current_file = None
    else:
        buffer.append(line.rstrip("\n"))