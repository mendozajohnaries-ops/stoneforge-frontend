// ============================================
// admin.js — Admin dashboard
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api';
let allPlayers = [];

function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function renderOverview(players) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const activeToday = players.filter(p => p.last_login && (now - new Date(p.last_login).getTime()) < day).length;
    const newToday    = players.filter(p => p.created    && (now - new Date(p.created).getTime())    < day).length;
    const total       = players.length;

    // Unique Users
    document.getElementById('ov-total').textContent        = total;
    document.getElementById('ov-active-today').textContent = activeToday;

    // Logins (active today as proxy)
    document.getElementById('ov-logins-total').textContent = total;
    document.getElementById('ov-logins-today').textContent = activeToday;

    // New Users
    document.getElementById('ov-new-total').textContent = total;
    document.getElementById('ov-new-today').textContent = newToday;

    document.getElementById('admin-subtitle').textContent =
        `StoneForge · ${total} players · Updated ${new Date().toLocaleTimeString()}`;
}

function renderReports(players) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    const newToday    = players.filter(p => p.created    && (now - new Date(p.created).getTime())    < day).length;
    const activeToday = players.filter(p => p.last_login && (now - new Date(p.last_login).getTime()) < day).length;
    const spenders    = players.filter(p => parseFloat(p.value_to_date_usd || 0) > 0).length;
    const totalCash   = players.reduce((s, p) => s + parseFloat(p.value_to_date_usd || 0), 0);

    const rows = [
        { label: 'Unique Users', today: activeToday, all: players.length },
        { label: 'New Users',    today: newToday,    all: players.length },
        { label: 'Purchases',    today: 'N/A',        all: 'N/A' },
        { label: 'Spenders',     today: spenders,     all: spenders },
        { label: 'ARPU',         today: 'N/A',        all: '$0.00' },
        { label: 'ARPPU',        today: 'N/A',        all: spenders > 0 ? '$' + (totalCash / spenders).toFixed(2) : '$0.00' },
    ];

    document.getElementById('reports-body').innerHTML = rows.map(r => `
        <tr>
            <td>${r.label}</td>
            <td>${r.today}</td>
            <td>${r.all}</td>
        </tr>
    `).join('');
}

function renderPlayers(players) {
    const tbody = document.getElementById('players-body');
    if (!players.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="no-data">No players found.</td></tr>';
        return;
    }
    tbody.innerHTML = players.map(p => {
        const name   = p.display_name || 'Unknown';
        const letter = name.charAt(0).toUpperCase();
        const cash   = parseFloat(p.value_to_date_usd || 0).toFixed(2);
        return `
            <tr>
                <td>
                    <div class="player-cell">
                        <div class="player-avatar">${letter}</div>
                        <div>
                            <div style="color:var(--clr-white);font-weight:600;">${name}</div>
                            <div class="player-id-small">${p.playfab_id.slice(0,4)}...</div>
                        </div>
                    </div>
                </td>
                <td>${formatDate(p.created)}</td>
                <td>${formatDateTime(p.last_login)}</td>
                <td style="color:var(--clr-orange-light);font-weight:600;">$${cash}</td>
                <td>
                    <button class="btn-delete" data-id="${p.playfab_id}" data-name="${name}" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#fca5a5;padding:0.3rem 0.75rem;border-radius:6px;font-family:var(--font-ui);font-size:0.78rem;font-weight:600;cursor:pointer;">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Search
document.getElementById('player-search')?.addEventListener('input', e => {
    const q        = e.target.value.toLowerCase();
    const filtered = allPlayers.filter(p =>
        (p.display_name || '').toLowerCase().includes(q) ||
        (p.playfab_id   || '').toLowerCase().includes(q)
    );
    renderPlayers(filtered);
});

// ---- Delete player ----
async function deletePlayer(playfabId, displayName) {
    if (!confirm(`Delete player "${displayName}"? This cannot be undone.`)) return;

    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    try {
        const res  = await fetch(`${API_BASE}/admin/delete-player`, {
            method:  'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'x-playfab-id': cachedUser.playfab_id },
            body: JSON.stringify({ playfab_id: playfabId }),
        });
        const data = await res.json();
        if (data.success) {
            allPlayers = allPlayers.filter(p => p.playfab_id !== playfabId);
            renderOverview(allPlayers);
            renderReports(allPlayers);
            renderPlayers(allPlayers);
        } else {
            alert('Failed to delete: ' + (data.error || 'Unknown error'));
        }
    } catch {
        alert('Could not connect to server.');
    }
}

// Delegate delete button clicks
document.getElementById('players-body')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-delete');
    if (btn) deletePlayer(btn.dataset.id, btn.dataset.name);
});

async function initAdmin() {
    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');

    if (!cachedUser) { window.location.href = 'login-page.html'; return; }
    if (!cachedUser.is_admin) { window.location.href = 'dashboard.html'; return; }

    let res;
    try {
        res = await fetch(`${API_BASE}/admin/players`, {
            credentials: 'include',
            headers: { 'x-playfab-id': cachedUser.playfab_id }
        });
    } catch {
        document.getElementById('loading-screen').innerHTML =
            '<p style="color:#fca5a5;font-family:var(--font-ui);">Could not connect to server.</p>';
        return;
    }

    if (res.status === 403) { window.location.href = 'dashboard.html'; return; }

    const data = await res.json();
    if (!data.success) {
        document.getElementById('loading-screen').innerHTML =
            `<p style="color:#fca5a5;font-family:var(--font-ui);">${data.error || 'Failed to load.'}</p>`;
        return;
    }

    allPlayers = data.players || [];

    document.getElementById('loading-screen').style.display  = 'none';
    document.getElementById('admin-content').style.display   = 'block';

    renderOverview(allPlayers);
    renderReports(allPlayers);
    renderPlayers(allPlayers);

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initAdmin();
