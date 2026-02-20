# Swiss Federal Audit Office Parliament Monitor

Monitor parliamentary interventions (motions, postulates, interpellations, questions) and **debates** mentioning the **Swiss Federal Audit Office** (SFAO / CDF / EFK) using the Swiss Parliament Open Data API.

## 🆕 What's New (February 2026)

### 🔘 Session Detail & Nouveautés Button
- **Year chart click**: Click on a year in the "Evolution by Year" chart to see session breakdown
- **Session detail**: Shows intervention count per session (Spring, Special, Summer, Autumn, Winter)
- **Filter by session**: Click on a session to filter objects by year + session
- **Nouveautés button**: New green button to filter only recently added/updated objects (highlighted in green)
- **Toggle behavior**: Button turns white with green border when active, click again to deactivate
- **Reset clears all**: Reset button now clears session filter and URL parameters
- **Cross-browser**: Works on Chrome, Safari, Firefox, Edge (desktop & mobile)

### 🏛️ Legislature Filter & Extended Data
- **New filter**: Filter by legislature (51st or 52nd)
- **51st legislature**: December 2019 - September 2023 (sessions 5101-5122)
- **52nd legislature**: December 2023 - ongoing (sessions 5201+)
- **Extended database**: Now covers both legislatures (213 objects, 433 debates)
- **All pages**: Available on Objects, Debates, and Statistics pages

### 🏢 Department Filter
- **New filter**: Filter by responsible federal department (DFF, DETEC, DDPS, etc.)
- **All pages**: Available on Objects, Debates, and Statistics pages
- **Trilingual**: Department abbreviations translated (DE/FR/IT)

### 🗣️ Parliamentary Debates
- **New page**: Real-time debates mentioning the SFAO from plenary sessions
- **Transcript search**: Full-text search through parliamentary speeches
- **Speaker info**: Name, party, canton for each intervention
- **Direct links**: Click to see the full intervention on the Official Bulletin
- **Smart highlighting**: CDF/EFK terms automatically highlighted in yellow
- **Department info**: Each debate linked to its responsible department

### 📊 Enhanced Statistics
- **Debate statistics section**: Party distribution, council breakdown, top speakers
- **Interactive filters**: Filter all charts by Year, Council, Party, Department
- **Federal Council category**: Speeches by Federal Councillors tracked separately
- **Click-through navigation**: Click any chart segment to filter debates

### 🎨 UI Improvements
- **Consistent design**: Debates page follows Objects page styling
- **Mobile optimized**: Responsive layout for all pages
- **Better text formatting**: Paragraphs, cleaned-up text, no formatting bugs
- **"Show more" button**: Progressive loading (10 objects / 5 debates initially)
- **Back to top button**: Quick navigation on mobile devices
- **Session type filters**: Spring, Summer, Autumn, Winter, Special sessions

---

## Overview

This project provides:
1. **R Scripts**:
   - `Recherche_CDF_EFK.R` — Searches for parliamentary objects (motions, postulates, etc.)
   - `Recherche_Debats.R` — Searches for debate transcripts mentioning SFAO
2. **GitHub Pages Website** — Interactive web interface with search, debates, and statistics
3. **iOS Widget** (`EFK_CDF_Parlement.js`) — Scriptable widget displaying the latest interventions
4. **JSON Data** — `cdf_efk_data.json` (objects) + `debates_data.json` (debates)

## 🌐 Website

The project includes a trilingual GitHub Pages website (FR/DE/IT) with:

### Pages
- **Accueil** (`home.html` / `home_de.html`) — 🆕 Homepage with session summary and quick access
- **Objets** (`index.html` / `index_de.html` / `index_it.html`) — Filter interventions by text, type, council, year, party, department
- **Débats** (`debates.html` / `debates_de.html` / `debates_it.html`) — Parliamentary debate transcripts with department filter
- **Statistiques** (`stats.html` / `stats_de.html` / `stats_it.html`) — Interactive charts for both objects and debates

### Features
- 🏠 **Homepage**: Session summary with latest interventions and debates overview
- 🔍 **Advanced search**: Full-text search in titles AND submitted text (word boundary matching)
- 🗣️ **Debate transcripts**: Full-text speeches with speaker details
- 📊 **Dual statistics**: Charts for both parliamentary objects and debates
- 🎛️ **Multi-select filters**: Type, Council, Year, Party, Session
- 🌐 **Trilingual**: Full support for French, German, and Italian
- 🏢 **Department filter**: Filter by responsible federal department
- 📱 **Responsive**: Optimized for desktop and mobile
- 🔶 **Smart highlighting**: Search terms highlighted in results
- ⬆️ **Back to top**: Quick scroll button on mobile
- ➕ **Progressive loading**: "Show more" replaces pagination
- 🏛️ **Favicon**: Custom parliament icon in browser tab
- 🇨🇭 **Bilingual search**: FR/DE/IT synonyms (CDF↔EFK) automatically included

**Live URL**: `https://arnaudbon20.github.io/EFK_CDF_Parlement/`

## Features

- **Incremental search**: Only searches the last 6 months for updates (faster execution)
- **Bilingual search**: French + German keyword detection
- **Automatic deduplication** of results
- **Multiple export formats**: Excel (.xlsx) and JSON
- **GitHub-hosted data**: Widget fetches data from GitHub (no iCloud sync required)
- **Automated updates**: GitHub Actions runs every 2 days (22h UTC)
- **Multi-layer fallback**: GitHub → Local module → Cache → Parliament API

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
# Legislatures to analyze (51 = 2019-2023, 52 = 2023-2027)
Legislaturen <- c(51, 52)

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

- Displays the 3 most recent interventions
- Automatic language detection (French/German based on iOS settings)
- Tap to open Curia Vista search
- **Data source priority**: GitHub → Local module → Cache → Parliament API
- Cache validity: 6 hours

## API Reference

This project uses:
- [Swiss Parliament Open Data API](https://ws.parlament.ch/)
- [swissparl R package](https://github.com/zumbov2/swissparl)

## License

MIT License

## Automation

### GitHub Actions

A GitHub Action runs automatically to update the data:

| Schedule | Action |
|----------|--------|
| Every 2 days at 22h UTC | Update parliamentary objects (`Recherche_CDF_EFK.R`) |
| Every 2 days at 22h UTC | Update debate transcripts (`Recherche_Debats.R`) |

The workflow:
1. Executes both R scripts
2. Commits updated JSON and Excel files
3. Deploys to GitHub Pages
4. No manual intervention required

**Manual trigger**: Go to the **Actions** tab on GitHub → Select workflow → "Run workflow"

### Session Updates

The homepage automatically displays the **last completed session** summary:
- Session dates are defined in `sessions.json`
- Homepage switches to next session after the end date
- No code changes needed for new sessions (just update `sessions.json`)
