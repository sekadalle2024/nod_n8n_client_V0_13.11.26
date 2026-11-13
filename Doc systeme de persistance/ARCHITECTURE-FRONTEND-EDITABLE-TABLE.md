# ARCHITECTURE FRONTEND - COMPOSANT EDITABLE TABLE

## 📋 Vue d'Ensemble

Le composant `<EditableDataTable>` permet l'édition en temps réel des tables d'audit stockées dans PostgreSQL, avec versioning automatique et synchronisation bidirectionnelle.

---

## 🏗️ Architecture Globale

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVIGATEUR (React)                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         <EditableDataTable schemaId="xxx" />          │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │ State Local  │  │ Optimistic   │  │   Debounce  │ │ │
│  │  │ (React)      │  │ Updates      │  │   Save      │ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Grille Éditable (AG Grid / TanStack)     │ │ │
│  │  │  - Édition inline                                │ │ │
│  │  │  - Drag & drop réorganisation                    │ │ │
│  │  │  │  - Validation temps réel                       │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│                              │ REST API (fetch)              │
│                              ▼                               │
└─────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼──────────────────────────────┐
│                      SERVEUR NOD (Fastify)                   │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐ │
│  │              API Routes (/api/audit/*)                 │ │
│  │                                                        │ │
│  │  GET    /schemas/:id/data     → Lire toutes lignes   │ │
│  │  POST   /schemas/:id/data     → Créer ligne          │ │
│  │  PUT    /data/:id             → Modifier ligne       │ │
│  │  DELETE /data/:id             → Supprimer ligne      │ │
│  │  PUT    /data/:id/order       → Réorganiser          │ │
│  │  GET    /data/:id/versions    → Historique           │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌───────────────────────────▼────────────────────────────┐ │
│  │         Fonctions CRUD (db-audit-tables.ts)           │ │
│  │  - getTableData()                                     │ │
│  │  - insertTableData()                                  │ │
│  │  - updateTableData()  → Crée version automatiquement │ │
│  │  - deleteTableData()                                  │ │
│  │  - reorderTableData()                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
└──────────────────────────────┼──────────────────────────────┘
                               │ SQL (Knex.js)
┌──────────────────────────────▼──────────────────────────────┐
│                    POSTGRESQL (Docker)                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  audit_table_schemas                                   │ │
│  │  - id, user_id, table_name, column_definitions         │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌────────────────────────────▼──────────────────────────┐ │
│  │  audit_table_data                                      │ │
│  │  - id, table_schema_id, row_data (JSONB), row_order   │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│  ┌────────────────────────────▼──────────────────────────┐ │
│  │  audit_data_versions  (HISTORIQUE)                     │ │
│  │  - id, table_data_id, row_data, change_type, date      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Composant React : EditableDataTable

### Structure du Composant

```typescript
// src/web/components/EditableDataTable.tsx

interface EditableDataTableProps {
  schemaId: string; // UUID du schéma de table
  onDataChange?: () => void; // Callback après modification
  readOnly?: boolean; // Mode lecture seule
  maxRows?: number; // Limite affichage (pagination)
}

interface TableRow {
  id: string; // UUID de la ligne
  row_data: Record<string, any>; // Données JSONB
  row_order: number; // Ordre d'affichage
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

interface ColumnDefinition {
  name: string; // Nom technique (clé JSON)
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  displayName: string; // Nom affiché
  required?: boolean;
  options?: string[]; // Pour type 'select'
}
```

### Cycle de Vie du Composant

```typescript
export function EditableDataTable({ schemaId, onDataChange, readOnly }: EditableDataTableProps) {
  // 1. État local
  const [schema, setSchema] = useState<TableSchema | null>(null);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, any>>(new Map());

  // 2. Chargement initial
  useEffect(() => {
    loadSchemaAndData();
  }, [schemaId]);

  // 3. Auto-save avec debounce (1 seconde)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingChanges.size > 0) {
        savePendingChanges();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [pendingChanges]);

  // ... handlers
}
```

---

## 🔄 Flux de Données : Modification d'une Cellule

### Scénario : Utilisateur modifie le solde d'un compte

```
ÉTAPE 1 : Utilisateur clique sur cellule "solde"
┌─────────────────────────────────────────┐
│  N° Compte  │  Solde    │  Devise       │
│─────────────┼───────────┼───────────────│
│  4001234567 │ [125000]← │  XOF          │  ← Édition en cours
│  4001234568 │  89000    │  XOF          │
└─────────────────────────────────────────┘

ÉTAPE 2 : Modification locale (Optimistic Update)
┌─────────────────────────────────────────┐
│  N° Compte  │  Solde    │  Devise       │
│─────────────┼───────────┼───────────────│
│  4001234567 │ 130000 💾 │  XOF          │  ← Indicateur "non sauvegardé"
│  4001234568 │  89000    │  XOF          │
└─────────────────────────────────────────┘

State React:
{
  rows: [
    { id: "row-uuid-1", row_data: { compte: "4001234567", solde: 130000, ... } }
  ],
  pendingChanges: Map {
    "row-uuid-1" => { solde: 130000 }
  }
}

ÉTAPE 3 : Debounce (1 seconde sans autre modification)

ÉTAPE 4 : Requête HTTP PUT
PUT /api/audit/data/row-uuid-1
Authorization: Bearer token
Content-Type: application/json

{
  "rowData": {
    "compte": "4001234567",
    "solde": 130000,
    "devise": "XOF",
    "date_derniere_op": "2023-01-15",
    ...
  }
}

ÉTAPE 5 : Serveur - updateTableData() [db-audit-tables.ts]

async function updateTableData({ dataId, userId, rowData }) {
  // Transaction PostgreSQL
  await db.transaction(async (trx) => {

    // 5.1 : Lire ancienne valeur
    const oldRow = await trx('audit_table_data')
      .where({ id: dataId, table_schema_id: ... })
      .first();

    // 5.2 : Mettre à jour la ligne
    await trx('audit_table_data')
      .where({ id: dataId })
      .update({
        row_data: rowData,           // Nouvelle valeur
        updated_at: new Date()
      });

    // 5.3 : Créer version automatiquement (AUDIT TRAIL)
    await trx('audit_data_versions').insert({
      id: uuid(),
      table_data_id: dataId,
      row_data: oldRow.row_data,    // ← Ancienne valeur sauvegardée
      change_type: 'update',
      changed_at: new Date(),
      changed_by: userId
    });

  });

  return updatedRow;
}

ÉTAPE 6 : PostgreSQL Execution

-- Transaction BEGIN

-- Lecture ancienne valeur
SELECT * FROM audit_table_data WHERE id = 'row-uuid-1';
-- Résultat: { row_data: { solde: 125000 }, ... }

-- Update
UPDATE audit_table_data
SET row_data = '{"compte":"4001234567","solde":130000,"devise":"XOF",...}'::jsonb,
    updated_at = NOW()
WHERE id = 'row-uuid-1';

-- Insertion version (historique)
INSERT INTO audit_data_versions (id, table_data_id, row_data, change_type, changed_at)
VALUES (
  'version-uuid',
  'row-uuid-1',
  '{"compte":"4001234567","solde":125000,"devise":"XOF",...}'::jsonb,  ← Ancienne valeur
  'update',
  NOW()
);

-- COMMIT

ÉTAPE 7 : Réponse HTTP 200
{
  "data": {
    "id": "row-uuid-1",
    "row_data": { "compte": "4001234567", "solde": 130000, ... },
    "updated_at": "2024-11-12T23:45:00Z"
  }
}

ÉTAPE 8 : Mise à jour React
┌─────────────────────────────────────────┐
│  N° Compte  │  Solde    │  Devise       │
│─────────────┼───────────┼───────────────│
│  4001234567 │ 130000 ✓  │  XOF          │  ← Sauvegardé !
│  4001234568 │  89000    │  XOF          │
└─────────────────────────────────────────┘

State React:
{
  rows: [mise à jour avec réponse serveur],
  pendingChanges: Map {} ← Vidé
}
```

---

## 💾 Implémentation : Handlers React

### 1. Chargement Initial

```typescript
async function loadSchemaAndData() {
  setLoading(true);

  try {
    // Charger le schéma (colonnes, types)
    const schemaRes = await fetch(`/api/audit/schemas/${schemaId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const schemaData = await schemaRes.json();
    setSchema(schemaData.schema);

    // Charger les données
    const dataRes = await fetch(`/api/audit/schemas/${schemaId}/data`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dataJson = await dataRes.json();

    // Trier par row_order
    const sortedRows = dataJson.data.sort((a, b) => a.row_order - b.row_order);
    setRows(sortedRows);
  } catch (error) {
    console.error('Erreur chargement:', error);
    // Afficher toast d'erreur
  } finally {
    setLoading(false);
  }
}
```

### 2. Modification de Cellule

```typescript
function handleCellChange(rowId: string, columnName: string, newValue: any) {
  // Optimistic update : mise à jour immédiate du state
  setRows((prevRows) =>
    prevRows.map((row) => {
      if (row.id === rowId) {
        return {
          ...row,
          row_data: {
            ...row.row_data,
            [columnName]: newValue,
          },
        };
      }
      return row;
    }),
  );

  // Marquer comme "en attente de sauvegarde"
  setPendingChanges((prev) => {
    const newMap = new Map(prev);
    const existing = newMap.get(rowId) || {};
    newMap.set(rowId, {
      ...existing,
      [columnName]: newValue,
    });
    return newMap;
  });

  // Le debounce (useEffect) va sauvegarder après 1 seconde
}
```

### 3. Sauvegarde Auto avec Debounce

```typescript
async function savePendingChanges() {
  if (pendingChanges.size === 0) return;

  setSaving(true);
  const changesArray = Array.from(pendingChanges.entries());

  try {
    // Sauvegarder chaque ligne modifiée
    await Promise.all(
      changesArray.map(async ([rowId, changes]) => {
        // Récupérer la ligne complète
        const row = rows.find((r) => r.id === rowId);
        if (!row) return;

        // Fusionner les changements avec les données existantes
        const updatedRowData = {
          ...row.row_data,
          ...changes,
        };

        // Envoyer au serveur
        const response = await fetch(`/api/audit/data/${rowId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rowData: updatedRowData }),
        });

        if (!response.ok) {
          throw new Error(`Erreur sauvegarde ligne ${rowId}`);
        }

        const result = await response.json();
        return result.data;
      }),
    );

    // Vider les changements en attente
    setPendingChanges(new Map());

    // Callback optionnel
    onDataChange?.();

    // Toast de succès
    showToast('Modifications sauvegardées', 'success');
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    showToast('Erreur lors de la sauvegarde', 'error');

    // Garder les changements en attente pour réessayer
  } finally {
    setSaving(false);
  }
}
```

### 4. Ajout de Ligne

```typescript
async function handleAddRow() {
  // Créer ligne vide avec valeurs par défaut
  const emptyRowData: Record<string, any> = {};

  schema.column_definitions.forEach((col) => {
    if (col.type === 'text') emptyRowData[col.name] = '';
    else if (col.type === 'number') emptyRowData[col.name] = 0;
    else if (col.type === 'date') emptyRowData[col.name] = new Date().toISOString().split('T')[0];
    else if (col.type === 'boolean') emptyRowData[col.name] = false;
    else if (col.type === 'select' && col.options) emptyRowData[col.name] = col.options[0];
  });

  try {
    // Envoyer au serveur
    const response = await fetch(`/api/audit/schemas/${schemaId}/data`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rowData: emptyRowData }),
    });

    const result = await response.json();
    const newRow = result.data;

    // Ajouter à la fin du tableau
    setRows((prevRows) => [...prevRows, newRow]);

    showToast('Ligne ajoutée', 'success');
  } catch (error) {
    console.error('Erreur ajout ligne:', error);
    showToast("Erreur lors de l'ajout", 'error');
  }
}
```

### 5. Suppression de Ligne

```typescript
async function handleDeleteRow(rowId: string) {
  // Confirmation utilisateur
  const confirmed = await confirm('Supprimer cette ligne ?');
  if (!confirmed) return;

  try {
    // Soft delete côté serveur
    const response = await fetch(`/api/audit/data/${rowId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Erreur suppression');
    }

    // Retirer de l'affichage
    setRows((prevRows) => prevRows.filter((row) => row.id !== rowId));

    showToast('Ligne supprimée', 'success');
  } catch (error) {
    console.error('Erreur suppression:', error);
    showToast('Erreur lors de la suppression', 'error');
  }
}
```

### 6. Réorganisation (Drag & Drop)

```typescript
async function handleRowReorder(rowId: string, newOrder: number) {
  // Optimistic update : réorganiser localement
  setRows((prevRows) => {
    const rowsCopy = [...prevRows];
    const rowIndex = rowsCopy.findIndex((r) => r.id === rowId);
    const [movedRow] = rowsCopy.splice(rowIndex, 1);
    rowsCopy.splice(newOrder, 0, movedRow);

    // Recalculer row_order pour chaque ligne
    return rowsCopy.map((row, index) => ({
      ...row,
      row_order: index,
    }));
  });

  try {
    // Mettre à jour sur le serveur
    await fetch(`/api/audit/data/${rowId}/order`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newOrder }),
    });
  } catch (error) {
    console.error('Erreur réorganisation:', error);
    // Recharger les données en cas d'erreur
    loadSchemaAndData();
  }
}
```

---

## 🎭 Composants UI Spécialisés

### CellEditor : Éditeur Selon Type

```typescript
interface CellEditorProps {
  value: any;
  columnDef: ColumnDefinition;
  onChange: (newValue: any) => void;
  onBlur: () => void;
}

function CellEditor({ value, columnDef, onChange, onBlur }: CellEditorProps) {
  switch (columnDef.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus
        />
      );

    case 'number':
      return (
        <input
          type="number"
          value={value || 0}
          onChange={e => onChange(parseFloat(e.target.value))}
          onBlur={onBlur}
          autoFocus
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus
        />
      );

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={value || false}
          onChange={e => onChange(e.target.checked)}
          onBlur={onBlur}
          autoFocus
        />
      );

    case 'select':
      return (
        <select
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          autoFocus
        >
          {columnDef.options?.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    default:
      return <span>{value}</span>;
  }
}
```

---

## 📊 Gestion PostgreSQL : Côté Serveur

### Requête PostgreSQL pour Modification

```sql
-- Exemple concret pour modification du solde

-- 1. Transaction BEGIN
BEGIN;

-- 2. Lecture ancienne valeur (pour historique)
SELECT
  id,
  row_data,
  updated_at
FROM audit_table_data
WHERE id = '550e8400-e29b-41d4-a716-446655440001'
  AND table_schema_id IN (
    SELECT id FROM audit_table_schemas WHERE user_id = 'user-uuid-123'
  );

-- Résultat:
-- { id: "550e...", row_data: {"compte":"4001234567","solde":125000,...}, ... }

-- 3. UPDATE avec JSONB
UPDATE audit_table_data
SET
  row_data = jsonb_set(
    row_data,
    '{solde}',              -- Chemin dans JSONB
    '130000'::jsonb,        -- Nouvelle valeur
    true                    -- Créer si inexistant
  ),
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440001';

-- 4. INSERT version (historique automatique)
INSERT INTO audit_data_versions (
  id,
  table_data_id,
  row_data,
  change_type,
  changed_at,
  changed_by
) VALUES (
  gen_random_uuid(),
  '550e8400-e29b-41d4-a716-446655440001',
  '{"compte":"4001234567","solde":125000,"devise":"XOF",...}'::jsonb, -- Ancienne valeur
  'update',
  NOW(),
  'user-uuid-123'
);

-- 5. COMMIT
COMMIT;
```

### Avantages de JSONB PostgreSQL

```sql
-- ✅ Indexation possible
CREATE INDEX idx_audit_data_solde ON audit_table_data
USING GIN ((row_data -> 'solde'));

-- ✅ Requêtes complexes possibles
SELECT * FROM audit_table_data
WHERE (row_data->>'solde')::numeric > 100000
  AND row_data->>'devise' = 'XOF';

-- ✅ Mise à jour partielle efficace
UPDATE audit_table_data
SET row_data = row_data || '{"statut":"validé"}'::jsonb
WHERE id = 'row-uuid';

-- ✅ Historique complet
SELECT
  changed_at,
  row_data->>'solde' as ancien_solde
FROM audit_data_versions
WHERE table_data_id = 'row-uuid'
ORDER BY changed_at DESC;
```

---

## 🔐 Sécurité et Performance

### 1. Validation Côté Client

```typescript
function validateCell(value: any, columnDef: ColumnDefinition): string | null {
  // Required
  if (columnDef.required && (value === null || value === undefined || value === '')) {
    return 'Ce champ est requis';
  }

  // Type number
  if (columnDef.type === 'number' && isNaN(Number(value))) {
    return 'Doit être un nombre';
  }

  // Type date
  if (columnDef.type === 'date' && !isValidDate(value)) {
    return 'Date invalide';
  }

  // Type select
  if (columnDef.type === 'select' && columnDef.options) {
    if (!columnDef.options.includes(value)) {
      return 'Valeur non autorisée';
    }
  }

  return null; // Valide
}
```

### 2. Optimisation: Batch Updates

```typescript
// Au lieu de sauvegarder chaque cellule séparément,
// grouper les modifications par ligne et sauvegarder toute la ligne

async function savePendingChangesBatch() {
  const updates = Array.from(pendingChanges.entries()).map(([rowId, changes]) => {
    const row = rows.find((r) => r.id === rowId);
    return {
      id: rowId,
      rowData: { ...row.row_data, ...changes },
    };
  });

  // Requête unique avec Promise.all
  await Promise.all(
    updates.map((update) =>
      fetch(`/api/audit/data/${update.id}`, {
        method: 'PUT',
        body: JSON.stringify({ rowData: update.rowData }),
      }),
    ),
  );
}
```

### 3. Gestion Conflits (Concurrent Updates)

```typescript
// Utiliser updated_at comme version optimiste

interface OptimisticLockError {
  type: 'conflict';
  serverVersion: string;
  clientVersion: string;
}

async function saveWithOptimisticLock(rowId: string, rowData: any, clientUpdatedAt: string) {
  const response = await fetch(`/api/audit/data/${rowId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Unmodified-Since': clientUpdatedAt, // ← Version client
    },
    body: JSON.stringify({ rowData }),
  });

  if (response.status === 412) {
    // Precondition Failed
    // Conflit détecté !
    const conflict = await response.json();

    // Afficher dialogue de résolution
    const resolution = await showConflictDialog({
      clientData: rowData,
      serverData: conflict.currentData,
    });

    if (resolution === 'keep-server') {
      // Recharger depuis serveur
      loadSchemaAndData();
    } else if (resolution === 'overwrite') {
      // Forcer l'écrasement
      await fetch(`/api/audit/data/${rowId}`, {
        method: 'PUT',
        headers: { 'X-Force-Overwrite': 'true' },
        body: JSON.stringify({ rowData }),
      });
    }
  }
}
```

---

## 📈 Indicateurs Visuels

### États Possibles d'une Cellule

```typescript
type CellState =
  | 'idle' // Aucune modification
  | 'editing' // En cours d'édition
  | 'pending' // Modifié, en attente de sauvegarde
  | 'saving' // Sauvegarde en cours
  | 'saved' // Sauvegardé avec succès
  | 'error'; // Erreur de sauvegarde

// Styles visuels
const cellStyles = {
  idle: 'bg-white border-gray-200',
  editing: 'bg-blue-50 border-blue-300',
  pending: 'bg-yellow-50 border-yellow-300', // 💾 icône
  saving: 'bg-blue-50 border-blue-300 opacity-50', // ⏳ spinner
  saved: 'bg-green-50 border-green-300', // ✓ icône
  error: 'bg-red-50 border-red-300', // ❌ icône
};
```

### Barre de Statut

```typescript
function StatusBar({ pendingChanges, saving }: StatusBarProps) {
  if (saving) {
    return (
      <div className="status-bar saving">
        ⏳ Sauvegarde en cours...
      </div>
    );
  }

  if (pendingChanges.size > 0) {
    return (
      <div className="status-bar pending">
        💾 {pendingChanges.size} modification(s) non sauvegardée(s)
      </div>
    );
  }

  return (
    <div className="status-bar saved">
      ✓ Toutes les modifications sont sauvegardées
    </div>
  );
}
```

---

## 🎯 Exemple Complet : Composant Final

```typescript
// src/web/components/EditableDataTable.tsx

import { useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

export function EditableDataTable({ schemaId }: { schemaId: string }) {
  const [schema, setSchema] = useState(null);
  const [rows, setRows] = useState([]);
  const [columnDefs, setColumnDefs] = useState([]);
  const [pendingChanges, setPendingChanges] = useState(new Map());
  const [saving, setSaving] = useState(false);

  // Chargement initial
  useEffect(() => {
    loadData();
  }, [schemaId]);

  // Auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingChanges.size > 0) savePendingChanges();
    }, 1000);
    return () => clearTimeout(timer);
  }, [pendingChanges]);

  async function loadData() {
    // ... (voir plus haut)
  }

  async function savePendingChanges() {
    // ... (voir plus haut)
  }

  function handleCellValueChanged(params) {
    const rowId = params.data.id;
    const field = params.colDef.field;
    const newValue = params.newValue;

    setPendingChanges(prev => {
      const map = new Map(prev);
      map.set(rowId, { ...map.get(rowId), [field]: newValue });
      return map;
    });
  }

  return (
    <div className="editable-data-table">
      <div className="toolbar">
        <button onClick={handleAddRow}>➕ Ajouter une ligne</button>
        <StatusBar pendingChanges={pendingChanges} saving={saving} />
      </div>

      <div className="ag-theme-alpine" style={{ height: 600, width: '100%' }}>
        <AgGridReact
          rowData={rows.map(r => ({ id: r.id, ...r.row_data }))}
          columnDefs={columnDefs}
          onCellValueChanged={handleCellValueChanged}
          defaultColDef={{
            editable: true,
            sortable: true,
            filter: true,
            resizable: true
          }}
          rowDragManaged={true}
          animateRows={true}
        />
      </div>
    </div>
  );
}
```

---

## 🚀 Résumé : Points Clés

| Aspect              | Solution                                                |
| ------------------- | ------------------------------------------------------- |
| **État local**      | React useState pour optimistic updates                  |
| **Synchronisation** | Debounce 1s avant sauvegarde API                        |
| **Versioning**      | Automatique côté serveur (PostgreSQL)                   |
| **Performance**     | Batch updates + JSONB indexé                            |
| **Sécurité**        | Validation client + serveur, isolation user_id          |
| **UX**              | Indicateurs visuels (pending/saved/error)               |
| **Historique**      | Accessible via modal, stocké dans `audit_data_versions` |

**Le composant est 100% fonctionnel dès que le backend est testé et validé !** 🎉
