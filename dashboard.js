// ============================================
// dashboard.js — Player profile page
// ============================================

const API_BASE  = 'https://stoneforge-backend.onrender.com/api';
let cachedUser  = null;

async function apiGet(endpoint, headers = {}) {
    const res  = await fetch(`${API_BASE}/${endpoint}`, { credentials: 'include', headers });
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

function renderOwnerBadge(ownsGame) {
    const badgeEl = document.getElementById('owner-badge-container');
    if (ownsGame) {
        badgeEl.innerHTML = '<div class="owner-badge">⚔️ Full Game Owner</div>';
    } else {
        badgeEl.innerHTML = '';
    }
}

// ============================================
// Achievements — placeholder UI (TODO: wire to PlayFab stats)
// ============================================
const ACHIEVEMENT_DEFS = [
    { id: 'tutorial',   icon: '📖', name: 'First Steps',       desc: 'Complete the tutorial',         statKey: 'TutorialComplete' },
    { id: 'mine_first', icon: '⛏️', name: 'Stone Breaker',     desc: 'Mine your first stone',          statKey: 'FirstStoneMined' },
    { id: 'build_100',  icon: '🏗️', name: "Builder's Mark",    desc: 'Place 100 blocks',               statKey: 'BlocksPlaced' },
    { id: 'craft_item', icon: '🔨', name: 'Forgemaster',        desc: 'Craft your first item',          statKey: 'ItemsCrafted' },
    { id: 'chapter2',   icon: '🗺️', name: 'Adventurer',        desc: 'Reach Chapter 2',                statKey: 'Chapter2Complete' },
    { id: 'rare_ore',   icon: '💎', name: 'Diamond Miner',      desc: 'Mine a rare ore deposit',        statKey: 'RareOreMined' },
];

function renderAchievements(stats) {
    // stats = { StatName: value } from PlayFab — null means not yet loaded
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    grid.innerHTML = ACHIEVEMENT_DEFS.map(a => {
        // TODO: map a.statKey to actual PlayFab stat names from Gabriel's team
        // For now, treat any stat value > 0 as unlocked
        const unlocked = stats ? (stats[a.statKey] > 0) : false;
        const cls      = unlocked ? 'achievement-item--unlocked' : 'achievement-item--locked';
        const badge    = unlocked
            ? '<span class="achievement-info__badge achievement-info__badge--unlocked">✓ Unlocked</span>'
            : '<span class="achievement-info__badge achievement-info__badge--locked">Locked</span>';
        return `
            <div class="achievement-item ${cls}">
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-info">
                    <div class="achievement-info__name">${a.name}</div>
                    <div class="achievement-info__desc">${a.desc}</div>
                    ${badge}
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// Report Modal
// ============================================
let reportTarget   = null; // { playfab_id, display_name }
let searchDebounce = null;
// Track already-reported targets per session to prevent duplicate submissions
const reportedTargets = new Set(JSON.parse(sessionStorage.getItem('sf_reported') || '[]'));

function saveReportedTargets() {
    sessionStorage.setItem('sf_reported', JSON.stringify([...reportedTargets]));
}

function openReportModal() {
    reportTarget = null;
    setReportStep(1);
    document.getElementById('rmodal-search').value = '';
    document.getElementById('rmodal-results').innerHTML = '<div class="rmodal__no-results" style="padding:1rem;color:var(--clr-text-dim);font-family:var(--font-ui);font-size:0.82rem;">Type at least 2 characters to search.</div>';
    document.getElementById('report-modal').style.display = 'flex';
    setTimeout(() => document.getElementById('rmodal-search').focus(), 50);
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
}

function setReportStep(step) {
    document.querySelectorAll('.rmodal__step').forEach(s => s.classList.remove('rmodal__step--active'));
    const el = document.getElementById(`rmodal-step-${step}`);
    if (el) el.classList.add('rmodal__step--active');
}

function selectReportTarget(player) {
    reportTarget = player;
    const name   = player.display_name || 'Unknown';
    document.getElementById('rmodal-sel-avatar').textContent = name.charAt(0).toUpperCase();
    document.getElementById('rmodal-sel-name').textContent   = name;
    document.getElementById('rmodal-sel-id').textContent     = 'UF-' + player.playfab_id.slice(0, 4);

    // Reset categories
    document.querySelectorAll('#rmodal-categories .rmodal__cat').forEach(label => {
        label.classList.remove('rmodal__cat--selected');
        label.querySelector('input').checked = false;
    });
    document.getElementById('rmodal-note').value   = '';
    document.getElementById('rmodal-error').style.display = 'none';

    setReportStep(2);
}

async function searchPlayers(q) {
    const resultsEl = document.getElementById('rmodal-results');
    if (q.length < 2) {
        resultsEl.innerHTML = '<div class="rmodal__no-results" style="padding:1rem;color:var(--clr-text-dim);font-family:var(--font-ui);font-size:0.82rem;">Type at least 2 characters to search.</div>';
        return;
    }
    resultsEl.innerHTML = '<div class="rmodal__no-results" style="padding:1rem;color:var(--clr-text-dim);font-family:var(--font-ui);font-size:0.82rem;">Searching...</div>';
    try {
        const { ok, data } = await apiGet(`search-players?q=${encodeURIComponent(q)}`, { 'x-playfab-id': cachedUser.playfab_id });
        if (!ok || !data.success) { resultsEl.innerHTML = '<div class="rmodal__no-results">Search failed. Try again.</div>'; return; }
        const players = (data.players || []).filter(p => p.playfab_id !== cachedUser.playfab_id);
        if (!players.length) { resultsEl.innerHTML = '<div class="rmodal__no-results" style="padding:1rem;color:var(--clr-text-dim);font-family:var(--font-ui);font-size:0.82rem;">No players found.</div>'; return; }

        resultsEl.innerHTML = players.map(p => {
            const name   = p.display_name || 'Unknown';
            const letter = name.charAt(0).toUpperCase();
            const alreadyReported = reportedTargets.has(p.playfab_id);
            return `
                <div class="rmodal__result-item ${alreadyReported ? 'already-reported' : ''}" data-id="${p.playfab_id}" data-name="${name}" style="${alreadyReported ? 'opacity:0.5;cursor:not-allowed;' : ''}">
                    <div class="rmodal__result-avatar">${letter}</div>
                    <div>
                        <div class="rmodal__result-name">${name}</div>
                        <div class="rmodal__result-id">UF-${p.playfab_id.slice(0,4)}${alreadyReported ? ' · Already reported' : ''}</div>
                    </div>
                </div>
            `;
        }).join('');

        // Click handler for each result
        resultsEl.querySelectorAll('.rmodal__result-item:not(.already-reported)').forEach(item => {
            item.addEventListener('click', () => {
                selectReportTarget({ playfab_id: item.dataset.id, display_name: item.dataset.name });
            });
        });
    } catch {
        resultsEl.innerHTML = '<div class="rmodal__no-results">Could not connect. Try again.</div>';
    }
}

async function submitReport() {
    const categories = [...document.querySelectorAll('#rmodal-categories input:checked')].map(cb => cb.value);
    const note       = document.getElementById('rmodal-note').value.trim();
    const errorEl    = document.getElementById('rmodal-error');
    const submitBtn  = document.getElementById('rmodal-submit-btn');

    errorEl.style.display = 'none';

    if (!reportTarget) return;
    if (reportTarget.playfab_id === cachedUser.playfab_id) {
        errorEl.textContent   = 'You cannot report yourself.';
        errorEl.style.display = 'block';
        return;
    }
    if (reportedTargets.has(reportTarget.playfab_id)) {
        errorEl.textContent   = 'You have already reported this player.';
        errorEl.style.display = 'block';
        return;
    }
    if (!categories.length) {
        errorEl.textContent   = 'Please select at least one reason.';
        errorEl.style.display = 'block';
        return;
    }

    submitBtn.disabled    = true;
    submitBtn.textContent = 'Submitting...';

    try {
        const res  = await fetch(`${API_BASE}/report-player`, {
            method:      'POST',
            credentials: 'include',
            headers:     { 'Content-Type': 'application/json', 'x-playfab-id': cachedUser.playfab_id },
            body:        JSON.stringify({ reported_player_id: reportTarget.playfab_id, categories, note }),
        });
        const data = await res.json();
        if (!data.success) {
            errorEl.textContent   = data.error || 'Failed to submit report.';
            errorEl.style.display = 'block';
            submitBtn.disabled    = false;
            submitBtn.textContent = 'Submit Report';
            return;
        }
        // Track locally so the player can't resubmit in the same session
        reportedTargets.add(reportTarget.playfab_id);
        saveReportedTargets();
        setReportStep(3);
    } catch {
        errorEl.textContent   = 'Could not connect to the server.';
        errorEl.style.display = 'block';
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Submit Report';
    }
}

function initReportModal() {
    // Category pill toggle
    document.querySelectorAll('#rmodal-categories .rmodal__cat').forEach(label => {
        label.addEventListener('click', () => {
            const cb = label.querySelector('input');
            // toggle is handled by browser checkbox, just sync the class
            requestAnimationFrame(() => {
                label.classList.toggle('rmodal__cat--selected', cb.checked);
            });
        });
    });

    document.getElementById('report-btn')?.addEventListener('click', openReportModal);
    document.getElementById('rmodal-close-btn')?.addEventListener('click', closeReportModal);
    document.getElementById('rmodal-done-btn')?.addEventListener('click', closeReportModal);
    document.getElementById('rmodal-back-btn')?.addEventListener('click', () => setReportStep(1));
    document.getElementById('rmodal-submit-btn')?.addEventListener('click', submitReport);

    // Close on backdrop click
    document.getElementById('report-modal')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeReportModal();
    });

    // Search input debounce
    document.getElementById('rmodal-search')?.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => searchPlayers(e.target.value.trim()), 300);
    });
}

// ============================================
// Main init
// ============================================
async function initDashboard() {
    cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || 'null');
    if (!cachedUser) { window.location.href = 'login-page.html'; return; }
    if (cachedUser.is_admin) { window.location.href = 'admin.html'; return; }

    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display      = 'block';

    renderProfile(cachedUser, null);
    renderOwnerBadge(false);
    renderAchievements(null); // placeholder locked state while loading

    initReportModal();

    const [detailsRes, ownershipRes, statsRes] = await Promise.allSettled([
        apiGet(`get-player-details?playfab_id=${cachedUser.playfab_id}`),
        apiGet(`check-ownership?playfab_id=${cachedUser.playfab_id}`),
        apiGet('get-stats'),
    ]);

    const details  = (detailsRes.status === 'fulfilled'   && detailsRes.value.ok)   ? detailsRes.value.data   : null;
    const ownsGame = (ownershipRes.status === 'fulfilled' && ownershipRes.value.ok) ? ownershipRes.value.data.owns_game : false;
    const stats    = (statsRes.status === 'fulfilled'     && statsRes.value.ok)     ? statsRes.value.data.stats : null;

    renderProfile(cachedUser, details);
    renderOwnerBadge(ownsGame);
    renderAchievements(stats);

    // Remove "Syncing..." subtitle once we have stats
    const achSubtitle = document.querySelector('#achievements-card .card__title span');
    if (achSubtitle) achSubtitle.style.display = 'none';

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initDashboard();
