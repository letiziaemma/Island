/**
 * Shared app utilities — navigation, formatting, DOM helpers.
 */

// ── Edit mode ─────────────────────────────────────────────────────
// 3 taps on the nav brand within 2 s toggles editing.
// Persisted in sessionStorage — survives page navigation within the tab.

const EDIT_KEY = 'island-edit';

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

function showAccessModal() {
  let modal = document.getElementById('access-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'access-modal';
    modal.className = 'access-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="access-modal__box">
        <p class="access-modal__msg">You are not eligible to make changes here.</p>
        <p class="access-modal__hint">Please contact the administrator, <strong>Letizia</strong>.</p>
        <button class="access-modal__close" type="button">OK</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('.access-modal__close').addEventListener('click', () => {
      modal.classList.remove('access-modal--visible');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('access-modal--visible');
    });
  }
  modal.classList.add('access-modal--visible');
}

const PROTECTED = [
  '.stop-add-btn',
  '.stop-add-input',
  '.itinerary__delete',
  '.accom__person-btn',
  '.meal__tag',
  '.meal__input',
  '.reflection__submit-btn',
  '.reflection__redo-btn',
  '.reflection__buonanotte-btn',
  '.reflection__input',
  '.reflection__textarea',
].join(',');

function initReadOnlyGuard() {
  document.body.addEventListener('click', (e) => {
    if (document.body.classList.contains('edit-mode')) return;
    if (e.target.closest(PROTECTED)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      showAccessModal();
    }
  }, true);

  document.body.addEventListener('focusin', (e) => {
    if (document.body.classList.contains('edit-mode')) return;
    if (e.target.closest('.meal__input, .reflection__input, .reflection__textarea')) {
      e.target.blur();
      showAccessModal();
    }
  });

  document.body.addEventListener('submit', (e) => {
    if (document.body.classList.contains('edit-mode')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showAccessModal();
  }, true);
}

function initEditMode() {
  if (sessionStorage.getItem(EDIT_KEY) === '1') {
    document.body.classList.add('edit-mode');
  }

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
      sessionStorage.setItem(EDIT_KEY, on ? '1' : '0');
      showEditToast(on ? 'Bearbeiten aktiviert ✓' : 'Bearbeiten deaktiviert');
    }
  });

  initReadOnlyGuard();
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
