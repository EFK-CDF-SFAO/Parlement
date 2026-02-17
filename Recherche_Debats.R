# Script pour rechercher les mentions du CDF/EFK dans les débats parlementaires
# (Bulletin officiel / Amtliches Bulletin)
#
# VERSION 1.0 - Débats parlementaires
# - Recherche dans les transcriptions des débats (table Transcript)
# - Exporte un JSON pour le site web
# - Exécution recommandée: 3 fois par session (début, milieu, fin)

# Force HTTP/1.1 to avoid curl HTTP/2 framing errors
library(httr)
httr::set_config(httr::config(http_version = 1.1))

packages <- c(
  "dplyr", "swissparl", "stringr", "openxlsx", "jsonlite", "xfun"
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

if (Sys.getenv("CI") == "true") {
  script_dir <- getwd()
} else {
  script_dir <- "/Users/arnaudbonvin/Documents/Windsurf/EFK Parlament"
  setwd(script_dir)
}
cat("Répertoire de travail:", getwd(), "\n\n")

# ============================================================================
# PARAMÈTRES
# ============================================================================

# Sessions à analyser (ID de la session d'hiver 2025)
# Pour ajouter d'autres sessions, ajouter les IDs ici
SESSIONS_DEBATS <- c("5211")

# Fichiers de sortie
FICHIER_DEBATS_EXCEL <- "Debats_CDF_EFK.xlsx"
FICHIER_DEBATS_JSON <- "debates_data.json"

# ============================================================================
# PATTERNS DE RECHERCHE
# ============================================================================

# Pattern allemand (EFK)
pattern_efk_de <- regex(
"(?<!Kom|Sub|Del|Prä)[^a-zA-Z0-9]EFK[^a-zA-Z0-9]|Eidgenössische(n|r)? Finanzkontrolle",
  ignore_case = TRUE
)

# Pattern français (CDF) - exclure les faux positifs
pattern_cdf_fr <- regex(
  "(?<![a-zA-Z])CDF(?![a-zA-Z])|Contrôle fédéral des finances",
  ignore_case = TRUE
)

# Faux positifs à exclure (Commission des finances)
pattern_faux_positif_cdf <- regex(
  "CDF-N|CDF-E|Commission des finances",
  ignore_case = TRUE
)

# ============================================================================
# RECHERCHE DES DÉBATS
# ============================================================================

cat("============================================\n")
cat("RECHERCHE DES DÉBATS PARLEMENTAIRES\n")
cat("============================================\n\n")

Debats_Tous <- NULL

for (session_id in SESSIONS_DEBATS) {
  cat("Session", session_id, ":\n")
  
  # Recherche en allemand
  cat("  Recherche DE...")
  Debats_DE <- tryCatch({
    get_data(table = "Transcript", Language = "DE", IdSession = session_id) |>
      filter(!is.na(Text)) |>
      mutate(Text = strip_html(Text)) |>
      filter(str_detect(Text, pattern_efk_de)) |>
      mutate(Langue = "DE") |>
      select(
        ID, IdSession, IdSubject, SortOrder, MeetingDate, MeetingCouncilAbbreviation, 
        SpeakerFullName, SpeakerFunction, ParlGroupAbbreviation, CantonAbbreviation,
        Text, Langue, Start, End
      )
  }, error = function(e) {
    cat(" erreur:", e$message, "\n")
    NULL
  })
  
  if (!is.null(Debats_DE) && nrow(Debats_DE) > 0) {
    cat(" ", nrow(Debats_DE), "trouvés\n")
  } else {
    cat(" 0 trouvés\n")
    Debats_DE <- NULL
  }
  
  # Recherche en français
  cat("  Recherche FR...")
  Debats_FR <- tryCatch({
    get_data(table = "Transcript", Language = "FR", IdSession = session_id) |>
      filter(!is.na(Text)) |>
      mutate(Text = strip_html(Text)) |>
      filter(str_detect(Text, pattern_cdf_fr)) |>
      filter(!str_detect(Text, pattern_faux_positif_cdf)) |>
      mutate(Langue = "FR") |>
      select(
        ID, IdSession, IdSubject, SortOrder, MeetingDate, MeetingCouncilAbbreviation, 
        SpeakerFullName, SpeakerFunction, ParlGroupAbbreviation, CantonAbbreviation,
        Text, Langue, Start, End
      )
  }, error = function(e) {
    cat(" erreur:", e$message, "\n")
    NULL
  })
  
  if (!is.null(Debats_FR) && nrow(Debats_FR) > 0) {
    cat(" ", nrow(Debats_FR), "trouvés\n")
  } else {
    cat(" 0 trouvés\n")
    Debats_FR <- NULL
  }
  
  # Combiner
  session_debats <- bind_rows(Debats_DE, Debats_FR)
  Debats_Tous <- bind_rows(Debats_Tous, session_debats)
}

# Dédoublonner par ID
if (!is.null(Debats_Tous) && nrow(Debats_Tous) > 0) {
  Debats_Tous <- Debats_Tous |>
    distinct(ID, .keep_all = TRUE)
}

cat("\nTotal débats uniques:", nrow(Debats_Tous), "\n")

# Récupérer les infos sur les objets parlementaires via SubjectBusiness
cat("Récupération des infos sur les objets parlementaires...\n")
subject_ids <- unique(Debats_Tous$IdSubject)
cat("  ->", length(subject_ids), "sujets uniques à enrichir\n")

SubjectBusiness_All <- NULL
for (sid in subject_ids) {
  sb <- tryCatch({
    result <- get_data(table = "SubjectBusiness", Language = "FR", IdSubject = as.integer(sid))
    if (nrow(result) > 0) {
      result |>
        select(IdSubject, BusinessNumber, BusinessShortNumber, TitleFR, TitleDE) |>
        head(1)
    } else {
      NULL
    }
  }, error = function(e) {
    NULL
  })
  if (!is.null(sb)) {
    SubjectBusiness_All <- bind_rows(SubjectBusiness_All, sb)
  }
}

cat("  ->", if(!is.null(SubjectBusiness_All)) nrow(SubjectBusiness_All) else 0, "sujets avec infos business\n")

if (!is.null(SubjectBusiness_All) && nrow(SubjectBusiness_All) > 0) {
  # Convertir IdSubject en character pour le join
  SubjectBusiness_All <- SubjectBusiness_All |>
    mutate(IdSubject = as.character(IdSubject))
  
  Debats_Tous <- Debats_Tous |>
    left_join(SubjectBusiness_All, by = "IdSubject")
  cat("  -> Infos objets ajoutées pour", sum(!is.na(Debats_Tous$BusinessShortNumber)), "débats\n")
} else {
  # Ajouter les colonnes vides si pas de données
  Debats_Tous <- Debats_Tous |>
    mutate(
      BusinessNumber = NA_integer_,
      BusinessShortNumber = NA_character_,
      TitleFR = NA_character_,
      TitleDE = NA_character_
    )
}

cat("\n")

# ============================================================================
# EXPORT
# ============================================================================

if (!is.null(Debats_Tous) && nrow(Debats_Tous) > 0) {
  
  # Export Excel
  cat("Export Excel...\n")
  Debats_Export <- Debats_Tous |>
    mutate(
      Extrait = str_sub(Text, 1, 500)
    ) |>
    select(ID, MeetingDate, MeetingCouncilAbbreviation, SpeakerFullName, ParlGroupAbbreviation, 
           CantonAbbreviation, Langue, Extrait, Text) |>
    arrange(MeetingDate, MeetingCouncilAbbreviation)
  
  wb_debats <- createWorkbook()
  addWorksheet(wb_debats, "Débats-CDF-EFK")
  writeDataTable(wb_debats, "Débats-CDF-EFK", Debats_Export)
  saveWorkbook(wb_debats, file = FICHIER_DEBATS_EXCEL, overwrite = TRUE)
  cat("  ->", FICHIER_DEBATS_EXCEL, "\n")
  
  # Export JSON
  cat("Export JSON...\n")
  Debats_JSON <- Debats_Tous |>
    transmute(
      id = ID,
      id_subject = IdSubject,
      id_session = IdSession,
      sort_order = SortOrder,
      date = as.character(MeetingDate),
      council = MeetingCouncilAbbreviation,
      speaker = SpeakerFullName,
      function_speaker = SpeakerFunction,
      party = ParlGroupAbbreviation,
      canton = CantonAbbreviation,
      affair_id = as.character(BusinessNumber),
      business_number = BusinessShortNumber,
      business_title = case_when(
        Langue == "DE" ~ coalesce(TitleDE, TitleFR),
        TRUE ~ coalesce(TitleFR, TitleDE)
      ),
      text = Text,
      language = Langue
    )
  
  jsonlite::write_json(
    list(
      meta = list(
        sessions = paste(SESSIONS_DEBATS, collapse = ", "),
        count = nrow(Debats_JSON),
        updated = as.character(Sys.time())
      ),
      items = Debats_JSON
    ),
    FICHIER_DEBATS_JSON,
    auto_unbox = TRUE,
    pretty = TRUE
  )
  cat("  ->", FICHIER_DEBATS_JSON, "\n")
  
  # ============================================================================
  # RÉSUMÉ
  # ============================================================================
  
  cat("\n============================================\n")
  cat("RÉSUMÉ\n")
  cat("============================================\n")
  cat("Sessions analysées:", paste(SESSIONS_DEBATS, collapse = ", "), "\n")
  cat("Total débats:", nrow(Debats_Tous), "\n")
  cat("\nPar conseil:\n")
  print(table(Debats_Tous$CouncilName))
  cat("\nPar groupe:\n")
  print(table(Debats_Tous$ParlGroupAbbreviation))
  cat("\nFichiers exportés:\n")
  cat(" -", FICHIER_DEBATS_EXCEL, "\n")
  cat(" -", FICHIER_DEBATS_JSON, "\n")
  cat("\n⚠️  N'oubliez pas de commit/push sur GitHub!\n")
  
} else {
  cat("Aucun débat trouvé.\n")
}
