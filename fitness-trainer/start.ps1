# ============================================================
#  FitCoach — ЛОКАЛЬНЫЙ ЗАПУСК (PowerShell, кросс-платформенный вариант)
#  Запуск:  powershell -ExecutionPolicy Bypass -File start.ps1
# ============================================================
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PyDir = Join-Path $Root "python"
Set-Location $PyDir

function Write-Step($msg) { Write-Host "▶ $msg" -ForegroundColor Cyan }

# 1. Python
Write-Step "Проверка Python..."
try { python --version | Out-Null }
catch {
    Write-Host "Python не найден. Установите Python 3.10+ с python.org" -ForegroundColor Red
    exit 1
}

# 2. Виртуальное окружение
$venvActivate = Join-Path $PyDir ".venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
    Write-Step "Создание виртуального окружения..."
    python -m venv .venv
}
& $venvActivate

# 3. pip + зависимости
Write-Step "Установка зависимостей..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

# 4. Инициализация БД
Write-Step "Инициализация базы данных..."
python init_db.py

# 5. Запуск
Write-Host ""
Write-Host "Сервер: http://localhost:8000" -ForegroundColor Green
Write-Host "Тренер:  admin / admin123" -ForegroundColor Yellow
Write-Host "Клиент:  Иванов Иван / client123" -ForegroundColor Yellow
Write-Host ""

# Открыть браузер
Start-Job { Start-Sleep -Seconds 3; Start-Process "http://localhost:8000" } | Out-Null

Write-Step "Запуск сервера (Ctrl+C для остановки)..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000
