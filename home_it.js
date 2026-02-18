// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';
const SESSIONS_URL = 'sessions.json';

// Traduzione dei tipi di oggetti
const typeLabels = {
    'Mo.': 'Mozione',
    'Po.': 'Postulato',
    'Ip.': 'Interpellanza',
    'Fra.': 'Interrogazione',
    'Iv. pa.': 'Iniziativa parl.',
    'Iv. ct.': 'Iniziativa cant.'
};

// Nomi delle sessioni in italiano
const sessionNames = {
    'printemps': 'sessione primaverile',
    'ete': 'sessione estiva',
    'automne': 'sessione autunnale',
    'hiver': 'sessione invernale'
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
    
    const sortedSessions = sessions
        .filter(s => s.type === 'ordinaire')
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    let lastEndedSession = null;
    let nextSession = null;
    
    for (let i = 0; i < sortedSessions.length; i++) {
        const session = sortedSessions[i];
        const endDate = new Date(session.end);
        
        const displayUntil = new Date(endDate);
        displayUntil.setHours(9, 0, 0, 0);
        
        if (i + 1 < sortedSessions.length) {
            const nextStart = new Date(sortedSessions[i + 1].start);
            if (now < nextStart && now >= displayUntil) {
                lastEndedSession = session;
                nextSession = sortedSessions[i + 1];
                break;
            }
        }
        
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

function getSessionNameIT(sessionId) {
    if (!sessionId) return '';
    const parts = sessionId.split('-');
    if (parts.length < 2) return '';
    return sessionNames[parts[1]] || '';
}

function displaySessionSummary(summary, currentSession) {
    if (!summary) return;
    
    const titleEl = document.getElementById('summaryTitle');
    const textEl = document.getElementById('summaryText');
    
    const sessionStart = currentSession ? currentSession.start : summary.session_start;
    const sessionEnd = currentSession ? currentSession.end : summary.session_end;
    const sessionId = currentSession ? currentSession.id : summary.session_id;
    
    // Construire le nom de session en italien
    let sessionName = getSessionNameIT(sessionId);
    if (!sessionName && currentSession) {
        // Extraire de name_fr
        const nameFr = currentSession.name_fr.toLowerCase();
        if (nameFr.includes('hiver')) sessionName = 'sessione invernale ' + sessionEnd.substring(0, 4);
        else if (nameFr.includes('printemps')) sessionName = 'sessione primaverile ' + sessionEnd.substring(0, 4);
        else if (nameFr.includes('été') || nameFr.includes('ete')) sessionName = 'sessione estiva ' + sessionEnd.substring(0, 4);
        else if (nameFr.includes('automne')) sessionName = 'sessione autunnale ' + sessionEnd.substring(0, 4);
        else sessionName = currentSession.name_fr;
    }
    
    const startDate = formatDate(sessionStart);
    const endDate = formatDate(sessionEnd);
    
    if (titleEl) {
        titleEl.textContent = `Riassunto della ${sessionName} (${startDate} - ${endDate})`;
    }
    
    // Texte traduit en italien
    if (textEl && summary.text_fr) {
        const count = summary.count || 0;
        const types = summary.by_type || {};
        
        let typesText = [];
        if (types['Mo.']) typesText.push(`${types['Mo.']} mozion${types['Mo.'] > 1 ? 'i' : 'e'}`);
        if (types['Po.']) typesText.push(`${types['Po.']} postulat${types['Po.'] > 1 ? 'i' : 'o'}`);
        if (types['Ip.']) typesText.push(`${types['Ip.']} interpellanz${types['Ip.'] > 1 ? 'e' : 'a'}`);
        if (types['Fra.']) typesText.push(`${types['Fra.']} interrogazion${types['Fra.'] > 1 ? 'i' : 'e'}`);
        
        const cn = summary.by_council?.CN || 0;
        const ce = summary.by_council?.CE || 0;
        
        let text = `Durante la ${sessionName}, sono stati presentati ${count} interventi relativi al CDF: ${typesText.join(', ')}. `;
        if (cn > 0 && ce > 0) {
            text += `${cn} al Consiglio nazionale e ${ce} al Consiglio degli Stati.`;
        } else if (cn > 0) {
            text += `Tutti al Consiglio nazionale.`;
        } else if (ce > 0) {
            text += `Tutti al Consiglio degli Stati.`;
        }
        
        textEl.textContent = text;
    }
}

function displayObjectsList(summary) {
    const container = document.getElementById('objectsList');
    if (!container || !summary || !summary.interventions) return;
    
    const interventions = summary.interventions;
    let html = '<ul class="home-interventions-list">';
    
    for (let i = 0; i < interventions.shortId.length; i++) {
        // URL italiano
        const url = interventions.url_fr[i].replace('/fr/', '/it/');
        // Titre: priorité IT > FR > DE
        const titleIT = interventions.title_it ? interventions.title_it[i] : null;
        const titleFR = interventions.title[i];
        const title = (titleIT && titleIT.trim() && titleIT.toLowerCase() !== 'titre suit') 
            ? titleIT 
            : titleFR;
        html += `
            <li>
                <a href="${url}" target="_blank">
                    <span class="intervention-id">${interventions.shortId[i]}</span>
                    <span class="intervention-type">${typeLabels[interventions.type[i]] || interventions.type[i]}</span>
                    <span class="intervention-title">${title}</span>
                    <span class="intervention-author">👤 ${interventions.author[i]} (${interventions.party[i]})</span>
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
    
    let sessionDebates = debates;
    if (currentSession && currentSession.start && currentSession.end) {
        const startDate = new Date(currentSession.start);
        const endDate = new Date(currentSession.end);
        sessionDebates = debates.filter(d => {
            const dateStr = String(d.date);
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            const debateDate = new Date(`${year}-${month}-${day}`);
            return debateDate >= startDate && debateDate <= endDate;
        });
    }
    
    const cnCount = sessionDebates.filter(d => d.council === 'N' || d.council === 'CN' || d.council === 'NR').length;
    const ceCount = sessionDebates.filter(d => d.council === 'S' || d.council === 'CE' || d.council === 'SR').length;
    
    const speakers = [...new Set(sessionDebates.map(d => d.speaker))];
    // Utiliser titre IT si disponible, sinon FR
    const topics = [...new Set(sessionDebates.filter(d => d.business_title_it || d.business_title_fr).map(d => d.business_title_it || d.business_title_fr))];
    
    let html = '';
    
    let sessionName = 'l\'ultima sessione';
    if (currentSession) {
        const nameFr = currentSession.name_fr.toLowerCase();
        if (nameFr.includes('hiver')) sessionName = 'la sessione invernale';
        else if (nameFr.includes('printemps')) sessionName = 'la sessione primaverile';
        else if (nameFr.includes('été') || nameFr.includes('ete')) sessionName = 'la sessione estiva';
        else if (nameFr.includes('automne')) sessionName = 'la sessione autunnale';
    }
    
    if (sessionDebates.length > 0) {
        html = `
            <p><strong>${sessionDebates.length} interventi</strong> che menzionano il CDF durante ${sessionName}.</p>
            <ul class="debates-summary-list">
                <li>🏛️ <strong>${cnCount}</strong> al Consiglio nazionale, <strong>${ceCount}</strong> al Consiglio degli Stati</li>
                <li>👥 <strong>${speakers.length}</strong> oratori diversi</li>
            </ul>
        `;
        
        if (topics.length > 0) {
            html += `<p><strong>Oggetti discussi:</strong></p><ul class="debates-topics-list">`;
            topics.slice(0, 5).forEach(topic => {
                html += `<li>${topic}</li>`;
            });
            if (topics.length > 5) {
                html += `<li><em>... e altri ${topics.length - 5}</em></li>`;
            }
            html += '</ul>';
        }
    } else {
        html = `<p>Nessun dibattito che menziona il CDF durante ${sessionName}.</p>`;
    }
    
    container.innerHTML = html;
}
