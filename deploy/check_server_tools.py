import paramiko
import os
import sys

hostname = os.environ.get("SERVER_HOST", "72.62.254.251")
username = os.environ.get("SERVER_USER", "root")
password = os.environ.get("SSH_PASS")

if not password:
    sys.exit("[ERR] SSH_PASS environment variable is not set.")

def check_tools():
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(hostname, username=username, password=password)
        
        print(f"--- Checking tools on {hostname} ---")
        for cmd in ["node -v", "npm -v", "tesseract --version"]:
            stdin, stdout, stderr = ssh.exec_command(cmd)
            out = stdout.read().decode().strip()
            err = stderr.read().decode().strip()
            if out:
                print(f"{cmd}: {out}")
            else:
                print(f"{cmd}: FAILED ({err})")
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_tools()
