// ============================================
// admin.js — Admin dashboard
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';
let allPlayers     = [];
let playerStatuses = {}; // { playfab_id: { status, suspension_end } }
let reportCounts   = {}; // { playfab_id: count }
let currentTab     = 'all';

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

// Report count badge — color thresholds: 0 = none, 1-2 = low, 3-4 = med (orange), 5+ = high (red)
function reportBadge(playfabId, name) {
    const count = reportCounts[playfabId] || 0;
    let cls = 'report-badge--none';
    if (count >= 5)      cls = 'report-badge--high';
    else if (count >= 3) cls = 'report-badge--med';
    else if (count >= 1) cls = 'report-badge--low';

    const icon = count >= 5 ? '🚨 ' : count >= 3 ? '⚠ ' : '';
    const clickable = count > 0 ? `data-id="${playfabId}" data-name="${name}"` : '';
    return `<span class="report-badge ${cls} ${count > 0 ? 'btn-view-reports' : ''}" ${clickable}>${icon}${count}</span>`;
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
    if (currentTab === 'banned')   return allPlayers.filter(p => getPlayerStatus(p.playfab_id) === 'banned');
    if (currentTab === 'suspended') return allPlayers.filter(p => getPlayerStatus(p.playfab_id) === 'suspended');
    if (currentTab === 'reported') return allPlayers.filter(p => (reportCounts[p.playfab_id] || 0) > 0);
    return allPlayers; // 'all'
}

function renderPlayers(players) {
    const tbody = document.getElementById('players-body');
    const q     = document.getElementById('player-search')?.value.toLowerCase() || '';
    const filtered = players.filter(p =>
        (p.display_name || '').toLowerCase().includes(q) ||
        (p.playfab_id   || '').toLowerCase().includes(q)
    );

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="no-data">No players found.</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const name    = p.display_name || 'Unknown';
        const letter  = name.charAt(0).toUpperCase();
        const cash    = parseFloat(p.value_to_date_usd || 0).toFixed(2);
        const status  = getPlayerStatus(p.playfab_id);
        const suspEnd = getSuspensionEnd(p.playfab_id);

        const banBtn = status === 'banned'
            ? `<button class="btn-action btn-unban"    data-id="${p.playfab_id}" data-name="${name}">Unban</button>`
            : `<button class="btn-action btn-ban"      data-id="${p.playfab_id}" data-name="${name}">Ban</button>`;

        const suspBtn = status === 'suspended'
            ? `<button class="btn-action btn-unsuspend" data-id="${p.playfab_id}" data-name="${name}">Unsuspend</button>`
            : `<button class="btn-action btn-suspend"   data-id="${p.playfab_id}" data-name="${name}">Suspend</button>`;

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
                <td>${reportBadge(p.playfab_id, name)}</td>
                <td>${formatDate(p.created)}</td>
                <td>${formatDateTime(p.last_login)}</td>
                <td style="color:var(--clr-orange-light);font-weight:600;">$${cash}</td>
                <td>${banBtn}</td>
                <td>${suspBtn}</td>
            </tr>
        `;
    }).join('');
}

// ============================================
// Suspend modal
// ============================================
function openSuspendModal(playfabId, name) {
    document.getElementById('suspend-modal').style.display = 'flex';
    document.getElementById('suspend-player-name').textContent = name;
    document.getElementById('suspend-confirm-btn').dataset.id   = playfabId;
    document.getElementById('suspend-confirm-btn').dataset.name = name;
    document.getElementById('suspend-duration').value = '';
    document.getElementById('suspend-unit').value     = 'hours';
    document.getElementById('suspend-reason').value   = '';
    document.getElementById('suspend-error').style.display = 'none';
}

function closeSuspendModal() {
    document.getElementById('suspend-modal').style.display = 'none';
}

// ============================================
// Ban modal
// ============================================
function openBanModal(playfabId, name) {
    document.getElementById('ban-modal').style.display = 'flex';
    document.getElementById('ban-player-name').textContent = name;
    document.getElementById('ban-confirm-btn').dataset.id   = playfabId;
    document.getElementById('ban-confirm-btn').dataset.name = name;
    document.getElementById('ban-reason').value = '';
    document.getElementById('ban-error').style.display = 'none';
}

function closeBanModal() {
    document.getElementById('ban-modal').style.display = 'none';
}

// ============================================
// Reports view modal
// ============================================
async function openReportsModal(playfabId, name) {
    document.getElementById('reports-modal').style.display  = 'flex';
    document.getElementById('reports-modal-title').textContent = `Reports · ${name}`;
    const count = reportCounts[playfabId] || 0;
    document.getElementById('reports-modal-sub').textContent   = `${count} report${count !== 1 ? 's' : ''} filed against this player`;
    document.getElementById('reports-modal-body').innerHTML = '<div class="no-data">Loading...</div>';

    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    try {
        const res  = await fetch(`${API_BASE}/admin/reports/${playfabId}`, {
            credentials: 'include',
            headers: { 'x-playfab-id': cachedUser.playfab_id },
        });
        const data = await res.json();
        if (!data.success || !data.reports.length) {
            document.getElementById('reports-modal-body').innerHTML = '<div class="no-data">No reports found.</div>';
            return;
        }
        document.getElementById('reports-modal-body').innerHTML = data.reports.map(r => {
            const cats = (r.categories || []).map(c => `<span class="report-entry__cat">${c}</span>`).join('');
            const note = r.note ? `<div class="report-entry__note">"${r.note}"</div>` : '';
            const date = new Date(r.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="report-entry">
                    <div class="report-entry__cats">${cats}</div>
                    ${note}
                    <div class="report-entry__meta">
                        Reported by <span class="report-entry__reporter">${r.reporter_name || r.reporter_id}</span> · ${date}
                    </div>
                </div>
            `;
        }).join('');
    } catch {
        document.getElementById('reports-modal-body').innerHTML = '<div class="no-data">Could not load reports.</div>';
    }
}

function closeReportsModal() {
    document.getElementById('reports-modal').style.display = 'none';
}

// ============================================
// Tab switching
// ============================================
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderPlayers(getFilteredPlayers());
}

// ============================================
// Admin actions
// ============================================
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

// ============================================
// Event delegation — players table
// ============================================
document.getElementById('players-body')?.addEventListener('click', async (e) => {
    // View reports badge
    const badge = e.target.closest('.btn-view-reports');
    if (badge) {
        openReportsModal(badge.dataset.id, badge.dataset.name);
        return;
    }

    const btn = e.target.closest('.btn-action');
    if (!btn) return;
    const id   = btn.dataset.id;
    const name = btn.dataset.name;

    if (btn.classList.contains('btn-ban')) {
        openBanModal(id, name);
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

// ============================================
// Ban confirm
// ============================================
document.getElementById('ban-confirm-btn')?.addEventListener('click', async () => {
    const btn    = document.getElementById('ban-confirm-btn');
    const id     = btn.dataset.id;
    const name   = btn.dataset.name;
    const reason = document.getElementById('ban-reason').value.trim();
    const errEl  = document.getElementById('ban-error');

    btn.textContent = 'Banning...'; btn.disabled = true;
    const data = await adminAction('ban-player', { playfab_id: id, display_name: name, reason });
    if (data.success) {
        playerStatuses[id] = { status: 'banned', suspension_end: null };
        closeBanModal();
        renderPlayers(getFilteredPlayers());
    } else {
        errEl.textContent   = data.error || 'Failed to ban.';
        errEl.style.display = 'block';
        btn.textContent = 'Ban Player'; btn.disabled = false;
    }
});

// ============================================
// Suspend confirm
// ============================================
document.getElementById('suspend-confirm-btn')?.addEventListener('click', async () => {
    const btn      = document.getElementById('suspend-confirm-btn');
    const id       = btn.dataset.id;
    const name     = btn.dataset.name;
    const duration = parseInt(document.getElementById('suspend-duration').value);
    const unit     = document.getElementById('suspend-unit').value;
    const reason   = document.getElementById('suspend-reason').value.trim();
    const errEl    = document.getElementById('suspend-error');

    if (!duration || duration <= 0) {
        errEl.textContent   = 'Please enter a valid duration.';
        errEl.style.display = 'block';
        return;
    }

    const hours = unit === 'days' ? duration * 24 : duration;
    btn.textContent = 'Suspending...'; btn.disabled = true;

    const data = await adminAction('suspend-player', { playfab_id: id, display_name: name, duration_hours: hours, reason });
    if (data.success) {
        playerStatuses[id] = { status: 'suspended', suspension_end: data.suspension_end };
        closeSuspendModal();
        renderPlayers(getFilteredPlayers());
    } else {
        errEl.textContent   = data.error || 'Failed to suspend.';
        errEl.style.display = 'block';
        btn.textContent = 'Confirm'; btn.disabled = false;
    }
});

// ============================================
// Modal close handlers
// ============================================
document.getElementById('suspend-cancel-btn')?.addEventListener('click', closeSuspendModal);
document.getElementById('suspend-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSuspendModal(); });

document.getElementById('ban-cancel-btn')?.addEventListener('click', closeBanModal);
document.getElementById('ban-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeBanModal(); });

document.getElementById('reports-modal-close')?.addEventListener('click', closeReportsModal);
document.getElementById('reports-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeReportsModal(); });

// ============================================
// Search + tab
// ============================================
document.getElementById('player-search')?.addEventListener('input', () => {
    renderPlayers(getFilteredPlayers());
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ============================================
// Render purchases
// ============================================
function renderPurchases(purchases) {
    const tbody   = document.getElementById('purchases-body');
    const totalEl = document.getElementById('purchases-total');

    if (!purchases || purchases.length === 0) {
        tbody.innerHTML   = '<tr><td colspan="3" class="no-data">No purchases yet.</td></tr>';
        totalEl.textContent = '₱0';
        return;
    }

    tbody.innerHTML = purchases.map(p => {
        const name = p.display_name || 'Unknown';
        const pid  = 'UF-' + (p.playfab_id || '').slice(0, 4);
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

// ============================================
// Main init
// ============================================
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

    // Build status map
    for (const p of allPlayers) {
        playerStatuses[p.playfab_id] = { status: p.status || 'active', suspension_end: p.suspension_end || null };
    }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('admin-content').style.display  = 'block';

    renderOverview(allPlayers);
    renderReports(allPlayers);
    renderPlayers(getFilteredPlayers());

    // Fetch report counts in parallel (non-blocking — renders fine without them)
    fetch(`${API_BASE}/admin/report-counts`, {
        credentials: 'include',
        headers: { 'x-playfab-id': cachedUser.playfab_id },
    }).then(r => r.json()).then(d => {
        if (d.success) {
            reportCounts = d.counts || {};
            renderPlayers(getFilteredPlayers()); // re-render with report counts
        }
    }).catch(() => {});

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
