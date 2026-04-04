// ============================================
// dashboard.js — Player profile page
// ============================================

const API_BASE  = 'https://stoneforge-backend.onrender.com/api';
const FULL_GAME_URL = 'https://drive.google.com/drive/folders/1u-lrULU2BEpGLfAqHs5qNczTRUU-5YGu?usp=sharing';
let cachedUser  = null;

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

function renderGameOwnership(ownsGame) {
    const actionEl  = document.getElementById('game-action');
    const subEl     = document.getElementById('game-sub');
    const badgeEl   = document.getElementById('owner-badge-container');

    if (ownsGame) {
        subEl.textContent = 'You own the full game';
        badgeEl.innerHTML = '<div class="owner-badge">⚔️ Full Game Owner</div>';
        actionEl.innerHTML = `<a href="${FULL_GAME_URL}" target="_blank" class="btn-download">⬇ Download Full Game</a>`;
    } else {
        subEl.textContent = 'Full version with all features';
        badgeEl.innerHTML = '';
        actionEl.innerHTML = '<div class="btn-locked">🔒 Purchase to Unlock</div>';
    }
}

async function initDashboard() {
    cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    if (!cachedUser) { window.location.href = 'login-page.html'; return; }
    if (cachedUser.is_admin) { window.location.href = 'admin.html'; return; }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display      = 'block';

    renderProfile(cachedUser, null);
    renderGameOwnership(false);

    const [detailsRes, ownershipRes] = await Promise.allSettled([
        apiGet(`get-player-details?playfab_id=${cachedUser.playfab_id}`),
        apiGet(`check-ownership?playfab_id=${cachedUser.playfab_id}`),
    ]);

    const details  = (detailsRes.status === 'fulfilled'   && detailsRes.value.ok)   ? detailsRes.value.data   : null;
    const ownsGame = (ownershipRes.status === 'fulfilled' && ownershipRes.value.ok) ? ownershipRes.value.data.owns_game : false;

    renderProfile(cachedUser, details);
    renderGameOwnership(ownsGame);

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initDashboard();
