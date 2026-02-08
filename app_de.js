// Configuration
const DATA_URL = 'cdf_efk_data.json';
const ITEMS_PER_PAGE = 20;

// State
let allData = [];
let filteredData = [];
let currentPage = 1;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearButton = document.getElementById('clearSearch');
const typeFilter = document.getElementById('typeFilter');
const councilFilter = document.getElementById('councilFilter');
const yearFilter = document.getElementById('yearFilter');
const partyFilter = document.getElementById('partyFilter');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    showLoading();
    try {
        const response = await fetch(DATA_URL);
        const json = await response.json();
        allData = json.items || [];
        
        // Display last update
        if (json.meta && json.meta.updated) {
            const date = new Date(json.meta.updated);
            lastUpdate.textContent = `Aktualisiert: ${date.toLocaleDateString('de-CH')}`;
        }
        
        // Display session summary if available
        displaySessionSummary(json.session_summary);
        
        // Populate year and party filters
        populateYearFilter();
        populatePartyFilter();
        
        // Check for search parameter in URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            searchInput.value = searchParam;
        }
        
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
        'Centre': 'Mitte'
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
    typeFilter.addEventListener('change', applyFilters);
    councilFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    partyFilter.addEventListener('change', applyFilters);
    
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
    const years = [...new Set(allData.map(item => item.date?.substring(0, 4)).filter(Boolean))];
    years.sort((a, b) => b - a);
    
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
}

function populatePartyFilter() {
    const parties = [...new Set(allData.map(item => item.party).filter(Boolean))];
    parties.sort();
    
    parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        option.textContent = translateParty(party);
        partyFilter.appendChild(option);
    });
}

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValue = typeFilter.value;
    const councilValue = councilFilter.value;
    const yearValue = yearFilter.value;
    const partyValue = partyFilter.value;
    
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
        
        // Type filter
        if (typeValue && item.type !== typeValue) {
            return false;
        }
        
        // Council filter
        if (councilValue && item.council !== councilValue) {
            return false;
        }
        
        // Year filter
        if (yearValue && !item.date?.startsWith(yearValue)) {
            return false;
        }
        
        // Party filter (includes groups/factions)
        if (partyValue) {
            const itemParty = item.party || getPartyFromAuthor(item.author);
            if (itemParty !== partyValue) {
                return false;
            }
        }
        
        return true;
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

function renderResults() {
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = filteredData.slice(start, end);
    
    // Update count
    resultsCount.textContent = `${filteredData.length} Vorstoss${filteredData.length !== 1 ? 'e' : ''} gefunden`;
    
    if (pageData.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Keine Ergebnisse</h3>
                <p>Versuchen Sie, Ihre Suchkriterien anzupassen</p>
            </div>
        `;
        return;
    }
    
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    resultsContainer.innerHTML = pageData.map(item => createCard(item, searchTerm)).join('');
    
    // Add pagination if needed
    if (totalPages > 1) {
        resultsContainer.innerHTML += createPagination(totalPages);
        setupPaginationListeners();
    }
}

function createCard(item, searchTerm) {
    const title = highlightText(item.title_de || item.title, searchTerm);
    const authorName = translateAuthor(item.author || '');
    const partyDE = translateParty(item.party || '');
    const authorWithParty = partyDE ? `${authorName} (${partyDE})` : authorName;
    const author = highlightText(authorWithParty, searchTerm);
    const shortId = highlightText(item.shortId, searchTerm);
    
    const date = item.date ? new Date(item.date).toLocaleDateString('de-CH') : '';
    const url = item.url_de || item.url_fr;
    
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
                    <span class="badge badge-type">${item.type}</span>
                    <span class="badge badge-council">${item.council === 'NR' ? 'NR' : 'SR'}</span>
                </div>
            </div>
            <h3 class="card-title">
                <a href="${url}" target="_blank" rel="noopener">${title}</a>
            </h3>
            <div class="card-meta">
                <span>👤 ${author}</span>
                <span>📅 ${date}</span>
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
