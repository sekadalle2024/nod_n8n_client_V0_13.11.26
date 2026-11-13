# 🏗️ Architecture Technique - SaaS Multi-Utilisateurs

## Vue d'Ensemble

Ce document détaille l'architecture technique complète du système multi-utilisateurs.

---

## 🎨 Architecture Globale

```
┌──────────────────────────────────────────────────────────────┐
│                     Navigateur Client                         │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              React Application                          │  │
│  │  • LoginPage (email/password)                          │  │
│  │  • AuthProvider (context global)                       │  │
│  │  • PrivateRoute (protection routes)                    │  │
│  │  • ChatPage, AuditPage (protégées)                     │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↕ HTTP + JWT                         │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                    Serveur Node.js/Express                    │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           Routes Publiques (sans auth)                 │  │
│  │  POST /api/auth/register                               │  │
│  │  POST /api/auth/login                                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                             ↓                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Middleware d'Authentification                  │  │
│  │  • Vérifier JWT token                                  │  │
│  │  • Valider session en base                             │  │
│  │  • Charger user dans req.user                          │  │
│  └────────────────────────────────────────────────────────┘  │
│                             ↓                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Middleware Multi-Tenant                        │  │
│  │  SET search_path TO user_{id}, public                  │  │
│  └────────────────────────────────────────────────────────┘  │
│                             ↓                                 │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Routes Protégées (avec auth)                   │  │
│  │  GET  /api/auth/me                                     │  │
│  │  POST /api/auth/logout                                 │  │
│  │  GET  /api/chat/*                                      │  │
│  │  POST /api/audit/*                                     │  │
│  │  ...                                                   │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL Multi-Tenant Database                 │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Schema: public (données communes)              │  │
│  │  • users (id, email, password_hash, ...)               │  │
│  │  • user_sessions (token_hash, expires_at, ...)         │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Schema: user_1 (données utilisateur 1)         │  │
│  │  • threads, turns, memory, preferences                 │  │
│  │  • vault (credentials)                                 │  │
│  │  • audit_missions, audit_findings                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Schema: user_2 (données utilisateur 2)         │  │
│  │  • threads, turns, memory, preferences                 │  │
│  │  • vault (credentials)                                 │  │
│  │  • audit_missions, audit_findings                      │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         Schema: user_N (...)                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│                    Workspace Pool Docker                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Workspace 1 │  │  Workspace 2 │  │  Workspace N │       │
│  │  (user_id: 1)│  │  (user_id: 2)│  │  (user_id: N)│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  • Création dynamique                                        │
│  • Rotation automatique (LRU)                                │
│  • Cleanup après 30 min inactivité                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 Flux d'Authentification

### 1. Inscription (Register)

```
Client                    Serveur                  PostgreSQL
  │                         │                          │
  │  POST /api/auth/register                          │
  │  {email, password, name}                           │
  ├────────────────────────>│                          │
  │                         │                          │
  │                         │  Valider email unique    │
  │                         ├─────────────────────────>│
  │                         │<─────────────────────────┤
  │                         │  OK ou Erreur            │
  │                         │                          │
  │                         │  Hasher password (bcrypt)│
  │                         │                          │
  │                         │  INSERT INTO users       │
  │                         ├─────────────────────────>│
  │                         │                          │
  │                         │  ← TRIGGER              │
  │                         │  CREATE SCHEMA user_X    │
  │                         │  CREATE TABLES...        │
  │                         │                          │
  │                         │<─────────────────────────┤
  │                         │  user_id: 1              │
  │                         │                          │
  │                         │  Générer JWT token       │
  │                         │                          │
  │                         │  INSERT INTO user_sessions
  │                         ├─────────────────────────>│
  │                         │                          │
  │<────────────────────────┤                          │
  │  {user, token}          │                          │
  │                         │                          │
  │  Sauvegarder token      │                          │
  │  localStorage           │                          │
  │                         │                          │
```

### 2. Connexion (Login)

```
Client                    Serveur                  PostgreSQL
  │                         │                          │
  │  POST /api/auth/login   │                          │
  │  {email, password}      │                          │
  ├────────────────────────>│                          │
  │                         │                          │
  │                         │  SELECT * FROM users     │
  │                         │  WHERE email = $1        │
  │                         ├─────────────────────────>│
  │                         │<─────────────────────────┤
  │                         │  User data               │
  │                         │                          │
  │                         │  Vérifier mot de passe   │
  │                         │  bcrypt.compare()        │
  │                         │                          │
  │                         │  Si OK:                  │
  │                         │  Générer nouveau JWT     │
  │                         │                          │
  │                         │  INSERT INTO user_sessions
  │                         ├─────────────────────────>│
  │                         │                          │
  │                         │  UPDATE last_login       │
  │                         ├─────────────────────────>│
  │                         │                          │
  │<────────────────────────┤                          │
  │  {user, token}          │                          │
  │                         │                          │
```

### 3. Requête Protégée

```
Client                    Serveur                  PostgreSQL
  │                         │                          │
  │  GET /api/chat          │                          │
  │  Authorization: Bearer {token}                     │
  ├────────────────────────>│                          │
  │                         │                          │
  │                         │  authMiddleware()        │
  │                         │  • Extraire token        │
  │                         │  • Vérifier JWT (jwt.verify)
  │                         │  • Hash token            │
  │                         │                          │
  │                         │  SELECT FROM user_sessions
  │                         │  WHERE token_hash = $1   │
  │                         │  AND expires_at > NOW()  │
  │                         ├─────────────────────────>│
  │                         │<─────────────────────────┤
  │                         │  Session valide          │
  │                         │                          │
  │                         │  SELECT FROM users       │
  │                         │  WHERE id = $1           │
  │                         ├─────────────────────────>│
  │                         │<─────────────────────────┤
  │                         │  User actif              │
  │                         │                          │
  │                         │  req.user = {userId, email, role}
  │                         │                          │
  │                         │  tenantMiddleware()      │
  │                         │  SET search_path TO user_1, public
  │                         ├─────────────────────────>│
  │                         │                          │
  │                         │  SELECT FROM threads     │
  │                         │  (dans user_1 schema)    │
  │                         ├─────────────────────────>│
  │                         │<─────────────────────────┤
  │                         │  Données user_1          │
  │                         │                          │
  │<────────────────────────┤                          │
  │  {data}                 │                          │
  │                         │                          │
```

---

## 🗄️ Schéma PostgreSQL Multi-Tenant

### Schema `public` (Commun)

```sql
CREATE TABLE public.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user',
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Schema `user_{id}` (Par Utilisateur)

Chaque utilisateur obtient automatiquement :

```sql
CREATE SCHEMA user_1;

-- Tables Nod existantes (copiées)
CREATE TABLE user_1.threads AS TABLE public.threads WITH NO DATA;
CREATE TABLE user_1.turns AS TABLE public.turns WITH NO DATA;
CREATE TABLE user_1.memory AS TABLE public.memory WITH NO DATA;
CREATE TABLE user_1.preferences AS TABLE public.preferences WITH NO DATA;
CREATE TABLE user_1.vault AS TABLE public.vault WITH NO DATA;

-- Tables audit custom
CREATE TABLE user_1.audit_missions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  client VARCHAR(255),
  status VARCHAR(50) DEFAULT 'draft',
  start_date DATE,
  end_date DATE,
  created_by INTEGER REFERENCES public.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_1.audit_findings (
  id SERIAL PRIMARY KEY,
  mission_id INTEGER REFERENCES user_1.audit_missions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  severity VARCHAR(50),
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Mécanisme de Création Automatique

**Trigger PostgreSQL** qui s'exécute à chaque `INSERT` dans `users` :

```sql
CREATE OR REPLACE FUNCTION create_user_schema()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer le schéma
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS user_%s', NEW.id);

  -- Copier les tables nécessaires
  EXECUTE format('CREATE TABLE user_%s.threads AS TABLE threads WITH NO DATA', NEW.id);
  EXECUTE format('CREATE TABLE user_%s.turns AS TABLE turns WITH NO DATA', NEW.id);
  -- ... etc

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_user_schema_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_user_schema();
```

---

## 🔄 Context Switching (Multi-Tenancy)

### Principe

Chaque requête bascule automatiquement vers le schéma de l'utilisateur authentifié via `SET search_path`.

### Implémentation

**Fichier** : `src/server/db/multi-tenant.ts`

```typescript
export async function setUserContext(userId: number): Promise<void> {
  await db.query(`SET search_path TO user_${userId}, public`);
}
```

**Middleware Express** :

```typescript
export function tenantMiddleware(req, res, next) {
  if (req.user && req.user.userId) {
    setUserContext(req.user.userId)
      .then(() => next())
      .catch((error) => res.status(500).json({ error }));
  } else {
    next();
  }
}
```

### Ordre des Middleware

```typescript
app.use('/api/auth', authRouter); // Routes publiques

app.use('/api', authMiddleware); // 1. Vérifier auth
app.use('/api', tenantMiddleware); // 2. Basculer schéma

app.use('/api/chat', chatRouter); // Routes protégées
app.use('/api/audit', auditRouter);
```

### Résolution de Tables

```sql
-- Avant middleware
SELECT * FROM threads;
-- → Cherche dans search_path actuel (probablement 'public')

-- Après middleware (user_id = 5)
SET search_path TO user_5, public;
SELECT * FROM threads;
-- → Cherche d'abord dans user_5.threads
-- → Si pas trouvé, cherche dans public.threads
```

---

## 🔐 Sécurité JWT

### Structure du Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": 123,
    "email": "user@example.com",
    "role": "user",
    "iat": 1699564800,
    "exp": 1700169600
  },
  "signature": "..."
}
```

### Durée de Vie

- **Token JWT** : 7 jours (défini dans `JWT_EXPIRES_IN`)
- **Session DB** : 7 jours (colonne `expires_at`)

### Stockage

- **Client** : `localStorage.setItem('auth_token', token)`
- **Serveur** : Token hashé (SHA256) dans `user_sessions.token_hash`

### Vérification Double

1. **JWT valide** (signature, expiration)
2. **Session existe en base** (pas révoquée)

```typescript
const payload = jwt.verify(token, JWT_SECRET); // 1. Vérif JWT
const sessionValid = await validateSession(token); // 2. Vérif DB
```

### Révocation

```typescript
// Logout = suppression de la session
await db.query('DELETE FROM user_sessions WHERE token_hash = $1', [hashToken(token)]);
```

---

## 🐳 Workspace Pool

### Principe

Au lieu de créer 1 workspace par utilisateur en permanence, on utilise un **pool dynamique** :

- Maximum N workspaces simultanés (ex: 10)
- Création à la demande
- Rotation LRU (Least Recently Used)
- Cleanup automatique après inactivité

### Algorithme

```typescript
function getWorkspaceForUser(userId) {
  // 1. Utilisateur a déjà un workspace ?
  if (workspacePool.has(userId)) {
    return workspacePool.get(userId);
  }

  // 2. Pool plein ?
  if (workspacePool.size >= MAX_WORKSPACES) {
    // Supprimer le workspace le plus ancien inutilisé
    cleanupOldWorkspaces();
  }

  // 3. Créer nouveau workspace
  const containerId = await createWorkspaceContainer(userId);

  workspacePool.set(userId, {
    containerId,
    userId,
    lastUsed: new Date(),
    inUse: true,
  });

  return containerId;
}
```

### Cleanup Automatique

```typescript
// Toutes les 10 minutes
setInterval(
  () => {
    cleanupIdleWorkspaces(30); // 30 min d'inactivité
  },
  10 * 60 * 1000,
);
```

---

## 📊 Performance & Scalabilité

### Ressources par Utilisateur

| Ressource             | Consommation   | Notes                 |
| --------------------- | -------------- | --------------------- |
| **PostgreSQL**        | ~5-10 MB       | Schéma + tables vides |
| **Workspace (actif)** | ~500 MB - 1 GB | Conteneur Docker      |
| **Session RAM**       | ~1-5 MB        | En mémoire serveur    |

### Estimation Totale

| Utilisateurs | RAM Totale | Workspaces Simultanés |
| ------------ | ---------- | --------------------- |
| 10           | 8-16 GB    | 5-10                  |
| 50           | 16-32 GB   | 10-20                 |
| 100          | 32-64 GB   | 20-30                 |

### Optimisations Possibles

1. **Connection Pooling** PostgreSQL (pgBouncer)
2. **Redis** pour sessions (au lieu de PostgreSQL)
3. **CDN** pour assets statiques
4. **Horizontal Scaling** (plusieurs serveurs Nod)

---

## 🔍 Monitoring

### Métriques Clés

1. **Authentification** :
   - Taux d'inscription (users/jour)
   - Taux de connexion réussie
   - Tokens expirés
   - Sessions actives

2. **Performance** :
   - Temps réponse API
   - Requêtes SQL par endpoint
   - Context switch time

3. **Ressources** :
   - Workspaces actifs
   - RAM utilisée
   - Connexions PostgreSQL

### Logs Importants

```typescript
// À loguer
console.log('User registered:', { userId, email });
console.log('User logged in:', { userId, email, ipAddress });
console.log('Workspace created:', { userId, containerId });
console.log('Schema switched:', { userId, schema: `user_${userId}` });
```

---

## 🛡️ Sécurité

### Mesures Implémentées

1. **Passwords** :
   - ✅ Hashés avec bcrypt (salt rounds: 12)
   - ✅ Jamais stockés en clair
   - ✅ Minimum 8 caractères

2. **Tokens** :
   - ✅ JWT signés (HS256)
   - ✅ Expiration 7 jours
   - ✅ Révocables (via DB)

3. **Isolation** :
   - ✅ Schémas PostgreSQL séparés
   - ✅ Workspaces Docker isolés
   - ✅ Pas de partage de données entre users

4. **API** :
   - ✅ Routes protégées par auth
   - ✅ Validation des entrées
   - ✅ Gestion d'erreurs sans leak d'info

### Améliorations Futures

- [ ] Rate limiting par utilisateur
- [ ] 2FA (authentification à 2 facteurs)
- [ ] Vérification email obligatoire
- [ ] Audit logs (qui a fait quoi)
- [ ] HTTPS obligatoire en production
- [ ] CORS configuration stricte

---

**Cette architecture est scalable, sécurisée et maintenant documentée ! 🚀**
