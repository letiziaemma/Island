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
    container.innerHTML = `
      <div class="countdown">
        <div class="countdown__unit">
          <span class="countdown__number mono" data-unit="days">${days}</span>
          <span class="countdown__label">Days</span>
        </div>
        <div class="countdown__unit">
          <span class="countdown__number mono" data-unit="hours">${String(hours).padStart(2, '0')}</span>
          <span class="countdown__label">Hours</span>
        </div>
        <div class="countdown__unit">
          <span class="countdown__number mono" data-unit="minutes">${String(minutes).padStart(2, '0')}</span>
          <span class="countdown__label">Min</span>
        </div>
        <div class="countdown__unit">
          <span class="countdown__number mono" data-unit="seconds">${String(seconds).padStart(2, '0')}</span>
          <span class="countdown__label">Sec</span>
        </div>
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

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat">
        <p class="stat__value mono">${stats.daysElapsed}</p>
        <p class="stat__label">Days elapsed</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.daysRemaining}</p>
        <p class="stat__label">Days remaining</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.distanceCovered}</p>
        <p class="stat__label">km covered</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.totalDistance}</p>
        <p class="stat__label">km total</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.waterfalls}</p>
        <p class="stat__label">Waterfalls</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.photosTaken}</p>
        <p class="stat__label">Photos</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${stats.coffeesConsumed}</p>
        <p class="stat__label">Coffees</p>
      </div>
      <div class="stat">
        <p class="stat__value mono">${totalDays}</p>
        <p class="stat__label">Trip days</p>
      </div>
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
