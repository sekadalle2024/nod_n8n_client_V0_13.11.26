# Tests - Système de Persistance des Tables d'Audit

Ce dossier contient des exemples JSON réels basés sur votre workflow d'audit bancaire E-audit.

## 📊 Fichiers de test

### 1. **01-table-feuille-couverture-comptes-dormants.json**

- **Type** : Feuille de couverture (contrôle validation)
- **Processus** : Surveillance permanente - Contrôle des comptes dormants
- **Référence** : FC-BK-A10
- **Colonnes** : 18 colonnes (ordre, compte, dates, montants, contrôles CTR 1-5)
- **Particularité** : Assertions de contrôle interne (Autorisation, Formalisation, Traçabilité)

### 2. **02-table-feuille-revision-comptable.json**

- **Type** : Feuille de révision (rapprochement)
- **Processus** : Révision comptable - Comptes de dépôts
- **Référence** : FR-CPT-A10
- **Colonnes** : 16 colonnes (compte PCB, dates, montants, écarts)
- **Particularité** : Assertions d'audit financier (Validité, Exhaustivité, Droits et obligations)

### 3. **03-table-matrice-surveillance-permanente.json**

- **Type** : Matrice de contrôle permanent
- **Processus** : Dispositif de surveillance 1er et 2nd niveau
- **Référence** : MSP-BK-A10
- **Colonnes** : 6 colonnes (points de contrôle, risques, documents)
- **Particularité** : Structure hiérarchique des contrôles

### 4. **04-table-plan-recommandations.json**

- **Type** : Plan d'actions correctives
- **Processus** : Remédiation du contrôle permanent
- **Référence** : RECO-MSP-A10
- **Colonnes** : 8 colonnes (sous-processus, anomalies, plans d'action)
- **Particularité** : Assertions + Responsables + Échéances

### 5. **05-document-extraction-core-banking.json**

- **Type** : Document opérationnel (extraction système)
- **Processus** : Gestion et réactivation des comptes inactifs
- **Référence** : EXT-CB-DORM-2024-001
- **Colonnes** : 9 colonnes (compte, agence, maker/checker, habilitations)
- **Particularité** : Données brutes du Core Banking

## 🎯 Utilisation pour les tests

### Test 1 : Validation du schéma de base de données

```bash
# Démarrer les conteneurs Docker (quand le build sera terminé)
docker compose up -d

# Lancer les tests unitaires
pnpm --filter @nod/server test src/server/db-audit-tables.test.ts
```

### Test 2 : Test d'intégration avec n8n

1. **Créer le schéma de table** (via API)

```bash
curl -X POST http://localhost:4310/api/audit/schemas \
  -H "Content-Type: application/json" \
  -d @01-table-feuille-couverture-comptes-dormants.json
```

2. **Insérer des données** (bulk insert)

```bash
curl -X POST http://localhost:4310/api/audit/schemas/{schema_id}/data/bulk \
  -H "Content-Type: application/json" \
  -d '{"rows": [/* données du sample_data */]}'
```

3. **Récupérer et modifier**

```bash
# GET - Lister les données
curl http://localhost:4310/api/audit/schemas/{schema_id}/data

# PUT - Modifier une ligne
curl -X PUT http://localhost:4310/api/audit/schemas/data/{data_id} \
  -H "Content-Type: application/json" \
  -d '{"row_data": {/* nouvelles valeurs */}}'
```

## 🔍 Points de validation

### ✅ Schéma de base de données

- [ ] Tables `audit_table_schemas`, `audit_table_data`, `audit_data_versions` créées
- [ ] Contraintes d'intégrité (FOREIGN KEY, UNIQUE)
- [ ] Index de performance sur `owner_id`, `table_schema_id`, `deleted_at`

### ✅ Types de colonnes supportés

- [ ] `text` - Chaînes de caractères
- [ ] `number` - Nombres (FCFA, montants)
- [ ] `date` - Dates (format ISO 8601)
- [ ] `boolean` - Oui/Non
- [ ] `select` - Listes déroulantes avec options

### ✅ Fonctionnalités CRUD

- [ ] **Create** : Insertion de nouvelles lignes (simple + bulk)
- [ ] **Read** : Récupération avec tri par `row_order`
- [ ] **Update** : Modification avec versioning automatique
- [ ] **Delete** : Suppression logique (soft delete avec `deleted_at`)

### ✅ Versioning automatique

- [ ] Création : `change_type = 'create'`
- [ ] Modification : `change_type = 'update'` avec ancien état
- [ ] Suppression : `change_type = 'delete'` avec état final

### ✅ Ordre des lignes

- [ ] `row_order` auto-incrémenté
- [ ] Endpoint `/data/{dataId}/order` pour réorganiser

### ✅ Multi-tenant

- [ ] Isolation par `owner_id`
- [ ] Requêtes filtrées automatiquement

## 📝 Prochaines étapes

1. ✅ **Phase 1 : Base de données** (TERMINÉ)
   - Schéma créé
   - Fonctions CRUD implémentées
   - Versioning opérationnel

2. ⏳ **Phase 2 : API Routes** (EN COURS)
   - Routes Fastify créées
   - Validation Zod en place
   - À intégrer dans `app.ts`

3. 🔜 **Phase 3 : Tests unitaires**
   - Créer `db-audit-tables.test.ts`
   - Tester INSERT, UPDATE, DELETE
   - Tester le versioning

4. 🔜 **Phase 4 : Interface Web**
   - Composant React `<EditableDataTable>`
   - Édition inline des cellules
   - Ajout/suppression de lignes

5. 🔜 **Phase 5 : Intégration n8n**
   - Webhook pour recevoir les tables générées
   - Mapping automatique vers `audit_table_schemas`
   - Transformation JSON → PostgreSQL

## 🐛 Problèmes connus

- Docker build en cours (62% - 23/37 étapes)
- Routes API créées mais pas encore montées dans le serveur
- Tests unitaires à créer

## 📚 Références

- **Circulaire N°03-2017/CB/C** : Contrôle interne bancaire UMOA
- **Instruction N°008/07/2013/BCEAO** : Traitement des comptes inactifs
- **Normes IIA 14.3 et 14.4** : Audit interne et surveillance permanente
- **PCB UMOA** : Plan Comptable Bancaire UMOA / SYSCOHADA Révisé
