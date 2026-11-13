# 🔀 Routing Direct n8n - Documentation

## 🎯 Objectif

Permettre aux utilisateurs de **choisir** entre :

1. **Mode Agent AI** (défaut actuel) : L'agent Nod interprète et exécute les demandes
2. **Mode Routing Direct n8n** : Appel direct aux workflows n8n sans interprétation AI

---

## 📋 Vue d'Ensemble

### Concept

```
┌─────────────────────────────────────────────────────┐
│              Interface Utilisateur                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  "Exécuter workflow: analyse_financiere"     │  │
│  │                                               │  │
│  │  [○] Mode Agent AI                           │  │
│  │  [●] Mode Routing Direct n8n                 │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↓
         ┌─────────────┴─────────────┐
         │                           │
    Mode Agent                  Mode Direct
         │                           │
         ↓                           ↓
┌──────────────────┐        ┌──────────────────┐
│   Agent Nod      │        │  API Router      │
│   (Pi Model)     │        │  (Sans AI)       │
│                  │        │                  │
│  • Interprète    │        │  • Parse JSON    │
│  • Raisonne      │        │  • Valide        │
│  • Contexte      │        │  • Route direct  │
└────────┬─────────┘        └────────┬─────────┘
         │                           │
         └─────────────┬─────────────┘
                       ↓
              ┌────────────────┐
              │  n8n Workflows │
              │  (Exécution)   │
              └────────────────┘
```

---

## 📚 Documents

| Fichier                      | Description                           |
| ---------------------------- | ------------------------------------- |
| `00-README.md`               | Ce fichier - Vue d'ensemble           |
| `01-ARCHITECTURE.md`         | Architecture technique détaillée      |
| `02-PLAN-IMPLEMENTATION.md`  | Plan d'implémentation étape par étape |
| `03-API-SPECIFICATION.md`    | Spécification de l'API de routing     |
| `04-EXEMPLES-UTILISATION.md` | Exemples d'usage et cas pratiques     |
| `05-COMPARAISON.md`          | Comparaison Agent vs Direct           |

---

## 💡 Cas d'Usage

### Mode Agent AI (Actuel)

**Avantages** :

- ✅ Interface naturelle (langage naturel)
- ✅ Compréhension du contexte
- ✅ Suggestions intelligentes
- ✅ Gestion d'erreurs avancée

**Inconvénients** :

- ❌ Latence (appels modèle AI)
- ❌ Coûts tokens
- ❌ Non déterministe
- ❌ Dépendance au modèle

**Exemple** :

```
User: "Analyse les finances du mois dernier"
Agent: [Comprend] → [Choisit workflow] → [Prépare params] → [Exécute] → [Interprète résultat]
```

---

### Mode Routing Direct n8n

**Avantages** :

- ✅ Rapide (pas d'AI)
- ✅ Pas de coût tokens
- ✅ Déterministe
- ✅ Prévisible

**Inconvénients** :

- ❌ Syntaxe stricte (JSON)
- ❌ Pas de compréhension naturelle
- ❌ Pas de suggestions
- ❌ Gestion erreurs basique

**Exemple** :

```json
{
  "mode": "direct",
  "workflow": "analyse_financiere",
  "params": {
    "mois": "2026-10",
    "format": "pdf"
  }
}
```

---

## 🔑 Fonctionnalités Clés

### 1. Sélecteur de Mode (UI)

**Interface Chat** :

- Toggle "Mode Agent" / "Mode Direct"
- Indication visuelle du mode actif
- Changement à la volée

**Interface Programmation** :

- API endpoint dédiée
- Headers ou query params pour mode
- Response types différents

---

### 2. API Router (Backend)

**Nouveau composant** :

- Parse requests directes
- Valide structure JSON
- Route vers n8n sans AI
- Retourne résultats bruts

**Endpoints** :

- `POST /api/direct/execute` - Exécution directe
- `GET /api/direct/workflows` - Liste workflows
- `GET /api/direct/workflows/:id` - Détails workflow
- `POST /api/direct/validate` - Validation params

---

### 3. Système Hybride

**Coexistence** :

- Les deux modes disponibles simultanément
- Switch à la volée par utilisateur
- Historique mixte (agent + direct)
- Logs séparés pour analyse

---

## 📊 Architecture Simplifiée

```typescript
// Requête utilisateur
interface UserRequest {
  mode: 'agent' | 'direct';
  content: string | DirectWorkflowRequest;
}

// Mode Direct
interface DirectWorkflowRequest {
  workflow: string; // ID ou nom du workflow
  params: Record<string, any>; // Paramètres
  async?: boolean; // Exécution async
  timeout?: number; // Timeout custom
}

// Routing
function handleRequest(req: UserRequest) {
  if (req.mode === 'agent') {
    return handleAgentMode(req.content as string);
  } else {
    return handleDirectMode(req.content as DirectWorkflowRequest);
  }
}
```

---

## 🚀 Implémentation

### Phase 1 : Backend (API Router)

- Créer endpoint `/api/direct`
- Parser et validator
- Connexion n8n direct
- Gestion erreurs

### Phase 2 : Frontend (UI)

- Toggle Mode Agent/Direct
- Formulaire pour mode direct
- Éditeur JSON (optionnel)
- Historique mode mixte

### Phase 3 : Intégration

- Middleware de routing
- Logs séparés
- Analytics par mode
- Tests end-to-end

### Phase 4 : Documentation

- Guide utilisateur
- API docs
- Exemples workflows
- Best practices

---

## 📈 Bénéfices

### Pour les Utilisateurs

**Développeurs** :

- Intégration directe dans scripts
- Pas de dépendance AI
- Performance prévisible
- Debugging facile

**Utilisateurs Business** :

- Interface naturelle (Agent)
- Rapidité (Direct) quand besoin
- Flexibilité maximale

---

### Pour le Système

**Performance** :

- Réduction latence (mode direct)
- Économie tokens AI
- Scalabilité améliorée

**Fiabilité** :

- Moins de points de défaillance
- Fallback possible (si AI down → direct)
- Audit trail clair

---

## ⚠️ Considérations

### Sécurité

- ✅ Validation stricte mode direct
- ✅ Permissions identiques (agent + direct)
- ✅ Rate limiting par mode
- ✅ Audit logs complets

### UX

- ⚠️ Formation utilisateurs (2 modes)
- ⚠️ Documentation claire
- ✅ Mode par défaut configuré (Agent)
- ✅ Switch intuitif

### Maintenance

- Workflows doivent être **auto-documentés**
- Schémas JSON maintenus
- Tests pour les 2 modes
- Monitoring séparé

---

## 🎯 Prochaines Étapes

1. **Lire** : `01-ARCHITECTURE.md` pour comprendre en détail
2. **Planifier** : `02-PLAN-IMPLEMENTATION.md` pour exécution
3. **Spécifier** : `03-API-SPECIFICATION.md` pour contrat API
4. **Tester** : `04-EXEMPLES-UTILISATION.md` pour cas pratiques

---

## 📞 Compatibilité

### Avec SaaS Multi-Utilisateurs

✅ **Compatible** : Le routing direct fonctionne avec le multi-tenant

- Chaque user a ses propres workflows n8n
- Isolation identique (schémas PostgreSQL)
- Mode sélectionnable par utilisateur

### Avec Installation Actuelle

✅ **Rétrocompatible** : Mode Agent reste le défaut

- Pas de breaking changes
- Mode direct = feature additive
- Peut être activé progressivement

---

**Créé le** : 2026-11-12  
**Version** : 1.0  
**Status** : 📝 Documentation en cours
