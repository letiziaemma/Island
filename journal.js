import { fetchTripData } from './data.js';
import { initNav, formatDate, showError, showLoading } from './app.js';
import * as db from './db.js';

const REFLECTION_LABELS = {
  moments:   'Memorable Moments',
  learnings: 'Learnings of the Day',
  song:      'Song of the Day',
  emoji:     'Emoji of the Day',
};
const REFLECTION_USER_COLOR = {
  Nella:   'var(--accent-cyan)',
  Leonie:  'var(--accent-lime)',
  Letizia: 'var(--accent-magenta)',
};
const REFLECTION_USERS = ['Nella', 'Leonie', 'Letizia'];
const CONTENT_FIELDS = ['moments', 'learnings', 'song', 'emoji'];

let allReflectionData = {};

async function getSubmittedReflections() {
  const reflections = await db.getAllReflections();
  const result = [];
  for (const date of Object.keys(reflections).sort().reverse()) {
    const dayData = reflections[date] || {};
    const users = REFLECTION_USERS
      .filter(u => dayData[u] && CONTENT_FIELDS.some(f => dayData[u][f] && String(dayData[u][f]).trim()))
      .map(u => ({ user: u, data: dayData[u] }));
    if (users.length) result.push({ date, users });
  }
  return result;
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatTimestamp(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} · ${HH}:${MM}`;
}

async function renderStandaloneReflections() {
  const container = document.getElementById('reflections-list');
  if (!container) return;

  const days = await getSubmittedReflections();

  if (!days.length) {
    container.innerHTML = `
      <div class="refl-standalone">
        <h2 class="section-flat__title">Daily Reflections</h2>
        <p class="refl-standalone__empty">No reflections yet — check back tonight.</p>
      </div>`;
    return;
  }

  const dayBlocks = days.map(({ date, users }) => {
    const cards = users.map(({ user, data }) => {
      const color = REFLECTION_USER_COLOR[user] || 'var(--accent-cyan)';
      const emoji = data.emoji && data.emoji.trim() ? data.emoji.trim() : '';
      const timestamp = formatTimestamp(data._submittedAt);
      const items = Object.entries(REFLECTION_LABELS)
        .filter(([key]) => key !== 'emoji' && data[key] && data[key].trim())
        .map(([key, label]) => `
          <div class="refl-item">
            <span class="refl-item__label">${label}</span>
            <span class="refl-item__value">${data[key]}</span>
          </div>`)
        .join('');
      return `
        <div class="refl-card" style="--uc:${color}">
          <div class="refl-card__header">
            <span class="refl-card__name">${user}</span>
            ${emoji ? `<span class="refl-card__emoji">${emoji}</span>` : ''}
          </div>
          ${timestamp ? `<span class="refl-card__timestamp">${timestamp}</span>` : ''}
          ${items}
        </div>`;
    }).join('');

    return `
      <div class="refl-standalone__day">
        <p class="refl-standalone__date">${formatDayLabel(date)}</p>
        <div class="refl-standalone__grid">${cards}</div>
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="refl-standalone">
      <h2 class="section-flat__title">Daily Reflections</h2>
      ${dayBlocks}
    </div>`;
}

function buildReflectionBlock(date) {
  const dayData = allReflectionData[date];
  if (!dayData) return '';

  const entries = Object.entries(dayData).filter(([, v]) =>
    CONTENT_FIELDS.some(f => v[f] && String(v[f]).trim())
  );
  if (!entries.length) return '';

  const cards = entries.map(([user, data]) => {
    const color = REFLECTION_USER_COLOR[user] || 'var(--accent-cyan)';
    const items = Object.entries(REFLECTION_LABELS)
      .filter(([key]) => data[key] && data[key].trim())
      .map(([key, label]) => `
        <div class="refl-item">
          <span class="refl-item__label">${label}</span>
          <span class="refl-item__value">${data[key]}</span>
        </div>`)
      .join('');
    return `<div class="refl-card" style="--uc:${color}">
      <span class="refl-card__name">${user}</span>
      ${items}
    </div>`;
  }).join('');

  return `<div class="refl-block">
    <p class="refl-block__title">Daily Reflections</p>
    <div class="refl-block__cards">${cards}</div>
  </div>`;
}

function renderJournalEntry(entry) {
  const article = document.createElement('article');
  article.className = 'journal-entry';
  article.dataset.day = entry.day;

  article.innerHTML = `
    <header class="journal-entry__header" role="button" tabindex="0" aria-expanded="false">
      <div class="journal-entry__header-left">
        <span class="journal-entry__day mono">${entry.day}</span>
        <div class="journal-entry__info">
          <h2 class="journal-entry__title">${entry.title}</h2>
          <div class="journal-entry__meta">
            <span>${formatDate(entry.date)}</span>
            <span>·</span>
            <span>${entry.location}</span>
          </div>
        </div>
      </div>
      <span class="journal-entry__mood">${entry.mood}</span>
      <span class="journal-entry__toggle" aria-hidden="true">+</span>
    </header>
    <div class="journal-entry__body">
      <p class="journal-entry__excerpt">${entry.excerpt}</p>
      <div class="journal-entry__text">${entry.body}</div>
      ${buildReflectionBlock(entry.date)}
    </div>
  `;

  const header = article.querySelector('.journal-entry__header');

  function toggle() {
    const expanded = article.classList.toggle('journal-entry--expanded');
    header.setAttribute('aria-expanded', expanded);
  }

  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });

  return article;
}

function renderJournal(journal) {
  const container = document.getElementById('journal-list');
  if (!container) return;

  container.innerHTML = '';

  const sorted = [...journal].sort((a, b) => a.day - b.day);

  sorted.forEach((entry, index) => {
    const el = renderJournalEntry(entry);
    if (index === sorted.length - 1) {
      el.classList.add('journal-entry--expanded');
      el.querySelector('.journal-entry__header').setAttribute('aria-expanded', 'true');
    }
    container.appendChild(el);
  });
}

async function init() {
  initNav('journal');

  const status = document.getElementById('page-status');
  if (status) showLoading(status);

  try {
    const [data, reflections] = await Promise.all([
      fetchTripData(),
      db.getAllReflections(),
    ]);
    if (status) status.innerHTML = '';

    allReflectionData = reflections;
    renderJournal(data.journal);
    renderStandaloneReflections();

    db.supabase.channel('journal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections' }, async () => {
        allReflectionData = await db.getAllReflections();
        renderStandaloneReflections();
      })
      .subscribe();

    const countEl = document.getElementById('entry-count');
    if (countEl) countEl.textContent = `${data.journal.length} entries`;
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();
