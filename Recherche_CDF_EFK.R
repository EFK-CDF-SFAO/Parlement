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

# Détecter si on est dans GitHub Actions (variable CI=true)
if (Sys.getenv("CI") == "true") {
  script_dir <- getwd()  # GitHub Actions: utiliser le répertoire courant
} else {
  script_dir <- "/Users/arnaudbonvin/Documents/Windsurf/EFK Parlament"
  setwd(script_dir)
}
cat("Répertoire de travail:", getwd(), "\n\n")

# ============================================================================
# PARAMÈTRES
# ============================================================================

# Législature à analyser (52 = 2023-2027)
Legislatur <- 52

# Nombre de mois à rechercher pour les mises à jour
MOIS_MISE_A_JOUR <- 6

# Types d'affaires à rechercher
Geschaeftstyp <- c(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 18, 19)

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
  "\\bContr(ô|o)le\\s+f(é|e)d(é|e)ral\\s+des\\s+finances\\b|\\(\\s*CDF\\s*\\)|\\bCDF(?!-[NE])\\b",
  ignore_case = TRUE
)

# Pattern pour exclure les faux positifs (CDF = Commission des finances)
# CDF-N = Commission des finances du National, CDF-E = Commission des finances des États
pattern_faux_positif_cdf <- regex("\\bCDF-[NE]\\b", ignore_case = TRUE)

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
  
  # Exclure les faux positifs (objets qui ne mentionnent que CDF-N ou CDF-E, pas le vrai CDF)
  # Ces objets parlent de la Commission des finances, pas du Contrôle fédéral des finances
  # 24.3077: CDF-N/CDF-E = Commission des finances
  # 25.479: CdF = Commission des finances (Golay)
  faux_positifs <- c("24.3077", "25.479")  # Liste des numéros à exclure manuellement
  n_avant <- nrow(Donnees_Existantes)
  Donnees_Existantes <- Donnees_Existantes |>
    filter(!Numéro %in% faux_positifs)
  if (nrow(Donnees_Existantes) < n_avant) {
    cat("  -> Exclusion de", n_avant - nrow(Donnees_Existantes), "faux positifs (CDF = Commission des finances)\n")
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

# Séparer les recalculs internes des vrais changements de contenu
IDs_Recalcul_Interne <- c()  # Juste correction Mention/Auteur (pas intéressant)

if (!is.null(Donnees_Existantes)) {
  # IDs à recalculer pour Mention ou Auteur manquant
  if ("Mention" %in% names(Donnees_Existantes)) {
    IDs_Recalcul_Interne <- c(IDs_Recalcul_Interne, 
      Donnees_Existantes |> filter(Mention == "À recalculer") |> pull(ID))
  }
  
  if ("Auteur" %in% names(Donnees_Existantes)) {
    IDs_Recalcul_Interne <- c(IDs_Recalcul_Interne,
      Donnees_Existantes |> filter(is.na(Auteur) | Auteur == "") |> pull(ID))
  }
  
  IDs_Recalcul_Interne <- unique(IDs_Recalcul_Interne)
  IDs_A_Mettre_A_Jour <- unique(c(IDs_A_Mettre_A_Jour, IDs_Recalcul_Interne))
  cat("Objets à recalculer (Mention/Auteur):", length(IDs_Recalcul_Interne), "\n")
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
  
  # Récupérer les partis des auteurs via BusinessRole
  cat("Récupération des partis des auteurs...\n")
  
  Auteurs <- tryCatch({
    get_data(table = "BusinessRole", BusinessNumber = IDs_A_Traiter, Role = 7, Language = "FR") |>
      filter(!is.na(MemberCouncilNumber)) |>
      select(BusinessNumber, MemberCouncilNumber) |>
      distinct()
  }, error = function(e) {
    cat("  Erreur récupération auteurs:", e$message, "\n")
    NULL
  })
  
  if (!is.null(Auteurs) && nrow(Auteurs) > 0) {
    MemberCouncilIds <- unique(Auteurs$MemberCouncilNumber)
    cat("  ->", length(MemberCouncilIds), "auteurs trouvés\n")
    
    Partis <- tryCatch({
      get_data(table = "MemberCouncil", ID = MemberCouncilIds, Language = "FR") |>
        select(ID, PartyAbbreviation) |>
        rename(MemberCouncilNumber = ID, Parti = PartyAbbreviation)
    }, error = function(e) {
      cat("  Erreur récupération partis:", e$message, "\n")
      NULL
    })
    
    if (!is.null(Partis)) {
      Auteurs <- Auteurs |>
        left_join(Partis, by = "MemberCouncilNumber") |>
        select(BusinessNumber, Parti) |>
        rename(ID = BusinessNumber)
      
      Daten_DE <- Daten_DE |>
        left_join(Auteurs, by = "ID")
    } else {
      Daten_DE <- Daten_DE |> mutate(Parti = NA_character_)
    }
  } else {
    Daten_DE <- Daten_DE |> mutate(Parti = NA_character_)
  }
  
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
      Parti,
      Date_dépôt = SubmissionDate,
      Conseil = SubmissionCouncilAbbreviation,
      Titre_DE = Title,
      Titre_FR,
      Statut,
      Lien_DE,
      Lien_FR,
      Mention
    )
  
  # Convertir Date_dépôt en caractère et corriger les types d'interventions
  # Ajouter Date_MAJ pour les objets traités aujourd'hui
  Nouveaux_Resultats <- Nouveaux_Resultats |>
    mutate(
      Date_dépôt = as.character(Date_dépôt),
      Date_MAJ = as.character(Sys.Date()),  # Date de mise à jour = aujourd'hui
      # Corriger le type "A" (Anfrage) en "Fra." pour cohérence
      Type = ifelse(Type == "A", "Fra.", Type)
    )
  
  # ============================================================================
  # FUSIONNER AVEC LES DONNÉES EXISTANTES
  # ============================================================================
  
  if (!is.null(Donnees_Existantes)) {
    # Convertir les dates existantes en caractère aussi
    Donnees_Existantes <- Donnees_Existantes |>
      mutate(Date_dépôt = as.character(Date_dépôt))
    
    # Ajouter la colonne Parti si elle n'existe pas
    if (!"Parti" %in% names(Donnees_Existantes)) {
      Donnees_Existantes <- Donnees_Existantes |>
        mutate(Parti = NA_character_)
    }
    
    # Ajouter la colonne Date_MAJ si elle n'existe pas (pour les anciennes données)
    if (!"Date_MAJ" %in% names(Donnees_Existantes)) {
      Donnees_Existantes <- Donnees_Existantes |>
        mutate(Date_MAJ = NA_character_)
    }
    
    # Retirer les objets mis à jour des données existantes
    Donnees_Existantes_Filtrees <- Donnees_Existantes |>
      filter(!ID %in% IDs_A_Mettre_A_Jour)
    
    # Combiner et trier par Date_MAJ (desc) puis Date_dépôt (desc)
    Resultats <- bind_rows(Donnees_Existantes_Filtrees, Nouveaux_Resultats) |>
      arrange(desc(Date_MAJ), desc(Date_dépôt))
    
    cat("Fusion avec données existantes...\n")
    cat("  - Conservés:", nrow(Donnees_Existantes_Filtrees), "\n")
    cat("  - Ajoutés/Mis à jour:", nrow(Nouveaux_Resultats), "\n")
  } else {
    Resultats <- Nouveaux_Resultats |>
      arrange(desc(Date_MAJ), desc(Date_dépôt))
  }
  
} else {
  cat("Aucun nouvel objet ou mise à jour.\n")
  Resultats <- Donnees_Existantes
}

# ============================================================================
# EXPORT NOUVEAUTÉS (seulement les vrais changements pertinents)
# ============================================================================

# Détecter les vrais changements de contenu (pas les recalculs internes)
Changements_Pertinents <- NULL

if (length(Nouveaux_IDs) > 0 || length(IDs_A_Mettre_A_Jour) > 0) {
  cat("\nAnalyse des changements pertinents...\n")
  
  # 1. Nouveaux objets = toujours pertinents
  if (length(Nouveaux_IDs) > 0) {
    Nouveaux <- Nouveaux_Resultats |>
      filter(ID %in% Nouveaux_IDs) |>
      mutate(Type_Changement = "Nouvel objet")
    Changements_Pertinents <- bind_rows(Changements_Pertinents, Nouveaux)
    cat("  - Nouveaux objets:", length(Nouveaux_IDs), "\n")
  }
  
  # 2. Comparer avec les données existantes pour détecter les vrais changements
  # IMPORTANT: On ne garde que les réponses CF où le CDF est mentionné (pas les simples changements de statut)
  IDs_MAJ_Reels <- setdiff(IDs_A_Mettre_A_Jour, IDs_Recalcul_Interne)
  
  # Liste des IDs avec changement de statut (pour mise en évidence sur la page web)
  IDs_Statut_Change <- c()
  
  if (length(IDs_MAJ_Reels) > 0 && !is.null(Donnees_Existantes)) {
    nb_reponse_cf <- 0
    
    for (id in IDs_MAJ_Reels) {
      ancien <- Donnees_Existantes |> filter(ID == id)
      nouveau <- Nouveaux_Resultats |> filter(ID == id)
      
      if (nrow(ancien) > 0 && nrow(nouveau) > 0) {
        # Détecter changement de statut (pour mise en évidence)
        if (!identical(ancien$Statut[1], nouveau$Statut[1])) {
          IDs_Statut_Change <- c(IDs_Statut_Change, id)
        }
        
        # Détecter ajout réponse du Conseil fédéral avec mention CDF
        ancien_mention <- ancien$Mention[1]
        nouveau_mention <- nouveau$Mention[1]
        
        # Si avant pas de CF et maintenant oui = réponse CF ajoutée (le CF cite le CDF)
        avant_sans_cf <- ancien_mention %in% c("Élu", "Titre uniquement")
        maintenant_avec_cf <- str_detect(nouveau_mention, "Conseil fédéral")
        
        if (avant_sans_cf && maintenant_avec_cf) {
          MAJ <- nouveau |>
            mutate(Type_Changement = "Réponse CF ajoutée")
          Changements_Pertinents <- bind_rows(Changements_Pertinents, MAJ)
          nb_reponse_cf <- nb_reponse_cf + 1
        }
        # Note: Les simples changements de statut (sans mention CDF par le CF) sont ignorés dans Nouveautés
      }
    }
    cat("  - Réponses CF ajoutées (avec mention CDF):", nb_reponse_cf, "\n")
    cat("  - Statuts modifiés (pour page web):", length(IDs_Statut_Change), "\n")
    
    # Marquer les objets avec changement de statut dans les résultats
    if (length(IDs_Statut_Change) > 0) {
      Resultats <- Resultats |>
        mutate(
          Statut_Change_Date = if_else(ID %in% IDs_Statut_Change, as.character(Sys.Date()), NA_character_)
        )
    }
  }
  
  cat("  - Recalculs internes (ignorés):", length(IDs_Recalcul_Interne), "\n")
}

# Exporter si changements pertinents
if (!is.null(Changements_Pertinents) && nrow(Changements_Pertinents) > 0) {
  # Créer le dossier Nouveautés s'il n'existe pas
  dossier_nouveautes <- file.path(script_dir, "Nouveautés")
  if (!dir.exists(dossier_nouveautes)) {
    dir.create(dossier_nouveautes)
  }
  
  # Sélectionner les colonnes utiles
  Export_Nouveautes <- Changements_Pertinents |>
    select(Type_Changement, Numéro, Auteur, Mention, Statut, Lien_FR)
  
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
  
  cat("\nExport nouveautés ->", chemin_fichier, "\n")
  cat("  Total changements pertinents:", nrow(Export_Nouveautes), "\n")
} else {
  cat("\nAucun changement pertinent à exporter.\n")
}

# ============================================================================
# EXPORT EXCEL
# ============================================================================

if (!is.null(Resultats) && nrow(Resultats) > 0) {
  
  cat("\nExport vers", FICHIER_EXCEL, "...\n")
  
  # Créer le workbook avec mise en évidence des statuts mis à jour
  wb <- createWorkbook()
  addWorksheet(wb, "CDF-EFK")
  writeDataTable(wb, "CDF-EFK", Resultats)
  
  # Style vert pour les objets mis à jour aujourd'hui (Date_MAJ = aujourd'hui)
  style_vert <- createStyle(fontColour = "#006400", bgFill = "#90EE90")
  
  # Trouver les lignes avec Date_MAJ = aujourd'hui
  date_aujourdhui <- as.character(Sys.Date())
  lignes_maj <- which(Resultats$Date_MAJ == date_aujourdhui) + 1  # +1 pour l'en-tête
  
  # Trouver la colonne Statut
  col_statut <- which(names(Resultats) == "Statut")
  
  # Appliquer le style vert aux cellules Statut des lignes mises à jour
  if (length(lignes_maj) > 0 && length(col_statut) > 0) {
    addStyle(wb, "CDF-EFK", style = style_vert, rows = lignes_maj, cols = col_statut, gridExpand = TRUE)
    cat("  - Statuts surlignés en vert:", length(lignes_maj), "\n")
  }
  
  # Sauvegarder le fichier
  saveWorkbook(wb, file = FICHIER_EXCEL, overwrite = TRUE)
  
  # ============================================================================
  # GÉNÉRATION DU RÉSUMÉ DE SESSION
  # ============================================================================
  
  cat("Génération du résumé de session...\n")
  
  # Charger les dates des sessions
  sessions_file <- file.path(script_dir, "sessions.json")
  sessions_data <- jsonlite::fromJSON(sessions_file)$sessions
  sessions_data$start <- as.Date(sessions_data$start)
  sessions_data$end <- as.Date(sessions_data$end)
  
  # Trouver la dernière session terminée
  aujourd_hui <- Sys.Date()
  sessions_terminees <- sessions_data |>
    filter(end < aujourd_hui) |>
    arrange(desc(end))
  
  # Trouver la prochaine session (pour savoir jusqu'à quand afficher le résumé)
  prochaine_session <- sessions_data |>
    filter(start > aujourd_hui) |>
    arrange(start) |>
    slice(1)
  
  session_summary <- NULL
  
  if (nrow(sessions_terminees) > 0) {
    derniere_session <- sessions_terminees[1, ]
    
    # Filtrer les interventions déposées pendant cette session
    interventions_session <- Resultats |>
      filter(
        as.Date(Date_dépôt) >= derniere_session$start,
        as.Date(Date_dépôt) <= derniere_session$end
      )
    
    if (nrow(interventions_session) > 0) {
      cat("  ->", nrow(interventions_session), "interventions pour", derniere_session$name_fr, "\n")
      
      # Compter par type
      par_type <- interventions_session |>
        group_by(Type) |>
        summarise(n = n(), .groups = "drop") |>
        arrange(desc(n))
      
      # Compter par conseil
      par_conseil <- interventions_session |>
        group_by(Conseil) |>
        summarise(n = n(), .groups = "drop")
      
      # Compter par parti
      par_parti <- interventions_session |>
        filter(!is.na(Parti)) |>
        group_by(Parti) |>
        summarise(n = n(), .groups = "drop") |>
        arrange(desc(n))
      
      # Compter par mention (qui cite le CDF)
      par_mention <- interventions_session |>
        group_by(Mention) |>
        summarise(n = n(), .groups = "drop")
      
      # Générer le résumé textuel FR
      types_text_fr <- paste(
        sapply(1:nrow(par_type), function(i) {
          type_name <- switch(par_type$Type[i],
            "Mo." = "motion",
            "Po." = "postulat",
            "Ip." = "interpellation",
            "Fra." = "question",
            "A" = "initiative",
            par_type$Type[i]
          )
          if (par_type$n[i] > 1) type_name <- paste0(type_name, "s")
          paste0(par_type$n[i], " ", type_name)
        }),
        collapse = ", "
      )
      
      cn_count <- sum(par_conseil$n[par_conseil$Conseil == "NR"], na.rm = TRUE)
      ce_count <- sum(par_conseil$n[par_conseil$Conseil == "SR"], na.rm = TRUE)
      
      partis_top <- if (nrow(par_parti) > 0) {
        paste(head(par_parti$Parti, 3), collapse = ", ")
      } else ""
      
      # Traduire les noms de partis pour l'allemand
      partis_top_de <- if (nrow(par_parti) > 0) {
        partis_de <- sapply(head(par_parti$Parti, 3), function(p) {
          switch(p,
            "VERT-E-S" = "GRÜNE",
            "Les Vert-e-s" = "GRÜNE",
            "Al" = "GRÜNE",
            "pvl" = "GLP",
            "PVL" = "GLP",
            "PS" = "SP",
            "PSS" = "SP",
            "PLR" = "FDP",
            "UDC" = "SVP",
            "Le Centre" = "Die Mitte",
            "Centre" = "Mitte",
            p  # default
          )
        })
        paste(partis_de, collapse = ", ")
      } else ""
      
      # Générer un résumé thématique basé sur les titres
      themes_fr <- ""
      themes_de <- ""
      if (nrow(interventions_session) > 0) {
        # Créer une liste descriptive : titre complet + (Nom, Parti)
        themes_list_fr <- sapply(seq_len(nrow(interventions_session)), function(i) {
          titre <- interventions_session$Titre_FR[i]
          auteur <- interventions_session$Auteur[i]
          parti <- if ("Parti" %in% names(interventions_session)) interventions_session$Parti[i] else ""
          
          # Extraire le nom de famille (premier mot car format "Nom Prénom")
          nom_parts <- strsplit(auteur, " ")[[1]]
          nom_famille <- nom_parts[1]
          
          # Format: Titre (Nom, Parti)
          if (!is.na(parti) && parti != "") {
            paste0(titre, " (", nom_famille, ", ", parti, ")")
          } else {
            paste0(titre, " (", nom_famille, ")")
          }
        })
        
        themes_list_de <- sapply(seq_len(nrow(interventions_session)), function(i) {
          titre <- interventions_session$Titre_DE[i]
          auteur <- interventions_session$Auteur[i]
          parti <- if ("Parti" %in% names(interventions_session)) interventions_session$Parti[i] else ""
          
          # Traduire le nom du parti en allemand
          parti_de <- switch(parti,
            "VERT-E-S" = "GRÜNE",
            "Les Vert-e-s" = "GRÜNE",
            "Al" = "GRÜNE",
            "pvl" = "GLP",
            "PVL" = "GLP",
            "PS" = "SP",
            "PSS" = "SP",
            "PLR" = "FDP",
            "UDC" = "SVP",
            "Le Centre" = "Die Mitte",
            "Centre" = "Mitte",
            parti  # default: keep original
          )
          
          # Extraire le nom de famille (premier mot car format "Nom Prénom")
          nom_parts <- strsplit(auteur, " ")[[1]]
          nom_famille <- nom_parts[1]
          
          # Format: Titel (Name, Partei)
          if (!is.na(parti_de) && parti_de != "") {
            paste0(titre, " (", nom_famille, ", ", parti_de, ")")
          } else {
            paste0(titre, " (", nom_famille, ")")
          }
        })
        
        # Joindre tous les thèmes avec des points-virgules
        themes_fr <- paste(themes_list_fr, collapse = " ; ")
        themes_de <- paste(themes_list_de, collapse = " ; ")
      }
      
      resume_fr <- paste0(
        "Durant la ", derniere_session$name_fr, " (",
        format(derniere_session$start, "%d.%m"), " - ",
        format(derniere_session$end, "%d.%m.%Y"), "), ",
        nrow(interventions_session), " interventions mentionnant le CDF ont été déposées : ",
        types_text_fr, ". ",
        if (cn_count > 0 && ce_count > 0) {
          paste0(cn_count, " au Conseil national et ", ce_count, " au Conseil des États. ")
        } else if (cn_count > 0) {
          paste0("Toutes au Conseil national. ")
        } else {
          paste0("Toutes au Conseil des États. ")
        },
        if (nrow(par_parti) > 0) {
          paste0("Les partis les plus actifs : ", partis_top, ".")
        } else ""
      )
      
      # Générer le résumé textuel DE
      types_text_de <- paste(
        sapply(1:nrow(par_type), function(i) {
          type_name <- switch(par_type$Type[i],
            "Mo." = "Motion",
            "Po." = "Postulat",
            "Ip." = "Interpellation",
            "Fra." = "Anfrage",
            "A" = "Initiative",
            par_type$Type[i]
          )
          if (par_type$n[i] > 1 && !type_name %in% c("Anfrage")) type_name <- paste0(type_name, "en")
          if (par_type$n[i] > 1 && type_name == "Anfrage") type_name <- "Anfragen"
          paste0(par_type$n[i], " ", type_name)
        }),
        collapse = ", "
      )
      
      resume_de <- paste0(
        "Während der ", derniere_session$name_de, " (",
        format(derniere_session$start, "%d.%m"), " - ",
        format(derniere_session$end, "%d.%m.%Y"), ") wurden ",
        nrow(interventions_session), " Vorstösse mit Bezug zur EFK eingereicht: ",
        types_text_de, ". ",
        if (cn_count > 0 && ce_count > 0) {
          paste0(cn_count, " im Nationalrat und ", ce_count, " im Ständerat. ")
        } else if (cn_count > 0) {
          paste0("Alle im Nationalrat. ")
        } else {
          paste0("Alle im Ständerat. ")
        },
        if (nrow(par_parti) > 0) {
          paste0("Die aktivsten Parteien: ", partis_top_de, ".")
        } else ""
      )
      
      # Créer l'objet résumé
      session_summary <- list(
        session_id = derniere_session$id,
        title_fr = paste0("Résumé de la ", sub("Session ", "session ", derniere_session$name_fr)),
        title_de = paste0("Zusammenfassung der ", derniere_session$name_de),
        text_fr = resume_fr,
        text_de = resume_de,
        themes_fr = themes_fr,
        themes_de = themes_de,
        session_start = as.character(derniere_session$start),
        session_end = as.character(derniere_session$end),
        display_until = if (nrow(prochaine_session) > 0) as.character(prochaine_session$start[1]) else NA_character_,
        count = nrow(interventions_session),
        by_type = setNames(as.list(par_type$n), par_type$Type),
        by_council = list(
          CN = cn_count,
          CE = ce_count
        ),
        interventions = interventions_session |>
          mutate(
            shortId = Numéro,
            title = Titre_FR,
            title_de = Titre_DE,
            author = Auteur,
            party = if ("Parti" %in% names(interventions_session)) Parti else NA_character_,
            type = Type,
            url_fr = Lien_FR,
            url_de = Lien_DE
          ) |>
          select(shortId, title, title_de, author, party, type, url_fr, url_de) |>
          as.list()
      )
      
      cat("  -> Résumé généré pour", derniere_session$name_fr, "\n")
    } else {
      cat("  -> Aucune intervention pour la dernière session\n")
    }
  } else {
    cat("  -> Aucune session terminée trouvée\n")
  }
  
  # ============================================================================
  # EXPORT JSON POUR GITHUB
  # ============================================================================
  
  cat("Export JSON pour GitHub...\n")
  
  # Préparer les données pour le JSON (toutes les interventions)
  Donnees_JSON <- Resultats |>
    mutate(
      shortId = Numéro,
      title = Titre_FR,
      title_de = Titre_DE,
      author = Auteur,
      party = if ("Parti" %in% names(Resultats)) Parti else NA_character_,
      # Corriger le type "A" (Anfrage) en "Fra." pour cohérence
      type = ifelse(Type == "A", "Fra.", Type),
      status = Statut,
      council = Conseil,
      date = as.character(Date_dépôt),
      date_maj = if ("Date_MAJ" %in% names(Resultats)) Date_MAJ else NA_character_,
      statut_change_date = if ("Statut_Change_Date" %in% names(Resultats)) Statut_Change_Date else NA_character_,
      url_fr = Lien_FR,
      url_de = Lien_DE,
      mention = Mention
    ) |>
    select(shortId, title, title_de, author, party, type, status, 
           council, date, date_maj, statut_change_date, url_fr, url_de, mention)
  
  # Liste des vrais nouveaux objets (pour le widget)
  vrais_nouveaux_ids <- if (length(Nouveaux_IDs) > 0) {
    Resultats |> filter(ID %in% Nouveaux_IDs) |> pull(Numéro)
  } else {
    character(0)
  }
  
  # Créer l'objet JSON avec métadonnées
  json_export <- list(
    meta = list(
      updated = format(Sys.time(), "%Y-%m-%dT%H:%M:%S"),
      total_count = nrow(Resultats),
      source = "Swiss Parliament API",
      legislature = Legislatur,
      new_ids = vrais_nouveaux_ids  # IDs des vrais nouveaux objets
    ),
    session_summary = session_summary,
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
