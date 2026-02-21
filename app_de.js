// Configuration
const DATA_URL = 'cdf_efk_data.json';
const EXCEL_URL = 'Objets_parlementaires_CDF_EFK.xlsx';
const INITIAL_ITEMS = 10;
const ITEMS_PER_LOAD = 10;

// State
let allData = [];
let filteredData = [];
let displayedCount = 0;
let newIds = []; // IDs der echten neuen Objekte

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearButton = document.getElementById('clearSearch');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');
const downloadBtn = document.getElementById('downloadBtn');
const resetFiltersBtn = document.getElementById('resetFilters');
const showNewUpdatesBtn = document.getElementById('showNewUpdates');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    showLoading();
    try {
        const response = await fetch(DATA_URL);
        const json = await response.json();
        allData = json.items || [];
        newIds = json.meta?.new_ids || [];
        
        // Display last update
        if (json.meta && json.meta.updated) {
            const date = new Date(json.meta.updated);
            lastUpdate.textContent = `Aktualisiert: ${date.toLocaleDateString('de-CH')}`;
        }
        
        // Display session summary if available
        displaySessionSummary(json.session_summary);
        
        // Populate year, party and department filters
        populateYearFilter();
        populatePartyFilter();
        populateDepartmentFilter();
        
        // Initialize dropdown filters
        initDropdownFilters();
        
        // Check for search parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
        // Check for filter parameters from stats page
        const filterParty = urlParams.get('filter_party');
        const filterType = urlParams.get('filter_type');
        const filterYear = urlParams.get('filter_year');
        const filterSession = urlParams.get('filter_session');
        
        if (filterParty) {
            applyFilterFromUrl('partyDropdown', filterParty);
        }
        if (filterType) {
            applyFilterFromUrl('typeDropdown', filterType);
        }
        if (filterYear) {
            applyFilterFromUrl('yearDropdown', filterYear);
        }
        
        // Store session filter for use in applyFilters
        window.sessionFilter = filterSession || null;
        
        // Initial display
        filteredData = [...allData];
        applyFilters();
        
        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Fehler beim Laden der Daten');
    }
}

function displaySessionSummary(summary) {
    if (!summary) return;
    
    // Check if we should display the summary (before next session starts)
    const today = new Date();
    const displayUntil = summary.display_until ? new Date(summary.display_until) : null;
    
    if (displayUntil && today >= displayUntil) {
        return; // Don't display after next session starts
    }
    
    const container = document.getElementById('sessionSummary');
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    const listEl = document.getElementById('summaryInterventions');
    
    if (!container || !titleEl || !textEl || !listEl) return;
    
    titleEl.textContent = summary.title_de;
    textEl.innerHTML = summary.text_de + (summary.themes_de ? '<br><br><strong>Themen:</strong> ' + escapeHtml(summary.themes_de) : '');
    
    // Build interventions list
    if (summary.interventions && summary.interventions.shortId) {
        const items = summary.interventions.shortId.map((id, i) => {
            const title = summary.interventions.title_de[i] || '';
            const author = summary.interventions.author[i] || '';
            const party = translateParty(summary.interventions.party[i] || '');
            const type = summary.interventions.type[i] || '';
            const url = summary.interventions.url_de[i] || '#';
            const authorWithParty = party ? `${author} (${party})` : author;
            return `<li><a href="${url}" target="_blank">${id}</a> – ${type} – ${escapeHtml(title.substring(0, 60))}${title.length > 60 ? '...' : ''} – <em>${escapeHtml(authorWithParty)}</em></li>`;
        });
        listEl.innerHTML = items.join('');
    }
    
    container.style.display = 'block';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function translateParty(party) {
    const translations = {
        'VERT-E-S': 'GRÜNE',
        'Les Vert-e-s': 'GRÜNE',
        'Al': 'GRÜNE',
        'pvl': 'GLP',
        'PVL': 'GLP',
        'Vert\'libéraux': 'GLP',
        'PS': 'SP',
        'PSS': 'SP',
        'PLR': 'FDP',
        'UDC': 'SVP',
        'Le Centre': 'Die Mitte',
        'Centre': 'Mitte',
        'M-E': 'Die Mitte'
    };
    return translations[party] || party;
}

function getPartyFromAuthor(author) {
    if (!author) return null;
    if (author.includes('FDP') || author.includes('PLR')) return 'PLR';
    if (author.includes('Grünliberale') || author.includes('Vert\'libéra')) return 'pvl';
    if (author.includes('SVP') || author.includes('UDC')) return 'UDC';
    if (author.includes('SP ') || author.includes('PS ') || author.includes('socialiste')) return 'PSS';
    if (author.includes('Grüne') || author.includes('Verts') || author.includes('VERT')) return 'VERT-E-S';
    if (author.includes('Mitte') || author.includes('Centre')) return 'Le Centre';
    return null;
}

function translateAuthor(author) {
    const translations = {
        'Commission des finances Conseil national': 'Finanzkommission Nationalrat',
        'Commission des finances Conseil des États': 'Finanzkommission Ständerat',
        'Commission de l\'économie et des redevances Conseil national': 'Kommission für Wirtschaft und Abgaben Nationalrat',
        'Commission de l\'économie et des redevances Conseil des États': 'Kommission für Wirtschaft und Abgaben Ständerat',
        'Commission de la sécurité sociale et de la santé publique Conseil national': 'Kommission für soziale Sicherheit und Gesundheit Nationalrat',
        'Commission de la sécurité sociale et de la santé publique Conseil des États': 'Kommission für soziale Sicherheit und Gesundheit Ständerat',
        'Commission des transports et des télécommunications Conseil national': 'Kommission für Verkehr und Fernmeldewesen Nationalrat',
        'Commission des transports et des télécommunications Conseil des États': 'Kommission für Verkehr und Fernmeldewesen Ständerat',
        'Commission de la politique de sécurité Conseil national': 'Sicherheitspolitische Kommission Nationalrat',
        'Commission de la politique de sécurité Conseil des États': 'Sicherheitspolitische Kommission Ständerat',
        'Commission des institutions politiques Conseil national': 'Staatspolitische Kommission Nationalrat',
        'Commission des institutions politiques Conseil des États': 'Staatspolitische Kommission Ständerat',
        'Commission de gestion Conseil national': 'Geschäftsprüfungskommission Nationalrat',
        'Commission de gestion Conseil des États': 'Geschäftsprüfungskommission Ständerat',
        'Commission de l\'environnement, de l\'aménagement du territoire et de l\'énergie Conseil national': 'Kommission für Umwelt, Raumplanung und Energie Nationalrat',
        'Commission de l\'environnement, de l\'aménagement du territoire et de l\'énergie Conseil des États': 'Kommission für Umwelt, Raumplanung und Energie Ständerat'
    };
    return translations[author] || author;
}

function updateLangSwitcherLinks() {
    const searchValue = searchInput.value.trim();
    const langLinks = document.querySelectorAll('.lang-switcher a');
    langLinks.forEach(link => {
        const href = link.getAttribute('href').split('?')[0];
        if (searchValue) {
            link.setAttribute('href', `${href}?search=${encodeURIComponent(searchValue)}`);
        } else {
            link.setAttribute('href', href);
        }
    });
}

function setupEventListeners() {
    searchInput.addEventListener('input', () => {
        debounce(applyFilters, 300)();
        updateLangSwitcherLinks();
    });
    clearButton.addEventListener('click', clearSearch);
    
    // Download Excel button
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadFilteredData);
    }
    
    // Update lang switcher on load
    updateLangSwitcherLinks();
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchInput.value) {
            clearSearch();
        }
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });
}

function populateYearFilter() {
    const yearMenu = document.getElementById('yearMenu');
    const years = [...new Set(allData.map(item => item.date?.substring(0, 4)).filter(Boolean))];
    years.sort((a, b) => b - a);
    
    // Add "Alle" option (checked by default)
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    yearMenu.appendChild(allLabel);
    
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
}

function populatePartyFilter() {
    const partyMenu = document.getElementById('partyMenu');
    const translatedParties = [...new Set(allData.map(item => translateParty(item.party)).filter(Boolean))];
    translatedParties.sort((a, b) => a.localeCompare(b, 'de'));
    
    // Add "Alle" option (checked by default)
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    partyMenu.appendChild(allLabel);
    
    translatedParties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
}

function populateDepartmentFilter() {
    const deptMenu = document.getElementById('departmentMenu');
    if (!deptMenu) return;
    
    const departments = [...new Set(allData.map(item => item.department).filter(Boolean))];
    departments.sort((a, b) => a.localeCompare(b, 'de'));
    
    // Add "Alle" option (checked by default)
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    deptMenu.appendChild(allLabel);
    
    departments.forEach(dept => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${dept}"> ${dept}`;
        deptMenu.appendChild(label);
    });
}

function getCheckedValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return [];
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked:not([data-select-all])');
    return Array.from(checkboxes).map(cb => cb.value).filter(v => v);
}

function updateFilterCount(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    const countSpan = dropdown.querySelector('.filter-count');
    if (!countSpan) return;
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all]):checked');
    
    if (checkboxes.length > 0) {
        countSpan.textContent = `(${checkboxes.length})`;
    } else {
        countSpan.textContent = '';
    }
}

function initDropdownFilters() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.filter-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdowns.forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });
        
        // Handle checkbox changes
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const isSelectAll = e.target.hasAttribute('data-select-all');
                if (isSelectAll && e.target.checked) {
                    dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])').forEach(other => {
                        other.checked = false;
                    });
                } else if (!isSelectAll && e.target.checked) {
                    const selectAll = dropdown.querySelector('input[data-select-all]');
                    if (selectAll) selectAll.checked = false;
                }
                updateFilterCount(dropdown.id);
                applyFilters();
            });
        });
    });
    
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });
    
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.addEventListener('click', e => e.stopPropagation());
    });
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetAllFilters);
    }
    
    // Show new updates button
    if (showNewUpdatesBtn) {
        showNewUpdatesBtn.addEventListener('click', toggleNewUpdatesFilter);
    }
}

function toggleNewUpdatesFilter() {
    window.newUpdatesFilter = !window.newUpdatesFilter;
    
    if (window.newUpdatesFilter) {
        showNewUpdatesBtn.classList.add('active');
    } else {
        showNewUpdatesBtn.classList.remove('active');
    }
    
    applyFilters();
}

function resetAllFilters() {
    document.querySelectorAll('.filter-dropdown input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
    });
    // Recheck "Alle" by default
    document.querySelectorAll('.filter-dropdown input[data-select-all]').forEach(cb => {
        cb.checked = true;
    });
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        updateFilterCount(dropdown.id);
    });
    searchInput.value = '';
    
    // Clear session filter
    window.sessionFilter = null;
    
    // Clear new updates filter
    window.newUpdatesFilter = false;
    if (showNewUpdatesBtn) {
        showNewUpdatesBtn.classList.remove('active');
    }
    
    // Clear URL parameters
    if (window.history.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    applyFilters();
}

function applyFilterFromUrl(dropdownId, filterValue) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Uncheck "Alle"
    const selectAll = dropdown.querySelector('input[data-select-all]');
    if (selectAll) selectAll.checked = false;
    
    // Check the matching checkbox
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    checkboxes.forEach(cb => {
        if (cb.value === filterValue) {
            cb.checked = true;
        }
    });
    
    updateFilterCount(dropdownId);
}

function getLegislature(date) {
    if (!date) return null;
    // 52. Legislatur: ab Dezember 2023 (Wintersession 2023)
    // 51. Legislatur: Dezember 2019 - September 2023
    if (date >= '2023-12-01') return '52';
    if (date >= '2019-12-01') return '51';
    return null;
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValues = getCheckedValues('typeDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const yearValues = getCheckedValues('yearDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    const departmentValues = getCheckedValues('departmentDropdown');
    const legislatureValues = getCheckedValues('legislatureDropdown');
    
    filteredData = allData.filter(item => {
        // Text search avec word boundaries
        if (searchTerm) {
            const searchFields = [
                item.shortId,
                item.title,
                item.title_de,
                item.author,
                item.type,
                item.status,
                item.text,
                item.text_de
            ].filter(Boolean).join(' ');
            
            if (!searchWholeWord(searchFields, searchTerm)) {
                return false;
            }
        }
        
        // Type filter (multiple)
        if (typeValues.length > 0 && !typeValues.includes(item.type)) {
            return false;
        }
        
        // Council filter (multiple)
        if (councilValues.length > 0 && !councilValues.includes(item.council)) {
            return false;
        }
        
        // Year filter (multiple)
        if (yearValues.length > 0) {
            const itemYear = item.date?.substring(0, 4);
            if (!yearValues.includes(itemYear)) {
                return false;
            }
        }
        
        // Session filter (from URL)
        if (window.sessionFilter && item.date) {
            const month = parseInt(item.date.substring(5, 7));
            const sessionMonths = {
                'printemps': [3],
                'speciale': [4, 5],
                'ete': [6],
                'automne': [9, 10],
                'hiver': [12],
                'autre': [1, 2, 7, 8, 11]
            };
            const validMonths = sessionMonths[window.sessionFilter] || [];
            if (!validMonths.includes(month)) {
                return false;
            }
        }
        
        // New updates filter
        if (window.newUpdatesFilter) {
            if (!newIds.includes(item.shortId)) {
                return false;
            }
        }
        
        // Party filter (multiple)
        if (partyValues.length > 0) {
            const itemParty = translateParty(item.party) || getPartyFromAuthor(item.author);
            if (!partyValues.includes(itemParty)) {
                return false;
            }
        }
        
        // Department filter (multiple)
        if (departmentValues.length > 0) {
            const itemDept = item.department || 'none';
            if (!departmentValues.includes(itemDept)) {
                return false;
            }
        }
        
        // Legislature filter (multiple)
        if (legislatureValues.length > 0) {
            const itemLegislature = getLegislature(item.date);
            if (!legislatureValues.includes(itemLegislature)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Sortieren nach Datum (absteigend), dann nach date_maj (Aktualisierte zuerst), dann nach Nummer
    filteredData.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
            return dateB.localeCompare(dateA); // Datum absteigend
        }
        // Gleiches Datum: Aktualisierte zuerst
        const majA = a.date_maj || '';
        const majB = b.date_maj || '';
        if (majA !== majB) {
            return majB.localeCompare(majA);
        }
        // Gleiches Datum und MAJ: nach Nummer absteigend sortieren
        return (b.shortId || '').localeCompare(a.shortId || '');
    });
    
    currentPage = 1;
    renderResults();
    updateURL();
}

function updateURL() {
    const params = new URLSearchParams();
    
    const searchTerm = searchInput.value.trim();
    if (searchTerm) params.set('search', searchTerm);
    
    const yearValues = getCheckedValues('yearDropdown');
    if (yearValues && yearValues.length > 0) {
        params.set('filter_year', yearValues.join(','));
    }
    
    if (window.sessionFilter) params.set('filter_session', window.sessionFilter);
    
    const typeValues = getCheckedValues('typeDropdown');
    if (typeValues && typeValues.length > 0) {
        params.set('filter_type', typeValues.join(','));
    }
    
    const councilValues = getCheckedValues('councilDropdown');
    if (councilValues && councilValues.length > 0) {
        params.set('filter_council', councilValues.join(','));
    }
    
    const partyValues = getCheckedValues('partyDropdown');
    if (partyValues && partyValues.length > 0) {
        params.set('filter_party', partyValues.join(','));
    }
    
    const departmentValues = getCheckedValues('departmentDropdown');
    if (departmentValues && departmentValues.length > 0) {
        params.set('filter_department', departmentValues.join(','));
    }
    
    const legislatureValues = getCheckedValues('legislatureDropdown');
    if (legislatureValues && legislatureValues.length > 0) {
        params.set('filter_legislature', legislatureValues.join(','));
    }
    
    if (window.newUpdatesFilter) params.set('nouveautes', '1');
    
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
}

function clearSearch() {
    searchInput.value = '';
    typeFilter.value = '';
    councilFilter.value = '';
    yearFilter.value = '';
    partyFilter.value = '';
    searchInput.focus();
    applyFilters();
}

function renderResults(loadMore = false) {
    // Update count
    resultsCount.textContent = `${filteredData.length} ${filteredData.length !== 1 ? 'Vorstösse' : 'Vorstoss'} gefunden`;
    
    if (filteredData.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Keine Ergebnisse</h3>
                <p>Versuchen Sie, Ihre Suchkriterien anzupassen</p>
            </div>
        `;
        displayedCount = 0;
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!loadMore) {
        displayedCount = Math.min(INITIAL_ITEMS, filteredData.length);
        resultsContainer.innerHTML = '';
    } else {
        displayedCount = Math.min(displayedCount + ITEMS_PER_LOAD, filteredData.length);
        const oldBtn = document.getElementById('showMoreBtn');
        if (oldBtn) oldBtn.remove();
    }
    
    const itemsToShow = filteredData.slice(0, displayedCount);
    resultsContainer.innerHTML = itemsToShow.map(item => createCard(item, searchTerm)).join('');
    
    if (displayedCount < filteredData.length) {
        const remaining = filteredData.length - displayedCount;
        resultsContainer.innerHTML += `
            <div class="show-more-container">
                <button id="showMoreBtn" class="btn-show-more">Mehr anzeigen (${remaining} verbleibend)</button>
            </div>
        `;
        document.getElementById('showMoreBtn').addEventListener('click', () => renderResults(true));
    }
}

function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: 'Der Autor zitiert die EFK' };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: 'Der Autor und der Bundesrat zitieren die EFK' };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: 'Der Bundesrat zitiert die EFK' };
    } else {
        return { emojis: '🧑', tooltip: 'Der Autor zitiert die EFK' };
    }
}

function translateType(type) {
    if (type === 'Fra.') return 'Frage';
    return type;
}

function isTitleMissing(title) {
    if (!title) return true;
    const missing = ['titre suit', 'titel folgt', ''];
    return missing.includes(title.toLowerCase().trim());
}

function isRecentlyUpdated(dateStr, days) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = now - date;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= days;
}

function createCard(item, searchTerm) {
    const deMissing = isTitleMissing(item.title_de);
    const displayTitle = deMissing && item.title ? item.title : (item.title_de || item.title);
    const title = highlightText(displayTitle, searchTerm);
    const langWarning = deMissing && item.title ? '<span class="lang-warning">🇫🇷 Derzeit nur auf Französisch verfügbar</span>' : '';
    
    const authorName = translateAuthor(item.author || '');
    const partyDE = translateParty(item.party || '');
    const authorWithParty = partyDE ? `${authorName} (${partyDE})` : authorName;
    const author = highlightText(authorWithParty, searchTerm);
    
    // Nummer unterstreichen wenn es ein echtes neues Objekt ist (in new_ids)
    const isNew = newIds.includes(item.shortId);
    const shortIdHighlighted = highlightText(item.shortId, searchTerm);
    const shortId = isNew ? `<span class="id-updated">${shortIdHighlighted}</span>` : shortIdHighlighted;
    
    const date = item.date ? new Date(item.date).toLocaleDateString('de-CH') : '';
    const dateMaj = item.date_maj ? new Date(item.date_maj).toLocaleDateString('de-CH') : '';
    // Afficher 🔄 uniquement si mise à jour cette semaine (7 jours)
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateMajObj = item.date_maj ? new Date(item.date_maj) : null;
    const showDateMaj = dateMaj && dateMaj !== date && dateMajObj && dateMajObj >= oneWeekAgo;
    const url = item.url_de || item.url_fr;
    const mentionData = getMentionEmojis(item.mention);
    
    // Status badge color
    let statusClass = 'badge-status';
    if (item.status?.includes('Erledigt') || item.status?.includes('Liquidé')) {
        statusClass += ' badge-done';
    }
    
    return `
        <article class="card">
            <div class="card-header">
                <span class="card-id">${shortId}</span>
                <div class="card-badges">
                    <span class="badge badge-type">${translateType(item.type)}</span>
                    <span class="badge badge-council">${item.council === 'NR' ? 'NR' : 'SR'}</span>
                    <span class="badge badge-mention" title="${mentionData.tooltip}">${mentionData.emojis}</span>
                </div>
            </div>
            <h3 class="card-title">
                <a href="${url}" target="_blank" rel="noopener">${title}</a>
            </h3>
            ${langWarning}
            <div class="card-meta">
                <span>👤 ${author}</span>
                <span>📅 ${date}${showDateMaj ? ` · 🔄 ${dateMaj}` : ''}</span>
            </div>
            ${item.status ? `<div style="margin-top: 0.5rem;"><span class="badge ${statusClass}">${getStatusDE(item.status)}</span></div>` : ''}
        </article>
    `;
}

function createPagination(totalPages) {
    return `
        <div class="pagination">
            <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>← Zurück</button>
            <span>Seite ${currentPage} / ${totalPages}</span>
            <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>Weiter →</button>
        </div>
    `;
}

function setupPaginationListeners() {
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderResults();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
            if (currentPage < totalPages) {
                currentPage++;
                renderResults();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    }
}

function highlightText(text, searchTerm) {
    if (!text || !searchTerm) return text || '';
    
    const escapedTerm = escapeRegex(searchTerm);
    const regex = new RegExp(`(\\b${escapedTerm}\\b)`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Recherche par mot entier (word boundary)
function searchWholeWord(text, term) {
    if (!text || !term) return false;
    const escapedTerm = escapeRegex(term);
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(text);
}

function showLoading() {
    resultsContainer.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
        </div>
    `;
}

function showError(message) {
    resultsContainer.innerHTML = `
        <div class="empty-state">
            <h3>Fehler</h3>
            <p>${message}</p>
        </div>
    `;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function getStatusDE(status) {
    if (!status) return '';
    if (status.includes('/')) {
        return status.split('/')[0].trim();
    }
    return status;
}

function getPartyDE(party) {
    const translations = {
        'VERT-E-S': 'Grüne',
        'Le Centre': 'Die Mitte',
        'Parti socialiste': 'SP',
        'PLR': 'FDP',
        'UDC': 'SVP',
        'Vert\'libéraux': 'GLP',
        'pvl': 'GLP'
    };
    return translations[party] || party;
}

function downloadFilteredData() {
    if (filteredData.length === 0) {
        alert('Keine Daten zum Exportieren');
        return;
    }
    
    const headers = ['ID', 'Typ', 'Titel', 'Autor', 'Partei', 'Rat', 'Datum', 'Status', 'Link'];
    const rows = filteredData.map(item => [
        item.id || '',
        item.type || '',
        (item.title_de || item.title || '').replace(/"/g, '""'),
        (item.author || '').replace(/"/g, '""'),
        getPartyDE(item.party) || '',
        item.council || '',
        item.date || '',
        getStatusDE(item.status),
        item.url_de || ''
    ]);
    
    const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Vorstoesse_EFK_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
