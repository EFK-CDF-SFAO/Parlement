# Script pour trouver les interpellations, motions, questions et postulats
# mentionnant le Contrôle fédéral des finances (CDF/EFK)
# en français et en allemand

# Force HTTP/1.1 to avoid curl HTTP/2 framing errors
library(httr)
httr::set_config(httr::config(http_version = 1.1))

packages <- c(
  "dplyr", "swissparl", "stringr", "openxlsx", "tidyr", "xfun", "jsonlite"
)

missing <- packages[!vapply(packages, requireNamespace, logical(1), quietly = TRUE)]

if (length(missing) > 0) {
  stop(
    "Missing packages: ", paste(missing, collapse = ", "),
    "\nInstall them with install.packages().",
    call. = FALSE
  )
}

invisible(lapply(packages, library, character.only = TRUE))

# ============================================================================
# RÉPERTOIRE DE TRAVAIL
# ============================================================================

# Définir le répertoire de travail au dossier du script
script_dir <- "/Users/arnaudbonvin/Documents/Windsurf/EFK Parlament"
setwd(script_dir)
cat("Répertoire de travail:", getwd(), "\n\n")

# ============================================================================
# PARAMÈTRES
# ============================================================================

# Législature à analyser (52 = 2023-2027)
Legislatur <- 52

# Types d'affaires à rechercher:
# 5 = Motion
# 6 = Postulat
# 8 = Interpellation
# 9 = Interpellation urgente
# 10 = Interpellation urgente
# 12 = Question ordinaire
# 13 = Question urgente
# 14 = Question heure des questions
# 18 = Anfrage (Question)
# 19 = Anfrage dringlich (Question urgente)
Geschaeftstyp <- c(5, 6, 8, 9, 10, 12, 13, 14, 18, 19)

# ============================================================================
# PATTERNS DE RECHERCHE
# ============================================================================

# Pattern allemand: Eidgenössische Finanzkontrolle, EFK
pattern_efk_de <- regex(

  "\\b(Eidg(en(ö|oe)ssische)?|Eidg\\.)\\s*Finanzkontrolle\\b|\\(\\s*EFK\\s*\\)|\\bEFK\\b",
  ignore_case = TRUE
)

# Pattern français: Contrôle fédéral des finances, CDF
pattern_cdf_fr <- regex(
  "\\bContr(ô|o)le\\s+f(é|e)d(é|e)ral\\s+des\\s+finances\\b|\\(\\s*CDF\\s*\\)|\\bCDF\\b",
  ignore_case = TRUE
)

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

na0 <- function(x) if_else(is.na(x), "", x)

concatener_textes <- function(df) {
  df |>
    mutate(
      Text = str_c(
        na0(Title),
        na0(SubmittedText),
        na0(ReasonText),
        na0(FederalCouncilResponseText),
        sep = " "
      ),
      Text = strip_html(Text)
    )
}

# ============================================================================
# RÉCUPÉRATION DES SESSIONS
# ============================================================================

cat("Récupération des sessions de la législature", Legislatur, "...\n")

Sessionen <- get_data(
  table = "Session",
  Language = "DE",
  LegislativePeriodNumber = Legislatur
) |>
  select(ID, SessionName, StartDate, EndDate)

SessionID <- Sessionen$ID
cat("Nombre de sessions trouvées:", length(SessionID), "\n\n")

# ============================================================================
# RECHERCHE EN ALLEMAND (EFK)
# ============================================================================

cat("Recherche des objets mentionnant l'EFK en allemand...\n")

Geschaefte_DE <- list()

for (sid in SessionID) {
  cat("  Session", sid, "...")
  
  tmp <- tryCatch({
    get_data(
      table = "Business",
      SubmissionSession = sid,
      Language = "DE"
    ) |>
      filter(BusinessType %in% Geschaeftstyp) |>
      concatener_textes() |>
      filter(str_detect(Text, pattern_efk_de)) |>
      mutate(
        SessionID = sid,
        Langue_Detection = "DE"
      ) |>
      select(SessionID, ID, BusinessShortNumber, Title, BusinessTypeAbbreviation, 
             SubmissionDate, BusinessStatusText, Langue_Detection)
  }, error = function(e) {
    cat(" erreur:", e$message, "\n")
    return(NULL)
  })
  
  if (!is.null(tmp) && nrow(tmp) > 0) {
    Geschaefte_DE[[as.character(sid)]] <- tmp
    cat(" ", nrow(tmp), "objets trouvés\n")
  } else {
    cat(" 0 objets\n")
  }
}

Geschaefte_DE <- bind_rows(Geschaefte_DE)
cat("Total objets trouvés en allemand:", nrow(Geschaefte_DE), "\n\n")

# ============================================================================
# RECHERCHE EN FRANÇAIS (CDF)
# ============================================================================

cat("Recherche des objets mentionnant le CDF en français...\n")

Geschaefte_FR <- list()

for (sid in SessionID) {
  cat("  Session", sid, "...")
  
  tmp <- tryCatch({
    get_data(
      table = "Business",
      SubmissionSession = sid,
      Language = "FR"
    ) |>
      filter(BusinessType %in% Geschaeftstyp) |>
      concatener_textes() |>
      filter(str_detect(Text, pattern_cdf_fr)) |>
      mutate(
        SessionID = sid,
        Langue_Detection = "FR"
      ) |>
      select(SessionID, ID, BusinessShortNumber, Title, BusinessTypeAbbreviation, 
             SubmissionDate, BusinessStatusText, Langue_Detection)
  }, error = function(e) {
    cat(" erreur:", e$message, "\n")
    return(NULL)
  })
  
  if (!is.null(tmp) && nrow(tmp) > 0) {
    Geschaefte_FR[[as.character(sid)]] <- tmp
    cat(" ", nrow(tmp), "objets trouvés\n")
  } else {
    cat(" 0 objets\n")
  }
}

Geschaefte_FR <- bind_rows(Geschaefte_FR)
cat("Total objets trouvés en français:", nrow(Geschaefte_FR), "\n\n")

# ============================================================================
# FUSION DES RÉSULTATS (DÉDOUBLONNAGE PAR ID)
# ============================================================================

cat("Fusion et dédoublonnage des résultats...\n")

# Combiner les deux dataframes
Tous_Geschaefte <- bind_rows(Geschaefte_DE, Geschaefte_FR)

# Garder les IDs uniques (un objet peut être trouvé dans les deux langues)
Geschaefte_Uniques <- Tous_Geschaefte |>
  group_by(ID) |>
  summarise(
    BusinessShortNumber = first(BusinessShortNumber),
    Title = first(Title),
    BusinessTypeAbbreviation = first(BusinessTypeAbbreviation),
    SubmissionDate = first(SubmissionDate),
    BusinessStatusText = first(BusinessStatusText),
    Langues_Detection = paste(unique(Langue_Detection), collapse = ", "),
    .groups = "drop"
  )

cat("Nombre d'objets uniques:", nrow(Geschaefte_Uniques), "\n\n")

# ============================================================================
# RÉCUPÉRATION DES DÉTAILS COMPLETS
# ============================================================================

if (nrow(Geschaefte_Uniques) > 0) {
  
  ListeID <- Geschaefte_Uniques$ID
  
  cat("Récupération des détails complets...\n")
  
  # Données en allemand
  Daten_DE <- get_data(table = "Business", ID = ListeID, Language = "DE") |>
    select(ID, BusinessShortNumber, BusinessTypeAbbreviation, Title, 
           SubmittedBy, BusinessStatusText, SubmissionDate, SubmissionCouncilAbbreviation)
  
  # Données en français
  Daten_FR <- get_data(table = "Business", ID = ListeID, Language = "FR") |>
    select(ID, Title, BusinessStatusText)
  
  names(Daten_FR) <- c("ID", "Titre_FR", "Statut_FR")
  
  # Fusion
  Resultats <- Daten_DE |>
    left_join(Daten_FR, by = "ID") |>
    left_join(
      Geschaefte_Uniques |> select(ID, Langues_Detection),
      by = "ID"
    ) |>
    mutate(
      Lien_DE = paste0("https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=", ID),
      Lien_FR = paste0("https://www.parlament.ch/fr/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=", ID)
    ) |>
    arrange(desc(SubmissionDate))
  
  # Renommer les colonnes
  names(Resultats) <- c(
    "ID", "Numéro", "Type", "Titre_DE", "Auteur", 
    "Statut_DE", "Date_dépôt", "Conseil",
    "Titre_FR", "Statut_FR", "Langue_détection",
    "Lien_DE", "Lien_FR"
  )
  
  # ============================================================================
  # EXPORT EXCEL
  # ============================================================================
  
  fichier_sortie <- "Objets_parlementaires_CDF_EFK.xlsx"
  
  cat("Export vers", fichier_sortie, "...\n")
  
  write.xlsx(
    Resultats, 
    file = fichier_sortie,
    overwrite = TRUE, 
    asTable = TRUE, 
    sheetName = "CDF-EFK"
  )
  
  # ============================================================================
  # EXPORT JSON POUR LE WIDGET SCRIPTABLE
  # ============================================================================
  
  # Chemin vers le dossier iCloud Scriptable
  icloud_scriptable <- file.path(
    Sys.getenv("HOME"),
    "Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"
  )
  
  # Fichiers de sortie
  fichier_js_local <- "CDF_Data.js"
  fichier_js_icloud <- file.path(icloud_scriptable, "CDF_Data.js")
  
  # Prendre les 10 derniers objets (triés par date décroissante)
  Derniers <- Resultats |>
    head(10) |>
    mutate(
      shortId = Numéro,
      title = Titre_FR,
      author = Auteur,
      updated = as.character(Date_dépôt),
      url_fr = Lien_FR,
      url_de = Lien_DE
    ) |>
    select(shortId, title, author, Type, updated, url_fr, url_de)
  
  # Convertir en JSON
  json_data <- jsonlite::toJSON(Derniers, pretty = TRUE, auto_unbox = TRUE)
  
  # Créer le contenu du fichier JS
  js_content <- paste0(
    "// Données CDF/EFK - Généré automatiquement par Recherche_CDF_EFK.R\n",
    "// Dernière mise à jour: ", Sys.time(), "\n\n",
    "const CDF_DATA = ", json_data, ";\n\n",
    "module.exports = CDF_DATA;\n"
  )
  
  # Export local
  writeLines(js_content, fichier_js_local)
  cat("Export JS local:", fichier_js_local, "\n")
  
  # Export vers iCloud Scriptable (si le dossier existe)
  if (dir.exists(icloud_scriptable)) {
    writeLines(js_content, fichier_js_icloud)
    cat("Export JS iCloud:", fichier_js_icloud, "\n")
  } else {
    cat("ATTENTION: Dossier iCloud Scriptable non trouvé.\n")
    cat("Chemin attendu:", icloud_scriptable, "\n")
    cat("Copiez manuellement le fichier CDF_Data.js dans Scriptable.\n")
  }
  
  cat("\n============================================\n")
  cat("RÉSUMÉ\n")
  cat("============================================\n")
  cat("Législature:", Legislatur, "\n")
  cat("Sessions analysées:", length(SessionID), "\n")
  cat("Objets trouvés:", nrow(Resultats), "\n")
  cat("\nRépartition par type:\n")
  print(table(Resultats$Type))
  cat("\nFichiers exportés:\n")
  cat(" -", fichier_sortie, "\n")
  cat(" -", fichier_js_local, "(JS local)\n")
  if (dir.exists(icloud_scriptable)) {
    cat(" -", fichier_js_icloud, "(iCloud Scriptable)\n")
  }
  
} else {
  cat("Aucun objet trouvé mentionnant le CDF/EFK.\n")
}
