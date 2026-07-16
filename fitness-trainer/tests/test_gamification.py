"""
Тесты геймификации (XP и уровни) — чистая логика, без БД.
Позитивные и негативные проверки.
"""
import gamification as g


class TestXpCalculation:
    # --- Позитивные ---
    def test_base_xp_for_empty_workout(self):
        xp = g.calculate_workout_xp([], pr_count=0)
        assert xp == g.BASE_XP  # только базовый опыт

    def test_xp_increases_with_more_weight(self):
        light = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=50, reps=10, sets_count=3)])
        heavy = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=100, reps=10, sets_count=3)])
        assert heavy > light, "Больший вес должен давать больше XP"

    def test_xp_increases_with_more_sets(self):
        few = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=10, sets_count=2)])
        many = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=10, sets_count=5)])
        assert many > few, "Больше подходов → больше XP"

    def test_xp_increases_with_more_reps(self):
        few = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=5, sets_count=3)])
        many = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=12, sets_count=3)])
        assert many > few, "Больше повторений → больше XP"

    def test_pr_bonus(self):
        base = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=10, sets_count=3)], pr_count=0)
        with_pr = g.calculate_workout_xp([g.ExerciseInput("Жим", weight=70, reps=10, sets_count=3)], pr_count=2)
        assert with_pr - base == 2 * g.PR_BONUS_XP

    def test_xp_always_non_negative(self):
        assert g.calculate_workout_xp([g.ExerciseInput("Жим", weight=0, reps=0, sets_count=0)]) >= 0


class TestLevels:
    # --- Позитивные ---
    def test_starts_at_level_1(self):
        info = g.level_info(0)
        assert info.level == 1
        assert info.xp_in_level == 0

    def test_level_progresses_with_xp(self):
        low = g.level_info(100)
        high = g.level_info(5000)
        assert high.level > low.level

    def test_progress_pct_range(self):
        for xp in [0, 50, 100, 500, 1000, 99999]:
            info = g.level_info(xp)
            assert 0 <= info.progress_pct <= 100

    def test_level_title_changes(self):
        assert g.level_title(1) == "Новичок"
        assert g.level_title(5) == "Спортсмен"
        assert g.level_title(25) == "Легенда"

    def test_threshold_grows_with_level(self):
        """Каждый следующий уровень требует больше XP, чем предыдущий."""
        t1 = g._xp_threshold(1)
        t2 = g._xp_threshold(2)
        t3 = g._xp_threshold(3)
        assert t1 < t2 < t3

    # --- Негативные ---
    def test_negative_xp_clamped(self):
        info = g.level_info(-100)
        assert info.level == 1
        assert info.total_xp == 0

    def test_level_info_dict_has_all_fields(self):
        d = g.level_info_dict(1234)
        for key in ("level", "title", "total_xp", "xp_in_level", "xp_for_next", "progress_pct"):
            assert key in d
