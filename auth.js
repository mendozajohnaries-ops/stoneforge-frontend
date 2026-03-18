// ============================================
// auth.js — Login, signup, logout logic
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';

// ---- Shared helpers ----

function showError(message) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
}

function hideError() {
    const el = document.getElementById('auth-error');
    if (el) el.style.display = 'none';
}

function setLoading(loading, btnId = 'submit-btn', defaultText = '', loadingText = 'Loading...') {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? loadingText : defaultText;
}

async function apiPost(endpoint, body) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

function saveUserAndRedirect(data, username) {
    sessionStorage.setItem('sf_user', JSON.stringify({
        playfab_id:   data.playfab_id,
        username:     data.username || username,
        display_name: data.display_name,
        created:      data.created      || null,
        last_login:   data.last_login   || null,
        is_admin:     data.is_admin     || false,
    }));
    window.location.href = data.is_admin ? 'admin.html' : 'dashboard.html';
}

// ---- LOGIN FORM (username + password) ----

const loginForm_auth = document.getElementById('login-form');
if (loginForm_auth) {
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.dataset.defaultText = 'Sign In';

    loginForm_auth.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) { showError('Please fill in all fields.'); return; }

        setLoading(true, 'submit-btn', 'Sign In', 'Signing in...');

        try {
            const { ok, data } = await apiPost('login', { username, password });
            if (!ok) { showError(data.error || 'Login failed. Check your credentials.'); return; }
            saveUserAndRedirect(data, username);
        } catch (err) {
            showError('Could not connect to the server. Try again.');
        } finally {
            setLoading(false, 'submit-btn', 'Sign In');
        }
    });
}

// ---- GOOGLE MODAL (email + password) ----

const googleBtn = document.getElementById('google-btn');
if (googleBtn) {
    // Build modal once
    const modal = document.createElement('div');
    modal.id = 'google-modal';
    modal.innerHTML = `
        <div class="google-modal__backdrop"></div>
        <div class="google-modal__card">
            <div class="google-modal__header">
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" style="width:24px;height:24px;">
                <span>Sign in with Google account</span>
                <button class="google-modal__close" id="google-modal-close">✕</button>
            </div>
            <p class="google-modal__hint">Use the email you registered with</p>
            <div class="google-modal__error" id="google-error" style="display:none;"></div>
            <div class="google-modal__field">
                <label>Email</label>
                <input type="email" id="google-email" placeholder="Enter your email" autocomplete="email">
            </div>
            <div class="google-modal__field">
                <label>Password</label>
                <input type="password" id="google-password" placeholder="Enter your password" autocomplete="current-password">
            </div>
            <button class="google-modal__submit" id="google-submit">Continue</button>
        </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #google-modal {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; align-items: center; justify-content: center;
        }
        .google-modal__backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
        }
        .google-modal__card {
            position: relative; z-index: 1;
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 16px;
            padding: 2rem;
            width: 100%; max-width: 400px;
            margin: 1rem;
            animation: modalIn 0.2s ease;
        }
        @keyframes modalIn {
            from { opacity: 0; transform: translateY(-12px); }
            to   { opacity: 1; transform: translateY(0); }
        }
        .google-modal__header {
            display: flex; align-items: center; gap: 0.75rem;
            margin-bottom: 0.5rem;
            font-family: 'Montserrat', sans-serif;
            font-weight: 700; font-size: 1rem; color: #fff;
        }
        .google-modal__close {
            margin-left: auto; background: none; border: none;
            color: #888; font-size: 1rem; cursor: pointer; padding: 0.25rem;
        }
        .google-modal__close:hover { color: #fff; }
        .google-modal__hint {
            font-size: 0.82rem; color: #888;
            font-family: 'Montserrat', sans-serif;
            margin-bottom: 1.25rem;
        }
        .google-modal__error {
            background: rgba(239,68,68,0.1);
            border: 1px solid rgba(239,68,68,0.3);
            border-radius: 8px; padding: 0.6rem 0.9rem;
            font-size: 0.84rem; color: #fca5a5;
            font-family: 'Montserrat', sans-serif;
            margin-bottom: 1rem;
        }
        .google-modal__field {
            margin-bottom: 1rem;
        }
        .google-modal__field label {
            display: block; font-size: 0.82rem; font-weight: 600;
            color: #ccc; margin-bottom: 0.4rem;
            font-family: 'Montserrat', sans-serif;
        }
        .google-modal__field input {
            width: 100%; padding: 0.75rem 1rem;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px; color: #fff;
            font-family: 'Roboto Mono', monospace;
            font-size: 0.9rem; outline: none;
            box-sizing: border-box;
            transition: border-color 0.15s ease;
        }
        .google-modal__field input:focus {
            border-color: rgba(255,255,255,0.3);
        }
        .google-modal__submit {
            width: 100%; padding: 0.85rem;
            background: #D97706; border: none;
            border-radius: 10px; color: #fff;
            font-family: 'Montserrat', sans-serif;
            font-weight: 700; font-size: 0.95rem;
            cursor: pointer; margin-top: 0.5rem;
            transition: background 0.15s ease;
        }
        .google-modal__submit:hover { background: #F59E0B; }
        .google-modal__submit:disabled { opacity: 0.6; cursor: not-allowed; }
    `;
    document.head.appendChild(style);

    // Open modal
    googleBtn.addEventListener('click', () => {
        document.body.appendChild(modal);
        document.getElementById('google-email').focus();
    });

    // Close modal
    modal.addEventListener('click', (e) => {
        const backdrop = modal.querySelector('.google-modal__backdrop');
        const closeBtn = document.getElementById('google-modal-close');
        if (e.target === backdrop || e.target === closeBtn) {
            modal.remove();
        }
    });

    // Submit email login
    modal.addEventListener('click', async (e) => {
        if (e.target.id !== 'google-submit') return;

        const email    = document.getElementById('google-email').value.trim();
        const password = document.getElementById('google-password').value;
        const errorEl  = document.getElementById('google-error');
        const submitEl = document.getElementById('google-submit');

        errorEl.style.display = 'none';

        if (!email || !password) {
            errorEl.textContent = 'Please fill in all fields.';
            errorEl.style.display = 'block';
            return;
        }

        submitEl.disabled = true;
        submitEl.textContent = 'Signing in...';

        try {
            const { ok, data } = await apiPost('login-email', { email, password });
            if (!ok) {
                errorEl.textContent = data.error || 'Login failed. Check your credentials.';
                errorEl.style.display = 'block';
                submitEl.disabled = false;
                submitEl.textContent = 'Continue';
                return;
            }
            saveUserAndRedirect(data, data.username);
        } catch (err) {
            errorEl.textContent = 'Could not connect to the server. Try again.';
            errorEl.style.display = 'block';
            submitEl.disabled = false;
            submitEl.textContent = 'Continue';
        }
    });

    // Allow Enter key in modal fields
    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            document.getElementById('google-submit')?.click();
        }
    });
}

// ---- SIGNUP FORM ----

const signupForm_auth = document.getElementById('signup-form');
if (signupForm_auth) {
    // Terms checkbox — enable/disable submit button
    const termsCheckbox = document.getElementById('terms-checkbox');
    const termsToggle   = document.getElementById('terms-toggle');
    const termsBody     = document.getElementById('terms-body');
    const termsArrow    = document.getElementById('terms-arrow');
    const submitBtn     = document.getElementById('submit-btn');

    if (termsCheckbox && submitBtn) {
        termsCheckbox.addEventListener('change', () => {
            submitBtn.disabled = !termsCheckbox.checked;
            submitBtn.style.opacity  = termsCheckbox.checked ? '1'            : '0.5';
            submitBtn.style.cursor   = termsCheckbox.checked ? 'pointer'      : 'not-allowed';
        });
    }

    if (termsToggle && termsBody) {
        termsToggle.addEventListener('click', () => {
            const open = termsBody.style.display === 'block';
            termsBody.style.display = open ? 'none' : 'block';
            if (termsArrow) termsArrow.textContent = open ? 'View ▾' : 'Hide ▴';
        });
        // terms-link click also opens
        const termsLink = document.getElementById('terms-link');
        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                termsBody.style.display = 'block';
                if (termsArrow) termsArrow.textContent = 'Hide ▴';
            });
        }
    }
    const passwordEl = document.getElementById('password');
    const confirmEl  = document.getElementById('confirm-password');
    const passwordErr = document.getElementById('password-error');

    function validatePasswords() {
        const match = passwordEl.value === confirmEl.value;
        if (confirmEl.value && !match) {
            passwordErr?.classList.add('visible');
            confirmEl.setCustomValidity('Passwords do not match');
        } else {
            passwordErr?.classList.remove('visible');
            confirmEl.setCustomValidity('');
        }
        return match;
    }

    passwordEl.addEventListener('input', validatePasswords);
    confirmEl.addEventListener('input', validatePasswords);

    signupForm_auth.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (!validatePasswords()) return;

        const username = document.getElementById('username').value.trim();
        const email    = document.getElementById('email').value.trim();
        const password = passwordEl.value;

        if (!username || !email || !password) { showError('Please fill in all fields.'); return; }
        if (username.length < 3) { showError('Username must be at least 3 characters.'); return; }
        if (!/^[a-zA-Z0-9]+$/.test(username)) { showError('Username can only contain letters and numbers.'); return; }
        if (password.length < 6) { showError('Password must be at least 6 characters.'); return; }

        setLoading(true, 'submit-btn', 'Create Account', 'Creating account...');

        try {
            const { ok, data } = await apiPost('register', { username, email, password });
            if (!ok) { showError(data.error || 'Registration failed.'); return; }
            saveUserAndRedirect(data, username);
        } catch (err) {
            showError('Could not connect to the server. Try again.');
        } finally {
            setLoading(false, 'submit-btn', 'Create Account');
        }
    });
}
