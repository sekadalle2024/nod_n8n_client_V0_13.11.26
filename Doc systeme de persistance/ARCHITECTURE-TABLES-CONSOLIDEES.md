# ARCHITECTURE - TABLES AVEC CONSOLIDATIONS ET MENUS DÉROULANTS

## 📋 Problématique

**Cas d'usage réel** : Tables d'audit avec assertions comptables

```
Table Source: "Feuille de Révision Comptable"
┌──────────────┬──────────┬──────────┬──────────┬──────────┐
│ Compte       │ Montant  │ Écart    │ Assertion│ Statut   │
│              │ Comptable│          │          │          │
├──────────────┼──────────┼──────────┼──────────┼──────────┤
│ 411 Client A │ 125,000  │ 5,000    │ Existence│ ▼ Validé │ ← Menu déroulant
│ 411 Client B │ 89,000   │ -2,000   │ Existence│ ▼ En cours│
│ 512 Banque   │ 450,000  │ 0        │ Valorisation│ ▼ Validé│
└──────────────┴──────────┴──────────┴──────────┴──────────┘
                         ↓
              Consolidation automatique
                         ↓
Table Consolidée: "Synthèse par Assertion"
┌──────────────┬───────────┬──────────┬─────────┐
│ Assertion    │ Nb Comptes│ Total    │ Écarts  │
│              │           │ Montant  │ Cumul   │
├──────────────┼───────────┼──────────┼─────────┤
│ Existence    │ 2         │ 214,000  │ 3,000   │ ← Auto-calculé
│ Valorisation │ 1         │ 450,000  │ 0       │
└──────────────┴───────────┴──────────┴─────────┘
```

**Défis** :

1. ❌ Menu déroulant mal persisté (valeur ou index ?)
2. ❌ Consolidations incohérentes après modification
3. ❌ Calculs perdus au rechargement
4. ❌ Ordre de mise à jour non garanti
5. ❌ Difficile de déboguer les erreurs

---

## 🏗️ Solution Complète avec PostgreSQL

### Architecture Globale

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPOSANT REACT                               │
│                                                                  │
│  Table Source (Éditable)                                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  onChange → Validation → State Update → Trigger Calcul     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                         ↓                                        │
│  Debounce (1s) → Save Source + Calcul Consolidation            │
│                         ↓                                        │
│  Table Consolidée (Read-Only)                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Affichage résultats agrégés (auto-refresh)                │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    API SERVEUR NOD                               │
│                                                                  │
│  POST /api/audit/schemas/:id/data                               │
│  PUT  /api/audit/data/:id                                       │
│    ↓                                                             │
│  1. Sauvegarder ligne source                                    │
│  2. Recalculer consolidation                                    │
│  3. Sauvegarder table consolidée                                │
│  4. Retourner les deux                                          │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    POSTGRESQL                                    │
│                                                                  │
│  audit_table_data (Source)                                      │
│  row_data = {                                                    │
│    "assertion": "Existence",      ← Valeur texte, pas index    │
│    "montant": 125000,                                           │
│    "statut": "Validé"                                           │
│  }                                                               │
│                         ↓                                        │
│  audit_table_consolidations (Agrégats)                          │
│  {                                                               │
│    "source_schema_id": "uuid-source",                           │
│    "group_by": "assertion",                                     │
│    "aggregates": {                                              │
│      "Existence": { "count": 2, "sum_montant": 214000 }        │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💾 Schéma Base de Données : Tables de Consolidation

### Nouvelle Table : `audit_table_consolidations`

```sql
CREATE TABLE audit_table_consolidations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source des données
  source_schema_id UUID NOT NULL REFERENCES audit_table_schemas(id) ON DELETE CASCADE,

  -- Configuration de la consolidation
  group_by_column TEXT NOT NULL,          -- Ex: "assertion"
  aggregate_columns JSONB NOT NULL,       -- Ex: ["montant", "ecart"]
  aggregate_functions JSONB NOT NULL,     -- Ex: {"montant": ["sum", "count"], "ecart": ["sum"]}

  -- Résultats calculés (JSONB pour flexibilité)
  aggregates JSONB NOT NULL,              -- Résultats par groupe

  -- Métadonnées
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Index pour performance
  CONSTRAINT unique_consolidation UNIQUE(source_schema_id, group_by_column)
);

CREATE INDEX idx_consolidations_source ON audit_table_consolidations(source_schema_id);
CREATE INDEX idx_consolidations_calculated ON audit_table_consolidations(last_calculated_at);
```

### Exemple de Données Consolidées

```json
{
  "source_schema_id": "uuid-feuille-revision",
  "group_by_column": "assertion",
  "aggregate_columns": ["montant", "ecart"],
  "aggregate_functions": {
    "montant": ["sum", "count", "avg"],
    "ecart": ["sum", "abs_sum"]
  },
  "aggregates": {
    "Existence": {
      "count": 2,
      "montant_sum": 214000,
      "montant_avg": 107000,
      "ecart_sum": 3000,
      "ecart_abs_sum": 7000
    },
    "Valorisation": {
      "count": 1,
      "montant_sum": 450000,
      "montant_avg": 450000,
      "ecart_sum": 0,
      "ecart_abs_sum": 0
    },
    "Exhaustivité": {
      "count": 5,
      "montant_sum": 1250000,
      "montant_avg": 250000,
      "ecart_sum": -5000,
      "ecart_abs_sum": 15000
    }
  },
  "last_calculated_at": "2024-11-12T23:50:00Z"
}
```

---

## 🔧 Implémentation Backend

### 1. Fonction de Consolidation

```typescript
// src/server/db-audit-tables-consolidation.ts

interface ConsolidationConfig {
  sourceSchemaId: string;
  groupByColumn: string;
  aggregateColumns: string[];
  aggregateFunctions: Record<string, string[]>; // { "montant": ["sum", "count"] }
}

interface AggregateResult {
  [group: string]: {
    count: number;
    [key: string]: number; // montant_sum, ecart_avg, etc.
  };
}

/**
 * Recalcule la consolidation d'une table source
 */
export async function calculateConsolidation(
  config: ConsolidationConfig,
  userId: string,
): Promise<AggregateResult> {
  const { sourceSchemaId, groupByColumn, aggregateColumns, aggregateFunctions } = config;

  // 1. Récupérer toutes les lignes de la table source
  const sourceRows = await db('audit_table_data')
    .join('audit_table_schemas', 'audit_table_data.table_schema_id', 'audit_table_schemas.id')
    .where({
      'audit_table_schemas.id': sourceSchemaId,
      'audit_table_schemas.user_id': userId,
    })
    .whereNull('audit_table_data.deleted_at')
    .select('audit_table_data.row_data');

  // 2. Grouper par la colonne spécifiée
  const groups: Record<string, any[]> = {};

  for (const row of sourceRows) {
    const groupValue = row.row_data[groupByColumn];
    if (!groupValue) continue;

    if (!groups[groupValue]) {
      groups[groupValue] = [];
    }
    groups[groupValue].push(row.row_data);
  }

  // 3. Calculer les agrégats pour chaque groupe
  const results: AggregateResult = {};

  for (const [groupValue, rows] of Object.entries(groups)) {
    results[groupValue] = {
      count: rows.length,
    };

    // Calculer chaque fonction d'agrégation
    for (const column of aggregateColumns) {
      const functions = aggregateFunctions[column] || [];

      for (const func of functions) {
        const key = `${column}_${func}`;
        results[groupValue][key] = calculateAggregate(rows, column, func);
      }
    }
  }

  return results;
}

/**
 * Calcule une fonction d'agrégation sur une colonne
 */
function calculateAggregate(rows: any[], column: string, func: string): number {
  const values = rows.map((row) => parseFloat(row[column])).filter((val) => !isNaN(val));

  if (values.length === 0) return 0;

  switch (func) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0);

    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length;

    case 'min':
      return Math.min(...values);

    case 'max':
      return Math.max(...values);

    case 'count':
      return values.length;

    case 'abs_sum':
      // Somme des valeurs absolues (pour écarts)
      return values.reduce((a, b) => a + Math.abs(b), 0);

    default:
      return 0;
  }
}

/**
 * Sauvegarde les résultats de consolidation
 */
export async function saveConsolidation(
  config: ConsolidationConfig,
  aggregates: AggregateResult,
  userId: string,
): Promise<void> {
  await db('audit_table_consolidations')
    .insert({
      source_schema_id: config.sourceSchemaId,
      group_by_column: config.groupByColumn,
      aggregate_columns: config.aggregateColumns,
      aggregate_functions: config.aggregateFunctions,
      aggregates: aggregates,
      last_calculated_at: new Date(),
      updated_at: new Date(),
    })
    .onConflict(['source_schema_id', 'group_by_column'])
    .merge({
      aggregates: aggregates,
      last_calculated_at: new Date(),
      updated_at: new Date(),
    });
}

/**
 * Récupère la consolidation d'une table
 */
export async function getConsolidation(
  sourceSchemaId: string,
  groupByColumn: string,
  userId: string,
): Promise<AggregateResult | null> {
  const consolidation = await db('audit_table_consolidations')
    .join(
      'audit_table_schemas',
      'audit_table_consolidations.source_schema_id',
      'audit_table_schemas.id',
    )
    .where({
      'audit_table_consolidations.source_schema_id': sourceSchemaId,
      'audit_table_consolidations.group_by_column': groupByColumn,
      'audit_table_schemas.user_id': userId,
    })
    .select('audit_table_consolidations.aggregates')
    .first();

  return consolidation ? consolidation.aggregates : null;
}
```

### 2. Modification de `updateTableData` pour Déclencher Consolidation

```typescript
// src/server/db-audit-tables.ts

export async function updateTableData({ dataId, userId, rowData }) {
  return await db.transaction(async (trx) => {
    // 1. Lire ancienne valeur
    const oldRow = await trx('audit_table_data').where({ id: dataId }).first();

    // 2. Mettre à jour
    const [updatedRow] = await trx('audit_table_data')
      .where({ id: dataId })
      .update({
        row_data: rowData,
        updated_at: new Date(),
      })
      .returning('*');

    // 3. Créer version
    await trx('audit_data_versions').insert({
      table_data_id: dataId,
      row_data: oldRow.row_data,
      change_type: 'update',
      changed_at: new Date(),
      changed_by: userId,
    });

    // 4. 🆕 DÉCLENCHER RECALCUL DES CONSOLIDATIONS
    const schemaId = updatedRow.table_schema_id;
    await recalculateAllConsolidations(schemaId, userId, trx);

    return updatedRow;
  });
}

/**
 * Recalcule toutes les consolidations liées à un schéma
 */
async function recalculateAllConsolidations(schemaId: string, userId: string, trx: any) {
  // Récupérer toutes les consolidations configurées pour ce schéma
  const consolidations = await trx('audit_table_consolidations')
    .where({ source_schema_id: schemaId })
    .select('*');

  for (const consol of consolidations) {
    const config: ConsolidationConfig = {
      sourceSchemaId: consol.source_schema_id,
      groupByColumn: consol.group_by_column,
      aggregateColumns: consol.aggregate_columns,
      aggregateFunctions: consol.aggregate_functions,
    };

    // Recalculer
    const aggregates = await calculateConsolidation(config, userId);

    // Sauvegarder dans la transaction
    await trx('audit_table_consolidations')
      .where({
        source_schema_id: config.sourceSchemaId,
        group_by_column: config.groupByColumn,
      })
      .update({
        aggregates: aggregates,
        last_calculated_at: new Date(),
        updated_at: new Date(),
      });
  }
}
```

---

## 🎨 Implémentation Frontend

### 1. Composant Table Source avec Menu Déroulant

```typescript
// src/web/components/EditableDataTableWithConsolidation.tsx

interface Column {
  name: string;
  type: 'text' | 'number' | 'select';
  displayName: string;
  options?: string[]; // Pour type 'select'
}

function CellWithSelect({ value, column, onChange }: CellProps) {
  if (column.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="cell-select"
      >
        <option value="">-- Sélectionner --</option>
        {column.options?.map(opt => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  // Autres types...
  return <input type="text" value={value} onChange={e => onChange(e.target.value)} />;
}

export function EditableDataTableWithConsolidation({ schemaId }: Props) {
  const [sourceRows, setSourceRows] = useState([]);
  const [consolidation, setConsolidation] = useState(null);
  const [pendingChanges, setPendingChanges] = useState(new Map());

  // Charger données source ET consolidation
  useEffect(() => {
    loadSourceData();
    loadConsolidation();
  }, [schemaId]);

  // Auto-save avec recalcul de consolidation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (pendingChanges.size > 0) {
        savePendingChangesWithConsolidation();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [pendingChanges]);

  async function savePendingChangesWithConsolidation() {
    // Sauvegarder les changements
    await savePendingChanges();

    // Recharger la consolidation (auto-calculée côté serveur)
    await loadConsolidation();
  }

  async function loadConsolidation() {
    const response = await fetch(
      `/api/audit/schemas/${schemaId}/consolidation?groupBy=assertion`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const data = await response.json();
    setConsolidation(data.aggregates);
  }

  return (
    <div className="table-with-consolidation">

      {/* Table source éditable */}
      <section className="source-table">
        <h2>Feuille de Révision Comptable</h2>
        <DataGrid
          rows={sourceRows}
          columns={columns}
          onCellChange={handleCellChange}
          editable={true}
        />
      </section>

      {/* Table consolidée (read-only) */}
      <section className="consolidated-table">
        <h2>Synthèse par Assertion</h2>
        <ConsolidationGrid
          data={consolidation}
          groupBy="assertion"
        />
        <small>
          Dernière mise à jour : {formatDate(consolidation?.last_calculated_at)}
        </small>
      </section>

    </div>
  );
}
```

### 2. Affichage de la Consolidation

```typescript
function ConsolidationGrid({ data, groupBy }: ConsolidationGridProps) {
  if (!data) return <div>Chargement...</div>;

  const groups = Object.keys(data);

  return (
    <table className="consolidation-grid">
      <thead>
        <tr>
          <th>{groupBy}</th>
          <th>Nb Comptes</th>
          <th>Total Montant</th>
          <th>Montant Moyen</th>
          <th>Écarts Cumulés</th>
        </tr>
      </thead>
      <tbody>
        {groups.map(group => (
          <tr key={group}>
            <td><strong>{group}</strong></td>
            <td>{data[group].count}</td>
            <td>{formatCurrency(data[group].montant_sum)}</td>
            <td>{formatCurrency(data[group].montant_avg)}</td>
            <td className={data[group].ecart_sum < 0 ? 'negative' : ''}>
              {formatCurrency(data[group].ecart_sum)}
            </td>
          </tr>
        ))}
        <tr className="total-row">
          <td><strong>TOTAL</strong></td>
          <td>{groups.reduce((sum, g) => sum + data[g].count, 0)}</td>
          <td>{formatCurrency(groups.reduce((sum, g) => sum + data[g].montant_sum, 0))}</td>
          <td>-</td>
          <td>{formatCurrency(groups.reduce((sum, g) => sum + data[g].ecart_sum, 0))}</td>
        </tr>
      </tbody>
    </table>
  );
}
```

---

## 🔄 Routes API Supplémentaires

```typescript
// src/server/routes-audit-tables.ts

/**
 * Récupérer la consolidation d'une table
 */
app.get('/api/audit/schemas/:id/consolidation', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const { groupBy } = request.query;

  if (!groupBy) {
    return reply.status(400).send({ error: 'Paramètre groupBy requis' });
  }

  try {
    const aggregates = await getConsolidation(schemaId, groupBy as string, request.user.id);

    if (!aggregates) {
      return reply.status(404).send({ error: 'Consolidation non trouvée' });
    }

    return reply.send({ aggregates });
  } catch (error) {
    console.error('Erreur récupération consolidation:', error);
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
});

/**
 * Créer ou mettre à jour une configuration de consolidation
 */
app.post('/api/audit/schemas/:id/consolidation/config', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const { groupByColumn, aggregateColumns, aggregateFunctions } = request.body;

  try {
    // Créer la configuration
    const config: ConsolidationConfig = {
      sourceSchemaId: schemaId,
      groupByColumn,
      aggregateColumns,
      aggregateFunctions,
    };

    // Calculer immédiatement
    const aggregates = await calculateConsolidation(config, request.user.id);

    // Sauvegarder
    await saveConsolidation(config, aggregates, request.user.id);

    return reply.status(201).send({
      config,
      aggregates,
    });
  } catch (error) {
    console.error('Erreur création consolidation:', error);
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
});

/**
 * Forcer le recalcul d'une consolidation
 */
app.post('/api/audit/schemas/:id/consolidation/recalculate', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const { groupBy } = request.body;

  try {
    // Récupérer la config existante
    const consol = await db('audit_table_consolidations')
      .where({
        source_schema_id: schemaId,
        group_by_column: groupBy,
      })
      .first();

    if (!consol) {
      return reply.status(404).send({ error: 'Configuration non trouvée' });
    }

    const config: ConsolidationConfig = {
      sourceSchemaId: consol.source_schema_id,
      groupByColumn: consol.group_by_column,
      aggregateColumns: consol.aggregate_columns,
      aggregateFunctions: consol.aggregate_functions,
    };

    // Recalculer
    const aggregates = await calculateConsolidation(config, request.user.id);

    // Sauvegarder
    await saveConsolidation(config, aggregates, request.user.id);

    return reply.send({ aggregates });
  } catch (error) {
    console.error('Erreur recalcul consolidation:', error);
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
});
```

---

## 🎯 Exemple Concret : Feuille de Révision

### Configuration Initiale

```json
{
  "sourceSchemaId": "uuid-feuille-revision",
  "groupByColumn": "assertion",
  "aggregateColumns": ["montant_comptable", "ecart"],
  "aggregateFunctions": {
    "montant_comptable": ["sum", "count", "avg"],
    "ecart": ["sum", "abs_sum"]
  }
}
```

### Données Source

```json
[
  {
    "id": "row-1",
    "row_data": {
      "compte": "411 Client A",
      "montant_comptable": 125000,
      "ecart": 5000,
      "assertion": "Existence",
      "statut": "Validé"
    }
  },
  {
    "id": "row-2",
    "row_data": {
      "compte": "411 Client B",
      "montant_comptable": 89000,
      "ecart": -2000,
      "assertion": "Existence",
      "statut": "En cours"
    }
  },
  {
    "id": "row-3",
    "row_data": {
      "compte": "512 Banque",
      "montant_comptable": 450000,
      "ecart": 0,
      "assertion": "Valorisation",
      "statut": "Validé"
    }
  }
]
```

### Résultat Consolidé

```json
{
  "Existence": {
    "count": 2,
    "montant_comptable_sum": 214000,
    "montant_comptable_avg": 107000,
    "ecart_sum": 3000,
    "ecart_abs_sum": 7000
  },
  "Valorisation": {
    "count": 1,
    "montant_comptable_sum": 450000,
    "montant_comptable_avg": 450000,
    "ecart_sum": 0,
    "ecart_abs_sum": 0
  }
}
```

### Affichage Interface

```
┌─────────────────────────────────────────────────────────────┐
│  Synthèse par Assertion                                      │
├──────────────┬───────────┬──────────────┬──────────────────┤
│ Assertion    │ Nb Comptes│ Total Montant│ Écarts Cumulés   │
├──────────────┼───────────┼──────────────┼──────────────────┤
│ Existence    │ 2         │ 214 000 XOF  │ 3 000 XOF        │
│ Valorisation │ 1         │ 450 000 XOF  │ 0 XOF            │
├──────────────┼───────────┼──────────────┼──────────────────┤
│ TOTAL        │ 3         │ 664 000 XOF  │ 3 000 XOF        │
└──────────────┴───────────┴──────────────┴──────────────────┘

Dernière mise à jour : 12/11/2024 23:50:00
[🔄 Recalculer maintenant]
```

---

## ✅ Avantages de Cette Solution

| Problème Antérieur                  | Solution PostgreSQL                          |
| ----------------------------------- | -------------------------------------------- |
| ❌ Menu déroulant mal persisté      | ✅ Valeur texte complète stockée en JSONB    |
| ❌ Calculs perdus au reload         | ✅ Consolidation persistée dans table dédiée |
| ❌ Incohérences après modif         | ✅ Recalcul automatique dans transaction     |
| ❌ Ordre de mise à jour non garanti | ✅ Transaction PostgreSQL atomique           |
| ❌ Difficile à déboguer             | ✅ Historique complet + timestamp recalcul   |
| ❌ Performance dégradée             | ✅ Index JSONB + agrégats pré-calculés       |

---

## 🚀 Migration depuis Votre Ancien Système

### Étape 1 : Exporter vos données actuelles

```json
{
  "tables": [
    {
      "name": "feuille_revision",
      "columns": [...],
      "rows": [...]
    }
  ],
  "consolidations": [
    {
      "source": "feuille_revision",
      "groupBy": "assertion",
      "aggregates": {...}
    }
  ]
}
```

### Étape 2 : Importer via API

```typescript
POST /api/audit/import
{
  "tables": [...],
  "consolidations": [...]
}

// Le serveur va :
// 1. Créer les schémas
// 2. Insérer les données
// 3. Configurer les consolidations
// 4. Calculer les agrégats
```

---

## 📊 Tests de Non-Régression

```typescript
// tests/consolidation.test.ts

describe('Consolidations', () => {
  it('devrait recalculer automatiquement après modification', async () => {
    // 1. Créer table source
    const schema = await createTableSchema({...});

    // 2. Insérer données
    await insertTableData({ assertion: 'Existence', montant: 125000 });
    await insertTableData({ assertion: 'Existence', montant: 89000 });

    // 3. Configurer consolidation
    await createConsolidation({
      sourceSchemaId: schema.id,
      groupByColumn: 'assertion',
      aggregateColumns: ['montant'],
      aggregateFunctions: { montant: ['sum'] }
    });

    // 4. Vérifier calcul initial
    let consol = await getConsolidation(schema.id, 'assertion');
    expect(consol.Existence.montant_sum).toBe(214000);

    // 5. Modifier une ligne
    await updateTableData({
      dataId: 'row-1',
      rowData: { assertion: 'Existence', montant: 130000 } // Changé de 125k à 130k
    });

    // 6. Vérifier recalcul automatique
    consol = await getConsolidation(schema.id, 'assertion');
    expect(consol.Existence.montant_sum).toBe(219000); // 130k + 89k
  });
});
```

---

**Cette architecture garantit la persistance fiable de vos tables consolidées !** ✅

Voulez-vous que je crée également un exemple complet avec votre cas spécifique d'assertions comptables ?
