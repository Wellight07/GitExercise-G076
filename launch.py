import subprocess
import sys
import time
import webbrowser
from pathlib import Path
from shutil import which


if getattr(sys, "frozen", False):
    BASE_DIR = Path(sys.executable).resolve().parent
else:
    BASE_DIR = Path(__file__).resolve().parent

APP_URL = "http://127.0.0.1:5000"


def get_python_command():
    python_exe = which("python")

    if python_exe:
        return [python_exe]

    py_launcher = which("py")

    if py_launcher:
        return [py_launcher, "-3"]

    return None


def get_backend_path():
    same_folder_path = BASE_DIR / "backend.py"

    if same_folder_path.exists():
        return same_folder_path

    parent_folder_path = BASE_DIR.parent / "backend.py"

    if parent_folder_path.exists():
        return parent_folder_path

    return same_folder_path


def main():
    backend_path = get_backend_path()
    python_command = get_python_command()

    if not backend_path.exists():
        print("backend.py was not found beside this launcher or in its parent folder.")
        input("Press Enter to exit...")
        return

    if python_command is None:
        print("Python was not found. Please install Python or run backend.py manually.")
        input("Press Enter to exit...")
        return

    process = subprocess.Popen(python_command + [str(backend_path)], cwd=backend_path.parent)

    time.sleep(2)
    webbrowser.open(APP_URL)

    try:
        process.wait()
    except KeyboardInterrupt:
        process.terminate()


if __name__ == "__main__":
    main()
