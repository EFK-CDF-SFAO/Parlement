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
        
        if (json.meta && json.meta.updated) {
            const date = new Date(json.meta.updated);
            lastUpdate.textContent = `Aggiornamento: ${date.toLocaleDateString('it-CH')}`;
        }
        
        displaySessionSummary(json.session_summary);
        populateYearFilter();
        populatePartyFilter();
        initDropdownFilters();
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
        const filterParty = urlParams.get('filter_party');
        const filterType = urlParams.get('filter_type');
        
        if (filterParty) {
            applyFilterFromUrl('partyDropdown', filterParty);
        }
        if (filterType) {
            applyFilterFromUrl('typeDropdown', filterType);
        }
        
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

function translateParty(party) {
    const translations = {
        'Al': 'Verdi',
        'VERT-E-S': 'Verdi',
        'PSS': 'PS',
        'PS': 'PS',
        'M-E': 'Alleanza del Centro',
        'Le Centre': 'Alleanza del Centro',
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
        'Groupe de l\'Union démocratique du centre': 'Gruppo dell\'Unione democratica di centro',
        'Fraktion der Mitte': 'Gruppo del Centro',
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
    if (author.includes('SVP') || author.includes('UDC')) return 'UDC';
    if (author.includes('SP ') || author.includes('PS ') || author.includes('socialista')) return 'PS';
    if (author.includes('Grüne') || author.includes('Verts') || author.includes('Verdi')) return 'Verdi';
    if (author.includes('Mitte') || author.includes('Centre') || author.includes('Centro')) return 'Alleanza del Centro';
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

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValues = getCheckedValues('typeDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const yearValues = getCheckedValues('yearDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    
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
        
        if (partyValues.length > 0) {
            const itemParty = translateParty(item.party) || getPartyFromAuthor(item.author);
            if (!partyValues.includes(itemParty)) {
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
                <span>📅 ${date}</span>
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
        'Liquidé': 'Liquidato',
        'Erledigt': 'Liquidato',
        'Im Rat noch nicht behandelt': 'Non ancora trattato',
        'Au Conseil, pas encore traité': 'Non ancora trattato',
        'Angenommen': 'Accettato',
        'Adopté': 'Accettato',
        'Abgelehnt': 'Respinto',
        'Rejeté': 'Respinto',
        'Zurückgezogen': 'Ritirato',
        'Retiré': 'Ritirato'
    };
    
    if (status.includes('/')) {
        const parts = status.split('/');
        const frStatus = parts[1]?.trim();
        return translations[frStatus] || frStatus || status;
    }
    return translations[status] || status;
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
        (item.title || '').replace(/"/g, '""'),
        (item.author || '').replace(/"/g, '""'),
        item.party || '',
        item.council || '',
        item.date || '',
        getStatusIT(item.status),
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
    link.download = `Oggetti_CDF_EFK_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}
