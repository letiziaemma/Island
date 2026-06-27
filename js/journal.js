import { fetchTripData } from './data.js';
import { initNav, formatDate, showError, showLoading } from './app.js';

const REFLECTION_LABELS = {
  moments:   'Memorable Moments',
  learnings: 'Learnings of the Day',
  song:      'Song of the Day',
  emoji:     'Emoji of the Day',
};
const REFLECTION_USER_COLOR = {
  Nella: 'var(--accent-cyan)',
  Leonie: 'var(--accent-lime)',
  Letizia: 'var(--accent-magenta)',
};

function buildReflectionBlock(date) {
  let all = {};
  try { all = JSON.parse(localStorage.getItem('island-reflections') || '{}'); } catch {}
  const dayData = all[date];
  if (!dayData) return '';

  const entries = Object.entries(dayData).filter(([, v]) =>
    Object.values(v).some((s) => s && s.trim())
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
    const data = await fetchTripData();
    if (status) status.innerHTML = '';

    renderJournal(data.journal);

    const countEl = document.getElementById('entry-count');
    if (countEl) {
      countEl.textContent = `${data.journal.length} entries`;
    }
  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();
