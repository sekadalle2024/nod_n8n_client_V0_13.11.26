# Guide de Développement et Modification

## 🎯 Objectifs de Développement

Ce guide vous aide à modifier :

1. **Interface Web** (React) - L'application dans le navigateur
2. **Application Desktop** (Electron) - L'app standalone
3. **Logique Serveur** (Node.js) - Le backend et l'API
4. **Conteneurs Docker** - L'environnement d'exécution

---

## 🚀 Workflow de Développement

### Démarrage Quotidien

```powershell
# 1. Ouvrir PowerShell et naviguer
cd h:\nod_n8n

# 2. Activer Node.js 24.21.0
nvm use 24.21.0

# 3. S'assurer que Docker est démarré
docker ps

# 4. Démarrer les conteneurs (si arrêtés)
docker compose up -d

# 5. Démarrer le serveur en mode développement (avec watch)
pnpm exec tsx watch src/server/index.ts
```

### Mode Développement vs Production

#### Mode Développement (recommandé pour modifications)

```powershell
# Serveur avec hot-reload
pnpm exec tsx watch src/server/index.ts

# Dans un autre terminal : build web en watch mode
pnpm run dev
```

**Avantages** :

- ✅ Hot-reload automatique (serveur redémarre à chaque modification)
- ✅ Vite dev server (HMR pour React)
- ✅ Source maps pour debug
- ✅ Pas de compilation nécessaire

#### Mode Production

```powershell
# Build complet
pnpm run build

# Démarrer en production
pnpm exec tsx src/server/index.ts
```

---

## 🎨 Modifier l'Interface Web (React)

### Structure des Fichiers Web

```
src/web/
├── app.tsx                   # 🎯 Point d'entrée React
├── components/               # 🎯 Composants réutilisables
│   ├── chat/                # Interface de conversation
│   │   ├── message.tsx     # Affichage d'un message
│   │   ├── input.tsx       # Champ de saisie
│   │   └── message-list.tsx # Liste des messages
│   ├── sidebar/             # Navigation latérale
│   ├── editor/              # Éditeur de code/texte
│   ├── settings/            # Panneau de configuration
│   └── ...
├── pages/                    # 🎯 Pages/Routes
│   ├── chat.tsx             # Page principale de chat
│   ├── apps.tsx             # Gestion des applications
│   ├── tasks.tsx            # Liste des tâches
│   ├── usage.tsx            # Statistiques
│   └── ...
├── lib/                      # Utilitaires
│   ├── api.ts               # Client API REST
│   ├── hooks/               # Custom React hooks
│   └── ...
├── styles.css                # 🎯 Styles globaux
└── theme.css                 # 🎯 Variables CSS (couleurs, espacements)
```

### Exemple 1 : Modifier les Couleurs

**Fichier** : `src/web/theme.css`

```css
:root {
  /* Modifier les couleurs principales */
  --color-primary: #007bff; /* Bleu par défaut */
  --color-secondary: #6c757d; /* Gris */
  --color-success: #28a745; /* Vert */
  --color-danger: #dc3545; /* Rouge */

  /* Mode sombre */
  --bg-primary: #1a1a1a;
  --text-primary: #ffffff;
}
```

**Résultat** : Les couleurs changent dans toute l'application.

### Exemple 2 : Ajouter un Nouveau Composant

**Créer** : `src/web/components/custom-button.tsx`

```typescript
import React from 'react';
import './custom-button.css';

interface CustomButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const CustomButton: React.FC<CustomButtonProps> = ({
  label,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button
      className={`custom-button custom-button--${variant}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};
```

**Utiliser** dans `src/web/app.tsx` :

```typescript
import { CustomButton } from './components/custom-button';

// Dans le JSX
<CustomButton
  label="Mon Bouton"
  onClick={() => console.log('Cliqué!')}
  variant="primary"
/>
```

### Exemple 3 : Modifier la Page de Chat

**Fichier** : `src/web/pages/chat.tsx` (ou composant similaire)

```typescript
import React, { useState } from 'react';

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);

  // Ajouter une fonction personnalisée
  const handleCustomAction = () => {
    // Votre logique ici
  };

  return (
    <div className="chat-page">
      {/* Ajouter un bouton personnalisé */}
      <button onClick={handleCustomAction}>
        Action Personnalisée
      </button>

      {/* Reste du composant */}
      <MessageList messages={messages} />
      <ChatInput onSend={...} />
    </div>
  );
};
```

### Build et Test

```powershell
# En développement (auto-reload)
pnpm run dev

# Build de production
pnpm run build

# Vérifier le build
ls dist/web/
```

---

## 🖥️ Modifier l'Application Desktop (Electron)

### Structure Desktop

```
desktop/
├── src/
│   ├── main/                 # Process principal Electron
│   │   ├── index.ts         # 🎯 Point d'entrée
│   │   ├── window.ts        # Gestion des fenêtres
│   │   └── ...
│   └── preload/              # Scripts preload (pont sécurisé)
│       └── index.ts         # 🎯 API exposée au renderer
└── scripts/
    └── build-ui.mjs          # Script de build
```

### Exemple 1 : Modifier la Taille de Fenêtre

**Fichier** : `desktop/src/main/window.ts` (ou similar)

```typescript
function createMainWindow() {
  const win = new BrowserWindow({
    width: 1400, // Modifier ici
    height: 900, // Modifier ici
    minWidth: 800, // Taille minimale
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  return win;
}
```

### Exemple 2 : Ajouter un Menu Personnalisé

**Fichier** : `desktop/src/main/menu.ts` (créer si n'existe pas)

```typescript
import { Menu, MenuItem } from 'electron';

export function createCustomMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Mon Action',
          click: () => {
            // Votre logique ici
            console.log('Action personnalisée déclenchée');
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quitter' },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}
```

### Exemple 3 : Accès Fichiers Locaux

**Fichier** : `desktop/src/preload/index.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// Exposer API sécurisée au renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Lire un fichier local
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),

  // Ouvrir un dialogue de sélection
  openFile: () => ipcRenderer.invoke('open-file-dialog'),

  // Votre fonction personnalisée
  customAction: (data: any) => ipcRenderer.invoke('custom-action', data),
});
```

**Dans le main process** : `desktop/src/main/index.ts`

```typescript
import { ipcMain, dialog } from 'electron';
import fs from 'fs/promises';

// Handler pour lire un fichier
ipcMain.handle('read-file', async (event, path) => {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return { success: true, content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handler pour ouvrir un dialogue
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Tous les fichiers', extensions: ['*'] }],
  });

  return result.filePaths[0];
});
```

**Utiliser dans React** : `src/web/components/file-picker.tsx`

```typescript
// Déclaration TypeScript
declare global {
  interface Window {
    electronAPI?: {
      readFile: (path: string) => Promise<any>;
      openFile: () => Promise<string>;
    };
  }
}

// Dans le composant
const handleOpenFile = async () => {
  if (window.electronAPI) {
    const filePath = await window.electronAPI.openFile();
    const result = await window.electronAPI.readFile(filePath);
    console.log(result.content);
  }
};
```

### Build Desktop

```powershell
# Build de l'application desktop
# TODO: Vérifier les scripts exacts dans package.json
pnpm run build:desktop
```

---

## ⚙️ Modifier le Serveur Node.js

### Structure Serveur

```
src/server/
├── index.ts                  # 🎯 Point d'entrée serveur
├── composition.ts            # Injection de dépendances
├── routes/                   # Routes API
│   ├── chat.ts              # Endpoints chat
│   ├── apps.ts              # Gestion apps connectées
│   └── ...
├── trust.ts                  # 🎯 Système de vérification sécurité
├── tools/                    # Outils disponibles pour l'AI
│   ├── bash.ts              # Exécution commandes
│   ├── read.ts              # Lecture fichiers
│   └── ...
├── db/                       # Accès base de données
└── local-files.ts            # 🎯 Gestion fichiers locaux
```

### Exemple 1 : Ajouter une Route API

**Créer** : `src/server/routes/custom.ts`

```typescript
import { Router } from 'express';

export const customRouter = Router();

// GET /api/custom/status
customRouter.get('/status', async (req, res) => {
  res.json({
    status: 'ok',
    message: 'Mon endpoint personnalisé',
  });
});

// POST /api/custom/action
customRouter.post('/action', async (req, res) => {
  const { data } = req.body;

  // Votre logique ici
  const result = await processCustomAction(data);

  res.json({ success: true, result });
});

async function processCustomAction(data: any) {
  // Implémentation
  return { processed: true, data };
}
```

**Enregistrer** dans `src/server/index.ts` :

```typescript
import { customRouter } from './routes/custom';

// Dans la configuration Express
app.use('/api/custom', customRouter);
```

### Exemple 2 : Ajouter un Tool pour l'AI

**Créer** : `src/server/tools/custom-tool.ts`

```typescript
export interface CustomToolInput {
  parameter: string;
  options?: Record<string, any>;
}

export async function customTool(input: CustomToolInput, context: ToolContext): Promise<string> {
  const { parameter, options } = input;

  // Validation
  if (!parameter) {
    throw new Error('Parameter is required');
  }

  // Votre logique ici
  const result = await performCustomOperation(parameter, options);

  // Retourner le résultat pour l'AI
  return `Operation completed: ${result}`;
}

async function performCustomOperation(param: string, opts?: any) {
  // Implémentation
  return `Processed: ${param}`;
}
```

**Enregistrer le tool** dans la composition :

```typescript
// src/server/composition.ts ou tools/index.ts
export const tools = {
  // ... outils existants
  custom_tool: customTool,
};
```

### Exemple 3 : Modifier le Trust Check

**⚠️ ATTENTION** : Modifier `trust.ts` affecte la sécurité !

**Fichier** : `src/server/trust.ts`

```typescript
// Ajouter une règle personnalisée
export async function trustCheck(params: TrustCheckParams): Promise<Decision> {
  const { action, userWords, arguments: args } = params;

  // Votre règle personnalisée
  if (action === 'my_custom_action') {
    // Toujours demander confirmation pour cette action
    return {
      allowed: false,
      requiresConfirmation: true,
      reason: 'Cette action nécessite votre confirmation',
    };
  }

  // Logique existante
  return await performStandardTrustCheck(params);
}
```

---

## 🐳 Modifier les Conteneurs Docker

### Fichiers Importants

- `compose.yaml` - Configuration Docker Compose
- `Dockerfile.workspace` - Image du workspace
- `Dockerfile.browser` - Image du navigateur
- `src/providers/docker/` - Scripts d'installation

### Exemple 1 : Ajouter un Package dans Workspace

**Fichier** : `Dockerfile.workspace`

```dockerfile
# Ligne existante (environ ligne 7)
RUN apt-get update && apt-get install -y --no-install-recommends \
    iptables python3 python-is-python3 python3-pip \
    # ... packages existants ...
    tesseract-ocr-nld \
    # AJOUTER VOS PACKAGES ICI
    vim \
    htop \
    && rm -rf /var/lib/apt/lists/*
```

**Rebuild** :

```powershell
docker compose build workspace
docker compose up -d workspace
```

### Exemple 2 : Modifier les Variables d'Environnement Docker

**Fichier** : `compose.yaml`

```yaml
services:
  workspace:
    # ... config existante
    environment:
      - MY_CUSTOM_VAR=valeur
      - ANOTHER_VAR=${ENV_VAR_FROM_HOST}
```

**Redémarrer** :

```powershell
docker compose up -d
```

### Exemple 3 : Changer le Port PostgreSQL

**Fichier** : `compose.yaml`

```yaml
services:
  postgres:
    # ... config existante
    ports:
      - '54330:5432' # Changer 54329 en 54330
```

**⚠️ Mettre à jour aussi** : `.env`

```env
DATABASE_URL=postgresql://nod:PASSWORD@127.0.0.1:54330/nod
```

---

## 🧪 Tests et Validation

### Lancer les Tests

```powershell
# Tests unitaires
pnpm test

# Tests d'une partie spécifique
pnpm test src/server/trust.test.ts

# Tests en mode watch
pnpm test --watch
```

### Linting et Formatage

```powershell
# Vérifier le code
pnpm run lint

# Formater automatiquement
pnpm run format

# Vérifier TypeScript
pnpm run typecheck
```

---

## 🔍 Debug et Logs

### Debug du Serveur

```typescript
// Ajouter des logs dans le code
console.log('Debug:', variable);

// Utiliser un debugger
import debug from 'debug';
const log = debug('nod:custom');
log('Message de debug');
```

**Activer les logs** :

```powershell
$env:DEBUG="nod:*"
pnpm exec tsx watch src/server/index.ts
```

### Debug React (Browser DevTools)

1. Ouvrir `http://localhost:4310`
2. F12 → Console
3. Ajouter des `console.log()` dans vos composants

### Logs Docker

```powershell
# Voir tous les logs
docker compose logs

# Suivre en temps réel
docker compose logs -f

# Logs d'un seul conteneur
docker compose logs workspace

# Dernières 100 lignes
docker compose logs --tail=100
```

---

## 📝 Bonnes Pratiques

### 1. Toujours Tester Localement

```powershell
# Avant de commit
pnpm run lint
pnpm run typecheck
pnpm test
```

### 2. Utiliser Git Correctement

```powershell
# Créer une branche pour chaque fonctionnalité
git checkout -b feature/ma-nouvelle-fonctionnalite

# Commits atomiques et descriptifs
git add src/web/components/custom-button.tsx
git commit -m "feat(web): Ajout du composant CustomButton"

# Push
git push origin feature/ma-nouvelle-fonctionnalite
```

### 3. Sauvegarder Régulièrement

```powershell
# Sauvegarder la base de données
docker compose exec postgres pg_dump -U nod nod > backup.sql

# Sauvegarder les données locales
xcopy h:\nod_n8n\.local h:\backup\nod_data /E /I
```

### 4. Documentation du Code

```typescript
/**
 * Description de la fonction
 * @param param1 - Description du paramètre
 * @returns Description du retour
 */
export function myFunction(param1: string): Result {
  // Implémentation
}
```

---

## 🚨 Points d'Attention Importants

### 🔐 Sécurité

1. **Ne jamais commit les secrets** dans `.env`
2. **Toujours valider les entrées utilisateur**
3. **Ne pas contourner le Trust Check** sans raison
4. **Utiliser HTTPS** en production

### ⚠️ Performance

1. **Optimiser les re-renders React** (useMemo, useCallback)
2. **Lazy load** les composants lourds
3. **Indexer** les requêtes DB fréquentes
4. **Limiter les appels AI** (coûteux)

### 🐛 Debugging

1. **Activer les source maps** en dev
2. **Logs structurés** avec contexte
3. **Error boundaries** en React
4. **Try/catch** dans les fonctions async

### 📦 Dépendances

1. **Vérifier les updates** : `pnpm outdated`
2. **Tester après update** : `pnpm update`
3. **Lock file** toujours commité
4. **Pas de dépendances non utilisées**

---

## 🔗 Ressources Supplémentaires

- **Documentation officielle** : `docs/src/content/docs/`
- **AGENTS.md** : Règles et architecture
- **CONTRIBUTING.md** : Guide de contribution
- **Code existant** : Meilleur exemple à suivre

---

## 💡 Prochaines Étapes

1. Explorer le code dans `src/web/` et `src/server/`
2. Faire une petite modification (ex: couleur)
3. Tester en local
4. Créer des composants réutilisables
5. Documenter vos changements
