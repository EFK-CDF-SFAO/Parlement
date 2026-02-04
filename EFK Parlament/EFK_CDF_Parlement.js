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
const GITHUB_JSON_URL = "https://raw.githubusercontent.com/ArnaudBon20/EFK_CDF_Parlement/main/cdf_efk_data.json";

// Fallback: Fichier JS local (iCloud Scriptable)
const DATA_MODULE = "CDF_Data";

// URLs Curia Vista (clic sur le widget)
const CV_FR = 'https://www.parlament.ch/fr/ratsbetrieb/suche-curia-vista#k=%22Contr%C3%B4le%20f%C3%A9d%C3%A9ral%20des%20finances%22';
const CV_DE = 'https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista#k=%22Eidgen%C3%B6ssische%20Finanzkontrolle%22#l=1033';

// API Open Data
const API_BASE = "https://ws-old.parlament.ch";

// Types d'interventions à inclure
// 5 = Motion, 6 = Postulat, 8 = Interpellation, 9 = Interpellation urgente, 11 = Question, 13 = Question urgente
const INTERVENTION_TYPE_IDS = new Set([5, 6, 8, 9, 11, 13]);

const CFG = {
  fr: {
    title: "Le CDF au Parlement",
    keyword: "Contrôle fédéral des finances",
    openUrl: CV_FR,
    apiLang: "fr",
    acceptLang: "fr-CH,fr;q=0.9",
    labelLast: "Derniers objets déposés",
  },
  de: {
    title: "Die EFK im Parlament",
    keyword: "Eidgenössische Finanzkontrolle",
    openUrl: CV_DE,
    apiLang: "de",
    acceptLang: "de-CH,de;q=0.9",
    labelLast: "Letzte Vorstösse",
  },
};

// --- Détection langue iOS ---
function detectLang() {
  try {
    const pref = Device.preferredLanguages ? Device.preferredLanguages() : [];
    const first = (Array.isArray(pref) && pref.length ? String(pref[0]) : "").toLowerCase();
    if (first.startsWith("de")) return "de";
  } catch (_) {}
  return "fr";
}

const LANG = detectLang();
const cfg = CFG[LANG];

// --- Couleurs dynamiques (Light/Dark) ---
const BG = Color.dynamic(new Color("#FFFFFF"), new Color("#1C1C1E"));
const TEXT_PRIMARY = Color.dynamic(new Color("#000000"), new Color("#FFFFFF"));
const TEXT_SECONDARY = Color.dynamic(new Color("#666666"), new Color("#AAAAAA"));
const ACCENT = Color.dynamic(new Color("#E30613"), new Color("#FF6B6B"));

// --- Cache ---
const fm = FileManager.local();
const dir = fm.joinPath(fm.documentsDirectory(), "cdf-efk-parliament");
if (!fm.fileExists(dir)) fm.createDirectory(dir, true);

const PATH_CACHE = fm.joinPath(dir, `cache_v2_${LANG}.json`);
const PATH_SEEN_IDS = fm.joinPath(dir, `seen_ids_v2_${LANG}.json`);
const PATH_NEW_IDS = fm.joinPath(dir, `new_ids_v2_${LANG}.json`);
const PATH_LAST_UPDATE = fm.joinPath(dir, `last_update_v2_${LANG}.txt`);
const PATH_LAST_FETCH = fm.joinPath(dir, `last_fetch_v2_${LANG}.txt`);

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

async function fetchCouncillorParty(councillorId) {
  if (!councillorId) return null;
  const url = `${API_BASE}/councillors/${councillorId}?format=json&lang=${encodeURIComponent(cfg.apiLang)}`;
  try {
    const c = await fetchJSON(url);
    return c?.party?.abbreviation || c?.partyAbbreviation || null;
  } catch (_) {
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
function addTitle(w, text) {
  const s = w.addStack();
  s.layoutHorizontally();
  s.addSpacer();
  const t = s.addText(text);
  t.font = Font.boldSystemFont(14);
  t.textColor = TEXT_PRIMARY;
  s.addSpacer();
}

function addNewLine(w, label, ids, color) {
  const s = w.addStack();
  s.layoutHorizontally();
  
  const l = s.addText(label);
  l.font = Font.boldSystemFont(11);
  l.textColor = TEXT_SECONDARY;
  
  const v = s.addText(ids.length > 0 ? ids.join(" / ") : "❌");
  v.font = Font.systemFont(11);
  v.textColor = ids.length > 0 ? color : TEXT_SECONDARY;
  v.lineLimit = 1;
}

function addItemBlock(w, item) {
  const header = `${item.shortId} — ${clamp(item.title, 60)}`;
  const h = w.addText(header);
  h.font = Font.boldSystemFont(10);
  h.textColor = TEXT_PRIMARY;
  h.lineLimit = 1;
  
  const who = item.party ? `${item.author} (${item.party})` : item.author;
  const a = w.addText(clamp(who, 40));
  a.font = Font.systemFont(10);
  a.textColor = TEXT_SECONDARY;
  a.lineLimit = 1;
}

// --- Main ---
const w = new ListWidget();
w.backgroundColor = BG;
w.url = cfg.openUrl;
w.setPadding(6, 12, 12, 12);

addTitle(w, cfg.title);
w.addSpacer(6);

// ============================================
// 1. ESSAYER DE CHARGER DEPUIS GITHUB (prioritaire)
// ============================================
let items = [];
let fetchOk = false;
let errorMsg = "";
let dataSource = "none";

const cachedItems = readJSON(PATH_CACHE, []);

// Essayer GitHub si le cache est expiré
if (!isCacheValid()) {
  console.log("[DEBUG] Fetch GitHub...");
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
      console.log(`[DEBUG] ✓ GitHub: ${items.length} items (màj: ${data.meta?.updated || "?"})`);
    }
  } catch (e) {
    console.log(`[DEBUG] GitHub non disponible: ${e}`);
  }
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

// Détection des nouvelles interventions (quotidien)
let newIds = readJSON(PATH_NEW_IDS, []);
if (!Array.isArray(newIds)) newIds = [];

if (shouldDoDailyUpdate() && items.length > 0) {
  const seenIds = new Set(readJSON(PATH_SEEN_IDS, []));
  const currentIds = items.map(x => x.shortId).filter(Boolean);
  
  newIds = currentIds.filter(id => !seenIds.has(id));
  
  writeJSON(PATH_NEW_IDS, newIds);
  writeJSON(PATH_SEEN_IDS, currentIds);
  writeText(PATH_LAST_UPDATE, new Date().toISOString());
  
  console.log(`[DEBUG] Mise à jour quotidienne: ${newIds.length} nouveaux`);
}

// Affichage ligne "Derniers objets déposés"
const labelLine = w.addText(cfg.labelLast);
labelLine.font = Font.mediumSystemFont(11);
labelLine.textColor = TEXT_SECONDARY;
w.addSpacer(6);

// Affichage des 3 dernières interventions
const last5 = items.slice(0, 3);

if (!last5.length) {
  console.warn("[WARN] Aucun résultat à afficher");
  const msg = fetchOk 
    ? (LANG === "fr" ? "Aucun résultat trouvé." : "Keine Resultate.")
    : (LANG === "fr" ? "Erreur réseau / API" : "Netzwerk-/API-Fehler");
  const t = w.addText(msg);
  t.font = Font.boldSystemFont(13);
  t.textColor = ACCENT;
  
  if (errorMsg) {
    w.addSpacer(4);
    const err = w.addText(`Erreur: ${clamp(errorMsg, 60)}`);
    err.font = Font.systemFont(9);
    err.textColor = TEXT_SECONDARY;
  }
} else {
  for (let i = 0; i < last5.length; i++) {
    addItemBlock(w, last5[i]);
    if (i < last5.length - 1) w.addSpacer(6);
  }
}

Script.setWidget(w);
Script.complete();
