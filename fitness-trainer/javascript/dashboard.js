/* dashboard.js — кабинет тренера */
var Trainer = {
  currentClient: null,

  init: function() {
    var session = requireAuth('trainer');
    if (!session) return;

    Theme.init();
    document.getElementById('themeToggle').addEventListener('click', function() { Theme.toggle(); });
    document.getElementById('userName').textContent = session.full_name || 'Тренер';

    // События ДО иконок (критично — если иконки упадут, меню всё равно работает)
    var self = this;
    document.getElementById('mobileMenuBtn').addEventListener('click', function() {
      self.toggleSidebar();
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

    // Навигация
    document.querySelectorAll('.sidebar a[data-view]').forEach(function(a) {
      a.addEventListener('click', function(e) { e.preventDefault(); self.navigate(a.dataset.view); });
    });
    var addLink = document.querySelector('.sidebar a[data-action="add-client"]');
    if (addLink) addLink.addEventListener('click', function(e) { e.preventDefault(); self.openClientModal(); });
    document.querySelectorAll('.sidebar a').forEach(function(a) {
      a.addEventListener('click', function() { self.closeSidebar(); });
    });

    // Иконки (после всех handler'ов)
    try {
      document.getElementById('mobileMenuBtn').innerHTML = Icons.svg('menu', 22);
      document.getElementById('bellIcon').innerHTML = Icons.svg('bell', 22);
      document.getElementById('logoutBtn').innerHTML = Icons.svg('logout', 16) + ' Выйти';
      document.getElementById('ic-overview').innerHTML = Icons.svg('home');
      document.getElementById('ic-clients').innerHTML = Icons.svg('users');
      document.getElementById('ic-calendar').innerHTML = Icons.svg('calendar');
      document.getElementById('ic-templates').innerHTML = Icons.svg('clipboard');
      document.getElementById('ic-analytics').innerHTML = Icons.svg('chart');
      document.getElementById('ic-earnings').innerHTML = Icons.svg('card');
      document.getElementById('ic-leaderboard').innerHTML = Icons.svg('trophy');
      document.getElementById('ic-profile').innerHTML = Icons.svg('user');
      document.getElementById('ic-add').innerHTML = Icons.svg('plus');
    } catch(e) { console.warn('Icon setup error:', e); }

    // Восстановление последней view после перезагрузки
    var savedView = localStorage.getItem('fc_trainer_view') || 'overview';
    var savedClient = localStorage.getItem('fc_trainer_client');
    if (savedClient) this.currentClient = parseInt(savedClient);
    this.navigate(savedView);
  },

  openBookCell: function(date, time) {
    var self = this;
    this._bookTime = time;
    this._bookDate = date;
    API.clients().then(function(clients) {
      var opts = clients.map(function(c) {
        return '<option value="' + c.id + '">' + self.esc(c.full_name) + '</option>';
      }).join('');

      var hours = [];
      for (var h = 8; h <= 21; h++) hours.push((h < 10 ? '0' : '') + h + ':00');

      var timeGrid = hours.map(function(t) {
        var sel = t === time ? ' selected' : '';
        return '<button type="button" class="tp-btn' + sel + '" data-time="' + t + '" onclick="Trainer.pickTime(\'' + t + '\')">' + t + '</button>';
      }).join('');

      var dp = self._renderDatePicker(date);

      self.openModal('Новая запись',
        '<div class="field"><label>Клиент</label><select class="input" id="bcClient">' + opts + '</select></div>' +
        '<div class="field"><label>Дата</label>' + dp + '</div>' +
        '<div class="field"><label>Время</label>' +
          '<div class="time-picker">' +
            '<div class="tp-display" id="tpDisplay">' +
              '<input type="text" id="tpInput" class="tp-input" value="' + time + '" maxlength="5" placeholder="--:--" ' +
                'oninput="Trainer.onTimeInput(this.value)" onfocus="this.select()">' +
              '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '</div>' +
            '<div class="tp-grid">' + timeGrid + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="field"><label>Заметка</label><textarea class="input" id="bcNote" rows="2" placeholder="Необязательно..."></textarea></div>',
        '<button class="btn btn-danger" data-wk-close>Отмена</button>' +
        '<button class="btn btn-success" onclick="Trainer.saveBookCell()">' + Icons.svg('check', 16) + ' Записать</button>'
      );
      document.querySelectorAll('#modalFooter [data-wk-close]').forEach(function(b) {
        b.onclick = function() { self.closeModal(); };
      });
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  _renderDatePicker: function(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    var monthsShort = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
    var selDay = d.getDate();
    var selMonth = d.getMonth();
    var selYear = d.getFullYear();
    var daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();

    var today = new Date();
    var tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);

    var html = '<div class="date-picker">';

    // Дисплей
    html += '<div class="dp-display">' +
      '<span class="dp-val" id="dpVal">' + fmtDate(dateStr) + '</span>' +
      '</div>';

    // Быстрый выбор
    html += '<div class="dp-quick">' +
      '<button type="button" class="tp-btn" onclick="Trainer.pickDateQuick(\'' + today.toISOString().slice(0,10) + '\')">Сегодня</button>' +
      '<button type="button" class="tp-btn" onclick="Trainer.pickDateQuick(\'' + tomorrow.toISOString().slice(0,10) + '\')">Завтра</button>' +
      '</div>';

    // Месяц
    html += '<div class="dp-section"><div class="dp-label">Месяц</div><div class="dp-months">';
    for (var m = 0; m < 12; m++) {
      var msel = m === selMonth ? ' selected' : '';
      html += '<button type="button" class="tp-btn' + msel + '" data-month="' + m + '" onclick="Trainer.pickMonth(' + m + ')">' + monthsShort[m] + '</button>';
    }
    html += '</div></div>';

    // День
    html += '<div class="dp-section"><div class="dp-label">День</div><div class="dp-days">';
    for (var day = 1; day <= daysInMonth; day++) {
      var dsel = day === selDay ? ' selected' : '';
      html += '<button type="button" class="tp-btn' + dsel + '" data-day="' + day + '" onclick="Trainer.pickDay(' + day + ')">' + day + '</button>';
    }
    html += '</div></div>';

    // Год
    html += '<div class="dp-section"><div class="dp-label">Год</div><div class="dp-years">' +
      '<button type="button" class="tp-btn" onclick="Trainer.pickYear(-1)">' + Icons.svg('arrowleft',14) + '</button>' +
      '<span class="dp-year-val" id="dpYear">' + selYear + '</span>' +
      '<button type="button" class="tp-btn" onclick="Trainer.pickYear(1)">' + Icons.svg('arrowright',14) + '</button>' +
      '</div></div>';

    html += '</div>';
    return html;
  },

  _getDP: function() {
    var months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    var dayBtn = document.querySelector('.dp-days .tp-btn.selected');
    var monBtn = document.querySelector('.dp-months .tp-btn.selected');
    var yearEl = document.getElementById('dpYear');
    if (!dayBtn || !monBtn || !yearEl) return null;
    var day = parseInt(dayBtn.dataset.day);
    var mon = parseInt(monBtn.dataset.month);
    var year = parseInt(yearEl.textContent);
    return { day: day, month: mon, year: year, str: year + '-' + months[mon] + '-' + (day < 10 ? '0' + day : day) };
  },

  _updateDPDisplay: function() {
    var dp = this._getDP();
    if (!dp) return;
    this._bookDate = dp.str;
    var val = document.getElementById('dpVal');
    if (val) val.textContent = fmtDate(dp.str);
  },

  pickDay: function(day) {
    document.querySelectorAll('.dp-days .tp-btn').forEach(function(b) { b.classList.remove('selected'); });
    var btn = document.querySelector('.dp-days .tp-btn[data-day="' + day + '"]');
    if (btn) btn.classList.add('selected');
    this._updateDPDisplay();
  },

  pickMonth: function(m) {
    document.querySelectorAll('.dp-months .tp-btn').forEach(function(b) { b.classList.remove('selected'); });
    var btn = document.querySelector('.dp-months .tp-btn[data-month="' + m + '"]');
    if (btn) btn.classList.add('selected');
    // Обновить дни в новом месяце
    var yearEl = document.getElementById('dpYear');
    var year = parseInt(yearEl ? yearEl.textContent : new Date().getFullYear());
    var daysInMonth = new Date(year, m + 1, 0).getDate();
    var dayBtn = document.querySelector('.dp-days .tp-btn.selected');
    var selDay = dayBtn ? Math.min(parseInt(dayBtn.dataset.day), daysInMonth) : 1;
    var daysContainer = document.querySelector('.dp-days');
    if (daysContainer) {
      var html = '';
      for (var d = 1; d <= daysInMonth; d++) {
        html += '<button type="button" class="tp-btn' + (d === selDay ? ' selected' : '') + '" data-day="' + d + '" onclick="Trainer.pickDay(' + d + ')">' + d + '</button>';
      }
      daysContainer.innerHTML = html;
    }
    this._updateDPDisplay();
  },

  pickYear: function(delta) {
    var yearEl = document.getElementById('dpYear');
    if (!yearEl) return;
    var y = parseInt(yearEl.textContent) + delta;
    yearEl.textContent = y;
    // Обновить дни (для високосного февраля)
    var monBtn = document.querySelector('.dp-months .tp-btn.selected');
    var m = monBtn ? parseInt(monBtn.dataset.month) : 0;
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var dayBtn = document.querySelector('.dp-days .tp-btn.selected');
    var selDay = dayBtn ? Math.min(parseInt(dayBtn.dataset.day), daysInMonth) : 1;
    var daysContainer = document.querySelector('.dp-days');
    if (daysContainer) {
      var html = '';
      for (var d = 1; d <= daysInMonth; d++) {
        html += '<button type="button" class="tp-btn' + (d === selDay ? ' selected' : '') + '" data-day="' + d + '" onclick="Trainer.pickDay(' + d + ')">' + d + '</button>';
      }
      daysContainer.innerHTML = html;
    }
    this._updateDPDisplay();
  },

  pickDateQuick: function(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    this.pickMonth(d.getMonth());
    var self = this;
    setTimeout(function() {
      self.pickDay(d.getDate());
      var yearEl = document.getElementById('dpYear');
      if (yearEl) yearEl.textContent = d.getFullYear();
      self._updateDPDisplay();
    }, 10);
  },

  pickTime: function(t) {
    this._bookTime = t;
    var inp = document.getElementById('tpInput');
    if (inp) inp.value = t;
    document.querySelectorAll('.tp-btn').forEach(function(b) {
      b.classList.toggle('selected', b.dataset.time === t);
    });
  },

  onTimeInput: function(val) {
    val = val.replace(/[^\d:]/g, '');
    if (val.length === 2 && !val.includes(':')) val = val + ':';
    if (val.length > 5) val = val.slice(0, 5);
    var inp = document.getElementById('tpInput');
    if (inp) inp.value = val;
    if (/^\d{2}:\d{2}$/.test(val)) {
      this._bookTime = val;
      document.querySelectorAll('.tp-btn').forEach(function(b) {
        b.classList.toggle('selected', b.dataset.time === val);
      });
    }
  },

  saveBookCell: function() {
    var data = {
      client_id: parseInt(document.getElementById('bcClient').value),
      session_date: this._bookDate,
      session_time: this._bookTime || document.getElementById('tpInput').value,
      note: document.getElementById('bcNote').value || null,
    };
    var self = this;
    API.bookForClient(data).then(function(r) {
      toast('Записано', 'Клиент добавлен в расписание', 'success');
      self.closeModal();
      self.loadWeekGrid();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },


  navigate: function(view) {
    localStorage.setItem('fc_trainer_view', view);
    this.closeSidebar();
    var self = this;
    document.querySelectorAll('.sidebar a[data-view]').forEach(function(a) {
      a.classList.toggle('active', a.dataset.view === view);
    });
    var views = {
      overview: function() { self.renderOverview(); },
      clients: function() { self.renderClients(); },
      calendar: function() { self.renderCalendar(); },
      templates: function() { self.renderTemplates(); },
      analytics: function() { self.renderAnalytics(); },
      earnings: function() { self.renderEarnings(); },
      leaderboard: function() { self.renderLeaderboard(); },
      profile: function() { self.renderProfile(); },
      'client-profile': function() { self.renderClientProfile(); },
      'client-trainings': function() { self.renderClientTrainings(); },
      'client-weekly': function() {
        var cn = (self._clientName || '');
        if (self.currentClient) {
          API.client(self.currentClient).then(function(c) { self._clientName = c.full_name; WeeklyTracker.openForTrainer(self.currentClient, c.full_name); });
        }
      },
      'client-measurements': function() { self.renderClientMeasurements(); },
      'client-stats': function() { self.renderClientStats(); },
      'client-records': function() { self.renderClientRecords(); },
    };
    if (views[view]) views[view]();
  },

  // ===== ОБЗОР =====
  renderOverview: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Обзор</h1><p class="page-subtitle">Статистика по клиентам</p>' +
      '<div class="stat-grid" id="ovStats"><div class="stat-card"><div class="stat-value" id="sClients">...</div><div class="stat-label">Клиентов</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="sTrainings">...</div><div class="stat-label">Тренировок</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="sNotif">...</div><div class="stat-label">Уведомлений</div></div></div>' +
      '<div class="card"><h3 style="margin-bottom:16px;">Действия</h3>' +
      '<button class="btn btn-primary" onclick="Trainer.navigate(\'clients\')">Все клиенты</button> ' +
      '<button class="btn btn-ghost" onclick="Trainer.openClientModal()">Добавить клиента</button></div>';
    var self = this;
    API.clients().then(function(clients) {
      document.getElementById('sClients').textContent = clients.length;
      var total = 0;
      var done = 0;
      clients.forEach(function(c) {
        API.trainings(c.id).then(function(t) {
          total += t.length;
          done++;
          if (done >= clients.length) document.getElementById('sTrainings').textContent = total;
        }).catch(function(){ done++; });
      });
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
    API.unreadCount().then(function(d) {
      document.getElementById('sNotif').textContent = d.count;
    }).catch(function(){});
  },

  // ===== КЛИЕНТЫ =====
  renderClients: function(search) {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Клиенты</h1>' +
      '<div class="search-bar"><span class="search-icon">' + Icons.svg('search', 18) + '</span>' +
      '<input type="text" class="input" id="clientSearch" placeholder="Поиск..." value="' + (search || '') + '"></div>' +
      '<div class="flex-between" style="margin-bottom:18px;">' +
      '<span class="text-muted" id="clientCount"></span>' +
      '<div class="flex gap">' +
        '<button class="btn btn-ghost btn-sm" id="selectAllBtn" onclick="Trainer.toggleAllClients()">' + Icons.svg('check', 14) + ' Выбрать всех</button>' +
        '<button class="btn btn-danger btn-sm hidden" id="archiveBtn" onclick="Trainer.deleteSelected()">' + Icons.svg('trash', 14) + ' Удалить</button>' +
        '<button class="btn btn-primary btn-sm" onclick="Trainer.openClientModal()">' + Icons.svg('plus', 14) + ' Добавить</button>' +
      '</div></div>' +
      '<div class="grid grid-3" id="clientsGrid"></div>';
    var self = this;
    this._selectedClients = new Set();
    var input = document.getElementById('clientSearch');
    var timer;
    input.addEventListener('input', function() {
      clearTimeout(timer);
      timer = setTimeout(function() { self.renderClients(input.value); }, 300);
    });
    API.clients(search).then(function(clients) {
      var grid = document.getElementById('clientsGrid');
      document.getElementById('clientCount').textContent = 'Всего: ' + clients.length;
      if (!clients.length) { grid.innerHTML = '<div class="empty-state"><h3>Клиенты не найдены</h3></div>'; return; }
      grid.innerHTML = clients.map(function(c) {
        return '<div class="client-card" data-cid="' + c.id + '">' +
          '<div class="client-card-top">' +
            '<label class="client-checkbox" onclick="event.stopPropagation()"><input type="checkbox" data-cid="' + c.id + '" onchange="Trainer.toggleClient(' + c.id + ', this.checked)"><span class="checkmark"></span></label>' +
            '<div class="avatar" onclick="Trainer.openClient(' + c.id + ')">' + initials(c.full_name) + '</div>' +
          '</div>' +
          '<div class="name" onclick="Trainer.openClient(' + c.id + ')">' + self.esc(c.full_name) + '</div>' +
          '<div class="meta">' + (c.phone ? '<a href="tel:' + c.phone.replace(/[^+\d]/g, '') + '" class="phone-link" onclick="event.stopPropagation()">' + Icons.svg('phone', 14) + ' ' + self.esc(c.phone) + '</a>' : '—') + '</div>' +
          '<div class="meta">' + (c.goal || '—') + '</div>' +
          '<span class="sessions-badge ' + (c.paid_sessions > 0 ? 'has-sessions' : 'no-sessions') + '">' + (c.paid_sessions || 0) + ' трен.</span>' +
          '</div>';
      }).join('');
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  toggleClient: function(id, checked) {
    if (checked) { this._selectedClients.add(id); } else { this._selectedClients.delete(id); }
    this._updateArchiveBtn();
  },

  toggleAllClients: function() {
    var checkboxes = document.querySelectorAll('#clientsGrid input[type=checkbox]');
    var allChecked = Array.from(checkboxes).every(function(cb) { return cb.checked; });
    var self = this;
    checkboxes.forEach(function(cb) {
      cb.checked = !allChecked;
      var cid = parseInt(cb.dataset.cid);
      if (!allChecked) { self._selectedClients.add(cid); } else { self._selectedClients.delete(cid); }
    });
    this._updateArchiveBtn();
  },

  _updateArchiveBtn: function() {
    var btn = document.getElementById('archiveBtn');
    if (!btn) return;
    var count = this._selectedClients.size;
    if (count > 0) { btn.classList.remove('hidden'); btn.innerHTML = Icons.svg('trash', 14) + ' Удалить (' + count + ')'; }
    else { btn.classList.add('hidden'); }
  },

  deleteSelected: function() {
    var ids = Array.from(this._selectedClients);
    if (!ids.length) return;
    if (!confirm('Удалить ' + ids.length + ' клиент(ов) навсегда? Это действие нельзя отменить.')) return;
    var self = this;
    var done = 0;
    ids.forEach(function(id) {
      API.deleteClient(id).then(function() {
        done++;
        if (done >= ids.length) {
          toast('Удалено', done + ' клиент(ов) удалено', 'success');
          self._selectedClients.clear();
          self.renderClients();
        }
      }).catch(function(e) {
        done++;
        if (done >= ids.length) { self._selectedClients.clear(); self.renderClients(); }
      });
    });
  },

  openClient: function(id) {
    this.currentClient = id;
    localStorage.setItem('fc_trainer_client', id);
    localStorage.setItem('fc_trainer_view', 'client-profile');
    document.querySelectorAll('.sidebar a[data-view]').forEach(function(a) { a.classList.remove('active'); });
    this.renderClientNav();
    this.renderClientProfile();
  },

  renderClientNav: function() {
    var nav = document.getElementById('clientNav');
    nav.classList.remove('hidden');
    nav.innerHTML = '<a href="#" data-view="client-profile" class="active"><span class="icon">' + Icons.svg('user') + '</span> Карточка</a>' +
      '<a href="#" data-view="client-trainings"><span class="icon">' + Icons.svg('dumbbell') + '</span> Тренировки</a>' +
      '<a href="#" data-view="client-weekly"><span class="icon">' + Icons.svg('chart') + '</span> Трекинг</a>' +
      '<a href="#" data-view="client-measurements"><span class="icon">' + Icons.svg('ruler') + '</span> Замеры</a>' +
      '<a href="#" data-view="client-stats"><span class="icon">' + Icons.svg('chart') + '</span> Статистика</a>' +
      '<a href="#" data-view="client-records"><span class="icon">' + Icons.svg('award') + '</span> Рекорды</a>';
    var self = this;
    nav.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function(e) { e.preventDefault(); self.navigate(a.dataset.view); });
    });
  },

  renderClientProfile: function() {
    document.querySelectorAll('#clientNav a').forEach(function(a) { a.classList.toggle('active', a.dataset.view === 'client-profile'); });
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="spinner"></div>';
    var self = this;
    Promise.all([API.client(this.currentClient), API.clientRanking(this.currentClient), API.measurements(this.currentClient)]).then(function(arr) {
      var c = arr[0], rank = arr[1], meas = arr[2] || [];
      var lastWeight = null;
      for (var i = 0; i < meas.length; i++) { if (meas[i].weight) { lastWeight = parseFloat(meas[i].weight); } }

      var bmiHtml = '<div class="card bmi-card">' +
        '<div class="bmi-head"><h3>ИМТ</h3>' +
          (lastWeight && c.height ? '<span class="bmi-val" id="bmiVal" style="color:#22c55e;">' + (lastWeight / Math.pow(c.height/100, 2)).toFixed(1) + '</span>' : '<span class="bmi-val" id="bmiVal" style="color:var(--text-muted);">—</span>') +
        '</div>' +
        '<div class="bmi-cat" id="bmiCat" style="min-height:20px;margin-bottom:10px;">' +
          (lastWeight && c.height ? (function() { var b = lastWeight / Math.pow(c.height/100, 2); if (b < 18.5) return '<span style="color:#f59e0b;">Недостаток веса</span>'; if (b < 25) return '<span style="color:#22c55e;">Норма</span>'; if (b < 30) return '<span style="color:#f59e0b;">Избыток веса</span>'; return '<span style="color:#ef4444;">Ожирение</span>'; })() : '<span class="text-muted">Введите вес и рост</span>') +
        '</div>' +
        '<div class="bmi-bar" id="bmiBarWrap" style="' + (lastWeight && c.height ? '' : 'opacity:0.3;') + '"><div class="bmi-marker" id="bmiMarker" style="left:' + (lastWeight && c.height ? Math.min(100, Math.max(0, ((lastWeight / Math.pow(c.height/100, 2) - 15) / 25 * 100))) : 0) + '%;"></div></div>' +
        '<div class="bmi-scale"><span>15</span><span>18.5</span><span>25</span><span>30</span><span>40</span></div>' +
        '<div class="bmi-inputs">' +
          '<div class="field"><label>Вес, кг</label><input type="number" step="0.1" class="input" id="bmiWeight" value="' + (lastWeight || '') + '" placeholder="0" oninput="Trainer.calcBmiLive()"></div>' +
          '<div class="field"><label>Рост, см</label><input type="number" class="input" id="bmiHeight" value="' + (c.height || '') + '" placeholder="0" oninput="Trainer.calcBmiLive()"></div>' +
        '</div>' +
        '<button class="btn btn-primary btn-sm" style="margin-top:10px;" onclick="Trainer.saveBmiData(' + c.id + ')">' + Icons.svg('check', 14) + ' Сохранить</button>' +
        '</div>';
      main.innerHTML = '<button class="btn-back" onclick="Trainer.navigate(\'clients\')"><span class="back-arrow"></span> Назад</button>' +
        '<h1 class="page-title">' + self.esc(c.full_name) + '</h1>' +
        '<div class="card level-card"><div class="level-badge">Ур. ' + rank.level + '</div>' +
        '<div class="level-body"><span class="level-title">' + self.esc(rank.title) + '</span>' +
        '<span class="badge">#' + rank.rank + ' из ' + rank.total_clients + '</span>' +
        '<div class="xp-bar-wrap"><div class="xp-bar" style="width:' + rank.progress_pct + '%"></div></div>' +
        '<div class="xp-text">' + rank.xp_in_level + ' / ' + rank.xp_for_next + ' XP</div></div></div>' +
        '<div class="card"><div class="flex-between"><span class="sessions-badge ' + (c.paid_sessions > 0 ? 'has-sessions' : 'no-sessions') + '">' + Icons.svg('card', 16) + ' Оплачено: ' + (c.paid_sessions || 0) + '</span>' +
        '<div class="flex gap">' +
        '<span class="badge">' + Icons.svg('card', 14) + ' ' + (c.session_price || 0) + '/тр.</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="Trainer.openPriceModal(' + c.id + ',' + (c.session_price || 0) + ')">Цена</button>' +
        '<button class="btn btn-primary btn-sm" onclick="Trainer.openSessionsModal(' + c.id + ',' + (c.paid_sessions || 0) + ')">' + Icons.svg('edit', 14) + ' Сессии</button></div></div></div>' +
        '<div class="card"><div class="flex-between" style="margin-bottom:16px;"><h3>Информация</h3>' +
        '<button class="btn btn-ghost btn-sm" onclick="Trainer.editClient(' + c.id + ')">' + Icons.svg('edit', 14) + ' Редактировать</button></div>' +
        '<div class="profile-grid">' +
        '<div class="profile-field"><span class="pf-label">Телефон</span><span class="pf-value">' + (c.phone ? '<a href="tel:' + c.phone.replace(/[^+\d]/g, '') + '" class="phone-link">' + self.esc(c.phone) + '</a>' : '—') + '</span></div>' +
        '<div class="profile-field"><span class="pf-label">Цель</span><span class="pf-value">' + (c.goal || '—') + '</span></div>' +
        '<div class="profile-field"><span class="pf-label">Пульсовая зона</span><span class="pf-value">' + (c.pulse_zone || '—') + '</span></div>' +
        '<div class="profile-field" style="grid-column:1/-1;"><span class="pf-label">Противопоказания</span><span class="pf-value">' + (c.contraindications || '—') + '</span></div>' +
        '<div class="profile-field"><span class="pf-label">Рост</span><span class="pf-value">' + (c.height ? c.height + ' см' : '—') + '</span></div>' +
        '</div></div>' +
        bmiHtml;
    }).catch(function(e) { main.innerHTML = '<p class="text-muted">Ошибка: ' + e.message + '</p>'; });
  },

  renderClientTrainings: function() {
    document.querySelectorAll('#clientNav a').forEach(function(a) { a.classList.toggle('active', a.dataset.view === 'client-trainings'); });
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="flex-between"><div><h1 class="page-title">Тренировки</h1></div>' +
      '<button class="btn btn-primary" onclick="Trainer.openTrainingModal()">' + Icons.svg('plus', 16) + ' Новая</button></div>' +
      '<div id="trList"></div>';
    var self = this;
    API.trainings(this.currentClient).then(function(list) {
      var el = document.getElementById('trList');
      if (!list.length) { el.innerHTML = '<div class="empty-state"><h3>Тренировок нет</h3></div>'; return; }
      el.innerHTML = list.map(function(t) {
        return '<div class="training-entry" onclick="Trainer.viewTraining(' + t.id + ')">' +
          '<div class="te-head"><div class="te-date">' + Icons.svg('calendar', 18) + ' ' + fmtDate(t.training_date) + '</div>' +
          (t.well_being ? '<span class="badge badge-success">' + t.well_being + '</span>' : '') + '</div>' +
          '<div class="text-muted" style="font-size:14px;">Упражнений: ' + t.exercises.length + '</div>' +
          (t.comment ? '<div class="te-comment">' + self.esc(t.comment) + '</div>' : '') + '</div>';
      }).join('');
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  renderClientMeasurements: function() {
    document.querySelectorAll('#clientNav a').forEach(function(a) { a.classList.toggle('active', a.dataset.view === 'client-measurements'); });
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="flex-between"><div><h1 class="page-title">Замеры</h1></div>' +
      '<button class="btn btn-primary" onclick="Trainer.openMeasurementModal()">' + Icons.svg('plus', 16) + ' Добавить</button></div>' +
      '<div class="table-wrap"><table id="measTable"><thead></thead><tbody></tbody></table></div>';
    var self = this;
    API.measurements(this.currentClient).then(function(data) {
      var cols = [['Дата','measure_date',fmtDate],['Вес','weight'],['Талия','waist'],['Грудь','chest'],['Бедро','thigh']];
      document.querySelector('#measTable thead').innerHTML = '<tr>' + cols.map(function(c){return '<th>'+c[0]+'</th>';}).join('') + '<th></th></tr>';
      var tbody = data.length ? data.map(function(m) {
        return '<tr>' + cols.map(function(c){ return '<td>' + (c[2] ? c[2](m[c[1]]) : (m[c[1]] || '—')) + '</td>'; }).join('') +
          '<td><button class="btn btn-danger btn-sm" onclick="Trainer.delMeasurement(' + m.id + ')">' + Icons.svg('trash',14) + '</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty-state">Замеров нет</td></tr>';
      document.querySelector('#measTable tbody').innerHTML = tbody;
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  renderClientStats: function() {
    document.querySelectorAll('#clientNav a').forEach(function(a) { a.classList.toggle('active', a.dataset.view === 'client-stats'); });
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Статистика</h1><div id="statsContent"><div class="spinner"></div></div>';
    var self = this;
    Promise.all([API.attendance(this.currentClient), API.weightProgress(this.currentClient), API.exerciseSummary(this.currentClient)]).then(function(arr) {
      var att = arr[0], weight = arr[1], exSum = arr[2];
      var html = '<div class="stat-grid">' +
        '<div class="stat-card"><div class="stat-value">' + att.month + '</div><div class="stat-label">За месяц</div></div>' +
        '<div class="stat-card"><div class="stat-value">' + att.total + '</div><div class="stat-label">Всего</div></div>' +
        '</div>';
      if (weight.length > 1) {
        html += '<div class="chart-box"><h3>Динамика веса тела</h3><canvas id="wChart" class="chart-canvas"></canvas></div>';
      }
      if (exSum && exSum.length) {
        html += '<div class="card"><h3 style="margin-bottom:14px;">Прогресс по упражнениям</h3>' +
          '<div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>Упражнение</th><th>Последний</th><th>Лучший</th><th>Динамика</th><th>Зап.</th></tr></thead><tbody>';
        exSum.forEach(function(s) {
          var trendIcon = s.trend === 'up' ? Icons.svg('trendup', 16) : (s.trend === 'down' ? '<span style="color:var(--danger);">↓</span>' : '<span style="color:var(--text-muted);">→</span>');
          var deltaTxt = s.delta != null ? (s.delta > 0 ? '+' : '') + s.delta + ' кг' : '—';
          var trendCls = s.trend === 'up' ? 'badge-success' : '';
          html += '<tr><td><strong>' + self.esc(s.exercise) + '</strong></td>' +
            '<td>' + (s.last_weight || '—') + ' кг</td>' +
            '<td>' + (s.best_weight || '—') + ' кг</td>' +
            '<td><span class="' + trendCls + '">' + trendIcon + ' ' + deltaTxt + '</span></td>' +
            '<td>' + s.sessions + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
      }
      document.getElementById('statsContent').innerHTML = html;
      if (weight.length > 1) {
        Charts.line('wChart', weight.map(function(w){return fmtDate(w.date);}),
          [{label:'Вес', data: weight.map(function(w){return w.weight;}), color:'#2ecc71'}]);
      }
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  renderClientRecords: function() {
    document.querySelectorAll('#clientNav a').forEach(function(a) { a.classList.toggle('active', a.dataset.view === 'client-records'); });
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Рекорды</h1><div class="records-grid" id="recGrid"><div class="spinner"></div></div>';
    var self = this;
    API.records(this.currentClient).then(function(recs) {
      var grid = document.getElementById('recGrid');
      if (!recs.length) { grid.innerHTML = '<div class="empty-state"><h3>Рекордов нет</h3></div>'; return; }
      grid.innerHTML = recs.map(function(r) {
        return '<div class="record-card"><div class="rec-name">' + self.esc(r.exercise) + '</div>' +
          (r.best_weight ? '<div class="rec-row"><span>Вес</span><span class="rec-val">' + r.best_weight + ' кг</span></div>' : '') +
          (r.best_reps ? '<div class="rec-row"><span>Повторы</span><span class="rec-val">' + r.best_reps + '</span></div>' : '') +
          '</div>';
      }).join('');
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  // ===== ЗАРАБОТОК =====
  renderEarnings: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">' + Icons.svg('card', 26) + ' Заработок</h1>' +
      '<p class="page-subtitle">Калькулятор дохода от тренировок</p>' +
      '<div class="stat-grid" id="earnStats"><div class="spinner"></div></div>' +
      '<div id="earnCalc"></div>';
    var self = this;
    API.earnings().then(function(e) {
      document.getElementById('earnStats').innerHTML =
        '<div class="stat-card"><div class="stat-icon">' + Icons.svg('card', 24) + '</div><div class="stat-value">' + e.month_earnings + '</div><div class="stat-label">За месяц (' + self.monthName() + ')</div></div>' +
        '<div class="stat-card"><div class="stat-icon">' + Icons.svg('clock', 24) + '</div><div class="stat-value">' + e.per_hour + '</div><div class="stat-label">В час</div></div>' +
        '<div class="stat-card"><div class="stat-icon">' + Icons.svg('calendar', 24) + '</div><div class="stat-value">' + e.week_earnings + '</div><div class="stat-label">За неделю</div></div>' +
        '<div class="stat-card"><div class="stat-icon">' + Icons.svg('trendup', 24) + '</div><div class="stat-value">' + e.year_earnings + '</div><div class="stat-label">За год</div></div>';
      document.getElementById('earnCalc').innerHTML =
        '<div class="card"><h3 style="margin-bottom:16px;">Баланс месяца (обнуляется 1-го числа)</h3>' +
        '<div style="display:flex;align-items:center;gap:20px;margin-bottom:20px;">' +
        '<div style="font-size:36px;font-weight:800;color:var(--success);">' + e.month_balance + '</div>' +
        '<div class="text-muted">' + e.hours_month + ' ч. • ' + e.month_sessions_count + ' трен.</div></div>' +
        '<div class="xp-bar-wrap" style="height:12px;"><div class="xp-bar" style="width:100%;background:linear-gradient(90deg,#2ecc71,#68d391);"></div></div></div>' +
        '<div class="card" style="margin-top:18px;"><h3 style="margin-bottom:16px;">Калькулятор</h3>' +
        '<div class="grid grid-2">' +
        '<div class="field"><label>Цена за тренировку</label><input type="number" class="input" id="calcPrice" value="1000" oninput="Trainer.calcEarnings()"></div>' +
        '<div class="field"><label>Тренировок в неделю</label><input type="number" class="input" id="calcPerWeek" value="10" oninput="Trainer.calcEarnings()"></div>' +
        '</div><div id="calcResult" style="margin-top:16px;"></div></div>';
      self.calcEarnings();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  calcEarnings: function() {
    var price = parseFloat(document.getElementById('calcPrice').value) || 0;
    var perWeek = parseInt(document.getElementById('calcPerWeek').value) || 0;
    var week = price * perWeek;
    var month = week * 4.33;
    var year = month * 12;
    document.getElementById('calcResult').innerHTML =
      '<div class="stat-grid">' +
      '<div class="stat-card"><div class="stat-value">' + week.toFixed(0) + '</div><div class="stat-label">В неделю</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + month.toFixed(0) + '</div><div class="stat-label">В месяц</div></div>' +
      '<div class="stat-card"><div class="stat-value">' + year.toFixed(0) + '</div><div class="stat-label">В год</div></div>' +
      '</div>';
  },

  monthName: function() {
    var m = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    return m[new Date().getMonth()];
  },

  // ===== КАЛЕНДАРЬ / ЗАПИСИ =====
  _weekDate: null,

  renderCalendar: function() {
    if (!this._weekDate) this._weekDate = new Date().toISOString().slice(0, 10);
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">' + Icons.svg('calendar', 26) + ' Расписание</h1>' +
      '<div class="sched-nav">' +
        '<button class="btn btn-ghost btn-sm" onclick="Trainer.changeWeek(-7)">' + Icons.svg('arrowleft', 14) + '</button>' +
        '<span id="weekLabel" class="sched-week-label">...</span>' +
        '<button class="btn btn-ghost btn-sm" onclick="Trainer.changeWeek(7)">' + Icons.svg('arrowright', 14) + '</button>' +
        '<button class="btn btn-primary btn-sm" onclick="Trainer.resetWeek()" style="margin-left:auto;">Сегодня</button>' +
      '</div>' +
      '<div id="schedGrid"><div class="spinner"></div></div>' +
      '<div style="margin-top:24px;"><h3 style="margin-bottom:12px;">Список записей</h3>' +
      '<div class="flex gap" style="margin-bottom:14px;flex-wrap:wrap;">' +
      '<button class="btn btn-primary btn-sm" onclick="Trainer.filterCalendar(\'\')">Все</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="Trainer.filterCalendar(\'pending\')">Ожидают</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="Trainer.filterCalendar(\'confirmed\')">Подтверждены</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="Trainer.filterCalendar(\'completed\')">Проведены</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="Trainer.filterCalendar(\'cancelled\')">Отменены</button>' +
      '</div><div id="calList"><div class="spinner"></div></div></div>';
    this._calFilter = '';
    this.loadWeekGrid();
    this.loadCalendar();
  },

  changeWeek: function(delta) {
    var d = new Date(this._weekDate);
    d.setDate(d.getDate() + delta);
    this._weekDate = d.toISOString().slice(0, 10);
    this.loadWeekGrid();
  },

  resetWeek: function() {
    this._weekDate = new Date().toISOString().slice(0, 10);
    this.loadWeekGrid();
  },

  loadWeekGrid: function() {
    var self = this;
    API.weekSchedule(this._weekDate).then(function(data) {
      var lbl = document.getElementById('weekLabel');
      if (lbl) lbl.textContent = fmtDate(data.week_start) + ' — ' + fmtDate(data.week_end);

      var wh = data.work_hours || {};
      var minH = 8, maxH = 21;
      Object.values(wh).forEach(function(w) {
        var s = parseInt(w.start.split(':')[0]); if (s < minH) minH = s;
        var e = parseInt(w.end.split(':')[0]); if (e > maxH) maxH = e;
      });

      var hours = [];
      for (var h = minH; h <= maxH; h++) hours.push(h);

      var grid = document.getElementById('schedGrid');
      if (!grid) return;

      var html = '<div class="sched-grid" style="grid-template-columns: 56px repeat(7, 1fr);">' +
        '<div class="sched-corner"></div>';
      data.days.forEach(function(d) {
        html += '<div class="sched-day-head' + (d.is_today ? ' today' : '') + '">' +
          '<div class="sd-name">' + d.day_name + '</div>' +
          '<div class="sd-date">' + fmtDate(d.date).split('.')[0] + '</div></div>';
      });

      var sessMap = {};
      data.days.forEach(function(d) {
        d.sessions.forEach(function(s) {
          if (s.time) sessMap[d.date + '_' + s.time] = s;
        });
      });

      hours.forEach(function(h) {
        var timeStr = (h < 10 ? '0' : '') + h + ':00';
        html += '<div class="sched-time">' + timeStr + '</div>';
        data.days.forEach(function(d) {
          var key = d.date + '_' + timeStr;
          var s = sessMap[key];
          var dow = d.day_of_week;
          var isWorkDay = wh[dow];
          var isWorkHour = isWorkDay && h >= parseInt(wh[dow].start.split(':')[0]) && h < parseInt(wh[dow].end.split(':')[0]);
          if (s) {
            html += '<div class="sched-cell booked ' + (s.status === 'pending' ? 'pending' : 'confirmed') + '" onclick="Trainer.openClient(' + s.client_id + ')">' +
              '<div class="sc-name">' + self.esc(s.client_name.split(' ')[0]) + '</div>' +
              '<div class="sc-time">' + timeStr + '</div></div>';
          } else if (isWorkHour) {
            html += '<div class="sched-cell work clickable" onclick="Trainer.openBookCell(\'' + d.date + '\',\'' + timeStr + '\')">' +
              '<div class="sc-add">' + Icons.svg('plus', 16) + '</div></div>';
          } else {
            html += '<div class="sched-cell"></div>';
          }
        });
      });
      html += '</div>';
      grid.innerHTML = html;
    }).catch(function(e) { 
      var grid = document.getElementById('schedGrid');
      if (grid) grid.innerHTML = '<p class="text-muted">Ошибка: ' + e.message + '</p>';
    });
  },

  filterCalendar: function(status) {
    this._calFilter = status;
    document.querySelectorAll('.flex.gap button').forEach(function(b) {
      b.classList.remove('btn-primary'); b.classList.add('btn-ghost');
    });
    event.target.classList.add('btn-primary'); event.target.classList.remove('btn-ghost');
    this.loadCalendar();
  },

  loadCalendar: function() {
    var self = this;
    API.calendarSessions(this._calFilter).then(function(list) {
      var el = document.getElementById('calList');
      if (!list.length) { el.innerHTML = '<div class="empty-state"><h3>Записей нет</h3></div>'; return; }
      el.innerHTML = list.map(function(s) {
        var statusBadge = '';
        if (s.status === 'pending') statusBadge = '<span class="badge" style="background:#fff3cd;color:#b8860b;">Ожидает</span>';
        else if (s.status === 'confirmed') statusBadge = '<span class="badge badge-success">Подтверждена</span>';
        else if (s.status === 'cancelled') statusBadge = '<span class="badge" style="background:#fde8e8;color:#c53030;">Отменена</span>';
        else if (s.status === 'completed') statusBadge = '<span class="badge badge-success">Проведена</span>';
        else if (s.status === 'reschedule') statusBadge = '<span class="badge" style="background:#e5f2ff;color:#2e6da4;">Перенос</span>';
        var actions = '';
        if (s.status === 'pending') {
          actions = '<button class="btn btn-success btn-sm" onclick="Trainer.confirmSess(' + s.id + ')">' + Icons.svg('check', 14) + ' Подтвердить</button> ' +
            '<button class="btn btn-ghost btn-sm" onclick="Trainer.openSessionPriceModal(' + s.id + ',' + (s.price || 0) + ')">' + Icons.svg('edit', 14) + ' Цена</button> ' +
            '<button class="btn btn-danger btn-sm" onclick="Trainer.cancelSess(' + s.id + ')">' + Icons.svg('x', 14) + '</button>';
        } else if (s.status === 'confirmed') {
          actions = '<button class="btn btn-success btn-sm" onclick="Trainer.openCompleteModal(' + s.id + ',' + (s.price || 0) + ')">' + Icons.svg('check', 14) + ' Проведена</button> ' +
            '<button class="btn btn-ghost btn-sm" onclick="Trainer.openSessionPriceModal(' + s.id + ',' + (s.price || 0) + ')">' + Icons.svg('edit', 14) + ' Цена</button> ' +
            '<button class="btn btn-danger btn-sm" onclick="Trainer.cancelSess(' + s.id + ')">' + Icons.svg('x', 14) + '</button>';
        } else if (s.status === 'reschedule') {
          actions = '<button class="btn btn-primary btn-sm" onclick="Trainer.openRescheduleModal(' + s.id + ')">Перенести</button>';
        } else if (s.status === 'completed') {
          actions = '<button class="btn btn-ghost btn-sm" onclick="Trainer.openSessionPriceModal(' + s.id + ',' + (s.price || 0) + ')">' + Icons.svg('edit', 14) + ' Изменить цену</button>';
        } else if (s.status === 'cancelled') {
          actions = '<button class="btn btn-primary btn-sm" onclick="Trainer.rebookSession(' + s.id + ',' + s.client_id + ',\'' + s.session_date + '\',\'' + (s.session_time || '') + '\')">' + Icons.svg('calendar', 14) + ' Заменить</button>';
        }
        return '<div class="training-entry">' +
          '<div class="te-head"><div class="te-date">' + Icons.svg('calendar', 18) + ' ' + fmtDate(s.session_date) + (s.session_time ? ' в ' + s.session_time : '') + '</div>' + statusBadge + '</div>' +
          '<div class="text-muted" style="margin:4px 0;">' + Icons.svg('user', 14) + ' ' + self.esc(s.client_name) + (s.client_phone ? ' • <a href="tel:' + s.client_phone.replace(/[^+\d]/g, '') + '" class="phone-link">' + self.esc(s.client_phone) + '</a>' : '') + '</div>' +
          '<div style="margin:4px 0;font-weight:600;color:var(--primary);">' + Icons.svg('card', 14) + ' ' + (s.price || 0) + '</div>' +
          (s.reschedule_request ? '<div class="te-comment">Запрос переноса: ' + self.esc(s.reschedule_request) + '</div>' : '') +
          (s.note ? '<div class="te-comment">' + self.esc(s.note) + '</div>' : '') +
          (actions ? '<div style="margin-top:8px;" class="flex gap">' + actions + '</div>' : '') +
          '</div>';
      }).join('');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  confirmSess: function(id) {
    var self = this;
    API.confirmSession(id).then(function() { toast('Подтверждено', '', 'success'); self.loadCalendar(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  cancelSess: function(id) {
    if (!confirm('Отменить запись? Клиент получит уведомление.')) return;
    var self = this;
    API.cancelSession(id, '').then(function() { toast('Отменено', '', 'success'); self.loadCalendar(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  calcBmiLive: function() {
    var w = parseFloat(document.getElementById('bmiWeight').value) || 0;
    var h = parseFloat(document.getElementById('bmiHeight').value) || 0;
    var valEl = document.getElementById('bmiVal');
    var catEl = document.getElementById('bmiCat');
    var marker = document.getElementById('bmiMarker');
    var barWrap = document.getElementById('bmiBarWrap');
    if (w > 0 && h > 0) {
      var bmi = w / Math.pow(h / 100, 2);
      var cat = '', color = '';
      if (bmi < 18.5) { cat = 'Недостаток веса'; color = '#f59e0b'; }
      else if (bmi < 25) { cat = 'Норма'; color = '#22c55e'; }
      else if (bmi < 30) { cat = 'Избыток веса'; color = '#f59e0b'; }
      else { cat = 'Ожирение'; color = '#ef4444'; }
      valEl.textContent = bmi.toFixed(1);
      valEl.style.color = color;
      catEl.innerHTML = '<span style="color:' + color + ';">' + cat + '</span>';
      var pct = Math.min(100, Math.max(0, ((bmi - 15) / 25) * 100));
      if (marker) { marker.style.left = pct + '%'; marker.style.background = color; }
      if (barWrap) barWrap.style.opacity = '1';
    } else {
      valEl.textContent = '—';
      valEl.style.color = 'var(--text-muted)';
      catEl.innerHTML = '<span class="text-muted">Введите вес и рост</span>';
      if (barWrap) barWrap.style.opacity = '0.3';
    }
  },

  saveBmiData: function(clientId) {
    var h = parseInt(document.getElementById('bmiHeight').value) || null;
    var w = parseFloat(document.getElementById('bmiWeight').value) || null;
    var self = this;
    var promises = [];
    if (h) promises.push(API.updateClient(clientId, { height: h }));
    if (w) {
      var today = new Date().toISOString().slice(0, 10);
      promises.push(API.createMeasurement({ client_id: clientId, measure_date: today, weight: w }));
    }
    if (!promises.length) { toast('Введите данные', '', 'error'); return; }
    Promise.all(promises).then(function() {
      toast('Сохранено', 'ИМТ обновлён', 'success');
      self.renderClientProfile();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  rebookSession: function(oldId, clientId, oldDate, oldTime) {
    var self = this;
    this.openModal('Заменить тренировку',
      '<p style="margin-bottom:14px;color:var(--text-muted);">Перенести на новую дату и время.</p>' +
      '<div class="field"><label>Дата</label><input type="date" class="input" id="rbDate" value="' + oldDate + '"></div>' +
      '<div class="field"><label>Время</label><input type="time" class="input" id="rbTime" value="' + (oldTime || '10:00') + '"></div>',
      '<button class="btn btn-danger" data-close>Отмена</button>' +
      '<button class="btn btn-success" onclick="Trainer.saveRebook(' + oldId + ',' + clientId + ')">' + Icons.svg('check', 16) + ' Записать</button>'
    );
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) {
      b.addEventListener('click', function() { self.closeModal(); });
    });
  },

  saveRebook: function(oldId, clientId) {
    var data = {
      client_id: clientId,
      session_date: document.getElementById('rbDate').value,
      session_time: document.getElementById('rbTime').value,
    };
    var self = this;
    API.bookForClient(data).then(function() {
      toast('Заменено', 'Новая тренировка создана', 'success');
      self.closeModal();
      self.loadCalendar();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openCompleteModal: function(id, currentPrice) {
    this.openModal('Провести тренировку',
      '<div class="field"><label>Стоимость тренировки</label><input type="number" step="50" class="input" id="completePrice" value="' + currentPrice + '"></div>' +
      '<p class="text-muted" style="font-size:13px;">Эта сумма будет добавлена в баланс месяца.</p>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-success" onclick="Trainer.doComplete(' + id + ')">' + Icons.svg('check', 16) + ' Отметить проведённой</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  doComplete: function(id) {
    var price = parseFloat(document.getElementById('completePrice').value) || 0;
    var self = this;
    API.completeSession(id, price).then(function(r) { toast('Проведена!', 'Цена: ' + r.price + ' → баланс обновлён', 'success'); self.closeModal(); self.loadCalendar(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openSessionPriceModal: function(id, currentPrice) {
    this.openModal('Стоимость тренировки',
      '<div class="field"><label>Цена за тренировку</label><input type="number" step="50" class="input" id="sessPriceInput" value="' + currentPrice + '"></div>' +
      '<p class="text-muted" style="font-size:13px;">Изменение цены обновит баланс заработка.</p>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveSessionPrice(' + id + ')">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  saveSessionPrice: function(id) {
    var price = parseFloat(document.getElementById('sessPriceInput').value) || 0;
    var self = this;
    API.updateSessionPrice(id, price).then(function(r) {
      toast('Цена обновлена', price + ' → баланс: ' + r.month_balance, 'success');
      self.closeModal();
      self.loadCalendar();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openRescheduleModal: function(id) {
    var today = new Date().toISOString().slice(0, 10);
    this.openModal('Перенос тренировки',
      '<div class="grid grid-2"><div class="field"><label>Новая дата</label><input type="date" class="input" id="rDate" value="' + today + '"></div>' +
      '<div class="field"><label>Новое время</label><input type="time" class="input" id="rTime" value="10:00"></div></div>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.doReschedule(' + id + ')">Перенести</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  doReschedule: function(id) {
    var d = document.getElementById('rDate').value;
    var t = document.getElementById('rTime').value;
    var self = this;
    API.rescheduleSession(id, { session_date: d, session_time: t }).then(function() {
      toast('Перенесено', 'Клиент получил уведомление', 'success'); self.closeModal(); self.loadCalendar();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  // ===== ШАБЛОНЫ =====
  renderTemplates: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="flex-between"><div><h1 class="page-title">Шаблоны тренировок</h1></div>' +
      '<button class="btn btn-primary" onclick="Trainer.openTemplateModal()">' + Icons.svg('plus', 16) + ' Создать</button></div>' +
      '<div class="grid grid-2" id="tplGrid"><div class="spinner"></div></div>';
    var self = this;
    API.templates().then(function(list) {
      var grid = document.getElementById('tplGrid');
      if (!list.length) { grid.innerHTML = '<div class="empty-state"><h3>Шаблонов нет</h3></div>'; return; }
      grid.innerHTML = list.map(function(t) {
        var exs = (t.exercises || []).map(function(e) { return '<tr><td>' + self.esc(e.name) + '</td><td>' + (e.weight ? e.weight + ' кг' : '—') + '</td><td>' + (e.reps ? e.reps + 'x' + (e.sets_count || 1) : '') + '</td></tr>'; }).join('');
        return '<div class="card"><div class="flex-between"><h3>' + self.esc(t.name) + '</h3><span class="badge">' + self.esc(t.category) + '</span></div>' +
          (t.description ? '<p class="text-muted" style="font-size:14px;margin:8px 0;">' + self.esc(t.description) + '</p>' : '') +
          (exs ? '<div class="table-wrap" style="box-shadow:none;margin-bottom:12px;"><table><tbody>' + exs + '</tbody></table></div>' : '') +
          '<button class="btn btn-primary btn-sm" onclick="Trainer.openApplyModal(' + t.id + ',\'' + self.esc(t.name) + '\')">' + Icons.svg('send', 14) + ' Отправить</button> ' +
          '<button class="btn btn-danger btn-sm" onclick="Trainer.delTemplate(' + t.id + ')">' + Icons.svg('trash', 14) + '</button></div>';
      }).join('');
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  openTemplateModal: function() {
    this.openModal('Новый шаблон',
      '<form id="tplForm"><div class="field"><label>Название</label><input class="input" name="name" required></div>' +
      '<div class="field"><label>Категория</label><input class="input" name="category" value="Общая"></div>' +
      '<div class="field"><label>Описание</label><textarea class="input" name="description"></textarea></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th><th></th></tr></thead><tbody id="tplExRows"></tbody></table></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="Trainer.addTplExRow()">' + Icons.svg('plus', 14) + ' Упражнение</button></form>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveTemplate()">Создать</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
    this.addTplExRow();
  },

  addTplExRow: function() {
    document.getElementById('tplExRows').insertAdjacentHTML('beforeend',
      '<tr><td><input class="input" name="ex_name" placeholder="Жим"></td>' +
      '<td><input class="input" type="number" step="0.5" name="ex_weight"></td>' +
      '<td><input class="input" type="number" name="ex_reps"></td>' +
      '<td><input class="input" type="number" name="ex_sets"></td>' +
      '<td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove()">' + Icons.svg('x', 14) + '</button></td></tr>');
  },

  saveTemplate: function() {
    var fd = new FormData(document.getElementById('tplForm'));
    var data = { name: fd.get('name'), category: fd.get('category') || 'Общая', description: fd.get('description') || null, exercises: [] };
    document.querySelectorAll('#tplExRows tr').forEach(function(row) {
      var v = row.querySelectorAll('input');
      if (v[0].value.trim()) data.exercises.push({ name: v[0].value, weight: v[1].value ? Number(v[1].value) : null, reps: v[2].value ? Number(v[2].value) : null, sets_count: v[3].value ? Number(v[3].value) : null });
    });
    var self = this;
    API.createTemplate(data).then(function() { toast('Создано', '', 'success'); self.closeModal(); self.renderTemplates(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  openApplyModal: function(id, name) {
    var self = this;
    API.clients().then(function(clients) {
      self._applyClients = clients;
      self._applyTemplateId = id;
      var today = new Date().toISOString().slice(0, 10);
      self.openModal('Отправить: ' + name,
        '<div class="field"><label>Дата тренировки</label><input type="date" class="input" id="applyDate" value="' + today + '"></div>' +
        '<div class="search-bar modal-search"><span class="search-icon">' + Icons.svg('search', 18) + '</span>' +
        '<input type="text" class="input" id="applySearch" placeholder="Поиск клиента..." oninput="Trainer.filterApplyClients()"></div>' +
        '<div style="display:flex;gap:8px;margin-bottom:10px;"><button class="btn btn-ghost btn-sm" onclick="Trainer.selectAllApply(true)">Выбрать всех</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="Trainer.selectAllApply(false)">Снять всех</button></div>' +
        '<div id="applyClientList" style="max-height:300px;overflow-y:auto;"></div>',
        '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.applyTemplate(' + id + ')">' + Icons.svg('send', 16) + ' Отправить</button>');
      document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
      self.renderApplyClientList('');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  renderApplyClientList: function(query) {
    var clients = this._applyClients || [];
    var q = (query || '').toLowerCase();
    var filtered = q ? clients.filter(function(c) { return (c.full_name || '').toLowerCase().indexOf(q) >= 0 || (c.phone || '').toLowerCase().indexOf(q) >= 0; }) : clients;
    var html = filtered.length ? filtered.map(function(c) {
      return '<label class="apply-client-row"><input type="checkbox" value="' + c.id + '"> ' + this.esc(c.full_name) +
        ' <span class="badge" style="margin-left:auto;">' + (c.paid_sessions || 0) + ' трен.</span></label>';
    }.bind(this)).join('') : '<p class="text-muted" style="padding:14px;">Не найдено</p>';
    document.getElementById('applyClientList').innerHTML = html;
  },

  filterApplyClients: function() {
    this.renderApplyClientList(document.getElementById('applySearch').value);
  },

  selectAllApply: function(checked) {
    document.querySelectorAll('#applyClientList input[type=checkbox]').forEach(function(cb) { cb.checked = checked; });
  },

  applyTemplate: function(id) {
    var checked = document.querySelectorAll('#applyClientList input[type=checkbox]:checked');
    var ids = [];
    document.querySelectorAll('.apply-client-row input[type=checkbox]:checked').forEach(function(c) { ids.push(Number(c.value)); });
    var date = document.getElementById('applyDate').value;
    if (!ids.length) { toast('Выберите клиентов', '', 'error'); return; }
    API.applyTemplateBulk(id, { client_ids: ids, training_date: date }).then(function(r) {
      toast('Отправлено!', 'Создано: ' + r.applied, 'success');
      Trainer.closeModal();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  delTemplate: function(id) {
    if (!confirm('Удалить шаблон?')) return;
    API.deleteTemplate(id).then(function() { toast('Удалено', '', 'success'); Trainer.renderTemplates(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  // ===== АНАЛИТИКА =====
  renderAnalytics: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Аналитика</h1>' +
      '<div class="stat-grid"><div class="stat-card"><div class="stat-value" id="aClients">...</div><div class="stat-label">Клиентов</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="aMonth">...</div><div class="stat-label">За месяц</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="aTotal">...</div><div class="stat-label">Всего</div></div></div>' +
      '<div class="stat-grid"><div class="stat-card"><div class="stat-value" id="aRating" style="color:#f59e0b;">—</div><div class="stat-label">Средняя оценка</div></div>' +
      '<div class="stat-card"><div class="stat-value" id="aSleep">—</div><div class="stat-label">Средний сон, ч</div></div></div>' +
      '<div class="card"><h3>Посещаемость</h3><div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>Клиент</th><th>Всего</th><th>Статус</th></tr></thead><tbody id="attBody"><tr><td colspan="3"><div class="spinner"></div></td></tr></tbody></table></div></div>' +
      '<div class="card"><h3>Прогресс</h3><div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>Клиент</th><th>Цель</th><th>Вес</th><th>Статус</th></tr></thead><tbody id="progBody"><tr><td colspan="4"><div class="spinner"></div></td></tr></tbody></table></div></div>' +
      '<div class="card"><h3>Оценки тренировок</h3><div class="table-wrap" style="box-shadow:none;"><table><thead><tr><th>Клиент</th><th>Оценка</th><th>Сон</th><th>Сложность</th></tr></thead><tbody id="fbBody"><tr><td colspan="4"><div class="spinner"></div></td></tr></tbody></table></div></div>';
    var self = this;
    API.trainerReport().then(function(r) {
      document.getElementById('aClients').textContent = r.total_clients;
      document.getElementById('aMonth').textContent = r.sessions_this_month;
      document.getElementById('aTotal').textContent = r.total_sessions;
    }).catch(function(){});
    API.attendanceReport().then(function(att) {
      document.getElementById('attBody').innerHTML = att.map(function(a) {
        return '<tr><td><strong>' + self.esc(a.full_name) + '</strong></td><td>' + a.total_sessions + '</td><td><span class="badge">' + self.esc(a.status) + '</span></td></tr>';
      }).join('');
    }).catch(function(){});
    API.progressReport().then(function(prog) {
      document.getElementById('progBody').innerHTML = prog.map(function(p) {
        return '<tr><td><strong>' + self.esc(p.full_name) + '</strong></td><td>' + (p.goal || '—') + '</td><td>' + (p.weight_delta != null ? (p.weight_delta > 0 ? '+' : '') + p.weight_delta + ' кг' : '—') + '</td><td>' + self.esc(p.progress_label) + '</td></tr>';
      }).join('');
    }).catch(function(){});
    API.trainingFeedback().then(function(fb) {
      document.getElementById('aRating').textContent = fb.overall_avg_rating || '—';
      var sleepEl = document.getElementById('aSleep');
      sleepEl.textContent = fb.overall_avg_sleep || '—';
      if (fb.overall_avg_sleep && fb.overall_avg_sleep < 7) sleepEl.style.color = '#ef4444';
      var diffMap = { easy: 'Легко', medium: 'Средне', hard: 'Сложно' };
      var diffColors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444' };
      var rows = (fb.clients || []).map(function(c) {
        var stars = '';
        for (var s = 1; s <= 5; s++) stars += s <= c.avg_rating ? '★' : '☆';
        var sleepTxt = c.avg_sleep != null ? c.avg_sleep + 'ч' : '—';
        var sleepStyle = c.avg_sleep != null && c.avg_sleep < 7 ? 'color:#ef4444;' : '';
        var diffHtml = Object.keys(c.difficulty_counts || {}).map(function(d) {
          return '<span class="badge" style="background:' + (diffColors[d] || '#999') + '20;color:' + (diffColors[d] || '#999') + ';">' + (diffMap[d] || d) + ': ' + c.difficulty_counts[d] + '</span>';
        }).join(' ') || '—';
        return '<tr><td><strong>' + self.esc(c.client_name) + '</strong></td>' +
          '<td style="color:#f59e0b;font-size:16px;">' + stars + ' (' + c.avg_rating + ')</td>' +
          '<td style="' + sleepStyle + '">' + sleepTxt + '</td>' +
          '<td>' + diffHtml + '</td></tr>';
      }).join('');
      document.getElementById('fbBody').innerHTML = rows || '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;">Пока нет оценок</td></tr>';
    }).catch(function(){});
  },

  // ===== РЕЙТИНГ =====
  renderLeaderboard: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<h1 class="page-title">Рейтинг</h1><div id="lbList"><div class="spinner"></div></div>';
    var self = this;
    API.leaderboard().then(function(list) {
      var el = document.getElementById('lbList');
      if (!list.length) { el.innerHTML = '<div class="empty-state"><h3>Нет данных</h3></div>'; return; }
      el.innerHTML = list.map(function(e) {
        return '<div class="lb-row" onclick="Trainer.openClient(' + e.client_id + ')">' +
          '<div class="lb-rank ' + (e.rank <= 3 ? 'lb-rank-top lb-rank-' + e.rank : '') + '">' + e.rank + '</div>' +
          '<div class="lb-avatar">' + initials(e.full_name) + '</div>' +
          '<div class="lb-info"><div class="lb-name">' + self.esc(e.full_name) + '</div>' +
          '<div class="lb-meta">Ур. ' + e.level + ' - ' + e.workouts_count + ' трен.</div></div>' +
          '<div class="lb-xp"><span class="lb-xp-val">' + e.total_xp + '</span><span class="lb-xp-label">XP</span></div></div>';
      }).join('');
    }).catch(function(e){ toast('Ошибка', e.message, 'error'); });
  },

  // ===== ПРОФИЛЬ =====
  renderProfile: function() {
    var main = document.getElementById('mainContent');
    main.innerHTML = '<div class="spinner"></div>';
    var self = this;
    API.me().then(function(me) {
      main.innerHTML = '<button class="btn-back" onclick="Trainer.navigate(\'overview\')"><span class="back-arrow"></span> Назад</button>' +
        '<h1 class="page-title">Мой профиль</h1>' +
        '<div class="card" style="max-width:600px;"><form id="tpForm">' +
        '<div class="field"><label>ФИО</label><input class="input" name="full_name" value="' + self.esc(me.full_name || '') + '"></div>' +
        '<div class="field"><label>Email</label><input class="input" type="email" name="email" value="' + self.esc(me.email || '') + '"></div>' +
        '<div class="field"><label>Новый пароль</label><input class="input" type="password" name="password" placeholder="Оставьте пустым"></div>' +
        '<button type="button" class="btn btn-primary" onclick="Trainer.saveProfile()">' + Icons.svg('checkcircle', 16) + ' Сохранить</button>' +
        '</form></div>' +
        '<div class="card" style="max-width:600px;margin-top:20px;" id="workHoursCard"><div class="spinner"></div></div>';
      self.loadWorkHours();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  loadWorkHours: function() {
    var self = this;
    var days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
    API.mySchedule().then(function(slots) {
      var map = {};
      slots.forEach(function(s) { map[s.day_of_week] = s; });

      // Генерируем опции времени каждые 30 минут
      var timeOpts = '<option value="">—</option>';
      for (var h = 6; h <= 23; h++) {
        for (var m = 0; m < 60; m += 30) {
          if (h === 23 && m === 30) break;
          var v = (h < 10 ? '0' : '') + h + ':' + (m === 0 ? '00' : '30');
          timeOpts += '<option value="' + v + '">' + v + '</option>';
        }
      }

      var html = '<h3 style="margin-bottom:14px;">Рабочие часы</h3>';

      // Быстрые пресеты
      html += '<div class="wh-presets">' +
        '<span class="wh-preset-label">Быстро:</span>' +
        '<button type="button" class="wh-preset-btn" onclick="Trainer.applyPreset(\'08:00\',\'20:00\')">8:00–20:00</button>' +
        '<button type="button" class="wh-preset-btn" onclick="Trainer.applyPreset(\'09:00\',\'19:00\')">9:00–19:00</button>' +
        '<button type="button" class="wh-preset-btn" onclick="Trainer.applyPreset(\'10:00\',\'22:00\')">10:00–22:00</button>' +
        '<button type="button" class="wh-preset-btn" onclick="Trainer.applyPreset(\'07:00\',\'15:00\')">7:00–15:00</button>' +
        '<button type="button" class="wh-preset-btn" onclick="Trainer.applyPreset(\'15:00\',\'23:00\')">15:00–23:00</button>' +
        '</div>';

      days.forEach(function(name, i) {
        var s = map[i];
        var checked = s ? 'checked' : '';
        var start = s ? s.start_time : '09:00';
        var end = s ? s.end_time : '19:00';

        function opts(sel) {
          return timeOpts.replace('value="' + sel + '"', 'value="' + sel + '" selected');
        }

        html += '<div class="wh-row' + (s ? '' : ' wh-off') + '">' +
          '<label class="wh-check"><input type="checkbox" data-day="' + i + '" ' + checked + '><span></span></label>' +
          '<span class="wh-day">' + name + '</span>' +
          '<div class="wh-times' + (s ? '' : ' disabled') + '" data-day="' + i + '">' +
            '<select class="wh-select" data-day-start="' + i + '" ' + (s ? '' : 'disabled') + '>' + opts(start) + '</select>' +
            '<span class="wh-dash">—</span>' +
            '<select class="wh-select" data-day-end="' + i + '" ' + (s ? '' : 'disabled') + '>' + opts(end) + '</select>' +
          '</div>' +
          '</div>';
      });

      html += '<div class="wh-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" onclick="Trainer.copyToAll()">' + Icons.svg('copy', 14) + ' Применить ко всем</button>' +
        '<button type="button" class="btn btn-primary" onclick="Trainer.saveWorkHours()">' + Icons.svg('check', 16) + ' Сохранить</button>' +
        '</div>';

      document.getElementById('workHoursCard').innerHTML = html;
      document.querySelectorAll('.wh-check input').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var row = cb.closest('.wh-row');
          var times = row.querySelector('.wh-times');
          if (cb.checked) { row.classList.remove('wh-off'); times.classList.remove('disabled'); }
          else { row.classList.add('wh-off'); times.classList.add('disabled'); }
          times.querySelectorAll('select').forEach(function(s) { s.disabled = !cb.checked; });
        });
      });
    }).catch(function() {
      document.getElementById('workHoursCard').innerHTML = '<p class="text-muted">Не удалось загрузить</p>';
    });
  },

  applyPreset: function(start, end) {
    document.querySelectorAll('.wh-check input:checked').forEach(function(cb) {
      var d = cb.dataset.day;
      var ss = document.querySelector('[data-day-start="' + d + '"]');
      var se = document.querySelector('[data-day-end="' + d + '"]');
      if (ss) ss.value = start;
      if (se) se.value = end;
    });
    toast('Применено', start + ' — ' + end + ' к выбранным дням', 'success');
  },

  copyToAll: function() {
    var firstStart = null, firstEnd = null;
    document.querySelectorAll('.wh-check input:checked').forEach(function(cb) {
      var d = cb.dataset.day;
      var ss = document.querySelector('[data-day-start="' + d + '"]');
      var se = document.querySelector('[data-day-end="' + d + '"]');
      if (ss && ss.value && !firstStart) { firstStart = ss.value; firstEnd = se ? se.value : null; }
    });
    if (!firstStart) { toast('Выберите день', 'Отметьте хотя бы один день', 'error'); return; }
    document.querySelectorAll('.wh-check input:checked').forEach(function(cb) {
      var d = cb.dataset.day;
      var ss = document.querySelector('[data-day-start="' + d + '"]');
      var se = document.querySelector('[data-day-end="' + d + '"]');
      if (ss) ss.value = firstStart;
      if (se) se.value = firstEnd;
    });
    toast('Готово', 'Время скопировано на все дни', 'success');
  },

  saveWorkHours: function() {
    var slots = [];
    document.querySelectorAll('.wh-check input').forEach(function(cb) {
      if (cb.checked) {
        var d = cb.dataset.day;
        slots.push({
          day_of_week: parseInt(d),
          start_time: document.querySelector('[data-day-start="' + d + '"]').value,
          end_time: document.querySelector('[data-day-end="' + d + '"]').value,
        });
      }
    });
    API.setMySchedule(slots).then(function() {
      toast('Сохранено', 'Рабочие часы обновлены', 'success');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  saveProfile: function() {
    var fd = new FormData(document.getElementById('tpForm'));
    var data = { full_name: fd.get('full_name'), email: fd.get('email') };
    if (fd.get('password')) data.password = fd.get('password');
    API.updateTrainerProfile(data).then(function(r) {
      var s = Token.getSession(); s.full_name = r.full_name; Token.setSession(s);
      document.getElementById('userName').textContent = r.full_name;
      toast('Сохранено', '', 'success');
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  // ===== ОПЛАЧЕННЫЕ ТРЕНИРОВКИ =====
  openSessionsModal: function(clientId, current) {
    this.openModal('Оплаченные тренировки',
      '<div class="field"><label>Количество</label><input type="number" min="0" class="input" id="sessionsInput" value="' + current + '"></div>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveSessions(' + clientId + ')">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  openPriceModal: function(clientId, current) {
    this.openModal('Стоимость тренировки',
      '<div class="field"><label>Цена за 1 тренировку</label><input type="number" step="50" class="input" id="priceInput" value="' + current + '"></div>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.savePrice(' + clientId + ')">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  savePrice: function(clientId) {
    var val = parseFloat(document.getElementById('priceInput').value) || 0;
    var self = this;
    API.setSessionPrice(clientId, val).then(function() { toast('Сохранено', 'Цена: ' + val, 'success'); self.closeModal(); self.renderClientProfile(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  saveSessions: function(clientId) {
    var val = parseInt(document.getElementById('sessionsInput').value) || 0;
    API.setPaidSessions(clientId, val).then(function() {
      toast('Обновлено', 'Оплачено: ' + val, 'success');
      Trainer.closeModal();
      Trainer.renderClientProfile();
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  // ===== МОДАЛКИ =====
  openModal: function(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('open');
  },

  closeModal: function() { document.getElementById('modalOverlay').classList.remove('open'); },

  openClientModal: function(client) {
    var c = client || {};
    this.openModal(client ? 'Редактировать' : 'Новый клиент',
      '<form id="clientForm"><div class="field"><label>ФИО</label><input class="input" name="full_name" value="' + this.esc(c.full_name || '') + '" required></div>' +
      '<div class="grid grid-2"><div class="field"><label>Телефон</label><input class="input" name="phone" value="' + this.esc(c.phone || '') + '"></div>' +
      '<div class="field"><label>Пароль</label><input class="input" name="password" value="' + this.esc(c.password || '') + '"></div></div>' +
      '<div class="field"><label>Цель</label><textarea class="input" name="goal">' + this.esc(c.goal || '') + '</textarea></div></form>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveClient(' + (c.id || 0) + ')">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  editClient: function(id) {
    var self = this;
    API.client(id).then(function(c) { self.openClientModal(c); }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  saveClient: function(id) {
    var fd = new FormData(document.getElementById('clientForm'));
    var data = { full_name: fd.get('full_name'), phone: fd.get('phone') || null, goal: fd.get('goal') || null };
    if (fd.get('password')) data.password = fd.get('password');
    var self = this;
    if (id) {
      API.updateClient(id, data).then(function() { toast('Сохранено', '', 'success'); self.closeModal(); self.renderClientProfile(); })
        .catch(function(e) { toast('Ошибка', e.message, 'error'); });
    } else {
      API.createClient(data).then(function() { toast('Создан', '', 'success'); self.closeModal(); self.navigate('clients'); })
        .catch(function(e) { toast('Ошибка', e.message, 'error'); });
    }
  },

  openTrainingModal: function() {
    var today = new Date().toISOString().slice(0, 10);
    this.openModal('Новая тренировка',
      '<form id="trForm"><div class="grid grid-2"><div class="field"><label>Дата</label><input type="date" class="input" name="training_date" value="' + today + '" required></div>' +
      '<div class="field"><label>Вес тела</label><input type="number" step="0.1" class="input" name="body_weight"></div></div>' +
      '<div class="table-wrap"><table><thead><tr><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th><th></th></tr></thead><tbody id="exRows"></tbody></table></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="Trainer.addExRow()">' + Icons.svg('plus', 14) + ' Упражнение</button>' +
      '<div class="field" style="margin-top:12px;"><label>Комментарий</label><textarea class="input" name="comment"></textarea></div></form>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveTraining()">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
    this.addExRow();
  },

  addExRow: function() {
    document.getElementById('exRows').insertAdjacentHTML('beforeend',
      '<tr><td><input class="input" name="ex_name" placeholder="Жим"></td>' +
      '<td><input class="input" type="number" step="0.5" name="ex_weight"></td>' +
      '<td><input class="input" type="number" name="ex_reps"></td>' +
      '<td><input class="input" type="number" name="ex_sets"></td>' +
      '<td><button type="button" class="btn btn-danger btn-sm" onclick="this.closest(\'tr\').remove()">' + Icons.svg('x', 14) + '</button></td></tr>');
  },

  saveTraining: function() {
    var fd = new FormData(document.getElementById('trForm'));
    var data = { client_id: this.currentClient, training_date: fd.get('training_date'), body_weight: fd.get('body_weight') ? Number(fd.get('body_weight')) : null, comment: fd.get('comment') || null, exercises: [] };
    document.querySelectorAll('#exRows tr').forEach(function(row) {
      var v = row.querySelectorAll('input');
      if (v[0].value.trim()) data.exercises.push({ name: v[0].value, weight: v[1].value ? Number(v[1].value) : null, reps: v[2].value ? Number(v[2].value) : null, sets_count: v[3].value ? Number(v[3].value) : null });
    });
    var self = this;
    API.createTraining(data).then(function() { toast('Добавлена', '', 'success'); self.closeModal(); self.renderClientTrainings(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  viewTraining: function(id) {
    var self = this;
    API.training(id).then(function(t) {
      API.exerciseSummary(t.client_id).then(function(summary) {
        var sumMap = {};
        summary.forEach(function(s) { sumMap[s.exercise] = s; });

        var exRows = t.exercises.length ? t.exercises.map(function(e, idx) {
          var s = sumMap[e.name];
          var progHtml = '';
          if (s && e.weight) {
            var icon = '', delta = '', cls = '';
            if (s.trend === 'up') { icon = Icons.svg('trendup', 14); cls = 'badge-success'; delta = '+' + s.delta + ' кг'; }
            else if (s.trend === 'down') { icon = '<span style="color:var(--danger);">↓</span>'; delta = s.delta + ' кг'; }
            else { icon = '<span style="color:var(--text-muted);">→</span>'; delta = 'стабильно'; }
            progHtml = '<br><small class="' + cls + '">' + icon + ' ' + delta + ' • лучший: ' + s.best_weight + ' кг • ' + s.sessions + ' зап.</small>';
          }
          return '<tr class="ex-row" data-idx="' + idx + '">' +
            '<td><input type="checkbox" class="ex-check" onclick="Trainer.toggleEx(' + idx + ')"></td>' +
            '<td><strong>' + self.esc(e.name) + '</strong>' + progHtml + '</td>' +
            '<td>' + (e.weight ? e.weight + ' кг' : '—') + '</td>' +
            '<td>' + (e.reps || '—') + '</td><td>' + (e.sets_count || '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="5">Нет упражнений</td></tr>';

        var weightHtml = t.body_weight
          ? '<div class="card" style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">' +
            Icons.svg('activity', 28) + '<div><div class="pf-label">Вес тела</div>' +
            '<div style="font-size:22px;font-weight:800;color:var(--primary);">' + t.body_weight + ' кг</div></div></div>'
          : '';

        var toolbar = t.exercises.length
          ? '<div class="ex-toolbar"><button class="btn btn-ghost btn-sm" onclick="Trainer.checkAllEx(true)">' + Icons.svg('check', 14) + ' Отметить все</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="Trainer.checkAllEx(false)">Снять все</button>' +
            '<span class="text-muted" style="font-size:13px;" id="exCounter"></span></div>'
          : '';

        self.openModal('Тренировка ' + fmtDate(t.training_date),
          weightHtml + toolbar +
          '<div class="table-wrap"><table><thead><tr><th></th><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th></tr></thead><tbody id="exTbody">' + exRows + '</tbody></table></div>' +
          (t.comment ? '<div class="comment-block">' + self.esc(t.comment) + '</div>' : ''),
          '<button class="btn btn-ghost" data-close>Закрыть</button>');
        document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
        self.updateExCounter();
      }).catch(function() {
        var exRows = t.exercises.length ? t.exercises.map(function(e, idx) {
          return '<tr class="ex-row" data-idx="' + idx + '"><td><input type="checkbox" class="ex-check" onclick="Trainer.toggleEx(' + idx + ')"></td>' +
            '<td>' + self.esc(e.name) + '</td><td>' + (e.weight || '—') + '</td><td>' + (e.reps || '—') + '</td><td>' + (e.sets_count || '—') + '</td></tr>';
        }).join('') : '<tr><td colspan="5">Нет упражнений</td></tr>';
        self.openModal('Тренировка ' + fmtDate(t.training_date),
          (t.body_weight ? '<div class="comment-block"><strong>Вес тела: ' + t.body_weight + ' кг</strong></div>' : '') +
          (t.exercises.length ? '<div class="ex-toolbar"><button class="btn btn-ghost btn-sm" onclick="Trainer.checkAllEx(true)">' + Icons.svg('check', 14) + ' Отметить все</button><button class="btn btn-ghost btn-sm" onclick="Trainer.checkAllEx(false)">Снять все</button></div>' : '') +
          '<div class="table-wrap"><table><thead><tr><th></th><th>Упражнение</th><th>Вес</th><th>Повторы</th><th>Подходы</th></tr></thead><tbody>' + exRows + '</tbody></table></div>' +
          (t.comment ? '<div class="comment-block">' + self.esc(t.comment) + '</div>' : ''),
          '<button class="btn btn-ghost" data-close>Закрыть</button>');
        document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
      });
    }).catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  toggleEx: function(idx) {
    var row = document.querySelector('#exTbody tr[data-idx="' + idx + '"]');
    if (!row) return;
    var cb = row.querySelector('.ex-check');
    if (cb.checked) { row.classList.add('ex-done'); row.classList.remove('ex-undone'); }
    else { row.classList.remove('ex-done'); }
    this.updateExCounter();
  },

  checkAllEx: function(checked) {
    var rows = document.querySelectorAll('#exTbody tr.ex-row');
    rows.forEach(function(row) {
      var cb = row.querySelector('.ex-check');
      cb.checked = checked;
      if (checked) { row.classList.add('ex-done'); row.classList.remove('ex-undone'); }
      else { row.classList.remove('ex-done'); }
    });
    this.updateExCounter();
  },

  updateExCounter: function() {
    var el = document.getElementById('exCounter');
    if (!el) return;
    var total = document.querySelectorAll('#exTbody tr.ex-row').length;
    var done = document.querySelectorAll('#exTbody tr.ex-row.ex-done').length;
    el.textContent = 'Выполнено: ' + done + ' / ' + total;
  },

  openMeasurementModal: function() {
    var today = new Date().toISOString().slice(0, 10);
    this.openModal('Новый замер',
      '<form id="measForm"><div class="field"><label>Дата</label><input type="date" class="input" name="measure_date" value="' + today + '" required></div>' +
      '<div class="grid grid-2"><div class="field"><label>Вес</label><input type="number" step="0.1" class="input" name="weight"></div>' +
      '<div class="field"><label>Талия</label><input type="number" step="0.1" class="input" name="waist"></div>' +
      '<div class="field"><label>Грудь</label><input type="number" step="0.1" class="input" name="chest"></div>' +
      '<div class="field"><label>Бедро</label><input type="number" step="0.1" class="input" name="thigh"></div></div></form>',
      '<button class="btn btn-ghost" data-close>Отмена</button><button class="btn btn-primary" onclick="Trainer.saveMeasurement()">Сохранить</button>');
    var self = this;
    document.querySelectorAll('#modalFooter [data-close]').forEach(function(b) { b.addEventListener('click', function() { self.closeModal(); }); });
  },

  saveMeasurement: function() {
    var fd = new FormData(document.getElementById('measForm'));
    var data = { client_id: this.currentClient, measure_date: fd.get('measure_date'), weight: fd.get('weight') ? Number(fd.get('weight')) : null, waist: fd.get('waist') ? Number(fd.get('waist')) : null, chest: fd.get('chest') ? Number(fd.get('chest')) : null, thigh: fd.get('thigh') ? Number(fd.get('thigh')) : null };
    var self = this;
    API.createMeasurement(data).then(function() { toast('Добавлен', '', 'success'); self.closeModal(); self.renderClientMeasurements(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  delMeasurement: function(id) {
    if (!confirm('Удалить?')) return;
    var self = this;
    API.deleteMeasurement(id).then(function() { toast('Удалено', '', 'success'); self.renderClientMeasurements(); })
      .catch(function(e) { toast('Ошибка', e.message, 'error'); });
  },

  esc: function(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; },

  toggleSidebar: function() {
    var sb = document.getElementById('sidebar');
    if (!sb.querySelector('.sb-mobile-header')) {
      var hd = document.createElement('div');
      hd.className = 'sb-mobile-header';
      hd.innerHTML = '<button class="sb-close-btn" onclick="Trainer.closeSidebar()">' + Icons.svg('menu', 20) + '</button>' +
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
  if (document.getElementById('sidebar') && location.pathname.indexOf('trainer') >= 0) {
    Trainer.init();
  }
});
