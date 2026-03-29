// ============================================
// dashboard.js — Player profile page
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';
let selectedPkg  = null;
let cachedUser   = null;

async function apiGet(endpoint) {
    const res  = await fetch(`${API_BASE}/${endpoint}`, { credentials: 'include' });
    const data = await res.json();
    return { ok: res.ok, data };
}

function formatDate(iso) {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(iso) {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderProfile(user, details) {
    const name = user?.display_name || user?.username || 'Player';
    document.getElementById('display-name').textContent    = name;
    document.getElementById('avatar-initials').textContent = name.charAt(0).toUpperCase();

    const pid = user?.playfab_id || '';
    document.getElementById('playfab-id').textContent = 'Player ID: UF-' + (pid ? pid.slice(0,4) : '—');

    const created   = details?.created    || user?.created;
    const lastLogin = details?.last_login || user?.last_login;
    document.getElementById('account-created').textContent    = formatDate(created);
    document.getElementById('account-last-login').textContent = formatDateTime(lastLogin);
}

function renderCoyns(virtualCurrency) {
    const cn     = virtualCurrency?.CN ?? null;
    const el     = document.getElementById('coyns-amount');
    const noteEl = document.getElementById('coyns-note');

    if (cn === null) {
        el.textContent   = '—';
        noteEl.textContent = 'Purchase Coyns in-game';
    } else {
        el.textContent   = cn.toLocaleString();
        noteEl.textContent = cn === 0 ? 'Purchase Coyns in-game' : 'Spend Coyns at the in-game shop';
    }
}

// ---- Package modal ----
async function loadPackages() {
    const { ok, data } = await apiGet('purchase/packages');
    if (!ok) return;

    const grid = document.getElementById('packages-grid');
    grid.innerHTML = Object.entries(data.packages).map(([id, pkg]) => `
        <div class="pkg-card" data-id="${id}" data-coyns="${pkg.coyns}" data-price="${pkg.price_php}">
            <div class="pkg-card__coyns">${pkg.coyns}</div>
            <div class="pkg-card__label">COYNS</div>
            <div class="pkg-card__price">₱${pkg.price_php}</div>
        </div>
    `).join('');

    // Package selection
    grid.querySelectorAll('.pkg-card').forEach(card => {
        card.addEventListener('click', () => {
            grid.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedPkg = card.dataset.id;
            const btn   = document.getElementById('checkout-btn');
            btn.disabled     = false;
            btn.textContent  = `Buy ${card.dataset.coyns} Coyns for ₱${card.dataset.price}`;
        });
    });
}

function openModal() {
    selectedPkg = null;
    document.getElementById('checkout-btn').disabled    = true;
    document.getElementById('checkout-btn').textContent = 'Select a package';
    document.querySelectorAll('.pkg-card').forEach(c => c.classList.remove('selected'));
    document.getElementById('pkg-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('pkg-modal').style.display = 'none';
}

async function handleCheckout() {
    if (!selectedPkg || !cachedUser) return;

    const btn = document.getElementById('checkout-btn');
    btn.disabled    = true;
    btn.textContent = 'Redirecting...';

    try {
        const res  = await fetch(`${API_BASE}/purchase`, {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json' },
            body:        JSON.stringify({ user_id: cachedUser.playfab_id, package_id: selectedPkg }),
        });
        const data = await res.json();

        if (data.success && data.checkout_url) {
            window.location.href = data.checkout_url;
        } else {
            alert(data.error || 'Failed to create checkout. Try again.');
            btn.disabled    = false;
            btn.textContent = 'Try Again';
        }
    } catch {
        alert('Could not connect to server.');
        btn.disabled    = false;
        btn.textContent = 'Try Again';
    }
}

// ---- Check payment return ----
function checkPaymentReturn() {
    const params  = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (payment === 'success') {
        document.getElementById('payment-banner').style.display = 'block';
        // Clean URL
        window.history.replaceState({}, '', 'dashboard.html');
        // Refresh coyns after delay to allow webhook processing
        setTimeout(async () => {
            const { ok, data } = await apiGet(`get-inventory?playfab_id=${cachedUser.playfab_id}`);
            if (ok) renderCoyns(data.virtual_currency);
            document.getElementById('payment-banner').style.display = 'none';
        }, 4000);
    }
}

// ---- Main init ----
async function initDashboard() {
    cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');

    if (!cachedUser) { window.location.href = 'login-page.html'; return; }
    if (cachedUser.is_admin) { window.location.href = 'admin.html'; return; }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display      = 'block';

    renderProfile(cachedUser, null);
    renderCoyns(null);
    checkPaymentReturn();
    loadPackages();

    // Fetch details + inventory in parallel
    const [detailsRes, inventoryRes] = await Promise.allSettled([
        apiGet(`get-player-details?playfab_id=${cachedUser.playfab_id}`),
        apiGet(`get-inventory?playfab_id=${cachedUser.playfab_id}`),
    ]);

    const details = (detailsRes.status === 'fulfilled'   && detailsRes.value.ok)   ? detailsRes.value.data   : null;
    const invData = (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) ? inventoryRes.value.data : null;

    renderProfile(cachedUser, details);
    renderCoyns(invData?.virtual_currency || null);

    // Event listeners
    document.getElementById('buy-btn').addEventListener('click', openModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('pkg-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.getElementById('checkout-btn').addEventListener('click', handleCheckout);

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initDashboard();
