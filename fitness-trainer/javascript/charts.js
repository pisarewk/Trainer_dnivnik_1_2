/* ============================================================
   CHARTS — построение графиков через Chart.js.
   Хранит ссылки на активные графики для пересоздания.
   ============================================================ */

const Charts = {
  instances: {},

  destroy(id) {
    if (this.instances[id]) {
      this.instances[id].destroy();
      delete this.instances[id];
    }
  },

  clearAll() {
    Object.keys(this.instances).forEach(k => this.destroy(k));
  },

  /** Линейный график (например, изменение веса). */
  line(id, labels, datasets, title = '') {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    this.instances[id] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: datasets.map((ds, i) => ({
          label: ds.label,
          data: ds.data,
          borderColor: ds.color || ['#4399fa', '#ff5a5f', '#2ecc71'][i % 3],
          backgroundColor: (ds.color || '#4399fa') + '22',
          fill: ds.fill !== false,
          tension: 0.35,
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
        })),
      },
      options: this._baseOptions(title),
    });
  },

  /** Столбчатый график (например, рабочий вес по тренировкам). */
  bar(id, labels, data, label = '', color = '#4399fa') {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    this.instances[id] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label, data,
          backgroundColor: color + 'cc',
          borderColor: color,
          borderWidth: 2,
          borderRadius: 8,
        }],
      },
      options: this._baseOptions(label),
    });
  },

  /** Пончик (например, распределение). */
  doughnut(id, labels, data, colors) {
    this.destroy(id);
    const ctx = document.getElementById(id);
    if (!ctx) return;
    this.instances[id] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
      },
    });
  },

  _baseOptions(title) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' },
        title: { display: !!title, text: title, font: { size: 15 } },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        y: { beginAtZero: false, grid: { color: '#eef2f7' } },
        x: { grid: { display: false } },
      },
      animation: { duration: 800, easing: 'easeOutQuart' },
    };
  },
};
