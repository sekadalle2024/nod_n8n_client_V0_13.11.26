# Erreur CRLF lors du Build Docker - RÉSOLU ✅

## 🔴 Erreur Rencontrée

```bash
> [workspace rtk 3/3] RUN bash /tmp/install-rtk.sh:
: invalid optionll-rtk.sh: line 1: set: -
set: usage: set [-abefhkmnptuvxBCEHPT] [-o option-name] [--] [-] [arg ...]
/tmp/install-rtk.sh: line 2: $'\r': command not found
sha256sum: invalid option -- '
Try 'sha256sum --help' for more information.
tar: 1\r: Invalid number of elements
/tmp/install-rtk.sh: line 20: syntax error: unexpected end of file
```

**Exit code:** 2

---

## 🔍 Analyse du Problème

### Symptômes

- `$'\r': command not found`
- `invalid option` sur des commandes valides
- `syntax error: unexpected end of file`

### Cause Racine

**Fins de ligne Windows (CRLF) dans les scripts shell Linux**

Quand Git clone un repository sur Windows, il peut convertir automatiquement les fins de ligne :

- **LF (Line Feed)** `\n` - Standard Unix/Linux/macOS
- **CRLF (Carriage Return + Line Feed)** `\r\n` - Standard Windows

Les conteneurs Docker tournent sous Linux et **ne comprennent pas** les caractères `\r` (Carriage Return).

### Fichiers Affectés

1. `src/providers/docker/install-rtk.sh` ❌
2. `src/providers/docker/workspace-network.sh` ❌

---

## ✅ Solution Appliquée

### Méthode : Réécriture des Fichiers

Les fichiers ont été réécrits avec Kiro en utilisant `fs_write`, qui crée automatiquement des fichiers avec fins de ligne Unix (LF).

**Fichiers corrigés :**

- ✅ `src/providers/docker/install-rtk.sh`
- ✅ `src/providers/docker/workspace-network.sh`

### Commande de Test

Après correction, relancer le build :

```powershell
docker compose up -d --build --wait --remove-orphans
```

---

## 🔧 Solutions Alternatives (pour référence)

### Solution 1 : dos2unix (si disponible)

```powershell
# Installer dos2unix (via WSL ou chocolatey)
choco install dos2unix

# Convertir les fichiers
dos2unix src/providers/docker/install-rtk.sh
dos2unix src/providers/docker/workspace-network.sh
```

### Solution 2 : PowerShell (manuel)

```powershell
# Lire le fichier, remplacer CRLF par LF
$content = Get-Content "src/providers/docker/install-rtk.sh" -Raw
$content = $content -replace "`r`n", "`n"
[System.IO.File]::WriteAllText("src/providers/docker/install-rtk.sh", $content, [System.Text.UTF8Encoding]::new($false))
```

### Solution 3 : VSCode

1. Ouvrir le fichier dans VSCode
2. En bas à droite, cliquer sur "CRLF"
3. Sélectionner "LF"
4. Sauvegarder (Ctrl+S)

### Solution 4 : Git Configuration (Préventif)

Configurer Git pour ne **pas** convertir les fins de ligne des fichiers `.sh` :

**Créer/modifier** `.gitattributes` à la racine du projet :

```gitattributes
# Forcer LF pour tous les scripts shell
*.sh text eol=lf

# Autres fichiers texte
*.ts text eol=lf
*.tsx text eol=lf
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
```

Puis re-cloner ou normaliser :

```powershell
# Supprimer les fichiers du cache Git
git rm --cached -r .

# Réappliquer les attributs
git reset --hard
```

---

## 📋 Checklist Post-Correction

- [x] `install-rtk.sh` converti en LF
- [x] `workspace-network.sh` converti en LF
- [ ] Build Docker relancé
- [ ] Build réussi sans erreur CRLF
- [ ] Conteneurs démarrés (postgres, workspace, browser)
- [ ] Serveur Nod lancé

---

## 🎯 Commandes pour Continuer

Maintenant que les scripts sont corrigés, relancez le build :

```powershell
# 1. Assurer que les variables d'environnement sont définies
cd h:\nod_n8n
nvm use 24.21.0
$env:NOD_POSTGRES_PASSWORD="B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS"
$env:NOD_DATA_ROOT="h:\nod_n8n\.local"
$env:DATABASE_URL="postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod"

# 2. Relancer le build Docker (15-30 minutes)
docker compose up -d --build --wait --remove-orphans
```

---

## 📝 Notes pour le Futur

1. **Toujours vérifier** les fins de ligne des scripts shell sur Windows
2. **Utiliser** `.gitattributes` pour éviter ce problème
3. **VSCode** affiche le type de fin de ligne en bas à droite
4. **Git Bash** peut aussi causer ce problème si mal configuré

---

## 🔗 Références

- [Git Documentation - gitattributes](https://git-scm.com/docs/gitattributes)
- [Stack Overflow - CRLF vs LF](https://stackoverflow.com/questions/1967370/git-replacing-lf-with-crlf)
- [GitHub - Dealing with line endings](https://docs.github.com/en/get-started/getting-started-with-git/configuring-git-to-handle-line-endings)
