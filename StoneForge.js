// ============================================
// STONEFORGE.JS — All page interactions
// ============================================

// ---- NAV: Burger + scroll behavior ----
const burger      = document.getElementById('burger');
const navLinks    = document.getElementById('nav-links');
const navOverlay  = document.getElementById('nav-overlay');
const mainNav     = document.getElementById('main-nav');

function openNav() {
  navLinks?.classList.add('active');
  burger?.classList.add('active');
  navOverlay?.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeNav() {
  navLinks?.classList.remove('active');
  burger?.classList.remove('active');
  navOverlay?.classList.remove('active');
  document.body.style.overflow = '';
}

burger?.addEventListener('click', () => {
  navLinks?.classList.contains('active') ? closeNav() : openNav();
});

navOverlay?.addEventListener('click', closeNav);

burger?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); burger.click(); }
});

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeNav();
});

// ---- NAV: Active link — switches on click ----
const allNavLinks = document.querySelectorAll('.nav__link');

// Set active based on current page on load
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
allNavLinks.forEach(link => {
  const href = link.getAttribute('href');
  // Match exact page or hash links on same page
  const isCurrentPage = href === currentPage ||
    (href?.includes('#') && (currentPage === 'index.html' || currentPage === ''));
  if (href === currentPage || (currentPage === '' && href === 'index.html')) {
    link.classList.add('nav__link--active');
  }
});

// Switch active on click
allNavLinks.forEach(link => {
  link.addEventListener('click', () => {
    allNavLinks.forEach(l => l.classList.remove('nav__link--active'));
    link.classList.add('nav__link--active');
    // Close mobile nav after click
    closeNav();
  });
});

// ---- NAV: Scroll shadow ----
window.addEventListener('scroll', () => {
  mainNav?.classList.toggle('nav--scrolled', window.scrollY > 20);
}, { passive: true });

// ---- PATCH NOTES: toggle ----
const patchToggle = document.getElementById('patch-toggle');
const patchBody   = document.getElementById('patch-body');
const patchArrow  = patchToggle?.querySelector('.patch-toggle');

patchToggle?.addEventListener('click', () => {
  const isOpen = patchBody.classList.contains('open');
  patchBody.classList.toggle('open');
  if (patchArrow) {
    patchArrow.style.transform = isOpen ? '' : 'rotate(180deg)';
  }
});

// ---- SIGNUP: password match validation ----
const signupForm      = document.getElementById('signup-form');
const passwordInput   = document.getElementById('password');
const confirmInput    = document.getElementById('confirm-password');
const passwordError   = document.getElementById('password-error');

function checkPasswordMatch() {
  if (!confirmInput || !passwordInput) return;
  const match = passwordInput.value === confirmInput.value;
  if (confirmInput.value && !match) {
    passwordError?.classList.add('visible');
    confirmInput.setCustomValidity('Passwords do not match');
  } else {
    passwordError?.classList.remove('visible');
    confirmInput.setCustomValidity('');
  }
}

passwordInput?.addEventListener('input', checkPasswordMatch);
confirmInput?.addEventListener('input', checkPasswordMatch);

// ---- NAV: Show Dashboard if logged in, Sign In if not ----
const authItem = document.getElementById('nav-auth-item');
if (authItem) {
  const user = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
  if (user) {
    const label = user.is_admin ? 'Dashboard' : 'Profile';
    const page  = user.is_admin ? 'admin.html' : 'dashboard.html';
    authItem.innerHTML = `<a href="${page}" class="nav__link">${label}</a>`;
  }
}

// ============================================
// Reviews & Ratings
// ============================================
const REVIEWS_API = 'https://stoneforge-backend.onrender.com/api';

function escapeReviewHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderStars(rating) {
  const rounded = Math.round(Number(rating) || 0);
  return '★★★★★'.split('').map((star, i) =>
    `<span aria-hidden="true" style="opacity:${i < rounded ? '1' : '0.22'}">${star}</span>`
  ).join('');
}

function renderReviewList(reviews) {
  const list = document.getElementById('reviews-list');
  if (!list) return;

  if (!reviews.length) {
    list.innerHTML = '<div class="reviews__empty">No reviews yet. Be the first to rate StoneForge.</div>';
    return;
  }

  list.innerHTML = reviews.map(item => {
    const name = escapeReviewHtml(item.display_name || 'Player');
    const text = escapeReviewHtml(item.review || '');
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : '';

    return `
      <article class="review-card">
        <div class="review-card__top">
          <div>
            <div class="review-card__name">${name}</div>
            <div class="review-card__stars" aria-label="${Number(item.rating)} out of 5 stars">${renderStars(item.rating)}</div>
          </div>
          <time class="review-card__date">${date}</time>
        </div>
        ${text ? `<p class="review-card__text">${text}</p>` : ''}
      </article>
    `;
  }).join('');
}

async function loadReviews() {
  try {
    const response = await fetch(`${REVIEWS_API}/reviews`, { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load reviews.');

    const average = document.getElementById('reviews-average');
    const stars = document.getElementById('reviews-summary-stars');
    const count = document.getElementById('reviews-count');

    average.textContent = data.summary.count ? data.summary.average.toFixed(1) : '—';
    stars.innerHTML = data.summary.count ? renderStars(data.summary.average) : '☆☆☆☆☆';
    count.textContent = data.summary.count
      ? `${data.summary.count} review${data.summary.count === 1 ? '' : 's'}`
      : 'No reviews yet';

    renderReviewList(data.reviews || []);
  } catch (err) {
    const list = document.getElementById('reviews-list');
    if (list) list.innerHTML = '<div class="reviews__empty">Reviews are temporarily unavailable.</div>';
    console.error('Reviews load error:', err);
  }
}

function setupReviewForm() {
  const form = document.getElementById('review-form');
  const signin = document.getElementById('review-signin');
  const note = document.getElementById('review-form-note');
  const picker = document.getElementById('star-picker');
  const ratingInput = document.getElementById('review-rating');
  const textInput = document.getElementById('review-text');
  const counter = document.getElementById('review-counter');

  if (!form || !signin || !note || !picker || !ratingInput || !textInput) return;

  const user = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
  if (!user) return;

  form.hidden = false;
  signin.style.display = 'none';
  note.textContent = 'Choose a star rating and optionally share your experience.';

  function setRating(value) {
    ratingInput.value = String(value);
    picker.querySelectorAll('.star-picker__star').forEach(button => {
      button.classList.toggle('is-selected', Number(button.dataset.rating) <= value);
    });
  }

  picker.querySelectorAll('.star-picker__star').forEach(button => {
    button.addEventListener('click', () => setRating(Number(button.dataset.rating)));
  });

  textInput.addEventListener('input', () => {
    counter.textContent = `${textInput.value.length} / 500`;
  });

  fetch(`${REVIEWS_API}/reviews/mine`, { credentials: 'include' })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load your review.');
      if (data.review) {
        setRating(data.review.rating);
        textInput.value = data.review.review || '';
        counter.textContent = `${textInput.value.length} / 500`;
        note.textContent = 'You can update your existing review.';
        document.getElementById('review-submit').textContent = 'Update Review';
      }
    })
    .catch(err => console.error('My review load error:', err));

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const message = document.getElementById('review-form-message');
    const submit = document.getElementById('review-submit');
    message.textContent = '';

    const rating = Number(ratingInput.value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      message.textContent = 'Please select a star rating.';
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Saving...';

    try {
      const response = await fetch(`${REVIEWS_API}/reviews`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          review: textInput.value.trim()
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save your review.');

      message.textContent = 'Review saved.';
      submit.textContent = 'Update Review';
      await loadReviews();
    } catch (err) {
      message.textContent = err.message;
    } finally {
      submit.disabled = false;
      if (submit.textContent === 'Saving...') submit.textContent = 'Submit Review';
    }
  });
}

loadReviews();
setupReviewForm();
