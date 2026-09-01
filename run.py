import sys
import os
import subprocess
import threading
import time

def log_output(process, prefix):
    """Dynamically read process stdout/stderr line-by-line and print with colored label."""
    while True:
        line = process.stdout.readline()
        if not line:
            break
        decoded = line.decode('utf-8', errors='replace').rstrip()
        print(f"{prefix} {decoded}", flush=True)

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
    RESET = "\033[0m"

    print("=" * 70)
    print(f"{GREEN}        PROVISIONING SYSTEM ORCHESTRATOR - STARTUP ENGINE{RESET}")
    print("=" * 70)
    print(f" Python Interpreter: {venv_python}")
    print(f" Web Server Script : {main_script}")
    print(f" Worker Script     : {worker_script}")
    print("=" * 70 + "\n")

    # Prepare subprocess environment with forced UTF-8
    sub_env = os.environ.copy()
    sub_env["PYTHONIOENCODING"] = "utf-8"
    sub_env["PYTHONUTF8"] = "1"
    deploy_app_dir = os.path.join(base_dir, "deploy_app")
    existing_pp = sub_env.get("PYTHONPATH", "")
    sub_env["PYTHONPATH"] = f"{deploy_app_dir}{os.pathsep}{base_dir}{os.pathsep}{existing_pp}".rstrip(os.pathsep)

    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    # Start main web application process
    p_main = subprocess.Popen(
        [venv_python, main_script],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=base_dir,
        env=sub_env
    )

    # Start worker pipeline process
    p_worker = subprocess.Popen(
        [venv_python, worker_script],
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

    try:
        # Loop to monitor lifecycle of both runtimes
        while p_main.poll() is None and p_worker.poll() is None:
            time.sleep(1.0)
    except KeyboardInterrupt:
        print(f"\n\n{GREEN}Shutting down orchestrator processes gracefully...{RESET}")
    finally:
        p_main.terminate()
        p_worker.terminate()
        try:
            p_main.wait(timeout=3)
            p_worker.wait(timeout=3)
        except subprocess.TimeoutExpired:
            p_main.kill()
            p_worker.kill()
        print("All processes terminated successfully.")

if __name__ == "__main__":
    main()
