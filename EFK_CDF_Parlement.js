// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: gavel;

/**
 * Le CDF au Parlement / Die EFK im Parlament
 * 
 * Affiche les 5 dernières interventions parlementaires (interpellations, motions, questions)
 * mentionnant le Contrôle fédéral des finances (CDF/EFK).
 * 
 * Logique:
 * - Recherche par mot-clé via l'API Open Data du Parlement
 * - Tri par date de mise à jour (plus récente d'abord)
 * - Affichage des 5 dernières interventions
 * - Détection quotidienne des nouvelles interventions
 */

// --- Configuration ---
const UPDATE_HOUR = 0;
const UPDATE_MINUTE = 30;
const CACHE_VALIDITY_HOURS = 6;

// URL GitHub pour les données JSON
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/EFK-CDF-SFAO/Parlement/main/cdf_efk_data.json";
const GITHUB_DEBATES_URL = "https://raw.githubusercontent.com/EFK-CDF-SFAO/Parlement/main/debates_data.json";

// Fallback: Fichier JS local (iCloud Scriptable)
const DATA_MODULE = "CDF_Data";

// URLs Curia Vista (clic sur le widget)
const CV_FR = 'https://www.parlament.ch/fr/ratsbetrieb/suche-curia-vista#k=%22Contr%C3%B4le%20f%C3%A9d%C3%A9ral%20des%20finances%22';
const CV_DE = 'https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista#k=%22Eidgen%C3%B6ssische%20Finanzkontrolle%22';

// API Open Data
const API_BASE = "https://ws-old.parlament.ch";

// Types d'interventions à inclure
// 5 = Motion, 6 = Postulat, 8 = Interpellation, 9 = Interpellation urgente, 11 = Question, 13 = Question urgente
const INTERVENTION_TYPE_IDS = new Set([5, 6, 8, 9, 11, 13]);

const CV_IT = 'https://www.parlament.ch/it/ratsbetrieb/suche-curia-vista#k=%22Controllo%20federale%20delle%20finanze%22';

const CFG = {
  fr: {
    title: "CDF - Parlement",
    keyword: "Contrôle fédéral des finances",
    openUrl: CV_FR,
    apiLang: "fr",
    acceptLang: "fr-CH,fr;q=0.9",
    labelUpdates: "Mises à jour récentes",
    noUpdates: "Pas de nouvelles mentions du CDF",
  },
  de: {
    title: "EFK - Parlament",
    keyword: "Eidgenössische Finanzkontrolle",
    openUrl: CV_DE,
    apiLang: "de",
    acceptLang: "de-CH,de;q=0.9",
    labelUpdates: "Aktuelle Aktualisierungen",
    noUpdates: "Keine neuen EFK-Erwähnungen",
  },
  it: {
    title: "CDF - Parlamento",
    keyword: "Controllo federale delle finanze",
    openUrl: CV_IT,
    apiLang: "it",
    acceptLang: "it-CH,it;q=0.9",
    labelUpdates: "Aggiornamenti recenti",
    noUpdates: "Nessuna nuova menzione del CDF",
  },
};

// --- Détection langue iOS ---
function detectLang() {
  try {
    const pref = Device.preferredLanguages ? Device.preferredLanguages() : [];
    const first = (Array.isArray(pref) && pref.length ? String(pref[0]) : "").toLowerCase();
    if (first.startsWith("de")) return "de";
    if (first.startsWith("it")) return "it";
  } catch (_) {}
  return "fr";
}

const LANG = detectLang();
const cfg = CFG[LANG];

// --- Couleurs dynamiques (Light/Dark) ---
const BG = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E")); // Blanc / Gris foncé
const TEXT_PRIMARY = Color.dynamic(new Color("#1C1C1E"), new Color("#FFFFFF"));
const TEXT_SECONDARY = Color.dynamic(new Color("#6B7280"), new Color("#9CA3AF"));
const ACCENT = new Color("#EA5A4F"); // Rouge CDF
const ACCENT_LIGHT = Color.dynamic(new Color("#FEE2E2"), new Color("#7F1D1D")); // Rouge clair/foncé
const CARD_BG = Color.dynamic(new Color("#F3F4F6"), new Color("#2C2C2E"));
const SUCCESS = new Color("#10B981"); // Vert

// --- Cache ---
const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "cdf-efk-parliament");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);

const PATH_CACHE = fm.joinPath(dir, `cache_v2_${LANG}.json`);
const PATH_SEEN_IDS = fm.joinPath(dir, `seen_ids_v2_${LANG}.json`);
const PATH_NEW_IDS = fm.joinPath(dir, `new_ids_v2_${LANG}.json`);
const PATH_LAST_UPDATE = fm.joinPath(dir, `last_update_v2_${LANG}.txt`);
const PATH_LAST_FETCH = fm.joinPath(dir, `last_fetch_v2_${LANG}.txt`);
const PATH_RECENT_ITEMS = fm.joinPath(dir, `recent_items_${LANG}.json`);

function readJSON(path, fallback) {
  try {
    if (!fm.fileExists(path)) return fallback;
    return JSON.parse(fm.readString(path));
  } catch (_) {
    return fallback;
  }
}

function writeJSON(path, obj) {
  try {
    fm.writeString(path, JSON.stringify(obj));
  } catch (_) {}
}

function readText(path, fallback = "") {
  try {
    if (!fm.fileExists(path)) return fallback;
    return fm.readString(path);
  } catch (_) {
    return fallback;
  }
}

function writeText(path, txt) {
  try {
    fm.writeString(path, txt);
  } catch (_) {}
}

function shouldDoDailyUpdate() {
  const now = new Date();
  const last = new Date(readText(PATH_LAST_UPDATE, "1970-01-01T00:00:00.000Z"));
  const todayUpdate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), UPDATE_HOUR, UPDATE_MINUTE);
  return now >= todayUpdate && last < todayUpdate;
}

function isCacheValid() {
  const now = new Date();
  const lastFetch = new Date(readText(PATH_LAST_FETCH, "1970-01-01T00:00:00.000Z"));
  const hoursSinceLastFetch = (now - lastFetch) / (1000 * 60 * 60);
  return hoursSinceLastFetch < CACHE_VALIDITY_HOURS;
}

// --- Helpers texte ---
function normalize(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function normalizeLower(s) {
  return normalize(s).toLowerCase();
}

function stripHtml(s) {
  return normalize(String(s || "").replace(/<[^>]*>/g, " "));
}

function clamp(s, max) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

function extractSurname(fullName) {
  const parts = normalize(fullName).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : normalize(fullName);
}

// --- API ---
async function fetchJSON(url) {
  const req = new Request(url);
  req.headers = {
    "Accept": "application/json",
    "Accept-Language": cfg.acceptLang,
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
  };
  req.timeoutInterval = 15;
  
  try {
    const response = await req.loadString();
    if (!response || response.trim().length === 0) {
      throw new Error("Réponse vide");
    }
    return JSON.parse(response);
  } catch (e) {
    console.error(`[ERROR] fetchJSON: ${e}`);
    throw e;
  }
}

async function fetchAffairById(id) {
  const url = `${API_BASE}/affairs/${id}?format=json&lang=${encodeURIComponent(cfg.apiLang)}`;
  return await fetchJSON(url);
}

// Mapping des partis selon la langue (API -> affichage)
const PARTY_MAP = {
  fr: {
    "SVP": "UDC", "UDC": "UDC",
    "FDP": "PLR", "PLR": "PLR", "FDP-Liberale": "PLR",
    "GLP": "vert'libéraux", "PVL": "vert'libéraux",
    "Mitte": "Centre", "Die Mitte": "Centre", "Le Centre": "Centre",
    "SP": "PS", "PS": "PS",
    "Grüne": "Les Verts", "VERT": "Les Verts", "Les Verts": "Les Verts", "GPS": "Les Verts",
    "MCG": "MCG",
    "EDU": "UDF", "UDF": "UDF",
  },
  de: {
    "UDC": "SVP", "SVP": "SVP",
    "PLR": "FDP", "FDP": "FDP", "FDP-Liberale": "FDP",
    "PVL": "GLP", "GLP": "GLP", "vert'libéraux": "GLP",
    "Centre": "Mitte", "Le Centre": "Mitte", "Die Mitte": "Mitte", "Mitte": "Mitte",
    "PS": "SP", "SP": "SP",
    "Les Verts": "Grüne", "VERT": "Grüne", "Grüne": "Grüne", "GPS": "Grüne",
    "MCG": "MCG",
    "UDF": "EDU", "EDU": "EDU",
  }
};

function translateParty(apiParty) {
  if (!apiParty) return null;
  const map = PARTY_MAP[LANG] || PARTY_MAP.fr;
  // Chercher d'abord exact, puis en majuscules
  return map[apiParty] || map[apiParty.toUpperCase()] || apiParty;
}

// Récupérer le parti via l'API OData du Parlement (par nom de famille)
async function fetchPartyByAuthorName(authorName) {
  if (!authorName) return null;
  try {
    // Extraire le nom de famille (premier mot du nom complet "Nom Prénom")
    const parts = authorName.trim().split(/\s+/);
    if (parts.length === 0) return null;
    const lastName = parts[0];
    
    console.log(`[DEBUG] Recherche parti pour: ${lastName}`);
    
    // Chercher le MemberCouncil par nom de famille
    const memberUrl = `https://ws.parlament.ch/odata.svc/MemberCouncil?$filter=LastName%20eq%20'${encodeURIComponent(lastName)}'%20and%20Language%20eq%20'DE'%20and%20Active%20eq%20true&$format=json`;
    const memberReq = new Request(memberUrl);
    memberReq.timeoutInterval = 10;
    const memberData = JSON.parse(await memberReq.loadString());
    
    const members = memberData?.d?.results || [];
    console.log(`[DEBUG] MemberCouncil trouvés: ${members.length}`);
    
    if (members.length === 0) return null;
    
    // Si plusieurs résultats, essayer de matcher avec le prénom
    let member = members[0];
    if (members.length > 1 && parts.length > 1) {
      const firstName = parts.slice(1).join(" ");
      const match = members.find(m => m.FirstName === firstName);
      if (match) member = match;
    }
    
    const apiParty = member?.PartyAbbreviation;
    console.log(`[DEBUG] Parti API: ${apiParty}`);
    return translateParty(apiParty);
  } catch (e) {
    console.log(`[DEBUG] Erreur récupération parti: ${e}`);
    return null;
  }
}

// --- Recherche ---
function affairContainsKeyword(affair, keyword) {
  const k = normalizeLower(keyword);
  
  // Vérifier le titre
  const title = normalizeLower(stripHtml(affair?.title || ""));
  if (title.includes(k)) return true;
  
  // Vérifier les textes (description, développement, etc.)
  const texts = Array.isArray(affair?.texts) ? affair.texts : [];
  for (const t of texts) {
    const value = normalizeLower(stripHtml(t?.value || ""));
    if (value.includes(k)) return true;
  }
  
  return false;
}

function getShortId(affair, fallbackId) {
  return normalize(affair?.shortId || affair?.shortIdFormatted || fallbackId);
}

function getAuthorName(affair) {
  const c = affair?.author?.councillor;
  if (c) {
    const name = c.officialDenomination || c.name || 
      [c.firstName, c.lastName].filter(Boolean).join(" ") || "";
    return extractSurname(name);
  }
  const comm = affair?.author?.committee;
  if (comm?.abbreviation1) return normalize(comm.abbreviation1);
  if (comm?.name) return normalize(comm.name);
  return "—";
}

// Trouver la dernière page de l'API par recherche binaire
async function findLastPage() {
  let low = 1;
  let high = 5000;
  let lastValid = 1;
  
  console.log("[DEBUG] Recherche de la dernière page...");
  
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const url = `${API_BASE}/affairs?format=json&lang=${cfg.apiLang}&pageNumber=${mid}`;
    
    try {
      const data = await fetchJSON(url);
      if (Array.isArray(data) && data.length > 0) {
        lastValid = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    } catch (e) {
      high = mid - 1;
    }
  }
  
  console.log(`[DEBUG] Dernière page trouvée: ${lastValid}`);
  return lastValid;
}

// Recherche des interventions CDF/EFK en partant de la dernière page
async function searchCDFInterventions() {
  console.log("[DEBUG] Recherche des interventions CDF/EFK (dernières pages)...");
  
  const interventions = [];
  let checkedCount = 0;
  const maxToCheck = 100; // Réduit pour éviter dépassement mémoire
  const maxPagesToCheck = 50; // Plus de pages mais moins de requêtes par page
  
  // Plage d'IDs: 20254000 (25.4000) à 20259999 (25.9999)
  // Ce sont les interpellations de 2025 (session 4 et suivantes)
  const MIN_ID = 20254000;
  const MAX_ID = 20259999;
  
  // Trouver la dernière page
  const lastPage = await findLastPage();
  
  // Parcourir les pages en partant de la dernière
  for (let i = 0; i < maxPagesToCheck && checkedCount < maxToCheck; i++) {
    const page = lastPage - i;
    if (page < 1) break;
    
    const url = `${API_BASE}/affairs?format=json&lang=${cfg.apiLang}&pageNumber=${page}`;
    
    let pageData;
    try {
      pageData = await fetchJSON(url);
    } catch (e) {
      console.log(`[DEBUG] Page ${page}: erreur fetch`);
      continue;
    }
    
    if (!Array.isArray(pageData) || pageData.length === 0) {
      console.log(`[DEBUG] Page ${page}: vide`);
      continue;
    }
    
    // Trier par ID décroissant
    pageData.sort((a, b) => (b.id || 0) - (a.id || 0));
    
    const firstId = pageData[0]?.id || 0;
    const lastId = pageData[pageData.length - 1]?.id || 0;
    
    // Ignorer les pages avec des IDs trop récents (2026)
    if (lastId > MAX_ID) {
      console.log(`[DEBUG] Page ${page}: IDs trop récents (${lastId}), skip`);
      continue;
    }
    
    // Arrêter si tous les IDs sont trop anciens
    if (firstId < MIN_ID) {
      console.log(`[DEBUG] Page ${page}: IDs trop anciens (${firstId}), arrêt`);
      break;
    }
    
    console.log(`[DEBUG] Page ${page}: IDs ${firstId} - ${lastId}`);
    
    // Filtrer les items dans la plage 25.4xxx
    const validItems = pageData.filter(item => {
      const id = item?.id || 0;
      return id >= MIN_ID && id <= MAX_ID;
    });
    
    if (validItems.length === 0) continue;
    
    console.log(`[DEBUG] ${validItems.length} items dans la plage 25.4xxx`);
    
    for (const item of validItems) {
      if (checkedCount >= maxToCheck) break;
      if (interventions.length >= 10) break;
      
      const id = item?.id;
      
      // Obtenir les détails (seulement pour les IDs 25.4xxx)
      let affair;
      try {
        affair = await fetchAffairById(id);
      } catch (e) {
        continue;
      }
      
      checkedCount++;
      
      const typeId = affair?.affairType?.id;
      const shortId = getShortId(affair, String(id));
      
      // Filtrer par type
      if (!INTERVENTION_TYPE_IDS.has(typeId)) {
        continue;
      }
      
      // Vérifier le mot-clé CDF
      if (!affairContainsKeyword(affair, cfg.keyword)) {
        console.log(`[DEBUG] ${shortId}: pas de mot-clé CDF`);
        continue;
      }
      
      // Intervention CDF trouvée!
      const title = normalize(stripHtml(affair?.title || ""));
      const author = getAuthorName(affair);
      
      let party = null;
      const councillorId = affair?.author?.councillor?.id;
      if (councillorId) {
        try {
          party = await fetchCouncillorParty(councillorId);
        } catch (_) {}
      }
      
      interventions.push({
        shortId,
        title,
        author,
        party: party ? normalize(party) : null,
        updated: affair?.updated || null,
      });
      
      console.log(`[DEBUG] ✓ TROUVÉ: ${shortId} - ${clamp(title, 50)}`);
    }
    
    if (interventions.length >= 10) {
      console.log(`[DEBUG] 10 interventions CDF trouvées, arrêt`);
      break;
    }
  }
  
  console.log(`[DEBUG] Vérifié: ${checkedCount} interventions, Trouvé: ${interventions.length} CDF`);
  return interventions;
}

// --- UI ---
function addTitle(w, text, count) {
  const s = w.addStack();
  s.layoutHorizontally();
  s.centerAlignContent();
  
  // Centrer le titre
  s.addSpacer();
  
  // Emoji + Titre sur la même ligne
  const titleText = count > 0 ? `🔔 ${text}` : `🔍 ${text}`;
  const t = s.addText(titleText);
  t.font = Font.boldSystemFont(14);
  t.textColor = TEXT_PRIMARY;
  
  // Badge compteur si nouveautés
  if (count > 0) {
    s.addSpacer(8);
    const badge = s.addStack();
    badge.backgroundColor = ACCENT;
    badge.cornerRadius = 10;
    badge.setPadding(2, 8, 2, 8);
    const badgeText = badge.addText(String(count));
    badgeText.font = Font.boldSystemFont(11);
    badgeText.textColor = Color.white();
  }
  
  s.addSpacer();
}

function addItemCard(w, item, isNew) {
  // Wrapper pour centrer la carte
  const wrapper = w.addStack();
  wrapper.layoutHorizontally();
  wrapper.addSpacer();
  
  const card = wrapper.addStack();
  card.layoutVertically();
  card.backgroundColor = CARD_BG;
  card.cornerRadius = 10;
  card.setPadding(8, 10, 8, 10);
  card.size = new Size(0, 0); // Auto-size
  
  wrapper.addSpacer();
  
  // Ligne 1: Numéro + Badge nouveau
  const topRow = card.addStack();
  topRow.layoutHorizontally();
  topRow.centerAlignContent();
  
  // Numéro avec accent
  const idText = topRow.addText(item.shortId);
  idText.font = Font.boldMonospacedSystemFont(11);
  idText.textColor = ACCENT;
  
  topRow.addSpacer(6);
  
  // Badge "NEW" si nouveau
  if (isNew) {
    const newBadge = topRow.addStack();
    newBadge.backgroundColor = SUCCESS;
    newBadge.cornerRadius = 4;
    newBadge.setPadding(1, 5, 1, 5);
    const newText = newBadge.addText("NEW");
    newText.font = Font.boldSystemFont(8);
    newText.textColor = Color.white();
  }
  
  topRow.addSpacer();
  
  card.addSpacer(3);
  
  // Ligne 2: Titre
  const title = LANG === "de" && item.title_de ? item.title_de : item.title;
  const titleText = card.addText(clamp(title, 55));
  titleText.font = Font.mediumSystemFont(11);
  titleText.textColor = TEXT_PRIMARY;
  titleText.lineLimit = 2;
  
  card.addSpacer(4);
  
  // Ligne 3: Auteur + Parti
  const bottomRow = card.addStack();
  bottomRow.layoutHorizontally();
  bottomRow.centerAlignContent();
  
  const authorIcon = bottomRow.addText("👤");
  authorIcon.font = Font.systemFont(9);
  bottomRow.addSpacer(3);
  
  const who = item.party ? `${item.author} (${item.party})` : item.author;
  const authorText = bottomRow.addText(clamp(who, 35));
  authorText.font = Font.systemFont(10);
  authorText.textColor = TEXT_SECONDARY;
  authorText.lineLimit = 1;
}

// --- Main ---
console.log(`[DEBUG] Mode: ${config.runsInWidget ? 'widget' : 'app'}`);
const w = new ListWidget();
w.backgroundColor = BG;
w.url = cfg.openUrl;
w.setPadding(10, 12, 10, 12);

// ============================================
// 1. ESSAYER DE CHARGER DEPUIS GITHUB (prioritaire)
// ============================================
let items = [];
let fetchOk = false;
let errorMsg = "";
let dataSource = "none";

const cachedItems = readJSON(PATH_CACHE, []);

// Variable pour stocker les new_ids du JSON (vrais nouveaux objets et débats)
let githubNewIds = [];
let githubNewDebateIds = [];
let debateItems = [];

// Toujours essayer de récupérer les données (même si cache valide, pour les new_ids)
console.log("[DEBUG] Fetch GitHub...");

// Récupérer les objets parlementaires
try {
  const req = new Request(GITHUB_JSON_URL);
  req.timeoutInterval = 10;
  const response = await req.loadString();
  const data = JSON.parse(response);
  
  if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
    items = data.items;
    fetchOk = true;
    dataSource = "github";
    writeJSON(PATH_CACHE, items);
    writeText(PATH_LAST_FETCH, new Date().toISOString());
    
    // Extraire les vrais nouveaux IDs du JSON
    if (data.meta?.new_ids) {
      if (Array.isArray(data.meta.new_ids)) {
        githubNewIds = data.meta.new_ids;
      } else if (typeof data.meta.new_ids === 'string') {
        githubNewIds = data.meta.new_ids.split(',').map(id => id.trim()).filter(id => id);
      }
      console.log(`[DEBUG] ✓ GitHub objets: ${items.length} items, ${githubNewIds.length} nouveaux`);
    } else {
      console.log(`[DEBUG] ✓ GitHub objets: ${items.length} items`);
    }
  }
} catch (e) {
  console.log(`[DEBUG] GitHub objets non disponible: ${e}`);
}

// Récupérer les débats
try {
  const reqDebates = new Request(GITHUB_DEBATES_URL);
  reqDebates.timeoutInterval = 10;
  const responseDebates = await reqDebates.loadString();
  const debatesData = JSON.parse(responseDebates);
  
  if (debatesData?.items && Array.isArray(debatesData.items)) {
    debateItems = debatesData.items;
    
    // Extraire les nouveaux débats
    if (debatesData.new_ids) {
      if (Array.isArray(debatesData.new_ids)) {
        githubNewDebateIds = debatesData.new_ids;
      } else if (typeof debatesData.new_ids === 'string') {
        githubNewDebateIds = debatesData.new_ids.split(',').map(id => id.trim()).filter(id => id);
      }
    }
    console.log(`[DEBUG] ✓ GitHub débats: ${debateItems.length} items, ${githubNewDebateIds.length} nouveaux`);
  }
} catch (e) {
  console.log(`[DEBUG] GitHub débats non disponible: ${e}`);
}

// ============================================
// 2. FALLBACK: Module local CDF_Data
// ============================================
if (!fetchOk) {
  try {
    const dataModule = importModule(DATA_MODULE);
    if (Array.isArray(dataModule) && dataModule.length > 0) {
      items = dataModule;
      fetchOk = true;
      dataSource = "local";
      console.log(`[DEBUG] ✓ Module local: ${items.length} items`);
    }
  } catch (e) {
    console.log(`[DEBUG] Module local non disponible: ${e}`);
  }
}

// ============================================
// 3. FALLBACK: Cache local
// ============================================
if (!fetchOk && Array.isArray(cachedItems) && cachedItems.length > 0) {
  items = cachedItems;
  fetchOk = true;
  dataSource = "cache";
  console.log(`[DEBUG] ✓ Cache local: ${items.length} items`);
}

// ============================================
// 4. DERNIER FALLBACK: API Parlement
// ============================================
if (!fetchOk) {
  console.log("[DEBUG] Fetch API Parlement...");
  try {
    const fetched = await searchCDFInterventions();
    if (Array.isArray(fetched) && fetched.length > 0) {
      items = fetched;
      fetchOk = true;
      dataSource = "api";
      writeJSON(PATH_CACHE, items);
      writeText(PATH_LAST_FETCH, new Date().toISOString());
      console.log(`[DEBUG] ✓ API: ${items.length} items`);
    }
  } catch (e) {
    errorMsg = String(e);
    console.error(`[ERROR] API échoué: ${errorMsg}`);
  }
}

console.log(`[DEBUG] Source: ${dataSource}, Items: ${items.length}`);

// Détection des nouvelles interventions (basée sur new_ids du JSON GitHub)
let newIds = readJSON(PATH_NEW_IDS, []);
if (!Array.isArray(newIds)) newIds = [];

if (shouldDoDailyUpdate() && items.length > 0) {
  // Utiliser les new_ids du JSON si disponibles (vrais nouveaux objets)
  if (dataSource === "github" && Array.isArray(githubNewIds) && githubNewIds.length > 0) {
    newIds = githubNewIds;
    console.log(`[DEBUG] Vrais nouveaux objets (JSON): ${newIds.length}`);
  } else {
    // Fallback: comparer avec les IDs vus précédemment
    const seenIds = new Set(readJSON(PATH_SEEN_IDS, []));
    const currentIds = items.map(x => x.shortId).filter(Boolean);
    newIds = currentIds.filter(id => !seenIds.has(id));
    console.log(`[DEBUG] Nouveaux objets (comparaison): ${newIds.length}`);
  }
  
  // Sauvegarder les IDs vus
  const currentIds = items.map(x => x.shortId).filter(Boolean);
  writeJSON(PATH_NEW_IDS, newIds);
  writeJSON(PATH_SEEN_IDS, currentIds);
  writeText(PATH_LAST_UPDATE, new Date().toISOString());
}

// Debug: afficher les IDs récupérés
console.log(`[DEBUG] githubNewIds: ${JSON.stringify(githubNewIds)}`);
console.log(`[DEBUG] githubNewDebateIds: ${JSON.stringify(githubNewDebateIds)}`);
console.log(`[DEBUG] debateItems count: ${debateItems.length}`);
console.log(`[DEBUG] items count: ${items.length}`);

// Filtrer les items récents: soit dans new_ids du JSON, soit mis à jour < 7 jours
const now = new Date();
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
const newIdsSet = new Set(githubNewIds);
const newDebateIdsSet = new Set(githubNewDebateIds);

const recentItems = items.filter(item => {
  // Si l'item est dans new_ids du JSON, il est récent
  if (newIdsSet.has(item.shortId)) return true;
  // Sinon, vérifier la date de mise à jour
  if (!item.updated) return false;
  const updatedDate = new Date(item.updated);
  return updatedDate >= sevenDaysAgo;
});

// Filtrer les nouveaux débats
const newDebates = debateItems.filter(debate => {
  return newDebateIdsSet.has(debate.id) || newDebateIdsSet.has(String(debate.id));
}).map(debate => ({
  shortId: `Débat ${debate.id}`,
  title: debate[`business_title_${LANG}`] || debate.business_title_fr || "Débat parlementaire",
  author: debate.speaker,
  party: debate.party,
  type: "Débat",
  isDebate: true,
  updated: debate.date ? String(debate.date) : null
}));

console.log(`[DEBUG] Items récents objets: ${recentItems.length}, débats: ${newDebates.length}`);

// Combiner objets et débats (débats en premier car plus récents)
const allRecentItems = [...newDebates, ...recentItems];
console.log(`[DEBUG] allRecentItems: ${allRecentItems.length}`);

// Affichage des 3 dernières mises à jour (objets + débats combinés)
let last3 = allRecentItems.slice(0, 3);

// Sauvegarder les items récents pour le cache widget
if (last3.length > 0) {
  writeJSON(PATH_RECENT_ITEMS, last3);
  console.log(`[DEBUG] Items récents sauvegardés dans le cache`);
} else {
  // Utiliser le cache si aucun item récent
  const cachedRecent = readJSON(PATH_RECENT_ITEMS, []);
  if (cachedRecent.length > 0) {
    last3 = cachedRecent;
    console.log(`[DEBUG] Utilisation du cache items récents: ${last3.length}`);
  }
}

console.log(`[DEBUG] last3: ${last3.length}, premier: ${last3[0]?.title || 'aucun'}`);

// Récupérer les partis pour les items affichés (si pas déjà présent)
console.log(`[DEBUG] Début récupération partis...`);
for (const item of last3) {
  if (!item.party && item.author) {
    try {
      item.party = await fetchPartyByAuthorName(item.author);
    } catch (_) {}
  }
}
console.log(`[DEBUG] Fin récupération partis, début affichage...`);

// Titre avec compteur de nouveautés
addTitle(w, cfg.title, last3.length);
w.addSpacer(8);

if (!last3.length) {
  console.warn("[WARN] Aucun résultat récent à afficher");
  
  // Wrapper pour centrer
  const emptyWrapper = w.addStack();
  emptyWrapper.layoutHorizontally();
  emptyWrapper.addSpacer();
  
  // Message vide avec style
  const emptyCard = emptyWrapper.addStack();
  emptyCard.layoutVertically();
  emptyCard.backgroundColor = CARD_BG;
  emptyCard.cornerRadius = 10;
  emptyCard.setPadding(16, 20, 16, 20);
  
  emptyWrapper.addSpacer();
  
  let msg;
  if (!fetchOk) {
    msg = LANG === "fr" ? "⚠️ Erreur réseau" : (LANG === "de" ? "⚠️ Netzwerkfehler" : "⚠️ Errore di rete");
  } else {
    msg = `😴 ${cfg.noUpdates}`;
  }
  const emptyText = emptyCard.addText(msg);
  emptyText.font = Font.mediumSystemFont(12);
  emptyText.textColor = TEXT_SECONDARY;
  emptyText.centerAlignText();
  
} else {
  for (let i = 0; i < last3.length; i++) {
    try {
      // Marquer comme nouveau si c'est un objet dans newIds OU un débat
      const isNew = last3[i].isDebate || newIdsSet.has(last3[i].shortId);
      console.log(`[DEBUG] Affichage item ${i}: ${last3[i].shortId}, isNew: ${isNew}`);
      addItemCard(w, last3[i], isNew);
      if (i < last3.length - 1) w.addSpacer(6);
    } catch (e) {
      console.error(`[ERROR] Erreur affichage item ${i}: ${e}`);
    }
  }
}

// Footer avec date de dernière mise à jour
w.addSpacer();
const lastFetch = fm.fileExists(PATH_LAST_FETCH) 
  ? new Date(readText(PATH_LAST_FETCH))
  : new Date();
const footerLabel = LANG === "fr" ? "Màj" : (LANG === "de" ? "Akt." : "Agg.");
const localeMap = { fr: "fr-CH", de: "de-CH", it: "it-CH" };
const footer = w.addText(`${footerLabel}: ${lastFetch.toLocaleDateString(localeMap[LANG] || "fr-CH")}`);
footer.font = Font.systemFont(8);
footer.textColor = TEXT_SECONDARY;
footer.rightAlignText();

Script.setWidget(w);

// Afficher le widget si lancé directement dans Scriptable
if (!config.runsInWidget) {
  await w.presentMedium();
}

Script.complete();
