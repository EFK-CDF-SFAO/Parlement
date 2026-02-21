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
    'UDC': '#009F4D',
    'PSS': '#E53935',
    'PS': '#E53935',
    'PLR': '#0066CC',
    'Le Centre': '#FF9800',
    'Centre': '#FF9800',
    'M-E': '#FF9800',
    'PDC': '#FF9800',
    'PBD': '#FF9800',
    'CSPO': '#FF9800',
    'CVP': '#FF9800',
    'BDP': '#FF9800',
    'VERT-E-S': '#8BC34A',
    'Les Vert-e-s': '#8BC34A',
    'Al': '#8BC34A',
    'Vert\'libéraux': '#CDDC39',
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
    'PDC': 'Le Centre',
    'PBD': 'Le Centre',
    'CSPO': 'Le Centre',
    'CVP': 'Le Centre',
    'BDP': 'Le Centre',
    'VERT-E-S': 'VERT-E-S',
    'Les Vert-e-s': 'VERT-E-S',
    'Al': 'VERT-E-S',
    'pvl': 'Vert\'libéraux',
    'PVL': 'Vert\'libéraux'
};

const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Heure des questions',
    'A.': 'Question',
    'Pa. Iv.': 'Initiative parl.',
    'D.Ip.': 'Interpellation urgente',
    'BRG': 'Objet du CF'
};

function translateDept(deptDE) {
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
        'VBV': 'AF'
    };
    return translations[deptDE] || deptDE;
}

const typeToFilter = {
    'Motion': 'Mo.',
    'Postulat': 'Po.',
    'Interpellation': 'Ip.',
    'Heure des questions': 'Fra.',
    'Question': 'A.',
    'Initiative parl.': 'Pa. Iv.',
    'Interpellation urgente': 'D.Ip.',
    'Objet du CF': 'BRG'
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
        filteredData = [...allData];
        
        populateObjectFilters();
        setupObjectFilterListeners();
        renderAllObjectCharts();
        
        // Charger les données des débats
        const debatesResponse = await fetch('debates_data.json');
        const debatesJson = await debatesResponse.json();
        debatesData = debatesJson.items || [];
        // Trier du plus récent au plus vieux
        debatesData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        filteredDebatesData = [...debatesData];
        
        populateDebateFilters();
        setupDebateFilterListeners();
        renderAllDebateCharts();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function getCheckedValues(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    const selectAll = dropdown.querySelector('[data-select-all]');
    if (selectAll && selectAll.checked) return [];
    return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function setupDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const btn = dropdown.querySelector('.filter-btn');
    const menu = dropdown.querySelector('.filter-menu');
    const selectAll = dropdown.querySelector('[data-select-all]');
    const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
    const countSpan = dropdown.querySelector('.filter-count');
    
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.filter-dropdown.open').forEach(d => {
            if (d !== dropdown) d.classList.remove('open');
        });
        dropdown.classList.toggle('open');
    });
    
    function updateCount() {
        const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
        if (selectAll && selectAll.checked) {
            countSpan.textContent = '';
        } else if (checked > 0) {
            countSpan.textContent = `(${checked})`;
        } else {
            countSpan.textContent = '';
        }
    }
    
    if (selectAll) {
        selectAll.addEventListener('change', () => {
            checkboxes.forEach(cb => cb.checked = false);
            updateCount();
        });
    }
    
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked && selectAll) selectAll.checked = false;
            if (!Array.from(checkboxes).some(c => c.checked) && selectAll) selectAll.checked = true;
            updateCount();
        });
    });
    
    updateCount();
}

function populateObjectFilters() {
    // Populer filtre années
    const yearMenu = document.getElementById('objectYearMenu');
    const years = [...new Set(allData.map(d => d.date ? d.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
    
    // Populer filtre partis
    const partyMenu = document.getElementById('objectPartyMenu');
    const parties = [...new Set(allData.map(d => {
        const party = d.party || getPartyFromAuthor(d.author);
        return normalizeParty(party);
    }).filter(Boolean))];
    parties.sort((a, b) => a.localeCompare(b, 'fr'));
    parties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
    
    // Populer filtre départements
    const deptMenu = document.getElementById('objectDeptMenu');
    if (deptMenu) {
        const departments = [...new Set(allData.map(d => d.department).filter(Boolean))];
        departments.sort((a, b) => translateDept(a).localeCompare(translateDept(b), 'fr'));
        departments.forEach(dept => {
            const label = document.createElement('label');
            const deptFR = translateDept(dept);
            label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptFR}`;
            deptMenu.appendChild(label);
        });
    }
    
    // Setup dropdowns
    setupDropdown('objectYearDropdown');
    setupDropdown('objectCouncilDropdown');
    setupDropdown('objectPartyDropdown');
    setupDropdown('objectDeptDropdown');
    setupDropdown('objectLegislatureDropdown');
}

function setupObjectFilterListeners() {
    ['objectYearDropdown', 'objectCouncilDropdown', 'objectPartyDropdown', 'objectDeptDropdown', 'objectLegislatureDropdown'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyObjectFilters);
    });
    document.getElementById('resetObjectFilters').addEventListener('click', resetObjectFilters);
}

function resetObjectFilters() {
    ['objectYearDropdown', 'objectCouncilDropdown', 'objectPartyDropdown', 'objectDeptDropdown', 'objectLegislatureDropdown'].forEach(id => {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        const selectAll = dropdown.querySelector('[data-select-all]');
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
        if (selectAll) selectAll.checked = true;
        checkboxes.forEach(cb => cb.checked = false);
        const countSpan = dropdown.querySelector('.filter-count');
        if (countSpan) countSpan.textContent = '';
    });
    applyObjectFilters();
}

function getLegislature(date) {
    if (!date) return null;
    if (date >= '2023-12-01') return '52';
    if (date >= '2019-12-01') return '51';
    if (date >= '2015-12-01') return '50';
    return null;
}

function getLegislatureFromSession(sessionId) {
    if (!sessionId) return null;
    const sessionStr = String(sessionId);
    if (sessionStr.startsWith('52')) return '52';
    if (sessionStr.startsWith('51')) return '51';
    if (sessionStr.startsWith('50')) return '50';
    return null;
}

function applyObjectFilters() {
    const yearFilters = getCheckedValues('objectYearDropdown');
    const councilFilters = getCheckedValues('objectCouncilDropdown');
    const partyFilters = getCheckedValues('objectPartyDropdown');
    const deptFilters = getCheckedValues('objectDeptDropdown');
    const legislatureFilters = getCheckedValues('objectLegislatureDropdown');
    
    filteredData = allData.filter(item => {
        // Filtre année
        if (yearFilters.length > 0 && item.date) {
            const year = item.date.substring(0, 4);
            if (!yearFilters.includes(year)) return false;
        }
        // Filtre conseil (NR=N, SR=S)
        if (councilFilters.length > 0) {
            const councilCode = item.council === 'NR' ? 'N' : item.council === 'SR' ? 'S' : item.council;
            if (!councilFilters.includes(councilCode)) return false;
        }
        // Filtre parti
        if (partyFilters.length > 0) {
            const itemParty = item.party || getPartyFromAuthor(item.author);
            const normalizedParty = normalizeParty(itemParty);
            if (!partyFilters.includes(normalizedParty)) return false;
        }
        // Filtre département
        if (deptFilters.length > 0) {
            const itemDept = item.department || 'none';
            if (!deptFilters.includes(itemDept)) return false;
        }
        // Filtre législature
        if (legislatureFilters.length > 0) {
            const itemLegislature = getLegislature(item.date);
            if (!legislatureFilters.includes(itemLegislature)) return false;
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

const sessionTypes = {
    '5201': 'Hiver',
    '5202': 'Printemps',
    '5203': 'Spéciale',
    '5204': 'Été',
    '5205': 'Automne',
    '5206': 'Hiver',
    '5207': 'Printemps',
    '5208': 'Spéciale',
    '5209': 'Été',
    '5210': 'Automne',
    '5211': 'Hiver'
};

function populateDebateFilters() {
    // Populer filtre années
    const yearMenu = document.getElementById('debateYearMenu');
    const years = [...new Set(debatesData.map(d => d.date ? d.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
    
    // Populer filtre partis
    const partyMenu = document.getElementById('debatePartyMenu');
    const parties = [...new Set(debatesData.map(d => {
        if (!d.party) return 'Conseil fédéral';
        return debatePartyLabels[d.party] || d.party;
    }))];
    parties.sort((a, b) => a.localeCompare(b, 'fr'));
    parties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
    
    // Populer filtre départements
    const deptMenu = document.getElementById('debateDeptMenu');
    if (deptMenu) {
        const departments = [...new Set(debatesData.map(d => d.department).filter(Boolean))];
        departments.sort((a, b) => translateDept(a).localeCompare(translateDept(b), 'fr'));
        departments.forEach(dept => {
            const label = document.createElement('label');
            const deptFR = translateDept(dept);
            label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptFR}`;
            deptMenu.appendChild(label);
        });
    }
    
    // Setup dropdowns
    setupDropdown('debateYearDropdown');
    setupDropdown('debateSessionDropdown');
    setupDropdown('debateCouncilDropdown');
    setupDropdown('debatePartyDropdown');
    setupDropdown('debateDeptDropdown');
    setupDropdown('debateLegislatureDropdown');
}

function setupDebateFilterListeners() {
    ['debateYearDropdown', 'debateSessionDropdown', 'debateCouncilDropdown', 'debatePartyDropdown', 'debateDeptDropdown', 'debateLegislatureDropdown'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', applyDebateFilters);
    });
    document.getElementById('resetDebateFilters').addEventListener('click', resetDebateFilters);
}

function resetDebateFilters() {
    ['debateYearDropdown', 'debateSessionDropdown', 'debateCouncilDropdown', 'debatePartyDropdown', 'debateDeptDropdown', 'debateLegislatureDropdown'].forEach(id => {
        const dropdown = document.getElementById(id);
        if (!dropdown) return;
        const selectAll = dropdown.querySelector('[data-select-all]');
        const checkboxes = dropdown.querySelectorAll('input[type="checkbox"]:not([data-select-all])');
        if (selectAll) selectAll.checked = true;
        checkboxes.forEach(cb => cb.checked = false);
        const countSpan = dropdown.querySelector('.filter-count');
        if (countSpan) countSpan.textContent = '';
    });
    applyDebateFilters();
}

function applyDebateFilters() {
    const yearFilters = getCheckedValues('debateYearDropdown');
    const sessionFilters = getCheckedValues('debateSessionDropdown');
    const councilFilters = getCheckedValues('debateCouncilDropdown');
    const partyFilters = getCheckedValues('debatePartyDropdown');
    const deptFilters = getCheckedValues('debateDeptDropdown');
    const legislatureFilters = getCheckedValues('debateLegislatureDropdown');
    
    filteredDebatesData = debatesData.filter(item => {
        // Filtre année
        if (yearFilters.length > 0 && item.date) {
            const year = item.date.substring(0, 4);
            if (!yearFilters.includes(year)) return false;
        }
        // Filtre session (par type)
        if (sessionFilters.length > 0) {
            const sessionType = sessionTypes[item.id_session];
            if (!sessionFilters.includes(sessionType)) return false;
        }
        // Filtre conseil
        if (councilFilters.length > 0 && !councilFilters.includes(item.council)) return false;
        // Filtre parti
        if (partyFilters.length > 0) {
            const itemParty = item.party ? (debatePartyLabels[item.party] || item.party) : 'Conseil fédéral';
            if (!partyFilters.includes(itemParty)) return false;
        }
        // Filtre département
        if (deptFilters.length > 0) {
            const itemDept = item.department || 'none';
            if (!deptFilters.includes(itemDept)) return false;
        }
        // Filtre législature
        if (legislatureFilters.length > 0) {
            const itemLegislature = getLegislatureFromSession(item.id_session);
            if (!legislatureFilters.includes(itemLegislature)) return false;
        }
        return true;
    });
    
    filteredDebatesData.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    
    renderAllDebateCharts();
}

function renderAllDebateCharts() {
    renderDebatePartyChart();
    renderDebateCouncilChart();
    renderTopSpeakers();
    renderTopSpeakersNoCF();
    renderDebateSummary();
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

function normalizeParty(party) {
    const normalized = {
        'PSS': 'PS',
        'PS': 'PS',
        'VERT-E-S': 'VERT-E-S',
        'Les Vert-e-s': 'VERT-E-S',
        'Al': 'VERT-E-S',
        'pvl': 'Vert\'libéraux',
        'PVL': 'Vert\'libéraux',
        'Le Centre': 'Le Centre',
        'Centre': 'Le Centre',
        'M-E': 'Le Centre',
        'PDC': 'Le Centre',
        'PBD': 'Le Centre',
        'CSPO': 'Le Centre',
        'CVP': 'Le Centre',
        'BDP': 'Le Centre'
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
                x: { 
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
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
    const colors = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B', '#E91E63'];
    
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
                    position: 'bottom',
                    onClick: (event, legendItem, legend) => {
                        const index = legendItem.index;
                        const typeLabel = labels[index];
                        const filterValue = typeToFilter[typeLabel] || typeLabel;
                        window.location.href = `index.html?filter_type=${encodeURIComponent(filterValue)}`;
                    },
                    labels: {
                        cursor: 'pointer'
                    }
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

// Plugin pour effet pulsation sur les points
const pulsePlugin = {
    id: 'pulseEffect',
    afterDraw: (chart) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data) return;
        
        const time = Date.now() / 1000;
        const pulseRadius = 8 + Math.sin(time * 3) * 4; // Pulse entre 4 et 12
        const pulseOpacity = 0.3 + Math.sin(time * 3) * 0.2; // Opacity entre 0.1 et 0.5
        
        meta.data.forEach((point) => {
            const x = point.x;
            const y = point.y;
            
            // Cercle pulsant externe
            ctx.beginPath();
            ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(234, 90, 79, ${pulseOpacity})`;
            ctx.fill();
            ctx.closePath();
        });
        
        // Demander une nouvelle frame pour l'animation
        requestAnimationFrame(() => chart.draw());
    }
};

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
                label: 'Interventions',
                data: data,
                borderColor: '#2196F3',
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 6,
                pointBackgroundColor: '#EA5A4F',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverRadius: 10,
                pointHitRadius: 15
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
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const year = labels[index];
                    showSessionDetail(year);
                }
            }
        },
        plugins: [pulsePlugin]
    });
}

function showSessionDetail(year) {
    const detailContainer = document.getElementById('sessionDetail');
    const titleEl = document.getElementById('sessionDetailTitle');
    const contentEl = document.getElementById('sessionDetailContent');
    
    if (!detailContainer) return;
    
    // Définir les sessions par année
    const sessionsByYear = {
        'printemps': { name: 'Session de printemps', months: [3] },
        'speciale': { name: 'Session spéciale', months: [4, 5] },
        'ete': { name: 'Session d\'été', months: [6] },
        'automne': { name: 'Session d\'automne', months: [9, 10] },
        'hiver': { name: 'Session d\'hiver', months: [12] }
    };
    
    // Compter les interventions par session pour l'année sélectionnée
    const sessionCounts = {};
    
    filteredData.forEach(item => {
        if (item.date && item.date.startsWith(year)) {
            const month = parseInt(item.date.substring(5, 7));
            let sessionKey;
            
            // Assigner chaque mois à la session parlementaire correspondante
            // Printemps: février-mars, Spéciale: avril-mai, Été: juin-juillet
            // Automne: août-octobre, Hiver: novembre-janvier
            if (month === 2 || month === 3) sessionKey = 'printemps';
            else if (month === 4 || month === 5) sessionKey = 'speciale';
            else if (month === 6 || month === 7) sessionKey = 'ete';
            else if (month >= 8 && month <= 10) sessionKey = 'automne';
            else sessionKey = 'hiver'; // novembre, décembre, janvier
            
            sessionCounts[sessionKey] = (sessionCounts[sessionKey] || 0) + 1;
        }
    });
    
    // Construire le HTML
    titleEl.textContent = `Détail ${year} par session`;
    
    const sessionLabels = {
        'printemps': 'Session de printemps',
        'speciale': 'Session spéciale',
        'ete': 'Session d\'été',
        'automne': 'Session d\'automne',
        'hiver': 'Session d\'hiver',
        'autre': 'Hors session'
    };
    
    let html = '<div class="session-detail-grid">';
    
    const orderedKeys = ['printemps', 'speciale', 'ete', 'automne', 'hiver', 'autre'];
    orderedKeys.forEach(key => {
        if (sessionCounts[key]) {
            html += `
                <div class="session-detail-item" onclick="filterBySession('${year}', '${key}')">
                    <span class="session-name">${sessionLabels[key]}</span>
                    <span class="session-count">${sessionCounts[key]}</span>
                </div>
            `;
        }
    });
    
    html += '</div>';
    contentEl.innerHTML = html;
    detailContainer.style.display = 'block';
}

function filterBySession(year, sessionKey) {
    // Rediriger vers la page objets avec filtre année et session
    const sessionNames = {
        'printemps': 'printemps',
        'speciale': 'speciale',
        'ete': 'ete',
        'automne': 'automne',
        'hiver': 'hiver',
        'autre': 'autre'
    };
    
    window.location.href = `index.html?filter_year=${year}&filter_session=${sessionNames[sessionKey]}`;
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
    'CE': 'Le Centre',
    'C': 'Le Centre',
    'BD': 'Le Centre',
    'G': 'VERT-E-S',
    'GL': 'Vert\'libéraux',
    '': 'Conseil fédéral'
};

const councilLabels = {
    'N': 'Conseil national',
    'S': 'Conseil des États',
    'V': 'AF'
};

function renderDebatePartyChart() {
    if (debatePartyChartInstance) {
        debatePartyChartInstance.destroy();
    }
    
    const partyCounts = {};
    
    filteredDebatesData.forEach(item => {
        const party = debatePartyLabels[item.party] || item.party || 'Conseil fédéral';
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
                x: { 
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
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
    if (debateCouncilChartInstance) {
        debateCouncilChartInstance.destroy();
    }
    
    const councilCounts = {};
    
    filteredDebatesData.forEach(item => {
        const council = councilLabels[item.council] || item.council || 'Autre';
        councilCounts[council] = (councilCounts[council] || 0) + 1;
    });
    
    const labels = Object.keys(councilCounts);
    const data = Object.values(councilCounts);
    // Rouge = CN, Bleu = CE, Violet = AF
    const colors = ['#EA5A4F', '#003399', '#8B5CF6'];
    
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
                    position: 'bottom',
                    onClick: (event, legendItem, legend) => {
                        const index = legendItem.index;
                        const council = labels[index];
                        window.location.href = `debates.html?filter_council=${encodeURIComponent(council)}`;
                    },
                    labels: {
                        cursor: 'pointer'
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const council = labels[index];
                    window.location.href = `debates.html?filter_council=${encodeURIComponent(council)}`;
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
                speakerParties[speaker] = 'Conseil fédéral';
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

function renderTopSpeakersNoCF() {
    const speakerCounts = {};
    const speakerParties = {};
    
    filteredDebatesData.forEach(item => {
        const speaker = item.speaker;
        if (speaker && item.party) {
            speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
            speakerParties[speaker] = debatePartyLabels[item.party] || item.party;
        }
    });
    
    const topSpeakers = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('topSpeakersNoCF');
    
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
    
    const totalDebates = filteredDebatesData.length;
    const uniqueSpeakers = new Set(filteredDebatesData.map(d => d.speaker)).size;
    const uniqueObjects = new Set(filteredDebatesData.map(d => d.business_number).filter(Boolean)).size;
    
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

document.addEventListener('click', () => {
    document.querySelectorAll('.filter-dropdown.open').forEach(d => d.classList.remove('open'));
});
