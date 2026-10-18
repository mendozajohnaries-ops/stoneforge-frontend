/* Shared catalog and authenticated, read-only account achievement browser. */
(function (root) {
    'use strict';
    const categories = ['Story', 'Gameplay', 'Collection', 'Perks', 'Multiplayer', 'Mastery', 'Future'];
    function validateCatalog(data) {
        if (!data || data.version !== 1 || !Array.isArray(data.definitions) || data.definitions.length !== 71) throw new Error('Invalid achievement catalog.');
        const ids = new Set();
        for (const def of data.definitions) {
            if (!def || typeof def.id !== 'string' || ids.has(def.id) || !categories.includes(def.category) ||
                typeof def.title !== 'string' || typeof def.description !== 'string' || typeof def.available !== 'boolean' ||
                !Number.isSafeInteger(def.target) || def.target < 1 || def.target > 10000) throw new Error('Invalid achievement definition.');
            ids.add(def.id);
        }
        if (data.definitions.filter(def => def.available).length !== 58) throw new Error('Catalog availability mismatch.');
        return data.definitions;
    }
    function validateRecords(data, definitions) {
        if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 71) throw new Error('Invalid achievement progress.');
        const defs = new Map(definitions.map(def => [def.id, def])), records = new Map();
        for (const record of data.records) {
            const def = record && defs.get(record.id);
            if (!def || !def.available || records.has(record.id) || !Number.isSafeInteger(record.progress) ||
                record.progress < 0 || record.progress > def.target) throw new Error('Invalid achievement progress.');
            records.set(record.id, record);
        }
        return records;
    }
    function state(def, records) {
        const progress = records.get(def.id)?.progress || 0;
        return { progress, status: !def.available ? 'unavailable' : progress >= def.target ? 'unlocked' : progress > 0 ? 'progress' : 'locked' };
    }
    function summary(definitions, records) {
        const available = definitions.filter(def => def.available);
        return { available: available.length, reserved: definitions.length - available.length,
            unlocked: available.filter(def => state(def, records).status === 'unlocked').length };
    }
    function mount({ document, apiBase, owner, currentOwner, fetch: request = root.fetch.bind(root) }) {
        const grid = document.getElementById('achievements-grid'), status = document.getElementById('achievement-sync-status');
        const filter = document.getElementById('achievement-category'), refresh = document.getElementById('achievement-refresh');
        if (!grid || !status || !filter || !refresh) return null;
        const viewAll = document.getElementById('achievement-view-all');
        let expanded = !viewAll;
        let definitions = [], records = new Map(), generation = 0, stopped = false, timer, controller;
        const element = (tag, text, className) => {
            const node = document.createElement(tag);
            if (text !== undefined) node.textContent = text;
            if (className) node.className = className;
            return node;
        };
        for (const category of ['All', ...categories]) {
            const option = element('option', category); option.value = category; filter.append(option);
        }
        function render() {
            grid.replaceChildren();
            let shown = 0;
            for (const def of definitions) {
                if (filter.value && filter.value !== 'All' && filter.value !== def.category) continue;
                if (!expanded && shown++ >= 6) break;
                const current = state(def, records);
                const card = element('article', undefined, 'achievement-item achievement-item--' + current.status);
                const icon = element('div', current.status === 'unlocked' ? '✓' : '?', 'achievement-icon');
                icon.setAttribute('aria-hidden', 'true'); card.append(icon);
                const info = element('div', undefined, 'achievement-info');
                info.append(element('div', current.status === 'unlocked' ? def.title : '???', 'achievement-info__name'));
                if (current.status === 'unlocked') info.append(element('div', def.category + (def.chapter ? ' · Chapter ' + def.chapter : ''), 'achievement-info__category'));
                info.append(element('div', current.status === 'unlocked' ? def.description : '???', 'achievement-info__desc'));
                const label = current.status === 'unavailable' ? 'Not yet available' : current.status === 'unlocked' ? 'Unlocked' :
                    current.status === 'progress' ? 'In progress' : 'Locked';
                info.append(element('span', label, 'achievement-info__badge achievement-info__badge--' + current.status));
                if (current.status === 'unlocked' && def.target > 1) {
                    const progress = element('progress'); progress.max = def.target; progress.value = current.progress;
                    progress.setAttribute('aria-label', def.title + ' progress'); info.append(progress);
                }
                card.append(info); grid.append(card);
            }
        }
        async function load() {
            if (stopped) return;
            const requestGeneration = ++generation;
            controller?.abort(); controller = new AbortController();
            refresh.disabled = true; status.textContent = 'Loading account achievements…';
            try {
                const responses = await Promise.all(['achievements/catalog', 'achievements'].map(path =>
                    request(apiBase + '/' + path, { credentials: 'include', cache: 'no-store', signal: controller.signal })));
                if (responses.some(response => !response.ok)) throw new Error('Achievement sync unavailable. Sign in again if your session expired, or retry.');
                const [catalog, snapshot] = await Promise.all(responses.map(response => response.json()));
                if (stopped || requestGeneration !== generation || currentOwner() !== owner) return;
                if (snapshot.owner !== owner) throw new Error('Account session changed.');
                definitions = validateCatalog(catalog); records = validateRecords(snapshot, definitions);
                render();
                const totals = summary(definitions, records);
                status.textContent = totals.unlocked + '/' + totals.available + ' available completed · ' + totals.reserved +
                    ' reserved · Account progress';
            } catch (error) {
                if (stopped || requestGeneration !== generation || error.name === 'AbortError') return;
                grid.replaceChildren();
                status.textContent = 'Achievement sync unavailable. Your progress has not been reset. Retry after signing in or reconnecting.';
            } finally { if (!stopped && requestGeneration === generation) refresh.disabled = false; }
        }
        const onFilter = () => render();
        const onExpand = () => { expanded = !expanded; viewAll.textContent = expanded ? 'Show fewer achievements' : 'View all achievements'; render(); };
        viewAll?.addEventListener('click', onExpand);
        const onVisible = () => { if (!document.hidden) load(); };
        filter.addEventListener('change', onFilter); refresh.addEventListener('click', load);
        document.addEventListener('visibilitychange', onVisible);
        timer = setInterval(() => { if (!document.hidden) load(); }, 60000);
        load();
        return { refresh: load, stop() { stopped = true; generation++; controller?.abort(); clearInterval(timer);
            grid.replaceChildren(); records.clear(); definitions = [];
            viewAll?.removeEventListener('click', onExpand);
            document.removeEventListener('visibilitychange', onVisible); filter.removeEventListener('change', onFilter); refresh.removeEventListener('click', load);
            status.textContent = 'Signed out.'; } };
    }
    const api = { categories, validateCatalog, validateRecords, state, summary, mount };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.StoneForgeAchievements = api;
})(typeof window !== 'undefined' ? window : globalThis);
