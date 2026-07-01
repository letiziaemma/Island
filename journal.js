import { fetchTripData } from './data.js';
import { initNav, showError, showLoading } from './app.js';
import * as db from './db.js';

const REFLECTION_USER_COLOR = {
  Nella:   'var(--accent-cyan)',
  Leonie:  'var(--accent-lime)',
  Letizia: 'var(--accent-magenta)',
};
const REFLECTION_USERS = ['Nella', 'Leonie', 'Letizia'];

// ── Helpers ───────────────────────────────────────────────────────

function getDayNumber(dateStr, startDate) {
  const d = new Date(dateStr + 'T00:00:00');
  const s = new Date(startDate + 'T00:00:00');
  return Math.max(1, Math.floor((d - s) / 86400000) + 1);
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function fmtTime(isoStr) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Data ──────────────────────────────────────────────────────────

// Returns days with at least one user who clicked "Immortalize memories"
async function getImmortalizedReflections() {
  const reflections = await db.getAllReflections();
  const result = [];
  for (const date of Object.keys(reflections).sort().reverse()) {
    const dayData = reflections[date] || {};
    const users = REFLECTION_USERS
      .filter(u => dayData[u]?._submittedAt)
      .map(u => ({ user: u, data: dayData[u] }));
    if (users.length) result.push({ date, users });
  }
  return result;
}

// ── Render ────────────────────────────────────────────────────────

async function renderReflections(startDate) {
  const container = document.getElementById('reflections-list');
  if (!container) return;

  const days = await getImmortalizedReflections();

  if (!days.length) {
    container.innerHTML = '<p class="jnl-empty">No memories immortalized yet — check back tonight.</p>';
    return;
  }

  const html = days.map(({ date, users }) => {
    const dayNum = startDate ? getDayNumber(date, startDate) : null;

    const cards = users.map(({ user, data }) => {
      const color = REFLECTION_USER_COLOR[user] || 'var(--accent-cyan)';
      const time  = fmtTime(data._submittedAt);
      const emoji = data.emoji?.trim() || '';
      const song  = data.song?.trim()  || '';

      const songHtml = song ? `
        <div class="jnl-card__song">
          <span class="jnl-card__song-icon">♪</span>
          <span>${song}</span>
        </div>` : '';

      const contentFields = [
        { key: 'moments',   label: 'Memorable Moments'   },
        { key: 'learnings', label: 'Learnings of the Day' },
      ].filter(f => data[f.key]?.trim());

      const fieldsHtml = contentFields.map(f => `
        <div class="jnl-card__field">
          <span class="jnl-card__field-label">${f.label}</span>
          <p class="jnl-card__field-text">${data[f.key]}</p>
        </div>`).join('');

      const hasDivider = (song || contentFields.length) && emoji;

      return `
        <div class="jnl-card" style="--uc:${color}">
          ${emoji ? `<div class="jnl-card__emoji">${emoji}</div>` : ''}
          <div class="jnl-card__byline">
            <span class="jnl-card__name">${user}</span>
            ${time ? `<span class="jnl-card__time mono">${time}</span>` : ''}
          </div>
          ${songHtml}
          ${fieldsHtml ? `<div class="jnl-card__divider"></div>${fieldsHtml}` : ''}
        </div>`;
    }).join('');

    return `
      <div class="jnl-day">
        <div class="jnl-day__head">
          ${dayNum ? `<span class="jnl-day__num">Day ${dayNum}</span>` : ''}
          <span class="jnl-day__date">${fmtDate(date)}</span>
        </div>
        <div class="jnl-day__grid">${cards}</div>
      </div>`;
  }).join('');

  container.innerHTML = `<div class="jnl-section">${html}</div>`;
}

// ── Init ──────────────────────────────────────────────────────────

async function init() {
  initNav('journal');

  const status = document.getElementById('page-status');
  if (status) showLoading(status);

  try {
    const data = await fetchTripData();
    if (status) status.innerHTML = '';

    const startDate = data.trip.startDate;

    await renderReflections(startDate);

    // Live updates from other devices
    db.supabase.channel('journal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflections' }, async () => {
        await renderReflections(startDate);
      })
      .subscribe();

    // Reload when user switches back to this tab
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await renderReflections(startDate);
      }
    });

  } catch (err) {
    if (status) showError(status, err.message);
  }
}

init();
