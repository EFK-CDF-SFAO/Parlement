#!/usr/bin/env python3
"""
Fetch cantonal parliament mentions of the Swiss Federal Audit Office (EFK/CDF).
Excludes federal parliament (CHE) and cantonal audit offices.
"""

import argparse
import requests
import json
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any

API_BASE = "https://api.openparldata.ch/v1"

# Search terms for the FEDERAL audit office - more specific queries
SEARCH_TERMS_FEDERAL = [
    # German - full terms (most reliable)
    "Eidgenössische Finanzkontrolle",
    "Eidgenössischen Finanzkontrolle",
    "EFK-Bericht",
    "EFK-Prüfung",
    "EFK-Audit",
    "Bericht der EFK",
    "Prüfung der EFK",
    # French
    "Contrôle fédéral des finances",
    "rapport du CDF",
    "audit du CDF",
    # Italian
    "Controllo federale delle finanze",
]

# Federal parliament body key to exclude
FEDERAL_BODY_KEY = "CHE"

# Bilingual cantons (FR/DE) - prefer French for these
BILINGUAL_CANTONS_FR = {"VS", "FR"}

# Title patterns to exclude (not relevant EFK mentions)
EXCLUDE_TITLE_PATTERNS = [
    "Sammelvorlage betreffend",  # Generic budget compilations
    "Schlussabrechnungen von Verpflichtungskrediten",  # Credit settlements
]

# Types to exclude when they only cite EFK due to legal requirements
EXCLUDE_TYPES_LEGAL_MENTION = [
    "Rechnung",  # Annual accounts that cite EFK only because of law
    "Jahresrechnung",
    "Staatsrechnung",
]

# French translations for cantons and major cities
CANTON_NAMES_FR = {
    # Cantons
    "AG": "Argovie",
    "AI": "Appenzell Rhodes-Intérieures",
    "AR": "Appenzell Rhodes-Extérieures",
    "BE": "Berne",
    "BL": "Bâle-Campagne",
    "BS": "Bâle-Ville",
    "FR": "Fribourg",
    "GE": "Genève",
    "GL": "Glaris",
    "GR": "Grisons",
    "JU": "Jura",
    "LU": "Lucerne",
    "NE": "Neuchâtel",
    "NW": "Nidwald",
    "OW": "Obwald",
    "SG": "Saint-Gall",
    "SH": "Schaffhouse",
    "SO": "Soleure",
    "SZ": "Schwytz",
    "TG": "Thurgovie",
    "TI": "Tessin",
    "UR": "Uri",
    "VD": "Vaud",
    "VS": "Valais",
    "ZG": "Zoug",
    "ZH": "Zurich",
    "LIE": "Liechtenstein",
    # Major cities (body_key -> French name)
    "261": "Zurich (Ville)",
    "351": "Berne (Ville)",
    "1061": "Lucerne (Ville)",
    "2829": "Liestal",
    "5586": "Lausanne",
    "6621": "Genève (Ville)",
    "230": "Winterthour",
}

# Patterns that indicate FEDERAL audit office (positive match)
FEDERAL_PATTERNS = [
    r"[Ee]idgenössische[n]?\s+Finanzkontrolle",
    r"EFK[\s\-]Bericht",
    r"EFK[\s\-]Prüfung",
    r"EFK[\s\-]Audit",
    r"Bericht\s+der\s+EFK",
    r"Prüfung\s+der\s+EFK",
    r"Contrôle\s+fédéral\s+des\s+finances",
    r"rapport\s+(du|de\s+la?)\s+CDF",
    r"audit\s+(du|de\s+la?)\s+CDF",
    r"Controllo\s+federale\s+delle\s+finanze",
    r"Finanzkontrolle\s+des\s+Bundes",
]

# Terms to EXCLUDE (cantonal/municipal audit offices, false positives)
EXCLUDE_PATTERNS = [
    # Cantonal audit offices
    r"kantonale[n]?\s+Finanzkontrolle",
    r"Finanzkontrolle\s+des\s+Kantons",
    r"Finanzkontrolle\s+(Basel|Bern|Zürich|Luzern|Aargau|St\.?\s*Gallen|Wallis|Valais)",
    r"städtische[n]?\s+Finanzkontrolle",
    r"Finanzkontrolle\s+der\s+Stadt",
    r"Contrôle\s+(cantonal|communal)\s+des\s+finances",
    r"Controllo\s+(cantonale|comunale)\s+delle\s+finanze",
    # Elections/reports of cantonal audit directors
    r"Wahl\s+(des|der)\s+(Direktors?|Vorsteherin|Leiterin|Vorsteher)\s+der\s+Finanzkontrolle",
    r"Tätigkeitsbericht\s+\d{4}(/\d{2,4})?\s+der\s+Finanzkontrolle(?!\s+des\s+Bundes)",
    r"Bericht\s+der\s+Finanzkontrolle\s+für\s+das\s+Jahr",
    # False positives from partial matches
    r"Briefkasten",
    r"Stiefkind",
    r"Briefkopf",
    r"Briefkastenfirm",
]


def should_exclude_affair(affair: Dict) -> bool:
    """Check if affair should be excluded (not relevant EFK mention)."""
    title_de = affair.get("title_de") or affair.get("title", {}).get("de", "") or ""
    title_fr = affair.get("title_fr") or affair.get("title", {}).get("fr", "") or ""
    title = f"{title_de} {title_fr}".lower()
    
    # Check title exclusion patterns
    for pattern in EXCLUDE_TITLE_PATTERNS:
        if pattern.lower() in title:
            return True
    
    # Check if it's a Rechnung type (legal mention only)
    type_name = (affair.get("type_name_de") or affair.get("type_harmonized_de") or 
                 affair.get("type_name_fr") or affair.get("type_harmonized_fr") or "")
    
    for excluded_type in EXCLUDE_TYPES_LEGAL_MENTION:
        if excluded_type.lower() in type_name.lower():
            # Check if the snippet actually discusses EFK substantively
            snippets = affair.get("_search_meta", {}).get("snippets", [])
            snippet_text = " ".join(s.get("text", "") for s in snippets).lower()
            
            # If snippet only mentions EFK in legal/procedural context, exclude
            legal_keywords = ["gemäss", "selon", "conformément", "gesetz", "loi", "verordnung"]
            substantive_keywords = ["bericht", "rapport", "prüfung", "audit", "empfehlung", "recommandation", "kritik", "critique"]
            
            has_legal = any(kw in snippet_text for kw in legal_keywords)
            has_substantive = any(kw in snippet_text for kw in substantive_keywords)
            
            # Exclude if only legal mention without substantive discussion
            if has_legal and not has_substantive:
                return True
    
    return False


def is_federal_audit_mention(text: str) -> bool:
    """Check if text explicitly mentions the FEDERAL audit office."""
    if not text:
        return False
    
    # First check for exclusion patterns
    for pattern in EXCLUDE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return False
    
    # Must match a federal-specific pattern
    for pattern in FEDERAL_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True
    
    return False


def fetch_affairs_by_term(search_term: str, limit: int = 200) -> List[Dict]:
    """Fetch affairs matching a search term, excluding federal parliament."""
    url = f"{API_BASE}/affairs/"
    params = {
        "search": search_term,
        "search_mode": "partial",
        "search_scope": "metadata,docs",
        "limit": limit,
        "sort_by": "-begin_date",
        "lang_format": "flat",
        "hide_null": "true",
    }
    
    try:
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        print(f"  Error fetching '{search_term}': {e}")
        return []


def get_snippets_text(affair: Dict) -> str:
    """Extract text from search snippets if available."""
    search_meta = affair.get("_search_meta", {})
    snippets = search_meta.get("snippets", [])
    return " ".join(s.get("text", "") for s in snippets)


def fetch_french_snippets_for_bilingual(affairs: List[Dict]) -> None:
    """Fetch French snippets specifically for bilingual cantons (VS, FR)."""
    print("\nFetching French snippets for bilingual cantons...")
    
    # French search terms (broader to catch more VS/FR affairs)
    fr_terms = [
        "Contrôle fédéral des finances",
        "Contrôle fédéral",
        "contrôle des finances",
        "rapport du CDF",
        "CDF",
    ]
    
    # Get affair IDs for bilingual cantons
    bilingual_ids = {a["id"]: a for a in affairs if a.get("body_key") in BILINGUAL_CANTONS_FR}
    
    if not bilingual_ids:
        return
    
    for term in fr_terms:
        url = f"{API_BASE}/affairs/"
        params = {
            "search": term,
            "search_mode": "partial",
            "limit": 200,
            "sort_by": "-begin_date",
            "lang_format": "flat",
        }
        
        try:
            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            data = response.json()
            
            for affair in data.get("data", []):
                affair_id = affair.get("id")
                if affair_id in bilingual_ids:
                    # Update with French snippets
                    search_meta = affair.get("_search_meta", {})
                    snippets = search_meta.get("snippets", [])
                    if snippets:
                        # Store French snippets
                        if "_search_meta_fr" not in bilingual_ids[affair_id]:
                            bilingual_ids[affair_id]["_search_meta_fr"] = {"snippets": []}
                        bilingual_ids[affair_id]["_search_meta_fr"]["snippets"].extend(snippets)
                        
        except Exception as e:
            print(f"  Error searching '{term}': {e}")
    
    # Update affairs with French snippets
    for affair_id, affair in bilingual_ids.items():
        if "_search_meta_fr" in affair:
            affair["_search_meta"] = affair["_search_meta_fr"]
            del affair["_search_meta_fr"]
            print(f"  ✓ Updated FR snippets for affair {affair_id}")


def fetch_all_federal_mentions() -> List[Dict]:
    """Fetch all cantonal mentions of the federal audit office."""
    all_affairs = {}
    
    for term in SEARCH_TERMS_FEDERAL:
        print(f"Searching for: {term}")
        affairs = fetch_affairs_by_term(term)
        print(f"  → {len(affairs)} results")
        
        for affair in affairs:
            affair_id = affair.get("id")
            body_key = affair.get("body_key", "")
            
            # Skip federal parliament and already seen affairs
            if body_key == FEDERAL_BODY_KEY or affair_id in all_affairs:
                continue
            
            # Skip excluded affairs (not relevant EFK mentions)
            if should_exclude_affair(affair):
                continue
            
            # Skip if already found
            if affair_id in all_affairs:
                continue
            
            # Combine all text fields for analysis
            title_de = affair.get("title_de", "") or ""
            title_fr = affair.get("title_fr", "") or ""
            title_it = affair.get("title_it", "") or ""
            title_long_de = affair.get("title_long_de", "") or ""
            title_long_fr = affair.get("title_long_fr", "") or ""
            snippets_text = get_snippets_text(affair)
            
            full_text = f"{title_de} {title_fr} {title_it} {title_long_de} {title_long_fr} {snippets_text}"
            
            # Check if it's actually about the FEDERAL audit office
            if is_federal_audit_mention(full_text):
                all_affairs[affair_id] = affair
                display_title = title_de or title_fr or title_it
                print(f"  ✓ [{body_key}] {display_title[:80]}...")
    
    return list(all_affairs.values())


def fetch_affair_docs(affair_id: int) -> List[Dict]:
    """Fetch documents for a specific affair."""
    url = f"{API_BASE}/affairs/{affair_id}/docs/"
    params = {
        "limit": 50,
        "lang_format": "flat",
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        return []


def fetch_affair_contributors(affair_id: int) -> List[Dict]:
    """Fetch contributors (authors) for a specific affair."""
    url = f"{API_BASE}/affairs/{affair_id}/contributors/"
    params = {
        "lang_format": "flat",
    }
    
    try:
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get("data", [])
    except Exception as e:
        return []


# Grisons deputies party mapping
GRISONS_DEPUTIES_PARTIES = {
    # Add deputies as needed when they appear in affairs
}

# Zug deputies party mapping
ZUG_DEPUTIES_PARTIES = {
    'Andreas Iten': 'PLR',
    'Esther Haas': 'Les Verts',
    'Luzian Franzini': 'ALG',  # Alternative - die Grünen
    'Rita Hofer': 'PS',
}

# Vaud deputies party mapping
VAUD_DEPUTIES_PARTIES = {
    'Hadrien Buclin': 'Ensemble à Gauche',  # EàG-POP
    'Rebecca Ruiz': 'PS',  # Conseillère d'État
    'Vassilis Venizelos': 'Les Verts',  # Conseiller d'État
    'Christelle Luisier': 'PLR',  # Conseillère d'État
    'Isabelle Moret': 'PLR',  # Conseillère d'État
    'Valérie Dittli': 'Le Centre',  # Conseillère d'État
    'Frédéric Borloz': 'PLR',  # Conseiller d'État
    'Pierre-Yves Maillard': 'PS',
    'Ada Marra': 'PS',
}

# Fribourg deputies/government party mapping
FRIBOURG_DEPUTIES_PARTIES = {
    'Olivier Curty': 'Le Centre',  # Conseiller d'État
    'Jean-François Steiert': 'PS',  # Conseiller d'État
    'Didier Castella': 'Le Centre',  # Conseiller d'État
    'Romain Collaud': 'PLR',  # Conseiller d'État
    'Sylvie Bonvin-Sansonnens': 'Les Verts',  # Conseillère d'État
    'Philippe Demierre': 'UDC',  # Conseiller d'État
    'Sophie Tritten': 'Le Centre',  # Conseillère d'État
}

# Valais deputies party mapping (scraped from parlement.vs.ch)
VALAIS_DEPUTIES_PARTIES = {
    # Based on current Grand Council composition
    'Blaise Melly': 'Le Centre',
    'Andrea Amherd-Burgener': 'Le Centre',
    'Emmanuel Revaz': 'Le Centre',
    'Sonia Tauss-Cornut': 'PS',
    'Anne-Laure Secco': 'PLR',
    'Dina Studer': 'Les Verts',
    'Rahel Pirovino-Indermitte': 'Le Centre',
    'Aurel Schmid': 'UDC',
    'Urs Juon': 'UDC',
    'Damien Revaz': 'Le Centre',
    'Florian Chappot': 'PLR',
    'Diego Wellig': 'Le Centre',
    'Franz Ruppen': 'UDC',
    'Philipp Matthias Bregy': 'Le Centre',
    'Beat Rieder': 'Le Centre',
    'Mathias Reynard': 'PS',
    'Roberto Schmidt': 'Le Centre',
    'Christophe Darbellay': 'Le Centre',
    'Frédéric Favre': 'PLR',
    'Franz Ruppen': 'UDC',
}

# Party name translations (DE -> FR)
PARTY_TRANSLATIONS = {
    'FDP': 'PLR', 'SVP': 'UDC', 'SP': 'PS', 
    'CVP': 'PDC', 'Grüne': 'Les Verts', 'GLP': 'PVL',
    'EVP': 'PEV', 'BDP': 'PBD', 'Mitte': 'Le Centre',
    'Die Mitte': 'Le Centre', 'GPS': 'Les Verts',
}


def scrape_authors_from_page(page_url: str) -> List[Dict]:
    """Scrape author information directly from parliament page when API doesn't provide party info."""
    import re
    from bs4 import BeautifulSoup
    
    if not page_url:
        return []
    
    try:
        response = requests.get(page_url, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        authors = []
        
        # Pattern for Zurich city parliament: "Name (Party)"
        # Look for entrySubmitted div or similar
        submitted_div = soup.find('div', class_='entrySubmitted')
        if submitted_div:
            # Find all links with author names
            links = submitted_div.find_all('a')
            for link in links:
                text = link.get_text(strip=True)
                # Match "Name (Party)" pattern
                match = re.match(r'^(.+?)\s*\(([^)]+)\)$', text)
                if match:
                    authors.append({
                        'fullname': match.group(1).strip(),
                        'party': match.group(2).strip(),
                    })
                elif text and not text.startswith('http'):
                    authors.append({
                        'fullname': text,
                        'party': '',
                    })
        
        # Pattern for Valais parliament: look for author info
        if not authors:
            # Try to find author pattern in page text
            text = soup.get_text()
            # Match patterns like "Auteur: Name (Party)" or "Eingereicht von: Name (Party)"
            patterns = [
                r'(?:Auteur|Eingereicht von|Autor)[:\s]+([^(]+)\s*\(([^)]+)\)',
                r'(?:Auteur|Eingereicht von|Autor)[:\s]+([^\n(]+)',
            ]
            for pattern in patterns:
                matches = re.findall(pattern, text)
                for match in matches:
                    if isinstance(match, tuple) and len(match) == 2:
                        authors.append({
                            'fullname': match[0].strip(),
                            'party': match[1].strip(),
                        })
                    elif isinstance(match, str):
                        authors.append({
                            'fullname': match.strip(),
                            'party': '',
                        })
                if authors:
                    break
        
        return authors[:3]  # Limit to first 3 authors
    except Exception as e:
        return []


def find_efk_documents(docs: List[Dict], snippet_sources: List[str]) -> Dict[str, List[Dict]]:
    """Find documents that mention the federal audit office.
    Returns dict with 'fr' and 'de' versions for bilingual cantons."""
    import re
    
    def get_base_name(name: str) -> str:
        """Get base name without language prefix/suffix."""
        # Remove prefix like de_, fr_, it_
        name = re.sub(r'^(de|fr|it)_', '', name)
        # Remove suffix like _DE, _FR, _IT
        return re.sub(r'[_-](DE|FR|IT|de|fr|it)(\.\w+)?$', '', name)
    
    def get_lang(name: str) -> str:
        """Detect document language from name."""
        if '_FR' in name or '_fr' in name or name.endswith('_FR.pdf') or name.startswith('fr_'):
            return 'fr'
        elif '_DE' in name or '_de' in name or name.endswith('_DE.pdf') or name.startswith('de_'):
            return 'de'
        return 'unknown'
    
    # Group documents by base name and language
    docs_by_base = {}  # base_name -> {lang: doc_info}
    
    for doc in docs:
        name = doc.get("name", "") or ""
        url = doc.get("url")
        
        if not url:
            continue
            
        # Check if this document was found in snippets (strict matching)
        matched = False
        for source in snippet_sources:
            if source and name:
                # Require exact match or very high similarity (>80% of name matches)
                if source == name or name == source:
                    matched = True
                    break
                # Allow match if source is a significant part of the name (not just prefix)
                if len(source) > 20 and source in name:
                    matched = True
                    break
                if len(name) > 20 and name in source:
                    matched = True
                    break
        
        if not matched:
            # Only include if name explicitly mentions EFK/CDF
            title = doc.get("title", "") or ""
            text = f"{name} {title}"
            if not is_federal_audit_mention(text):
                continue
        
        base_name = get_base_name(name)
        lang = get_lang(name)
        
        if base_name not in docs_by_base:
            docs_by_base[base_name] = {}
        
        # Store by language (or 'default' if unknown)
        lang_key = lang if lang != 'unknown' else 'default'
        if lang_key not in docs_by_base[base_name]:
            docs_by_base[base_name][lang_key] = {
                "id": doc.get("id"),
                "name": name,
                "title": doc.get("title", ""),
                "url": url,
                "mime_type": doc.get("mime_type"),
            }
    
    # Build result with FR preferred (for French interface)
    # but keep DE versions available for future bilingual support
    result_fr = []
    result_de = []
    
    def generate_fr_url(url: str) -> str:
        """Generate FR URL from DE URL by replacing language markers."""
        if not url:
            return url
        # Replace /de/ with /fr/ in path
        url = url.replace("/de/", "/fr/")
        # Replace de_ prefix in filename with fr_
        url = re.sub(r'/de_([^/]+)$', r'/fr_\1', url)
        return url
    
    def generate_de_url(url: str) -> str:
        """Generate DE URL from FR URL by replacing language markers."""
        if not url:
            return url
        url = url.replace("/fr/", "/de/")
        url = re.sub(r'/fr_([^/]+)$', r'/de_\1', url)
        return url
    
    for base_name, lang_docs in docs_by_base.items():
        # For FR list: prefer FR, fallback to default, then generate from DE
        if 'fr' in lang_docs:
            result_fr.append(lang_docs['fr'])
        elif 'default' in lang_docs:
            result_fr.append(lang_docs['default'])
        elif 'de' in lang_docs:
            # Generate FR URL from DE
            doc_fr = lang_docs['de'].copy()
            doc_fr['url'] = generate_fr_url(doc_fr['url'])
            result_fr.append(doc_fr)
        
        # For DE list: prefer DE, fallback to default, then generate from FR
        if 'de' in lang_docs:
            result_de.append(lang_docs['de'])
        elif 'default' in lang_docs:
            result_de.append(lang_docs['default'])
        elif 'fr' in lang_docs:
            # Generate DE URL from FR
            doc_de = lang_docs['fr'].copy()
            doc_de['url'] = generate_de_url(doc_de['url'])
            result_de.append(doc_de)
    
    return {"fr": result_fr, "de": result_de}


def detect_snippet_language(text: str) -> str:
    """Detect if snippet is in French or German based on keywords."""
    fr_keywords = ["Contrôle", "fédéral", "finances", "rapport", "conformément", 
                   "recommandations", "audit", "prochaines", "également"]
    de_keywords = ["Finanzkontrolle", "eidgenössisch", "Prüfung", "Bericht", 
                   "gemäss", "Empfehlungen", "Kontrolle", "ebenfalls"]
    
    text_lower = text.lower()
    fr_count = sum(1 for kw in fr_keywords if kw.lower() in text_lower)
    de_count = sum(1 for kw in de_keywords if kw.lower() in text_lower)
    
    if fr_count > de_count:
        return "fr"
    elif de_count > fr_count:
        return "de"
    return "unknown"


def snippet_mentions_efk(text: str) -> bool:
    """Check if snippet text actually mentions EFK/CDF."""
    if not text:
        return False
    text_lower = text.lower()
    
    efk_keywords = [
        "eidgenössische finanzkontrolle", "eidgenössischen finanzkontrolle",
        "finanzkontrolle des bundes", "efk", "efk-bericht", "efk-prüfung",
        "contrôle fédéral des finances", "cdf", "rapport du cdf",
        "controllo federale delle finanze",
    ]
    
    return any(kw in text_lower for kw in efk_keywords)


def extract_snippet_info(affair: Dict) -> Dict:
    """Extract snippet sources and text excerpts in both FR and DE that mention EFK."""
    import re
    
    sources = []
    excerpts_fr = []
    excerpts_de = []
    search_meta = affair.get("_search_meta", {})
    snippets = search_meta.get("snippets", [])
    
    seen_texts = set()
    for snippet in snippets:
        source_name = snippet.get("source_name", "")
        text = snippet.get("text", "").strip()
        
        # Only add source if the snippet actually mentions EFK/CDF
        if snippet.get("source_type") == "docs" and source_name and snippet_mentions_efk(text):
            sources.append(source_name)
        
        # Only keep excerpts that actually mention EFK/CDF
        if text and text not in seen_texts and snippet_mentions_efk(text):
            # Clean up the text
            text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
            if len(text) > 50:  # Only meaningful excerpts
                lang = detect_snippet_language(text)
                excerpt = {
                    "text": text[:300],
                    "source": source_name or "titre",
                }
                
                if lang == "fr":
                    excerpts_fr.append(excerpt)
                else:
                    # DE or unknown -> treat as DE
                    excerpts_de.append(excerpt)
                
                seen_texts.add(text)
    
    return {
        "sources": list(set(sources)),
        "excerpts_fr": excerpts_fr[:2],
        "excerpts_de": excerpts_de[:2],
    }


def enrich_with_documents_and_authors(affairs: List[Dict]) -> List[Dict]:
    """Fetch and add relevant documents and authors to each affair."""
    print("\nFetching documents and authors for each affair...")
    
    for i, affair in enumerate(affairs):
        affair_id = affair.get("id")
        title = affair.get("title_de") or affair.get("title_fr") or ""
        print(f"  [{i+1}/{len(affairs)}] {title[:50]}...", end=" ")
        
        # Extract snippet info (sources and text excerpts)
        snippet_info = extract_snippet_info(affair)
        snippet_sources = snippet_info["sources"]
        
        # Store text excerpts in both languages
        if snippet_info["excerpts_fr"]:
            affair["efk_excerpts_fr"] = snippet_info["excerpts_fr"]
        if snippet_info["excerpts_de"]:
            affair["efk_excerpts_de"] = snippet_info["excerpts_de"]
        
        # Fetch all documents for this affair
        docs = fetch_affair_docs(affair_id)
        
        if docs:
            # Find documents that mention EFK (using snippets + name matching)
            efk_docs_by_lang = find_efk_documents(docs, snippet_sources)
            
            # Store FR documents for French interface (primary)
            if efk_docs_by_lang["fr"]:
                affair["efk_documents"] = efk_docs_by_lang["fr"]
                print(f"✓ {len(efk_docs_by_lang['fr'])} doc(s)", end=" ")
            
            # Also store DE documents for future bilingual support
            if efk_docs_by_lang["de"]:
                affair["efk_documents_de"] = efk_docs_by_lang["de"]
            
            # If no specific EFK docs found, include all docs for reference
            if not efk_docs_by_lang["fr"] and not efk_docs_by_lang["de"]:
                affair["all_documents"] = [{
                    "id": d.get("id"),
                    "name": d.get("name", ""),
                    "url": d.get("url"),
                    "mime_type": d.get("mime_type"),
                } for d in docs[:5]]
                print(f"({len(docs)} docs)", end=" ")
        else:
            # No docs but we have snippet sources - store them for reference
            if snippet_sources:
                affair["snippet_sources"] = snippet_sources
            print("no docs", end=" ")
        
        # Fetch contributors (authors)
        contributors = fetch_affair_contributors(affair_id)
        authors = []
        has_party_from_api = False
        
        if contributors:
            for c in contributors:
                party_dict = c.get("party", {}) or {}
                author_info = {
                    "fullname": c.get("fullname", ""),
                    "firstname": c.get("firstname", ""),
                    "lastname": c.get("lastname", ""),
                    "party_fr": party_dict.get("fr", "") if isinstance(party_dict, dict) else "",
                    "party_de": party_dict.get("de", "") if isinstance(party_dict, dict) else "",
                    "role": c.get("role_harmonized", ""),
                }
                if author_info["fullname"]:
                    authors.append(author_info)
                    if author_info["party_fr"] or author_info["party_de"]:
                        has_party_from_api = True
        
        # If no party info from API, try different sources
        if not has_party_from_api:
            body_key = affair.get("body_key", "")
            
            # Use static dictionaries for known cantons
            party_dict = None
            if body_key == "VS":
                party_dict = VALAIS_DEPUTIES_PARTIES
            elif body_key == "FR":
                party_dict = FRIBOURG_DEPUTIES_PARTIES
            elif body_key == "VD":
                party_dict = VAUD_DEPUTIES_PARTIES
            elif body_key == "ZG":
                party_dict = ZUG_DEPUTIES_PARTIES
            elif body_key == "BE":
                # Load Bern deputies from JSON file
                import os
                bern_file = os.path.join(os.path.dirname(__file__), "bern_deputies.json")
                if os.path.exists(bern_file):
                    with open(bern_file, "r", encoding="utf-8") as f:
                        bern_data = json.load(f)
                    for author in authors:
                        fullname = author.get("fullname", "")
                        if fullname in bern_data:
                            author["party_fr"] = bern_data[fullname].get("fr", "")
                            author["party_de"] = bern_data[fullname].get("de", "")
                            has_party_from_api = True
            
            if party_dict:
                for author in authors:
                    fullname = author.get("fullname", "")
                    if fullname in party_dict:
                        party = party_dict[fullname]
                        author["party_fr"] = party
                        # Translate to German if needed
                        de_parties = {v: k for k, v in PARTY_TRANSLATIONS.items()}
                        author["party_de"] = de_parties.get(party, party)
                        has_party_from_api = True
            
            # For other cantons, try scraping the parliament page
            page_url = affair.get("url_external_de") or affair.get("url_external_fr") or affair.get("url_external")
            scraped_authors = scrape_authors_from_page(page_url)
            if scraped_authors:
                party_translations = {
                    'FDP': 'PLR', 'SVP': 'UDC', 'SP': 'PS', 
                    'CVP': 'PDC', 'Grüne': 'Les Verts', 'GLP': 'PVL',
                    'EVP': 'PEV', 'BDP': 'PBD', 'Mitte': 'Le Centre',
                }
                
                # If we have authors from API, update them with scraped party info
                if authors:
                    for author in authors:
                        for scraped in scraped_authors:
                            if scraped.get('fullname') and author.get('fullname'):
                                if (scraped['fullname'] in author['fullname'] or 
                                    author['fullname'] in scraped['fullname'] or
                                    author.get('lastname', '') in scraped['fullname']):
                                    if scraped.get('party'):
                                        author['party_de'] = scraped['party']
                                        author['party_fr'] = party_translations.get(scraped['party'], scraped['party'])
                                    break
                
                # Add any scraped authors not already in the list
                existing_names = {a.get('fullname', '').lower() for a in authors}
                existing_lastnames = {a.get('lastname', '').lower() for a in authors if a.get('lastname')}
                for scraped in scraped_authors:
                    scraped_name = scraped.get('fullname', '')
                    scraped_lastname = scraped_name.split()[-1].lower() if ' ' in scraped_name else scraped_name.lower()
                    
                    if scraped_name and scraped_name.lower() not in existing_names and scraped_lastname not in existing_lastnames:
                        new_author = {
                            'fullname': scraped_name,
                            'firstname': scraped_name.split()[0] if ' ' in scraped_name else '',
                            'lastname': scraped_name.split()[-1] if ' ' in scraped_name else scraped_name,
                            'party_de': scraped.get('party', ''),
                            'party_fr': party_translations.get(scraped.get('party', ''), scraped.get('party', '')),
                            'role': 'author',
                        }
                        authors.append(new_author)
                        existing_lastnames.add(scraped_lastname)
        
        if authors:
            affair["authors"] = authors
            
            # Filter out departments - keep only real authors
            real_authors = [a for a in authors if a.get('role') != 'leading_department' and 
                           not a.get('fullname', '').endswith(')') or 
                           a.get('party_fr') or a.get('party_de')]
            
            # If no real authors found, use all authors
            if not real_authors:
                real_authors = authors
            
            # Create display strings with ALL authors
            def format_author(author, lang='fr'):
                party = author.get(f'party_{lang}', '') or author.get('party_de', '')
                if party:
                    return f"{author['fullname']} ({party})"
                return author['fullname']
            
            # Format all real authors (deduplicated by fullname, normalized)
            seen_names = set()
            unique_authors = []
            for a in real_authors:
                name = a.get('fullname', '')
                # Normalize: replace non-breaking spaces and strip
                normalized_name = name.replace('\xa0', ' ').strip().lower()
                if name and normalized_name not in seen_names:
                    seen_names.add(normalized_name)
                    unique_authors.append(a)
            
            authors_display_fr = ', '.join(format_author(a, 'fr') for a in unique_authors)
            authors_display_de = ', '.join(format_author(a, 'de') for a in unique_authors)
            
            affair["author_display_fr"] = authors_display_fr
            affair["author_display_de"] = authors_display_de
            affair["author_display"] = authors_display_fr
            
            print(f"👤 {affair['author_display'][:30]}")
        else:
            print("")
        
        # Generate FR/IT URLs from DE URL if missing
        url_de = affair.get("url_external_de") or affair.get("url_external")
        if url_de:
            if not affair.get("url_external_fr"):
                affair["url_external_fr"] = url_de.replace("/de/", "/fr/")
            if not affair.get("url_external_it"):
                affair["url_external_it"] = url_de.replace("/de/", "/it/")
        
        # Small delay to avoid rate limiting
        import time
        time.sleep(0.3)
    
    return affairs


def fetch_body_info() -> Dict[str, str]:
    """Fetch body names for display."""
    url = f"{API_BASE}/bodies/"
    params = {
        "fields": "body_key,name",
        "limit": 2500,
        "lang_format": "flat",
    }
    
    try:
        response = requests.get(url, params=params, timeout=60)
        response.raise_for_status()
        data = response.json()
        bodies = {b["body_key"]: b["name"] for b in data.get("data", [])}
        
        # Manual overrides for common municipalities
        overrides = {
            "261": "Zürich (Stadt)",
            "351": "Bern (Stadt)",
            "1061": "Luzern (Stadt)",
            "2829": "Liestal",
        }
        bodies.update(overrides)
        
        return bodies
    except Exception as e:
        print(f"Error fetching bodies: {e}")
        return {}


def enrich_with_body_names(affairs: List[Dict], bodies: Dict[str, str]) -> List[Dict]:
    """Add body names to affairs (French translations when available)."""
    for affair in affairs:
        body_key = affair.get("body_key", "")
        
        # Use French translation if available, otherwise use API name
        if body_key in CANTON_NAMES_FR:
            affair["body_name_fr"] = CANTON_NAMES_FR[body_key]
        else:
            # Try to get from API data
            affair["body_name_fr"] = bodies.get(body_key, body_key)
        
        # Also store original name for reference
        affair["body_name_original"] = bodies.get(body_key, body_key)
        
        # Default display name is French
        affair["body_name"] = affair["body_name_fr"]
    
    return affairs


def save_results(affairs: List[Dict], filename: str = "cantonal_efk_mentions.json"):
    """Save results to JSON file."""
    output = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_records": len(affairs),
            "source": "OpenParlData.ch API",
            "description": "Cantonal parliament mentions of the Swiss Federal Audit Office (EFK/CDF)",
        },
        "data": affairs
    }
    
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Saved {len(affairs)} records to {filename}")


def main():
    parser = argparse.ArgumentParser(description="Fetch cantonal EFK mentions")
    parser.add_argument("--months-back", type=int, default=None,
                       help="Only fetch affairs from the last N months (default: all)")
    args = parser.parse_args()
    
    print("=" * 60)
    print("Fetching cantonal mentions of the Federal Audit Office")
    print("=" * 60)
    
    if args.months_back:
        print(f"  (Limited to last {args.months_back} month(s))")
    
    # Fetch body information
    print("\nFetching parliament information...")
    bodies = fetch_body_info()
    print(f"  Found {len(bodies)} parliaments")
    
    # Fetch all mentions
    print("\nSearching for federal audit office mentions...")
    affairs = fetch_all_federal_mentions()
    
    # Filter by date if --months-back specified
    if args.months_back:
        cutoff_date = (datetime.now() - timedelta(days=args.months_back * 30)).strftime("%Y-%m-%d")
        original_count = len(affairs)
        affairs = [a for a in affairs if (a.get("begin_date") or "") >= cutoff_date]
        print(f"  Filtered to {len(affairs)} affairs (from {original_count}) since {cutoff_date}")
    
    # Enrich with body names
    affairs = enrich_with_body_names(affairs, bodies)
    
    # Fetch French snippets for bilingual cantons (VS, FR)
    fetch_french_snippets_for_bilingual(affairs)
    
    # Fetch documents and authors for each affair
    affairs = enrich_with_documents_and_authors(affairs)
    
    # Sort by date (most recent first)
    affairs.sort(key=lambda x: x.get("begin_date", "") or "", reverse=True)
    
    # If --months-back, merge with existing data (keep old entries)
    if args.months_back:
        import os
        existing_file = os.path.join(os.path.dirname(__file__), "cantonal_efk_mentions.json")
        if os.path.exists(existing_file):
            with open(existing_file, "r", encoding="utf-8") as f:
                existing_data = json.load(f)
            existing_affairs = existing_data.get("data", [])
            
            # Merge: new affairs + existing affairs not in new set
            new_ids = {a.get("id") for a in affairs}
            for old in existing_affairs:
                if old.get("id") not in new_ids:
                    affairs.append(old)
            
            # Re-sort
            affairs.sort(key=lambda x: x.get("begin_date", "") or "", reverse=True)
            print(f"  Merged with existing data: {len(affairs)} total affairs")
    
    # Save results
    save_results(affairs)
    
    # Summary by canton
    print("\n" + "=" * 60)
    print("Summary by parliament:")
    print("=" * 60)
    
    by_body = {}
    with_efk_docs = 0
    for affair in affairs:
        body = affair.get("body_name", "Unknown")
        by_body[body] = by_body.get(body, 0) + 1
        if affair.get("efk_documents"):
            with_efk_docs += 1
    
    for body, count in sorted(by_body.items(), key=lambda x: -x[1]):
        print(f"  {body}: {count}")
    
    print(f"\n✓ {with_efk_docs}/{len(affairs)} objets avec documents EFK identifiés")


if __name__ == "__main__":
    main()
