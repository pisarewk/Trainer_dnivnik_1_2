@echo off
REM ============================================================
REM  FitCoach — ЛОКАЛЬНЫЙ ЗАПУСК (Windows)
REM  Двойной клик по этому файлу запускает всё приложение.
REM ============================================================
chcp 65001 >nul
setlocal enabledelayedexpansion
title FitCoach - Электронный дневник тренера

cd /d "%~dp0python"

echo ============================================================
echo   FitCoach — запуск приложения
echo ============================================================
echo.

REM --- 1. Проверка Python ---
python --version >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] Python не найден в PATH.
  echo Установите Python 3.10+ с https://www.python.org/downloads/
  echo и добавьте галочку "Add Python to PATH" при установке.
  echo.
  pause
  exit /b 1
)

REM --- 2. Виртуальное окружение ---
if not exist ".venv\Scripts\activate.bat" (
  echo [1/4] Создание виртуального окружения...
  python -m venv .venv
  if errorlevel 1 (
    echo [ОШИБКА] Не удалось создать venv. Попробуйте: python -m ensurepip --upgrade
    pause
    exit /b 1
  )
)
call ".venv\Scripts\activate.bat"

REM --- 3. Обновление pip ---
python -m pip --version >nul 2>&1
if errorlevel 1 (
  echo [ОШИБКА] pip недоступен. Выполните: python -m ensurepip --upgrade
  pause
  exit /b 1
)

REM --- 4. Установка зависимостей ---
echo [2/4] Проверка зависимостей...
python -m pip install -q -r requirements.txt
if errorlevel 1 (
  echo [ОШИБКА] Не удалось установить зависимости.
  pause
  exit /b 1
)

REM --- 5. Инициализация базы данных ---
echo [3/4] Инициализация базы данных (SQLite)...
python -c "import models; from database import engine; models.Base.metadata.create_all(bind=engine); print('  Таблицы готовы')" >nul 2>&1
python init_db.py

REM --- 6. Запуск сервера ---
echo [4/4] Запуск сервера на http://localhost:8000
echo.
echo   Логин тренера: admin   / admin123
echo   Логин клиента: Иванов Иван / client123
echo.
echo   Остановить сервер: Ctrl+C
echo ============================================================
echo.

REM Открыть браузер через 3 секунды
start "" /b cmd /c "timeout /t 3 >nul && start http://localhost:8000"

REM Запуск uvicorn
python -m uvicorn main:app --host 0.0.0.0 --port 8000

pause
