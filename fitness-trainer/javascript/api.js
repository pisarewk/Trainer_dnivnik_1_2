/* ============================================================
   API — базовые функции для работы с сервером FastAPI.
   Хранение токена в localStorage, автоматическая авторизация.
   ============================================================ */

// Базовый адрес API. При запуске uvicorn на порту 8000.
const API_BASE = window.API_BASE || window.location.origin;

const Token = {
  get: () => localStorage.getItem('fc_token'),
  set: (t) => localStorage.setItem('fc_token', t),
  clear: () => { localStorage.removeItem('fc_token'); localStorage.removeItem('fc_session'); },
  setSession: (data) => localStorage.setItem('fc_session', JSON.stringify(data)),
  getSession: () => {
    try { return JSON.parse(localStorage.getItem('fc_session')); } catch { return null; }
  },
};

/** Универсальный запрос к API. */
async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = Token.get();
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);

  if (res.status === 401) {
    Token.clear();
    if (!location.pathname.includes('login') && !location.pathname.includes('landing')) {
      location.href = 'login.html';
    }
    throw new Error('Не авторизован');
  }

  if (!res.ok) {
    let msg = 'Ошибка запроса';
    try {
      const data = await res.json();
      msg = data.detail || msg;
    } catch {}
    throw new Error(msg);
  }

  if (res.status === 204) return null;
  return res.json();
}

/* --- Эндпоинты --- */
const API = {
  // Авторизация
  login: (username, password) => api('/api/auth/login', { method: 'POST', body: { username, password } }),
  me: () => api('/api/auth/me'),

  // Клиенты
  clients: (search) => api('/api/clients' + (search ? '?search=' + encodeURIComponent(search) : '')),
  client: (id) => api('/api/clients/' + id),
  createClient: (data) => api('/api/clients', { method: 'POST', body: data }),
  updateClient: (id, data) => api('/api/clients/' + id, { method: 'PUT', body: data }),
  deleteClient: (id) => api('/api/clients/' + id, { method: 'DELETE' }),
  archiveClientsBulk: (ids) => api('/api/clients/archive-bulk', { method: 'POST', body: { client_ids: ids } }),

  // Расписание
  mySchedule: () => api('/api/schedule/my'),
  setMySchedule: (slots) => api('/api/schedule/my', { method: 'POST', body: slots }),
  weekSchedule: (d) => api('/api/schedule/week' + (d ? '?date=' + d : '')),
  updateOwnProfile: (id, data) => api('/api/clients/' + id + '/profile', { method: 'PUT', body: data }),
  setPaidSessions: (id, n) => api('/api/clients/' + id + '/sessions', { method: 'PUT', body: { paid_sessions: n } }),

  // Тренировки
  trainings: (clientId) => api('/api/trainings?client_id=' + clientId),
  training: (id) => api('/api/trainings/' + id),
  createTraining: (data) => api('/api/trainings', { method: 'POST', body: data }),
  deleteTraining: (id) => api('/api/trainings/' + id, { method: 'DELETE' }),
  addComment: (id, comment, well_being) => api('/api/trainings/' + id + '/comment',
    { method: 'POST', body: { comment, well_being } }),
  rateTraining: (id, data) => api('/api/trainings/' + id + '/rate', { method: 'PUT', body: data }),

  // Замеры
  measurements: (clientId) => api('/api/measurements?client_id=' + clientId),
  createMeasurement: (data) => api('/api/measurements', { method: 'POST', body: data }),
  deleteMeasurement: (id) => api('/api/measurements/' + id, { method: 'DELETE' }),

  // Статистика
  records: (clientId) => api('/api/stats/' + clientId + '/records'),
  exerciseProgress: (clientId, exercise) =>
    api('/api/stats/' + clientId + '/exercise-progress?exercise=' + encodeURIComponent(exercise)),
  weightProgress: (clientId) => api('/api/stats/' + clientId + '/weight-progress'),
  attendance: (clientId) => api('/api/stats/' + clientId + '/attendance'),
  exerciseNames: (clientId) => api('/api/stats/' + clientId + '/exercise-names'),
  exerciseSummary: (clientId) => api('/api/stats/' + clientId + '/exercise-summary'),

  // Календарь / записи
  calendarSessions: (status) => api('/api/calendar/sessions' + (status ? '?status=' + status : '') + (status ? '&' : '?') + '_t=' + Date.now()),
  bookSession: (data) => api('/api/calendar/book', { method: 'POST', body: data }),
  bookForClient: (data) => api('/api/calendar/book-for-client', { method: 'POST', body: data }),
  confirmSession: (id) => api('/api/calendar/' + id + '/confirm', { method: 'PUT' }),
  cancelSession: (id, reason) => api('/api/calendar/' + id + '/cancel', { method: 'PUT', body: { reason: reason || '' } }),
  rescheduleSession: (id, data) => api('/api/calendar/' + id + '/reschedule', { method: 'PUT', body: data }),
  completeSession: (id, price) => api('/api/calendar/' + id + '/complete', { method: 'PUT', body: price != null ? { price: price } : {} }),
  updateSessionPrice: (id, price) => api('/api/calendar/' + id + '/price', { method: 'PUT', body: { price: price } }),
  availableSlots: (d) => api('/api/calendar/available-slots?d=' + d),
  earnings: () => api('/api/calendar/earnings'),
  setSessionPrice: (clientId, price) => api('/api/clients/' + clientId + '/price', { method: 'PUT', body: { session_price: price } }),

  // Уведомления
  notifications: () => api('/api/notifications'),
  newNotifications: (since) => api('/api/notifications/new' + (since ? '?since=' + encodeURIComponent(since) : '')),
  unreadCount: () => api('/api/notifications/unread-count'),
  markRead: (id) => api('/api/notifications/' + id + '/read', { method: 'POST' }),
  markAllRead: () => api('/api/notifications/read-all', { method: 'POST' }),

  // Рейтинг и опыт
  leaderboard: (limit = 50) => api('/api/leaderboard?limit=' + limit),
  clientRanking: (clientId) => api('/api/leaderboard/client/' + clientId),
  xpHistory: (clientId) => api('/api/leaderboard/client/' + clientId + '/history'),
  register: (data) => api('/api/auth/register', { method: 'POST', body: data }),
  updateTrainerProfile: (data) => api('/api/auth/trainer-profile', { method: 'PUT', body: data }),

  // Шаблоны тренировок
  templates: () => api('/api/templates'),
  createTemplate: (data) => api('/api/templates', { method: 'POST', body: data }),
  applyTemplate: (id, data) => api('/api/templates/' + id + '/apply', { method: 'POST', body: data }),
  applyTemplateBulk: (id, data) => api('/api/templates/' + id + '/apply-bulk', { method: 'POST', body: data }),
  deleteTemplate: (id) => api('/api/templates/' + id, { method: 'DELETE' }),

  // Отзывы
  reviews: () => api('/api/reviews'),
  allReviews: () => api('/api/reviews/all'),
  createReview: (data) => api('/api/reviews', { method: 'POST', body: data }),
  approveReview: (id) => api('/api/reviews/' + id + '/approve', { method: 'PUT' }),
  deleteReview: (id) => api('/api/reviews/' + id, { method: 'DELETE' }),

  // Аналитика
  attendanceReport: () => api('/api/analytics/attendance'),
  progressReport: () => api('/api/analytics/progress'),
  trainerReport: () => api('/api/analytics/trainer-report'),
  trainingFeedback: () => api('/api/analytics/training-feedback'),
};

/* --- Вспомогательные функции UI --- */

function showLoader(show = true) {
  const el = document.getElementById('loader');
  if (el) el.classList.toggle('open', show);
}

function toast(title, msg = '', type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<div class="toast-title">${title}</div>${msg ? '<div class="toast-msg">' + msg + '</div>' : ''}`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(40px)';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/** Форматирование даты YYYY-MM-DD → DD.MM.YYYY */
function fmtDate(d) {
  if (!d) return '—';
  const parts = String(d).split('-');
  if (parts.length === 3) return parts.reverse().join('.');
  return d;
}

/**
 * Парсинг timestamp от API как UTC и конвертация в локальное время.
 * Сервер хранит datetime.utcnow() — отдаёт ISO без суффикса 'Z'.
 * JS по умолчанию воспринимает это как локальное время → +3ч ошибка (Москва).
 * Эта функция добавляет 'Z' если нет timezone info.
 */
function parseUTC(iso) {
  if (!iso) return new Date();
  let s = String(iso);
  if (!s.endsWith('Z') && !s.includes('+') && !s.match(/-\d{2}:\d{2}$/)) {
    s += 'Z';
  }
  return new Date(s);
}

/** Форматирование времени HH:MM по Москве */
function fmtTime(iso) {
  if (!iso) return '';
  return parseUTC(iso).toLocaleTimeString('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "сколько времени назад" — корректный расчёт с учётом UTC */
function timeAgoCalc(iso) {
  const d = parseUTC(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return 'только что';
  if (diff < 60) return Math.max(1, Math.floor(diff)) + ' мин назад';
  if (diff < 3600) return Math.floor(diff / 60) + ' мин назад';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ч назад';
  return fmtDate(d.toISOString().slice(0, 10));
}

/** Возраст по дате рождения */
function age(birth) {
  if (!birth) return null;
  const b = new Date(birth);
  const diff = Date.now() - b.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

/** Инициалы для аватара */
function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

/** Требование авторизации на странице. */
function requireAuth(expectedRole) {
  const session = Token.getSession();
  const token = Token.get();
  if (!token || !session) {
    location.href = 'login.html';
    return null;
  }
  if (expectedRole && session.role !== expectedRole) {
    location.href = session.role === 'trainer' ? 'trainer-dashboard.html' : 'client-dashboard.html';
    return null;
  }
  return session;
}
