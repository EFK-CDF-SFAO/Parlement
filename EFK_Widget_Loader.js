// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: red; icon-glyph: gavel;

/**
 * CDF/EFK Widget Loader
 * 
 * Ce script charge automatiquement la dernière version du widget
 * depuis GitHub. Vous n'avez plus besoin de le mettre à jour manuellement.
 */

const SCRIPT_URL = "https://raw.githubusercontent.com/ArnaudBon20/EFK_CDF_Parlement/main/EFK_CDF_Parlement.js";

try {
  const req = new Request(SCRIPT_URL);
  req.timeoutInterval = 15;
  const scriptCode = await req.loadString();
  
  if (scriptCode && scriptCode.length > 100) {
    // Exécuter le script téléchargé
    eval(scriptCode);
  } else {
    throw new Error("Script vide ou invalide");
  }
} catch (e) {
  // En cas d'erreur, afficher un widget d'erreur
  const w = new ListWidget();
  w.backgroundColor = new Color("#001F3F");
  
  const title = w.addText("CDF - Erreur");
  title.font = Font.boldSystemFont(14);
  title.textColor = Color.white();
  
  w.addSpacer(8);
  
  const msg = w.addText("Impossible de charger le widget.\nVérifiez votre connexion.");
  msg.font = Font.systemFont(11);
  msg.textColor = new Color("#B0C4DE");
  
  w.addSpacer(4);
  
  const err = w.addText(String(e).slice(0, 50));
  err.font = Font.systemFont(9);
  err.textColor = new Color("#FF6B6B");
  
  Script.setWidget(w);
  Script.complete();
}
