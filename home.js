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

// Emojis pour les mentions CDF
function getMentionEmojis(mention) {
    if (!mention) return { emojis: '🧑', tooltip: "L'auteur cite le CDF" };
    const hasElu = mention.includes('Élu');
    const hasCF = mention.includes('Conseil fédéral');
    
    if (hasElu && hasCF) {
        return { emojis: '🧑 🏛️', tooltip: "L'auteur et le Conseil fédéral citent le CDF" };
    } else if (hasCF) {
        return { emojis: '🏛️', tooltip: "Le Conseil fédéral cite le CDF" };
    } else {
        return { emojis: '🧑', tooltip: "L'auteur cite le CDF" };
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
            // Session active : afficher l'animation
            showSessionAnimation(activeSession);
        } else {
            // Pas de session active : afficher le résumé classique
            document.getElementById('heroBanner').style.display = 'block';
            document.getElementById('sessionAnimation').style.display = 'none';
        }
        
        // Déterminer la session à afficher (dernière session terminée ou active)
        const currentSession = activeSession || getCurrentSession(sessionsJson.sessions);
        
        // Load objects data
        const objectsResponse = await fetch(DATA_URL);
        const objectsJson = await objectsResponse.json();
        
        // Display session summary ou message session active
        const newIds = objectsJson.meta?.new_ids || [];
        
        if (activeSession) {
            // Session active: afficher les nouveaux objets déposés
            displayNewObjectsDuringSession(objectsJson.items, newIds, activeSession);
            // Cacher le texte de résumé et la légende verte
            const summaryText = document.getElementById('summaryText');
            if (summaryText) summaryText.style.display = 'none';
            const legendHint = document.querySelector('.legend-hint');
            if (legendHint) legendHint.style.display = 'none';
        } else {
            // Hors session: affichage normal
            displaySessionSummary(objectsJson.session_summary, currentSession);
            displayObjectsList(objectsJson.session_summary, newIds, objectsJson.items);
        }
        
        // Load debates data
        const debatesResponse = await fetch(DEBATES_URL);
        const debatesJson = await debatesResponse.json();
        
        // Display debates summary
        const debatesCount = displayDebatesSummary(debatesJson, currentSession);
        
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
        
        // Si on est entre le premier jour 12h et le dernier jour 12h
        if (now >= startDate && now <= endDate) {
            return session;
        }
    }
    
    return null;
}

// Afficher l'animation de session
function showSessionAnimation(session) {
    const container = document.getElementById('sessionAnimation');
    const heroBanner = document.getElementById('heroBanner');
    
    container.style.display = 'block';
    heroBanner.style.display = 'none';
    
    // Stocker la date de fin pour getSessionDayInfo
    window.currentSessionEnd = session.end;
    
    // Mettre à jour le titre et les dates (sans l'année dans le titre)
    const titleWithoutYear = session.name_fr.replace(/\s*\d{4}$/, '');
    document.getElementById('sessionTitlePixel').textContent = titleWithoutYear;
    document.getElementById('sessionDatePixel').textContent = formatSessionDates(session.start, session.end);
    
    // Mettre à jour les URLs des boutons avec les filtres de session
    const year = new Date(session.start).getFullYear();
    const sessionType = getSessionType(session.id);
    
    const btnObjects = document.getElementById('btnViewObjects');
    const btnDebates = document.getElementById('btnViewDebates');
    
    if (btnObjects) {
        btnObjects.href = `objects.html?filter_year=${year}`;
    }
    if (btnDebates) {
        btnDebates.href = `debates.html?filter_year=${year}&filter_session=${sessionType}`;
    }
    
    // Initialiser les animations
    initSessionAnimations();
}

// Obtenir le type de session (Printemps, Été, Automne, Hiver)
function getSessionType(sessionId) {
    const typeMap = {
        'printemps': 'Printemps',
        'ete': 'Été',
        'automne': 'Automne',
        'hiver': 'Hiver',
        'speciale': 'Spéciale'
    };
    const parts = sessionId.split('-');
    if (parts.length >= 2) {
        return typeMap[parts[1]] || 'Printemps';
    }
    return 'Printemps';
}

// Formater les dates de session (ex: "2 - 20 mars 2026")
function formatSessionDates(startStr, endStr) {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    
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

// Initialiser les animations de la session
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
    const dayOfWeek = now.getDay(); // 0=dimanche, 1=lundi, ..., 5=vendredi, 6=samedi
    
    // Récupérer la session active pour savoir si c'est le dernier vendredi
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
    
    // Samedi/Dimanche: pas de personnages
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Vendredi (1er & 2ème): pas de personnages
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Lundi: personnages 14:30-15:00
    if (dayOfWeek === 1) {
        return (time >= 14.5 && time < 15);
    }
    
    // Dernier vendredi: personnages 7:45-8:00
    if (isLastFriday) {
        return (time >= 7.75 && time < 8);
    }
    
    // Mardi, mercredi, jeudi: 7:45-8:00 + 14:30-15:00
    return (time >= 7.75 && time < 8) || (time >= 14.5 && time < 15);
}

function shouldShowBulles(time) {
    const { dayOfWeek, isLastFriday } = getSessionDayInfo();
    
    // Samedi/Dimanche: pas de bulles
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Vendredi (1er & 2ème): pas de bulles
    if (dayOfWeek === 5 && !isLastFriday) return false;
    
    // Lundi: bulles 15:00-19:00
    if (dayOfWeek === 1) {
        return (time >= 15 && time < 19);
    }
    
    // Dernier vendredi: bulles 8:00-12:00
    if (isLastFriday) {
        return (time >= 8 && time < 12);
    }
    
    // Mardi, mercredi, jeudi: 8:00-13:00 + 15:00-19:00
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
    
    // Générer le texte dynamiquement (comme IT)
    if (textEl) {
        const count = summary.count || 0;
        const types = summary.by_type || {};
        
        let typesText = [];
        if (types['Ip.']) typesText.push(`${types['Ip.']} interpellation${types['Ip.'] > 1 ? 's' : ''}`);
        if (types['Mo.']) typesText.push(`${types['Mo.']} motion${types['Mo.'] > 1 ? 's' : ''}`);
        if (types['Fra.']) typesText.push(`${types['Fra.']} question${types['Fra.'] > 1 ? 's' : ''}`);
        if (types['Po.']) typesText.push(`${types['Po.']} postulat${types['Po.'] > 1 ? 's' : ''}`);
        
        const cn = summary.by_council?.CN || 0;
        const ce = summary.by_council?.CE || 0;
        
        let text = `Durant la ${sessionName}, ${count} interventions mentionnant le CDF ont été déposées ou ont fait l'objet d'une réponse du Conseil fédéral qui cite le CDF : ${typesText.join(', ')}. `;
        if (cn > 0 && ce > 0) {
            text += `${cn} au Conseil national et ${ce} au Conseil des États. `;
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
                text += `Les partis les plus actifs : ${sortedParties.join(', ')}.`;
            }
        }
        
        textEl.textContent = text;
    }
}

// Afficher les nouveaux objets déposés pendant la session active
function displayNewObjectsDuringSession(allItems, newIds, activeSession) {
    const container = document.getElementById('objectsList');
    if (!container) return;
    
    // Filtrer les objets déposés pendant la session active
    const startDate = new Date(activeSession.start);
    const endDate = new Date(activeSession.end);
    
    const newObjects = allItems.filter(item => {
        // Vérifier si l'objet est dans newIds (nouveaux/mis à jour)
        if (!newIds.includes(item.shortId)) return false;
        
        // Vérifier la date de dépôt si disponible
        if (item.dateDeposit) {
            const depositDate = new Date(item.dateDeposit);
            return depositDate >= startDate && depositDate <= endDate;
        }
        return true; // Si pas de date, inclure par défaut
    });
    
    if (newObjects.length === 0) {
        container.innerHTML = `<p class="no-debates">Aucun nouvel objet déposé.</p>`;
        return;
    }
    
    // Trier par shortId décroissant
    newObjects.sort((a, b) => b.shortId.localeCompare(a.shortId, undefined, { numeric: true }));
    
    let html = '';
    for (const item of newObjects) {
        const party = translateParty(item.party);
        const type = item.type;
        const typeColor = typeColors[type] || '#6B7280';
        const partyColor = partyColors[party] || partyColors[item.party] || '#6B7280';
        const mentionData = getMentionEmojis(item.mention);
        
        html += `
            <a href="${item.url_fr}" target="_blank" class="intervention-card card-new">
                <div class="card-header">
                    <span class="card-type">${typeLabels[type] || type}</span>
                    <span class="card-id">${item.shortId}</span>
                </div>
                <div class="card-title">${item.title}</div>
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
        const partyColor = partyColors[party] || partyColors[interventions.party[i]] || '#6B7280';
        
        // Récupérer la mention depuis les items
        const itemData = itemsMap[shortId];
        const mentionData = getMentionEmojis(itemData?.mention);
        
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
                    <span class="card-mention" title="${mentionData.tooltip}">${mentionData.emojis}</span>
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
            <div class="debates-mini-cards">
                <a href="debates.html?filter_council=N" class="debate-stat-card clickable">
                    <span class="debate-stat-icon">🏛️</span>
                    <span class="debate-stat-number">${cnCount}</span>
                    <span class="debate-stat-label">Conseil national</span>
                </a>
                <a href="debates.html?filter_council=S" class="debate-stat-card clickable">
                    <span class="debate-stat-icon">🏛️</span>
                    <span class="debate-stat-number">${ceCount}</span>
                    <span class="debate-stat-label">Conseil des États</span>
                </a>
                <div class="debate-stat-card">
                    <span class="debate-stat-icon">👥</span>
                    <span class="debate-stat-number">${speakers.length}</span>
                    <span class="debate-stat-label">orateurs</span>
                </div>
            </div>
        `;
    } else {
        html = `<p class="no-debates">Aucun débat mentionnant le CDF.</p>`;
    }
    
    container.innerHTML = html;
    return sessionDebates.length;
}
