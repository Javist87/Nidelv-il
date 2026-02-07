(function () {
    'use strict';

    var ROWS = 30;
    var COLS = 30;
    var STORAGE_KEY = 'nidelv-il-fliser';
    var SETTINGS_KEY = 'nidelv-il-settings';
    var MAX_LOGO_SIZE = 150; // Max logo dimension in pixels for storage

    // State
    var tiles = {};
    var settings = {};
    var currentTile = null;
    var currentLogo = null; // base64 string for the logo being edited
    var highlightedTiles = [];
    var multiSelectMode = false;
    var selectedTiles = [];

    // DOM elements
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
    var progressEl = document.getElementById('progress-percent');
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

    // ===== Data helpers =====

    function tileKey(row, col) {
        return row + '-' + col;
    }

    // Get tile data as object (handles migration from old string format)
    function getTileData(key) {
        var val = tiles[key];
        if (!val) return null;
        if (typeof val === 'string') {
            return { name: val };
        }
        return val;
    }

    // Set tile data
    function setTileData(key, name, logo, group) {
        var data = { name: name };
        if (logo) data.logo = logo;
        if (group) data.group = group;
        tiles[key] = data;
    }

    // ===== localStorage =====

    function loadData() {
        try {
            var saved = localStorage.getItem(STORAGE_KEY);
            if (saved) tiles = JSON.parse(saved);
        } catch (e) {
            tiles = {};
        }
        try {
            var s = localStorage.getItem(SETTINGS_KEY);
            if (s) settings = JSON.parse(s);
        } catch (e) {
            settings = {};
        }
    }

    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
        } catch (e) {
            console.error('Kunne ikke lagre flisdata:', e);
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Kunne ikke lagre innstillinger:', e);
        }
    }

    // ===== Image resizing =====

    function resizeImage(file, maxDim, callback) {
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var w = img.width;
                var h = img.height;
                if (w <= maxDim && h <= maxDim) {
                    callback(e.target.result);
                    return;
                }
                var scale = Math.min(maxDim / w, maxDim / h);
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(w * scale);
                canvas.height = Math.round(h * scale);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/png', 0.8));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // ===== Grid building =====

    function buildGrid() {
        gridEl.innerHTML = '';
        for (var row = 0; row < ROWS; row++) {
            for (var col = 0; col < COLS; col++) {
                var tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = row;
                tile.dataset.col = col;

                var key = tileKey(row, col);
                var data = getTileData(key);
                if (data) {
                    if (data.logo || data.group) {
                        tile.classList.add('sponsor');
                    } else {
                        tile.classList.add('sold');
                    }
                    var tooltip = document.createElement('span');
                    tooltip.className = 'tooltip';
                    tooltip.textContent = data.name;
                    tile.appendChild(tooltip);
                }

                (function (r, c) {
                    tile.addEventListener('click', function () {
                        onTileClick(r, c);
                    });
                })(row, col);

                gridEl.appendChild(tile);
            }
        }
        renderLogoOverlays();
    }

    // ===== Logo overlays =====

    function renderLogoOverlays() {
        logoOverlaysEl.innerHTML = '';

        // Collect groups and single tiles with logos
        var groups = {};
        var singles = [];

        Object.keys(tiles).forEach(function (key) {
            var data = getTileData(key);
            if (!data || !data.logo) return;

            if (data.group) {
                if (!groups[data.group]) {
                    groups[data.group] = { logo: data.logo, keys: [] };
                }
                groups[data.group].keys.push(key);
            } else {
                singles.push(key);
            }
        });

        // Render group logos (spanning bounding box)
        Object.keys(groups).forEach(function (groupId) {
            var group = groups[groupId];
            var bounds = getBounds(group.keys);
            createLogoOverlay(bounds, group.logo);
        });

        // Render single tile logos
        singles.forEach(function (key) {
            var data = getTileData(key);
            var bounds = getBounds([key]);
            createLogoOverlay(bounds, data.logo);
        });
    }

    function getBounds(keys) {
        var minRow = ROWS, maxRow = 0, minCol = COLS, maxCol = 0;
        keys.forEach(function (key) {
            var parts = key.split('-');
            var r = parseInt(parts[0]);
            var c = parseInt(parts[1]);
            if (r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
        });
        return { minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol };
    }

    function createLogoOverlay(bounds, logoSrc) {
        var div = document.createElement('div');
        div.className = 'logo-overlay';

        var left = (bounds.minCol / COLS) * 100;
        var top = (bounds.minRow / ROWS) * 100;
        var width = ((bounds.maxCol - bounds.minCol + 1) / COLS) * 100;
        var height = ((bounds.maxRow - bounds.minRow + 1) / ROWS) * 100;

        div.style.left = left + '%';
        div.style.top = top + '%';
        div.style.width = width + '%';
        div.style.height = height + '%';

        var img = document.createElement('img');
        img.src = logoSrc;
        img.alt = 'Sponsor logo';
        div.appendChild(img);

        logoOverlaysEl.appendChild(div);
    }

    // ===== Statistics =====

    function updateStats() {
        var soldCount = Object.keys(tiles).length;
        var total = ROWS * COLS;
        var availableCount = total - soldCount;
        var percent = Math.round((soldCount / total) * 100);

        soldCountEl.textContent = soldCount;
        availableCountEl.textContent = availableCount;
        progressEl.textContent = percent + '%';
    }

    // ===== Tile click handling =====

    function onTileClick(row, col) {
        if (multiSelectMode) {
            toggleTileSelection(row, col);
        } else {
            openModal(row, col);
        }
    }

    // ===== Multi-select mode =====

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

        // Remove selection styling
        var selected = gridEl.querySelectorAll('.selected');
        for (var i = 0; i < selected.length; i++) {
            selected[i].classList.remove('selected');
        }
    }

    function toggleTileSelection(row, col) {
        var key = tileKey(row, col);
        var idx = selectedTiles.indexOf(key);
        var tileIndex = row * COLS + col;
        var tileEl = gridEl.children[tileIndex];

        if (idx >= 0) {
            selectedTiles.splice(idx, 1);
            if (tileEl) tileEl.classList.remove('selected');
        } else {
            selectedTiles.push(key);
            if (tileEl) tileEl.classList.add('selected');
        }
        updateSelectionCount();
    }

    function updateSelectionCount() {
        selectionCount.textContent = selectedTiles.length + ' fliser valgt';
        assignBtn.disabled = selectedTiles.length === 0;
    }

    // ===== Modal =====

    function openModal(row, col) {
        currentTile = { row: row, col: col, keys: [tileKey(row, col)] };
        var key = tileKey(row, col);
        var data = getTileData(key);

        modalTitle.textContent = 'Flis (rad ' + (row + 1) + ', kolonne ' + (col + 1) + ')';
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

        // Check if all selected tiles already have the same data
        var firstData = getTileData(selectedTiles[0]);
        nameInput.value = firstData ? firstData.name : '';
        currentLogo = firstData ? (firstData.logo || null) : null;
        updateLogoPreview();

        clearBtn.style.display = firstData ? 'block' : 'none';
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
        updateLogoPreview();
    }

    function saveTile() {
        if (!currentTile) return;

        var name = nameInput.value.trim();
        var keys = currentTile.keys;
        var groupId = null;

        // Generate group ID if multiple tiles
        if (keys.length > 1) {
            groupId = 'g-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
        }

        if (name) {
            keys.forEach(function (key) {
                setTileData(key, name, currentLogo, groupId);
            });
        } else {
            // No name = remove tiles
            keys.forEach(function (key) {
                delete tiles[key];
            });
        }

        saveData();
        buildGrid();
        updateStats();
        restoreHighlights();
        closeModal();

        if (multiSelectMode) {
            exitMultiSelectMode();
        }
    }

    function clearTile() {
        if (!currentTile) return;

        var keys = currentTile.keys;

        // If tile belongs to a group, clear all tiles in the group
        var firstData = getTileData(keys[0]);
        if (firstData && firstData.group) {
            var groupId = firstData.group;
            Object.keys(tiles).forEach(function (key) {
                var d = getTileData(key);
                if (d && d.group === groupId) {
                    delete tiles[key];
                }
            });
        } else {
            keys.forEach(function (key) {
                delete tiles[key];
            });
        }

        saveData();
        buildGrid();
        updateStats();
        restoreHighlights();
        closeModal();

        if (multiSelectMode) {
            exitMultiSelectMode();
        }
    }

    // ===== Background image =====

    function loadBackground() {
        if (settings.backgroundImage) {
            fieldSurroundings.style.backgroundImage = 'url(' + settings.backgroundImage + ')';
            bgClearBtn.style.display = 'inline-flex';
        }
    }

    function setBackgroundImage(file) {
        // Resize for background - allow larger (800px)
        resizeImage(file, 800, function (dataUrl) {
            settings.backgroundImage = dataUrl;
            saveSettings();
            fieldSurroundings.style.backgroundImage = 'url(' + dataUrl + ')';
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

        var query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        highlightedTiles = [];

        Object.keys(tiles).forEach(function (key) {
            var data = getTileData(key);
            if (data && data.name.toLowerCase().indexOf(query) >= 0) {
                highlightedTiles.push(key);
                var parts = key.split('-');
                var row = parseInt(parts[0]);
                var col = parseInt(parts[1]);
                var index = row * COLS + col;
                var tileEl = gridEl.children[index];
                if (tileEl) {
                    tileEl.classList.add('highlight');
                }
            }
        });

        if (highlightedTiles.length === 0) {
            alert('Ingen fliser funnet med navnet "' + searchInput.value.trim() + '"');
        }
    }

    function clearHighlights() {
        var highlighted = gridEl.querySelectorAll('.highlight');
        for (var i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('highlight');
        }
        highlightedTiles = [];
    }

    function restoreHighlights() {
        highlightedTiles.forEach(function (key) {
            var parts = key.split('-');
            var row = parseInt(parts[0]);
            var col = parseInt(parts[1]);
            var index = row * COLS + col;
            var tileEl = gridEl.children[index];
            if (tileEl && tiles[key]) {
                tileEl.classList.add('highlight');
            }
        });
    }

    // ===== Excel =====

    function exportToExcel() {
        var data = [];
        for (var row = 0; row < ROWS; row++) {
            var rowData = [];
            for (var col = 0; col < COLS; col++) {
                var key = tileKey(row, col);
                var d = getTileData(key);
                rowData.push(d ? d.name : '');
            }
            data.push(rowData);
        }

        var ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [];
        for (var c = 0; c < COLS; c++) {
            ws['!cols'].push({ wch: 14 });
        }

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fotballbane');
        XLSX.writeFile(wb, 'nidelv-il-fliser.xlsx');
    }

    function importFromExcel(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var wb = XLSX.read(data, { type: 'array' });
                var ws = wb.Sheets[wb.SheetNames[0]];
                var jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                // Preserve tiles with logos/groups, update names from Excel
                var newTiles = {};
                var maxRows = Math.min(jsonData.length, ROWS);
                for (var row = 0; row < maxRows; row++) {
                    var rowData = jsonData[row];
                    if (!rowData) continue;
                    var maxCols = Math.min(rowData.length, COLS);
                    for (var col = 0; col < maxCols; col++) {
                        var value = String(rowData[col] || '').trim();
                        if (value) {
                            var key = tileKey(row, col);
                            var existing = getTileData(key);
                            if (existing && existing.logo) {
                                // Keep logo and group, update name
                                newTiles[key] = { name: value, logo: existing.logo };
                                if (existing.group) newTiles[key].group = existing.group;
                            } else {
                                newTiles[key] = { name: value };
                            }
                        }
                    }
                }

                tiles = newTiles;
                saveData();
                buildGrid();
                updateStats();
                clearHighlights();

                alert('Importert! ' + Object.keys(tiles).length + ' fliser med navn ble lastet inn.');
            } catch (err) {
                alert('Kunne ikke lese filen. Sjekk at det er en gyldig Excel-fil (.xlsx).');
                console.error('Import error:', err);
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ===== Event listeners =====

    saveBtn.addEventListener('click', saveTile);
    cancelBtn.addEventListener('click', closeModal);
    clearBtn.addEventListener('click', clearTile);
    closeBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) closeModal();
    });

    nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') saveTile();
        if (e.key === 'Escape') closeModal();
    });

    // Logo upload in modal
    logoInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        resizeImage(file, MAX_LOGO_SIZE, function (dataUrl) {
            currentLogo = dataUrl;
            updateLogoPreview();
        });
        logoInput.value = '';
    });

    removeLogoBtn.addEventListener('click', function () {
        currentLogo = null;
        updateLogoPreview();
    });

    // Multi-select
    multiselectBtn.addEventListener('click', function () {
        if (multiSelectMode) {
            exitMultiSelectMode();
        } else {
            enterMultiSelectMode();
        }
    });

    assignBtn.addEventListener('click', function () {
        openMultiModal();
    });

    cancelSelectBtn.addEventListener('click', function () {
        exitMultiSelectMode();
    });

    // Background image
    bgInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (file) {
            setBackgroundImage(file);
            bgInput.value = '';
        }
    });

    bgClearBtn.addEventListener('click', clearBackground);

    // Excel
    exportBtn.addEventListener('click', exportToExcel);

    importInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (file) {
            importFromExcel(file);
            importInput.value = '';
        }
    });

    // Search
    searchBtn.addEventListener('click', searchTiles);

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') searchTiles();
    });

    searchInput.addEventListener('input', function () {
        if (!searchInput.value.trim()) clearHighlights();
    });

    // Global keyboard
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            if (modalOverlay.classList.contains('active')) {
                closeModal();
            } else if (multiSelectMode) {
                exitMultiSelectMode();
            }
        }
    });

    // ===== Initialize =====

    loadData();
    buildGrid();
    updateStats();
    loadBackground();
})();
