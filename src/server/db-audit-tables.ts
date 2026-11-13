import { pool } from './db.ts';
import { ownerId } from './config.ts';
import type pg from 'pg';

export async function initializeAuditTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_table_schemas (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      table_name text NOT NULL,
      display_name text NOT NULL,
      n8n_workflow_id text,
      column_definitions jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz,
      UNIQUE(owner_id, table_name)
    );
    CREATE INDEX IF NOT EXISTS audit_table_schemas_owner ON audit_table_schemas(owner_id, deleted_at);
    
    CREATE TABLE IF NOT EXISTS audit_table_data (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      table_schema_id uuid NOT NULL REFERENCES audit_table_schemas(id) ON DELETE CASCADE,
      row_data jsonb NOT NULL,
      row_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    );
    CREATE INDEX IF NOT EXISTS audit_table_data_schema ON audit_table_data(table_schema_id, deleted_at, row_order);
    CREATE INDEX IF NOT EXISTS audit_table_data_owner ON audit_table_data(owner_id, deleted_at);
    
    CREATE TABLE IF NOT EXISTS audit_data_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      table_data_id uuid NOT NULL REFERENCES audit_table_data(id) ON DELETE CASCADE,
      row_data jsonb NOT NULL,
      change_type text NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
      changed_by text,
      changed_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_data_versions_data ON audit_data_versions(table_data_id, changed_at DESC);
    CREATE INDEX IF NOT EXISTS audit_data_versions_owner ON audit_data_versions(owner_id, changed_at DESC);
    
    CREATE TABLE IF NOT EXISTS audit_table_consolidations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id text NOT NULL,
      source_schema_id uuid NOT NULL REFERENCES audit_table_schemas(id) ON DELETE CASCADE,
      group_by_column text NOT NULL,
      aggregate_columns text[] NOT NULL,
      aggregate_functions text[] NOT NULL,
      aggregates jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS audit_table_consolidations_source ON audit_table_consolidations(source_schema_id);
    CREATE INDEX IF NOT EXISTS audit_table_consolidations_owner ON audit_table_consolidations(owner_id);
  `);
}

export interface AuditTableSchema {
  id: string;
  owner_id: string;
  table_name: string;
  display_name: string;
  n8n_workflow_id: string | null;
  column_definitions: ColumnDefinition[];
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ColumnDefinition {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select';
  label: string;
  required?: boolean;
  options?: string[];
  default_value?: unknown;
}

export interface AuditTableData {
  id: string;
  owner_id: string;
  table_schema_id: string;
  row_data: Record<string, unknown>;
  row_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface AuditDataVersion {
  id: string;
  owner_id: string;
  table_data_id: string;
  row_data: Record<string, unknown>;
  change_type: 'create' | 'update' | 'delete';
  changed_by: string | null;
  changed_at: Date;
}

export async function createTableSchema(
  client: pg.PoolClient,
  {
    table_name,
    display_name,
    n8n_workflow_id,
    column_definitions,
  }: {
    table_name: string;
    display_name: string;
    n8n_workflow_id?: string;
    column_definitions: ColumnDefinition[];
  },
): Promise<AuditTableSchema> {
  const result = await client.query<AuditTableSchema>(
    `INSERT INTO audit_table_schemas (owner_id, table_name, display_name, n8n_workflow_id, column_definitions)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (owner_id, table_name) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           n8n_workflow_id = EXCLUDED.n8n_workflow_id,
           column_definitions = EXCLUDED.column_definitions,
           updated_at = now(),
           deleted_at = NULL
     RETURNING *`,
    [
      ownerId,
      table_name,
      display_name,
      n8n_workflow_id || null,
      JSON.stringify(column_definitions),
    ],
  );
  return result.rows[0];
}

export async function getTableSchemas(client: pg.PoolClient): Promise<AuditTableSchema[]> {
  const result = await client.query<AuditTableSchema>(
    `SELECT * FROM audit_table_schemas
     WHERE owner_id = $1 AND deleted_at IS NULL
     ORDER BY updated_at DESC`,
    [ownerId],
  );
  return result.rows;
}

export async function getTableSchema(
  client: pg.PoolClient,
  table_schema_id: string,
): Promise<AuditTableSchema | null> {
  const result = await client.query<AuditTableSchema>(
    `SELECT * FROM audit_table_schemas
     WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [table_schema_id, ownerId],
  );
  return result.rows[0] || null;
}

export async function deleteTableSchema(
  client: pg.PoolClient,
  table_schema_id: string,
): Promise<void> {
  await client.query(
    `UPDATE audit_table_schemas
     SET deleted_at = now()
     WHERE id = $1 AND owner_id = $2`,
    [table_schema_id, ownerId],
  );
}

export async function insertTableData(
  client: pg.PoolClient,
  {
    table_schema_id,
    row_data,
  }: {
    table_schema_id: string;
    row_data: Record<string, unknown>;
  },
): Promise<AuditTableData> {
  const maxOrder = await client.query<{ max: number }>(
    `SELECT COALESCE(MAX(row_order), 0) as max
     FROM audit_table_data
     WHERE table_schema_id = $1 AND deleted_at IS NULL`,
    [table_schema_id],
  );

  const result = await client.query<AuditTableData>(
    `INSERT INTO audit_table_data (owner_id, table_schema_id, row_data, row_order)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [ownerId, table_schema_id, JSON.stringify(row_data), maxOrder.rows[0].max + 1],
  );

  await client.query(
    `INSERT INTO audit_data_versions (owner_id, table_data_id, row_data, change_type, changed_by)
     VALUES ($1, $2, $3, 'create', $4)`,
    [ownerId, result.rows[0].id, JSON.stringify(row_data), ownerId],
  );

  return result.rows[0];
}

export async function updateTableData(
  client: pg.PoolClient,
  {
    data_id,
    row_data,
  }: {
    data_id: string;
    row_data: Record<string, unknown>;
  },
): Promise<AuditTableData> {
  const result = await client.query<AuditTableData>(
    `UPDATE audit_table_data
     SET row_data = $1, updated_at = now()
     WHERE id = $2 AND owner_id = $3 AND deleted_at IS NULL
     RETURNING *`,
    [JSON.stringify(row_data), data_id, ownerId],
  );

  if (result.rows[0]) {
    await client.query(
      `INSERT INTO audit_data_versions (owner_id, table_data_id, row_data, change_type, changed_by)
       VALUES ($1, $2, $3, 'update', $4)`,
      [ownerId, data_id, JSON.stringify(row_data), ownerId],
    );
  }

  return result.rows[0];
}

export async function deleteTableData(client: pg.PoolClient, data_id: string): Promise<void> {
  const existing = await client.query<AuditTableData>(
    `SELECT * FROM audit_table_data WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL`,
    [data_id, ownerId],
  );

  if (existing.rows[0]) {
    await client.query(
      `UPDATE audit_table_data
       SET deleted_at = now()
       WHERE id = $1 AND owner_id = $2`,
      [data_id, ownerId],
    );

    await client.query(
      `INSERT INTO audit_data_versions (owner_id, table_data_id, row_data, change_type, changed_by)
       VALUES ($1, $2, $3, 'delete', $4)`,
      [ownerId, data_id, JSON.stringify(existing.rows[0].row_data), ownerId],
    );
  }
}

export async function getTableData(
  client: pg.PoolClient,
  table_schema_id: string,
): Promise<AuditTableData[]> {
  const result = await client.query<AuditTableData>(
    `SELECT * FROM audit_table_data
     WHERE table_schema_id = $1 AND owner_id = $2 AND deleted_at IS NULL
     ORDER BY row_order ASC`,
    [table_schema_id, ownerId],
  );
  return result.rows;
}

export async function getDataVersions(
  client: pg.PoolClient,
  table_data_id: string,
): Promise<AuditDataVersion[]> {
  const result = await client.query<AuditDataVersion>(
    `SELECT * FROM audit_data_versions
     WHERE table_data_id = $1 AND owner_id = $2
     ORDER BY changed_at DESC`,
    [table_data_id, ownerId],
  );
  return result.rows;
}

export async function reorderTableData(
  client: pg.PoolClient,
  {
    data_id,
    new_order,
  }: {
    data_id: string;
    new_order: number;
  },
): Promise<void> {
  await client.query(
    `UPDATE audit_table_data
     SET row_order = $1, updated_at = now()
     WHERE id = $2 AND owner_id = $3`,
    [new_order, data_id, ownerId],
  );
}

export async function bulkInsertTableData(
  client: pg.PoolClient,
  {
    table_schema_id,
    rows,
  }: {
    table_schema_id: string;
    rows: Record<string, unknown>[];
  },
): Promise<AuditTableData[]> {
  const maxOrder = await client.query<{ max: number }>(
    `SELECT COALESCE(MAX(row_order), 0) as max
     FROM audit_table_data
     WHERE table_schema_id = $1 AND deleted_at IS NULL`,
    [table_schema_id],
  );

  const inserted: AuditTableData[] = [];
  let currentOrder = maxOrder.rows[0].max;

  for (const row_data of rows) {
    currentOrder += 1;
    const result = await client.query<AuditTableData>(
      `INSERT INTO audit_table_data (owner_id, table_schema_id, row_data, row_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [ownerId, table_schema_id, JSON.stringify(row_data), currentOrder],
    );

    await client.query(
      `INSERT INTO audit_data_versions (owner_id, table_data_id, row_data, change_type, changed_by)
       VALUES ($1, $2, $3, 'create', $4)`,
      [ownerId, result.rows[0].id, JSON.stringify(row_data), ownerId],
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}
