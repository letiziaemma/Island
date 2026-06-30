/**
 * Shared app utilities — navigation, formatting, DOM helpers.
 */

// ── Edit mode ─────────────────────────────────────────────────────
// 5 taps on the nav brand within 2 s toggles editing.
// State lives in JS memory only — resets on page reload.

function showEditToast(message) {
  let toast = document.getElementById('edit-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'edit-toast';
    toast.className = 'edit-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('edit-toast--show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('edit-toast--show'), 2500);
}

function initEditMode() {
  const brand = document.querySelector('.nav__brand');
  if (!brand) return;

  let count = 0;
  let timer = null;

  brand.addEventListener('click', (e) => {
    e.preventDefault();
    count++;
    clearTimeout(timer);
    timer = setTimeout(() => { count = 0; }, 2000);

    if (count >= 3) {
      count = 0;
      clearTimeout(timer);
      const on = document.body.classList.toggle('edit-mode');
      showEditToast(on ? 'Bearbeiten aktiviert ✓' : 'Bearbeiten deaktiviert');
    }
  });
}

export function initNav(activePage) {
  const links = document.querySelectorAll('.nav__link');
  links.forEach((link) => {
    const page = link.dataset.page;
    if (page === activePage) {
      link.classList.add('nav__link--active');
      link.setAttribute('aria-current', 'page');
    }
  });
  initEditMode();
}

export function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function formatShortDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

export function daysUntil(endDateStr) {
  const end = new Date(endDateStr + 'T23:59:59');
  const now = new Date();
  const diff = end - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return { days, hours, minutes, seconds };
}

export function daysBetween(startStr, endStr) {
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  return Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
}

export function el(tag, className, html) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (html !== undefined) element.innerHTML = html;
  return element;
}

export function showError(container, message) {
  container.innerHTML = `<div class="error">${message}</div>`;
}

export function showLoading(container) {
  container.innerHTML = '<div class="loading">Loading trip data…</div>';
}
