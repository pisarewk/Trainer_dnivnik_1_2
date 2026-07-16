/* client.js — кабинет клиента */
var Client = {
  clientId: null,

  init: function() {
    var session = requireAuth('client');
    if (!session) return;
    this.clientId = session.client_id;

    Theme.init();
    document.getElementById('themeToggle').addEventListener('click', function() { Theme.toggle(); });
    document.getElementById('userName').textContent = session.full_name || 'Клиент';

    document.getElementById('mobileMenuBtn').innerHTML = Icons.svg('menu', 22);
    document.getElementById('bellIcon').innerHTML = Icons.svg('bell', 22);
    document.getElementById('logoutBtn').innerHTML = Icons.svg('logout', 16) + ' Выйти';
    document.getElementById('ic-home').innerHTML = Icons.svg('home');
    document.getElementById('ic-booking').innerHTML = Icons.svg('calendar');
    document.getElementById('ic-profile').innerHTML = Icons.svg('user');
    document.getElementById('ic-trainings').innerHTML = Icons.svg('dumbbell');
    document.getElementById('ic-weekly').innerHTML = Icons.svg('chart');
    document.getElementById('ic-measurements').innerHTML = Icons.svg('ruler');
    document.getElementById('ic-stats').innerHTML = Icons.svg('chart');
    document.getElementById('ic-records').innerHTML = Icons.svg('award');
    document.getElementById('ic-leaderboard').innerHTML = Icons.svg('trophy');

    var self = this;
    document.querySelectorAll('.sidebar a[data-view]').forEach(function(a) {
      a.addEventListener('click', function(e) { e.preventDefault(); self.navigate(a.dataset.view); });
    });
    document.getElementById('logoutBtn').addEventListener('click', function(e) {
      e.preventDefault(); Token.clear(); location.href = 'login.html';
    });
    document.querySelectorAll('[data-close]').forEach(function(b) {
      b.addEventListener('click', function() { self.closeModal(); });
    });
    document.getElementById('modalOverlay').addEventListener('click', function(e) {
      if (e.target.id === 'modalOverlay') self.closeModal();
    });
    document.querySelectorAll('[data-notif-close]').forEach(function(b) {
      b.addEventListener('click', function() { document.getElementById('notifOverlay').classList.remove('open'); });
    });
    document.getElementById('notifOverlay').addEventListener('click', function(e) {
      if (e.target.id === 'notifOverlay') e.target.classList.remove('open');
    });
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
      self.toggleSidebar();
    });
    document.querySelectorAll('.sidebar a').forEach(function(a) {
      a.addEventListener('click', function() { self.closeSidebar(); });
    });

    // Восстановление последней view после перезагрузки
    var savedView = localStorage.getItem('fc_client_view') || 'home';
    this.navigate(savedView);
  },

  navigate: function(view) {
    localStorage.setItem('fc_client_view', view);
    this.closeSidebar();
    var self = this;
    document.querySelectorAll('.sidebar a[data-view]').forEach(function(a) {
      a.classList.toggle('active', a.dataset.view === view);
    });
    var views = {
      home: function() { self.renderHome(); },
      booking: function() { self.renderBooking(); },
      profile: function() { self.renderProfile(); },
      trainings: function() { self.renderTrainings(); },
      weekly: function() { WeeklyTracker.renderClientView(); },
      measurements: function() { self.renderMeasurements(); },
      stats: function() { self.renderStats(); },
      records: function() { self.renderRecords(); },
      leaderboard: function() { self.renderLeaderboard(); },
    };
    if (views[view]) views[view]();
  },

  renderHome: function() {
    var main = document.getElementById('mainContent');
    var name = (Token.getSession() || {}).full_name || '';
    main.innerHTML = '<h1 class="page-title">Привет, ' + this.esc(name) + '!</h1><p class="page-subtitle">Ваш прогресс</p>' +
      '<div id="homeLevel"></div><div id="homeSessions"></div>' +
      '<div class="stat-grid">' +
      '<div class="stat-card"><div class="stat-value" id="hRank">...</div><div class="stat-label">Рейтинг</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="hTrainings">...</div><div class="stat-label">Тренировок</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="hRecords">...</div><div class="stat-label">Рекордов</div></div></div>' +
      '<div class="card"><h3 style="margin-bottom:14px;">Последние тренировки</h3><div id="hRecent"></div></div>';
    var self = this;
    Promise.all([API.clientRanking(this.clientId), API.records(this.clientId), API.trainings(this.clientId), API.attendance(this.clientId)]).then(function(arr) {
      var rank = arr[0], recs = arr[1], trainings = arr[2], att = arr[3];
      document.getElementById('homeLevel').innerHTML = self.xpCard(rank);
      document.getElementById('hRank').textContent = '#' + rank.rank;
      document.getElementById('hTrainings').textContent = att.total;
      document.getElementById('hRecords').textContent = recs.length;
      var recent = trainings.slice(0, 4);
      var el = document.getElementById('hRecent');
      el.innerHTML = recent.length ? recent.map(function(t) {
        return '<div class="training-entry" onclick="Client.viewTraining(' + t.id + ')">' +
          '<div class="te-head"><div class="te-date">' + Icons.svg('calendar', 18) + ' ' + fmtDate(t.training_date) + '</div>' +
          (t.well_being ? '<span class="badge badge-success">' + t.well_being + '</span>' : '') + '</div>' +
          (t.comment ? '<div class="te-comment">' + self.esc(t.comment) + '</div>' : '') + '</div>';
      }).join('') : '<p class="text-muted">Тренировок пока нет</p>';
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
    API.me().then(function(me) {
      var ps = me.paid_sessions || 0;
      var badge = ps > 0
        ? '<span class="sessions-badge has-sessions">' + Icons.svg('card', 16) + ' Осталось ' + ps + '</span>'
        : '<span class="sessions-badge no-sessions">Нет оплаченных</span>';
      document.getElementById('homeSessions').innerHTML = '<div class="card" style="margin-bottom:18px;">' + badge + '</div>';
    }).catch(function(){});
  },

  xpCard: function(rank) {
    return '<div class="card level-card"><div class="level-badge">Ур. ' + rank.level + '</div>' +
      '<div class="level-body"><span class="level-title">' + this.esc(rank.title) + '</span>' +
      '<div class="xp-bar-wrap"><div class="xp-bar" style="width:' + rank.progress_pct + '%"></div></div>' +
      '<div class="xp-text">' + rank.xp_in_level + ' / ' + rank.xp_for_next + ' XP - всего ' + rank.total_xp + '</div></div></div>';
  },

  renderBooking: function() {
    var main = document.getElementById('mainContent');
    var today = new Date().toISOString().slice(0, 10);
    main.innerHTML = '<h1 class="page-title">' + Icons.svg('calendar', 26) + ' Записаться на тренировку</h1>' +
      '<p class="page-subtitle">Выберите дату и свободное время</p>' +
      '<div class="card" style="max-width:600px;">' +
      '<div class="field"><label>Дата</label><input type="date" class="input" id="bookDate" value="' + today + '" min="' + today + '" onchange="Client.loadSlots()"></div>' +
      '<div id="slotsArea"><p class="text-muted">Выберите дату выше</p></div>' +
      '<div class="field" style="margin-top:16px;"><label>Комментарий (необязательно)</label><textarea class="input" id="bookNote" placeholder="Дополнительно..."></textarea></div>' +
      '<button class="btn btn-primary" id="bookBtn" onclick="Client.doBook()" disabled>' + Icons.svg('check', 16) + ' Записаться</button>' +
      '</div>' +
      '<div class="card" style="margin-top:20px;"><h3 style="margin-bottom:14px;">Мои записи</h3><div id="myBookings"><div class="spinner"></div></div></div>';
    this.loadSlots();
    this.loadMyBookings();
  },

  loadSlots: function() {
    var d = document.getElementById('bookDate').value;
    if (!d) return;
    var el = document.getElementById('slotsArea');
    el.innerHTML = '<div class="spinner"></div>';
    API.availableSlots(d).then(function(slots) {
      if (!slots.length) {
        el.innerHTML = '<p class="text-muted" style="padding:16px;text-align:center;">В этот день тренер не работает. Выберите другую дату.</p>';
        return;
      }
      var available = slots.filter(function(s) { return s.available; });
      if (!available.length) {
        el.innerHTML = '<p class="text-muted" style="padding:16px;text-align:center;">На эту дату всё занято. Выберите другую дату.</p>';
        return;
      }
      var html = '<div class="tp-grid">';
      available.forEach(function(s) {
        html += '<button class="tp-btn slot-btn" onclick="Client.selectSlot(\'' + s.time + '\')" data-time="' + s.time + '">' + s.time + '</button>';
      });
      html += '</div>';
      el.innerHTML = html;
    }).catch(function(e) { el.innerHTML = '<p class="text-muted">Ошибка: ' + e.message + '</p>'; });
  },

  selectSlot: function(time) {
    document.querySelectorAll('.slot-btn').forEach(function(b) { b.classList.remove('selected'); });
    var btn = document.querySelector('.slot-btn[data-time="' + time + '"]');
    if (btn) btn.classList.add('selected');
    this._selectedSlot = time;
    document.getElementById('bookBtn').disabled = false;
  },

  doBook: function() {
    var d = document.getElementById('bookDate').value;
    var t = this._selectedSlot;
    var note = document.getElementById('bookNote').value;
    if (!d || !t) { toast('Выберите дату и время', '', 'error'); return; }
    var self = this;
    API.bookSession({ session_date: d, session_time: t, note: note }).then(function(r) {
      toast('Запись создана!', 'Ожидает подтверждения тренера', 'success');
      self.renderBooking();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  loadMyBookings: function() {
    var self = this;
    API.calendarSessions('').then(function(list) {
      var el = document.getElementById('myBookings');
      if (!el) return;
      if (!list.length) { el.innerHTML = '<p class="text-muted">Записей нет</p>'; return; }
      list.sort(function(a, b) {
        var da = a.session_date, db = b.session_date;
        if (da < db) return 1; if (da > db) return -1; return 0;
      });
      el.innerHTML = list.map(function(s) {
        var badge = '';
        var dim = '';
        if (s.status === 'pending') badge = '<span class="badge" style="background:#fff3cd;color:#b8860b;">Ожидает</span>';
        else if (s.status === 'confirmed') badge = '<span class="badge badge-success">Подтверждена</span>';
        else if (s.status === 'reschedule') badge = '<span class="badge" style="background:#e5f2ff;color:#2e6da4;">Перенос</span>';
        else if (s.status === 'cancelled') { badge = '<span class="badge" style="background:#fde8e8;color:#c53030;">Отменена</span>'; dim = ' style="opacity:0.6;"'; }
        else if (s.status === 'completed') { badge = '<span class="badge badge-success">Проведена</span>'; dim = ' style="opacity:0.6;"'; }
        var actions = '';
        if (s.status === 'pending' || s.status === 'confirmed') {
          actions = '<button class="btn btn-danger btn-sm" style="margin-top:8px;" onclick="Client.cancelBooking(' + s.id + ')">' + Icons.svg('x', 14) + ' Отменить</button>';
        }
        if (s.status === 'confirmed') {
          actions += ' <button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="Client.requestReschedule(' + s.id + ')">Перенести</button>';
        }
        return '<div class="training-entry"' + dim + '>' +
          '<div class="te-head"><div class="te-date">' + Icons.svg('calendar', 18) + ' ' + fmtDate(s.session_date) + (s.session_time ? ' в ' + s.session_time : '') + '</div>' + badge + '</div>' +
          (s.note ? '<div class="te-comment">' + self.esc(s.note) + '</div>' : '') +
          (s.reschedule_request ? '<div class="te-comment">Перенос: ' + self.esc(s.reschedule_request) + '</div>' : '') +
          actions +
          '</div>';
      }).join('');
    }).catch(function() {});
  },

  cancelBooking: function(id) {
    if (!confirm('Отменить запись? Тренер получит уведомление.')) return;
    var self = this;
    API.cancelSession(id, 'Отменено клиентом').then(function() { toast('Отменено', '', 'success'); self.loadMyBookings(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  requestReschedule: function(id) {
    var reason = prompt('Почему нужно перенести? Опишите желаемое время:');
    if (!reason) return;
    var self = this;
    API.rescheduleSession(id, { request: reason }).then(function() { toast('Запрос отправлен', 'Тренер увидит ваш запрос', 'success'); self.loadMyBookings(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderProfile: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="spinner"></div>';
    var self = this;
    API.client(this.clientId).then(function(c) {
      main.innerHTML = '<h1 class="page-title">Моя анкета</h1>' +
        '<div class="card"><form id="profileForm">' +
        '<div class="field"><label>ФИО</label><input class="input" name="full_name" value="' + self.esc(c.full_name || '') + '"></div>' +
        '<div class="field"><label>Телефон</label><input class="input" name="phone" value="' + self.esc(c.phone || '') + '"></div>' +
        '<div class="field"><label>Цель</label><textarea class="input" name="goal">' + self.esc(c.goal || '') + '</textarea></div>' +
        '<div class="field"><label>Новый пароль</label><input class="input" type="password" name="password"></div>' +
        '<button type="button" class="btn btn-primary" onclick="Client.saveProfile()">Сохранить</button></form></div>';
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  saveProfile: function() {
    var fd = new FormData(document.getElementById('profileForm'));
    var data = {};
    for (var p of fd.entries()) { if (p[0] === 'password') { if (p[1]) data.password = p[1]; } else data[p[0]] = p[1] || null; }
    API.updateOwnProfile(this.clientId, data).then(function() { toast('Сохранено', '', 'success'); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderTrainings: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Тренировки</h1><div id="trList"><div class="spinner"></div></div>';
    var self = this;
    API.trainings(this.clientId).then(function(list) {
      var el = document.getElementById('trList');
      if (!list.length) { el.innerHTML = '<div class="empty-state"><h3>Тренировок нет</h3></div>'; return; }

      var html = '';
      // Кнопка отзыва после 10 тренировок
      if (list.length >= 10) {
        html += '<div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">' +
          Icons.svg('star', 22) + '<div style="flex:1;"><b>Напишите отзыв!</b><br><span class="text-muted" style="font-size:13px;">Вы прошли ' + list.length + ' тренировок</span></div>' +
          '<button class="btn btn-primary btn-sm" onclick="Client.openReviewModal()">Оставить отзыв</button></div>';
      }

      html += list.map(function(t) {
        var rateHtml = '';
        if (t.rating) {
          var stars = '';
          for (var s = 1; s <= 5; s++) stars += s <= t.rating ? Icons.svg('star', 14) : '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
          var diffMap = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' };
          var diffColor = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
          var sleepColor = t.sleep_hours != null && t.sleep_hours < 7 ? '#ef4444' : '#22c55e';
          rateHtml = '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
            '<span style="color:#f59e0b;">' + stars + '</span>' +
            (t.difficulty ? '<span class="badge" style="background:' + (diffColor[t.difficulty] || '#999') + '20;color:' + (diffColor[t.difficulty] || '#999') + ';">' + (diffMap[t.difficulty] || t.difficulty) + '</span>' : '') +
            (t.sleep_hours != null ? '<span class="badge" style="background:' + sleepColor + '20;color:' + sleepColor + ';">Сон: ' + t.sleep_hours + 'ч</span>' : '') +
            '</div>' +
            (t.client_comment ? '<div class="te-comment">' + self.esc(t.client_comment) + '</div>' : '');
        } else {
          rateHtml = '<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="event.stopPropagation();Client.openRateModal(' + t.id + ')">Оценить тренировку</button>';
        }
        return '<div class="training-entry" onclick="Client.viewTraining(' + t.id + ')">' +
          '<div class="te-head"><div class="te-date">' + Icons.svg('calendar', 18) + ' ' + fmtDate(t.training_date) + '</div>' +
          (t.well_being ? '<span class="badge badge-success">' + t.well_being + '</span>' : '') + '</div>' +
          '<div class="text-muted" style="font-size:14px;">Упражнений: ' + t.exercises.length + '</div>' +
          (t.comment ? '<div class="te-comment">' + self.esc(t.comment) + '</div>' : '') +
          rateHtml + '</div>';
      }).join('');
      el.innerHTML = html;
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  _rateDifficulty: null,
  _rateRating: 0,

  openRateModal: function(trainingId) {
    var self = this;
    this._rateDifficulty = null;
    this._rateRating = 0;
    this.openModal('Оценить тренировку',
      '<div class="rate-section"><label>Сложность</label>' +
        '<div class="rate-difficulty">' +
          '<button type="button" class="rd-btn" data-d="easy" onclick="Client.pickDiff(\'easy\')">Легко</button>' +
          '<button type="button" class="rd-btn" data-d="medium" onclick="Client.pickDiff(\'medium\')">Средне</button>' +
          '<button type="button" class="rd-btn" data-d="hard" onclick="Client.pickDiff(\'hard\')">Сложно</button>' +
        '</div></div>' +
      '<div class="rate-section"><label>Оценка</label>' +
        '<div class="rate-stars" id="rateStars">' +
          [1,2,3,4,5].map(function(n) { return '<button type="button" class="rs-btn" data-n="' + n + '" onclick="Client.pickStar(' + n + ')">' + Icons.svg('star', 28) + '</button>'; }).join('') +
        '</div></div>' +
      '<div class="rate-section"><label>Сколько часов спали? <span id="sleepLabel" style="color:var(--text-muted);">—</span></label>' +
        '<input type="range" class="rate-slider" id="rateSleep" min="0" max="12" step="0.5" value="7" oninput="Client.onSleep(this.value)">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);"><span>0ч</span><span style="color:#22c55e;">7ч (норма)</span><span>12ч</span></div>' +
      '</div>' +
      '<div class="rate-section"><label>Комментарий</label>' +
        '<textarea class="input" id="rateComment" rows="2" placeholder="Как прошло?"></textarea>' +
      '</div>',
      '<button class="btn btn-danger" data-close>Отмена</button>' +
      '<button class="btn btn-success" onclick="Client.saveRate(' + trainingId + ')">Сохранить</button>'
    );
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) {
      b.addEventListener('click', function() { self.closeModal(); });
    });
    this.onSleep(7);
  },

  pickDiff: function(d) {
    this._rateDifficulty = d;
    document.querySelectorAll('.rd-btn').forEach(function(b) { b.classList.remove('selected'); });
    document.querySelector('.rd-btn[data-d="' + d + '"]').classList.add('selected');
  },

  pickStar: function(n) {
    this._rateRating = n;
    document.querySelectorAll('.rs-btn').forEach(function(b, i) {
      b.classList.toggle('active', i < n);
    });
  },

  onSleep: function(v) {
    var lbl = document.getElementById('sleepLabel');
    var val = parseFloat(v);
    if (lbl) {
      lbl.textContent = val + ' ч';
      lbl.style.color = val < 7 ? '#ef4444' : '#22c55e';
    }
  },

  saveRate: function(trainingId) {
    var data = {
      difficulty: this._rateDifficulty,
      rating: this._rateRating || null,
      sleep_hours: parseFloat(document.getElementById('rateSleep').value) || null,
      client_comment: document.getElementById('rateComment').value || null,
    };
    if (!data.difficulty && !data.rating) { toast('Выберите сложность или оценку', '', 'error'); return; }
    var self = this;
    API.rateTraining(trainingId, data).then(function() {
      toast('Сохранено', 'Спасибо за оценку!', 'success');
      self.closeModal();
      self.renderTrainings();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openReviewModal: function() {
    var self = this;
    this.openModal('Отзыв о тренере',
      '<div class="rate-section"><label>Оценка</label>' +
        '<div class="rate-stars" id="revStars">' +
          [1,2,3,4,5].map(function(n) { return '<button type="button" class="rs-btn" data-n="' + n + '" onclick="Client.pickRevStar(' + n + ')">' + Icons.svg('star', 28) + '</button>'; }).join('') +
        '</div></div>' +
      '<div class="rate-section"><label>Ваш отзыв</label>' +
        '<textarea class="input" id="revText" rows="4" placeholder="Расскажите о своих впечатлениях..."></textarea>' +
      '</div>',
      '<button class="btn btn-danger" data-close>Отмена</button>' +
      '<button class="btn btn-success" onclick="Client.saveReview()">Отправить</button>'
    );
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) {
      b.addEventListener('click', function() { self.closeModal(); });
    });
    this._revRating = 0;
  },

  pickRevStar: function(n) {
    this._revRating = n;
    document.querySelectorAll('#revStars .rs-btn').forEach(function(b, i) {
      b.classList.toggle('active', i < n);
    });
  },

  saveReview: function() {
    if (!this._revRating) { toast('Поставьте оценку', '', 'error'); return; }
    var text = document.getElementById('revText').value.trim();
    if (!text) { toast('Напишите текст отзыва', '', 'error'); return; }
    var self = this;
    API.createReview({ author_name: (Token.getSession() || {}).full_name || 'Клиент', rating: this._revRating, text: text }).then(function() {
      toast('Отправлено', 'Отзыв появится после одобрения тренера', 'success');
      self.closeModal();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  viewTraining: function(id) {
    var self = this;
    API.training(id).then(function(t) {
      API.exerciseSummary(t.client_id).then(function(summary) {
        var sumMap = {};
        summary.forEach(function(s) { sumMap[s.exercise] = s; });
        var exs = t.exercises.length ? t.exercises.map(function(e) {
          var s = sumMap[e.name];
          var progHtml = '';
          if (s && e.weight) {
            var icon = '', delta = '', cls = '';
            if (s.trend === 'up') { icon = Icons.svg('trendup', 14); cls = 'badge-success'; delta = '+' + s.delta + ' кг'; }
            else if (s.trend === 'down') { icon = '<span style="color:var(--danger);">↓</span>'; delta = s.delta + ' кг'; }
            else { icon = '<span style="color:var(--text-muted);">→</span>'; delta = 'стабильно'; }
            progHtml = '<br><small class="' + cls + '">' + icon + ' ' + delta + ' • лучший: ' + s.best_weight + ' кг • ' + s.sessions + ' зап.</small>';
          }
          return '<tr><td><strong>' + self.esc(e.name) + '</strong>' + progHtml + '</td>' +
            '<td>' + (e.weight ? e.weight + ' кг' : '—') + '</td>' +
            '<td>' + (e.reps || '—') + '</td><td>' + (e.sets_count || '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="4">Нет</td></tr>';
        var weightHtml = t.body_weight
          ? '<div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">' +
            Icons.svg('activity', 28) + '<div><div class="pf-label">Вес тела</div>' +
            '<div style="font-size:22px;font-weight:800;color:var(--primary);">' + t.body_weight + ' кг</div></div></div>' : '';
        self.openModal('Тренировка ' + fmtDate(t.training_date),
          weightHtml +
          '<div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th></tr></thead><tbody>' + exs + '</tbody></table></div>' +
          (t.comment ? '<div class="comment-block">' + self.esc(t.comment) + '</div>' : ''),
          '<button class="btn btn-ghost" data-close>Закрыть</button>');
        document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
      }).catch(function() {
        var exs = t.exercises.length ? t.exercises.map(function(e) {
          return '<tr><td>' + self.esc(e.name) + '</td><td>' + (e.weight || '—') + '</td><td>' + (e.reps || '—') + '</td><td>' + (e.sets_count || '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="4">Нет</td></tr>';
        self.openModal('Тренировка ' + fmtDate(t.training_date),
          (t.body_weight ? '<div class="comment-block"><strong>Вес тела: ' + t.body_weight + ' кг</strong></div>' : '') +
          '<div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th></tr></thead><tbody>' + exs + '</tbody></table></div>' +
          (t.comment ? '<div class="comment-block">' + self.esc(t.comment) + '</div>' : ''),
          '<button class="btn btn-ghost" data-close>Закрыть</button>');
        document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
      });
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderMeasurements: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="flex-between"><div><h1 class="page-title">Замеры</h1></div>' +
      '<button class="btn btn-primary" onclick="Client.openMeasurementModal()">' + Icons.svg('plus', 16) + ' Добавить</button></div>' +
      '<div class="table-wrap"><table id="cMeasTable"><thead></thead><tbody></tbody></table></div>';
    var self = this;
    API.measurements(this.clientId).then(function(data) {
      var cols = [['Дата','measure_date',fmtDate],['Вес','weight'],['Талия','waist'],['Грудь','chest'],['Бедро','thigh']];
      document.querySelector('#cMeasTable thead').innerHTML = '<tr>' + cols.map(function(c){return '<th>'+c[0]+'</th>';}).join('') + '<th></th></tr>';
      var tbody = data.length ? data.map(function(m) {
        return '<tr>' + cols.map(function(c){ return '<td>' + (c[2] ? c[2](m[c[1]]) : (m[c[1]] || '—')) + '</td>'; }).join('') +
          '<td><button class="btn btn-danger btn-sm" onclick="Client.delMeasurement(' + m.id + ')">' + Icons.svg('trash',14) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty-state">Замеров нет</td></tr>';
      document.querySelector('#cMeasTable tbody').innerHTML = tbody;
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openMeasurementModal: function() {
    var today = new Date().toISOString().slice(0, 10);
    this.openModal('Новый замер',
      '<form id="cMeasForm"><div class="field"><label>Дата</label><input type="date" class="input" name="measure_date" value="' + today + '" required></div>' +
      '<div class="grid grid-2"><div class="field"><label>Вес</label><input type="number" step="0.1" class="input" name="weight"></div>' +
      '<div class="field"><label>Талия</label><input type="number" step="0.1" class="input" name="waist"></div>' +
      '<div class="field"><label>Грудь</label><input type="number" step="0.1" class="input" name="chest"></div>' +
      '<div class="field"><label>Бедро</label><input type="number" step="0.1" class="input" name="thigh"></div></div></form>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Client.saveMeasurement()">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  saveMeasurement: function() {
    var fd = new FormData(document.getElementById('cMeasForm'));
    var data = { client_id: this.clientId, measure_date: fd.get('measure_date'), weight: fd.get('weight') ? Number(fd.get('weight')) : null, waist: fd.get('waist') ? Number(fd.get('waist')) : null, chest: fd.get('chest') ? Number(fd.get('chest')) : null, thigh: fd.get('thigh') ? Number(fd.get('thigh')) : null };
    var self = this;
    API.createMeasurement(data).then(function() { toast('Добавлен', '', 'success'); self.closeModal(); self.renderMeasurements(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  delMeasurement: function(id) {
    if (!confirm('Удалить?')) return;
    var self = this;
    API.deleteMeasurement(id).then(function() { toast('Удалено', '', 'success'); self.renderMeasurements(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderStats: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Прогресс</h1><div id="statsContent"><div class="spinner"></div></div>';
    var self = this;
    Promise.all([API.attendance(this.clientId), API.weightProgress(this.clientId), API.exerciseSummary(this.clientId)]).then(function(arr) {
      var att = arr[0], weight = arr[1], exSum = arr[2];
      var html = '<div class="stat-grid"><div class="stat-card"><div class="stat-value">' + att.total + '</div><div class="stat-label">Всего</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + att.month + '</div><div class="stat-label">За месяц</div></div></div>';
      if (weight.length > 1) html += '<div class="chart-box"><h3>Динамика веса тела</h3><canvas id="cWChart" class="chart-canvas"></canvas></div>';
      if (exSum && exSum.length) {
        html += '<div class="card"><h3 style="margin-bottom:14px;">Прогресс по упражнениям</h3>' +
          '<div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>Упражнение</th><th>Последний</th><th>Лучший</th><th>Динамика</th></tr></thead><tbody>';
        exSum.forEach(function(s) {
          var trendIcon = s.trend === 'up' ? Icons.svg('trendup', 16) : (s.trend === 'down' ? '<span style="color:var(--danger);">↓</span>' : '<span style="color:var(--text-muted);">→</span>');
          var deltaTxt = s.delta != null ? (s.delta > 0 ? '+' : '') + s.delta + ' кг' : '—';
          var trendCls = s.trend === 'up' ? 'badge-success' : '';
          html += '<tr><td><strong>' + self.esc(s.exercise) + '</strong></td>' +
            '<td>' + (s.last_weight || '—') + ' кг</td>' +
            '<td>' + (s.best_weight || '—') + ' кг</td>' +
            '<td><span class="' + trendCls + '">' + trendIcon + ' ' + deltaTxt + '</span></td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      document.getElementById('statsContent').innerHTML = html;
      if (weight.length > 1) Charts.line('cWChart', weight.map(function(w){return fmtDate(w.date);}), [{label:'Вес', data: weight.map(function(w){return w.weight;}), color:'#2ecc71'}]);
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderRecords: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Рекорды</h1><div class="records-grid" id="cRecGrid"><div class="spinner"></div></div>';
    var self = this;
    API.records(this.clientId).then(function(recs) {
      var grid = document.getElementById('cRecGrid');
      if (!recs.length) { grid.innerHTML = '<div class="empty-state"><h3>Рекордов нет</h3></div>'; return; }
      grid.innerHTML = recs.map(function(r) {
        return '<div class="record-card"><div class="rec-name">' + self.esc(r.exercise) + '</div>' +
          (r.best_weight ? '<div class="rec-row"><span>Вес</span><span class="rec-val">' + r.best_weight + ' кг</span></div>' : '') +
          (r.best_reps ? '<div class="rec-row"><span>Повторы</span><span class="rec-val">' + r.best_reps + '</span></div>' : '') + '</div>';
      }).join('');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderLeaderboard: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Рейтинг</h1><div id="cLbList"><div class="spinner"></div></div>';
    var self = this;
    API.leaderboard().then(function(list) {
      var myId = self.clientId;
      var el = document.getElementById('cLbList');
      el.innerHTML = list.map(function(e) {
        return '<div class="lb-row ' + (e.client_id === myId ? 'lb-row-me' : '') + '">' +
          '<div class="lb-rank ' + (e.rank <= 3 ? 'lb-rank-top lb-rank-' + e.rank : '') + '">' + e.rank + '</div>' +
          '<div class="lb-avatar">' + initials(e.full_name) + '</div>' +
          '<div class="lb-info"><div class="lb-name">' + self.esc(e.full_name) + (e.client_id === myId ? ' (Вы)' : '') + '</div>' +
          '<div class="lb-meta">Ур. ' + e.level + ' - ' + e.workouts_count + ' трен.</div></div>' +
          '<div class="lb-xp"><span class="lb-xp-val">' + e.total_xp + '</span><span class="lb-xp-label">XP</span></div></div>';
      }).join('');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openModal: function(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('open');
  },

  closeModal: function() { document.getElementById('modalOverlay').classList.remove('open'); },

  esc: function(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

  toggleSidebar: function() {
    var sb = document.getElementById('sidebar');
    if (!sb.querySelector('.sb-mobile-header')) {
      var hd = document.createElement('div');
      hd.className = 'sb-mobile-header';
      hd.innerHTML = '<button class="sb-close-btn" onclick="Client.closeSidebar()">' + Icons.svg('menu', 20) + '</button>' +
        '<span class="sb-logo"><svg class="logo-mark" viewBox="0 0 40 40" width="24" height="24"><defs><linearGradient id="lg2" x1="0" y1="0" x2="40" y2="40"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs><path d="M20 3 L34 11 L34 27 L20 37 L6 27 L6 11 Z" fill="url(#lg2)" fill-opacity="0.1" stroke="url(#lg2)" stroke-width="2.5" stroke-linejoin="round"/><g fill="url(#lg2)"><rect x="8" y="15" width="3.5" height="10" rx="1.5"/><rect x="12" y="16.5" width="2.5" height="7" rx="1"/><rect x="25.5" y="16.5" width="2.5" height="7" rx="1"/><rect x="28.5" y="15" width="3.5" height="10" rx="1.5"/></g><rect x="14" y="19" width="12" height="2.5" rx="1" fill="url(#lg2)"/></svg>Cross<span>Coach</span></span>';
      sb.insertBefore(hd, sb.firstChild);
    }
    var isOpen = sb.classList.toggle('mobile-open');
    document.body.classList.toggle('sb-open', isOpen);
  },

  closeSidebar: function() {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.body.classList.remove('sb-open');
  }
};

document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('sidebar') && location.pathname.indexOf('client-dashboard') >= 0) {
    Client.init();
  }
});
