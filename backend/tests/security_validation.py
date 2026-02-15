import os
import sys
import socket
import subprocess

def print_result(test_name, success, message=""):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status} - {test_name}: {message}")

def test_read_only_fs():
    """Attempt to write to the root filesystem."""
    try:
        with open("/root/security_test.txt", "w") as f:
            f.write("hacked")
        print_result("Read-Only Filesystem", False, "Successfully wrote to /root")
    except OSError as e:
        print_result("Read-Only Filesystem", True, f"Write blocked: {e}")
    except Exception as e:
        print_result("Read-Only Filesystem", False, f"Unexpected error: {e}")

def test_network_isolation():
    """Attempt to connect to an external IP (Google DNS)."""
    try:
        socket.create_connection(("8.8.8.8", 53), timeout=2)
        print_result("Network Isolation", False, "Successfully connected to 8.8.8.8")
    except OSError:
        print_result("Network Isolation", True, "Connection failed (expected)")
    except Exception as e:
        print_result("Network Isolation", False, f"Unexpected error: {e}")

def test_privilege_drop():
    """Check if running as root."""
    uid = os.getuid()
    if uid == 0:
        print_result("Non-Root User", False, f"Running as UID {uid} (Root)")
    else:
        print_result("Non-Root User", True, f"Running as UID {uid}")

def test_temp_write():
    """Verify verify /tmp is writable (should be allowed via tmpfs)."""
    try:
        with open("/tmp/security_test.txt", "w") as f:
            f.write("ok")
        print_result("Tmpfs Writable", True, "Successfully wrote to /tmp")
    except Exception as e:
        print_result("Tmpfs Writable", False, f"Could not write to /tmp: {e}")

if __name__ == "__main__":
    print("🔒 Security Hardening Validation 🔒")
    print("-" * 40)
    test_read_only_fs()
    test_network_isolation()
    test_privilege_drop()
    test_temp_write()
    print("-" * 40)
