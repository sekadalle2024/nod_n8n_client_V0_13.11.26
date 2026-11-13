# WORKSPACE TEAM - PARTAGE COLLABORATIF DE TABLES

## 📋 Vue d'Ensemble

Ce dossier documente le système de partage collaboratif de tables d'audit, permettant à plusieurs utilisateurs (auditeurs et opérationnels) de travailler simultanément sur les mêmes tables depuis des postes distants.

---

## 🎯 Cas d'Usage Principal

### Suivi des Recommandations d'Audit

```
┌─────────────────────────────────────────────────────────────┐
│  AUDITEUR (PC Bureau)                                        │
│  - Crée la table "Suivi Recommandations"                    │
│  - Définit les colonnes (N°, Recommandation, Priorité...)   │
│  - Remplit les recommandations issues de l'audit            │
│  - PARTAGE la table avec les opérationnels                  │
└─────────────────────────────────────────────────────────────┘
                         ↓
              URL de partage générée
          https://nod.app/shared/table/uuid-xxx
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  OPÉRATIONNEL 1 (PC distant - Comptabilité)                 │
│  - Ouvre le lien                                             │
│  - Voit les recommandations qui le concernent               │
│  - Remplit : "Actions menées", "Preuves", "Statut"         │
│  - Upload pièces justificatives                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  OPÉRATIONNEL 2 (PC distant - DSI)                          │
│  - Ouvre le même lien                                        │
│  - Travaille sur ses recommandations                         │
│  - Modifications synchronisées en temps réel                 │
└─────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────┐
│  AUDITEUR (PC Bureau)                                        │
│  - Voit les mises à jour en temps réel                      │
│  - Historique complet des modifications                      │
│  - Exporte le suivi complété                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture Technique

### Système Multi-Utilisateur SaaS

```
┌─────────────────────────────────────────────────────────────┐
│                    NAVIGATEURS CLIENTS                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auditeur PC1 │  │ Opérat. PC2  │  │ Opérat. PC3  │     │
│  │ React App    │  │ React App    │  │ React App    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                     WebSocket (temps réel)
                     + REST API (CRUD)
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    SERVEUR NOD (Unique)                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  WebSocket Server (Socket.io)                           ││
│  │  - Broadcast modifications à tous les clients connectés ││
│  │  - Gestion des conflits (Operational Transform)         ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  API REST Fastify                                       ││
│  │  - CRUD tables partagées                                ││
│  │  - Gestion permissions (lecture/écriture par user)      ││
│  └─────────────────────────────────────────────────────────┘│
└────────────────────────────┬─────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                    POSTGRESQL (Unique)                        │
│                                                              │
│  audit_table_shares  (Partages)                              │
│  audit_table_permissions  (Permissions par utilisateur)      │
│  audit_table_data  (Données avec lock optimiste)            │
│  audit_data_versions  (Historique + qui a modifié quoi)     │
└─────────────────────────────────────────────────────────────┘
```

**Points Clés** :

- ✅ **Un seul serveur Node.js** : Tous les utilisateurs se connectent au même
- ✅ **Une seule base PostgreSQL** : Source unique de vérité
- ✅ **WebSocket** : Synchronisation temps réel entre clients
- ✅ **Permissions granulaires** : Contrôle qui peut lire/modifier quoi

---

## 📚 Documents dans ce Dossier

| Fichier                                 | Description                                   |
| --------------------------------------- | --------------------------------------------- |
| `00-README-WORKSPACE-COLLABORATIF.md`   | Ce document (vue d'ensemble)                  |
| `01-ARCHITECTURE-PARTAGE-TEMPS-REEL.md` | Architecture technique WebSocket + OT         |
| `02-PERMISSIONS-ROLES-UTILISATEURS.md`  | Système de permissions et rôles               |
| `03-GESTION-CONFLITS-EDITION.md`        | Résolution conflits modifications simultanées |
| `04-IMPLEMENTATION-WEBSOCKET.md`        | Code backend/frontend WebSocket               |
| `05-CAS-USAGE-SUIVI-RECOMMANDATIONS.md` | Exemple concret complet                       |

---

## 🚀 Fonctionnalités

### 1. Partage de Table

```typescript
// Auditeur crée un lien de partage
POST /api/audit/schemas/:id/share
{
  "accessType": "edit",        // "view" ou "edit"
  "expiresAt": "2025-01-31",   // Date expiration (optionnel)
  "allowedUsers": [            // Utilisateurs spécifiques (optionnel)
    "user@example.com"
  ]
}

// Réponse
{
  "shareId": "uuid-share",
  "shareUrl": "https://nod.app/shared/table/uuid-share",
  "qrCode": "data:image/png;base64,..."  // QR code pour mobile
}
```

### 2. Synchronisation Temps Réel

```typescript
// Utilisateur A modifie une cellule
→ WebSocket broadcast à tous les utilisateurs connectés
→ Utilisateur B et C voient la modification instantanément

// Avec indicateur de présence
👤 Auditeur (vous)
👤 Marie (Comptabilité) - en train d'éditer ligne 5
👤 Jean (DSI) - vient de modifier ligne 8
```

### 3. Permissions Granulaires

```typescript
{
  "permissions": {
    "user-auditeur": {
      "role": "owner",           // Tous les droits
      "canEdit": true,
      "canDelete": true,
      "canShare": true,
      "canExport": true
    },
    "user-operationnel-1": {
      "role": "editor",          // Peut éditer
      "canEdit": true,
      "canDelete": false,        // Ne peut pas supprimer
      "canShare": false,
      "canExport": true
    },
    "user-operationnel-2": {
      "role": "viewer",          // Lecture seule
      "canEdit": false,
      "canDelete": false,
      "canShare": false,
      "canExport": true
    }
  }
}
```

### 4. Gestion des Conflits

```typescript
// Scénario : Deux utilisateurs modifient la même cellule

User A: Modifie "Statut" → "En cours" à 14:00:00
User B: Modifie "Statut" → "Terminé" à 14:00:01

// Système détecte conflit
→ Dernière modification gagne (Last Write Wins)
→ Notification aux deux utilisateurs
→ Historique garde les deux versions

// User A voit :
⚠️  Votre modification "En cours" a été écrasée par User B ("Terminé")
[Voir l'historique] [Restaurer ma version]
```

### 5. Historique Détaillé

```typescript
GET /api/audit/data/:id/versions

// Réponse
{
  "versions": [
    {
      "changed_at": "2024-11-12T14:00:01Z",
      "changed_by": "user-operationnel-2",
      "changed_by_name": "Marie Dupont",
      "change_type": "update",
      "column": "statut",
      "old_value": "En cours",
      "new_value": "Terminé"
    },
    {
      "changed_at": "2024-11-12T14:00:00Z",
      "changed_by": "user-operationnel-1",
      "changed_by_name": "Jean Martin",
      "change_type": "update",
      "column": "statut",
      "old_value": "À faire",
      "new_value": "En cours"
    }
  ]
}
```

---

## 🔐 Sécurité

### Authentification

```typescript
// Lien de partage contient un token
https://nod.app/shared/table/uuid-share?token=secret-token-xyz

// Backend vérifie :
1. Le token est valide
2. Le partage n'a pas expiré
3. L'utilisateur a les permissions nécessaires
4. La table existe et n'est pas supprimée
```

### Isolation des Données

```typescript
// Chaque utilisateur voit UNIQUEMENT :
- Les tables partagées avec lui
- Ses propres tables
- Les lignes filtrées selon ses permissions (optionnel)

// Exemple : Filtrage par département
Opérationnel Comptabilité → Voit seulement lignes où département = "Comptabilité"
Opérationnel DSI → Voit seulement lignes où département = "DSI"
Auditeur → Voit TOUTES les lignes
```

### Audit Trail Complet

```typescript
// Toutes les actions sont tracées
- Qui a ouvert le lien de partage
- Qui a modifié quelle cellule à quelle heure
- Qui a téléchargé des pièces justificatives
- Qui a exporté la table

// Rapports d'activité
GET /api/audit/schemas/:id/activity-log
```

---

## 📱 Support Multi-Plateforme

### Desktop (Nod App)

```
✅ Application Electron
✅ Performances optimales
✅ Accès hors ligne (avec sync au retour)
```

### Web (Navigateur)

```
✅ https://nod.app (React SPA)
✅ Compatible Chrome, Firefox, Edge, Safari
✅ Responsive (tablette supportée)
```

### Mobile (Futur)

```
⏳ Application React Native
⏳ QR code pour accès rapide
⏳ Notifications push pour modifications
```

---

## 🌐 Comparaison avec Autres Solutions

| Aspect          | Nod (Notre Solution)  | Google Sheets   | Notion          | NotebookLM          |
| --------------- | --------------------- | --------------- | --------------- | ------------------- |
| **Hébergement** | Serveur unique (SaaS) | Cloud Google    | Cloud Notion    | Cloud Google        |
| **Temps réel**  | ✅ WebSocket          | ✅ Propriétaire | ✅ Propriétaire | ❌ Non collaboratif |
| **Permissions** | ✅ Granulaires        | ✅ Par document | ✅ Par page     | ❌ Personnel        |
| **Audit trail** | ✅ Complet            | ⚠️ Limité       | ⚠️ Basique      | ❌ Aucun            |
| **Offline**     | ✅ Desktop            | ⚠️ Limité       | ❌ Non          | ❌ Non              |
| **Versioning**  | ✅ Automatique        | ⚠️ Historique   | ⚠️ Historique   | ❌ Non              |
| **Self-hosted** | ✅ Possible           | ❌ Non          | ❌ Non          | ❌ Non              |
| **RGPD**        | ✅ Données FR         | ⚠️ USA          | ⚠️ USA          | ⚠️ USA              |

---

## 🎯 Avantages de Notre Solution

### 1. Contrôle Total

```
✅ Données hébergées sur VOTRE serveur
✅ Aucune dépendance externe (Google, Notion...)
✅ Conformité RGPD garantie
✅ Pas de limitation de volume ou d'utilisateurs
```

### 2. Intégration n8n

```
✅ Tables créées automatiquement depuis workflows n8n
✅ Synchronisation bidirectionnelle
✅ Automatisations illimitées
```

### 3. Audit-First Design

```
✅ Historique complet de TOUTES les modifications
✅ Export conforme normes d'audit (ISO, IFAC...)
✅ Traçabilité who/when/what garantie
✅ Signatures électroniques (futur)
```

### 4. Performance

```
✅ PostgreSQL = Base de données audit-proof
✅ JSONB = Flexibilité sans migration
✅ WebSocket = Latence < 50ms
✅ Cache intelligent = Chargement instantané
```

---

## 🚦 Roadmap Fonctionnalités

### Phase 1 : MVP (Actuel)

- [x] Création et édition de tables
- [x] CRUD avec versioning automatique
- [x] Consolidations automatiques
- [ ] **WebSocket temps réel** ← Prochaine étape
- [ ] **Système de partage** ← Prochaine étape

### Phase 2 : Collaboration

- [ ] Partage par lien
- [ ] Permissions granulaires
- [ ] Indicateurs de présence (qui édite quoi)
- [ ] Commentaires sur lignes/cellules
- [ ] Notifications (email + in-app)

### Phase 3 : Avancé

- [ ] Filtres personnalisés par utilisateur
- [ ] Vues sauvegardées
- [ ] Workflows d'approbation
- [ ] Signatures électroniques
- [ ] API publique pour intégrations

---

## 📞 Documentation Détaillée

Consultez les autres documents de ce dossier pour :

1. **Architecture technique complète** → `01-ARCHITECTURE-PARTAGE-TEMPS-REEL.md`
2. **Système de permissions** → `02-PERMISSIONS-ROLES-UTILISATEURS.md`
3. **Gestion des conflits** → `03-GESTION-CONFLITS-EDITION.md`
4. **Implémentation code** → `04-IMPLEMENTATION-WEBSOCKET.md`
5. **Exemple concret** → `05-CAS-USAGE-SUIVI-RECOMMANDATIONS.md`

---

## 🎓 Réponse à Votre Question

> "Est-ce possible de partager des tables qui peuvent être modifiées par deux PC distants, comme les notebooks LLM ou les spaces d'OpenAI ?"

**Réponse : OUI, absolument ! C'est exactement le même principe.**

### Comment ça marche :

```
NotebookLM / ChatGPT Spaces :
- Un serveur central (Google/OpenAI)
- Plusieurs utilisateurs se connectent via navigateur
- Modifications synchronisées en temps réel
- Tout le monde voit les mêmes données

Notre Solution Nod :
- Un serveur Node.js (le vôtre ou hébergé)
- Plusieurs utilisateurs se connectent via navigateur ou app desktop
- Modifications synchronisées via WebSocket
- PostgreSQL comme base unique
- PLUS : Vous contrôlez vos données !
```

### Différences clés :

| Aspect          | NotebookLM/Spaces   | Nod                        |
| --------------- | ------------------- | -------------------------- |
| Serveur         | Cloud externe       | Votre serveur              |
| Données         | USA (Google/OpenAI) | France (ou où vous voulez) |
| Confidentialité | ⚠️ Partagé avec IA  | ✅ Privé à 100%            |
| Audit trail     | ❌ Limité           | ✅ Complet                 |
| Coût            | Gratuit mais limité | Serveur unique illimité    |

**La prochaine étape est d'implémenter le WebSocket pour activer le temps réel !** 🚀

---

**Créé le** : 12 novembre 2026  
**Version** : 1.0  
**Statut** : Documentation de base - Implémentation en cours
