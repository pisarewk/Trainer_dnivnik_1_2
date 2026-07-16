/* ============================================================
   NOTIFICATIONS — колокольчик, панель, real-time popup toasts.
   ============================================================ */

/* --- SVG иконки для уведомлений (без эмодзи) --- */
const NotifIcons = {
  training: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5h11M17.5 17.5h-11M9 6.5V4h6v2.5M9 17.5V20h6v-2.5M7.5 9h9v6h-9z"/><path d="M4 9h2.5v6H4zM17.5 9H20v6h-2.5z"/></svg>',
  record: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.5 13L7 22l5-3 5 3-1.5-9"/></svg>',
  comment: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  profile: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
  booking: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4M9 14l2 2 4-4"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-5M12 8h.01"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  success: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>',
};

const Notifier = {
  pollTimer: null,
  popupPollTimer: null,
  lastCheckTime: null,
  shownIds: new Set(),
  soundEnabled: true,

  init() {
    const bell = document.getElementById('notifBell');
    const overlay = document.getElementById('notifOverlay');
    const closeBtns = document.querySelectorAll('[data-notif-close]');
    const markAll = document.getElementById('markAllRead');

    if (bell) {
      bell.addEventListener('click', () => {
        overlay.classList.add('open');
        this.renderList();
      });
    }
    closeBtns.forEach(b => b.addEventListener('click', () => overlay.classList.remove('open')));
    if (overlay) overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.remove('open');
    });

    if (markAll) {
      markAll.addEventListener('click', async () => {
        await API.markAllRead();
        this.refreshBadge();
        this.renderList();
        toast('Готово', 'Все уведомления отмечены', 'success');
      });
    }

    this.refreshBadge();

    // Запрашиваем разрешение на браузерные уведомления
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Первый опрос: устанавливаем lastCheckTime на текущее время,
    // чтобы не засыпать пользователя старыми уведомлениями при входе
    this.lastCheckTime = new Date().toISOString();

    // Polling badge каждые 30 секунд
    this.pollTimer = setInterval(() => this.refreshBadge(), 30000);

    // Polling новых уведомлений для popup каждые 10 секунд
    this.popupPollTimer = setInterval(() => this.checkNew(), 10000);

    // Проверяем сразу при загрузке (но только свежие)
    setTimeout(() => this.checkNew(), 3000);

    // Обновляем при возврате на вкладку
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.refreshBadge();
        this.checkNew();
      }
    });
  },

  /* --- Real-time: проверка новых уведомлений --- */
  async checkNew() {
    if (!this.lastCheckTime) {
      this.lastCheckTime = new Date().toISOString();
      return;
    }
    try {
      const items = await API.newNotifications(this.lastCheckTime);
      if (!items || items.length === 0) return;

      // Обновляем время последней проверки
      this.lastCheckTime = new Date().toISOString();

      // Показываем только те, что ещё не демонстрировались
      const fresh = items.filter(n => !this.shownIds.has(n.id));
      if (fresh.length === 0) return;

      // Сортируем по времени (старые сначала)
      fresh.sort((a, b) => parseUTC(a.created_at) - parseUTC(b.created_at));

      for (const n of fresh) {
        this.shownIds.add(n.id);
        this.showPopup(n);
      }

      this.refreshBadge();
    } catch (e) {
      // Тихо игнорируем ошибки опроса
    }
  },

  /* --- Показ всплывающего уведомления --- */
  showPopup(notif) {
    const category = notif.category || 'info';
    const iconSvg = NotifIcons[category] || NotifIcons.info;
    const toastType = this.categoryToToastType(category);

    // Toast popup
    const container = document.getElementById('toastContainer');
    if (container) {
      const el = document.createElement('div');
      el.className = 'toast toast-notif ' + toastType;
      el.innerHTML = `
        <div class="toast-notif-inner">
          <div class="toast-icon">${iconSvg}</div>
          <div class="toast-content">
            <div class="toast-title">${this.escape(notif.title)}</div>
            ${notif.message ? '<div class="toast-msg">' + this.escape(notif.message) + '</div>' : ''}
            <div class="toast-time">${this.timeAgo(notif.created_at)}</div>
          </div>
          <button class="toast-close" onclick="this.parentElement.parentElement.remove()">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;
      container.appendChild(el);

      // Анимация входа
      requestAnimationFrame(() => el.classList.add('show'));

      // Автоматическое скрытие через 6 секунд
      const hideTimer = setTimeout(() => this.hideToast(el), 6000);

      // Пауза авто-скрытия при наведении
      el.addEventListener('mouseenter', () => {
        clearTimeout(hideTimer);
        el.classList.add('paused');
      });
      el.addEventListener('mouseleave', () => {
        el.classList.remove('paused');
        setTimeout(() => this.hideToast(el), 3000);
      });

      // Клик по тосту — открыть панель уведомлений
      el.addEventListener('click', (e) => {
        if (e.target.closest('.toast-close')) return;
        const overlay = document.getElementById('notifOverlay');
        if (overlay) {
          overlay.classList.add('open');
          this.renderList();
        }
      });
    }

    // Браузерное уведомление (если есть разрешение и вкладка не активна)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotif = new Notification(notif.title, {
          body: notif.message || '',
          icon: '/favicon.ico',
          tag: 'notif-' + notif.id,
        });
        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
        };
      } catch {}
    }

    // Звук уведомления
    this.playSound();
  },

  hideToast(el) {
    if (!el || !el.parentElement) return;
    el.classList.remove('show');
    el.classList.add('hiding');
    setTimeout(() => el.remove(), 400);
  },

  /* --- Звук уведомления (Web Audio API, без файлов) --- */
  playSound() {
    if (!this.soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  },

  categoryToToastType(cat) {
    const map = {
      training: '',
      record: 'success',
      booking: '',
      comment: '',
      profile: '',
      info: '',
    };
    return map[cat] || '';
  },

  async refreshBadge() {
    try {
      const data = await API.unreadCount();
      const countEl = document.getElementById('notifCount');
      if (!countEl) return;
      const bell = document.getElementById('notifBell');
      if (data.count > 0) {
        countEl.textContent = data.count > 99 ? '99+' : data.count;
        countEl.classList.remove('hidden');
        if (bell) bell.classList.add('has-unread');
      } else {
        countEl.classList.add('hidden');
        if (bell) bell.classList.remove('has-unread');
      }
    } catch {}
  },

  async renderList() {
    const list = document.getElementById('notifList');
    if (!list) return;
    list.innerHTML = '<div class="spinner"></div>';
    try {
      const items = await API.notifications();
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p style="color:var(--text-muted);padding:40px 0;text-align:center;">Нет уведомлений</p></div>';
        return;
      }
      list.innerHTML = items.map(n => {
        const cat = n.category || 'info';
        const iconSvg = NotifIcons[cat] || NotifIcons.info;
        return `
        <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
          <div class="notif-item-inner">
            <div class="notif-icon">${iconSvg}</div>
            <div class="notif-body">
              <div class="notif-title">${this.escape(n.title)}</div>
              <div class="notif-msg">${this.escape(n.message)}</div>
              <div class="notif-time">${this.timeAgo(n.created_at)}</div>
            </div>
          </div>
        </div>
      `}).join('');

      list.querySelectorAll('.notif-item').forEach(el => {
        el.addEventListener('click', async () => {
          await API.markRead(el.dataset.id);
          el.classList.remove('unread');
          this.refreshBadge();
        });
      });
    } catch (err) {
      list.innerHTML = '<p style="color:var(--text-muted)">Не удалось загрузить уведомления</p>';
    }
  },

  timeAgo(iso) {
    return timeAgoCalc(iso);
  },

  escape(s) {
    const div = document.createElement('div');
    div.textContent = s || '';
    return div.innerHTML;
  },
};

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('notifBell')) {
    Notifier.init();
  }
});
