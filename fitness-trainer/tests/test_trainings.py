"""
Тесты тренировок: создание, начисление XP, доступ, негативные случаи.
"""
from .conftest import auth_header

TRAINING_PAYLOAD = {
    "client_id": None,
    "training_date": "2026-04-01",
    "training_time": "18:00",
    "body_weight": 80.0,
    "comment": "Тест",
    "well_being": "Хорошее",
    "exercises": [
        {"name": "Жим лежа", "weight": 70, "reps": 10, "sets_count": 3,
         "pulse_before": 90, "pulse_after": 135, "reserve": 2},
        {"name": "Приседания", "weight": 100, "reps": 8, "sets_count": 4,
         "pulse_before": 100, "pulse_after": 160, "reserve": 1},
    ],
}


def _make_client(client, trainer_token):
    r = client.post("/api/clients", json={
        "full_name": "Тренировочный Клиент", "phone": "+7", "password": "Strong1pass",
    }, headers=auth_header(trainer_token))
    return r.json()["id"]


class TestTrainingPositive:
    def test_create_training(self, client, trainer_token):
        cid = _make_client(client, trainer_token)
        payload = dict(TRAINING_PAYLOAD, client_id=cid)
        r = client.post("/api/trainings", json=payload, headers=auth_header(trainer_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["exercises"]) == 2
        assert data["training_date"] == "2026-04-01"

    def test_xp_awarded_after_training(self, client, trainer_token):
        cid = _make_client(client, trainer_token)
        before = client.get(f"/api/clients/{cid}", headers=auth_header(trainer_token)).json()["xp"]
        payload = dict(TRAINING_PAYLOAD, client_id=cid)
        client.post("/api/trainings", json=payload, headers=auth_header(trainer_token))
        after = client.get(f"/api/clients/{cid}", headers=auth_header(trainer_token)).json()["xp"]
        assert after > before, "После тренировки XP должен увеличиться"
        assert after - before > 50  # больше базового

    def test_list_trainings(self, client, trainer_token):
        cid = _make_client(client, trainer_token)
        client.post("/api/trainings", json=dict(TRAINING_PAYLOAD, client_id=cid),
                    headers=auth_header(trainer_token))
        r = client.get(f"/api/trainings?client_id={cid}", headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_client_can_view_own_training(self, client, trainer_token, client_token):
        # тренер создаёт тренировку для клиента (нужен общий клиент)
        # используем client_token — клиент "Тестов Тест"
        # создаём тренировку от лица тренера для этого клиента
        from auth import hash_password
        import models
        # client_user уже существует под client_token; узнаём его id через me? проще через список
        me = client.get("/api/auth/me", headers=auth_header(client_token)).json()
        # но client_token — клиент; тренировку создаёт только тренер.
        # Создадим тренером тренировку для client_user:
        # нужно id client_user — он равен me user_id
        cid = me["user_id"]
        client.post("/api/trainings", json=dict(TRAINING_PAYLOAD, client_id=cid),
                    headers=auth_header(trainer_token))
        r = client.get(f"/api/trainings?client_id={cid}", headers=auth_header(client_token))
        assert r.status_code == 200


class TestTrainingNegative:
    def test_create_without_token(self, client):
        r = client.post("/api/trainings", json=dict(TRAINING_PAYLOAD, client_id=1))
        assert r.status_code == 401

    def test_create_as_client_forbidden(self, client, client_token, client_user):
        payload = dict(TRAINING_PAYLOAD, client_id=client_user.id)
        r = client.post("/api/trainings", json=payload, headers=auth_header(client_token))
        assert r.status_code == 403

    def test_create_for_nonexistent_client(self, client, trainer_token):
        payload = dict(TRAINING_PAYLOAD, client_id=99999)
        r = client.post("/api/trainings", json=payload, headers=auth_header(trainer_token))
        assert r.status_code == 404

    def test_get_nonexistent_training(self, client, trainer_token):
        r = client.get("/api/trainings/99999", headers=auth_header(trainer_token))
        assert r.status_code == 404

    def test_missing_exercises_field(self, client, trainer_token):
        cid = _make_client(client, trainer_token)
        # без exercises (необязательное поле) — должно работать
        r = client.post("/api/trainings", json={
            "client_id": cid, "training_date": "2026-04-02",
        }, headers=auth_header(trainer_token))
        assert r.status_code == 200
