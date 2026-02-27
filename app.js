// Configuration
const DATA_URL = 'cdf_efk_data.json';
const EXCEL_URL = 'Objets_parlementaires_CDF_EFK.xlsx';
const INITIAL_ITEMS = 10;
const ITEMS_PER_LOAD = 10;

// State
let allData = [];
let filteredData = [];
let displayedCount = 0;
let newIds = []; // IDs des vrais nouveaux objets
let sessionsData = []; // Données des sessions parlementaires

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
        // Charger les données des sessions
        const sessionsResponse = await fetch('sessions.json');
        const sessionsJson = await sessionsResponse.json();
        sessionsData = sessionsJson.sessions || [];
        
        const response = await fetch(DATA_URL);
        const json = await response.json();
        allData = json.items || [];
        newIds = json.meta?.new_ids || [];
        
        // Display last update
        if (json.meta && json.meta.updated) {
            const date = new Date(json.meta.updated);
            lastUpdate.textContent = `Mise à jour: ${date.toLocaleDateString('fr-CH')}`;
        }
        
        // Display session summary if available
        displaySessionSummary(json.session_summary);
        
        // Populate year, party, department and tags filters
        populateYearFilter();
        populatePartyFilter();
        populateDepartmentFilter();
        populateTagsFilter();
        
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
        const filterCouncil = urlParams.get('filter_council');
        const filterDept = urlParams.get('filter_dept');
        const filterLegislature = urlParams.get('filter_legislature');
        const filterTags = urlParams.get('filter_tags');
        const filterMention = urlParams.get('filter_mention');
        
        if (filterParty) {
            applyFilterFromUrl('partyDropdown', filterParty);
        }
        if (filterType) {
            applyFilterFromUrl('typeDropdown', filterType);
        }
        if (filterYear) {
            applyFilterFromUrl('yearDropdown', filterYear);
        }
        if (filterCouncil) {
            applyFilterFromUrl('councilDropdown', filterCouncil);
        }
        if (filterDept) {
            applyFilterFromUrl('departmentDropdown', filterDept);
        }
        if (filterLegislature) {
            applyFilterFromUrl('legislatureDropdown', filterLegislature);
        }
        if (filterTags) {
            applyFilterFromUrl('tagsDropdown', filterTags);
        }
        if (filterMention) {
            applyFilterFromUrl('mentionDropdown', filterMention);
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
        showError('Erreur lors du chargement des données');
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
    
    titleEl.textContent = summary.title_fr;
    textEl.innerHTML = summary.text_fr + (summary.themes_fr ? '<br><br><strong>Thèmes abordés :</strong> ' + escapeHtml(summary.themes_fr) : '');
    
    // Build interventions list
    if (summary.interventions && summary.interventions.shortId) {
        const items = summary.interventions.shortId.map((id, i) => {
            const title = summary.interventions.title[i] || '';
            const author = summary.interventions.author[i] || '';
            const party = translateParty(summary.interventions.party[i] || '');
            const type = summary.interventions.type[i] || '';
            const url = summary.interventions.url_fr[i] || '#';
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
        'Al': 'VERT-E-S',
        'PSS': 'PS',
        'M-E': 'Le Centre',
        'PDC': 'Le Centre',
        'PBD': 'Le Centre',
        'CSPO': 'Le Centre',
        'CVP': 'Le Centre',
        'BDP': 'Le Centre'
    };
    return translations[party] || party;
}

function translateAuthor(author) {
    if (!author) return '';
    const translations = {
        'Sicherheitspolitische Kommission Nationalrat-Nationalrat': 'Commission de la politique de sécurité du Conseil national',
        'Sicherheitspolitische Kommission Nationalrat': 'Commission de la politique de sécurité du Conseil national',
        'Sicherheitspolitische Kommission Ständerat': 'Commission de la politique de sécurité du Conseil des États',
        'FDP-Liberale Fraktion': 'Groupe libéral-radical',
        'Grüne Fraktion': 'Groupe des VERT-E-S',
        'Sozialdemokratische Fraktion': 'Groupe socialiste',
        'SVP-Fraktion': 'Groupe de l\'Union démocratique du centre',
        'Fraktion der Schweizerischen Volkspartei': 'Groupe de l\'Union démocratique du centre',
        'Fraktion der Mitte': 'Groupe du Centre',
        'Die Mitte-Fraktion. Die Mitte. EVP.': 'Groupe du Centre',
        'Grünliberale Fraktion': 'Groupe vert\'libéral'
    };
    return translations[author] || author;
}

function getPartyFromAuthor(author) {
    if (!author) return null;
    if (author.includes('FDP') || author.includes('PLR') || author.includes('libéral-radical')) return 'PLR';
    if (author.includes('Grünliberale') || author.includes('vert\'libéral')) return 'pvl';
    if (author.includes('SVP') || author.includes('UDC') || author.includes('Schweizerischen Volkspartei') || author.includes('Union démocratique')) return 'UDC';
    if (author.includes('SP ') || author.includes('PS ') || author.includes('socialiste') || author.includes('Sozialdemokratische')) return 'PSS';
    if (author.includes('Grüne') || author.includes('Verts') || author.includes('VERT')) return 'VERT-E-S';
    if (author.includes('Mitte') || author.includes('Centre') || author.includes('EVP')) return 'Le Centre';
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
    
    // Add "Tous" option (checked by default)
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
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
    translatedParties.sort((a, b) => a.localeCompare(b, 'fr'));
    
    // Add "Tous" option (checked by default)
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Tous`;
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
        'UVEK': 'DETEC',
        'VBS': 'DDPS',
        'EJPD': 'DFJP',
        'EDA': 'DFAE',
        'WBF': 'DEFR',
        'BK': 'ChF',
        'BGer': 'TF',
        'Parl': 'Parl',
        'VBV': 'AF',
        'AB-BA': 'AS-MPC'
    };
    return translations[deptDE] || deptDE;
}

function populateDepartmentFilter() {
    const deptMenu = document.getElementById('departmentMenu');
    if (!deptMenu) return;
    
    const departments = [...new Set(allData.map(item => item.department).filter(Boolean))];
    departments.sort((a, b) => translateDepartment(a).localeCompare(translateDepartment(b), 'fr'));
    
    // Add "Tous" option (checked by default)
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

function populateTagsFilter() {
    const tagsMenu = document.getElementById('tagsMenu');
    if (!tagsMenu) return;
    
    // Extraire tous les tags uniques (séparés par |)
    const allTags = new Set();
    allData.forEach(item => {
        if (item.tags) {
            item.tags.split('|').forEach(tag => {
                if (tag.trim()) allTags.add(tag.trim());
            });
        }
    });
    
    const tagsArray = [...allTags].sort((a, b) => a.localeCompare(b, 'fr'));
    
    // Add "Tous" option (checked by default)
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
        // Récupérer les labels des filtres sélectionnés
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

function initDropdownFilters() {
    const dropdowns = document.querySelectorAll('.filter-dropdown');
    
    // Toggle dropdown on button click
    dropdowns.forEach(dropdown => {
        const btn = dropdown.querySelector('.filter-btn');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns
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
                    // Uncheck all other checkboxes
                    dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])').forEach(other => {
                        other.checked = false;
                    });
                } else if (!isSelectAll && e.target.checked) {
                    // Uncheck "Tous" when selecting specific option
                    const selectAll = dropdown.querySelector('input[data-select-all]');
                    if (selectAll) selectAll.checked = false;
                }
                updateFilterCount(dropdown.id);
                applyFilters();
            });
        });
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        dropdowns.forEach(d => d.classList.remove('open'));
    });
    
    // Prevent closing when clicking inside menu
    document.querySelectorAll('.filter-menu').forEach(menu => {
        menu.addEventListener('click', e => e.stopPropagation());
    });
    
    // Reset filters button
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
    // Recheck "Tous" by default
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
    
    // Support multiple values separated by comma
    const filterValues = filterValue.split(',').map(v => v.trim());
    
    // Uncheck "Tous"
    const selectAll = dropdown.querySelector('input[data-select-all]');
    if (selectAll) selectAll.checked = false;
    
    // Check the matching checkboxes
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    checkboxes.forEach(cb => {
        if (filterValues.includes(cb.value)) {
            cb.checked = true;
        }
    });
    
    updateFilterCount(dropdownId);
}

function getLegislature(date) {
    if (!date) return null;
    // 52ème législature: à partir de décembre 2023 (session d'hiver 2023)
    // 51ème législature: décembre 2019 - septembre 2023
    // 50ème législature: décembre 2015 - septembre 2019
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
    const mentionValues = getCheckedValues('mentionDropdown');
    
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
                item.text,      // Texte de l'objet
                item.text_de    // Texte allemand
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
        
        // Session filter (from URL) - utilise les dates exactes des sessions
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
        
        // Tags filter (multiple) - un objet passe si au moins un de ses tags est sélectionné
        if (tagsValues.length > 0) {
            const itemTags = item.tags ? item.tags.split('|').map(t => t.trim()) : [];
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
        
        // Mention filter (qui cite le CDF)
        if (mentionValues.length > 0) {
            const mentionMap = {
                'elu': 'Élu',
                'cf': 'Conseil fédéral',
                'both': 'Élu & Conseil fédéral'
            };
            const itemMention = item.mention || '';
            const matchesMention = mentionValues.some(v => mentionMap[v] === itemMention);
            if (!matchesMention) {
                return false;
            }
        }
        
        return true;
    });
    
    // Trier par date (desc), puis par date_maj (MAJ en premier), puis par numéro
    filteredData.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        if (dateA !== dateB) {
            return dateB.localeCompare(dateA); // Date desc
        }
        // Même date: MAJ récente en premier
        const majA = a.date_maj || '';
        const majB = b.date_maj || '';
        if (majA !== majB) {
            return majB.localeCompare(majA);
        }
        // Même date et MAJ: trier par numéro décroissant
        return (b.shortId || '').localeCompare(a.shortId || '');
    });
    
    currentPage = 1;
    renderResults();
    updateURL();
}

function updateURL() {
    const params = new URLSearchParams();
    
    // Search term
    const searchTerm = searchInput.value.trim();
    if (searchTerm) params.set('search', searchTerm);
    
    // Year filter
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
    
    // Update URL without reload
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
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!loadMore) {
        displayedCount = Math.min(INITIAL_ITEMS, filteredData.length);
        resultsContainer.innerHTML = '';
    } else {
        displayedCount = Math.min(displayedCount + ITEMS_PER_LOAD, filteredData.length);
        // Remove old show more button
        const oldBtn = document.getElementById('showMoreBtn');
        if (oldBtn) oldBtn.remove();
    }
    
    const itemsToShow = filteredData.slice(0, displayedCount);
    resultsContainer.innerHTML = itemsToShow.map(item => createCard(item, searchTerm)).join('');
    
    // Add "Show more" button if there are more items
    if (displayedCount < filteredData.length) {
        const remaining = filteredData.length - displayedCount;
        resultsContainer.innerHTML += `
            <div class="show-more-container">
                <button id="showMoreBtn" class="btn-show-more">Afficher plus (${remaining} restant${remaining > 1 ? 's' : ''})</button>
            </div>
        `;
        document.getElementById('showMoreBtn').addEventListener('click', () => renderResults(true));
    }
}

function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: "L'auteur cite le CDF" };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: "L'auteur et le Conseil fédéral citent le CDF" };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: "Le Conseil fédéral cite le CDF" };
    } else {
        return { emojis: '🧑', tooltip: "L'auteur cite le CDF" };
    }
}

function translateType(type) {
    const translations = {
        'Interpellation': 'Interpellation',
        'Ip.': 'Ip.',
        'Motion': 'Motion',
        'Mo.': 'Mo.',
        'Fragestunde': 'Heure des questions',
        'Fra.': 'Heure des questions',
        'Geschäft des Bundesrates': 'Objet du Conseil fédéral',
        'Postulat': 'Postulat',
        'Po.': 'Po.',
        'Anfrage': 'Question',
        'A.': 'Question',
        'Parlamentarische Initiative': 'Initiative parlementaire',
        'Pa.Iv.': 'Iv.pa.',
        'Geschäft des Parlaments': 'Objet du Parlement'
    };
    return translations[type] || type;
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
    const frMissing = isTitleMissing(item.title);
    const displayTitle = frMissing && item.title_de ? item.title_de : (item.title || item.title_de);
    const title = highlightText(displayTitle, searchTerm);
    const langWarning = frMissing && item.title_de ? '<span class="lang-warning">🇩🇪 Uniquement en allemand pour le moment</span>' : '';
    
    const authorName = translateAuthor(item.author || '');
    const partyFR = translateParty(item.party || '');
    const authorWithParty = partyFR ? `${authorName} (${partyFR})` : authorName;
    const author = highlightText(authorWithParty, searchTerm);
    
    // Marquer comme nouveau si c'est un vrai nouvel objet (dans new_ids)
    const isNew = newIds.includes(item.shortId);
    const shortId = highlightText(item.shortId, searchTerm);
    
    const date = item.date ? new Date(item.date).toLocaleDateString('fr-CH') : '';
    const dateMaj = item.date_maj ? new Date(item.date_maj).toLocaleDateString('fr-CH') : '';
    // Afficher 🔄 si date de mise à jour existe et différente de la date de dépôt
    const showDateMaj = dateMaj && dateMaj !== date;
    const url = item.url_fr || item.url_de;
    const mentionData = getMentionEmojis(item.mention);
    
    // Status badge color
    let statusClass = 'badge-status';
    if (item.status?.includes('Erledigt') || item.status?.includes('Liquidé')) {
        statusClass += ' badge-done';
    }
    
    return `
        <article class="card${isNew ? ' card-new' : ''}">
            <div class="card-header">
                <span class="card-id">${shortId}</span>
                <div class="card-badges">
                    <span class="badge badge-type">${translateType(item.type)}</span>
                    <span class="badge badge-council">${item.council === 'NR' ? 'CN' : 'CE'}</span>
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
            ${item.status ? `<div style="margin-top: 0.5rem;"><span class="badge ${statusClass}">${getStatusFR(item.status)}</span></div>` : ''}
        </article>
    `;
}

function createPagination(totalPages) {
    return `
        <div class="pagination">
            <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>← Précédent</button>
            <span>Page ${currentPage} / ${totalPages}</span>
            <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>Suivant →</button>
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
    
    // Surligner uniquement les mots entiers
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
    // Créer une regex avec word boundaries pour éviter les correspondances partielles
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
            <h3>Erreur</h3>
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

function getStatusFR(status) {
    if (!status) return '';
    if (status.includes('/')) {
        return status.split('/')[1].trim();
    }
    return status;
}

function downloadFilteredData() {
    if (filteredData.length === 0) {
        alert('Aucune donnée à exporter');
        return;
    }
    
    const headers = ['ID', 'Type', 'Titre', 'Auteur', 'Parti', 'Conseil', 'Date', 'Statut', 'Lien'];
    const rows = filteredData.map(item => [
        item.id || '',
        item.type || '',
        (item.title || '').replace(/"/g, '""'),
        (item.author || '').replace(/"/g, '""'),
        item.party || '',
        item.council || '',
        item.date || '',
        getStatusFR(item.status),
        item.url_fr || ''
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
    link.download = `Objets_CDF_EFK_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
