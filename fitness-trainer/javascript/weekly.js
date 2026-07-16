/* ============================================================
   WEEKLY TRACKER — еженедельный трекинг питания и активности.
   Тренер: задаёт цели, видит фактические данные клиента.
   Клиент: вводит фактические значения, видит прогресс.
   ============================================================ */
(function() {
  var API_BASE = 'http://127.0.0.1:8000';

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = typeof Token !== 'undefined' ? Token.get() : localStorage.getItem('fc_token');
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  async function wapi(path, opts) {
    opts = opts || {};
    var res = await fetch(API_BASE + '/api/weekly' + path, {
      method: opts.method || 'GET',
      headers: authHeaders(),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      var d = await res.json().catch(function() { return { detail: 'Ошибка' }; });
      throw new Error(d.detail || 'Ошибка запроса');
    }
    return res.json();
  }

  /* --- Иконки --- */
  function ic(name, sz) {
    sz = sz || 18;
    var map = {
      flame: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/>',
      droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0L12 2.69z"/>',
      moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
      foot: '<path d="M4 16v-2.5a2.5 2.5 0 015 0V16a2 2 0 11-4 0zm9-6.5a2.5 2.5 0 015 0V14a2 2 0 11-4 0V9.5zM7.5 6a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm6-2a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>',
      trendUp: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
      trendDown: '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
      check: '<polyline points="20 6 9 17 4 12"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
      link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
      calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
      save: '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
      arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    };
    var p = map[name] || '';
    return '<svg viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function fd(d) { return window.fmtDate ? fmtDate(d) : (d || '—'); }

  function progressBadge(status) {
    if (status === 'progress') return '<span class="wk-badge wk-progress">' + ic('trendUp', 14) + ' Прогресс</span>';
    if (status === 'regression') return '<span class="wk-badge wk-regression">' + ic('trendDown', 14) + ' Регресс</span>';
    if (status === 'repeated_regression') return '<span class="wk-badge wk-repeated">' + ic('alert', 14) + ' Повторный регресс!</span>';
    if (status === 'stable') return '<span class="wk-badge wk-stable">Стабильно</span>';
    if (status === 'first') return '<span class="wk-badge wk-first">Первая неделя</span>';
    return '<span class="wk-badge wk-stable">—</span>';
  }

  function metricRow(label, target, actual, unit, invert) {
    var tHtml = target != null ? target + (unit ? ' ' + unit : '') : '—';
    var aHtml = actual != null ? actual + (unit ? ' ' + unit : '') : '<span class="wk-pending">не введено</span>';
    var cls = '';
    if (target != null && actual != null) {
      var ok;
      if (invert) {
        ok = actual <= target * 1.1;
      } else {
        ok = actual >= target * 0.85;
      }
      cls = ok ? 'wk-good' : 'wk-bad';
    }
    return '<div class="wk-metric-row">' +
      '<span class="wk-metric-label">' + label + '</span>' +
      '<span class="wk-metric-target">' + tHtml + '</span>' +
      '<span class="wk-metric-arrow"></span>' +
      '<span class="wk-metric-actual ' + cls + '">' + aHtml + '</span>' +
      '</div>';
  }

  /* =================== VIEW: ТРЕНЕР =================== */
  var WeeklyTracker = {
    _clientId: null,
    _clientName: '',

    openForTrainer: function(clientId, clientName) {
      this._clientId = clientId;
      this._clientName = clientName || '';
      this.renderTrainerView();
    },

    async renderTrainerView() {
      var main = document.getElementById('mainContent');
      var self = this;
      main.innerHTML = '<div class="spinner"></div>';

      var items = [];
      try { items = await wapi('/' + self._clientId); } catch(e) {}

      var html = '<div class="wk-header">' +
        '<button class="btn-back" onclick="Trainer.navigate(\'client-profile\')" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;display:flex;align-items:center;gap:6px;margin-bottom:12px;">' + ic('arrowLeft', 16) + ' Назад</button>' +
        '<h1 class="page-title">' + ic('calendar', 26) + ' Еженедельный трекинг</h1>' +
        '<p class="page-subtitle">' + esc(self._clientName) + ' — цель, факт, прогресс</p>' +
        '<button class="btn btn-primary wk-add-btn" onclick="WeeklyTracker.openCreateModal()">' + ic('plus', 16) + ' Добавить неделю</button>' +
        '</div>';

      if (!items.length) {
        html += '<div class="card wk-empty"><p style="color:var(--text-muted);text-align:center;padding:40px 0;">Пока нет данных. Нажмите «Добавить неделю» чтобы задать цели для клиента.</p></div>';
      } else {
        items.sort(function(a, b) { return b.week_number - a.week_number; });
        for (var i = 0; i < items.length; i++) {
          html += self._renderWeekCard(items[i], true);
        }
      }

      main.innerHTML = html;
    },

    _renderWeekCard: function(ci, isTrainer) {
      var wd = ci.weight_delta;
      var wdHtml = '';
      if (wd != null) {
        var sign = wd > 0 ? '+' : '';
        var cls = wd < 0 ? 'wk-down' : (wd > 0 ? 'wk-up' : '');
        wdHtml = '<span class="wk-weight-delta ' + cls + '">' + sign + wd + ' кг</span>';
      }

      var menuHtml = '';
      if (ci.nutrition_menu_url) {
        menuHtml = '<a href="' + esc(ci.nutrition_menu_url) + '" target="_blank" class="wk-menu-link">' + ic('link', 14) + ' Меню питания</a>';
      }

      var notesHtml = '';
      if (ci.trainer_notes) {
        notesHtml = '<div class="wk-notes">' + esc(ci.trainer_notes) + '</div>';
      }

      return '<div class="card wk-card wk-status-' + (ci.progress_status || 'none') + '">' +
        '<div class="wk-card-head">' +
          '<div class="wk-week-info">' +
            '<span class="wk-week-num">Неделя №' + ci.week_number + '</span>' +
            '<span class="wk-week-date">' + fd(ci.check_date) + '</span>' +
          '</div>' +
          progressBadge(ci.progress_status) +
        '</div>' +

        (ci.weight != null || wdHtml ? '<div class="wk-weight-row">' +
          (ci.weight != null ? '<span class="wk-weight">Вес: <strong>' + ci.weight + ' кг</strong></span>' : '<span class="wk-weight">Вес: <span class="wk-pending">не указан</span></span>') +
          wdHtml +
        '</div>' : '') +

        '<div class="wk-metrics">' +
          '<div class="wk-metric-header"><span>Показатель</span><span>Цель</span><span></span><span>Факт</span></div>' +
          metricRow(ic('flame', 14) + ' Калории', ci.target_calories, ci.actual_calories, 'ккал', true) +
          metricRow('Белки', ci.target_protein, ci.actual_protein, 'г') +
          metricRow('Жиры', ci.target_fat, ci.actual_fat, 'г') +
          metricRow('Углеводы', ci.target_carbs, ci.actual_carbs, 'г') +
          metricRow(ic('foot', 14) + ' Шаги', ci.target_steps, ci.actual_steps, '') +
          metricRow(ic('droplet', 14) + ' Вода', ci.target_water, ci.actual_water, 'л') +
          metricRow(ic('moon', 14) + ' Сон', ci.target_sleep, ci.actual_sleep, 'ч') +
        '</div>' +

        (ci.actual_activity ? '<div class="wk-activity"><span class="wk-act-label">Активность:</span> ' + esc(ci.actual_activity) + '</div>' : '') +
        menuHtml +
        notesHtml +

        (isTrainer ? '<div class="wk-card-actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="WeeklyTracker.openEditModal(' + ci.id + ')">Изменить цели</button>' +
        '</div>' : '') +
        '</div>';
    },

    /* --- Модалка: создать неделю --- */
    openCreateModal: function() {
      var today = new Date().toISOString().slice(0, 10);
      var html = '<div class="modal-overlay open" id="wkModal">' +
        '<div class="modal">' +
        '<div class="modal-header"><h3>Новая неделя</h3>' +
        '<button data-wk-close class="modal-close wk-reject" title="Отменить"></button>' +
        '<button onclick="WeeklyTracker.saveCreate()" class="modal-close wk-accept" title="Создать"></button>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="field"><label>Дата</label><input type="date" class="input" id="wk_date" value="' + today + '"></div>' +
        '<div class="wk-form-grid">' +
          '<div class="field"><label>Калории (цель)</label><input type="number" class="input" id="wk_cal" placeholder="2000"></div>' +
          '<div class="field"><label>Шаги (цель)</label><input type="number" class="input" id="wk_steps" placeholder="10000"></div>' +
          '<div class="field"><label>Белки, г</label><input type="number" class="input" id="wk_protein" placeholder="150"></div>' +
          '<div class="field"><label>Жиры, г</label><input type="number" class="input" id="wk_fat" placeholder="70"></div>' +
          '<div class="field"><label>Углеводы, г</label><input type="number" class="input" id="wk_carbs" placeholder="200"></div>' +
          '<div class="field"><label>Вода, л</label><input type="number" step="0.1" class="input" id="wk_water" placeholder="2.5"></div>' +
          '<div class="field"><label>Сон, ч (цель)</label><input type="number" step="0.5" class="input" id="wk_sleep" placeholder="8"></div>' +
        '</div>' +
        '<div class="field"><label>Ссылка на меню питания</label><input type="url" class="input" id="wk_menu" placeholder="https://..."></div>' +
        '<div class="field"><label>Заметки для клиента</label><textarea class="input" id="wk_notes" rows="2" placeholder="Комментарий..."></textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-danger" data-wk-close>' + ic('x', 14) + ' Отменить</button> ' +
        '<button class="btn btn-success" onclick="WeeklyTracker.saveCreate()">' + ic('save', 16) + ' Создать</button></div>' +
        '</div></div>';

      var old = document.getElementById('wkModal');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      document.querySelectorAll('[data-wk-close]').forEach(function(b) {
        b.onclick = function() { document.getElementById('wkModal').remove(); };
      });
    },

    async saveCreate() {
      var data = {
        check_date: document.getElementById('wk_date').value,
        target_calories: +document.getElementById('wk_cal').value || null,
        target_protein: +document.getElementById('wk_protein').value || null,
        target_fat: +document.getElementById('wk_fat').value || null,
        target_carbs: +document.getElementById('wk_carbs').value || null,
        target_steps: +document.getElementById('wk_steps').value || null,
        target_water: +document.getElementById('wk_water').value || null,
        target_sleep: +document.getElementById('wk_sleep').value || null,
        nutrition_menu_url: document.getElementById('wk_menu').value || null,
        trainer_notes: document.getElementById('wk_notes').value || null,
      };
      try {
        await wapi('/' + this._clientId, { method: 'POST', body: data });
        toast('Создано', 'Неделя добавлена', 'success');
        document.getElementById('wkModal').remove();
        this.renderTrainerView();
      } catch(e) { toast('Ошибка', e.message, 'error'); }
    },

    /* --- Модалка: изменить цели --- */
    _editData: null,

    async openEditModal(checkinId) {
      var items = await wapi('/' + this._clientId);
      var ci = items.find(function(c) { return c.id === checkinId; });
      if (!ci) return;
      this._editData = ci;

        var html = '<div class="modal-overlay open" id="wkModal">' +
        '<div class="modal">' +
        '<div class="modal-header"><h3>Цели — Неделя №' + ci.week_number + '</h3>' +
        '<button data-wk-close class="modal-close wk-reject" title="Отменить"></button>' +
        '<button onclick="WeeklyTracker.saveEdit(' + checkinId + ')" class="modal-close wk-accept" title="Сохранить"></button>' +
        '</div>' +
        '<div class="modal-body">' +
        '<div class="wk-form-grid">' +
          '<div class="field"><label>Калории</label><input type="number" class="input" id="wk_cal" value="' + (ci.target_calories || '') + '"></div>' +
          '<div class="field"><label>Шаги</label><input type="number" class="input" id="wk_steps" value="' + (ci.target_steps || '') + '"></div>' +
          '<div class="field"><label>Белки, г</label><input type="number" class="input" id="wk_protein" value="' + (ci.target_protein || '') + '"></div>' +
          '<div class="field"><label>Жиры, г</label><input type="number" class="input" id="wk_fat" value="' + (ci.target_fat || '') + '"></div>' +
          '<div class="field"><label>Углеводы, г</label><input type="number" class="input" id="wk_carbs" value="' + (ci.target_carbs || '') + '"></div>' +
          '<div class="field"><label>Вода, л</label><input type="number" step="0.1" class="input" id="wk_water" value="' + (ci.target_water || '') + '"></div>' +
          '<div class="field"><label>Сон, ч</label><input type="number" step="0.5" class="input" id="wk_sleep" value="' + (ci.target_sleep || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>Ссылка на меню</label><input type="url" class="input" id="wk_menu" value="' + esc(ci.nutrition_menu_url || '') + '"></div>' +
        '<div class="field"><label>Заметки</label><textarea class="input" id="wk_notes" rows="2">' + esc(ci.trainer_notes || '') + '</textarea></div>' +
        '</div>' +
        '<div class="modal-footer"><button class="btn btn-danger" data-wk-close>' + ic('x', 14) + ' Отменить</button> ' +
        '<button class="btn btn-success" onclick="WeeklyTracker.saveEdit(' + checkinId + ')">' + ic('save', 16) + ' Сохранить</button></div>' +
        '</div></div>';

      var old = document.getElementById('wkModal');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
      document.querySelectorAll('[data-wk-close]').forEach(function(b) {
        b.onclick = function() { document.getElementById('wkModal').remove(); };
      });
    },

    async saveEdit(checkinId) {
      var data = {
        target_calories: +document.getElementById('wk_cal').value || null,
        target_protein: +document.getElementById('wk_protein').value || null,
        target_fat: +document.getElementById('wk_fat').value || null,
        target_carbs: +document.getElementById('wk_carbs').value || null,
        target_steps: +document.getElementById('wk_steps').value || null,
        target_water: +document.getElementById('wk_water').value || null,
        target_sleep: +document.getElementById('wk_sleep').value || null,
        nutrition_menu_url: document.getElementById('wk_menu').value || null,
        trainer_notes: document.getElementById('wk_notes').value || null,
      };
      try {
        await wapi('/' + checkinId + '/targets', { method: 'PUT', body: data });
        toast('Сохранено', '', 'success');
        document.getElementById('wkModal').remove();
        this.renderTrainerView();
      } catch(e) { toast('Ошибка', e.message, 'error'); }
    },

    /* =================== VIEW: КЛИЕНТ =================== */
    async renderClientView() {
      var main = document.getElementById('mainContent');
      var self = this;
      main.innerHTML = '<div class="spinner"></div>';

      var items = [];
      try { items = await wapi('/my/list'); } catch(e) {}

      if (!items.length) {
        main.innerHTML = '<h1 class="page-title">' + ic('calendar', 26) + ' Мой дневник</h1>' +
          '<p class="page-subtitle">Еженедельный трекинг питания и активности</p>' +
          '<div class="card wk-empty"><p style="color:var(--text-muted);text-align:center;padding:40px 0;">Тренер ещё не добавил недельный план. Как только добавит — вы увидите цели и сможете вводить свои показатели.</p></div>';
        return;
      }

      items.sort(function(a, b) { return b.week_number - a.week_number; });
      var current = items[0];
      var history = items.slice(1);

      var html = '<h1 class="page-title">' + ic('calendar', 26) + ' Мой дневник</h1>' +
        '<p class="page-subtitle">Неделя №' + current.week_number + ' из ' + items.length + '</p>';

      // Мотивационное сообщение
      html += self._motivation(current.progress_status);

      // Текущая неделя (большая карточка с вводом)
      html += self._renderClientCurrent(current);

      // Ссылка на меню
      if (current.nutrition_menu_url) {
        html += '<div class="card" style="margin-top:16px;"><a href="' + esc(current.nutrition_menu_url) + '" target="_blank" class="wk-menu-link">' + ic('link', 16) + ' Открыть меню питания</a></div>';
      }

      // История
      if (history.length) {
        html += '<h3 style="margin:24px 0 12px;">История</h3>';
        for (var i = 0; i < history.length; i++) {
          html += self._renderWeekCard(history[i], false);
        }
      }

      main.innerHTML = html;
    },

    _motivation: function(status) {
      if (status === 'progress') return '<div class="wk-motiv wk-motiv-good">' + ic('trendUp', 20) + ' Отличная работа! Продолжайте в том же духе!</div>';
      if (status === 'regression') return '<div class="wk-motiv wk-motiv-bad">' + ic('trendDown', 20) + ' На этой неделе небольшой откат. Не сдавайтесь!</div>';
      if (status === 'repeated_regression') return '<div class="wk-motiv wk-motiv-alert">' + ic('alert', 20) + ' Внимание: повторный регресс. Стоит пересмотреть подход с тренером.</div>';
      if (status === 'first') return '<div class="wk-motiv wk-motiv-info">' + ic('calendar', 20) + ' Первая неделя — это старт. Заполняйте показатели регулярно!</div>';
      return '<div class="wk-motiv wk-motiv-info">Заполняйте свои показатели каждую неделю.</div>';
    },

    _renderClientCurrent: function(ci) {
      var self = this;
      var wd = ci.weight_delta;
      var wdHtml = '';
      if (wd != null) {
        var sign = wd > 0 ? '+' : '';
        var cls = wd < 0 ? 'wk-down' : (wd > 0 ? 'wk-up' : '');
        wdHtml = '<span class="wk-weight-delta ' + cls + '">' + sign + wd + ' кг к прошлой неделе</span>';
      }

      return '<div class="card wk-card wk-current wk-status-' + (ci.progress_status || 'none') + '">' +
        '<div class="wk-card-head">' +
          '<div class="wk-week-info"><span class="wk-week-num">Неделя №' + ci.week_number + '</span><span class="wk-week-date">' + fd(ci.check_date) + '</span></div>' +
          progressBadge(ci.progress_status) +
        '</div>' +
        (wdHtml ? '<div style="margin-bottom:16px;">' + wdHtml + '</div>' : '') +

        '<div class="wk-input-grid">' +
          self._inputField('weight', 'Вес, кг', ci.weight, 'number', '0.1') +
          self._inputField('actual_calories', ic('flame', 14) + ' Калории', ci.actual_calories, 'number') +
          self._inputField('actual_steps', ic('foot', 14) + ' Шаги', ci.actual_steps, 'number') +
          self._inputField('actual_water', ic('droplet', 14) + ' Вода, л', ci.actual_water, 'number', '0.1') +
          self._inputField('actual_sleep', ic('moon', 14) + ' Сон, ч', ci.actual_sleep, 'number', '0.5') +
          self._inputField('actual_protein', 'Белки, г', ci.actual_protein, 'number') +
          self._inputField('actual_fat', 'Жиры, г', ci.actual_fat, 'number') +
          self._inputField('actual_carbs', 'Углеводы, г', ci.actual_carbs, 'number') +
        '</div>' +

        '<div class="field" style="margin-top:12px;"><label>Активность</label><textarea class="input" id="wk_act" rows="2" placeholder="Что делали на этой неделе...">' + esc(ci.actual_activity || '') + '</textarea></div>' +

        // Цели от тренера (только для чтения)
        '<div class="wk-targets-summary">' +
          '<h4 style="font-size:13px;color:var(--text-muted);margin-bottom:8px;">Цели от тренера:</h4>' +
          '<div class="wk-targets-grid">' +
            self._targetChip('Калории', ci.target_calories, 'ккал') +
            self._targetChip('Белки', ci.target_protein, 'г') +
            self._targetChip('Жиры', ci.target_fat, 'г') +
            self._targetChip('Углеводы', ci.target_carbs, 'г') +
            self._targetChip('Шаги', ci.target_steps, '') +
            self._targetChip('Вода', ci.target_water, 'л') +
            self._targetChip('Сон', ci.target_sleep, 'ч') +
          '</div>' +
        '</div>' +

        (ci.trainer_notes ? '<div class="wk-notes wk-notes-trainer">' + esc(ci.trainer_notes) + '</div>' : '') +

        '<button class="btn btn-primary" style="margin-top:16px;" onclick="WeeklyTracker.saveActuals(' + ci.id + ')">' + ic('save', 16) + ' Сохранить показатели</button>' +
        '</div>';
    },

    _inputField: function(id, label, val, type, step) {
      return '<div class="field"><label>' + label + '</label>' +
        '<input type="' + (type || 'text') + '" step="' + (step || '1') + '" class="input" id="wk_in_' + id + '" value="' + (val != null ? val : '') + '" placeholder="—"></div>';
    },

    _targetChip: function(label, val, unit) {
      return '<div class="wk-target-chip"><span class="wk-tc-label">' + label + '</span><span class="wk-tc-val">' + (val != null ? val + (unit ? ' ' + unit : '') : '—') + '</span></div>';
    },

    async saveActuals(checkinId) {
      var g = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
      var data = {
        weight: +g('wk_in_weight') || null,
        actual_calories: +g('wk_in_actual_calories') || null,
        actual_steps: +g('wk_in_actual_steps') || null,
        actual_water: +g('wk_in_actual_water') || null,
        actual_sleep: +g('wk_in_actual_sleep') || null,
        actual_protein: +g('wk_in_actual_protein') || null,
        actual_fat: +g('wk_in_actual_fat') || null,
        actual_carbs: +g('wk_in_actual_carbs') || null,
        actual_activity: g('wk_act') || null,
      };
      try {
        await wapi('/my/' + checkinId, { method: 'PUT', body: data });
        toast('Сохранено!', 'Прогресс пересчитан', 'success');
        this.renderClientView();
      } catch(e) { toast('Ошибка', e.message, 'error'); }
    },
  };

  window.WeeklyTracker = WeeklyTracker;
})();
