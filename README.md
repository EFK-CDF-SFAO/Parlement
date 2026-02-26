<p align="center">
  <img src="https://www.efk.admin.ch/images/logo_efk.svg" alt="EFK Logo" width="120">
</p>

<h1 align="center">🏛️ Le CDF au Parlement</h1>

<p align="center">
  <strong>Outil de veille parlementaire du Contrôle fédéral des finances</strong><br>
  <em>Swiss Federal Audit Office • Eidgenössische Finanzkontrolle • Controllo federale delle finanze</em>
</p>

<p align="center">
  <a href="https://efk-cdf-sfao.github.io/Parlement/">
    <img src="https://img.shields.io/badge/🌐_Site_Web-Accéder-EA5A4F?style=for-the-badge" alt="Website">
  </a>
  <img src="https://img.shields.io/badge/Objets-327+-003399?style=for-the-badge" alt="Objects">
  <img src="https://img.shields.io/badge/Débats-729+-003399?style=for-the-badge" alt="Debates">
  <img src="https://img.shields.io/badge/Langues-FR_DE_IT-gray?style=for-the-badge" alt="Languages">
</p>

<br>

<p align="center">
  <img width="1281" height="641" alt="Site" src="https://github.com/user-attachments/assets/6051fddc-f6ee-42ba-930a-5cea950f842a" />
</p>

---

## ✨ Fonctionnalités

| 📊 **Objets parlementaires** | 🎤 **Débats** | 📈 **Statistiques** |
|:---:|:---:|:---:|
| Motions, postulats, interpellations, questions | Transcriptions des séances plénières | Analyses par année, parti, conseil |
| Recherche plein texte | Filtres par orateur et parti | Graphiques interactifs |
| Filtres avancés (thèmes, département, session) | Texte intégral des interventions | Export possible |

### 🔍 Recherche avancée
- **Recherche plein texte** dans les titres et textes déposés
- **Filtres multiples** : type, conseil, année, parti, département, thèmes, législature, session
- **Mise en évidence** des termes recherchés
- **Interface responsive** (desktop + mobile)

---

## 📱 Widget iOS

Un widget Scriptable affiche les 5 dernières interventions directement sur l'écran d'accueil de votre iPhone.

### Installation rapide (avec mises à jour automatiques)

1. Installez [Scriptable](https://apps.apple.com/app/scriptable/id1405459188) sur votre iPhone
2. Créez un nouveau script et collez le contenu de [`EFK_CDF_Loader.js`](EFK_CDF_Loader.js)
3. Ajoutez un widget Scriptable sur votre écran d'accueil
4. Configurez-le pour exécuter votre script

> 💡 **Avantage** : Le loader télécharge automatiquement les mises à jour du widget depuis GitHub. Vous n'aurez plus besoin de copier/coller le code à chaque mise à jour !

### Fonctionnalités du widget
- 🌍 **Trilingue** : détection automatique de la langue (FR/DE/IT)
- 🔄 **Cache intelligent** : validité 24h, mise à jour automatique
- 📲 **Tap to open** : ouvre Curia Vista dans la langue correspondante

---

## 🗓️ Couverture temporelle

| Législature | Période | Sessions |
|:-----------:|:-------:|:--------:|
| 50ème | Déc. 2015 – Sept. 2019 | 5001-5019 |
| 51ème | Déc. 2019 – Sept. 2023 | 5101-5122 |
| 52ème | Déc. 2023 – en cours | 5201+ |

---

## ⚙️ Architecture technique

```
📁 Parlement/
├── 🌐 Website (GitHub Pages)
│   ├── index.html / index_de.html / index_it.html
│   ├── objects.html / debates.html / stats.html
│   └── app.js / stats.js
├── 📊 Scripts R
│   ├── Recherche_CDF_EFK.R    → Objets parlementaires
│   └── Recherche_Debats.R     → Débats
├── 📱 Widget iOS
│   ├── EFK_CDF_Loader.js      → Loader (à installer)
│   └── EFK_CDF_Parlement.js   → Widget principal
└── 📄 Données
    ├── cdf_efk_data.json      → Objets
    └── debates_data.json      → Débats
```

---

## 🔧 Installation pour développeurs

### Prérequis
- **R 4.0+** avec les packages : `swissparl`, `dplyr`, `stringr`, `tidyr`, `jsonlite`, `openxlsx`
- **Git** pour le versioning

### Installation des packages R

```r
install.packages(c("dplyr", "stringr", "tidyr", "xfun", "openxlsx", "jsonlite", "httr", "lubridate"))
remotes::install_github("zumbov2/swissparl")
```

### Exécution des scripts

```bash
# Objets parlementaires (mode incrémental : 6 derniers mois)
Rscript Recherche_CDF_EFK.R

# Débats (scanner uniquement les sessions récentes)
Rscript Recherche_Debats.R
```

---

## 🤖 Automatisation

Les données sont mises à jour automatiquement via **GitHub Actions** :

| Fréquence | Action |
|:---------:|:------:|
| Quotidien à 22h UTC | Mise à jour des objets parlementaires |
| Tous les 2 jours à 22h UTC | Mise à jour des débats |

> **Déclenchement manuel** : Onglet *Actions* → Sélectionner le workflow → *Run workflow*

---

## 📚 API utilisées

- [Swiss Parliament Open Data API](https://ws.parlament.ch/)
- [Package R swissparl](https://github.com/zumbov2/swissparl)

---

## 📄 Licence

MIT License

---

<p align="center">
  <strong>Contrôle fédéral des finances CDF</strong><br>
  <em>Monbijoustrasse 45, 3003 Berne</em><br>
  <a href="https://www.efk.admin.ch">www.efk.admin.ch</a>
</p>
