/**
 * Module de carte interactive de la Suisse
 * Utilise les données GeoJSON officielles de Swisstopo
 * Affiche les cantons colorés selon le nombre d'interventions
 * Permet de filtrer par canton en cliquant
 */

// Mapping des body_key/body_name vers les IDs des cantons
const CANTON_MAPPING = {
    // Noms utilisés dans les données cantonales
    'Zurich (Ville)': 'ZH', 'Zürich': 'ZH', 'Kanton Zürich': 'ZH', 'Stadt Zürich': 'ZH',
    'Berne': 'BE', 'Bern': 'BE', 'Bern/Berne': 'BE', 'Kanton Bern': 'BE',
    'Luzern': 'LU', 'Lucerne': 'LU', 'Kanton Luzern': 'LU',
    'Uri': 'UR', 'Schwyz': 'SZ', 'Obwalden': 'OW', 'Nidwalden': 'NW',
    'Glarus': 'GL', 'Zoug': 'ZG', 'Zug': 'ZG',
    'Fribourg': 'FR', 'Freiburg': 'FR', 'Fribourg/Freiburg': 'FR',
    'Solothurn': 'SO', 'Soleure': 'SO',
    'Basel-Stadt': 'BS', 'Bâle-Ville': 'BS',
    'Basel-Landschaft': 'BL', 'Bâle-Campagne': 'BL',
    'Schaffhausen': 'SH', 'Schaffhouse': 'SH',
    'Appenzell Ausserrhoden': 'AR', 'Appenzell Innerrhoden': 'AI',
    'St. Gallen': 'SG', 'Saint-Gall': 'SG',
    'Graubünden': 'GR', 'Grisons': 'GR', 'Grigioni': 'GR',
    'Aargau': 'AG', 'Argovie': 'AG',
    'Thurgau': 'TG', 'Thurgovie': 'TG',
    'Ticino': 'TI', 'Tessin': 'TI',
    'Vaud': 'VD', 'Waadt': 'VD',
    'Valais': 'VS', 'Wallis': 'VS', 'Valais/Wallis': 'VS',
    'Neuchâtel': 'NE', 'Neuenburg': 'NE',
    'Genève': 'GE', 'Genf': 'GE',
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
let geoData = null;

/**
 * Initialise la carte avec les données
 */
async function initSwissMap(affairs, lang = 'fr') {
    mapLang = lang;
    
    const mapContainer = document.getElementById('swiss-map-container');
    if (!mapContainer) return;
    
    try {
        // Charger le GeoJSON
        const response = await fetch('swiss-cantons.geojson');
        geoData = await response.json();
        
        // Compter les interventions par canton
        countInterventionsByCanton(affairs);
        
        // Créer le SVG à partir du GeoJSON
        createSvgMap(mapContainer);
        
        
    } catch (error) {
        console.error('Erreur chargement carte:', error);
        mapContainer.innerHTML = '<p style="text-align:center;color:#666;">Carte non disponible</p>';
    }
}

/**
 * Crée le SVG de la carte à partir du GeoJSON
 */
function createSvgMap(container) {
    const width = 500;
    const height = 340;
    
    // Projection pour la Suisse
    const bounds = getBounds(geoData);
    const scale = Math.min(
        width / (bounds.maxX - bounds.minX),
        height / (bounds.maxY - bounds.minY)
    ) * 0.95;
    
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    
    // Créer le SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('id', 'swiss-map');
    
    // Dessiner chaque canton
    geoData.features.forEach(feature => {
        const cantonId = feature.properties.id;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', cantonId);
        path.setAttribute('class', 'canton');
        path.setAttribute('d', geoToPath(feature.geometry, centerX, centerY, scale, width, height));
        
        // Colorer selon le nombre d'interventions
        const count = cantonCounts[cantonId] || 0;
        const maxCount = Math.max(...Object.values(cantonCounts), 1);
        
        if (count > 0) {
            const intensity = 0.2 + (count / maxCount) * 0.8;
            path.style.fill = BASE_COLOR;
            path.style.opacity = intensity;
        } else {
            path.style.fill = '#e0e0e0';
            path.style.opacity = 1;
        }
        
        // Événements
        path.addEventListener('click', () => toggleCantonFilter(cantonId));
        path.addEventListener('mouseenter', (e) => showTooltip(e, cantonId));
        path.addEventListener('mouseleave', hideTooltip);
        
        svg.appendChild(path);
    });
    
    container.innerHTML = '';
    container.appendChild(svg);
}

/**
 * Calcule les limites du GeoJSON
 */
function getBounds(geojson) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    geojson.features.forEach(feature => {
        const coords = feature.geometry.type === 'Polygon' 
            ? feature.geometry.coordinates 
            : feature.geometry.coordinates.flat();
        
        coords.forEach(ring => {
            ring.forEach(([x, y]) => {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
        });
    });
    
    return { minX, minY, maxX, maxY };
}

/**
 * Convertit une géométrie GeoJSON en chemin SVG
 */
function geoToPath(geometry, centerX, centerY, scale, width, height) {
    const project = ([x, y]) => {
        const px = (x - centerX) * scale + width / 2;
        const py = (centerY - y) * scale + height / 2; // Inverser Y
        return [px, py];
    };
    
    const rings = geometry.type === 'Polygon' 
        ? geometry.coordinates 
        : geometry.coordinates.flat();
    
    return rings.map(ring => {
        const points = ring.map(project);
        return 'M' + points.map(p => p.join(',')).join('L') + 'Z';
    }).join(' ');
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
