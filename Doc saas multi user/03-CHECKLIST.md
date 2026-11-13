# ✅ Checklist de Progression - SaaS Multi-Utilisateurs

Cocher chaque étape au fur et à mesure de l'avancement.

---

## Phase 1 : Préparation (1 heure)

### 1.1 Backup Base de Données ⚠️

- [ ] Créer backup PostgreSQL
- [ ] Vérifier fichier backup créé (taille > 0)
- [ ] Tester restauration backup (optionnel mais recommandé)

**Commandes** :

```bash
docker exec nod-postgres-1 pg_dump -U nod nod > backup-$(date +%Y%m%d-%H%M%S).sql
ls -lh backup-*.sql
```

---

### 1.2 Installer Dépendances NPM

- [ ] Installer `bcrypt`
- [ ] Installer `jsonwebtoken`
- [ ] Installer types TypeScript
- [ ] Vérifier `pnpm install` réussit

**Commandes** :

```bash
cd h:\nod_n8n
pnpm add bcrypt jsonwebtoken
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

---

### 1.3 Créer Arborescence

- [ ] Créer `src/server/auth/`
- [ ] Créer `src/server/db/`
- [ ] Créer `src/server/routes/`
- [ ] Créer `src/web/pages/`
- [ ] Créer `src/web/hooks/`
- [ ] Créer `src/web/components/`
- [ ] Créer `migrations/`

**Commandes** :

```bash
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\auth" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\db" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\server\routes" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\web\pages" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\web\hooks" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\src\web\components" -Force
New-Item -ItemType Directory -Path "h:\nod_n8n\migrations" -Force
```

---

### 1.4 Générer JWT Secret

- [ ] Générer secret aléatoire
- [ ] Ajouter `JWT_SECRET` dans `.env`
- [ ] Vérifier longueur > 64 caractères

**Commandes** :

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copier le résultat dans .env
```

**Ajouter à `.env`** :

```env
JWT_SECRET=<votre_secret_tres_long>
```

---

## Phase 2 : Base de Données (2 heures)

### 2.1 Créer Migration SQL

- [ ] Fichier `migrations/001-multi-user-schema.sql` créé
- [ ] Table `users` définie
- [ ] Table `user_sessions` définie
- [ ] Fonction `create_user_schema()` définie
- [ ] Trigger `create_user_schema_trigger` défini

---

### 2.2 Exécuter Migration ⚠️ CRITIQUE

- [ ] Connexion PostgreSQL réussie
- [ ] BEGIN transaction
- [ ] Copier-coller SQL
- [ ] Vérifier tables créées
- [ ] COMMIT ou ROLLBACK

**Commandes** :

```bash
docker exec -it nod-postgres-1 psql -U nod -d nod
```

**Dans psql** :

```sql
BEGIN;
-- Copier-coller le contenu de migrations/001-multi-user-schema.sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'user_sessions');
COMMIT;
```

---

### 2.3 Tester Création Automatique Schéma

- [ ] Insérer utilisateur test
- [ ] Vérifier schéma `user_X` créé
- [ ] Vérifier tables dans le schéma
- [ ] Nettoyer (DELETE + DROP SCHEMA)

**Commandes SQL** :

```sql
INSERT INTO public.users (email, password_hash, name)
VALUES ('test@example.com', 'dummy', 'Test') RETURNING id;

SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'user_%';
SELECT tablename FROM pg_tables WHERE schemaname = 'user_1';

DELETE FROM public.users WHERE email = 'test@example.com';
DROP SCHEMA IF EXISTS user_1 CASCADE;
```

---

## Phase 3 : Backend Auth (4-6 heures)

### 3.1 Module d'Authentification

- [ ] Fichier `src/server/auth/index.ts` créé
- [ ] Fonction `registerUser()` implémentée
- [ ] Fonction `loginUser()` implémentée
- [ ] Fonction `logoutUser()` implémentée
- [ ] Fonction `verifyToken()` implémentée
- [ ] Fonction `validateSession()` implémentée
- [ ] Compile sans erreur TypeScript

---

### 3.2 Middleware d'Authentification

- [ ] Fichier `src/server/auth/middleware.ts` créé
- [ ] `authMiddleware` implémenté
- [ ] `optionalAuthMiddleware` implémenté (optionnel)
- [ ] `requireRole` implémenté (optionnel)
- [ ] Types Express étendus (`req.user`)
- [ ] Compile sans erreur

---

### 3.3 Multi-Tenancy Database

- [ ] Fichier `src/server/db/multi-tenant.ts` créé
- [ ] Fonction `setUserContext()` implémentée
- [ ] Fonction `resetContext()` implémentée
- [ ] Middleware `tenantMiddleware` implémenté
- [ ] Fonction `withUserContext()` implémentée (optionnel)
- [ ] Compile sans erreur

---

### 3.4 Routes d'Authentification

- [ ] Fichier `src/server/routes/auth.ts` créé
- [ ] Route `POST /api/auth/register` implémentée
- [ ] Route `POST /api/auth/login` implémentée
- [ ] Route `POST /api/auth/logout` implémentée
- [ ] Route `GET /api/auth/me` implémentée
- [ ] Gestion d'erreurs présente
- [ ] Compile sans erreur

---

### 3.5 Intégration Serveur Principal ⚠️ CRITIQUE

- [ ] Backup de `src/server/index.ts` créé
- [ ] Import `authRouter` ajouté
- [ ] Import `authMiddleware` ajouté
- [ ] Import `tenantMiddleware` ajouté
- [ ] Route publique `/api/auth` ajoutée
- [ ] `authMiddleware` appliqué à `/api`
- [ ] `tenantMiddleware` appliqué à `/api`
- [ ] Serveur compile sans erreur
- [ ] Serveur démarre sans erreur

**Backup** :

```bash
Copy-Item "h:\nod_n8n\src\server\index.ts" "h:\nod_n8n\src\server\index.ts.backup"
```

---

## Phase 4 : Frontend React (3-4 heures)

### 4.1 Hook useAuth

- [ ] Fichier `src/web/hooks/useAuth.ts` créé
- [ ] `AuthContext` créé
- [ ] `AuthProvider` implémenté
- [ ] Hook `useAuth` exporté
- [ ] Gestion du token localStorage
- [ ] Compile sans erreur

---

### 4.2 Page de Login

- [ ] Fichier `src/web/pages/LoginPage.tsx` créé
- [ ] Formulaire Login implémenté
- [ ] Formulaire Register implémenté
- [ ] Basculement Login/Register
- [ ] Gestion d'erreurs
- [ ] Redirection après login
- [ ] Compile sans erreur

---

### 4.3 Route Guard

- [ ] Fichier `src/web/components/PrivateRoute.tsx` créé
- [ ] Vérification authentification
- [ ] Redirection vers `/login` si non authentifié
- [ ] Affichage loader pendant vérification
- [ ] Compile sans erreur

---

### 4.4 Mise à Jour Router ⚠️ CRITIQUE

- [ ] Backup de `src/web/App.tsx` créé
- [ ] Import `AuthProvider` ajouté
- [ ] Import `LoginPage` ajouté
- [ ] Import `PrivateRoute` ajouté
- [ ] Wrapper `<AuthProvider>` ajouté
- [ ] Route `/login` ajoutée
- [ ] Routes existantes protégées avec `<PrivateRoute>`
- [ ] Compile sans erreur

**Backup** :

```bash
Copy-Item "h:\nod_n8n\src\web\App.tsx" "h:\nod_n8n\src\web\App.tsx.backup"
```

---

## Phase 5 : Tests (2-3 heures)

### 5.1 Tests Backend (API)

- [ ] Register avec email valide → 201 + token
- [ ] Register avec email existant → 400
- [ ] Login avec bon mot de passe → 200 + token
- [ ] Login avec mauvais mot de passe → 401
- [ ] GET /api/auth/me avec token valide → 200
- [ ] GET /api/auth/me sans token → 401
- [ ] Logout → 200
- [ ] Route protégée sans token → 401

**Voir** : `04-TESTS.md` pour commandes détaillées

---

### 5.2 Tests Frontend (Interface)

- [ ] Page `/login` accessible
- [ ] Inscription nouveau utilisateur fonctionne
- [ ] Connexion fonctionne
- [ ] Erreurs affichées (mauvais mot de passe)
- [ ] Redirection après login vers `/`
- [ ] Routes protégées redirigent vers `/login`
- [ ] Déconnexion fonctionne

---

### 5.3 Tests Multi-Tenancy (Isolation)

- [ ] Créer 2 utilisateurs
- [ ] User 1 crée des données
- [ ] User 2 ne voit PAS les données de User 1
- [ ] Cleanup réussi

**Commandes SQL** :

```sql
-- Voir 04-TESTS.md section Multi-Tenancy
```

---

## Phase 6 : Déploiement

### 6.1 Compilation Production

- [ ] `pnpm run build` réussit
- [ ] Fichiers générés dans `dist/`
- [ ] Pas d'erreurs TypeScript
- [ ] Pas d'avertissements critiques

---

### 6.2 Variables d'Environnement

- [ ] `.env` contient `JWT_SECRET`
- [ ] `.env` contient `DATABASE_URL`
- [ ] `.env` contient `PORT`
- [ ] `.env` ne contient pas de valeurs par défaut

---

### 6.3 Démarrage Serveur

- [ ] Serveur démarre sans erreur
- [ ] Page `/login` accessible
- [ ] Inscription fonctionne
- [ ] Connexion fonctionne
- [ ] Chat accessible après login

**Commandes** :

```bash
pnpm exec tsx src/server/index.ts
```

---

## 📊 Progression Globale

- [ ] Phase 1 : Préparation (4/4 étapes)
- [ ] Phase 2 : Base de Données (3/3 étapes)
- [ ] Phase 3 : Backend Auth (5/5 étapes)
- [ ] Phase 4 : Frontend React (4/4 étapes)
- [ ] Phase 5 : Tests (3/3 sections)
- [ ] Phase 6 : Déploiement (3/3 étapes)

**Total** : 0/22 étapes principales

---

## 🎯 Statut Final

- [ ] ✅ **Projet Complet** : Toutes les étapes cochées
- [ ] ✅ **Tests Passés** : 100% de réussite
- [ ] ✅ **Production Ready** : Déployé et fonctionnel

---

**Date de début** : __________  
**Date de fin** : __________  
**Durée totale** : __________ heures
