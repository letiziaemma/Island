import { fetchTripData } from './data.js';
import {
  initNav,
  daysUntil,
  daysBetween,
  showError,
  showLoading,
} from './app.js';

let countdownInterval = null;

function parseCoordsFromUrl(url) {
  if (!url) return null;
  try {
    let m = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
    m = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  } catch {}
  return null;
}

const distanceCache = {};

async function getDrivingDistance(lat1, lng1, lat2, lng2) {
  const key = `${lat1.toFixed(4)},${lng1.toFixed(4)},${lat2.toFixed(4)},${lng2.toFixed(4)}`;
  if (key in distanceCache) return distanceCache[key];
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`
    );
    const json = await res.json();
    if (json.code === 'Ok' && json.routes.length > 0) {
      const km = json.routes[0].distance / 1000;
      distanceCache[key] = km;
      return km;
    }
  } catch {}
  distanceCache[key] = null;
  return null;
}

async function updateKmStat(stops) {
  const withCoords = stops.map(s => ({
    status: s.status,
    coords: parseCoordsFromUrl(s.url),
  }));

  let totalKm = 0;
  let doneKm = 0;
  let anyData = false;

  for (let i = 0; i < withCoords.length - 1; i++) {
    const from = withCoords[i];
    const to = withCoords[i + 1];
    if (!from.coords || !to.coords) continue;
    const dist = await getDrivingDistance(
      from.coords.lat, from.coords.lng,
      to.coords.lat, to.coords.lng
    );
    if (dist === null) continue;
    anyData = true;
    totalKm += dist;
    if (from.status === 'completed' && to.status === 'completed') {
      doneKm += dist;
    }
  }

  if (anyData) {
    const doneEl = document.getElementById('stat-km-done');
    const totalEl = document.getElementById('stat-km-total');
    if (doneEl) doneEl.textContent = Math.round(doneKm);
    if (totalEl) totalEl.textContent = Math.round(totalKm);
  }
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

const ACCOM_KEY = 'island-accommodation-v1';

function loadAccom(base) {
  try {
    const saved = localStorage.getItem(ACCOM_KEY);
    return saved ? JSON.parse(saved) : base.map(a => ({ ...a }));
  } catch {
    return base.map(a => ({ ...a }));
  }
}

function saveAccom(accoms) {
  localStorage.setItem(ACCOM_KEY, JSON.stringify(accoms));
}

const ACCOM_PERSONS = ['Leonie', 'Nella', 'Letizia'];
const ACCOM_PERSON_COLOR = { Leonie: 'var(--accent-lime)', Nella: 'var(--accent-cyan)', Letizia: 'var(--accent-magenta)' };

function renderAccommodation(base) {
  const container = document.getElementById('accommodation');
  if (!container) return;

  let accoms = loadAccom(base);
  let formPerson = '';

  function isTonight(a) {
    const today = new Date().toISOString().slice(0, 10);
    return today >= a.checkInDate && today < a.checkOutDate;
  }

  function draw() {
    const items = accoms.map((a, i) => {
      const tonight = isTonight(a);
      const mapsHref = a.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.name + ' Iceland')}`;
      const [cy, cm, cd] = a.checkInDate.split('-');
      const checkInStr = `${cd}.${cm}.${cy} · ${a.checkInTime || '--:--'}`;
      const personColor = a.person ? ACCOM_PERSON_COLOR[a.person] : null;
      const personBadge = a.person
        ? `<span class="accom__person-badge" style="color:${personColor};border-color:${personColor}">${a.person}</span>`
        : '';
      return `
        <div class="accom${tonight ? ' accom--tonight' : ''}">
          <div class="accom__info">
            <p class="accom__name">
              <a class="stop-maps-link" href="${mapsHref}" target="_blank" rel="noopener noreferrer">${a.name}</a>
              ${tonight ? '<span class="accom__tonight-badge">Tonight</span>' : ''}
            </p>
            <p class="accom__meta">Check-in ${checkInStr}</p>
          </div>
          ${personBadge}
          <button class="stop-delete" data-index="${i}" aria-label="Delete accommodation">✕</button>
        </div>
      `;
    }).join('');

    const personBtns = ACCOM_PERSONS.map(p => {
      const color = ACCOM_PERSON_COLOR[p];
      const active = formPerson === p;
      return `<button type="button" class="accom__person-btn${active ? ' accom__person-btn--active' : ''}" data-person="${p}" style="--pc:${color}">${p}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="accoms">${items}</div>
      <form class="stop-add-form" id="accom-add-form" style="flex-wrap:wrap;">
        <input class="stop-add-input" type="text" placeholder="Name (e.g. City Hotel)" id="accom-name" required />
        <input class="stop-add-input stop-add-input--day" type="date" id="accom-checkin" required />
        <input class="stop-add-input stop-add-input--day" type="time" id="accom-checkin-time" />
        <input class="stop-add-input stop-add-input--day" type="date" id="accom-checkout" required />
        <input class="stop-add-input" type="url" placeholder="Maps URL (optional)" id="accom-url" />
        <div class="accom__person-picker">${personBtns}</div>
        <button class="stop-add-btn" type="submit">+ Add</button>
      </form>
    `;

    ['#accom-checkin', '#accom-checkin-time', '#accom-checkout'].forEach(id => {
      const el = container.querySelector(id);
      if (!el) return;
      el.addEventListener('change', () => el.classList.toggle('has-value', !!el.value));
    });

    container.querySelectorAll('.accom__person-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        formPerson = formPerson === btn.dataset.person ? '' : btn.dataset.person;
        draw();
      });
    });

    container.querySelectorAll('.stop-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        accoms.splice(Number(btn.dataset.index), 1);
        saveAccom(accoms);
        draw();
      });
    });

    container.querySelector('#accom-add-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = container.querySelector('#accom-name').value.trim();
      const checkInDate = container.querySelector('#accom-checkin').value;
      const checkInTime = container.querySelector('#accom-checkin-time').value || null;
      const checkOutDate = container.querySelector('#accom-checkout').value;
      const url = container.querySelector('#accom-url').value.trim() || null;
      if (!name || !checkInDate || !checkOutDate) return;
      accoms.push({ id: `acc-${Date.now()}`, name, person: formPerson, checkInDate, checkInTime, checkOutDate, url });
      accoms.sort((a, b) => a.checkInDate.localeCompare(b.checkInDate));
      saveAccom(accoms);
      formPerson = '';
      draw();
    });
  }

  draw();
}

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
      let when = '';
      if (m.date) {
        const [my, mm, md] = m.date.split('-');
        when = `${md}.${mm}.${my} · ${m.time || '--:--'}`;
      } else if (m.day) {
        when = `Day ${m.day}`;
      }
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

function renderStatistics(stats, trip, milestones) {
  const container = document.getElementById('statistics');
  if (!container) return;

  const stops = loadStops(milestones);
  const stopsTotal = stops.length;
  const stopsDone = stops.filter(s => s.status === 'completed').length;

  const start = new Date(trip.startDate + 'T00:00:00');
  const end = new Date(trip.endDate + 'T00:00:00');
  const totalDays = Math.round((end - start) / 86400000) + 1;

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.min(Math.max(Math.floor((todayMidnight - start) / 86400000) + 1, 1), totalDays);

  const accents = ['cyan', 'lime', 'magenta', 'cyan', 'lime', 'magenta'];
  const units = [
    { value: `${dayNumber}<span class="hero__stat-sep">/</span>${totalDays}`, label: 'Days' },
    { value: `<span id="stat-km-done">—</span><span class="hero__stat-sep">/</span><span id="stat-km-total">—</span>`, label: 'km' },
    { value: `${stopsDone}<span class="hero__stat-sep">/</span>${stopsTotal}`, label: 'Stops' },
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
    renderAccommodation(data.accommodation || []);
    renderStatistics(data.statistics, data.trip, data.milestones);
    updateKmStat(loadStops(data.milestones));
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();

window.addEventListener('beforeunload', () => {
  if (countdownInterval) clearInterval(countdownInterval);
});
