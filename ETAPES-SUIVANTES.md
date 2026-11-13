# ✅ Configuration Nod - Étapes Suivantes

## État actuel

✅ **Serveur Nod en ligne** : http://localhost:4310  
✅ **Vault Key configurée** : `NOD_VAULT_KEY` dans `.env`  
✅ **Google Gemini API Key** : `GEMINI_API_KEY` dans `.env`  
✅ **PostgreSQL actif** : Port 54329  
✅ **Système de persistance** : Backend complet (11 endpoints)

---

## 🔐 Étape 1 : Connecter Google Gemini dans l'interface web

Le serveur a redémarré avec les nouvelles configurations. Maintenant :

### Dans votre navigateur :

1. **Rechargez la page** : http://localhost:4310
   - Ou reconnectez-vous avec le jeton : `KXkl8AoKlM3iFaXdP9e9RjCAiyHIyAbbYdchI2DkaRU`

2. **Allez dans Settings** (⚙️ en haut à droite)

3. **Section "Models"** ou "Connections"

4. **Cliquez "Add Connection"** ou "Connect Model"

5. **Sélectionnez "Google Gemini"**

6. **Collez votre clé API** :

   ```
   AQ.Ab8RN6IEycTIxeVdlnx-h1a7g56ZK2uVRFvtKeLQq60kF5PidA
   ```

7. **Choisissez le modèle par défaut** :
   - Recommandé : `gemini-2.5-flash` (rapide, gratuit)

8. **Cliquez "Connect" ou "Save"**

Cette fois, **ça devrait fonctionner** car `NOD_VAULT_KEY` est maintenant configuré ! ✅

---

## 🧪 Étape 2 : Tester Google Gemini

Dans le chat Nod, tapez :

```
Hello! Peux-tu me confirmer quel modèle tu utilises ?
```

**Réponse attendue :**

```
Bonjour ! J'utilise gemini-2.5-flash de Google.
```

---

## 📊 Étape 3 : Tester le système de persistance des tables

### Test rapide via l'API :

Ouvrez un nouveau terminal PowerShell et testez :

```powershell
# Test 1 : Créer une table d'audit
$body = @{
    user_id = "user123"
    table_name = "audit_risques"
    display_name = "Table des Risques"
    n8n_workflow_id = "workflow_001"
    column_definitions = @(
        @{ name = "assertion"; type = "text"; required = $true }
        @{ name = "niveau_risque"; type = "select"; options = @("Faible", "Moyen", "Élevé") }
        @{ name = "montant"; type = "number" }
    )
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:4310/api/audit/schemas" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"
```

**Résultat attendu :**

```json
{
  "id": 1,
  "user_id": "user123",
  "table_name": "audit_risques",
  "display_name": "Table des Risques",
  "column_definitions": [...]
}
```

### Test 2 : Insérer des données

```powershell
$data = @{
    row_data = @{
        assertion = "Existence des stocks"
        niveau_risque = "Élevé"
        montant = 150000
    }
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:4310/api/audit/schemas/1/data" `
    -Method POST `
    -Body $data `
    -ContentType "application/json"
```

### Test 3 : Récupérer les données

```powershell
Invoke-RestMethod -Uri "http://localhost:4310/api/audit/schemas/1/data" `
    -Method GET
```

---

## 📁 Étape 4 : Tester avec vos vraies tables n8n

Vous avez 5 fichiers JSON de tables réelles dans :

```
Doc systeme de persistance/tests-audit-tables/
├── table-taches-roulement-validation.json (20 lignes)
├── table-tests-cadence-rotation.json (20 lignes)
├── table-tests-details-immobilisations.json (20 lignes)
├── table-tests-immobilisations.json (10 lignes)
└── table-tiers-releves.json (17 lignes)
```

**Script de test complet** :

```powershell
cd "Doc systeme de persistance/tests-audit-tables"
node run-tests.mjs
```

Ce script va :

1. Créer les 5 tables
2. Insérer toutes les données (87 lignes au total)
3. Tester les modifications
4. Tester les consolidations
5. Tester les versions

---

## 🎨 Étape 5 : Créer l'interface frontend

Une fois les tests backend validés, nous créerons :

### Composants React à développer :

1. **`<EditableDataTable>`** - Tableau avec édition inline
   - Cellules éditables au clic
   - Menus déroulants pour colonnes `select`
   - Validation en temps réel

2. **`<ConsolidationGrid>`** - Vue des consolidations
   - Agrégations par assertion
   - Totaux automatiques
   - Formules visibles

3. **`<VersionHistoryModal>`** - Historique des modifications
   - Timeline des changements
   - Diff visuel avant/après
   - Restauration de version

4. **`<CollaborativeEditor>`** - Édition multi-utilisateurs
   - WebSocket en temps réel
   - Curseurs des autres utilisateurs
   - Notifications de modifications

5. **`<TableStructureEditor>`** - Gestion des colonnes
   - Ajouter/supprimer colonnes
   - Renommer colonnes
   - Définir types et options

---

## 🔗 Étape 6 : Intégrer avec n8n

Créer un webhook dans Nod pour recevoir les tables de n8n :

```typescript
// Endpoint : POST /api/audit/from-n8n
app.post('/api/audit/from-n8n', async (request, reply) => {
  const { workflow_id, table_name, columns, data } = request.body;

  // 1. Créer le schéma de table
  const schema = await createTableSchema({
    user_id: 'n8n_user',
    table_name,
    n8n_workflow_id: workflow_id,
    column_definitions: columns,
  });

  // 2. Insérer les données en masse
  await bulkInsertTableData(schema.id, data);

  return { success: true, table_id: schema.id };
});
```

**Dans n8n**, ajoutez un nœud HTTP Request à la fin de votre workflow :

```
URL: http://localhost:4310/api/audit/from-n8n
Method: POST
Body: {{ $json }}
```

---

## 📋 Checklist de progression

### Configuration serveur ✅

- [x] Docker containers running
- [x] PostgreSQL healthy
- [x] Serveur Nod démarré
- [x] Vault Key configurée
- [x] Gemini API Key ajoutée

### Configuration interface ⏳

- [ ] Gemini connecté dans l'UI
- [ ] Test conversation avec Gemini
- [ ] Vérification des modèles disponibles

### Tests backend ⏳

- [ ] API créer table
- [ ] API insérer données
- [ ] API modifier données
- [ ] API versions
- [ ] API consolidations
- [ ] Tests avec tables réelles (5 fichiers JSON)

### Développement frontend 🔜

- [ ] Composant EditableDataTable
- [ ] Composant ConsolidationGrid
- [ ] Composant VersionHistory
- [ ] WebSocket collaboration
- [ ] Interface gestion colonnes

### Intégration n8n 🔜

- [ ] Webhook endpoint
- [ ] Configuration n8n workflow
- [ ] Test import automatique
- [ ] Documentation utilisateur

---

## 🚀 Prochaine action immédiate

**Dans votre navigateur :**

1. Rechargez http://localhost:4310
2. Entrez le jeton : `KXkl8AoKlM3iFaXdP9e9RjCAiyHIyAbbYdchI2DkaRU`
3. Allez dans Settings → Models
4. Connectez Google Gemini avec votre clé
5. Testez une conversation

**Ensuite :**

- Lancez les tests backend : `node "Doc systeme de persistance/tests-audit-tables/run-tests.mjs"`
- Dites-moi si ça fonctionne ou s'il y a des erreurs

---

## 📞 Besoin d'aide ?

Si vous rencontrez un problème :

1. Vérifiez les logs du serveur (terminal où tourne tsx)
2. Vérifiez la console du navigateur (F12)
3. Partagez le message d'erreur

**Tout est prêt côté serveur. À vous de jouer ! 🎮**
