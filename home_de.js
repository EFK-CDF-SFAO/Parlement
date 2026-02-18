// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';
const SESSIONS_URL = 'sessions.json';

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
        // Load sessions data
        const sessionsResponse = await fetch(SESSIONS_URL);
        const sessionsJson = await sessionsResponse.json();
        
        // Déterminer la session à afficher (dernière session terminée)
        const currentSession = getCurrentSession(sessionsJson.sessions);
        
        // Load objects data
        const objectsResponse = await fetch(DATA_URL);
        const objectsJson = await objectsResponse.json();
        
        // Display session summary avec session déterminée automatiquement
        displaySessionSummary(objectsJson.session_summary, currentSession);
        
        // Display objects list
        displayObjectsList(objectsJson.session_summary);
        
        // Load debates data
        const debatesResponse = await fetch(DEBATES_URL);
        const debatesJson = await debatesResponse.json();
        
        // Display debates summary
        displayDebatesSummary(debatesJson, currentSession);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Déterminer la dernière session terminée
function getCurrentSession(sessions) {
    const now = new Date();
    
    // Trier les sessions par date de début
    const sortedSessions = sessions
        .filter(s => s.type === 'ordinaire')
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    // Trouver la dernière session terminée
    let lastEndedSession = null;
    
    for (let i = 0; i < sortedSessions.length; i++) {
        const session = sortedSessions[i];
        const endDate = new Date(session.end);
        
        // Si on est après la fin de cette session
        if (now >= endDate) {
            lastEndedSession = session;
        }
    }
    
    return lastEndedSession;
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

function displaySessionSummary(summary, currentSession) {
    if (!summary) return;
    
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    
    // Utiliser la session déterminée automatiquement ou celle du JSON
    const sessionStart = currentSession ? currentSession.start : summary.session_start;
    const sessionEnd = currentSession ? currentSession.end : summary.session_end;
    const sessionId = currentSession ? currentSession.id : summary.session_id;
    
    // Construire le titre avec les dates
    const sessionName = currentSession ? currentSession.name_de : getSessionName(sessionId);
    const startDate = formatDate(sessionStart);
    const endDate = formatDate(sessionEnd);
    
    if (titleEl) {
        titleEl.textContent = `Zusammenfassung der ${sessionName} (${startDate} - ${endDate})`;
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

function displayDebatesSummary(debatesData, currentSession) {
    const container = document.getElementById('debatesSummary');
    if (!container) return;
    
    const debates = debatesData.items || [];
    
    // Filter debates from the current session
    let sessionDebates = debates;
    if (currentSession && currentSession.start && currentSession.end) {
        const startDate = new Date(currentSession.start);
        const endDate = new Date(currentSession.end);
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
    const sessionName = currentSession ? currentSession.name_de : 'der letzten Session';
    
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
