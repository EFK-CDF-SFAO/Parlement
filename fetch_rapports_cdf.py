#!/usr/bin/env python3
"""
Script pour récupérer les rapports CDF depuis l'API WordPress
et faire le matching avec les objets/débats parlementaires.
"""

import json
import re
import urllib.request
import urllib.error
from pathlib import Path

API_BASE_DE = "https://www.efk.admin.ch/wp-json/wp/v2"
API_BASE_FR = "https://www.efk.admin.ch/fr/wp-json/wp/v2"
OUTPUT_FILE = "rapports_cdf.json"

def fetch_audits_for_lang(api_base, lang):
    """Récupère tous les rapports depuis l'API WordPress pour une langue."""
    audits = []
    page = 1
    per_page = 100
    
    while True:
        url = f"{api_base}/audit?per_page={per_page}&page={page}"
        
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 400:
                break
            raise
        
        if not data:
            break
            
        audits.extend(data)
        page += 1
    
    return audits

def fetch_all_audits():
    """Récupère tous les rapports depuis l'API WordPress (DE + FR)."""
    print("Récupération des rapports CDF...")
    
    # Récupérer DE
    print("  DE...", end=" ")
    audits_de = fetch_audits_for_lang(API_BASE_DE, "de")
    print(f"{len(audits_de)} rapports")
    
    # Récupérer FR
    print("  FR...", end=" ")
    audits_fr = fetch_audits_for_lang(API_BASE_FR, "fr")
    print(f"{len(audits_fr)} rapports")
    
    # Indexer FR par numéro PA pour merge
    fr_by_pa = {}
    for audit in audits_fr:
        acf = audit.get("acf") or {}
        audit_numbers = acf.get("audit_numbers") or []
        for num in audit_numbers:
            if num and num.get("audit_number"):
                pa = num["audit_number"]
                fr_by_pa[pa] = audit
    
    # Ajouter titre FR aux audits DE
    for audit in audits_de:
        acf = audit.get("acf") or {}
        audit_numbers = acf.get("audit_numbers") or []
        for num in audit_numbers:
            if num and num.get("audit_number"):
                pa = num["audit_number"]
                if pa in fr_by_pa:
                    audit["title_fr"] = fr_by_pa[pa].get("title", {}).get("rendered", "")
                    audit["content_fr"] = fr_by_pa[pa].get("content", {}).get("rendered", "")
                    break
    
    print(f"\nTotal: {len(audits_de)} rapports (avec titres FR)")
    return audits_de

def extract_rapport_data(audit):
    """Extrait les données utiles d'un rapport."""
    acf = audit.get("acf") or {}
    
    # Extraire les numéros PA
    pa_numbers = []
    audit_numbers = acf.get("audit_numbers") or []
    for num in audit_numbers:
        if num and num.get("audit_number"):
            pa_numbers.append(num["audit_number"])
    
    # Extraire le contenu HTML DE et le nettoyer
    content_html_de = audit.get("content", {}).get("rendered", "") or ""
    content_de = re.sub(r'<[^>]+>', ' ', content_html_de)
    content_de = re.sub(r'\s+', ' ', content_de).strip()
    
    # Extraire le contenu HTML FR et le nettoyer
    content_html_fr = audit.get("content_fr", "") or ""
    content_fr = re.sub(r'<[^>]+>', ' ', content_html_fr)
    content_fr = re.sub(r'\s+', ' ', content_fr).strip()
    
    return {
        "id": audit.get("id"),
        "pa_numbers": pa_numbers,
        "title_de": audit.get("title", {}).get("rendered", ""),
        "title_fr": audit.get("title_fr", ""),
        "content_de": content_de,
        "content_fr": content_fr,
        "date": acf.get("audit_date", ""),
        "office": acf.get("audit_office_local", ""),
        "url": audit.get("link", ""),
        "category_ids": audit.get("audit_category", []),
        "type_ids": audit.get("audit_type", [])
    }

def save_rapports(rapports):
    """Sauvegarde les rapports dans un fichier JSON."""
    output = {
        "meta": {
            "total": len(rapports),
            "source": "efk.admin.ch API"
        },
        "items": rapports
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\nFichier {OUTPUT_FILE} créé avec {len(rapports)} rapports")

def load_debates():
    """Charge les données des débats."""
    with open("debates_data.json", "r", encoding="utf-8") as f:
        return json.load(f)

def load_objects():
    """Charge les données des objets parlementaires."""
    with open("cdf_efk_data.json", "r", encoding="utf-8") as f:
        return json.load(f)

def find_pa_in_text(text, pa_numbers):
    """Cherche les numéros PA dans un texte."""
    if not text:
        return []
    
    found = []
    for pa in pa_numbers:
        # Chercher différents formats : PA 12345, PA12345, 12345
        patterns = [
            rf'\bPA\s*{pa}\b',
            rf'\b{pa}\b'
        ]
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                found.append(pa)
                break
    return found

def normalize_text(text):
    """Normalise un texte pour la comparaison."""
    if not text:
        return ""
    # Minuscules
    text = text.lower()
    # Conserver les tirets dans les termes composés (e-id, f-35, etc.)
    # Remplacer tiret par underscore temporairement
    text = re.sub(r'(\w)-(\w)', r'\1_\2', text)
    # Suppression ponctuation sauf underscore
    text = re.sub(r'[^\w\s]', ' ', text)
    # Remettre les tirets
    text = text.replace('_', '-')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def extract_keywords(text, min_length=5):
    """Extrait les mots-clés significatifs d'un texte."""
    if not text:
        return set()
    
    # Termes courts mais significatifs (à conserver même si < min_length)
    important_short_terms = {
        'eid', 'e-id', 'cff', 'sbb', 'ffs', 'post', 'ruag', 'nato', 'asile', 'asyl',
        'bav', 'bag', 'bsv', 'bfe', 'bazl', 'seco', 'deza', 'ejpd', 'uvek', 'edöb',
        'ahv', 'avs', 'ivs', 'apg', 'alv', 'suva', 'pkb', 'publica',
        'f35', 'f-35', 'p8', 'c130', 'rega', 'srg', 'srf', 'rts',
        'tva', 'mwst', 'ust', 'zoll', 'douane', 'covid', 'sars',
        'ai', 'ki', 'cyber', 'cloud', 'data', 'agrar', 'rail', 'auto',
    }
    
    # Mots à ignorer (stopwords FR/DE + termes génériques CDF)
    stopwords = {
        # Stopwords FR
        'pour', 'dans', 'avec', 'sans', 'être', 'avoir', 'faire', 'plus', 'moins',
        'cette', 'sont', 'leur', 'leurs', 'nous', 'vous', 'elle', 'elles',
        'aussi', 'comme', 'donc', 'entre', 'mais', 'même', 'autre', 'autres',
        'contre', 'depuis', 'avant', 'après', 'pendant', 'selon', 'alors',
        'toujours', 'encore', 'ainsi', 'parce', 'peut', 'peuvent', 'doit',
        'faut', 'tout', 'tous', 'toute', 'toutes', 'bien', 'très', 'fait',
        # Stopwords DE
        'eine', 'einer', 'eines', 'einem', 'einen', 'dass', 'wird', 'werden',
        'haben', 'sein', 'sind', 'wurde', 'wurden', 'durch', 'nach', 'über',
        'unter', 'zwischen', 'diese', 'dieser', 'dieses', 'diesem', 'diesen',
        'auch', 'aber', 'oder', 'wenn', 'weil', 'noch', 'schon', 'sehr',
        'mehr', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen',
        'nicht', 'kein', 'keine', 'keiner', 'keines', 'alle', 'allen',
        # Termes génériques CDF/EFK à exclure (déjà présents dans tous les débats)
        'cdf', 'efk', 'sfao', 'finanzkontrolle', 'eidgenössische', 'eidgenössischen',
        'contrôle', 'fédéral', 'fédérale', 'finances', 'controllo', 'federale',
        'finanze', 'audit', 'prüfung', 'rapport', 'bericht', 'rapporto',
        'bundesrat', 'conseil', 'national', 'états', 'ständerat', 'nationalrat',
        'schweiz', 'suisse', 'svizzera', 'bund', 'bundes', 'confédération',
        'million', 'millionen', 'millions', 'milliard', 'milliards',
        'franken', 'francs', 'chf', 'jahr', 'jahre', 'jahren', 'année', 'années',
        'januar', 'februar', 'märz', 'april', 'juni', 'juli', 'august',
        'september', 'oktober', 'november', 'dezember',
        'janvier', 'février', 'mars', 'avril', 'juin', 'juillet', 'août',
        'septembre', 'octobre', 'novembre', 'décembre',
        'artikel', 'article', 'absatz', 'alinéa', 'gesetz', 'loi', 'legge',
        'verwaltung', 'administration', 'amministrazione', 'bereich', 'domaine',
    }
    
    words = normalize_text(text).split()
    # Garder les mots longs OU les termes courts importants
    keywords = {w for w in words if (len(w) >= min_length or w in important_short_terms) and w not in stopwords}
    return keywords

def match_by_keywords(rapport_title, debate_text, threshold=4):
    """Vérifie si un rapport correspond à un débat par mots-clés."""
    rapport_keywords = extract_keywords(rapport_title)
    debate_keywords = extract_keywords(debate_text)
    
    # Compter les mots en commun
    common = rapport_keywords & debate_keywords
    return len(common) >= threshold, common

def parse_date(date_str):
    """Parse une date au format YYYYMMDD ou YYYY-MM-DD."""
    if not date_str:
        return None
    try:
        # Format YYYYMMDD
        if len(str(date_str)) == 8 and str(date_str).isdigit():
            return int(str(date_str))
        # Format avec tirets
        clean = str(date_str).replace('-', '')[:8]
        if len(clean) == 8 and clean.isdigit():
            return int(clean)
    except:
        pass
    return None

def is_rapport_before_debate(rapport_date, debate_date, max_years=3):
    """Vérifie si le rapport a été publié avant le débat (max 3 ans avant)."""
    r_date = parse_date(rapport_date)
    d_date = parse_date(debate_date)
    
    if r_date is None or d_date is None:
        return False  # Si pas de date, on ne peut pas vérifier
    
    # Rapport doit être publié AVANT le débat
    if r_date > d_date:
        return False
    
    # Rapport ne doit pas être trop vieux (max 3 ans = ~30000 jours en format YYYYMMDD)
    # Approximation: 3 ans = 30000 en différence YYYYMMDD
    date_diff = d_date - r_date
    max_diff = max_years * 10000  # 30000 pour 3 ans
    
    return date_diff <= max_diff

def match_by_office(rapport_office, debate_department):
    """Vérifie si l'office du rapport correspond au département du débat."""
    if not rapport_office or not debate_department:
        return False
    
    # Mapping office -> département
    office_mapping = {
        'SECO': ['WBF', 'DEFR', 'SECO'],
        'OFSP': ['EDI', 'DFI', 'BAG', 'OFSP'],
        'OFAS': ['EDI', 'DFI', 'BSV', 'OFAS'],
        'OFEN': ['UVEK', 'DETEC', 'BFE', 'OFEN'],
        'OFROU': ['UVEK', 'DETEC', 'ASTRA', 'OFROU'],
        'OFT': ['UVEK', 'DETEC', 'BAV', 'OFT'],
        'DDPS': ['VBS', 'DDPS'],
        'armasuisse': ['VBS', 'DDPS'],
        'DFAE': ['EDA', 'DFAE'],
        'DDC': ['EDA', 'DFAE', 'DEZA', 'DDC'],
        'FEDPOL': ['EJPD', 'DFJP', 'FEDPOL'],
        'SEM': ['EJPD', 'DFJP', 'SEM'],
        'AFF': ['EFD', 'DFF', 'EFV', 'AFF'],
        'AFC': ['EFD', 'DFF', 'ESTV', 'AFC'],
        'AFD': ['EFD', 'DFF', 'EZV', 'AFD'],
        'OFCOM': ['UVEK', 'DETEC', 'BAKOM', 'OFCOM'],
        'MétéoSuisse': ['EDI', 'DFI'],
        'Swissmedic': ['EDI', 'DFI'],
        'CFF': ['UVEK', 'DETEC', 'SBB', 'CFF'],
        'La Poste': ['UVEK', 'DETEC'],
        'Swisscom': ['UVEK', 'DETEC'],
    }
    
    rapport_office_upper = rapport_office.upper()
    debate_dept_upper = debate_department.upper()
    
    # Chercher correspondance directe ou via mapping
    for office, depts in office_mapping.items():
        if office.upper() in rapport_office_upper:
            for dept in depts:
                if dept.upper() in debate_dept_upper:
                    return True
    
    # Correspondance directe
    return rapport_office_upper in debate_dept_upper or debate_dept_upper in rapport_office_upper

def match_office_in_text(rapport_office, debate_text):
    """Vérifie si l'office du rapport est mentionné dans le texte du débat."""
    if not rapport_office or not debate_text:
        return False
    
    # Normaliser
    text_lower = debate_text.lower()
    office_lower = rapport_office.lower()
    
    # Liste des offices à rechercher (avec variantes)
    office_variants = {
        'fedpol': ['fedpol', 'bundesamt für polizei', 'office fédéral de la police'],
        'seco': ['seco', 'staatssekretariat für wirtschaft', 'secrétariat d\'état à l\'économie'],
        'sem': ['sem', 'staatssekretariat für migration', 'secrétariat d\'état aux migrations'],
        'bav': ['bav', 'bundesamt für verkehr', 'office fédéral des transports', 'oft'],
        'bafu': ['bafu', 'bundesamt für umwelt', 'office fédéral de l\'environnement', 'ofev'],
        'bag': ['bag', 'bundesamt für gesundheit', 'office fédéral de la santé publique', 'ofsp'],
        'bsv': ['bsv', 'bundesamt für sozialversicherungen', 'office fédéral des assurances sociales', 'ofas'],
        'estv': ['estv', 'eidgenössische steuerverwaltung', 'administration fédérale des contributions', 'afc'],
        'bazl': ['bazl', 'bundesamt für zivilluftfahrt', 'office fédéral de l\'aviation civile', 'ofac'],
        'astra': ['astra', 'bundesamt für strassen', 'office fédéral des routes', 'ofrou'],
        'bfe': ['bfe', 'bundesamt für energie', 'office fédéral de l\'énergie', 'ofen'],
        'bakom': ['bakom', 'bundesamt für kommunikation', 'office fédéral de la communication', 'ofcom'],
        'bj': ['bj', 'bundesamt für justiz', 'office fédéral de la justice', 'ofj'],
        'eda': ['eda', 'departement für auswärtige angelegenheiten', 'dfae'],
        'vbs': ['vbs', 'departement für verteidigung', 'ddps'],
        'armasuisse': ['armasuisse'],
        'sbb': ['sbb', 'cff', 'ffs', 'bundesbahnen', 'chemins de fer fédéraux'],
        'post': ['post', 'poste', 'posta'],
        'swisscom': ['swisscom'],
        'ruag': ['ruag'],
    }
    
    # Chercher l'office dans le texte
    for office_key, variants in office_variants.items():
        if office_key in office_lower or office_lower in office_key:
            for variant in variants:
                if variant in text_lower:
                    return True
    
    # Recherche directe de l'office
    if office_lower in text_lower:
        return True
    
    return False

def match_rapports_with_data(rapports):
    """Fait le matching entre rapports et objets/débats avec 3 méthodes."""
    # Créer un index des numéros PA
    pa_to_rapport = {}
    for r in rapports:
        for pa in r["pa_numbers"]:
            pa_to_rapport[pa] = r
    
    all_pa_numbers = list(pa_to_rapport.keys())
    
    # Charger les données
    debates_data = load_debates()
    objects_data = load_objects()
    
    print(f"\n=== MATCHING ===")
    print(f"Rapports: {len(rapports)} | Débats: {len(debates_data.get('items', []))} | Objets: {len(objects_data.get('items', []))}")
    
    # === 1. MATCHING PAR NUMÉRO PA ===
    print("\n1. Matching par numéro PA...")
    debates_pa_matches = []
    for debate in debates_data.get("items", []):
        text = f"{debate.get('text', '')} {debate.get('business_title_fr', '')} {debate.get('business_title_de', '')}"
        found_pa = find_pa_in_text(text, all_pa_numbers)
        if found_pa:
            debates_pa_matches.append({
                "debate_id": debate.get("id"),
                "speaker": debate.get("speaker"),
                "pa_numbers": found_pa,
                "business_number": debate.get("business_number"),
                "match_type": "pa_number"
            })
    
    objects_pa_matches = []
    for obj in objects_data.get("items", []):
        # Ne pas inclure shortId pour éviter les faux positifs (25.8194 != PA 8194)
        text = f"{obj.get('title', '')} {obj.get('description', '')} {obj.get('text', '')}"
        found_pa = find_pa_in_text(text, all_pa_numbers)
        if found_pa:
            objects_pa_matches.append({
                "object_id": obj.get("shortId"),
                "title": obj.get("title"),
                "pa_numbers": found_pa,
                "match_type": "pa_number"
            })
    
    print(f"   → Débats: {len(debates_pa_matches)} | Objets: {len(objects_pa_matches)}")
    
    # === 2. MATCHING PAR MOTS-CLÉS (affiné) ===
    print("\n2. Matching par mots-clés (titre rapport vs texte débat)...")
    print("   Critères: ≥4 mots spécifiques + rapport 3 ans max avant débat")
    print("   Filtré: 51ème et 52ème législatures (débats >= 2019)")
    
    debates_keyword_matches = []
    matched_debate_ids = {m["debate_id"] for m in debates_pa_matches}
    
    for debate in debates_data.get("items", []):
        if debate.get("id") in matched_debate_ids:
            continue  # Déjà matché par PA
        
        # Filtrer: uniquement 51ème et 52ème législatures (>= décembre 2019)
        debate_date = debate.get("date")
        if debate_date and parse_date(debate_date) and parse_date(debate_date) < 20191202:
            continue
            
        debate_text = f"{debate.get('text', '')} {debate.get('business_title_fr', '')} {debate.get('business_title_de', '')}"
        debate_dept = debate.get("department", "")
        
        best_match = None
        best_score = 0
        
        for rapport in rapports:
            # 1. Vérifier la date (rapport publié AVANT le débat)
            if not is_rapport_before_debate(rapport.get("date"), debate_date):
                continue
            
            # 2. Matching par mots-clés bilingues : TITRE a plus de poids que contenu
            title_text = f"{rapport['title_de']} {rapport.get('title_fr', '')}"
            content_text = f"{rapport.get('content_de', '')} {rapport.get('content_fr', '')}"
            title_keywords = extract_keywords(title_text)
            content_keywords = extract_keywords(content_text)
            debate_keywords = extract_keywords(debate_text)
            
            # Mots du TITRE trouvés dans le débat (très important)
            title_matches = title_keywords & debate_keywords
            # Mots du contenu trouvés dans le débat (moins important)
            content_matches = content_keywords & debate_keywords
            
            office_in_text = match_office_in_text(rapport.get("office", ""), debate_text)
            
            # Au moins 2 mots du titre OU 4 mots du contenu OU office dans texte
            if len(title_matches) < 2 and len(content_matches) < 4 and not office_in_text:
                continue
            
            # 3. Bonus si même département
            same_dept = match_by_office(rapport.get("office", ""), debate_dept)
            
            # Score : titre x3 + contenu x1 + bonus département + bonus office
            score = len(title_matches) * 3 + len(content_matches) + (5 if same_dept else 0) + (8 if office_in_text else 0)
            common_words = title_matches | content_matches
            
            if score > best_score:
                best_score = score
                best_match = {
                    "debate_id": debate.get("id"),
                    "speaker": debate.get("speaker"),
                    "business_number": debate.get("business_number"),
                    "debate_date": str(debate_date),
                    "debate_dept": debate_dept,
                    "rapport_id": rapport["id"],
                    "rapport_title": rapport["title_de"],
                    "rapport_date": rapport.get("date", ""),
                    "rapport_office": rapport.get("office", ""),
                    "rapport_pa": rapport.get("pa_numbers", []),
                    "common_keywords": list(common_words),
                    "same_department": same_dept,
                    "office_in_text": office_in_text,
                    "score": score,
                    "match_type": "title" if len(title_matches) >= 2 else ("office" if office_in_text else "content")
                }
        
        if best_match:
            debates_keyword_matches.append(best_match)
            matched_debate_ids.add(debate.get("id"))
    
    # Trier par score décroissant
    debates_keyword_matches.sort(key=lambda x: x["score"], reverse=True)
    
    print(f"   → Débats: {len(debates_keyword_matches)}")
    print(f"   → Avec même département: {sum(1 for m in debates_keyword_matches if m['same_department'])}")
    
    # === 3. MATCHING PAR OFFICE/DÉPARTEMENT ===
    print("\n3. Matching par office/département...")
    debates_office_matches = []
    
    # Créer index rapport par office
    rapports_by_office = {}
    for r in rapports:
        office = r.get("office", "")
        if office:
            if office not in rapports_by_office:
                rapports_by_office[office] = []
            rapports_by_office[office].append(r)
    
    print(f"   Offices dans rapports: {list(rapports_by_office.keys())[:10]}...")
    
    # Compter débats par département
    dept_counts = {}
    for debate in debates_data.get("items", []):
        dept = debate.get("department", "")
        if dept:
            dept_counts[dept] = dept_counts.get(dept, 0) + 1
    
    print(f"   Départements dans débats: {dept_counts}")
    
    # Matching office <-> département
    office_dept_matches = {}
    for office, raps in rapports_by_office.items():
        for dept in dept_counts.keys():
            if match_by_office(office, dept):
                key = f"{office} <-> {dept}"
                office_dept_matches[key] = {
                    "office": office,
                    "department": dept,
                    "rapports_count": len(raps),
                    "debates_count": dept_counts[dept]
                }
    
    print(f"   Correspondances office/dept: {len(office_dept_matches)}")
    for k, v in office_dept_matches.items():
        print(f"      • {k}: {v['rapports_count']} rapports, {v['debates_count']} débats")
    
    return {
        "by_pa_number": {
            "debates": debates_pa_matches,
            "objects": objects_pa_matches
        },
        "by_keywords": {
            "debates": debates_keyword_matches
        },
        "by_office": office_dept_matches
    }

def main():
    # 1. Récupérer les rapports
    audits = fetch_all_audits()
    
    # 2. Extraire les données utiles
    rapports = [extract_rapport_data(a) for a in audits]
    
    # Filtrer ceux qui ont un numéro PA
    rapports_with_pa = [r for r in rapports if r["pa_numbers"]]
    print(f"Rapports avec numéro PA: {len(rapports_with_pa)}")
    
    # 3. Sauvegarder
    save_rapports(rapports)
    
    # 4. Faire le matching (avec les 3 méthodes)
    matches = match_rapports_with_data(rapports)
    
    # 5. Afficher les résultats
    print(f"\n" + "="*50)
    print(f"RÉSUMÉ DES CORRESPONDANCES")
    print(f"="*50)
    
    pa_debates = matches['by_pa_number']['debates']
    pa_objects = matches['by_pa_number']['objects']
    kw_debates = matches['by_keywords']['debates']
    
    print(f"\n1. PAR NUMÉRO PA:")
    print(f"   Débats: {len(pa_debates)}")
    print(f"   Objets: {len(pa_objects)}")
    
    print(f"\n2. PAR MOTS-CLÉS:")
    print(f"   Débats: {len(kw_debates)}")
    
    print(f"\n3. PAR OFFICE/DÉPARTEMENT:")
    print(f"   Correspondances trouvées: {len(matches['by_office'])}")
    
    # Exemples de matching par mots-clés (triés par score)
    if kw_debates:
        print(f"\n--- Top 15 matching mots-clés (par score) ---")
        for i, m in enumerate(kw_debates[:15]):
            dept_marker = "✓" if m.get('same_department') else " "
            print(f"\n  {i+1}. [{dept_marker}] Score {m['score']} | {m['speaker']} ({m['business_number']})")
            print(f"     Débat: {m['debate_date']} | Dept: {m['debate_dept']}")
            print(f"     Rapport: {m['rapport_title'][:60]}...")
            print(f"     Rapport date: {m['rapport_date']} | Office: {m['rapport_office']}")
            print(f"     Mots communs: {m['common_keywords']}")
    
    # Sauvegarder les matches
    with open("rapports_matches.json", "w", encoding="utf-8") as f:
        json.dump(matches, f, ensure_ascii=False, indent=2)
    print(f"\nFichier rapports_matches.json créé")

if __name__ == "__main__":
    main()
