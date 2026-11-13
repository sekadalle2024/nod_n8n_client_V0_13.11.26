# 🏗️ Architecture - Routing Direct n8n

## Vue d'Ensemble

Ce document détaille l'architecture technique du système de routing direct vers n8n.

---

## 🎨 Architecture Globale

```
┌───────────────────────────────────────────────────────────────┐
│                     Client (Browser/API)                      │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Mode Selector Component                                │  │
│  │  • Radio/Toggle: Agent / Direct                         │  │
│  │  • Form Builder (mode direct)                           │  │
│  │  • JSON Editor (advanced)                               │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────────┬──────────────────────────────────┘
                             │ HTTP Request
                             ↓
┌───────────────────────────────────────────────────────────────┐
│                  Express Server (Backend)                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Request Router Middleware                              │  │
│  │  • Detect mode from body/headers                        │  │
│  │  • Route to appropriate handler                         │  │
│  └──────────────┬─────────────────────┬────────────────────┘  │
│                 │                     │                        │
│        Mode: Agent            Mode: Direct                     │
│                 │                     │                        │
│  ┌──────────────▼───────────┐  ┌─────▼──────────────────┐    │
│  │  Agent Handler           │  │  Direct Router         │    │
│  │  (Existing)              │  │  (New Component)       │    │
│  │                          │  │                        │    │
│  │  • Pi Model Call         │  │  • JSON Validator      │    │
│  │  • Context Reasoning     │  │  • Workflow Resolver   │    │
│  │  • Tool Selection        │  │  • Params Builder      │    │
│  │  • Error Interpretation  │  │  • Direct n8n Call     │    │
│  └──────────────┬───────────┘  └─────┬──────────────────┘    │
│                 │                     │                        │
│                 └──────────┬──────────┘                        │
│                            │                                   │
│                 ┌──────────▼──────────┐                        │
│                 │  n8n Connector      │                        │
│                 │  • Authentication   │                        │
│                 │  • Workflow Exec    │                        │
│                 │  • Result Handling  │                        │
│                 └──────────┬──────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │ HTTP/Webhook
                             ↓
┌───────────────────────────────────────────────────────────────┐
│                       n8n Instance                            │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Workflow Execution                                     │  │
│  │  • analyse_financiere                                   │  │
│  │  • generer_rapport_audit                                │  │
│  │  • verifier_conformite                                  │  │
│  │  • ...                                                  │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 🔀 Composant: Request Router

### Responsabilité

Router les requêtes vers le bon handler (Agent ou Direct).

### Implémentation

**Fichier** : `src/server/middleware/mode-router.ts`

```typescript
import { Request, Response, NextFunction } from 'express';

export type ExecutionMode = 'agent' | 'direct';

export interface ModeRequest extends Request {
  executionMode: ExecutionMode;
}

/**
 * Middleware pour détecter et router le mode d'exécution
 */
export function modeRouterMiddleware(req: Request, res: Response, next: NextFunction): void {
  const modeReq = req as ModeRequest;

  // 1. Vérifier le header X-Execution-Mode
  const headerMode = req.headers['x-execution-mode'] as ExecutionMode;

  // 2. Vérifier le body.mode
  const bodyMode = req.body?.mode as ExecutionMode;

  // 3. Vérifier query param ?mode=
  const queryMode = req.query?.mode as ExecutionMode;

  // Priorité: header > body > query > default (agent)
  modeReq.executionMode = headerMode || bodyMode || queryMode || 'agent';

  // Valider le mode
  if (!['agent', 'direct'].includes(modeReq.executionMode)) {
    return res.status(400).json({
      error: 'Invalid execution mode',
      validModes: ['agent', 'direct'],
    });
  }

  next();
}
```

---

## 🎯 Composant: Direct Router

### Responsabilité

Gérer les requêtes en mode direct (sans AI).

### Architecture Interne

```
DirectRouter
├── Validator (validation schéma)
├── WorkflowResolver (résolution workflow)
├── ParamsBuilder (construction paramètres)
├── N8nExecutor (exécution)
└── ResponseFormatter (formatage réponse)
```

### Implémentation

**Fichier** : `src/server/direct/router.ts`

```typescript
import { N8nClient } from '../n8n/client';
import { validateWorkflowRequest } from './validator';
import { resolveWorkflow } from './resolver';
import { buildParams } from './params-builder';

export interface DirectWorkflowRequest {
  workflow: string; // ID ou nom du workflow
  params?: Record<string, any>; // Paramètres optionnels
  async?: boolean; // Exécution async (défaut: false)
  timeout?: number; // Timeout en ms (défaut: 60000)
  webhookWait?: boolean; // Attendre résultat webhook
}

export interface DirectWorkflowResponse {
  success: boolean;
  executionId: string;
  status: 'completed' | 'running' | 'failed';
  data?: any;
  error?: string;
  duration?: number;
}

export class DirectRouter {
  private n8nClient: N8nClient;

  constructor(n8nUrl: string, n8nToken: string) {
    this.n8nClient = new N8nClient(n8nUrl, n8nToken);
  }

  /**
   * Exécuter un workflow en mode direct
   */
  async execute(userId: number, request: DirectWorkflowRequest): Promise<DirectWorkflowResponse> {
    // 1. Valider la requête
    const validation = validateWorkflowRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    // 2. Résoudre le workflow (par nom ou ID)
    const workflow = await resolveWorkflow(this.n8nClient, request.workflow, userId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${request.workflow}`);
    }

    // 3. Construire les paramètres
    const params = buildParams(workflow, request.params || {});

    // 4. Exécuter le workflow
    const startTime = Date.now();

    const execution = await this.n8nClient.executeWorkflow(workflow.id, params, {
      async: request.async || false,
      timeout: request.timeout || 60000,
      webhookWait: request.webhookWait || false,
    });

    const duration = Date.now() - startTime;

    // 5. Formater la réponse
    return {
      success: execution.status === 'completed',
      executionId: execution.id,
      status: execution.status,
      data: execution.data,
      error: execution.error,
      duration,
    };
  }

  /**
   * Lister les workflows disponibles
   */
  async listWorkflows(userId: number): Promise<WorkflowInfo[]> {
    return await this.n8nClient.listWorkflows(userId);
  }

  /**
   * Obtenir les détails d'un workflow
   */
  async getWorkflow(userId: number, workflowId: string): Promise<WorkflowDetails> {
    return await this.n8nClient.getWorkflow(workflowId, userId);
  }
}
```

---

## 🔍 Composant: Validator

### Responsabilité

Valider la structure des requêtes directes.

**Fichier** : `src/server/direct/validator.ts`

```typescript
import Joi from 'joi';

const directWorkflowSchema = Joi.object({
  workflow: Joi.string().required().description('Workflow ID or name'),

  params: Joi.object().optional().description('Workflow parameters'),

  async: Joi.boolean().optional().default(false).description('Execute asynchronously'),

  timeout: Joi.number()
    .optional()
    .default(60000)
    .min(1000)
    .max(300000)
    .description('Timeout in milliseconds'),

  webhookWait: Joi.boolean().optional().default(false).description('Wait for webhook response'),
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorkflowRequest(request: any): ValidationResult {
  const { error } = directWorkflowSchema.validate(request, {
    abortEarly: false,
  });

  if (error) {
    return {
      valid: false,
      errors: error.details.map((d) => d.message),
    };
  }

  return {
    valid: true,
    errors: [],
  };
}
```

---

## 🔗 Composant: N8n Client

### Responsabilité

Communiquer avec l'instance n8n.

**Fichier** : `src/server/n8n/client.ts`

```typescript
import axios, { AxiosInstance } from 'axios';

export interface WorkflowInfo {
  id: string;
  name: string;
  active: boolean;
  tags: string[];
}

export interface WorkflowDetails extends WorkflowInfo {
  nodes: any[];
  connections: any;
  settings: any;
  staticData: any;
}

export interface ExecutionOptions {
  async: boolean;
  timeout: number;
  webhookWait: boolean;
}

export interface ExecutionResult {
  id: string;
  status: 'completed' | 'running' | 'failed';
  data?: any;
  error?: string;
}

export class N8nClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Lister tous les workflows
   */
  async listWorkflows(userId?: number): Promise<WorkflowInfo[]> {
    const response = await this.client.get('/workflows');

    // Filtrer par userId si multi-tenant
    let workflows = response.data.data;

    if (userId) {
      workflows = workflows.filter((w: any) => w.tags?.includes(`user_${userId}`));
    }

    return workflows.map((w: any) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      tags: w.tags || [],
    }));
  }

  /**
   * Obtenir un workflow par ID
   */
  async getWorkflow(workflowId: string, userId?: number): Promise<WorkflowDetails> {
    const response = await this.client.get(`/workflows/${workflowId}`);
    const workflow = response.data;

    // Vérifier permissions si multi-tenant
    if (userId && !workflow.tags?.includes(`user_${userId}`)) {
      throw new Error('Unauthorized: workflow does not belong to user');
    }

    return {
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      tags: workflow.tags || [],
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    };
  }

  /**
   * Exécuter un workflow
   */
  async executeWorkflow(
    workflowId: string,
    params: Record<string, any>,
    options: ExecutionOptions,
  ): Promise<ExecutionResult> {
    // Mode async ou sync
    if (options.async) {
      return await this.executeAsync(workflowId, params);
    } else {
      return await this.executeSync(workflowId, params, options.timeout);
    }
  }

  /**
   * Exécution synchrone
   */
  private async executeSync(
    workflowId: string,
    params: Record<string, any>,
    timeout: number,
  ): Promise<ExecutionResult> {
    try {
      const response = await this.client.post(
        `/workflows/${workflowId}/execute`,
        { data: params },
        { timeout },
      );

      return {
        id: response.data.executionId,
        status: 'completed',
        data: response.data.data,
      };
    } catch (error: any) {
      return {
        id: error.response?.data?.executionId || 'unknown',
        status: 'failed',
        error: error.message,
      };
    }
  }

  /**
   * Exécution asynchrone
   */
  private async executeAsync(
    workflowId: string,
    params: Record<string, any>,
  ): Promise<ExecutionResult> {
    const response = await this.client.post(`/workflows/${workflowId}/execute`, {
      data: params,
      waitTill: 'false', // Ne pas attendre le résultat
    });

    return {
      id: response.data.executionId,
      status: 'running',
    };
  }

  /**
   * Obtenir le résultat d'une exécution
   */
  async getExecution(executionId: string): Promise<ExecutionResult> {
    const response = await this.client.get(`/executions/${executionId}`);
    const execution = response.data;

    return {
      id: execution.id,
      status: execution.finished ? 'completed' : 'running',
      data: execution.data,
      error: execution.stoppedAt ? execution.error : undefined,
    };
  }
}
```

---

## 📡 Routes API

### Endpoints

**Fichier** : `src/server/routes/direct.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../auth/middleware';
import { modeRouterMiddleware } from '../middleware/mode-router';
import { DirectRouter } from '../direct/router';

export const directRouter = Router();

// Middleware auth (toutes les routes protégées)
directRouter.use(authMiddleware);

// Initialiser Direct Router
const directRouterInstance = new DirectRouter(
  process.env.N8N_URL || 'http://localhost:5678',
  process.env.N8N_API_KEY || '',
);

/**
 * POST /api/direct/execute
 * Exécuter un workflow en mode direct
 */
directRouter.post('/execute', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const request = req.body;

    const result = await directRouterInstance.execute(userId, request);

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/direct/workflows
 * Lister les workflows disponibles
 */
directRouter.get('/workflows', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const workflows = await directRouterInstance.listWorkflows(userId);

    res.json({
      success: true,
      workflows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/direct/workflows/:id
 * Détails d'un workflow
 */
directRouter.get('/workflows/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const workflowId = req.params.id;

    const workflow = await directRouterInstance.getWorkflow(userId, workflowId);

    res.json({
      success: true,
      workflow,
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/direct/validate
 * Valider une requête sans l'exécuter
 */
directRouter.post('/validate', async (req, res) => {
  try {
    const { validateWorkflowRequest } = await import('../direct/validator');

    const validation = validateWorkflowRequest(req.body);

    res.json(validation);
  } catch (error: any) {
    res.status(500).json({
      valid: false,
      errors: [error.message],
    });
  }
});
```

---

## 🔐 Sécurité

### Authentication

- ✅ Même système auth que mode Agent (JWT)
- ✅ Utilisateur doit être authentifié
- ✅ Workflows filtrés par userId (multi-tenant)

### Authorization

- ✅ Un utilisateur ne peut exécuter que ses propres workflows
- ✅ Tags n8n : `user_{userId}` pour isolation
- ✅ Validation côté serveur

### Rate Limiting

```typescript
// src/server/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const directRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requêtes par minute
  keyGenerator: (req) => {
    return req.user?.userId.toString() || req.ip;
  },
  message: 'Too many direct requests, please try again later',
});

// Application dans routes
directRouter.use('/execute', directRateLimiter);
```

---

## 📊 Monitoring & Logs

### Logs Structurés

```typescript
// Log chaque exécution directe
logger.info('Direct workflow execution', {
  userId,
  workflowId,
  workflowName,
  params,
  duration,
  status,
  executionId,
});
```

### Métriques

- Nombre d'exécutions directes vs agent
- Latence moyenne par mode
- Taux de succès
- Workflows les plus utilisés

---

## 🎯 Prochaine Étape

→ Voir `02-PLAN-IMPLEMENTATION.md` pour le plan d'exécution détaillé
