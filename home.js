// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';

// Traduction des types d'objets
const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Question',
    'Iv. pa.': 'Initiative parl.',
    'Iv. ct.': 'Initiative cant.'
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

function displaySessionSummary(summary) {
    if (!summary) return;
    
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    
    if (titleEl) titleEl.textContent = summary.title_fr;
    if (textEl) textEl.textContent = summary.text_fr;
}

function displayObjectsList(summary) {
    const container = document.getElementById('objectsList');
    if (!container || !summary || !summary.interventions) return;
    
    const interventions = summary.interventions;
    let html = '<ul class="home-interventions-list">';
    
    for (let i = 0; i < interventions.shortId.length; i++) {
        html += `
            <li>
                <a href="${interventions.url_fr[i]}" target="_blank">
                    <span class="intervention-id">${interventions.shortId[i]}</span>
                    <span class="intervention-type">${typeLabels[interventions.type[i]] || interventions.type[i]}</span>
                    <span class="intervention-title">${interventions.title[i]}</span>
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
    const topics = [...new Set(sessionDebates.filter(d => d.business_title_fr).map(d => d.business_title_fr))];
    
    let html = '';
    
    if (sessionDebates.length > 0) {
        html = `
            <p><strong>${sessionDebates.length} prises de parole</strong> mentionnant le CDF durant la dernière session.</p>
            <ul class="debates-summary-list">
                <li>🏛️ <strong>${cnCount}</strong> au Conseil national, <strong>${ceCount}</strong> au Conseil des États</li>
                <li>👥 <strong>${speakers.length}</strong> orateurs différents</li>
            </ul>
        `;
        
        if (topics.length > 0) {
            html += `<p><strong>Objets discutés :</strong></p><ul class="debates-topics-list">`;
            topics.slice(0, 5).forEach(topic => {
                html += `<li>${topic}</li>`;
            });
            if (topics.length > 5) {
                html += `<li><em>... et ${topics.length - 5} autres</em></li>`;
            }
            html += '</ul>';
        }
    } else {
        html = '<p>Aucun débat mentionnant le CDF durant la dernière session.</p>';
    }
    
    container.innerHTML = html;
}
