import sys
import os
import subprocess
import threading
import time

def log_output(process, prefix):
    """Dynamically read process stdout/stderr line-by-line and print with colored label."""
    skip_trace = False
    for line in iter(process.stdout.readline, b''):
        decoded = line.decode('utf-8', errors='replace').rstrip()
        if not decoded:
            continue
        # Filter out benign Windows client SSE disconnect noise
        if "_call_connection_lost" in decoded or "WinError 10054" in decoded:
            skip_trace = True
            continue
        if skip_trace:
            if "ConnectionResetError" in decoded:
                skip_trace = False
                continue
            if decoded.strip().startswith("File ") or "proactor_events" in decoded or "shutdown" in decoded or "handle:" in decoded or "Traceback" in decoded:
                continue
            skip_trace = False
        print(f"{prefix} {decoded}", flush=True)

def free_port(port=8000):
    """If port is occupied on Windows, free it automatically to prevent [Errno 10048]."""
    if sys.platform != "win32":
        return
    try:
        cmd = f'powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"'
        output = subprocess.check_output(cmd, shell=True).decode().strip()
        if output:
            for pid_str in output.split():
                try:
                    pid = int(pid_str.strip())
                    if pid > 0 and pid != os.getpid():
                        print(f"\033[93m[STARTUP] Releasing port {port} (stopping lingering PID {pid})...\033[0m", flush=True)
                        subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                except ValueError:
                    pass
            time.sleep(1.0)
    except Exception:
        pass

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Locate virtual environment python.exe or default python
    venv_python = os.path.join(base_dir, ".venv", "Scripts", "python.exe")
    if not os.path.exists(venv_python):
        venv_python = sys.executable

    main_script = os.path.join(base_dir, "deploy_app", "open_webui", "app", "main.py")
    worker_script = os.path.join(base_dir, "deploy_app", "open_webui", "app", "worker.py")

    # ANSI Color Escape Codes
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RESET = "\033[0m"

    print("=" * 70)
    print(f"{GREEN}        PROVISIONING SYSTEM ORCHESTRATOR - STARTUP ENGINE{RESET}")
    print("=" * 70)
    print(f" Python Interpreter: {venv_python}")
    print(f" Web Server Script : {main_script}")
    print(f" Worker Script     : {worker_script}")
    print("=" * 70, flush=True)

    # Automatically ensure port 8000 is clean before starting
    free_port(8000)

    # Prepare subprocess environment with forced UTF-8 & unbuffered output
    sub_env = os.environ.copy()
    sub_env["PYTHONIOENCODING"] = "utf-8"
    sub_env["PYTHONUTF8"] = "1"
    sub_env["PYTHONUNBUFFERED"] = "1"
    deploy_app_dir = os.path.join(base_dir, "deploy_app")
    existing_pp = sub_env.get("PYTHONPATH", "")
    sub_env["PYTHONPATH"] = f"{deploy_app_dir}{os.pathsep}{base_dir}{os.pathsep}{existing_pp}".rstrip(os.pathsep)

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    print(f"\n{GREEN}>>> Starting Web Server & Background Worker...{RESET}\n", flush=True)

    # Start main web application process with -u (unbuffered)
    p_main = subprocess.Popen(
        [venv_python, "-u", main_script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=base_dir,
        env=sub_env
    )

    # Start worker pipeline process with -u (unbuffered)
    p_worker = subprocess.Popen(
        [venv_python, "-u", worker_script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=base_dir,
        env=sub_env
    )

    # Start separate logging threads for stdout multiplexing
    t_main = threading.Thread(target=log_output, args=(p_main, f"{BLUE}[SERVER]{RESET}"))
    t_worker = threading.Thread(target=log_output, args=(p_worker, f"{MAGENTA}[WORKER]{RESET}"))

    t_main.daemon = True
    t_worker.daemon = True

    t_main.start()
    t_worker.start()

    print(f"{GREEN}[READY] Access Admin Portal at : http://localhost:8000/{RESET}")
    print(f"{GREEN}[READY] Access Request Form at : http://localhost:8000/request{RESET}\n", flush=True)

    try:
        # Loop to monitor lifecycle of both runtimes
        while p_main.poll() is None and p_worker.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        print(f"\n\n{GREEN}Shutting down orchestrator processes gracefully...{RESET}", flush=True)
    finally:
        p_main.terminate()
        p_worker.terminate()
        try:
            p_main.wait(timeout=3)
            p_worker.wait(timeout=3)
        except subprocess.TimeoutExpired:
            p_main.kill()
            p_worker.kill()
        print("All processes terminated successfully.", flush=True)

if __name__ == "__main__":
    main()
