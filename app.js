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

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearButton = document.getElementById('clearSearch');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');
const downloadBtn = document.getElementById('downloadBtn');
const resetFiltersBtn = document.getElementById('resetFilters');

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
            lastUpdate.textContent = `Mise à jour: ${date.toLocaleDateString('fr-CH')}`;
        }
        
        // Display session summary if available
        displaySessionSummary(json.session_summary);
        
        // Populate year and party filters
        populateYearFilter();
        populatePartyFilter();
        
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
        
        if (filterParty) {
            applyFilterFromUrl('partyDropdown', filterParty);
        }
        if (filterType) {
            applyFilterFromUrl('typeDropdown', filterType);
        }
        
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
            const party = summary.interventions.party[i] || '';
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

function translateParty(party) {
    const translations = {
        'Al': 'VERT-E-S',
        'PSS': 'PS',
        'M-E': 'Le Centre'
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
        'Fraktion der Mitte': 'Groupe du Centre',
        'Grünliberale Fraktion': 'Groupe vert\'libéral'
    };
    return translations[author] || author;
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

function getCheckedValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return [];
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:checked:not([data-select-all])');
    return Array.from(checkboxes).map(cb => cb.value).filter(v => v);
}

function updateFilterCount(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    const count = dropdown.querySelectorAll('input[type="checkbox"]:checked').length;
    const countSpan = dropdown.querySelector('.filter-count');
    if (!countSpan) return;
    if (count > 0) {
        countSpan.textContent = count;
        countSpan.classList.add('active');
    } else {
        countSpan.textContent = '';
        countSpan.classList.remove('active');
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
    applyFilters();
}

function applyFilterFromUrl(dropdownId, filterValue) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    // Uncheck "Tous"
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

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValues = getCheckedValues('typeDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const yearValues = getCheckedValues('yearDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    
    filteredData = allData.filter(item => {
        // Text search
        if (searchTerm) {
            const searchFields = [
                item.shortId,
                item.title,
                item.title_de,
                item.author,
                item.type,
                item.status
            ].filter(Boolean).map(f => f.toLowerCase());
            
            if (!searchFields.some(f => f.includes(searchTerm))) {
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
        
        // Party filter (multiple)
        if (partyValues.length > 0) {
            const itemParty = translateParty(item.party) || getPartyFromAuthor(item.author);
            if (!partyValues.includes(itemParty)) {
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
    
    // Souligner le numéro si c'est un vrai nouvel objet (dans new_ids)
    const isNew = newIds.includes(item.shortId);
    const shortIdHighlighted = highlightText(item.shortId, searchTerm);
    const shortId = isNew ? `<span class="id-updated">${shortIdHighlighted}</span>` : shortIdHighlighted;
    
    const date = item.date ? new Date(item.date).toLocaleDateString('fr-CH') : '';
    const url = item.url_fr || item.url_de;
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
                <span>📅 ${date}</span>
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
    
    const regex = new RegExp(`(${escapeRegex(searchTerm)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        item.url || ''
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
