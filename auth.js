// ============================================
// auth.js — Login, signup, logout logic
// ============================================

// Save intents if coming from game
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('shop') === 'true') {
    sessionStorage.setItem('shop_intent', 'true');
}
if (urlParams.get('report') === 'true') {
    sessionStorage.setItem('report_intent', 'true');
}

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

    const shopIntent = sessionStorage.getItem('shop_intent');
    if (shopIntent === 'true') {
        sessionStorage.removeItem('shop_intent');
        window.location.href = data.is_admin ? 'admin.html' : 'dashboard.html?shop=true';
    } else {
        window.location.href = data.is_admin ? 'admin.html' : 'dashboard.html';
    }
}

// ---- Blocked account modal (banned / suspended) ----

function injectBlockedModalStyles() {
    if (document.getElementById('blocked-modal-styles')) return;
    const style = document.createElement('style');
    style.id    = 'blocked-modal-styles';
    style.textContent = `
        #blocked-modal {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; align-items: center; justify-content: center;
        }
        .blocked-modal__backdrop {
            position: absolute; inset: 0;
            background: rgba(0,0,0,0.82);
            backdrop-filter: blur(6px);
        }
        .blocked-modal__card {
            position: relative; z-index: 1;
            background: #161616;
            border-radius: 18px;
            width: 100%; max-width: 420px;
            margin: 1rem;
            overflow: hidden;
            animation: bmIn 0.22s ease;
            box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        }
        @keyframes bmIn {
            from { opacity: 0; transform: translateY(-14px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        .blocked-modal__banner {
            padding: 1.75rem 2rem 1.5rem;
            display: flex; align-items: flex-start; gap: 1rem;
        }
        .blocked-modal__banner--banned    { background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(153,27,27,0.12)); border-bottom: 1px solid rgba(239,68,68,0.2); }
        .blocked-modal__banner--suspended { background: linear-gradient(135deg, rgba(217,119,6,0.18), rgba(146,64,14,0.12)); border-bottom: 1px solid rgba(217,119,6,0.2); }
        .blocked-modal__icon { font-size: 2rem; line-height: 1; flex-shrink: 0; margin-top: 0.1rem; }
        .blocked-modal__heading {
            font-family: 'Montserrat', sans-serif;
            font-size: 1.15rem; font-weight: 800; margin-bottom: 0.3rem;
        }
        .blocked-modal__heading--banned    { color: #fca5a5; }
        .blocked-modal__heading--suspended { color: #fcd34d; }
        .blocked-modal__tagline {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.82rem; color: rgba(255,255,255,0.55);
        }
        .blocked-modal__body { padding: 1.5rem 2rem; }
        .blocked-modal__field { margin-bottom: 1rem; }
        .blocked-modal__field-label {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.1em; color: rgba(255,255,255,0.35);
            margin-bottom: 0.3rem;
        }
        .blocked-modal__field-value {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.88rem; color: rgba(255,255,255,0.8);
        }
        .blocked-modal__field-value--reason {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 8px; padding: 0.55rem 0.85rem;
            font-style: italic;
        }
        .blocked-modal__appeal {
            font-family: 'Montserrat', sans-serif;
            font-size: 0.78rem; color: rgba(255,255,255,0.3);
            margin-top: 1rem; padding-top: 1rem;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        .blocked-modal__footer { padding: 0 2rem 1.75rem; }
        .blocked-modal__close-btn {
            width: 100%; padding: 0.8rem;
            background: rgba(255,255,255,0.07);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px; color: rgba(255,255,255,0.7);
            font-family: 'Montserrat', sans-serif;
            font-size: 0.9rem; font-weight: 600;
            cursor: pointer; transition: background 0.15s ease;
        }
        .blocked-modal__close-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    `;
    document.head.appendChild(style);
}

function showBlockedModal(type, data) {
    injectBlockedModalStyles();

    // Remove any existing instance
    document.getElementById('blocked-modal')?.remove();

    const isBanned    = type === 'banned';
    const heading     = isBanned ? 'Account Banned' : 'Account Suspended';
    const icon        = isBanned ? '🚫' : '⏸️';
    const bannerCls   = isBanned ? 'blocked-modal__banner--banned' : 'blocked-modal__banner--suspended';
    const headingCls  = isBanned ? 'blocked-modal__heading--banned' : 'blocked-modal__heading--suspended';
    const tagline     = isBanned
        ? 'Your account has been permanently removed from StoneForge.'
        : 'Your account access is temporarily restricted.';

    // Build detail rows
    let detailsHtml = '';

    if (!isBanned && data.until) {
        detailsHtml += `
            <div class="blocked-modal__field">
                <div class="blocked-modal__field-label">Suspended Until</div>
                <div class="blocked-modal__field-value">${data.until}</div>
            </div>
        `;
    }

    const reason = isBanned ? data.ban_reason : data.suspension_reason;
    if (reason) {
        detailsHtml += `
            <div class="blocked-modal__field">
                <div class="blocked-modal__field-label">Reason</div>
                <div class="blocked-modal__field-value blocked-modal__field-value--reason">${reason}</div>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.id    = 'blocked-modal';
    modal.innerHTML = `
        <div class="blocked-modal__backdrop"></div>
        <div class="blocked-modal__card">
            <div class="blocked-modal__banner ${bannerCls}">
                <div class="blocked-modal__icon">${icon}</div>
                <div>
                    <div class="blocked-modal__heading ${headingCls}">${heading}</div>
                    <div class="blocked-modal__tagline">${tagline}</div>
                </div>
            </div>
            <div class="blocked-modal__body">
                ${detailsHtml}
                <div class="blocked-modal__appeal">
                    If you believe this is a mistake, contact us at support@stoneforge.gg
                </div>
            </div>
            <div class="blocked-modal__footer">
                <button class="blocked-modal__close-btn" id="blocked-modal-close">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.blocked-modal__backdrop').addEventListener('click', () => modal.remove());
    document.getElementById('blocked-modal-close').addEventListener('click', () => modal.remove());
}

// ---- Google (email) sign-in modal ----

function initGoogleModal() {
    const googleBtn = document.getElementById('google-signin-btn');
    if (!googleBtn) return;

    const modal = document.createElement('div');
    modal.id = 'google-modal';
    modal.innerHTML = `
        <div class="google-modal__backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);z-index:9998;display:flex;align-items:center;justify-content:center;">
            <div class="google-modal__card" style="background:#1a1a1a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;width:100%;max-width:400px;margin:1rem;padding:1.75rem;animation:gmIn 0.2s ease;">
                <div class="google-modal__header">
                    <span>Sign in with Email</span>
                    <button id="google-modal-close" class="google-modal__close">✕</button>
                </div>
                <p class="google-modal__hint">Enter your StoneForge email and password.</p>
                <div id="google-error" class="google-modal__error" style="display:none;"></div>
                <div class="google-modal__field">
                    <label for="google-email">Email</label>
                    <input type="email" id="google-email" placeholder="your@email.com" autocomplete="email">
                </div>
                <div class="google-modal__field">
                    <label for="google-password">Password</label>
                    <input type="password" id="google-password" placeholder="Password" autocomplete="current-password">
                </div>
                <button id="google-submit" class="google-modal__submit">Continue</button>
            </div>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        @keyframes gmIn {
            from { opacity: 0; transform: translateY(-10px); }
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
        .google-modal__field { margin-bottom: 1rem; }
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
        .google-modal__field input:focus { border-color: rgba(255,255,255,0.3); }
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

    googleBtn.addEventListener('click', () => {
        document.body.appendChild(modal);
        document.getElementById('google-email').focus();
    });

    modal.addEventListener('click', (e) => {
        const backdrop = modal.querySelector('.google-modal__backdrop');
        const closeBtn = document.getElementById('google-modal-close');
        if (e.target === backdrop || e.target === closeBtn) modal.remove();
    });

    modal.addEventListener('click', async (e) => {
        if (e.target.id !== 'google-submit') return;

        const email    = document.getElementById('google-email').value.trim();
        const password = document.getElementById('google-password').value;
        const errorEl  = document.getElementById('google-error');
        const submitEl = document.getElementById('google-submit');

        errorEl.style.display = 'none';

        if (!email || !password) {
            errorEl.textContent    = 'Please fill in all fields.';
            errorEl.style.display  = 'block';
            return;
        }

        submitEl.disabled    = true;
        submitEl.textContent = 'Signing in...';

        try {
            const { ok, status, data } = await apiPost('login-email', { email, password });
            if (!ok) {
                // Show styled modal for ban/suspension, then close the google modal
                if (status === 403 && data.blocked) {
                    modal.remove();
                    showBlockedModal(data.blocked, data);
                    return;
                }
                errorEl.textContent   = data.error || 'Login failed. Check your credentials.';
                errorEl.style.display = 'block';
                submitEl.disabled    = false;
                submitEl.textContent = 'Continue';
                return;
            }
            saveUserAndRedirect(data, data.username);
        } catch (err) {
            errorEl.textContent   = 'Could not connect to the server. Try again.';
            errorEl.style.display = 'block';
            submitEl.disabled    = false;
            submitEl.textContent = 'Continue';
        }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('google-submit')?.click();
    });
}

// ---- SIGNUP FORM ----

const signupForm_auth = document.getElementById('signup-form');
if (signupForm_auth) {
    const termsCheckbox = document.getElementById('terms-checkbox');
    const termsToggle   = document.getElementById('terms-toggle');
    const termsBody     = document.getElementById('terms-body');
    const termsArrow    = document.getElementById('terms-arrow');
    const submitBtn     = document.getElementById('submit-btn');

    if (termsCheckbox && submitBtn) {
        termsCheckbox.addEventListener('change', () => {
            submitBtn.disabled      = !termsCheckbox.checked;
            submitBtn.style.opacity = termsCheckbox.checked ? '1'       : '0.5';
            submitBtn.style.cursor  = termsCheckbox.checked ? 'pointer' : 'not-allowed';
        });
    }

    if (termsToggle && termsBody) {
        termsToggle.addEventListener('click', () => {
            const open = termsBody.style.display === 'block';
            termsBody.style.display = open ? 'none' : 'block';
            if (termsArrow) termsArrow.textContent = open ? 'View ▾' : 'Hide ▴';
        });
        const termsLink = document.getElementById('terms-link');
        if (termsLink) {
            termsLink.addEventListener('click', (e) => {
                e.preventDefault();
                termsBody.style.display = 'block';
                if (termsArrow) termsArrow.textContent = 'Hide ▴';
            });
        }
    }

    const passwordEl  = document.getElementById('password');
    const confirmEl   = document.getElementById('confirm-password');
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

    // ---- OTP helpers ----

    // Holds the email used to request the OTP so verify-otp can reference it
    let _pendingEmail = '';

    function showOtpStep(email) {
        _pendingEmail = email;
        const otpEmailDisplay = document.getElementById('otp-email-display');
        if (otpEmailDisplay) otpEmailDisplay.textContent = email;

        // Swap panels
        const formWrap  = document.getElementById('signup-form-wrap');
        const otpStep   = document.getElementById('otp-step');
        if (formWrap) formWrap.style.display = 'none';
        if (otpStep)  otpStep.style.display  = 'block';

        // Focus the OTP input
        document.getElementById('otp-input')?.focus();
    }

    function showSignupForm() {
        const formWrap = document.getElementById('signup-form-wrap');
        const otpStep  = document.getElementById('otp-step');
        if (formWrap) formWrap.style.display = 'block';
        if (otpStep)  otpStep.style.display  = 'none';
        hideError();
    }

    // ---- Signup submit → send OTP ----

    signupForm_auth.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        if (!validatePasswords()) return;

        const username = document.getElementById('username').value.trim();
        const email    = document.getElementById('email').value.trim();
        const password = passwordEl.value;

        if (!username || !email || !password) { showError('Please fill in all fields.'); return; }
        if (username.length < 3)  { showError('Username must be at least 3 characters.'); return; }
        if (!/^[a-zA-Z0-9]+$/.test(username)) { showError('Username can only contain letters and numbers.'); return; }
        if (password.length < 6)  { showError('Password must be at least 6 characters.'); return; }

        setLoading(true, 'submit-btn', 'Create Account', 'Sending code...');

        try {
            const { ok, data } = await apiPost('send-otp', { username, email, password });
            if (!ok) { showError(data.error || 'Failed to send verification email.'); return; }
            showOtpStep(email);
        } catch (err) {
            showError('Could not connect to the server. Try again.');
        } finally {
            setLoading(false, 'submit-btn', 'Create Account');
        }
    });

    // ---- OTP verify button ----

    document.addEventListener('click', async (e) => {
        if (e.target.id !== 'otp-verify-btn') return;
        hideError();

        const otpInput = document.getElementById('otp-input');
        const otp = otpInput?.value.trim();

        if (!otp || otp.length !== 5) { showError('Enter the 5-digit code sent to your email.'); return; }

        const btn = document.getElementById('otp-verify-btn');
        btn.disabled    = true;
        btn.textContent = 'Verifying...';

        try {
            const { ok, data } = await apiPost('verify-otp', { email: _pendingEmail, otp });
            if (!ok) {
                showError(data.error || 'Verification failed.');
                btn.disabled    = false;
                btn.textContent = 'Verify';
                return;
            }
            saveUserAndRedirect(data, data.username);
        } catch (err) {
            showError('Could not connect to the server. Try again.');
            btn.disabled    = false;
            btn.textContent = 'Verify';
        }
    });

    // ---- Resend OTP ----

    document.addEventListener('click', async (e) => {
        if (e.target.id !== 'otp-resend-btn') return;

        const btn = document.getElementById('otp-resend-btn');
        btn.style.pointerEvents = 'none';
        btn.textContent = 'Sending...';
        hideError();

        // Re-read the form values from the hidden signup form
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        try {
            const { ok, data } = await apiPost('send-otp', { username, email: _pendingEmail, password });
            if (!ok) {
                showError(data.error || 'Failed to resend code.');
            } else {
                btn.textContent = 'Code resent!';
                setTimeout(() => {
                    btn.textContent         = 'Resend code';
                    btn.style.pointerEvents = 'auto';
                }, 4000);
                return;
            }
        } catch (err) {
            showError('Could not connect to the server. Try again.');
        }

        btn.textContent         = 'Resend code';
        btn.style.pointerEvents = 'auto';
    });

    // ---- Back to form ----

    document.addEventListener('click', (e) => {
        if (e.target.id === 'otp-back-btn') showSignupForm();
    });

    // ---- Allow only digits in OTP input ----

    document.addEventListener('input', (e) => {
        if (e.target.id !== 'otp-input') return;
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
    });

    // ---- Enter key on OTP input triggers verify ----

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement?.id === 'otp-input') {
            document.getElementById('otp-verify-btn')?.click();
        }
    });
}

// ---- LOGIN FORM ----
const loginForm_auth = document.getElementById('login-form');
if (loginForm_auth) {
    loginForm_auth.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;

        if (!username || !password) { showError('Please fill in all fields.'); return; }

        setLoading(true, 'submit-btn', 'Sign In', 'Signing in...');

        try {
            const { ok, status, data } = await apiPost('login', { username, password });
            if (!ok) {
                if (status === 403 && data.blocked) {
                    showBlockedModal(data.blocked, data);
                    return;
                }
                showError(data.error || 'Login failed. Check your credentials.');
                return;
            }
            saveUserAndRedirect(data, username);
        } catch (err) {
            showError('Could not connect to the server. Try again.');
        } finally {
            setLoading(false, 'submit-btn', 'Sign In');
        }
    });

    initGoogleModal();
}
