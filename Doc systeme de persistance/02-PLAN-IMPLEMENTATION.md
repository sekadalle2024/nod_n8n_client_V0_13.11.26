# 📋 Plan d'Implémentation - Système de Persistance

## Vue d'Ensemble

Ce document détaille le plan d'implémentation étape par étape du système de persistance.

---

## 🎯 Objectifs

1. ✅ Sauvegarder les données générées par n8n dans PostgreSQL
2. ✅ Permettre édition/modification par utilisateurs
3. ✅ Persister toutes les modifications
4. ✅ Historique complet (versioning)
5. ✅ Interface React pour édition intuitive

---

## 📊 Phases du Projet

```
Phase 1: Schémas PostgreSQL (1 jour)
   ↓
Phase 2: API CRUD Backend (2-3 jours)
   ↓
Phase 3: Composants React (3-4 jours)
   ↓
Phase 4: Intégration n8n (2 jours)
   ↓
Phase 5: Versioning & Historique (2 jours)
   ↓
Phase 6: Tests & Polish (1-2 jours)
```

**Durée totale estimée** : 11-14 jours

---

## Phase 1 : Schémas PostgreSQL (1 jour)

### Étape 1.1 : Créer Table Metadata

**Fichier** : `migrations/010-table-schemas.sql`

```sql
-- Voir 01-SCHEMA-DATABASE.md section "table_schemas"
CREATE TABLE IF NOT EXISTS public.table_schemas (
  -- ... (copier depuis doc)
);
```

**Exécuter** :

```bash
docker exec -it nod-postgres-1 psql -U nod -d nod
\i migrations/010-table-schemas.sql
```

**Validation** :

```sql
SELECT * FROM public.table_schemas;
-- Doit retourner 0 ligne (table vide mais créée)
```

---

### Étape 1.2 : Créer Fonction create_dynamic_table

**Fichier** : `migrations/011-functions.sql`

```sql
-- Voir 01-SCHEMA-DATABASE.md section "create_dynamic_table"
CREATE OR REPLACE FUNCTION create_dynamic_table(...)
RETURNS BOOLEAN AS $$
-- ...
$$ LANGUAGE plpgsql;
```

**Test** :

```sql
SELECT create_dynamic_table(
  1,
  'test_table',
  '[{"name":"title","type":"text"}]'::JSONB
);

-- Vérifier création
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'user_1' AND table_name = 'test_table';
```

---

### Étape 1.3 : Créer Tables Métier Par Défaut

**Fichier** : `migrations/012-default-tables.sql`

```sql
-- Pour chaque utilisateur existant, créer tables par défaut
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM public.users LOOP
    PERFORM create_dynamic_table(
      user_record.id,
      'audit_missions',
      '[...]'::JSONB
    );

    PERFORM create_dynamic_table(
      user_record.id,
      'audit_findings',
      '[...]'::JSONB
    );

    PERFORM create_dynamic_table(
      user_record.id,
      'audit_evidence',
      '[...]'::JSONB
    );
  END LOOP;
END $$;
```

---

### Étape 1.4 : Créer Table data_versions

**Pour chaque user existant** :

```sql
CREATE TABLE user_1.data_versions (
  -- ... (voir 01-SCHEMA-DATABASE.md)
);

-- Index
CREATE INDEX idx_data_versions_table_row
  ON user_1.data_versions(table_name, row_id);
```

---

### Étape 1.5 : Trigger Versioning

**Fonction générique** :

```sql
CREATE OR REPLACE FUNCTION save_version()
RETURNS TRIGGER AS $$
BEGIN
  -- ... (voir 01-SCHEMA-DATABASE.md)
END;
$$ LANGUAGE plpgsql;
```

**Appliquer aux tables** :

```sql
CREATE TRIGGER trigger_audit_findings_versioning
  BEFORE INSERT OR UPDATE OR DELETE ON user_1.audit_findings
  FOR EACH ROW
  EXECUTE FUNCTION save_version();
```

---

## Phase 2 : API CRUD Backend (2-3 jours)

### Étape 2.1 : Modèle de Données

**Fichier** : `src/server/models/data-table.ts`

```typescript
export interface DataRow {
  id: number;
  data: Record<string, any>;
  workflow_id?: string;
  workflow_execution_id?: string;
  source: 'n8n' | 'user' | 'api';
  version: number;
  created_at: Date;
  created_by: number;
  updated_at: Date;
  updated_by: number;
  deleted_at?: Date;
  deleted_by?: number;
}

export interface DataVersion {
  id: number;
  table_name: string;
  row_id: number;
  data_before?: Record<string, any>;
  data_after?: Record<string, any>;
  action: 'insert' | 'update' | 'delete';
  changed_fields?: string[];
  reason?: string;
  version: number;
  created_at: Date;
  created_by: number;
}

export interface TableSchema {
  id: number;
  user_id: number;
  schema_name: string;
  table_name: string;
  columns: ColumnDefinition[];
  allow_add: boolean;
  allow_edit: boolean;
  allow_delete: boolean;
}

export interface ColumnDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'json';
  label: string;
  required?: boolean;
  editable?: boolean;
  default?: any;
  options?: string[]; // Pour type 'select'
  min?: number;
  max?: number;
  max_length?: number;
}
```

---

### Étape 2.2 : Service DataTable

**Fichier** : `src/server/services/data-table.ts`

```typescript
import { db } from '../db';
import { setUserContext } from '../db/multi-tenant';

export class DataTableService {
  /**
   * Lister toutes les lignes d'une table
   */
  async list(
    userId: number,
    tableName: string,
    options: {
      limit?: number;
      offset?: number;
      sort?: string;
      order?: 'asc' | 'desc';
      includeDeleted?: boolean;
    } = {},
  ): Promise<DataRow[]> {
    await setUserContext(userId);

    const {
      limit = 50,
      offset = 0,
      sort = 'created_at',
      order = 'desc',
      includeDeleted = false,
    } = options;

    const whereClause = includeDeleted ? '' : 'WHERE deleted_at IS NULL';

    const query = `
      SELECT *
      FROM ${tableName}
      ${whereClause}
      ORDER BY ${sort} ${order}
      LIMIT $1 OFFSET $2
    `;

    const result = await db.query(query, [limit, offset]);
    return result.rows;
  }

  /**
   * Obtenir une ligne par ID
   */
  async get(userId: number, tableName: string, id: number): Promise<DataRow | null> {
    await setUserContext(userId);

    const result = await db.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

    return result.rows[0] || null;
  }

  /**
   * Créer une nouvelle ligne
   */
  async create(
    userId: number,
    tableName: string,
    data: Record<string, any>,
    source: 'n8n' | 'user' | 'api' = 'user',
    workflowId?: string,
    workflowExecutionId?: string,
  ): Promise<DataRow> {
    await setUserContext(userId);

    const result = await db.query(
      `INSERT INTO ${tableName} (
        data, 
        source, 
        workflow_id, 
        workflow_execution_id, 
        created_by, 
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING *`,
      [JSON.stringify(data), source, workflowId, workflowExecutionId, userId],
    );

    return result.rows[0];
  }

  /**
   * Mettre à jour une ligne
   */
  async update(
    userId: number,
    tableName: string,
    id: number,
    data: Record<string, any>,
    reason?: string,
  ): Promise<DataRow> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE ${tableName}
       SET data = $1, updated_by = $2
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(data), userId, id],
    );

    return result.rows[0];
  }

  /**
   * Supprimer une ligne (soft delete)
   */
  async delete(userId: number, tableName: string, id: number, reason?: string): Promise<boolean> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE ${tableName}
       SET deleted_at = NOW(), deleted_by = $1
       WHERE id = $2`,
      [userId, id],
    );

    return result.rowCount > 0;
  }

  /**
   * Obtenir l'historique d'une ligne
   */
  async getHistory(userId: number, tableName: string, rowId: number): Promise<DataVersion[]> {
    await setUserContext(userId);

    const result = await db.query(
      `SELECT * FROM data_versions
       WHERE table_name = $1 AND row_id = $2
       ORDER BY version DESC`,
      [tableName, rowId],
    );

    return result.rows;
  }

  /**
   * Restaurer une version spécifique
   */
  async restoreVersion(
    userId: number,
    tableName: string,
    rowId: number,
    version: number,
  ): Promise<DataRow> {
    await setUserContext(userId);

    // Récupérer la version
    const versionResult = await db.query(
      `SELECT data_after FROM data_versions
       WHERE table_name = $1 AND row_id = $2 AND version = $3`,
      [tableName, rowId, version],
    );

    if (versionResult.rows.length === 0) {
      throw new Error('Version not found');
    }

    const dataToRestore = versionResult.rows[0].data_after;

    // Mettre à jour la ligne
    return await this.update(
      userId,
      tableName,
      rowId,
      dataToRestore,
      `Restored from version ${version}`,
    );
  }
}
```

---

### Étape 2.3 : Routes API

**Fichier** : `src/server/routes/data.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../auth/middleware';
import { DataTableService } from '../services/data-table';

export const dataRouter = Router();

// Middleware auth (toutes les routes protégées)
dataRouter.use(authMiddleware);

const dataService = new DataTableService();

/**
 * GET /api/data/:table
 * Lister toutes les lignes
 */
dataRouter.get('/:table', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;

    const options = {
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
      sort: (req.query.sort as string) || 'created_at',
      order: (req.query.order as 'asc' | 'desc') || 'desc',
      includeDeleted: req.query.includeDeleted === 'true',
    };

    const rows = await dataService.list(userId, tableName, options);

    res.json({
      success: true,
      data: rows,
      pagination: {
        limit: options.limit,
        offset: options.offset,
        total: rows.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/data/:table/:id
 * Obtenir une ligne
 */
dataRouter.get('/:table/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const id = parseInt(req.params.id);

    const row = await dataService.get(userId, tableName, id);

    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'Row not found',
      });
    }

    res.json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/data/:table
 * Créer une ligne
 */
dataRouter.post('/:table', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const { data, source, workflow_id, workflow_execution_id } = req.body;

    const row = await dataService.create(
      userId,
      tableName,
      data,
      source || 'user',
      workflow_id,
      workflow_execution_id,
    );

    res.status(201).json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/data/:table/:id
 * Mettre à jour une ligne
 */
dataRouter.put('/:table/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const id = parseInt(req.params.id);
    const { data, reason } = req.body;

    const row = await dataService.update(userId, tableName, id, data, reason);

    res.json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/data/:table/:id
 * Supprimer une ligne (soft delete)
 */
dataRouter.delete('/:table/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const id = parseInt(req.params.id);
    const reason = req.query.reason as string;

    const deleted = await dataService.delete(userId, tableName, id, reason);

    res.json({
      success: deleted,
      message: deleted ? 'Row deleted' : 'Row not found',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/data/:table/:id/history
 * Obtenir l'historique
 */
dataRouter.get('/:table/:id/history', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const id = parseInt(req.params.id);

    const history = await dataService.getHistory(userId, tableName, id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/data/:table/:id/restore
 * Restaurer une version
 */
dataRouter.post('/:table/:id/restore', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const tableName = req.params.table;
    const id = parseInt(req.params.id);
    const { version } = req.body;

    const row = await dataService.restoreVersion(userId, tableName, id, version);

    res.json({
      success: true,
      data: row,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

---

### Étape 2.4 : Intégration dans server

**Fichier** : `src/server/index.ts`

```typescript
import { dataRouter } from './routes/data';

// Après les autres routes
app.use('/api/data', dataRouter);
```

---

## Phase 3 : Composants React (3-4 jours)

### Étape 3.1 : Composant EditableCell

**Fichier** : `src/web/components/EditableCell.tsx`

```typescript
import React, { useState, useEffect } from 'react';

interface EditableCellProps {
  value: any;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  editable: boolean;
  onChange: (value: any) => void;
}

export const EditableCell: React.FC<EditableCellProps> = ({
  value,
  type,
  options,
  editable,
  onChange
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentValue, setCurrentValue] = useState(value);

  useEffect(() => {
    setCurrentValue(value);
  }, [value]);

  const handleSave = () => {
    setIsEditing(false);
    onChange(currentValue);
  };

  if (!editable) {
    return <span>{value}</span>;
  }

  if (!isEditing) {
    return (
      <span
        onClick={() => setIsEditing(true)}
        className="editable-cell"
      >
        {value || '(vide)'}
      </span>
    );
  }

  // Rendu selon le type
  switch (type) {
    case 'text':
      return (
        <input
          type="text"
          value={currentValue}
          onChange={(e) => setCurrentValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={currentValue}
          onChange={(e) => setCurrentValue(Number(e.target.value))}
          onBlur={handleSave}
          autoFocus
        />
      );

    case 'select':
      return (
        <select
          value={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.value);
            onChange(e.target.value);
            setIsEditing(false);
          }}
          autoFocus
        >
          {options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={currentValue}
          onChange={(e) => {
            setCurrentValue(e.target.checked);
            onChange(e.target.checked);
            setIsEditing(false);
          }}
        />
      );

    default:
      return <span>{value}</span>;
  }
};
```

---

### Étape 3.2 : Composant EditableDataTable

**Fichier** : `src/web/components/EditableDataTable.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { EditableCell } from './EditableCell';
import { api } from '../lib/api';

interface Column {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  options?: string[];
  editable: boolean;
}

interface EditableDataTableProps {
  tableName: string;
  columns: Column[];
  allowAdd?: boolean;
  allowDelete?: boolean;
  allowExport?: boolean;
  autoSave?: boolean;
  debounceMs?: number;
}

export const EditableDataTable: React.FC<EditableDataTableProps> = ({
  tableName,
  columns,
  allowAdd = true,
  allowDelete = true,
  allowExport = false,
  autoSave = true,
  debounceMs = 500
}) => {

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Charger les données
  useEffect(() => {
    loadData();
  }, [tableName]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/data/${tableName}`);
      setRows(response.data.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder une cellule
  const handleCellChange = async (rowId: number, key: string, value: any) => {
    // Mettre à jour localement
    setRows(prev => prev.map(row =>
      row.id === rowId
        ? { ...row, data: { ...row.data, [key]: value } }
        : row
    ));

    // Auto-save si activé
    if (autoSave) {
      setSaving(true);
      setTimeout(async () => {
        try {
          const row = rows.find(r => r.id === rowId);
          await api.put(`/api/data/${tableName}/${rowId}`, {
            data: { ...row.data, [key]: value }
          });
        } catch (error) {
          console.error('Error saving:', error);
        } finally {
          setSaving(false);
        }
      }, debounceMs);
    }
  };

  // Ajouter une ligne
  const handleAddRow = async () => {
    const newRow = {};
    columns.forEach(col => {
      newRow[col.key] = '';
    });

    try {
      const response = await api.post(`/api/data/${tableName}`, {
        data: newRow
      });
      setRows(prev => [...prev, response.data.data]);
    } catch (error) {
      console.error('Error adding row:', error);
    }
  };

  // Supprimer une ligne
  const handleDeleteRow = async (rowId: number) => {
    if (!confirm('Supprimer cette ligne ?')) return;

    try {
      await api.delete(`/api/data/${tableName}/${rowId}`);
      setRows(prev => prev.filter(r => r.id !== rowId));
    } catch (error) {
      console.error('Error deleting row:', error);
    }
  };

  if (loading) {
    return <div>Chargement...</div>;
  }

  return (
    <div className="editable-table">
      {saving && <div className="saving-indicator">Sauvegarde...</div>}

      <table>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
            {allowDelete && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              {columns.map(col => (
                <td key={col.key}>
                  <EditableCell
                    value={row.data[col.key]}
                    type={col.type}
                    options={col.options}
                    editable={col.editable}
                    onChange={(value) => handleCellChange(row.id, col.key, value)}
                  />
                </td>
              ))}
              {allowDelete && (
                <td>
                  <button onClick={() => handleDeleteRow(row.id)}>
                    Supprimer
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {allowAdd && (
        <button onClick={handleAddRow}>Ajouter une ligne</button>
      )}
    </div>
  );
};
```

---

## Phase 4-6 : Voir Documents Séparés

Les phases suivantes sont détaillées dans les documents suivants :

- **Phase 4** : Voir document à créer `03-INTEGRATION-N8N.md`
- **Phase 5** : Voir document à créer `04-VERSIONING-HISTORIQUE.md`
- **Phase 6** : Voir document à créer `05-TESTS-POLISH.md`

---

## 🎯 Prochaine Étape

**Commencer par Phase 1, Étape 1.1** : Créer les migrations SQL

**Voulez-vous que je crée les documents restants (Phases 4-6) ?**
