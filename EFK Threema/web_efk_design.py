#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script de scraping automatisé pour les rapports EFK/CDF
Version améliorée avec gestion des ports et meilleure structure
"""

# =============================================================================
# IMPORTS ET CONFIGURATION
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
from datetime import datetime, timedelta
from functools import wraps

# Configuration de base
DEFAULT_PORT = 5003
MAX_PORT_ATTEMPTS = 10

# Installation et import des dépendances obligatoires
REQUIREMENTS = [
    'flask',
    'requests',
    'beautifulsoup4',
    'schedule',
    'python-dotenv'
]

print("🔍 Vérification des dépendances...")
for package in REQUIREMENTS:
    try:
        __import__(package.split('==')[0])
        print(f"✅ {package} est déjà installé")
    except ImportError:
        print(f"📦 Installation de {package}...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])

# Import des modules après installation
try:
    from flask import Flask, request, jsonify, render_template_string
    import requests
    from bs4 import BeautifulSoup
    import schedule
    from dotenv import load_dotenv
    
    # Charger les variables d'environnement
    load_dotenv()
    
    # Configuration Threema
    THREEMA_GATEWAY_ID = os.getenv('THREEMA_GATEWAY_ID', '*EFKCDF6')
    THREEMA_GATEWAY_SECRET = os.getenv('THREEMA_GATEWAY_SECRET', '***REMOVED***')
    THREEMA_API_URL = "https://msgapi.threema.ch/send_simple"
    TEST_THREEMA_ID = os.getenv('TEST_THREEMA_ID', 'P5R6NT4X')
    
    print("✅ Tous les modules nécessaires sont disponibles")
    
except Exception as e:
    print(f"❌ Erreur d'importation: {e}")
    sys.exit(1)

# Initialisation de l'application Flask
app = Flask(__name__)

# Configuration de l'application
app.config.update(
    SECRET_KEY=os.getenv('FLASK_SECRET_KEY', 'dev-key-change-in-production'),
    PORT=DEFAULT_PORT,
    DEBUG=True,
    TESTING=False
)

# Configuration du planificateur
SCHEDULER_AVAILABLE = 'schedule' in globals()

# Installation et import des modules de scraping
try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPING_AVAILABLE = True
    print("✅ Modules de scraping disponibles")
except ImportError:
    print("📦 Installation des modules de scraping...")
    try:
        import subprocess
        import sys
        subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "beautifulsoup4"])
        import requests
        from bs4 import BeautifulSoup
        SCRAPING_AVAILABLE = True
        print("✅ Modules de scraping installés avec succès")
    except Exception as e:
        print(f"❌ Impossible d'installer les modules de scraping: {e}")
        print("📦 Installer manuellement avec: pip install requests beautifulsoup4")
        SCRAPING_AVAILABLE = False

app = Flask(__name__)

# Configuration Threema
THREEMA_GATEWAY_ID = "*EFKCDF6"
THREEMA_GATEWAY_SECRET = "***REMOVED***"
THREEMA_API_URL = "https://msgapi.threema.ch/send_simple"
TEST_THREEMA_ID = "P5R6NT4X"

def send_threema_message(to_id, message):
    try:
        data = {
            'from': THREEMA_GATEWAY_ID,
            'to': to_id,
            'secret': THREEMA_GATEWAY_SECRET,
            'text': message
        }
        response = requests.post(THREEMA_API_URL, data=data, timeout=10)
        if response.status_code == 200:
            return {"status": "success", "message_id": response.text.strip()}
        else:
            return {"status": "error", "message": response.text}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def load_reports(language):
    """Charge les rapports existants pour une langue donnée"""
    try:
        filename = f'reports_{language}.json'
        if os.path.exists(filename):
            with open(filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []
    except Exception as e:
        print(f"❌ Erreur lors du chargement des rapports {language.upper()}: {e}")
        return []

def save_reports(reports, language):
    """Sauvegarde les rapports pour une langue donnée"""
    try:
        filename = f'reports_{language}.json'
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(reports, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"❌ Erreur lors de la sauvegarde des rapports {language.upper()}: {e}")
        return False

def scrape_efk_reports_fr():
    """Scraper pour les rapports en français"""
    return scrape_efk_reports_by_lang('fr')

def scrape_efk_reports_de():
    """Scraper pour les rapports en allemand"""
    return scrape_efk_reports_by_lang('de')

def scrape_efk_reports_it():
    """Scraper pour les rapports en italien"""
    return scrape_efk_reports_by_lang('it')

def scrape_efk_reports_by_lang(language):
    """Scraper pour une langue spécifique"""
    if not SCRAPING_AVAILABLE:
        print(f"❌ Modules de scraping non disponibles pour {language.upper()}")
        return []
    
    urls = {
        'fr': 'https://www.efk.admin.ch/fr/audit/',
        'de': 'https://www.efk.admin.ch/prufung/',
        'it': 'https://www.efk.admin.ch/it/verifica/'
    }
    
    url = urls.get(language, urls['fr'])  # Par défaut sur français
    
    try:
        print(f"🔍 Scraping des rapports en {language.upper()} depuis {url}")
        reports = scrape_reports_from_page(url, language)
        print(f"✅ {language.upper()}: {len(reports)} rapports trouvés")
        return reports
    except Exception as e:
        print(f"❌ Erreur lors du scraping {language.upper()}: {e}")
        import traceback
        traceback.print_exc()
        return []

def scrape_efk_reports():
    """Scraper principal pour détecter les nouveaux rapports EFK/CDF"""
    if not SCRAPING_AVAILABLE:
        print("❌ Modules de scraping non disponibles")
        return {'fr': [], 'de': [], 'it': []}
    
    print("🔍 Scraping RÉEL des nouveaux rapports EFK/CDF...")
    
    all_reports = {
        'fr': scrape_efk_reports_fr(),
        'de': scrape_efk_reports_de(),
        'it': scrape_efk_reports_it()
    }
    
    # Afficher un résumé
    for lang, reports in all_reports.items():
        print(f"📊 {lang.upper()}: {len(reports)} rapports trouvés")
        for i, report in enumerate(reports[:3], 1):  # Afficher les 3 premiers rapports
            print(f"   {i}. {report.get('title', 'Sans titre')[:60]}...")
        if len(reports) > 3:
            print(f"   ...et {len(reports) - 3} autres")
    
    total_reports = sum(len(reports) for reports in all_reports.values())
    print(f"🎯 Total final: {total_reports} rapports")
    
    return all_reports

def scrape_reports_from_page(url, language):
    """Scraper amélioré avec détection robuste des rapports"""
    print(f"🔍 Début du scraping pour {language.upper()} depuis {url}")
    reports = []
    
    try:
        # Configuration des headers pour ressembler à un vrai navigateur
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': f'{language}-CH,{language};q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://www.efk.admin.ch/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Cache-Control': 'max-age=0',
            'Pragma': 'no-cache'
        }
        
        print(f"   🌐 Connexion au scraping réel: {url}")
        
        # Essayer plusieurs stratégies de connexion
        response = None
        session = requests.Session()
        session.headers.update(headers)
        
        for attempt in range(2):
            try:
                if attempt == 0:
                    # Première tentative : connexion normale
                    response = session.get(url, timeout=15, allow_redirects=True, verify=True)
                else:
                    # Deuxième tentative : avec délai et headers différents
                    time.sleep(2)
                    headers['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    response = session.get(url, timeout=20, allow_redirects=True)
                
                response.raise_for_status()
                print(f"   ✅ Connexion réussie (tentative {attempt + 1})")
                break
                
            except requests.exceptions.RequestException as e:
                print(f"   ⚠️  Tentative {attempt + 1} échouée: {e}")
                if attempt == 1:
                    print(f"   ❌ Toutes les tentatives ont échoué pour {url}")
                    return []
        
        if not response:
            print(f"   ❌ Impossible de se connecter à {url}")
            return []
        
        print(f"   ✅ Réponse reçue ({response.status_code}), taille: {len(response.content)} bytes")
        
        # NOUVEAU : Debug du contenu reçu
        content_preview = response.text[:500]
        print(f"   📄 Aperçu du contenu reçu:")
        print(f"      {content_preview}")
        
        # Vérifier si on a été redirigé
        if response.url != url:
            print(f"   🔄 Redirection détectée: {response.url}")
        
        # Vérifier si c'est une page d'erreur ou vide
        if len(response.content) < 1000:
            print(f"   ⚠️  Contenu très court ({len(response.content)} bytes) - possiblement une page d'erreur")
            
            # Essayer des URLs alternatives
            alternative_urls = get_alternative_urls(url, language)
            
            for alt_url in alternative_urls:
                print(f"   🔄 Essai URL alternative: {alt_url}")
                try:
                    alt_response = session.get(alt_url, timeout=15, allow_redirects=True)
                    if alt_response.status_code == 200 and len(alt_response.content) > 1000:
                        print(f"      ✅ URL alternative fonctionne: {len(alt_response.content)} bytes")
                        response = alt_response
                        url = alt_url
                        break
                    else:
                        print(f"      ❌ URL alternative échoue: {alt_response.status_code}")
                except:
                    print(f"      ❌ Erreur sur URL alternative")
                    continue
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Debug : afficher le titre de la page
        page_title = soup.find('title')
        if page_title:
            print(f"   📄 Titre de la page: {page_title.get_text().strip()}")
        
        print(f"   🔍 Scraping RÉEL de la page {language.upper()}...")
        
        # Chercher TOUS les liens sur la page
        all_links = soup.find_all('a', href=True)
        print(f"   🔗 {len(all_links)} liens trouvés au total")
        
        # Debug : afficher les premiers liens
        if len(all_links) > 0:
            print(f"   🔍 Premiers liens trouvés:")
            for i, link in enumerate(all_links[:5]):
                href = link.get('href', '')
                text = link.get_text(strip=True)[:50]
                print(f"      {i+1}. {href} → {text}")
        else:
            print(f"   ❌ Aucun lien trouvé - vérifiez si la page utilise JavaScript")
            
            # Chercher des indices de chargement JavaScript
            scripts = soup.find_all('script')
            if scripts:
                print(f"   📜 {len(scripts)} scripts trouvés - la page peut charger du contenu dynamiquement")
        
        # Patterns améliorés pour détecter les rapports selon la langue
        report_patterns = {
            'de': ['/prufung/', '/berichte/', '/bericht/', 'efk.admin.ch/prufung/'],
            'fr': ['/audit/', '/rapports/', '/rapport/', 'efk.admin.ch/audit/'],
            'it': ['/verifica/', '/rapporti/', '/rapporto/', 'efk.admin.ch/verifica/']
        }
        
        # Mots-clés à rechercher dans les liens et textes
        keywords = {
            'de': ['prüfung', 'bericht', 'evaluation', 'untersuchung', 'analyse', 'kontrolle'],
            'fr': ['audit', 'rapport', 'évaluation', 'enquête', 'analyse', 'contrôle'],
            'it': ['verifica', 'rapporto', 'valutazione', 'inchiesta', 'analisi', 'controllo']
        }
        
        # Patterns à exclure (plus restrictifs)
        exclude_patterns = [
            '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx',
            'mailto:', 'tel:', '#', 'javascript:', '?', 'feed', 'rss', 'atom',
            '/kontakt', '/contact', '/impressum', '/mentions', '/sitemap', '/newsletter',
            '/suche', '/recherche', '/cerca', '/cookies', '/datenschutz', '/privacy',
            '/legal', '/rechtliches', '/disclaimer', '/conditions', '/conditions-utilisation',
            '/accessibilite', '/barrierefreiheit', '/accessibilita', '/login', '/signin',
            '/register', '/abonnement', '/abonnieren', '/newsletter', '/rss', '/feed',
            '/print', '/pdf', '/download', '/media/', '/files/', '/document/', '/doc/',
            '/wp-', '/admin', '/backend', '/api/', '/rest/', '/xmlrpc.php', '/wp-login.php'
        ]
        
        potential_reports = []
        patterns = report_patterns.get(language, ['/audit/'])
        lang_keywords = keywords.get(language, [])
        
        print(f"   🔍 Analyse des liens avec {len(patterns)} motifs et {len(lang_keywords)} mots-clés...")
        
        # D'abord, essayer de trouver la section des rapports
        report_sections = soup.find_all(['section', 'div', 'article'], class_=re.compile(r'(report|audit|bericht|rapport|publication|news)', re.I))
        
        # Si on a trouvé des sections de rapports, on les utilise
        links_to_check = []
        if report_sections:
            print(f"   📚 {len(report_sections)} sections de rapports trouvées")
            for section in report_sections:
                links_to_check.extend(section.find_all('a', href=True))
        else:
            print("   ℹ️  Aucune section de rapports spécifique trouvée, analyse complète de la page")
            links_to_check = all_links
        
        print(f"   🔗 Vérification de {len(links_to_check)} liens potentiels...")
        
        for link in links_to_check:
            try:
                href = link.get('href', '').strip()
                text = link.get_text(' ', strip=True)
                
                # Ignorer les liens vides ou trop courts
                if not href or len(href) < 5:
                    continue
                
                # Construire l'URL complète si nécessaire
                if href.startswith('/'):
                    full_url = f"https://www.efk.admin.ch{href}"
                elif href.startswith('https://www.efk.admin.ch'):
                    full_url = href
                else:
                    continue  # Ignorer les liens externes
                
                # Ignorer les extensions de fichiers non pertinentes
                if any(full_url.lower().endswith(ext) for ext in ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx']):
                    continue
                
                # Vérifier si c'est un lien vers un rapport
                is_report_link = False
                score = 0
                
                # 1. Vérifier par l'URL (pattern principal)
                for pattern in patterns:
                    if pattern.lower() in full_url.lower():
                        score += 2  # Forte probabilité si le motif est dans l'URL
                
                # 2. Vérifier les mots-clés dans l'URL
                url_lower = full_url.lower()
                for keyword in lang_keywords:
                    if keyword in url_lower:
                        score += 1
                
                # 3. Vérifier les mots-clés dans le texte du lien
                text_lower = text.lower()
                for keyword in lang_keywords:
                    if keyword in text_lower:
                        score += 1
                
                # 4. Vérifier la structure du texte (doit ressembler à un titre de rapport)
                if len(text) >= 15 and len(text) < 150:  # Longueur raisonnable pour un titre
                    score += 1
                
                # 5. Vérifier la présence d'une date dans le texte ou à proximité
                date_patterns = [
                    r'\d{1,2}\.\d{1,2}\.\d{2,4}',  # DD.MM.YYYY
                    r'\d{1,2}/\d{1,2}/\d{2,4}',     # DD/MM/YYYY
                    r'\d{4}-\d{1,2}-\d{1,2}',       # YYYY-MM-DD
                ]
                
                # Vérifier dans le texte du lien
                if any(re.search(p, text) for p in date_patterns):
                    score += 1
                
                # Vérifier dans le texte environnant (parent ou éléments frères)
                parent_text = ' '.join(link.parent.get_text(' ', strip=True).split())
                if any(re.search(p, parent_text) for p in date_patterns):
                    score += 1
                
                # 6. Exclure les liens non pertinents
                if any(exclude in full_url.lower() for exclude in exclude_patterns):
                    score = 0
                
                # 7. Exclure les liens de navigation
                nav_keywords = ['navigation', 'menu', 'home', 'accueil', 'startseite', 'haut de page', 'top of page']
                if any(nav in text_lower for nav in nav_keywords):
                    score = 0
                
                # 8. Vérifier si le lien est dans un menu de navigation
                parent_classes = ' '.join(link.parent.get('class', []))
                if any(nav in parent_classes.lower() for nav in ['nav', 'menu', 'footer']):
                    score = max(0, score - 1)  # Réduire le score mais ne pas exclure complètement
                
                # Si le score est suffisamment élevé, c'est probablement un rapport
                if score >= 2:
                    # Vérifier si ce n'est pas un doublon
                    is_duplicate = any(p[0] == full_url for p in potential_reports)
                    if not is_duplicate:
                        print(f"      ✅ Lien détecté (score: {score}): {text[:60]}...")
                        potential_reports.append((full_url, text, href))
            
            except Exception as e:
                print(f"      ⚠️  Erreur analyse lien: {e}")
                continue
        
        print(f"   📋 {len(potential_reports)} liens potentiels de rapports détectés")
        
        # Debug : afficher les liens détectés
        if potential_reports:
            print(f"   🎯 Liens de rapports détectés:")
            for i, (url, text, href) in enumerate(potential_reports[:3]):
                print(f"      {i+1}. {text[:50]}... → {href}")
        
        # Limiter le nombre de rapports à traiter pour éviter la surcharge
        max_reports = 30
        print(f"\n🔍 Traitement des {min(len(potential_reports), max_reports)} premiers rapports potentiels...")
        
        for i, (full_url, text, href) in enumerate(potential_reports[:max_reports]):
            try:
                print(f"\n      🔍 Analyse du rapport #{i+1}: {text[:60]}...")
                
                # Nettoyer le texte
                text = text.strip()
                text_lower = text.lower()
                
                # 1. Filtrage navigation strict
                navigation_words = {
                    'fr': ['retour', 'précédent', 'haut de page', 'menu', 'accueil', 'recherche'],
                    'de': ['zurück', 'vorherige', 'seitenanfang', 'menü', 'startseite', 'suche'],
                    'it': ['indietro', 'precedente', 'inizio pagina', 'menu', 'home', 'ricerca']
                }
                
                is_navigation = any(
                    nav_word in text_lower 
                    for nav_word in navigation_words.get(language, []) + 
                                  navigation_words['fr'] + 
                                  navigation_words['de'] + 
                                  navigation_words['it']
                )
                
                if is_navigation:
                    print(f"      🚫 EXCLU - Lien de navigation détecté")
                    continue
                
                # 2. Vérifier longueur minimum et maximum
                if len(text) < 30:
                    print(f"      🚫 EXCLU - Titre trop court ({len(text)} caractères)")
                    continue
                    
                if len(text) > 200:
                    print(f"      🚫 EXCLU - Titre trop long ({len(text)} caractères)")
                    continue
                
                # 3. Vérifier que ce n'est pas un titre générique
                generic_words = {
                    'fr': ['publications', 'rapports', 'tous les rapports', 'archives', 'recherche', 'contact'],
                    'de': ['publikationen', 'berichte', 'alle berichte', 'archive', 'suche', 'kontakt'],
                    'it': ['pubblicazioni', 'rapporti', 'tutti i rapporti', 'archivio', 'ricerca', 'contatto']
                }
                
                if any(gen.lower() == text_lower for gen in generic_words.get(language, []) + 
                                                             generic_words['fr'] + 
                                                             generic_words['de'] + 
                                                             generic_words['it']):
                    print(f"      🚫 EXCLU - Titre générique")
                    continue
                
                # 4. Vérifier si c'est une page de catégorie plutôt qu'un rapport
                category_indicators = {
                    'fr': ['tous les', 'catégorie', 'thème', 'par date', 'par thème'],
                    'de': ['alle', 'kategorie', 'thema', 'nach datum', 'nach thema'],
                    'it': ['tutti', 'categoria', 'tema', 'per data', 'per tema']
                }
                
                if any(indicator in text_lower for indicator in category_indicators.get(language, [])):
                    print(f"      🚫 EXCLU - Page de catégorie détectée")
                    continue
                
                print(f"      ✅ RAPPORT VALIDÉ: '{text[:60]}...'")
                
                # 5. Extraire les métadonnées du rapport
                print(f"         🔗 URL: {full_url}")
                
                # Extraire un numéro de rapport
                report_number = extract_report_number(full_url, text)
                print(f"         # Numéro: {report_number}")
                
                # Déterminer la catégorie
                category = determine_category(text, language)
                print(f"         📂 Catégorie: {category}")
                
                # Essayer d'extraire la date de publication depuis la page
                publication_date = None
                try:
                    # Essayer de trouver la date dans la page
                    response = requests.get(full_url, headers=headers, timeout=15)
                    if response.status_code == 200:
                        page_soup = BeautifulSoup(response.content, 'html.parser')
                        
                        # Chercher des balises meta de date
                        for meta in page_soup.find_all('meta'):
                            if any(attr in str(meta.get('property', '')).lower() for attr in ['date', 'pubdate', 'pub']):
                                publication_date = meta.get('content', '')
                                break
                        
                        # Si pas trouvé dans les meta, chercher dans le contenu
                        if not publication_date:
                            date_elements = page_soup.find_all(['time', 'span', 'div'], 
                                                             class_=re.compile(r'(date|publi|published|updated)', re.I))
                            for elem in date_elements:
                                if re.search(r'\d{1,2}[\./]\d{1,2}[\./]\d{2,4}', elem.get_text()):
                                    publication_date = elem.get_text().strip()
                                    break
                except Exception as e:
                    print(f"         ⚠️  Impossible d'extraire la date: {e}")
                
                # Utiliser la date actuelle si aucune date n'a été trouvée
                if not publication_date:
                    publication_date = datetime.now().strftime('%d.%m.%Y')
                    print(f"         📅 Date (par défaut): {publication_date}")
                else:
                    print(f"         📅 Date extraite: {publication_date}")
                
                # Créer un ID unique basé sur l'URL et la langue
                import hashlib
                unique_id = f"{language}_{report_number}"
                
                # Créer les données du rapport
                report_data = {
                    'id': unique_id,
                    'title': clean_title(text),
                    'category': category,
                    'number': report_number,
                    'report_date': publication_date,
                    'publication_date': publication_date,
                    'url': full_url,
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'language': language,
                    'source': 'EFK/CDF',
                    'scraped_at': datetime.now().isoformat()
                }
                
                # Vérifier les doublons avant d'ajouter
                is_duplicate = any(
                    r.get('id') == report_data['id'] or 
                    (r.get('url') == report_data['url'] and r.get('language') == report_data['language'])
                    for r in reports
                )
                
                if not is_duplicate:
                    reports.append(report_data)
                    print(f"         ✅ Rapport ajouté: #{report_number} - {text[:40]}...")
                else:
                    print(f"         ⏭️  Doublon ignoré: {text[:40]}...")
                
            except Exception as e:
                print(f"      ❌ Erreur lors du traitement du rapport: {e}")
                import traceback
                traceback.print_exc()
                continue
        
        print(f"   📊 SCRAPING RÉEL terminé pour {language.upper()}: {len(reports)} rapports trouvés")
        
        return reports
        
    except Exception as e:
        print(f"   ❌ Erreur critique scraping {url}: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_alternative_urls(original_url, language):
    """Obtenir des URLs alternatives pour le scraping"""
    alternatives = {
        'de': [
            'https://www.efk.admin.ch/de/prufung/',
            'https://www.efk.admin.ch/de/berichte/',
            'https://www.efk.admin.ch/de/',
        ],
        'fr': [
            'https://www.efk.admin.ch/fr/publications/',
            'https://www.efk.admin.ch/fr/rapports/',
            'https://www.efk.admin.ch/fr/',
        ],
        'it': [
            'https://www.efk.admin.ch/it/pubblicazioni/',
            'https://www.efk.admin.ch/it/rapporti/',
            'https://www.efk.admin.ch/it/',
        ]
    }
    
    return alternatives.get(language, [])

def get_known_reports_for_language(language):
    """Retourner les rapports connus pour une langue spécifique"""
    known_reports = {
        'de': [
            {
                'id': f'de_25101_{int(datetime.now().timestamp())}',
                'title': 'Schweizerische Post AG: Umsetzung wesentlicher Empfehlungen zum Risikomanagement über die Tochtergesellschaften',
                'category': 'Wirtschaft und Unternehmen',
                'number': '25101',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/prufung/schweizerische-post-ag-umsetzung-wesentlicher-empfehlungen-zum-risikomanagement-ueber-die-tochtergesellschaften/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'de'
            },
            {
                'id': f'de_25102_{int(datetime.now().timestamp())}',
                'title': 'Projektfortschritt beim Ausbau der A1 zwischen Le Vengeron und Nyon',
                'category': 'Verkehr und Infrastruktur',
                'number': '25102',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/prufung/projektfortschritt-beim-ausbau-der-a1-zwischen-le-vengeron-und-nyon/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'de'
            }
        ],
        'fr': [
            {
                'id': f'fr_25101_{int(datetime.now().timestamp())}',
                'title': 'La Poste suisse SA : mise en œuvre des principales recommandations relatives à la gestion des risques concernant les filiales',
                'category': 'Économie et entreprises',
                'number': '25101',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/fr/audit/la-poste-suisse-sa-mise-en-oeuvre-des-principales-recommandations-relatives-a-la-gestion-des-risques-concernant-les-filiales/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'fr'
            },
            {
                'id': f'fr_25102_{int(datetime.now().timestamp())}',
                'title': 'Avancement du projet d\'aménagement de l\'A1 entre Le Vengeron et Nyon',
                'category': 'Transports et infrastructure',
                'number': '25102',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/fr/audit/avancement-du-projet-d-amenagement-de-l-a1-entre-le-vengeron-et-nyon/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'fr'
            }
        ],
        'it': [
            {
                'id': f'it_25101_{int(datetime.now().timestamp())}',
                'title': 'La Posta Svizzera SA: attuazione delle principali raccomandazioni relative alla gestione dei rischi riguardanti le filiali',
                'category': 'Economia e imprese',
                'number': '25101',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/it/verifica/la-posta-svizzera-sa-attuazione-delle-principali-raccomandazioni-relative-alla-gestione-dei-rischi-riguardanti-le-filiali/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'it'
            },
            {
                'id': f'it_25102_{int(datetime.now().timestamp())}',
                'title': 'Progressi del progetto di ampliamento dell\'A1 tra Le Vengeron e Nyon',
                'category': 'Trasporti e infrastrutture',
                'number': '25102',
                'report_date': datetime.now().strftime('%d.%m.%Y'),
                'publication_date': datetime.now().strftime('%d.%m.%Y'),
                'url': 'https://www.efk.admin.ch/it/verifica/progressi-del-progetto-di-ampliamento-dell-a1-tra-le-vengeron-e-nyon/',
                'date': datetime.now().strftime('%Y-%m-%d'),
                'language': 'it'
            }
        ]
    }
    
    return known_reports.get(language, [])

def get_specific_test_reports(language):
    """Retourner des rapports de test spécifiques quand la connexion échoue"""
    print(f"   📋 Génération de rapports de test pour {language.upper()}")
    return get_known_reports_for_language(language)

def extract_report_number(url, title):
    """
    Extrait un numéro de rapport d'une URL ou d'un titre.
    
    Args:
        url (str): L'URL de la page du rapport
        title (str): Le titre du rapport
        
    Returns:
        str: Le numéro de rapport extrait ou un identifiant unique généré
    """
    import re
    
    # 1. Essayer d'extraire depuis l'URL (priorité la plus élevée)
    
    # Format: /fr/audit/2023/1234-titre/ ou /prufung/2023/1234-titre/
    match = re.search(r'/(\d{3,})[-/]', url)
    if match:
        return match.group(1)
    
    # Format: /fr/audit/2023/rapport-1234-titre/ ou /prufung/2023/bericht-1234-titel/
    for prefix in ['rapport', 'bericht', 'report', 'rapporto', 'verifica', 'audit', 'prufung']:
        match = re.search(fr'{prefix}[-_](\d{{3,}})', url.lower())
        if match:
            return match.group(1)
    
    # Format: /fr/audit/2023/ABC-1234-titre/ (avec préfixe alphabétique)
    match = re.search(r'/([A-Za-z]{2,}[-_])?(\d{3,})[-/]', url)
    if match:
        return match.group(2) if match.group(2) else match.group(1)
    
    # 2. Essayer d'extraire depuis le titre
    
    # Format: "Rapport 1234: Titre du rapport"
    for prefix in ['rapport', 'bericht', 'report', 'rapporto', 'verifica']:
        match = re.search(fr'{prefix}[\s:]+(\d{{3,}})', title.lower())
        if match:
            return match.group(1)
    
    # Format: "[1234] Titre du rapport" ou "(1234) Titre du rapport"
    for pattern in [r'\[(\d{3,})\]', r'\((\d{3,})\)']:
        match = re.search(pattern, title)
        if match:
            return match.group(1)
    
    # Format: "Titre du rapport (No 1234)" ou "Titre (Nr. 1234)"
    for pattern in [r'\([nN][o°º]\s*(\d{3,})\)', 
                   r'\([nN]r[.:]?\s*(\d{3,})\)',
                   r'\b(?:ref|reference|référence)[.:]?\s*(\d{3,})\b']:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            return match.group(1) if match.lastindex == 1 else match.group(2)
    
    # 3. Essayer de trouver une séquence de 3+ chiffres consécutifs
    match = re.search(r'\b(\d{3,})\b', url + ' ' + title)
    if match:
        return match.group(1)
    
    # 4. Si aucun numéro n'est trouvé, générer un identifiant unique
    import hashlib
    from datetime import datetime
    
    # Créer un hash basé sur l'URL et la date actuelle
    unique_str = f"{url}_{datetime.now().strftime('%Y%m%d')}"
    url_hash = hashlib.md5(unique_str.encode()).hexdigest()[:8].upper()
    
    # Extraire les premières lettres significatives du titre pour l'identifiant
    words = re.findall(r'\b\w{3,}\b', title)
    prefix = ''.join(word[0].upper() for word in words[:3]) if words else 'RPT'
    
    return f"{prefix}-{url_hash}"

def clean_title(title, language='fr'):
    """
    Nettoie et formate un titre de rapport.
    
    Args:
        title (str): Le titre à nettoyer
        language (str): Code de langue ('fr', 'de', 'it')
        
    Returns:
        str: Le titre nettoyé et formaté
    """
    if not title or not isinstance(title, str):
        return ""
    
    # Dictionnaire de remplacements spécifiques par langue
    replacements = {
        'fr': {
            r'\s*:\s*': ' : ',  # Espaces autour des deux-points
            r'\s*;\s*': ' ; ',   # Espaces autour des points-virgules
            r'\s*\?\s*': ' ? ',  # Espaces autour des points d'interrogation
            r'\s*!\s*': ' ! ',    # Espaces autour des points d'exclamation
            r'\s*»\s*': ' »',     # Espaces avant les guillemets fermants
            r'\s*«\s*': '« ',     # Espaces après les guillemets ouvrants
            r'\s*%': '%',         # Pas d'espace avant le signe pourcent
            r'\s*€\s*': ' €',    # Espace avant le symbole euro, pas après
            r'\s*\$\s*': ' $',   # Espace avant le symbole dollar, pas après
            r'\s*°\s*': '°',      # Pas d'espace autour du symbole degré
        },
        'de': {
            r'\s*:\s*': ': ',     # Espace après les deux-points
            r'\s*;\s*': '; ',     # Espace après les points-virgules
            r'\s*\?\s*': '? ',   # Espace après les points d'interrogation
            r'\s*!\s*': '! ',     # Espace après les points d'exclamation
            r'„\s*': '„',          # Pas d'espace après le guillemet ouvrant allemand
            r'\s*"': '"',         # Pas d'espace avant le guillemet fermant
            r'\s*%': ' %',         # Espace avant le signe pourcent
            r'\s*€\s*': ' €',     # Espace avant le symbole euro, pas après
            r'\s*\$\s*': ' $',   # Espace avant le symbole dollar, pas après
            r'\s*°\s*': '°',      # Pas d'espace autour du symbole degré
        },
        'it': {
            r'\s*:\s*': ': ',     # Espace après les deux-points
            r'\s*;\s*': '; ',     # Espace après les points-virgules
            r'\s*\?\s*': '? ',   # Espace après les points d'interrogation
            r'\s*!\s*': '! ',     # Espace après les points d'exclamation
            r'«\s*': '«',          # Pas d'espace après le guillemet ouvrant
            r'\s*»': '»',          # Pas d'espace avant le guillemet fermant
            r'\s*%': ' %',         # Espace avant le signe pourcent
            r'\s*€\s*': ' €',     # Espace avant le symbole euro, pas après
            r'\s*\$\s*': ' $',   # Espace avant le symbole dollar, pas après
            r'\s*°\s*': '°',      # Pas d'espace autour du symbole degré
        }
    }
    
    # Remplacer les séquences d'espaces par un seul espace
    title = ' '.join(title.split())
    
    # Appliquer les remplacements spécifiques à la langue
    lang_replacements = replacements.get(language, replacements['fr'])
    for pattern, replacement in lang_replacements.items():
        title = re.sub(pattern, replacement, title)
    
    # Remplacer les espaces insécables par des espaces normaux
    title = title.replace('\xa0', ' ').replace('\u202f', ' ')
    
    # Supprimer les espaces multiples consécutifs
    title = ' '.join(title.split())
    
    # Nettoyer les espaces autour des tirets
    title = re.sub(r'\s*-\s*', '-', title)  # Pas d'espace autour des tirets
    
    # Gérer les apostrophes (espace avant sauf après une lettre)
    title = re.sub(r"(\w)'(\w)", r"\1'\2", title)  # Pas d'espace à l'intérieur des mots
    
    # Mettre en majuscule la première lettre du titre
    if title:
        # Vérifier si le titre commence par un guillemet
        if title[0] in ['"', '«', '»', '„', '“'] and len(title) > 1:
            title = title[0] + title[1].upper() + title[2:]
        else:
            title = title[0].upper() + title[1:]
    
    # Supprimer les espaces en début et fin de chaîne
    title = title.strip()
    
    # Gérer la ponctuation finale
    if title:
        # Supprimer les points multiples à la fin
        title = re.sub(r'[.]+$', '', title)
        
        # Ajouter un point à la fin si nécessaire (sauf si le titre se termine par une ponctuation forte)
        if not re.search(r'[.!?»"'']$', title):
            title += '.'
    
    # Remplacer les guillemets droits par des guillemets français si nécessaire
    if language == 'fr':
        title = re.sub(r'"([^"]+)"', r'«\1»', title)
    
    return title

def determine_category(title, url=None, language='fr'):
    """
    Détermine la catégorie d'un rapport basée sur son titre et son URL.
    
    Args:
        title (str): Le titre du rapport
        url (str, optional): L'URL du rapport pour une meilleure détection
        language (str): Code de langue ('fr', 'de', 'it')
        
    Returns:
        str: La catégorie déterminée
    """
    if not title:
        return 'divers'
        
    title_lower = title.lower()
    url_lower = (url or '').lower()
    
    # Dictionnaire des catégories avec leurs mots-clés par langue
    categories = {
        'finances': {
            'fr': ['financ', 'budg', 'compte', 'dépense', 'recette', 'dette', 'déficit', 'fiscal', 'impôt', 'taxe'],
            'de': ['finanz', 'haushalt', 'konto', 'ausgabe', 'einnahme', 'schuld', 'defizit', 'steuer', 'abgabe'],
            'it': ['finanz', 'bilancio', 'conto', 'spesa', 'entrata', 'debito', 'deficit', 'fiscale', 'tassa']
        },
        'sécurité': {
            'fr': ['sécurit', 'police', 'gendarmerie', 'armée', 'défense', 'terroris', 'sûreté', 'criminalité', 'délinquance'],
            'de': ['sicherheit', 'polizei', 'gendarmerie', 'armee', 'verteidigung', 'terror', 'kriminalität'],
            'it': ['sicurezza', 'polizia', 'esercito', 'difesa', 'terrorismo', 'criminalità']
        },
        'santé': {
            'fr': ['santé', 'hôpital', 'médecin', 'soin', 'maladie', 'médical', 'pharmacie', 'assurance maladie'],
            'de': ['gesundheit', 'krankenhaus', 'arzt', 'pflege', 'krankheit', 'medizin', 'apotheke', 'krankenkasse'],
            'it': ['salute', 'ospedale', 'medico', 'cura', 'malattia', 'medico', 'farmacia', 'assicurazione malattia']
        },
        'éducation': {
            'fr': ['éducation', 'école', 'université', 'formation', 'enseignement', 'élève', 'étudiant', 'professeur'],
            'de': ['bildung', 'schule', 'universität', 'ausbildung', 'unterricht', 'schüler', 'student', 'lehrer'],
            'it': ['istruzione', 'scuola', 'università', 'formazione', 'insegnamento', 'studente', 'professore']
        },
        'transport': {
            'fr': ['transport', 'route', 'train', 'avion', 'métro', 'tram', 'bus', 'véhicule', 'autoroute'],
            'de': ['verkehr', 'straße', 'zug', 'flugzeug', 'u-bahn', 'tram', 'bus', 'fahrzeug', 'autobahn'],
            'it': ['trasporto', 'strada', 'treno', 'aereo', 'metropolitana', 'tram', 'autobus', 'veicolo', 'autostrada']
        },
        'environnement': {
            'fr': ['environnement', 'climat', 'pollution', 'énergie', 'déchet', 'biodiversité', 'nature'],
            'de': ['umwelt', 'klima', 'verschmutzung', 'energie', 'abfall', 'biodiversität', 'natur'],
            'it': ['ambiente', 'clima', 'inquinamento', 'energia', 'rifiuti', 'biodiversità', 'natura']
        },
        'administration': {
            'fr': ['administration', 'fonction publique', 'service public', 'état', 'gouvernement', 'collectivité'],
            'de': ['verwaltung', 'öffentlicher dienst', 'staat', 'regierung', 'gemeinde'],
            'it': ['amministrazione', 'pubblica amministrazione', 'stato', 'governo', 'comune']
        },
        'social': {
            'fr': ['social', 'famille', 'personnes âgées', 'handicap', 'insertion', 'pauvreté', 'logement'],
            'de': ['sozial', 'familie', 'senioren', 'behinderung', 'integration', 'armut', 'wohnung'],
            'it': ['sociale', 'famiglia', 'anziani', 'disabilità', 'inclusione', 'povertà', 'alloggio']
        },
        'culture': {
            'fr': ['culture', 'patrimoine', 'musée', 'théâtre', 'cinéma', 'art', 'bibliothèque', 'archive'],
            'de': ['kultur', 'kulturerbe', 'museum', 'theater', 'kino', 'kunst', 'bibliothek', 'archiv'],
            'it': ['cultura', 'patrimonio', 'museo', 'teatro', 'cinema', 'arte', 'biblioteca', 'archivio']
        },
        'économie': {
            'fr': ['économie', 'entreprise', 'emploi', 'chômage', 'industrie', 'commerce', 'croissance', 'pib'],
            'de': ['wirtschaft', 'unternehmen', 'beschäftigung', 'arbeitslosigkeit', 'industrie', 'handel', 'wachstum', 'bip'],
            'it': ['economia', 'impresa', 'occupazione', 'disoccupazione', 'industria', 'commercio', 'crescita', 'pil']
        }
    }
    
    # Vérifier d'abord l'URL si elle est fournie
    if url_lower:
        # Détection par chemin d'URL
        url_parts = url_lower.split('/')
        
        # Mappage des chemins d'URL vers les catégories
        url_category_mapping = {
            'finances': ['finances', 'finanzen', 'finanze', 'budget', 'haushalt', 'bilancio'],
            'sécurité': ['securite', 'sicherheit', 'sicurezza', 'police', 'polizei', 'polizia'],
            'santé': ['sante', 'gesundheit', 'salute', 'hopitaux', 'krankenhaus', 'ospedali'],
            'éducation': ['education', 'bildung', 'istruzione', 'ecoles', 'schulen', 'scuole'],
            'transport': ['transport', 'verkehr', 'trasporti', 'routes', 'strassen', 'strade']
        }
        
        for category, keywords in url_category_mapping.items():
            if any(keyword in url_parts for keyword in keywords):
                return category
    
    # Vérifier chaque catégorie dans le titre
    for category, keywords in categories.items():
        # Vérifier les mots-clés dans la langue spécifiée
        if any(keyword in title_lower for keyword in keywords.get(language, [])):
            return category
        
        # Vérifier également dans les autres langues (au cas où)
        for lang in ['fr', 'de', 'it']:
            if lang != language and any(keyword in title_lower for keyword in keywords.get(lang, [])):
                return category
    
    # Essayer de détecter des numéros de loi ou de rapport spécifiques
    if re.search(r'\b(?:loi|ordonnance|décret|message)\s+[A-Z0-9\.\-]+', title, re.IGNORECASE):
        return 'législation'
    
    if re.search(r'\b(?:rapport|bericht|report)\s+[A-Z0-9\.\-]+', title, re.IGNORECASE):
        return 'rapport officiel'
    
    # Catégorie par défaut si aucune correspondance
    return 'divers'

def check_for_real_new_reports():
    """Vérifier s'il y a de vrais nouveaux rapports (maintenant avec scraping réel)"""
    print("🔍 Vérification de nouveaux rapports avec scraping réel...")
    return scrape_efk_reports()

def sort_reports_by_date(reports):
    """Trier les rapports par date de publication (plus récent en premier)"""
    try:
        def parse_date(date_str):
            """Convertir une date DD.MM.YYYY en objet datetime pour le tri"""
            try:
                return datetime.strptime(date_str, '%d.%m.%Y')
            except:
                # Si la date ne peut pas être parsée, utiliser une date par défaut
                return datetime(1900, 1, 1)
        
        # Trier par date de publication (plus récent en premier)
        sorted_reports = sorted(
            reports, 
            key=lambda r: parse_date(r.get('publication_date', '01.01.1900')), 
            reverse=True
        )
        
        return sorted_reports
        
    except Exception as e:
        print(f"❌ Erreur tri par date: {e}")
        return reports  # Retourner les rapports non triés en cas d'erreur

def load_efk_data():
    try:
        # Charger les nouveaux rapports
        if os.path.exists("data/new_reports.json"):
            with open("data/new_reports.json", "r", encoding="utf-8") as f:
                new_reports = json.load(f)
        else:
            new_reports = get_test_reports()
        
        # Trier les nouveaux rapports par date (plus récent en premier)
        for lang in ['fr', 'de', 'it']:
            new_reports[lang] = sort_reports_by_date(new_reports.get(lang, []))
        
        # Charger les archives
        if os.path.exists("data/archived_reports.json"):
            with open("data/archived_reports.json", "r", encoding="utf-8") as f:
                archived_reports = json.load(f)
                # Nettoyer les rapports de test indésirables (inclut déjà le tri par date)
                archived_reports = clean_test_reports(archived_reports)
        else:
            archived_reports = {'fr': [], 'de': [], 'it': []}
            
        return new_reports, archived_reports
    except Exception as e:
        print(f"❌ Erreur chargement: {e}")
        return get_test_reports(), {'fr': [], 'de': [], 'it': []}

def save_reports_data(new_reports, archived_reports):
    """Sauvegarder les données de rapports"""
    try:
        os.makedirs("data", exist_ok=True)
        
        with open("data/new_reports.json", "w", encoding="utf-8") as f:
            json.dump(new_reports, f, ensure_ascii=False, indent=2)
            
        with open("data/archived_reports.json", "w", encoding="utf-8") as f:
            json.dump(archived_reports, f, ensure_ascii=False, indent=2)
            
        return True
    except Exception as e:
        print(f"❌ Erreur sauvegarde: {e}")
        return False

    for report_number, reports_by_lang in existing_reports.items():
        # Pour chaque rapport, vérifier si on a des traductions manquantes
        for lang in ['fr', 'de', 'it']:
            if lang not in reports_by_lang:
                # Essayer de trouver une traduction dans les nouveaux rapports
                for other_lang in ['fr', 'de', 'it']:
                    if other_lang in reports_by_lang and other_lang != lang:
                        # Créer une version traduite du rapport
                        translated_report = reports_by_lang[other_lang].copy()
                        translated_report['language'] = lang
                        translated_report['id'] = f"{lang}_{report_number}"
                        translated_report['title'] = f"[Traduction] {translated_report['title']}"
                        
                        # Ajouter le rapport traduit
                        truly_new[lang].append(translated_report)
                        break
    
    return truly_new

def generate_url_from_title(title, language):
    """Générer une URL à partir du titre en traitant les deux-points comme des espaces"""
    # Remplacer les deux-points par des espaces
    clean_title = title.replace(':', ' ')
    
    # Enlever les guillemets et autres caractères spéciaux
    clean_title = clean_title.replace('«', '').replace('»', '').replace('"', '').replace('"', '').replace('"', '')
    clean_title = clean_title.replace('\'', '').replace(''', '').replace(''', '')
    
    # Convertir en minuscules et remplacer les espaces par des tirets
    url_slug = clean_title.lower().strip()
    url_slug = '-'.join(url_slug.split())  # Remplace tous les espaces multiples par un seul tiret
    
    # Remplacer les caractères spéciaux
    url_slug = url_slug.replace('à', 'a').replace('é', 'e').replace('è', 'e').replace('ê', 'e')
    url_slug = url_slug.replace('ç', 'c').replace('ù', 'u').replace('ü', 'u').replace('ö', 'o')
    url_slug = url_slug.replace('ä', 'a').replace('ß', 'ss')
    
    # Construire l'URL selon la langue
    if language == 'de':
        return f'https://www.efk.admin.ch/prufung/{url_slug}/'
    elif language == 'fr':
        return f'https://www.efk.admin.ch/fr/audit/{url_slug}/'
    elif language == 'it':
        return f'https://www.efk.admin.ch/it/verifica/{url_slug}/'
    
    return ''

def fix_archived_urls(archived_reports):
    """Corriger les URLs des rapports archivés avec la bonne structure"""
    
    # Mapping des corrections d'URLs et titres basé sur les numéros de rapports
    corrections = {
        # Rapport #24420
        'fr_24420': {
            'url': 'https://www.efk.admin.ch/fr/audit/lutte-contre-la-dissemination-des-maladies-et-des-ravageurs-des-vegetaux/',
            'title': 'Lutte contre la dissémination des maladies et des ravageurs des végétaux'
        },
        'de_24420': {
            'url': 'https://www.efk.admin.ch/prufung/bekaempfung-der-verbreitung-von-pflanzenkrankheiten-und-schaedlingen/',
            'title': 'Bekämpfung der Verbreitung von Pflanzenkrankheiten und -schädlingen'
        },
        'it_24420': {
            'url': 'https://www.efk.admin.ch/it/verifica/lotta-contro-la-diffusione-di-malattie-e-parassiti-delle-piante/',
            'title': 'Lotta contro la diffusione di malattie e parassiti delle piante'
        },
        
        # Rapport #24706
        'fr_24706': {
            'url': 'https://www.efk.admin.ch/fr/audit/audit-de-la-chaussee-roulante/',
            'title': 'Audit de la « chaussée roulante »'
        },
        'de_24706': {
            'url': 'https://www.efk.admin.ch/prufung/pruefung-der-rollenden-landstrasse/',
            'title': 'Prüfung der «Rollenden Landstrasse»'
        },
        'it_24706': {
            'url': 'https://www.efk.admin.ch/it/verifica/verifica-della-strada-viaggiante/',
            'title': 'Verifica della "strada viaggiante"'
        },
        
        # Rapport #24526 - Avec titres complets incluant la partie après les deux-points
        'fr_24526': {
            'url': 'https://www.efk.admin.ch/fr/audit/separation-des-taches-entre-la-confederation-et-les-cantons-guide-sur-les-rapports-pertinents-du-cdf/',
            'title': 'Séparation des tâches entre la Confédération et les cantons : guide sur les rapports pertinents du CDF'
        },
        'de_24526': {
            'url': 'https://www.efk.admin.ch/prufung/aufgabenentflechtung-zwischen-bund-und-kantonen-orientierungshilfe-zu-relevanten-efk-berichten/',
            'title': 'Aufgabenentflechtung zwischen Bund und Kantonen: Orientierungshilfe zu relevanten EFK-Berichten'
        },
        'it_24526': {
            'url': 'https://www.efk.admin.ch/it/verifica/separazione-dei-compiti-tra-confederazione-e-cantoni-guida-ai-rapporti-pertinenti-del-cdf/',
            'title': 'Separazione dei compiti tra Confederazione e Cantoni: guida ai rapporti pertinenti del CDF'
        },
    }
    
    fixed_reports = {'fr': [], 'de': [], 'it': []}
    
    for lang in ['fr', 'de', 'it']:
        for report in archived_reports.get(lang, []):
            # Créer une copie du rapport
            fixed_report = report.copy()
            
            # Corriger l'URL et le titre si on a une correction pour ce rapport
            report_key = f"{lang}_{report.get('number', report.get('id', '').split('_')[-1])}"
            
            if report_key in corrections:
                fixed_report['url'] = corrections[report_key]['url']
                fixed_report['title'] = corrections[report_key]['title']
                print(f"🔗 URL et titre corrigés pour {report_key}")
                print(f"   URL: {corrections[report_key]['url']}")
                print(f"   Titre: {corrections[report_key]['title']}")
            
            fixed_reports[lang].append(fixed_report)
    
    return fixed_reports

def clean_test_reports(archived_reports):
    """Nettoyer les rapports de test indésirables des archives ET corriger les URLs"""
    # D'abord corriger les URLs
    fixed_reports = fix_archived_urls(archived_reports)
    
    # Ensuite nettoyer les rapports de test et les rapports indésirables
    test_patterns = [
        "206171",  # Numéro du rapport de test à supprimer
        "17.06.2025",  # Date du rapport de test
        "Neuer EFK Bericht vom 17.06.2025",  # Titre allemand
        "Nouveau rapport CDF du 17.06.2025",  # Titre français
        "Nuovo rapporto CDF del 17.06.2025"   # Titre italien
    ]
    
    # URLs spécifiques à supprimer des archives (ces rapports doivent être dans "nouveaux" seulement)
    specific_urls_to_remove = [
        'https://www.efk.admin.ch/prufung/schweizerische-post-ag-umsetzung-wesentlicher-empfehlungen-zum-risikomanagement-ueber-die-tochtergesellschaften/',
        'https://www.efk.admin.ch/prufung/projektfortschritt-beim-ausbau-der-a1-zwischen-le-vengeron-und-nyon/',
        'https://www.efk.admin.ch/fr/audit/la-poste-suisse-sa-mise-en-oeuvre-des-recommandations-essentielles-gestion-des-risques-via-les-filiales/',
        'https://www.efk.admin.ch/fr/audit/etat-davancement-du-projet-delargissement-de-la1-entre-le-vengeron-et-nyon/',
        'https://www.efk.admin.ch/it/verifica/la-posta-svizzera-sa-attuazione-di-importanti-raccomandazioni-sulla-gestione-dei-rischi-presso-le-filiali/',
        'https://www.efk.admin.ch/it/verifica/stato-di-attuazione-del-progetto-di-potenziamento-della1-tra-le-vengeron-e-nyon/'
    ]
    
    cleaned_reports = {'fr': [], 'de': [], 'it': []}
    seen_urls = {'fr': set(), 'de': set(), 'it': set()}  # Pour éviter les doublons
    
    for lang in ['fr', 'de', 'it']:
        for report in fixed_reports.get(lang, []):
            # Vérifier si le rapport contient des patterns de test
            is_test_report = any(
                pattern in str(report.get('number', '')) or 
                pattern in str(report.get('title', '')) or 
                pattern in str(report.get('publication_date', ''))
                for pattern in test_patterns
            )
            
            # Vérifier si c'est un rapport avec numéro "R" en FR ou IT
            is_r_report = False
            if lang in ['fr', 'it']:  # Seulement pour français et italien
                report_number = str(report.get('number', ''))
                if report_number.startswith('R'):
                    is_r_report = True
                    print(f"🗑️  Suppression rapport #{report_number} en {lang.upper()}: {report.get('title', 'Sans titre')[:50]}...")
            
            # Vérifier si c'est le rapport PEER2025 en allemand
            is_peer2025_de = False
            if lang == 'de':
                report_number = str(report.get('number', ''))
                if report_number == 'PEER2025':
                    is_peer2025_de = True
                    print(f"🗑️  Suppression rapport PEER2025 en DE: {report.get('title', 'Sans titre')[:50]}...")
            
            # Vérifier si c'est un des rapports spécifiques à supprimer des archives
            report_url = report.get('url', '')
            is_specific_to_remove = report_url in specific_urls_to_remove
            if is_specific_to_remove:
                print(f"🗑️  Suppression rapport spécifique des archives {lang.upper()}: {report.get('title', 'Sans titre')[:50]}...")
                print(f"      URL: {report_url}")
                continue
            
            # Vérifier les doublons d'URL
            is_duplicate = report_url in seen_urls[lang]
            if is_duplicate:
                print(f"🗑️  Suppression doublon en {lang.upper()}: {report.get('title', 'Sans titre')[:50]}...")
            
            # Garder seulement les rapports qui ne sont pas des tests, pas des "R", pas PEER2025-DE, pas spécifiques et pas des doublons
            if not is_test_report and not is_r_report and not is_peer2025_de and not is_specific_to_remove and not is_duplicate:
                cleaned_reports[lang].append(report)
                seen_urls[lang].add(report_url)
    
    # Trier les rapports par date (plus récent en premier) pour chaque langue
    for lang in ['fr', 'de', 'it']:
        cleaned_reports[lang] = sort_reports_by_date(cleaned_reports[lang])
    
    return cleaned_reports

def get_test_reports():
    """Rapports de test mis à jour avec TOUS les rapports synchronisés (6 rapports par langue)"""
    # Utiliser directement les rapports connus qui sont maintenant synchronisés et complets
    return {
        'fr': get_known_reports_for_language('fr'),
        'de': get_known_reports_for_language('de'),
        'it': get_known_reports_for_language('it')
    }

def simulate_scraper():
    """Simule le scraper avec des données de test"""
    print("🔍 Simulation du scraper EFK/CDF")
    print("📋 Chargement des rapports de test du 28.05.2025...")
    
    all_reports = get_test_reports()
    
    for lang, reports in all_reports.items():
        print(f"✅ {lang.upper()}: {len(reports)} rapports chargés")
        for report in reports:
            print(f"  📋 #{report['number']}: {report['title'][:50]}...")
    
    total = sum(len(reports) for reports in all_reports.values())
    print(f"🎯 Total: {total} rapports disponibles")
    
    return all_reports

def update_reports_automatically():
    """
    Met à jour automatiquement les rapports EFK/CDF avec une gestion avancée des erreurs
    et une meilleure synchronisation entre les langues.
    
    Returns:
        bool: True si la mise à jour a réussi, False sinon
    """
    from datetime import datetime
    import time
    
    start_time = time.time()
    print("\n" + "="*80)
    print(f"🔄 DÉMARRAGE DE LA MISE À JOUR - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    # Dictionnaire pour stocker les détails de la mise à jour
    update_details = {
        'start_time': datetime.now().isoformat(),
        'languages_updated': [],
        'new_reports': {'fr': 0, 'de': 0, 'it': 0},
        'errors': [],
        'warnings': []
    }
    
    try:
        # 1. Charger les rapports existants
        print("\n📂 CHARGEMENT DES RAPPORTS EXISTANTS")
        print("-" * 60)
        existing_reports = {}
        
        for lang in ['fr', 'de', 'it']:
            try:
                existing_reports[lang] = load_reports(lang)
                count = len(existing_reports[lang])
                print(f"   ✅ {lang.upper()}: {count} rapports chargés")
                update_details['languages_updated'].append(lang)
            except Exception as e:
                error_msg = f"Erreur lors du chargement des rapports {lang.upper()}: {str(e)}"
                print(f"   ❌ {error_msg}")
                update_details['errors'].append(error_msg)
                existing_reports[lang] = []
        
        # 2. Récupérer les nouveaux rapports
        print("\n🌐 RÉCUPÉRATION DES NOUVEAUX RAPPORTS")
        print("-" * 60)
        
        all_new_reports = {'fr': [], 'de': [], 'it': []}
        
        for lang in ['fr', 'de', 'it']:
            try:
                print(f"\n   🔍 Récupération des rapports en {lang.upper()}...")
                lang_start_time = time.time()
                
                # Appel spécifique à chaque langue
                if lang == 'fr':
                    lang_reports = scrape_efk_reports_fr()
                elif lang == 'de':
                    lang_reports = scrape_efk_reports_de()
                else:  # it
                    lang_reports = scrape_efk_reports_it()
                
                duration = time.time() - lang_start_time
                
                if not lang_reports:
                    warning_msg = f"Aucun rapport récupéré pour la langue {lang.upper()}"
                    print(f"   ⚠️  {warning_msg}")
                    update_details['warnings'].append(warning_msg)
                else:
                    print(f"   ✅ {len(lang_reports)} rapports récupérés en {duration:.1f}s")
                    all_new_reports[lang] = lang_reports
            
            except Exception as e:
                error_msg = f"Erreur lors de la récupération des rapports {lang.upper()}: {str(e)}"
                print(f"   ❌ {error_msg}")
                update_details['errors'].append(error_msg)
                import traceback
                traceback.print_exc()
        
        # 3. Comparer et synchroniser les rapports
        print("\n🔍 COMPARAISON ET SYNCHRONISATION")
        print("-" * 60)
        
        # Créer un index des rapports existants par numéro de rapport
        reports_index = {}
        for lang, reports in existing_reports.items():
            for report in reports:
                report_id = report.get('id', '')
                if '_' in report_id:  # Format attendu: 'fr_1234_abc123'
                    base_number = report_id.split('_')[1]  # Récupère la partie numérique
                    if base_number not in reports_index:
                        reports_index[base_number] = {}
                    reports_index[base_number][lang] = report
        
        # Vérifier les nouveaux rapports et les traductions manquantes
        new_reports_to_add = {'fr': [], 'de': [], 'it': []}
        
        for lang in ['fr', 'de', 'it']:
            for new_report in all_new_reports[lang]:
                report_id = new_report.get('id', '')
                
                # Vérifier si c'est un nouvel ID de rapport
                if not any(r['id'] == report_id for r in existing_reports[lang]):
                    new_reports_to_add[lang].append(new_report)
                    update_details['new_reports'][lang] += 1
                    
                    # Mettre à jour l'index pour les autres langues
                    if '_' in report_id:
                        base_number = report_id.split('_')[1]
                        if base_number not in reports_index:
                            reports_index[base_number] = {}
                        reports_index[base_number][lang] = new_report
        
        # Vérifier les traductions manquantes
        for base_number, lang_reports in reports_index.items():
            for lang in ['fr', 'de', 'it']:
                if lang not in lang_reports and len(lang_reports) > 0:
                    # Créer une entrée de traduction manquante
                    existing_lang, existing_report = next(iter(lang_reports.items()))
                    translated_report = existing_report.copy()
                    translated_report['id'] = translated_report['id'].replace(
                        f"{existing_lang}_", f"{lang}_"
                    )
                    translated_report['language'] = lang
                    translated_report['title'] = f"[Traduction] {existing_report['title']}"
                    translated_report['url'] = existing_report['url'].replace(
                        f'/{existing_lang}/', f'/{lang}/'
                    )
                    
                    # Vérifier si cette traduction n'existe pas déjà
                    if not any(r['id'] == translated_report['id'] for r in existing_reports[lang]):
                        new_reports_to_add[lang].append(translated_report)
                        update_details['new_reports'][lang] += 1
                        print(f"   ➕ Traduction {lang} ajoutée pour le rapport {base_number}")
        
        # 4. Sauvegarder les mises à jour
        print("\n💾 SAUVEGARDE DES MISES À JOUR")
        print("-" * 60)
        
        for lang in ['fr', 'de', 'it']:
            if new_reports_to_add[lang]:
                try:
                    # Fusionner les anciens et nouveaux rapports
                    updated_reports = existing_reports[lang] + new_reports_to_add[lang]
                    
                    # Trier par date (du plus récent au plus ancien)
                    updated_reports.sort(
                        key=lambda x: x.get('publication_date', ''), 
                        reverse=True
                    )
                    
                    # Limiter à 100 rapports maximum par langue
                    if len(updated_reports) > 100:
                        print(f"   ℹ️  Limitation à 100 rapports pour {lang.upper()} (précédemment: {len(updated_reports)})")
                        updated_reports = updated_reports[:100]
                    
                    # Sauvegarder
                    save_success = save_reports(updated_reports, lang)
                    
                    if save_success:
                        count = len(new_reports_to_add[lang])
                        print(f"   ✅ {lang.upper()}: {count} nouveaux rapports sauvegardés (total: {len(updated_reports)})")
                    else:
                        error_msg = f"Échec de la sauvegarde pour {lang.upper()}"
                        print(f"   ❌ {error_msg}")
                        update_details['errors'].append(error_msg)
                
                except Exception as e:
                    error_msg = f"Erreur lors de la sauvegarde pour {lang.upper()}: {str(e)}"
                    print(f"   ❌ {error_msg}")
                    update_details['errors'].append(error_msg)
                    import traceback
                    traceback.print_exc()
            else:
                print(f"   ⏩ Aucune mise à jour pour {lang.upper()}")
        
        # 5. Envoyer des notifications si nécessaire
        total_new = sum(update_details['new_reports'].values())
        if total_new > 0:
            print(f"\n📨 ENVOI DES NOTIFICATIONS ({total_new} nouveaux rapports)")
            print("-" * 60)
            
            try:
                send_notifications(new_reports_to_add)
                print("   ✅ Notifications envoyées avec succès")
            except Exception as e:
                error_msg = f"Erreur lors de l'envoi des notifications: {str(e)}"
                print(f"   ❌ {error_msg}")
                update_details['errors'].append(error_msg)
                import traceback
                traceback.print_exc()
        
        # 6. Finalisation
        duration = time.time() - start_time
        update_details['end_time'] = datetime.now().isoformat()
        update_details['duration_seconds'] = round(duration, 2)
        update_details['success'] = len(update_details['errors']) == 0
        
        print("\n" + "="*80)
        if update_details['success']:
            print(f"✅ MISE À JOUR TERMINÉE AVEC SUCCÈS en {duration:.1f}s")
        else:
            print(f"⚠️  MISE À JOUR TERMINÉE AVEC DES ERREURS en {duration:.1f}s")
        print("="*80)
        
        return update_details['success']
    
    except Exception as e:
        duration = time.time() - start_time
        error_msg = f"ERREUR CRITIQUE: {str(e)}"
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        
        update_details.update({
            'end_time': datetime.now().isoformat(),
            'duration_seconds': round(duration, 2),
            'success': False,
            'errors': update_details['errors'] + [error_msg]
        })
        
        print("\n" + "="*80)
        print(f"❌ MISE À JOUR INTERROMPUE APRÈS {duration:.1f}s")
        print("="*80)
        
        return False

def send_update_notification(total_new):
    """Envoyer notification Threema des nouveaux rapports"""
    message = f"""🔄 Mise à jour EFK/CDF automatique

📊 {total_new} nouveaux rapports détectés
🕐 {datetime.now().strftime('%d.%m.%Y à %H:%M')}

Consultez l'interface pour voir les nouveaux rapports."""
    
    try:
        result = send_threema_message(TEST_THREEMA_ID, message)
        if result.get('status') == 'success':
            print(f"📱 Notification envoyée - ID: {result.get('message_id')}")
        else:
            print(f"❌ Erreur notification: {result.get('message')}")
    except Exception as e:
        print(f"❌ Erreur envoi notification: {e}")

def setup_scheduler():
    """Configurer la planification automatique"""
    if not SCHEDULER_AVAILABLE:
        print("❌ Planification non disponible - module 'schedule' manquant")
        return False
        
    try:
        # Effacer les anciennes tâches
        schedule.clear()
        
        # Programmer les mises à jour : lundi et mercredi à 23h05
        schedule.every().monday.at("23:05").do(update_reports_automatically)
        schedule.every().wednesday.at("23:05").do(update_reports_automatically)
        
        print("⏰ Planification configurée avec succès:")
        print("   📅 Lundi 23h05 - Mise à jour automatique")
        print("   📅 Mercredi 23h05 - Mise à jour automatique")
        
        # Afficher les prochaines exécutions
        jobs = schedule.get_jobs()
        if jobs:
            print("🔮 Prochaines exécutions:")
            for job in jobs:
                print(f"   ⏰ {job.next_run.strftime('%A %d.%m.%Y à %H:%M')}")
        
        return True
    except Exception as e:
        print(f"❌ Erreur configuration scheduler: {e}")
        return False

def run_scheduler():
    """Exécuter le planificateur en arrière-plan"""
    if not SCHEDULER_AVAILABLE:
        print("❌ Scheduler non disponible")
        return
        
    print("🚀 Démarrage du planificateur en arrière-plan...")
    
    while True:
        try:
            schedule.run_pending()
            time.sleep(60)  # Vérifier toutes les minutes
            
            # Debug : afficher le statut toutes les 6 heures à minuit
            current_time = datetime.now()
            if current_time.hour == 0 and current_time.minute == 0:
                jobs = schedule.get_jobs()
                if jobs:
                    next_run = jobs[0].next_run
                    print(f"⏰ Scheduler actif - {current_time.strftime('%d.%m.%Y %H:%M')} - Prochaine: {next_run.strftime('%A %d.%m.%Y à %H:%M')}")
        except Exception as e:
            print(f"❌ Erreur dans le scheduler: {e}")
            time.sleep(300)  # Attendre 5 minutes avant de réessayer

@app.route('/')
def home():
    new_reports, archived_reports = load_efk_data()
    total_new = sum(len(reports) for reports in new_reports.values())
    total_archived = sum(len(reports) for reports in archived_reports.values())
    
    # Calculer le nombre unique de nouveaux rapports (pas par langue)
    unique_new_reports = set()
    for lang_reports in new_reports.values():
        for report in lang_reports:
            unique_new_reports.add(report.get('number', report.get('id', '')))
    unique_new_count = len(unique_new_reports)
    
    # Calculer le nombre unique de rapports archivés
    unique_archived_reports = set()
    for lang_reports in archived_reports.values():
        for report in lang_reports:
            unique_archived_reports.add(report.get('number', report.get('id', '')))
    unique_archived_count = len(unique_archived_reports)
    
    scheduler_info = ""
    if SCHEDULER_AVAILABLE:
        scheduler_info = """
        <div class="scheduler-info">
            <strong>⏰ Planification automatique activée</strong><br>
            📅 Mise à jour : <strong>Lundi 23h05</strong> et <strong>Mercredi 23h05</strong><br>
            🔄 Nouveaux rapports détectés automatiquement
        </div>
        """
    else:
        scheduler_info = """
        <div class="scheduler-info" style="border-left-color: #ff9500;">
            <strong>⚠️ Planification non disponible</strong><br>
            📦 Installer 'schedule' avec : <code>pip install schedule</code><br>
            🔄 Utiliser la mise à jour manuelle en attendant
        </div>
        """
    
    return f'''
<!DOCTYPE html>
<html>
<head>
    <title>EFK Scraper - Avec planification</title>
    <meta charset="UTF-8">
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: white;
        }}
        .container {{
            max-width: 1000px;
            margin: 0 auto;
            text-align: center;
        }}
        .header {{
            margin-bottom: 40px;
        }}
        .header h1 {{
            font-size: 3em;
            margin-bottom: 10px;
            text-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }}
        .scheduler-info {{
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            border-left: 5px solid #30d158;
        }}
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 20px;
            margin: 40px 0;
        }}
        .stat-card {{
            background: rgba(255,255,255,0.9);
            color: #333;
            padding: 30px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: transform 0.3s ease;
        }}
        .stat-card:hover {{
            transform: translateY(-10px);
        }}
        .stat-card.new {{
            border-left: 5px solid #30d158;
        }}
        .stat-card.archived {{
            border-left: 5px solid #ff9500;
        }}
        .stat-card.languages {{
            border-left: 5px solid #007aff;
        }}
        .stat-number {{
            font-size: 2.5em;
            font-weight: bold;
            color: #667eea;
        }}
        .btn {{
            background: rgba(255,255,255,0.2);
            color: white;
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            margin: 10px;
            cursor: pointer;
            font-weight: 600;
            backdrop-filter: blur(10px);
            transition: all 0.3s ease;
        }}
        .btn:hover {{
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }}
        .btn.archives {{
            background: rgba(255, 149, 0, 0.3);
        }}
        .btn.archives:hover {{
            background: rgba(255, 149, 0, 0.4);
        }}
        .reports-section {{
            background: rgba(255,255,255,0.9);
            color: #333;
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: left;
            display: none;
        }}
        .language-section {{
            margin-bottom: 40px;
            padding: 25px;
            border-radius: 15px;
            border-left: 5px solid;
        }}
        .language-section.fr {{
            background: linear-gradient(135deg, rgba(0, 85, 164, 0.1), rgba(255, 255, 255, 0.1));
            border-left-color: #0055A4;
        }}
        .language-section.de {{
            background: linear-gradient(135deg, rgba(255, 204, 0, 0.1), rgba(255, 255, 255, 0.1));
            border-left-color: #FFCC00;
        }}
        .language-section.it {{
            background: linear-gradient(135deg, rgba(0, 146, 70, 0.1), rgba(255, 255, 255, 0.1));
            border-left-color: #009246;
        }}
        .language-header {{
            display: flex;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid rgba(0,0,0,0.1);
        }}
        .language-flag {{
            font-size: 2em;
            margin-right: 15px;
        }}
        .language-title {{
            font-size: 1.8em;
            font-weight: bold;
            color: #333;
        }}
        .language-count {{
            background: rgba(102, 126, 234, 0.2);
            color: #667eea;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: bold;
            margin-left: auto;
        }}
        .report-item {{
            border-bottom: 1px solid rgba(0,0,0,0.1);
            padding: 20px 0;
            transition: all 0.3s ease;
        }}
        .report-item:hover {{
            background: rgba(102, 126, 234, 0.05);
            border-radius: 10px;
            padding: 20px 15px;
        }}
        .report-item:last-child {{
            border-bottom: none;
        }}
        .report-title {{
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 1.1em;
        }}
        .report-meta {{
            color: #666;
            margin-bottom: 10px;
        }}
        .btn-small {{
            background: #30d158;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-right: 10px;
            font-weight: 600;
            transition: all 0.3s ease;
        }}
        .btn-small:hover {{
            background: #28a745;
            transform: translateY(-2px);
        }}
        .btn-grouped {{
            background: rgba(255,255,255,0.9);
            color: #333;
            padding: 12px 24px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }}
        .btn-grouped:hover {{
            background: rgba(255,255,255,1);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }}
        .modal {{
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.8);
        }}
        .modal-content {{
            background-color: white;
            margin: 5% auto;
            padding: 30px;
            border-radius: 15px;
            width: 80%;
            max-width: 700px;
            color: #333;
        }}
        .modal h2 {{
            color: #667eea;
            margin-bottom: 20px;
        }}
        .language-tabs {{
            display: flex;
            margin-bottom: 20px;
            border-bottom: 2px solid #eee;
        }}
        .tab-btn {{
            background: none;
            border: none;
            padding: 12px 20px;
            cursor: pointer;
            font-weight: 600;
            color: #666;
            border-bottom: 2px solid transparent;
            transition: all 0.3s ease;
        }}
        .tab-btn:hover {{
            color: #667eea;
            background: rgba(102, 126, 234, 0.1);
        }}
        .tab-btn.active {{
            color: #667eea;
            border-bottom-color: #667eea;
            background: rgba(102, 126, 234, 0.1);
        }}
        .modal textarea {{
            width: 100%;
            height: 250px;
            padding: 15px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-family: monospace;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
        }}
        .modal-buttons {{
            text-align: right;
            margin-top: 20px;
        }}
        .modal-btn {{
            padding: 12px 24px;
            margin-left: 10px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }}
        .modal-btn.send {{
            background: #30d158;
            color: white;
        }}
        .modal-btn.send-lang {{
            background: #667eea;
            color: white;
            margin-left: 5px;
            padding: 10px 18px;
        }}
        .modal-btn.send-lang:hover {{
            background: #5a67d8;
        }}
        .modal-btn.cancel {{
            background: #ccc;
            color: #333;
        }}
        .no-reports {{
            text-align: center;
            padding: 60px 20px;
            color: #666;
            font-size: 1.2em;
        }}
        .no-reports-icon {{
            font-size: 4em;
            margin-bottom: 20px;
            opacity: 0.5;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 EFK Scraper</h1>
            <p>Rapports d'audit suisses - Avec scraping réel et planification automatique</p>
        </div>
        
        {scheduler_info}
        
        <div class="stats">
            <div class="stat-card new">
                <div class="stat-number">{unique_new_count}</div>
                <div>Nouveaux rapports</div>
            </div>
            <div class="stat-card archived">
                <div class="stat-number">{unique_archived_count}</div>
                <div>Rapports archivés</div>
            </div>
        </div>
        
        <button class="btn" onclick="runScraper()">🔍 Mise à jour manuelle</button>
        <button class="btn" onclick="showReports('new')">📊 Voir nouveaux rapports</button>
        <button class="btn archives" onclick="showReports('archived')">📁 Voir archives</button>
        <button class="btn" onclick="addNewReportsToArchives()">➕ Ajouter nouveaux rapports</button>
        <button class="btn" onclick="cleanNavigationReports()">🧹 Nettoyer navigation</button>
        <button class="btn" onclick="testRealScraping()">🧪 Test scraping réel</button>
        <button class="btn" onclick="cleanArchives()">🗑️ Nettoyer archives</button>
        <button class="btn" onclick="checkScheduler()">⏰ Statut planification</button>
        <button class="btn" onclick="testThreema()">📱 Test Threema</button>
        
        <div id="reports" class="reports-section">
            <h2 id="reports-title">📊 Rapports EFK/CDF</h2>
            <div id="reports-content"></div>
        </div>
        
        <!-- Modal d'édition -->
        <div id="messageModal" class="modal">
            <div class="modal-content">
                <h2 id="modalTitle">📝 Éditer le message Threema</h2>
                
                <!-- Onglets de langues (cachés par défaut) -->
                <div id="languageTabs" class="language-tabs" style="display: none;">
                    <button class="tab-btn active" onclick="switchLanguageTab('fr')" data-lang="fr">🇫🇷 Français</button>
                    <button class="tab-btn" onclick="switchLanguageTab('de')" data-lang="de">🇩🇪 Deutsch</button>
                    <button class="tab-btn" onclick="switchLanguageTab('it')" data-lang="it">🇮🇹 Italiano</button>
                </div>
                
                <!-- Zone d'édition unique -->
                <textarea id="messageText" placeholder="Éditez votre message ici..."></textarea>
                
                <!-- Boutons d'envoi -->
                <div class="modal-buttons">
                    <button class="modal-btn cancel" onclick="closeModal()">Annuler</button>
                    
                    <!-- Boutons pour rapport individuel -->
                    <div id="singleReportButtons">
                        <button class="modal-btn send" onclick="sendEditedMessage()">📤 Envoyer</button>
                    </div>
                    
                    <!-- Boutons pour rapports groupés (cachés par défaut) -->
                    <div id="groupedReportButtons" style="display: none;">
                        <button class="modal-btn send-lang" onclick="sendGroupedMessage('fr')">📤 Envoyer FR</button>
                        <button class="modal-btn send-lang" onclick="sendGroupedMessage('de')">📤 Envoyer DE</button>
                        <button class="modal-btn send-lang" onclick="sendGroupedMessage('it')">📤 Envoyer IT</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        function runScraper() {{
            if (confirm('🔍 Lancer une mise à jour manuelle des rapports ?\\n\\nCela va scraper le site EFK/CDF pour détecter les nouveaux rapports.')) {{
                // Afficher un indicateur de chargement
                let button = document.querySelector('button[onclick="runScraper()"]');
                let originalText = button.textContent;
                button.textContent = '🔄 Scraping en cours...';
                button.disabled = true;
                
                fetch('/run-scraper')
                    .then(r => r.json())
                    .then(data => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        
                        if (data.status === 'success') {{
                            let message = '✅ ' + data.message;
                            if (data.new_count !== undefined && data.archived_count !== undefined) {{
                                message += '\\n\\n📊 État final:';
                                message += '\\n• Nouveaux rapports: ' + data.new_count;
                                message += '\\n• Rapports archivés: ' + data.archived_count;
                            }}
                            alert(message);
                            location.reload(); // Recharger pour voir les changements
                        }} else {{
                            alert('❌ Erreur: ' + data.message);
                        }}
                    }})
                    .catch(error => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        alert('❌ Erreur de connexion: ' + error);
                    }});
            }}
        }}
        
        function showReports(type) {{
            document.getElementById('reports').style.display = 'block';
            
            let endpoint = type === 'archived' ? '/api/archived-reports' : '/api/reports';
            let title = type === 'archived' ? '📁 Archives des rapports EFK/CDF' : '📊 Nouveaux rapports EFK/CDF';
            
            document.getElementById('reports-title').textContent = title;
            
            fetch(endpoint)
                .then(r => r.json())
                .then(data => {{
                    let html = '';
                    
                    // Définir les drapeaux et noms pour chaque langue
                    const languageInfo = {{
                        'fr': {{ flag: '🇫🇷', name: 'Rapport CDF', fullName: 'Français' }},
                        'de': {{ flag: '🇩🇪', name: 'EFK Bericht', fullName: 'Deutsch' }},
                        'it': {{ flag: '🇮🇹', name: 'Rapporti CDF', fullName: 'Italiano' }}
                    }};
                    
                    let reportsData = type === 'archived' ? data.archived_reports : data.reports;
                    let hasReports = false;
                    
                    // Grouper les rapports par date pour les nouveaux rapports
                    if (type !== 'archived') {{
                        let groupedByDate = {{}};
                        for (let lang in reportsData) {{
                            for (let report of reportsData[lang]) {{
                                let date = report.publication_date;
                                if (!groupedByDate[date]) {{
                                    groupedByDate[date] = {{}};
                                }}
                                if (!groupedByDate[date][lang]) {{
                                    groupedByDate[date][lang] = [];
                                }}
                                groupedByDate[date][lang].push(report);
                            }}
                        }}
                        
                        // Ajouter boutons d'envoi groupé pour chaque date
                        for (let date in groupedByDate) {{
                            let totalReportsForDate = 0;
                            for (let lang in groupedByDate[date]) {{
                                totalReportsForDate += groupedByDate[date][lang].length;
                            }}
                            
                            if (totalReportsForDate >= 3) {{ // Si au moins 3 rapports
                                html += '<div style="background: linear-gradient(135deg, #30d158, #28a745); color: white; padding: 20px; border-radius: 15px; margin: 20px 0; text-align: center;">';
                                html += '<h3 style="margin: 0 0 15px 0;">📊 Rapports du ' + date + '</h3>';
                                html += '<p style="margin: 0 0 15px 0;">' + Math.ceil(totalReportsForDate / 3) + ' rapport(s) disponible(s) en plusieurs langues</p>';
                                
                                // Approche simplifiée : stocker les données avec un ID unique
                                let dataId = 'grouped_' + date.replace(/\./g, '_');
                                html += '<button class="btn-grouped" onclick="sendStoredGroupedReports(\\''+dataId+'\\', \\''+date+'\\')">📤 Envoyer tous les rapports du ' + date + '</button>';
                                
                                // Stocker les données globalement avec un ID unique
                                if (!window.groupedReportsData) {{
                                    window.groupedReportsData = {{}};
                                }}
                                window.groupedReportsData[dataId] = groupedByDate[date];
                                
                                html += '</div>';
                            }}
                        }}
                    }}
                    
                    for (let lang in reportsData) {{
                        if (reportsData[lang].length > 0) {{
                            hasReports = true;
                            const info = languageInfo[lang];
                            
                            // Créer une section séparée pour chaque langue
                            html += '<div class="language-section ' + lang + '">';
                            html += '<div class="language-header">';
                            html += '<span class="language-flag">' + info.flag + '</span>';
                            html += '<span class="language-title">' + info.name + ' (' + info.fullName + ')</span>';
                            html += '<span class="language-count">' + reportsData[lang].length + ' rapports</span>';
                            html += '</div>';
                            
                            reportsData[lang].forEach(report => {{
                                html += '<div class="report-item">';
                                
                                // Utiliser le bon mot selon la langue
                                let reportWord = '';
                                if (lang === 'fr') {{
                                    reportWord = 'Rapport';
                                }} else if (lang === 'de') {{
                                    reportWord = 'Bericht';
                                }} else if (lang === 'it') {{
                                    reportWord = 'Rapporti';
                                }}
                                
                                html += '<div style="color: #667eea; font-weight: bold; margin-bottom: 5px;">' + reportWord + ' #' + report.number + '</div>';
                                
                                if (report.category) {{
                                    html += '<div style="color: #e91e63; font-weight: 600; margin-bottom: 8px;">🏷️ ' + report.category + '</div>';
                                }}
                                html += '<div class="report-title">' + report.title + '</div>';
                                html += '<div class="report-meta">📅 ' + report.publication_date + ' | 🔗 <a href="' + report.url + '" target="_blank" style="color: #667eea;">Voir le rapport</a></div>';
                                
                                // Bouton d'envoi pour tous les rapports (nouveaux et archivés)
                                let buttonText = type === 'archived' ? '📤 Renvoyer via Threema' : '📤 Envoyer via Threema';
                                html += '<button class="btn-small" onclick="editAndSend(\\''+report.id+'\\', \\''+lang+'\\', \\''+report.title+'\\', \\''+report.url+'\\', \\''+report.number+'\\', \\''+report.category+'\\', \\''+report.publication_date+'\\')">'+buttonText+'</button>';
                                
                                html += '</div>';
                            }});
                            
                            html += '</div>'; // Fermer language-section
                        }}
                    }}
                    
                    if (!hasReports) {{
                        let message = type === 'archived' ? 'Aucun rapport archivé trouvé.' : 'Aucun nouveau rapport disponible.';
                        let icon = type === 'archived' ? '📁' : '📊';
                        html = '<div class="no-reports">';
                        html += '<div class="no-reports-icon">' + icon + '</div>';
                        html += '<div>' + message + '</div>';
                        html += '</div>';
                    }}
                    
                    document.getElementById('reports-content').innerHTML = html;
                }});
        }}
        
        // Nouvelle fonction simplifiée pour les rapports groupés
        function sendStoredGroupedReports(dataId, date) {{
            console.log('🔍 sendStoredGroupedReports appelée avec:', dataId, date);
            
            // Récupérer les données stockées
            if (!window.groupedReportsData || !window.groupedReportsData[dataId]) {{
                console.error('❌ Données non trouvées pour:', dataId);
                alert('❌ Erreur: données des rapports non trouvées. Rechargez la page et réessayez.');
                return;
            }}
            
            const groupedReports = window.groupedReportsData[dataId];
            console.log('✅ Données récupérées:', groupedReports);
            
            // Appeler la fonction principale
            processGroupedReports(groupedReports, date);
        }}
        
        function processGroupedReports(groupedReports, date) {{
            console.log('🔍 processGroupedReports avec:', groupedReports, date);
            
            // Préparer les messages pour chaque langue
            const translations = {{
                'fr': {{
                    header: '📊 Nouveaux rapports CDF',
                    category: '🏷️'
                }},
                'de': {{
                    header: '📊 Neue EFK-Berichte',
                    category: '🏷️'
                }},
                'it': {{
                    header: '📊 Nuovi rapporti CDF',
                    category: '🏷️'
                }}
            }};
            
            // Créer les messages pour chaque langue
            const messages = {{}};
            const reportEmojis = ['📋', '📄', '📊', '📈', '📉', '📝', '🔍', '💼', '📑', '📜'];
            
            ['fr', 'de', 'it'].forEach(lang => {{
                console.log(`🔍 Traitement langue ${{lang}}:`, groupedReports[lang]);
                
                if (groupedReports[lang] && Array.isArray(groupedReports[lang]) && groupedReports[lang].length > 0) {{
                    let message = translations[lang].header + ' - ' + date + '\\n\\n';
                    
                    groupedReports[lang].forEach((report, index) => {{
                        let emoji = reportEmojis[index % reportEmojis.length];
                        
                        message += emoji + ' #' + (report.number || 'N/A') + '\\n';
                        
                        if (report.category && report.category !== 'undefined') {{
                            message += translations[lang].category + ' ' + report.category + '\\n';
                        }}
                        
                        message += '*' + (report.title || 'Sans titre') + '*\\n';
                        message += '🔗 ' + (report.url || '#') + '\\n';
                        
                        // Séparateur élégant entre les rapports (sauf pour le dernier)
                        if (index < groupedReports[lang].length - 1) {{
                            message += '\\n━━━━━━━━━━\\n\\n';
                        }}
                    }});
                    
                    messages[lang] = message;
                    console.log(`✅ Message ${{lang}} créé:`, message.substring(0, 100) + '...');
                }} else {{
                    console.log(`⚠️  Pas de rapports pour ${{lang}}`);
                }}
            }});
            
            // Vérifier si on a au moins un message
            if (Object.keys(messages).length === 0) {{
                console.error('❌ Aucun message généré');
                alert('❌ Aucun rapport trouvé pour créer des messages');
                return;
            }}
            
            console.log('✅ Messages créés:', Object.keys(messages));
            
            // Stocker les messages globalement pour les boutons d'envoi
            window.groupedMessages = messages;
            
            // Configurer la modal pour l'envoi groupé
            document.getElementById('modalTitle').textContent = '📤 Envoyer les rapports du ' + date;
            document.getElementById('languageTabs').style.display = 'flex';
            document.getElementById('singleReportButtons').style.display = 'none';
            document.getElementById('groupedReportButtons').style.display = 'block';
            
            // Afficher le message de la première langue disponible
            let firstLang = Object.keys(messages)[0] || 'fr';
            switchLanguageTab(firstLang);
            
            // Afficher la modal
            document.getElementById('messageModal').style.display = 'block';
            
            console.log('✅ Modal affichée avec succès');
        }}
        
        function sendGroupedReports(date, encodedGroupedReports) {{
            console.log('🔍 sendGroupedReports appelée avec:', date, encodedGroupedReports);
            
            // Décoder les données
            let groupedReports;
            try {{
                groupedReports = JSON.parse(decodeURIComponent(encodedGroupedReports));
                console.log('✅ Données décodées:', groupedReports);
            }} catch (e) {{
                console.error('❌ Erreur décodage:', e);
                alert('❌ Erreur lors du chargement des données des rapports: ' + e.message);
                return;
            }}
            
            // Appeler la fonction principale
            processGroupedReports(groupedReports, date);
        }}
        
        function switchLanguageTab(selectedLang) {{
            // Changer l'onglet actif
            document.querySelectorAll('.tab-btn').forEach(btn => {{
                btn.classList.remove('active');
            }});
            document.querySelector(`[data-lang="${{selectedLang}}"]`).classList.add('active');
            
            // Afficher le message de la langue sélectionnée
            if (window.groupedMessages && window.groupedMessages[selectedLang]) {{
                document.getElementById('messageText').value = window.groupedMessages[selectedLang];
            }} else {{
                document.getElementById('messageText').value = `Aucun rapport disponible en ${{selectedLang.toUpperCase()}}`;
            }}
        }}
        
        function sendGroupedMessage(lang) {{
            if (!window.groupedMessages || !window.groupedMessages[lang]) {{
                alert(`❌ Aucun message disponible pour ${{lang.toUpperCase()}}`);
                return;
            }}
            
            const message = window.groupedMessages[lang];
            
            if (!message.trim()) {{
                alert('Message vide !');
                return;
            }}
            
            // Confirmer l'envoi
            const langNames = {{ 'fr': 'Français', 'de': 'Deutsch', 'it': 'Italiano' }};
            if (!confirm(`📤 Envoyer tous les rapports en ${{langNames[lang]}} ?`)) {{
                return;
            }}
            
            fetch('/send-custom-message', {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{message: message}})
            }})
            .then(r => r.json())
            .then(data => {{
                if (data.status === 'success') {{
                    alert(`✅ Rapports ${{langNames[lang]}} envoyés !\\nID: ` + data.message_id);
                    closeModal();
                }} else {{
                    alert('❌ Erreur: ' + data.message);
                }}
            }})
            .catch(error => {{
                alert('❌ Erreur de connexion: ' + error);
            }});
        }}
        
        function editAndSend(id, lang, title, url, number, category, date) {{
            // Réinitialiser la modal pour un rapport individuel
            document.getElementById('modalTitle').textContent = '📝 Éditer le message Threema';
            document.getElementById('languageTabs').style.display = 'none';
            document.getElementById('singleReportButtons').style.display = 'block';
            document.getElementById('groupedReportButtons').style.display = 'none';
            
            // Créer le message avec titre + numéro, puis date en dessous
            let message = '';
            
            if (lang === 'fr') {{
                message = '📊 Rapport #' + number + '\\n';
            }} else if (lang === 'de') {{
                message = '📊 Bericht #' + number + '\\n';
            }} else if (lang === 'it') {{
                message = '📊 Rapporti #' + number + '\\n';
            }}
            
            // Date juste en dessous
            message += '📅 ' + date + '\\n\\n';
            
            if (category && category !== 'undefined') {{
                message += '🏷️ ' + category + '\\n\\n';
            }}
            
            // Titre en gras pour Threema (une seule étoile)
            message += '*' + title + '*\\n\\n';
            message += '🔗 ' + url;
            
            // Afficher la modal
            document.getElementById('messageText').value = message;
            document.getElementById('messageModal').style.display = 'block';
        }}
        
        // Fonction de test pour débugger l'envoi groupé
        function testGroupedModal() {{
            console.log('🧪 Test de l\\'envoi groupé');
            
            const testData = {{
                'fr': [
                    {{
                        number: '25101',
                        title: 'La Poste suisse SA : mise en œuvre des recommandations essentielles gestion des risques via les filiales',
                        category: 'Économie et entreprises',
                        url: 'https://www.efk.admin.ch/fr/audit/la-poste-suisse-sa-mise-en-oeuvre-des-recommandations-essentielles-gestion-des-risques-via-les-filiales/'
                    }},
                    {{
                        number: '25102',
                        title: 'État d\\'avancement du projet d\\'élargissement de l\\'A1 entre Le Vengeron et Nyon',
                        category: 'Transports et infrastructure',
                        url: 'https://www.efk.admin.ch/fr/audit/etat-davancement-du-projet-delargissement-de-la1-entre-le-vengeron-et-nyon/'
                    }}
                ],
                'de': [
                    {{
                        number: '25101',
                        title: 'Schweizerische Post AG: Umsetzung wesentlicher Empfehlungen zum Risikomanagement über die Tochtergesellschaften',
                        category: 'Wirtschaft und Unternehmen',
                        url: 'https://www.efk.admin.ch/prufung/schweizerische-post-ag-umsetzung-wesentlicher-empfehlungen-zum-risikomanagement-ueber-die-tochtergesellschaften/'
                    }},
                    {{
                        number: '25102',
                        title: 'Projektfortschritt beim Ausbau der A1 zwischen Le Vengeron und Nyon',
                        category: 'Verkehr und Infrastruktur',
                        url: 'https://www.efk.admin.ch/prufung/projektfortschritt-beim-ausbau-der-a1-zwischen-le-vengeron-und-nyon/'
                    }}
                ],
                'it': [
                    {{
                        number: '25101',
                        title: 'La Posta Svizzera SA: attuazione di importanti raccomandazioni sulla gestione dei rischi presso le filiali',
                        category: 'Economia e imprese',
                        url: 'https://www.efk.admin.ch/it/verifica/la-posta-svizzera-sa-attuazione-di-importanti-raccomandazioni-sulla-gestione-dei-rischi-presso-le-filiali/'
                    }},
                    {{
                        number: '25102',
                        title: 'Stato di attuazione del progetto di potenziamento dell\\'A1 tra Le Vengeron e Nyon',
                        category: 'Trasporti e infrastrutture',
                        url: 'https://www.efk.admin.ch/it/verifica/stato-di-attuazione-del-progetto-di-potenziamento-della1-tra-le-vengeron-e-nyon/'
                    }}
                ]
            }};
            
            // Tester directement avec les données
            processGroupedReports(testData, '24.06.2025');
        }}
        
        function closeModal() {{
            document.getElementById('messageModal').style.display = 'none';
            // Nettoyer les données globales
            window.groupedMessages = null;
        }}
        
        function sendEditedMessage() {{
            let message = document.getElementById('messageText').value;
            if (!message.trim()) {{
                alert('Message vide !');
                return;
            }}
            
            fetch('/send-custom-message', {{
                method: 'POST',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{message: message}})
            }})
            .then(r => r.json())
            .then(data => {{
                closeModal();
                if (data.status === 'success') {{
                    alert('✅ Message envoyé !\\nID: ' + data.message_id);
                }} else {{
                    alert('❌ Erreur: ' + data.message);
                }}
            }})
            .catch(error => {{
                alert('❌ Erreur de connexion: ' + error);
            }});
        }}
        
        function addNewReportsToArchives() {{
            if (confirm('➕ Ajouter les nouveaux rapports aux archives ?\\n\\nCela ajoutera les 4 nouveaux rapports EFK dans les archives (synchronisés dans les 3 langues).')) {{
                let button = document.querySelector('button[onclick="addNewReportsToArchives()"]');
                let originalText = button.textContent;
                button.textContent = '➕ Ajout en cours...';
                button.disabled = true;
                
                fetch('/add-new-reports-to-archives')
                    .then(r => r.json())
                    .then(data => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        
                        if (data.status === 'success') {{
                            alert('✅ ' + data.message + '\\n\\n📊 Résultat:\\n• Nouveaux rapports ajoutés: ' + data.added_count + '\\n• Total rapports archivés: ' + data.archived_total);
                            location.reload();
                        }} else {{
                            alert('❌ Erreur: ' + data.message);
                        }}
                    }})
                    .catch(error => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        alert('❌ Erreur de connexion: ' + error);
                    }});
            }}
        }}
        
        function cleanNavigationReports() {{
            if (confirm('🧹 Nettoyer les faux rapports de navigation ?\\n\\nCela supprimera définitivement tous les rapports comme "Zurück zu den Publikationen".')) {{
                let button = document.querySelector('button[onclick="cleanNavigationReports()"]');
                let originalText = button.textContent;
                button.textContent = '🧹 Nettoyage...';
                button.disabled = true;
                
                fetch('/clean-navigation-reports')
                    .then(r => r.json())
                    .then(data => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        
                        if (data.status === 'success') {{
                            alert('✅ ' + data.message + '\\n\\n📊 Résultat:\\n• Faux rapports supprimés: ' + data.removed_count + '\\n• Nouveaux rapports: ' + data.new_count + '\\n• Rapports archivés: ' + data.archived_count);
                            location.reload();
                        }} else {{
                            alert('❌ Erreur: ' + data.message);
                        }}
                    }})
                    .catch(error => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        alert('❌ Erreur de connexion: ' + error);
                    }});
            }}
        }}
        
        function testRealScraping() {{
            if (confirm('🧪 Tester le scraping réel du site EFK ?\\n\\nCela va diagnostiquer la connectivité et tenter de scraper de vrais rapports.')) {{
                let button = document.querySelector('button[onclick="testRealScraping()"]');
                let originalText = button.textContent;
                button.textContent = '🔄 Test en cours...';
                button.disabled = true;
                
                fetch('/test-real-scraping')
                    .then(r => r.json())
                    .then(data => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        
                        if (data.status === 'success') {{
                            let message = '🧪 TEST DU SCRAPING RÉEL\\n\\n';
                            
                            // Connectivité
                            let accessible = 0;
                            let total = Object.keys(data.connectivity).length;
                            for (let url in data.connectivity) {{
                                if (data.connectivity[url].status === 200) accessible++;
                            }}
                            message += `🌐 Connectivité: ${{accessible}}/${{total}} URLs accessibles\\n\\n`;
                            
                            // Rapports scrapés
                            message += `📋 Rapports scrapés: ${{data.scraped_reports.total}} total\\n`;
                            for (let lang in data.scraped_reports.by_language) {{
                                let count = data.scraped_reports.by_language[lang];
                                message += `   • ${{lang.toUpperCase()}}: ${{count}} rapports\\n`;
                            }}
                            
                            // Exemples de titres
                            if (data.scraped_reports.sample_titles) {{
                                message += '\\n📄 Exemples de rapports trouvés:\\n';
                                for (let lang in data.scraped_reports.sample_titles) {{
                                    message += `\\n${{lang.toUpperCase()}}:\\n`;
                                    data.scraped_reports.sample_titles[lang].forEach((title, i) => {{
                                        message += `${{i+1}}. ${{title}}...\\n`;
                                    }});
                                }}
                            }}
                            
                            alert(message);
                        }} else {{
                            alert('❌ Erreur test scraping: ' + data.message);
                        }}
                    }})
                    .catch(error => {{
                        button.textContent = originalText;
                        button.disabled = false;
                        alert('❌ Erreur de connexion: ' + error);
                    }});
            }}
        }}
        
        function cleanArchives() {{
            if (confirm('🧹 Nettoyer les archives des rapports de test ?\\n\\nCela supprimera les rapports de test indésirables.')) {{
                fetch('/clean-archives')
                    .then(r => r.json())
                    .then(data => {{
                        if (data.status === 'success') {{
                            alert('✅ ' + data.message + '\\n\\nAvant: ' + data.before + ' rapports\\nAprès: ' + data.after + ' rapports');
                            location.reload();
                        }} else {{
                            alert('❌ Erreur: ' + data.message);
                        }}
                    }});
            }}
        }}
        
        function checkScheduler() {{
            fetch('/scheduler-status')
                .then(r => r.json())
                .then(data => {{
                    let message = '';
                    if (data.status === 'active') {{
                        message = '✅ Planification ACTIVE\\n\\n' + data.message + '\\n\\n';
                        data.jobs.forEach(job => {{
                            message += '⏰ Prochaine exécution: ' + job.next_run + '\\n';
                        }});
                    }} else if (data.status === 'disabled') {{
                        message = '❌ Planification DÉSACTIVÉE\\n\\n' + data.message + '\\n\\n📦 Installer avec: pip install schedule';
                    }} else if (data.status === 'no_jobs') {{
                        message = '⚠️ Planification CONFIGURÉE\\n\\nMais aucune tâche planifiée trouvée.';
                    }} else {{
                        message = '❌ Erreur: ' + data.message;
                    }}
                    alert(message);
                }});
        }}
        
        function testScheduler() {{
            if (confirm('🧪 Programmer un test de planification dans 1 minute ?\\n\\nCela déclenchera une mise à jour automatique de test.')) {{
                fetch('/test-scheduler')
                    .then(r => r.json())
                    .then(data => {{
                        if (data.status === 'success') {{
                            alert('✅ Test programmé !\\n\\n⏰ Exécution prévue à: ' + data.test_time + '\\n\\nVérifiez les logs dans 1 minute.');
                        }} else {{
                            alert('❌ Erreur: ' + data.message);
                        }}
                    }});
            }}
        }}
        
        function testThreema() {{
            fetch('/send-test')
                .then(r => r.json())
                .then(data => {{
                    if (data.status === 'success') {{
                        alert('✅ Test envoyé !\\nID: ' + data.message_id);
                    }} else {{
                        alert('❌ Erreur: ' + data.message);
                    }}
                }});
        }}
        
        // Fermer modal en cliquant dehors
        window.onclick = function(event) {{
            if (event.target == document.getElementById('messageModal')) {{
                closeModal();
            }}
        }}
    </script>
</body>
</html>
    '''

@app.route('/api/reports')
def api_reports():
    new_reports, _ = load_efk_data()
    return {"status": "success", "reports": new_reports}

@app.route('/api/archived-reports')
def api_archived_reports():
    _, archived_reports = load_efk_data()
    return {"status": "success", "archived_reports": archived_reports}

@app.route('/run-scraper')
def run_scraper():
    try:
        print("🔄 MISE À JOUR MANUELLE DÉCLENCHÉE")
        print("=" * 50)
        
        # Charger les données actuelles
        current_new, current_archived = load_efk_data()
        current_total = sum(len(reports) for reports in current_new.values())
        archived_total = sum(len(reports) for reports in current_archived.values())
        
        print(f"📊 État actuel: {current_total} nouveaux rapports, {archived_total} archivés")
        
        # Scraper les derniers rapports du site EFK
        print("🕷️ Scraping du site EFK en cours...")
        scraped_reports = scrape_efk_reports()
        scraped_total = sum(len(reports) for reports in scraped_reports.values())
        
        print(f"🔍 Rapports scrapés: {scraped_total} trouvés sur le site")
        
        if scraped_total > 0:
            print("📦 Archivage des anciens rapports...")
            
            # Archiver TOUS les anciens "nouveaux" rapports
            for lang in ['fr', 'de', 'it']:
                if current_new[lang]:  # S'il y a des rapports actuels
                    print(f"   📁 {lang.upper()}: {len(current_new[lang])} rapports → archives")
                    current_archived[lang].extend(current_new[lang])
            
            # Les rapports scrapés deviennent les nouveaux
            new_reports = scraped_reports
            
            print("💾 Sauvegarde des nouvelles données...")
            
            # Sauvegarder
            if save_reports_data(new_reports, current_archived):
                new_total = sum(len(reports) for reports in new_reports.values())
                final_archived = sum(len(reports) for reports in current_archived.values())
                
                print("✅ MISE À JOUR TERMINÉE")
                print(f"📊 Résultat: {new_total} nouveaux rapports, {final_archived} archivés")
                
                return {
                    "status": "success", 
                    "message": f"Mise à jour réussie ! {new_total} nouveaux rapports détectés depuis le site EFK. {current_total} anciens rapports archivés.",
                    "new_count": new_total,
                    "archived_count": final_archived
                }
            else:
                return {"status": "error", "message": "Erreur lors de la sauvegarde"}
        else:
            print("ℹ️  Aucun nouveau rapport détecté sur le site")
            
            # Pas de nouveaux rapports, on garde les données actuelles
            return {
                "status": "success", 
                "message": "Scraping terminé. Aucun nouveau rapport trouvé sur le site EFK.",
                "new_count": current_total,
                "archived_count": archived_total
            }
                
    except Exception as e:
        print(f"❌ ERREUR MISE À JOUR: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.route('/test-scheduler')
def test_scheduler_route():
    """Tester le planificateur avec une tâche immédiate"""
    if not SCHEDULER_AVAILABLE:
        return {"status": "error", "message": "Planificateur non disponible"}
    
    try:
        # Programmer une tâche de test dans 1 minute
        test_time = (datetime.now() + timedelta(minutes=1)).strftime("%H:%M")
        schedule.every().day.at(test_time).do(update_reports_automatically).tag('test')
        
        return {
            "status": "success", 
            "message": f"Tâche de test programmée pour {test_time}",
            "test_time": test_time
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.route('/scheduler-status')
def scheduler_status():
    """Vérifier le statut du planificateur"""
    if not SCHEDULER_AVAILABLE:
        return {"status": "disabled", "message": "Module 'schedule' non installé"}
    
    try:
        jobs = schedule.get_jobs()
        if not jobs:
            return {"status": "no_jobs", "message": "Aucune tâche planifiée"}
        
        job_info = []
        for job in jobs:
            job_info.append({
                "next_run": job.next_run.strftime('%d.%m.%Y à %H:%M'),
                "job": str(job.job_func.__name__)
            })
        
        return {
            "status": "active",
            "message": f"{len(jobs)} tâche(s) planifiée(s)",
            "jobs": job_info
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def add_missing_reports():
    """Ajoute les 4 rapports manquants aux archives"""
    try:
        # Charger les données existantes
        new_reports, archived_reports = load_efk_data()
        
        # Liste des rapports à ajouter (URLs allemandes)
        report_urls = [
            "https://www.efk.admin.ch/prufung/aufsicht-uber-die-subventionen-an-fachgesellschaften-der-schweizerischen-akademie-der-geistes-und-sozialwissenschaften/",
            "https://www.efk.admin.ch/prufung/biodiversitaetsbeitraege-in-der-landwirtschaft/",
            "https://www.efk.admin.ch/prufung/nachpruefung-der-evaluation-der-internationalen-rechtshilfe-in-strafsachen/",
            "https://www.efk.admin.ch/prufung/massnahmen-im-bereich-selbstbestimmtes-wohnen-fur-menschen-mit-behinderungen/"
        ]
        
        # Traductions des titres
        titles = {
            "aufsicht-uber-die-subventionen-an-fachgesellschaften-der-schweizerischen-akademie-der-geistes-und-sozialwissenschaften": {
                "de": "Aufsicht über die Subventionen an Fachgesellschaften der Schweizerischen Akademie der Geistes- und Sozialwissenschaften",
                "fr": "Surveillance des subventions aux sociétés spécialisées de l'Académie suisse des sciences humaines et sociales",
                "it": "Sorveglianza sui sussidi alle società specializzate dell'Accademia svizzera di scienze umane e sociali"
            },
            "biodiversitaetsbeitraege-in-der-landwirtschaft": {
                "de": "Biodiversitätsbeiträge in der Landwirtschaft",
                "fr": "Contributions à la biodiversité dans l'agriculture",
                "it": "Contributi per la biodiversità in agricoltura"
            },
            "nachpruefung-der-evaluation-der-internationalen-rechtshilfe-in-strafsachen": {
                "de": "Nachprüfung der Evaluation der internationalen Rechtshilfe in Strafsachen",
                "fr": "Contrôle de l'évaluation de l'entraide judiciaire internationale en matière pénale",
                "it": "Verifica della valutazione dell'assistenza giudiziaria internazionale in materia penale"
            },
            "massnahmen-im-bereich-selbstbestimmtes-wohnen-fur-menschen-mit-behinderungen": {
                "de": "Massnahmen im Bereich selbstbestimmtes Wohnen für Menschen mit Behinderungen",
                "fr": "Mesures dans le domaine du logement autonome pour les personnes en situation de handicap",
                "it": "Misure nell'ambito dell'abitare autonomo per le persone con disabilità"
            }
        }
        
        # Catégories prédéfinies pour chaque rapport
        categories = {
            "aufsicht-uber-die-subventionen-an-fachgesellschaften-der-schweizerischen-akademie-der-geistes-und-sozialwissenschaften": "Éducation et recherche",
            "biodiversitaetsbeitraege-in-der-landwirtschaft": "Environnement et agriculture",
            "nachpruefung-der-evaluation-der-internationalen-rechtshilfe-in-strafsachen": "Justice et sécurité",
            "massnahmen-im-bereich-selbstbestimmtes-wohnen-fur-menschen-mit-behinderungen": "Affaires sociales et santé"
        }
        
        # Dates de publication (approximatives)
        publication_dates = {
            "aufsicht-uber-die-subventionen-an-fachgesellschaften-der-schweizerischen-akademie-der-geistes-und-sozialwissenschaften": "01.07.2025",
            "biodiversitaetsbeitraege-in-der-landwirtschaft": "28.06.2025",
            "nachpruefung-der-evaluation-der-internationalen-rechtshilfe-in-strafsachen": "25.06.2025",
            "massnahmen-im-bereich-selbstbestimmtes-wohnen-fur-menschen-mit-behinderungen": "20.06.2025"
        }
        
        added_count = 0
        
        # Pour chaque rapport
        for url in report_urls:
            # Extraire l'identifiant du rapport
            report_id = url.split('/')[-2]
            
            # Vérifier si le rapport existe déjà dans les archives
            report_exists = False
            for lang in archived_reports:
                for report in archived_reports[lang]:
                    if report_id in report.get('url', ''):
                        report_exists = True
                        break
                if report_exists:
                    break
            
            if not report_exists:
                # Ajouter le rapport dans les trois langues
                for lang in ["de", "fr", "it"]:
                    # Construire l'URL dans la langue cible
                    if lang == "de":
                        report_url = url
                    else:
                        lang_prefix = "fr/audit" if lang == "fr" else "it/verifica"
                        report_url = url.replace("/prufung/", f"/{lang_prefix}/")
                    
                    # Créer le rapport
                    report = {
                        "id": f"{report_id}-{lang}",
                        "title": titles[report_id][lang],
                        "url": report_url,
                        "language": lang,
                        "publication_date": publication_dates[report_id],
                        "category": categories[report_id],
                        "is_new": True,
                        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        "report_number": f"EFK-{report_id[:8].upper()}",
                        "summary": f"Rapport sur {titles[report_id][lang].lower()}"
                    }
                    
                    # Ajouter aux archives
                    if lang not in archived_reports:
                        archived_reports[lang] = []
                    archived_reports[lang].append(report)
                    added_count += 1
        
        if added_count > 0:
            # Sauvegarder les archives mises à jour
            if save_reports_data(new_reports, archived_reports):
                return {
                    "status": "success",
                    "message": f"{added_count} nouveaux rapports ajoutés avec succès dans les trois langues.",
                    "added": added_count
                }
            else:
                return {"status": "error", "message": "Erreur lors de la sauvegarde des archives"}
        else:
            return {"status": "info", "message": "Aucun nouveau rapport à ajouter"}
            
    except Exception as e:
        return {"status": "error", "message": f"Erreur: {str(e)}"}

@app.route('/add-missing-reports')
def add_missing_reports_route():
    """Route pour ajouter les rapports manquants"""
    return jsonify(add_missing_reports())

@app.route('/clean-archives')
def clean_archives():
    """Nettoyer les archives des rapports de test ET supprimer les doublons spécifiques"""
    try:
        new_reports, archived_reports = load_efk_data()
        
        # Compter les rapports avant nettoyage
        before_count = sum(len(reports) for reports in archived_reports.values())
        
        # Nettoyer les archives (suppression des rapports de test et des doublons)
        cleaned_archives = clean_test_reports(archived_reports)
        
        # Ajouter les rapports manquants
        add_result = add_missing_reports()
        if add_result["status"] == "success":
            # Recharger les données après ajout
            new_reports, cleaned_archives = load_efk_data()
        
        # Supprimer les doublons spécifiques
        seen = {}
        for lang in cleaned_archives:
            unique_reports = []
            for report in cleaned_archives[lang]:
                # Créer une clé unique basée sur l'URL et la langue
                key = (report.get('url', ''), report.get('language', ''))
                if key not in seen:
                    seen[key] = True
                    unique_reports.append(report)
            cleaned_archives[lang] = unique_reports
        
        # Compter après nettoyage
        after_count = sum(len(reports) for reports in cleaned_archives.values())
        removed_count = before_count - after_count + (add_result.get('added', 0) if 'added' in add_result else 0)
        
        # Sauvegarder les archives nettoyées
        if save_reports_data(new_reports, cleaned_archives):
            result = {
                "status": "success", 
                "message": f"Archives nettoyées et mises à jour ! {removed_count} rapports modifiés.",
                "before": before_count,
                "after": after_count,
                "removed": removed_count,
                "added": add_result.get('added', 0) if 'added' in add_result else 0
            }
            
            # Ajouter les détails de l'ajout des rapports manquants
            if 'message' in add_result:
                result['add_message'] = add_result['message']
                
            return result
        else:
            return {"status": "error", "message": "Erreur lors de la sauvegarde"}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.route('/add-new-reports-to-archives')
def add_new_reports_to_archives():
    """Ajouter les 4 nouveaux rapports dans les archives (synchronisés dans les 3 langues)"""
    try:
        print("➕ AJOUT DES NOUVEAUX RAPPORTS DANS LES ARCHIVES")
        print("=" * 60)
        
        # Charger les données actuelles
        new_reports, archived_reports = load_efk_data()
        
        # Obtenir TOUS les rapports connus (incluant les 4 nouveaux)
        all_known_reports = {
            'de': get_known_reports_for_language('de'),
            'fr': get_known_reports_for_language('fr'),
            'it': get_known_reports_for_language('it')
        }
        
        added_count = 0
        
        # Ajouter tous les rapports connus dans les archives (s'ils n'y sont pas déjà)
        for lang in ['fr', 'de', 'it']:
            existing_numbers = {report.get('number', '') for report in archived_reports.get(lang, [])}
            
            for known_report in all_known_reports[lang]:
                report_number = known_report.get('number', '')
                
                # Vérifier si le rapport n'est pas déjà dans les archives
                if report_number not in existing_numbers:
                    archived_reports[lang].append(known_report)
                    added_count += 1
                    print(f"   ➕ Ajouté {lang.upper()}: #{report_number} - {known_report.get('title', 'Sans titre')[:50]}...")
                else:
                    print(f"   ⚠️  Déjà présent {lang.upper()}: #{report_number}")
        
        # Sauvegarder les archives mises à jour
        if save_reports_data(new_reports, archived_reports):
            archived_total = sum(len(reports) for reports in archived_reports.values())
            
            print(f"✅ AJOUT TERMINÉ")
            print(f"➕ {added_count} nouveaux rapports ajoutés")
            print(f"📁 {archived_total} rapports archivés au total")
            
            return {
                "status": "success",
                "message": f"Ajout réussi ! {added_count} nouveaux rapports ajoutés aux archives (synchronisés dans les 3 langues).",
                "added_count": added_count,
                "archived_total": archived_total
            }
        else:
            return {"status": "error", "message": "Erreur lors de la sauvegarde"}
            
    except Exception as e:
        print(f"❌ Erreur ajout rapports: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
    """Supprimer les faux rapports de navigation (comme 'Zurück zu den Publikationen')"""
    try:
        print("🧹 NETTOYAGE DES FAUX RAPPORTS DE NAVIGATION")
        print("=" * 60)
        
        # Charger les données actuelles
        new_reports, archived_reports = load_efk_data()
        
        # Mots-clés de navigation à supprimer
        navigation_keywords = [
            'zurück', 'retour', 'back', 'navigation', 'menu', 'home',
            'publikationen', 'rapports', 'berichte', 'publications',
            'übersicht', 'aperçu', 'panoramica', 'alle berichte'
        ]
        
        cleaned_new = {'fr': [], 'de': [], 'it': []}
        cleaned_archived = {'fr': [], 'de': [], 'it': []}
        
        removed_count = 0
        
        # Nettoyer les nouveaux rapports
        for lang in ['fr', 'de', 'it']:
            for report in new_reports.get(lang, []):
                title = report.get('title', '').lower()
                
                # Vérifier si c'est un lien de navigation
                is_navigation = any(keyword in title for keyword in navigation_keywords)
                
                if is_navigation:
                    print(f"🗑️  SUPPRESSION nouveau rapport navigation {lang.upper()}: {report.get('title', 'Sans titre')[:60]}...")
                    removed_count += 1
                else:
                    cleaned_new[lang].append(report)
        
        # Nettoyer les rapports archivés
        for lang in ['fr', 'de', 'it']:
            for report in archived_reports.get(lang, []):
                title = report.get('title', '').lower()
                
                # Vérifier si c'est un lien de navigation
                is_navigation = any(keyword in title for keyword in navigation_keywords)
                
                if is_navigation:
                    print(f"🗑️  SUPPRESSION rapport archivé navigation {lang.upper()}: {report.get('title', 'Sans titre')[:60]}...")
                    removed_count += 1
                else:
                    cleaned_archived[lang].append(report)
        
        # Sauvegarder les données nettoyées
        if save_reports_data(cleaned_new, cleaned_archived):
            new_total = sum(len(reports) for reports in cleaned_new.values())
            archived_total = sum(len(reports) for reports in cleaned_archived.values())
            
            print(f"✅ NETTOYAGE TERMINÉ")
            print(f"🗑️  {removed_count} faux rapports supprimés")
            print(f"📊 Résultat: {new_total} nouveaux rapports, {archived_total} archivés")
            
            return {
                "status": "success",
                "message": f"Nettoyage réussi ! {removed_count} faux rapports de navigation supprimés.",
                "removed_count": removed_count,
                "new_count": new_total,
                "archived_count": archived_total
            }
        else:
            return {"status": "error", "message": "Erreur lors de la sauvegarde"}
            
    except Exception as e:
        print(f"❌ Erreur nettoyage: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}
    """Tester le scraping réel pour diagnostiquer les problèmes"""
    try:
        print("🧪 TEST DU SCRAPING RÉEL AVEC FILTRAGE")
        print("=" * 50)
        
        # Test de connectivité de base
        test_urls = [
            'https://www.efk.admin.ch/',
            'https://www.efk.admin.ch/prufung/',
            'https://www.efk.admin.ch/fr/audit/',
            'https://www.efk.admin.ch/it/verifica/'
        ]
        
        connectivity_results = {}
        
        for url in test_urls:
            try:
                print(f"🔍 Test de connectivité: {url}")
                response = requests.get(url, timeout=10, headers={
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
                })
                connectivity_results[url] = {
                    'status': response.status_code,
                    'size': len(response.content),
                    'title': None
                }
                
                if response.status_code == 200:
                    soup = BeautifulSoup(response.content, 'html.parser')
                    title = soup.find('title')
                    if title:
                        connectivity_results[url]['title'] = title.get_text().strip()
                
                print(f"   ✅ {response.status_code} - {len(response.content)} bytes")
                
            except Exception as e:
                connectivity_results[url] = {'status': 'error', 'error': str(e)}
                print(f"   ❌ Erreur: {e}")
        
        # Test du scraping réel AVEC filtrage amélioré
        print("\n🕷️ Test du scraping de rapports avec filtrage...")
        scraped_reports = scrape_efk_reports()
        
        # Debug supplémentaire : tester le filtrage sur des exemples connus
        print("\n🔍 Test du filtrage sur des exemples:")
        test_links = [
            {"title": "Zurück zu den Publikationen", "language": "de"},
            {"title": "Retour aux publications", "language": "fr"},
            {"title": "Schweizerische Post AG: Umsetzung wesentlicher Empfehlungen", "language": "de"},
            {"title": "Audit de la chaussée roulante", "language": "fr"},
        ]
        
        for test_link in test_links:
            title = test_link["title"]
            lang = test_link["language"]
            
            # Simuler le filtrage
            navigation_words = {
                'de': ['zurück', 'back', 'weiter', 'next', 'navigation', 'startseite', 'home', 'menü', 'menu', 'übersicht', 'alle publikationen'],
                'fr': ['retour', 'back', 'suivant', 'next', 'navigation', 'accueil', 'home', 'menu', 'aperçu', 'toutes publications'],
                'it': ['indietro', 'back', 'avanti', 'next', 'navigation', 'home', 'menu', 'panoramica', 'tutte pubblicazioni']
            }
            
            nav_words = navigation_words.get(lang, [])
            is_navigation = any(nav_word in title.lower() for nav_word in nav_words)
            
            result = "🚫 FILTRÉ" if is_navigation else "✅ GARDÉ"
            print(f"   {result} ({lang.upper()}): {title}")
        
        # Compter les résultats
        total_scraped = sum(len(reports) for reports in scraped_reports.values())
        
        # Préparer le résultat
        result = {
            "status": "success",
            "connectivity": connectivity_results,
            "scraped_reports": {
                "total": total_scraped,
                "by_language": {
                    lang: len(reports) for lang, reports in scraped_reports.items()
                },
                "sample_titles": {}
            }
        }
        
        # Ajouter des exemples de titres APRÈS filtrage
        for lang, reports in scraped_reports.items():
            if reports:
                result["scraped_reports"]["sample_titles"][lang] = [
                    report.get('title', 'Sans titre')[:60] for report in reports[:3]
                ]
        
        print(f"\n📊 RÉSULTATS DU TEST AVEC FILTRAGE:")
        print(f"   🌐 Connectivité: {len([r for r in connectivity_results.values() if r.get('status') == 200])}/{len(test_urls)} URLs accessibles")
        print(f"   📋 Rapports scrapés APRÈS filtrage: {total_scraped} total")
        for lang, count in result["scraped_reports"]["by_language"].items():
            print(f"      - {lang.upper()}: {count} rapports")
            
            # Afficher les titres trouvés
            if lang in result["scraped_reports"]["sample_titles"]:
                for i, title in enumerate(result["scraped_reports"]["sample_titles"][lang]):
                    print(f"         {i+1}. {title}...")
        
        return result
        
    except Exception as e:
        print(f"❌ Erreur test scraping: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

@app.route('/send-custom-message', methods=['POST'])
def send_custom_message():
    try:
        data = request.json
        message = data.get('message', '')
        
        if not message.strip():
            return {"status": "error", "message": "Message vide"}
        
        return send_threema_message(TEST_THREEMA_ID, message)
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.route('/trigger-update')
def trigger_update():
    """Déclencher manuellement une mise à jour des rapports"""
    print("🔄 Déclenchement manuel de la mise à jour...")
    try:
        update_reports_automatically()
        return jsonify({"status": "success", "message": "Mise à jour déclenchée avec succès"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/send-test')
def send_test():
    message = f"""🧪 Test EFK/CDF Scraper

✅ Système opérationnel
🕐 {datetime.now().strftime('%d.%m.%Y à %H:%M')}

Gateway: {THREEMA_GATEWAY_ID}
Test réussi !"""
    
    return send_threema_message(TEST_THREEMA_ID, message)

# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def get_available_port(start_port, max_attempts=10):
    """Trouve un port disponible à partir du port de départ"""
    for port in range(start_port, start_port + max_attempts):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('0.0.0.0', port))
                return port
        except OSError:
            continue
    raise OSError(f"Aucun port disponible entre {start_port} et {start_port + max_attempts - 1}")

def signal_handler(sig, frame):
    """Gère les signaux d'arrêt"""
    print("\n\n🛑 Arrêt du serveur...")
    sys.exit(0)

# Enregistrer le gestionnaire de signal
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

# =============================================================================
# POINT D'ENTRÉE PRINCIPAL
# =============================================================================

if __name__ == '__main__':
    try:
        # Trouver un port disponible
        port = get_available_port(DEFAULT_PORT, MAX_PORT_ATTEMPTS)
        
        print("\n" + "="*80)
        print("🎨 EFK Scraper AVEC SCRAPING RÉEL")
        print("📊 Système de nouveaux rapports / archives activé")
        print("🕷️ Scraping automatique du site EFK/CDF activé")
        print("📝 Édition de messages Threema activée" if THREEMA_GATEWAY_ID and THREEMA_GATEWAY_SECRET else "⚠️  Threema non configuré")
        print("="*80 + "\n")
        
        # Configurer le planificateur
        if 'schedule' in globals():
            print("⏰ Configuration de la planification automatique...")
            if setup_scheduler():
                print("✅ Planification configurée avec succès")
                
                # Démarrer le planificateur en arrière-plan
                scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
                scheduler_thread.start()
                print("🚀 Planificateur démarré en arrière-plan")
                print("📅 Prochaines mises à jour: Lundi 23h05 et Mercredi 23h05")
            else:
                print("❌ Échec configuration planification")
        else:
            print("⚠️  Planification désactivée - problème avec le module 'schedule'")
        
        print("\n" + "="*60)
        print(f"🌐 Application prête - Accédez à http://127.0.0.1:{port}")
        print("🕷️ Scraping réel du site EFK/CDF disponible")
        print("="*60 + "\n")
        
        # Démarrer le serveur Flask
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
        
    except Exception as e:
        print(f"\n❌ Erreur critique: {e}")
        import traceback
        traceback.print_exc()
        print("Veuillez vérifier les logs pour plus de détails.")
        sys.exit(1)