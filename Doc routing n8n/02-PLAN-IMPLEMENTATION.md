# 📋 Plan d'Implémentation - Routing Direct n8n

## Vue d'Ensemble

Ce document détaille le plan d'implémentation étape par étape pour ajouter le routing direct n8n.

---

## 🎯 Objectifs

1. ✅ Permettre l'exécution directe de workflows n8n (sans AI)
2. ✅ Coexistence avec le mode Agent actuel
3. ✅ Interface utilisateur pour choisir le mode
4. ✅ API complète pour intégrations externes
5. ✅ Compatible avec SaaS multi-utilisateurs

---

## 📊 Phases du Projet

```
Phase 1: Backend Core (API Direct) - 3-4 jours
   ↓
Phase 2: Frontend (Mode Selector) - 2-3 jours
   ↓
Phase 3: Intégration n8n - 2 jours
   ↓
Phase 4: Tests & Documentation - 1-2 jours
```

**Durée totale estimée** : 8-11 jours

---

## Phase 1 : Backend Core (3-4 jours)

### Étape 1.1 : Créer le N8n Client

**Fichier** : `src/server/n8n/client.ts`

**Actions** :

- [ ] Créer classe `N8nClient`
- [ ] Méthode `listWorkflows()`
- [ ] Méthode `getWorkflow(id)`
- [ ] Méthode `executeWorkflow(id, params)`
- [ ] Méthode `getExecution(id)`
- [ ] Gestion d'erreurs
- [ ] Tests unitaires

**Dépendances** :

```bash
pnpm add axios
pnpm add -D @types/axios
```

**Variables d'environnement** (.env) :

```env
N8N_URL=http://localhost:5678
N8N_API_KEY=your_api_key_here
```

**Test** :

```typescript
// Test connexion n8n
const client = new N8nClient(process.env.N8N_URL!, process.env.N8N_API_KEY!);
const workflows = await client.listWorkflows();
console.log('Workflows:', workflows);
```

---

### Étape 1.2 : Créer le Validator

**Fichier** : `src/server/direct/validator.ts`

**Actions** :

- [ ] Installer Joi : `pnpm add joi`
- [ ] Créer schéma `directWorkflowSchema`
- [ ] Fonction `validateWorkflowRequest()`
- [ ] Tests de validation

**Validation** :

```typescript
const result = validateWorkflowRequest({
  workflow: 'test-workflow',
  params: { key: 'value' },
});
console.assert(result.valid === true);
```

---

### Étape 1.3 : Créer le Direct Router

**Fichier** : `src/server/direct/router.ts`

**Actions** :

- [ ] Créer classe `DirectRouter`
- [ ] Méthode `execute(userId, request)`
- [ ] Méthode `listWorkflows(userId)`
- [ ] Méthode `getWorkflow(userId, workflowId)`
- [ ] Gestion permissions multi-tenant
- [ ] Logs structurés

**Isolation Multi-Tenant** :

```typescript
// Filtrer workflows par user
workflows.filter((w) => w.tags?.includes(`user_${userId}`));
```

---

### Étape 1.4 : Créer les Routes API

**Fichier** : `src/server/routes/direct.ts`

**Actions** :

- [ ] Router Express
- [ ] `POST /api/direct/execute`
- [ ] `GET /api/direct/workflows`
- [ ] `GET /api/direct/workflows/:id`
- [ ] `POST /api/direct/validate`
- [ ] Middleware auth
- [ ] Rate limiting

**Intégration dans `src/server/index.ts`** :

```typescript
import { directRouter } from './routes/direct';

app.use('/api/direct', directRouter);
```

---

### Étape 1.5 : Middleware Mode Router

**Fichier** : `src/server/middleware/mode-router.ts`

**Actions** :

- [ ] Créer middleware `modeRouterMiddleware`
- [ ] Détection mode depuis header/body/query
- [ ] Extension interface Request
- [ ] Tests

**Application** :

```typescript
// Routes qui supportent les 2 modes
app.use('/api/execute', modeRouterMiddleware, executeHandler);
```

---

## Phase 2 : Frontend (2-3 jours)

### Étape 2.1 : Composant Mode Selector

**Fichier** : `src/web/components/ModeSelector.tsx`

**Actions** :

- [ ] Radio buttons : Agent / Direct
- [ ] State management (useState)
- [ ] Persist choice (localStorage)
- [ ] Styling

**Code** :

```typescript
interface ModeSelectorProps {
  mode: 'agent' | 'direct';
  onChange: (mode: 'agent' | 'direct') => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({ mode, onChange }) => {
  return (
    <div className="mode-selector">
      <label>
        <input
          type="radio"
          value="agent"
          checked={mode === 'agent'}
          onChange={() => onChange('agent')}
        />
        Mode Agent AI
      </label>

      <label>
        <input
          type="radio"
          value="direct"
          checked={mode === 'direct'}
          onChange={() => onChange('direct')}
        />
        Mode Direct n8n
      </label>
    </div>
  );
};
```

---

### Étape 2.2 : Formulaire Direct Mode

**Fichier** : `src/web/components/DirectWorkflowForm.tsx`

**Actions** :

- [ ] Select workflow (dropdown)
- [ ] Champs dynamiques (basés sur workflow schema)
- [ ] JSON editor avancé (Monaco Editor)
- [ ] Bouton Execute
- [ ] Affichage résultat

**Code** :

```typescript
interface DirectWorkflowFormProps {
  workflows: WorkflowInfo[];
  onExecute: (request: DirectWorkflowRequest) => void;
}

export const DirectWorkflowForm: React.FC<DirectWorkflowFormProps> = ({
  workflows,
  onExecute
}) => {
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [params, setParams] = useState({});

  return (
    <form onSubmit={handleSubmit}>
      <select
        value={selectedWorkflow}
        onChange={(e) => setSelectedWorkflow(e.target.value)}
      >
        <option value="">-- Choisir un workflow --</option>
        {workflows.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>

      <JsonEditor
        value={params}
        onChange={setParams}
      />

      <button type="submit">Exécuter</button>
    </form>
  );
};
```

---

### Étape 2.3 : Intégration Chat

**Fichier** : `src/web/pages/ChatPage.tsx`

**Modifications** :

- [ ] Ajouter `<ModeSelector>` en haut
- [ ] Conditionnel : afficher input text (agent) ou form (direct)
- [ ] Appel API différent selon mode
- [ ] Affichage résultats adapté

**Code** :

```typescript
const [mode, setMode] = useState<'agent' | 'direct'>('agent');

return (
  <div className="chat-page">
    <ModeSelector mode={mode} onChange={setMode} />

    {mode === 'agent' ? (
      <AgentChatInput onSubmit={handleAgentSubmit} />
    ) : (
      <DirectWorkflowForm
        workflows={workflows}
        onExecute={handleDirectExecute}
      />
    )}

    <MessagesDisplay messages={messages} />
  </div>
);
```

---

### Étape 2.4 : API Client

**Fichier** : `src/web/lib/direct-api.ts`

**Actions** :

- [ ] Fonction `executeDirectWorkflow()`
- [ ] Fonction `listWorkflows()`
- [ ] Fonction `getWorkflow(id)`
- [ ] Gestion erreurs
- [ ] Types TypeScript

**Code** :

```typescript
import { api } from './api';

export async function executeDirectWorkflow(
  request: DirectWorkflowRequest,
): Promise<DirectWorkflowResponse> {
  const response = await api.post('/api/direct/execute', request);
  return response.data;
}

export async function listWorkflows(): Promise<WorkflowInfo[]> {
  const response = await api.get('/api/direct/workflows');
  return response.data.workflows;
}
```

---

## Phase 3 : Intégration n8n (2 jours)

### Étape 3.1 : Configuration n8n

**Actions** :

- [ ] Installer n8n localement (si pas déjà fait)
- [ ] Générer API key
- [ ] Configurer webhook URL
- [ ] Tester connexion

**Installation n8n** :

```bash
# Via Docker
docker run -d --name n8n \
  -p 5678:5678 \
  -e N8N_BASIC_AUTH_ACTIVE=true \
  -e N8N_BASIC_AUTH_USER=admin \
  -e N8N_BASIC_AUTH_PASSWORD=admin \
  n8nio/n8n

# Via npm (alternative)
npm install -g n8n
n8n start
```

**Générer API Key** :

1. Accéder à n8n : http://localhost:5678
2. Settings → API
3. Créer une API Key
4. Copier dans `.env`

---

### Étape 3.2 : Créer Workflows Test

**Actions** :

- [ ] Workflow simple : "hello-world"
- [ ] Workflow avec params : "analyse-financiere"
- [ ] Workflow async : "rapport-long"
- [ ] Taguer avec `user_1` pour tests

**Exemple Workflow "hello-world"** :

```json
{
  "name": "hello-world",
  "nodes": [
    {
      "name": "Start",
      "type": "n8n-nodes-base.start",
      "position": [250, 300]
    },
    {
      "name": "Set",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {
              "name": "message",
              "value": "Hello from n8n!"
            }
          ]
        }
      },
      "position": [450, 300]
    }
  ],
  "connections": {
    "Start": {
      "main": [[{ "node": "Set", "type": "main", "index": 0 }]]
    }
  },
  "tags": ["user_1"]
}
```

---

### Étape 3.3 : Tests d'Intégration

**Actions** :

- [ ] Test connexion n8n
- [ ] Test liste workflows
- [ ] Test exécution sync
- [ ] Test exécution async
- [ ] Test avec paramètres
- [ ] Test gestion erreurs

**Script de test** :

```typescript
// tests/integration/n8n-direct.test.ts
import { N8nClient } from '../../src/server/n8n/client';
import { DirectRouter } from '../../src/server/direct/router';

describe('N8n Direct Integration', () => {
  const client = new N8nClient(process.env.N8N_URL!, process.env.N8N_API_KEY!);

  test('should list workflows', async () => {
    const workflows = await client.listWorkflows();
    expect(workflows).toBeInstanceOf(Array);
  });

  test('should execute workflow', async () => {
    const router = new DirectRouter(process.env.N8N_URL!, process.env.N8N_API_KEY!);

    const result = await router.execute(1, {
      workflow: 'hello-world',
      params: {},
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('completed');
  });
});
```

---

## Phase 4 : Tests & Documentation (1-2 jours)

### Étape 4.1 : Tests Unitaires

**Fichiers à tester** :

- [ ] `src/server/n8n/client.ts`
- [ ] `src/server/direct/validator.ts`
- [ ] `src/server/direct/router.ts`
- [ ] `src/server/routes/direct.ts`

**Framework** : Jest

```bash
pnpm test -- --coverage
```

---

### Étape 4.2 : Tests E2E

**Scénarios** :

- [ ] User se connecte
- [ ] User switch vers mode Direct
- [ ] User liste les workflows
- [ ] User exécute un workflow simple
- [ ] User exécute un workflow avec params
- [ ] User voit le résultat
- [ ] User switch vers mode Agent

**Tool** : Playwright ou Cypress

---

### Étape 4.3 : Documentation Utilisateur

**Créer** : `docs/src/content/docs/features/direct-routing.mdx`

**Contenu** :

- Introduction
- Différences Agent vs Direct
- Quand utiliser quel mode
- Tutoriel pas à pas
- Exemples d'API
- Troubleshooting

---

### Étape 4.4 : API Documentation

**Créer** : `docs/src/content/docs/api/direct-routing.mdx`

**Contenu** :

- Endpoints disponibles
- Request/Response schemas
- Exemples curl
- Code snippets (TypeScript, Python, curl)
- Rate limits
- Error codes

---

## 🔄 Checklist Complète

### Backend

- [ ] N8nClient créé et testé
- [ ] Validator créé et testé
- [ ] DirectRouter créé et testé
- [ ] Routes API créées
- [ ] Middleware mode-router créé
- [ ] Integration dans server principal
- [ ] Rate limiting configuré
- [ ] Logs structurés ajoutés

### Frontend

- [ ] ModeSelector component créé
- [ ] DirectWorkflowForm créé
- [ ] Intégration dans ChatPage
- [ ] API client créé
- [ ] Types TypeScript ajoutés
- [ ] Styling CSS

### N8n

- [ ] n8n installé et configuré
- [ ] API key générée
- [ ] Workflows test créés
- [ ] Tags multi-tenant configurés
- [ ] Connexion testée

### Tests

- [ ] Tests unitaires backend (80%+ coverage)
- [ ] Tests unitaires frontend
- [ ] Tests d'intégration n8n
- [ ] Tests E2E
- [ ] Tests performance

### Documentation

- [ ] Documentation utilisateur
- [ ] Documentation API
- [ ] Exemples de workflows
- [ ] Guide troubleshooting
- [ ] README mis à jour

---

## 🚀 Déploiement

### Prérequis

- ✅ Docker build complet (en cours)
- ✅ SaaS multi-utilisateurs (optionnel mais recommandé)
- ✅ n8n instance configurée
- ✅ Variables d'environnement

### Étapes

1. **Tester en local** :

   ```bash
   # Backend
   pnpm exec tsx src/server/index.ts

   # Frontend (dev)
   pnpm run dev
   ```

2. **Build production** :

   ```bash
   pnpm run build
   ```

3. **Démarrer** :

   ```bash
   pnpm start
   ```

4. **Vérifier** :
   - http://localhost:4310/login
   - Se connecter
   - Tester mode Direct

---

## 📊 Métriques de Succès

- [ ] Latence mode Direct < 100ms (vs ~500ms Agent)
- [ ] Taux de succès > 95%
- [ ] 0 erreurs de sécurité
- [ ] Documentation complète
- [ ] Tests coverage > 80%
- [ ] Feedback utilisateurs positifs

---

## 🎯 Prochaine Étape

Commencer par **Phase 1, Étape 1.1** : Créer le N8nClient

**Voulez-vous que je commence l'implémentation maintenant ?**
