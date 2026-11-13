# 📖 Documentation Installation Nod n8n - LIRE EN PREMIER

## 📂 Contenu de la Documentation

Cette documentation complète vous guide à travers l'installation de Nod n8n depuis les sources sur Windows.

### 📚 Documents Disponibles

1. **[00-LIRE-EN-PREMIER.md](00-LIRE-EN-PREMIER.md)** ⬅️ _Vous êtes ici_
   - Vue d'ensemble
   - Index des documents
   - Ordre de lecture recommandé

2. **[01-RESUME-INSTALLATION.md](01-RESUME-INSTALLATION.md)** ⭐ _Commencer ici_
   - Résumé complet du processus
   - Prérequis installés
   - Configuration finale
   - Commandes de démarrage

3. **[02-PROBLEMES-ET-SOLUTIONS.md](02-PROBLEMES-ET-SOLUTIONS.md)** 🔧
   - Tous les problèmes rencontrés
   - Solutions détaillées (qui ont marché / pas marché)
   - Tableaux récapitulatifs

4. **[03-ARCHITECTURE-PROJET.md](03-ARCHITECTURE-PROJET.md)** 🏗️
   - Structure des dossiers
   - Architecture technique (Web, Desktop, Server, Docker)
   - Diagrammes et explications

5. **[04-GUIDE-DEVELOPPEMENT.md](04-GUIDE-DEVELOPPEMENT.md)** 💻
   - Comment modifier le projet
   - Exemples de code
   - Workflow de développement
   - Bonnes pratiques

6. **[05-ERREUR-CRLF-RESOLUTION.md](05-ERREUR-CRLF-RESOLUTION.md)** 🚨
   - Problème critique CRLF/LF
   - Solution détaillée
   - Prévention future

7. **[06-WORKSPACE-EXPLIQUE.md](06-WORKSPACE-EXPLIQUE.md)** 🏗️ _Nouveau !_
   - Qu'est-ce que le Workspace Docker
   - À quoi il sert et ce qu'il permet
   - Skills : comment ça marche
   - Comment installer des packages
   - Cas d'usage avancés

---

## 🎯 Ordre de Lecture Recommandé

### 📖 Si vous installez pour la première fois :

1. **[01-RESUME-INSTALLATION.md](01-RESUME-INSTALLATION.md)** - Vue d'ensemble
2. **[05-ERREUR-CRLF-RESOLUTION.md](05-ERREUR-CRLF-RESOLUTION.md)** - IMPORTANT : Corriger avant le build Docker
3. Suivre les commandes dans le résumé
4. En cas d'erreur → **[02-PROBLEMES-ET-SOLUTIONS.md](02-PROBLEMES-ET-SOLUTIONS.md)**

### 🔧 Si vous avez rencontré une erreur :

1. **[02-PROBLEMES-ET-SOLUTIONS.md](02-PROBLEMES-ET-SOLUTIONS.md)** - Chercher votre erreur
2. Si erreur CRLF → **[05-ERREUR-CRLF-RESOLUTION.md](05-ERREUR-CRLF-RESOLUTION.md)**

### 💻 Si vous voulez modifier le code :

1. **[03-ARCHITECTURE-PROJET.md](03-ARCHITECTURE-PROJET.md)** - Comprendre la structure
2. **[04-GUIDE-DEVELOPPEMENT.md](04-GUIDE-DEVELOPPEMENT.md)** - Guide pratique avec exemples

---

## ⚡ Commandes Rapides

### Démarrer Nod (une fois installé)

```powershell
cd h:\nod_n8n
nvm use 24.21.0
docker compose up -d
pnpm exec tsx src/server/index.ts
```

### Reconstruire après modifications

```powershell
# Web uniquement
pnpm run build

# Docker (si Dockerfile modifié)
docker compose up -d --build

# Tout
pnpm run build && docker compose up -d --build
```

---

## 🆘 Problèmes Fréquents

| Symptôme                    | Document                                       | Solution Rapide         |
| --------------------------- | ---------------------------------------------- | ----------------------- |
| `$'\r': command not found`  | [05-ERREUR-CRLF](05-ERREUR-CRLF-RESOLUTION.md) | Convertir scripts en LF |
| `docker: command not found` | [02-PROBLEMES](02-PROBLEMES-ET-SOLUTIONS.md)   | Redémarrer terminal     |
| `spawn pnpm ENOENT`         | [02-PROBLEMES](02-PROBLEMES-ET-SOLUTIONS.md)   | Lancer manuellement     |
| `getaddrinfo EAI_AGAIN`     | [02-PROBLEMES](02-PROBLEMES-ET-SOLUTIONS.md)   | Redémarrer Docker       |
| `Illegal option -`          | [05-ERREUR-CRLF](05-ERREUR-CRLF-RESOLUTION.md) | Problème CRLF           |

---

## 📊 État de l'Installation

### ✅ Complété

- [x] Node.js 24.21.0 installé (via nvm)
- [x] pnpm 10.34.5 configuré
- [x] Docker Desktop 29.9.3 installé
- [x] Repository cloné
- [x] Dépendances installées (895 packages)
- [x] Projet compilé (dist/ créé)
- [x] Fichier .env configuré
- [x] **Scripts shell corrigés (CRLF → LF)**
- [x] Dockerfile.workspace modifié (sh → bash)

### 🔄 En Cours

- [ ] Build Docker complet (15-30 min)
- [ ] Conteneurs démarrés
- [ ] Serveur Nod lancé

### 🎯 Prochaines Étapes

1. Relancer le build Docker :

   ```powershell
   docker compose up -d --build --wait --remove-orphans
   ```

2. Attendre la fin du build (15-30 minutes)

3. Vérifier les conteneurs :

   ```powershell
   docker ps
   ```

4. Démarrer le serveur :

   ```powershell
   pnpm exec tsx src/server/index.ts
   ```

5. Ouvrir dans le navigateur :
   ```
   http://localhost:4310/#access=<token>
   ```

---

## 🎓 Ressources Additionnelles

### Dans le Projet

- `AGENTS.md` - Règles et architecture officielle
- `CONTRIBUTING.md` - Guide de contribution
- `docs/src/content/docs/` - Documentation officielle

### Externes

- [Repository GitHub](https://github.com/n8n-io/nod.git)
- [Documentation officielle n8n](https://docs.n8n.io/)

---

## 📝 Notes Importantes

1. **Docker est obligatoire** - Impossible de faire fonctionner Nod sans Docker
2. **Premier build = 15-30 min** - Normal, les images sont mises en cache ensuite
3. **Node.js 24.21.0** - Toujours utiliser `nvm use 24.21.0` avant de travailler
4. **Fins de ligne** - Attention aux CRLF sur Windows (voir document 05)
5. **PATH Docker** - Peut nécessiter un redémarrage de terminal

---

## 🤝 Aide et Support

### Problème non documenté ?

1. Vérifier **[02-PROBLEMES-ET-SOLUTIONS.md](02-PROBLEMES-ET-SOLUTIONS.md)**
2. Regarder les logs : `docker compose logs -f`
3. Consulter `AGENTS.md` dans le projet

### Modifier la Documentation

Tous les documents sont en Markdown et peuvent être édités. N'hésitez pas à ajouter vos propres découvertes !

---

## 📅 Dernière Mise à Jour

- **Date** : 12 novembre 2026
- **Version Nod** : Latest (main branch)
- **Système** : Windows 10/11 AMD64
- **Docker** : 29.9.3 avec WSL 2

---

## ✨ Bon Développement !

Cette documentation a été créée pour vous accompagner dans l'installation et la modification de Nod n8n.

**Prochaine étape recommandée** : Lire **[01-RESUME-INSTALLATION.md](01-RESUME-INSTALLATION.md)** 📖
