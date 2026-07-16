"""
Точка входа FastAPI.
Запуск:  uvicorn main:app --reload --port 8000
(файл находится в папке python/)

По умолчанию используется SQLite (файл fitness.db) — запуск из коробки.
Для PostgreSQL задайте переменную окружения DATABASE_URL.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from routers import auth, clients, trainings, measurements, notifications, stats, leaderboard
from routers import templates, reviews, analytics, admin
from routers import calendar as calendar_router
from routers import weekly as weekly_router
from routers import schedule as schedule_router
from security import add_security_headers, setup_rate_limiter

app = FastAPI(title="Express Cross Coach", version="2.0")

# Security headers
add_security_headers(app)

# CORS — чтобы фронтенд мог обращаться к API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting (опционально, если установлен slowapi)
setup_rate_limiter(app)

# Подключение роутеров
app.include_router(auth.router)
app.include_router(clients.router)
app.include_router(trainings.router)
app.include_router(measurements.router)
app.include_router(notifications.router)
app.include_router(stats.router)
app.include_router(leaderboard.router)
app.include_router(templates.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(admin.router)
app.include_router(calendar_router.router)
app.include_router(weekly_router.router)
app.include_router(schedule_router.router)

# Раздача статических файлов из родительской папки проекта
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML_DIR = os.path.join(PROJECT_ROOT, "html")
CSS_DIR = os.path.join(PROJECT_ROOT, "css")
JS_DIR = os.path.join(PROJECT_ROOT, "javascript")

if os.path.isdir(CSS_DIR):
    app.mount("/css", StaticFiles(directory=CSS_DIR), name="css")
if os.path.isdir(JS_DIR):
    app.mount("/javascript", StaticFiles(directory=JS_DIR), name="javascript")


@app.get("/")
def root():
    """Главная — лендинг."""
    index = os.path.join(HTML_DIR, "landing.html")
    if os.path.exists(index):
        return FileResponse(index)
    return {"message": "Сервер запущен. Откройте html/landing.html"}


@app.get("/page/{name}")
def page(name: str):
    """Отдаёт HTML-страницу по имени."""
    safe = os.path.basename(name)
    path = os.path.join(HTML_DIR, safe + ".html")
    if not os.path.exists(path):
        from fastapi import HTTPException
        raise HTTPException(404, "Страница не найдена")
    return FileResponse(path)


@app.get("/{page_name}.html")
def html_page(page_name: str):
    """Прямой доступ к html-страницам."""
    safe = os.path.basename(page_name)
    path = os.path.join(HTML_DIR, safe + ".html")
    if not os.path.exists(path):
        from fastapi import HTTPException
        raise HTTPException(404, "Страница не найдена")
    return FileResponse(path)


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0"}


@app.on_event("startup")
def startup_init_db():
    """Создаёт таблицы и демо-данные при первом запуске."""
    try:
        import init_db
        init_db.init()
    except Exception as e:
        print(f"DB init note: {e}")
