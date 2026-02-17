let allData = [];
let debatesData = [];

const partyColors = {
    'UDC': '#009F4D',
    'PSS': '#E53935',
    'PS': '#E53935',
    'PLR': '#0066CC',
    'Le Centre': '#FF9800',
    'Centre': '#FF9800',
    'M-E': '#FF9800',
    'VERT-E-S': '#8BC34A',
    'Les Vert-e-s': '#8BC34A',
    'Al': '#8BC34A',
    'pvl': '#CDDC39',
    'PVL': '#CDDC39'
};

const partyLabels = {
    'UDC': 'UDC',
    'PSS': 'PS',
    'PS': 'PS',
    'PLR': 'PLR',
    'Le Centre': 'Le Centre',
    'Centre': 'Le Centre',
    'M-E': 'Le Centre',
    'VERT-E-S': 'Verts',
    'Les Vert-e-s': 'Verts',
    'Al': 'Verts',
    'pvl': 'Vert\'libéraux',
    'PVL': 'Vert\'libéraux'
};

const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Heure des questions',
    'A.': 'Question'
};

const typeToFilter = {
    'Motion': 'Mo.',
    'Postulat': 'Po.',
    'Interpellation': 'Ip.',
    'Heure des questions': 'Fra.',
    'Question': 'A.'
};

const partyToFilter = {
    'PS': 'PS',
    'UDC': 'UDC',
    'PLR': 'PLR',
    'Le Centre': 'Le Centre',
    'Verts': 'VERT-E-S',
    'Vert\'libéraux': 'pvl'
};

async function init() {
    try {
        // Charger les données des objets parlementaires
        const response = await fetch('cdf_efk_data.json');
        const data = await response.json();
        allData = data.items || [];
        
        renderPartyChart();
        renderTypeChart();
        renderYearChart();
        renderTopAuthors();
        
        // Charger les données des débats
        const debatesResponse = await fetch('debates_data.json');
        const debatesJson = await debatesResponse.json();
        debatesData = debatesJson.items || [];
        
        renderDebatePartyChart();
        renderDebateCouncilChart();
        renderTopSpeakers();
        renderDebateSummary();
    } catch (error) {
        console.error('Error loading data:', error);
    }
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
        'PSS': 'PS',
        'PS': 'PS',
        'VERT-E-S': 'Verts',
        'Les Vert-e-s': 'Verts',
        'Al': 'Verts',
        'pvl': 'Vert\'libéraux',
        'PVL': 'Vert\'libéraux',
        'Le Centre': 'Le Centre',
        'Centre': 'Le Centre',
        'M-E': 'Le Centre'
    };
    return normalized[party] || party;
}

function renderPartyChart() {
    const partyCounts = {};
    
    allData.forEach(item => {
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
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Interventions',
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
                    window.location.href = `index.html?filter_party=${encodeURIComponent(filterValue)}`;
                }
            }
        }
    });
}

function renderTypeChart() {
    const typeCounts = {};
    
    allData.forEach(item => {
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
    new Chart(ctx, {
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
                    window.location.href = `index.html?filter_type=${encodeURIComponent(filterValue)}`;
                }
            }
        }
    });
}

function renderYearChart() {
    const yearCounts = {};
    
    allData.forEach(item => {
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
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Interventions',
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
    
    allData.forEach(item => {
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
        container.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topAuthors.forEach(([author, count], index) => {
        const party = authorParties[author] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `index.html?search=${encodeURIComponent(author)}`;
        
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

// ========== STATISTIQUES DÉBATS ==========

const debatePartyLabels = {
    'V': 'UDC',
    'S': 'PS',
    'RL': 'PLR',
    'M-E': 'Le Centre',
    'G': 'Verts',
    'GL': 'Vert\'libéraux',
    'BD': 'PBD'
};

const councilLabels = {
    'N': 'Conseil national',
    'S': 'Conseil des États'
};

function renderDebatePartyChart() {
    const partyCounts = {};
    
    debatesData.forEach(item => {
        const party = debatePartyLabels[item.party] || item.party || 'Autre';
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
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Interventions',
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
                    window.location.href = `debates.html?filter_party=${encodeURIComponent(party)}`;
                }
            }
        }
    });
}

function renderDebateCouncilChart() {
    const councilCounts = {};
    
    debatesData.forEach(item => {
        const council = councilLabels[item.council] || item.council || 'Autre';
        councilCounts[council] = (councilCounts[council] || 0) + 1;
    });
    
    const labels = Object.keys(councilCounts);
    const data = Object.values(councilCounts);
    const colors = ['#3949ab', '#7986cb'];
    
    const ctx = document.getElementById('debateCouncilChart').getContext('2d');
    new Chart(ctx, {
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
            }
        }
    });
}

function renderTopSpeakers() {
    const speakerCounts = {};
    const speakerParties = {};
    
    debatesData.forEach(item => {
        const speaker = item.speaker;
        if (speaker) {
            speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
            if (item.party) {
                speakerParties[speaker] = debatePartyLabels[item.party] || item.party;
            }
        }
    });
    
    const topSpeakers = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('topSpeakers');
    
    if (topSpeakers.length === 0) {
        container.innerHTML = '<p>Aucune donnée disponible</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topSpeakers.forEach(([speaker, count], index) => {
        const party = speakerParties[speaker] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `debates.html?search=${encodeURIComponent(speaker)}`;
        
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
    
    const totalDebates = debatesData.length;
    const uniqueSpeakers = new Set(debatesData.map(d => d.speaker)).size;
    const uniqueObjects = new Set(debatesData.map(d => d.business_number).filter(Boolean)).size;
    
    container.innerHTML = `
        <div class="summary-stats">
            <div class="summary-item">
                <span class="summary-value">${totalDebates}</span>
                <span class="summary-label">Interventions</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueSpeakers}</span>
                <span class="summary-label">Orateurs</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueObjects}</span>
                <span class="summary-label">Objets discutés</span>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
