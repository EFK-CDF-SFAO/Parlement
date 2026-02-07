# Script pour trouver les interpellations, motions, questions et postulats
# mentionnant le Contrôle fédéral des finances (CDF/EFK)
# en français et en allemand
#
# VERSION 2.0 - Recherche incrémentale
# - Charge les données existantes depuis l'Excel
# - Ne recherche que les interventions des 6 derniers mois
# - Met à jour l'Excel avec les nouvelles interventions
# - Exporte un JSON pour GitHub

# Force HTTP/1.1 to avoid curl HTTP/2 framing errors
library(httr)
httr::set_config(httr::config(http_version = 1.1))

packages <- c(
  "dplyr", "swissparl", "stringr", "openxlsx", "tidyr", "xfun", "jsonlite", "lubridate"
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

script_dir <- "/Users/arnaudbonvin/Documents/Windsurf/EFK Parlament"
setwd(script_dir)
cat("Répertoire de travail:", getwd(), "\n\n")

# ============================================================================
# PARAMÈTRES
# ============================================================================

# Législature à analyser (52 = 2023-2027)
Legislatur <- 52

# Nombre de mois à rechercher pour les mises à jour
MOIS_MISE_A_JOUR <- 6

# Types d'affaires à rechercher
Geschaeftstyp <- c(5, 6, 8, 9, 10, 12, 13, 14, 18, 19)

# Fichiers
FICHIER_EXCEL <- "Objets_parlementaires_CDF_EFK.xlsx"
FICHIER_JSON <- "cdf_efk_data.json"

# URL GitHub pour le widget
GITHUB_RAW_URL <- "https://raw.githubusercontent.com/ArnaudBon20/EFK_CDF_Parlement/main/cdf_efk_data.json"

# ============================================================================
# PATTERNS DE RECHERCHE
# ============================================================================

pattern_efk_de <- regex(
  "\\b(Eidg(en(ö|oe)ssische)?|Eidg\\.)\\s*Finanzkontrolle\\b|\\(\\s*EFK\\s*\\)|\\bEFK\\b",
  ignore_case = TRUE
)

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
# CHARGER LES DONNÉES EXISTANTES
# ============================================================================

Donnees_Existantes <- NULL
IDs_Existants <- c()

if (file.exists(FICHIER_EXCEL)) {
  cat("Chargement des données existantes depuis", FICHIER_EXCEL, "...\n")
  Donnees_Existantes <- read.xlsx(FICHIER_EXCEL, detectDates = TRUE)
  
  # Convertir les dates numériques Excel en dates lisibles
  if ("Date_dépôt" %in% names(Donnees_Existantes)) {
    Donnees_Existantes <- Donnees_Existantes |>
      mutate(Date_dépôt = case_when(
        is.numeric(Date_dépôt) ~ format(as.Date(Date_dépôt, origin = "1899-12-30"), "%Y-%m-%d"),
        TRUE ~ as.character(Date_dépôt)
      ))
  }
  
  # Migration de l'ancienne structure vers la nouvelle si nécessaire
  if ("Statut_DE" %in% names(Donnees_Existantes) && !"Statut" %in% names(Donnees_Existantes)) {
    cat("  -> Migration de l'ancienne structure de colonnes...\n")
    Donnees_Existantes <- Donnees_Existantes |>
      mutate(
        Statut = paste0(na0(Statut_DE), " / ", na0(Statut_FR)),
        Mention = "À recalculer"
      ) |>
      select(ID, Numéro, Type, Auteur, Date_dépôt, Conseil, Titre_DE, Titre_FR, 
             Statut, Lien_DE, Lien_FR, Mention)
  } else if (!"Mention" %in% names(Donnees_Existantes)) {
    # Ajouter la colonne Mention si elle n'existe pas (nouvelle structure sans Mention)
    Donnees_Existantes <- Donnees_Existantes |>
      mutate(Mention = "À recalculer")
  }
  
  IDs_Existants <- Donnees_Existantes$ID
  cat("  ->", nrow(Donnees_Existantes), "interventions existantes\n\n")
} else {
  cat("Pas de fichier existant. Recherche complète...\n\n")
}

# ============================================================================
# DÉTERMINER LES SESSIONS À RECHERCHER
# ============================================================================

cat("Récupération des sessions de la législature", Legislatur, "...\n")

Sessionen <- get_data(
  table = "Session",
  Language = "DE",
  LegislativePeriodNumber = Legislatur
) |>
  select(ID, SessionName, StartDate, EndDate) |>
  mutate(
    StartDate = as.Date(StartDate),
    EndDate = as.Date(EndDate)
  )

# Si données existantes, ne chercher que les sessions des 6 derniers mois
date_limite <- Sys.Date() - months(MOIS_MISE_A_JOUR)

if (!is.null(Donnees_Existantes)) {
  Sessions_A_Chercher <- Sessionen |>
    filter(EndDate >= date_limite | is.na(EndDate))
  cat("Mode incrémental: sessions depuis", format(date_limite, "%d.%m.%Y"), "\n")
} else {
  Sessions_A_Chercher <- Sessionen
  cat("Mode complet: toutes les sessions\n")
}

SessionID <- Sessions_A_Chercher$ID
cat("Sessions à analyser:", length(SessionID), "\n\n")

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
# FUSION DES RÉSULTATS DE LA RECHERCHE
# ============================================================================

cat("Fusion et dédoublonnage des résultats...\n")

Tous_Geschaefte <- bind_rows(Geschaefte_DE, Geschaefte_FR)

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

# Identifier les nouveaux IDs et ceux à mettre à jour
Nouveaux_IDs <- setdiff(Geschaefte_Uniques$ID, IDs_Existants)
IDs_A_Mettre_A_Jour <- intersect(Geschaefte_Uniques$ID, IDs_Existants)

# Ajouter les IDs avec Mention "À recalculer" ou sans Auteur pour forcer leur recalcul
if (!is.null(Donnees_Existantes)) {
  IDs_A_Recalculer <- c()
  
  if ("Mention" %in% names(Donnees_Existantes)) {
    IDs_A_Recalculer <- c(IDs_A_Recalculer, 
      Donnees_Existantes |> filter(Mention == "À recalculer") |> pull(ID))
  }
  
  if ("Auteur" %in% names(Donnees_Existantes)) {
    IDs_A_Recalculer <- c(IDs_A_Recalculer,
      Donnees_Existantes |> filter(is.na(Auteur) | Auteur == "") |> pull(ID))
  }
  
  IDs_A_Recalculer <- unique(IDs_A_Recalculer)
  IDs_A_Mettre_A_Jour <- unique(c(IDs_A_Mettre_A_Jour, IDs_A_Recalculer))
  cat("Objets à recalculer (Mention/Auteur):", length(IDs_A_Recalculer), "\n")
}

cat("Nouveaux objets:", length(Nouveaux_IDs), "\n")
cat("Objets à mettre à jour:", length(IDs_A_Mettre_A_Jour), "\n\n")

# ============================================================================
# RÉCUPÉRATION DES DÉTAILS COMPLETS (nouveaux + màj)
# ============================================================================

IDs_A_Traiter <- c(Nouveaux_IDs, IDs_A_Mettre_A_Jour)

if (length(IDs_A_Traiter) > 0) {
  
  cat("Récupération des détails pour", length(IDs_A_Traiter), "objets...\n")
  
  # Données en allemand (avec textes pour détection de mention)
  Daten_DE <- get_data(table = "Business", ID = IDs_A_Traiter, Language = "DE") |>
    select(ID, BusinessShortNumber, BusinessTypeAbbreviation, Title, 
           SubmittedBy, BusinessStatusText, SubmissionDate, SubmissionCouncilAbbreviation,
           SubmittedText, ReasonText, FederalCouncilResponseText)
  
  # Données en français (avec textes pour détection de mention)
  Daten_FR <- get_data(table = "Business", ID = IDs_A_Traiter, Language = "FR") |>
    select(ID, Title, BusinessStatusText, SubmittedText, ReasonText, FederalCouncilResponseText)
  
  names(Daten_FR) <- c("ID", "Titre_FR", "Statut_FR", "SubmittedText_FR", "ReasonText_FR", "FederalCouncilResponseText_FR")
  
  # Récupérer les noms de commissions pour les objets sans auteur (SubmittedBy = NA)
  IDs_Sans_Auteur <- Daten_DE |> filter(is.na(SubmittedBy)) |> pull(ID)
  
  if (length(IDs_Sans_Auteur) > 0) {
    cat("Récupération des commissions pour", length(IDs_Sans_Auteur), "objets sans auteur...\n")
    
    # Récupérer les rôles pour ces objets
    Roles_Commission <- tryCatch({
      get_data(table = "BusinessRole", BusinessNumber = IDs_Sans_Auteur, Language = "FR") |>
        filter(!is.na(CommitteeNumber)) |>
        select(BusinessNumber, CommitteeNumber) |>
        distinct()
    }, error = function(e) NULL)
    
    if (!is.null(Roles_Commission) && nrow(Roles_Commission) > 0) {
      # Récupérer les noms des commissions
      Commissions <- tryCatch({
        get_data(table = "Committee", CommitteeNumber = unique(Roles_Commission$CommitteeNumber), Language = "FR") |>
          select(CommitteeNumber, CommitteeName) |>
          distinct()
      }, error = function(e) NULL)
      
      if (!is.null(Commissions)) {
        Roles_Commission <- Roles_Commission |>
          left_join(Commissions, by = "CommitteeNumber") |>
          rename(ID = BusinessNumber, Auteur_Commission = CommitteeName)
        
        # Joindre aux données DE
        Daten_DE <- Daten_DE |>
          left_join(Roles_Commission |> select(ID, Auteur_Commission), by = "ID") |>
          mutate(SubmittedBy = if_else(is.na(SubmittedBy) & !is.na(Auteur_Commission), 
                                        Auteur_Commission, SubmittedBy)) |>
          select(-Auteur_Commission)
      }
    }
  }
  
  # Fusion
  Nouveaux_Resultats <- Daten_DE |>
    left_join(Daten_FR, by = "ID") |>
    left_join(
      Geschaefte_Uniques |> select(ID, Langues_Detection),
      by = "ID"
    ) |>
    mutate(
      # Combiner les textes de question (DE + FR)
      Texte_Question = paste(
        na0(SubmittedText), na0(ReasonText),
        na0(SubmittedText_FR), na0(ReasonText_FR),
        sep = " "
      ) |> strip_html(),
      # Combiner les textes de réponse (DE + FR)
      Texte_Reponse = paste(
        na0(FederalCouncilResponseText),
        na0(FederalCouncilResponseText_FR),
        sep = " "
      ) |> strip_html(),
      # Détecter où la mention apparaît
      Mention_Elu = str_detect(Texte_Question, pattern_efk_de) | str_detect(Texte_Question, pattern_cdf_fr),
      Mention_CF = str_detect(Texte_Reponse, pattern_efk_de) | str_detect(Texte_Reponse, pattern_cdf_fr),
      # Créer la colonne Mention
      Mention = case_when(
        Mention_Elu & Mention_CF ~ "Élu & Conseil fédéral",
        Mention_Elu ~ "Élu",
        Mention_CF ~ "Conseil fédéral",
        TRUE ~ "Titre uniquement"
      ),
      # Fusionner les statuts DE et FR
      Statut = paste0(BusinessStatusText, " / ", Statut_FR),
      # Créer les liens
      Lien_DE = paste0("https://www.parlament.ch/de/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=", ID),
      Lien_FR = paste0("https://www.parlament.ch/fr/ratsbetrieb/suche-curia-vista/geschaeft?AffairId=", ID)
    ) |>
    # Sélectionner et réorganiser les colonnes dans l'ordre demandé
    select(
      ID,
      Numéro = BusinessShortNumber,
      Type = BusinessTypeAbbreviation,
      Auteur = SubmittedBy,
      Date_dépôt = SubmissionDate,
      Conseil = SubmissionCouncilAbbreviation,
      Titre_DE = Title,
      Titre_FR,
      Statut,
      Lien_DE,
      Lien_FR,
      Mention
    )
  
  # Convertir Date_dépôt en caractère pour éviter les conflits de type
  Nouveaux_Resultats <- Nouveaux_Resultats |>
    mutate(Date_dépôt = as.character(Date_dépôt))
  
  # ============================================================================
  # FUSIONNER AVEC LES DONNÉES EXISTANTES
  # ============================================================================
  
  if (!is.null(Donnees_Existantes)) {
    # Convertir les dates existantes en caractère aussi
    Donnees_Existantes <- Donnees_Existantes |>
      mutate(Date_dépôt = as.character(Date_dépôt))
    
    # Retirer les objets mis à jour des données existantes
    Donnees_Existantes_Filtrees <- Donnees_Existantes |>
      filter(!ID %in% IDs_A_Mettre_A_Jour)
    
    # Combiner
    Resultats <- bind_rows(Donnees_Existantes_Filtrees, Nouveaux_Resultats) |>
      arrange(desc(Date_dépôt))
    
    cat("Fusion avec données existantes...\n")
    cat("  - Conservés:", nrow(Donnees_Existantes_Filtrees), "\n")
    cat("  - Ajoutés/Mis à jour:", nrow(Nouveaux_Resultats), "\n")
  } else {
    Resultats <- Nouveaux_Resultats |>
      arrange(desc(Date_dépôt))
  }
  
} else {
  cat("Aucun nouvel objet ou mise à jour.\n")
  Resultats <- Donnees_Existantes
}

# ============================================================================
# EXPORT NOUVEAUTÉS (nouveaux objets + mises à jour)
# ============================================================================

if (length(Nouveaux_IDs) > 0 || length(IDs_A_Mettre_A_Jour) > 0) {
  cat("\nExport des nouveautés et mises à jour...\n")
  cat("  - Nouveaux objets:", length(Nouveaux_IDs), "\n")
  cat("  - Mises à jour:", length(IDs_A_Mettre_A_Jour), "\n")
  
  # Créer le dossier Nouveautés s'il n'existe pas
  dossier_nouveautes <- file.path(script_dir, "Nouveautés")
  if (!dir.exists(dossier_nouveautes)) {
    dir.create(dossier_nouveautes)
  }
  
  # Préparer les données avec colonne Type
  Export_Nouveautes <- Nouveaux_Resultats |>
    mutate(
      Type_MAJ = case_when(
        ID %in% Nouveaux_IDs ~ "Nouveau",
        ID %in% IDs_A_Mettre_A_Jour ~ "Mise à jour",
        TRUE ~ "Autre"
      )
    ) |>
    select(Type_MAJ, Numéro, Auteur, Mention, Lien_FR)
  
  # Nom du fichier avec la date
  nom_fichier <- paste0("Nouveautes_", format(Sys.Date(), "%Y-%m-%d"), ".xlsx")
  chemin_fichier <- file.path(dossier_nouveautes, nom_fichier)
  
  # Exporter en Excel
  write.xlsx(
    Export_Nouveautes,
    file = chemin_fichier,
    overwrite = TRUE,
    asTable = TRUE,
    sheetName = "Nouveautés"
  )
  
  cat("  ->", chemin_fichier, "\n")
}

# ============================================================================
# EXPORT EXCEL
# ============================================================================

if (!is.null(Resultats) && nrow(Resultats) > 0) {
  
  cat("\nExport vers", FICHIER_EXCEL, "...\n")
  
  write.xlsx(
    Resultats, 
    file = FICHIER_EXCEL,
    overwrite = TRUE, 
    asTable = TRUE, 
    sheetName = "CDF-EFK"
  )
  
  # ============================================================================
  # EXPORT JSON POUR GITHUB
  # ============================================================================
  
  cat("Export JSON pour GitHub...\n")
  
  # Préparer les données pour le JSON
  Donnees_JSON <- Resultats |>
    head(20) |>
    mutate(
      shortId = Numéro,
      title = Titre_FR,
      title_de = Titre_DE,
      author = Auteur,
      type = Type,
      status = Statut,
      council = Conseil,
      date = as.character(Date_dépôt),
      url_fr = Lien_FR,
      url_de = Lien_DE,
      mention = Mention
    ) |>
    select(shortId, title, title_de, author, type, status, 
           council, date, url_fr, url_de, mention)
  
  # Créer l'objet JSON avec métadonnées
  json_export <- list(
    meta = list(
      updated = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
      total_count = nrow(Resultats),
      source = "Swiss Parliament API",
      legislature = Legislatur
    ),
    items = Donnees_JSON
  )
  
  # Écrire le JSON
  json_content <- jsonlite::toJSON(json_export, pretty = TRUE, auto_unbox = TRUE)
  writeLines(json_content, FICHIER_JSON)
  cat("  ->", FICHIER_JSON, "\n")
  
  # ============================================================================
  # EXPORT JS POUR SCRIPTABLE (iCloud)
  # ============================================================================
  
  icloud_scriptable <- file.path(
    Sys.getenv("HOME"),
    "Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents"
  )
  
  fichier_js_icloud <- file.path(icloud_scriptable, "CDF_Data.js")
  
  # Format JS pour Scriptable
  Derniers_JS <- Resultats |>
    head(10) |>
    mutate(
      shortId = Numéro,
      title = Titre_FR,
      title_de = Titre_DE,
      author = Auteur,
      updated = as.character(Date_dépôt),
      url_fr = Lien_FR,
      url_de = Lien_DE,
      mention = Mention
    ) |>
    select(shortId, title, title_de, author, Type, updated, url_fr, url_de, mention)
  
  json_js <- jsonlite::toJSON(Derniers_JS, pretty = TRUE, auto_unbox = TRUE)
  
  js_content <- paste0(
    "// Données CDF/EFK - Généré automatiquement par Recherche_CDF_EFK.R\n",
    "// Dernière mise à jour: ", Sys.time(), "\n\n",
    "const CDF_DATA = ", json_js, ";\n\n",
    "module.exports = CDF_DATA;\n"
  )
  
  writeLines(js_content, "CDF_Data.js")
  
  if (dir.exists(icloud_scriptable)) {
    writeLines(js_content, fichier_js_icloud)
    cat("  -> CDF_Data.js (iCloud Scriptable)\n")
  }
  
  # ============================================================================
  # RÉSUMÉ
  # ============================================================================
  
  cat("\n============================================\n")
  cat("RÉSUMÉ\n")
  cat("============================================\n")
  cat("Mode:", ifelse(is.null(Donnees_Existantes), "Recherche complète", "Mise à jour incrémentale"), "\n")
  cat("Législature:", Legislatur, "\n")
  cat("Sessions analysées:", length(SessionID), "\n")
  cat("Total objets:", nrow(Resultats), "\n")
  cat("Nouveaux:", length(Nouveaux_IDs), "\n")
  cat("Mis à jour:", length(IDs_A_Mettre_A_Jour), "\n")
  cat("\nRépartition par type:\n")
  print(table(Resultats$Type))
  cat("\nFichiers exportés:\n")
  cat(" -", FICHIER_EXCEL, "\n")
  cat(" -", FICHIER_JSON, "(pour GitHub)\n")
  cat(" - CDF_Data.js (pour Scriptable)\n")
  cat("\n⚠️  N'oubliez pas de commit/push", FICHIER_JSON, "sur GitHub!\n")
  
} else {
  cat("Aucun résultat à exporter.\n")
}
