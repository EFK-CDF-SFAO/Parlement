# Swiss Federal Audit Office Parliament Monitor

Parliamentary monitoring tool for the **Swiss Federal Audit Office** (SFAO / CDF / EFK). Tracks parliamentary interventions (motions, postulates, interpellations, questions) and debates mentioning the SFAO.

🔗 **Website**: [https://arnaudbon20.github.io/EFK_CDF_Parlement/](https://arnaudbon20.github.io/EFK_CDF_Parlement/)

---

## Overview

This project allows you to:
- **Track** parliamentary interventions mentioning the SFAO (327 objects since 2015)
- **Browse** plenary debate transcripts (854 debates)
- **Analyze** statistics by year, party, council, department, themes
- **Receive** automatic updates via GitHub Actions

### Coverage
| Legislature | Period | Sessions |
|-------------|--------|----------|
| 50th | Dec. 2015 – Sept. 2019 | 5001-5019 |
| 51st | Dec. 2019 – Sept. 2023 | 5101-5122 |
| 52nd | Dec. 2023 – ongoing | 5201+ |

---

## Components

| Component | Description |
|-----------|-------------|
| **Website** | Trilingual interface (FR/DE/IT) with search, debates and statistics |
| **R Scripts** | `Recherche_CDF_EFK.R` (objects) and `Recherche_Debats.R` (debates) |
| **iOS Widget** | Scriptable widget displaying latest interventions |
| **JSON Data** | `cdf_efk_data.json` + `debates_data.json` |

### Website Pages
| Page | Description |
|------|-------------|
| **Home** | Session summary and overview of latest interventions |
| **Objects** | Filterable list of parliamentary interventions |
| **Debates** | Plenary debate transcripts |
| **Statistics** | Interactive charts (by year, party, council, type) |

### Features
- Full-text search (title + submitted text)
- Multiple filters: type, council, year, party, department, **themes (domaines)**, legislature, session
- Trilingual theme names (FR/DE/IT) from Swiss Parliament API
- Search term highlighting
- Responsive interface (desktop + mobile)
- Progressive loading ("Show more")

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
| `debates_data.json` | JSON data for debates (website reads from here) |

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

## Automation

### GitHub Actions

| Schedule | Action |
|----------|--------|
| Daily at 22h UTC | Update parliamentary objects |
| Every 2 days at 22h UTC | Update debate transcripts |

The workflows:
1. Execute R scripts
2. Commit updated JSON and Excel files
3. Deploy to GitHub Pages

**Manual trigger**: Go to **Actions** tab on GitHub → Select workflow → "Run workflow"

### Session Management

The homepage automatically displays the **last completed session** summary:
- Session dates are defined in `sessions.json`
- Homepage switches to next session after the end date
