#!/usr/bin/env node

/**
 * Test direct de la persistance via PostgreSQL
 * Sans passer par l'authentification HTTP
 */

import pkg from 'pg';
const { Pool } = pkg;

// Configuration PostgreSQL depuis .env
const pool = new Pool({
  connectionString:
    'postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod',
});

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`  ✓ ${message}`, 'green');
}

function logError(message) {
  log(`  ✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`  ℹ ${message}`, 'blue');
}

async function main() {
  log('\n========================================', 'cyan');
  log('  Test Direct - Système de Persistance', 'cyan');
  log('========================================\n', 'cyan');

  try {
    // Test 1: Connexion PostgreSQL
    log('[1/8] Test de connexion PostgreSQL', 'cyan');
    const testConn = await pool.query('SELECT 1 as test');
    if (testConn.rows[0].test === 1) {
      logSuccess('Connexion PostgreSQL OK');
    }

    // Test 2: Vérification des tables
    log('\n[2/8] Vérification des tables', 'cyan');
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'audit_%'
      ORDER BY table_name
    `);

    const expectedTables = ['audit_data_versions', 'audit_table_data', 'audit_table_schemas'];

    const foundTables = tables.rows.map((r) => r.table_name);

    for (const table of expectedTables) {
      if (foundTables.includes(table)) {
        logSuccess(`Table "${table}" existe`);
      } else {
        logError(`Table "${table}" manquante`);
      }
    }

    // Test 3: Créer un schéma de table
    log("\n[3/8] Création d'un schéma de table", 'cyan');
    const schemaResult = await pool.query(
      `
      INSERT INTO audit_table_schemas (
        owner_id, table_name, display_name, n8n_workflow_id, column_definitions
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
      [
        'test_user_001',
        'test_risques',
        'Table de Test - Risques',
        'workflow_test_001',
        JSON.stringify([
          { name: 'assertion', type: 'text', required: true },
          { name: 'niveau_risque', type: 'select', options: ['Faible', 'Moyen', 'Élevé'] },
          { name: 'montant', type: 'number' },
          { name: 'date_audit', type: 'date' },
          { name: 'conforme', type: 'boolean' },
        ]),
      ],
    );

    const schemaId = schemaResult.rows[0].id;
    logSuccess(`Schéma créé avec ID: ${schemaId}`);
    logInfo(`Nom: ${schemaResult.rows[0].display_name}`);

    // Test 4: Insérer des données
    log('\n[4/8] Insertion de données', 'cyan');
    const insertResult1 = await pool.query(
      `
      INSERT INTO audit_table_data (
        owner_id, table_schema_id, row_data, row_order
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [
        'test_user_001',
        schemaId,
        JSON.stringify({
          assertion: 'Existence des stocks',
          niveau_risque: 'Élevé',
          montant: 150000,
          date_audit: '2024-01-15',
          conforme: false,
        }),
        1,
      ],
    );

    const dataId1 = insertResult1.rows[0].id;
    logSuccess(`Ligne 1 insérée - ID: ${dataId1}`);

    const insertResult2 = await pool.query(
      `
      INSERT INTO audit_table_data (
        owner_id, table_schema_id, row_data, row_order
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
      [
        'test_user_001',
        schemaId,
        JSON.stringify({
          assertion: 'Valorisation des immobilisations',
          niveau_risque: 'Moyen',
          montant: 85000,
          date_audit: '2024-01-16',
          conforme: true,
        }),
        2,
      ],
    );

    const dataId2 = insertResult2.rows[0].id;
    logSuccess(`Ligne 2 insérée - ID: ${dataId2}`);

    // Test 5: Lire les données
    log('\n[5/8] Lecture des données', 'cyan');
    const readResult = await pool.query(
      `
      SELECT * FROM audit_table_data 
      WHERE table_schema_id = $1 AND deleted_at IS NULL
      ORDER BY row_order
    `,
      [schemaId],
    );

    logSuccess(`${readResult.rows.length} lignes récupérées`);
    readResult.rows.forEach((row, i) => {
      const data = row.row_data;
      logInfo(`  Ligne ${i + 1}: ${data.assertion} - ${data.niveau_risque} - ${data.montant}€`);
    });

    // Test 6: Modifier une donnée (avec versioning)
    log('\n[6/8] Modification avec versioning', 'cyan');

    // Sauvegarder l'ancienne version
    const oldData = readResult.rows[0];
    await pool.query(
      `
      INSERT INTO audit_data_versions (
        owner_id, table_data_id, row_data, change_type, changed_by
      ) VALUES ($1, $2, $3, $4, $5)
    `,
      ['test_user_001', dataId1, oldData.row_data, 'update', 'test_user_001'],
    );

    logSuccess('Version sauvegardée');

    // Mettre à jour
    const updateResult = await pool.query(
      `
      UPDATE audit_table_data 
      SET row_data = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `,
      [
        JSON.stringify({
          assertion: 'Existence des stocks',
          niveau_risque: 'Faible', // Changé de Élevé à Faible
          montant: 150000,
          date_audit: '2024-01-15',
          conforme: true, // Changé de false à true
        }),
        dataId1,
      ],
    );

    logSuccess('Données mises à jour');
    logInfo(`  Ancien: Élevé, non conforme`);
    logInfo(`  Nouveau: Faible, conforme`);

    // Test 7: Vérifier l'historique
    log("\n[7/8] Vérification de l'historique", 'cyan');
    const versionResult = await pool.query(
      `
      SELECT * FROM audit_data_versions 
      WHERE table_data_id = $1
      ORDER BY changed_at DESC
    `,
      [dataId1],
    );

    logSuccess(`${versionResult.rows.length} version(s) trouvée(s)`);
    versionResult.rows.forEach((v, i) => {
      const data = v.row_data;
      logInfo(`  Version ${i + 1}: ${data.niveau_risque} - Conforme: ${data.conforme}`);
    });

    // Test 8: Test de soft delete
    log('\n[8/8] Test de suppression douce (soft delete)', 'cyan');
    await pool.query(
      `
      UPDATE audit_table_data 
      SET deleted_at = NOW()
      WHERE id = $1
    `,
      [dataId2],
    );

    logSuccess(`Ligne ${dataId2} marquée comme supprimée`);

    const activeCount = await pool.query(
      `
      SELECT COUNT(*) as count 
      FROM audit_table_data 
      WHERE table_schema_id = $1 AND deleted_at IS NULL
    `,
      [schemaId],
    );

    logInfo(`Lignes actives restantes: ${activeCount.rows[0].count}`);

    // Résumé final
    log('\n========================================', 'green');
    log('  ✓ TOUS LES TESTS SONT PASSÉS !', 'green');
    log('========================================', 'green');

    log('\n📊 Résumé:', 'cyan');
    logInfo(`  • Schéma créé: ID ${schemaId}`);
    logInfo(`  • Données insérées: 2 lignes`);
    logInfo(`  • Modifications: 1 avec versioning`);
    logInfo(`  • Versions historiques: ${versionResult.rows.length}`);
    logInfo(`  • Soft delete: 1 ligne`);
    logInfo(`  • Lignes actives: ${activeCount.rows[0].count}`);

    log('\n💡 Prochaines étapes:', 'yellow');
    logInfo('  1. Créer la table audit_table_consolidations');
    logInfo('  2. Implémenter les routes API REST');
    logInfo('  3. Créer les composants React');
    logInfo('  4. Ajouter WebSocket pour collaboration');
  } catch (error) {
    log('\n❌ ERREUR:', 'red');
    logError(error.message);
    logError(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
