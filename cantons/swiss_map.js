/**
 * Module de carte interactive de la Suisse
 * Affiche les cantons colorés selon le nombre d'interventions
 * Permet de filtrer par canton en cliquant
 */

// Mapping des body_key/body_name vers les IDs SVG des cantons
const CANTON_MAPPING = {
    // Cantons avec leur code ISO
    'Zürich': 'ZH',
    'Kanton Zürich': 'ZH',
    'Stadt Zürich': 'ZH',  // Fusionné avec le canton
    'Bern': 'BE',
    'Kanton Bern': 'BE',
    'Luzern': 'LU',
    'Kanton Luzern': 'LU',
    'Uri': 'UR',
    'Schwyz': 'SZ',
    'Obwalden': 'OW',
    'Nidwalden': 'NW',
    'Glarus': 'GL',
    'Zug': 'ZG',
    'Fribourg': 'FR',
    'Freiburg': 'FR',
    'Solothurn': 'SO',
    'Basel-Stadt': 'BS',
    'Basel-Landschaft': 'BL',
    'Schaffhausen': 'SH',
    'Appenzell Ausserrhoden': 'AR',
    'Appenzell Innerrhoden': 'AI',
    'St. Gallen': 'SG',
    'Graubünden': 'GR',
    'Aargau': 'AG',
    'Thurgau': 'TG',
    'Ticino': 'TI',
    'Tessin': 'TI',
    'Vaud': 'VD',
    'Waadt': 'VD',
    'Valais': 'VS',
    'Wallis': 'VS',
    'Neuchâtel': 'NE',
    'Neuenburg': 'NE',
    'Genève': 'GE',
    'Genf': 'GE',
    'Jura': 'JU',
    // Codes directs
    'ZH': 'ZH', 'BE': 'BE', 'LU': 'LU', 'UR': 'UR', 'SZ': 'SZ',
    'OW': 'OW', 'NW': 'NW', 'GL': 'GL', 'ZG': 'ZG', 'FR': 'FR',
    'SO': 'SO', 'BS': 'BS', 'BL': 'BL', 'SH': 'SH', 'AR': 'AR',
    'AI': 'AI', 'SG': 'SG', 'GR': 'GR', 'AG': 'AG', 'TG': 'TG',
    'TI': 'TI', 'VD': 'VD', 'VS': 'VS', 'NE': 'NE', 'GE': 'GE', 'JU': 'JU'
};

// Noms des cantons par langue
const CANTON_NAMES = {
    fr: {
        'ZH': 'Zurich', 'BE': 'Berne', 'LU': 'Lucerne', 'UR': 'Uri', 'SZ': 'Schwytz',
        'OW': 'Obwald', 'NW': 'Nidwald', 'GL': 'Glaris', 'ZG': 'Zoug', 'FR': 'Fribourg',
        'SO': 'Soleure', 'BS': 'Bâle-Ville', 'BL': 'Bâle-Campagne', 'SH': 'Schaffhouse',
        'AR': 'Appenzell RE', 'AI': 'Appenzell RI', 'SG': 'Saint-Gall', 'GR': 'Grisons',
        'AG': 'Argovie', 'TG': 'Thurgovie', 'TI': 'Tessin', 'VD': 'Vaud', 'VS': 'Valais',
        'NE': 'Neuchâtel', 'GE': 'Genève', 'JU': 'Jura'
    },
    de: {
        'ZH': 'Zürich', 'BE': 'Bern', 'LU': 'Luzern', 'UR': 'Uri', 'SZ': 'Schwyz',
        'OW': 'Obwalden', 'NW': 'Nidwalden', 'GL': 'Glarus', 'ZG': 'Zug', 'FR': 'Freiburg',
        'SO': 'Solothurn', 'BS': 'Basel-Stadt', 'BL': 'Basel-Landschaft', 'SH': 'Schaffhausen',
        'AR': 'Appenzell AR', 'AI': 'Appenzell AI', 'SG': 'St. Gallen', 'GR': 'Graubünden',
        'AG': 'Aargau', 'TG': 'Thurgau', 'TI': 'Tessin', 'VD': 'Waadt', 'VS': 'Wallis',
        'NE': 'Neuenburg', 'GE': 'Genf', 'JU': 'Jura'
    },
    it: {
        'ZH': 'Zurigo', 'BE': 'Berna', 'LU': 'Lucerna', 'UR': 'Uri', 'SZ': 'Svitto',
        'OW': 'Obvaldo', 'NW': 'Nidvaldo', 'GL': 'Glarona', 'ZG': 'Zugo', 'FR': 'Friburgo',
        'SO': 'Soletta', 'BS': 'Basilea Città', 'BL': 'Basilea Campagna', 'SH': 'Sciaffusa',
        'AR': 'Appenzello RE', 'AI': 'Appenzello RI', 'SG': 'San Gallo', 'GR': 'Grigioni',
        'AG': 'Argovia', 'TG': 'Turgovia', 'TI': 'Ticino', 'VD': 'Vaud', 'VS': 'Vallese',
        'NE': 'Neuchâtel', 'GE': 'Ginevra', 'JU': 'Giura'
    }
};

// Couleur de base CDF/EFK
const BASE_COLOR = '#003399';

let cantonCounts = {};
let selectedCanton = null;
let mapLang = 'fr';

/**
 * Initialise la carte avec les données
 */
async function initSwissMap(affairs, lang = 'fr') {
    mapLang = lang;
    
    // Charger le SVG
    const mapContainer = document.getElementById('swiss-map-container');
    if (!mapContainer) return;
    
    try {
        const response = await fetch('swiss_map.svg');
        const svgText = await response.text();
        mapContainer.innerHTML = svgText;
        
        // Compter les interventions par canton
        countInterventionsByCanton(affairs);
        
        // Colorier la carte
        colorizeMap();
        
        // Ajouter les événements de clic
        setupMapEvents();
        
        // Créer la légende
        createLegend();
        
    } catch (error) {
        console.error('Erreur chargement carte:', error);
        mapContainer.innerHTML = '<p style="text-align:center;color:#666;">Carte non disponible</p>';
    }
}

/**
 * Compte les interventions par canton
 */
function countInterventionsByCanton(affairs) {
    cantonCounts = {};
    
    affairs.forEach(affair => {
        const bodyKey = affair.body_key || '';
        const bodyName = affair.body_name || '';
        
        // Trouver le code canton
        let cantonCode = CANTON_MAPPING[bodyKey] || CANTON_MAPPING[bodyName];
        
        if (cantonCode) {
            cantonCounts[cantonCode] = (cantonCounts[cantonCode] || 0) + 1;
        }
    });
    
    return cantonCounts;
}

/**
 * Colorise la carte selon le nombre d'interventions
 */
function colorizeMap() {
    const maxCount = Math.max(...Object.values(cantonCounts), 1);
    
    // Parcourir tous les cantons du SVG
    document.querySelectorAll('.canton').forEach(canton => {
        const cantonId = canton.id;
        const count = cantonCounts[cantonId] || 0;
        
        if (count > 0) {
            // Calculer l'opacité (0.2 à 1.0)
            const intensity = 0.2 + (count / maxCount) * 0.8;
            canton.style.fill = BASE_COLOR;
            canton.style.opacity = intensity;
        } else {
            canton.style.fill = '#e0e0e0';
            canton.style.opacity = 1;
        }
        
        // Tooltip
        const cantonName = CANTON_NAMES[mapLang][cantonId] || cantonId;
        canton.setAttribute('title', `${cantonName}: ${count} intervention${count > 1 ? 's' : ''}`);
    });
}

/**
 * Configure les événements de clic sur la carte
 */
function setupMapEvents() {
    document.querySelectorAll('.canton').forEach(canton => {
        canton.addEventListener('click', (e) => {
            const cantonId = e.target.id;
            toggleCantonFilter(cantonId);
        });
        
        // Tooltip au survol
        canton.addEventListener('mouseenter', (e) => {
            showTooltip(e, canton.id);
        });
        
        canton.addEventListener('mouseleave', () => {
            hideTooltip();
        });
    });
}

/**
 * Active/désactive le filtre par canton
 */
function toggleCantonFilter(cantonId) {
    const cantonSelect = document.getElementById('cantonFilter');
    
    // Désélectionner si même canton
    if (selectedCanton === cantonId) {
        selectedCanton = null;
        cantonSelect.value = '';
        document.querySelectorAll('.canton').forEach(c => c.classList.remove('active'));
    } else {
        selectedCanton = cantonId;
        
        // Trouver le nom du canton correspondant dans le select
        const cantonName = findCantonNameInSelect(cantonId);
        if (cantonName) {
            cantonSelect.value = cantonName;
        }
        
        // Highlight visuel
        document.querySelectorAll('.canton').forEach(c => c.classList.remove('active'));
        document.getElementById(cantonId)?.classList.add('active');
    }
    
    // Déclencher le filtre
    filterAffairs();
}

/**
 * Trouve le nom du canton dans le select
 */
function findCantonNameInSelect(cantonId) {
    const cantonSelect = document.getElementById('cantonFilter');
    
    for (let option of cantonSelect.options) {
        const value = option.value;
        if (CANTON_MAPPING[value] === cantonId) {
            return value;
        }
    }
    return null;
}

/**
 * Met à jour la sélection visuelle sur la carte depuis le select
 */
function updateMapFromSelect(selectValue) {
    document.querySelectorAll('.canton').forEach(c => c.classList.remove('active'));
    
    if (selectValue) {
        const cantonId = CANTON_MAPPING[selectValue];
        if (cantonId) {
            selectedCanton = cantonId;
            document.getElementById(cantonId)?.classList.add('active');
        }
    } else {
        selectedCanton = null;
    }
}

/**
 * Affiche le tooltip
 */
function showTooltip(event, cantonId) {
    let tooltip = document.getElementById('map-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'map-tooltip';
        tooltip.className = 'map-tooltip';
        document.body.appendChild(tooltip);
    }
    
    const count = cantonCounts[cantonId] || 0;
    const cantonName = CANTON_NAMES[mapLang][cantonId] || cantonId;
    
    const labels = {
        fr: { intervention: 'intervention', interventions: 'interventions', none: 'Aucune intervention' },
        de: { intervention: 'Intervention', interventions: 'Interventionen', none: 'Keine Intervention' },
        it: { intervention: 'intervento', interventions: 'interventi', none: 'Nessun intervento' }
    };
    const l = labels[mapLang] || labels.fr;
    
    tooltip.innerHTML = `<strong>${cantonName}</strong><br>${count > 0 ? count + ' ' + (count > 1 ? l.interventions : l.intervention) : l.none}`;
    tooltip.style.display = 'block';
    tooltip.style.left = (event.pageX + 10) + 'px';
    tooltip.style.top = (event.pageY + 10) + 'px';
}

/**
 * Cache le tooltip
 */
function hideTooltip() {
    const tooltip = document.getElementById('map-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

/**
 * Crée la légende de la carte
 */
function createLegend() {
    const legendContainer = document.getElementById('map-legend');
    if (!legendContainer) return;
    
    const labels = {
        fr: { few: 'Peu', many: 'Beaucoup', none: 'Aucune' },
        de: { few: 'Wenig', many: 'Viele', none: 'Keine' },
        it: { few: 'Pochi', many: 'Molti', none: 'Nessuno' }
    };
    const l = labels[mapLang] || labels.fr;
    
    legendContainer.innerHTML = `
        <div class="legend-item">
            <span class="legend-color" style="background: #e0e0e0;"></span>
            <span>${l.none}</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: ${BASE_COLOR}; opacity: 0.3;"></span>
            <span>${l.few}</span>
        </div>
        <div class="legend-item">
            <span class="legend-color" style="background: ${BASE_COLOR}; opacity: 1;"></span>
            <span>${l.many}</span>
        </div>
    `;
}
