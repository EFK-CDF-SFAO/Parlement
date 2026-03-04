// Configuration
const DATA_URL = 'cdf_efk_data.json';
const DEBATES_URL = 'debates_data.json';
const SESSIONS_URL = 'sessions.json';

// Traduction des types d'objets
const typeLabels = {
    'Mo.': 'Mo.',
    'Po.': 'Po.',
    'Ip.': 'Ip.',
    'D.Ip.': 'D.Ip.',
    'Fra.': 'Fra.',
    'A.': 'A.',
    'Pa. Iv.': 'Pa. Iv.',
    'Iv. pa.': 'Iv. pa.',
    'Iv. ct.': 'Iv. ct.',
    'BRG': 'BRG'
};

// Traduction des partis
function translateParty(party) {
    const translations = {
        'V': 'SVP',
        'S': 'SP',
        'RL': 'FDP',
        'M-E': 'Die Mitte',
        'M': 'Die Mitte',
        'G': 'GRÜNE',
        'GL': 'GLP',
        'BD': 'Die Mitte',
        'CEg': 'Die Mitte',
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
        'Centre': 'Die Mitte'
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
        
        // Vérifier si une session est active
        const activeSession = getActiveSession(sessionsJson.sessions);
        
        if (activeSession) {
            showSessionAnimation(activeSession);
        } else {
            document.getElementById('heroBanner').style.display = 'block';
            document.getElementById('sessionAnimation').style.display = 'none';
        }
        
        // Déterminer la session à afficher
        const currentSession = activeSession || getCurrentSession(sessionsJson.sessions);
        
        // Load objects data
        const objectsResponse = await fetch(DATA_URL);
        const objectsJson = await objectsResponse.json();
        
        // Display session summary ou nouveaux objets si session active
        const newIds = objectsJson.meta?.new_ids || [];
        
        if (activeSession) {
            displayNewObjectsDuringSession(objectsJson.items, newIds, activeSession);
            const summaryText = document.getElementById('summaryText');
            if (summaryText) summaryText.style.display = 'none';
            const legendHint = document.querySelector('.legend-hint');
            if (legendHint) legendHint.style.display = 'none';
        } else {
            displaySessionSummary(objectsJson.session_summary, currentSession);
            displayObjectsList(objectsJson.session_summary, newIds, objectsJson.items);
        }
        
        // Load debates data (uniquement pendant session active)
        if (activeSession) {
            const debatesResponse = await fetch(DEBATES_URL);
            const debatesJson = await debatesResponse.json();
            displayDebatesSummary(debatesJson, activeSession);
        }
        
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Vérifier si une session est actuellement active (du premier jour 12h jusqu'au dernier jour 12h)
function getActiveSession(sessions) {
    const now = new Date();
    
    for (const session of sessions) {
        const startDate = new Date(session.start);
        startDate.setHours(12, 0, 0, 0); // Début à 12h le premier jour
        
        const endDate = new Date(session.end);
        endDate.setHours(12, 0, 0, 0); // Fin à 12h le dernier jour
        
        if (now >= startDate && now <= endDate) {
            return session;
        }
    }
    return null;
}

function showSessionAnimation(session) {
    const container = document.getElementById('sessionAnimation');
    const heroBanner = document.getElementById('heroBanner');
    
    container.style.display = 'block';
    heroBanner.style.display = 'none';
    
    // Speichern des Enddatums für getSessionDayInfo
    window.currentSessionEnd = session.end;
    
    // Titel ohne Jahr
    const titleWithoutYear = session.name_de.replace(/\s*\d{4}$/, '');
    document.getElementById('sessionTitlePixel').textContent = titleWithoutYear;
    document.getElementById('sessionDatePixel').textContent = formatSessionDates(session.start, session.end);
    
    // Mettre à jour les URLs des boutons avec les filtres de session
    const year = new Date(session.start).getFullYear();
    const sessionType = getSessionType(session.id);
    
    const btnObjects = document.getElementById('btnViewObjects');
    const btnDebates = document.getElementById('btnViewDebates');
    
    if (btnObjects) {
        btnObjects.href = `objects_de.html?filter_year=${year}`;
    }
    if (btnDebates) {
        btnDebates.href = `debates_de.html?filter_year=${year}&filter_session=${sessionType}`;
    }
    
    initSessionAnimations();
}

// Obtenir le type de session (Frühjahr, Sommer, Herbst, Winter)
function getSessionType(sessionId) {
    const typeMap = {
        'printemps': 'Frühjahr',
        'ete': 'Sommer',
        'automne': 'Herbst',
        'hiver': 'Winter',
        'speciale': 'Sonder'
    };
    const parts = sessionId.split('-');
    if (parts.length >= 2) {
        return typeMap[parts[1]] || 'Frühjahr';
    }
    return 'Frühjahr';
}

function formatSessionDates(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    
    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = months[end.getMonth()];
    const year = end.getFullYear();
    
    if (start.getMonth() === end.getMonth()) {
        return `${startDay}. - ${endDay}. ${month} ${year}`;
    } else {
        return `${startDay}. ${months[start.getMonth()]} - ${endDay}. ${month} ${year}`;
    }
}

function initSessionAnimations() {
    genererEtoilesSession();
    updateSessionSky();
    setInterval(updateSessionSky, 60000);
}

function genererEtoilesSession() {
    const container = document.getElementById('pixelEtoiles');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 15; i++) {
        const star = document.createElement('div');
        star.className = 'pixel-star';
        star.style.left = (Math.random() * 95 + 2) + '%';
        star.style.top = (Math.random() * 90) + '%';
        star.style.animationDelay = (Math.random() * 2) + 's';
        container.appendChild(star);
    }
}

function getSessionTime() {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
}

function getSessionDayInfo() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sonntag, 1=Montag, ..., 5=Freitag, 6=Samstag
    
    // Enddatum der Session für letzten Freitag
    const sessionEnd = window.currentSessionEnd;
    let isLastFriday = false;
    
    if (sessionEnd && dayOfWeek === 5) {
        const endDate = new Date(sessionEnd);
        const todayDate = now.toDateString();
        const endDateStr = endDate.toDateString();
        isLastFriday = (todayDate === endDateStr);
    }
    
    return { dayOfWeek, isLastFriday };
}

function shouldShowPersonnages(time) {
    const { dayOfWeek, isLastFriday } = getSessionDayInfo();
    
    // Samstag/Sonntag: keine Personen
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Freitag (1. & 2.): keine Personen
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Montag: Personen 14:30-15:00
    if (dayOfWeek === 1) {
        return (time >= 14.5 && time < 15);
    }
    
    // Letzter Freitag: Personen 7:45-8:00
    if (isLastFriday) {
        return (time >= 7.75 && time < 8);
    }
    
    // Dienstag, Mittwoch, Donnerstag: 7:45-8:00 + 14:30-15:00
    return (time >= 7.75 && time < 8) || (time >= 14.5 && time < 15);
}

function shouldShowBulles(time) {
    const { dayOfWeek, isLastFriday } = getSessionDayInfo();
    
    // Samstag/Sonntag: keine Blasen
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Freitag (1. & 2.): keine Blasen
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Montag: Blasen 15:00-19:00
    if (dayOfWeek === 1) {
        return (time >= 15 && time < 19);
    }
    
    // Letzter Freitag: Blasen 8:00-12:00
    if (isLastFriday) {
        return (time >= 8 && time < 12);
    }
    
    // Dienstag, Mittwoch, Donnerstag: 8:00-13:00 + 15:00-19:00
    return (time >= 8 && time < 13) || (time >= 15 && time < 19);
}

function genererPersonnagesSession() {
    const container = document.getElementById('pixelPersos');
    if (!container) return;
    container.innerHTML = '';
    
    const time = getSessionTime();
    if (!shouldShowPersonnages(time)) return;
    
    const personnages = [
        { parti: 'udc', dir: 'gauche', femme: false },
        { parti: 'ps', dir: 'droite', femme: true },
        { parti: 'plr', dir: 'gauche', femme: false },
        { parti: 'verts', dir: 'droite', femme: true },
        { parti: 'centre', dir: 'gauche', femme: false },
        { parti: 'vertlib', dir: 'droite', femme: true }
    ];
    
    for (let i = 0; i < personnages.length; i++) {
        const p = personnages[i];
        const perso = document.createElement('div');
        let classes = `pixel-perso ${p.parti} ${p.dir}`;
        if (p.femme) classes += ' femme';
        perso.className = classes;
        perso.style.animationDelay = (i * 1.2) + 's';
        perso.style.animationDuration = '8s';
        container.appendChild(perso);
    }
}

function gererBullesSession() {
    const time = getSessionTime();
    const bulles = document.querySelectorAll('.pixel-bulle');
    const show = shouldShowBulles(time);
    bulles.forEach(b => {
        if (show) {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
}

function updateSessionSky() {
    const container = document.getElementById('sessionAnimation');
    if (!container) return;
    
    const time = getSessionTime();
    
    container.classList.remove('morning', 'day', 'evening', 'night');
    
    if (time >= 7.75 && time < 8) {
        container.classList.add('morning');
    } else if (time >= 8 && time < 19) {
        container.classList.add('day');
    } else if (time >= 19 && time < 21) {
        container.classList.add('evening');
    } else {
        container.classList.add('night');
    }
    
    genererPersonnagesSession();
    gererBullesSession();
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
        
        let text = `Während der ${sessionName} wurden ${count} Vorstösse mit Bezug zur EFK eingereicht oder mit einer Antwort des Bundesrates versehen, die die EFK erwähnt: ${typesText.join(', ')}. `;
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
    
    // Bande verte si mise à jour < 4 jours
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    
    let html = '';
    
    for (const i of indices) {
        const shortId = interventions.shortId[i];
        const itemData = itemsMap[shortId];
        const itemDateStr = itemData?.date_maj || itemData?.date || '';
        const itemDate = itemDateStr ? new Date(itemDateStr + 'T12:00:00') : null;
        const isNew = itemDate ? itemDate >= fourDaysAgo : false;
        const party = translateParty(interventions.party[i]);
        const type = interventions.type[i];
        const typeColor = typeColors[type] || '#6B7280';
        const partyColor = partyColors[party] || '#6B7280';
        
        // Récupérer la mention depuis les items
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

// Afficher les objets déposés pendant la session active
function displayNewObjectsDuringSession(allItems, newIds, activeSession) {
    const container = document.getElementById('objectsList');
    if (!container) return;
    
    // Dates de la session (comparaison par string YYYY-MM-DD)
    const sessionStartStr = activeSession.start;
    const sessionEndStr = activeSession.end;
    
    // Filtrer les objets déposés pendant la session en cours
    const sessionObjects = allItems.filter(item => {
        const itemDateStr = (item.date || '').substring(0, 10);
        return itemDateStr >= sessionStartStr && itemDateStr <= sessionEndStr;
    });
    
    if (sessionObjects.length === 0) {
        container.innerHTML = `<p class="no-debates">Keine Vorstösse in dieser Session.</p>`;
        return;
    }
    
    // Trier par shortId décroissant (plus récents en premier)
    sessionObjects.sort((a, b) => b.shortId.localeCompare(a.shortId, undefined, { numeric: true }));
    
    // Limiter à 5 objets maximum
    const objectsToShow = sessionObjects.slice(0, 5);
    
    // Bande verte uniquement si déposé dans les 4 derniers jours
    const now = new Date();
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    
    let html = '';
    for (const item of objectsToShow) {
        const party = translateParty(item.party);
        const type = item.type;
        const partyColor = partyColors[party] || '#6B7280';
        const mentionData = getMentionEmojis(item.mention);
        
        // Bande verte si déposé il y a moins de 4 jours
        const itemDate = new Date(item.date + 'T12:00:00');
        const isNew = itemDate >= fourDaysAgo;
        
        html += `
            <a href="${item.url_de}" target="_blank" class="intervention-card${isNew ? ' card-new' : ''}">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${item.shortId}</span>
                </div>
                <div class="card-title">${item.title_de || item.title}</div>
                <div class="card-footer">
                    <span class="card-author">${item.author}</span>
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
    
    let html = '';
    
    if (sessionDebates.length > 0) {
        // Trier par date décroissante puis par sort_order
        sessionDebates.sort((a, b) => {
            const dateCompare = String(b.date).localeCompare(String(a.date));
            if (dateCompare !== 0) return dateCompare;
            return (b.sort_order || 0) - (a.sort_order || 0);
        });
        
        // Afficher les 5 derniers débats en format carte
        const latestDebates = sessionDebates.slice(0, 5);
        const newDebateIds = debatesData.new_ids || [];
        
        // Garder la bande verte pendant 4 jours
        const now = new Date();
        const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
        
        for (const debate of latestDebates) {
            const councilLabel = debate.council === 'N' ? 'Nationalrat' : 'Ständerat';
            const party = translateParty(debate.party);
            const partyColor = partyColors[party] || partyColors[debate.party] || '#6B7280';
            const title = debate.business_title_de || 'Parlamentsdebatte';
            const businessNumber = debate.business_number || '';
            const debateUrl = `debates_de.html?search=${encodeURIComponent(debate.speaker)}`;
            
            // Bande verte si date < 4 jours
            const debateDate = new Date(`${String(debate.date).substring(0,4)}-${String(debate.date).substring(4,6)}-${String(debate.date).substring(6,8)}`);
            const isNew = debateDate >= fourDaysAgo;
            
            html += `
                <a href="${debateUrl}" class="intervention-card${isNew ? ' card-new' : ''}">
                    <div class="card-header">
                        <span class="card-type">${councilLabel}</span>
                        <span class="card-id">${businessNumber}</span>
                    </div>
                    <div class="card-title">${title}</div>
                    <div class="card-footer">
                        <span class="card-author">${debate.speaker}</span>
                        <span class="card-party" style="background: ${partyColor};">${party}</span>
                    </div>
                </a>
            `;
        }
    } else {
        html = `<p class="no-debates">Keine Debatten mit Bezug zur EFK.</p>`;
    }
    
    container.innerHTML = html;
}
