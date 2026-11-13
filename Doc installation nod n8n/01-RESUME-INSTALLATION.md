# Résumé de l'Installation Nod n8n

## 📋 Informations du Projet

- **Projet** : Nod n8n (AI-powered development environment)
- **Repository** : https://github.com/n8n-io/nod.git
- **Dossier d'installation** : `h:\nod_n8n`
- **Date d'installation** : 12 novembre 2026
- **Système** : Windows (AMD64), Docker Desktop, WSL 2

---

## ✅ Prérequis Installés

### 1. Node.js

- **Version requise** : 24.21.0 minimum
- **Gestionnaire** : nvm-windows (version 1.2.2)
- **Versions installées** :
  - Node.js 22.22.0 (préexistante)
  - Node.js 24.21.0 (installée pour Nod) ✅
- **Commande d'activation** : `nvm use 24.21.0`

### 2. pnpm

- **Version requise** : 10.34.5
- **Installation** : Via Corepack (intégré à Node.js 24.21.0)
- **Commande d'activation** : `corepack enable`
- **Chemin** : `C:\nvm4w\nodejs\pnpm.ps1`

### 3. Git

- **Statut** : Préinstallé
- **Utilisation** : Clone du repository

### 4. Docker Desktop

- **Version installée** : 29.9.3 (build 5457199)
- **Type d'installation** : Per-user (utilisateur LEADER)
- **Chemin** : `C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin\`
- **Backend** : WSL 2 (recommandé)
- **Configuration** :
  - Enable host networking : ✅ Activé
  - Default networking mode : IPv4 only

### 5. WSL 2

- **Version par défaut** : 2
- **Statut** : Déjà installé et configuré
- **Fichier de config** : `C:\Users\LEADER\.wslconfig` (créé pour résoudre problèmes DNS)

---

## 📦 Étapes d'Installation Réalisées

### Étape 1 : Clone du Repository

```bash
git clone https://github.com/n8n-io/nod.git .
```

- **Durée** : ~2-3 minutes
- **Résultat** : 28,822 objets clonés (70.14 MB)

### Étape 2 : Activation de Corepack et pnpm

```bash
corepack enable
```

- **Résultat** : pnpm 10.34.5 téléchargé et activé

### Étape 3 : Installation des Dépendances

```bash
pnpm install
```

- **Durée** : 7 minutes 32 secondes
- **Packages installés** : 895 packages
- **Note** : Avertissement sur les scripts de build (non critique)

### Étape 4 : Compilation du Projet

```bash
pnpm run build
```

- **Durée** : 13 secondes
- **Résultat** :
  - 3,094 modules transformés
  - Build Vite réussi
  - Dossier `dist/web/` créé avec les assets compilés
  - Taille totale : ~5 MB (dont 2.1 MB pour index.js)

### Étape 5 : Configuration de l'Environnement

#### Fichier `.env` créé :

```env
PORT=4310
NOD_HOST=127.0.0.1
NOD_DATA_ROOT=.local
NOD_POSTGRES_PASSWORD=B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS
DATABASE_URL=postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod
```

#### Dossier de données créé :

```
h:\nod_n8n\.local\
```

### Étape 6 : Construction des Conteneurs Docker

```bash
docker compose up -d --build --wait --remove-orphans
```

- **Durée estimée** : 15-30 minutes (premier build)
- **Images construites** :
  1. PostgreSQL 17-alpine (image existante)
  2. Workspace (custom build - long)
  3. Browser (custom build - long)

---

## 🎯 Commandes de Démarrage Finales

### Démarrage complet :

```powershell
# 1. Naviguer vers le projet
cd h:\nod_n8n

# 2. Activer Node.js 24.21.0
nvm use 24.21.0

# 3. Configurer les variables d'environnement
$env:NOD_POSTGRES_PASSWORD="B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS"
$env:NOD_DATA_ROOT="h:\nod_n8n\.local"
$env:DATABASE_URL="postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod"

# 4. Démarrer les conteneurs Docker (si pas déjà lancés)
docker compose up -d

# 5. Démarrer le serveur Nod
pnpm exec tsx src/server/index.ts
```

### Accès à l'application :

```
http://localhost:4310/#access=<generated-token>
```

Le lien complet avec le token sera affiché dans le terminal au démarrage.

---

## 📊 Statut Final

- ✅ **Node.js 24.21.0** : Installé et fonctionnel
- ✅ **pnpm 10.34.5** : Installé et fonctionnel
- ✅ **Docker Desktop 29.9.3** : Installé et démarré
- ✅ **Repository cloné** : Complet
- ✅ **Dépendances installées** : 895 packages
- ✅ **Projet compilé** : dist/ créé avec succès
- ✅ **Configuration .env** : Créée
- 🔄 **Conteneurs Docker** : En cours de construction

---

## 📝 Notes Importantes

1. **Docker est obligatoire** - Impossible d'installer Nod sans Docker (4 conteneurs requis)
2. **Premier build long** - Le build Docker initial prend 15-30 minutes
3. **Builds suivants rapides** - Les images Docker sont mises en cache
4. **PATH Docker** - Docker n'est pas automatiquement dans le PATH après installation
5. **Version Node isolée** - Utiliser `nvm use 24.21.0` avant chaque session de développement

---

## 🔄 Commandes Utiles au Quotidien

### Démarrer Nod :

```powershell
cd h:\nod_n8n
nvm use 24.21.0
docker compose up -d
pnpm exec tsx src/server/index.ts
```

### Arrêter Nod :

```powershell
# Ctrl+C dans le terminal du serveur
docker compose stop
```

### Voir les logs Docker :

```powershell
docker compose logs -f
```

### Redémarrer les conteneurs :

```powershell
docker compose restart
```

### Reconstruire après modification du Dockerfile :

```powershell
docker compose up -d --build
```
