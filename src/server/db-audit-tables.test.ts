import assert from 'node:assert/strict';
import test, { describe, before, after } from 'node:test';
import pg from 'pg';
import {
  initializeAuditTables,
  createTableSchema,
  insertTableData,
  updateTableData,
  deleteTableData,
  getTableData,
  getTableSchemas,
  bulkInsertTableData,
  getDataVersions,
} from './db-audit-tables.ts';
import type { ColumnDefinition } from './db-audit-tables.ts';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL || 'postgresql://nod:test@localhost:54329/nod_test';
let testPool: pg.Pool;
let testOwnerId: string;

describe('Audit Tables Database Schema', () => {
  before(async () => {
    testPool = new pg.Pool({ connectionString: testDatabaseUrl });
    testOwnerId = 'test-owner-001';

    await testPool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await testPool.query('CREATE SCHEMA public');
    await initializeAuditTables();
  });

  after(async () => {
    await testPool.end();
  });

  describe('Table Schema CRUD Operations', () => {
    test('should create a new table schema', async () => {
      const client = await testPool.connect();
      try {
        const columnDefs: ColumnDefinition[] = [
          { name: 'ordre', type: 'number', label: 'N° Ordre', required: true },
          { name: 'compte', type: 'text', label: 'N° Compte', required: true },
          { name: 'montant', type: 'number', label: 'Montant (FCFA)', required: true },
          { name: 'conforme', type: 'boolean', label: 'Conforme', required: false },
          {
            name: 'statut',
            type: 'select',
            label: 'Statut',
            options: ['Satisfaisant', 'Non-satisfaisant'],
          },
        ];

        const schema = await createTableSchema(client, {
          table_name: 'test_feuille_couverture',
          display_name: 'Test - Feuille de couverture',
          n8n_workflow_id: 'workflow_test_001',
          column_definitions: columnDefs,
        });

        assert.ok(schema.id);
        assert.equal(schema.table_name, 'test_feuille_couverture');
        assert.equal(schema.display_name, 'Test - Feuille de couverture');
        assert.equal(schema.owner_id, testOwnerId);
        assert.equal(schema.column_definitions.length, 5);
      } finally {
        client.release();
      }
    });

    test('should retrieve all table schemas for owner', async () => {
      const client = await testPool.connect();
      try {
        const schemas = await getTableSchemas(client);
        assert.ok(schemas.length > 0);
        assert.ok(schemas.every((s) => s.owner_id === testOwnerId));
      } finally {
        client.release();
      }
    });

    test('should handle duplicate table_name with upsert', async () => {
      const client = await testPool.connect();
      try {
        const columnDefs: ColumnDefinition[] = [{ name: 'test', type: 'text', label: 'Test' }];

        const first = await createTableSchema(client, {
          table_name: 'duplicate_test',
          display_name: 'First Version',
          column_definitions: columnDefs,
        });

        const second = await createTableSchema(client, {
          table_name: 'duplicate_test',
          display_name: 'Second Version',
          column_definitions: columnDefs,
        });

        assert.equal(first.id, second.id);
        assert.equal(second.display_name, 'Second Version');
      } finally {
        client.release();
      }
    });
  });

  describe('Table Data CRUD Operations', () => {
    let testSchemaId: string;

    before(async () => {
      const client = await testPool.connect();
      try {
        const schema = await createTableSchema(client, {
          table_name: 'test_data_operations',
          display_name: 'Test Data Operations',
          column_definitions: [
            { name: 'ordre', type: 'number', label: 'Ordre' },
            { name: 'description', type: 'text', label: 'Description' },
            { name: 'montant', type: 'number', label: 'Montant' },
          ],
        });
        testSchemaId = schema.id;
      } finally {
        client.release();
      }
    });

    test('should insert a single row', async () => {
      const client = await testPool.connect();
      try {
        const data = await insertTableData(client, {
          table_schema_id: testSchemaId,
          row_data: {
            ordre: 1,
            description: 'Test row 1',
            montant: 1000000,
          },
        });

        assert.ok(data.id);
        assert.equal(data.table_schema_id, testSchemaId);
        assert.equal(data.row_order, 1);
        assert.deepEqual(data.row_data, {
          ordre: 1,
          description: 'Test row 1',
          montant: 1000000,
        });
      } finally {
        client.release();
      }
    });

    test('should bulk insert multiple rows with correct ordering', async () => {
      const client = await testPool.connect();
      try {
        const rows = [
          { ordre: 2, description: 'Bulk row 1', montant: 2000000 },
          { ordre: 3, description: 'Bulk row 2', montant: 3000000 },
          { ordre: 4, description: 'Bulk row 3', montant: 4000000 },
        ];

        const inserted = await bulkInsertTableData(client, {
          table_schema_id: testSchemaId,
          rows,
        });

        assert.equal(inserted.length, 3);
        assert.equal(inserted[0].row_order, 2);
        assert.equal(inserted[1].row_order, 3);
        assert.equal(inserted[2].row_order, 4);
      } finally {
        client.release();
      }
    });

    test('should retrieve all table data sorted by row_order', async () => {
      const client = await testPool.connect();
      try {
        const allData = await getTableData(client, testSchemaId);
        assert.ok(allData.length >= 4);

        for (let i = 1; i < allData.length; i++) {
          assert.ok(allData[i].row_order >= allData[i - 1].row_order);
        }
      } finally {
        client.release();
      }
    });

    test('should update a row and create version history', async () => {
      const client = await testPool.connect();
      try {
        const allData = await getTableData(client, testSchemaId);
        const firstRow = allData[0];

        const updated = await updateTableData(client, {
          data_id: firstRow.id,
          row_data: {
            ...firstRow.row_data,
            description: 'Updated description',
            montant: 9999999,
          },
        });

        assert.equal(updated.id, firstRow.id);
        assert.equal((updated.row_data as any).description, 'Updated description');
        assert.equal((updated.row_data as any).montant, 9999999);

        const versions = await getDataVersions(client, firstRow.id);
        assert.ok(versions.length >= 2);
        assert.equal(versions[0].change_type, 'update');
        assert.equal(versions[versions.length - 1].change_type, 'create');
      } finally {
        client.release();
      }
    });

    test('should soft delete a row and create deletion version', async () => {
      const client = await testPool.connect();
      try {
        const allData = await getTableData(client, testSchemaId);
        const rowToDelete = allData[allData.length - 1];

        await deleteTableData(client, rowToDelete.id);

        const afterDelete = await getTableData(client, testSchemaId);
        assert.equal(afterDelete.length, allData.length - 1);

        const versions = await getDataVersions(client, rowToDelete.id);
        assert.equal(versions[0].change_type, 'delete');
      } finally {
        client.release();
      }
    });
  });

  describe('Real-world Audit Table Scenarios', () => {
    test('should handle Feuille Couverture schema from bank audit', async () => {
      const client = await testPool.connect();
      try {
        const schema = await createTableSchema(client, {
          table_name: 'fc_bk_a10_comptes_dormants',
          display_name: 'FC-BK-A10 - Audit des levées de blocage des comptes dormants',
          n8n_workflow_id: 'workflow_audit_comptes_dormants',
          column_definitions: [
            { name: 'ordre', type: 'number', label: 'N° Ordre', required: true },
            { name: 'compte_client', type: 'text', label: 'N° Compte Client', required: true },
            { name: 'date_reactivation', type: 'date', label: 'Date Réactivation', required: true },
            { name: 'intitule_compte', type: 'text', label: 'Intitulé Compte', required: true },
            {
              name: 'solde_veille',
              type: 'number',
              label: 'Solde Veille Réactivation (FCFA)',
              required: true,
            },
            {
              name: 'visa_agence',
              type: 'select',
              label: 'Visa Agence (Maker)',
              options: ['Oui', 'Non'],
              required: true,
            },
            {
              name: 'visa_siege',
              type: 'select',
              label: 'Visa Conformité Siège (Checker)',
              options: ['Oui', 'Non'],
              required: true,
            },
            { name: 'ecart', type: 'number', label: 'Écart Non Autorisé (FCFA)', required: true },
            { name: 'ctr_1', type: 'select', label: 'CTR 1', options: ['+', '-', 'x'] },
            { name: 'ctr_2', type: 'select', label: 'CTR 2', options: ['+', '-', 'x'] },
            { name: 'ctr_3', type: 'select', label: 'CTR 3', options: ['+', '-', 'x'] },
            { name: 'ctr_4', type: 'select', label: 'CTR 4', options: ['+', '-', 'x'] },
            { name: 'ctr_5', type: 'select', label: 'CTR 5', options: ['+', '-', 'x'] },
            {
              name: 'conclusion',
              type: 'select',
              label: 'Conclusion',
              options: ['Satisfaisant', 'Non-satisfaisant'],
              required: true,
            },
          ],
        });

        const testData = await insertTableData(client, {
          table_schema_id: schema.id,
          row_data: {
            ordre: 1,
            compte_client: 'CPT-DOR-04412',
            date_reactivation: '2024-05-14',
            intitule_compte: 'SOC. IVOIRIENNE LIQUIDATION',
            solde_veille: 34000000,
            visa_agence: 'Oui',
            visa_siege: 'Non',
            ecart: 34000000,
            ctr_1: '-',
            ctr_2: '-',
            ctr_3: '-',
            ctr_4: '-',
            ctr_5: '-',
            conclusion: 'Non-satisfaisant',
          },
        });

        assert.ok(testData.id);
        assert.equal((testData.row_data as any).ecart, 34000000);
        assert.equal((testData.row_data as any).conclusion, 'Non-satisfaisant');
      } finally {
        client.release();
      }
    });

    test('should handle Matrice Surveillance Permanente schema', async () => {
      const client = await testPool.connect();
      try {
        const schema = await createTableSchema(client, {
          table_name: 'msp_bk_a10_surveillance',
          display_name: 'MSP-BK-A10 - Matrice de surveillance permanente',
          n8n_workflow_id: 'workflow_matrice_surveillance',
          column_definitions: [
            { name: 'numero', type: 'number', label: 'N°', required: true },
            { name: 'point_controle', type: 'text', label: 'Point de contrôle', required: true },
            { name: 'risque', type: 'text', label: 'Risque', required: true },
            {
              name: 'controle_1er_niveau',
              type: 'text',
              label: 'Contrôle de premier niveau',
              required: true,
            },
            {
              name: 'controle_2nd_niveau',
              type: 'text',
              label: 'Contrôle de second niveau',
              required: true,
            },
            { name: 'document', type: 'text', label: 'Document', required: true },
          ],
        });

        const rows = [
          {
            numero: 1,
            point_controle: 'Détection automatique des comptes inactifs',
            risque: 'Maintien erroné de comptes inactifs',
            controle_1er_niveau: 'Batch automatisé mensuel',
            controle_2nd_niveau: 'Rapprochement par DCI',
            document: 'ETAT-INACT-01',
          },
          {
            numero: 2,
            point_controle: 'Bascule en compte dormant après 24 mois',
            risque: 'Défaut de gel informatique',
            controle_1er_niveau: 'Vérification attribut système',
            controle_2nd_niveau: 'Audit IT exhaustif',
            document: 'REP-GEL-02',
          },
        ];

        const inserted = await bulkInsertTableData(client, {
          table_schema_id: schema.id,
          rows,
        });

        assert.equal(inserted.length, 2);
        assert.equal((inserted[0].row_data as any).numero, 1);
        assert.equal((inserted[1].row_data as any).numero, 2);
      } finally {
        client.release();
      }
    });
  });

  describe('Version History Tracking', () => {
    test('should maintain complete audit trail of changes', async () => {
      const client = await testPool.connect();
      try {
        const schema = await createTableSchema(client, {
          table_name: 'test_versioning',
          display_name: 'Test Versioning',
          column_definitions: [{ name: 'value', type: 'number', label: 'Value' }],
        });

        const original = await insertTableData(client, {
          table_schema_id: schema.id,
          row_data: { value: 100 },
        });

        await updateTableData(client, {
          data_id: original.id,
          row_data: { value: 200 },
        });

        await updateTableData(client, {
          data_id: original.id,
          row_data: { value: 300 },
        });

        await deleteTableData(client, original.id);

        const versions = await getDataVersions(client, original.id);

        assert.equal(versions.length, 4);
        assert.equal(versions[0].change_type, 'delete');
        assert.equal((versions[0].row_data as any).value, 300);

        assert.equal(versions[1].change_type, 'update');
        assert.equal((versions[1].row_data as any).value, 300);

        assert.equal(versions[2].change_type, 'update');
        assert.equal((versions[2].row_data as any).value, 200);

        assert.equal(versions[3].change_type, 'create');
        assert.equal((versions[3].row_data as any).value, 100);
      } finally {
        client.release();
      }
    });
  });
});
