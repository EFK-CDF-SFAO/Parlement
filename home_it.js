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

// Traduction des partis
function translateParty(party) {
    const translations = {
        'V': 'UDC',
        'S': 'PS',
        'RL': 'PLR',
        'M-E': 'Alleanza del Centro',
        'M': 'Alleanza del Centro',
        'G': 'Verdi',
        'GL': 'Verdi liberali',
        'BD': 'Alleanza del Centro',
        'CEg': 'Alleanza del Centro',
        'Al': 'Verdi',
        'VERT-E-S': 'Verdi',
        'PSS': 'PS',
        'Le Centre': 'Alleanza del Centro',
        'pvl': 'Verdi liberali',
        'PVL': 'Verdi liberali'
    };
    return translations[party] || party;
}

// Nomi delle sessioni in italiano
const sessionNames = {
    'printemps': 'sessione primaverile',
    'ete': 'sessione estiva',
    'automne': 'sessione autunnale',
    'hiver': 'sessione invernale'
};

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
    'UDC': '#009F4D',
    'PLR': '#0066CC',
    'Alleanza del Centro': '#FF9900',
    'PS': '#E41019',
    'Verdi': '#84B414',
    'Verdi liberali': '#A6CF42'
};

// Emojis per le citazioni CDF
function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: "L'autore cita il CDF" };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: "L'autore e il Consiglio federale citano il CDF" };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: "Il Consiglio federale cita il CDF" };
    } else {
        return { emojis: '🧑', tooltip: "L'autore cita il CDF" };
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
        let newIds = objectsJson.meta?.new_ids || [];
        // Convertir en tableau si c'est une string
        if (typeof newIds === 'string') {
            newIds = newIds.split(',').map(id => id.trim()).filter(id => id);
        }
        
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
    
    // Memorizzare la data di fine per getSessionDayInfo
    window.currentSessionEnd = session.end;
    
    // Utiliser name_fr comme fallback si name_it n'existe pas
    const sessionName = session.name_it || session.name_fr.replace('Session de printemps', 'Sessione primaverile')
        .replace("Session d'été", 'Sessione estiva')
        .replace("Session d'automne", 'Sessione autunnale')
        .replace("Session d'hiver", 'Sessione invernale');
    
    // Titolo senza anno
    const titleWithoutYear = sessionName.replace(/\s*\d{4}$/, '');
    document.getElementById('sessionTitlePixel').textContent = titleWithoutYear;
    document.getElementById('sessionDatePixel').textContent = formatSessionDatesIt(session.start, session.end);
    
    // Mettre à jour les URLs des boutons avec les filtres de session
    const year = new Date(session.start).getFullYear();
    const sessionType = getSessionType(session.id);
    
    const btnObjects = document.getElementById('btnViewObjects');
    const btnDebates = document.getElementById('btnViewDebates');
    
    if (btnObjects) {
        btnObjects.href = `objects_it.html?filter_year=${year}`;
    }
    if (btnDebates) {
        btnDebates.href = `debates_it.html?filter_year=${year}&filter_session=${sessionType}`;
    }
    
    initSessionAnimations();
}

// Obtenir le type de session (Primaverile, Estiva, Autunnale, Invernale)
function getSessionType(sessionId) {
    const typeMap = {
        'printemps': 'Primaverile',
        'ete': 'Estiva',
        'automne': 'Autunnale',
        'hiver': 'Invernale',
        'speciale': 'Speciale'
    };
    const parts = sessionId.split('-');
    if (parts.length >= 2) {
        return typeMap[parts[1]] || 'Primaverile';
    }
    return 'Primaverile';
}

function formatSessionDatesIt(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 
                    'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
    
    const startDay = start.getDate();
    const endDay = end.getDate();
    const month = months[end.getMonth()];
    const year = end.getFullYear();
    
    if (start.getMonth() === end.getMonth()) {
        return `${startDay} - ${endDay} ${month} ${year}`;
    } else {
        return `${startDay} ${months[start.getMonth()]} - ${endDay} ${month} ${year}`;
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
    const dayOfWeek = now.getDay(); // 0=domenica, 1=lunedì, ..., 5=venerdì, 6=sabato
    
    // Data di fine sessione per ultimo venerdì
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
    
    // Sabato/Domenica: nessun personaggio
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Venerdì (1° & 2°): nessun personaggio
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Lunedì: personaggi 14:30-15:00
    if (dayOfWeek === 1) {
        return (time >= 14.5 && time < 15);
    }
    
    // Ultimo venerdì: personaggi 7:45-8:00
    if (isLastFriday) {
        return (time >= 7.75 && time < 8);
    }
    
    // Martedì, mercoledì, giovedì: 7:45-8:00 + 14:30-15:00
    return (time >= 7.75 && time < 8) || (time >= 14.5 && time < 15);
}

function shouldShowBulles(time) {
    const { dayOfWeek, isLastFriday } = getSessionDayInfo();
    
    // Sabato/Domenica: nessuna bolla
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Venerdì (tranne ultimo): nessuna bolla
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Lunedì: bolle solo dalle 15:00
    if (dayOfWeek === 1) {
        return (time >= 15 && time < 19);
    }
    
    // Ultimo venerdì: bolle 8:00-12:00
    if (isLastFriday) {
        return (time >= 8 && time < 12);
    }
    
    // Martedì, mercoledì, giovedì: 8:00-13:00 + 15:00-19:00
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
        
        let text = `Durante la ${sessionName}, sono stati presentati ${count} interventi relativi al CDF o che hanno ricevuto una risposta del Consiglio federale che cita il CDF: ${typesText.join(', ')}. `;
        if (cn > 0 && ce > 0) {
            text += `${cn} al Consiglio nazionale e ${ce} al Consiglio degli Stati. `;
        } else if (cn > 0) {
            text += `Tutti al Consiglio nazionale. `;
        } else if (ce > 0) {
            text += `Tutti al Consiglio degli Stati. `;
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
                text += `I partiti più attivi: ${sortedParties.join(', ')}.`;
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
        
        // URL italiano
        const url = interventions.url_fr[i].replace('/fr/', '/it/');
        // Titre: priorité IT > FR
        const titleIT = interventions.title_it ? interventions.title_it[i] : null;
        const titleFR = interventions.title[i];
        const title = (titleIT && titleIT.trim() && titleIT.toLowerCase() !== 'titre suit') 
            ? titleIT 
            : titleFR;
        
        html += `
            <a href="${url}" target="_blank" class="intervention-card${isNew ? ' card-new' : ''}">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${shortId}</span>
                </div>
                <div class="card-title">${title}</div>
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

// Afficher les nouveaux objets déposés pendant la session active
function displayNewObjectsDuringSession(allItems, newIds, activeSession) {
    const container = document.getElementById('objectsList');
    if (!container) return;
    
    // Filtrer les objets qui sont dans newIds (nouveaux/mis à jour)
    const newObjects = allItems.filter(item => newIds.includes(item.shortId));
    
    if (newObjects.length === 0) {
        container.innerHTML = `<p class="no-debates">Nessun nuovo intervento depositato.</p>`;
        return;
    }
    
    newObjects.sort((a, b) => b.shortId.localeCompare(a.shortId, undefined, { numeric: true }));
    
    let html = '';
    for (const item of newObjects) {
        const party = translateParty(item.party);
        const type = item.type;
        const partyColor = partyColors[party] || '#6B7280';
        const mentionData = getMentionEmojis(item.mention);
        const url = item.url_fr.replace('/fr/', '/it/');
        const title = (item.title_it && item.title_it.trim() && item.title_it.toLowerCase() !== 'titre suit') 
            ? item.title_it : item.title;
        
        html += `
            <a href="${url}" target="_blank" class="intervention-card card-new">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${item.shortId}</span>
                </div>
                <div class="card-title">${title}</div>
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
        
        for (const debate of latestDebates) {
            const councilLabel = debate.council === 'N' ? 'Consiglio nazionale' : 'Consiglio degli Stati';
            const party = translateParty(debate.party);
            const partyColor = partyColors[party] || partyColors[debate.party] || '#6B7280';
            const title = debate.business_title_it || debate.business_title_fr || 'Dibattito parlamentare';
            const businessNumber = debate.business_number || '';
            const debateUrl = `debates_it.html?search=${encodeURIComponent(debate.speaker)}`;
            const isNew = newDebateIds.includes(debate.id);
            
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
        html = `<p class="no-debates">Nessun dibattito che menziona il CDF.</p>`;
    }
    
    container.innerHTML = html;
}
