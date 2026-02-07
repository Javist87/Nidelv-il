(function () {
    'use strict';

    var ROWS = 30;
    var COLS = 30;
    var STORAGE_KEY = 'nidelv-il-fliser';
    var SETTINGS_KEY = 'nidelv-il-settings';
    var SESSION_KEY = 'nidelv-il-admin';
    var MAX_LOGO_SIZE = 150;

    // State
    var tiles = {};
    var settings = {};
    var currentTile = null;
    var currentLogo = null;
    var highlightedTiles = [];
    var multiSelectMode = false;
    var selectedTiles = [];

    // DOM refs
    var gridEl = document.getElementById('grid');
    var logoOverlaysEl = document.getElementById('logo-overlays');
    var modalOverlay = document.getElementById('modal-overlay');
    var modalTitle = document.getElementById('modal-title');
    var nameInput = document.getElementById('tile-name-input');
    var logoInput = document.getElementById('tile-logo-input');
    var logoPreview = document.getElementById('logo-preview');
    var removeLogoBtn = document.getElementById('remove-logo-btn');
    var saveBtn = document.getElementById('save-btn');
    var cancelBtn = document.getElementById('cancel-btn');
    var clearBtn = document.getElementById('clear-btn');
    var closeBtn = document.getElementById('close-btn');
    var soldCountEl = document.getElementById('sold-count');
    var availableCountEl = document.getElementById('available-count');
    var raisedAmountEl = document.getElementById('raised-amount');
    var progressEl = document.getElementById('progress-percent');
    var progressBarEl = document.getElementById('progress-bar');
    var searchInput = document.getElementById('search-input');
    var searchBtn = document.getElementById('search-btn');
    var exportBtn = document.getElementById('export-btn');
    var importInput = document.getElementById('import-input');
    var multiselectBtn = document.getElementById('multiselect-btn');
    var selectionBar = document.getElementById('selection-bar');
    var selectionCount = document.getElementById('selection-count');
    var assignBtn = document.getElementById('assign-btn');
    var cancelSelectBtn = document.getElementById('cancel-select-btn');
    var bgInput = document.getElementById('bg-input');
    var bgClearBtn = document.getElementById('bg-clear-btn');
    var fieldSurroundings = document.getElementById('field-surroundings');
    var sponsorGrid = document.getElementById('sponsor-grid');

    // Admin DOM
    var adminBtn = document.getElementById('admin-btn');
    var adminBadge = document.getElementById('admin-badge');
    var logoutBtn = document.getElementById('logout-btn');
    var loginOverlay = document.getElementById('login-overlay');
    var loginTitle = document.getElementById('login-title');
    var loginHint = document.getElementById('login-hint');
    var adminPassword = document.getElementById('admin-password');
    var loginSubmitBtn = document.getElementById('login-submit-btn');
    var loginCancelBtn = document.getElementById('login-cancel-btn');
    var loginCloseBtn = document.getElementById('login-close-btn');

    // Settings DOM
    var settingsBtn = document.getElementById('settings-btn');
    var settingsOverlay = document.getElementById('settings-overlay');
    var settingsCloseBtn = document.getElementById('settings-close-btn');
    var settingsSaveBtn = document.getElementById('settings-save-btn');
    var settingsCancelBtn = document.getElementById('settings-cancel-btn');
    var tilePriceInput = document.getElementById('tile-price-input');
    var newPasswordInput = document.getElementById('new-password');
    var confirmPasswordInput = document.getElementById('confirm-password');

    // ===== Helpers =====

    function tileKey(row, col) { return row + '-' + col; }

    function getTileData(key) {
        var val = tiles[key];
        if (!val) return null;
        if (typeof val === 'string') return { name: val };
        return val;
    }

    function setTileData(key, name, logo, group) {
        var data = { name: name };
        if (logo) data.logo = logo;
        if (group) data.group = group;
        tiles[key] = data;
    }

    // ===== Password hashing =====

    function hashPassword(password) {
        // Simple hash for client-side use
        var hash = 0;
        for (var i = 0; i < password.length; i++) {
            var chr = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + chr;
            hash |= 0;
        }
        // Double hash for more entropy
        var str = String(hash);
        var hash2 = 0;
        for (var j = 0; j < str.length; j++) {
            hash2 = ((hash2 << 5) - hash2) + str.charCodeAt(j);
            hash2 |= 0;
        }
        return 'h_' + Math.abs(hash) + '_' + Math.abs(hash2);
    }

    // ===== Admin =====

    function isAdmin() {
        return sessionStorage.getItem(SESSION_KEY) === 'true';
    }

    function setAdminMode(active) {
        if (active) {
            sessionStorage.setItem(SESSION_KEY, 'true');
            document.body.classList.remove('viewer');
            adminBadge.style.display = 'block';
            adminBtn.style.display = 'none';
        } else {
            sessionStorage.removeItem(SESSION_KEY);
            document.body.classList.add('viewer');
            adminBadge.style.display = 'none';
            adminBtn.style.display = 'block';
            if (multiSelectMode) exitMultiSelectMode();
        }
    }

    function openLoginModal() {
        var hasPassword = settings.adminPasswordHash;
        if (hasPassword) {
            loginTitle.textContent = 'Admin-innlogging';
            loginHint.textContent = '';
            loginHint.className = 'login-hint';
            loginSubmitBtn.textContent = 'Logg inn';
        } else {
            loginTitle.textContent = 'Opprett admin-passord';
            loginHint.textContent = 'Ingen passord er satt ennå. Velg et passord (min 4 tegn).';
            loginHint.className = 'login-hint';
            loginSubmitBtn.textContent = 'Opprett passord';
        }
        adminPassword.value = '';
        loginOverlay.classList.add('active');
        adminPassword.focus();
    }

    function closeLoginModal() {
        loginOverlay.classList.remove('active');
        adminPassword.value = '';
    }

    function handleLogin() {
        var pw = adminPassword.value;
        if (pw.length < 4) {
            loginHint.textContent = 'Passordet må ha minst 4 tegn.';
            loginHint.className = 'login-hint error';
            return;
        }

        var pwHash = hashPassword(pw);

        if (!settings.adminPasswordHash) {
            // First time - set password
            settings.adminPasswordHash = pwHash;
            saveSettings();
            setAdminMode(true);
            closeLoginModal();
        } else if (pwHash === settings.adminPasswordHash) {
            // Correct password
            setAdminMode(true);
            closeLoginModal();
        } else {
            loginHint.textContent = 'Feil passord. Prøv igjen.';
            loginHint.className = 'login-hint error';
            adminPassword.value = '';
            adminPassword.focus();
        }
    }

    // ===== Settings =====

    function openSettingsModal() {
        tilePriceInput.value = settings.tilePrice || '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        settingsOverlay.classList.add('active');
    }

    function closeSettingsModal() {
        settingsOverlay.classList.remove('active');
    }

    function saveSettingsForm() {
        var price = parseInt(tilePriceInput.value);
        if (!isNaN(price) && price >= 0) {
            settings.tilePrice = price;
        } else {
            delete settings.tilePrice;
        }

        var newPw = newPasswordInput.value;
        var confirmPw = confirmPasswordInput.value;
        if (newPw) {
            if (newPw.length < 4) {
                alert('Nytt passord må ha minst 4 tegn.');
                return;
            }
            if (newPw !== confirmPw) {
                alert('Passordene er ikke like.');
                return;
            }
            settings.adminPasswordHash = hashPassword(newPw);
        }

        saveSettings();
        updateStats();
        closeSettingsModal();
    }

    // ===== Storage =====

    function loadData() {
        try { var s = localStorage.getItem(STORAGE_KEY); if (s) tiles = JSON.parse(s); } catch (e) { tiles = {}; }
        try { var s2 = localStorage.getItem(SETTINGS_KEY); if (s2) settings = JSON.parse(s2); } catch (e) { settings = {}; }
    }

    function saveData() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tiles)); } catch (e) { console.error('Lagringsfeil:', e); }
    }

    function saveSettings() {
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { console.error('Lagringsfeil:', e); }
    }

    // ===== Image resizing =====

    function resizeImage(file, maxDim, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                if (img.width <= maxDim && img.height <= maxDim) { callback(e.target.result); return; }
                var scale = Math.min(maxDim / img.width, maxDim / img.height);
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/png', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ===== Grid =====

    function buildGrid() {
        gridEl.innerHTML = '';
        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                var tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = row;
                tile.dataset.col = col;

                var tileNum = row * COLS + col + 1;
                var numSpan = document.createElement('span');
                numSpan.className = 'tile-number';
                numSpan.textContent = tileNum;
                tile.appendChild(numSpan);

                var key = tileKey(row, col);
                var data = getTileData(key);
                if (data) {
                    tile.classList.add(data.logo || data.group ? 'sponsor' : 'sold');
                    var tooltip = document.createElement('span');
                    tooltip.className = 'tooltip';
                    tooltip.textContent = '#' + tileNum + ' — ' + data.name;
                    tile.appendChild(tooltip);
                }

                (function (r, c) {
                    tile.addEventListener('click', function () { onTileClick(r, c); });
                })(row, col);

                gridEl.appendChild(tile);
            }
        }
        renderLogoOverlays();
    }

    // ===== Logo overlays =====

    function renderLogoOverlays() {
        logoOverlaysEl.innerHTML = '';
        var groups = {};
        var singles = [];

        Object.keys(tiles).forEach(function (key) {
            var data = getTileData(key);
            if (!data || !data.logo) return;
            if (data.group) {
                if (!groups[data.group]) groups[data.group] = { logo: data.logo, keys: [] };
                groups[data.group].keys.push(key);
            } else {
                singles.push(key);
            }
        });

        Object.keys(groups).forEach(function (gid) {
            createLogoOverlay(getBounds(groups[gid].keys), groups[gid].logo);
        });
        singles.forEach(function (key) {
            createLogoOverlay(getBounds([key]), getTileData(key).logo);
        });
    }

    function getBounds(keys) {
        var minR = ROWS, maxR = 0, minC = COLS, maxC = 0;
        keys.forEach(function (k) {
            var p = k.split('-'); var r = +p[0]; var c = +p[1];
            if (r < minR) minR = r; if (r > maxR) maxR = r;
            if (c < minC) minC = c; if (c > maxC) maxC = c;
        });
        return { minRow: minR, maxRow: maxR, minCol: minC, maxCol: maxC };
    }

    function createLogoOverlay(b, src) {
        var div = document.createElement('div');
        div.className = 'logo-overlay';
        div.style.left = (b.minCol / COLS * 100) + '%';
        div.style.top = (b.minRow / ROWS * 100) + '%';
        div.style.width = ((b.maxCol - b.minCol + 1) / COLS * 100) + '%';
        div.style.height = ((b.maxRow - b.minRow + 1) / ROWS * 100) + '%';
        var img = document.createElement('img');
        img.src = src;
        img.alt = 'Logo';
        div.appendChild(img);
        logoOverlaysEl.appendChild(div);
    }

    // ===== Stats =====

    function updateStats() {
        var soldCount = Object.keys(tiles).length;
        var total = ROWS * COLS;
        var percent = Math.round((soldCount / total) * 100);
        var price = settings.tilePrice || 0;

        soldCountEl.textContent = soldCount;
        availableCountEl.textContent = total - soldCount;
        progressEl.textContent = percent + '%';
        progressBarEl.style.width = percent + '%';
        raisedAmountEl.textContent = price > 0 ? 'kr ' + (soldCount * price).toLocaleString('nb-NO') : '-';
    }

    // ===== Sponsor list =====

    function renderSponsorList() {
        sponsorGrid.innerHTML = '';
        var names = {};
        Object.keys(tiles).forEach(function (key) {
            var d = getTileData(key);
            if (!d) return;
            var p = key.split('-');
            var num = +p[0] * COLS + +p[1] + 1;
            if (!names[d.name]) names[d.name] = { count: 0, logo: d.logo || null, nums: [] };
            names[d.name].count++;
            names[d.name].nums.push(num);
        });

        var sorted = Object.keys(names).sort(function (a, b) {
            return names[b].count - names[a].count;
        });

        if (sorted.length === 0) {
            sponsorGrid.innerHTML = '<div class="sponsor-empty">Ingen sponsorer ennå - bli den første!</div>';
            return;
        }

        sorted.forEach(function (name) {
            var info = names[name];
            var card = document.createElement('div');
            card.className = 'sponsor-card';

            if (info.logo) {
                var img = document.createElement('img');
                img.src = info.logo;
                img.alt = name;
                img.className = 'sponsor-card-logo';
                card.appendChild(img);
            }

            var nameEl = document.createElement('div');
            nameEl.className = 'sponsor-card-name';
            nameEl.textContent = name;
            card.appendChild(nameEl);

            var tilesEl = document.createElement('div');
            tilesEl.className = 'sponsor-card-tiles';
            info.nums.sort(function(a, b) { return a - b; });
            var numsText = info.nums.length <= 5 ? ' (#' + info.nums.join(', #') + ')' : '';
            tilesEl.textContent = info.count + (info.count === 1 ? ' flis' : ' fliser') + numsText;
            card.appendChild(tilesEl);

            sponsorGrid.appendChild(card);
        });
    }

    // ===== Tile click =====

    function onTileClick(row, col) {
        if (!isAdmin()) return;
        if (multiSelectMode) {
            toggleTileSelection(row, col);
        } else {
            openModal(row, col);
        }
    }

    // ===== Multi-select =====

    function enterMultiSelectMode() {
        multiSelectMode = true;
        selectedTiles = [];
        multiselectBtn.classList.add('active');
        selectionBar.style.display = 'flex';
        updateSelectionCount();
    }

    function exitMultiSelectMode() {
        multiSelectMode = false;
        selectedTiles = [];
        multiselectBtn.classList.remove('active');
        selectionBar.style.display = 'none';
        var sel = gridEl.querySelectorAll('.selected');
        for (var i = 0; i < sel.length; i++) sel[i].classList.remove('selected');
    }

    function toggleTileSelection(row, col) {
        var key = tileKey(row, col);
        var idx = selectedTiles.indexOf(key);
        var el = gridEl.children[row * COLS + col];
        if (idx >= 0) { selectedTiles.splice(idx, 1); if (el) el.classList.remove('selected'); }
        else { selectedTiles.push(key); if (el) el.classList.add('selected'); }
        updateSelectionCount();
    }

    function updateSelectionCount() {
        selectionCount.textContent = selectedTiles.length + ' fliser valgt';
        assignBtn.disabled = selectedTiles.length === 0;
    }

    // ===== Modal =====

    function openModal(row, col) {
        currentTile = { keys: [tileKey(row, col)] };
        var data = getTileData(tileKey(row, col));
        var tileNum = row * COLS + col + 1;
        modalTitle.textContent = 'Flis #' + tileNum + ' (rad ' + (row + 1) + ', kolonne ' + (col + 1) + ')';
        nameInput.value = data ? data.name : '';
        currentLogo = data ? (data.logo || null) : null;
        updateLogoPreview();
        clearBtn.style.display = data ? 'block' : 'none';
        modalOverlay.classList.add('active');
        nameInput.focus();
    }

    function openMultiModal() {
        if (selectedTiles.length === 0) return;
        currentTile = { keys: selectedTiles.slice() };
        modalTitle.textContent = selectedTiles.length + ' fliser valgt (bedrift/sponsor)';
        var first = getTileData(selectedTiles[0]);
        nameInput.value = first ? first.name : '';
        currentLogo = first ? (first.logo || null) : null;
        updateLogoPreview();
        clearBtn.style.display = first ? 'block' : 'none';
        modalOverlay.classList.add('active');
        nameInput.focus();
    }

    function updateLogoPreview() {
        if (currentLogo) {
            logoPreview.innerHTML = '<img src="' + currentLogo + '" alt="Logo">';
            removeLogoBtn.style.display = 'block';
        } else {
            logoPreview.innerHTML = '<span class="logo-placeholder">Ingen logo</span>';
            removeLogoBtn.style.display = 'none';
        }
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
        currentTile = null;
        currentLogo = null;
        nameInput.value = '';
        logoInput.value = '';
    }

    function saveTile() {
        if (!currentTile) return;
        var name = nameInput.value.trim();
        var keys = currentTile.keys;
        var groupId = keys.length > 1 ? 'g-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5) : null;

        if (name) {
            keys.forEach(function (k) { setTileData(k, name, currentLogo, groupId); });
        } else {
            keys.forEach(function (k) { delete tiles[k]; });
        }

        saveData(); buildGrid(); updateStats(); renderSponsorList(); restoreHighlights(); closeModal();
        if (multiSelectMode) exitMultiSelectMode();
    }

    function clearTile() {
        if (!currentTile) return;
        var first = getTileData(currentTile.keys[0]);
        if (first && first.group) {
            var gid = first.group;
            Object.keys(tiles).forEach(function (k) { var d = getTileData(k); if (d && d.group === gid) delete tiles[k]; });
        } else {
            currentTile.keys.forEach(function (k) { delete tiles[k]; });
        }
        saveData(); buildGrid(); updateStats(); renderSponsorList(); restoreHighlights(); closeModal();
        if (multiSelectMode) exitMultiSelectMode();
    }

    // ===== Background =====

    function loadBackground() {
        if (settings.backgroundImage) {
            fieldSurroundings.style.backgroundImage = 'url(' + settings.backgroundImage + ')';
            bgClearBtn.style.display = 'inline-flex';
        }
    }

    function setBackgroundImage(file) {
        resizeImage(file, 800, function (url) {
            settings.backgroundImage = url;
            saveSettings();
            fieldSurroundings.style.backgroundImage = 'url(' + url + ')';
            bgClearBtn.style.display = 'inline-flex';
        });
    }

    function clearBackground() {
        delete settings.backgroundImage;
        saveSettings();
        fieldSurroundings.style.backgroundImage = '';
        bgClearBtn.style.display = 'none';
    }

    // ===== Search =====

    function searchTiles() {
        clearHighlights();
        var q = searchInput.value.trim().toLowerCase();
        if (!q) return;
        highlightedTiles = [];
        Object.keys(tiles).forEach(function (key) {
            var d = getTileData(key);
            if (d && d.name.toLowerCase().indexOf(q) >= 0) {
                highlightedTiles.push(key);
                var p = key.split('-');
                var el = gridEl.children[+p[0] * COLS + +p[1]];
                if (el) el.classList.add('highlight');
            }
        });
        if (highlightedTiles.length === 0) {
            alert('Ingen fliser funnet med "' + searchInput.value.trim() + '"');
        } else if (highlightedTiles.length <= 10) {
            var nums = highlightedTiles.map(function(key) {
                var p = key.split('-');
                return '#' + (+p[0] * COLS + +p[1] + 1);
            });
            alert('Funnet ' + highlightedTiles.length + ' fliser: ' + nums.join(', '));
        }
    }

    function clearHighlights() {
        var hl = gridEl.querySelectorAll('.highlight');
        for (var i = 0; i < hl.length; i++) hl[i].classList.remove('highlight');
        highlightedTiles = [];
    }

    function restoreHighlights() {
        highlightedTiles.forEach(function (key) {
            var p = key.split('-');
            var el = gridEl.children[+p[0] * COLS + +p[1]];
            if (el && tiles[key]) el.classList.add('highlight');
        });
    }

    // ===== Excel =====

    function exportToExcel() {
        var data = [];
        // Header row with column numbers
        var header = [];
        for (var h = 0; h < COLS; h++) header.push('Kol ' + (h + 1));
        data.push(header);
        for (var r = 0; r < ROWS; r++) {
            var row = [];
            for (var c = 0; c < COLS; c++) {
                var d = getTileData(tileKey(r, c));
                var num = r * COLS + c + 1;
                row.push(d ? '#' + num + ' ' + d.name : '#' + num);
            }
            data.push(row);
        }
        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [];
        for (var i = 0; i < COLS; i++) ws['!cols'].push({ wch: 14 });
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fotballbane');
        XLSX.writeFile(wb, 'nidelv-il-fliser.xlsx');
    }

    function importFromExcel(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                var json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
                var newTiles = {};
                var maxR = Math.min(json.length, ROWS);
                for (var r = 0; r < maxR; r++) {
                    if (!json[r]) continue;
                    var maxC = Math.min(json[r].length, COLS);
                    for (var c = 0; c < maxC; c++) {
                        var v = String(json[r][c] || '').trim();
                        if (v) {
                            var k = tileKey(r, c);
                            var ex = getTileData(k);
                            if (ex && ex.logo) {
                                newTiles[k] = { name: v, logo: ex.logo };
                                if (ex.group) newTiles[k].group = ex.group;
                            } else {
                                newTiles[k] = { name: v };
                            }
                        }
                    }
                }
                tiles = newTiles;
                saveData(); buildGrid(); updateStats(); renderSponsorList(); clearHighlights();
                alert('Importert! ' + Object.keys(tiles).length + ' fliser lastet inn.');
            } catch (err) {
                alert('Kunne ikke lese filen.');
                console.error(err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ===== Event listeners =====

    // Tile modal
    saveBtn.addEventListener('click', saveTile);
    cancelBtn.addEventListener('click', closeModal);
    clearBtn.addEventListener('click', clearTile);
    closeBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', function (e) { if (e.target === modalOverlay) closeModal(); });
    nameInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') saveTile(); if (e.key === 'Escape') closeModal(); });

    logoInput.addEventListener('change', function (e) {
        var f = e.target.files[0];
        if (!f) return;
        resizeImage(f, MAX_LOGO_SIZE, function (url) { currentLogo = url; updateLogoPreview(); });
        logoInput.value = '';
    });
    removeLogoBtn.addEventListener('click', function () { currentLogo = null; updateLogoPreview(); });

    // Multi-select
    multiselectBtn.addEventListener('click', function () { multiSelectMode ? exitMultiSelectMode() : enterMultiSelectMode(); });
    assignBtn.addEventListener('click', openMultiModal);
    cancelSelectBtn.addEventListener('click', exitMultiSelectMode);

    // Background
    bgInput.addEventListener('change', function (e) { var f = e.target.files[0]; if (f) { setBackgroundImage(f); bgInput.value = ''; } });
    bgClearBtn.addEventListener('click', clearBackground);

    // Excel
    exportBtn.addEventListener('click', exportToExcel);
    importInput.addEventListener('change', function (e) { var f = e.target.files[0]; if (f) { importFromExcel(f); importInput.value = ''; } });

    // Search
    searchBtn.addEventListener('click', searchTiles);
    searchInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') searchTiles(); });
    searchInput.addEventListener('input', function () { if (!searchInput.value.trim()) clearHighlights(); });

    // Admin login
    adminBtn.addEventListener('click', openLoginModal);
    loginSubmitBtn.addEventListener('click', handleLogin);
    loginCancelBtn.addEventListener('click', closeLoginModal);
    loginCloseBtn.addEventListener('click', closeLoginModal);
    loginOverlay.addEventListener('click', function (e) { if (e.target === loginOverlay) closeLoginModal(); });
    adminPassword.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleLogin(); if (e.key === 'Escape') closeLoginModal(); });
    logoutBtn.addEventListener('click', function () { setAdminMode(false); });

    // Settings
    settingsBtn.addEventListener('click', openSettingsModal);
    settingsSaveBtn.addEventListener('click', saveSettingsForm);
    settingsCancelBtn.addEventListener('click', closeSettingsModal);
    settingsCloseBtn.addEventListener('click', closeSettingsModal);
    settingsOverlay.addEventListener('click', function (e) { if (e.target === settingsOverlay) closeSettingsModal(); });

    // Global keyboard
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (modalOverlay.classList.contains('active')) closeModal();
            else if (loginOverlay.classList.contains('active')) closeLoginModal();
            else if (settingsOverlay.classList.contains('active')) closeSettingsModal();
            else if (multiSelectMode) exitMultiSelectMode();
        }
    });

    // ===== Init =====

    loadData();
    if (isAdmin()) setAdminMode(true);
    else setAdminMode(false);
    buildGrid();
    updateStats();
    renderSponsorList();
    loadBackground();
})();
