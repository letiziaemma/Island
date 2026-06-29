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
  const container = document.getElementById('countdown');
  if (!container) return;

  function update() {
    const { days, hours, minutes, seconds } = daysUntil(trip.endDate);
    const accents = ['magenta', 'cyan', 'lime'];
    const units = [
      { value: days, label: 'Days' },
      { value: String(hours).padStart(2, '0'), label: 'Hours' },
      { value: String(minutes).padStart(2, '0'), label: 'Min' },
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

  update();
  countdownInterval = setInterval(update, 1000);
}

function renderMilestones(milestones) {
  const container = document.getElementById('milestones');
  if (!container) return;

  const items = milestones
    .map(
      (m, i) => `
      <div class="milestone milestone--${m.status}">
        <span class="milestone__number mono">${i + 1}</span>
        <div class="milestone__info">
          <p class="milestone__title">${m.title}</p>
          <p class="milestone__day">Day ${m.day}</p>
        </div>
        <span class="milestone__badge milestone__badge--${m.status}">${m.status}</span>
      </div>
    `
    )
    .join('');

  container.innerHTML = `<div class="milestones">${items}</div>`;
}

function renderStatistics(stats, trip) {
  const container = document.getElementById('statistics');
  if (!container) return;

  const totalDays = daysBetween(trip.startDate, trip.endDate);
  const accents = ['cyan', 'lime', 'magenta', 'cyan', 'lime', 'magenta'];
  const units = [
    { value: `${stats.daysElapsed}<span class="hero__stat-sep">/</span>${totalDays}`, label: 'Days' },
    { value: `${stats.distanceCovered}<span class="hero__stat-sep">/</span>${stats.totalDistance}`, label: 'km' },
    { value: stats.waterfalls, label: 'Waterfalls' },
    { value: stats.photosTaken, label: 'Photos' },
    { value: stats.coffeesConsumed, label: 'Coffees' },
    { value: stats.daysRemaining, label: 'Days left' },
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
