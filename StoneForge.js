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
  const user = sessionStorage.getItem('sf_user');
  if (user) {
    authItem.innerHTML = '<a href="dashboard.html"><button class="nav__cta">Dashboard</button></a>';
  }
}
