# GUIDE COMPLET - TESTS SYSTÈME DE PERSISTANCE

## 📋 Prérequis

### 1. Docker démarré et images construites

```powershell
# Vérifier Docker
docker version

# Vérifier les images
docker images

# Vous devriez voir :
# - nod_n8n-workspace
# - nod_n8n-browser
# - postgres:17-alpine
```

### 2. Containers en cours d'exécution

```powershell
# Démarrer tous les containers
cd h:\nod_n8n
docker compose up -d

# Vérifier que 4 containers tournent
docker ps

# Attendu :
# - nod_n8n-workspace-1
# - nod_n8n-browser-1
# - nod_n8n-postgres-1
# - nod_n8n-agent-browser-1
```

### 3. Base de données initialisée

```powershell
# Vérifier que PostgreSQL répond
docker exec nod_n8n-postgres-1 pg_isready -U nod

# Devrait afficher : /var/run/postgresql:5432 - accepting connections
```

---

## 🧪 PHASE 1 : Tests Unitaires

### Commande

```powershell
cd h:\nod_n8n
pnpm test src/server/db-audit-tables.test.ts
```

### Tests exécutés (14 tests)

#### Groupe 1 : Gestion des Schémas (4 tests)

1. ✅ Créer un schéma de table
2. ✅ Lister tous les schémas d'un utilisateur
3. ✅ Récupérer un schéma spécifique
4. ✅ Supprimer un schéma

#### Groupe 2 : Gestion des Données (5 tests)

5. ✅ Insérer une ligne de données
6. ✅ Insérer plusieurs lignes en bulk
7. ✅ Récupérer toutes les lignes d'une table
8. ✅ Modifier une ligne existante
9. ✅ Supprimer une ligne (soft delete)

#### Groupe 3 : Versioning (2 tests)

10. ✅ Création automatique de version lors d'une modification
11. ✅ Consulter l'historique des versions

#### Groupe 4 : Ordre des lignes (1 test)

12. ✅ Réorganiser l'ordre des lignes

#### Groupe 5 : Isolation Multi-Tenant (2 tests)

13. ✅ Un utilisateur ne voit que ses propres schémas
14. ✅ Un utilisateur ne peut pas modifier les données d'un autre

### Résultat attendu

```
✓ src/server/db-audit-tables.test.ts (14 tests)
  ✓ Audit Tables - Schemas (4)
  ✓ Audit Tables - Data (5)
  ✓ Audit Tables - Versioning (2)
  ✓ Audit Tables - Ordering (1)
  ✓ Audit Tables - Multi-tenant (2)

Test Files  1 passed (1)
Tests  14 passed (14)
Duration  ~2-3s
```

### En cas d'échec

**Erreur de connexion DB** :

```
Error: connect ECONNREFUSED 127.0.0.1:54329
```

→ Vérifier que PostgreSQL tourne : `docker ps | findstr postgres`

**Erreur de schéma** :

```
Error: relation "audit_table_schemas" does not exist
```

→ Relancer l'initialisation : `pnpm exec tsx src/server/index.ts` (démarre puis CTRL+C)

---

## 🧪 PHASE 2 : Tests d'Intégration API

### Prérequis

1. **Démarrer le serveur Nod** :

```powershell
cd h:\nod_n8n
pnpm exec tsx src/server/index.ts
```

2. **Récupérer le token d'accès** :

```
# Le serveur affiche au démarrage :
http://localhost:4310/#access=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Copier la partie après #access=
```

3. **Configurer le token** :

```powershell
# Créer un fichier .env dans tests-audit-tables/
cd h:\nod_n8n\tests-audit-tables
"NOD_API_URL=http://localhost:4310`nNOD_API_TOKEN=VOTRE_TOKEN_ICI" | Out-File -FilePath .env -Encoding utf8
```

### Commande

```powershell
cd h:\nod_n8n
node tests-audit-tables/run-tests.mjs
```

### Tests exécutés (8 scénarios)

#### Scénario 1 : Vérification Authentification

- ❌ Requête sans token → 401 Unauthorized
- ✅ Requête avec token → 200 OK

#### Scénario 2 : Création de Schéma

- Utilise `01-table-feuille-couverture-comptes-dormants.json`
- Crée une table avec 8 colonnes
- Vérifie l'ID retourné

#### Scénario 3 : Insertion Bulk de Données

- Insère les 20 lignes d'exemple
- Vérifie le nombre de lignes créées
- Contrôle les IDs générés

#### Scénario 4 : Lecture des Données

- Récupère toutes les lignes de la table
- Vérifie l'ordre (row_order)
- Contrôle l'intégrité des données JSONB

#### Scénario 5 : Modification d'une Ligne

- Modifie le solde d'un compte
- Vérifie la mise à jour
- Contrôle que `updated_at` change

#### Scénario 6 : Consultation Historique

- Récupère les versions de la ligne modifiée
- Vérifie qu'il y a 2 versions (insert + update)
- Contrôle que l'ancienne valeur est sauvegardée

#### Scénario 7 : Suppression d'une Ligne

- Soft delete d'une ligne
- Vérifie que `deleted_at` est défini
- Contrôle que la ligne n'apparaît plus dans GET par défaut

#### Scénario 8 : Réorganisation de l'Ordre

- Change le `row_order` d'une ligne
- Vérifie le nouvel ordre
- Contrôle que les autres lignes ne sont pas affectées

### Résultat attendu

```
🧪 TESTS SYSTÈME DE PERSISTANCE DES TABLES D'AUDIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API URL: http://localhost:4310
Token: ✅ Configuré

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Test 1: Authentification
   └─ Sans token: 401 ✓
   └─ Avec token: 200 ✓

✅ Test 2: Création schéma (Feuille Couverture)
   └─ ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx ✓
   └─ 8 colonnes définies ✓

✅ Test 3: Insertion bulk (20 lignes)
   └─ 20 lignes insérées ✓
   └─ IDs générés ✓

✅ Test 4: Lecture données
   └─ 20 lignes récupérées ✓
   └─ Ordre correct ✓

✅ Test 5: Modification ligne
   └─ Solde mis à jour ✓
   └─ Timestamp updated_at changé ✓

✅ Test 6: Historique versions
   └─ 2 versions (insert + update) ✓
   └─ Ancienne valeur sauvegardée ✓

✅ Test 7: Suppression ligne
   └─ deleted_at défini ✓
   └─ Ligne masquée par défaut ✓

✅ Test 8: Réorganisation ordre
   └─ row_order modifié ✓
   └─ Autres lignes inchangées ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TOUS LES TESTS RÉUSSIS (8/8)

Durée totale: ~3-5 secondes
```

### En cas d'échec

**Erreur 401** :

```
❌ Test 1: Unauthorized
```

→ Vérifier le token dans `.env`

**Erreur 500** :

```
❌ Test 2: Internal Server Error
```

→ Vérifier les logs du serveur Nod

**Erreur ECONNREFUSED** :

```
❌ Cannot connect to http://localhost:4310
```

→ Vérifier que le serveur Nod est démarré

---

## 🧪 PHASE 3 : Tests Manuels avec les 5 Tables Réelles

### Objectif

Tester le système avec les 5 exemples de tables d'audit bancaire fournies par l'utilisateur.

### Fichiers à tester

1. `01-table-feuille-couverture-comptes-dormants.json` (8 colonnes, 20 lignes)
2. `02-table-feuille-revision-comptable.json` (9 colonnes, 15 lignes)
3. `03-table-matrice-surveillance-permanente.json` (10 colonnes, 12 lignes)
4. `04-table-plan-recommandations.json` (8 colonnes, 10 lignes)
5. `05-document-extraction-core-banking.json` (12 colonnes, 30 lignes)

### Script de Test

```powershell
# tests-audit-tables/test-all-tables.mjs
cd h:\nod_n8n\tests-audit-tables
node test-all-tables.mjs
```

Je vais créer ce script maintenant...

### Résultat attendu

```
🎯 TEST DES 5 TABLES D'AUDIT BANCAIRE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 Table 1: Feuille de Couverture - Comptes Dormants
   ✅ Schéma créé (8 colonnes)
   ✅ 20 lignes insérées
   ✅ Données vérifiées

📊 Table 2: Feuille de Révision Comptable
   ✅ Schéma créé (9 colonnes)
   ✅ 15 lignes insérées
   ✅ Données vérifiées

📊 Table 3: Matrice de Surveillance Permanente
   ✅ Schéma créé (10 colonnes)
   ✅ 12 lignes insérées
   ✅ Données vérifiées

📊 Table 4: Plan de Recommandations
   ✅ Schéma créé (8 colonnes)
   ✅ 10 lignes insérées
   ✅ Données vérifiées

📊 Table 5: Document d'Extraction Core Banking
   ✅ Schéma créé (12 colonnes)
   ✅ 30 lignes insérées
   ✅ Données vérifiées

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TOUTES LES TABLES TESTÉES AVEC SUCCÈS

Statistiques:
- 5 schémas créés
- 47 colonnes au total
- 87 lignes insérées
- 0 erreurs

Durée: ~8-10 secondes
```

---

## 🧪 PHASE 4 : Tests de Performance

### Test de Volume

```powershell
# Créer une table avec 1000 lignes
node tests-audit-tables/test-performance.mjs
```

### Métriques à vérifier

| Opération             | Volume      | Temps attendu |
| --------------------- | ----------- | ------------- |
| Création schéma       | 1 table     | < 100ms       |
| Bulk insert           | 1000 lignes | < 2s          |
| Lecture toutes lignes | 1000 lignes | < 500ms       |
| Modification 1 ligne  | 1 ligne     | < 100ms       |
| Historique 1 ligne    | 10 versions | < 100ms       |
| Suppression 1 ligne   | 1 ligne     | < 100ms       |

---

## 🧪 PHASE 5 : Tests Multi-Utilisateur

### Objectif

Vérifier l'isolation des données entre utilisateurs (SaaS).

### Scénario

1. Créer 2 utilisateurs (A et B)
2. Utilisateur A crée une table avec données
3. Utilisateur B tente de lire les données de A → ❌ 404
4. Utilisateur B crée sa propre table
5. Les deux utilisateurs voient uniquement leurs tables

### Script

```powershell
node tests-audit-tables/test-multi-tenant.mjs
```

---

## 📊 CHECKLIST COMPLÈTE

### Avant les tests

- [ ] Docker Desktop démarré
- [ ] Images construites (`docker images` montre 3+ images)
- [ ] Containers démarrés (`docker ps` montre 4 containers)
- [ ] PostgreSQL répond (`docker exec nod_n8n-postgres-1 pg_isready`)
- [ ] Serveur Nod démarré (`pnpm exec tsx src/server/index.ts`)
- [ ] Token d'accès récupéré
- [ ] Fichier `.env` configuré dans `tests-audit-tables/`

### Tests unitaires

- [ ] 14 tests passent
- [ ] Durée < 5 secondes
- [ ] Aucune erreur de connexion DB
- [ ] Couverture : schémas, données, versions, ordre, isolation

### Tests d'intégration API

- [ ] 8 scénarios passent
- [ ] Authentification vérifiée (401 sans token)
- [ ] CRUD complet testé
- [ ] Versioning automatique vérifié
- [ ] Soft delete confirmé

### Tests tables réelles

- [ ] 5 tables bancaires créées
- [ ] 87 lignes totales insérées
- [ ] Toutes les structures de colonnes supportées
- [ ] Aucune perte de données

### Tests optionnels

- [ ] Performance avec 1000 lignes
- [ ] Isolation multi-tenant vérifiée
- [ ] Tests de charge (10 utilisateurs simultanés)

---

## 🐛 Dépannage

### Problème : Tests unitaires échouent

**Erreur** : `relation "audit_table_schemas" does not exist`

**Solution** :

```powershell
# Réinitialiser la base de données
docker compose down -v
docker compose up -d
# Attendre 10 secondes
pnpm exec tsx src/server/index.ts
# CTRL+C après le message "Server ready"
```

### Problème : Tests API timeout

**Erreur** : `ECONNREFUSED 127.0.0.1:4310`

**Solution** :

```powershell
# Vérifier que le serveur tourne
Get-Process -Name node -ErrorAction SilentlyContinue
# Si aucun processus, redémarrer :
pnpm exec tsx src/server/index.ts
```

### Problème : Token invalide

**Erreur** : `401 Unauthorized`

**Solution** :

```powershell
# Vérifier le token dans l'output du serveur
# Copier la valeur après #access=
# Mettre à jour tests-audit-tables/.env
```

### Problème : Données corrompues

**Solution** :

```powershell
# Reset complet
docker compose down -v
docker compose up -d
rm -r .local/db.sqlite (si existe)
pnpm exec tsx src/server/index.ts
```

---

## 📈 Rapports de Test

### Générer un rapport HTML

```powershell
pnpm test src/server/db-audit-tables.test.ts --reporter=html > test-report.html
```

### Générer un rapport JSON

```powershell
node tests-audit-tables/run-tests.mjs --json > test-results.json
```

---

## ✅ Critères de Validation

Le système est considéré **validé** si :

1. ✅ **Tous les tests unitaires passent** (14/14)
2. ✅ **Tous les tests d'intégration passent** (8/8)
3. ✅ **Les 5 tables réelles sont créées sans erreur**
4. ✅ **Le versioning fonctionne** (historique visible)
5. ✅ **L'isolation multi-tenant fonctionne** (pas de fuite de données)
6. ✅ **Performance acceptable** (< 2s pour 1000 lignes)
7. ✅ **Aucune erreur dans les logs serveur**

---

## 🚀 Après Validation

Une fois tous les tests réussis :

1. **Documenter les résultats** dans `TESTS-RESULTS.md`
2. **Committer le code** (backend validé)
3. **Passer au frontend React** (composant `<EditableDataTable>`)
4. **Créer le webhook n8n** (`POST /api/audit/from-n8n`)

---

**Préparé le** : 12 novembre 2026  
**Système** : Persistance des Tables d'Audit - Nod n8n  
**Statut** : ⏳ En attente exécution
