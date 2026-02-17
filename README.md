# Swiss Federal Audit Office Parliament Monitor

Monitor parliamentary interventions (motions, postulates, interpellations, questions) and **debates** mentioning the **Swiss Federal Audit Office** (SFAO / CDF / EFK) using the Swiss Parliament Open Data API.

## 🆕 What's New (February 2026)

### 🗣️ Parliamentary Debates
- **New page**: Real-time debates mentioning the SFAO from plenary sessions
- **Transcript search**: Full-text search through parliamentary speeches
- **Speaker info**: Name, party, canton for each intervention
- **Direct links**: Click to see the full intervention on the Official Bulletin
- **Smart highlighting**: CDF/EFK terms automatically highlighted in yellow

### 📊 Enhanced Statistics
- **Debate statistics section**: Party distribution, council breakdown, top speakers
- **Interactive filters**: Filter all charts by Year, Council, Party
- **Federal Council category**: Speeches by Federal Councillors tracked separately
- **Click-through navigation**: Click any chart segment to filter debates

### 🎨 UI Improvements
- **Consistent design**: Debates page follows Objects page styling
- **Mobile optimized**: Responsive layout for all pages
- **Better text formatting**: Paragraphs, cleaned-up text, no formatting bugs

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

The project includes a bilingual GitHub Pages website (FR/DE) with:

### Pages
- **Objets** (`index.html` / `index_de.html`) — Filter interventions by text, type, council, year, party
- **Débats** (`debates.html` / `debates_de.html`) — 🆕 Parliamentary debate transcripts
- **Statistiques** (`stats.html` / `stats_de.html`) — Interactive charts for both objects and debates
- **Liste** (`liste.html` / `liste_de.html`) — Sortable table with all interventions + Excel export

### Features
- 🔍 **Advanced filters**: Custom dropdown filters with checkboxes for multi-select
- 🗣️ **Debate transcripts**: Full-text speeches with speaker details
- � **Dual statistics**: Charts for both parliamentary objects and debates
- 🎛️ **Chart filters**: Filter statistics by Year, Council, Party
- 🏆 **Top rankings**: Most active MPs and speakers
- 🌐 **Bilingual**: Full French/German translation
- 📱 **Responsive**: Optimized for desktop and mobile
- � **Smart highlighting**: CDF/EFK terms highlighted in debate texts
- 📈 **Clickable charts**: Click to filter search results

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

### Running the R Script

The script will:
1. Query all sessions from the current legislature (52)
2. Search for interventions mentioning SFAO in German
3. Search for interventions mentioning SFAO in French
4. Merge and deduplicate results
5. Export to:
   - `Objets_parlementaires_CDF_EFK.xlsx` (Excel file with full details)
   - `CDF_Data.js` (JavaScript module for the iOS widget)

### Configuration

Edit the following variables in `Recherche_CDF_EFK.R`:

```r
# Legislature to analyze (52 = 2023-2027)
Legislatur <- 52

# Business types to search
# 5 = Motion, 6 = Postulate, 8/9/10 = Interpellation
# 12/13/14/18/19 = Questions
Geschaeftstyp <- c(5, 6, 8, 9, 10, 12, 13, 14, 18, 19)
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
   - First run: Full search of all sessions
   - Subsequent runs: Only searches last 6 months (incremental)
2. **Commit and push** `cdf_efk_data.json` to GitHub

### Parliamentary Debates 🆕
1. **Run** `Recherche_Debats.R`
   - Searches transcripts from configured sessions
   - Exports both FR and DE titles for bilingual support
2. **Commit and push** `debates_data.json` to GitHub

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

A GitHub Action runs automatically **every 2 days at 22h UTC (23h Swiss time)** to update the data:
- Executes the R script
- Commits updated JSON and Excel files
- Deploys to GitHub Pages
- No manual intervention required

You can also trigger it manually from the **Actions** tab on GitHub.
