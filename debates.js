const INITIAL_ITEMS = 5;
const ITEMS_PER_LOAD = 5;

let allData = [];
let filteredData = [];
let displayedCount = 0;
let newIds = []; // IDs des nouveaux débats (< 4 jours)
let objectsData = {}; // Mapping business_number -> tags pour le filtre thématique

const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');
const resetFilters = document.getElementById('resetFilters');
const showNewUpdatesBtn = document.getElementById('showNewUpdates');

const councilLabels = {
    'N': 'Conseil national',
    'S': 'Conseil des États',
    'V': 'Assemblée fédérale'
};

const partyLabels = {
    'V': 'UDC',
    'S': 'PS',
    'RL': 'PLR',
    'M-E': 'Le Centre',
    'CE': 'Le Centre',
    'C': 'Le Centre',
    'BD': 'Le Centre',
    'G': 'VERT-E-S',
    'GL': 'Vert\'libéraux'
};

// Synonymes bilingues pour recherche étendue
const searchSynonyms = {
    // Partis politiques
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
    // Départements fédéraux
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
// Gère les numéros d'objets (ex: 22.202) et les noms avec accents (ex: André)
function searchWholeWord(text, term) {
    if (!text || !term) return false;
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    // Pour les numéros d'objets (ex: 22.202), utiliser une recherche simple
    if (/^\d+\.\d+$/.test(term)) {
        return lowerText.includes(lowerTerm);
    }
    // Pour les noms complets (contenant un espace) ou avec accents, recherche simple
    if (term.includes(' ') || /[àâäéèêëïîôùûüç]/i.test(term)) {
        return lowerText.includes(lowerTerm);
    }
    // Sinon, utiliser word boundary
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedTerm}\\b`, 'i');
    return regex.test(text);
}

function getPartyDisplay(item) {
    if (!item.party || item.party === 'undefined' || item.party === '') {
        return 'Conseil fédéral';
    }
    return partyLabels[item.party] || item.party;
}

async function init() {
    try {
        // Charger les débats et les objets en parallèle
        const [debatesResponse, objectsResponse] = await Promise.all([
            fetch('debates_data.json'),
            fetch('cdf_efk_data.json')
        ]);
        
        const data = await debatesResponse.json();
        const objectsJson = await objectsResponse.json();
        
        allData = data.items || [];
        newIds = data.new_ids || [];
        
        // Créer le mapping business_number -> tags
        if (objectsJson.items) {
            objectsJson.items.forEach(item => {
                if (item.shortId && item.tags) {
                    objectsData[item.shortId] = item.tags;
                }
            });
        }
        
        // Trier du plus récent au plus vieux
        allData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        
        if (data.meta) {
            const updated = new Date(data.meta.updated);
            lastUpdate.textContent = `Mise à jour: ${updated.toLocaleDateString('fr-CH')}`;
        }
        
        populateYearFilter();
        populateSessionFilter();
        populateCouncilFilter();
        populatePartyFilter();
        populateDepartmentFilter();
        populateTagsFilter();
        initDropdownFilters();
        
        // Gérer les paramètres URL depuis la page stats
        const urlParams = new URLSearchParams(window.location.search);
        const filterParty = urlParams.get('filter_party');
        const filterCouncil = urlParams.get('filter_council');
        const filterYear = urlParams.get('filter_year');
        const filterSession = urlParams.get('filter_session');
        const filterDept = urlParams.get('filter_dept');
        const filterLegislature = urlParams.get('filter_legislature');
        const searchParam = urlParams.get('search');
        
        if (filterParty) {
            applyUrlFilter('partyMenu', filterParty);
        }
        if (filterCouncil) {
            applyUrlFilter('councilMenu', filterCouncil);
        }
        if (filterYear) {
            applyUrlFilter('yearMenu', filterYear);
        }
        if (filterSession) {
            applyUrlFilter('sessionMenu', filterSession);
        }
        if (filterDept) {
            applyUrlFilter('departmentMenu', filterDept);
        }
        if (filterLegislature) {
            applyUrlFilter('legislatureMenu', filterLegislature);
        }
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
        filteredData = [...allData];
        applyFilters();
        
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        resultsContainer.innerHTML = '<p class="error">Erreur de chargement des données</p>';
    }
}

function applyUrlFilter(menuId, filterValue) {
    const menu = document.getElementById(menuId);
    if (!menu) return;
    
    // Support multiple values separated by comma
    const filterValues = filterValue.split(',').map(v => v.trim());
    
    // Décocher "Tous"
    const selectAll = menu.querySelector('[data-select-all]');
    if (selectAll) selectAll.checked = false;
    
    // Cocher les valeurs filtrées
    const checkboxes = menu.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    checkboxes.forEach(cb => {
        const label = cb.parentElement.textContent.trim();
        cb.checked = filterValues.some(v => label.includes(v) || cb.value === v);
    });
    
    // Mettre à jour l'affichage du dropdown
    const dropdown = menu.closest('.filter-dropdown');
    if (dropdown) {
        updateFilterCount(dropdown.id);
    }
}

// Mapping des types de sessions (législatures 50, 51, 52)
const sessionTypes = {
    // Législature 50 (2015-2019)
    '5001': 'Hiver', '5002': 'Printemps', '5003': 'Spéciale', '5004': 'Été', '5005': 'Automne',
    '5006': 'Hiver', '5007': 'Printemps', '5008': 'Spéciale', '5009': 'Été', '5010': 'Automne',
    '5011': 'Hiver', '5012': 'Printemps', '5013': 'Été', '5014': 'Automne',
    '5015': 'Hiver', '5016': 'Printemps', '5017': 'Spéciale', '5018': 'Été', '5019': 'Automne',
    // Législature 51 (2019-2023)
    '5101': 'Hiver', '5102': 'Printemps', '5103': 'Spéciale', '5104': 'Été', '5105': 'Automne',
    '5106': 'Spéciale', '5107': 'Hiver', '5108': 'Printemps', '5109': 'Spéciale', '5110': 'Été',
    '5111': 'Automne', '5112': 'Hiver', '5113': 'Printemps', '5114': 'Spéciale', '5115': 'Été',
    '5116': 'Automne', '5117': 'Hiver', '5118': 'Printemps', '5119': 'Spéciale', '5120': 'Spéciale',
    '5121': 'Été', '5122': 'Automne',
    // Législature 52 (2023-)
    '5201': 'Hiver', '5202': 'Printemps', '5203': 'Spéciale', '5204': 'Été', '5205': 'Automne',
    '5206': 'Hiver', '5207': 'Printemps', '5208': 'Spéciale', '5209': 'Été', '5210': 'Automne',
    '5211': 'Hiver', '5212': 'Printemps', '5213': 'Spéciale', '5214': 'Été', '5215': 'Automne',
    '5216': 'Hiver', '5217': 'Printemps', '5218': 'Spéciale'
};

function populateYearFilter() {
    const yearMenu = document.getElementById('yearMenu');
    const years = [...new Set(allData.map(item => item.date ? item.date.substring(0, 4) : null).filter(Boolean))];
    if (!years.includes('2026')) years.push('2026');
    years.sort().reverse();
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Toutes`;
    yearMenu.appendChild(allLabel);
    
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
}

function populateSessionFilter() {
    const sessionMenu = document.getElementById('sessionMenu');
    const sessionTypesList = ['Hiver', 'Printemps', 'Été', 'Automne', 'Spéciale'];
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Toutes`;
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
    
    // Options fixes pour le filtre conseil
    const councilOptions = [
        { value: 'N', label: 'Conseil national' },
        { value: 'S', label: 'Conseil des États' },
        { value: 'V', label: 'Assemblée fédérale' }
    ];
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
    councilMenu.appendChild(allLabel);
    
    councilOptions.forEach(option => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${option.value}"> ${option.label}`;
        councilMenu.appendChild(label);
    });
}

function populatePartyFilter() {
    const partyMenu = document.getElementById('partyMenu');
    // Regrouper les anciens partis sous Le Centre
    const partyGroups = {};
    let hasFederalCouncil = false;
    
    allData.forEach(item => {
        if (!item.party) {
            hasFederalCouncil = true;
            return;
        }
        const displayName = partyLabels[item.party] || item.party;
        if (!partyGroups[displayName]) {
            partyGroups[displayName] = [];
        }
        if (!partyGroups[displayName].includes(item.party)) {
            partyGroups[displayName].push(item.party);
        }
    });
    
    const displayNames = Object.keys(partyGroups).sort((a, b) => a.localeCompare(b, 'fr'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
    partyMenu.appendChild(allLabel);
    
    // Ajouter Conseil fédéral en premier si présent
    if (hasFederalCouncil) {
        const cfLabel = document.createElement('label');
        cfLabel.innerHTML = `<input type="checkbox" value="Conseil fédéral"> Conseil fédéral`;
        partyMenu.appendChild(cfLabel);
    }
    
    displayNames.forEach(displayName => {
        const label = document.createElement('label');
        const values = partyGroups[displayName].join(',');
        label.innerHTML = `<input type="checkbox" value="${values}"> ${displayName}`;
        partyMenu.appendChild(label);
    });
}

function translateDepartment(deptDE) {
    const translations = {
        'EFD': 'DFF',
        'EDI': 'DFI',
        'UVEK': 'DETEC',
        'VBS': 'DDPS',
        'EJPD': 'DFJP',
        'EDA': 'DFAE',
        'WBF': 'DEFR',
        'BK': 'ChF',
        'BGer': 'TF',
        'Parl': 'Parl',
        'VBV': 'AF'
    };
    return translations[deptDE] || deptDE;
}

function populateDepartmentFilter() {
    const deptMenu = document.getElementById('departmentMenu');
    if (!deptMenu) return;
    
    const departments = [...new Set(allData.map(item => item.department).filter(Boolean))];
    departments.sort((a, b) => translateDepartment(a).localeCompare(translateDepartment(b), 'fr'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
    deptMenu.appendChild(allLabel);
    
    departments.forEach(dept => {
        const label = document.createElement('label');
        const deptFR = translateDepartment(dept);
        label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptFR}`;
        deptMenu.appendChild(label);
    });
}

function getDebateTags(item) {
    // Récupérer les tags de l'objet associé au débat via business_number
    if (!item.business_number) return [];
    const tags = objectsData[item.business_number];
    if (!tags) return [];
    return tags.split('|').map(t => t.trim()).filter(t => t);
}

function populateTagsFilter() {
    const tagsMenu = document.getElementById('tagsMenu');
    if (!tagsMenu) return;
    
    // Extraire tous les tags uniques des débats via leurs objets associés
    const allTags = new Set();
    allData.forEach(item => {
        const tags = getDebateTags(item);
        tags.forEach(tag => allTags.add(tag));
    });
    
    const tagsArray = [...allTags].sort((a, b) => a.localeCompare(b, 'fr'));
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
    tagsMenu.appendChild(allLabel);
    
    tagsArray.forEach(tag => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${tag}"> ${tag}`;
        tagsMenu.appendChild(label);
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
        const selectedLabels = Array.from(checkboxes).map(cb => {
            const label = cb.parentElement.textContent.trim();
            return label;
        });
        
        if (selectedLabels.length === 1) {
            countSpan.textContent = `: ${selectedLabels[0]}`;
        } else if (selectedLabels.length <= 2) {
            countSpan.textContent = `: ${selectedLabels.join(', ')}`;
        } else {
            countSpan.textContent = `: ${selectedLabels[0]} +${selectedLabels.length - 1}`;
        }
    } else {
        countSpan.textContent = '';
    }
}

function getCheckedValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return null;
    
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
        // Clear new updates filter
        window.newUpdatesFilter = false;
        if (showNewUpdatesBtn) {
            showNewUpdatesBtn.classList.remove('active');
        }
        applyFilters();
    });
    
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

function getLegislatureFromSession(sessionId) {
    if (!sessionId) return null;
    const sessionStr = String(sessionId);
    if (sessionStr.startsWith('52')) return '52';
    if (sessionStr.startsWith('51')) return '51';
    if (sessionStr.startsWith('50')) return '50';
    return null;
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const yearValues = getCheckedValues('yearDropdown');
    const sessionValues = getCheckedValues('sessionDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    const departmentValues = getCheckedValues('departmentDropdown');
    const legislatureValues = getCheckedValues('legislatureDropdown');
    const tagsValues = getCheckedValues('tagsDropdown');
    
    filteredData = allData.filter(item => {
        // New updates filter (< 4 jours, cohérent avec la bande verte)
        if (window.newUpdatesFilter) {
            const now = new Date();
            const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
            const dateStr = String(item.date);
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const itemDate = new Date(`${year}-${month}-${day}T12:00:00`);
            const isRecent = itemDate >= fourDaysAgo;
            if (!isRecent) {
                return false;
            }
        }
        
        if (searchTerm) {
            const searchFields = [
                item.speaker,
                item.text,
                item.party,
                item.canton,
                item.business_number,
                item.business_title_fr,
                item.business_title_de
            ].filter(Boolean).join(' ');
            
            // Recherche par mot entier avec synonymes bilingues
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
        
        if (partyValues) {
            // Gérer les valeurs multiples séparées par des virgules
            const allPartyValues = partyValues.flatMap(v => v.split(','));
            // Conseil fédéral = pas de parti (item.party vide)
            const isFederalCouncil = !item.party;
            const matchesFederalCouncil = allPartyValues.includes('Conseil fédéral') && isFederalCouncil;
            const matchesParty = item.party && allPartyValues.includes(item.party);
            if (!matchesFederalCouncil && !matchesParty) {
                return false;
            }
        }
        
        // Filtre département
        if (departmentValues) {
            const itemDept = item.department || 'none';
            if (!departmentValues.includes(itemDept)) {
                return false;
            }
        }
        
        // Filtre législature
        if (legislatureValues) {
            const itemLegislature = getLegislatureFromSession(item.id_session);
            if (!legislatureValues.includes(itemLegislature)) {
                return false;
            }
        }
        
        // Filtre thématique (via les tags de l'objet associé)
        if (tagsValues) {
            const itemTags = getDebateTags(item);
            const hasMatchingTag = tagsValues.some(tag => itemTags.includes(tag));
            if (!hasMatchingTag) {
                return false;
            }
        }
        
        return true;
    });
    
    // Trier du plus récent au plus vieux
    filteredData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
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
    
    const sessionValues = getCheckedValues('sessionDropdown');
    if (sessionValues && sessionValues.length > 0) {
        params.set('filter_session', sessionValues.join(','));
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
    
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}.${month}.${year}`;
}

function highlightCDF(text, searchTerm = '') {
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
    
    // Surligner le terme de recherche et ses synonymes bilingues
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
    // Bande verte si date < 4 jours
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const dateStr = String(item.date);
    const debateDate = new Date(`${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}T12:00:00`);
    const isNew = debateDate >= fourDaysAgo;
    card.className = `card debate-card${isNew ? ' card-new' : ''}`;
    
    const councilDisplay = councilLabels[item.council] || item.council;
    const partyDisplay = getPartyDisplay(item);
    
    const textPreview = item.text.length > 400 
        ? item.text.substring(0, 400) + '...' 
        : item.text;
    
    // Lien vers l'intervention avec ancre #votumX (va sur le titre)
    const votumAnchor = item.sort_order ? `#votum${item.sort_order}` : '';
    const bulletinUrl = item.id_subject 
        ? `https://www.parlament.ch/fr/ratsbetrieb/amtliches-bulletin/amtliches-bulletin-die-verhandlungen?SubjectId=${item.id_subject}${votumAnchor}`
        : null;
    
    // Lien vers l'objet parlementaire sur Curia Vista (va sur le numéro)
    const curiaVistaUrl = item.affair_id 
        ? `https://www.parlament.ch/fr/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${item.affair_id}`
        : null;
    
    // Numéro avec lien Curia Vista
    const businessNumberLink = (item.business_number && curiaVistaUrl)
        ? `<a href="${curiaVistaUrl}" target="_blank" class="card-id" title="Voir l'objet sur Curia Vista">${item.business_number}</a>`
        : `<span class="card-id">${item.business_number || ''}</span>`;
    
    // Titre avec lien bulletin (intervention) - toujours en français pour la page FR
    const businessTitle = item.business_title_fr || item.business_title || '';
    const businessTitleLink = (businessTitle && bulletinUrl)
        ? `<a href="${bulletinUrl}" target="_blank" title="Voir l'intervention complète">${businessTitle}</a>`
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
            <span>💬 ${speakerText}</span>
            <span>📅 ${formatDate(item.date)}</span>
        </div>
        <div class="card-text">${highlightCDF(textPreview, searchTerm)}</div>
    `;
    
    if (item.text.length > 400) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn-expand';
        expandBtn.textContent = 'Voir plus';
        expandBtn.addEventListener('click', () => {
            const textDiv = card.querySelector('.card-text');
            if (expandBtn.textContent === 'Voir plus') {
                textDiv.innerHTML = highlightCDF(item.text, searchTerm);
                expandBtn.textContent = 'Voir moins';
            } else {
                textDiv.innerHTML = highlightCDF(textPreview, searchTerm);
                expandBtn.textContent = 'Voir plus';
            }
        });
        card.appendChild(expandBtn);
    }
    
    return card;
}

function renderResults(loadMore = false) {
    resultsCount.textContent = `${filteredData.length} intervention${filteredData.length !== 1 ? 's' : ''} trouvée${filteredData.length !== 1 ? 's' : ''}`;
    
    if (filteredData.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Aucun résultat</h3>
                <p>Essayez de modifier vos critères de recherche</p>
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
        container.innerHTML = `<button id="showMoreBtn" class="btn-show-more">Afficher plus (${remaining} restant${remaining > 1 ? 's' : ''})</button>`;
        resultsContainer.appendChild(container);
        document.getElementById('showMoreBtn').addEventListener('click', () => renderResults(true));
    }
}

document.addEventListener('DOMContentLoaded', init);
