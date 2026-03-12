/**
 * Module de résumé des débats via LLM (OpenAI, Ollama, Gemini)
 * 
 * Les clés API sont chargées depuis llm_config.js (non commité)
 * Voir llm_config.example.js pour le format attendu
 */

/**
 * Configuration du LLM pour la génération de résumés
 * Les clés API sont chargées depuis llm_config.js (non commité)
 */
const LLM_CONFIG = {
    // Provider actif: 'openai', 'ollama' ou 'gemini'
    provider: 'gemini',
    
    // OpenAI config
    openai: {
        get apiKey() { return typeof LLM_API_KEYS !== 'undefined' ? LLM_API_KEYS.openai : ''; },
        model: 'gpt-4o-mini',
        maxTokens: 1000
    },
    
    // Ollama config (local)
    ollama: {
        baseUrl: 'http://localhost:11434',
        model: 'mistral',
        maxTokens: 1000
    },
    
    // Gemini config (Google)
    gemini: {
        get apiKey() { return typeof LLM_API_KEYS !== 'undefined' ? LLM_API_KEYS.gemini : ''; },
        model: 'gemini-flash-latest',
        maxTokens: 4000
    },
    
    temperature: 0.3
};

// Détection automatique de la langue selon la page
function detectLanguage() {
    const path = window.location.pathname;
    if (path.includes('_de.html') || path.includes('_de')) return 'de';
    if (path.includes('_it.html') || path.includes('_it')) return 'it';
    return 'fr';
}

// Textes localisés
const LOCALES = {
    fr: {
        systemPrompt: 'Tu es un expert en politique suisse et en analyse parlementaire.',
        promptIntro: 'Résume les débats suivants sur l\'objet',
        interventions: 'Interventions',
        total: 'au total',
        instructions: `## Instructions:
1. Structure ta réponse ainsi:
   - "## Contexte" : une phrase sur le conseil (Conseil national ou Conseil des États, pas "suisse") et la période
   - "## Positions des intervenants" : pour chaque orateur, écris "**Nom Prénom (Parti, Canton)**" puis immédiatement après les points clés de sa position (2-3 phrases)
   - "## Points de consensus" : ce sur quoi les intervenants s'accordent
   - "## Divergences" : les désaccords
2. Rédige en français, de manière concise mais complète (500-800 mots selon le nombre d'intervenants)
3. Utilise "débats" en minuscule, pas de majuscule`,
        summary: 'Résumé',
        modalTitle: 'Résumé IA',
        interventionsAnalyzed: 'intervention(s) analysée(s)',
        disclaimerOpenAI: '⚠️ Résumé généré par IA (GPT-4o-mini) - À vérifier',
        disclaimerOllama: '⚠️ Résumé généré par IA (Mistral local) - À vérifier',
        disclaimerGemini: '⚠️ Résumé généré par IA (Gemini Flash) - À vérifier',
        loading: 'Génération du résumé pour',
        loadingHint: 'Cela peut prendre quelques secondes',
        btnText: '🤖 Résumer cet objet',
        btnTitle: 'Générer un résumé IA des débats sur cet objet',
        federalCouncil: 'Conseil fédéral',
        copy: 'Copier',
        copied: 'Copié !'
    },
    de: {
        systemPrompt: 'Du bist ein Experte für Schweizer Politik und parlamentarische Analyse.',
        promptIntro: 'Fasse die folgenden Debatten zum Geschäft zusammen',
        interventions: 'Wortmeldungen',
        total: 'insgesamt',
        instructions: `## Anweisungen:
1. Strukturiere deine Antwort so:
   - "## Kontext" : ein Satz über den Rat (Nationalrat oder Ständerat) und den Zeitraum
   - "## Positionen der Redner" : für jeden Redner schreibe "**Vorname Nachname (Partei, Kanton)**" und direkt danach die Kernpunkte seiner Position (2-3 Sätze)
   - "## Konsens" : worauf sich die Redner einigen
   - "## Divergenzen" : die Meinungsverschiedenheiten
2. Verfasse auf Deutsch, prägnant aber vollständig (500-800 Wörter je nach Anzahl der Redner)
3. Schreibe "Debatten" in Kleinbuchstaben`,
        summary: 'Zusammenfassung',
        modalTitle: 'KI-Zusammenfassung',
        interventionsAnalyzed: 'Wortmeldung(en) analysiert',
        disclaimerOpenAI: '⚠️ Von KI generierte Zusammenfassung (GPT-4o-mini) - Zu überprüfen',
        disclaimerOllama: '⚠️ Von KI generierte Zusammenfassung (Mistral lokal) - Zu überprüfen',
        disclaimerGemini: '⚠️ Von KI generierte Zusammenfassung (Gemini Flash) - Zu überprüfen',
        loading: 'Zusammenfassung wird erstellt für',
        loadingHint: 'Dies kann einige Sekunden dauern',
        btnText: '🤖 Geschäft zusammenfassen',
        btnTitle: 'KI-Zusammenfassung der Debatten zu diesem Geschäft erstellen',
        federalCouncil: 'Bundesrat',
        copy: 'Kopieren',
        copied: 'Kopiert!'
    },
    it: {
        systemPrompt: 'Sei un esperto di politica svizzera e di analisi parlamentare.',
        promptIntro: 'Riassumi i seguenti dibattiti sull\'oggetto',
        interventions: 'Interventi',
        total: 'in totale',
        instructions: `## Istruzioni:
1. Struttura la tua risposta così:
   - "## Contesto" : una frase sul consiglio (Consiglio nazionale o Consiglio degli Stati) e il periodo
   - "## Posizioni degli oratori" : per ogni oratore, scrivi "**Nome Cognome (Partito, Cantone)**" poi subito dopo i punti chiave della sua posizione (2-3 frasi)
   - "## Punti di consenso" : ciò su cui gli oratori concordano
   - "## Divergenze" : i disaccordi
2. Redigi in italiano, conciso ma completo (500-800 parole a seconda del numero di oratori)
3. Scrivi "dibattiti" in minuscolo`,
        summary: 'Riassunto',
        modalTitle: 'Riassunto IA',
        interventionsAnalyzed: 'intervento/i analizzato/i',
        disclaimerOpenAI: '⚠️ Riassunto generato da IA (GPT-4o-mini) - Da verificare',
        disclaimerOllama: '⚠️ Riassunto generato da IA (Mistral locale) - Da verificare',
        disclaimerGemini: '⚠️ Riassunto generato da IA (Gemini Flash) - Da verificare',
        loading: 'Generazione del riassunto per',
        loadingHint: 'Questo può richiedere alcuni secondi',
        btnText: '🤖 Riassumi questo oggetto',
        btnTitle: 'Genera un riassunto IA dei dibattiti su questo oggetto',
        federalCouncil: 'Consiglio federale',
        copy: 'Copia',
        copied: 'Copiato!'
    }
};

function getLocale() {
    return LOCALES[detectLanguage()];
}

// Mapping des partis par langue
const PARTY_NAMES_BY_LANG = {
    fr: {
        'V': 'UDC', 'S': 'PS', 'RL': 'PLR', 'M-E': 'Le Centre',
        'CE': 'Le Centre', 'C': 'Le Centre', 'BD': 'Le Centre',
        'G': 'VERT-E-S', 'GL': 'Vert\'libéraux'
    },
    de: {
        'V': 'SVP', 'S': 'SP', 'RL': 'FDP', 'M-E': 'Die Mitte',
        'CE': 'Die Mitte', 'C': 'Die Mitte', 'BD': 'Die Mitte',
        'G': 'Grüne', 'GL': 'GLP'
    },
    it: {
        'V': 'UDC', 'S': 'PS', 'RL': 'PLR', 'M-E': 'Alleanza del Centro',
        'CE': 'Alleanza del Centro', 'C': 'Alleanza del Centro', 'BD': 'Alleanza del Centro',
        'G': 'Verdi', 'GL': 'Verdi liberali'
    }
};

const COUNCIL_NAMES_BY_LANG = {
    fr: {
        'N': 'Conseil national',
        'S': 'Conseil des États',
        'V': 'Assemblée fédérale'
    },
    de: {
        'N': 'Nationalrat',
        'S': 'Ständerat',
        'V': 'Bundesversammlung'
    },
    it: {
        'N': 'Consiglio nazionale',
        'S': 'Consiglio degli Stati',
        'V': 'Assemblea federale'
    }
};

function getPartyName(partyCode) {
    const lang = detectLanguage();
    return PARTY_NAMES_BY_LANG[lang][partyCode] || partyCode;
}

function getCouncilName(councilCode) {
    const lang = detectLanguage();
    return COUNCIL_NAMES_BY_LANG[lang][councilCode] || councilCode;
}

/**
 * Filtre les débats pour un objet parlementaire donné
 */
function filterDebatesByObject(debates, businessNumber) {
    return debates.filter(d => d.business_number === businessNumber);
}

/**
 * Formate la date YYYYMMDD en DD.MM.YYYY
 */
function formatDateLLM(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    return `${dateStr.substring(6, 8)}.${dateStr.substring(4, 6)}.${dateStr.substring(0, 4)}`;
}

/**
 * Construit le prompt pour le LLM (multilingue)
 */
function buildPrompt(debates, businessNumber) {
    if (!debates.length) return '';
    
    const lang = detectLanguage();
    const locale = getLocale();
    
    // Titre selon la langue
    const title = lang === 'de' 
        ? (debates[0].business_title_de || debates[0].business_title_fr || '')
        : lang === 'it'
        ? (debates[0].business_title_it || debates[0].business_title_fr || '')
        : (debates[0].business_title_fr || debates[0].business_title_de || '');
    
    // Trier par date
    const sorted = [...debates].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    
    const interventions = sorted.map(d => {
        const speaker = d.speaker || 'Inconnu';
        const party = getPartyName(d.party) || d.party || locale.federalCouncil;
        const canton = d.canton || '';
        const dateFmt = formatDateLLM(d.date);
        const council = getCouncilName(d.council) || d.council;
        const text = d.text || '';
        
        return `### ${speaker} (${party}, ${canton}) - ${dateFmt} (${council})\n${text}\n`;
    }).join('\n');
    
    return `${locale.promptIntro} **${businessNumber}**: "${title}"

## ${locale.interventions} (${debates.length} ${locale.total}):
${interventions}

${locale.instructions}

## ${locale.summary}:`;
}

/**
 * Appelle l'API LLM (OpenAI, Ollama ou Gemini) pour générer le résumé
 */
async function callLLM(prompt) {
    const locale = getLocale();
    
    if (LLM_CONFIG.provider === 'ollama') {
        return await callOllama(prompt, locale);
    } else if (LLM_CONFIG.provider === 'gemini') {
        return await callGemini(prompt, locale);
    } else {
        return await callOpenAI(prompt, locale);
    }
}

/**
 * Appelle l'API Gemini (Google)
 */
async function callGemini(prompt, locale) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${LLM_CONFIG.gemini.model}:generateContent?key=${LLM_CONFIG.gemini.apiKey}`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `${locale.systemPrompt}\n\n${prompt}`
                }]
            }],
            generationConfig: {
                temperature: LLM_CONFIG.temperature,
                maxOutputTokens: LLM_CONFIG.gemini.maxTokens,
                responseMimeType: 'text/plain'
            }
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erreur API Gemini');
    }
    
    const data = await response.json();
    
    // Gemini 2.5 peut retourner plusieurs parts (thinking + response)
    const parts = data.candidates[0].content.parts;
    // Prendre la dernière part qui contient la réponse finale
    return parts[parts.length - 1].text;
}

/**
 * Appelle l'API Ollama (local)
 */
async function callOllama(prompt, locale) {
    const response = await fetch(`${LLM_CONFIG.ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: LLM_CONFIG.ollama.model,
            prompt: `${locale.systemPrompt}\n\n${prompt}`,
            stream: false,
            options: {
                temperature: LLM_CONFIG.temperature,
                num_predict: LLM_CONFIG.ollama.maxTokens
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Erreur Ollama - Vérifiez que le serveur est lancé (ollama serve)');
    }
    
    const data = await response.json();
    return data.response;
}

/**
 * Appelle l'API OpenAI
 */
async function callOpenAI(prompt, locale) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${LLM_CONFIG.openai.apiKey}`
        },
        body: JSON.stringify({
            model: LLM_CONFIG.openai.model,
            messages: [
                { role: 'system', content: locale.systemPrompt },
                { role: 'user', content: prompt }
            ],
            max_tokens: LLM_CONFIG.openai.maxTokens,
            temperature: LLM_CONFIG.temperature
        })
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erreur API OpenAI');
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Génère un résumé pour un objet parlementaire
 * @param {string} businessNumber - Numéro de l'objet (ex: "22.3877")
 * @param {Array} allDebates - Tableau de tous les débats
 * @returns {Promise<string>} - Le résumé généré
 */
async function generateSummary(businessNumber, allDebates) {
    const debates = filterDebatesByObject(allDebates, businessNumber);
    
    if (!debates.length) {
        throw new Error(`Aucun débat trouvé pour l'objet ${businessNumber}`);
    }
    
    const prompt = buildPrompt(debates, businessNumber);
    return await callLLM(prompt);
}

/**
 * Crée et affiche le modal de résumé (multilingue)
 */
function showSummaryModal(businessNumber, title, summary, debateCount) {
    const locale = getLocale();
    
    // Supprimer l'ancien modal s'il existe
    const existingModal = document.getElementById('summaryModal');
    if (existingModal) existingModal.remove();
    
    // Stocker le texte brut pour la copie
    window._summaryText = summary;
    
    const modal = document.createElement('div');
    modal.id = 'summaryModal';
    modal.className = 'summary-modal';
    modal.innerHTML = `
        <div class="summary-modal-content">
            <div class="summary-modal-header">
                <h2>📋 ${locale.modalTitle} - ${businessNumber}</h2>
                <button class="summary-modal-close" onclick="closeSummaryModal()">&times;</button>
            </div>
            <div class="summary-modal-subtitle">${title}</div>
            <div class="summary-modal-meta">${debateCount} ${locale.interventionsAnalyzed}</div>
            <div class="summary-modal-body">${formatSummaryAsHTML(summary)}</div>
            <div class="summary-modal-footer">
                <span class="summary-disclaimer">${LLM_CONFIG.provider === 'gemini' ? locale.disclaimerGemini : (LLM_CONFIG.provider === 'ollama' ? locale.disclaimerOllama : locale.disclaimerOpenAI)}</span>
                <button class="btn-copy-summary" onclick="copySummaryToClipboard()">📋 ${locale.copy}</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Fermer en cliquant en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeSummaryModal();
    });
    
    // Fermer avec Escape
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Copie le résumé dans le presse-papier
 */
async function copySummaryToClipboard() {
    const locale = getLocale();
    const btn = document.querySelector('.btn-copy-summary');
    
    try {
        await navigator.clipboard.writeText(window._summaryText || '');
        btn.innerHTML = `✓ ${locale.copied}`;
        btn.classList.add('copied');
        
        setTimeout(() => {
            btn.innerHTML = `📋 ${locale.copy}`;
            btn.classList.remove('copied');
        }, 2000);
    } catch (err) {
        console.error('Erreur copie:', err);
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape') closeSummaryModal();
}

function closeSummaryModal() {
    const modal = document.getElementById('summaryModal');
    if (modal) modal.remove();
    document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Convertit le markdown simple en HTML avec une meilleure structure
 */
function formatSummaryAsHTML(text) {
    // Normaliser les sauts de ligne
    let html = text.trim();
    
    // Titres (ordre important: ### avant ## avant #)
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
    
    // Gras
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Listes à puces
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Chaque ligne qui commence par un nom en gras devient un paragraphe
    // Détecte les lignes commençant par <strong> (après conversion du **)
    html = html.replace(/\n(<strong>)/g, '</p><p class="speaker">$1');
    
    // Paragraphes (double saut de ligne)
    html = html.replace(/\n\n/g, '</p><p>');
    
    // Simple saut de ligne restant
    html = html.replace(/\n/g, '<br>');
    
    // Envelopper dans un paragraphe
    html = '<p>' + html + '</p>';
    
    // Nettoyer les paragraphes vides et mal formés
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p><h/g, '<h');
    html = html.replace(/<\/h2><\/p>/g, '</h2>');
    html = html.replace(/<\/h4><\/p>/g, '</h4>');
    html = html.replace(/<p><br>/g, '<p>');
    html = html.replace(/<br><\/p>/g, '</p>');
    
    return html;
}

/**
 * Affiche un loader pendant le chargement (multilingue)
 */
function showSummaryLoader(businessNumber) {
    const locale = getLocale();
    
    const existingModal = document.getElementById('summaryModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.id = 'summaryModal';
    modal.className = 'summary-modal';
    modal.innerHTML = `
        <div class="summary-modal-content summary-loading">
            <div class="summary-spinner"></div>
            <p>${locale.loading} <strong>${businessNumber}</strong>...</p>
            <p class="summary-loading-hint">${locale.loadingHint}</p>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/**
 * Gère le clic sur le bouton de résumé
 */
async function handleSummaryClick(businessNumber, businessTitle, allDebates) {
    showSummaryLoader(businessNumber);
    
    try {
        const debates = filterDebatesByObject(allDebates, businessNumber);
        const summary = await generateSummary(businessNumber, allDebates);
        showSummaryModal(businessNumber, businessTitle, summary, debates.length);
    } catch (error) {
        closeSummaryModal();
        alert(`Erreur: ${error.message}`);
    }
}
