/* theme.js — тёмная/светлая тема */
window.Theme = {
  get: function() { return localStorage.getItem('fc_theme') || 'light'; },
  apply: function(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('fc_theme', t);
  },
  toggle: function() {
    this.apply(this.get() === 'dark' ? 'light' : 'dark');
  },
  init: function() {
    this.apply(this.get());
  }
};
