import paramiko

hostname = "72.62.254.251"
username = "root"
password = "Jul1@n/221/cloudhost"

def check_logs():
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(hostname, username=username, password=password)
        
        print("--- Service Status ---")
        stdin, stdout, stderr = ssh.exec_command("systemctl status soundit")
        print(stdout.read().decode())
        print(stderr.read().decode())
        
        print("--- Recent Logs ---")
        stdin, stdout, stderr = ssh.exec_command("journalctl -u soundit -n 50 --no-pager")
        print(stdout.read().decode())
        
        ssh.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_logs()
