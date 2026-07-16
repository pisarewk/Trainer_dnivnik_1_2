@echo off
REM ============================================================
REM  FitCoach — ЗАПУСК ТЕСТОВ (Windows)
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

if not exist "python\.venv\Scripts\activate.bat" (
  echo Виртуальное окружение не найдено. Сначала запустите start.bat
  pause
  exit /b 1
)

call "python\.venv\Scripts\activate.bat"
cd python
echo Запуск тестов pytest...
echo ============================================================
python -m pytest ..\tests -v
echo.
pause
