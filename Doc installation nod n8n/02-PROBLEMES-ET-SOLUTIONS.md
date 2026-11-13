# Problèmes Rencontrés et Solutions

## 🔴 Problème 1 : Version de Node.js insuffisante

### Symptôme

```
Use Node.js 24.21.0 or newer.
```

### Cause

- Node.js 22.22.0 était déjà installé via nvm
- Nod nécessite Node.js >= 24.21.0

### Solution ✅

```powershell
nvm install 24.21.0
nvm use 24.21.0
node --version  # Vérification
```

### Résultat

Node.js 24.21.0 installé et actif, coexistant avec la version 22.22.0 pour les autres projets.

---

## 🔴 Problème 2 : Docker non accessible dans le PATH

### Symptôme

```
docker : Le terme «docker» n'est pas reconnu comme nom d'applet de commande
```

### Cause

- Docker Desktop installé en mode "per-user"
- Chemin d'installation : `C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\`
- Le PATH n'était pas mis à jour dans le terminal actif

### Solutions Tentées

#### ❌ Solution 1 (échec) : Rafraîchir le PATH dans le terminal

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```

**Résultat** : N'a pas fonctionné, Docker toujours non trouvé

#### ❌ Solution 2 (échec) : Modifier dynamiquement le PATH

```powershell
$env:Path += ";C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin"
```

**Résultat** : Fonctionne dans le terminal actuel mais pas hérité par les sous-processus

#### ✅ Solution 3 (succès) : Utiliser le chemin complet

```powershell
& "C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe" --version
```

**Résultat** : Fonctionne parfaitement

#### ✅ Solution 4 (succès permanent) : Redémarrer le terminal

1. Fermer complètement PowerShell
2. Redémarrer PowerShell
3. Docker est maintenant dans le PATH automatiquement

### Résultat Final

Docker accessible via `docker` directement après redémarrage du terminal.

---

## 🔴 Problème 3 : Erreur "spawn pnpm ENOENT" dans script start.mjs

### Symptôme

```
spawn pnpm ENOENT
ELIFECYCLE  Command failed with exit code 1.
```

### Cause

Le script `scripts/start.mjs` utilise `spawn('pnpm', ...)` qui ne trouve pas `pnpm` dans le PATH des sous-processus créés par Node.js.

### Solutions Tentées

#### ❌ Solution 1 (échec) : Script PowerShell avec PATH modifié

```powershell
$env:Path = "C:\Users\LEADER\AppData\Local\nvm\v24.21.0;$env:Path"
$env:Path = "C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin;$env:Path"
pnpm start
```

**Résultat** : Les variables d'environnement ne sont pas héritées par `spawn()`

#### ❌ Solution 2 (échec) : Installation globale de pnpm avec npm

```powershell
npm install -g pnpm@10.34.5
```

**Résultat** : pnpm déjà installé, conflit avec Corepack

#### ✅ Solution 3 (succès) : Installer manuellement puis lancer directement

1. `pnpm install` - Installation des dépendances
2. `pnpm run build` - Compilation
3. Configurer l'environnement manuellement
4. Lancer Docker Compose manuellement
5. Lancer le serveur directement : `pnpm exec tsx src/server/index.ts`

### Résultat Final

Contournement du script `start.mjs` en exécutant les étapes séparément.

---

## 🔴 Problème 4 : Erreur Docker "docker-credential-desktop not found"

### Symptôme

```
error getting credentials - err: exec: "docker-credential-desktop": executable file not found in %PATH%
```

### Cause

Docker Desktop utilise `credsStore: "desktop"` dans `~/.docker/config.json`, mais le helper n'est pas dans le PATH lors du build.

### Solution ✅

Modifier `C:\Users\LEADER\.docker\config.json` :

```json
{
    "auths": {},
    "currentContext": "desktop-linux",
    ...
}
```

**Supprimer la ligne** : `"credsStore": "desktop",`

### Résultat

Les builds Docker fonctionnent sans erreur de credentials.

---

## 🔴 Problème 5 : Erreur DNS "getaddrinfo EAI_AGAIN registry.npmjs.org"

### Symptôme

```
FetchError: request to https://registry.npmjs.org/@tiptap/extension-link/-/extension-link-3.33.0.tgz failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org
```

### Cause

Docker Desktop avec WSL 2 ne pouvait pas résoudre les DNS pour accéder à npm.

### Solutions Tentées

#### ✅ Solution 1 : Créer fichier .wslconfig

Créer `C:\Users\LEADER\.wslconfig` :

```ini
[wsl2]
networkingMode=mirrored
dnsTunneling=true
firewall=true
autoProxy=true
```

#### ✅ Solution 2 : Configurer Docker Desktop Network Settings

- Aller dans Settings → Network
- Activer "Enable host networking"
- Sélectionner "IPv4 only" dans "Default networking mode"
- Cliquer sur "Apply & Restart"

#### ✅ Solution 3 : Redémarrer Docker Desktop

1. Fermer Docker Desktop complètement
2. Relancer Docker Desktop
3. Attendre qu'il soit complètement démarré

### Résultat Final

Après redémarrage, Docker peut accéder à npm et les builds fonctionnent.

---

## 🔴 Problème 6 : Erreur "Illegal option -" dans install-rtk.sh

### Symptôme

```
/tmp/install-rtk.sh: 1: set: Illegal option -
exit code: 2
```

### Cause

Le script `src/providers/docker/install-rtk.sh` utilise `set -eu` (syntaxe bash), mais le Dockerfile l'exécute avec `sh` (POSIX shell).

### Solution ✅

Modifier `Dockerfile.workspace` ligne 3 :

```dockerfile
# AVANT
RUN sh /tmp/install-rtk.sh

# APRÈS
RUN bash /tmp/install-rtk.sh
```

### Résultat

Le script s'exécute correctement avec bash.

---

## 🔴 Problème 7 : Variables d'environnement non héritées dans processus background

### Symptôme

Les processus lancés en arrière-plan avec `control_pwsh_process` ne reçoivent pas les variables d'environnement définies.

### Cause

L'outil `control_pwsh_process` de Kiro lance un nouveau processus PowerShell isolé.

### Solution ✅

Créer un script PowerShell autonome qui définit les variables en interne :

```powershell
# build-docker.ps1
$env:NOD_POSTGRES_PASSWORD = "..."
$env:NOD_DATA_ROOT = "..."
$env:DATABASE_URL = "..."
docker compose up -d --build --wait
```

Puis lancer : `powershell -ExecutionPolicy Bypass -File build-docker.ps1`

### Résultat

Les variables sont correctement définies dans le contexte du script.

---

## 🔴 Problème 8 : Timeout lors du build Docker (10 minutes)

### Symptôme

```
Command timed out after 600000ms
```

### Cause

Le build Docker initial prend plus de 10 minutes (construction de 3 images complexes).

### Solution ✅

Augmenter le timeout à 20 minutes (1,200,000 ms) ou 30 minutes (1,800,000 ms) :

```powershell
# Dans l'outil execute_pwsh
timeout: 1800000  # 30 minutes
```

Ou lancer manuellement dans le terminal de l'utilisateur (pas de timeout).

### Résultat

Le build se termine avec succès.

---

## 🟡 Problème 9 : Avertissement "pnpm approve-builds"

### Symptôme

```
╭──────────────────────────────────────────────────────────╮
│ Some packages want to run build scripts upon install.   │
│ Run "pnpm approve-builds" to pick which should be        │
│ allowed to run scripts.                                  │
╰──────────────────────────────────────────────────────────╯
```

### Packages concernés

- `@whiskeysockets/baileys`
- `onnxruntime-node`

### Solution

Ce n'est **pas critique** pour le fonctionnement de Nod. Les scripts de build peuvent être approuvés plus tard si nécessaire :

```powershell
pnpm approve-builds
```

### Résultat

Nod fonctionne sans problème malgré l'avertissement.

---

## 🔴 Problème 10 : Erreur CRLF dans les scripts shell (CRITIQUE)

### Symptôme

```
/tmp/install-rtk.sh: line 2: $'\r': command not found
sha256sum: invalid option -- '
syntax error: unexpected end of file
exit code: 2
```

### Cause

**Fins de ligne Windows (CRLF)** dans les scripts shell au lieu de fins de ligne Unix (LF).

Lors du clone Git sur Windows, les fichiers `.sh` ont été convertis avec des fins de ligne CRLF (`\r\n`), mais Docker/Linux ne comprend que LF (`\n`).

### Fichiers Affectés

- `src/providers/docker/install-rtk.sh`
- `src/providers/docker/workspace-network.sh`

### Solution ✅

Réécrire les fichiers avec fins de ligne LF uniquement.

**Méthode 1** : Avec Kiro (automatique)

```typescript
// Utiliser fs_write pour réécrire le fichier
// fs_write crée automatiquement des fichiers avec LF
```

**Méthode 2** : Avec VSCode

1. Ouvrir le fichier
2. Cliquer sur "CRLF" en bas à droite
3. Sélectionner "LF"
4. Sauvegarder

**Méthode 3** : Avec PowerShell

```powershell
$content = Get-Content "src/providers/docker/install-rtk.sh" -Raw
$content = $content -replace "`r`n", "`n"
[System.IO.File]::WriteAllText("src/providers/docker/install-rtk.sh", $content, [System.Text.UTF8Encoding]::new($false))
```

### Prévention Future

Créer `.gitattributes` à la racine :

```gitattributes
*.sh text eol=lf
*.ts text eol=lf
*.js text eol=lf
```

### Résultat

Après correction, le build Docker réussit.

---

## 📊 Résumé des Solutions

| Problème                   | Solution Efficace          | Alternative                    |
| -------------------------- | -------------------------- | ------------------------------ |
| Node.js < 24.21            | `nvm install 24.21.0`      | Installer Node.js officiel     |
| Docker non trouvé          | Redémarrer terminal        | Chemin complet vers docker.exe |
| spawn pnpm ENOENT          | Lancer manuellement        | Modifier PATH système          |
| docker-credential-desktop  | Supprimer `credsStore`     | -                              |
| DNS Docker                 | .wslconfig + restart       | DNS manuel dans Docker         |
| install-rtk.sh error       | `sh` → `bash`              | -                              |
| Variables env non héritées | Script autonome .ps1       | Définir en dur dans code       |
| Timeout build              | Augmenter timeout / manuel | -                              |
| approve-builds warning     | Ignorer (non critique)     | `pnpm approve-builds`          |

---

## 🎯 Points Clés pour Éviter les Problèmes

1. **Toujours utiliser Node.js 24.21.0** via `nvm use 24.21.0`
2. **Redémarrer le terminal** après installation de Docker
3. **Docker Desktop doit être démarré** avant toute commande Docker
4. **Premier build Docker = 15-30 min** - normal et attendu
5. **Utiliser PowerShell natif** plutôt que les processus Kiro pour l'installation
6. **Vérifier .wslconfig** si problèmes réseau Docker
7. **Ne pas utiliser `pnpm start`** directement, préférer les étapes manuelles
