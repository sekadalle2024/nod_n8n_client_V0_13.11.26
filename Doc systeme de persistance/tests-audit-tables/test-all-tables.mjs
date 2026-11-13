#!/usr/bin/env node

/**
 * Test complet des 5 tables d'audit bancaire
 *
 * Ce script teste la création et l'insertion de données
 * pour toutes les tables réelles fournies par l'utilisateur.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const API_URL = process.env.NOD_API_URL || 'http://localhost:4310';
const API_TOKEN = process.env.NOD_API_TOKEN || '';

if (!API_TOKEN) {
  console.error('❌ NOD_API_TOKEN non configuré');
  console.error('   Créer un fichier .env avec:');
  console.error('   NOD_API_TOKEN=votre_token_ici');
  process.exit(1);
}

// Utilitaires
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiCall(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  return response.json();
}

// Liste des fichiers de tables
const TABLE_FILES = [
  {
    file: '01-table-feuille-couverture-comptes-dormants.json',
    name: 'Feuille de Couverture - Comptes Dormants',
    expectedColumns: 8,
    expectedRows: 20,
  },
  {
    file: '02-table-feuille-revision-comptable.json',
    name: 'Feuille de Révision Comptable',
    expectedColumns: 9,
    expectedRows: 15,
  },
  {
    file: '03-table-matrice-surveillance-permanente.json',
    name: 'Matrice de Surveillance Permanente',
    expectedColumns: 10,
    expectedRows: 12,
  },
  {
    file: '04-table-plan-recommandations.json',
    name: 'Plan de Recommandations',
    expectedColumns: 8,
    expectedRows: 10,
  },
  {
    file: '05-document-extraction-core-banking.json',
    name: "Document d'Extraction Core Banking",
    expectedColumns: 12,
    expectedRows: 30,
  },
];

// Tests
console.log("🎯 TEST DES 5 TABLES D'AUDIT BANCAIRE");
console.log('━'.repeat(60));
console.log('');

let totalSchemas = 0;
let totalColumns = 0;
let totalRows = 0;
let errors = 0;

const startTime = Date.now();

for (const tableInfo of TABLE_FILES) {
  try {
    console.log(`📊 Table: ${tableInfo.name}`);

    // Charger le fichier JSON
    const filePath = path.join(__dirname, tableInfo.file);
    const tableData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Étape 1 : Créer le schéma
    console.log(`   └─ Création schéma...`);
    const createSchemaResponse = await apiCall('/api/audit/schemas', {
      method: 'POST',
      body: JSON.stringify({
        tableName: tableData.tableName,
        displayName: tableData.displayName,
        columnDefinitions: tableData.columnDefinitions,
        n8nWorkflowId: tableData.n8nWorkflowId || `test-${Date.now()}`,
      }),
    });

    const schemaId = createSchemaResponse.schema.id;
    const actualColumns = createSchemaResponse.schema.column_definitions.length;

    if (actualColumns !== tableInfo.expectedColumns) {
      throw new Error(
        `Nombre de colonnes incorrect: ${actualColumns} au lieu de ${tableInfo.expectedColumns}`,
      );
    }

    console.log(`   ✅ Schéma créé (${actualColumns} colonnes)`);
    totalSchemas++;
    totalColumns += actualColumns;

    // Étape 2 : Insérer les données en bulk
    if (tableData.data && tableData.data.length > 0) {
      console.log(`   └─ Insertion ${tableData.data.length} lignes...`);

      const bulkInsertResponse = await apiCall(`/api/audit/schemas/${schemaId}/data/bulk`, {
        method: 'POST',
        body: JSON.stringify({
          rows: tableData.data,
        }),
      });

      const insertedCount = bulkInsertResponse.data.length;

      if (insertedCount !== tableInfo.expectedRows) {
        throw new Error(
          `Nombre de lignes incorrect: ${insertedCount} au lieu de ${tableInfo.expectedRows}`,
        );
      }

      console.log(`   ✅ ${insertedCount} lignes insérées`);
      totalRows += insertedCount;
    }

    // Étape 3 : Vérifier les données
    console.log(`   └─ Vérification données...`);
    const dataResponse = await apiCall(`/api/audit/schemas/${schemaId}/data`);

    if (dataResponse.data.length !== tableInfo.expectedRows) {
      throw new Error(`Nombre de lignes lues incorrect: ${dataResponse.data.length}`);
    }

    // Vérifier que chaque ligne a bien les bonnes colonnes
    for (const row of dataResponse.data) {
      const rowKeys = Object.keys(row.row_data);
      if (rowKeys.length === 0) {
        throw new Error(`Ligne vide détectée: ${row.id}`);
      }
    }

    console.log(`   ✅ Données vérifiées`);
    console.log('');

    // Pause pour éviter de surcharger l'API
    await sleep(100);
  } catch (error) {
    console.log(`   ❌ ERREUR: ${error.message}`);
    console.log('');
    errors++;
  }
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('━'.repeat(60));
console.log('');

if (errors === 0) {
  console.log('✅ TOUTES LES TABLES TESTÉES AVEC SUCCÈS');
} else {
  console.log(`❌ ${errors} ERREUR(S) DÉTECTÉE(S)`);
}

console.log('');
console.log('Statistiques:');
console.log(`- ${totalSchemas} schémas créés`);
console.log(`- ${totalColumns} colonnes au total`);
console.log(`- ${totalRows} lignes insérées`);
console.log(`- ${errors} erreurs`);
console.log('');
console.log(`Durée: ${duration}s`);
console.log('');

process.exit(errors > 0 ? 1 : 0);
