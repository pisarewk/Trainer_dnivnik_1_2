"""
БЕЗОПАСНОСТЬ — проверка надёжности пароля, security-заголовки,
ограничение частоты запросов (rate limiting).
"""
import re

# Параметры надёжности пароля
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 72  # ограничение bcrypt


def validate_password_strength(password: str) -> None:
    """
    Проверяет надёжность пароля. Бросает ValueError с понятным сообщением,
    если пароль слабый.
    """
    if not password or len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Пароль должен содержать не менее {MIN_PASSWORD_LENGTH} символов")
    if len(password) > MAX_PASSWORD_LENGTH:
        raise ValueError(
            f"Пароль слишком длинный (максимум {MAX_PASSWORD_LENGTH} символов)")
    if not re.search(r"[A-Za-zА-Яа-я]", password):
        raise ValueError("Пароль должен содержать хотя бы одну букву")
    if not re.search(r"\d", password):
        raise ValueError("Пароль должен содержать хотя бы одну цифру")


def sanitize_username(username: str) -> str:
    """Базовая очистка имени пользователя (тримминг, контроль длины)."""
    username = (username or "").strip()
    if len(username) < 3:
        raise ValueError("Имя пользователя должно содержать не менее 3 символов")
    if len(username) > 50:
        raise ValueError("Имя пользователя слишком длинное")
    if not re.match(r"^[\wА-Яа-яёЁ\s.@+-]+$", username):
        raise ValueError("Имя пользователя содержит недопустимые символы")
    return username


# --- Security headers ---
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


def add_security_headers(app):
    """Добавляет middleware для security-заголовков."""
    from starlette.middleware.base import BaseHTTPMiddleware

    class SecurityHeadersMiddleware(BaseHTTPMiddleware):
        async def dispatch(self, request, call_next):
            response = await call_next(request)
            for key, value in SECURITY_HEADERS.items():
                response.headers[key] = value
            return response

    app.add_middleware(SecurityHeadersMiddleware)


# --- Rate limiting ---
def setup_rate_limiter(app):
    """Настраивает ограничение частоты запросов через slowapi."""
    try:
        from slowapi import Limiter, _rate_limit_exceeded_handler
        from slowapi.util import get_remote_address
        from slowapi.errors import RateLimitExceeded
    except ImportError:
        # slowapi не установлен — пропускаем
        return None

    limiter = Limiter(key_func=get_remote_address)
    app.state.limiter = limiter
    try:
        from fastapi import Request
        from fastapi.responses import JSONResponse

        @app.exception_handler(RateLimitExceeded)
        async def rate_limit_handler(request, exc):
            return JSONResponse(
                status_code=429,
                content={"detail": "Слишком много запросов. Попробуйте позже."},
            )
    except Exception:
        pass
    return limiter
