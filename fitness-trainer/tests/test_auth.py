"""
Тесты аутентификации: позитивные (успешный вход) и негативные
(неверный пароль, короткое имя, отсутствие полей, доступ без токена).
"""
from .conftest import auth_header


class TestLoginPositive:
    def test_trainer_login_success(self, client, trainer_token):
        assert trainer_token  # токен получен

    def test_login_returns_level_info(self, client, trainer):
        r = client.post("/api/auth/login", json={"username": "admin", "password": "Admin12345"})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "trainer"
        assert "level" in data
        assert data["level"]["level"] == 1

    def test_client_login_success(self, client, client_token):
        assert client_token

    def test_me_endpoint(self, client, trainer_token):
        r = client.get("/api/auth/me", headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert r.json()["role"] == "trainer"


class TestLoginNegative:
    def test_wrong_password(self, client, trainer):
        r = client.post("/api/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401
        assert "Неверный" in r.json()["detail"]

    def test_nonexistent_user(self, client):
        r = client.post("/api/auth/login", json={"username": "ghost", "password": "x"})
        assert r.status_code == 401

    def test_missing_password_field(self, client):
        # Pydantic валидация: поле обязательно
        r = client.post("/api/auth/login", json={"username": "admin"})
        assert r.status_code == 422

    def test_short_username_rejected(self, client):
        r = client.post("/api/auth/login", json={"username": "ab", "password": "Admin12345"})
        assert r.status_code == 422

    def test_me_without_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401


class TestRegistration:
    def test_register_success(self, client):
        r = client.post("/api/auth/register", json={
            "full_name": "Новый Клиент", "password": "Strong1pass", "phone": "+7 111"
        })
        assert r.status_code == 200
        assert r.json()["client_id"]

    def test_register_weak_password(self, client):
        r = client.post("/api/auth/register", json={
            "full_name": "Слабый Пароль", "password": "123"
        })
        assert r.status_code == 422

    def test_register_short_name(self, client):
        r = client.post("/api/auth/register", json={
            "full_name": "Я", "password": "Strong1pass"
        })
        assert r.status_code == 422

    def test_register_duplicate(self, client, client_user):
        r = client.post("/api/auth/register", json={
            "full_name": "Тестов Тест", "password": "Strong1pass"
        })
        assert r.status_code == 409
