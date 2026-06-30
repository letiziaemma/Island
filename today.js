import { fetchTripData } from './data.js';
import { initNav, showError, showLoading } from './app.js';
import * as db from './db.js';

// ── Constants ─────────────────────────────────────────────────────

const STATUS_LABELS = { completed: 'Done', current: 'Now', upcoming: 'Next' };
const MEAL_TAGS = ['Nella', 'Letizia', 'Leonie', 'Auswärts', 'Einkaufen'];
const REFLECTION_USERS = ['Nella', 'Leonie', 'Letizia'];
const REFLECTION_USER_COLOR = {
  Nella:    'var(--accent-cyan)',
  Leonie:   'var(--accent-lime)',
  Letizia:  'var(--accent-magenta)',
};
const REFLECTION_FIELDS = [
  { key: 'moments',   label: 'Memorable Moments',   placeholder: 'What stood out today?',  multi: true  },
  { key: 'learnings', label: 'Learnings of the Day', placeholder: 'What did you learn?',    multi: true  },
  { key: 'song',      label: 'Song of the Day',      placeholder: 'Your soundtrack today…', multi: false },
  { key: 'emoji',     label: 'Emoji of the Day',     placeholder: '✨',                      multi: false },
];

// ── Module state (replaces localStorage) ─────────────────────────

const state = {
  reflections: {},
  meals: { lunch: { dish: '', tags: [] }, dinner: { dish: '', tags: [] } },
  stops: [],
  hidden: [],
};

// Draw function refs — set by render* calls, invoked by real-time handlers
let _activeUser = REFLECTION_USERS[0];
let _drawItinerary = null;
let _drawMeals = null;
let _drawReflection = null;

// ── Utilities ─────────────────────────────────────────────────────

let tripLocations = [];
const distanceCache = {};

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

const ACCOM_KEY = 'island-accommodation-v1';

function loadAccom(base) {
  try {
    const saved = localStorage.getItem(ACCOM_KEY);
    return saved ? JSON.parse(saved) : (base || []).map(a => ({ ...a }));
  } catch {
    return (base || []).map(a => ({ ...a }));
  }
}

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

function getCoordsForItem(item) {
  if (item.custom) {
    const s = state.stops.find(c => c.id === item.id);
    return s?.lat && s?.lng ? { lat: s.lat, lng: s.lng } : null;
  }
  const match = tripLocations.find(loc =>
    item.location?.toLowerCase().includes(loc.name.toLowerCase()) ||
    item.title?.toLowerCase().includes(loc.name.toLowerCase())
  );
  return match ? { lat: match.lat, lng: match.lng } : null;
}

function computeStatus(time) {
  if (!time) return 'upcoming';
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [h, m] = time.split(':').map(Number);
  const stopMin = h * 60 + m;
  if (nowMin >= stopMin + 60) return 'completed';
  if (nowMin >= stopMin) return 'current';
  return 'upcoming';
}

function getVisibleItinerary(itinerary) {
  return itinerary.filter((_, i) => !state.hidden.includes(i));
}

// ── Hero ──────────────────────────────────────────────────────────

async function updateHeroKm(baseItinerary) {
  const visibleItems = getVisibleItinerary(baseItinerary);
  const extra = state.stops.map(s => ({
    id: s.id, time: s.time || null, title: s.title, location: s.title, custom: true,
  }));

  const all = [...visibleItems, ...extra].sort((a, b) => {
    if (!a.time && !b.time) return 0;
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  }).map(item => ({
    ...item,
    status: computeStatus(item.time),
    coords: getCoordsForItem(item),
  }));

  let totalKm = 0;
  let doneKm = 0;
  let anyCoords = false;

  for (let i = 0; i < all.length - 1; i++) {
    const from = all[i].coords;
    const to = all[i + 1].coords;
    if (!from || !to) continue;
    const dist = await getDrivingDistance(from.lat, from.lng, to.lat, to.lng);
    if (dist === null) continue;
    anyCoords = true;
    totalKm += dist;
    if (all[i].status === 'completed' && all[i + 1].status === 'completed') doneKm += dist;
  }

  const doneEl = document.getElementById('hero-km-done');
  const totalEl = document.getElementById('hero-km-total');
  if (anyCoords) {
    if (doneEl) doneEl.textContent = Math.round(doneKm);
    if (totalEl) totalEl.textContent = Math.round(totalKm);
  }
}

function computeTodayStopCounts(baseItinerary) {
  const visibleItems = getVisibleItinerary(baseItinerary);
  const allStops = [
    ...visibleItems.map(i => ({ time: i.time })),
    ...state.stops.map(s => ({ time: s.time || null })),
  ];
  const total = allStops.length;
  const done = allStops.filter(s => computeStatus(s.time) === 'completed').length;
  return { done, total };
}

function updateHeroStopCount(todayItinerary) {
  const { done, total } = computeTodayStopCounts(todayItinerary);
  const doneEl = document.getElementById('hero-stops-done');
  const totalEl = document.getElementById('hero-stops-total');
  if (doneEl) doneEl.textContent = done;
  if (totalEl) totalEl.textContent = total;
}

function renderHero(data) {
  const container = document.getElementById('hero');
  if (!container) return;

  const { trip, today } = data;
  const { header } = trip;
  const eyebrow = header.eyebrow.join(' · ');
  const { done, total } = computeTodayStopCounts(today.itinerary);

  const start = new Date(trip.startDate + 'T00:00:00');
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNumber = Math.min(
    Math.max(Math.floor((todayMidnight - start) / 86400000) + 1, 1),
    trip.totalDays
  );
  const totalDays = Math.round((new Date(trip.endDate + 'T00:00:00') - start) / 86400000) + 1;

  const dynamicValues = [
    `<span id="hero-stops-done">${done}</span><span class="hero__stat-sep">/</span><span id="hero-stops-total">${total}</span>`,
    `<span id="hero-km-done">—</span><span class="hero__stat-sep">/</span><span id="hero-km-total">—</span>`,
    `${dayNumber}<span class="hero__stat-sep">/</span>${totalDays}`,
  ];

  const stats = header.stats.map((stat, i) => `
    <div class="hero__stat">
      <span class="hero__stat-value hero__stat-value--${stat.accent}">${dynamicValues[i]}</span>
      <span class="hero__stat-label">${stat.label}</span>
    </div>`).join('');

  container.innerHTML = `
    <div class="hero__content">
      <p class="hero__eyebrow">${eyebrow}</p>
      <h1 class="display hero__title">${header.title}</h1>
      <p class="hero__subtitle">${header.subtitle}</p>
      <div class="hero__stats">${stats}</div>
    </div>`;
}

// ── Itinerary ─────────────────────────────────────────────────────

function renderItinerary(today, baseAccom) {
  const container = document.getElementById('itinerary');
  if (!container) return;

  function draw() {
    const todayVal = localDateStr(new Date());

    const baseItems = today.itinerary
      .map((item, idx) => ({ ...item, _idx: idx, custom: false }))
      .filter(item => !state.hidden.includes(item._idx));

    const extra = state.stops.map(s => ({
      id: s.id,
      time: s.time || null,
      title: s.title,
      location: s.title,
      url: s.url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.title + ' Iceland')}`,
      custom: true,
    }));

    const middle = [...baseItems, ...extra].sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });

    const accoms = loadAccom(baseAccom);
    const startAccom = accoms.find(a => a.checkOutDate === todayVal);
    const endAccom   = accoms.find(a => a.checkInDate  === todayVal);

    const startItem = startAccom ? [{
      displayTime: '--:--', title: startAccom.name, _status: 'completed', isAccom: true,
    }] : [];
    const endItem = endAccom ? [{
      displayTime: endAccom.checkInTime || '--:--',
      title: `Check-in — ${endAccom.name}`,
      _status: computeStatus(endAccom.checkInTime),
      isAccom: true,
    }] : [];

    const all = [...startItem, ...middle, ...endItem];

    const items = all.map((item) => {
      const status      = item.isAccom ? item._status : computeStatus(item.time);
      const displayTime = item.isAccom ? item.displayTime : (item.time || '');
      const href = !item.isAccom && (item.url || (item.location
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`
        : null));
      const deleteBtn = item.isAccom ? '' : item.custom
        ? `<button class="itinerary__delete" data-id="${item.id}" aria-label="Delete stop">✕</button>`
        : `<button class="itinerary__delete" data-idx="${item._idx}" aria-label="Delete stop">✕</button>`;
      return `
        <li class="itinerary__item itinerary__item--${status}">
          <span class="itinerary__time mono">${displayTime}</span>
          <div class="itinerary__content">
            <span class="itinerary__title">${item.title}</span>
            ${href ? `<a class="itinerary__location" href="${href}" target="_blank" rel="noopener noreferrer">
              ${item.location}
              <svg class="itinerary__location-icon" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M1 9L9 1M9 1H3M9 1V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>` : ''}
          </div>
          <span class="itinerary__status itinerary__status--${status}">
            ${STATUS_LABELS[status] || status}
          </span>
          <span class="itinerary__marker" aria-hidden="true"></span>
          ${deleteBtn}
        </li>`;
    }).join('');

    container.innerHTML = `
      <ul class="itinerary">${items}</ul>
      <form class="stop-add-form" id="itinerary-add-form" style="margin-top: var(--space-md);">
        <input class="stop-add-input" type="text" placeholder="Stop name" id="itin-title" required />
        <input class="stop-add-input stop-add-input--day" type="time" id="itin-time" />
        <input class="stop-add-input" type="url" placeholder="Maps URL (optional)" id="itin-url" />
        <button class="stop-add-btn" type="submit">+ Add</button>
      </form>`;

    container.querySelectorAll('.itinerary__delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (btn.dataset.id) {
          state.stops = state.stops.filter(s => s.id !== btn.dataset.id);
          await db.deleteStop(btn.dataset.id);
        } else if (btn.dataset.idx !== undefined) {
          const idx = Number(btn.dataset.idx);
          if (!state.hidden.includes(idx)) {
            state.hidden = [...state.hidden, idx];
            await db.addHiddenIndex(todayVal, idx);
          }
        }
        draw();
        updateHeroStopCount(today.itinerary);
        updateHeroKm(today.itinerary);
      });
    });

    const form = container.querySelector('#itinerary-add-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const title = form.querySelector('#itin-title').value.trim();
      const time  = form.querySelector('#itin-time').value || null;
      const url   = form.querySelector('#itin-url').value.trim() || null;
      if (!title) return;
      const stop = { id: `u-${Date.now()}`, title, date: todayVal, time, url };
      state.stops = [...state.stops, stop].sort((a, b) => {
        const ak = `${a.date} ${a.time || '99:99'}`;
        const bk = `${b.date} ${b.time || '99:99'}`;
        return ak.localeCompare(bk);
      });
      await db.insertStop(stop);
      draw();
      updateHeroStopCount(today.itinerary);
      updateHeroKm(today.itinerary);
    });
  }

  _drawItinerary = draw;
  draw();
}

// ── Progress ──────────────────────────────────────────────────────

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
    </div>`;
}

// ── Meals ─────────────────────────────────────────────────────────

function renderMeals(today) {
  const container = document.getElementById('meals');
  if (!container) return;

  const debouncedSave = debounce((mealType, dish, tags) => {
    db.upsertMeal(today.date, mealType, dish, tags);
  }, 600);

  function draw() {
    function mealBlock(key, label) {
      const m = state.meals[key];
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
              <input class="meal__input" data-field="dish" value="${m.dish || ''}" placeholder="What's on the menu?">
            </div>
            <div class="meal__tags">${tags}</div>
          </div>
        </div>`;
    }

    container.innerHTML = `
      <div class="meals">
        ${mealBlock('lunch', 'Lunch')}
        <div class="meals__divider"></div>
        ${mealBlock('dinner', 'Dinner')}
      </div>`;

    container.querySelectorAll('.meal').forEach((mealEl) => {
      const key = mealEl.dataset.mealKey;

      mealEl.querySelector('[data-field="dish"]').addEventListener('input', (e) => {
        state.meals[key].dish = e.target.value;
        debouncedSave(key, state.meals[key].dish, state.meals[key].tags);
      });

      mealEl.querySelectorAll('.meal__tag').forEach((btn) => {
        btn.addEventListener('click', () => {
          const tag = btn.dataset.tag;
          const tags = state.meals[key].tags || [];
          state.meals[key].tags = tags.includes(tag)
            ? tags.filter(t => t !== tag)
            : [...tags, tag];
          db.upsertMeal(today.date, key, state.meals[key].dish, state.meals[key].tags);
          btn.classList.toggle('meal__tag--active');
        });
      });
    });
  }

  _drawMeals = draw;
  draw();
}

// ── Reflection ────────────────────────────────────────────────────

function renderReflection(today) {
  const container = document.getElementById('reflection');
  if (!container) return;

  _activeUser = REFLECTION_USERS[0];
  let showThankYou = false;
  let thankYouUser = '';

  if (!state.reflections[today.date]) state.reflections[today.date] = {};

  const debouncedSave = debounce((user, fields) => {
    db.upsertReflection(today.date, user, fields);
  }, 600);

  function getUserData(user) {
    return state.reflections[today.date][user] || { moments: '', learnings: '', song: '', emoji: '' };
  }

  function getSubmittedUsers() {
    const dayData = state.reflections[today.date] || {};
    return REFLECTION_USERS.filter(u => dayData[u]?._isSubmitted);
  }

  function draw() {
    const submitted = getSubmittedUsers();
    const color = REFLECTION_USER_COLOR[_activeUser];

    if (showThankYou) {
      const tyColor = REFLECTION_USER_COLOR[thankYouUser];
      container.innerHTML = `
        <div class="reflection reflection--thankyou" style="--uc:${tyColor}">
          <p class="reflection__thankyou-text">Thank you <strong>${thankYouUser}</strong>, for sharing your memories. See you tomorrow.</p>
          <button class="reflection__buonanotte-btn" type="button">Buona Notte, tvb.</button>
        </div>`;
      container.querySelector('.reflection__buonanotte-btn').addEventListener('click', async () => {
        if (!state.reflections[today.date][thankYouUser]) {
          state.reflections[today.date][thankYouUser] = { moments: '', learnings: '', song: '', emoji: '' };
        }
        state.reflections[today.date][thankYouUser]._isSubmitted = true;
        await db.upsertReflection(today.date, thankYouUser, state.reflections[today.date][thankYouUser]);
        showThankYou = false;
        draw();
      });
      return;
    }

    const userBtns = REFLECTION_USERS.map((u) => {
      const active = u === _activeUser;
      const c = REFLECTION_USER_COLOR[u];
      const done = submitted.includes(u);
      return `<button
        class="reflection__user${active ? ' reflection__user--active' : ''}${done ? ' reflection__user--done' : ''}"
        data-user="${u}"
        style="--uc:${c}"
        type="button">${u}${done ? ' ✓' : ''}</button>`;
    }).join('');

    const isSubmitted = submitted.includes(_activeUser);
    const d = getUserData(_activeUser);

    const fields = REFLECTION_FIELDS.map((f) => {
      const val = d[f.key] || '';
      const input = f.multi
        ? `<textarea class="reflection__input reflection__textarea" data-field="${f.key}" placeholder="${f.placeholder}"${isSubmitted ? ' disabled' : ''}>${val}</textarea>`
        : `<input class="reflection__input${f.key === 'emoji' ? ' reflection__input--emoji' : ''}" data-field="${f.key}" value="${val}" placeholder="${f.placeholder}"${isSubmitted ? ' disabled' : ''}>`;
      return `<div class="reflection__field">
        <span class="reflection__field-label">${f.label}</span>
        ${input}
      </div>`;
    }).join('');

    const footer = isSubmitted
      ? `<div class="reflection__submitted-row">
           <p class="reflection__submitted-label">Memories immortalized ✓</p>
           <button class="reflection__redo-btn" type="button">Redo</button>
         </div>`
      : `<button class="reflection__submit-btn" type="button">Immortalize memories</button>`;

    container.innerHTML = `
      <div class="reflection" style="--uc:${color}">
        <div class="reflection__users">${userBtns}</div>
        <div class="reflection__fields">${fields}</div>
        ${footer}
      </div>`;

    container.querySelectorAll('.reflection__user').forEach((btn) => {
      btn.addEventListener('click', () => { _activeUser = btn.dataset.user; draw(); });
    });

    if (!isSubmitted) {
      container.querySelector('.reflection__submit-btn').addEventListener('click', () => {
        if (!state.reflections[today.date][_activeUser]) {
          state.reflections[today.date][_activeUser] = { moments: '', learnings: '', song: '', emoji: '' };
        }
        state.reflections[today.date][_activeUser]._submittedAt = new Date().toISOString();
        db.upsertReflection(today.date, _activeUser, state.reflections[today.date][_activeUser]);
        showThankYou = true;
        thankYouUser = _activeUser;
        draw();
      });

      container.querySelectorAll('[data-field]').forEach((el) => {
        el.addEventListener('input', () => {
          if (!state.reflections[today.date][_activeUser]) {
            state.reflections[today.date][_activeUser] = { moments: '', learnings: '', song: '', emoji: '' };
          }
          state.reflections[today.date][_activeUser][el.dataset.field] = el.value;
          debouncedSave(_activeUser, state.reflections[today.date][_activeUser]);
        });
      });
    } else {
      container.querySelector('.reflection__redo-btn').addEventListener('click', async () => {
        if (state.reflections[today.date][_activeUser]) {
          state.reflections[today.date][_activeUser]._isSubmitted = false;
        }
        await db.upsertReflection(today.date, _activeUser, state.reflections[today.date][_activeUser] || {});
        draw();
      });
    }
  }

  _drawReflection = draw;
  draw();
}

// ── Real-time subscriptions ───────────────────────────────────────

function initRealtime(todayStr, todayData) {
  const todayItinerary = todayData.itinerary;

  db.supabase.channel('today-rt')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'reflections' },
      (payload) => {
        const { eventType, new: n, old: o } = payload;
        if (eventType === 'DELETE') {
          if (state.reflections[o.date]) delete state.reflections[o.date][o.user];
        } else {
          if (!state.reflections[n.date]) state.reflections[n.date] = {};
          // Preserve live keystrokes — don't overwrite current user's in-progress entry
          if (n.user !== _activeUser || n.date !== todayData.date) {
            state.reflections[n.date][n.user] = {
              moments:      n.moments,
              learnings:    n.learnings,
              song:         n.song,
              emoji:        n.emoji,
              _submittedAt: n.submitted_at,
              _isSubmitted: n.is_submitted,
            };
          }
        }
        if (_drawReflection) _drawReflection();
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'meals', filter: `date=eq.${todayData.date}` },
      async () => {
        state.meals = await db.getMeals(todayData.date);
        if (_drawMeals) _drawMeals();
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'stops', filter: `date=eq.${todayStr}` },
      async () => {
        state.stops = await db.getStops(todayStr);
        if (_drawItinerary) _drawItinerary();
        updateHeroStopCount(todayItinerary);
        updateHeroKm(todayItinerary);
      })
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'hidden_stops', filter: `date=eq.${todayStr}` },
      async () => {
        state.hidden = await db.getHiddenIndices(todayStr);
        if (_drawItinerary) _drawItinerary();
        updateHeroStopCount(todayItinerary);
        updateHeroKm(todayItinerary);
      })
    .subscribe();
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  initNav('today');

  const status = document.getElementById('page-status');
  if (status) showLoading(status);

  try {
    const data = await fetchTripData();
    if (status) status.innerHTML = '';

    tripLocations = data.locations || [];
    const todayStr = localDateStr(new Date());

    const [reflections, meals, stops, hidden] = await Promise.all([
      db.getAllReflections(),
      db.getMeals(data.today.date),
      db.getStops(todayStr),
      db.getHiddenIndices(todayStr),
    ]);

    state.reflections = reflections;
    state.meals       = meals;
    state.stops       = stops;
    state.hidden      = hidden;

    renderHero(data);
    renderItinerary(data.today, data.accommodation || []);
    renderProgress(data.today);
    renderMeals(data.today);
    renderReflection(data.today);
    updateHeroKm(data.today.itinerary);
    initRealtime(todayStr, data.today);
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();
