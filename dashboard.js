// ============================================
// dashboard.js — Loads player data from PHP API
// ============================================

const API_BASE = 'https://stoneforge-backend.onrender.com/api'; // ← same as auth.js

async function apiGet(endpoint) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
        credentials: 'include', // sends httpOnly session cookie automatically
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

function showError(message) {
    const banner = document.getElementById('error-banner');
    banner.textContent = message;
    banner.style.display = 'block';
}

function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    return new Date(isoString).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

// ---- Render functions ----

function renderProfile(profile, cachedUser) {
    const name = profile?.DisplayName || cachedUser?.display_name || cachedUser?.username || 'Player';
    document.getElementById('display-name').textContent = name;
    document.getElementById('avatar-initials').textContent = name.charAt(0).toUpperCase();
    document.getElementById('account-created').textContent =
        'Member since ' + formatDate(profile?.Created);
    document.getElementById('playfab-id').textContent =
        'Player ID: ' + (cachedUser?.playfab_id || '—');
}

function renderStats(stats) {
    const container = document.getElementById('stats-list');
    const entries = Object.entries(stats);

    if (entries.length === 0) {
        container.innerHTML = '<div class="stat-empty">No statistics recorded yet.<br>Play the game to earn stats!</div>';
        return;
    }

    container.innerHTML = entries.map(([name, value]) => `
        <div class="stat-row">
            <span class="stat-row__name">${name.replace(/_/g, ' ')}</span>
            <span class="stat-row__value">${value.toLocaleString()}</span>
        </div>
    `).join('');
}

function renderInventory(inventory) {
    const grid = document.getElementById('inventory-grid');

    if (!inventory || inventory.length === 0) {
        grid.innerHTML = '<div class="stat-empty" style="grid-column:1/-1;">No items in inventory.<br>Craft items in-game to see them here!</div>';
        return;
    }

    // Map item class IDs to emojis for display
    const iconMap = {
        'Stone':     '🪨',
        'Wood':      '🪵',
        'Iron':      '⚙️',
        'Gold':      '🥇',
        'Diamond':   '💎',
        'Pickaxe':   '⛏️',
        'Hammer':    '🔨',
        'Axe':       '🪓',
        'Sword':     '⚔️',
        'Shield':    '🛡️',
        'Potion':    '🧪',
        'Ore':       '🔩',
        'Gem':       '💠',
    };

    grid.innerHTML = inventory.map(item => {
        const itemName = item.DisplayName || item.ItemId || 'Unknown Item';
        const icon = Object.entries(iconMap).find(([k]) =>
            itemName.toLowerCase().includes(k.toLowerCase())
        )?.[1] ?? '📦';

        return `
            <div class="inventory-item" title="${item.ItemId}">
                <div class="inventory-item__icon">${icon}</div>
                <div class="inventory-item__name">${itemName}</div>
                ${item.RemainingUses != null
                    ? `<div class="inventory-item__qty">${item.RemainingUses} uses left</div>`
                    : ''}
            </div>
        `;
    }).join('');
}

function renderCurrency(virtualCurrency) {
    const container = document.getElementById('currency-list');
    const entries = Object.entries(virtualCurrency);

    if (entries.length === 0) {
        container.innerHTML = '<span style="font-size:0.85rem; color: var(--clr-text-dim); font-family: var(--font-ui);">No currency data</span>';
        return;
    }

    container.innerHTML = entries.map(([code, amount]) => `
        <div class="currency-chip">
            <span class="currency-chip__code">${code}</span>
            <span class="currency-chip__amount">${amount.toLocaleString()}</span>
        </div>
    `).join('');
}

// ---- Main init ----

async function initDashboard() {
    // 1. Check auth before rendering anything
    const { ok, status } = await apiGet('check-auth.php').catch(() => ({ ok: false }));

    if (!ok || status === 401) {
        window.location.href = 'login-page.html';
        return;
    }

    // 2. Get cached user info from sessionStorage (set on login)
    const cachedUser = JSON.parse(sessionStorage.getItem('sf_user') || '{}');

    // 3. Show dashboard, hide loader
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // 4. Set a placeholder while real data loads
    renderProfile(null, cachedUser);

    // 5. Load all data in parallel — don't wait for each one to finish
    const [profileRes, statsRes, inventoryRes] = await Promise.allSettled([
        apiGet('get-profile.php'),
        apiGet('get-stats.php'),
        apiGet('get-inventory.php'),
    ]);

    // Profile
    if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
        renderProfile(profileRes.value.data.profile, cachedUser);
    } else {
        renderProfile(null, cachedUser); // fall back to cached
    }

    // Stats
    if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        renderStats(statsRes.value.data.stats || {});
    } else {
        renderStats({});
    }

    // Inventory + currency
    if (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) {
        renderInventory(inventoryRes.value.data.inventory || []);
        renderCurrency(inventoryRes.value.data.virtual_currency || {});
    } else {
        renderInventory([]);
        renderCurrency({});
    }

    // 6. Logout button
    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        sessionStorage.removeItem('sf_user');
        window.location.href = 'login-page.html';
    });
}

initDashboard();
