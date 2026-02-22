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

// Traduction des partis
function translateParty(party) {
    const translations = {
        'VERT-E-S': 'GRÜNE',
        'Les Vert-e-s': 'GRÜNE',
        'Al': 'GRÜNE',
        'pvl': 'GLP',
        'PVL': 'GLP',
        'Vert\'libéraux': 'GLP',
        'PS': 'SP',
        'PSS': 'SP',
        'PLR': 'FDP',
        'UDC': 'SVP',
        'Le Centre': 'Die Mitte',
        'Centre': 'Mitte',
        'M-E': 'Die Mitte'
    };
    return translations[party] || party;
}

// Couleurs par type d'objet
const typeColors = {
    'Mo.': '#3B82F6',
    'Po.': '#8B5CF6',
    'Ip.': '#F59E0B',
    'Fra.': '#10B981',
    'Iv. pa.': '#EC4899',
    'Iv. ct.': '#6366F1'
};

// Couleurs par parti
const partyColors = {
    'SVP': '#009F4D',
    'FDP': '#0066CC',
    'Die Mitte': '#FF9900',
    'SP': '#E41019',
    'GRÜNE': '#84B414',
    'GLP': '#A6CF42'
};

// Emojis pour les mentions EFK
function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: "Der Autor zitiert die EFK" };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: "Der Autor und der Bundesrat zitieren die EFK" };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: "Der Bundesrat zitiert die EFK" };
    } else {
        return { emojis: '🧑', tooltip: "Der Autor zitiert die EFK" };
    }
}

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
        displayObjectsList(objectsJson.session_summary, newIds, objectsJson.items);
        
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
    
    // Générer le texte dynamiquement (comme IT)
    if (textEl) {
        const count = summary.count || 0;
        const types = summary.by_type || {};
        
        let typesText = [];
        if (types['Ip.']) typesText.push(`${types['Ip.']} Interpellation${types['Ip.'] > 1 ? 'en' : ''}`);
        if (types['Mo.']) typesText.push(`${types['Mo.']} Motion${types['Mo.'] > 1 ? 'en' : ''}`);
        if (types['Fra.']) typesText.push(`${types['Fra.']} Anfrage${types['Fra.'] > 1 ? 'n' : ''}`);
        if (types['Po.']) typesText.push(`${types['Po.']} Postulat${types['Po.'] > 1 ? 'e' : ''}`);
        
        const cn = summary.by_council?.CN || 0;
        const ce = summary.by_council?.CE || 0;
        
        let text = `Während der ${sessionName} wurden ${count} Vorstösse mit Bezug zur EFK eingereicht: ${typesText.join(', ')}. `;
        if (cn > 0 && ce > 0) {
            text += `${cn} im Nationalrat und ${ce} im Ständerat. `;
        }
        
        // Ajouter les partis les plus actifs
        if (summary.interventions && summary.interventions.party) {
            const partyCounts = {};
            summary.interventions.party.forEach(p => {
                const translated = translateParty(p);
                partyCounts[translated] = (partyCounts[translated] || 0) + 1;
            });
            const sorted = Object.entries(partyCounts)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
            // Prendre tous les partis avec le même nombre max d'interventions
            const maxCount = sorted[0]?.[1] || 0;
            const sortedParties = sorted
                .filter(([_, count]) => count === maxCount)
                .map(([p]) => p);
            if (sortedParties.length > 0) {
                text += `Die aktivsten Parteien: ${sortedParties.join(', ')}.`;
            }
        }
        
        textEl.textContent = text;
    }
}

function displayObjectsList(summary, newIds = [], allItems = []) {
    const container = document.getElementById('objectsList');
    if (!container || !summary || !summary.interventions) return;
    
    const interventions = summary.interventions;
    
    // Créer un map des items pour accès rapide aux mentions
    const itemsMap = {};
    allItems.forEach(item => {
        itemsMap[item.shortId] = item;
    });
    
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
        const partyColor = partyColors[party] || '#6B7280';
        
        // Récupérer la mention depuis les items
        const itemData = itemsMap[shortId];
        const mentionData = getMentionEmojis(itemData?.mention);
        
        html += `
            <a href="${interventions.url_de[i]}" target="_blank" class="intervention-card${isNew ? ' card-new' : ''}">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${shortId}</span>
                </div>
                <div class="card-title">${interventions.title_de[i]}</div>
                <div class="card-footer">
                    <span class="card-author">${interventions.author[i]}</span>
                    <span class="card-party" style="background: ${partyColor};">${party}</span>
                    <span class="card-mention" title="${mentionData.tooltip}">${mentionData.emojis}</span>
                </div>
            </a>
        `;
    }
    
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
            <div class="debates-mini-cards">
                <a href="debates_de.html?filter_council=N" class="debate-stat-card clickable">
                    <span class="debate-stat-icon">🏛️</span>
                    <span class="debate-stat-number">${cnCount}</span>
                    <span class="debate-stat-label">Nationalrat</span>
                </a>
                <a href="debates_de.html?filter_council=S" class="debate-stat-card clickable">
                    <span class="debate-stat-icon">🏛️</span>
                    <span class="debate-stat-number">${ceCount}</span>
                    <span class="debate-stat-label">Ständerat</span>
                </a>
                <div class="debate-stat-card">
                    <span class="debate-stat-icon">👥</span>
                    <span class="debate-stat-number">${speakers.length}</span>
                    <span class="debate-stat-label">Redner</span>
                </div>
            </div>
        `;
    } else {
        html = `<p class="no-debates">Keine Debatten mit Bezug zur EFK während der ${sessionName}.</p>`;
    }
    
    container.innerHTML = html;
}
