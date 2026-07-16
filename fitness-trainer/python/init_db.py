"""
Скрипт инициализации БД.
1) Создаёт таблицы по моделям ORM.
2) Создаёт тестового тренера и клиентов с правильными bcrypt-хешами.
3) Создаёт демо-тренировки, замеры и начисляет опыт (XP).

Запуск:  python init_db.py
"""
from datetime import date
from database import engine, SessionLocal
import models
from auth import hash_password
import gamification


def init():
    print("Создание таблиц...")
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Тренер
        if not db.query(models.User).filter(models.User.username == "admin").first():
            db.add(models.User(
                username="admin",
                email="admin@fitness.ru",
                full_name="Тренер Дмитрий",
                password_hash=hash_password("admin123"),
                role="trainer",
            ))
            print("Создан тренер: admin / admin123")

        # Демо-клиенты
        demo_clients = [
            dict(full_name="Иванов Иван", phone="+7 900 123-45-67", card_number="1234-5678",
                 birth_date=date(1990, 5, 12), goal="Набор мышечной массы",
                 contraindications="Нет", pulse_zone="120-140"),
            dict(full_name="Петров Сергей", phone="+7 900 222-33-44", card_number="2345-6789",
                 birth_date=date(1988, 3, 2), goal="Снижение веса",
                 contraindications="Больное колено", pulse_zone="110-130"),
            dict(full_name="Сидорова Анна", phone="+7 900 555-66-77", card_number="3456-7890",
                 birth_date=date(1995, 7, 19), goal="Поддержание формы",
                 contraindications="Нет", pulse_zone="120-150"),
        ]
        passwords = {"Иванов Иван": "client123", "Петров Сергей": "client123",
                     "Сидорова Анна": "client123"}

        for cd in demo_clients:
            if db.query(models.Client).filter(models.Client.full_name == cd["full_name"]).first():
                continue
            client = models.Client(
                full_name=cd["full_name"],
                user_id=db.query(models.User).filter(models.User.username == "admin").first().id,
                birth_date=cd["birth_date"],
                phone=cd["phone"],
                card_number=cd["card_number"],
                password_hash=hash_password(passwords[cd["full_name"]]),
                pulse_zone=cd["pulse_zone"],
                goal=cd["goal"],
                contraindications=cd["contraindications"],
                paid_sessions=8,
                xp=0,
            )
            db.add(client)
            db.flush()

            # Демо-тренировки с упражнениями + начисление XP
            workouts = [
                (date(2026, 1, 15), 82.5, [
                    ("Жим лежа", 70, 10, 3, 90, 135, 2),
                    ("Тяга блока", 55, 12, 3, 100, 145, 1),
                    ("Приседания", 90, 8, 4, 110, 160, 1),
                ]),
                (date(2026, 1, 22), 82.0, [
                    ("Жим лежа", 72.5, 10, 3, 92, 138, 2),
                    ("Тяга блока", 57.5, 12, 3, 102, 148, 1),
                ]),
                (date(2026, 2, 3), 81.8, [
                    ("Приседания", 92.5, 8, 4, 112, 162, 1),
                    ("Жим лежа", 75, 8, 4, 95, 145, 1),
                ]),
            ]
            total_xp = 0
            for wd, body_w, exs in workouts:
                t = models.Training(client_id=client.id, training_date=wd,
                                    body_weight=body_w, well_being="Хорошее")
                db.add(t)
                db.flush()
                ex_inputs = []
                for i, (n, w, r, s, pb, pa, res) in enumerate(exs, 1):
                    db.add(models.Exercise(training_id=t.id, name=n, weight=w, reps=r,
                                           sets_count=s, pulse_before=pb, pulse_after=pa,
                                           reserve=res, position=i))
                    ex_inputs.append(gamification.ExerciseInput(
                        name=n, weight=w, reps=r, sets_count=s))
                xp = gamification.calculate_workout_xp(ex_inputs)
                total_xp += xp
                db.add(models.XpLog(client_id=client.id, training_id=t.id,
                                    amount=xp, reason="Тренировка"))

            # Разный XP для разнообразия рейтинга
            bonus = {"Иванов Иван": 0, "Петров Сергей": 350, "Сидорова Анна": 800}
            client.xp = total_xp + bonus.get(client.full_name, 0)

            # Замеры (только Иванову)
            if cd["full_name"] == "Иванов Иван":
                measures = [
                    (date(2026, 1, 1), 38.0, 36.5, 58.0, 100.0, 88.0, 105.0, 36.0, 17.0, 85.0),
                    (date(2026, 2, 1), 38.2, 36.8, 58.5, 100.5, 87.0, 105.5, 36.3, 17.0, 84.0),
                    (date(2026, 3, 1), 38.5, 37.0, 59.0, 101.0, 86.0, 106.0, 36.8, 17.1, 83.0),
                ]
                for m in measures:
                    db.add(models.Measurement(client_id=client.id, measure_date=m[0],
                                              shin=m[1], calf=m[2], thigh=m[3], buttocks=m[4],
                                              waist=m[5], chest=m[6], arm=m[7], wrist=m[8], weight=m[9]))

            print(f"Создан клиент: {cd['full_name']} / {passwords[cd['full_name']]} "
                  f"(XP: {client.xp}, ур. {gamification.level_info(client.xp).level})")

        # --- Демо-шаблоны тренировок ---
        if not db.query(models.WorkoutTemplate).first():
            import json
            templates_data = [
                dict(name="CrossFit Меткон", category="Меткон",
                     description="(2:00 работа / 2:00 отдых) х8 раундов. AMRAP: трастеры, подтягивания, бёрпи.",
                     exercises=[
                         dict(name="Трастеры", weight=40, reps=8, sets_count=3),
                         dict(name="Подтягивания", reps=8, sets_count=3),
                         dict(name="Бёрпи боком через штангу", reps=8, sets_count=3),
                     ]),
                dict(name="Силовая: Становая тяга", category="Силовая",
                     description="12:00 EMOM: 5 повторений каждую минуту. 3 круга: 30%/42%/55%/60%.",
                     exercises=[
                         dict(name="Становая тяга", weight=100, reps=5, sets_count=12),
                     ]),
                dict(name="Рывок + Меткон", category="Тяжёлая атлетика",
                     description="Рывок в стойку + рывок с виса в сед (1+1). Меткон на дистанцию.",
                     exercises=[
                         dict(name="Рывок в стойку + с виса", weight=60, reps=1, sets_count=5),
                         dict(name="Байк эрг", notes="3:00"),
                         dict(name="Бёрпи с прыжком в длину", notes="3:00"),
                         dict(name="Лыжный / гребля", notes="3:00"),
                         dict(name="Гиперэкстензии", reps=20, sets_count=3),
                     ]),
                dict(name="Кардио EMOM 40 мин", category="Кардио",
                     description="40:00 EMOM. Мин1-байк, Мин2-бёрпи, Мин3-носки к перекладине, Мин4-скакалка, Мин5-перенос.",
                     exercises=[
                         dict(name="Эир байк", notes="12 кал, 1 мин"),
                         dict(name="Бёрпи", reps=10, sets_count=1, notes="1 мин"),
                         dict(name="Подносы носков к перекладине", reps=12, sets_count=1),
                         dict(name="Двойные на скакалке", reps=40, sets_count=1),
                         dict(name="Перенос сэндбэга 15м", weight=50, sets_count=1),
                     ]),
                dict(name="Базовая сила: Верх тела", category="Силовая",
                     description="Жим, тяга, бицепс, трицепс. 3-4 подхода.",
                     exercises=[
                         dict(name="Жим лёжа", weight=70, reps=10, sets_count=4),
                         dict(name="Тяга блока", weight=55, reps=12, sets_count=3),
                         dict(name="Подъём гантелей на бицепс", weight=12, reps=16, sets_count=3),
                         dict(name="Разгибания на трицепс", weight=20, reps=10, sets_count=3),
                     ]),
            ]
            admin_user = db.query(models.User).filter(models.User.username == "admin").first()
            for td in templates_data:
                db.add(models.WorkoutTemplate(
                    name=td["name"], description=td["description"],
                    category=td["category"],
                    exercises_json=json.dumps(td["exercises"], ensure_ascii=False),
                    created_by_user_id=admin_user.id if admin_user else None,
                ))
            db.commit()
            print(f"Создано шаблонов тренировок: {len(templates_data)}")

        # --- Демо-отзывы ---
        if not db.query(models.Review).first():
            demo_reviews = [
                dict(author_name="Алексей М.", rating=5,
                     text="Занимаюсь полгода — результаты отличные! Тренер всегда подбирает программу под мои цели.",
                     is_approved=True),
                dict(author_name="Мария К.", rating=5,
                     text="Удобное приложение, вижу свой прогресс в графиках. Очень мотивирует!",
                     is_approved=True),
                dict(author_name="Дмитрий В.", rating=4,
                     text="Хороший сервис, нравится система уведомлений и напоминаний о тренировках.",
                     is_approved=True),
                dict(author_name="Екатерина С.", rating=5,
                     text="Сбросила 8 кг за 3 месяца! Спасибо за индивидуальный подход.",
                     is_approved=True),
                dict(author_name="Игорь П.", rating=4,
                     text="Удобно отслеживать замеры и рекорды. Рекомендую всем кто серьёзно занимается.",
                     is_approved=False),
            ]
            for rd in demo_reviews:
                db.add(models.Review(**rd))
            db.commit()
            print(f"Создано отзывов: {len(demo_reviews)}")

        db.commit()
        print("\nГотово! База инициализирована.")
        print("Вход тренера:   admin / admin123")
        print("Вход клиента:   Иванов Иван / client123")
    finally:
        db.close()


if __name__ == "__main__":
    init()
