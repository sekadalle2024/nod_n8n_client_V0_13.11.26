# CAS D'USAGE : SUIVI DES RECOMMANDATIONS D'AUDIT

## 📋 Contexte

**Besoin** : L'auditeur crée une table de suivi des recommandations et la partage avec les opérationnels pour qu'ils renseignent les preuves et actions menées.

**Contrainte** : Plusieurs PC distants doivent pouvoir modifier la même table simultanément.

---

## 🎯 Workflow Complet

### Phase 1 : Création par l'Auditeur

```
┌─────────────────────────────────────────────────────────────┐
│  AUDITEUR - PC Bureau                                        │
│  Localisation : Bureau d'audit                               │
└─────────────────────────────────────────────────────────────┘

Étape 1 : Créer la table de suivi
────────────────────────────────────
POST /api/audit/schemas
{
  "tableName": "suivi_recommandations_2024",
  "displayName": "Suivi des Recommandations - Mission 2024",
  "columnDefinitions": [
    {
      "name": "numero",
      "type": "text",
      "displayName": "N° Reco",
      "required": true
    },
    {
      "name": "recommandation",
      "type": "text",
      "displayName": "Recommandation",
      "required": true
    },
    {
      "name": "priorite",
      "type": "select",
      "displayName": "Priorité",
      "options": ["Critique", "Élevée", "Moyenne", "Faible"],
      "required": true
    },
    {
      "name": "departement",
      "type": "select",
      "displayName": "Département concerné",
      "options": ["Comptabilité", "DSI", "RH", "DAF", "DG"],
      "required": true
    },
    {
      "name": "echeance",
      "type": "date",
      "displayName": "Échéance",
      "required": true
    },
    {
      "name": "responsable",
      "type": "text",
      "displayName": "Responsable",
      "required": false
    },
    {
      "name": "actions_menees",
      "type": "text",
      "displayName": "Actions menées (à remplir par opérationnel)",
      "required": false
    },
    {
      "name": "preuves",
      "type": "text",
      "displayName": "Références des preuves",
      "required": false
    },
    {
      "name": "statut",
      "type": "select",
      "displayName": "Statut",
      "options": ["À faire", "En cours", "Terminé", "Bloqué"],
      "required": true
    },
    {
      "name": "commentaire_auditeur",
      "type": "text",
      "displayName": "Commentaire auditeur",
      "required": false
    }
  ]
}

→ Réponse : schemaId = "uuid-schema-123"


Étape 2 : Remplir les recommandations issues de l'audit
────────────────────────────────────────────────────────
POST /api/audit/schemas/uuid-schema-123/data/bulk
{
  "rows": [
    {
      "numero": "R001",
      "recommandation": "Renforcer les contrôles d'accès aux bases de données",
      "priorite": "Critique",
      "departement": "DSI",
      "echeance": "2024-12-31",
      "responsable": "Directeur DSI",
      "statut": "À faire"
    },
    {
      "numero": "R002",
      "recommandation": "Mettre à jour la procédure de rapprochement bancaire",
      "priorite": "Élevée",
      "departement": "Comptabilité",
      "echeance": "2024-11-30",
      "responsable": "Chef comptable",
      "statut": "À faire"
    },
    {
      "numero": "R003",
      "recommandation": "Formaliser le processus de recrutement",
      "priorite": "Moyenne",
      "departement": "RH",
      "echeance": "2025-01-31",
      "responsable": "DRH",
      "statut": "À faire"
    }
    // ... 15 recommandations au total
  ]
}

→ 15 lignes créées


Étape 3 : Partager la table avec les opérationnels
───────────────────────────────────────────────────
POST /api/audit/schemas/uuid-schema-123/share
{
  "accessType": "edit",
  "expiresAt": "2025-02-28",
  "permissions": {
    "marie.dupont@company.com": {
      "role": "editor",
      "canEdit": true,
      "canDelete": false,
      "rowFilters": {
        "departement": "Comptabilité"  // Ne voit que ses lignes
      }
    },
    "jean.martin@company.com": {
      "role": "editor",
      "canEdit": true,
      "canDelete": false,
      "rowFilters": {
        "departement": "DSI"
      }
    },
    "sophie.bernard@company.com": {
      "role": "viewer",  // DG en lecture seule
      "canEdit": false,
      "canExport": true
    }
  }
}

→ Réponse :
{
  "shareId": "uuid-share-456",
  "shareUrl": "https://nod.company.com/shared/table/uuid-share-456",
  "shareUrls": {
    "marie.dupont@company.com": "...?token=token-marie",
    "jean.martin@company.com": "...?token=token-jean",
    "sophie.bernard@company.com": "...?token=token-sophie"
  }
}


Étape 4 : Envoyer les liens par email
──────────────────────────────────────
Email automatique envoyé :

De : auditeur@company.com
À : marie.dupont@company.com
Objet : Suivi des recommandations - Mission d'audit 2024

Bonjour Marie,

Suite à notre mission d'audit, veuillez trouver ci-dessous le lien
pour accéder au tableau de suivi des recommandations vous concernant.

Vous pourrez :
- Consulter les recommandations du département Comptabilité
- Renseigner les actions menées
- Ajouter les références des preuves
- Mettre à jour le statut

Lien d'accès : https://nod.company.com/shared/table/uuid-share-456?token=token-marie

Ce lien est valable jusqu'au 28 février 2025.

Cordialement,
L'équipe d'audit
```

---

### Phase 2 : Travail des Opérationnels

```
┌─────────────────────────────────────────────────────────────┐
│  OPÉRATIONNEL COMPTABILITÉ - PC Distant (Maison)            │
│  Marie Dupont - marie.dupont@company.com                    │
└─────────────────────────────────────────────────────────────┘

Action 1 : Ouvrir le lien
─────────────────────────
Clic sur le lien dans l'email
→ Navigateur s'ouvre sur https://nod.company.com/shared/...
→ Connexion automatique via token
→ WebSocket établi pour temps réel


Action 2 : Visualiser ses recommandations
─────────────────────────────────────────
GET /api/audit/shared/uuid-share-456/data

// Affichage filtré (seulement département Comptabilité)
┌──────┬─────────────────────────────────┬──────────┬─────────────┐
│ N°   │ Recommandation                  │ Priorité │ Échéance    │
├──────┼─────────────────────────────────┼──────────┼─────────────┤
│ R002 │ Mettre à jour procédure rappro  │ Élevée   │ 30/11/2024  │
│ R007 │ Automatiser justification TVA   │ Moyenne  │ 15/12/2024  │
│ R012 │ Documenter clôture comptable    │ Faible   │ 31/01/2025  │
└──────┴─────────────────────────────────┴──────────┴─────────────┘

// Marie voit uniquement 3 lignes sur 15


Action 3 : Remplir les actions menées (R002)
────────────────────────────────────────────
Clic sur ligne R002
→ Edition inline activée

Champ "Actions menées" :
[Procédure de rapprochement bancaire mise à jour le 15/11/2024.
 Formation des 2 comptables effectuée le 18/11/2024.
 Mise en application depuis le 20/11/2024.]

Champ "Preuves" :
[Document "PROC-RAPPRO-BANC-V2.pdf" stocké dans G:\Audit\Preuves\
 Feuille de présence formation du 18/11/2024
 Rapprochements Nov 2024 (3 fichiers Excel)]

Champ "Statut" :
[Terminé ▼]

→ Sauvegarde automatique après 1 seconde
→ PUT /api/audit/shared/uuid-share-456/data/row-uuid-r002

→ WebSocket broadcast aux autres utilisateurs connectés


Action 4 : Upload de pièce justificative
─────────────────────────────────────────
Bouton [📎 Joindre fichier]
→ Sélectionne "PROC-RAPPRO-BANC-V2.pdf"
→ Upload vers serveur
→ POST /api/audit/shared/uuid-share-456/data/row-uuid-r002/attachments

Résultat :
┌─────────────────────────────────────────────────────────┐
│ Pièces jointes (3) :                                    │
│ 📄 PROC-RAPPRO-BANC-V2.pdf (1.2 MB) [Télécharger]     │
│ 📄 Formation-18-11-2024.pdf (450 KB) [Télécharger]    │
│ 📊 Rapprochements-Nov-2024.xlsx (280 KB) [Télécharger]│
└─────────────────────────────────────────────────────────┘
```

---

```
┌─────────────────────────────────────────────────────────────┐
│  OPÉRATIONNEL DSI - PC Distant (Bureau)                     │
│  Jean Martin - jean.martin@company.com                      │
└─────────────────────────────────────────────────────────────┘

Action simultanée : Jean travaille en même temps
────────────────────────────────────────────────
Jean ouvre le lien à 14:30
Marie est déjà connectée depuis 14:00

Interface Jean :
┌─────────────────────────────────────────────────────────┐
│ 👤 Utilisateurs connectés :                             │
│ • Vous (Jean Martin)                                    │
│ • Marie Dupont - Édite ligne R002   ← Indicateur      │
└─────────────────────────────────────────────────────────┘

Jean voit ses recommandations (département DSI uniquement) :
┌──────┬─────────────────────────────────┬──────────┬─────────────┐
│ N°   │ Recommandation                  │ Priorité │ Échéance    │
├──────┼─────────────────────────────────┼──────────┼─────────────┤
│ R001 │ Renforcer contrôles accès BDD   │ Critique │ 31/12/2024  │
│ R005 │ Implémenter MFA                 │ Élevée   │ 15/12/2024  │
│ R009 │ Mettre à jour pare-feu          │ Moyenne  │ 31/01/2025  │
└──────┴─────────────────────────────────┴──────────┴─────────────┘

Jean remplit R001 en même temps que Marie remplit R002
→ Aucun conflit (lignes différentes)
→ Modifications synchronisées en temps réel
```

---

### Phase 3 : Suivi par l'Auditeur

```
┌─────────────────────────────────────────────────────────────┐
│  AUDITEUR - PC Bureau                                        │
│  Retour 2 jours plus tard                                    │
└─────────────────────────────────────────────────────────────┘

Action 1 : Consulter les mises à jour
──────────────────────────────────────
Ouvre la table dans Nod
→ GET /api/audit/schemas/uuid-schema-123/data

Vue auditeur (TOUTES les lignes, tous départements) :
┌──────┬─────────────────────┬──────────┬──────────┬─────────────┐
│ N°   │ Recommandation      │ Priorité │ Statut   │ Maj par     │
├──────┼─────────────────────┼──────────┼──────────┼─────────────┤
│ R001 │ Contrôles BDD       │ Critique │ En cours │ J. Martin ✓ │
│ R002 │ Procédure rappro    │ Élevée   │ Terminé  │ M. Dupont ✓ │
│ R003 │ Process recrutement │ Moyenne  │ À faire  │ -           │
│ R004 │ ...                 │ Élevée   │ En cours │ ...         │
└──────┴─────────────────────┴──────────┴──────────┴─────────────┘

Statistiques automatiques :
• 15 recommandations total
• 8 Terminées (53%)
• 5 En cours (33%)
• 2 À faire (13%)
• Taux d'avancement global : 53%


Action 2 : Consulter l'historique d'une ligne
──────────────────────────────────────────────
Clic droit sur R002 → [Voir l'historique]

┌─────────────────────────────────────────────────────────────┐
│ Historique de R002 - Procédure rapprochement bancaire      │
├─────────────────────────────────────────────────────────────┤
│ 20/11/2024 14:45 - Marie Dupont                            │
│ Statut : "À faire" → "Terminé"                             │
│ Actions menées : (rempli)                                   │
│ Preuves : (rempli)                                          │
│ 3 fichiers joints                                           │
│                                                             │
│ 20/11/2024 14:32 - Marie Dupont                            │
│ Actions menées : Première saisie                            │
│                                                             │
│ 12/11/2024 10:15 - Auditeur                                │
│ Création initiale                                           │
└─────────────────────────────────────────────────────────────┘


Action 3 : Télécharger les preuves
───────────────────────────────────
Clic sur R002 → Section "Pièces jointes"
→ Télécharge "PROC-RAPPRO-BANC-V2.pdf"
→ Vérifie que la procédure est conforme
→ Ajoute commentaire dans "Commentaire auditeur"

[Procédure vérifiée le 22/11/2024. Conforme aux recommandations.
 Formation effectuée. Recommandation validée.]


Action 4 : Exporter le suivi pour le rapport
────────────────────────────────────────────
Menu → Exporter → HTML

Génère un rapport professionnel :
┌─────────────────────────────────────────────────────────────┐
│           SUIVI DES RECOMMANDATIONS - MISSION 2024          │
│                    Généré le 22/11/2024                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Synthèse :                                                 │
│  • 15 recommandations émises                                │
│  • 8 recommandations clôturées (53%)                        │
│  • 5 recommandations en cours (33%)                         │
│  • 2 recommandations non démarrées (13%)                    │
│                                                             │
│  Détail par département :                                   │
│  • Comptabilité : 3/3 terminées (100%)                     │
│  • DSI : 2/4 terminées (50%)                               │
│  • RH : 1/3 terminées (33%)                                │
│  • DAF : 2/3 terminées (67%)                               │
│  • DG : 0/2 terminées (0%)                                 │
│                                                             │
│  [Tableau détaillé avec toutes les lignes...]              │
│                                                             │
│  Pièces justificatives collectées : 23 fichiers           │
│  Total taille : 18.5 MB                                    │
└─────────────────────────────────────────────────────────────┘

→ Annexe au rapport d'audit final
```

---

## 🔄 Synchronisation Temps Réel

### Scénario Concurrent

```
Heure : 14:30:00
Marie (Comptabilité) et Jean (DSI) travaillent simultanément

14:30:05 - Marie modifie R002.statut → "En cours"
         → WebSocket broadcast
         → Jean voit la modification instantanément (même s'il ne peut pas voir R002)
         → Auditeur voit la modification s'il est connecté

14:30:12 - Jean modifie R001.actions_menees → "Audit droits effectué"
         → WebSocket broadcast
         → Marie NE VOIT PAS (ligne filtrée, département DSI)
         → Auditeur voit la modification (il voit tout)

14:30:18 - Marie et Jean modifient en même temps leurs lignes respectives
         → Aucun conflit (lignes différentes)
         → Les deux modifications réussissent
         → PostgreSQL gère la concurrence via transactions

14:30:25 - Auditeur se connecte
         → Reçoit l'état actuel complet
         → WebSocket établi pour recevoir futures modifications
```

---

## 📊 Tableau de Bord Auditeur

### Vue Temps Réel

```
┌─────────────────────────────────────────────────────────────┐
│  TABLEAU DE BORD - SUIVI RECOMMANDATIONS                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Avancement Global : [████████████░░░] 53%                 │
│                                                             │
│  Par Priorité :                                             │
│  Critique (3)  : [████████████████] 67%  2/3               │
│  Élevée (5)    : [████████████░░░░] 60%  3/5               │
│  Moyenne (5)   : [████████░░░░░░░░] 40%  2/5               │
│  Faible (2)    : [████████░░░░░░░░] 50%  1/2               │
│                                                             │
│  Activité Récente : (temps réel)                           │
│  • Il y a 2 min - Marie Dupont a terminé R002              │
│  • Il y a 5 min - Jean Martin a mis à jour R001            │
│  • Il y a 15 min - Sophie Bernard a consulté le tableau    │
│                                                             │
│  Utilisateurs actuellement connectés : 2                    │
│  👤 Marie Dupont (Comptabilité)                            │
│  👤 Jean Martin (DSI)                                       │
│                                                             │
│  Alertes :                                                  │
│  ⚠️  R005 - Échéance dans 5 jours (15/12/2024)            │
│  🔴 R008 - Échéance dépassée de 2 jours !                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Permissions et Sécurité

### Matrice de Permissions

| Rôle                      | Voir lignes | Éditer          | Supprimer | Partager | Exporter | Historique       |
| ------------------------- | ----------- | --------------- | --------- | -------- | -------- | ---------------- |
| **Auditeur (owner)**      | Toutes      | ✅              | ✅        | ✅       | ✅       | ✅ Complet       |
| **Opérationnel (editor)** | Filtrées    | ✅ Ses colonnes | ❌        | ❌       | ✅       | ✅ Ses modifs    |
| **Direction (viewer)**    | Toutes      | ❌              | ❌        | ❌       | ✅       | ✅ Lecture seule |

### Colonnes en Lecture Seule pour Opérationnels

```typescript
{
  "column_permissions": {
    "numero": { "editable_by": ["owner"] },        // Auditeur seulement
    "recommandation": { "editable_by": ["owner"] },
    "priorite": { "editable_by": ["owner"] },
    "departement": { "editable_by": ["owner"] },
    "echeance": { "editable_by": ["owner"] },
    "responsable": { "editable_by": ["owner"] },

    "actions_menees": { "editable_by": ["owner", "editor"] },  // Tous
    "preuves": { "editable_by": ["owner", "editor"] },
    "statut": { "editable_by": ["owner", "editor"] },

    "commentaire_auditeur": { "editable_by": ["owner"] }  // Auditeur seulement
  }
}
```

Interface opérationnel :

```
┌──────┬─────────────────────┬──────────┬─────────────┬──────────┐
│ N°   │ Recommandation      │ Priorité │ Échéance    │ Statut   │
│ 🔒   │ 🔒                  │ 🔒       │ 🔒          │ ✏️       │ ← Légende
├──────┼─────────────────────┼──────────┼─────────────┼──────────┤
│ R002 │ Procédure rappro... │ Élevée   │ 30/11/2024  │ [Terminé▼]│
└──────┴─────────────────────┴──────────┴─────────────┴──────────┘

🔒 = Lecture seule (grisé)
✏️  = Éditable (surligné au survol)
```

---

## 📱 Interface Mobile (Future)

```
┌─────────────────────────────────┐
│  📱 Suivi Recommandations       │
│  ──────────────────────────── │
│                                 │
│  🔍 [Rechercher...         ]   │
│                                 │
│  📋 Mes recommandations (3)     │
│                                 │
│  ┌─────────────────────────────┐│
│  │ R002 🔴 Élevée              ││
│  │ Procédure rapprochement...  ││
│  │ ⏰ Échéance: 30/11/2024     ││
│  │ ✅ Terminé                  ││
│  └─────────────────────────────┘│
│                                 │
│  ┌─────────────────────────────┐│
│  │ R007 🟡 Moyenne             ││
│  │ Automatiser TVA...          ││
│  │ ⏰ Échéance: 15/12/2024     ││
│  │ 🔄 En cours                 ││
│  └─────────────────────────────┘│
│                                 │
│  [➕ Scanner QR Code]          │
└─────────────────────────────────┘
```

---

## ✅ Avantages de Cette Solution

### Pour l'Auditeur

```
✅ Créer et partager en quelques clics
✅ Suivi temps réel de l'avancement
✅ Historique complet de qui a fait quoi
✅ Export automatique pour le rapport
✅ Relances automatiques (échéances)
✅ Traçabilité audit-proof
```

### Pour les Opérationnels

```
✅ Accès simple par lien (aucune installation)
✅ Interface intuitive (comme Excel)
✅ Notifications des modifications
✅ Upload de preuves facilité
✅ Voir uniquement ses recommandations
✅ Travail à distance possible
```

### Pour l'Organisation

```
✅ Centralisation des données
✅ Réduction des emails avec pièces jointes
✅ Gain de temps considérable
✅ Meilleure collaboration
✅ Conformité RGPD garantie
✅ Données hébergées en interne
```

---

**Cette architecture permet une collaboration fluide et sécurisée, exactement comme NotebookLM ou les Spaces OpenAI, mais avec vos propres données et un contrôle total !** 🚀
