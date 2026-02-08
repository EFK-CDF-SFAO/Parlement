// Configuration
const DATA_URL = 'cdf_efk_data.json';
const EXCEL_URL = 'Objets_parlementaires_CDF_EFK.xlsx';
const ITEMS_PER_PAGE = 50;

// State
let allData = [];
let sortedData = [];
let currentPage = 1;
let currentSort = { field: 'date', order: 'desc' };

// DOM Elements
const tableBody = document.getElementById('tableBody');
const resultsCount = document.getElementById('resultsCount');
const lastUpdate = document.getElementById('lastUpdate');
const sortSelect = document.getElementById('sortSelect');
const paginationContainer = document.getElementById('pagination');
const downloadBtn = document.getElementById('downloadBtn');

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
            lastUpdate.textContent = `Mise à jour: ${date.toLocaleDateString('fr-CH')}`;
        }
        
        // Initial sort and display
        sortData();
        renderTable();
        
        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        showError('Erreur lors du chargement des données');
    }
}

function setupEventListeners() {
    // Sort select
    sortSelect.addEventListener('change', () => {
        const [field, order] = sortSelect.value.split('-');
        currentSort = { field, order: order || 'asc' };
        currentPage = 1;
        sortData();
        renderTable();
    });
    
    // Table header sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.dataset.sort;
            if (currentSort.field === field) {
                currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.field = field;
                currentSort.order = 'asc';
            }
            currentPage = 1;
            updateSortSelect();
            sortData();
            renderTable();
            updateSortIndicators();
        });
    });
    
    // Download button
    downloadBtn.addEventListener('click', () => {
        window.open(EXCEL_URL, '_blank');
    });
}

function updateSortSelect() {
    const value = `${currentSort.field}-${currentSort.order}`;
    if ([...sortSelect.options].some(opt => opt.value === value)) {
        sortSelect.value = value;
    }
}

function updateSortIndicators() {
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
        if (th.dataset.sort === currentSort.field) {
            th.classList.add(`sorted-${currentSort.order}`);
        }
    });
}

function sortData() {
    sortedData = [...allData];
    
    sortedData.sort((a, b) => {
        let valA, valB;
        
        switch (currentSort.field) {
            case 'date':
                valA = a.date || '';
                valB = b.date || '';
                break;
            case 'id':
                valA = a.shortId || '';
                valB = b.shortId || '';
                break;
            case 'author':
                valA = (a.author || '').toLowerCase();
                valB = (b.author || '').toLowerCase();
                break;
            case 'type':
                valA = a.type || '';
                valB = b.type || '';
                break;
            case 'title':
                valA = (a.title || a.title_de || '').toLowerCase();
                valB = (b.title || b.title_de || '').toLowerCase();
                break;
            case 'council':
                valA = a.council || '';
                valB = b.council || '';
                break;
            case 'status':
                valA = a.status || '';
                valB = b.status || '';
                break;
            default:
                valA = a.date || '';
                valB = b.date || '';
        }
        
        let comparison = 0;
        if (valA < valB) comparison = -1;
        if (valA > valB) comparison = 1;
        
        return currentSort.order === 'desc' ? -comparison : comparison;
    });
}

function renderTable() {
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    const pageData = sortedData.slice(start, end);
    
    // Update count
    resultsCount.textContent = `${sortedData.length} intervention${sortedData.length !== 1 ? 's' : ''}`;
    
    if (pageData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem;">
                    Aucune donnée disponible
                </td>
            </tr>
        `;
        paginationContainer.innerHTML = '';
        return;
    }
    
    tableBody.innerHTML = pageData.map(item => createRow(item)).join('');
    renderPagination(totalPages);
    updateSortIndicators();
}

function createRow(item) {
    const date = item.date ? new Date(item.date).toLocaleDateString('fr-CH') : '';
    const url = item.url_fr || item.url_de;
    const title = item.title || item.title_de || '';
    const council = item.council === 'NR' ? 'CN' : 'CE';
    
    // Author with party (translated to French)
    const authorName = item.author || '';
    const partyFR = translateParty(item.party || '');
    const authorWithParty = partyFR ? `${authorName} (${partyFR})` : authorName;
    
    // Truncate title if too long
    const maxTitleLength = 80;
    const displayTitle = title.length > maxTitleLength 
        ? title.substring(0, maxTitleLength) + '...' 
        : title;
    
    // Shorten status
    let status = item.status || '';
    if (status.includes('/')) {
        status = status.split('/')[1].trim(); // Take French version
    }
    if (status.length > 30) {
        status = status.substring(0, 30) + '...';
    }
    
    // Mention (who cites CDF)
    const mention = item.mention || '';
    
    return `
        <tr>
            <td><a href="${url}" target="_blank" rel="noopener">${item.shortId}</a></td>
            <td>${item.type}</td>
            <td title="${escapeHtml(title)}">${escapeHtml(displayTitle)}</td>
            <td>${escapeHtml(authorWithParty)}</td>
            <td>${council}</td>
            <td>${date}</td>
            <td title="${escapeHtml(item.status || '')}">${escapeHtml(status)}</td>
            <td>${escapeHtml(mention)}</td>
        </tr>
    `;
}

function renderPagination(totalPages) {
    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let paginationHtml = `
        <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>← Précédent</button>
    `;
    
    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    if (startPage > 1) {
        paginationHtml += `<button class="page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHtml += `<span>...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHtml += `
            <button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>
        `;
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHtml += `<span>...</span>`;
        }
        paginationHtml += `<button class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    paginationHtml += `
        <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>Suivant →</button>
    `;
    
    paginationContainer.innerHTML = paginationHtml;
    
    // Setup pagination listeners
    document.getElementById('prevPage')?.addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPage')?.addEventListener('click', () => goToPage(currentPage + 1));
    document.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => goToPage(parseInt(btn.dataset.page)));
    });
}

function goToPage(page) {
    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);
    if (page >= 1 && page <= totalPages) {
        currentPage = page;
        renderTable();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function translateParty(party) {
    const translations = {
        'Al': 'Verts',
        'PSS': 'PS'
    };
    return translations[party] || party;
}

function showLoading() {
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem;">
                <div class="spinner" style="margin: 0 auto;"></div>
            </td>
        </tr>
    `;
}

function showError(message) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--primary);">
                ${message}
            </td>
        </tr>
    `;
}
