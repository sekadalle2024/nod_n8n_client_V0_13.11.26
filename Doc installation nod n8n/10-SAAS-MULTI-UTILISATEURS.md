# Transformer Nod en SaaS Multi-Utilisateurs

## 🎯 Objectif

**1 seule installation Nod** qui gère **plusieurs utilisateurs** de manière isolée et sécurisée.

---

## 📋 Plan de Développement Complet

### Vue d'Ensemble de l'Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nod SaaS                             │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │         Système d'Authentification               │  │
│  │  • Registration / Login / Logout                 │  │
│  │  • JWT Tokens                                    │  │
│  │  • Session Management                            │  │
│  │  • Password Reset                                │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │      PostgreSQL Multi-Tenant Database            │  │
│  │                                                  │  │
│  │  public (tables communes)                        │  │
│  │  ├── users                                       │  │
│  │  ├── subscriptions                               │  │
│  │  └── billing                                     │  │
│  │                                                  │  │
│  │  user_1 (données utilisateur 1)                  │  │
│  │  ├── threads, turns, memory                     │  │
│  │  ├── preferences, vault                         │  │
│  │  └── audit (missions, findings...)              │  │
│  │                                                  │  │
│  │  user_2 (données utilisateur 2)                  │  │
│  │  ├── threads, turns, memory                     │  │
│  │  └── audit                                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │      Workspace Pool (Conteneurs Partagés)        │  │
│  │  • Isolation par user_id                         │  │
│  │  • Rotation automatique                          │  │
│  │  • Cleanup après usage                           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │          API Routes Modifiées                    │  │
│  │  • Toutes les routes protégées par auth         │  │
│  │  • Context switching automatique (user_id)       │  │
│  │  • Rate limiting par utilisateur                 │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📝 Étape 1 : Système d'Authentification

### 1.1 Créer la Table `users`

**Fichier** : `migrations/001-users-table.sql`

```sql
-- Table principale des utilisateurs
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'user', -- 'user', 'admin', 'auditor'
  subscription_tier VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  is_active BOOLEAN DEFAULT TRUE,
  email_verified BOOLEAN DEFAULT FALSE,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_sessions_token ON public.user_sessions(token_hash);
CREATE INDEX idx_sessions_user ON public.user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON public.user_sessions(expires_at);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fonction pour créer un schéma utilisateur automatiquement
CREATE OR REPLACE FUNCTION create_user_schema()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer un schéma pour ce nouvel utilisateur
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS user_%s', NEW.id);

  -- Copier toutes les tables nécessaires dans ce schéma
  -- (threads, turns, memory, preferences, vault, etc.)
  EXECUTE format('
    CREATE TABLE user_%s.threads AS
    TABLE threads WITH NO DATA
  ', NEW.id);

  EXECUTE format('
    CREATE TABLE user_%s.turns AS
    TABLE turns WITH NO DATA
  ', NEW.id);

  EXECUTE format('
    CREATE TABLE user_%s.memory AS
    TABLE memory WITH NO DATA
  ', NEW.id);

  EXECUTE format('
    CREATE TABLE user_%s.preferences AS
    TABLE preferences WITH NO DATA
  ', NEW.id);

  EXECUTE format('
    CREATE TABLE user_%s.vault AS
    TABLE vault WITH NO DATA
  ', NEW.id);

  -- Schéma audit (missions, findings, etc.)
  EXECUTE format('
    CREATE TABLE user_%s.audit_missions (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      client VARCHAR(255),
      status VARCHAR(50) DEFAULT ''draft'',
      start_date DATE,
      end_date DATE,
      created_by INTEGER REFERENCES public.users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  ', NEW.id);

  EXECUTE format('
    CREATE TABLE user_%s.audit_findings (
      id SERIAL PRIMARY KEY,
      mission_id INTEGER REFERENCES user_%s.audit_missions(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      severity VARCHAR(50),
      status VARCHAR(50) DEFAULT ''open'',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  ', NEW.id, NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour créer automatiquement le schéma d'un nouvel utilisateur
CREATE TRIGGER create_user_schema_trigger
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION create_user_schema();
```

### 1.2 Module d'Authentification

**Fichier** : `src/server/auth/index.ts`

```typescript
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
  is_active: boolean;
  email_verified: boolean;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

/**
 * Inscription d'un nouvel utilisateur
 */
export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ user: User; token: string }> {
  // Validation
  if (!email || !password || password.length < 8) {
    throw new Error('Email requis et mot de passe minimum 8 caractères');
  }

  // Vérifier si l'email existe déjà
  const existing = await db.query('SELECT id FROM public.users WHERE email = $1', [
    email.toLowerCase(),
  ]);

  if (existing.rows.length > 0) {
    throw new Error('Cet email est déjà utilisé');
  }

  // Hasher le mot de passe
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Générer un token de vérification
  const verificationToken = crypto.randomBytes(32).toString('hex');

  // Créer l'utilisateur
  const result = await db.query(
    `INSERT INTO public.users (email, password_hash, name, verification_token)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, name, role, subscription_tier, is_active, email_verified`,
    [email.toLowerCase(), passwordHash, name, verificationToken],
  );

  const user = result.rows[0];

  // Générer un JWT
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Enregistrer la session
  await createSession(user.id, token);

  // TODO: Envoyer email de vérification avec verificationToken

  return { user, token };
}

/**
 * Connexion d'un utilisateur
 */
export async function loginUser(
  email: string,
  password: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<{ user: User; token: string }> {
  // Récupérer l'utilisateur
  const result = await db.query('SELECT * FROM public.users WHERE email = $1', [
    email.toLowerCase(),
  ]);

  if (result.rows.length === 0) {
    throw new Error('Email ou mot de passe incorrect');
  }

  const user = result.rows[0];

  // Vérifier le compte actif
  if (!user.is_active) {
    throw new Error('Votre compte a été désactivé');
  }

  // Vérifier le mot de passe
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    throw new Error('Email ou mot de passe incorrect');
  }

  // Générer un nouveau token
  const token = generateToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  // Enregistrer la session
  await createSession(user.id, token, ipAddress, userAgent);

  // Mettre à jour last_login
  await db.query('UPDATE public.users SET last_login = NOW() WHERE id = $1', [user.id]);

  // Retourner les données publiques
  const publicUser: User = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    subscription_tier: user.subscription_tier,
    is_active: user.is_active,
    email_verified: user.email_verified,
  };

  return { user: publicUser, token };
}

/**
 * Déconnexion (invalider le token)
 */
export async function logoutUser(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.query('DELETE FROM public.user_sessions WHERE token_hash = $1', [tokenHash]);
}

/**
 * Vérifier un token JWT
 */
export function verifyToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
}

/**
 * Générer un token JWT
 */
function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Créer une session en base
 */
async function createSession(
  userId: number,
  token: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 jours

  await db.query(
    `INSERT INTO public.user_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, tokenHash, expiresAt, ipAddress, userAgent],
  );
}

/**
 * Vérifier qu'une session existe et est valide
 */
export async function validateSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const result = await db.query(
    `SELECT id FROM public.user_sessions 
     WHERE token_hash = $1 AND expires_at > NOW()`,
    [tokenHash],
  );
  return result.rows.length > 0;
}

/**
 * Hasher un token pour le stocker
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Récupérer un utilisateur par ID
 */
export async function getUserById(userId: number): Promise<User | null> {
  const result = await db.query(
    `SELECT id, email, name, role, subscription_tier, is_active, email_verified
     FROM public.users WHERE id = $1`,
    [userId],
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Nettoyer les sessions expirées (à appeler périodiquement)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  await db.query('DELETE FROM public.user_sessions WHERE expires_at < NOW()');
}
```

### 1.3 Middleware d'Authentification

**Fichier** : `src/server/auth/middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyToken, validateSession, getUserById } from './index';

// Étendre le type Request pour inclure user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: number;
        email: string;
        role: string;
      };
    }
  }
}

/**
 * Middleware pour protéger les routes
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Récupérer le token depuis le header Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: "Token d'authentification manquant" });
      return;
    }

    const token = authHeader.substring(7);

    // Vérifier le JWT
    const payload = verifyToken(token);

    // Vérifier que la session existe en base
    const sessionValid = await validateSession(token);

    if (!sessionValid) {
      res.status(401).json({ error: 'Session expirée ou invalide' });
      return;
    }

    // Vérifier que l'utilisateur existe et est actif
    const user = await getUserById(payload.userId);

    if (!user || !user.is_active) {
      res.status(401).json({ error: 'Utilisateur introuvable ou inactif' });
      return;
    }

    // Ajouter les infos user à la requête
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentification échouée' });
  }
}

/**
 * Middleware optionnel (ne bloque pas si pas de token)
 */
export async function optionalAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyToken(token);
      const sessionValid = await validateSession(token);

      if (sessionValid) {
        req.user = {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        };
      }
    }

    next();
  } catch (error) {
    // Ignorer les erreurs, continuer sans user
    next();
  }
}

/**
 * Middleware pour vérifier un rôle spécifique
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Permissions insuffisantes' });
      return;
    }

    next();
  };
}
```

---

## 🗄️ Étape 2 : Multi-Tenancy PostgreSQL

### 2.1 Context Switching Automatique

**Fichier** : `src/server/db/multi-tenant.ts`

```typescript
import { db } from './index';

/**
 * Basculer vers le schéma d'un utilisateur
 * Toutes les requêtes suivantes utiliseront ce schéma
 */
export async function setUserContext(userId: number): Promise<void> {
  await db.query(`SET search_path TO user_${userId}, public`);
}

/**
 * Réinitialiser vers le schéma public
 */
export async function resetContext(): Promise<void> {
  await db.query('SET search_path TO public');
}

/**
 * Middleware Express pour basculer automatiquement le schéma
 */
export function tenantMiddleware(req: any, res: any, next: any): void {
  if (req.user && req.user.userId) {
    setUserContext(req.user.userId)
      .then(() => next())
      .catch((error) => {
        console.error('Tenant middleware error:', error);
        res.status(500).json({ error: 'Erreur de contexte utilisateur' });
      });
  } else {
    next();
  }
}

/**
 * Wrapper pour exécuter une requête dans le contexte d'un utilisateur
 */
export async function withUserContext<T>(userId: number, callback: () => Promise<T>): Promise<T> {
  await setUserContext(userId);
  try {
    return await callback();
  } finally {
    await resetContext();
  }
}
```

---

## 🌐 Étape 3 : Routes d'Authentification

**Fichier** : `src/server/routes/auth.ts`

```typescript
import { Router } from 'express';
import { registerUser, loginUser, logoutUser, getUserById } from '../auth';
import { authMiddleware } from '../auth/middleware';

export const authRouter = Router();

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        error: 'Email, mot de passe et nom requis',
      });
    }

    const result = await registerUser(email, password, name);

    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({
      success: false,
      error: error.message || "Erreur lors de l'inscription",
    });
  }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis',
      });
    }

    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];

    const result = await loginUser(email, password, ipAddress, userAgent);

    res.json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Erreur lors de la connexion',
    });
  }
});

/**
 * POST /api/auth/logout
 * Déconnexion (invalider le token)
 */
authRouter.post('/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.substring(7);

    if (token) {
      await logoutUser(token);
    }

    res.json({ success: true, message: 'Déconnexion réussie' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la déconnexion',
    });
  }
});

/**
 * GET /api/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
authRouter.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur introuvable',
      });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération du profil',
    });
  }
});
```

---

## 🔌 Étape 4 : Intégration dans le Serveur Principal

**Fichier** : `src/server/index.ts` (modifications)

```typescript
import express from 'express';
import { authRouter } from './routes/auth';
import { authMiddleware } from './auth/middleware';
import { tenantMiddleware } from './db/multi-tenant';

const app = express();

app.use(express.json());

// Routes publiques (pas d'auth)
app.use('/api/auth', authRouter);

// TOUTES les autres routes doivent être protégées
app.use('/api', authMiddleware); // ← Protéger toutes les routes API
app.use('/api', tenantMiddleware); // ← Basculer automatiquement le schéma

// Vos routes existantes (maintenant protégées)
app.use('/api/chat', chatRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/audit', auditRouter); // Vos routes audit

// Route pour servir l'app React (avec auth check côté client)
app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'dist/web' });
});

const PORT = process.env.PORT || 4310;
app.listen(PORT, () => {
  console.log(`Nod SaaS running on http://localhost:${PORT}`);
});
```

---

## 🎨 Étape 5 : Interface Utilisateur (React)

### 5.1 Page de Login

**Fichier** : `src/web/pages/LoginPage.tsx`

```typescript
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const payload = isLogin
        ? { email, password }
        : { email, password, name };

      const response = await api.post(endpoint, payload);

      if (response.data.success) {
        // Sauvegarder le token
        localStorage.setItem('auth_token', response.data.token);

        // Configurer le header pour les futures requêtes
        api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;

        // Rediriger vers le chat
        navigate('/');
      }
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
        'Une erreur est survenue'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            {isLogin ? 'Connexion à Nod' : 'Créer un compte'}
          </h2>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {!isLogin && (
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nom complet
              </label>
              <input
                id="name"
                type="text"
                required={!isLogin}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!isLogin && (
              <p className="mt-1 text-sm text-gray-500">
                Minimum 8 caractères
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-50"
          >
            {loading ? 'Chargement...' : isLogin ? 'Se connecter' : 'S\'inscrire'}
          </button>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-500"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
            >
              {isLogin
                ? 'Pas encore de compte ? S\'inscrire'
                : 'Déjà un compte ? Se connecter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

### 5.2 Hook d'Authentification

**Fichier** : `src/web/hooks/useAuth.ts`

```typescript
import { useState, useEffect, createContext, useContext } from 'react';
import { api } from '../lib/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  subscription_tier: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Charger l'utilisateur au démarrage
    const token = localStorage.getItem('auth_token');

    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      api.get('/api/auth/me')
        .then((response) => {
          if (response.data.success) {
            setUser(response.data.user);
          }
        })
        .catch(() => {
          // Token invalide
          localStorage.removeItem('auth_token');
          delete api.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });

    if (response.data.success) {
      localStorage.setItem('auth_token', response.data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      setUser(response.data.user);
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      localStorage.removeItem('auth_token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

### 5.3 Route Guard

**Fichier** : `src/web/components/PrivateRoute.tsx`

```typescript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
```

### 5.4 Router Mise à Jour

**Fichier** : `src/web/App.tsx`

```typescript
import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { PrivateRoute } from './components/PrivateRoute';
import { ChatPage } from './pages/ChatPage';
import { AuditPage } from './pages/AuditPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Routes publiques */}
          <Route path="/login" element={<LoginPage />} />

          {/* Routes privées (protégées) */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <ChatPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/audit"
            element={
              <PrivateRoute>
                <AuditPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
```

---

## 🐳 Étape 6 : Workspace Pool (Conteneurs Partagés)

### 6.1 Gestion des Workspaces

**Fichier** : `src/server/workspace-pool.ts`

```typescript
import { Docker } from 'dockerode';

const docker = new Docker();

interface WorkspaceInfo {
  containerId: string;
  userId: number;
  lastUsed: Date;
  inUse: boolean;
}

// Pool de workspaces actifs
const workspacePool = new Map<number, WorkspaceInfo>();

// Limite de workspaces simultanés
const MAX_WORKSPACES = 10;

/**
 * Obtenir ou créer un workspace pour un utilisateur
 */
export async function getWorkspaceForUser(userId: number): Promise<string> {
  // Vérifier si l'utilisateur a déjà un workspace
  if (workspacePool.has(userId)) {
    const workspace = workspacePool.get(userId)!;
    workspace.lastUsed = new Date();
    workspace.inUse = true;
    return workspace.containerId;
  }

  // Si le pool est plein, nettoyer les plus anciens inutilisés
  if (workspacePool.size >= MAX_WORKSPACES) {
    await cleanupOldWorkspaces();
  }

  // Créer un nouveau workspace
  const containerId = await createWorkspaceContainer(userId);

  workspacePool.set(userId, {
    containerId,
    userId,
    lastUsed: new Date(),
    inUse: true,
  });

  return containerId;
}

/**
 * Créer un nouveau conteneur workspace
 */
async function createWorkspaceContainer(userId: number): Promise<string> {
  const container = await docker.createContainer({
    name: `nod-workspace-user${userId}-${Date.now()}`,
    Image: 'nod-workspace:latest',
    Labels: {
      'nod.user_id': userId.toString(),
      'nod.type': 'workspace',
    },
    Env: [`USER_ID=${userId}`],
  });

  await container.start();

  return container.id;
}

/**
 * Libérer un workspace (marquer comme non utilisé)
 */
export function releaseWorkspace(userId: number): void {
  const workspace = workspacePool.get(userId);
  if (workspace) {
    workspace.inUse = false;
    workspace.lastUsed = new Date();
  }
}

/**
 * Nettoyer les workspaces les plus anciens inutilisés
 */
async function cleanupOldWorkspaces(): Promise<void> {
  const unused = Array.from(workspacePool.entries())
    .filter(([_, info]) => !info.inUse)
    .sort((a, b) => a[1].lastUsed.getTime() - b[1].lastUsed.getTime());

  // Supprimer le plus ancien
  if (unused.length > 0) {
    const [userId, info] = unused[0];

    try {
      const container = docker.getContainer(info.containerId);
      await container.stop();
      await container.remove();
    } catch (error) {
      console.error(`Error removing workspace for user ${userId}:`, error);
    }

    workspacePool.delete(userId);
  }
}

/**
 * Nettoyer tous les workspaces inutilisés depuis plus de X minutes
 */
export async function cleanupIdleWorkspaces(maxIdleMinutes = 30): Promise<void> {
  const now = new Date();

  for (const [userId, info] of workspacePool.entries()) {
    if (info.inUse) continue;

    const idleMinutes = (now.getTime() - info.lastUsed.getTime()) / 1000 / 60;

    if (idleMinutes > maxIdleMinutes) {
      try {
        const container = docker.getContainer(info.containerId);
        await container.stop();
        await container.remove();
        workspacePool.delete(userId);
      } catch (error) {
        console.error(`Error cleaning workspace for user ${userId}:`, error);
      }
    }
  }
}

// Nettoyer toutes les 10 minutes
setInterval(
  () => {
    cleanupIdleWorkspaces(30);
  },
  10 * 60 * 1000,
);
```

---

## 📦 Étape 7 : Dépendances NPM

**Ajouter à `package.json`** :

```json
{
  "dependencies": {
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.6"
  }
}
```

**Installer** :

```bash
pnpm add bcrypt jsonwebtoken
pnpm add -D @types/bcrypt @types/jsonwebtoken
```

---

## 🔐 Étape 8 : Variables d'Environnement

**Ajouter à `.env`** :

```env
# JWT Secret (générer avec: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=<votre_secret_tres_long_et_aleatoire>

# Autres configs existantes
PORT=4310
DATABASE_URL=postgresql://...
```

---

## 🚀 Étape 9 : Migration et Démarrage

### 9.1 Appliquer la Migration

```bash
# Se connecter à PostgreSQL
docker exec -it nod-postgres-1 psql -U nod -d nod

# Copier-coller le contenu de migrations/001-users-table.sql
```

### 9.2 Compiler et Démarrer

```bash
cd h:\nod_n8n

# Compiler
pnpm run build

# Démarrer le serveur
pnpm exec tsx src/server/index.ts
```

---

## ✅ Test de l'Implémentation

### Test 1 : Inscription

```bash
curl -X POST http://localhost:4310/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123",
    "name": "Utilisateur 1"
  }'
```

**Réponse attendue** :

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
  "token": "eyJhbGciOiJIUzI1NiIsInR..."
}
```

### Test 2 : Connexion

```bash
curl -X POST http://localhost:4310/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user1@example.com",
    "password": "password123"
  }'
```

### Test 3 : Accès Protégé

```bash
curl http://localhost:4310/api/auth/me \
  -H "Authorization: Bearer <votre_token>"
```

---

## 📊 Estimation Temps de Développement

| Tâche                            | Temps Estimé    |
| -------------------------------- | --------------- |
| Migration PostgreSQL             | 2-4 heures      |
| Module Auth Backend              | 1-2 jours       |
| Middleware & Context Switching   | 1 jour          |
| Routes API                       | 1 jour          |
| Interface Login/Register (React) | 1-2 jours       |
| Workspace Pool                   | 2-3 jours       |
| Tests & Debug                    | 2-3 jours       |
| **TOTAL**                        | **10-15 jours** |

---

## 💡 Fonctionnalités Avancées (Optionnelles)

### 1. Rate Limiting par Utilisateur

**Fichier** : `src/server/middleware/rate-limit.ts`

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rate_limit:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes par utilisateur
  keyGenerator: (req) => {
    // Rate limit par user_id si authentifié
    return req.user?.userId.toString() || req.ip;
  },
});
```

### 2. Billing & Subscriptions

**Table** : `subscriptions`

```sql
CREATE TABLE public.subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'enterprise'
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'cancelled', 'expired'
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Usage Tracking

**Table** : `usage_logs`

```sql
CREATE TABLE public.usage_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  action VARCHAR(100), -- 'api_call', 'model_request', 'workspace_usage'
  metadata JSONB,
  cost NUMERIC(10, 4), -- Coût en USD
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usage_user_date ON public.usage_logs(user_id, created_at);
```

### 4. Admin Dashboard

Routes pour gérer les utilisateurs :

```typescript
// GET /api/admin/users
// POST /api/admin/users/:id/disable
// GET /api/admin/usage-stats
```

---

## 🎯 Résumé Final

✅ **Ce que vous obtenez** :

1. **1 seule installation Nod** qui gère N utilisateurs
2. **Login/Logout** avec JWT
3. **Isolation complète** des données (schémas PostgreSQL séparés)
4. **Workspace pool** partagé (optimisation ressources)
5. **API protégée** par authentification
6. **Interface moderne** avec React

✅ **Scalabilité** :

- 10 utilisateurs : 8-16 GB RAM
- 50 utilisateurs : 16-32 GB RAM
- 100+ utilisateurs : 32-64 GB RAM

✅ **Coûts** :

- Développement : 2-3 semaines (interne) ou $10-15k (freelance)
- Hébergement : $50-200/mois selon le nombre d'utilisateurs

---

## 📞 Prochaines Étapes

**Voulez-vous que je commence l'implémentation ?**

Je peux créer :

1. ✅ Les migrations PostgreSQL
2. ✅ Le module d'authentification complet
3. ✅ Les routes API
4. ✅ L'interface React Login/Register

**Dites-moi par où commencer !** 🚀
