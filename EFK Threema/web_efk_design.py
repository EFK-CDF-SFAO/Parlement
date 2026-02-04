#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de scraping automatisé pour les rapports EFK/CDF
Version propre et fonctionnelle avec Selenium, Flask et Schedule.
"""

# =============================================================================
# SECTION 1: IMPORTS ET CONFIGURATION
# =============================================================================

import os
import sys
import json
import re
import time
import signal
import socket
import threading
import subprocess
from datetime import datetime
from urllib.parse import urljoin

# --- Installation des dépendances ---
REQUIREMENTS = [
    'flask', 'requests', 'beautifulsoup4', 'schedule', 'python-dotenv',
    'selenium', 'selenium-wire', 'webdriver-manager', 'blinker==1.7.0'
]

def check_and_install(packages):
    installed = subprocess.run([sys.executable, "-m", "pip", "freeze"], capture_output=True, text=True)
    installed_packages = installed.stdout.lower()
    for package in packages:
        try:
            # Gérer les cas où le nom pip et le nom d'import diffèrent
            package_name_for_check = re.split(r'[=<>]=?', package)[0].lower()

            if package_name_for_check in installed_packages:
                # Forcer la réinstallation si une version spécifique est demandée (pour blinker)
                if '==' in package:
                    print(f"📦 Vérification et forçage de la version pour {package}...")
                    subprocess.check_call([sys.executable, "-m", "pip", "install", "--force-reinstall", package])
                else:
                    print(f"✅ {package} est déjà installé.")
            else:
                print(f"📦 Installation de {package}...")
                subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        except (ImportError, ModuleNotFoundError):
            print(f"📦 Installation de {package}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", package])

check_and_install(REQUIREMENTS)

# --- Import des modules après vérification ---
try:
    from flask import Flask, request, jsonify, render_template_string
    import requests
    from bs4 import BeautifulSoup
    import schedule
    from dotenv import load_dotenv
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from seleniumwire import webdriver  # Remplacer l'import de selenium
    from webdriver_manager.chrome import ChromeDriverManager
    from selenium.webdriver.chrome.service import Service as ChromeService
except ImportError as e:
    print(f"❌ Erreur critique d'importation après installation: {e}")
    sys.exit(1)

# --- Configuration Globale ---
load_dotenv()

# Configuration de base
DEFAULT_PORT = 5003
MAX_PORT_ATTEMPTS = 10

# Configuration Threema
THREEMA_GATEWAY_ID = os.getenv('THREEMA_GATEWAY_ID', '*EFKCDF6')
THREEMA_GATEWAY_SECRET = os.getenv('THREEMA_GATEWAY_SECRET', '***REMOVED***')
THREEMA_API_URL = "https://msgapi.threema.ch/send_simple"
TEST_THREEMA_ID = os.getenv('TEST_THREEMA_ID', 'P5R6NT4X')

# URLs de scraping
SCRAPING_URLS = {
    "fr": "https://www.efk.admin.ch/fr/rapports/",
    "de": "https://www.efk.admin.ch/de/berichte/",
    "it": "https://www.efk.admin.ch/it/rapporti/",
}

# Initialisation de l'application Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'a-very-secret-key')


# =============================================================================
# SECTION 2: FONCTIONS UTILITAIRES (HELPERS)
# =============================================================================

def send_threema_message(to_id, message):
    """Envoie un message via l'API Threema Gateway."""
    try:
        response = requests.post(
            THREEMA_API_URL,
            data={'from': THREEMA_GATEWAY_ID, 'to': to_id, 'secret': THREEMA_GATEWAY_SECRET, 'text': message},
            timeout=10
        )
        if response.status_code == 200:
            return {"status": "success", "message_id": response.text.strip()}
        return {"status": "error", "code": response.status_code, "message": response.text}
    except requests.RequestException as e:
        return {"status": "error", "message": str(e)}

def load_reports(language):
    """Charge les rapports existants depuis un fichier JSON."""
    filename = f'reports_{language}.json'
    if not os.path.exists(filename):
        return []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"⚠️ Erreur lors du chargement de {filename}: {e}")
        return []

def save_reports(reports, language):
    """Sauvegarde les rapports dans un fichier JSON."""
    try:
        with open(f'reports_{language}.json', 'w', encoding='utf-8') as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"❌ Erreur lors de la sauvegarde des rapports {language.upper()}: {e}")
        return False

def clean_title(title):
    """Nettoie une chaîne de titre."""
    return ' '.join(title.split()).strip()

def extract_report_number(url, text):
    """Extrait un numéro de rapport (ex: 4-5 chiffres) de l'URL ou du texte."""
    match = re.search(r'(?:/|\D)(\d{4,5})(?:\D|$)', url + " " + text)
    return match.group(1) if match else str(abs(hash(url)))[:8]

def determine_category(text, language):
    """Détermine la catégorie d'un rapport à partir de mots-clés."""
    # ... (logique de catégorisation inchangée)
    return 'Non classé'


# =============================================================================
# SECTION 3: LOGIQUE DE SCRAPING
# =============================================================================

def scrape_reports_from_page(url, language):
    """Utilise Selenium pour scraper les rapports d'une page donnée."""
    print(f"[Scraping] Démarrage pour {language.upper()} sur {url}")
    driver = None
    try:
        options = Options()
        options.add_argument("--headless") # Exécuter en arrière-plan
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36")
        
        # Utiliser selenium-wire avec webdriver-manager
        service = ChromeService(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)

        # Intercepter les requêtes pour modifier les en-têtes et supprimer les traces de Selenium
        def interceptor(request):
            # Supprimer l'en-tête "sec-ch-ua" qui peut trahir l'automatisation
            if 'sec-ch-ua' in request.headers:
                del request.headers['sec-ch-ua']
            # Mettre à jour d'autres en-têtes pour paraître plus humain
            request.headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
            request.headers['Accept-Language'] = 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'

        driver.request_interceptor = interceptor

        # Script pour supprimer la variable navigator.webdriver
        driver.execute_cdp_cmd(
            'Page.addScriptToEvaluateOnNewDocument',
            {
                'source': 'Object.defineProperty(navigator, \'webdriver\', {get: () => undefined})'
            }
        )

        driver.get(url)
        try:
            # Attendre que le bouton d'acceptation des cookies soit cliquable et le cliquer
            cookie_accept_button = WebDriverWait(driver, 10).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, "a.cn-set-cookie[data-cookie-set='accept']"))
            )
            cookie_accept_button.click()
            print("[Scraping] Bannière de cookies acceptée.")
            # Attendre un court instant que la bannière disparaisse
            time.sleep(1)
        except Exception:
            # Si le bouton n'est pas trouvé, on continue (il n'est peut-être pas là)
            print("[Scraping] Pas de bannière de cookies trouvée, on continue.")

        # Attendre que la section des résultats de recherche soit chargée
        wait = WebDriverWait(driver, 20)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#search-results")))
        print(f"[Scraping] Page {url} chargée et l'élément #search-results a été trouvé.")

        # Sauvegarder le contenu de la page pour le débogage si nécessaire
        # debug_filename = f"debug_page_{language}.html"
        # with open(debug_filename, "w", encoding="utf-8") as f:
        #     f.write(driver.page_source)
        # print(f"[Scraping] Code source de la page sauvegardé dans {debug_filename}")

        soup = BeautifulSoup(driver.page_source, 'html.parser')
        search_results_container = soup.select_one("#search-results")
        if not search_results_container:
            print(f"[Scraping] L'élément #search-results n'a pas été trouvé dans le HTML de {url}.")
            return []

        links = search_results_container.find_all('a', href=True)
        print(f"[Scraping] {len(links)} liens trouvés dans #search-results.")

        report_patterns = {'de': ['/prufung/'], 'fr': ['/audit/'], 'it': ['/verifica/']}
        keywords = {'de': ['bericht'], 'fr': ['rapport'], 'it': ['rapporto']}
        exclude_patterns = ['.pdf', 'mailto:', 'tel:', '#', 'javascript:']
        
        found_reports = []
        for link in links:
            href = link.get('href', '')
            
            # Cibler l'élément de titre spécifique pour un texte plus propre
            title_element = link.find('div', class_='audit-card__title')
            text = clean_title(title_element.get_text()) if title_element else ''

            if not href or not text or any(ex in href.lower() for ex in exclude_patterns):
                continue

            full_url = urljoin(url, href)
            score = 0
            if any(p in full_url for p in report_patterns.get(language, [])): score += 2
            if any(k in text.lower() for k in keywords.get(language, [])): score += 1
            if re.search(r'\d{4,}', text): score += 1 # Contient un nombre (potentiellement une année ou un numéro)

            # --- DÉBUT MODIFICATION DEBUG --- 
            # Pour le français, on accepte tous les rapports pour le débogage
            # On logue aussi les détails pour voir ce qui est extrait
            if language == 'fr':
                print(f"[Debug FR] Lien trouvé: URL='{full_url}', Texte='{text}', Score={score}")

            if score >= 2 or language == 'fr':
            # --- FIN MODIFICATION DEBUG ---
                report_number = extract_report_number(full_url, text)
                unique_id = f"{language}_{report_number}"
                
                if not any(r['id'] == unique_id for r in found_reports):
                    found_reports.append({
                        'id': unique_id,
                        'title': text,
                        'category': determine_category(text, language),
                        'number': report_number,
                        'publication_date': datetime.now().strftime('%d.%m.%Y'),
                        'url': full_url,
                        'language': language,
                        'scraped_at': datetime.now().isoformat()
                    })
        
        print(f"[Scraping] {len(found_reports)} rapports potentiels identifiés.")
        return found_reports

    except Exception as e:
        print(f"❌ Erreur majeure dans scrape_reports_from_page: {e}")
        return [] # Retourner une liste vide en cas d'erreur
    finally:
        if driver:
            driver.quit()

def run_full_scrape_cycle():
    """Orchestre le cycle complet: scrape, compare, sauvegarde, et notifie."""
    print(f"\n{'='*25}\n CYCLE DE SCRAPING DÉMARRÉ - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*25}")
    new_reports_details = []
    
    for lang, url in SCRAPING_URLS.items():
        
        print(f"\n--- Traitement de la langue: {lang.upper()} ---")
        existing_reports = load_reports(lang)
        existing_ids = {r['id'] for r in existing_reports}
        
        current_reports = scrape_reports_from_page(url, lang)
        if not current_reports:
            print("Aucun rapport trouvé, passage au suivant.")
            continue

        new_reports = [r for r in current_reports if r['id'] not in existing_ids]
        
        if new_reports:
            print(f"✨ {len(new_reports)} NOUVEAU(X) rapport(s) trouvé(s) pour {lang.upper()}!")
            all_reports = existing_reports + new_reports
            save_reports(all_reports, lang)
            for report in new_reports:
                new_reports_details.append(f"- [{lang.upper()}] {report['title']}\n  {report['url']}")
        else:
            print("✅ Pas de nouveaux rapports.")

    if new_reports_details:
        print("\n✉️ Envoi de la notification Threema...")
        message = "Nouveaux rapports du CDF:\n\n" + "\n".join(new_reports_details)
        send_threema_message(TEST_THREEMA_ID, message)
    
    print(f"\n{'='*25}\n CYCLE DE SCRAPING TERMINÉ - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n{'='*25}")


# =============================================================================
# SECTION 4: PLANIFICATEUR (SCHEDULER)
# =============================================================================

def run_scheduler():
    """Lance la tâche de scraping à intervalle régulier."""
    print("⏰ Planificateur configuré pour s'exécuter toutes les 4 heures.")
    schedule.every(4).hours.do(run_full_scrape_cycle)
    # Lancer un premier cycle au démarrage
    run_full_scrape_cycle()
    while True:
        schedule.run_pending()
        time.sleep(60)


# =============================================================================
# SECTION 5: ROUTES FLASK
# =============================================================================

@app.route('/')
def index():
    """Page d'accueil et de statut."""
    return render_template_string("""
        <!DOCTYPE html><html><head><title>EFK/CDF Scraper</title></head>
        <body><h1>Scraper EFK/CDF Actif</h1><p>Le service est en cours d'exécution.</p>
        <a href="/scrape-now">Lancer un cycle de scraping manuel</a>
        </body></html>
    """)

@app.route('/scrape-now')
def trigger_scrape_now():
    """Déclenche manuellement un cycle de scraping."""
    threading.Thread(target=run_full_scrape_cycle).start()
    return jsonify({"status": "success", "message": "Cycle de scraping manuel démarré en arrière-plan."})

@app.route('/test-threema')
def test_threema_route():
    """Envoie un message de test Threema."""
    result = send_threema_message(TEST_THREEMA_ID, f"Message de test du scraper à {datetime.now()}.")
    return jsonify(result)


# =============================================================================
# SECTION 6: DÉMARRAGE DE L'APPLICATION
# =============================================================================

def find_free_port(start_port, max_attempts):
    """Trouve un port TCP libre en incrémentant depuis un port de départ."""
    for i in range(max_attempts):
        port = start_port + i
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('localhost', port)) != 0:
                return port
    return None

if __name__ == '__main__':
    # Démarrer le planificateur dans un thread séparé
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()

    # Démarrer le serveur Flask
    port = find_free_port(DEFAULT_PORT, MAX_PORT_ATTEMPTS)
    if port:
        print(f"🚀 Démarrage du serveur Flask sur http://localhost:{port}")
        # Utiliser 'waitress' ou 'gunicorn' pour la production
        app.run(host='0.0.0.0', port=port, debug=False)
    else:
        print(f"❌ Aucun port libre trouvé entre {DEFAULT_PORT} et {DEFAULT_PORT + MAX_PORT_ATTEMPTS}. Arrêt.")
        sys.exit(1)
