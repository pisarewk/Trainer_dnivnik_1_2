-- ============================================================
--  ЭЛЕКТРОННЫЙ ДНЕВНИК ТРЕНЕРА — СХЕМА БАЗЫ ДАННЫХ PostgreSQL
-- ============================================================

-- Создание базы данных (выполнить один раз вручную в psql):
--   CREATE DATABASE fitness_trainer ENCODING 'UTF8';
-- Затем подключиться к базе и выполнить этот файл.

-- Удаление существующих таблиц (для пересоздания)
DROP TABLE IF EXISTS exercise_sets CASCADE;
DROP TABLE IF EXISTS exercises CASCADE;
DROP TABLE IF EXISTS trainings CASCADE;
DROP TABLE IF EXISTS measurements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
--  ПОЛЬЗОВАТЕЛИ (тренер)
-- ============================================================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50)  UNIQUE NOT NULL,
    email           VARCHAR(120) UNIQUE NOT NULL,
    full_name       VARCHAR(150),
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'trainer',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================================
--  КЛИЕНТЫ
-- ============================================================
CREATE TABLE clients (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
    full_name           VARCHAR(150) NOT NULL,
    birth_date          DATE,
    phone               VARCHAR(30),
    card_number         VARCHAR(40),
    password_hash       VARCHAR(255),
    pulse_zone          VARCHAR(60),
    goal                TEXT,
    contraindications   TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_full_name ON clients (full_name);
CREATE INDEX idx_clients_phone     ON clients (phone);

-- ============================================================
--  ТРЕНИРОВКИ
-- ============================================================
CREATE TABLE trainings (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    training_date   DATE    NOT NULL,
    training_time   TIME,
    body_weight     NUMERIC(5,2),
    comment         TEXT,
    well_being      VARCHAR(120),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_trainings_client   ON trainings (client_id);
CREATE INDEX idx_trainings_date     ON trainings (training_date);

-- ============================================================
--  УПРАЖНЕНИЯ В ТРЕНИРОВКЕ
-- ============================================================
CREATE TABLE exercises (
    id              SERIAL PRIMARY KEY,
    training_id     INTEGER NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    weight          NUMERIC(6,2),
    reps            INTEGER,
    sets_count      INTEGER,
    pulse_before    INTEGER,
    pulse_after     INTEGER,
    reserve         INTEGER,
    position        INTEGER DEFAULT 0
);

-- ============================================================
--  ЗАМЕРЫ ТЕЛА
-- ============================================================
CREATE TABLE measurements (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    measure_date    DATE    NOT NULL,
    shin            NUMERIC(5,1),   -- объём голени
    calf            NUMERIC(5,1),   -- объём икры
    thigh           NUMERIC(5,1),   -- объём бедра
    buttocks        NUMERIC(5,1),   -- объём ягодиц
    waist           NUMERIC(5,1),   -- объём талии
    chest           NUMERIC(5,1),   -- объём груди
    arm             NUMERIC(5,1),   -- объём руки
    wrist           NUMERIC(5,1),   -- объём запястья
    weight          NUMERIC(5,1),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_measurements_client ON measurements (client_id);
CREATE INDEX idx_measurements_date   ON measurements (measure_date);

-- ============================================================
--  УВЕДОМЛЕНИЯ
-- ============================================================
CREATE TABLE notifications (
    id              SERIAL PRIMARY KEY,
    client_id       INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    user_id         INTEGER REFERENCES users(id)   ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    message         TEXT NOT NULL,
    category        VARCHAR(40) DEFAULT 'info',
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_client ON notifications (client_id);
CREATE INDEX idx_notifications_read   ON notifications (is_read);
