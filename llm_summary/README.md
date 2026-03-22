# Prototype: Résumé des débats via LLM

⚠️ **Branche expérimentale** - Ne pas merger sans validation complète.

## Prérequis

1. Python 3.8+
2. Clé API OpenAI

## Installation

```bash
cd llm_summary

# Créer et activer l'environnement virtuel
python3 -m venv venv
source venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt
```

## Configuration

Exporter ta clé API OpenAI (ne jamais la committer !) :

```bash
export OPENAI_API_KEY="sk-..."
```

## Usage

```bash
python summarize_debates.py <business_number>
```

### Exemples

```bash
# Résumer les débats sur l'objet 22.3877
python summarize_debates.py 22.3877

# Résumer les débats sur le budget 2016
python summarize_debates.py 15.041
```

## Coût estimé

- Modèle: `gpt-4o-mini`
- ~0.001-0.005 CHF par résumé (selon longueur des débats)

## Prochaines étapes

- [ ] Intégration dans l'interface web
- [ ] Cache des résumés générés
- [ ] Support multilingue (FR/DE/IT)
