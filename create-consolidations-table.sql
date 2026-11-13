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
