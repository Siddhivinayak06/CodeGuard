import builtins
import os
import shutil
import signal
import sys
import termios
import traceback

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

if WORKSPACE not in sys.path:
    sys.path.insert(0, WORKSPACE)


def cleanup_workspace():
    """Remove files from previous runs so stale code does not affect new executions."""
    try:
        for entry in os.listdir(WORKSPACE):
            path = os.path.join(WORKSPACE, entry)
            try:
                if os.path.isfile(path) or os.path.islink(path):
                    os.unlink(path)
                elif os.path.isdir(path):
                    shutil.rmtree(path, ignore_errors=True)
            except:
                pass
    except:
        pass


def normalize_relative_path(file_name, default_name="main.py"):
    normalized = (file_name or "").strip().replace("\\", "/")
    while normalized.startswith("/"):
        normalized = normalized[1:]
    return normalized or default_name


def resolve_workspace_path(file_name):
    normalized = normalize_relative_path(file_name)

    if ".." in normalized.split("/"):
        raise ValueError(f"Invalid file path: {file_name}")

    workspace_abs = os.path.abspath(WORKSPACE)
    target_abs = os.path.abspath(os.path.join(WORKSPACE, normalized))
    if target_abs != workspace_abs and not target_abs.startswith(workspace_abs + os.sep):
        raise ValueError(f"Invalid file path: {file_name}")

    return target_abs, normalized


def save_buffer_to_file(file_name, lines):
    if not file_name:
        return

    target_path, normalized_name = resolve_workspace_path(file_name)
    parent_dir = os.path.dirname(target_path)
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)

    with open(target_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return normalized_name


def find_first_python_file():
    py_files = []
    try:
        for root, _, files in os.walk(WORKSPACE):
            for file_name in files:
                if file_name.endswith(".py"):
                    absolute_path = os.path.join(root, file_name)
                    rel_path = os.path.relpath(absolute_path, WORKSPACE).replace("\\", "/")
                    py_files.append(rel_path)
    except:
        return None

    if not py_files:
        return None

    py_files.sort()
    return py_files[0]

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
    # Debug print
    # print(f"DEBUG: EXECUTION_TIMEOUT={os.environ.get('EXECUTION_TIMEOUT')}", file=sys.stderr)
    timeout_sec = int(os.environ.get("EXECUTION_TIMEOUT", 15))
    signal.alarm(timeout_sec)  # Restart timeout after input received
    return line

builtins.input = custom_input

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
batch_started = False


def execute_target_file(target_file):
    try:
        target_path, normalized_target = resolve_workspace_path(target_file)
    except Exception as e:
        print(f"{RED}❌ Invalid target file: {e}{RESET}", flush=True)
        return

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            code = f.read()

        timeout_sec = int(os.environ.get("EXECUTION_TIMEOUT", 15))
        signal.alarm(timeout_sec)  # Start timeout
        print(f"__SERVER_LOG__ Executing {normalized_target} with timeout {timeout_sec}s", flush=True)

        execution_globals = {
            "__name__": "__main__",
            "__file__": normalized_target,
        }
        compiled = compile(code, normalized_target, "exec")
        exec(compiled, execution_globals, execution_globals)
    except TimeoutError as e:
        print(f"{YELLOW}{e}{RESET}", flush=True)
    except Exception:
        etype, value, tb = sys.exc_info()
        frames = traceback.extract_tb(tb)
        user_frames = [frame for frame in frames if "interactive_wrapper.py" not in frame.filename]

        print(f"{RED}{BOLD}Traceback (most recent call last):{RESET}", flush=True)
        for frame in user_frames:
            print(f"  File \"{frame.filename}\", line {frame.lineno}, in {frame.name}", flush=True)
            if frame.line:
                print(f"    {frame.line}", flush=True)

        error_msg = traceback.format_exception_only(etype, value)[0].strip()
        print(f"{RED}{BOLD}{error_msg}{RESET}", flush=True)
    finally:
        signal.alarm(0)
        sys.stdout.flush()
        sys.stderr.flush()
        print(f"__SERVER_LOG__ Execution completed for {normalized_target}", flush=True)

while True:
    line = sys.stdin.readline()
    if not line:  # stdin closed
        break
    
    raw_line = line.strip()
    
    if raw_line.startswith("__FILE_START__"):
        if not batch_started:
            cleanup_workspace()
            batch_started = True

        # If we were previously buffering a file, save it now
        if current_file and buffer:
            try:
                save_buffer_to_file(current_file, buffer)
            except Exception as e:
                print(f"{RED}❌ Error saving {current_file}: {e}{RESET}", flush=True)

        current_file = normalize_relative_path(raw_line.replace("__FILE_START__", "", 1).strip())
        buffer = []
        continue
    
    if raw_line == "__RUN_CODE__":
        flush_stdin()
        
        # Save the LAST file buffer
        if current_file and buffer:
            try:
                save_buffer_to_file(current_file, buffer)
            except Exception as e:
                print(f"{RED}❌ Error saving {current_file}: {e}{RESET}", flush=True)
        
        buffer = [] # Clear buffer after saving
        
        # --- DETERMINE WHICH FILE TO RUN ---
        # Priority 1: main.py
        # Priority 2: current_file (if it is a .py file)
        # Priority 3: first .py file found
        
        target_file = None
        
        if os.path.exists(os.path.join(WORKSPACE, "main.py")):
            target_file = "main.py"
        elif current_file and current_file.endswith(".py"):
            try:
                candidate_path, _ = resolve_workspace_path(current_file)
                if os.path.exists(candidate_path):
                    target_file = current_file
            except:
                target_file = None
        else:
            target_file = find_first_python_file()

        if target_file:
            execute_target_file(target_file)
        else:
            print(f"{RED}❌ No executable Python file found (e.g. main.py){RESET}", flush=True)

        current_file = None
        batch_started = False
        
        flush_stdin()
        print(f"\n{CYAN}--- Execution Finished ---{RESET}\n", flush=True)
    else:
        buffer.append(line.rstrip("\n"))