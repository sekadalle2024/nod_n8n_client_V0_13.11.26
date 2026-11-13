# 📋 Plan d'Implémentation - Chat Multi-Session

## Vue d'Ensemble

Ce document détaille le plan d'implémentation étape par étape du système multi-chat.

---

## 🎯 Objectifs

1. ✅ Permettre création de plusieurs chats par utilisateur
2. ✅ Isolation des messages par chat
3. ✅ Interface sidebar avec liste des chats
4. ✅ Gestion complète (créer, renommer, archiver, supprimer)
5. ✅ Compatible avec systèmes existants

---

## 📊 Phases du Projet

```
Phase 1: Schémas PostgreSQL (1 jour)
   ↓
Phase 2: API Backend (2-3 jours)
   ↓
Phase 3: Frontend React (3-4 jours)
   ↓
Phase 4: Migration Données (1 jour)
   ↓
Phase 5: Tests & Polish (1-2 jours)
```

**Durée totale estimée** : 8-11 jours

---

## Phase 1 : Schémas PostgreSQL (1 jour)

### Étape 1.1 : Créer Table `chats`

**Fichier** : `migrations/020-chats.sql`

```sql
-- Pour chaque schéma user existant
-- (répéter pour user_1, user_2, etc.)

CREATE TABLE user_1.chats (
  id SERIAL PRIMARY KEY,

  -- Identification
  title VARCHAR(255) NOT NULL DEFAULT 'Nouvelle conversation',
  description TEXT,
  icon VARCHAR(50) DEFAULT '💬',
  color VARCHAR(7),

  -- Catégorie
  category VARCHAR(100),
  tags TEXT[],

  -- État
  status VARCHAR(50) DEFAULT 'active',
  pinned BOOLEAN DEFAULT FALSE,

  -- Statistiques
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP,

  -- Contraintes
  CHECK (status IN ('active', 'archived', 'deleted'))
);

-- Index
CREATE INDEX idx_chats_status ON user_1.chats(status);
CREATE INDEX idx_chats_created_by ON user_1.chats(created_by);
CREATE INDEX idx_chats_last_message ON user_1.chats(last_message_at DESC);
CREATE INDEX idx_chats_pinned ON user_1.chats(pinned) WHERE pinned = TRUE;
CREATE INDEX idx_chats_tags ON user_1.chats USING GIN(tags);

-- Trigger pour updated_at
CREATE TRIGGER trigger_chats_updated_at
  BEFORE UPDATE ON user_1.chats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

**Exécuter** :

```bash
docker exec -it nod-postgres-1 psql -U nod -d nod
\i migrations/020-chats.sql
```

**Validation** :

```sql
SELECT * FROM user_1.chats;
-- Doit retourner 0 ligne (table vide mais créée)

\d user_1.chats
-- Doit afficher la structure de la table
```

---

### Étape 1.2 : Modifier Table Messages (turns)

**Ajouter colonne `chat_id`** :

```sql
-- Ajouter la colonne (nullable au début)
ALTER TABLE user_1.turns
ADD COLUMN chat_id INTEGER;

-- Index pour performance
CREATE INDEX idx_turns_chat ON user_1.turns(chat_id);

-- Plus tard, après migration, ajouter contrainte
-- ALTER TABLE user_1.turns
-- ADD CONSTRAINT fk_turns_chat
-- FOREIGN KEY (chat_id) REFERENCES user_1.chats(id) ON DELETE CASCADE;
```

---

### Étape 1.3 : Fonction pour Créer Chat Par Défaut

**Pour les nouveaux utilisateurs** :

```sql
CREATE OR REPLACE FUNCTION create_default_chat_for_user(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
  v_schema_name VARCHAR(255);
  v_chat_id INTEGER;
BEGIN
  v_schema_name := 'user_' || p_user_id;

  -- Créer un chat par défaut
  EXECUTE format('
    INSERT INTO %I.chats (title, icon, created_by)
    VALUES (''Conversation Principale'', ''💬'', %s)
    RETURNING id
  ', v_schema_name, p_user_id) INTO v_chat_id;

  RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql;
```

---

### Étape 1.4 : Trigger Statistiques Chat

**Mettre à jour automatiquement `message_count` et `last_message_at`** :

```sql
CREATE OR REPLACE FUNCTION update_chat_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nouveau message
    UPDATE chats
    SET
      message_count = message_count + 1,
      last_message_at = NEW.created_at
    WHERE id = NEW.chat_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Message supprimé
    UPDATE chats
    SET message_count = message_count - 1
    WHERE id = OLD.chat_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_turns_update_chat_stats
  AFTER INSERT OR DELETE ON user_1.turns
  FOR EACH ROW
  WHEN (NEW.chat_id IS NOT NULL OR OLD.chat_id IS NOT NULL)
  EXECUTE FUNCTION update_chat_stats();
```

---

## Phase 2 : API Backend (2-3 jours)

### Étape 2.1 : Modèles TypeScript

**Fichier** : `src/server/models/chat.ts`

```typescript
export interface Chat {
  id: number;
  title: string;
  description?: string;
  icon: string;
  color?: string;
  category?: string;
  tags: string[];
  status: 'active' | 'archived' | 'deleted';
  pinned: boolean;
  message_count: number;
  last_message_at?: Date;
  created_at: Date;
  created_by: number;
  updated_at: Date;
  archived_at?: Date;
  deleted_at?: Date;
}

export interface Message {
  id: number;
  chat_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens_used?: number;
  cost?: number;
  attachments?: any[];
  context_data?: any;
  created_at: Date;
  created_by: number;
  deleted_at?: Date;
}

export interface ChatListOptions {
  status?: 'active' | 'archived' | 'deleted';
  category?: string;
  tags?: string[];
  pinned?: boolean;
  search?: string;
  sort?: 'created_at' | 'updated_at' | 'last_message_at' | 'message_count';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

---

### Étape 2.2 : Service Chat

**Fichier** : `src/server/services/chat.ts`

```typescript
import { db } from '../db';
import { setUserContext } from '../db/multi-tenant';
import { Chat, ChatListOptions } from '../models/chat';

export class ChatService {
  /**
   * Lister les chats d'un utilisateur
   */
  async list(userId: number, options: ChatListOptions = {}): Promise<Chat[]> {
    await setUserContext(userId);

    const {
      status = 'active',
      category,
      tags,
      pinned,
      search,
      sort = 'last_message_at',
      order = 'desc',
      limit = 50,
      offset = 0,
    } = options;

    let whereConditions = ['status = $1'];
    let params: any[] = [status];
    let paramIndex = 2;

    if (category) {
      whereConditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }

    if (tags && tags.length > 0) {
      whereConditions.push(`tags @> $${paramIndex++}`);
      params.push(tags);
    }

    if (pinned !== undefined) {
      whereConditions.push(`pinned = $${paramIndex++}`);
      params.push(pinned);
    }

    if (search) {
      whereConditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const query = `
      SELECT *
      FROM chats
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY 
        CASE WHEN pinned THEN 0 ELSE 1 END,
        ${sort} ${order}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Obtenir un chat par ID
   */
  async get(userId: number, chatId: number): Promise<Chat | null> {
    await setUserContext(userId);

    const result = await db.query('SELECT * FROM chats WHERE id = $1', [chatId]);

    return result.rows[0] || null;
  }

  /**
   * Créer un nouveau chat
   */
  async create(
    userId: number,
    data: {
      title?: string;
      description?: string;
      icon?: string;
      color?: string;
      category?: string;
      tags?: string[];
    },
  ): Promise<Chat> {
    await setUserContext(userId);

    const {
      title = 'Nouvelle conversation',
      description,
      icon = '💬',
      color,
      category,
      tags = [],
    } = data;

    const result = await db.query(
      `INSERT INTO chats (
        title, description, icon, color, category, tags, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [title, description, icon, color, category, tags, userId],
    );

    return result.rows[0];
  }

  /**
   * Mettre à jour un chat
   */
  async update(userId: number, chatId: number, data: Partial<Chat>): Promise<Chat> {
    await setUserContext(userId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ['title', 'description', 'icon', 'color', 'category', 'tags'];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    values.push(chatId);

    const query = `
      UPDATE chats
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  /**
   * Épingler / Détacher un chat
   */
  async togglePin(userId: number, chatId: number): Promise<Chat> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE chats
       SET pinned = NOT pinned
       WHERE id = $1
       RETURNING *`,
      [chatId],
    );

    return result.rows[0];
  }

  /**
   * Archiver un chat
   */
  async archive(userId: number, chatId: number): Promise<Chat> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE chats
       SET status = 'archived', archived_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [chatId],
    );

    return result.rows[0];
  }

  /**
   * Désarchiver un chat
   */
  async unarchive(userId: number, chatId: number): Promise<Chat> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE chats
       SET status = 'active', archived_at = NULL
       WHERE id = $1
       RETURNING *`,
      [chatId],
    );

    return result.rows[0];
  }

  /**
   * Supprimer un chat (soft delete)
   */
  async delete(userId: number, chatId: number): Promise<boolean> {
    await setUserContext(userId);

    const result = await db.query(
      `UPDATE chats
       SET status = 'deleted', deleted_at = NOW()
       WHERE id = $1`,
      [chatId],
    );

    return result.rowCount > 0;
  }

  /**
   * Obtenir les statistiques
   */
  async getStats(userId: number): Promise<any> {
    await setUserContext(userId);

    const result = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') AS active_count,
        COUNT(*) FILTER (WHERE status = 'archived') AS archived_count,
        SUM(message_count) AS total_messages,
        (
          SELECT json_build_object(
            'id', id,
            'title', title,
            'message_count', message_count
          )
          FROM chats
          WHERE status = 'active'
          ORDER BY message_count DESC
          LIMIT 1
        ) AS most_active_chat
      FROM chats
    `);

    return result.rows[0];
  }

  /**
   * Recherche globale
   */
  async search(
    userId: number,
    query: string,
    searchIn: ('title' | 'messages')[] = ['title', 'messages'],
  ): Promise<any[]> {
    await setUserContext(userId);

    const results: any[] = [];

    if (searchIn.includes('title')) {
      const chatResults = await db.query(
        `SELECT id, title, description
         FROM chats
         WHERE status = 'active'
           AND (title ILIKE $1 OR description ILIKE $1)
         LIMIT 10`,
        [`%${query}%`],
      );

      results.push(
        ...chatResults.rows.map((r) => ({
          type: 'chat',
          ...r,
        })),
      );
    }

    if (searchIn.includes('messages')) {
      // Recherche dans les messages (turns)
      const messageResults = await db.query(
        `SELECT DISTINCT ON (t.chat_id)
           t.chat_id,
           c.title AS chat_title,
           t.id AS message_id,
           substring(t.content FROM 1 FOR 200) AS snippet
         FROM turns t
         JOIN chats c ON c.id = t.chat_id
         WHERE c.status = 'active'
           AND t.content ILIKE $1
         ORDER BY t.chat_id, t.created_at DESC
         LIMIT 10`,
        [`%${query}%`],
      );

      results.push(
        ...messageResults.rows.map((r) => ({
          type: 'message',
          ...r,
        })),
      );
    }

    return results;
  }
}
```

---

### Étape 2.3 : Routes API

**Fichier** : `src/server/routes/chats.ts`

```typescript
import { Router } from 'express';
import { authMiddleware } from '../auth/middleware';
import { ChatService } from '../services/chat';

export const chatsRouter = Router();

// Middleware auth
chatsRouter.use(authMiddleware);

const chatService = new ChatService();

/**
 * GET /api/chats
 * Lister les chats
 */
chatsRouter.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const options = {
      status: req.query.status as any,
      category: req.query.category as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      pinned: req.query.pinned === 'true' ? true : undefined,
      search: req.query.search as string,
      sort: (req.query.sort as any) || 'last_message_at',
      order: (req.query.order as any) || 'desc',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0,
    };

    const chats = await chatService.list(userId, options);

    res.json({
      success: true,
      data: chats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/chats/:id
 * Obtenir un chat
 */
chatsRouter.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);

    const chat = await chatService.get(userId, chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        error: 'Chat not found',
      });
    }

    res.json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/chats
 * Créer un nouveau chat
 */
chatsRouter.post('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const data = req.body;

    const chat = await chatService.create(userId, data);

    res.status(201).json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/chats/:id
 * Mettre à jour un chat
 */
chatsRouter.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);
    const data = req.body;

    const chat = await chatService.update(userId, chatId, data);

    res.json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/chats/:id/pin
 * Épingler / Détacher
 */
chatsRouter.post('/:id/pin', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);

    const chat = await chatService.togglePin(userId, chatId);

    res.json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/chats/:id/archive
 * Archiver un chat
 */
chatsRouter.post('/:id/archive', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);

    const chat = await chatService.archive(userId, chatId);

    res.json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/chats/:id/unarchive
 * Désarchiver un chat
 */
chatsRouter.post('/:id/unarchive', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);

    const chat = await chatService.unarchive(userId, chatId);

    res.json({
      success: true,
      data: chat,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/chats/:id
 * Supprimer un chat
 */
chatsRouter.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const chatId = parseInt(req.params.id);

    const deleted = await chatService.delete(userId, chatId);

    res.json({
      success: deleted,
      message: deleted ? 'Chat deleted' : 'Chat not found',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/chats/stats
 * Statistiques
 */
chatsRouter.get('/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;

    const stats = await chatService.getStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/chats/search
 * Recherche globale
 */
chatsRouter.get('/search', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const query = req.query.q as string;
    const searchIn = req.query.in
      ? ((req.query.in as string).split(',') as any[])
      : ['title', 'messages'];

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const results = await chatService.search(userId, query, searchIn);

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

---

### Étape 2.4 : Intégration dans Server

**Fichier** : `src/server/index.ts`

```typescript
import { chatsRouter } from './routes/chats';

// Après les autres routes
app.use('/api/chats', chatsRouter);
```

---

## Phase 3-5 : Voir Documents Séparés

Les phases suivantes seront détaillées dans un document séparé pour le frontend React et la migration.

---

## 🎯 Prochaine Étape

**Commencer par Phase 1, Étape 1.1** : Créer la table `chats` dans PostgreSQL

**Voulez-vous que je crée le document pour les phases 3-5 (Frontend React + Migration) ?**
