#!/usr/bin/env python3
"""
Prototype: Résumé des débats parlementaires via OpenAI API
Branche: feature/llm-summary

Usage:
    export OPENAI_API_KEY="sk-..."
    python summarize_debates.py 22.3877
"""

import json
import os
import sys
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("❌ Module openai non installé. Exécute: pip install openai")
    sys.exit(1)


def load_debates(json_path: Path) -> list:
    """Charge les débats depuis le fichier JSON."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("items", [])


def filter_debates_by_object(debates: list, business_number: str) -> list:
    """Filtre les débats pour un objet parlementaire donné."""
    return [d for d in debates if d.get("business_number") == business_number]


def build_prompt(debates: list, business_number: str) -> str:
    """Construit le prompt pour le LLM."""
    if not debates:
        return ""
    
    # Récupérer le titre de l'objet (prendre le premier disponible)
    title_fr = debates[0].get("business_title_fr", "")
    title_de = debates[0].get("business_title_de", "")
    title = title_fr or title_de
    
    # Trier par date
    sorted_debates = sorted(debates, key=lambda x: x.get("date", ""))
    
    # Construire les interventions
    interventions = []
    for d in sorted_debates:
        speaker = d.get("speaker", "Inconnu")
        party = d.get("party", "")
        canton = d.get("canton", "")
        date = d.get("date", "")
        text = d.get("text", "")
        council = d.get("council", "")
        
        # Formater la date
        if len(date) == 8:
            date_fmt = f"{date[6:8]}.{date[4:6]}.{date[0:4]}"
        else:
            date_fmt = date
        
        # Conseil
        council_name = {"N": "Conseil national", "S": "Conseil des États", "V": "Assemblée fédérale"}.get(council, council)
        
        # Parti
        party_name = {
            "V": "UDC", "S": "PS", "RL": "PLR", "M-E": "Le Centre",
            "CE": "Le Centre", "C": "Le Centre", "G": "VERT-E-S", "GL": "Vert'libéraux"
        }.get(party, party or "Conseil fédéral")
        
        interventions.append(f"""
### {speaker} ({party_name}, {canton}) - {date_fmt} ({council_name})
{text}
""")
    
    prompt = f"""Tu es un assistant spécialisé dans l'analyse des débats parlementaires suisses.

Résume les débats suivants sur l'objet **{business_number}**: "{title}"

## Interventions ({len(debates)} au total):
{"".join(interventions)}

## Instructions:
1. Résume les positions principales exprimées par chaque parti/orateur
2. Identifie les points de consensus et les divergences
3. Mentionne le contexte (quel conseil, quelle période)
4. Si pertinent, indique les arguments clés pour/contre
5. Rédige en français, de manière concise (max 400 mots)
6. Structure ta réponse avec des sous-titres clairs

## Résumé:
"""
    return prompt


def summarize_with_openai(prompt: str, api_key: str) -> str:
    """Appelle l'API OpenAI pour générer le résumé."""
    client = OpenAI(api_key=api_key)
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",  # Moins cher, suffisant pour les résumés
        messages=[
            {"role": "system", "content": "Tu es un expert en politique suisse et en analyse parlementaire."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=1000,
        temperature=0.3  # Plus déterministe pour les résumés factuels
    )
    
    return response.choices[0].message.content


def main():
    if len(sys.argv) < 2:
        print("Usage: python summarize_debates.py <business_number>")
        print("Exemple: python summarize_debates.py 22.3877")
        sys.exit(1)
    
    business_number = sys.argv[1]
    
    # Vérifier la clé API
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("❌ Variable d'environnement OPENAI_API_KEY non définie")
        print("   export OPENAI_API_KEY='sk-...'")
        sys.exit(1)
    
    # Charger les débats
    script_dir = Path(__file__).parent
    json_path = script_dir.parent / "debates_data.json"
    
    if not json_path.exists():
        print(f"❌ Fichier non trouvé: {json_path}")
        sys.exit(1)
    
    print(f"📂 Chargement des débats depuis {json_path.name}...")
    debates = load_debates(json_path)
    print(f"   {len(debates)} débats au total")
    
    # Filtrer par objet
    filtered = filter_debates_by_object(debates, business_number)
    if not filtered:
        print(f"❌ Aucun débat trouvé pour l'objet {business_number}")
        print("\n💡 Objets disponibles (exemples):")
        sample_objects = list(set(d.get("business_number") for d in debates[:20] if d.get("business_number")))
        for obj in sample_objects[:10]:
            print(f"   - {obj}")
        sys.exit(1)
    
    print(f"✅ {len(filtered)} intervention(s) trouvée(s) pour {business_number}")
    
    # Construire le prompt
    prompt = build_prompt(filtered, business_number)
    
    # Afficher les stats
    token_estimate = len(prompt) // 4  # Estimation grossière
    print(f"📝 Prompt: ~{token_estimate} tokens estimés")
    
    # Appeler l'API
    print(f"🤖 Appel à OpenAI (gpt-4o-mini)...")
    try:
        summary = summarize_with_openai(prompt, api_key)
        print("\n" + "="*60)
        print(f"📋 RÉSUMÉ - Objet {business_number}")
        print("="*60)
        print(summary)
        print("="*60)
    except Exception as e:
        print(f"❌ Erreur API: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
