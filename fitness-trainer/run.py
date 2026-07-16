import os
import sys
import subprocess
import threading
import webbrowser
import time

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.join(PROJECT_ROOT, "python")
VENV_DIR = os.path.join(PYTHON_DIR, ".venv")
REQUIREMENTS = os.path.join(PYTHON_DIR, "requirements.txt")
HOST = "0.0.0.0"
PORT = 8000


def run(cmd, **kwargs):
    return subprocess.run(cmd, shell=True, **kwargs)


def main():
    os.chdir(PYTHON_DIR)

    python_exe = os.path.join(VENV_DIR, "Scripts", "python.exe")
    pip_exe = os.path.join(VENV_DIR, "Scripts", "pip.exe")

    if not os.path.exists(python_exe):
        print("[1/4] Создание виртуального окружения...")
        run(f'python -m venv "{VENV_DIR}"')
        if not os.path.exists(python_exe):
            print("[ОШИБКА] Не удалось создать venv.")
            sys.exit(1)

    if not os.path.exists(pip_exe):
        pip_exe = os.path.join(VENV_DIR, "Scripts", "pip3.exe")

    print("[2/4] Установка зависимостей...")
    run(f'"{pip_exe}" install -q -r "{REQUIREMENTS}"')

    print("[3/4] Инициализация базы данных...")
    init_db = os.path.join(PYTHON_DIR, "init_db.py")
    run(f'"{python_exe}" "{init_db}"')

    print(f"[4/4] Запуск сервера на http://localhost:{PORT}")
    print()
    print("  Логин тренера: admin   / admin123")
    print("  Логин клиента: Иванов Иван / client123")
    print()

    def open_browser():
        time.sleep(3)
        webbrowser.open(f"http://localhost:{PORT}")

    threading.Thread(target=open_browser, daemon=True).start()

    uvicorn = os.path.join(VENV_DIR, "Scripts", "uvicorn.exe")
    if not os.path.exists(uvicorn):
        uvicorn = "uvicorn"

    os.system(f'"{uvicorn}" main:app --host {HOST} --port {PORT}')


if __name__ == "__main__":
    main()
