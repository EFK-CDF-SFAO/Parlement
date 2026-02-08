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
        
        // Populate year filter
        populateYearFilter();
        
        // Initial display
        filteredData = [...allData];
        renderResults();
        
        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Fehler beim Laden der Daten');
    }
}

function setupEventListeners() {
    searchInput.addEventListener('input', debounce(applyFilters, 300));
    clearButton.addEventListener('click', clearSearch);
    typeFilter.addEventListener('change', applyFilters);
    councilFilter.addEventListener('change', applyFilters);
    yearFilter.addEventListener('change', applyFilters);
    
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

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const typeValue = typeFilter.value;
    const councilValue = councilFilter.value;
    const yearValue = yearFilter.value;
    
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
    const author = highlightText(item.author, searchTerm);
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
