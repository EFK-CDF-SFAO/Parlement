// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: gavel;

/**
 * EFK/CDF Parlement - Loader
 * 
 * Ce script charge automatiquement la dernière version du widget
 * depuis GitHub. Collez ce code UNE SEULE FOIS dans Scriptable.
 * Les mises à jour se feront automatiquement.
 * 
 * Pour forcer une mise à jour du cache: maintenez le doigt sur le widget
 * et choisissez "Modifier le widget", puis ajoutez "update" dans Parameter.
 */

const SCRIPT_URL = "https://raw.githubusercontent.com/EFK-CDF-SFAO/Parlement/main/EFK_CDF_Parlement.js";
const CACHE_FILE = "EFK_CDF_Parlement_cached.js";
const CACHE_VALIDITY_HOURS = 24;

async function loadScript() {
    const fm = FileManager.iCloud();
    const cacheDir = fm.documentsDirectory();
    const cachePath = fm.joinPath(cacheDir, CACHE_FILE);
    
    let code = null;
    let shouldUpdate = true;
    
    // Vérifier si on force la mise à jour
    const forceUpdate = args.widgetParameter === "update";
    
    // Vérifier le cache
    if (!forceUpdate && fm.fileExists(cachePath)) {
        const modDate = fm.modificationDate(cachePath);
        const ageHours = (Date.now() - modDate.getTime()) / (1000 * 60 * 60);
        
        if (ageHours < CACHE_VALIDITY_HOURS) {
            shouldUpdate = false;
            console.log(`Cache valide (${Math.round(ageHours)}h)`);
        }
    }
    
    // Télécharger si nécessaire
    if (shouldUpdate) {
        try {
            console.log("Téléchargement du script...");
            const req = new Request(SCRIPT_URL);
            code = await req.loadString();
            
            if (code && code.length > 100) {
                // Sauvegarder dans le cache
                fm.writeString(cachePath, code);
                console.log("Script mis à jour et mis en cache");
            } else {
                throw new Error("Script téléchargé invalide");
            }
        } catch (e) {
            console.error("Erreur téléchargement: " + e.message);
            // Utiliser le cache si disponible
            if (fm.fileExists(cachePath)) {
                console.log("Utilisation du cache de secours");
                code = fm.readString(cachePath);
            }
        }
    } else {
        // Lire depuis le cache
        code = fm.readString(cachePath);
    }
    
    if (!code) {
        // Afficher un widget d'erreur
        const widget = new ListWidget();
        widget.backgroundColor = new Color("#EA5A4F");
        const text = widget.addText("❌ Impossible de charger le widget");
        text.textColor = Color.white();
        text.font = Font.boldSystemFont(14);
        Script.setWidget(widget);
        return;
    }
    
    // Exécuter le script (qui contient son propre Script.setWidget() et Script.complete())
    await eval(code);
}

await loadScript();
