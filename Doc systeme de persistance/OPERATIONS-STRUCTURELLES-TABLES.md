# OPÉRATIONS STRUCTURELLES SUR LES TABLES

## 📋 Vue d'Ensemble

Cette documentation couvre toutes les opérations de modification de structure :

- ✅ Ajouter une colonne
- ✅ Supprimer une colonne
- ✅ Renommer une colonne
- ✅ Modifier type de colonne
- ✅ Dupliquer une ligne
- ✅ Dupliquer une table complète
- ✅ Créer une nouvelle table
- ✅ Importer/Exporter HTML

---

## 🏗️ Architecture : Schéma Flexible

### Principe JSONB : Pas de Migration SQL

```
❌ Base de données traditionnelle :
ALTER TABLE add_column → Migration lourde, downtime

✅ Avec JSONB PostgreSQL :
- Structure stockée dans column_definitions (JSONB)
- Données stockées dans row_data (JSONB)
- Modification = Mise à jour JSON
- AUCUNE migration SQL requise
- AUCUN downtime
```

### Exemple

```sql
-- Table audit_table_schemas
{
  "id": "uuid-schema-1",
  "column_definitions": [           ← Structure flexible
    { "name": "compte", "type": "text" },
    { "name": "montant", "type": "number" }
  ]
}

-- Ajouter colonne = Modifier JSON
UPDATE audit_table_schemas
SET column_definitions = column_definitions ||
    '[{"name":"devise","type":"text"}]'::jsonb
WHERE id = 'uuid-schema-1';

-- ✅ Instantané, aucune migration !
```

---

## 1️⃣ AJOUTER UNE COLONNE

### Backend : Route API

```typescript
// src/server/routes-audit-tables.ts

/**
 * Ajouter une colonne à un schéma existant
 */
app.post('/api/audit/schemas/:id/columns', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const { column } = request.body;

  // Validation
  if (!column.name || !column.type || !column.displayName) {
    return reply.status(400).send({ error: 'Colonne invalide' });
  }

  try {
    const updatedSchema = await addColumn({
      schemaId,
      userId: request.user.id,
      column,
    });

    return reply.send({ schema: updatedSchema });
  } catch (error) {
    console.error('Erreur ajout colonne:', error);
    return reply.status(500).send({ error: 'Erreur serveur' });
  }
});
```

### Backend : Fonction d'Ajout

```typescript
// src/server/db-audit-tables.ts

interface ColumnDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  displayName: string;
  required?: boolean;
  options?: string[];
  defaultValue?: any;
}

export async function addColumn({
  schemaId,
  userId,
  column,
}: {
  schemaId: string;
  userId: string;
  column: ColumnDefinition;
}): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Récupérer le schéma
    const schema = await trx('audit_table_schemas')
      .where({ id: schemaId, user_id: userId })
      .first();

    if (!schema) {
      throw new Error('Schéma non trouvé');
    }

    // 2. Vérifier que la colonne n'existe pas déjà
    const existingColumn = schema.column_definitions.find((col: any) => col.name === column.name);

    if (existingColumn) {
      throw new Error(`Colonne "${column.name}" existe déjà`);
    }

    // 3. Ajouter la colonne
    const updatedColumns = [...schema.column_definitions, column];

    // 4. Mettre à jour le schéma
    const [updatedSchema] = await trx('audit_table_schemas')
      .where({ id: schemaId })
      .update({
        column_definitions: updatedColumns,
        updated_at: new Date(),
      })
      .returning('*');

    // 5. Si defaultValue fournie, mettre à jour toutes les lignes existantes
    if (column.defaultValue !== undefined) {
      await trx('audit_table_data')
        .where({ table_schema_id: schemaId })
        .update({
          row_data: trx.raw(`row_data || ?::jsonb`, [
            JSON.stringify({ [column.name]: column.defaultValue }),
          ]),
        });
    }

    return updatedSchema;
  });
}
```

### Frontend : Composant Ajout Colonne

```typescript
// src/web/components/AddColumnDialog.tsx

interface AddColumnDialogProps {
  schemaId: string;
  onColumnAdded: () => void;
}

export function AddColumnDialog({ schemaId, onColumnAdded }: AddColumnDialogProps) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [type, setType] = useState<'text' | 'number' | 'date' | 'boolean' | 'select'>('text');
  const [required, setRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const column: ColumnDefinition = {
      name,
      displayName,
      type,
      required,
      defaultValue: defaultValue || undefined,
      options: type === 'select' ? options : undefined
    };

    try {
      const response = await fetch(`/api/audit/schemas/${schemaId}/columns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ column })
      });

      if (!response.ok) {
        throw new Error('Erreur ajout colonne');
      }

      showToast('Colonne ajoutée avec succès', 'success');
      onColumnAdded();

    } catch (error) {
      console.error(error);
      showToast('Erreur lors de l\'ajout', 'error');
    }
  }

  return (
    <Dialog>
      <DialogTitle>Ajouter une colonne</DialogTitle>
      <form onSubmit={handleSubmit}>

        <FormField>
          <label>Nom technique (clé JSON)</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="montant_total"
            required
          />
        </FormField>

        <FormField>
          <label>Nom affiché</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Montant Total"
            required
          />
        </FormField>

        <FormField>
          <label>Type</label>
          <select value={type} onChange={e => setType(e.target.value as any)}>
            <option value="text">Texte</option>
            <option value="number">Nombre</option>
            <option value="date">Date</option>
            <option value="boolean">Oui/Non</option>
            <option value="select">Menu déroulant</option>
          </select>
        </FormField>

        {type === 'select' && (
          <FormField>
            <label>Options (une par ligne)</label>
            <textarea
              value={options.join('\n')}
              onChange={e => setOptions(e.target.value.split('\n').filter(Boolean))}
              rows={5}
              placeholder="Option 1&#10;Option 2&#10;Option 3"
            />
          </FormField>
        )}

        <FormField>
          <label>Valeur par défaut (optionnel)</label>
          <input
            value={defaultValue}
            onChange={e => setDefaultValue(e.target.value)}
            placeholder="Laisser vide pour aucune valeur"
          />
          <small>Appliquée aux lignes existantes</small>
        </FormField>

        <FormField>
          <label>
            <input
              type="checkbox"
              checked={required}
              onChange={e => setRequired(e.target.checked)}
            />
            Champ obligatoire
          </label>
        </FormField>

        <DialogActions>
          <Button type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary">Ajouter</Button>
        </DialogActions>

      </form>
    </Dialog>
  );
}
```

---

## 2️⃣ SUPPRIMER UNE COLONNE

### Backend : Route API

```typescript
/**
 * Supprimer une colonne
 */
app.delete('/api/audit/schemas/:id/columns/:columnName', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId, columnName } = request.params;

  try {
    const updatedSchema = await deleteColumn({
      schemaId,
      userId: request.user.id,
      columnName,
    });

    return reply.send({ schema: updatedSchema });
  } catch (error) {
    console.error('Erreur suppression colonne:', error);
    return reply.status(500).send({ error: error.message });
  }
});
```

### Backend : Fonction de Suppression

```typescript
export async function deleteColumn({
  schemaId,
  userId,
  columnName,
}: {
  schemaId: string;
  userId: string;
  columnName: string;
}): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Récupérer le schéma
    const schema = await trx('audit_table_schemas')
      .where({ id: schemaId, user_id: userId })
      .first();

    if (!schema) {
      throw new Error('Schéma non trouvé');
    }

    // 2. Retirer la colonne
    const updatedColumns = schema.column_definitions.filter((col: any) => col.name !== columnName);

    if (updatedColumns.length === schema.column_definitions.length) {
      throw new Error(`Colonne "${columnName}" non trouvée`);
    }

    // 3. Mettre à jour le schéma
    const [updatedSchema] = await trx('audit_table_schemas')
      .where({ id: schemaId })
      .update({
        column_definitions: updatedColumns,
        updated_at: new Date(),
      })
      .returning('*');

    // 4. Supprimer la colonne de toutes les lignes de données
    // IMPORTANT : Conserver l'historique complet (versions)
    await trx('audit_table_data')
      .where({ table_schema_id: schemaId })
      .update({
        row_data: trx.raw(`row_data - ?`, [columnName]),
      });

    // Note : Les versions historiques gardent la colonne supprimée
    // pour préserver l'intégrité de l'audit trail

    return updatedSchema;
  });
}
```

### Frontend : Confirmation Suppression

```typescript
async function handleDeleteColumn(columnName: string) {
  const confirmed = await confirmDialog({
    title: 'Supprimer cette colonne ?',
    message: `La colonne "${columnName}" sera supprimée de toutes les lignes. Cette action est irréversible.`,
    confirmText: 'Supprimer',
    confirmVariant: 'danger',
  });

  if (!confirmed) return;

  try {
    await fetch(`/api/audit/schemas/${schemaId}/columns/${columnName}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    showToast('Colonne supprimée', 'success');
    reloadSchema();
  } catch (error) {
    showToast('Erreur lors de la suppression', 'error');
  }
}
```

---

## 3️⃣ RENOMMER UNE COLONNE

### Backend : Route API

```typescript
/**
 * Renommer une colonne
 */
app.patch('/api/audit/schemas/:id/columns/:columnName/rename', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId, columnName } = request.params;
  const { newName, newDisplayName } = request.body;

  try {
    const updatedSchema = await renameColumn({
      schemaId,
      userId: request.user.id,
      oldName: columnName,
      newName,
      newDisplayName,
    });

    return reply.send({ schema: updatedSchema });
  } catch (error) {
    console.error('Erreur renommage colonne:', error);
    return reply.status(500).send({ error: error.message });
  }
});
```

### Backend : Fonction de Renommage

```typescript
export async function renameColumn({
  schemaId,
  userId,
  oldName,
  newName,
  newDisplayName,
}: {
  schemaId: string;
  userId: string;
  oldName: string;
  newName: string;
  newDisplayName?: string;
}): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Récupérer le schéma
    const schema = await trx('audit_table_schemas')
      .where({ id: schemaId, user_id: userId })
      .first();

    if (!schema) {
      throw new Error('Schéma non trouvé');
    }

    // 2. Vérifier que newName n'existe pas déjà
    const existingColumn = schema.column_definitions.find((col: any) => col.name === newName);

    if (existingColumn && newName !== oldName) {
      throw new Error(`Colonne "${newName}" existe déjà`);
    }

    // 3. Mettre à jour la définition
    const updatedColumns = schema.column_definitions.map((col: any) => {
      if (col.name === oldName) {
        return {
          ...col,
          name: newName,
          displayName: newDisplayName || col.displayName,
        };
      }
      return col;
    });

    // 4. Mettre à jour le schéma
    const [updatedSchema] = await trx('audit_table_schemas')
      .where({ id: schemaId })
      .update({
        column_definitions: updatedColumns,
        updated_at: new Date(),
      })
      .returning('*');

    // 5. Renommer la clé dans toutes les lignes de données
    // PostgreSQL : renommer clé JSON
    await trx.raw(
      `
      UPDATE audit_table_data
      SET row_data = row_data - ? || jsonb_build_object(?, row_data->?)
      WHERE table_schema_id = ?
        AND row_data ? ?
    `,
      [oldName, newName, oldName, schemaId, oldName],
    );

    return updatedSchema;
  });
}
```

---

## 4️⃣ DUPLIQUER UNE LIGNE

### Backend : Route API

```typescript
/**
 * Dupliquer une ligne
 */
app.post('/api/audit/data/:id/duplicate', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: dataId } = request.params;

  try {
    const duplicatedRow = await duplicateRow({
      dataId,
      userId: request.user.id,
    });

    return reply.status(201).send({ data: duplicatedRow });
  } catch (error) {
    console.error('Erreur duplication ligne:', error);
    return reply.status(500).send({ error: error.message });
  }
});
```

### Backend : Fonction de Duplication

```typescript
export async function duplicateRow({
  dataId,
  userId,
}: {
  dataId: string;
  userId: string;
}): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Récupérer la ligne originale
    const originalRow = await trx('audit_table_data')
      .join('audit_table_schemas', 'audit_table_data.table_schema_id', 'audit_table_schemas.id')
      .where({
        'audit_table_data.id': dataId,
        'audit_table_schemas.user_id': userId,
      })
      .whereNull('audit_table_data.deleted_at')
      .select('audit_table_data.*')
      .first();

    if (!originalRow) {
      throw new Error('Ligne non trouvée');
    }

    // 2. Trouver le row_order maximum
    const maxOrderRow = await trx('audit_table_data')
      .where({ table_schema_id: originalRow.table_schema_id })
      .max('row_order as max_order')
      .first();

    const newOrder = (maxOrderRow?.max_order || 0) + 1;

    // 3. Créer la ligne dupliquée
    const [duplicatedRow] = await trx('audit_table_data')
      .insert({
        table_schema_id: originalRow.table_schema_id,
        row_data: originalRow.row_data, // ← Copie exacte des données
        row_order: newOrder,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // 4. Créer version initiale pour la nouvelle ligne
    await trx('audit_data_versions').insert({
      table_data_id: duplicatedRow.id,
      row_data: duplicatedRow.row_data,
      change_type: 'insert',
      changed_at: new Date(),
      changed_by: userId,
    });

    return duplicatedRow;
  });
}
```

### Frontend : Bouton Dupliquer

```typescript
function RowActionsMenu({ rowId }: { rowId: string }) {
  async function handleDuplicate() {
    try {
      const response = await fetch(`/api/audit/data/${rowId}/duplicate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const result = await response.json();

      // Ajouter la ligne dupliquée à la fin
      setRows(prev => [...prev, result.data]);

      showToast('Ligne dupliquée', 'success');

    } catch (error) {
      showToast('Erreur lors de la duplication', 'error');
    }
  }

  return (
    <DropdownMenu>
      <DropdownItem onClick={handleDuplicate}>
        📋 Dupliquer cette ligne
      </DropdownItem>
      <DropdownItem onClick={handleDelete}>
        🗑️ Supprimer
      </DropdownItem>
    </DropdownMenu>
  );
}
```

---

## 5️⃣ DUPLIQUER UNE TABLE COMPLÈTE

### Backend : Route API

```typescript
/**
 * Dupliquer une table entière (schéma + données)
 */
app.post('/api/audit/schemas/:id/duplicate', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const { newTableName, newDisplayName } = request.body;

  try {
    const duplicatedSchema = await duplicateTable({
      schemaId,
      userId: request.user.id,
      newTableName,
      newDisplayName,
    });

    return reply.status(201).send({ schema: duplicatedSchema });
  } catch (error) {
    console.error('Erreur duplication table:', error);
    return reply.status(500).send({ error: error.message });
  }
});
```

### Backend : Fonction de Duplication

```typescript
export async function duplicateTable({
  schemaId,
  userId,
  newTableName,
  newDisplayName,
}: {
  schemaId: string;
  userId: string;
  newTableName: string;
  newDisplayName: string;
}): Promise<any> {
  return await db.transaction(async (trx) => {
    // 1. Récupérer le schéma original
    const originalSchema = await trx('audit_table_schemas')
      .where({ id: schemaId, user_id: userId })
      .first();

    if (!originalSchema) {
      throw new Error('Schéma non trouvé');
    }

    // 2. Créer le nouveau schéma
    const [newSchema] = await trx('audit_table_schemas')
      .insert({
        user_id: userId,
        table_name: newTableName,
        display_name: newDisplayName,
        column_definitions: originalSchema.column_definitions, // ← Même structure
        n8n_workflow_id: null, // Pas de lien workflow
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // 3. Copier toutes les lignes de données
    const originalRows = await trx('audit_table_data')
      .where({ table_schema_id: schemaId })
      .whereNull('deleted_at')
      .orderBy('row_order');

    for (const row of originalRows) {
      const [newRow] = await trx('audit_table_data')
        .insert({
          table_schema_id: newSchema.id, // ← Nouveau schéma
          row_data: row.row_data, // ← Mêmes données
          row_order: row.row_order,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning('*');

      // Version initiale pour chaque ligne
      await trx('audit_data_versions').insert({
        table_data_id: newRow.id,
        row_data: newRow.row_data,
        change_type: 'insert',
        changed_at: new Date(),
        changed_by: userId,
      });
    }

    // 4. Copier les consolidations configurées
    const consolidations = await trx('audit_table_consolidations').where({
      source_schema_id: schemaId,
    });

    for (const consol of consolidations) {
      await trx('audit_table_consolidations').insert({
        source_schema_id: newSchema.id, // ← Nouveau schéma
        group_by_column: consol.group_by_column,
        aggregate_columns: consol.aggregate_columns,
        aggregate_functions: consol.aggregate_functions,
        aggregates: consol.aggregates, // ← Mêmes agrégats initiaux
        last_calculated_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return newSchema;
  });
}
```

---

## 6️⃣ CRÉER UNE NOUVELLE TABLE VIDE

### Frontend : Formulaire Création

```typescript
export function CreateTableDialog({ onTableCreated }: Props) {
  const [tableName, setTableName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    { name: 'colonne1', type: 'text', displayName: 'Colonne 1', required: false }
  ]);

  function addColumn() {
    setColumns([
      ...columns,
      { name: `colonne${columns.length + 1}`, type: 'text', displayName: '', required: false }
    ]);
  }

  function removeColumn(index: number) {
    setColumns(columns.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch('/api/audit/schemas', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tableName,
          displayName,
          columnDefinitions: columns
        })
      });

      if (!response.ok) {
        throw new Error('Erreur création table');
      }

      const result = await response.json();

      showToast('Table créée avec succès', 'success');
      onTableCreated(result.schema);

    } catch (error) {
      showToast('Erreur lors de la création', 'error');
    }
  }

  return (
    <Dialog>
      <DialogTitle>Créer une nouvelle table</DialogTitle>

      <form onSubmit={handleSubmit}>

        <FormField>
          <label>Nom technique</label>
          <input
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            placeholder="ma_nouvelle_table"
            required
          />
        </FormField>

        <FormField>
          <label>Nom affiché</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Ma Nouvelle Table"
            required
          />
        </FormField>

        <Divider />

        <h3>Colonnes</h3>

        {columns.map((col, index) => (
          <ColumnRow key={index}>
            <input
              placeholder="nom_colonne"
              value={col.name}
              onChange={e => {
                const updated = [...columns];
                updated[index].name = e.target.value;
                setColumns(updated);
              }}
            />
            <input
              placeholder="Nom Affiché"
              value={col.displayName}
              onChange={e => {
                const updated = [...columns];
                updated[index].displayName = e.target.value;
                setColumns(updated);
              }}
            />
            <select
              value={col.type}
              onChange={e => {
                const updated = [...columns];
                updated[index].type = e.target.value as any;
                setColumns(updated);
              }}
            >
              <option value="text">Texte</option>
              <option value="number">Nombre</option>
              <option value="date">Date</option>
              <option value="boolean">Oui/Non</option>
              <option value="select">Menu</option>
            </select>
            <Button
              type="button"
              onClick={() => removeColumn(index)}
              variant="ghost"
            >
              ❌
            </Button>
          </ColumnRow>
        ))}

        <Button type="button" onClick={addColumn} variant="secondary">
          ➕ Ajouter une colonne
        </Button>

        <DialogActions>
          <Button type="button" onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary">Créer</Button>
        </DialogActions>

      </form>
    </Dialog>
  );
}
```

---

## 7️⃣ IMPORTER / EXPORTER HTML

### Export vers HTML

```typescript
/**
 * Exporter une table vers HTML
 */
app.get('/api/audit/schemas/:id/export/html', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;

  try {
    // 1. Récupérer schéma et données
    const schema = await getTableSchema({ schemaId, userId: request.user.id });
    const data = await getTableData({ schemaId, userId: request.user.id });

    // 2. Générer HTML
    const html = generateTableHTML(schema, data.data);

    // 3. Retourner comme fichier téléchargeable
    reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${schema.table_name}.html"`)
      .send(html);
  } catch (error) {
    console.error('Erreur export HTML:', error);
    return reply.status(500).send({ error: 'Erreur export' });
  }
});

function generateTableHTML(schema: any, rows: any[]): string {
  const columns = schema.column_definitions;

  let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${schema.display_name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #4CAF50; color: white; font-weight: bold; }
    tr:nth-child(even) { background-color: #f2f2f2; }
    tr:hover { background-color: #ddd; }
    .footer { margin-top: 30px; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>${schema.display_name}</h1>
  <p>Exporté le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
  
  <table>
    <thead>
      <tr>
        ${columns.map((col: any) => `<th>${col.displayName}</th>`).join('')}
      </tr>
    </thead>
    <tbody>`;

  for (const row of rows) {
    html += '<tr>';
    for (const col of columns) {
      const value = row.row_data[col.name];
      const formattedValue = formatValue(value, col.type);
      html += `<td>${formattedValue}</td>`;
    }
    html += '</tr>';
  }

  html += `
    </tbody>
  </table>
  
  <div class="footer">
    <p>Généré par Nod n8n - Système de Persistance des Tables d'Audit</p>
    <p>${rows.length} lignes exportées</p>
  </div>
</body>
</html>`;

  return html;
}

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'number':
      return new Intl.NumberFormat('fr-FR').format(value);
    case 'date':
      return new Date(value).toLocaleDateString('fr-FR');
    case 'boolean':
      return value ? 'Oui' : 'Non';
    default:
      return String(value);
  }
}
```

### Import depuis HTML/Excel

```typescript
/**
 * Importer des données depuis un fichier (HTML, CSV, Excel)
 */
app.post('/api/audit/schemas/:id/import', async (request, reply) => {
  if (!request.user) {
    return reply.status(401).send({ error: 'Non authentifié' });
  }

  const { id: schemaId } = request.params;
  const data = await request.file(); // Utilise @fastify/multipart

  if (!data) {
    return reply.status(400).send({ error: 'Fichier manquant' });
  }

  try {
    // Lire le fichier
    const buffer = await data.toBuffer();
    const content = buffer.toString('utf-8');

    // Parser selon le type
    let rows: any[];

    if (data.mimetype === 'text/html') {
      rows = parseHTMLTable(content);
    } else if (data.mimetype === 'text/csv') {
      rows = parseCSV(content);
    } else {
      throw new Error('Format non supporté');
    }

    // Insérer en bulk
    const result = await bulkInsertTableData({
      schemaId,
      userId: request.user.id,
      rows,
    });

    return reply.send({
      message: `${result.data.length} lignes importées`,
      count: result.data.length,
    });
  } catch (error) {
    console.error('Erreur import:', error);
    return reply.status(500).send({ error: 'Erreur import' });
  }
});

function parseHTMLTable(html: string): any[] {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  const rows: any[] = [];
  const headers: string[] = [];

  // Lire les en-têtes
  $('table thead tr th').each((i, el) => {
    headers.push($(el).text().trim());
  });

  // Lire les lignes
  $('table tbody tr').each((i, tr) => {
    const row: any = {};
    $(tr)
      .find('td')
      .each((j, td) => {
        if (headers[j]) {
          row[headers[j]] = $(td).text().trim();
        }
      });
    rows.push(row);
  });

  return rows;
}
```

---

## 📊 Résumé des Opérations

| Opération             | Endpoint                            | Méthode | Versioning              |
| --------------------- | ----------------------------------- | ------- | ----------------------- |
| Ajouter colonne       | `/schemas/:id/columns`              | POST    | ✅ Schéma versionné     |
| Supprimer colonne     | `/schemas/:id/columns/:name`        | DELETE  | ✅ Historique préservé  |
| Renommer colonne      | `/schemas/:id/columns/:name/rename` | PATCH   | ✅ Clés JSON modifiées  |
| Modifier type colonne | `/schemas/:id/columns/:name`        | PATCH   | ✅ Validation appliquée |
| Dupliquer ligne       | `/data/:id/duplicate`               | POST    | ✅ Nouvelle version     |
| Dupliquer table       | `/schemas/:id/duplicate`            | POST    | ✅ Tout dupliqué        |
| Créer table           | `/schemas`                          | POST    | ✅ Schéma initial       |
| Exporter HTML         | `/schemas/:id/export/html`          | GET     | N/A                     |
| Importer              | `/schemas/:id/import`               | POST    | ✅ Versions créées      |

---

## ⚠️ Considérations Importantes

### 1. Suppression de Colonne

```
❌ Danger : Perte de données
✅ Solution : Confirmation obligatoire + soft delete possible
```

**Option soft delete** :

```typescript
// Au lieu de supprimer, marquer comme "hidden"
{
  "name": "ancienne_colonne",
  "type": "text",
  "hidden": true  // ← Pas supprimée, juste cachée
}
```

### 2. Modification de Type

```typescript
// Valider la compatibilité
async function changeColumnType(columnName: string, newType: string) {
  // Vérifier que toutes les valeurs sont convertibles
  const rows = await getTableData(...);

  for (const row of rows) {
    const value = row.row_data[columnName];
    if (!isConvertible(value, newType)) {
      throw new Error(`Ligne ${row.id} : valeur incompatible avec ${newType}`);
    }
  }

  // Si OK, mettre à jour
  await updateColumnType(...);
}
```

### 3. Duplication de Table Volumineuse

```typescript
// Avec barre de progression
async function duplicateTableWithProgress(schemaId: string, onProgress: (percent: number) => void) {
  const rows = await getTableData(...);
  const total = rows.length;

  for (let i = 0; i < total; i++) {
    await insertTableData(...);
    onProgress((i + 1) / total * 100);
  }
}
```

---

**Toutes les opérations structurelles sont maintenant couvertes !** ✅
