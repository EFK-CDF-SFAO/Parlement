<h1 align="center">🏛️ SFAO Parliament Monitor</h1>

<p align="center">
  <strong>Parliamentary monitoring tool for the Swiss Federal Audit Office</strong>
</p>

<p align="center">
  <a href="https://efk-cdf-sfao.github.io/Parlement/">
    <img src="https://img.shields.io/badge/🌐_Website-Open-EA5A4F?style=for-the-badge" alt="Website">
  </a>
  <img src="https://img.shields.io/badge/Objects-327+-003399?style=for-the-badge" alt="Objects">
  <img src="https://img.shields.io/badge/Debates-729+-003399?style=for-the-badge" alt="Debates">
  <img src="https://img.shields.io/badge/Languages-FR_DE_IT-gray?style=for-the-badge" alt="Languages">
</p>

<br>

<p align="center">
  <img width="1281" height="641" alt="Site" src="https://github.com/user-attachments/assets/6051fddc-f6ee-42ba-930a-5cea950f842a" />
</p>

---

## ✨ Features

| 📊 **Parliamentary Objects** | 🎤 **Debates** | 📈 **Statistics** |
|:---:|:---:|:---:|
| Motions, postulates, interpellations, questions | Plenary session transcripts | Analysis by year, party, council |
| Full-text search | Speaker and party filters | Interactive charts |
| Advanced filters (themes, department, session) | Full intervention text | Export options |

### 🔍 Advanced Search
- **Full-text search** in titles and submitted texts
- **Multiple filters**: type, council, year, party, department, themes, legislature, session
- **Highlighting** of search terms
- **Responsive interface** (desktop + mobile)

---

## 📱 iOS Widget

A Scriptable widget displays the 5 latest interventions directly on your iPhone home screen.

### Quick Setup (with auto-updates)

1. Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) on your iPhone
2. Create a new script and paste the contents of [`EFK_CDF_Loader.js`](EFK_CDF_Loader.js)
3. Add a Scriptable widget to your home screen
4. Configure it to run your script

> 💡 **Benefit**: The loader automatically downloads widget updates from GitHub. No more copy/pasting code for each update!

### Widget Features
- 🌍 **Trilingual**: automatic language detection (FR/DE/IT)
- 🔄 **Smart cache**: 24h validity, automatic refresh
- 📲 **Tap to open**: opens Curia Vista in the corresponding language

---

## 🗓️ Coverage

| Legislature | Period | Sessions |
|:-----------:|:------:|:--------:|
| 50th | Dec. 2015 – Sept. 2019 | 5001-5019 |
| 51st | Dec. 2019 – Sept. 2023 | 5101-5122 |
| 52nd | Dec. 2023 – ongoing | 5201+ |

---

## ⚙️ Technical Architecture

```
📁 Parlement/
├── 🌐 Website (GitHub Pages)
│   ├── index.html / index_de.html / index_it.html
│   ├── objects.html / debates.html / stats.html
│   └── app.js / stats.js
├── 📊 R Scripts
│   ├── Recherche_CDF_EFK.R    → Parliamentary objects
│   └── Recherche_Debats.R     → Debates
├── 📱 iOS Widget
│   ├── EFK_CDF_Loader.js      → Loader (install this)
│   └── EFK_CDF_Parlement.js   → Main widget
└── 📄 Data
    ├── cdf_efk_data.json      → Objects
    └── debates_data.json      → Debates
```

---

## 🔧 Developer Setup

### Requirements
- **R 4.0+** with packages: `swissparl`, `dplyr`, `stringr`, `tidyr`, `jsonlite`, `openxlsx`
- **Git** for version control

### R Package Installation

```r
install.packages(c("dplyr", "stringr", "tidyr", "xfun", "openxlsx", "jsonlite", "httr", "lubridate"))
remotes::install_github("zumbov2/swissparl")
```

### Running the Scripts

```bash
# Parliamentary objects (incremental mode: last 6 months)
Rscript Recherche_CDF_EFK.R

# Debates (scan only recent sessions)
Rscript Recherche_Debats.R
```

---

## 🤖 Automation

Data is automatically updated via **GitHub Actions**:

| Frequency | Action |
|:---------:|:------:|
| Twice daily at 13h UTC and 22h UTC | Update parliamentary objects |
| Twice daily at 13h UTC and 22h UTC | Update debates |

> **Manual trigger**: *Actions* tab → Select workflow → *Run workflow*

---

## 📚 APIs Used

- [Swiss Parliament Open Data API](https://ws.parlament.ch/)
- [swissparl R package](https://github.com/zumbov2/swissparl)

---

## 📄 License

MIT License
