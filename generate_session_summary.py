#!/usr/bin/env python3
"""
Génère un résumé de session parlementaire via Gemini (3 langues).
À exécuter en fin de session pour générer le résumé LLM.

Usage:
    export GEMINI_API_KEY="votre-clé"
    python generate_session_summary.py [session_id]
    
Exemple:
    python generate_session_summary.py 2026-printemps
"""

import json
import os
import sys
import re
import time
from pathlib import Path
from datetime import datetime

try:
    import requests
except ImportError:
    print("❌ Module requests non installé. Exécute: pip install requests")
    sys.exit(1)


# Configuration Gemini
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_WORKER_URL = "https://gemini-proxy.cloudflare-resent579.workers.dev"

# Mapping des partis par langue
PARTY_NAMES = {
    'fr': {
        'V': 'UDC', 'S': 'PS', 'RL': 'PLR', 'M-E': 'Le Centre', 'pvl': 'Vert\'libéraux',
        'CE': 'Le Centre', 'C': 'Le Centre', 'BD': 'Le Centre', 'MCG': 'MCG',
        'G': 'VERT-E-S', 'GL': 'Vert\'libéraux', 'UDC': 'UDC', 'PS': 'PS',
        'PLR': 'PLR', 'Le Centre': 'Le Centre', 'VERT-E-S': 'VERT-E-S'
    },
    'de': {
        'V': 'SVP', 'S': 'SP', 'RL': 'FDP', 'M-E': 'Die Mitte', 'pvl': 'GLP',
        'CE': 'Die Mitte', 'C': 'Die Mitte', 'BD': 'Die Mitte', 'MCG': 'MCG',
        'G': 'Grüne', 'GL': 'GLP', 'UDC': 'SVP', 'PS': 'SP',
        'PLR': 'FDP', 'Le Centre': 'Die Mitte', 'VERT-E-S': 'Grüne'
    },
    'it': {
        'V': 'UDC', 'S': 'PS', 'RL': 'PLR', 'M-E': 'Alleanza del Centro', 'pvl': 'Verdi liberali',
        'CE': 'Alleanza del Centro', 'C': 'Alleanza del Centro', 'BD': 'Alleanza del Centro', 'MCG': 'MCG',
        'G': 'Verdi', 'GL': 'Verdi liberali', 'UDC': 'UDC', 'PS': 'PS',
        'PLR': 'PLR', 'Le Centre': 'Alleanza del Centro', 'VERT-E-S': 'Verdi'
    }
}

# Types d'objets par langue
TYPE_NAMES = {
    'fr': {'Mo.': 'motion', 'Po.': 'postulat', 'Ip.': 'interpellation', 'D.Ip.': 'interpellation urgente', 'Fra.': 'question', 'Iv. pa.': 'initiative parlementaire'},
    'de': {'Mo.': 'Motion', 'Po.': 'Postulat', 'Ip.': 'Interpellation', 'D.Ip.': 'Dringliche Interpellation', 'Fra.': 'Anfrage', 'Iv. pa.': 'Parlamentarische Initiative'},
    'it': {'Mo.': 'mozione', 'Po.': 'postulato', 'Ip.': 'interpellanza', 'D.Ip.': 'interpellanza urgente', 'Fra.': 'interrogazione', 'Iv. pa.': 'iniziativa parlamentare'}
}

# Prompts système par langue
SYSTEM_PROMPTS = {
    'fr': "Tu es un expert en politique suisse et en analyse parlementaire. Tu travailles pour le Contrôle fédéral des finances (CDF).",
    'de': "Du bist ein Experte für Schweizer Politik und parlamentarische Analyse. Du arbeitest für die Eidgenössische Finanzkontrolle (EFK).",
    'it': "Sei un esperto di politica svizzera e di analisi parlamentare. Lavori per il Controllo federale delle finanze (CDF)."
}

# Instructions par langue
THEMES_INSTRUCTIONS = {
    'fr': """En 2-3 phrases COURTES, décris les sujets principaux de ces interventions parlementaires.
Sois FACTUEL : cite uniquement ce qui est demandé dans les objets (les titres).
Pas d'interprétations, pas de conclusions générales.
Exemple de format attendu: "Les objets portent sur [sujet 1], [sujet 2] et [sujet 3]. Plusieurs parlementaires interrogent le Conseil fédéral sur [détail]."
STOP après 2-3 phrases.""",

    'de': """In 2-3 KURZEN Sätzen: Beschreibe die Hauptthemen dieser parlamentarischen Vorstösse.
SACHLICH: Nenne nur, was in den Titeln der Vorstösse steht.
Keine Interpretationen, keine allgemeinen Schlussfolgerungen.
Beispielformat: "Die Vorstösse betreffen [Thema 1], [Thema 2] und [Thema 3]. Mehrere Ratsmitglieder befragen den Bundesrat zu [Detail]."
STOP nach 2-3 Sätzen.""",

    'it': """In 2-3 BREVI frasi: Descrivi i temi principali di questi interventi parlamentari.
FATTUALE: Cita solo ciò che è indicato nei titoli degli atti.
Nessuna interpretazione, nessuna conclusione generale.
Formato di esempio: "Gli atti riguardano [tema 1], [tema 2] e [tema 3]. Diversi parlamentari interrogano il Consiglio federale su [dettaglio]."
STOP dopo 2-3 frasi."""
}


def load_json(path: Path) -> dict:
    """Charge un fichier JSON."""
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def save_json(path: Path, data: dict):
    """Sauvegarde un fichier JSON."""
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_party_name(party: str, lang: str) -> str:
    """Traduit le code parti dans la langue cible."""
    return PARTY_NAMES.get(lang, {}).get(party, party)


def get_type_name(type_code: str, lang: str) -> str:
    """Traduit le type d'objet dans la langue cible."""
    return TYPE_NAMES.get(lang, {}).get(type_code, type_code)


def format_date_fr(date_str: str) -> str:
    """Formate une date YYYY-MM-DD en 'D mois YYYY' selon la langue."""
    months_fr = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
    months_de = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
    months_it = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
                 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
    try:
        parts = date_str.split('-')
        day = int(parts[2])
        month_idx = int(parts[1]) - 1
        year = parts[0]
        return day, month_idx, year
    except Exception:
        return None, None, None


def build_factual_intro(session_summary: dict, lang: str) -> str:
    """Construit la phrase d'intro factuelle (chiffres, types, partis) sans LLM."""
    count = session_summary.get('count', 0)
    by_type = session_summary.get('by_type', {})
    by_council = session_summary.get('by_council', {})
    interventions = session_summary.get('interventions', {})
    session_start = session_summary.get('session_start', '')
    session_end = session_summary.get('session_end', '')
    
    # Dates formatées
    def fmt(date_str):
        try:
            d, m, y = date_str.split('-')[2], int(date_str.split('-')[1]) - 1, date_str.split('-')[0]
            months_fr = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
            months_de = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
            months_it = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre']
            if lang == 'de':
                return f"{int(d)}. {months_de[m]} {y}"
            elif lang == 'it':
                return f"{int(d)} {months_it[m]} {y}"
            else:
                return f"{int(d)} {months_fr[m]} {y}"
        except Exception:
            return date_str
    
    start_fmt = fmt(session_start)
    end_fmt = fmt(session_end)
    
    # Répartition par type
    type_parts = []
    type_order = ['Mo.', 'Po.', 'Ip.', 'D.Ip.', 'Fra.', 'Iv. pa.']
    for t in type_order:
        if by_type.get(t):
            n = by_type[t]
            name = get_type_name(t, lang)
            if lang == 'fr':
                plural = 's' if n > 1 and name not in ['motion', 'postulat'] else ('s' if n > 1 else '')
                if name == 'motion': plural = 's' if n > 1 else ''
                type_parts.append(f"{n} {name}{plural}")
            elif lang == 'de':
                plural_map = {'Motion': 'Motionen', 'Postulat': 'Postulate', 'Interpellation': 'Interpellationen',
                              'Dringliche Interpellation': 'Dringliche Interpellationen', 'Anfrage': 'Anfragen',
                              'Parlamentarische Initiative': 'Parlamentarische Initiativen'}
                type_parts.append(f"{n} {plural_map.get(name, name) if n > 1 else name}")
            else:
                type_parts.append(f"{n} {name}")
    
    # Conseil(s)
    cn = by_council.get('CN', 0)
    ce = by_council.get('CE', 0)
    
    # Partis actifs
    party_counts = {}
    for p in interventions.get('party', []):
        translated = get_party_name(p, lang)
        party_counts[translated] = party_counts.get(translated, 0) + 1
    sorted_parties = sorted(party_counts.items(), key=lambda x: (-x[1], x[0]))
    party_str = ', '.join(f"{p} ({c})" for p, c in sorted_parties)
    
    if lang == 'fr':
        council_str = 'au Conseil national' if not ce else f'au Conseil national ({cn}) et au Conseil des États ({ce})'
        intro = f"Durant la session du {start_fmt} au {end_fmt}, {count} interventions mentionnant le CDF ont été déposées {council_str}. "
        intro += f"Elles se répartissent en {', '.join(type_parts)}. "
        intro += f"Partis représentés : {party_str}."
    elif lang == 'de':
        council_str = 'im Nationalrat' if not ce else f'im Nationalrat ({cn}) und im Ständerat ({ce})'
        intro = f"In der Session vom {start_fmt} bis {end_fmt} wurden {count} Vorstösse mit EFK-Bezug {council_str} eingereicht. "
        intro += f"Darunter: {', '.join(type_parts)}. "
        intro += f"Vertretene Parteien: {party_str}."
    else:
        council_str = 'al Consiglio nazionale' if not ce else f'al Consiglio nazionale ({cn}) e al Consiglio degli Stati ({ce})'
        intro = f"Durante la sessione dal {start_fmt} al {end_fmt}, sono stati depositati {count} interventi riguardanti il CDF {council_str}. "
        intro += f"Ripartizione: {', '.join(type_parts)}. "
        intro += f"Partiti rappresentati: {party_str}."
    
    return intro


def build_themes_prompt(session_summary: dict, items: list, lang: str) -> str:
    """Construit le prompt pour demander à Gemini uniquement les thèmes."""
    interventions = session_summary.get('interventions', {})
    short_ids = interventions.get('shortId', [])
    
    objects_list = []
    for short_id in short_ids:
        item = next((it for it in items if it.get('shortId') == short_id), None)
        if not item:
            continue
        
        if lang == 'de':
            title = item.get('title_de') or item.get('title') or ''
        elif lang == 'it':
            title = item.get('title_it') or item.get('title') or ''
        else:
            title = item.get('title') or item.get('title_de') or ''
        
        # Fallback si titre manquant
        if not title or title.lower().strip() in ['titre suit', 'titel folgt', 'titolo segue']:
            title = item.get('title_de') or item.get('title') or item.get('title_it') or ''
        
        if title:
            objects_list.append(f"- {title}")
    
    return f"""{SYSTEM_PROMPTS[lang]}

Objets parlementaires mentionnant le CDF:
{chr(10).join(objects_list)}

{THEMES_INSTRUCTIONS[lang]}"""


def call_gemini(prompt: str, api_key: str = None) -> str:
    """Appelle l'API Gemini pour générer le résumé (via Worker ou API directe)."""
    
    headers = {
        'Content-Type': 'application/json'
    }
    
    body = {
        'contents': [{
            'parts': [{
                'text': prompt
            }]
        }],
        'generationConfig': {
            'temperature': 0.3,
            'maxOutputTokens': 2000,
            'responseMimeType': 'text/plain'
        }
    }
    
    # Utiliser le Worker Cloudflare si pas de clé API
    if api_key:
        url = f"{GEMINI_URL.format(model=GEMINI_MODEL)}?key={api_key}"
    else:
        url = GEMINI_WORKER_URL
    
    response = requests.post(url, headers=headers, json=body)
    
    if response.status_code != 200:
        raise Exception(f"Erreur API Gemini: {response.status_code} - {response.text}")
    
    data = response.json()
    
    if not data.get('candidates') or not data['candidates'][0].get('content'):
        raise Exception("Réponse Gemini invalide ou bloquée")
    
    parts = data['candidates'][0]['content']['parts']
    return parts[-1]['text'].strip()


def generate_summaries(session_id: str, api_key: str = None) -> dict:
    """Génère les résumés dans les 3 langues."""
    script_dir = Path(__file__).parent
    
    # Charger les données
    data_path = script_dir / 'cdf_efk_data.json'
    data = load_json(data_path)
    
    session_summary = data.get('session_summary', {})
    items = data.get('items', [])
    
    # Vérifier que c'est la bonne session
    current_session_id = session_summary.get('session_id', '')
    if session_id and current_session_id != session_id:
        print(f"⚠️  Session demandée: {session_id}, session dans les données: {current_session_id}")
        print("   Utilisation de la session courante dans les données.")
    
    summaries = {
        'session_id': current_session_id,
        'generated_at': datetime.now().isoformat(),
        'model': GEMINI_MODEL,
        'summaries': {}
    }
    
    for i, lang in enumerate(['fr', 'de', 'it']):
        if i > 0:
            time.sleep(2)
        print(f"🔄 Génération du résumé en {lang.upper()}...")
        
        # Partie factuelle construite en Python (garantie complète)
        factual_intro = build_factual_intro(session_summary, lang)
        
        # Partie thèmes générée par Gemini (prompt court = pas de troncature)
        themes_prompt = build_themes_prompt(session_summary, items, lang)
        
        try:
            themes_text = call_gemini(themes_prompt, api_key)
            full_summary = f"{factual_intro}\n\n{themes_text}"
            summaries['summaries'][lang] = full_summary
            print(f"✅ Résumé {lang.upper()} généré ({len(full_summary)} caractères)")
        except Exception as e:
            print(f"❌ Erreur pour {lang}: {e}")
            summaries['summaries'][lang] = factual_intro  # Fallback sans thèmes
    
    return summaries


def main():
    # Clé API optionnelle (utilise le Worker Cloudflare si non définie)
    api_key = os.environ.get('GEMINI_API_KEY')
    if api_key:
        print("🔑 Utilisation de la clé API Gemini")
    else:
        print("☁️  Utilisation du Worker Cloudflare (pas de clé API)")
    
    # Session ID optionnel
    session_id = sys.argv[1] if len(sys.argv) > 1 else None
    
    print("🚀 Génération des résumés de session via Gemini...")
    
    # Générer les résumés
    summaries = generate_summaries(session_id, api_key)
    
    # Sauvegarder
    script_dir = Path(__file__).parent
    output_path = script_dir / 'session_llm_summaries.json'
    
    # Charger les résumés existants s'ils existent
    if output_path.exists():
        existing = load_json(output_path)
    else:
        existing = {'sessions': {}}
    
    # Ajouter/remplacer le résumé de cette session
    existing['sessions'][summaries['session_id']] = {
        'generated_at': summaries['generated_at'],
        'model': summaries['model'],
        'fr': summaries['summaries'].get('fr'),
        'de': summaries['summaries'].get('de'),
        'it': summaries['summaries'].get('it')
    }
    
    save_json(output_path, existing)
    
    print(f"\n✅ Résumés sauvegardés dans {output_path.name}")
    
    # Afficher un aperçu
    print("\n" + "="*60)
    print("📋 APERÇU DU RÉSUMÉ (FR)")
    print("="*60)
    print(summaries['summaries'].get('fr', 'Erreur'))
    print("="*60)


if __name__ == "__main__":
    main()
