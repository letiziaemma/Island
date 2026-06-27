import { fetchTripData } from './data.js';
import {
  initNav,
  showError,
  showLoading,
} from './app.js';

const STATUS_LABELS = {
  completed: 'Done',
  current: 'Now',
  upcoming: 'Next',
};

function renderHero(data) {
  const container = document.getElementById('hero');
  if (!container) return;

  const { trip, today, statistics } = data;
  const { header } = trip;
  const eyebrow = header.eyebrow.join(' · ');

  const dynamicValues = [
    `${today.progress.activitiesDone}<span class="hero__stat-sep">/</span>${today.progress.activitiesTotal}`,
    `${statistics.distanceCovered}<span class="hero__stat-sep">/</span>${statistics.totalDistance}`,
    `${today.dayNumber}<span class="hero__stat-sep">/</span>${trip.totalDays}`,
  ];

  const stats = header.stats
    .map(
      (stat, i) => `
      <div class="hero__stat">
        <span class="hero__stat-value hero__stat-value--${stat.accent}">${dynamicValues[i]}</span>
        <span class="hero__stat-label">${stat.label}</span>
      </div>
    `
    )
    .join('');

  container.innerHTML = `
    <div class="hero__content">
      <p class="hero__eyebrow">${eyebrow}</p>
      <h1 class="display hero__title">${header.title}</h1>
      <p class="hero__subtitle">${header.subtitle}</p>
      <div class="hero__stats">${stats}</div>
    </div>
  `;
}

function renderItinerary(today) {
  const container = document.getElementById('itinerary');
  if (!container) return;

  const items = today.itinerary
    .map((item) => {
      const href = item.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`;
      return `
      <li class="itinerary__item itinerary__item--${item.status}">
        <span class="itinerary__time mono">${item.time}</span>
        <div class="itinerary__content">
          <span class="itinerary__title">${item.title}</span>
          <a class="itinerary__location" href="${href}" target="_blank" rel="noopener noreferrer">
            ${item.location}
            <svg class="itinerary__location-icon" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        </div>
        <span class="itinerary__status itinerary__status--${item.status}">
          ${STATUS_LABELS[item.status] || item.status}
        </span>
        <span class="itinerary__marker" aria-hidden="true"></span>
      </li>
    `;
    })
    .join('');

  container.innerHTML = `<ul class="itinerary">${items}</ul>`;
}

function renderProgress(today) {
  const container = document.getElementById('progress');
  if (!container) return;

  const { progress } = today;

  container.innerHTML = `
    <div class="progress">
      <div class="progress__header">
        <span class="progress__label">Today's activities</span>
        <span class="progress__value mono">${progress.activitiesDone} / ${progress.activitiesTotal}</span>
      </div>
      <div class="progress__track">
        <div class="progress__fill" style="width: ${progress.dayComplete}%"></div>
      </div>
    </div>
    <div class="progress">
      <div class="progress__header">
        <span class="progress__label">Trip progress</span>
        <span class="progress__value mono">${progress.tripComplete}%</span>
      </div>
      <div class="progress__track">
        <div class="progress__fill" style="width: ${progress.tripComplete}%"></div>
      </div>
    </div>
    <div class="progress">
      <div class="progress__header">
        <span class="progress__label">Distance today</span>
        <span class="progress__value mono">${progress.distanceToday} km</span>
      </div>
    </div>
    <div class="progress">
      <div class="progress__header">
        <span class="progress__label">Total distance</span>
        <span class="progress__value mono">${progress.distanceTotal} km</span>
      </div>
    </div>
  `;
}

const MEAL_TAGS = ['Nella', 'Letizia', 'Leonie', 'Auswärts', 'Einkaufen'];

function getMeals(today) {
  const stored = localStorage.getItem(`island-meals-${today.date}`);
  if (stored) {
    try { return JSON.parse(stored); } catch {}
  }
  return today.meals || {
    lunch:  { dish: '', tags: [] },
    dinner: { dish: '', tags: [] },
  };
}

function saveMeals(date, meals) {
  localStorage.setItem(`island-meals-${date}`, JSON.stringify(meals));
}

function renderMeals(today) {
  const container = document.getElementById('meals');
  if (!container) return;

  const meals = getMeals(today);

  function mealBlock(key, label) {
    const m = meals[key];
    const tags = MEAL_TAGS.map((tag) => {
      const active = (m.tags || []).includes(tag);
      return `<button class="meal__tag meal__tag--${tag.toLowerCase().replace('ä', 'a').replace('ü', 'u')}${active ? ' meal__tag--active' : ''}" data-tag="${tag}" type="button">${tag}</button>`;
    }).join('');
    return `
      <div class="meal" data-meal-key="${key}">
        <span class="meal__label">${label}</span>
        <div class="meal__fields">
          <div class="meal__field">
            <span class="meal__field-label">Dish</span>
            <input class="meal__input" data-field="dish" value="${m.dish}" placeholder="What's on the menu?">
          </div>
          <div class="meal__tags">${tags}</div>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="meals">
      ${mealBlock('lunch', 'Lunch')}
      <div class="meals__divider"></div>
      ${mealBlock('dinner', 'Dinner')}
    </div>
  `;

  container.querySelectorAll('.meal').forEach((mealEl) => {
    const key = mealEl.dataset.mealKey;

    mealEl.querySelector('[data-field="dish"]').addEventListener('input', (e) => {
      meals[key].dish = e.target.value;
      saveMeals(today.date, meals);
    });

    mealEl.querySelectorAll('.meal__tag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        const tags = meals[key].tags || [];
        meals[key].tags = tags.includes(tag)
          ? tags.filter((t) => t !== tag)
          : [...tags, tag];
        saveMeals(today.date, meals);
        btn.classList.toggle('meal__tag--active');
      });
    });
  });
}


function initMap(locations) {
  const mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  const map = L.map(mapEl, {
    scrollWheelZoom: false,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(map);

  const bounds = [];
  const coords = locations.map((loc) => [loc.lat, loc.lng]);

  if (coords.length > 1) {
    L.polyline(coords, {
      color: '#22d3ee',
      weight: 2,
      opacity: 0.35,
      dashArray: '6 6',
    }).addTo(map);
  }

  locations.forEach((loc) => {
    const marker = L.circleMarker([loc.lat, loc.lng], {
      radius: 8,
      fillColor: '#22d3ee',
      color: '#0b0c12',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.85,
    }).addTo(map);

    const mapsUrl = loc.url || `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
    marker.bindPopup(`
      <strong>${loc.name}</strong><br>
      <span style="color:#8b8f9c">${loc.type}</span><br>
      <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;font-size:0.75rem;">Open in Maps ↗</a>
    `);
    bounds.push([loc.lat, loc.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

const REFLECTION_USERS = ['Nella', 'Leonie', 'Letizia'];
const REFLECTION_USER_COLOR = { Nella: 'var(--accent-cyan)', Leonie: 'var(--accent-lime)', Letizia: 'var(--accent-magenta)' };
const REFLECTION_FIELDS = [
  { key: 'moments',  label: 'Memorable Moments',  placeholder: 'What stood out today?',    multi: true  },
  { key: 'learnings',label: 'Learnings of the Day',placeholder: 'What did you learn?',       multi: true  },
  { key: 'song',     label: 'Song of the Day',     placeholder: 'Your soundtrack today…',    multi: false },
  { key: 'emoji',    label: 'Emoji of the Day',    placeholder: '✨',                         multi: false },
];

function getAllReflections() {
  try { return JSON.parse(localStorage.getItem('island-reflections') || '{}'); } catch { return {}; }
}

function saveAllReflections(data) {
  localStorage.setItem('island-reflections', JSON.stringify(data));
}

function renderReflection(today) {
  const container = document.getElementById('reflection');
  if (!container) return;

  let activeUser = REFLECTION_USERS[0];
  const all = getAllReflections();
  if (!all[today.date]) all[today.date] = {};

  function getUserData(user) {
    return all[today.date][user] || { moments: '', learnings: '', song: '', emoji: '' };
  }

  function draw() {
    const d = getUserData(activeUser);
    const color = REFLECTION_USER_COLOR[activeUser];

    const userBtns = REFLECTION_USERS.map((u) => {
      const active = u === activeUser;
      const c = REFLECTION_USER_COLOR[u];
      return `<button
        class="reflection__user${active ? ' reflection__user--active' : ''}"
        data-user="${u}"
        style="--uc:${c}"
        type="button">${u}</button>`;
    }).join('');

    const fields = REFLECTION_FIELDS.map((f) => {
      const val = d[f.key] || '';
      const input = f.multi
        ? `<textarea class="reflection__input reflection__textarea" data-field="${f.key}" placeholder="${f.placeholder}">${val}</textarea>`
        : `<input class="reflection__input${f.key === 'emoji' ? ' reflection__input--emoji' : ''}" data-field="${f.key}" value="${val}" placeholder="${f.placeholder}">`;
      return `<div class="reflection__field">
        <span class="reflection__field-label">${f.label}</span>
        ${input}
      </div>`;
    }).join('');

    container.innerHTML = `
      <div class="reflection" style="--uc:${color}">
        <div class="reflection__users">${userBtns}</div>
        <div class="reflection__fields">${fields}</div>
      </div>`;

    container.querySelectorAll('.reflection__user').forEach((btn) => {
      btn.addEventListener('click', () => { activeUser = btn.dataset.user; draw(); });
    });

    container.querySelectorAll('[data-field]').forEach((el) => {
      el.addEventListener('input', () => {
        if (!all[today.date][activeUser]) {
          all[today.date][activeUser] = { moments: '', learnings: '', song: '', emoji: '' };
        }
        all[today.date][activeUser][el.dataset.field] = el.value;
        saveAllReflections(all);
      });
    });
  }

  draw();
}

async function init() {
  initNav('today');

  const status = document.getElementById('page-status');
  if (status) showLoading(status);

  try {
    const data = await fetchTripData();
    if (status) status.innerHTML = '';

    renderHero(data);
    renderItinerary(data.today);
    renderProgress(data.today);
    renderMeals(data.today);
    renderReflection(data.today);
    initMap(data.locations);
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();
