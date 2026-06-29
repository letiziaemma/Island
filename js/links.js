import { fetchTripData } from './data.js';
import {
  initNav,
  daysUntil,
  daysBetween,
  showError,
  showLoading,
} from './app.js';

let countdownInterval = null;

function renderLinkItem(item) {
  return `
    <li class="link-item">
      <a href="${item.url}" class="link-item__title" ${
        item.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''
      }>${item.title}</a>
      <span class="link-item__note">${item.note}</span>
    </li>
  `;
}

function renderCategory(category) {
  const items = category.items.map(renderLinkItem).join('');

  return `
    <section class="card link-category" id="${category.id}">
      <h2 class="link-category__title label">${category.label}</h2>
      <ul class="link-list">${items}</ul>
    </section>
  `;
}

function renderLinks(links) {
  const container = document.getElementById('links-grid');
  if (!container) return;

  container.innerHTML = links.categories.map(renderCategory).join('');
}

function renderCountdown(trip) {
  function update() {
    const { days, hours, minutes } = daysUntil(trip.endDate);
    const els = [
      { id: 'stat-cd-days', value: days },
      { id: 'stat-cd-hours', value: String(hours).padStart(2, '0') },
      { id: 'stat-cd-min', value: String(minutes).padStart(2, '0') },
    ];
    els.forEach(({ id, value }) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

const STOPS_KEY = 'island-stops-v1';

function loadStops(base) {
  try {
    const saved = localStorage.getItem(STOPS_KEY);
    return saved ? JSON.parse(saved) : base.map(m => ({ ...m }));
  } catch {
    return base.map(m => ({ ...m }));
  }
}

function saveStops(stops) {
  localStorage.setItem(STOPS_KEY, JSON.stringify(stops));
}

function renderMilestones(base) {
  const container = document.getElementById('milestones');
  if (!container) return;

  let stops = loadStops(base);

  function mapsUrl(title, customUrl) {
    if (customUrl) return customUrl;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title + ' Iceland')}`;
  }

  function draw() {
    const items = stops.map((m, i) => {
      const when = m.date
        ? `${m.date}${m.time ? ' · ' + m.time : ''}`
        : (m.day ? `Day ${m.day}` : '');
      const href = mapsUrl(m.title, m.url);
      return `
      <div class="milestone milestone--${m.status}">
        <span class="milestone__number mono">${i + 1}</span>
        <div class="milestone__info">
          <p class="milestone__title">
            <a class="stop-maps-link" href="${href}" target="_blank" rel="noopener noreferrer">${m.title}</a>
          </p>
          ${when ? `<p class="milestone__day">${when}</p>` : ''}
        </div>
        <span class="milestone__badge milestone__badge--${m.status}">${m.status}</span>
        <button class="stop-delete" data-index="${i}" aria-label="Delete stop">✕</button>
      </div>
    `;
    }).join('');

    container.innerHTML = `
      <div class="milestones">${items}</div>
      <form class="stop-add-form" id="stop-add-form">
        <input class="stop-add-input" type="text" placeholder="Stop name" id="stop-title" required />
        <input class="stop-add-input stop-add-input--day" type="date" id="stop-date" required />
        <input class="stop-add-input stop-add-input--day" type="time" id="stop-time" />
        <input class="stop-add-input" type="url" placeholder="Maps URL (optional)" id="stop-url" />
        <button class="stop-add-btn" type="submit">+ Add</button>
      </form>
    `;

    ['#stop-date', '#stop-time'].forEach(id => {
      const el = container.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => el.classList.toggle('has-value', !!el.value));
    });

    container.querySelectorAll('.stop-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        stops.splice(Number(btn.dataset.index), 1);
        saveStops(stops);
        draw();
      });
    });

    container.querySelector('#stop-add-form').addEventListener('submit', e => {
      e.preventDefault();
      const title = container.querySelector('#stop-title').value.trim();
      const date = container.querySelector('#stop-date').value;
      const time = container.querySelector('#stop-time').value;
      const url = container.querySelector('#stop-url').value.trim() || null;
      if (!title || !date) return;
      stops.push({ id: `u-${Date.now()}`, title, date, time: time || null, url, status: 'upcoming' });
      stops.sort((a, b) => {
        const aKey = `${a.date || '9999-99-99'} ${a.time || '99:99'}`;
        const bKey = `${b.date || '9999-99-99'} ${b.time || '99:99'}`;
        return aKey.localeCompare(bKey);
      });
      saveStops(stops);
      draw();
    });
  }

  draw();
}

function renderStatistics(stats, trip) {
  const container = document.getElementById('statistics');
  if (!container) return;

  const totalDays = daysBetween(trip.startDate, trip.endDate);
  const accents = ['cyan', 'lime', 'magenta', 'magenta', 'cyan', 'lime'];
  const units = [
    { value: `${stats.daysElapsed}<span class="hero__stat-sep">/</span>${totalDays}`, label: 'Days' },
    { value: `${stats.distanceCovered}<span class="hero__stat-sep">/</span>${stats.totalDistance}`, label: 'km' },
    { value: `${stats.stopsDone}<span class="hero__stat-sep">/</span>${stats.stopsTotal}`, label: 'Stops' },
    { value: `<span id="stat-cd-days">--</span>`, label: 'Days' },
    { value: `<span id="stat-cd-hours">--</span>`, label: 'Hours' },
    { value: `<span id="stat-cd-min">--</span>`, label: 'Min' },
  ];

  container.innerHTML = `
    <div class="hero__stats" style="margin-top: 0; padding-bottom: 0; grid-template-columns: repeat(3, 1fr);">
      ${units.map((u, i) => `
        <div class="hero__stat">
          <span class="hero__stat-value hero__stat-value--${accents[i]}">${u.value}</span>
          <span class="hero__stat-label">${u.label}</span>
        </div>
      `).join('')}
    </div>
  `;
}

async function init() {
  initNav('links');

  const status = document.getElementById('page-status');
  if (status) showLoading(status);

  try {
    const data = await fetchTripData();
    if (status) status.innerHTML = '';

    renderCountdown(data.trip);
    renderMilestones(data.milestones);
    renderStatistics(data.statistics, data.trip);
    renderLinks(data.links);

    const countEl = document.getElementById('link-count');
    if (countEl) {
      const total = data.links.categories.reduce((sum, cat) => sum + cat.items.length, 0);
      countEl.textContent = `${total} links`;
    }
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();

window.addEventListener('beforeunload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
