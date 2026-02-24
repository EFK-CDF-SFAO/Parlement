// Configuration
const DATA_URL = 'cdf_efk_data.json';
const EXCEL_URL = 'Objets_parlementaires_CDF_EFK.xlsx';
const INITIAL_ITEMS = 10;
const ITEMS_PER_LOAD = 10;

// State
let allData = [];
let filteredData = [];
let displayedCount = 0;
let newIds = [];
let sessionsData = []; // Dati delle sessioni

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
        const sessionsResponse = await fetch('sessions.json');
        const sessionsJson = await sessionsResponse.json();
        sessionsData = sessionsJson.sessions || [];
        
        const response = await fetch(DATA_URL);
        const json = await response.json();
        allData = json.items || [];
        newIds = json.meta?.new_ids || [];
        
        if (json.meta && json.meta.updated) {
            const date = new Date(json.meta.updated);
            lastUpdate.textContent = `Aggiornamento: ${date.toLocaleDateString('it-CH')}`;
        }
        
        displaySessionSummary(json.session_summary);
        populateYearFilter();
        populatePartyFilter();
        populateDepartmentFilter();
        populateTagsFilter();
        initDropdownFilters();
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
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
        
        filteredData = [...allData];
        applyFilters();
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Errore durante il caricamento dei dati');
    }
}

function displaySessionSummary(summary) {
    if (!summary) return;
    
    const today = new Date();
    const displayUntil = summary.display_until ? new Date(summary.display_until) : null;
    
    if (displayUntil && today >= displayUntil) {
        return;
    }
    
    const container = document.getElementById('sessionSummary');
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    const listEl = document.getElementById('summaryInterventions');
    
    if (!container || !titleEl || !textEl || !listEl) return;
    
    titleEl.textContent = summary.title_fr;
    textEl.innerHTML = summary.text_fr + (summary.themes_fr ? '<br><br><strong>Temi trattati:</strong> ' + escapeHtml(summary.themes_fr) : '');
    
    if (summary.interventions && summary.interventions.shortId) {
        const items = summary.interventions.shortId.map((id, i) => {
            const title = summary.interventions.title[i] || '';
            const author = summary.interventions.author[i] || '';
            const party = summary.interventions.party[i] || '';
            const type = summary.interventions.type[i] || '';
            const url = (summary.interventions.url_fr[i] || '#').replace('/fr/', '/it/');
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

function getSessionTypeFromDate(dateStr) {
    if (!dateStr || !sessionsData.length) {
        return 'autre';
    }
    for (const session of sessionsData) {
        if (dateStr >= session.start && dateStr <= session.end) {
            const parts = session.id.split('-');
            if (parts.length >= 2) {
                const sessionType = parts[1];
                if (sessionType.startsWith('speciale')) return 'speciale';
                if (sessionType === 'printemps') return 'printemps';
                if (sessionType === 'ete') return 'ete';
                if (sessionType === 'automne') return 'automne';
                if (sessionType === 'hiver') return 'hiver';
            }
            return 'autre';
        }
    }
    return 'autre';
}

function translateParty(party) {
    const translations = {
        'Al': 'Verdi',
        'VERT-E-S': 'Verdi',
        'PSS': 'PS',
        'PS': 'PS',
        'M-E': 'Alleanza del Centro',
        'Le Centre': 'Alleanza del Centro',
        'PDC': 'Alleanza del Centro',
        'PBD': 'Alleanza del Centro',
        'CSPO': 'Alleanza del Centro',
        'CVP': 'Alleanza del Centro',
        'BDP': 'Alleanza del Centro',
        'PLR': 'PLR',
        'UDC': 'UDC',
        'pvl': 'PVL'
    };
    return translations[party] || party;
}

function translateAuthor(author) {
    if (!author) return '';
    const translations = {
        'Sicherheitspolitische Kommission Nationalrat-Nationalrat': 'Commissione della politica di sicurezza del Consiglio nazionale',
        'Sicherheitspolitische Kommission Nationalrat': 'Commissione della politica di sicurezza del Consiglio nazionale',
        'Sicherheitspolitische Kommission Ständerat': 'Commissione della politica di sicurezza del Consiglio degli Stati',
        'Commission de la politique de sécurité du Conseil national': 'Commissione della politica di sicurezza del Consiglio nazionale',
        'Commission de la politique de sécurité du Conseil des États': 'Commissione della politica di sicurezza del Consiglio degli Stati',
        'FDP-Liberale Fraktion': 'Gruppo liberale radicale',
        'Groupe libéral-radical': 'Gruppo liberale radicale',
        'Grüne Fraktion': 'Gruppo dei Verdi',
        'Groupe des VERT-E-S': 'Gruppo dei Verdi',
        'Sozialdemokratische Fraktion': 'Gruppo socialista',
        'Groupe socialiste': 'Gruppo socialista',
        'SVP-Fraktion': 'Gruppo dell\'Unione democratica di centro',
        'Fraktion der Schweizerischen Volkspartei': 'Gruppo dell\'Unione democratica di centro',
        'Groupe de l\'Union démocratique du centre': 'Gruppo dell\'Unione democratica di centro',
        'Fraktion der Mitte': 'Gruppo del Centro',
        'Die Mitte-Fraktion. Die Mitte. EVP.': 'Gruppo del Centro',
        'Groupe du Centre': 'Gruppo del Centro',
        'Grünliberale Fraktion': 'Gruppo verde liberale',
        'Groupe vert\'libéral': 'Gruppo verde liberale'
    };
    return translations[author] || author;
}

function getPartyFromAuthor(author) {
    if (!author) return null;
    if (author.includes('FDP') || author.includes('PLR') || author.includes('liberale radicale')) return 'PLR';
    if (author.includes('Grünliberale') || author.includes('verde liberale')) return 'PVL';
    if (author.includes('SVP') || author.includes('UDC') || author.includes('Schweizerischen Volkspartei') || author.includes('Unione democratica')) return 'UDC';
    if (author.includes('SP ') || author.includes('PS ') || author.includes('socialista') || author.includes('Sozialdemokratische')) return 'PS';
    if (author.includes('Grüne') || author.includes('Verts') || author.includes('Verdi')) return 'Verdi';
    if (author.includes('Mitte') || author.includes('Centre') || author.includes('Centro') || author.includes('EVP')) return 'Alleanza del Centro';
    return null;
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
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadFilteredData);
    }
    
    updateLangSwitcherLinks();
    
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
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tutti`;
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
    translatedParties.sort((a, b) => a.localeCompare(b, 'it'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tutti`;
    partyMenu.appendChild(allLabel);
    
    translatedParties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
}

function translateDepartment(deptDE) {
    const translations = {
        'EFD': 'DFF',
        'EDI': 'DFI',
        'UVEK': 'DATEC',
        'VBS': 'DDPS',
        'EJPD': 'DFGP',
        'EDA': 'DFAE',
        'WBF': 'DEFR',
        'BK': 'CaF',
        'BGer': 'TF',
        'Parl': 'Parl',
        'VBV': 'AF',
        'AB-BA': 'AV-MPC'
    };
    return translations[deptDE] || deptDE;
}

function populateDepartmentFilter() {
    const deptMenu = document.getElementById('departmentMenu');
    if (!deptMenu) return;
    
    const departments = [...new Set(allData.map(item => item.department).filter(Boolean))];
    departments.sort((a, b) => translateDepartment(a).localeCompare(translateDepartment(b), 'it'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tutti`;
    deptMenu.appendChild(allLabel);
    
    departments.forEach(dept => {
        const label = document.createElement('label');
        const deptIT = translateDepartment(dept);
        label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptIT}`;
        deptMenu.appendChild(label);
    });
}

function populateTagsFilter() {
    const tagsMenu = document.getElementById('tagsMenu');
    if (!tagsMenu) return;
    
    const allTags = new Set();
    allData.forEach(item => {
        if (item.tags_it) {
            item.tags_it.split('|').forEach(tag => {
                if (tag.trim()) allTags.add(tag.trim());
            });
        }
    });
    
    const tagsArray = [...allTags].sort((a, b) => a.localeCompare(b, 'it'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tutti`;
    tagsMenu.appendChild(allLabel);
    
    tagsArray.forEach(tag => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
        tagsMenu.appendChild(label);
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
    
    const selectAll = dropdown.querySelector('input[data-select-all]');
    if (selectAll) selectAll.checked = false;
    
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
    // 52ª legislatura: da dicembre 2023 (sessione invernale 2023)
    // 51ª legislatura: dicembre 2019 - settembre 2023
    // 50ª legislatura: dicembre 2015 - settembre 2019
    if (date >= '2023-12-01') return '52';
    if (date >= '2019-12-01') return '51';
    if (date >= '2015-12-01') return '50';
    return null;
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValues = getCheckedValues('typeDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const yearValues = getCheckedValues('yearDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    const departmentValues = getCheckedValues('departmentDropdown');
    const tagsValues = getCheckedValues('tagsDropdown');
    const legislatureValues = getCheckedValues('legislatureDropdown');
    
    filteredData = allData.filter(item => {
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
        
        if (typeValues.length > 0 && !typeValues.includes(item.type)) {
            return false;
        }
        
        if (councilValues.length > 0 && !councilValues.includes(item.council)) {
            return false;
        }
        
        if (yearValues.length > 0) {
            const itemYear = item.date?.substring(0, 4);
            if (!yearValues.includes(itemYear)) {
                return false;
            }
        }
        
        // Session filter (from URL) - utilise les dates exactes
        if (window.sessionFilter && item.date) {
            const itemSessionType = getSessionTypeFromDate(item.date);
            if (itemSessionType !== window.sessionFilter) {
                return false;
            }
        }
        
        // New updates filter
        if (window.newUpdatesFilter) {
            if (!newIds.includes(item.shortId)) {
                return false;
            }
        }
        
        if (partyValues.length > 0) {
            const itemParty = translateParty(item.party) || getPartyFromAuthor(item.author);
            if (!partyValues.includes(itemParty)) {
                return false;
            }
        }
        
        if (departmentValues.length > 0) {
            const itemDept = item.department || 'none';
            if (!departmentValues.includes(itemDept)) {
                return false;
            }
        }
        
        // Tags filter (multiple)
        if (tagsValues.length > 0) {
            const itemTags = item.tags_it ? item.tags_it.split('|').map(t => t.trim()) : [];
            const hasMatchingTag = itemTags.some(tag => tagsValues.includes(tag));
            if (!hasMatchingTag) {
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
    
    filteredData.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
            return dateB.localeCompare(dateA);
        }
        const majA = a.date_maj || '';
        const majB = b.date_maj || '';
        if (majA !== majB) {
            return majB.localeCompare(majA);
        }
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
    searchInput.focus();
    applyFilters();
}

function renderResults(loadMore = false) {
    resultsCount.textContent = `${filteredData.length} intervent${filteredData.length !== 1 ? 'i trovati' : 'o trovato'}`;
    
    if (filteredData.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Nessun risultato</h3>
                <p>Prova a modificare i criteri di ricerca</p>
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
                <button id="showMoreBtn" class="btn-show-more">Mostra di più (${remaining} rimanent${remaining > 1 ? 'i' : 'e'})</button>
            </div>
        `;
        document.getElementById('showMoreBtn').addEventListener('click', () => renderResults(true));
    }
}

function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: "L'autore cita il CDF" };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: "L'autore e il Consiglio federale citano il CDF" };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: "Il Consiglio federale cita il CDF" };
    } else {
        return { emojis: '🧑', tooltip: "L'autore cita il CDF" };
    }
}

function translateType(type) {
    const translations = {
        'Interpellation': 'Interpellanza',
        'Ip.': 'Ip.',
        'Motion': 'Mozione',
        'Mo.': 'Mo.',
        'Fragestunde': 'Ora delle domande',
        'Fra.': 'Ora delle domande',
        'Geschäft des Bundesrates': 'Oggetto del Consiglio federale',
        'Postulat': 'Postulato',
        'Po.': 'Po.',
        'Anfrage': 'Interrogazione',
        'A.': 'Interrogazione',
        'Parlamentarische Initiative': 'Iniziativa parlamentare',
        'Pa.Iv.': 'Iv.pa.',
        'Geschäft des Parlaments': 'Oggetto del Parlamento'
    };
    return translations[type] || type;
}

function isTitleMissing(title) {
    if (!title) return true;
    const missing = ['titre suit', 'titel folgt', ''];
    return missing.includes(title.toLowerCase().trim());
}

function createCard(item, searchTerm) {
    // Priorité: titre IT > titre FR > titre DE
    const hasIT = item.title_it && !isTitleMissing(item.title_it);
    const hasFR = item.title && !isTitleMissing(item.title);
    const hasDE = item.title_de && !isTitleMissing(item.title_de);
    
    let displayTitle, langWarning = '';
    if (hasIT) {
        displayTitle = item.title_it;
    } else if (hasFR) {
        displayTitle = item.title;
        langWarning = '<span class="lang-warning">🇫🇷 Solo in francese</span>';
    } else if (hasDE) {
        displayTitle = item.title_de;
        langWarning = '<span class="lang-warning">🇩🇪 Solo in tedesco</span>';
    } else {
        displayTitle = item.title || item.title_de || '';
    }
    const title = highlightText(displayTitle, searchTerm);
    
    const authorName = translateAuthor(item.author || '');
    const partyIT = translateParty(item.party || '');
    const authorWithParty = partyIT ? `${authorName} (${partyIT})` : authorName;
    const author = highlightText(authorWithParty, searchTerm);
    
    const isNew = newIds.includes(item.shortId);
    const shortIdHighlighted = highlightText(item.shortId, searchTerm);
    const shortId = isNew ? `<span class="id-updated">${shortIdHighlighted}</span>` : shortIdHighlighted;
    
    const date = item.date ? new Date(item.date).toLocaleDateString('it-CH') : '';
    const dateMaj = item.date_maj ? new Date(item.date_maj).toLocaleDateString('it-CH') : '';
    // Afficher 🔄 si date de mise à jour existe et différente de la date de dépôt
    const showDateMaj = dateMaj && dateMaj !== date;
    const url = (item.url_fr || item.url_de).replace('/fr/', '/it/');
    const mentionData = getMentionEmojis(item.mention);
    
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
                    <span class="badge badge-council">${item.council === 'NR' ? 'CN' : 'CS'}</span>
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
            ${item.status ? `<div style="margin-top: 0.5rem;"><span class="badge ${statusClass}">${getStatusIT(item.status)}</span></div>` : ''}
        </article>
    `;
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
            <h3>Errore</h3>
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

function getStatusIT(status) {
    if (!status) return '';
    
    const translations = {
        // Statuts liquidés
        'Liquidé': 'Liquidato',
        'Erledigt': 'Liquidato',
        // Non traité
        'Im Rat noch nicht behandelt': 'Non ancora trattato in Consiglio',
        'Au Conseil, pas encore traité': 'Non ancora trattato in Consiglio',
        // Accepté/Adopté
        'Angenommen': 'Accettato',
        'Adopté': 'Accettato',
        // Rejeté
        'Abgelehnt': 'Respinto',
        'Rejeté': 'Respinto',
        // Retiré
        'Zurückgezogen': 'Ritirato',
        'Retiré': 'Ritirato',
        // Déposé
        'Eingereicht': 'Depositato',
        'Déposé': 'Depositato',
        // Transmis au CF
        'Transmis au Conseil fédéral': 'Trasmesso al Consiglio federale',
        'An den Bundesrat überwiesen': 'Trasmesso al Consiglio federale',
        // Commission
        'Attribué à la commission compétente': 'Assegnato alla commissione competente',
        'Der zuständigen Kommission zugewiesen': 'Assegnato alla commissione competente',
        // Déclaration/Avis disponible
        'La déclaration sur l\'intervention est disponible': 'La dichiarazione sull\'intervento è disponibile',
        'Die Erklärung zum Vorstoss liegt vor': 'La dichiarazione sull\'intervento è disponibile',
        'L\'avis relatif à l\'intervention est disponible': 'La dichiarazione sull\'intervento è disponibile',
        "L’avis relatif à l’intervention est disponible": 'La dichiarazione sull\'intervento è disponibile',
        'Die Stellungnahme zum Vorstoss liegt vor': 'La dichiarazione sull\'intervento è disponibile',
        // En suspens
        'Suspendu': 'Sospeso',
        'Sistiert': 'Sospeso',
        // Classé
        'Classé': 'Tolto dal ruolo',
        'Abgeschrieben': 'Tolto dal ruolo'
    };
    
    if (status.includes('/')) {
        const parts = status.split('/');
        const frStatus = parts[1]?.trim();
        return translations[frStatus] || frStatus || status;
    }
    return translations[status] || status;
}

function getPartyIT(party) {
    const translations = {
        'VERT-E-S': 'Verdi',
        'Le Centre': 'Alleanza del Centro',
        'Parti socialiste': 'PS',
        'PLR': 'PLR',
        'UDC': 'UDC',
        'Vert\'libéraux': 'Verdi liberali'
    };
    return translations[party] || party;
}

function downloadFilteredData() {
    if (filteredData.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }
    
    const headers = ['ID', 'Tipo', 'Titolo', 'Autore', 'Partito', 'Consiglio', 'Data', 'Stato', 'Link'];
    const rows = filteredData.map(item => [
        item.id || '',
        item.type || '',
        (item.title_it || item.title || '').replace(/"/g, '""'),
        (item.author || '').replace(/"/g, '""'),
        getPartyIT(item.party) || '',
        item.council || '',
        item.date || '',
        getStatusIT(item.status),
        (item.url_fr || '').replace('/fr/', '/it/')
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
    link.download = `Oggetti_CDF_EFK_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
