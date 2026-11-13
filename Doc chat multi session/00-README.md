# 💬 Chat Multi-Session - Documentation

## 🎯 Objectif

Permettre aux utilisateurs de créer et gérer **plusieurs conversations** (chats) au lieu d'un seul chat unique.

---

## 📋 Problématique

### Situation Actuelle

```
Utilisateur
   ↓
Un seul chat (thread unique)
   ↓
Tous les messages mélangés
```

**Problèmes** :

- ❌ Impossible d'organiser par projet/sujet
- ❌ Historique long devient confus
- ❌ Difficile de retrouver une conversation spécifique
- ❌ Pas de séparation contexte

---

### Solution Voulue

```
Utilisateur
   ↓
├── Chat 1: "Audit Mission ABC"
├── Chat 2: "Analyse Financière Q1"
├── Chat 3: "Rapport Mensuel"
└── Chat 4: "Questions Diverses"
```

**Avantages** :

- ✅ Organisation par sujet/projet
- ✅ Contexte isolé par chat
- ✅ Historique clair
- ✅ Recherche facilitée
- ✅ Archivage possible

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              React Frontend                         │
│  ┌───────────────────────────────────────────────┐  │
│  │  Sidebar (Liste des Chats)                   │  │
│  │  ├── ➕ Nouveau Chat                         │  │
│  │  ├── 💬 Audit Mission ABC (actif)            │  │
│  │  ├── 💬 Analyse Financière Q1                │  │
│  │  ├── 💬 Rapport Mensuel                      │  │
│  │  └── 🗑️ Archivés (5)                         │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Chat Panel (Conversation Active)            │  │
│  │  • Messages du chat sélectionné              │  │
│  │  • Input message                             │  │
│  │  • Actions: Renommer, Archiver, Supprimer   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↕ HTTP
┌─────────────────────────────────────────────────────┐
│           Backend Express (Node.js)                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  Chat Management API                         │  │
│  │  • GET    /api/chats (liste)                 │  │
│  │  • POST   /api/chats (créer)                 │  │
│  │  • PUT    /api/chats/:id (renommer)          │  │
│  │  • DELETE /api/chats/:id (supprimer)         │  │
│  │  • POST   /api/chats/:id/archive             │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Messages API (par chat)                     │  │
│  │  • GET  /api/chats/:id/messages              │  │
│  │  • POST /api/chats/:id/messages              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                       ↕
┌─────────────────────────────────────────────────────┐
│         PostgreSQL Multi-Tenant                     │
│  ┌───────────────────────────────────────────────┐  │
│  │  Schema: user_1                              │  │
│  │  ├── chats (liste des conversations)         │  │
│  │  ├── messages (tous les messages)            │  │
│  │  └── chat_members (partage futur)            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Schéma de Données

### Table `chats`

```sql
CREATE TABLE user_X.chats (
  id SERIAL PRIMARY KEY,

  -- Identification
  title VARCHAR(255) NOT NULL DEFAULT 'Nouvelle conversation',

  -- Métadonnées
  description TEXT,
  icon VARCHAR(50) DEFAULT '💬', -- Emoji ou icon name
  color VARCHAR(7),               -- Ex: '#3B82F6'

  -- Catégorie (optionnel)
  category VARCHAR(100),          -- 'audit', 'finance', 'general'
  tags TEXT[],                    -- ['urgent', 'Q1', 'client-abc']

  -- État
  status VARCHAR(50) DEFAULT 'active', -- 'active' | 'archived' | 'deleted'
  pinned BOOLEAN DEFAULT FALSE,

  -- Statistiques
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  archived_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_chats_status ON user_X.chats(status);
CREATE INDEX idx_chats_created_by ON user_X.chats(created_by);
CREATE INDEX idx_chats_last_message ON user_X.chats(last_message_at DESC);
CREATE INDEX idx_chats_pinned ON user_X.chats(pinned) WHERE pinned = TRUE;
```

### Table `messages` (Modifiée)

```sql
-- Ajouter une colonne chat_id aux messages existants
ALTER TABLE user_X.turns
ADD COLUMN chat_id INTEGER REFERENCES user_X.chats(id) ON DELETE CASCADE;

-- Index pour performance
CREATE INDEX idx_turns_chat ON user_X.turns(chat_id);

-- Ou créer une nouvelle table messages (alternative)
CREATE TABLE user_X.messages (
  id SERIAL PRIMARY KEY,

  -- Référence au chat
  chat_id INTEGER NOT NULL REFERENCES user_X.chats(id) ON DELETE CASCADE,

  -- Contenu
  role VARCHAR(50) NOT NULL, -- 'user' | 'assistant' | 'system'
  content TEXT NOT NULL,

  -- Métadonnées
  model VARCHAR(100),        -- Modèle AI utilisé
  tokens_used INTEGER,
  cost NUMERIC(10, 6),

  -- Pièces jointes
  attachments JSONB,         -- [{type: 'file', url: '...', name: '...'}]

  -- Contexte
  context_data JSONB,        -- Données contextuelles

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  created_by INTEGER REFERENCES public.users(id),

  -- Soft delete
  deleted_at TIMESTAMP
);

CREATE INDEX idx_messages_chat ON user_X.messages(chat_id);
CREATE INDEX idx_messages_created_at ON user_X.messages(created_at DESC);
CREATE INDEX idx_messages_role ON user_X.messages(role);
```

---

## 🎨 Fonctionnalités Clés

### 1. Gestion des Chats

**Créer** :

```typescript
POST /api/chats
Body: {
  title: "Audit Mission ABC",
  category: "audit",
  tags: ["urgent", "2026"],
  icon: "📋"
}
```

**Lister** :

```typescript
GET /api/chats
Query: ?status=active&sort=last_message&order=desc
Response: [
  {
    id: 1,
    title: "Audit Mission ABC",
    message_count: 45,
    last_message_at: "2026-11-12T10:30:00Z",
    pinned: true
  }
]
```

**Renommer** :

```typescript
PUT / api / chats / 1;
Body: {
  title: 'Audit Mission ABC - Finalisé';
}
```

**Archiver** :

```typescript
POST / api / chats / 1 / archive;
```

**Supprimer** :

```typescript
DELETE / api / chats / 1;
```

---

### 2. Messages par Chat

**Envoyer message** :

```typescript
POST /api/chats/1/messages
Body: {
  content: "Analyse les finances de ce client",
  role: "user"
}
```

**Récupérer messages** :

```typescript
GET /api/chats/1/messages
Query: ?limit=50&offset=0
Response: [
  {
    id: 123,
    chat_id: 1,
    role: "user",
    content: "Analyse les finances...",
    created_at: "2026-11-12T10:30:00Z"
  },
  {
    id: 124,
    chat_id: 1,
    role: "assistant",
    content: "J'ai analysé...",
    created_at: "2026-11-12T10:30:15Z"
  }
]
```

---

### 3. Recherche et Filtres

**Recherche globale** :

```typescript
GET /api/chats/search
Query: ?q=audit+2026&in=title,messages
Response: [
  {
    chat_id: 1,
    title: "Audit Mission ABC",
    matches: [
      {
        message_id: 45,
        snippet: "...l'audit de 2026 révèle..."
      }
    ]
  }
]
```

**Filtres** :

```typescript
GET /api/chats
Query: ?category=audit&tags=urgent&pinned=true
```

---

### 4. Épingler (Pin)

```typescript
POST / api / chats / 1 / pin;
DELETE / api / chats / 1 / pin;
```

Les chats épinglés apparaissent en haut de la liste.

---

### 5. Statistiques

```typescript
GET /api/chats/stats
Response: {
  total: 15,
  active: 10,
  archived: 5,
  total_messages: 450,
  most_active: {
    chat_id: 3,
    title: "Questions Diverses",
    message_count: 120
  }
}
```

---

## 💡 Cas d'Usage

### Cas 1 : Organisation par Projet

```
User crée chat "Audit Client XYZ"
  ↓
User travaille sur ce projet (50 messages)
  ↓
User crée chat "Audit Client ABC"
  ↓
Contexte séparé, pas de confusion
```

---

### Cas 2 : Historique Long

```
User a 500 messages sur 6 mois
  ↓
Avant: 1 chat avec 500 messages (difficile à naviguer)
  ↓
Après: 10 chats thématiques (50 messages chacun)
  ↓
Navigation claire et rapide
```

---

### Cas 3 : Archivage

```
Projet terminé
  ↓
User archive le chat
  ↓
Chat disparaît de la liste active
  ↓
Mais reste accessible via "Archivés"
```

---

## 🎨 Interface Utilisateur

### Layout

```
┌────────────────────────────────────────────────────┐
│ Nod                                    [👤 Menu]   │
├───────────┬────────────────────────────────────────┤
│ Sidebar   │ Chat Panel                             │
│ (25%)     │ (75%)                                  │
│           │                                        │
│ ➕ Nouveau│ 📋 Audit Mission ABC           [⋯]    │
│           │ ────────────────────────────────────── │
│ 📌 Épinglés│ User: Analyse les finances            │
│ 📋 Audit  │ Assistant: J'ai analysé...            │
│   Mission │                                        │
│   ABC (45)│ User: Génère un rapport               │
│           │ Assistant: Voici le rapport...        │
│ 💬 Actifs │                                        │
│ 💬 Ana... │                                        │
│   Q1 (23) │                                        │
│ 💬 Quest..│                                        │
│   (120)   │                                        │
│           │                                        │
│ 🗂️ Archivés│                                        │
│ (5)       │ ────────────────────────────────────── │
│           │ [Type your message...]        [Send]  │
└───────────┴────────────────────────────────────────┘
```

---

### Actions Chat

**Menu contextuel (⋯)** :

- ✏️ Renommer
- 📌 Épingler / Détacher
- 🏷️ Gérer les tags
- 📁 Changer catégorie
- 🗂️ Archiver
- 🗑️ Supprimer

---

## 🔑 Fonctionnalités Avancées (Futures)

### 1. Partage de Chat

```typescript
POST /api/chats/1/share
Body: {
  user_id: 2,
  permission: 'read' // 'read' | 'write'
}
```

Table `chat_members` :

```sql
CREATE TABLE user_X.chat_members (
  id SERIAL PRIMARY KEY,
  chat_id INTEGER REFERENCES user_X.chats(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES public.users(id),
  permission VARCHAR(20) DEFAULT 'read',
  joined_at TIMESTAMP DEFAULT NOW()
);
```

---

### 2. Templates de Chat

```typescript
GET /api/chat-templates
Response: [
  {
    id: 1,
    name: "Audit Mission",
    icon: "📋",
    initial_message: "Bonjour, je commence une nouvelle mission d'audit..."
  }
]

POST /api/chats/from-template
Body: { template_id: 1, title: "Mon Audit" }
```

---

### 3. Export de Chat

```typescript
GET /api/chats/1/export
Query: ?format=pdf|markdown|json

Response: (file download)
```

---

### 4. Fusion de Chats

```typescript
POST /api/chats/merge
Body: {
  source_ids: [1, 2, 3],
  target_title: "Projet Global"
}
```

---

## 📊 Migration des Données

### Étape 1 : Chat par Défaut

Créer un chat "Conversation Principale" pour chaque user et y migrer les messages existants.

```sql
-- Pour chaque utilisateur
INSERT INTO user_X.chats (title, status, created_by)
VALUES ('Conversation Principale', 'active', X)
RETURNING id;

-- Migrer les messages
UPDATE user_X.turns
SET chat_id = <nouveau_chat_id>
WHERE chat_id IS NULL;
```

---

## ✅ Avantages

### Pour les Utilisateurs

- ✅ Organisation claire
- ✅ Contexte isolé
- ✅ Navigation rapide
- ✅ Archivage facile

### Pour le Système

- ✅ Scalabilité améliorée
- ✅ Gestion mémoire optimisée
- ✅ Recherche plus rapide
- ✅ Statistiques détaillées

---

## 🎯 Compatibilité

### Avec SaaS Multi-Utilisateurs ✅

- Chaque user a ses propres chats (schéma `user_X`)
- Isolation complète

### Avec Routing Direct ✅

- Mode Direct fonctionne par chat
- Historique séparé

### Avec Persistance ✅

- Tables liées à un chat spécifique
- Organisation cohérente

---

## 📝 Prochaines Étapes

1. **Lire** : `01-SCHEMA-DATABASE.md` pour détails SQL
2. **Comprendre** : `02-API-SPECIFICATION.md` pour contrat API
3. **Implémenter** : `03-PLAN-IMPLEMENTATION.md` pour exécution

---

**Créé le** : 2026-11-12  
**Version** : 1.0  
**Status** : 📝 Documentation en cours
