# Swiss Federal Audit Office Parliament Monitor

Monitor parliamentary interventions (motions, postulates, interpellations, questions) mentioning the **Swiss Federal Audit Office** (SFAO / CDF / EFK) using the Swiss Parliament Open Data API.

## Overview

This project provides:
1. **R Script** (`Recherche_CDF_EFK.R`) — Searches the Parliament API for interventions mentioning the Federal Audit Office in French ("Contrôle fédéral des finances", "CDF") and German ("Eidgenössische Finanzkontrolle", "EFK")
2. **GitHub Pages Website** — Interactive web interface with search and full list of interventions
3. **iOS Widget** (`EFK_CDF_Parlement.js`) — Scriptable widget displaying the latest parliamentary interventions on your iPhone
4. **JSON Data** (`cdf_efk_data.json`) — Regularly updated data file hosted on GitHub

## 🌐 Website

The project includes a GitHub Pages website with:
- **Search page** (`index.html`) — Filter interventions by text, type, council, and year
- **Full list** (`liste.html`) — Sortable table with all interventions + Excel download

**Live URL**: `https://[username].github.io/EFK-Parlament/`

## Features

- **Incremental search**: Only searches the last 6 months for updates (faster execution)
- **Bilingual search**: French + German keyword detection
- **Automatic deduplication** of results
- **Multiple export formats**: Excel (.xlsx) and JSON
- **GitHub-hosted data**: Widget fetches data from GitHub (no iCloud sync required)
- **Automated updates**: GitHub Actions runs weekly (Sunday 23h)
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
| `cdf_efk_data.json` | JSON data for GitHub (widget reads from here) |
| `CDF_Data.js` | JavaScript module for Scriptable (local fallback) |

## Workflow

1. **Run the R script** (`Recherche_CDF_EFK.R`)
   - First run: Full search of all sessions
   - Subsequent runs: Only searches last 6 months (incremental)
2. **Commit and push** `cdf_efk_data.json` to GitHub
3. **Widget automatically fetches** data from GitHub

```bash
git add cdf_efk_data.json
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

A GitHub Action runs automatically **every Sunday at 23h (Swiss time)** to update the data:
- Executes the R script
- Commits updated JSON and Excel files
- No manual intervention required

You can also trigger it manually from the **Actions** tab on GitHub.
