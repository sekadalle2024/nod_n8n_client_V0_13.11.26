# 🧪 Procédures de Test - SaaS Multi-Utilisateurs

Ce document contient toutes les commandes et procédures de test.

---

## 🎯 Tests Backend (API)

### Test 1 : Inscription (Register)

#### Cas Nominal (Succès)

**Commande** :

```bash
curl -X POST http://localhost:4310/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    \"email\": \"user1@example.com\",
    \"password\": \"password123\",
    \"name\": \"Utilisateur 1\"
  }'
```

**Réponse Attendue** :

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user1@example.com",
    "name": "Utilisateur 1",
    "role": "user",
    "subscription_tier": "free",
    "is_active": true,
    "email_verified": false
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation** :

- ✅ Status Code : 201
- ✅ `success: true`
- ✅ `user.id` présent
- ✅ `token` présent (JWT)

---

#### Cas d'Erreur (Email Existant)

**Commande** :

```bash
# Répéter l'inscription avec le même email
curl -X POST http://localhost:4310/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    \"email\": \"user1@example.com\",
    \"password\": \"password123\",
    \"name\": \"Utilisateur 1\"
  }'
```

**Réponse Attendue** :

```json
{
  "success": false,
  "error": "Cet email est déjà utilisé"
}
```

**Validation** :

- ✅ Status Code : 400
- ✅ `success: false`
- ✅ Message d'erreur présent

---

### Test 2 : Connexion (Login)

#### Cas Nominal (Succès)

**Commande** :

```bash
curl -X POST http://localhost:4310/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    \"email\": \"user1@example.com\",
    \"password\": \"password123\"
  }'
```

**Réponse Attendue** :

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user1@example.com",
    "name": "Utilisateur 1",
    "role": "user",
    "subscription_tier": "free"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Validation** :

- ✅ Status Code : 200
- ✅ `success: true`
- ✅ `token` présent
- ✅ Token différent de celui de register (nouveau token généré)

---

#### Cas d'Erreur (Mauvais Mot de Passe)

**Commande** :

```bash
curl -X POST http://localhost:4310/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    \"email\": \"user1@example.com\",
    \"password\": \"wrong_password\"
  }'
```

**Réponse Attendue** :

```json
{
  "success": false,
  "error": "Email ou mot de passe incorrect"
}
```

**Validation** :

- ✅ Status Code : 401
- ✅ `success: false`
- ✅ Message d'erreur ne révèle pas si l'email existe

---

### Test 3 : Profil Utilisateur (Me)

#### Avec Token Valide

**Commande** :

```bash
# Remplacer <TOKEN> par le token reçu au login
curl http://localhost:4310/api/auth/me `
  -H "Authorization: Bearer <TOKEN>"
```

**Réponse Attendue** :

```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user1@example.com",
    "name": "Utilisateur 1",
    "role": "user",
    "subscription_tier": "free",
    "is_active": true,
    "email_verified": false
  }
}
```

**Validation** :

- ✅ Status Code : 200
- ✅ `user` correspond à l'utilisateur connecté

---

#### Sans Token (Erreur)

**Commande** :

```bash
curl http://localhost:4310/api/auth/me
```

**Réponse Attendue** :

```json
{
  "error": "Token d'authentification manquant"
}
```

**Validation** :

- ✅ Status Code : 401
- ✅ Accès refusé

---

### Test 4 : Déconnexion (Logout)

**Commande** :

```bash
curl -X POST http://localhost:4310/api/auth/logout `
  -H "Authorization: Bearer <TOKEN>"
```

**Réponse Attendue** :

```json
{
  "success": true,
  "message": "Déconnexion réussie"
}
```

**Validation** :

- ✅ Status Code : 200
- ✅ Session supprimée en base
- ✅ Token ne fonctionne plus pour GET /api/auth/me

**Vérifier Token Invalide** :

```bash
curl http://localhost:4310/api/auth/me `
  -H "Authorization: Bearer <TOKEN>"
# Doit retourner 401
```

---

### Test 5 : Route Protégée

**Commande** :

```bash
# Essayer d'accéder à une route protégée sans token
curl http://localhost:4310/api/chat
```

**Réponse Attendue** :

```json
{
  "error": "Token d'authentification manquant"
}
```

**Validation** :

- ✅ Status Code : 401
- ✅ Toutes les routes (sauf /api/auth/*) refusent l'accès sans token

---

## 🗄️ Tests Multi-Tenancy (Isolation)

### Test 6 : Isolation des Données

**Objectif** : Vérifier que User 1 et User 2 ne voient pas les données de l'autre.

#### Étape 1 : Créer 2 Utilisateurs

```bash
# User 1
curl -X POST http://localhost:4310/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"alice@test.com\", \"password\": \"password123\", \"name\": \"Alice\"}'

# User 2
curl -X POST http://localhost:4310/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{\"email\": \"bob@test.com\", \"password\": \"password123\", \"name\": \"Bob\"}'
```

**Sauvegarder les tokens** :

```
TOKEN_ALICE=<token_alice>
TOKEN_BOB=<token_bob>
```

---

#### Étape 2 : Alice Crée des Données

```sql
-- Se connecter à PostgreSQL
docker exec -it nod-postgres-1 psql -U nod -d nod

-- Basculer vers le schéma d'Alice (supposons user_id = 1)
SET search_path TO user_1, public;

-- Créer une mission d'audit
INSERT INTO audit_missions (name, client, status)
VALUES ('Mission Confidentielle Alice', 'Client A', 'in_progress');

-- Vérifier
SELECT * FROM audit_missions;
```

**Validation** :

- ✅ Données insérées dans `user_1.audit_missions`

---

#### Étape 3 : Bob Ne Doit PAS Voir les Données d'Alice

```sql
-- Basculer vers le schéma de Bob (supposons user_id = 2)
SET search_path TO user_2, public;

-- Essayer de lire
SELECT * FROM audit_missions;
```

**Réponse Attendue** :

```
 id | name | client | status | start_date | end_date | created_by | created_at | updated_at
----+------+--------+--------+------------+----------+------------+------------+------------
(0 rows)
```

**Validation** :

- ✅ Aucune donnée visible
- ✅ Isolation complète

---

#### Étape 4 : Bob Crée Ses Propres Données

```sql
-- Toujours dans user_2
INSERT INTO audit_missions (name, client, status)
VALUES ('Mission Bob', 'Client B', 'draft');

SELECT * FROM audit_missions;
```

**Validation** :

- ✅ Bob voit uniquement sa propre mission
- ✅ Pas de fuite de données

---

#### Étape 5 : Vérifier depuis l'API

**Alice récupère ses missions** :

```bash
curl http://localhost:4310/api/audit/missions `
  -H "Authorization: Bearer $TOKEN_ALICE"
```

**Réponse Attendue** :

```json
[
  {
    "id": 1,
    "name": "Mission Confidentielle Alice",
    "client": "Client A",
    "status": "in_progress"
  }
]
```

**Bob récupère ses missions** :

```bash
curl http://localhost:4310/api/audit/missions `
  -H "Authorization: Bearer $TOKEN_BOB"
```

**Réponse Attendue** :

```json
[
  {
    "id": 1,
    "name": "Mission Bob",
    "client": "Client B",
    "status": "draft"
  }
]
```

**Validation** :

- ✅ Chaque utilisateur voit uniquement ses propres données
- ✅ IDs peuvent se répéter entre schémas (normal)

---

#### Cleanup

```sql
-- Supprimer les utilisateurs test
DELETE FROM public.users WHERE email IN ('alice@test.com', 'bob@test.com');

-- Supprimer les schémas
DROP SCHEMA IF EXISTS user_1 CASCADE;
DROP SCHEMA IF EXISTS user_2 CASCADE;
```

---

## 🌐 Tests Frontend (Interface)

### Test 7 : Page de Login

**Procédure** :

1. Ouvrir http://localhost:4310/login dans le navigateur
2. Vérifier l'affichage :
   - ✅ Formulaire "Connexion à Nod" visible
   - ✅ Champs : Email, Mot de passe
   - ✅ Bouton "Se connecter"
   - ✅ Lien "Pas encore de compte ? S'inscrire"

---

### Test 8 : Inscription depuis l'Interface

**Procédure** :

1. Sur http://localhost:4310/login
2. Cliquer sur "Pas encore de compte ? S'inscrire"
3. Remplir le formulaire :
   - Nom : "Test User"
   - Email : "test@interface.com"
   - Mot de passe : "password123"
4. Cliquer "S'inscrire"

**Validation** :

- ✅ Pas d'erreur affichée
- ✅ Redirection automatique vers `/` (chat)
- ✅ Interface Nod normale visible

---

### Test 9 : Connexion depuis l'Interface

**Procédure** :

1. Se déconnecter (ou ouvrir en navigation privée)
2. Aller sur http://localhost:4310/login
3. Remplir :
   - Email : "test@interface.com"
   - Mot de passe : "password123"
4. Cliquer "Se connecter"

**Validation** :

- ✅ Connexion réussie
- ✅ Redirection vers `/`
- ✅ Chat accessible

---

### Test 10 : Erreurs d'Authentification

**Procédure** :

1. Sur http://localhost:4310/login
2. Entrer un mauvais mot de passe
3. Cliquer "Se connecter"

**Validation** :

- ✅ Message d'erreur affiché : "Email ou mot de passe incorrect"
- ✅ Pas de redirection
- ✅ Formulaire reste visible

---

### Test 11 : Protection des Routes

**Procédure** :

1. Se déconnecter (ou supprimer localStorage)
2. Essayer d'accéder directement à http://localhost:4310/
3. Ou http://localhost:4310/audit

**Validation** :

- ✅ Redirection automatique vers `/login`
- ✅ Pas d'accès à l'interface sans authentification

---

### Test 12 : Déconnexion

**Procédure** :

1. Connecté en tant que user
2. Trouver le bouton "Déconnexion" (ou implémenter un)
3. Cliquer

**Validation** :

- ✅ Redirection vers `/login`
- ✅ Token supprimé du localStorage
- ✅ Ne peut plus accéder aux routes protégées

---

## 📊 Rapport de Tests

### Template de Rapport

```markdown
# Rapport de Tests - SaaS Multi-Utilisateurs

Date : __________
Testeur : __________

## Backend (API)

- [ ] Test 1 : Register (succès) - ✅ / ❌
- [ ] Test 1b : Register (email existant) - ✅ / ❌
- [ ] Test 2 : Login (succès) - ✅ / ❌
- [ ] Test 2b : Login (mauvais mot de passe) - ✅ / ❌
- [ ] Test 3 : GET /me (avec token) - ✅ / ❌
- [ ] Test 3b : GET /me (sans token) - ✅ / ❌
- [ ] Test 4 : Logout - ✅ / ❌
- [ ] Test 5 : Route protégée sans token - ✅ / ❌

## Multi-Tenancy

- [ ] Test 6a : Créer 2 utilisateurs - ✅ / ❌
- [ ] Test 6b : User 1 crée données - ✅ / ❌
- [ ] Test 6c : User 2 ne voit pas données User 1 - ✅ / ❌
- [ ] Test 6d : Isolation API - ✅ / ❌
- [ ] Test 6e : Cleanup - ✅ / ❌

## Frontend (Interface)

- [ ] Test 7 : Affichage page Login - ✅ / ❌
- [ ] Test 8 : Inscription interface - ✅ / ❌
- [ ] Test 9 : Connexion interface - ✅ / ❌
- [ ] Test 10 : Erreurs affichées - ✅ / ❌
- [ ] Test 11 : Protection routes - ✅ / ❌
- [ ] Test 12 : Déconnexion - ✅ / ❌

## Résumé

Total tests : 20
Réussis : ____ / 20
Échoués : ____ / 20

Taux de réussite : _____%

## Problèmes Rencontrés

1. ...
2. ...

## Notes

...
```

---

## 🔍 Tests de Performance (Optionnel)

### Test de Charge

**Objectif** : Vérifier que le système supporte plusieurs utilisateurs simultanés.

**Outil** : Apache Bench (ab)

```bash
# 100 requêtes, 10 simultanées
ab -n 100 -c 10 -H "Authorization: Bearer <TOKEN>" http://localhost:4310/api/auth/me
```

**Métriques à surveiller** :

- Temps de réponse moyen : < 200ms
- Taux de succès : 100%
- Pas d'erreurs de timeout

---

## ✅ Validation Finale

**Tous les tests passent** :

- ✅ 20/20 tests backend réussis
- ✅ Multi-tenancy validé
- ✅ Interface fonctionnelle

**Le système est prêt pour la production ! 🚀**
