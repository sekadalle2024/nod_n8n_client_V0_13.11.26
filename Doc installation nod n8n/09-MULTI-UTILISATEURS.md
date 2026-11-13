# Multi-Utilisateurs dans Nod - Guide Complet

## 🎯 Réponse Directe

### Architecture Actuelle de Nod

D'après `AGENTS.md` :

> **"One thread per owner"** - Une session = un utilisateur

Nod est conçu pour **un utilisateur unique par installation** :

- Un seul compte propriétaire
- Isolation totale entre installations
- Pas de système multi-utilisateurs natif

---

## 📊 État Actuel : Mono-Utilisateur

### Local (Desktop App)

```
Installation Nod Locale
├── 1 utilisateur (propriétaire)
├── 1 workspace Docker
├── 1 base de données PostgreSQL
└── Données isolées par installation
```

**Pas de multi-utilisateurs en local**

### Web (Installation depuis sources)

Même principe :

- 1 installation = 1 utilisateur
- Accessible via `http://localhost:4310/#access=token`
- Le token d'accès est unique

---

## 🔐 Pourquoi Nod est Mono-Utilisateur ?

### Raisons de Conception (d'après AGENTS.md)

1. **Sécurité et Isolation**

   ```
   One thread per owner, shared by web, Telegram and WhatsApp:
   one sandbox workspace keyed by the thread ID
   ```
   - Chaque utilisateur a son propre workspace isolé
   - Pas de risque de fuite de données entre utilisateurs
   - Credentials (Vault) liés à un seul propriétaire

2. **Simplicité**
   - Pas de gestion de permissions (ACL)
   - Pas d'authentification multi-niveaux
   - Pas de conflits de workspace

3. **Coûts AI**
   - Les limites de dépenses sont par installation
   - Tracking des coûts par utilisateur plus simple

---

## ✅ Solutions pour Multi-Utilisateurs

### Solution 1 : Installations Multiples (Recommandé Officiellement)

Créer une **installation séparée de Nod par utilisateur**.

#### Architecture

```
┌─────────────────────────────────────────────────┐
│            Serveur / PC Principal               │
├─────────────────────────────────────────────────┤
│  Installation Utilisateur 1 (Port 4310)         │
│  ├── PostgreSQL (port 54329)                    │
│  ├── Workspace 1                                │
│  └── Browser 1                                  │
├─────────────────────────────────────────────────┤
│  Installation Utilisateur 2 (Port 4311)         │
│  ├── PostgreSQL (port 54330)                    │
│  ├── Workspace 2                                │
│  └── Browser 2                                  │
├─────────────────────────────────────────────────┤
│  Installation Utilisateur 3 (Port 4312)         │
│  ├── PostgreSQL (port 54331)                    │
│  ├── Workspace 3                                │
│  └── Browser 3                                  │
└─────────────────────────────────────────────────┘
```

#### Mise en Œuvre

**Étape 1 : Dupliquer l'Installation**

```powershell
# Sur votre serveur, créer un dossier par utilisateur
mkdir h:\nod_installations
cd h:\nod_installations

# Utilisateur 1
git clone https://github.com/n8n-io/nod.git nod-user1
cd nod-user1
# Installer dépendances...

# Utilisateur 2
git clone https://github.com/n8n-io/nod.git nod-user2
cd nod-user2
# Installer dépendances...
```

**Étape 2 : Configurer des Ports Différents**

**Pour Utilisateur 1** : `nod-user1/.env`

```env
PORT=4310
NOD_HOST=127.0.0.1
NOD_DATA_ROOT=.local-user1
NOD_POSTGRES_PASSWORD=password_user1
DATABASE_URL=postgresql://nod:password_user1@127.0.0.1:54329/nod_user1
```

**Pour Utilisateur 2** : `nod-user2/.env`

```env
PORT=4311
NOD_HOST=127.0.0.1
NOD_DATA_ROOT=.local-user2
NOD_POSTGRES_PASSWORD=password_user2
DATABASE_URL=postgresql://nod:password_user2@127.0.0.1:54330/nod_user2
```

**Étape 3 : Modifier `compose.yaml` pour Chaque Utilisateur**

**nod-user1/compose.yaml** :

```yaml
services:
  postgres:
    ports:
      - '54329:5432' # Port unique
    # ...

  workspace:
    container_name: nod-user1-workspace
    # ...

  browser:
    container_name: nod-user1-browser
    # ...
```

**nod-user2/compose.yaml** :

```yaml
services:
  postgres:
    ports:
      - '54330:5432' # Port différent
    # ...

  workspace:
    container_name: nod-user2-workspace
    # ...

  browser:
    container_name: nod-user2-browser
    # ...
```

**Étape 4 : Démarrer Chaque Installation**

```powershell
# Utilisateur 1
cd h:\nod_installations\nod-user1
docker compose up -d
pnpm exec tsx src/server/index.ts

# Utilisateur 2
cd h:\nod_installations\nod-user2
docker compose up -d
pnpm exec tsx src/server/index.ts
```

**Accès** :

- Utilisateur 1 : `http://localhost:4310/#access=token1`
- Utilisateur 2 : `http://localhost:4311/#access=token2`

#### Avantages ✅

- ✅ Isolation totale (sécurité maximale)
- ✅ Pas de modification du code Nod
- ✅ Chaque utilisateur a son propre workspace
- ✅ Limites de coûts AI par utilisateur

#### Inconvénients ❌

- ❌ Consomme beaucoup de ressources (RAM, CPU)
- ❌ Duplication des données
- ❌ Gestion complexe (3 utilisateurs = 12 conteneurs Docker)
- ❌ Pas de partage de données entre utilisateurs

#### Estimation Ressources

| Utilisateurs | RAM Totale | Conteneurs Docker | Ports Utilisés |
| ------------ | ---------- | ----------------- | -------------- |
| 1            | 4-6 GB     | 4                 | 1 (4310)       |
| 3            | 12-18 GB   | 12                | 3 (4310-4312)  |
| 5            | 20-30 GB   | 20                | 5 (4310-4314)  |
| 10           | 40-60 GB   | 40                | 10 (4310-4319) |

**Non viable au-delà de 3-5 utilisateurs sur une machine standard.**

---

### Solution 2 : Reverse Proxy + Sous-Domaines (Meilleure pour Production)

Utiliser un **reverse proxy** (Nginx, Caddy, Traefik) pour router les utilisateurs.

#### Architecture

```
Internet
  ↓
┌─────────────────────────────────────────┐
│      Reverse Proxy (Nginx/Caddy)       │
│  https://nod.votresociete.com           │
└────┬─────────┬─────────┬────────────────┘
     │         │         │
     ↓         ↓         ↓
┌────────┐ ┌────────┐ ┌────────┐
│ Nod U1 │ │ Nod U2 │ │ Nod U3 │
│ :4310  │ │ :4311  │ │ :4312  │
└────────┘ └────────┘ └────────┘
```

**Routing** :

- `user1.nod.votresociete.com` → Port 4310
- `user2.nod.votresociete.com` → Port 4311
- `user3.nod.votresociete.com` → Port 4312

#### Configuration Nginx

```nginx
# /etc/nginx/sites-available/nod-multiuser

# Utilisateur 1
server {
    listen 80;
    server_name user1.nod.votresociete.com;

    location / {
        proxy_pass http://localhost:4310;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Utilisateur 2
server {
    listen 80;
    server_name user2.nod.votresociete.com;

    location / {
        proxy_pass http://localhost:4311;
        # ... même config
    }
}

# Utilisateur 3
server {
    listen 80;
    server_name user3.nod.votresociete.com;

    location / {
        proxy_pass http://localhost:4312;
        # ... même config
    }
}
```

#### Avantages ✅

- ✅ URLs propres et mémorisables
- ✅ HTTPS centralisé (Let's Encrypt)
- ✅ Gestion des certificats SSL simplifiée

#### Inconvénients ❌

- ❌ Toujours multi-installations (consomme autant de ressources)
- ❌ Configuration réseau supplémentaire

---

### Solution 3 : Base de Données Partagée + API Custom (Développement Requis)

**Modifier Nod** pour ajouter un système d'authentification multi-utilisateurs.

#### Architecture

```
┌──────────────────────────────────────────────────┐
│           Nod Modifié (1 seule instance)         │
│  ┌────────────────────────────────────────────┐  │
│  │  Auth Middleware                           │  │
│  │  ├── Login/Logout                          │  │
│  │  ├── JWT Tokens                            │  │
│  │  └── Session Management                    │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  PostgreSQL avec Multi-Tenancy             │  │
│  │  ├── Schema: user1                         │  │
│  │  ├── Schema: user2                         │  │
│  │  └── Schema: user3                         │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │  Workspace Pool                            │  │
│  │  ├── Workspace isolé par user_id           │  │
│  │  └── Rotation automatique                  │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

#### Modifications Nécessaires

##### 1. Système d'Authentification

**Fichier** : `src/server/auth.ts` (à créer)

```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { db } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Table des utilisateurs
// CREATE TABLE users (
//   id SERIAL PRIMARY KEY,
//   email VARCHAR(255) UNIQUE NOT NULL,
//   password_hash VARCHAR(255) NOT NULL,
//   name VARCHAR(255),
//   role VARCHAR(50) DEFAULT 'user',
//   created_at TIMESTAMP DEFAULT NOW()
// );

export async function register(email: string, password: string, name: string) {
  const passwordHash = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
    [email, passwordHash, name],
  );
  return result.rows[0];
}

export async function login(email: string, password: string) {
  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);

  if (result.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);

  if (!valid) {
    throw new Error('Invalid password');
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

  return { token, user: { id: user.id, email: user.email, name: user.name } };
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    throw new Error('Invalid token');
  }
}

// Middleware Express
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

##### 2. Multi-Tenancy dans PostgreSQL

Utiliser des **schémas PostgreSQL** par utilisateur :

```sql
-- Schéma par utilisateur
CREATE SCHEMA user_1;
CREATE SCHEMA user_2;
CREATE SCHEMA user_3;

-- Chaque schéma a les mêmes tables
-- Exemple pour user_1:
CREATE TABLE user_1.turns (...);
CREATE TABLE user_1.memory (...);
CREATE TABLE user_1.preferences (...);

-- Répéter pour user_2, user_3, etc.
```

**Fonction pour changer de schéma** :

```typescript
export function setUserSchema(userId: number) {
  return db.query(`SET search_path TO user_${userId}, public`);
}

// Dans chaque requête
app.get('/api/chat', authMiddleware, async (req, res) => {
  const { userId } = req.user;

  // Basculer vers le schéma de l'utilisateur
  await setUserSchema(userId);

  // Maintenant toutes les requêtes vont dans user_X
  const messages = await db.query('SELECT * FROM turns WHERE ...');

  res.json(messages.rows);
});
```

##### 3. Isolation des Workspaces

**Modifier** : `src/providers/docker/index.ts`

```typescript
// Créer un workspace par utilisateur avec ID unique
export async function createUserWorkspace(userId: number) {
  const containerName = `nod-workspace-user${userId}`;

  // Créer un conteneur workspace dédié
  await docker.createContainer({
    name: containerName,
    Image: 'nod-workspace:latest',
    Labels: {
      'nod.user_id': userId.toString(),
    },
  });

  return containerName;
}

// Pool de workspaces réutilisables
const workspacePool = new Map<number, string>();

export function getWorkspaceForUser(userId: number) {
  if (!workspacePool.has(userId)) {
    const workspace = createUserWorkspace(userId);
    workspacePool.set(userId, workspace);
  }
  return workspacePool.get(userId);
}
```

##### 4. Routes d'Authentification

**Fichier** : `src/server/routes/auth.ts`

```typescript
import { Router } from 'express';
import { register, login, authMiddleware } from '../auth';

export const authRouter = Router();

// Inscription
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const user = await register(email, password, name);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Connexion
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await login(email, password);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// Profil utilisateur
authRouter.get('/me', authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});
```

##### 5. Interface Login React

**Fichier** : `src/web/pages/login.tsx`

```typescript
import React, { useState } from 'react';
import { api } from '../lib/api';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await api.post('/api/auth/login', { email, password });

      // Sauvegarder le token
      localStorage.setItem('token', response.data.token);

      // Rediriger vers le chat
      window.location.href = '/';
    } catch (err) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <div className="login-page">
      <form onSubmit={handleLogin}>
        <h1>Connexion à Nod</h1>

        {error && <div className="error">{error}</div>}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit">Se connecter</button>
      </form>
    </div>
  );
};
```

#### Avantages ✅

- ✅ **1 seule installation** Nod (économie de ressources)
- ✅ Gestion centralisée
- ✅ Partage possible de données entre utilisateurs (si voulu)
- ✅ UX moderne avec login/logout

#### Inconvénients ❌

- ❌ **Développement custom lourd** (plusieurs semaines)
- ❌ Modification profonde du code Nod
- ❌ Maintenance complexe (fusion avec mises à jour Nod)
- ❌ Risques de sécurité si mal implémenté
- ❌ **Non supporté officiellement** par Nod

---

### Solution 4 : SSO + Proxy Auth (Entreprise)

Utiliser un **Identity Provider** externe (Keycloak, Auth0, Okta).

#### Architecture

```
Users → SSO (Keycloak) → Authenticating Proxy (OAuth2 Proxy) → Nod Instances
```

**Outils** :

- **Keycloak** (gratuit, open-source)
- **OAuth2 Proxy** pour protéger chaque instance Nod
- **Nginx** pour router

**Complexité** : Élevée, réservé aux grandes organisations.

---

## 🎯 Recommandation pour Votre Cas d'Audit

### Scénario : Cabinet d'Audit avec 5-10 Auditeurs

#### Option A : Installations Multiples (Court Terme)

**Pour 3-5 utilisateurs** :

- ✅ Faisable techniquement
- ✅ Rapide à mettre en place
- ✅ Sécurité maximale
- ❌ Ressources élevées (15-25 GB RAM)

**Coût** :

- Serveur 32 GB RAM : ~$100-150/mois

#### Option B : Développement Custom (Long Terme)

**Pour 10+ utilisateurs** :

- ✅ Scalable
- ✅ Meilleure UX
- ✅ Coûts optimisés
- ❌ Développement : 4-8 semaines
- ❌ Maintenance continue

**Coût** :

- Développement : ~$10,000-20,000 (freelance/interne)
- Serveur 16 GB RAM : ~$50-100/mois

---

## 📊 Tableau Comparatif

| Critère                   | Multi-Installations | Reverse Proxy      | Dev Custom    | SSO Enterprise |
| ------------------------- | ------------------- | ------------------ | ------------- | -------------- |
| **Complexité**            | Faible              | Moyenne            | Élevée        | Très élevée    |
| **Temps Setup**           | 1-2 jours           | 2-3 jours          | 4-8 semaines  | 2-4 semaines   |
| **Ressources (10 users)** | 40-60 GB RAM        | 40-60 GB RAM       | 8-16 GB RAM   | 8-16 GB RAM    |
| **Coût Développement**    | 0€                  | 0€                 | 10-20k€       | 5-10k€         |
| **Coût Hébergement/Mois** | 200-400€            | 200-400€           | 50-150€       | 100-200€       |
| **Isolation Données**     | ✅ Totale           | ✅ Totale          | ⚠️ Logique    | ⚠️ Logique     |
| **Partage Données**       | ❌ Impossible       | ❌ Impossible      | ✅ Possible   | ✅ Possible    |
| **Maintenance**           | Facile              | Moyenne            | Difficile     | Difficile      |
| **Scalabilité**           | ❌ Limitée (5 max)  | ❌ Limitée (5 max) | ✅ Excellente | ✅ Excellente  |

---

## ✅ Ma Recommandation Finale

### Phase 1 : Prototype / Petite Équipe (2-5 utilisateurs)

**Utiliser Multi-Installations** :

- Installation séparée par utilisateur
- Ports différents (4310, 4311, 4312...)
- Reverse proxy optionnel pour URLs propres

**Avantages** :

- ✅ Rapide à mettre en place (1-2 jours)
- ✅ Sécurité maximale
- ✅ Pas de modification du code

**Inconvénients** :

- ❌ Pas scalable au-delà de 5 utilisateurs
- ❌ Consomme beaucoup de ressources

### Phase 2 : Production / Croissance (10+ utilisateurs)

**Développer le Multi-Utilisateurs Custom** :

- Système d'authentification (JWT)
- Multi-tenancy PostgreSQL (schémas)
- Pool de workspaces
- Interface login/logout

**Budget** :

- Développement : 4-8 semaines (interne ou freelance)
- Hébergement : VPS 16 GB (~$100/mois)

---

## 📝 Pour Votre Projet d'Audit

**Je recommande de commencer par** :

1. **Court Terme** : Multi-installations
   - 1 installation par auditeur senior
   - Chacun a son environnement isolé
   - Données d'audit dans PostgreSQL partagée (voir doc 07)

2. **Moyen Terme** : Développer le multi-utilisateurs
   - Quand vous avez 5+ utilisateurs
   - Budget développement disponible
   - Besoin de partage de données

3. **Architecture Hybride** (Meilleure Option) :
   - **Nod mono-utilisateur** (interface AI)
   - **Application Audit Custom** (données partagées)
   - Les deux partagent la même PostgreSQL

```
┌─────────────────────────────────────────────┐
│     Application Audit Multi-Utilisateurs    │
│  (React + API Backend custom)               │
│  • Login/Logout                             │
│  • Missions partagées                       │
│  • Constatations collaboratives             │
└─────────────────┬───────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────┐
│         PostgreSQL Partagé                  │
│  • Schema audit (données)                   │
│  • Schema user_X (Nod par utilisateur)      │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┬─────────┐
        ↓                   ↓         ↓
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Nod User 1   │  │ Nod User 2   │  │ Nod User 3   │
│ (AI perso)   │  │ (AI perso)   │  │ (AI perso)   │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Avantages** :

- ✅ Meilleur des deux mondes
- ✅ Collaboration sur les audits
- ✅ AI personnalisée par utilisateur
- ✅ Scalable

---

**Besoin d'aide pour implémenter une de ces solutions ?** 🚀
