#!/usr/bin/env node

/**
 * Script de test manuel pour valider le système de persistance des tables d'audit
 *
 * Usage:
 *   node tests-audit-tables/run-tests.mjs
 *
 * Pré-requis:
 *   - Docker containers en cours d'exécution
 *   - Serveur Nod démarré sur http://localhost:4310
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:4310';

// Couleurs pour le terminal
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

function logStep(step, description) {
  log(`\n[${step}] ${description}`, 'cyan');
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

async function testEndpoint(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
    };
  }
}

async function main() {
  log('\n========================================', 'cyan');
  log('  Tests - Système de Persistance Audit', 'cyan');
  log('========================================\n', 'cyan');

  let createdSchemaId = null;
  let createdDataIds = [];

  // Test 1: Vérifier la santé du serveur
  logStep('1/8', 'Vérification de la santé du serveur');
  try {
    const health = await testEndpoint('GET', '/api/health');
    if (health.ok) {
      logSuccess('Serveur opérationnel');
    } else {
      logError('Le serveur ne répond pas correctement');
      process.exit(1);
    }
  } catch (error) {
    logError(`Impossible de se connecter au serveur: ${error.message}`);
    logInfo('Vérifiez que le serveur Nod est démarré sur http://localhost:4310');
    process.exit(1);
  }

  // Test 2: Créer un schéma de table
  logStep('2/8', "Création d'un schéma de table (Feuille de couverture)");
  try {
    const schemaFile = readFileSync(
      join(__dirname, '01-table-feuille-couverture-comptes-dormants.json'),
      'utf8',
    );
    const schemaData = JSON.parse(schemaFile);

    const result = await testEndpoint('POST', '/api/audit/schemas', schemaData.table_schema);

    if (result.ok && result.data.schema) {
      createdSchemaId = result.data.schema.id;
      logSuccess(`Schéma créé avec succès (ID: ${createdSchemaId})`);
      logInfo(`Nom: ${result.data.schema.display_name}`);
      logInfo(`Colonnes: ${result.data.schema.column_definitions.length}`);
    } else {
      logError(`Échec de création: ${JSON.stringify(result.data)}`);
      process.exit(1);
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
    process.exit(1);
  }

  // Test 3: Récupérer tous les schémas
  logStep('3/8', 'Récupération de tous les schémas');
  try {
    const result = await testEndpoint('GET', '/api/audit/schemas');

    if (result.ok && result.data.schemas) {
      logSuccess(`${result.data.schemas.length} schéma(s) trouvé(s)`);
      result.data.schemas.forEach((schema) => {
        logInfo(`  - ${schema.display_name} (${schema.column_definitions.length} colonnes)`);
      });
    } else {
      logError('Échec de récupération des schémas');
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Test 4: Insérer une ligne de données
  logStep('4/8', "Insertion d'une ligne de données");
  try {
    const rowData = {
      ordre: 1,
      compte_client: 'CPT-DOR-04412',
      date_reactivation: '2024-05-14',
      intitule_compte: 'SOC. IVOIRIENNE LIQUIDATION',
      solde_veille: 34000000,
      visa_agence: 'Oui',
      visa_siege: 'Non',
      contact_conforme: 'Non',
      montant_debit: 34000000,
      ecart: 34000000,
      assertion: 'Autorisation',
      ctr_1: '-',
      ctr_2: '-',
      ctr_3: '-',
      ctr_4: '-',
      ctr_5: '-',
      description: 'Test: Déblocage unilatéral sans visa Siège',
      conclusion: 'Non-satisfaisant',
    };

    const result = await testEndpoint('POST', `/api/audit/schemas/${createdSchemaId}/data`, {
      row_data: rowData,
    });

    if (result.ok && result.data.data) {
      createdDataIds.push(result.data.data.id);
      logSuccess(`Ligne insérée (ID: ${result.data.data.id})`);
      logInfo(`Ordre: ${result.data.data.row_order}`);
    } else {
      logError(`Échec d'insertion: ${JSON.stringify(result.data)}`);
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Test 5: Insertion en masse (bulk)
  logStep('5/8', 'Insertion en masse de 3 lignes');
  try {
    const rows = [
      {
        ordre: 2,
        compte_client: 'CPT-DOR-01205',
        date_reactivation: '2024-01-18',
        intitule_compte: 'ETS KOUADIO ET FILS',
        solde_veille: 1500000,
        visa_agence: 'Oui',
        visa_siege: 'Oui',
        contact_conforme: 'Oui',
        montant_debit: 1500000,
        ecart: 0,
        ctr_1: '+',
        ctr_2: '+',
        ctr_3: '+',
        ctr_4: '+',
        ctr_5: '+',
        conclusion: 'Satisfaisant',
      },
      {
        ordre: 3,
        compte_client: 'CPT-DOR-01890',
        date_reactivation: '2024-02-02',
        intitule_compte: 'SOCIETE CIVILE IMMO YACOUBA',
        solde_veille: 8250000,
        visa_agence: 'Oui',
        visa_siege: 'Oui',
        contact_conforme: 'Oui',
        montant_debit: 5000000,
        ecart: 0,
        ctr_1: '+',
        ctr_2: '+',
        ctr_3: '+',
        ctr_4: '+',
        ctr_5: '+',
        conclusion: 'Satisfaisant',
      },
      {
        ordre: 4,
        compte_client: 'CPT-DOR-02114',
        date_reactivation: '2024-02-15',
        intitule_compte: 'BAH MAMADOU (SUCCESSION)',
        solde_veille: 3400000,
        visa_agence: 'Oui',
        visa_siege: 'Oui',
        contact_conforme: 'Oui',
        montant_debit: 3400000,
        ecart: 0,
        ctr_1: '+',
        ctr_2: '+',
        ctr_3: '+',
        ctr_4: '+',
        ctr_5: '+',
        conclusion: 'Satisfaisant',
      },
    ];

    const result = await testEndpoint('POST', `/api/audit/schemas/${createdSchemaId}/data/bulk`, {
      rows,
    });

    if (result.ok && result.data.data) {
      result.data.data.forEach((item) => createdDataIds.push(item.id));
      logSuccess(`${result.data.data.length} lignes insérées`);
      logInfo(`Ordres: ${result.data.data.map((d) => d.row_order).join(', ')}`);
    } else {
      logError(`Échec d'insertion en masse: ${JSON.stringify(result.data)}`);
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Test 6: Récupérer toutes les données
  logStep('6/8', 'Récupération de toutes les lignes');
  try {
    const result = await testEndpoint('GET', `/api/audit/schemas/${createdSchemaId}/data`);

    if (result.ok && result.data.data) {
      logSuccess(`${result.data.data.length} ligne(s) récupérée(s)`);
      result.data.data.forEach((row) => {
        const data = row.row_data;
        logInfo(`  ${row.row_order}. ${data.compte_client} - ${data.conclusion}`);
      });
    } else {
      logError('Échec de récupération des données');
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Test 7: Modifier une ligne
  logStep('7/8', "Modification d'une ligne (changement de conclusion)");
  try {
    if (createdDataIds.length > 0) {
      const firstId = createdDataIds[0];

      const result = await testEndpoint('PUT', `/api/audit/data/${firstId}`, {
        row_data: {
          ordre: 1,
          compte_client: 'CPT-DOR-04412',
          date_reactivation: '2024-05-14',
          intitule_compte: 'SOC. IVOIRIENNE LIQUIDATION - MODIFIÉ',
          solde_veille: 34000000,
          visa_agence: 'Oui',
          visa_siege: 'Non',
          contact_conforme: 'Non',
          montant_debit: 34000000,
          ecart: 34000000,
          assertion: 'Autorisation',
          ctr_1: '-',
          ctr_2: '-',
          ctr_3: '-',
          ctr_4: '-',
          ctr_5: '-',
          description: 'Test MODIFIÉ: Déblocage unilatéral',
          conclusion: 'À RÉVISER',
        },
      });

      if (result.ok && result.data.data) {
        logSuccess(`Ligne modifiée (ID: ${firstId})`);
        logInfo(`Nouveau libellé: ${result.data.data.row_data.intitule_compte}`);
        logInfo(`Nouvelle conclusion: ${result.data.data.row_data.conclusion}`);
      } else {
        logError(`Échec de modification: ${JSON.stringify(result.data)}`);
      }
    } else {
      logError('Aucune donnée à modifier');
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Test 8: Vérifier l'historique des versions
  logStep('8/8', "Vérification de l'historique des versions");
  try {
    if (createdDataIds.length > 0) {
      const firstId = createdDataIds[0];

      const result = await testEndpoint('GET', `/api/audit/data/${firstId}/versions`);

      if (result.ok && result.data.versions) {
        logSuccess(`${result.data.versions.length} version(s) trouvée(s)`);
        result.data.versions.forEach((version) => {
          logInfo(`  ${version.change_type} - ${new Date(version.changed_at).toLocaleString()}`);
        });
      } else {
        logError('Échec de récupération des versions');
      }
    } else {
      logError('Aucune donnée pour vérifier les versions');
    }
  } catch (error) {
    logError(`Erreur: ${error.message}`);
  }

  // Résumé
  log('\n========================================', 'cyan');
  log('  Résumé des tests', 'cyan');
  log('========================================\n', 'cyan');
  logSuccess(`Schéma créé: ${createdSchemaId}`);
  logSuccess(`Données créées: ${createdDataIds.length} ligne(s)`);
  log('\n✅ Tous les tests sont terminés !\n', 'green');
  log('Prochaines étapes:', 'yellow');
  logInfo('1. Tester les routes de suppression (DELETE)');
  logInfo('2. Tester le réordonnancement (PUT /data/:id/order)');
  logInfo("3. Créer l'interface React pour éditer les tables");
  logInfo('4. Intégrer avec n8n pour recevoir les données');
}

main().catch((error) => {
  logError(`\nErreur fatale: ${error.message}`);
  console.error(error);
  process.exit(1);
});
