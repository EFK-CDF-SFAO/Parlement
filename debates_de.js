let allData = [];
let filteredData = [];

const searchInput = document.getElementById('searchInput');
const clearSearch = document.getElementById('clearSearch');
const resultsContainer = document.getElementById('results');
const resultsCount = document.getElementById('resultsCount');
const sessionInfo = document.getElementById('sessionInfo');
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
        
        if (data.meta) {
            const updated = new Date(data.meta.updated);
            sessionInfo.textContent = `Aktualisiert: ${updated.toLocaleDateString('de-CH')}`;
        }
        
        populateSessionFilter();
        populateCouncilFilter();
        populatePartyFilter();
        initDropdownFilters();
        
        filteredData = [...allData];
        applyFilters();
        
        setupEventListeners();
    } catch (error) {
        console.error('Error loading data:', error);
        resultsContainer.innerHTML = '<p class="error">Fehler beim Laden der Daten</p>';
    }
}

// Session-Mapping
const sessionLabels = {
    '5211': 'Wintersession 2025',
    '5210': 'Herbstsession 2024',
    '5209': 'Sommersession 2024',
    '5208': 'Frühjahrssession 2024'
};

function populateSessionFilter() {
    const sessionMenu = document.getElementById('sessionMenu');
    const sessions = [...new Set(allData.map(item => item.id_session).filter(Boolean))];
    sessions.sort().reverse();
    
    const allLabel = document.createElement('label');
    allLabel.className = 'select-all';
    allLabel.innerHTML = `<input type="checkbox" data-select-all checked> Alle`;
    sessionMenu.appendChild(allLabel);
    
    sessions.forEach(session => {
        const label = document.createElement('label');
        const displayName = sessionLabels[session] || `Session ${session}`;
        label.innerHTML = `<input type="checkbox" value="${session}"> ${displayName}`;
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
    const sessionValues = getCheckedValues('sessionDropdown');
    const councilValues = getCheckedValues('councilDropdown');
    const partyValues = getCheckedValues('partyDropdown');
    
    filteredData = allData.filter(item => {
        if (searchTerm) {
            const searchFields = [
                item.speaker,
                item.text,
                item.party,
                item.canton
            ].filter(Boolean).join(' ').toLowerCase();
            
            if (!searchFields.includes(searchTerm)) {
                return false;
            }
        }
        
        if (sessionValues && !sessionValues.includes(item.id_session)) {
            return false;
        }
        
        if (councilValues && !councilValues.includes(item.council)) {
            return false;
        }
        
        if (partyValues && !partyValues.includes(item.party)) {
            return false;
        }
        
        return true;
    });
    
    renderResults();
}

function formatDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}.${month}.${year}`;
}

function highlightEFK(text) {
    const patterns = [
        /\bCDF\b/gi,
        /\bEFK\b/gi,
        /Contrôle fédéral des finances/gi,
        /Eidgenössische Finanzkontrolle/gi
    ];
    
    let result = text;
    patterns.forEach(pattern => {
        result = result.replace(pattern, '<mark>$&</mark>');
    });
    
    return result;
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card debate-card';
    
    const councilDisplay = councilLabels[item.council] || item.council;
    const partyDisplay = getPartyDisplay(item);
    
    const textPreview = item.text.length > 400 
        ? item.text.substring(0, 400) + '...' 
        : item.text;
    
    // Lien vers l'intervention avec ancre #votumX
    const votumAnchor = item.sort_order ? `#votum${item.sort_order}` : '';
    const bulletinUrl = item.id_subject 
        ? `https://www.parlament.ch/de/ratsbetrieb/amtliches-bulletin/amtliches-bulletin-die-verhandlungen?SubjectId=${item.id_subject}${votumAnchor}`
        : null;
    
    const speakerLink = bulletinUrl 
        ? `<a href="${bulletinUrl}" target="_blank" class="speaker-link" title="Vollständige Intervention ansehen">${item.speaker}</a>`
        : item.speaker;
    
    // Lien vers l'objet parlementaire sur Curia Vista
    const curiaVistaUrl = item.affair_id 
        ? `https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=${item.affair_id}`
        : null;
    
    const businessInfo = (item.business_title && item.business_number) 
        ? `<div class="card-business">
            <a href="${curiaVistaUrl}" target="_blank" class="business-link" title="Geschäft auf Curia Vista ansehen">
                ${item.business_title} (${item.business_number})
            </a>
           </div>`
        : '';
    
    card.innerHTML = `
        <div class="card-header">
            <div class="card-meta">
                <span class="badge badge-council">${councilDisplay}</span>
            </div>
        </div>
        ${businessInfo}
        <div class="card-body">
            <div class="speaker-info">
                <span class="speaker-name">🗣️ ${speakerLink} (${partyDisplay}, ${item.canton || ''})</span>
                <span class="speaker-details">··· 📅 ${formatDate(item.date)}</span>
            </div>
            <div class="card-text">${highlightEFK(textPreview)}</div>
        </div>
    `;
    
    if (item.text.length > 400) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'btn-expand';
        expandBtn.textContent = 'Mehr anzeigen';
        expandBtn.addEventListener('click', () => {
            const textDiv = card.querySelector('.card-text');
            if (expandBtn.textContent === 'Mehr anzeigen') {
                textDiv.innerHTML = highlightEFK(item.text);
                expandBtn.textContent = 'Weniger anzeigen';
            } else {
                textDiv.innerHTML = highlightEFK(textPreview);
                expandBtn.textContent = 'Mehr anzeigen';
            }
        });
        card.querySelector('.card-body').appendChild(expandBtn);
    }
    
    return card;
}

function renderResults() {
    resultsContainer.innerHTML = '';
    resultsCount.textContent = `${filteredData.length} ${filteredData.length !== 1 ? 'Interventionen' : 'Intervention'} gefunden`;
    
    if (filteredData.length === 0) {
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <h3>Keine Ergebnisse</h3>
                <p>Versuchen Sie, Ihre Suchkriterien anzupassen</p>
            </div>
        `;
        return;
    }
    
    filteredData.forEach(item => {
        resultsContainer.appendChild(createCard(item));
    });
}

document.addEventListener('DOMContentLoaded', init);
