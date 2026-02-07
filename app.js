(function () {
    'use strict';

    const ROWS = 30;
    const COLS = 30;
    const STORAGE_KEY = 'nidelv-il-fliser';

    // State
    let tiles = {};
    let currentTile = null;
    let highlightedTiles = [];

    // DOM elements
    const gridEl = document.getElementById('grid');
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const nameInput = document.getElementById('tile-name-input');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const clearBtn = document.getElementById('clear-btn');
    const closeBtn = document.getElementById('close-btn');
    const soldCountEl = document.getElementById('sold-count');
    const availableCountEl = document.getElementById('available-count');
    const progressEl = document.getElementById('progress-percent');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const exportBtn = document.getElementById('export-btn');
    const importInput = document.getElementById('import-input');

    // Load data from localStorage
    function loadData() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                tiles = JSON.parse(saved);
            }
        } catch (e) {
            tiles = {};
        }
    }

    // Save data to localStorage
    function saveData() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tiles));
        } catch (e) {
            console.error('Kunne ikke lagre data:', e);
        }
    }

    // Get tile key from row and column
    function tileKey(row, col) {
        return row + '-' + col;
    }

    // Build the 30x30 grid
    function buildGrid() {
        gridEl.innerHTML = '';
        for (let row = 0; row < ROWS; row++) {
            for (let col = 0; col < COLS; col++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.dataset.row = row;
                tile.dataset.col = col;

                const key = tileKey(row, col);
                if (tiles[key]) {
                    tile.classList.add('sold');
                    const tooltip = document.createElement('span');
                    tooltip.className = 'tooltip';
                    tooltip.textContent = tiles[key];
                    tile.appendChild(tooltip);
                }

                tile.addEventListener('click', function () {
                    openModal(row, col);
                });

                gridEl.appendChild(tile);
            }
        }
    }

    // Update statistics display
    function updateStats() {
        const soldCount = Object.keys(tiles).length;
        const total = ROWS * COLS;
        const availableCount = total - soldCount;
        const percent = Math.round((soldCount / total) * 100);

        soldCountEl.textContent = soldCount;
        availableCountEl.textContent = availableCount;
        progressEl.textContent = percent + '%';
    }

    // Open the modal for a specific tile
    function openModal(row, col) {
        currentTile = { row: row, col: col };
        const key = tileKey(row, col);
        const existingName = tiles[key] || '';

        modalTitle.textContent = 'Flis (rad ' + (row + 1) + ', kolonne ' + (col + 1) + ')';
        nameInput.value = existingName;
        clearBtn.style.display = existingName ? 'block' : 'none';

        modalOverlay.classList.add('active');
        nameInput.focus();
    }

    // Close the modal
    function closeModal() {
        modalOverlay.classList.remove('active');
        currentTile = null;
        nameInput.value = '';
    }

    // Save the tile name
    function saveTile() {
        if (!currentTile) return;

        const name = nameInput.value.trim();
        const key = tileKey(currentTile.row, currentTile.col);

        if (name) {
            tiles[key] = name;
        } else {
            delete tiles[key];
        }

        saveData();
        buildGrid();
        updateStats();
        restoreHighlights();
        closeModal();
    }

    // Clear the tile name
    function clearTile() {
        if (!currentTile) return;

        const key = tileKey(currentTile.row, currentTile.col);
        delete tiles[key];

        saveData();
        buildGrid();
        updateStats();
        restoreHighlights();
        closeModal();
    }

    // Search for a name and highlight matching tiles
    function searchTiles() {
        clearHighlights();

        const query = searchInput.value.trim().toLowerCase();
        if (!query) return;

        highlightedTiles = [];

        Object.keys(tiles).forEach(function (key) {
            if (tiles[key].toLowerCase().includes(query)) {
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

    // Clear search highlights
    function clearHighlights() {
        var highlighted = gridEl.querySelectorAll('.highlight');
        for (var i = 0; i < highlighted.length; i++) {
            highlighted[i].classList.remove('highlight');
        }
        highlightedTiles = [];
    }

    // Restore highlights after grid rebuild
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

    // Export tile data to an Excel file (30x30 grid)
    function exportToExcel() {
        var data = [];
        for (var row = 0; row < ROWS; row++) {
            var rowData = [];
            for (var col = 0; col < COLS; col++) {
                var key = tileKey(row, col);
                rowData.push(tiles[key] || '');
            }
            data.push(rowData);
        }

        var ws = XLSX.utils.aoa_to_sheet(data);

        // Set column widths
        ws['!cols'] = [];
        for (var c = 0; c < COLS; c++) {
            ws['!cols'].push({ wch: 14 });
        }

        // Style sold cells with a fill color using cell comments as indicators
        for (var r = 0; r < ROWS; r++) {
            for (var ci = 0; ci < COLS; ci++) {
                var cellKey = tileKey(r, ci);
                if (tiles[cellKey]) {
                    var cellRef = XLSX.utils.encode_cell({ r: r, c: ci });
                    if (ws[cellRef]) {
                        ws[cellRef].s = {
                            fill: { fgColor: { rgb: 'FFE6A817' } },
                            font: { bold: true }
                        };
                    }
                }
            }
        }

        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fotballbane');
        XLSX.writeFile(wb, 'nidelv-il-fliser.xlsx');
    }

    // Import tile data from an Excel file
    function importFromExcel(file) {
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var data = new Uint8Array(e.target.result);
                var wb = XLSX.read(data, { type: 'array' });
                var ws = wb.Sheets[wb.SheetNames[0]];
                var jsonData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                // Clear existing tiles
                tiles = {};

                // Read up to 30 rows x 30 cols from the sheet
                var maxRows = Math.min(jsonData.length, ROWS);
                for (var row = 0; row < maxRows; row++) {
                    var rowData = jsonData[row];
                    if (!rowData) continue;
                    var maxCols = Math.min(rowData.length, COLS);
                    for (var col = 0; col < maxCols; col++) {
                        var value = String(rowData[col] || '').trim();
                        if (value) {
                            tiles[tileKey(row, col)] = value;
                        }
                    }
                }

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

    // Event listeners
    saveBtn.addEventListener('click', saveTile);
    cancelBtn.addEventListener('click', closeModal);
    clearBtn.addEventListener('click', clearTile);
    closeBtn.addEventListener('click', closeModal);

    modalOverlay.addEventListener('click', function (e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    nameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            saveTile();
        }
        if (e.key === 'Escape') {
            closeModal();
        }
    });

    exportBtn.addEventListener('click', exportToExcel);

    importInput.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (file) {
            importFromExcel(file);
            importInput.value = '';
        }
    });

    searchBtn.addEventListener('click', searchTiles);

    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            searchTiles();
        }
    });

    searchInput.addEventListener('input', function () {
        if (!searchInput.value.trim()) {
            clearHighlights();
        }
    });

    // Keyboard shortcut to close modal
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            closeModal();
        }
    });

    // Initialize
    loadData();
    buildGrid();
    updateStats();
})();
