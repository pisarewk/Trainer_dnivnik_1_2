"""
Тесты клиентов и безопасности (доступ, валидация пароля).
"""
from .conftest import auth_header

VALID_CLIENT = {
    "full_name": "Смирнов Алексей",
    "phone": "+7 999 888-77-66",
    "card_number": "9999-0000",
    "goal": "Сила",
    "contraindications": "Нет",
    "password": "Strong1pass",
}


class TestClientsPositive:
    def test_create_client_as_trainer(self, client, trainer_token):
        r = client.post("/api/clients", json=VALID_CLIENT, headers=auth_header(trainer_token))
        assert r.status_code == 200, r.text
        assert r.json()["full_name"] == "Смирнов Алексей"

    def test_list_clients_as_trainer(self, client, trainer_token, client_user):
        r = client.get("/api/clients", headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_search_clients(self, client, trainer_token, client_user):
        r = client.get("/api/clients?search=Тестов", headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert any("Тестов" in c["full_name"] for c in r.json())

    def test_update_client(self, client, trainer_token):
        create = client.post("/api/clients", json=VALID_CLIENT, headers=auth_header(trainer_token))
        cid = create.json()["id"]
        r = client.put(f"/api/clients/{cid}", json={"full_name": "Новое Имя"},
                       headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert r.json()["full_name"] == "Новое Имя"

    def test_client_sees_only_self(self, client, client_token, client_user):
        # клиент видит только себя в списке
        r = client.get("/api/clients", headers=auth_header(client_token))
        assert r.status_code == 200
        assert len(r.json()) == 1


class TestClientsNegative:
    def test_create_without_token(self, client):
        r = client.post("/api/clients", json=VALID_CLIENT)
        assert r.status_code == 401

    def test_create_as_client_forbidden(self, client, client_token):
        r = client.post("/api/clients", json=VALID_CLIENT, headers=auth_header(client_token))
        assert r.status_code == 403

    def test_create_weak_password(self, client, trainer_token):
        bad = dict(VALID_CLIENT, password="123")
        r = client.post("/api/clients", json=bad, headers=auth_header(trainer_token))
        assert r.status_code == 422

    def test_get_nonexistent_client(self, client, trainer_token):
        r = client.get("/api/clients/99999", headers=auth_header(trainer_token))
        assert r.status_code == 404

    def test_client_access_other_client(self, client, client_token, db_session, trainer):
        # создаём второго клиента
        from auth import hash_password
        import models
        other = models.Client(full_name="Другой Человек", password_hash=hash_password("X"))
        db_session.add(other)
        db_session.commit()
        db_session.refresh(other)
        r = client.get(f"/api/clients/{other.id}", headers=auth_header(client_token))
        assert r.status_code == 403

    def test_delete_only_trainer(self, client, client_token, client_user):
        r = client.delete(f"/api/clients/{client_user.id}", headers=auth_header(client_token))
        assert r.status_code == 403
