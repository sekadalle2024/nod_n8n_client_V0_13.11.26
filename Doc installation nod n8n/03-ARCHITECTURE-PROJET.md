# Architecture du Projet Nod n8n

## 📁 Structure des Dossiers

```
h:\nod_n8n\
├── .git/                          # Dépôt Git
├── .github/                       # CI/CD et workflows GitHub
├── .local/                        # Données locales (créé au runtime)
│   └── workspaces/               # Espaces de travail isolés
├── deployment/                    # Scripts et configs de déploiement
├── desktop/                       # 🎯 APPLICATION DESKTOP
│   ├── scripts/                  # Scripts de build desktop
│   └── src/                      # Code spécifique desktop (Electron)
├── dist/                         # 🎯 BUILD WEB (généré par vite)
│   └── web/                      # Assets compilés pour le navigateur
├── docs/                         # 📚 Documentation officielle
│   └── src/content/docs/         # Pages markdown de la doc
├── evals/                        # Tests d'évaluation
├── node_modules/                 # Dépendances npm (895 packages)
├── patches/                      # Patches npm personnalisés
├── public/                       # Assets statiques publics
├── scripts/                      # Scripts utilitaires
│   ├── start.mjs                # Script de démarrage principal
│   └── local-database.ts        # Gestion base de données locale
├── src/                          # 🎯 CODE SOURCE PRINCIPAL
│   ├── ports/                   # Interfaces et abstractions
│   ├── providers/               # Implémentations concrètes
│   │   ├── docker/             # Configuration conteneurs Docker
│   │   ├── container-browser/  # Navigateur isolé
│   │   └── pi/                 # Intégration modèle AI
│   ├── server/                  # 🎯 SERVEUR NODE.JS
│   │   ├── index.ts            # Point d'entrée serveur
│   │   ├── composition.ts      # Injection de dépendances
│   │   ├── trust.ts            # Système de vérification sécurité
│   │   └── local-files.ts      # Gestion fichiers locaux
│   ├── shared/                  # Code partagé client/serveur
│   └── web/                     # 🎯 APPLICATION WEB (React)
│       ├── app.tsx             # Composant racine
│       ├── components/         # Composants React réutilisables
│       ├── pages/              # Pages de l'application
│       ├── lib/                # Bibliothèques utilitaires
│       └── styles.css          # Styles globaux
├── tests/                        # Tests unitaires et d'intégration
├── .env                          # 🔑 Configuration locale (créé)
├── .env.example                  # Template de configuration
├── compose.yaml                  # 🐳 Configuration Docker Compose
├── Dockerfile.browser            # Image Docker navigateur
├── Dockerfile.workspace          # Image Docker workspace
├── package.json                  # Dépendances et scripts npm
├── pnpm-lock.yaml               # Lock file pnpm
├── tsconfig.json                # Configuration TypeScript
└── vite.config.ts               # Configuration Vite (build web)
```

---

## 🏗️ Architecture Technique

### 1. Stack Technologique

#### Frontend (Web)

- **Framework** : React 18+ avec TypeScript
- **Build tool** : Vite 8.3.5
- **Styling** : CSS modules + Tailwind CSS
- **Composants UI** :
  - Radix UI (primitives accessibles)
  - Lucide React (icônes)
  - TipTap (éditeur riche)

#### Backend (Server)

- **Runtime** : Node.js 24.21.0
- **Langage** : TypeScript
- **Build** : tsx (TypeScript execution)
- **Base de données** : PostgreSQL 17
- **ORM** : Drizzle (probable, à vérifier)

#### Desktop

- **Framework** : Electron (probable)
- **Intégration** : Wrapper autour de l'app web

#### Infrastructure

- **Conteneurisation** : Docker + Docker Compose
- **Isolation** : 4 conteneurs séparés
- **Réseau** : Firewall réseau custom

---

## 🐳 Architecture Docker

### Conteneurs

```
┌─────────────────────────────────────────────────────────┐
│                    Host Machine                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │             Docker Compose Network                 │ │
│  │                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐              │ │
│  │  │  PostgreSQL  │  │  Workspace   │              │ │
│  │  │  Port: 54329 │  │  (Sandbox)   │              │ │
│  │  │              │  │  - Python    │              │ │
│  │  │  Database    │  │  - Node.js   │              │ │
│  │  │  Credentials │  │  - Git, etc. │              │ │
│  │  └──────────────┘  └──────────────┘              │ │
│  │         ▲                  ▲                       │ │
│  │         │                  │                       │ │
│  │  ┌──────┴──────────────────┴──────┐              │ │
│  │  │      Firewall Container        │              │ │
│  │  │   (Network isolation)          │              │ │
│  │  └───────────────┬─────────────────┘              │ │
│  │                  │                                 │ │
│  │         ┌────────┴────────┐                       │ │
│  │         │    Browser       │                       │ │
│  │         │  (Chromium +     │                       │ │
│  │         │   Xvfb)          │                       │ │
│  │         └──────────────────┘                       │ │
│  └─────────────────────────────────────────────────────┘ │
│                         ▲                                │
│                         │                                │
│              ┌──────────┴──────────┐                    │
│              │   Nod Server        │                    │
│              │   Node.js           │                    │
│              │   Port: 4310        │                    │
│              └─────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Rôles des Conteneurs

1. **PostgreSQL** (`nod-local-postgres-1`)
   - Stocke : Sessions, conversations, configurations, historique
   - Port : 54329 (exposé sur localhost)
   - Image : `postgres:17-alpine`

2. **Workspace** (`nod-local-workspace-1`)
   - Environnement d'exécution isolé pour les commandes utilisateur
   - Contient : Python, Node.js, Git, ripgrep, ffmpeg, LibreOffice, etc.
   - Utilisateurs séparés : `node` (principal), `nod-connected` (CLI connectés)
   - Isolation réseau via firewall

3. **Browser** (`nod-local-browser-1`)
   - Chromium headless avec Xvfb (X virtual framebuffer)
   - Agent-browser pour automation
   - Isolation complète des cookies et sessions

4. **Firewall** (intégré dans workspace)
   - Filtre réseau entre workspace et internet
   - Bloque accès aux adresses privées
   - Permet uniquement adresses publiques

---

## 🔐 Architecture de Sécurité

### Principes Clés (d'après AGENTS.md)

1. **Trust Check** (`src/server/trust.ts`)
   - Vérifie chaque action avant exécution
   - Utilise un modèle LLM pour décider
   - Quote les mots exacts de l'utilisateur qui autorisent l'action

2. **Isolation Multi-Couches**
   - Conteneurs Docker séparés
   - Utilisateurs système différents
   - Pas de clés API dans les conteneurs
   - Sandbox réseau avec firewall

3. **Vault** (Coffre-fort)
   - Chiffrement des mots de passe/tokens
   - Clé de chiffrement stockée hors conteneurs
   - Sur Windows : probablement Windows Credential Manager
   - Sur macOS : Keychain
   - Sur Linux : `vault/master-key` dans `.local/`

4. **Redaction** (Masquage)
   - Mots de passe/codes/numéros de carte masqués dans logs
   - Jamais retournés au modèle AI
   - Entrée privée via formulaires sécurisés

5. **One Thread Per Owner**
   - Une session = un utilisateur
   - Isolation complète entre utilisateurs
   - Pas de partage de workspace

---

## 🎨 Architecture Web (React)

### Structure de l'Application Web

```typescript
src/web/
├── app.tsx                    // Racine React
├── components/                // Composants réutilisables
│   ├── chat/                 // Interface de chat
│   ├── editor/               // Éditeur de texte
│   ├── sidebar/              // Navigation latérale
│   ├── settings/             // Panneau de configuration
│   └── ...
├── pages/                     // Routes principales
│   ├── apps.tsx              // Gestion des apps connectées
│   ├── tasks.tsx             // Liste des tâches
│   ├── usage.tsx             // Statistiques d'utilisation
│   └── ...
├── lib/                       // Utilitaires
│   ├── api.ts                // Client API
│   ├── analytics.ts          // Tracking usage
│   └── ...
└── styles.css                 // Styles globaux
```

### Flux de Données

```
User Input → React Component → API Call → Server Handler
                                               ↓
                                        Trust Check
                                               ↓
                                        Tool Execution
                                               ↓
                                    Docker Container / DB
                                               ↓
                                        Response
                                               ↓
                                        AI Model
                                               ↓
                                    React Update (useState)
```

---

## 🖥️ Architecture Desktop (Electron)

### Structure Desktop

```
desktop/
├── scripts/
│   └── build-ui.mjs          // Script de build
└── src/
    ├── main/                 // Process principal Electron
    │   ├── index.ts         // Point d'entrée
    │   └── ...
    └── preload/              // Preload scripts (sécurité)
        └── index.ts
```

### Différences Desktop vs Web

| Aspect                | Web                | Desktop                        |
| --------------------- | ------------------ | ------------------------------ |
| Accès fichiers locaux | ❌ Non             | ✅ Oui (via `local-files` API) |
| Installation          | Hébergement requis | Standalone                     |
| Mises à jour          | Automatiques       | Manuel ou auto-updater         |
| Sécurité              | Sandbox navigateur | Electron sandbox               |
| Notifications         | Web notifications  | OS natives                     |

---

## 🔄 Cycle de Vie d'une Requête

### 1. User → Chat

```typescript
// src/web/components/chat/input.tsx
const handleSubmit = async (message: string) => {
  await api.sendMessage({ content: message });
};
```

### 2. API → Server

```typescript
// src/server/routes/chat.ts (probable)
app.post('/api/chat/message', async (req, res) => {
  const { content } = req.body;
  // ...
});
```

### 3. Trust Check

```typescript
// src/server/trust.ts
const decision = await trustCheck({
  userWords: previousMessages,
  action: proposedAction,
  arguments: actionArgs,
});
```

### 4. Tool Execution

```typescript
// src/server/tools/
if (decision.allowed) {
  const result = await executeTool(action, args);
}
```

### 5. AI Model Response

```typescript
// src/providers/pi/
const response = await model.complete({
  messages: [...history, toolResult],
});
```

### 6. Update UI

```typescript
// src/web/components/chat/message.tsx
setMessages((prev) => [...prev, newMessage]);
```

---

## 📊 Base de Données PostgreSQL

### Tables Principales (d'après AGENTS.md)

- **turns** : Chaque message/action (session_id, withdrawn, proactive)
- **turn_events** : Événements d'exécution et outils
- **model_usage** : Comptabilité des coûts modèle
- **preferences** : Paramètres utilisateur (rules, local_keep_out, etc.)
- **memory** : Notes apprises (memory_learn)
- **schedules** : Tâches planifiées
- **vault** : Credentials chiffrés

### Migrations

Probablement gérées par Drizzle ou un outil similaire dans `src/server/db/` (à confirmer).

---

## 🔌 Système de Providers

### Architecture Modulaire

```typescript
// src/ports/ - Interfaces
interface LLMProvider {
  complete(messages: Message[]): Promise<Response>;
}

interface BrowserProvider {
  navigate(url: string): Promise<void>;
  click(selector: string): Promise<void>;
}

// src/providers/ - Implémentations
class OpenAIProvider implements LLMProvider { ... }
class AnthropicProvider implements LLMProvider { ... }
class ContainerBrowserProvider implements BrowserProvider { ... }
```

### Composition (Injection de Dépendances)

```typescript
// src/server/composition.ts
export function createComposition() {
  const llm = selectLLMProvider(env.LLM_PROVIDER);
  const browser = new ContainerBrowserProvider();
  const db = createDatabaseClient();

  return {
    llm,
    browser,
    db,
    // ...
  };
}
```

---

## 🧩 Points d'Extension pour Modifications

Voir le document `04-GUIDE-DEVELOPPEMENT.md` pour les détails sur comment modifier chaque partie.
