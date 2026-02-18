const INITIAL_ITEMS = 5;
const ITEMS_PER_LOAD = 5;

let allData = [];
let filteredData = [];
let displayedCount = 0;

const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');
const resetFilters = document.getElementById('resetFilters');

const councilLabels = {
    'N': 'Nationalrat',
    'S': 'Ständerat'
};

const partyLabels = {
    'V': 'SVP',
    'S': 'SP',
    'RL': 'FDP',
    'M-E': 'Die Mitte',
    'G': 'GRÜNE',
    'GL': 'GLP',
    'BD': 'BDP'
};

// Zweisprachige Synonyme für erweiterte Suche
const searchSynonyms = {
    // Politische Parteien
    'plr': ['fdp', 'plr'],
    'fdp': ['plr', 'fdp'],
    'ps': ['sp', 'ps'],
    'sp': ['ps', 'sp'],
    'udc': ['svp', 'udc'],
    'svp': ['udc', 'svp'],
    'le centre': ['die mitte', 'le centre', 'mitte'],
    'die mitte': ['le centre', 'die mitte', 'mitte'],
    'mitte': ['le centre', 'die mitte', 'mitte'],
    'les verts': ['grüne', 'verts', 'vert-e-s'],
    'verts': ['grüne', 'les verts', 'vert-e-s'],
    'vert-e-s': ['grüne', 'les verts', 'verts'],
    'grüne': ['les verts', 'verts', 'vert-e-s'],
    'vert\'libéraux': ['grünliberale', 'pvl', 'glp'],
    'pvl': ['glp', 'vert\'libéraux', 'grünliberale'],
    'glp': ['pvl', 'vert\'libéraux', 'grünliberale'],
    'grünliberale': ['pvl', 'vert\'libéraux', 'glp'],
    // Bundesdepartemente
    'ddps': ['vbs', 'ddps'],
    'vbs': ['ddps', 'vbs'],
    'dfae': ['eda', 'dfae'],
    'eda': ['dfae', 'eda'],
    'dfi': ['edi', 'dfi'],
    'edi': ['dfi', 'edi'],
    'dfjp': ['ejpd', 'dfjp'],
    'ejpd': ['dfjp', 'ejpd'],
    'dff': ['efd', 'dff'],
    'efd': ['dff', 'efd'],
    'defr': ['wbf', 'defr'],
    'wbf': ['defr', 'wbf'],
    'detec': ['uvek', 'detec'],
    'uvek': ['detec', 'uvek'],
    // CDF/EFK
    'cdf': ['efk', 'cdf'],
    'efk': ['cdf', 'efk']
};

function getSearchTerms(term) {
    const lowerTerm = term.toLowerCase();
    const synonyms = searchSynonyms[lowerTerm];
    return synonyms ? synonyms : [lowerTerm];
}

// Recherche par mot entier (word boundary)
function searchWholeWord(text, term) {
    if (!text || !term) return false;
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(text);
}

function getPartyDisplay(item) {
    if (!item.party || item.party === 'undefined' || item.party === '') {
        return 'Bundesrat';
    }
    return partyLabels[item.party] || item.party;
}

async function init() {
    try {
        const response = await fetch('debates_data.json');
        const data = await response.json();
        allData = data.items || [];
        // Sortieren vom neuesten zum ältesten
        allData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        if (data.meta) {
            const updated = new Date(data.meta.updated);
            lastUpdate.textContent = `Aktualisiert: ${updated.toLocaleDateString('de-CH')}`;
        }
        
        populateYearFilter();
        populateSessionFilter();
        populateCouncilFilter();
        populatePartyFilter();
        populateDepartmentFilter();
        initDropdownFilters();
        
        // Gérer les paramètres URL depuis la page stats
        const urlParams = new URLSearchParams(window.location.search);
        const filterParty = urlParams.get('filter_party');
        const filterCouncil = urlParams.get('filter_council');
        const searchParam = urlParams.get('search');
        
        if (filterParty) {
            applyUrlFilter('partyMenu', filterParty);
        }
        if (filterCouncil) {
            applyUrlFilter('councilMenu', filterCouncil);
        }
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
        filteredData = [...allData];
        applyFilters();
        
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        resultsContainer.innerHTML = '<p class="error">Fehler beim Laden der Daten</p>';
    }
}

function applyUrlFilter(menuId, filterValue) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    // Décocher "Alle"
    const selectAll = menu.querySelector('[data-select-all]');
    if (selectAll) selectAll.checked = false;
    
    // Cocher uniquement la valeur filtrée
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    checkboxes.forEach(cb => {
        const label = cb.parentElement.textContent.trim();
        cb.checked = label.includes(filterValue) || cb.value === filterValue;
    });
}

// Mapping der Sessionstypen
const sessionTypes = {
    '5201': 'Winter',
    '5202': 'Frühjahr',
    '5203': 'Sonder',
    '5204': 'Sommer',
    '5205': 'Herbst',
    '5206': 'Winter',
    '5207': 'Frühjahr',
    '5208': 'Sonder',
    '5209': 'Sommer',
    '5210': 'Herbst',
    '5211': 'Winter'
};

function populateYearFilter() {
    const yearMenu = document.getElementById('yearMenu');
    const years = [...new Set(allData.map(item => item.date ? item.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    
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

function populateSessionFilter() {
    const sessionMenu = document.getElementById('sessionMenu');
    const sessionTypesList = ['Winter', 'Frühjahr', 'Sommer', 'Herbst', 'Sonder'];
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    sessionMenu.appendChild(allLabel);
    
    sessionTypesList.forEach(sessionType => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${sessionType}"> ${sessionType}`;
        sessionMenu.appendChild(label);
    });
}

function populateCouncilFilter() {
    const councilMenu = document.getElementById('councilMenu');
    const councils = [...new Set(allData.map(item => item.council).filter(Boolean))];
    
    // Feste Optionen für den Ratsfilter
    const councilOptions = [
        { value: 'N', label: 'Nationalrat' },
        { value: 'S', label: 'Ständerat' }
    ];
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    councilMenu.appendChild(allLabel);
    
    councilOptions.forEach(option => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${option.value}"> ${option.label}`;
        councilMenu.appendChild(label);
    });
}

function populatePartyFilter() {
    const partyMenu = document.getElementById('partyMenu');
    const parties = [...new Set(allData.map(item => item.party).filter(Boolean))];
    parties.sort();
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    partyMenu.appendChild(allLabel);
    
    parties.forEach(party => {
        const label = document.createElement('label');
        const displayName = partyLabels[party] || party;
        label.innerHTML = `<input type="checkbox" value="${party}"> ${displayName}`;
        partyMenu.appendChild(label);
    });
}

function populateDepartmentFilter() {
    const deptMenu = document.getElementById('departmentMenu');
    if (!deptMenu) return;
    
    const departments = [...new Set(allData.map(item => item.department).filter(Boolean))];
    departments.sort((a, b) => a.localeCompare(b, 'de'));
    
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

function initDropdownFilters() {
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        const btn = dropdown.querySelector('.filter-btn');
        const menu = dropdown.querySelector('.filter-menu');
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.filter-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.remove('open');
            });
            dropdown.classList.toggle('open');
        });
        
        menu.addEventListener('click', (e) => e.stopPropagation());
        
        const selectAll = menu.querySelector('[data-select-all]');
        const checkboxes = menu.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
        
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                checkboxes.forEach(cb => cb.checked = false);
                selectAll.checked = true;
                updateFilterCount(dropdown.id);
                applyFilters();
            });
        }
        
        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked && selectAll) {
                    selectAll.checked = false;
                }
                const anyChecked = Array.from(checkboxes).some(c => c.checked);
                if (!anyChecked && selectAll) {
                    selectAll.checked = true;
                }
                updateFilterCount(dropdown.id);
                applyFilters();
            });
        });
    });
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('open'));
    });
}

function updateFilterCount(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const countSpan = dropdown.querySelector('.filter-count');
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all]):checked');
    
    if (checkboxes.length > 0) {
        countSpan.textContent = `(${checkboxes.length})`;
    } else {
        countSpan.textContent = '';
    }
}

function getCheckedValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const selectAll = dropdown.querySelector('[data-select-all]');
    
    if (selectAll && selectAll.checked) {
        return null;
    }
    
    const checked = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all]):checked');
    return Array.from(checked).map(cb => cb.value);
}

function setupEventListeners() {
    searchInput.addEventListener('input', applyFilters);
    
    clearSearch.addEventListener('click', () => {
        searchInput.value = '';
        applyFilters();
    });
    
    resetFilters.addEventListener('click', () => {
        searchInput.value = '';
        document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
            const selectAll = dropdown.querySelector('[data-select-all]');
            const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
            if (selectAll) selectAll.checked = true;
            checkboxes.forEach(cb => cb.checked = false);
            updateFilterCount(dropdown.id);
        });
        applyFilters();
    });
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const yearValues = getCheckedValues('yearDropdown');
    const sessionValues = getCheckedValues('sessionDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    const departmentValues = getCheckedValues('departmentDropdown');
    
    filteredData = allData.filter(item => {
        if (searchTerm) {
            const searchFields = [
                item.speaker,
                item.text,
                item.party,
                item.canton,
                item.business_title_fr,
                item.business_title_de
            ].filter(Boolean).join(' ');
            
            // Suche mit Wortgrenzen und zweisprachigen Synonymen
            const searchTerms = getSearchTerms(searchTerm);
            const found = searchTerms.some(term => searchWholeWord(searchFields, term));
            if (!found) {
                return false;
            }
        }
        
        // Filtre année
        if (yearValues && item.date) {
            const itemYear = item.date.substring(0, 4);
            if (!yearValues.includes(itemYear)) {
                return false;
            }
        }
        
        // Filtre session (par type)
        if (sessionValues) {
            const itemSessionType = sessionTypes[item.id_session];
            if (!sessionValues.includes(itemSessionType)) {
                return false;
            }
        }
        
        if (councilValues && !councilValues.includes(item.council)) {
            return false;
        }
        
        if (partyValues && !partyValues.includes(item.party)) {
            return false;
        }
        
        // Filtre Departement
        if (departmentValues) {
            const itemDept = item.department || 'none';
            if (!departmentValues.includes(itemDept)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Sortieren vom neuesten zum ältesten
    filteredData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    renderResults();
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}.${month}.${year}`;
}

function highlightEFK(text, searchTerm = '') {
    // Nettoyer les bugs de mise en forme - supprimer tout entre crochets
    let result = text
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\(NB\)/gi, ' ')
        .replace(/\(AB\)/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Créer des paragraphes (couper après les phrases longues)
    result = result.replace(/\. ([A-Z])/g, '.</p><p>$1');
    result = '<p>' + result + '</p>';
    
    // Surligner les termes CDF/EFK (avec variantes)
    result = result.replace(/\bCDF\b/g, '<mark class="highlight">CDF</mark>');
    result = result.replace(/\bEFK\b/g, '<mark class="highlight">EFK</mark>');
    result = result.replace(/Contrôle fédéral des finances/gi, '<mark class="highlight">$&</mark>');
    result = result.replace(/Eidgenössischen? Finanzkontrolle/gi, '<mark class="highlight">$&</mark>');
    result = result.replace(/Finanzkontrolle/gi, '<mark class="highlight">$&</mark>');
    
    // Suchbegriff und zweisprachige Synonyme hervorheben
    if (searchTerm && searchTerm.length >= 2) {
        const searchTerms = getSearchTerms(searchTerm);
        searchTerms.forEach(term => {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const searchRegex = new RegExp(`(${escapedTerm})`, 'gi');
            result = result.replace(searchRegex, '<mark class="highlight-search">$1</mark>');
        });
    }
    
    return result;
}

function createCard(item, searchTerm = '') {
    const card = document.createElement('div');
    card.className = 'card debate-card';
    
    const councilDisplay = councilLabels[item.council] || item.council;
    const partyDisplay = getPartyDisplay(item);
    
    const textPreview = item.text.length > 400 
        ? item.text.substring(0, 400) + '...' 
        : item.text;
    
    // Lien vers l'intervention avec ancre #votumX (va sur le titre)
    const votumAnchor = item.sort_order ? `#votum${item.sort_order}` : '';
    const bulletinUrl = item.id_subject 
        ? `https://www.parlament.ch/de/ratsbetrieb/amtliches-bulletin/amtliches-bulletin-die-verhandlungen?SubjectId=${item.id_subject}${votumAnchor}`
        : null;
    
    // Lien vers l'objet parlementaire sur Curia Vista (va sur le numéro)
    const curiaVistaUrl = item.affair_id 
        ? `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${item.affair_id}`
        : null;
    
    // Numéro avec lien Curia Vista
    const businessNumberLink = (item.business_number && curiaVistaUrl)
        ? `<a href="${curiaVistaUrl}" target="_blank" class="card-id" title="Geschäft auf Curia Vista ansehen">${item.business_number}</a>`
        : `<span class="card-id">${item.business_number || ''}</span>`;
    
    // Titre avec lien bulletin (intervention) - toujours en allemand pour la page DE
    const businessTitle = item.business_title_de || item.business_title || '';
    const businessTitleLink = (businessTitle && bulletinUrl)
        ? `<a href="${bulletinUrl}" target="_blank" title="Vollständige Intervention ansehen">${businessTitle}</a>`
        : businessTitle;
    
    // Speaker sans lien
    const speakerText = `${item.speaker} (${partyDisplay}, ${item.canton || ''})`;
    
    card.innerHTML = `
        <div class="card-header">
            ${businessNumberLink}
            <div class="card-badges">
                <span class="badge badge-council">${councilDisplay}</span>
            </div>
        </div>
        <h3 class="card-title">${businessTitleLink}</h3>
        <div class="card-meta">
            <span>🗣️ ${speakerText}</span>
            <span>📅 ${formatDate(item.date)}</span>
        </div>
        <div class="card-text">${highlightEFK(textPreview, searchTerm)}</div>
    `;
    
    if (item.text.length > 400) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn-expand';
        expandBtn.textContent = 'Mehr anzeigen';
        expandBtn.addEventListener('click', () => {
            const textDiv = card.querySelector('.card-text');
            if (expandBtn.textContent === 'Mehr anzeigen') {
                textDiv.innerHTML = highlightEFK(item.text, searchTerm);
                expandBtn.textContent = 'Weniger anzeigen';
            } else {
                textDiv.innerHTML = highlightEFK(textPreview, searchTerm);
                expandBtn.textContent = 'Mehr anzeigen';
            }
        });
        card.appendChild(expandBtn);
    }
    
    return card;
}

function renderResults(loadMore = false) {
    resultsCount.textContent = `${filteredData.length} ${filteredData.length !== 1 ? 'Interventionen' : 'Intervention'} gefunden`;
    
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
    
    const currentSearchTerm = searchInput.value.trim();
    
    if (!loadMore) {
        displayedCount = Math.min(INITIAL_ITEMS, filteredData.length);
        resultsContainer.innerHTML = '';
    } else {
        displayedCount = Math.min(displayedCount + ITEMS_PER_LOAD, filteredData.length);
        const oldBtn = document.getElementById('showMoreBtn');
        if (oldBtn) oldBtn.parentElement.remove();
    }
    
    resultsContainer.innerHTML = '';
    const itemsToShow = filteredData.slice(0, displayedCount);
    itemsToShow.forEach(item => {
        resultsContainer.appendChild(createCard(item, currentSearchTerm));
    });
    
    if (displayedCount < filteredData.length) {
        const remaining = filteredData.length - displayedCount;
        const container = document.createElement('div');
        container.className = 'show-more-container';
        container.innerHTML = `<button id="showMoreBtn" class="btn-show-more">Mehr anzeigen (${remaining} verbleibend)</button>`;
        resultsContainer.appendChild(container);
        document.getElementById('showMoreBtn').addEventListener('click', () => renderResults(true));
    }
}

document.addEventListener('DOMContentLoaded', init);
