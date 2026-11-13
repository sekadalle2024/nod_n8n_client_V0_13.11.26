# 📋 Plan d'Action - Transformation SaaS Multi-Utilisateurs

## Vue d'Ensemble

Ce plan détaille **toutes les étapes** nécessaires pour transformer Nod en SaaS multi-utilisateurs, dans l'ordre optimal d'exécution.

---

## 🎯 Phases du Projet

```
Phase 1: Préparation (1h)
   ↓
Phase 2: Base de Données (2h)
   ↓
Phase 3: Backend Auth (4-6h)
   ↓
Phase 4: Frontend React (3-4h)
   ↓
Phase 5: Tests & Validation (2-3h)
   ↓
Phase 6: Déploiement
```

---

## Phase 1 : Préparation (1 heure)

### 1.1 Backup de la Base de Données ⚠️ CRITIQUE

**Fichiers affectés** : Aucun  
**Risque** : Aucun  
**Réversible** : N/A

**Actions** :

```bash
# Créer un backup PostgreSQL
docker exec nod-postgres-1 pg_dump -U nod nod > backup-$(date +%Y%m%d-%H%M%S).sql

# Vérifier le backup
ls -lh backup-*.sql
```

**Validation** :

- ✅ Fichier backup créé
- ✅ Taille > 0 KB

---

### 1.2 Installer les Dépendances NPM

**Fichiers affectés** : `package.json`, `pnpm-lock.yaml`  
**Risque** : Faible  
**Réversible** : Oui (désinstaller packages)

**Actions** :

```bash
cd h:\nod_n8n

# Installer bcrypt et jsonwebtoken
pnpm add bcrypt jsonwebtoken

# Types TypeScript
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

**Validation** :

- ✅ `bcrypt` dans package.json
- ✅ `jsonwebtoken` dans package.json
- ✅ `pnpm install` réussit sans erreur

---

### 1.3 Créer l'Arborescence de Fichiers

**Fichiers affectés** : Aucun (création uniquement)  
**Risque** : Aucun  
**Réversible** : Oui (supprimer dossiers)

**Actions** :

```bash
# Créer les dossiers nécessaires
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\auth" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\db" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\routes" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\web\pages" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\web\hooks" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\migrations" -Force
```

**Validation** :

- ✅ Tous les dossiers existent
- ✅ Pas d'erreurs de permissions

---

### 1.4 Générer JWT Secret

**Fichiers affectés** : `.env`  
**Risque** : Faible  
**Réversible** : Oui (modifier .env)

**Actions** :

```bash
# Générer un secret aléatoire
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Copier le résultat et l'ajouter à .env
```

**Ajouter à `.env`** :

```env
# JWT Secret (ne jamais partager)
JWT_SECRET=<le_secret_généré>
```

**Validation** :

- ✅ JWT_SECRET présent dans .env
- ✅ Longueur > 64 caractères

---

## Phase 2 : Base de Données (2 heures)

### 2.1 Créer la Migration SQL

**Fichiers créés** : `migrations/001-multi-user-schema.sql`  
**Risque** : Aucun (création seulement)  
**Réversible** : Oui (supprimer fichier)

**Contenu** : Voir fichier migration complet ci-dessous

**Validation** :

- ✅ Fichier créé
- ✅ SQL valide (pas d'erreurs de syntaxe)

---

### 2.2 Exécuter la Migration ⚠️ CRITIQUE

**Fichiers affectés** : Base de données PostgreSQL  
**Risque** : Moyen (modification schéma)  
**Réversible** : Oui (voir 05-ROLLBACK.md)

**Actions** :

```bash
# Se connecter à PostgreSQL
docker exec -it nod-postgres-1 psql -U nod -d nod

# Exécuter la migration dans une transaction
BEGIN;

-- Copier-coller le contenu de migrations/001-multi-user-schema.sql

-- Vérifier
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'user_sessions');

-- Si OK, committer
COMMIT;

-- Si problème, annuler
-- ROLLBACK;
```

**Validation** :

- ✅ Tables créées : `users`, `user_sessions`
- ✅ Trigger `create_user_schema_trigger` existe
- ✅ Fonctions créées sans erreur

---

### 2.3 Tester la Création Automatique de Schéma

**Fichiers affectés** : Base de données  
**Risque** : Faible  
**Réversible** : Oui (DELETE)

**Actions** :

```sql
-- Insérer un utilisateur test
INSERT INTO public.users (email, password_hash, name)
VALUES ('test@example.com', 'dummy_hash', 'Test User')
RETURNING id;

-- Vérifier que le schéma user_X a été créé
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'user_%';

-- Vérifier les tables dans le schéma
SELECT tablename FROM pg_tables WHERE schemaname = 'user_1';

-- Nettoyer
DELETE FROM public.users WHERE email = 'test@example.com';
DROP SCHEMA IF EXISTS user_1 CASCADE;
```

**Validation** :

- ✅ Schéma `user_1` créé automatiquement
- ✅ Tables présentes : `threads`, `turns`, `memory`, etc.
- ✅ Nettoyage réussi

---

## Phase 3 : Backend Auth (4-6 heures)

### 3.1 Module d'Authentification

**Fichier** : `src/server/auth/index.ts`  
**Risque** : Faible (nouveau fichier)  
**Réversible** : Oui (supprimer fichier)

**Contenu** : Voir fichier complet dans section Code

**Validation** :

- ✅ Fichier compile sans erreur TypeScript
- ✅ Imports résolus

---

### 3.2 Middleware d'Authentification

**Fichier** : `src/server/auth/middleware.ts`  
**Risque** : Faible (nouveau fichier)  
**Réversible** : Oui (supprimer fichier)

**Validation** :

- ✅ Types Express étendus correctement
- ✅ Compile sans erreur

---

### 3.3 Multi-Tenancy Database

**Fichier** : `src/server/db/multi-tenant.ts`  
**Risque** : Moyen (affecte toutes les requêtes)  
**Réversible** : Oui (supprimer fichier + retirer middleware)

**Validation** :

- ✅ Fonction `setUserContext` compile
- ✅ Middleware défini correctement

---

### 3.4 Routes d'Authentification

**Fichier** : `src/server/routes/auth.ts`  
**Risque** : Faible (nouvelles routes)  
**Réversible** : Oui (supprimer fichier)

**Validation** :

- ✅ Routes définies : `/register`, `/login`, `/logout`, `/me`
- ✅ Middleware appliqué correctement

---

### 3.5 Intégration dans le Serveur Principal ⚠️ CRITIQUE

**Fichier modifié** : `src/server/index.ts`  
**Risque** : Élevé (point d'entrée principal)  
**Réversible** : Oui (via Git ou backup)

**Actions** :

1. **Backup du fichier actuel** :

   ```bash
   Copy-Item "h:\nod_n8n\src\server\index.ts" "h:\nod_n8n\src\server\index.ts.backup"
   ```

2. **Modifications à apporter** :
   - Ajouter imports auth
   - Ajouter route publique `/api/auth`
   - Protéger toutes les autres routes avec `authMiddleware`
   - Ajouter `tenantMiddleware`

**Validation** :

- ✅ Serveur démarre sans erreur
- ✅ Routes publiques accessibles
- ✅ Routes protégées refusent sans token

---

## Phase 4 : Frontend React (3-4 heures)

### 4.1 Hook useAuth

**Fichier** : `src/web/hooks/useAuth.ts`  
**Risque** : Faible (nouveau fichier)  
**Réversible** : Oui (supprimer fichier)

**Validation** :

- ✅ Context créé
- ✅ AuthProvider défini
- ✅ Hook useAuth exporté

---

### 4.2 Page de Login

**Fichier** : `src/web/pages/LoginPage.tsx`  
**Risque** : Faible (nouveau fichier)  
**Réversible** : Oui (supprimer fichier)

**Validation** :

- ✅ Formulaire Login/Register
- ✅ Gestion d'erreurs
- ✅ Redirection après login

---

### 4.3 Route Guard

**Fichier** : `src/web/components/PrivateRoute.tsx`  
**Risque** : Faible (nouveau fichier)  
**Réversible** : Oui (supprimer fichier)

**Validation** :

- ✅ Redirection vers /login si non authentifié
- ✅ Affichage loader pendant vérification

---

### 4.4 Mise à Jour du Router ⚠️ CRITIQUE

**Fichier modifié** : `src/web/App.tsx`  
**Risque** : Élevé (affecte toute l'app)  
**Réversible** : Oui (via Git ou backup)

**Actions** :

1. **Backup** :

   ```bash
   Copy-Item "h:\nod_n8n\src\web\App.tsx" "h:\nod_n8n\src\web\App.tsx.backup"
   ```

2. **Modifications** :
   - Wrapper avec `<AuthProvider>`
   - Ajouter route `/login`
   - Protéger routes existantes avec `<PrivateRoute>`

**Validation** :

- ✅ App compile
- ✅ Route /login accessible
- ✅ Routes protégées fonctionnent

---

## Phase 5 : Tests & Validation (2-3 heures)

### 5.1 Tests Backend (API)

**Voir** : `04-TESTS.md` pour procédures détaillées

**Tests à réaliser** :

1. ✅ POST /api/auth/register (succès)
2. ✅ POST /api/auth/register (email dupliqué → erreur)
3. ✅ POST /api/auth/login (succès)
4. ✅ POST /api/auth/login (mauvais mot de passe → erreur)
5. ✅ GET /api/auth/me (avec token valide)
6. ✅ GET /api/auth/me (sans token → 401)
7. ✅ POST /api/auth/logout
8. ✅ Multi-tenancy (créer 2 users, vérifier isolation)

---

### 5.2 Tests Frontend (Interface)

**Tests à réaliser** :

1. ✅ Affichage page Login
2. ✅ Inscription nouveau utilisateur
3. ✅ Connexion utilisateur existant
4. ✅ Affichage erreurs (mauvais mot de passe)
5. ✅ Redirection après login
6. ✅ Protection routes (accès sans token → /login)
7. ✅ Déconnexion

---

### 5.3 Tests d'Isolation (Multi-Tenancy)

**Procédure** :

```sql
-- Créer 2 utilisateurs
INSERT INTO public.users (email, password_hash, name) VALUES
  ('user1@test.com', 'hash1', 'User 1'),
  ('user2@test.com', 'hash2', 'User 2');

-- User 1 crée des données
SET search_path TO user_1, public;
INSERT INTO threads (id, owner_id) VALUES (1, 1);

-- User 2 ne doit PAS voir les données de User 1
SET search_path TO user_2, public;
SELECT * FROM threads; -- Doit être vide

-- Cleanup
DELETE FROM public.users WHERE email LIKE '%@test.com';
DROP SCHEMA user_1 CASCADE;
DROP SCHEMA user_2 CASCADE;
```

**Validation** :

- ✅ Isolation complète entre utilisateurs
- ✅ Pas de fuite de données

---

## Phase 6 : Déploiement

### 6.1 Compilation Production

**Actions** :

```bash
cd h:\nod_n8n

# Build complet
pnpm run build

# Vérifier les artefacts
ls dist/
```

**Validation** :

- ✅ Compilation réussie
- ✅ Fichiers générés dans `dist/`

---

### 6.2 Variables d'Environnement

**Fichier** : `.env`

**Vérifier que toutes les variables sont présentes** :

```env
# Serveur
PORT=4310
NODE_ENV=production

# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=<long_random_string>

# Docker
NOD_DATA_ROOT=.local
```

---

### 6.3 Redémarrage du Serveur

**Actions** :

```bash
# Arrêter le serveur actuel (Ctrl+C)

# Démarrer en mode production
pnpm exec tsx src/server/index.ts
```

**Validation** :

- ✅ Serveur démarre sans erreur
- ✅ Login accessible à http://localhost:4310/login
- ✅ Inscription fonctionne
- ✅ Chat accessible après login

---

## 📊 Ordre d'Exécution Optimal

### Ordre Strict (Ne Pas Modifier)

```
1. Préparation (1.1 → 1.4)
   ↓
2. Base de Données (2.1 → 2.3)
   ↓
3. Backend Auth (3.1 → 3.5)
   ↓
4. Frontend React (4.1 → 4.4)
   ↓
5. Tests (5.1 → 5.3)
   ↓
6. Déploiement (6.1 → 6.3)
```

### Dépendances Critiques

| Étape                   | Dépend de                            |
| ----------------------- | ------------------------------------ |
| 2.2 (Migration SQL)     | 1.1 (Backup) ⚠️                      |
| 3.1 (Module Auth)       | 1.2 (NPM packages), 1.4 (JWT_SECRET) |
| 3.5 (Serveur principal) | 3.1, 3.2, 3.3, 3.4                   |
| 4.4 (Router)            | 4.1, 4.2, 4.3                        |
| 5.x (Tests)             | Toutes les phases précédentes        |

---

## ⚠️ Points de Non-Retour

### Après Migration SQL (Phase 2.2)

Une fois la migration committée :

- Tables `users` et `user_sessions` créées
- Trigger de création de schémas actif
- **Rollback possible** via script (voir 05-ROLLBACK.md)

### Après Modification Serveur (Phase 3.5)

Une fois le serveur modifié :

- Toutes les routes protégées par auth
- **Ancienne version inaccessible** sans token
- **Rollback** : Restaurer backup de `index.ts`

---

## 🎯 Critères de Succès

### Minimum Viable (MVP)

- ✅ Inscription d'un utilisateur fonctionne
- ✅ Login/Logout fonctionnent
- ✅ Routes protégées refusent accès sans token
- ✅ Isolation données entre utilisateurs

### Fonctionnel Complet

- ✅ Interface React moderne
- ✅ Gestion d'erreurs complète
- ✅ Tests passent à 100%
- ✅ Performance acceptable (< 200ms par requête)

### Production Ready

- ✅ Variables d'environnement sécurisées
- ✅ Logs configurés
- ✅ Monitoring en place
- ✅ Backup automatique DB

---

## 📝 Notes Importantes

### Ce Qui Reste Identique

- ✅ Architecture Docker (4 conteneurs)
- ✅ n8n workflows
- ✅ Workspace isolation
- ✅ Pi agent capabilities

### Ce Qui Change

- ❌ Ancien accès via token unique (#access=...)
- ❌ Pas de login/logout avant
- ➕ Multi-utilisateurs
- ➕ Authentification JWT
- ➕ Isolation complète données

---

## 🆘 En Cas de Problème

1. **Consulter** : `05-ROLLBACK.md`
2. **Vérifier logs** :
   ```bash
   docker logs nod-postgres-1
   pnpm exec tsx src/server/index.ts
   ```
3. **Tester isolation** :
   ```bash
   curl http://localhost:4310/api/auth/me
   # Doit retourner 401 sans token
   ```
4. **Restaurer backup** si nécessaire

---

**Prêt à exécuter ?** → Suivre `03-CHECKLIST.md` étape par étape 🚀
