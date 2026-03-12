// ============================================
// auth.js — Login, signup, logout logic
// Change API_BASE to your PHP server URL
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api'; // ← change this

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

function setLoading(loading) {
    const btn = document.getElementById('submit-btn');
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading
        ? (btn.dataset.loadingText || 'Loading...')
        : (btn.dataset.defaultText || btn.textContent);
}

async function apiPost(endpoint, body) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // sends/receives httpOnly cookies
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// ---- LOGIN FORM ----

const loginForm_auth = document.getElementById('login-form');
if (loginForm_auth) {
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.dataset.defaultText = 'Sign In';
    submitBtn.dataset.loadingText = 'Signing in...';

    loginForm_auth.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) {
            showError('Please fill in all fields.');
            return;
        }

        setLoading(true);

        try {
            const { ok, data } = await apiPost('login.php', { username, password });

            if (!ok) {
                showError(data.error || 'Login failed. Check your credentials.');
                return;
            }

            // Store non-sensitive display info in sessionStorage
            // (SessionTicket is safely in the httpOnly cookie — JS never sees it)
            sessionStorage.setItem('sf_user', JSON.stringify({
                playfab_id:   data.playfab_id,
                username:     data.username,
                display_name: data.display_name,
            }));

            // Redirect to dashboard
            window.location.href = 'dashboard.html';

        } catch (err) {
            showError('Could not connect to the server. Try again.');
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    });
}

// ---- SIGNUP FORM ----

const signupForm_auth = document.getElementById('signup-form');
if (signupForm_auth) {
    const submitBtn    = document.getElementById('submit-btn');
    const passwordEl   = document.getElementById('password');
    const confirmEl    = document.getElementById('confirm-password');
    const passwordErr  = document.getElementById('password-error');

    submitBtn.dataset.defaultText = 'Create Account';
    submitBtn.dataset.loadingText = 'Creating account...';

    function validatePasswords() {
        const match = passwordEl.value === confirmEl.value;
        if (confirmEl.value && !match) {
            passwordErr.classList.add('visible');
            confirmEl.setCustomValidity('Passwords do not match');
        } else {
            passwordErr.classList.remove('visible');
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

        if (!username || !email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        setLoading(true);

        try {
            const { ok, data } = await apiPost('register.php', { username, email, password });

            if (!ok) {
                showError(data.error || 'Registration failed.');
                return;
            }

            sessionStorage.setItem('sf_user', JSON.stringify({
                playfab_id:   data.playfab_id,
                username:     data.username,
                display_name: data.display_name,
            }));

            window.location.href = 'dashboard.html';

        } catch (err) {
            showError('Could not connect to the server. Try again.');
            console.error('Signup error:', err);
        } finally {
            setLoading(false);
        }
    });
}
