// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';
const SESSIONS_URL = 'sessions.json';

// Traduction des types d'objets
const typeLabels = {
    'Mo.': 'Motion',
    'Po.': 'Postulat',
    'Ip.': 'Interpellation',
    'Fra.': 'Question',
    'Iv. pa.': 'Initiative parl.',
    'Iv. ct.': 'Initiative cant.'
};

// Traduction des partis
function translateParty(party) {
    const translations = {
        'M-E': 'Le Centre'
    };
    return translations[party] || party;
}

// Couleurs par type d'objet
const typeColors = {
    'Mo.': '#3B82F6',      // Bleu
    'Po.': '#8B5CF6',      // Violet
    'Ip.': '#F59E0B',      // Orange
    'Fra.': '#10B981',     // Vert
    'Iv. pa.': '#EC4899',  // Rose
    'Iv. ct.': '#6366F1'   // Indigo
};

// Couleurs par parti
const partyColors = {
    'UDC': '#009F4D',
    'PLR': '#0066CC',
    'Le Centre': '#FF9900',
    'M-E': '#FF9900',
    'Parti socialiste': '#E41019',
    'PSS': '#E41019',
    'VERT-E-S': '#84B414',
    'pvl': '#A6CF42',
    'Vert\'libéraux': '#A6CF42'
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
        
        // Display objects list avec new_ids pour soulignement vert
        const newIds = objectsJson.meta?.new_ids || [];
        displayObjectsList(objectsJson.session_summary, newIds);
        
        // Load debates data
        const debatesResponse = await fetch(DEBATES_URL);
        const debatesJson = await debatesResponse.json();
        
        // Display debates summary
        const debatesCount = displayDebatesSummary(debatesJson, currentSession);
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Déterminer la dernière session terminée (afficher jusqu'au vendredi 9h de fin de session suivante)
function getCurrentSession(sessions) {
    const now = new Date();
    
    // Trier les sessions par date de début
    const sortedSessions = sessions
        .filter(s => s.type === 'ordinaire')
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    // Trouver la dernière session terminée
    let lastEndedSession = null;
    let nextSession = null;
    
    for (let i = 0; i < sortedSessions.length; i++) {
        const session = sortedSessions[i];
        const endDate = new Date(session.end);
        
        // Calculer le vendredi 9h après la fin de session (dernier jour + 9h)
        const displayUntil = new Date(endDate);
        displayUntil.setHours(9, 0, 0, 0);
        
        // Si la session suivante existe, afficher jusqu'au début de celle-ci
        if (i + 1 < sortedSessions.length) {
            const nextStart = new Date(sortedSessions[i + 1].start);
            if (now < nextStart && now >= displayUntil) {
                lastEndedSession = session;
                nextSession = sortedSessions[i + 1];
                break;
            }
        }
        
        // Si on est après la fin de cette session
        if (now >= endDate) {
            lastEndedSession = session;
            if (i + 1 < sortedSessions.length) {
                nextSession = sortedSessions[i + 1];
            }
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
        'printemps': 'session de printemps',
        'ete': 'session d\'été',
        'automne': 'session d\'automne',
        'hiver': 'session d\'hiver'
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
    const sessionName = currentSession ? currentSession.name_fr : getSessionName(sessionId);
    const startDate = formatDate(sessionStart);
    const endDate = formatDate(sessionEnd);
    
    if (titleEl) {
        titleEl.textContent = `Résumé de la ${sessionName} (${startDate} - ${endDate})`;
    }
    
    // Texte avec référence à la session (enlever les dates car déjà dans le titre)
    if (textEl) {
        let text = summary.text_fr;
        // Enlever "Session d'hiver 2025 (01.12 - 19.12.2025)," et remplacer par "Durant la session d'hiver,"
        text = text.replace(/Durant la Session [^,]+,/gi, `Durant la ${sessionName},`);
        textEl.textContent = text;
    }
}

function displayObjectsList(summary, newIds = []) {
    const container = document.getElementById('objectsList');
    if (!container || !summary || !summary.interventions) return;
    
    const interventions = summary.interventions;
    
    // Créer un tableau d'indices et trier par shortId décroissant
    const indices = interventions.shortId.map((_, i) => i);
    indices.sort((a, b) => {
        const idA = interventions.shortId[a];
        const idB = interventions.shortId[b];
        return idB.localeCompare(idA, undefined, { numeric: true });
    });
    
    let html = '';
    
    for (const i of indices) {
        const shortId = interventions.shortId[i];
        const isNew = newIds.includes(shortId);
        const party = translateParty(interventions.party[i]);
        const type = interventions.type[i];
        const typeColor = typeColors[type] || '#6B7280';
        const partyColor = partyColors[party] || partyColors[interventions.party[i]] || '#6B7280';
        
        html += `
            <a href="${interventions.url_fr[i]}" target="_blank" class="intervention-card${isNew ? ' card-new' : ''}">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${shortId}</span>
                </div>
                <div class="card-title">${interventions.title[i]}</div>
                <div class="card-footer">
                    <span class="card-author">${interventions.author[i]}</span>
                    <span class="card-party" style="background: ${partyColor};">${party}</span>
                </div>
            </a>
        `;
    }
    
    container.innerHTML = html;
}

function displayDebatesSummary(debatesData, currentSession) {
    const container = document.getElementById('debatesSummary');
    if (!container) return 0;
    
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
    const topics = [...new Set(sessionDebates.filter(d => d.business_title_fr).map(d => d.business_title_fr))];
    
    let html = '';
    
    // Nom de la session pour cohérence
    const sessionName = currentSession ? currentSession.name_fr : 'la dernière session';
    
    if (sessionDebates.length > 0) {
        html = `
            <p><strong>${sessionDebates.length} prises de parole</strong> mentionnant le CDF durant la ${sessionName}.</p>
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
        html = `<p>Aucun débat mentionnant le CDF durant la ${sessionName}.</p>`;
    }
    
    container.innerHTML = html;
    return sessionDebates.length;
}
