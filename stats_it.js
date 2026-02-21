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
    'Alleanza del Centro': '#FF9800',
    'Le Centre': '#FF9800',
    'Centro': '#FF9800',
    'M-E': '#FF9800',
    'PDC': '#FF9800',
    'PBD': '#FF9800',
    'CSPO': '#FF9800',
    'CVP': '#FF9800',
    'BDP': '#FF9800',
    'Verdi': '#8BC34A',
    'VERT-E-S': '#8BC34A',
    'Al': '#8BC34A',
    'Verdi liberali': '#CDDC39',
    'PVL': '#CDDC39',
    'pvl': '#CDDC39'
};

const partyLabels = {
    'UDC': 'UDC',
    'PSS': 'PS',
    'PS': 'PS',
    'PLR': 'PLR',
    'Le Centre': 'Alleanza del Centro',
    'Centre': 'Alleanza del Centro',
    'M-E': 'Alleanza del Centro',
    'PDC': 'Alleanza del Centro',
    'PBD': 'Alleanza del Centro',
    'CSPO': 'Alleanza del Centro',
    'CVP': 'Alleanza del Centro',
    'BDP': 'Alleanza del Centro',
    'VERT-E-S': 'Verdi',
    'Les Vert-e-s': 'Verdi',
    'Al': 'Verdi',
    'pvl': 'Verdi liberali',
    'PVL': 'Verdi liberali'
};

const typeLabels = {
    'Mo.': 'Mozione',
    'Po.': 'Postulato',
    'Ip.': 'Interpellanza',
    'Fra.': 'Ora delle domande',
    'A.': 'Interrogazione',
    'Pa. Iv.': 'Iniziativa parl.',
    'D.Ip.': 'Interpellanza urgente',
    'BRG': 'Oggetto del CF'
};

function translateDept(deptDE) {
    const translations = {
        'EFD': 'DFF',
        'EDI': 'DFI',
        'UVEK': 'DATEC',
        'VBS': 'DDPS',
        'EJPD': 'DFGP',
        'EDA': 'DFAE',
        'WBF': 'DEFR',
        'BK': 'CaF',
        'BGer': 'TF',
        'Parl': 'Parl',
        'VBV': 'AF'
    };
    return translations[deptDE] || deptDE;
}

const typeToFilter = {
    'Mozione': 'Mo.',
    'Postulato': 'Po.',
    'Interpellanza': 'Ip.',
    'Ora delle domande': 'Fra.',
    'Interrogazione': 'A.',
    'Iniziativa parl.': 'Pa. Iv.',
    'Interpellanza urgente': 'D.Ip.',
    'Oggetto del CF': 'BRG'
};

const partyToFilter = {
    'PS': 'PS',
    'UDC': 'UDC',
    'PLR': 'PLR',
    'Alleanza del Centro': 'Le Centre',
    'Verdi': 'VERT-E-S',
    'Verdi liberali': 'pvl'
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
        
        const debatesResponse = await fetch('debates_data.json');
        const debatesJson = await debatesResponse.json();
        debatesData = debatesJson.items || [];
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
    const yearMenu = document.getElementById('objectYearMenu');
    const years = [...new Set(allData.map(d => d.date ? d.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
    
    const partyMenu = document.getElementById('objectPartyMenu');
    const parties = [...new Set(allData.map(d => {
        const party = d.party || getPartyFromAuthor(d.author);
        return normalizeParty(party);
    }).filter(Boolean))];
    parties.sort();
    parties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
    
    const deptMenu = document.getElementById('objectDeptMenu');
    if (deptMenu) {
        const departments = [...new Set(allData.map(d => d.department).filter(Boolean))];
        departments.sort((a, b) => translateDept(a).localeCompare(translateDept(b), 'it'));
        departments.forEach(dept => {
            const label = document.createElement('label');
            const deptIT = translateDept(dept);
            label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptIT}`;
            deptMenu.appendChild(label);
        });
    }
    
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
        if (yearFilters.length > 0 && item.date) {
            const year = item.date.substring(0, 4);
            if (!yearFilters.includes(year)) return false;
        }
        if (councilFilters.length > 0) {
            const councilCode = item.council === 'NR' ? 'N' : item.council === 'SR' ? 'S' : item.council;
            if (!councilFilters.includes(councilCode)) return false;
        }
        if (partyFilters.length > 0) {
            const itemParty = item.party || getPartyFromAuthor(item.author);
            const normalizedParty = normalizeParty(itemParty);
            if (!partyFilters.includes(normalizedParty)) return false;
        }
        if (deptFilters.length > 0) {
            const itemDept = item.department || 'none';
            if (!deptFilters.includes(itemDept)) return false;
        }
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
    '5201': 'Invernale',
    '5202': 'Primaverile',
    '5203': 'Speciale',
    '5204': 'Estiva',
    '5205': 'Autunnale',
    '5206': 'Invernale',
    '5207': 'Primaverile',
    '5208': 'Speciale',
    '5209': 'Estiva',
    '5210': 'Autunnale',
    '5211': 'Invernale'
};

function populateDebateFilters() {
    const yearMenu = document.getElementById('debateYearMenu');
    const years = [...new Set(debatesData.map(d => d.date ? d.date.substring(0, 4) : null).filter(Boolean))];
    years.sort().reverse();
    years.forEach(year => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${year}"> ${year}`;
        yearMenu.appendChild(label);
    });
    
    const partyMenu = document.getElementById('debatePartyMenu');
    const parties = [...new Set(debatesData.map(d => {
        if (!d.party) return 'Consiglio federale';
        return debatePartyLabels[d.party] || d.party;
    }))];
    parties.sort();
    parties.forEach(party => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${party}"> ${party}`;
        partyMenu.appendChild(label);
    });
    
    const deptMenu = document.getElementById('debateDeptMenu');
    if (deptMenu) {
        const departments = [...new Set(debatesData.map(d => d.department).filter(Boolean))];
        departments.sort((a, b) => translateDept(a).localeCompare(translateDept(b), 'it'));
        departments.forEach(dept => {
            const label = document.createElement('label');
            const deptIT = translateDept(dept);
            label.innerHTML = `<input type="checkbox" value="${dept}"> ${deptIT}`;
            deptMenu.appendChild(label);
        });
    }
    
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
        if (yearFilters.length > 0 && item.date) {
            const year = item.date.substring(0, 4);
            if (!yearFilters.includes(year)) return false;
        }
        if (sessionFilters.length > 0) {
            const sessionType = sessionTypes[item.id_session];
            if (!sessionFilters.includes(sessionType)) return false;
        }
        if (councilFilters.length > 0 && !councilFilters.includes(item.council)) return false;
        if (partyFilters.length > 0) {
            const itemParty = item.party ? (debatePartyLabels[item.party] || item.party) : 'Consiglio federale';
            if (!partyFilters.includes(itemParty)) return false;
        }
        if (deptFilters.length > 0) {
            const itemDept = item.department || 'none';
            if (!deptFilters.includes(itemDept)) return false;
        }
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
    if (author.includes('FDP') || author.includes('PLR') || author.includes('liberale radicale')) return 'PLR';
    if (author.includes('Grünliberale') || author.includes('verde liberale')) return 'pvl';
    if (author.includes('SVP') || author.includes('UDC') || author.includes('Schweizerischen Volkspartei') || author.includes('Unione democratica')) return 'UDC';
    if (author.includes('SP ') || author.includes('PS ') || author.includes('socialista') || author.includes('Sozialdemokratische')) return 'PSS';
    if (author.includes('Grüne') || author.includes('Verts') || author.includes('Verdi')) return 'VERT-E-S';
    if (author.includes('Mitte') || author.includes('Centre') || author.includes('Centro') || author.includes('EVP')) return 'Le Centre';
    return null;
}

function normalizeParty(party) {
    const normalized = {
        'PSS': 'PS',
        'PS': 'PS',
        'VERT-E-S': 'Verdi',
        'Les Vert-e-s': 'Verdi',
        'Al': 'Verdi',
        'pvl': 'Verdi liberali',
        'PVL': 'Verdi liberali',
        'Le Centre': 'Alleanza del Centro',
        'Centre': 'Alleanza del Centro',
        'M-E': 'Alleanza del Centro',
        'PDC': 'Alleanza del Centro',
        'PBD': 'Alleanza del Centro',
        'CSPO': 'Alleanza del Centro',
        'CVP': 'Alleanza del Centro',
        'BDP': 'Alleanza del Centro'
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
                label: 'Interventi',
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
                    window.location.href = `index_it.html?filter_party=${encodeURIComponent(filterValue)}`;
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
                        window.location.href = `index_it.html?filter_type=${encodeURIComponent(filterValue)}`;
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
                    window.location.href = `index_it.html?filter_type=${encodeURIComponent(filterValue)}`;
                }
            }
        }
    });
}

// Plugin per effetto pulsazione sui punti
const pulsePlugin = {
    id: 'pulseEffect',
    afterDraw: (chart) => {
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        if (!meta.data) return;
        
        const time = Date.now() / 1000;
        const pulseRadius = 8 + Math.sin(time * 3) * 4;
        const pulseOpacity = 0.3 + Math.sin(time * 3) * 0.2;
        
        meta.data.forEach((point) => {
            const x = point.x;
            const y = point.y;
            
            ctx.beginPath();
            ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(234, 90, 79, ${pulseOpacity})`;
            ctx.fill();
            ctx.closePath();
        });
        
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
                label: 'Interventi',
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
    
    const sessionCounts = {};
    
    filteredData.forEach(item => {
        if (item.date && item.date.startsWith(year)) {
            const month = parseInt(item.date.substring(5, 7));
            let sessionKey = 'altro';
            
            if (month === 3) sessionKey = 'primavera';
            else if (month === 4 || month === 5) sessionKey = 'speciale';
            else if (month === 6) sessionKey = 'estiva';
            else if (month === 9 || month === 10) sessionKey = 'autunno';
            else if (month === 12) sessionKey = 'inverno';
            
            sessionCounts[sessionKey] = (sessionCounts[sessionKey] || 0) + 1;
        }
    });
    
    titleEl.textContent = `Dettaglio ${year} per sessione`;
    
    const sessionLabels = {
        'primavera': 'Sessione primaverile',
        'speciale': 'Sessione speciale',
        'estiva': 'Sessione estiva',
        'autunno': 'Sessione autunnale',
        'inverno': 'Sessione invernale',
        'altro': 'Fuori sessione'
    };
    
    let html = '<div class="session-detail-grid">';
    
    const orderedKeys = ['primavera', 'speciale', 'estiva', 'autunno', 'inverno', 'altro'];
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
    const sessionNames = {
        'primavera': 'printemps',
        'speciale': 'speciale',
        'estiva': 'ete',
        'autunno': 'automne',
        'inverno': 'hiver',
        'altro': 'autre'
    };
    
    window.location.href = `index_it.html?filter_year=${year}&filter_session=${sessionNames[sessionKey]}`;
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
        container.innerHTML = '<p>Nessun dato disponibile</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topAuthors.forEach(([author, count], index) => {
        const party = authorParties[author] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `index_it.html?search=${encodeURIComponent(author)}`;
        
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

// ========== STATISTICHE DIBATTITI ==========

const debatePartyLabels = {
    'V': 'UDC',
    'S': 'PS',
    'RL': 'PLR',
    'M-E': 'Alleanza del Centro',
    'CE': 'Alleanza del Centro',
    'C': 'Alleanza del Centro',
    'BD': 'Alleanza del Centro',
    'G': 'Verdi',
    'GL': 'Verdi liberali',
    '': 'Consiglio federale'
};

const councilLabels = {
    'N': 'Consiglio nazionale',
    'S': 'Consiglio degli Stati',
    'V': 'AF'
};

function renderDebatePartyChart() {
    if (debatePartyChartInstance) {
        debatePartyChartInstance.destroy();
    }
    
    const partyCounts = {};
    
    filteredDebatesData.forEach(item => {
        const party = debatePartyLabels[item.party] || item.party || 'Consiglio federale';
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
                label: 'Interventi',
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
                    window.location.href = `debates_it.html?filter_party=${encodeURIComponent(party)}`;
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
        const council = councilLabels[item.council] || item.council || 'Altro';
        councilCounts[council] = (councilCounts[council] || 0) + 1;
    });
    
    const labels = Object.keys(councilCounts);
    const data = Object.values(councilCounts);
    // Rosso = CN, Blu = CE, Viola = AF
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
                        window.location.href = `debates_it.html?filter_council=${encodeURIComponent(council)}`;
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
                    window.location.href = `debates_it.html?filter_council=${encodeURIComponent(council)}`;
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
                speakerParties[speaker] = 'Consiglio federale';
            }
        }
    });
    
    const topSpeakers = Object.entries(speakerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const container = document.getElementById('topSpeakers');
    
    if (topSpeakers.length === 0) {
        container.innerHTML = '<p>Nessun dato disponibile</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topSpeakers.forEach(([speaker, count], index) => {
        const party = speakerParties[speaker] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `debates_it.html?search=${encodeURIComponent(speaker)}`;
        
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
        container.innerHTML = '<p>Nessun dato disponibile</p>';
        return;
    }
    
    let html = '<div class="authors-ranking">';
    topSpeakers.forEach(([speaker, count], index) => {
        const party = speakerParties[speaker] || '';
        const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
        const searchUrl = `debates_it.html?search=${encodeURIComponent(speaker)}`;
        
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
                <span class="summary-label">Interventi</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueSpeakers}</span>
                <span class="summary-label">Oratori</span>
            </div>
            <div class="summary-item">
                <span class="summary-value">${uniqueObjects}</span>
                <span class="summary-label">Oggetti discussi</span>
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);

document.addEventListener('click', () => {
    document.querySelectorAll('.filter-dropdown.open').forEach(d => d.classList.remove('open'));
});
