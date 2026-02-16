let allData = [];

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
    'Fra.': 'Frage'
};

const typeToFilter = {
    'Motion': 'Mo.',
    'Postulat': 'Po.',
    'Interpellation': 'Ip.',
    'Frage': 'Fra.'
};

const partyToFilter = {
    'SP': 'PS',
    'SVP': 'UDC',
    'FDP': 'PLR',
    'Die Mitte': 'Le Centre',
    'GRÜNE': 'VERT-E-S',
    'GLP': 'PVL'
};

async function init() {
    try {
        const response = await fetch('cdf_efk_data.json');
        const data = await response.json();
        allData = data.items || [];
        
        renderPartyChart();
        renderTypeChart();
        renderYearChart();
        renderTopAuthors();
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
        'Centre': 'Die Mitte'
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
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336'];
    
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
                    window.location.href = `index_de.html?filter_type=${encodeURIComponent(filterValue)}`;
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

document.addEventListener('DOMContentLoaded', init);
