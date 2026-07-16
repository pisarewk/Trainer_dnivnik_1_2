/* landing.js — лендинг */
(function() {
  Theme.init();
  document.getElementById('themeToggle').addEventListener('click', function() { Theme.toggle(); });

  // Иконки
  document.getElementById('heroVisual').innerHTML = Icons.svg('dumbbell', 280);

  // Карточки возможностей
  var features = [
    { icon: 'shield', title: 'Авторизация тренера', text: 'Вход по логину и паролю. У каждого клиента свой личный кабинет.' },
    { icon: 'users', title: 'Управление клиентами', text: 'Добавление, редактирование и поиск клиентов по фамилии или телефону.' },
    { icon: 'clipboard', title: 'Ведение тренировок', text: 'Создание тренировок с упражнениями, комментариями и самочувствием.' },
    { icon: 'ruler', title: 'Замеры тела', text: 'Регулярный ввод объёмов и веса с автоматическими графиками.' },
    { icon: 'chart', title: 'Графики и статистика', text: 'Анализ прогресса по весу, повторениям и посещаемости.' },
    { icon: 'bell', title: 'Уведомления и рекорды', text: 'Автоматические уведомления и подсчёт личных рекордов.' },
  ];
  document.getElementById('featuresGrid').innerHTML = features.map(function(f, i) {
    return '<div class="feature reveal delay-' + ((i % 3) + 1) + '" data-feature>' +
      '<div class="f-icon">' + Icons.svg(f.icon, 32) + '</div>' +
      '<h3>' + f.title + '</h3><p>' + f.text + '</p></div>';
  }).join('');

  // Шаги
  var steps = [
    { n: 1, title: 'Авторизация тренера', text: 'Вход в систему по логину и паролю.' },
    { n: 2, title: 'Управление клиентами', text: 'Добавление, редактирование и поиск клиентов.' },
    { n: 3, title: 'Ведение тренировок', text: 'Создание тренировок с упражнениями.' },
    { n: 4, title: 'Замеры тела', text: 'Регулярный ввод объёмов и веса с графиками.' },
    { n: 5, title: 'Графики и статистика', text: 'Анализ прогресса и посещаемости.' },
    { n: 6, title: 'Уведомления и рекорды', text: 'Автоматические уведомления о рекордах.' },
  ];
  document.getElementById('stepsList').innerHTML = steps.map(function(s, i) {
    return '<div class="step reveal delay-' + ((i % 3) + 1) + '"><div class="step-num">' + s.n + '</div>' +
      '<div><h3>' + s.title + '</h3><p>' + s.text + '</p></div></div>';
  }).join('');

  // Анимация карточек и шагов (подъём при наведении/клике)
  document.querySelectorAll('[data-feature], .step').forEach(function(card) {
    card.addEventListener('click', function() {
      card.classList.add('clicked');
      setTimeout(function() { card.classList.remove('clicked'); }, 600);
    });
  });

  // Reveal при скролле
  function observeReveals() {
    var reveals = document.querySelectorAll('.reveal:not(.visible)');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) { entry.target.classList.add('visible'); io.unobserve(entry.target); }
        });
      }, { threshold: 0.12 });
      reveals.forEach(function(el) { io.observe(el); });
    } else {
      reveals.forEach(function(el) { el.classList.add('visible'); });
    }
  }
  observeReveals();

  // Навигация при скролле
  var nav = document.getElementById('landingNav');
  window.addEventListener('scroll', function() { nav.classList.toggle('scrolled', window.scrollY > 40); }, { passive: true });
  nav.classList.toggle('scrolled', window.scrollY > 40);

  // Плавный скролл
  document.querySelectorAll('.nav-links a[href^="#"]').forEach(function(a) {
    a.addEventListener('click', function(e) {
      var target = document.getElementById(a.getAttribute('href').slice(1));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  // Отзывы
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function stars(n) {
    var h = '';
    for (var i = 1; i <= 5; i++) h += (i <= n) ? Icons.starFill(18) : Icons.svg('star', 18);
    return h;
  }

  fetch('http://localhost:8000/api/reviews').then(function(r) { return r.json(); }).then(function(reviews) {
    if (!reviews || !reviews.length) {
      document.getElementById('reviewsGrid').innerHTML = '<div class="empty-review"><p>Пока нет отзывов</p></div>';
      return;
    }
    document.getElementById('reviewsGrid').innerHTML = reviews.map(function(rv, i) {
      var date = rv.created_at ? parseUTC(rv.created_at).toLocaleDateString('ru-RU') : '';
      var init = (rv.author_name || '?').split(' ').slice(0, 2).map(function(s) { return s[0]; }).join('').toUpperCase();
      return '<div class="review-card reveal delay-' + ((i % 4) + 1) + '">' +
        '<div class="review-stars">' + stars(rv.rating) + '</div>' +
        '<p class="review-text">' + esc(rv.text) + '</p>' +
        '<div class="review-author"><div class="review-avatar">' + init + '</div>' +
        '<div><strong>' + esc(rv.author_name) + '</strong>' + (date ? '<span class="review-date">' + date + '</span>' : '') + '</div></div></div>';
    }).join('');
    observeReveals();
  }).catch(function() {
    var demo = [
      { author_name: 'Алексей М.', rating: 5, text: 'Занимаюсь полгода — результаты отличные!' },
      { author_name: 'Мария К.', rating: 5, text: 'Удобное приложение, вижу прогресс в графиках.' },
      { author_name: 'Дмитрий В.', rating: 4, text: 'Хороший сервис, нравится система уведомлений.' },
    ];
    document.getElementById('reviewsGrid').innerHTML = demo.map(function(rv, i) {
      return '<div class="review-card reveal delay-' + ((i % 4) + 1) + '">' +
        '<div class="review-stars">' + stars(rv.rating) + '</div>' +
        '<p class="review-text">' + esc(rv.text) + '</p>' +
        '<div class="review-author"><div class="review-avatar">' + rv.author_name[0] + '</div>' +
        '<div><strong>' + esc(rv.author_name) + '</strong></div></div></div>';
    }).join('');
    observeReveals();
  });
})();
