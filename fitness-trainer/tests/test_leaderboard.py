"""
Тесты рейтинга (leaderboard) и замеров.
"""
from .conftest import auth_header


class TestLeaderboard:
    def test_leaderboard_requires_auth(self, client):
        r = client.get("/api/leaderboard")
        assert r.status_code == 401

    def test_leaderboard_sorted_by_xp(self, client, trainer_token, db_session):
        import models
        # три клиента с разным XP
        for name, xp in [("А", 100), ("Б", 500), ("В", 300)]:
            db_session.add(models.Client(full_name=name, xp=xp))
        db_session.commit()

        r = client.get("/api/leaderboard", headers=auth_header(trainer_token))
        assert r.status_code == 200
        data = r.json()
        xp_values = [e["total_xp"] for e in data]
        assert xp_values == sorted(xp_values, reverse=True), "Рейтинг сортируется по убыванию XP"
        assert data[0]["rank"] == 1
        assert data[0]["full_name"] == "Б"

    def test_leaderboard_has_level_and_title(self, client, trainer_token, db_session):
        import models
        db_session.add(models.Client(full_name="Уровневый", xp=3000))
        db_session.commit()
        r = client.get("/api/leaderboard", headers=auth_header(trainer_token))
        entry = [e for e in r.json() if e["full_name"] == "Уровневый"][0]
        assert entry["level"] >= 2
        assert entry["title"]

    def test_client_ranking(self, client, trainer_token, db_session):
        import models
        c = models.Client(full_name="Ранговый", xp=250)
        db_session.add(c)
        db_session.commit()
        db_session.refresh(c)
        r = client.get(f"/api/leaderboard/client/{c.id}", headers=auth_header(trainer_token))
        assert r.status_code == 200
        data = r.json()
        assert "rank" in data and data["rank"] is not None
        assert "level" in data


class TestMeasurements:
    MEAS = {
        "client_id": None,
        "measure_date": "2026-04-01",
        "shin": 38.0, "calf": 36.0, "thigh": 58.0, "buttocks": 100.0,
        "waist": 88.0, "chest": 105.0, "arm": 36.0, "wrist": 17.0, "weight": 82.0,
    }

    def test_add_measurement_trainer(self, client, trainer_token, db_session):
        import models
        c = models.Client(full_name="Замерный")
        db_session.add(c); db_session.commit(); db_session.refresh(c)
        r = client.post("/api/measurements", json=dict(self.MEAS, client_id=c.id),
                        headers=auth_header(trainer_token))
        assert r.status_code == 200, r.text

    def test_add_measurement_no_token(self, client):
        r = client.post("/api/measurements", json=dict(self.MEAS, client_id=1))
        assert r.status_code == 401

    def test_list_measurements(self, client, trainer_token, db_session):
        import models
        c = models.Client(full_name="Замерный2")
        db_session.add(c); db_session.commit(); db_session.refresh(c)
        client.post("/api/measurements", json=dict(self.MEAS, client_id=c.id),
                    headers=auth_header(trainer_token))
        r = client.get(f"/api/measurements?client_id={c.id}", headers=auth_header(trainer_token))
        assert r.status_code == 200
        assert len(r.json()) == 1
