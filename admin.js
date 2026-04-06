// ============================================
// admin.js — Admin dashboard
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';
let allPlayers   = [];
let playerStatuses = {}; // { playfab_id: { status, suspension_end } }
let currentTab   = 'all';

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Manila'
    });
}

function getPlayerStatus(playfabId) {
    const record = playerStatuses[playfabId];
    if (!record) return 'active';
    if (record.status === 'suspended' && record.suspension_end && new Date() > new Date(record.suspension_end)) return 'active';
    return record.status || 'active';
}

function getSuspensionEnd(playfabId) {
    return playerStatuses[playfabId]?.suspension_end || null;
}

function statusBadge(status, suspensionEnd) {
    if (status === 'banned') return `<span style="background:rgba(239,68,68,0.15);color:#fca5a5;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.72rem;font-weight:700;font-family:var(--font-ui);">Banned</span>`;
    if (status === 'suspended') {
        const until = suspensionEnd ? formatDateTime(suspensionEnd) : '';
        return `<span style="background:rgba(217,119,6,0.15);color:var(--clr-orange-light);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.72rem;font-weight:700;font-family:var(--font-ui);" title="Until ${until}">Suspended</span>`;
    }
    return `<span style="background:rgba(95,143,71,0.15);color:var(--clr-green-light);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.72rem;font-weight:700;font-family:var(--font-ui);">Active</span>`;
}

function renderOverview(players) {
    const now = Date.now(), day = 24 * 60 * 60 * 1000;
    const activeToday = players.filter(p => p.last_login && (now - new Date(p.last_login).getTime()) < day).length;
    const newToday    = players.filter(p => p.created    && (now - new Date(p.created).getTime())    < day).length;
    document.getElementById('ov-total').textContent        = players.length;
    document.getElementById('ov-active-today').textContent = activeToday;
    document.getElementById('ov-logins-total').textContent = players.length;
    document.getElementById('ov-logins-today').textContent = activeToday;
    document.getElementById('ov-new-total').textContent    = players.length;
    document.getElementById('ov-new-today').textContent    = newToday;
    document.getElementById('admin-subtitle').textContent  = `StoneForge · ${players.length} players · Updated ${new Date().toLocaleTimeString()}`;
}

function renderReports(players) {
    const now = Date.now(), day = 24 * 60 * 60 * 1000;
    const newToday    = players.filter(p => p.created    && (now - new Date(p.created).getTime())    < day).length;
    const activeToday = players.filter(p => p.last_login && (now - new Date(p.last_login).getTime()) < day).length;
    const spenders    = players.filter(p => parseFloat(p.value_to_date_usd || 0) > 0).length;
    const totalCash   = players.reduce((s, p) => s + parseFloat(p.value_to_date_usd || 0), 0);
    const rows = [
        { label: 'Unique Users', today: activeToday, all: players.length },
        { label: 'New Users',    today: newToday,    all: players.length },
        { label: 'ARPU',         today: 'N/A',        all: '$0.00' },
        { label: 'ARPPU',        today: 'N/A',        all: '$0.00' },
    ];
    document.getElementById('reports-body').innerHTML = rows.map(r => `
        <tr><td>${r.label}</td><td>${r.today}</td><td>${r.all}</td></tr>
    `).join('');
}

function getFilteredPlayers() {
    if (currentTab === 'banned') return allPlayers.filter(p => getPlayerStatus(p.playfab_id) === 'banned');
    if (currentTab === 'suspended') return allPlayers.filter(p => getPlayerStatus(p.playfab_id) === 'suspended');
    return allPlayers; // 'all' shows everyone with badges
}

function renderPlayers(players) {
    const tbody = document.getElementById('players-body');
    const q     = document.getElementById('player-search')?.value.toLowerCase() || '';
    const filtered = players.filter(p =>
        (p.display_name || '').toLowerCase().includes(q) ||
        (p.playfab_id   || '').toLowerCase().includes(q)
    );

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="no-data">No players found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const name     = p.display_name || 'Unknown';
        const letter   = name.charAt(0).toUpperCase();
        const cash     = parseFloat(p.value_to_date_usd || 0).toFixed(2);
        const status   = getPlayerStatus(p.playfab_id);
        const suspEnd  = getSuspensionEnd(p.playfab_id);

        const banBtn = status === 'banned'
            ? `<button class="btn-action btn-unban" data-id="${p.playfab_id}" data-name="${name}">Unban</button>`
            : `<button class="btn-action btn-ban" data-id="${p.playfab_id}" data-name="${name}">Ban</button>`;

        const suspBtn = status === 'suspended'
            ? `<button class="btn-action btn-unsuspend" data-id="${p.playfab_id}" data-name="${name}">Unsuspend</button>`
            : `<button class="btn-action btn-suspend" data-id="${p.playfab_id}" data-name="${name}">Suspend</button>`;

        return `
            <tr>
                <td>
                    <div class="player-cell">
                        <div class="player-avatar">${letter}</div>
                        <div>
                            <div style="color:var(--clr-white);font-weight:600;">${name}</div>
                            <div class="player-id-small">UF-${p.playfab_id.slice(0,4)}</div>
                        </div>
                    </div>
                </td>
                <td>${statusBadge(status, suspEnd)}</td>
                <td>${formatDate(p.created)}</td>
                <td>${formatDateTime(p.last_login)}</td>
                <td style="color:var(--clr-orange-light);font-weight:600;">$${cash}</td>
                <td>${banBtn}</td>
                <td>${suspBtn}</td>
            </tr>
        `;
    }).join('');
}

// ---- Suspend modal ----
function openSuspendModal(playfabId, name) {
    document.getElementById('suspend-modal').style.display = 'flex';
    document.getElementById('suspend-player-name').textContent = name;
    document.getElementById('suspend-confirm-btn').dataset.id   = playfabId;
    document.getElementById('suspend-confirm-btn').dataset.name = name;
    document.getElementById('suspend-duration').value = '';
    document.getElementById('suspend-unit').value = 'hours';
    document.getElementById('suspend-error').style.display = 'none';
}

function closeSuspendModal() {
    document.getElementById('suspend-modal').style.display = 'none';
}

// ---- Tab switching ----
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderPlayers(getFilteredPlayers());
}

// ---- Admin actions ----
async function adminAction(endpoint, body) {
    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    const res = await fetch(`${API_BASE}/admin/${endpoint}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-playfab-id': cachedUser.playfab_id },
        body: JSON.stringify(body),
    });
    return res.json();
}

// ---- Event delegation ----
document.getElementById('players-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-action');
    if (!btn) return;
    const id   = btn.dataset.id;
    const name = btn.dataset.name;

    if (btn.classList.contains('btn-ban')) {
        if (!confirm(`Ban "${name}"? They will not be able to log in.`)) return;
        btn.textContent = 'Banning...'; btn.disabled = true;
        const data = await adminAction('ban-player', { playfab_id: id, display_name: name });
        if (data.success) {
            playerStatuses[id] = { status: 'banned', suspension_end: null };
            renderPlayers(getFilteredPlayers());
        } else alert(data.error || 'Failed to ban.');
    }

    if (btn.classList.contains('btn-unban')) {
        if (!confirm(`Unban "${name}"?`)) return;
        btn.textContent = 'Unbanning...'; btn.disabled = true;
        const data = await adminAction('unban-player', { playfab_id: id });
        if (data.success) {
            playerStatuses[id] = { status: 'active', suspension_end: null };
            renderPlayers(getFilteredPlayers());
        } else alert(data.error || 'Failed to unban.');
    }

    if (btn.classList.contains('btn-suspend')) {
        openSuspendModal(id, name);
    }

    if (btn.classList.contains('btn-unsuspend')) {
        if (!confirm(`Unsuspend "${name}"?`)) return;
        btn.textContent = 'Unsuspending...'; btn.disabled = true;
        const data = await adminAction('unsuspend-player', { playfab_id: id });
        if (data.success) {
            playerStatuses[id] = { status: 'active', suspension_end: null };
            renderPlayers(getFilteredPlayers());
        } else alert(data.error || 'Failed to unsuspend.');
    }
});

document.getElementById('suspend-confirm-btn')?.addEventListener('click', async () => {
    const btn      = document.getElementById('suspend-confirm-btn');
    const id       = btn.dataset.id;
    const name     = btn.dataset.name;
    const duration = parseInt(document.getElementById('suspend-duration').value);
    const unit     = document.getElementById('suspend-unit').value;
    const errEl    = document.getElementById('suspend-error');

    if (!duration || duration <= 0) {
        errEl.textContent = 'Please enter a valid duration.';
        errEl.style.display = 'block';
        return;
    }

    const hours = unit === 'days' ? duration * 24 : duration;
    btn.textContent = 'Suspending...'; btn.disabled = true;

    const data = await adminAction('suspend-player', { playfab_id: id, display_name: name, duration_hours: hours });
    if (data.success) {
        playerStatuses[id] = { status: 'suspended', suspension_end: data.suspension_end };
        closeSuspendModal();
        renderPlayers(getFilteredPlayers());
    } else {
        errEl.textContent = data.error || 'Failed to suspend.';
        errEl.style.display = 'block';
        btn.textContent = 'Confirm'; btn.disabled = false;
    }
});

document.getElementById('player-search')?.addEventListener('input', () => {
    renderPlayers(getFilteredPlayers());
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

document.getElementById('suspend-cancel-btn')?.addEventListener('click', closeSuspendModal);
document.getElementById('suspend-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSuspendModal();
});

// ---- Render purchases ----
function renderPurchases(purchases) {
    const tbody = document.getElementById('purchases-body');
    const totalEl = document.getElementById('purchases-total');

    if (!purchases || purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="no-data">No purchases yet.</td></tr>';
        totalEl.textContent = '₱0';
        return;
    }

    tbody.innerHTML = purchases.map(p => {
        const name   = p.display_name || 'Unknown';
        const pid    = 'UF-' + (p.playfab_id || '').slice(0, 4);
        return `
            <tr>
                <td style="color:var(--clr-white);font-weight:600;">${name}</td>
                <td style="font-family:var(--font-body);font-size:0.82rem;color:var(--clr-text-dim);">${pid}</td>
                <td style="color:var(--clr-orange-light);font-weight:600;">₱350</td>
            </tr>
        `;
    }).join('');

    totalEl.textContent = '₱' + (purchases.length * 350).toLocaleString();
}

// ---- Main init ----
async function initAdmin() {
    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    if (!cachedUser) { window.location.href = 'login-page.html'; return; }
    if (!cachedUser.is_admin) { window.location.href = 'dashboard.html'; return; }

    let res;
    try {
        res = await fetch(`${API_BASE}/admin/players`, {
            credentials: 'include',
            headers: { 'x-playfab-id': cachedUser.playfab_id },
        });
    } catch {
        document.getElementById('loading-screen').innerHTML = '<p style="color:#fca5a5;font-family:var(--font-ui);">Could not connect to server.</p>';
        return;
    }

    if (res.status === 403) { window.location.href = 'dashboard.html'; return; }

    const data = await res.json();
    if (!data.success) {
        document.getElementById('loading-screen').innerHTML = `<p style="color:#fca5a5;font-family:var(--font-ui);">${data.error || 'Failed to load.'}</p>`;
        return;
    }

    allPlayers = data.players || [];

    // Build status map from player data directly
    for (const p of allPlayers) {
        playerStatuses[p.playfab_id] = { status: p.status || 'active', suspension_end: p.suspension_end || null };
    }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('admin-content').style.display  = 'block';

    renderOverview(allPlayers);
    renderReports(allPlayers);
    renderPlayers(getFilteredPlayers());

    // Load purchases
    try {
        const purchRes  = await fetch(`${API_BASE}/admin/purchases`, {
            credentials: 'include',
            headers: { 'x-playfab-id': cachedUser.playfab_id },
        });
        const purchData = await purchRes.json();
        if (purchData.success) renderPurchases(purchData.purchases);
    } catch { renderPurchases([]); }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initAdmin();
