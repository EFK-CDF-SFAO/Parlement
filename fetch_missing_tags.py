#!/usr/bin/env python3
"""
Script pour récupérer les domaines (tags) des objets parlementaires manquants
pour les débats qui référencent des objets non présents dans cdf_efk_data.json
"""

import json
import urllib.request
import urllib.parse
import time
from pathlib import Path

# Configuration
DEBATES_FILE = "debates_data.json"
OBJECTS_FILE = "cdf_efk_data.json"
OUTPUT_FILE = "missing_objects_tags.json"

API_BASE = "https://ws.parlament.ch/odata.svc"

def get_business_tags(business_number: str) -> dict:
    """Récupère les tags d'un objet parlementaire depuis l'API OData."""
    try:
        # Construire l'URL avec le bon format
        params = urllib.parse.urlencode({
            "$filter": f"BusinessShortNumber eq '{business_number}'",
            "$select": "BusinessShortNumber,TagNames",
            "$format": "json"
        })
        url = f"{API_BASE}/Business?{params}"
        
        req = urllib.request.Request(url)
        req.add_header('Accept', 'application/json')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
        
        results = data.get("d", {}).get("results", [])
        
        if results:
            return {
                "business_number": business_number,
                "tags": results[0].get("TagNames", ""),
                "found": True
            }
        else:
            return {
                "business_number": business_number,
                "tags": "",
                "found": False
            }
    except Exception as e:
        print(f"  Erreur pour {business_number}: {e}")
        return {
            "business_number": business_number,
            "tags": "",
            "found": False,
            "error": str(e)
        }

def main():
    # Charger les données existantes
    with open(DEBATES_FILE, "r", encoding="utf-8") as f:
        debates = json.load(f)
    
    with open(OBJECTS_FILE, "r", encoding="utf-8") as f:
        objects = json.load(f)
    
    # Créer le set des objets existants
    existing_ids = set(item["shortId"] for item in objects["items"] if item.get("shortId"))
    
    # Trouver les business_numbers manquants dans les débats
    missing_ids = set()
    for debate in debates["items"]:
        bn = debate.get("business_number")
        if bn and bn not in existing_ids:
            missing_ids.add(bn)
    
    print(f"Objets existants: {len(existing_ids)}")
    print(f"Objets manquants dans les débats: {len(missing_ids)}")
    
    # Charger le fichier de cache s'il existe
    cache = {}
    if Path(OUTPUT_FILE).exists():
        with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
            cache_data = json.load(f)
            cache = {item["business_number"]: item for item in cache_data.get("items", [])}
        print(f"Cache existant: {len(cache)} objets")
    
    # Récupérer les tags pour les objets manquants (non en cache)
    to_fetch = [bn for bn in sorted(missing_ids) if bn not in cache]
    print(f"À récupérer: {len(to_fetch)} objets")
    
    results = list(cache.values())
    
    for i, bn in enumerate(to_fetch):
        print(f"[{i+1}/{len(to_fetch)}] Récupération de {bn}...")
        result = get_business_tags(bn)
        results.append(result)
        
        # Pause pour ne pas surcharger l'API
        time.sleep(0.5)
        
        # Sauvegarder régulièrement
        if (i + 1) % 10 == 0:
            with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
                json.dump({"items": results}, f, ensure_ascii=False, indent=2)
            print(f"  Sauvegarde intermédiaire ({len(results)} objets)")
    
    # Sauvegarde finale
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"items": results}, f, ensure_ascii=False, indent=2)
    
    # Statistiques
    found = len([r for r in results if r.get("found")])
    with_tags = len([r for r in results if r.get("tags")])
    print(f"\nRésultats:")
    print(f"  Total: {len(results)}")
    print(f"  Trouvés: {found}")
    print(f"  Avec tags: {with_tags}")

if __name__ == "__main__":
    main()
