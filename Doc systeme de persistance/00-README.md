# 💾 Système de Persistance - Documentation

## 🎯 Objectif

Permettre aux utilisateurs de **modifier les données** générées par les workflows n8n (tables audit, rapports, etc.) et **persister ces modifications** dans PostgreSQL.

---

## 📋 Problématique

### Situation Actuelle

```
n8n Workflow → Génère Table → Affiche dans UI
                                      ↓
                              User modifie
                                      ↓
                              ❌ Modifications perdues au reload
```

### Solution Voulue

```
n8n Workflow → Génère Table → Sauvegarde PostgreSQL
                                      ↓
                              Affiche dans UI
                                      ↓
                              User modifie
                                      ↓
                              ✅ Sauvegarde PostgreSQL
                                      ↓
                              Reload → Modifications conservées
```

---

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────┐
│              n8n Workflow                           │
│  • Analyse financière                               │
│  • Génération rapport audit                         │
│  • Extraction données                               │
└────────────┬────────────────────────────────────────┘
             │ Webhook/API
             ↓
┌─────────────────────────────────────────────────────┐
│          Nod Backend (Express)                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  Workflow Result Handler                      │  │
│  │  • Reçoit données n8n                         │  │
│  │  • Parse structure                            │  │
│  │  • Détecte type (audit, rapport, etc.)       │  │
│  └────────────────┬──────────────────────────────┘  │
│                   ↓                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Persistence Layer                            │  │
│  │  • Crée/Update tables PostgreSQL              │  │
│  │  • Gère versions                              │  │
│  │  • Historique modifications                   │  │
│  └────────────────┬──────────────────────────────┘  │
│                   ↓                                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  CRUD API                                     │  │
│  │  • GET    /api/data/:table                    │  │
│  │  • POST   /api/data/:table                    │  │
│  │  • PUT    /api/data/:table/:id                │  │
│  │  • DELETE /api/data/:table/:id                │  │
│  └────────────────┬──────────────────────────────┘  │
└────────────────────┼──────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│            PostgreSQL Multi-Tenant                  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Schema: user_1                               │  │
│  │  ├── audit_missions (tables n8n)              │  │
│  │  ├── audit_findings                           │  │
│  │  ├── rapports_financiers                      │  │
│  │  └── data_versions (historique)               │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Schema: user_2                               │  │
│  │  └── ... (mêmes tables isolées)               │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                     ↑
                     │
┌────────────────────┼──────────────────────────────┐
│              React Frontend                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  DataTable Component                          │  │
│  │  • Affiche données                            │  │
│  │  • Édition inline                             │  │
│  │  • Ajout/Suppression lignes                   │  │
│  │  • Sauvegarde automatique                     │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📚 Documents

| Fichier                      | Description                           |
| ---------------------------- | ------------------------------------- |
| `00-README.md`               | Ce fichier - Vue d'ensemble           |
| `01-SCHEMA-DATABASE.md`      | Schémas PostgreSQL pour persistance   |
| `02-API-SPECIFICATION.md`    | API CRUD complète                     |
| `03-REACT-COMPONENTS.md`     | Composants React pour édition         |
| `04-WORKFLOW-INTEGRATION.md` | Intégration avec workflows n8n        |
| `05-VERSIONING.md`           | Système de versions et historique     |
| `06-PLAN-IMPLEMENTATION.md`  | Plan d'implémentation étape par étape |

---

## 💡 Cas d'Usage

### Cas 1 : Rapport d'Audit

```
1. n8n génère rapport avec 10 constatations
   ↓
2. Données sauvegardées dans user_X.audit_findings
   ↓
3. User ouvre le rapport dans Nod
   ↓
4. User modifie description d'une constatation
   ↓
5. Auto-save → PostgreSQL
   ↓
6. User ajoute une nouvelle ligne
   ↓
7. Auto-save → PostgreSQL
   ↓
8. User ferme et rouvre le rapport
   ↓
9. ✅ Toutes les modifications sont présentes
```

---

### Cas 2 : Tableau Financier

```
1. n8n extrait données comptables (100 lignes)
   ↓
2. Sauvegarde dans user_X.rapports_financiers
   ↓
3. User filtre, trie, édite des valeurs
   ↓
4. Toutes les modifications sauvegardées
   ↓
5. User exporte en PDF
   ↓
6. PDF généré avec données modifiées
```

---

## 🔑 Fonctionnalités Clés

### 1. Sauvegarde Automatique

**Déclencheurs** :

- Modification d'une cellule
- Ajout d'une ligne
- Suppression d'une ligne
- Réorganisation (tri, filtre appliqué)

**Debounce** : 500ms pour éviter trop de requêtes

---

### 2. Historique des Versions

**Chaque modification enregistrée avec** :

- Timestamp
- User ID
- Type de modification (update, insert, delete)
- Valeur avant/après
- Raison (optionnelle)

**Fonctionnalités** :

- Voir l'historique d'une ligne
- Restaurer une version précédente
- Comparer deux versions

---

### 3. Édition Collaborative (Future)

**Si plusieurs utilisateurs** :

- Verrou optimiste (version_number)
- Notification de conflits
- Résolution de conflits

---

### 4. Types de Données Supportés

| Type    | Édition      | Validation        |
| ------- | ------------ | ----------------- |
| Text    | Input text   | Max length        |
| Number  | Input number | Min/Max, decimals |
| Date    | Date picker  | Format, range     |
| Boolean | Checkbox     | -                 |
| Select  | Dropdown     | Liste valeurs     |
| JSON    | JSON editor  | Validité JSON     |
| File    | Upload       | Type, taille      |

---

## 📊 Schéma de Base

### Table Générique

```sql
CREATE TABLE user_X.{table_name} (
  id SERIAL PRIMARY KEY,

  -- Données business (dynamique)
  data JSONB NOT NULL,

  -- Métadonnées
  workflow_id VARCHAR(255),      -- ID du workflow n8n qui a créé
  workflow_execution_id VARCHAR(255), -- ID d'exécution n8n
  source VARCHAR(50) DEFAULT 'n8n', -- 'n8n' | 'user' | 'api'

  -- Versioning
  version INTEGER DEFAULT 1,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id)
);

-- Index pour performance
CREATE INDEX idx_{table_name}_workflow ON user_X.{table_name}(workflow_id);
CREATE INDEX idx_{table_name}_data ON user_X.{table_name} USING GIN(data);
CREATE INDEX idx_{table_name}_created_at ON user_X.{table_name}(created_at);
```

---

### Table d'Historique

```sql
CREATE TABLE user_X.data_versions (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(255) NOT NULL,
  row_id INTEGER NOT NULL,

  -- Snapshot complet de la ligne
  data_before JSONB,
  data_after JSONB,

  -- Type de modification
  action VARCHAR(20) NOT NULL, -- 'insert' | 'update' | 'delete'

  -- Colonnes modifiées (pour update)
  changed_fields TEXT[],

  -- Raison (optionnelle)
  reason TEXT,

  -- Qui et quand
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),

  -- Référence à la version
  version INTEGER NOT NULL
);

CREATE INDEX idx_data_versions_table_row ON user_X.data_versions(table_name, row_id);
CREATE INDEX idx_data_versions_created_at ON user_X.data_versions(created_at);
```

---

## 🚀 API Endpoints

### CRUD Basique

```typescript
// Lister toutes les lignes
GET /api/data/{table_name}
Query params: ?limit=50&offset=0&sort=created_at&order=desc

// Obtenir une ligne
GET /api/data/{table_name}/{id}

// Créer une ligne
POST /api/data/{table_name}
Body: { data: {...}, source: 'user' }

// Mettre à jour une ligne
PUT /api/data/{table_name}/{id}
Body: { data: {...}, reason: 'Correction erreur' }

// Supprimer une ligne (soft delete)
DELETE /api/data/{table_name}/{id}
Query params: ?reason=Doublon
```

### Versioning

```typescript
// Historique d'une ligne
GET /api/data/{table_name}/{id}/history

// Restaurer une version
POST /api/data/{table_name}/{id}/restore
Body: { version: 3 }

// Comparer deux versions
GET /api/data/{table_name}/{id}/compare
Query params: ?version1=2&version2=5
```

---

## 🎨 Composant React

### Exemple d'Utilisation

```typescript
import { EditableDataTable } from '@/components/EditableDataTable';

function AuditReport() {
  return (
    <EditableDataTable
      tableName="audit_findings"
      columns={[
        { key: 'title', label: 'Titre', type: 'text', editable: true },
        { key: 'severity', label: 'Sévérité', type: 'select',
          options: ['low', 'medium', 'high'], editable: true },
        { key: 'status', label: 'Statut', type: 'select',
          options: ['open', 'in_progress', 'closed'], editable: true },
        { key: 'created_at', label: 'Créé le', type: 'date', editable: false }
      ]}
      allowAdd={true}
      allowDelete={true}
      allowExport={true}
      autoSave={true}
      debounceMs={500}
    />
  );
}
```

---

## ✅ Avantages

### Pour les Utilisateurs

- ✅ Modifications persistantes
- ✅ Aucune perte de données
- ✅ Édition intuitive (inline)
- ✅ Historique complet
- ✅ Annulation possible (versions)

### Pour le Système

- ✅ Traçabilité complète
- ✅ Audit trail
- ✅ Scalable (PostgreSQL)
- ✅ Compatible multi-tenant
- ✅ API RESTful standard

---

## 🔐 Sécurité

### Permissions

- ✅ User ne peut modifier que SES données (schéma user_X)
- ✅ Validation côté serveur
- ✅ Historique immuable (append-only)
- ✅ Soft delete (récupération possible)

### Validation

- ✅ Types de données respectés
- ✅ Contraintes métier (min/max, required)
- ✅ Protection injection SQL (parameterized queries)
- ✅ Sanitization des données

---

## 📈 Performance

### Optimisations

- Indexation GIN sur colonnes JSONB
- Pagination obligatoire (limit/offset)
- Cache Redis (optionnel)
- Debounce auto-save (500ms)
- Batch updates quand possible

### Estimations

| Action                       | Temps  |
| ---------------------------- | ------ |
| GET 100 lignes               | <50ms  |
| UPDATE 1 ligne               | <20ms  |
| INSERT 1 ligne               | <30ms  |
| DELETE 1 ligne               | <20ms  |
| GET historique (50 versions) | <100ms |

---

## 🎯 Compatibilité

### Avec SaaS Multi-Utilisateurs ✅

- Chaque user a son schéma (`user_X`)
- Isolation complète des données
- API respecte les permissions

### Avec Routing Direct n8n ✅

- Workflows n8n écrivent dans les tables
- API lit/modifie les mêmes tables
- Cohérence garantie

### Avec Système d'Audit ✅

- Tables audit natives (`audit_missions`, `audit_findings`)
- Extensions possibles (colonnes custom)
- Historique intégré

---

## 📝 Prochaines Étapes

1. **Lire** : `01-SCHEMA-DATABASE.md` pour les détails SQL
2. **Comprendre** : `02-API-SPECIFICATION.md` pour contrat API
3. **Implémenter** : `06-PLAN-IMPLEMENTATION.md` pour exécution

---

**Créé le** : 2026-11-12  
**Version** : 1.0  
**Status** : 📝 Documentation en cours
