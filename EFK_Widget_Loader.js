// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: gavel;

/**
 * CDF/EFK Widget Auto-Updater
 * 
 * Ce script télécharge et met à jour automatiquement le widget principal
 * "CDF_EFK_Widget" dans Scriptable, puis l'exécute.
 * 
 * Première utilisation: le script sera téléchargé et créé automatiquement.
 * Utilisations suivantes: mise à jour automatique toutes les 24h.
 */

const SCRIPT_URL = "https://raw.githubusercontent.com/ArnaudBon20/EFK_CDF_Parlement/main/EFK_CDF_Parlement.js";
const WIDGET_SCRIPT_NAME = "CDF_EFK_Widget";

const fm = FileManager.iCloud();
const scriptPath = fm.joinPath(fm.documentsDirectory(), WIDGET_SCRIPT_NAME + ".js");
const updatePath = fm.joinPath(fm.documentsDirectory(), ".cdf_widget_update.txt");

async function shouldUpdate() {
  if (!fm.fileExists(scriptPath)) return true;
  if (!fm.fileExists(updatePath)) return true;
  
  try {
    const lastUpdate = new Date(fm.readString(updatePath));
    const hoursSince = (new Date() - lastUpdate) / (1000 * 60 * 60);
    return hoursSince > 24;
  } catch (e) {
    return true;
  }
}

async function downloadAndSaveWidget() {
  const req = new Request(SCRIPT_URL);
  req.timeoutInterval = 15;
  const scriptCode = await req.loadString();
  
  if (!scriptCode || scriptCode.length < 100) {
    throw new Error("Script invalide");
  }
  
  fm.writeString(scriptPath, scriptCode);
  fm.writeString(updatePath, new Date().toISOString());
  console.log("[Loader] Widget mis à jour avec succès");
}

function showError(e) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#001F3F");
  
  const title = w.addText("CDF - Erreur");
  title.font = Font.boldSystemFont(14);
  title.textColor = Color.white();
  
  w.addSpacer(8);
  
  const msg = w.addText("Erreur de mise à jour.\nLe widget existant sera utilisé.");
  msg.font = Font.systemFont(11);
  msg.textColor = new Color("#B0C4DE");
  
  w.addSpacer(4);
  
  const err = w.addText(String(e).slice(0, 50));
  err.font = Font.systemFont(9);
  err.textColor = new Color("#FF6B6B");
  
  Script.setWidget(w);
  Script.complete();
}

// Main
if (await shouldUpdate()) {
  try {
    await downloadAndSaveWidget();
  } catch (e) {
    console.log("[Loader] Erreur téléchargement: " + e);
    if (!fm.fileExists(scriptPath)) {
      showError(e);
      return;
    }
  }
}

// Exécuter le widget
if (fm.fileExists(scriptPath)) {
  // Attendre si le fichier est en cours de sync iCloud
  if (!fm.isFileDownloaded(scriptPath)) {
    await fm.downloadFileFromiCloud(scriptPath);
  }
  
  const widget = importModule(WIDGET_SCRIPT_NAME);
} else {
  showError(new Error("Widget non trouvé"));
}
