# Guide de Sauvegarde GitHub - nod_n8n

## 📦 Repository GitHub

**URL:** https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git

## 🚀 Premier Push (Déjà effectué)

### Script Automatique

Un script PowerShell `push-to-github.ps1` a été créé pour automatiser le processus.

**Exécution:**

```powershell
.\push-to-github.ps1
```

### Commandes Manuelles (Alternative)

```powershell
# 1. Se positionner dans le projet
cd h:\nod_n8n

# 2. Ajouter tous les fichiers
git add .

# 3. Créer un commit
git commit -m "Premier push - Sauvegarde nod_n8n - $(Get-Date -Format 'dd.MM.yyyy')"

# 4. Configurer le repository distant
git remote set-url origin https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git

# 5. Vérifier la configuration
git remote -v

# 6. Voir la branche actuelle
git branch

# 7. Push vers GitHub
git push -u origin main
```

## 🔄 Sauvegardes Futures

Pour les sauvegardes suivantes, utilisez ce processus simplifié:

```powershell
# 1. Vérifier les modifications
git status

# 2. Ajouter les fichiers modifiés
git add .

# 3. Commit avec message descriptif
git commit -m "Description des modifications - $(Get-Date -Format 'dd.MM.yyyy')"

# 4. Push vers GitHub
git push
```

## 📝 Bonnes Pratiques

### Messages de Commit

- **Fonctionnalité:** `feat: Ajout de la fonctionnalité X`
- **Correction:** `fix: Correction du bug Y`
- **Documentation:** `docs: Mise à jour de la documentation`
- **Style:** `style: Amélioration du style CSS`
- **Refactoring:** `refactor: Restructuration du code Z`
- **Test:** `test: Ajout des tests pour W`
- **Configuration:** `chore: Mise à jour des dépendances`

### Workflow Recommandé

1. **Travailler localement**

   ```powershell
   # Faire vos modifications
   # Tester votre code
   ```

2. **Vérifier avant de commiter**

   ```powershell
   git status          # Voir les fichiers modifiés
   git diff            # Voir les changements détaillés
   ```

3. **Commiter régulièrement**

   ```powershell
   git add .
   git commit -m "Message descriptif"
   ```

4. **Pusher régulièrement**
   ```powershell
   git push
   ```

## 🔐 Authentification GitHub

### Première fois

Lors du premier push, GitHub vous demandera de vous authentifier:

**Option 1: Personal Access Token (Recommandé)**

1. Allez sur GitHub → Settings → Developer settings → Personal access tokens
2. Générez un nouveau token avec les permissions `repo`
3. Utilisez ce token comme mot de passe lors du push

**Option 2: GitHub CLI**

```powershell
# Installer GitHub CLI
winget install GitHub.cli

# S'authentifier
gh auth login
```

### Sauvegarder les Identifiants

```powershell
# Windows Credential Manager sauvegarde automatiquement vos identifiants
# après le premier login réussi
```

## 🌿 Gestion des Branches

### Créer une nouvelle branche

```powershell
git checkout -b nouvelle-fonctionnalite
```

### Lister les branches

```powershell
git branch -a
```

### Changer de branche

```powershell
git checkout main
```

### Fusionner une branche

```powershell
git checkout main
git merge nouvelle-fonctionnalite
```

## 📊 Commandes Utiles

### Voir l'historique

```powershell
git log --oneline --graph --all
```

### Annuler des modifications

```powershell
# Annuler les modifications non commitées
git restore fichier.js

# Annuler le dernier commit (sans perdre les modifications)
git reset --soft HEAD~1

# Annuler le dernier commit (en perdant les modifications)
git reset --hard HEAD~1
```

### Mettre à jour depuis GitHub

```powershell
git pull origin main
```

## 🆘 Résolution de Problèmes

### Conflit lors du push

```powershell
# 1. Récupérer les dernières modifications
git pull origin main

# 2. Résoudre les conflits dans les fichiers
# 3. Ajouter les fichiers résolus
git add .

# 4. Finaliser la fusion
git commit -m "Résolution des conflits"

# 5. Push
git push
```

### Voir la configuration actuelle

```powershell
git config --list
git remote -v
```

## 📌 Informations du Projet

- **Nom du projet:** nod_n8n
- **Repository origin:** nod original (n8n-io/nod)
- **Repository cible:** sekadalle2024/nod_n8n_client_V0_13.11.26
- **Branche principale:** main
- **Premier push:** 13.11.2026

---

**Note:** Ce guide est spécifique au projet nod_n8n et au repository GitHub configuré.
