let allData = [];
let filteredData = [];
let debatesData = [];
let filteredDebatesData = [];
let partyChartInstance = null;
let typeChartInstance = null;
let yearChartInstance = null;
let debatePartyChartInstance = null;
let debateCouncilChartInstance = null;

const partyColors = {
    'SVP': '#009F4D',
    'UDC': '#009F4D',
    'SP': '#E53935',
    'PSS': '#E53935',
    'PS': '#E53935',
    'FDP': '#0066CC',
    'PLR': '#0066CC',
    'Die Mitte': '#FF9800',
    'Le Centre': '#FF9800',
    'Centre': '#FF9800',
    'M-E': '#FF9800',
    'GRÜNE': '#8BC34A',
    'VERT-E-S': '#8BC34A',
    'Les Vert-e-s': '#8BC34A',
    'Al': '#8BC34A',
    'GLP': '#CDDC39',
    'pvl': '#CDDC39',
    'PVL': '#CDDC39'
};

const partyLabels = {
    'UDC': 'SVP',
    'PSS': 'SP',
    'PS': 'SP',
    'PLR': 'FDP',
    'Le Centre': 'Die Mitte',
    'Centre': 'Die Mitte',
    'M-E': 'Die Mitte',
    'VERT-E-S': 'GRÜNE',
    'Les Vert-e-s': 'GRÜNE',
    'Al': 'GRÜNE',
    'pvl': 'GLP',
    'PVL': 'GLP'
};

const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Fragestunde',
    'A.': 'Anfrage'
};

const typeToFilter = {
    'Motion': 'Mo.',
    'Postulat': 'Po.',
    'Interpellation': 'Ip.',
    'Fragestunde': 'Fra.',
    'Anfrage': 'A.'
};

const partyToFilter = {
    'SP': 'SP',
    'SVP': 'SVP',
    'FDP': 'FDP',
    'Die Mitte': 'Die Mitte',
    'GRÜNE': 'GRÜNE',
    'GLP': 'GLP'
};

async function init() {
    try {
        const response = await fetch('cdf_efk_data.json');
        const data = await response.json();
        allData = data.items || [];
        filteredData = [...allData];
        
        populateObjectFilters();
        setupObjectFilterListeners();
        renderAllObjectCharts();
        
        // Charger les données des débats
        const debatesResponse = await fetch('debates_data.json');
        const debatesJson = await debatesResponse.json();
        debatesData = debatesJson.items || [];
        filteredDebatesData = [...debatesData];
        
        populateDebateFilters();
        setupDebateFilterListeners();
        renderAllDebateCharts();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function populateObjectFilters() {
    // Populer filtre années
    const yearFilter = document.getElementById('objectYearFilter');
    const years = [...new Set(allData.map(d => {
        if (d.SubmissionDate) return d.SubmissionDate.substring(0, 4);
        return null;
    }).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Populer filtre partis
    const partyFilter = document.getElementById('objectPartyFilter');
    const parties = [...new Set(allData.map(d => {
        const party = getPartyFromAuthor(d.SubmittedBy) || d.SubmittedBy;
        return partyLabels[party] || party;
    }).filter(Boolean))];
    parties.sort();
    parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        option.textContent = party;
        partyFilter.appendChild(option);
    });
}

function setupObjectFilterListeners() {
    document.getElementById('objectYearFilter').addEventListener('change', applyObjectFilters);
    document.getElementById('objectCouncilFilter').addEventListener('change', applyObjectFilters);
    document.getElementById('objectPartyFilter').addEventListener('change', applyObjectFilters);
}

function applyObjectFilters() {
    const yearFilter = document.getElementById('objectYearFilter').value;
    const councilFilter = document.getElementById('objectCouncilFilter').value;
    const partyFilter = document.getElementById('objectPartyFilter').value;
    
    filteredData = allData.filter(item => {
        if (yearFilter && item.SubmissionDate) {
            if (!item.SubmissionDate.startsWith(yearFilter)) return false;
        }
        if (councilFilter && item.SubmissionCouncilAbbreviation !== councilFilter) return false;
        if (partyFilter) {
            const itemParty = getPartyFromAuthor(item.SubmittedBy) || item.SubmittedBy;
            const normalizedParty = partyLabels[itemParty] || itemParty;
            if (normalizedParty !== partyFilter) return false;
        }
        return true;
    });
    
    renderAllObjectCharts();
}

function renderAllObjectCharts() {
    renderPartyChart();
    renderTypeChart();
    renderYearChart();
    renderTopAuthors();
}

function populateDebateFilters() {
    // Populer filtre années
    const yearFilter = document.getElementById('debateYearFilter');
    const years = [...new Set(debatesData.map(d => d.date ? d.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearFilter.appendChild(option);
    });
    
    // Populer filtre partis
    const partyFilter = document.getElementById('debatePartyFilter');
    const parties = [...new Set(debatesData.map(d => {
        if (!d.party) return 'Bundesrat';
        return debatePartyLabels[d.party] || d.party;
    }))];
    parties.sort();
    parties.forEach(party => {
        const option = document.createElement('option');
        option.value = party;
        option.textContent = party;
        partyFilter.appendChild(option);
    });
}

function setupDebateFilterListeners() {
    document.getElementById('debateYearFilter').addEventListener('change', applyDebateFilters);
    document.getElementById('debateCouncilFilter').addEventListener('change', applyDebateFilters);
    document.getElementById('debatePartyFilter').addEventListener('change', applyDebateFilters);
}

function applyDebateFilters() {
    const yearFilter = document.getElementById('debateYearFilter').value;
    const councilFilter = document.getElementById('debateCouncilFilter').value;
    const partyFilter = document.getElementById('debatePartyFilter').value;
    
    filteredDebatesData = debatesData.filter(item => {
        if (yearFilter && item.date) {
            if (!item.date.startsWith(yearFilter)) return false;
        }
        if (councilFilter && item.council !== councilFilter) return false;
        if (partyFilter) {
            const itemParty = item.party ? (debatePartyLabels[item.party] || item.party) : 'Bundesrat';
            if (itemParty !== partyFilter) return false;
        }
        return true;
    });
    
    renderAllDebateCharts();
}

function renderAllDebateCharts() {
    renderDebatePartyChart();
    renderDebateCouncilChart();
    renderTopSpeakers();
    renderDebateSummary();
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

function normalizeParty(party) {
    const normalized = {
        'UDC': 'SVP',
        'PSS': 'SP',
        'PS': 'SP',
        'PLR': 'FDP',
        'VERT-E-S': 'GRÜNE',
        'Les Vert-e-s': 'GRÜNE',
        'Al': 'GRÜNE',
        'pvl': 'GLP',
        'PVL': 'GLP',
        'Le Centre': 'Die Mitte',
        'Centre': 'Die Mitte',
        'M-E': 'Die Mitte'
    };
    return normalized[party] || party;
}

function renderPartyChart() {
    if (partyChartInstance) {
        partyChartInstance.destroy();
    }
    
    const partyCounts = {};
    
    filteredData.forEach(item => {
        let party = item.party || getPartyFromAuthor(item.author);
        if (party) {
            party = normalizeParty(party);
            partyCounts[party] = (partyCounts[party] || 0) + 1;
        }
    });
    
    const sortedParties = Object.entries(partyCounts)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedParties.map(([party]) => party);
    const data = sortedParties.map(([, count]) => count);
    const colors = labels.map(party => {
        for (const [key, color] of Object.entries(partyColors)) {
            if (normalizeParty(key) === party) return color;
        }
        return '#999';
    });
    
    const ctx = document.getElementById('partyChart').getContext('2d');
    partyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vorstösse',
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const party = labels[index];
                    const filterValue = partyToFilter[party] || party;
                    window.location.href = `index_de.html?filter_party=${encodeURIComponent(filterValue)}`;
                }
            }
        }
    });
}

function renderTypeChart() {
    if (typeChartInstance) {
        typeChartInstance.destroy();
    }
    
    const typeCounts = {};
    
    filteredData.forEach(item => {
        const type = item.type;
        if (type) {
            const label = typeLabels[type] || type;
            typeCounts[label] = (typeCounts[label] || 0) + 1;
        }
    });
    
    const labels = Object.keys(typeCounts);
    const data = Object.values(typeCounts);
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4'];
    
    const ctx = document.getElementById('typeChart').getContext('2d');
    typeChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const typeLabel = labels[index];
                    const filterValue = typeToFilter[typeLabel] || typeLabel;
                    window.location.href = `index_de.html?filter_type=${encodeURIComponent(filterValue)}`;
                }
            }
        }
    });
}

function renderYearChart() {
    if (yearChartInstance) {
        yearChartInstance.destroy();
    }
    
    const yearCounts = {};
    
    filteredData.forEach(item => {
        if (item.date) {
            const year = item.date.substring(0, 4);
            yearCounts[year] = (yearCounts[year] || 0) + 1;
        }
    });
    
    const sortedYears = Object.entries(yearCounts)
        .sort((a, b) => a[0].localeCompare(b[0]));
    
    const labels = sortedYears.map(([year]) => year);
    const data = sortedYears.map(([, count]) => count);
    
    const ctx = document.getElementById('yearChart').getContext('2d');
    yearChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vorstösse',
                data: data,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#2196F3'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderTopAuthors() {
    const authorCounts = {};
    const authorParties = {};
    
    filteredData.forEach(item => {
        const author = item.author;
        if (author && !author.includes('Commission') && !author.includes('Kommission') && !author.includes('Fraktion')) {
            authorCounts[author] = (authorCounts[author] || 0) + 1;
            if (item.party) {
                authorParties[author] = normalizeParty(item.party);
            }
        }
    });
    
    const topAuthors = Object.entries(authorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('topAuthors');
    
    if (topAuthors.length === 0) {
        container.innerHTML = '<p>Keine Daten verfügbar</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topAuthors.forEach(([author, count], index) => {
        const party = authorParties[author] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `index_de.html?search=${encodeURIComponent(author)}`;
        
        html += `
            <a href="${searchUrl}" class="author-row ${medalClass}">
                <div class="author-rank">${index + 1}</div>
                <div class="author-info">
                    <div class="author-name">${author}</div>
                    <div class="author-party">${party}</div>
                </div>
                <div class="author-count">${count}</div>
            </a>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

// ========== DEBATTEN-STATISTIKEN ==========

const debatePartyLabels = {
    'V': 'SVP',
    'S': 'SP',
    'RL': 'FDP',
    'M-E': 'Die Mitte',
    'G': 'GRÜNE',
    'GL': 'GLP',
    'BD': 'BDP',
    '': 'Bundesrat'
};

const councilLabelsDE = {
    'N': 'Nationalrat',
    'S': 'Ständerat'
};

function renderDebatePartyChart() {
    if (debatePartyChartInstance) {
        debatePartyChartInstance.destroy();
    }
    
    const partyCounts = {};
    
    filteredDebatesData.forEach(item => {
        const party = debatePartyLabels[item.party] || item.party || 'Bundesrat';
        partyCounts[party] = (partyCounts[party] || 0) + 1;
    });
    
    const sortedParties = Object.entries(partyCounts)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sortedParties.map(([party]) => party);
    const data = sortedParties.map(([, count]) => count);
    const colors = labels.map(party => {
        for (const [key, color] of Object.entries(partyColors)) {
            if (normalizeParty(key) === party) return color;
        }
        return '#999';
    });
    
    const ctx = document.getElementById('debatePartyChart').getContext('2d');
    debatePartyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Interventionen',
                data: data,
                backgroundColor: colors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { beginAtZero: true }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const party = labels[index];
                    window.location.href = `debates_de.html?filter_party=${encodeURIComponent(party)}`;
                }
            }
        }
    });
}

function renderDebateCouncilChart() {
    if (debateCouncilChartInstance) {
        debateCouncilChartInstance.destroy();
    }
    
    const councilCounts = {};
    
    filteredDebatesData.forEach(item => {
        const council = councilLabelsDE[item.council] || item.council || 'Andere';
        councilCounts[council] = (councilCounts[council] || 0) + 1;
    });
    
    const labels = Object.keys(councilCounts);
    const data = Object.values(councilCounts);
    const colors = ['#3949ab', '#7986cb'];
    
    const ctx = document.getElementById('debateCouncilChart').getContext('2d');
    debateCouncilChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const council = labels[index];
                    window.location.href = `debates_de.html?filter_council=${encodeURIComponent(council)}`;
                }
            }
        }
    });
}

function renderTopSpeakers() {
    const speakerCounts = {};
    const speakerParties = {};
    
    filteredDebatesData.forEach(item => {
        const speaker = item.speaker;
        if (speaker) {
            speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
            if (item.party) {
                speakerParties[speaker] = debatePartyLabels[item.party] || item.party;
            } else {
                speakerParties[speaker] = 'Bundesrat';
            }
        }
    });
    
    const topSpeakers = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('topSpeakers');
    
    if (topSpeakers.length === 0) {
        container.innerHTML = '<p>Keine Daten verfügbar</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topSpeakers.forEach(([speaker, count], index) => {
        const party = speakerParties[speaker] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `debates_de.html?search=${encodeURIComponent(speaker)}`;
        
        html += `
            <a href="${searchUrl}" class="author-row ${medalClass}">
                <div class="author-rank">${index + 1}</div>
                <div class="author-info">
                    <div class="author-name">${speaker}</div>
                    <div class="author-party">${party}</div>
                </div>
                <div class="author-count">${count}</div>
            </a>
        `;
    });
    html += '</div>';
    
    container.innerHTML = html;
}

function renderDebateSummary() {
    const container = document.getElementById('debateSummary');
    
    const totalDebates = filteredDebatesData.length;
    const uniqueSpeakers = new Set(filteredDebatesData.map(d => d.speaker)).size;
    const uniqueObjects = new Set(filteredDebatesData.map(d => d.business_number).filter(Boolean)).size;
    
    container.innerHTML = `
        <div class="summary-stats">
            <div class="summary-item">
                <span class="summary-value">${totalDebates}</span>
                <span class="summary-label">Interventionen</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueSpeakers}</span>
                <span class="summary-label">Redner</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueObjects}</span>
                <span class="summary-label">Behandelte Geschäfte</span>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
