-- ============================================================
--  НАЧАЛЬНЫЕ ДАННЫЕ — тестовый тренер и демонстрационный клиент
--  Пароли захешированы (passlib bcrypt).
--  Логин тренера: admin / пароль: admin123
--  Клиент: ivanov / пароль: client123
--  ВАЖНО: хеши ниже сгенерируйте через python auth_seed.py
--         или используйте уже готовые тестовые значения.
-- ============================================================

INSERT INTO users (username, email, full_name, password_hash, role) VALUES
('admin', 'admin@fitness.ru', 'Тренер Дмитрий',
 '$2b$12$0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9', 'trainer');

INSERT INTO clients (full_name, birth_date, phone, card_number, password_hash, pulse_zone, goal, contraindications) VALUES
('Иванов Иван', '1990-05-12', '+7 900 123-45-67', '1234-5678',
 '$2b$12$0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9r3vF0pX9',
 '120-140', 'Набор мышечной массы', 'Нет');

-- Демонстрационные тренировки (client_id = 1)
INSERT INTO trainings (client_id, training_date, training_time, body_weight, comment, well_being) VALUES
(1, '2026-01-15', '18:00', 82.5, 'Хорошая разминка', 'Отличное'),
(1, '2026-01-18', '18:00', 82.3, 'Увеличил вес в жиме', 'Нормальное'),
(1, '2026-01-22', '19:00', 82.0, 'Присед тяжело', 'Усталое');

-- Упражнения для тренировки 1
INSERT INTO exercises (training_id, name, weight, reps, sets_count, pulse_before, pulse_after, reserve, position) VALUES
(1, 'Жим лежа',          70, 10, 3, 90, 135, 2, 1),
(1, 'Тяга блока',        55, 12, 3, 100, 145, 1, 2),
(1, 'Приседания',        90,  8, 4, 110, 160, 1, 3);

-- Замеры тела
INSERT INTO measurements (client_id, measure_date, shin, calf, thigh, buttocks, waist, chest, arm, wrist, weight) VALUES
(1, '2026-01-01', 38.0, 36.5, 58.0, 100.0, 88.0, 105.0, 36.0, 17.0, 85.0),
(1, '2026-02-01', 38.2, 36.8, 58.5, 100.5, 87.0, 105.5, 36.3, 17.0, 84.0),
(1, '2026-03-01', 38.5, 37.0, 59.0, 101.0, 86.0, 106.0, 36.8, 17.1, 83.0);

-- Уведомления
INSERT INTO notifications (client_id, user_id, title, message, category) VALUES
(1, 1, 'Новая тренировка', 'Добавлена тренировка от 15 января', 'training'),
(1, 1, 'Новый рекорд!', 'Жим лежа — новый личный рекорд 70 кг', 'record');
