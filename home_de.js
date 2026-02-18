// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';

// Traduction des types d'objets
const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Anfrage',
    'Iv. pa.': 'Parl. Initiative',
    'Iv. ct.': 'Standesinitiative'
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // Load objects data
        const objectsResponse = await fetch(DATA_URL);
        const objectsJson = await objectsResponse.json();
        
        // Display session summary
        displaySessionSummary(objectsJson.session_summary);
        
        // Display objects list
        displayObjectsList(objectsJson.session_summary);
        
        // Load debates data
        const debatesResponse = await fetch(DEBATES_URL);
        const debatesJson = await debatesResponse.json();
        
        // Display debates summary
        displayDebatesSummary(debatesJson, objectsJson.session_summary);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function getSessionName(sessionId) {
    if (!sessionId) return '';
    const parts = sessionId.split('-');
    if (parts.length < 2) return '';
    const seasonMap = {
        'printemps': 'Frühjahrssession',
        'ete': 'Sommersession',
        'automne': 'Herbstsession',
        'hiver': 'Wintersession'
    };
    return seasonMap[parts[1]] || '';
}

function displaySessionSummary(summary) {
    if (!summary) return;
    
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    
    // Construire le titre avec les dates
    const sessionName = getSessionName(summary.session_id);
    const startDate = formatDate(summary.session_start);
    const endDate = formatDate(summary.session_end);
    const year = summary.session_start ? summary.session_start.substring(0, 4) : '';
    
    if (titleEl) {
        titleEl.textContent = `Zusammenfassung der ${sessionName} ${year} (${startDate} - ${endDate})`;
    }
    
    // Texte avec référence à la session
    if (textEl) {
        const text = summary.text_de.replace(/Wintersession \d{4}/gi, sessionName);
        textEl.textContent = text;
    }
}

function displayObjectsList(summary) {
    const container = document.getElementById('objectsList');
    if (!container || !summary || !summary.interventions) return;
    
    const interventions = summary.interventions;
    let html = '<ul class="home-interventions-list">';
    
    for (let i = 0; i < interventions.shortId.length; i++) {
        html += `
            <li>
                <a href="${interventions.url_de[i]}" target="_blank">
                    <span class="intervention-id">${interventions.shortId[i]}</span>
                    <span class="intervention-type">${typeLabels[interventions.type[i]] || interventions.type[i]}</span>
                    <span class="intervention-title">${interventions.title_de[i]}</span>
                    <span class="intervention-author">${interventions.author[i]} (${interventions.party[i]})</span>
                </a>
            </li>
        `;
    }
    
    html += '</ul>';
    container.innerHTML = html;
}

function displayDebatesSummary(debatesData, sessionSummary) {
    const container = document.getElementById('debatesSummary');
    if (!container) return;
    
    const debates = debatesData.items || [];
    
    // Filter debates from the last session
    let sessionDebates = debates;
    if (sessionSummary && sessionSummary.session_start && sessionSummary.session_end) {
        const startDate = new Date(sessionSummary.session_start);
        const endDate = new Date(sessionSummary.session_end);
        sessionDebates = debates.filter(d => {
            // Format date YYYYMMDD -> Date
            const dateStr = String(d.date);
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const debateDate = new Date(`${year}-${month}-${day}`);
            return debateDate >= startDate && debateDate <= endDate;
        });
    }
    
    // Count by council (N = Nationalrat, S = Ständerat)
    const cnCount = sessionDebates.filter(d => d.council === 'N' || d.council === 'CN' || d.council === 'NR').length;
    const ceCount = sessionDebates.filter(d => d.council === 'S' || d.council === 'CE' || d.council === 'SR').length;
    
    // Get unique speakers
    const speakers = [...new Set(sessionDebates.map(d => d.speaker))];
    
    // Get unique topics (from object references if available)
    const topics = [...new Set(sessionDebates.filter(d => d.business_title_de).map(d => d.business_title_de))];
    
    let html = '';
    
    // Nom de la session pour cohérence
    const sessionName = sessionSummary ? getSessionName(sessionSummary.session_id) : 'der letzten Session';
    
    if (sessionDebates.length > 0) {
        html = `
            <p><strong>${sessionDebates.length} Wortmeldungen</strong> mit Bezug zur EFK während der ${sessionName}.</p>
            <ul class="debates-summary-list">
                <li>🏛️ <strong>${cnCount}</strong> im Nationalrat, <strong>${ceCount}</strong> im Ständerat</li>
                <li>👥 <strong>${speakers.length}</strong> verschiedene Redner</li>
            </ul>
        `;
        
        if (topics.length > 0) {
            html += `<p><strong>Diskutierte Geschäfte:</strong></p><ul class="debates-topics-list">`;
            topics.slice(0, 5).forEach(topic => {
                html += `<li>${topic}</li>`;
            });
            if (topics.length > 5) {
                html += `<li><em>... und ${topics.length - 5} weitere</em></li>`;
            }
            html += '</ul>';
        }
    } else {
        html = `<p>Keine Debatten mit Bezug zur EFK während der ${sessionName}.</p>`;
    }
    
    container.innerHTML = html;
}
