# Swiss Federal Audit Office Parliament Monitor

Outil de veille parlementaire pour le **Contrôle fédéral des finances** (CDF / EFK / SFAO). Recense les interventions parlementaires (motions, postulats, interpellations, questions) et les débats mentionnant le CDF.

� **Site web** : [https://arnaudbon20.github.io/EFK_CDF_Parlement/](https://arnaudbon20.github.io/EFK_CDF_Parlement/)

---

## Présentation

Ce projet permet de :
- **Suivre** les interventions parlementaires mentionnant le CDF (327 objets depuis 2015)
- **Consulter** les transcriptions des débats en plénum (854 débats)
- **Analyser** les statistiques par année, parti, conseil, département
- **Recevoir** les mises à jour automatiques via GitHub Actions

### Couverture
| Législature | Période | Sessions |
|-------------|---------|----------|
| 50ème | Déc. 2015 – Sept. 2019 | 5001-5019 |
| 51ème | Déc. 2019 – Sept. 2023 | 5101-5122 |
| 52ème | Déc. 2023 – en cours | 5201+ |

---

## Composants

| Composant | Description |
|-----------|-------------|
| **Site web** | Interface trilingue (FR/DE/IT) avec recherche, débats et statistiques |
| **Scripts R** | `Recherche_CDF_EFK.R` (objets) et `Recherche_Debats.R` (débats) |
| **Widget iOS** | Widget Scriptable affichant les dernières interventions |
| **Données JSON** | `cdf_efk_data.json` + `debates_data.json` |

### Pages du site
| Page | Description |
|------|-------------|
| **Accueil** | Résumé de session et aperçu des dernières interventions |
| **Objets** | Liste filtrable des interventions parlementaires |
| **Débats** | Transcriptions des débats en plénum |
| **Statistiques** | Graphiques interactifs (par année, parti, conseil, type) |

### Fonctionnalités
- Recherche plein texte (titre + texte déposé)
- Filtres multiples : type, conseil, année, parti, département, législature, session
- Mise en évidence des termes recherchés
- Interface responsive (desktop + mobile)
- Chargement progressif ("Afficher plus")

## Requirements

### R Script
- R 4.0+
- Required packages:
  - `swissparl` (install from GitHub: `remotes::install_github("zumbov2/swissparl")`)
  - `dplyr`, `stringr`, `tidyr`, `xfun`, `lubridate`
  - `openxlsx` (Excel export)
  - `jsonlite` (JSON export)
  - `httr`

### iOS Widget
- iPhone with [Scriptable](https://scriptable.app/) app installed
- iCloud enabled for Scriptable

## Installation

### R Script Setup

1. Clone this repository
2. Install required R packages:
```r
install.packages(c("dplyr", "stringr", "tidyr", "xfun", "openxlsx", "jsonlite", "httr"))
install.packages("remotes")
remotes::install_github("zumbov2/swissparl")
```
3. Open `Recherche_CDF_EFK.R` in RStudio
4. Run the script (Cmd+Shift+Enter / Ctrl+Shift+Enter)

### iOS Widget Setup

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) on your iPhone
2. Copy `EFK_CDF_Parlement.js` and `CDF_Data.js` to your Scriptable iCloud folder:
   - Mac: `~/Library/Mobile Documents/iCloud~dk~simonbs~Scriptable/Documents/`
   - Or manually add scripts via the Scriptable app
3. Add a Scriptable widget to your home screen
4. Configure the widget to run `EFK_CDF_Parlement`

## Usage

### Running the R Scripts

#### Parliamentary Objects (`Recherche_CDF_EFK.R`)

```bash
Rscript Recherche_CDF_EFK.R
```

The script will:
1. Load existing data from Excel (incremental mode)
2. Search last 6 months for new/updated interventions
3. Fetch full details including **submitted text** for search
4. Generate session summary for homepage
5. Export to:
   - `Objets_parlementaires_CDF_EFK.xlsx` (Excel with full details)
   - `cdf_efk_data.json` (JSON for website with text for search)

#### Parliamentary Debates (`Recherche_Debats.R`)

```bash
Rscript Recherche_Debats.R
```

The script will:
1. Search debate transcripts from configured sessions
2. Extract speaker info (name, party, canton)
3. Export bilingual titles (FR/DE)
4. Export to:
   - `Debats_CDF_EFK.xlsx` (Excel with transcripts)
   - `debates_data.json` (JSON for website)

### Configuration

Edit the following variables in `Recherche_CDF_EFK.R`:

```r
# Legislatures to analyze (50 = 2015-2019, 51 = 2019-2023, 52 = 2023-2027)
Legislaturen <- c(50, 51, 52)

# Months to search in incremental mode
MOIS_MISE_A_JOUR <- 6
```

## Output Files

| File | Description |
|------|-------------|
| `Objets_parlementaires_CDF_EFK.xlsx` | Full Excel export with all interventions |
| `cdf_efk_data.json` | JSON data for objects (widget reads from here) |
| `CDF_Data.js` | JavaScript module for Scriptable (local fallback) |
| `Debats_CDF_EFK.xlsx` | 🆕 Excel export with debate transcripts |
| `debates_data.json` | 🆕 JSON data for debates (website reads from here) |

## Workflow

### Parliamentary Objects
1. **Run** `Recherche_CDF_EFK.R`
   - First run: Full search of all sessions (51st + 52nd legislature)
   - Subsequent runs: Only searches last 6 months (incremental)
   - Objects older than 6 months don't change, no need to rescan
2. **Commit and push** `cdf_efk_data.json` to GitHub

### Parliamentary Debates
1. **Run** `Recherche_Debats.R`
   - **Important**: Only scan the previous session + current session
   - Past session transcripts don't change, no need for full rescan
   - Update `SESSIONS_DEBATS` variable to include only recent sessions
   - Exports both FR and DE titles for bilingual support
2. **Commit and push** `debates_data.json` to GitHub

> ⚠️ **Performance tip**: For regular updates, don't rescan all sessions. Only add the current/previous session to avoid slow execution.

```bash
git add cdf_efk_data.json debates_data.json
git commit -m "Update parliament data"
git push
```

## Widget Features

- Displays the **5 most recent interventions** (motions, postulates, interpellations, questions)
- **Trilingual**: Automatic language detection (FR/DE/IT based on iOS settings)
- Tap to open Curia Vista search in the corresponding language
- **Data source priority**: GitHub JSON → Local module → Cache → Parliament API
- Cache validity: 6 hours
- Daily update detection for new interventions
- Supported intervention types: Motion, Postulate, Interpellation, Question (+ urgent variants)

## API Reference

This project uses:
- [Swiss Parliament Open Data API](https://ws.parlament.ch/)
- [swissparl R package](https://github.com/zumbov2/swissparl)

## License

MIT License

## Automatisation

### GitHub Actions

| Fréquence | Action |
|-----------|--------|
| Tous les jours à 22h UTC | Mise à jour des objets parlementaires |
| Tous les 2 jours à 22h UTC | Mise à jour des transcriptions de débats |

Les workflows :
1. Exécutent les scripts R
2. Commitent les fichiers JSON et Excel mis à jour
3. Déploient sur GitHub Pages

**Déclenchement manuel** : Onglet **Actions** sur GitHub → Sélectionner le workflow → "Run workflow"

### Gestion des sessions

La page d'accueil affiche automatiquement le résumé de la **dernière session terminée** :
- Les dates de session sont définies dans `sessions.json`
- La page bascule vers la session suivante après la date de fin
