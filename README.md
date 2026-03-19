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
  <img width="1032" height="1194" alt="CDF_Parlement" src="https://github.com/user-attachments/assets/b0748c06-6318-47c2-b879-8b135a524841" />
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

### 🤖 AI Summary (Debates)
Generate AI-powered summaries of parliamentary debates with one click:
- **Model**: Google Gemini Flash (via Cloudflare Worker proxy)
- **Languages**: FR, DE, IT
- **Content**: Context, speaker positions, consensus points, divergences

### 🏛️ Live Session Animation
During parliamentary sessions, the homepage displays an animated pixel art Federal Palace:
- **Dynamic sky**: changes based on time of day (morning 7:45-8:00, day 8:00-19:00, evening 19:00-21:00, night 21:00-7:45)
- **Auto-activation**: starts at 12:00 on the first day of session, ends at 12:00 on the last day
- **New objects display**: shows newly submitted parliamentary objects during the session

**Animation schedule by day:**

| Day | Characters | Debate bubbles |
|-----|------------|----------------|
| **Monday** | 14:30-15:00 | 15:00-19:00 |
| **Tuesday-Thursday** | 7:45-8:00 + 14:30-15:00 | 8:00-13:00 + 15:00-19:00 |
| **Friday (1st & 2nd)** | — | — |
| **Friday (last)** | 7:45-8:00 | 8:00-12:00 |
| **Saturday-Sunday** | — | — |

> The sky background always changes according to the time, even on days without animations.

---

## ️ Coverage

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
│   ├── app.js / stats.js
│   └── llm_summary.js         → AI summary module
├── 📊 R Scripts
│   ├── Recherche_CDF_EFK.R    → Parliamentary objects
│   └── Recherche_Debats.R     → Debates
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
| Twice daily at 13:00 and 22:00 (Swiss time) | Update parliamentary objects |
| Twice daily at 13:00 and 22:00 (Swiss time) | Update debates (during sessions only) |

> **Manual trigger**: *Actions* tab → Select workflow → *Run workflow*

---

## 📚 APIs Used

- [Swiss Parliament Open Data API](https://ws.parlament.ch/)
- [swissparl R package](https://github.com/zumbov2/swissparl) by zumbov2 (David Zumbach)

---

## 📄 License

MIT License
