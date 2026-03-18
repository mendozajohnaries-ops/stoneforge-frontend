// ============================================
// dashboard.js — Player profile page
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';

async function apiGet(endpoint) {
    const res  = await fetch(`${API_BASE}/${endpoint}`, { credentials: 'include' });
    const data = await res.json();
    return { ok: res.ok, data };
}

function formatDate(iso) {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function formatDateTime(iso) {
    if (!iso) return 'Unknown';
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function renderProfile(user, details) {
    const name = user?.display_name || user?.username || 'Player';
    document.getElementById('display-name').textContent     = name;
    document.getElementById('avatar-initials').textContent  = name.charAt(0).toUpperCase();
    const pid = user?.playfab_id || '';
    document.getElementById('playfab-id').textContent = 'Player ID: ' + (pid ? pid.slice(0,4) + '...' : '—');

    const created   = details?.created    || user?.created;
    const lastLogin = details?.last_login || user?.last_login;

    document.getElementById('account-created').textContent   = formatDate(created);
    document.getElementById('account-last-login').textContent = formatDateTime(lastLogin);
}

function renderGold(virtualCurrency) {
    const gc     = virtualCurrency?.GC ?? null;
    const el     = document.getElementById('gold-amount');
    const noteEl = document.getElementById('gold-note');

    if (gc === null) {
        el.textContent   = '—';
        noteEl.textContent = 'Earn gold by playing StoneForge';
    } else {
        el.textContent   = gc.toLocaleString();
        noteEl.textContent = gc === 0
            ? 'Earn gold by playing StoneForge'
            : 'Spend gold at the in-game shop';
    }
}

async function initDashboard() {
    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');

    if (!cachedUser) {
        window.location.href = 'login-page.html';
        return;
    }

    if (cachedUser.is_admin) {
        window.location.href = 'admin.html';
        return;
    }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display      = 'block';

    // Render immediately with cached data
    renderProfile(cachedUser, null);
    renderGold(null);

    // Fetch details + virtual currency in parallel
    const [detailsRes, inventoryRes] = await Promise.allSettled([
        apiGet(`get-player-details?playfab_id=${cachedUser.playfab_id}`),
        apiGet('get-inventory'),
    ]);

    const details  = (detailsRes.status === 'fulfilled'   && detailsRes.value.ok)   ? detailsRes.value.data   : null;
    const invData  = (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) ? inventoryRes.value.data : null;

    renderProfile(cachedUser, details);
    renderGold(invData?.virtual_currency || null);

    // Logout
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initDashboard();
