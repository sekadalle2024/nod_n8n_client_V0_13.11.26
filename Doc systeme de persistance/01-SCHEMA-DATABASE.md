# 🗄️ Schémas PostgreSQL - Système de Persistance

## Vue d'Ensemble

Ce document détaille tous les schémas PostgreSQL nécessaires pour le système de persistance.

---

## 🏗️ Architecture Multi-Tenant

```
PostgreSQL
├── Schema: public (données communes)
│   ├── users
│   ├── user_sessions
│   └── table_schemas (métadonnées des tables dynamiques)
│
├── Schema: user_1 (données utilisateur 1)
│   ├── audit_missions
│   ├── audit_findings
│   ├── audit_evidence
│   ├── rapports_financiers
│   ├── custom_tables... (créées dynamiquement)
│   └── data_versions (historique)
│
└── Schema: user_2 (données utilisateur 2)
    └── ... (même structure isolée)
```

---

## 📊 Schema Public : Table Metadata

### table_schemas

Enregistre les métadonnées de toutes les tables dynamiques créées.

```sql
CREATE TABLE IF NOT EXISTS public.table_schemas (
  id SERIAL PRIMARY KEY,

  -- Identification
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  schema_name VARCHAR(255) NOT NULL, -- Ex: 'user_1'
  table_name VARCHAR(255) NOT NULL,  -- Ex: 'audit_findings'

  -- Métadonnées de structure
  columns JSONB NOT NULL, -- Définition des colonnes
  /*
    Exemple columns:
    [
      {
        "name": "title",
        "type": "text",
        "label": "Titre",
        "required": true,
        "editable": true,
        "max_length": 255
      },
      {
        "name": "severity",
        "type": "select",
        "label": "Sévérité",
        "options": ["low", "medium", "high"],
        "default": "medium"
      }
    ]
  */

  -- Configuration
  allow_add BOOLEAN DEFAULT TRUE,
  allow_edit BOOLEAN DEFAULT TRUE,
  allow_delete BOOLEAN DEFAULT TRUE,
  enable_versioning BOOLEAN DEFAULT TRUE,
  enable_soft_delete BOOLEAN DEFAULT TRUE,

  -- Source
  source VARCHAR(50) DEFAULT 'n8n', -- 'n8n' | 'manual' | 'api'
  workflow_id VARCHAR(255),          -- Si créé par n8n

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Contrainte unicité
  UNIQUE(user_id, table_name)
);

CREATE INDEX idx_table_schemas_user ON public.table_schemas(user_id);
CREATE INDEX idx_table_schemas_workflow ON public.table_schemas(workflow_id);
```

---

## 🎯 Schema user_X : Tables de Données

### Template Générique

**Chaque table suit ce template** :

```sql
CREATE TABLE user_X.{table_name} (
  -- ID primaire
  id SERIAL PRIMARY KEY,

  -- Données business (JSONB pour flexibilité)
  data JSONB NOT NULL,
  /*
    Exemple data pour audit_findings:
    {
      "title": "Absence de séparation des tâches",
      "description": "Le même utilisateur peut créer et approuver des factures",
      "severity": "high",
      "status": "open",
      "recommendations": "Implémenter workflow approbation",
      "affected_process": "Comptes fournisseurs",
      "estimated_impact": 50000
    }
  */

  -- Métadonnées de source
  workflow_id VARCHAR(255),             -- ID workflow n8n créateur
  workflow_execution_id VARCHAR(255),   -- ID exécution spécifique
  source VARCHAR(50) DEFAULT 'n8n',     -- 'n8n' | 'user' | 'api'

  -- Versioning
  version INTEGER DEFAULT 1,

  -- Audit trail
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id),

  -- Contraintes
  CHECK (version > 0),
  CHECK (source IN ('n8n', 'user', 'api'))
);

-- Index pour performance
CREATE INDEX idx_{table_name}_workflow
  ON user_X.{table_name}(workflow_id);

CREATE INDEX idx_{table_name}_data
  ON user_X.{table_name} USING GIN(data);

CREATE INDEX idx_{table_name}_created_at
  ON user_X.{table_name}(created_at DESC);

CREATE INDEX idx_{table_name}_deleted
  ON user_X.{table_name}(deleted_at)
  WHERE deleted_at IS NULL;

-- Trigger pour updated_at automatique
CREATE OR REPLACE FUNCTION update_{table_name}_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_{table_name}_updated_at
  BEFORE UPDATE ON user_X.{table_name}
  FOR EACH ROW
  EXECUTE FUNCTION update_{table_name}_updated_at();
```

---

## 📜 Table d'Historique (Versioning)

### data_versions

**Une seule table d'historique** pour toutes les tables d'un user.

```sql
CREATE TABLE user_X.data_versions (
  id SERIAL PRIMARY KEY,

  -- Identification de la ligne modifiée
  table_name VARCHAR(255) NOT NULL,
  row_id INTEGER NOT NULL,

  -- Snapshot des données
  data_before JSONB,  -- État avant modification (NULL pour INSERT)
  data_after JSONB,   -- État après modification (NULL pour DELETE)

  -- Type de modification
  action VARCHAR(20) NOT NULL, -- 'insert' | 'update' | 'delete'

  -- Détails de la modification (pour UPDATE)
  changed_fields TEXT[],  -- Ex: ['severity', 'status']

  -- Raison (optionnelle)
  reason TEXT,

  -- Métadonnées
  version INTEGER NOT NULL,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),

  -- IP et User-Agent (pour traçabilité)
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- Contraintes
  CHECK (action IN ('insert', 'update', 'delete')),
  CHECK (
    (action = 'insert' AND data_before IS NULL AND data_after IS NOT NULL) OR
    (action = 'update' AND data_before IS NOT NULL AND data_after IS NOT NULL) OR
    (action = 'delete' AND data_before IS NOT NULL AND data_after IS NULL)
  )
);

-- Index composites pour requêtes fréquentes
CREATE INDEX idx_data_versions_table_row
  ON user_X.data_versions(table_name, row_id);

CREATE INDEX idx_data_versions_table_created
  ON user_X.data_versions(table_name, created_at DESC);

CREATE INDEX idx_data_versions_created_by
  ON user_X.data_versions(created_by, created_at DESC);

-- Index GIN pour recherche dans JSONB
CREATE INDEX idx_data_versions_data_after
  ON user_X.data_versions USING GIN(data_after);
```

---

## 🎯 Tables Métier Spécifiques

### audit_missions

```sql
CREATE TABLE user_X.audit_missions (
  id SERIAL PRIMARY KEY,

  data JSONB NOT NULL,
  /*
    {
      "name": "Audit Processus Achats 2026",
      "client": "Société ABC",
      "type": "process",
      "status": "in_progress",
      "start_date": "2026-01-15",
      "end_date": "2026-03-30",
      "lead_auditor": "Jean Dupont",
      "team_members": ["Marie Martin", "Pierre Durand"],
      "objectives": ["Vérifier conformité", "Identifier risques"],
      "scope": "Processus achats et approvisionnements",
      "budget_hours": 120,
      "actual_hours": 45
    }
  */

  workflow_id VARCHAR(255),
  workflow_execution_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'n8n',
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_audit_missions_data ON user_X.audit_missions USING GIN(data);
CREATE INDEX idx_audit_missions_status ON user_X.audit_missions((data->>'status'));
```

---

### audit_findings

```sql
CREATE TABLE user_X.audit_findings (
  id SERIAL PRIMARY KEY,

  -- Relation avec mission (optionnelle)
  mission_id INTEGER REFERENCES user_X.audit_missions(id) ON DELETE CASCADE,

  data JSONB NOT NULL,
  /*
    {
      "title": "Absence de séparation des tâches",
      "description": "Le même utilisateur peut créer et approuver...",
      "severity": "high",
      "status": "open",
      "category": "access_control",
      "affected_process": "Comptes fournisseurs",
      "risk_level": 8,
      "recommendations": "Implémenter workflow approbation à 2 niveaux",
      "responsible_person": "CFO",
      "due_date": "2026-06-30",
      "estimated_effort_hours": 40,
      "estimated_cost": 15000,
      "supporting_evidence": ["screenshot1.png", "policy_doc.pdf"]
    }
  */

  workflow_id VARCHAR(255),
  workflow_execution_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'n8n',
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_audit_findings_mission ON user_X.audit_findings(mission_id);
CREATE INDEX idx_audit_findings_data ON user_X.audit_findings USING GIN(data);
CREATE INDEX idx_audit_findings_severity ON user_X.audit_findings((data->>'severity'));
CREATE INDEX idx_audit_findings_status ON user_X.audit_findings((data->>'status'));
```

---

### audit_evidence

```sql
CREATE TABLE user_X.audit_evidence (
  id SERIAL PRIMARY KEY,

  -- Relation avec finding
  finding_id INTEGER REFERENCES user_X.audit_findings(id) ON DELETE CASCADE,

  data JSONB NOT NULL,
  /*
    {
      "type": "document",
      "title": "Procédure achats v2.1",
      "description": "Document décrivant le processus actuel",
      "file_path": "/evidence/2026/procedure_achats.pdf",
      "file_size": 2458963,
      "file_type": "application/pdf",
      "collected_date": "2026-02-15",
      "collected_by": "Marie Martin",
      "relevance": "Démontre absence de contrôle séparation",
      "confidentiality": "internal"
    }
  */

  workflow_id VARCHAR(255),
  workflow_execution_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'n8n',
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_audit_evidence_finding ON user_X.audit_evidence(finding_id);
CREATE INDEX idx_audit_evidence_data ON user_X.audit_evidence USING GIN(data);
```

---

### rapports_financiers

```sql
CREATE TABLE user_X.rapports_financiers (
  id SERIAL PRIMARY KEY,

  data JSONB NOT NULL,
  /*
    {
      "period": "2026-Q1",
      "type": "balance_sheet",
      "line_items": [
        {
          "account": "1010 - Caisse",
          "debit": 15420.50,
          "credit": 0,
          "balance": 15420.50
        },
        {
          "account": "4010 - Fournisseurs",
          "debit": 0,
          "credit": 84523.30,
          "balance": -84523.30
        }
      ],
      "total_assets": 1245632.80,
      "total_liabilities": 523641.20,
      "equity": 721991.60,
      "generated_date": "2026-04-05",
      "approved_by": null,
      "approval_date": null
    }
  */

  workflow_id VARCHAR(255),
  workflow_execution_id VARCHAR(255),
  source VARCHAR(50) DEFAULT 'n8n',
  version INTEGER DEFAULT 1,

  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES public.users(id),

  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES public.users(id)
);

CREATE INDEX idx_rapports_financiers_data ON user_X.rapports_financiers USING GIN(data);
CREATE INDEX idx_rapports_financiers_period ON user_X.rapports_financiers((data->>'period'));
```

---

## 🔧 Fonctions Utilitaires

### create_dynamic_table

Fonction pour créer dynamiquement une nouvelle table.

```sql
CREATE OR REPLACE FUNCTION create_dynamic_table(
  p_user_id INTEGER,
  p_table_name VARCHAR(255),
  p_columns JSONB
) RETURNS BOOLEAN AS $$
DECLARE
  v_schema_name VARCHAR(255);
BEGIN
  -- Construire le nom du schéma
  v_schema_name := 'user_' || p_user_id;

  -- Créer la table
  EXECUTE format('
    CREATE TABLE %I.%I (
      id SERIAL PRIMARY KEY,
      data JSONB NOT NULL,
      workflow_id VARCHAR(255),
      workflow_execution_id VARCHAR(255),
      source VARCHAR(50) DEFAULT ''n8n'',
      version INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES public.users(id),
      updated_at TIMESTAMP DEFAULT NOW(),
      updated_by INTEGER REFERENCES public.users(id),
      deleted_at TIMESTAMP,
      deleted_by INTEGER REFERENCES public.users(id)
    )',
    v_schema_name,
    p_table_name
  );

  -- Créer les index
  EXECUTE format('
    CREATE INDEX idx_%I_data ON %I.%I USING GIN(data)',
    p_table_name,
    v_schema_name,
    p_table_name
  );

  EXECUTE format('
    CREATE INDEX idx_%I_created_at ON %I.%I(created_at DESC)',
    p_table_name,
    v_schema_name,
    p_table_name
  );

  -- Enregistrer les métadonnées
  INSERT INTO public.table_schemas (
    user_id,
    schema_name,
    table_name,
    columns
  ) VALUES (
    p_user_id,
    v_schema_name,
    p_table_name,
    p_columns
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error creating table: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
```

---

### Trigger pour Versioning Automatique

```sql
CREATE OR REPLACE FUNCTION save_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Incrémenter la version
  NEW.version := COALESCE(OLD.version, 0) + 1;

  -- Sauvegarder dans data_versions
  INSERT INTO data_versions (
    table_name,
    row_id,
    data_before,
    data_after,
    action,
    version,
    created_by
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE
      WHEN TG_OP = 'INSERT' THEN NULL
      ELSE row_to_json(OLD)::JSONB
    END,
    CASE
      WHEN TG_OP = 'DELETE' THEN NULL
      ELSE row_to_json(NEW)::JSONB
    END,
    LOWER(TG_OP),
    NEW.version,
    NEW.updated_by
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Appliquer à toutes les tables
-- (répéter pour chaque table)
CREATE TRIGGER trigger_audit_findings_versioning
  BEFORE INSERT OR UPDATE OR DELETE ON user_X.audit_findings
  FOR EACH ROW
  EXECUTE FUNCTION save_version();
```

---

## 🎯 Requêtes Utiles

### Lister les Tables d'un User

```sql
SELECT
  table_name,
  columns,
  created_at,
  (
    SELECT COUNT(*)
    FROM information_schema.tables
    WHERE table_schema = ts.schema_name
      AND table_name = ts.table_name
  ) AS table_exists
FROM public.table_schemas ts
WHERE user_id = 1
ORDER BY created_at DESC;
```

---

### Compter les Lignes par Table

```sql
SELECT
  ts.table_name,
  (
    SELECT COUNT(*)
    FROM user_1.audit_findings
    WHERE deleted_at IS NULL
  ) AS active_rows,
  (
    SELECT COUNT(*)
    FROM user_1.audit_findings
    WHERE deleted_at IS NOT NULL
  ) AS deleted_rows
FROM public.table_schemas ts
WHERE user_id = 1;
```

---

### Obtenir l'Historique d'une Ligne

```sql
SELECT
  id,
  action,
  version,
  data_before,
  data_after,
  changed_fields,
  reason,
  created_at,
  (SELECT name FROM public.users WHERE id = created_by) AS modified_by
FROM user_1.data_versions
WHERE table_name = 'audit_findings'
  AND row_id = 42
ORDER BY version DESC;
```

---

## 🎯 Migration Script

```sql
-- Script pour créer toutes les tables d'un nouveau user
CREATE OR REPLACE FUNCTION setup_user_data_schema(p_user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_schema_name VARCHAR(255);
BEGIN
  v_schema_name := 'user_' || p_user_id;

  -- Créer le schéma si nécessaire (déjà fait par trigger users)

  -- Créer data_versions
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.data_versions (
      id SERIAL PRIMARY KEY,
      table_name VARCHAR(255) NOT NULL,
      row_id INTEGER NOT NULL,
      data_before JSONB,
      data_after JSONB,
      action VARCHAR(20) NOT NULL,
      changed_fields TEXT[],
      reason TEXT,
      version INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      created_by INTEGER REFERENCES public.users(id),
      ip_address VARCHAR(45),
      user_agent TEXT
    )',
    v_schema_name
  );

  -- Créer tables métier par défaut
  PERFORM create_dynamic_table(
    p_user_id,
    'audit_missions',
    '[{"name":"name","type":"text"},{"name":"status","type":"select"}]'::JSONB
  );

  PERFORM create_dynamic_table(
    p_user_id,
    'audit_findings',
    '[{"name":"title","type":"text"},{"name":"severity","type":"select"}]'::JSONB
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

**Prochaine étape** : Voir `02-API-SPECIFICATION.md` pour l'API CRUD complète.
