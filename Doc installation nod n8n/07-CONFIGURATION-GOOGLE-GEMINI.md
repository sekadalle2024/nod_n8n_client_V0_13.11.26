# Configuration Google Gemini dans Nod

## Oui, vous pouvez utiliser une clé API Google AI Studio !

Nod supporte **deux types de clés Google** pour accéder aux modèles Gemini :

### 1. Google AI Studio (Recommandé pour développement) ⭐

**Provider :** `google`  
**Variable d'environnement :** `GEMINI_API_KEY`  
**URL d'obtention :** https://aistudio.google.com/api-keys

**Avantages :**

- ✅ Gratuit avec quota généreux (60 requêtes/minute)
- ✅ Configuration simple (juste une clé API)
- ✅ Accès immédiat aux modèles Gemini (Flash, Pro, etc.)
- ✅ Idéal pour développement et tests

**Modèles disponibles :**

- `gemini-2.5-flash` (rapide, moins cher)
- `gemini-2.5-pro` (plus puissant)
- `gemini-3.8-flash` (dernière version)
- `gemini-4-argon` (version payante)

### 2. Google Vertex AI (Pour production)

**Provider :** `google-vertex`  
**Variable d'environnement :** `GOOGLE_CLOUD_API_KEY`  
**URL d'obtention :** https://console.cloud.google.com/apis/credentials

**Nécessite :**

- Un projet Google Cloud Platform
- Activation de l'API Vertex AI
- Configuration de la facturation

---

## Configuration dans Nod

### Méthode 1 : Via l'interface web (Recommandé)

1. **Connectez-vous à Nod** avec le jeton d'accès
2. **Allez dans Settings → Models**
3. **Cliquez sur "Add Model Connection"**
4. **Sélectionnez "Google Gemini"**
5. **Collez votre clé API Google AI Studio**
6. **Sélectionnez le modèle par défaut** (ex: `gemini-2.5-flash`)

### Méthode 2 : Via le fichier .env

Ajoutez cette ligne au fichier `.env` :

```env
GEMINI_API_KEY=AIzaSy...votre_cle_ici...
```

**Fichier .env complet :**

```env
PORT=4310
NOD_HOST=127.0.0.1
NOD_DATA_ROOT=.local
NOD_POSTGRES_PASSWORD=B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS
DATABASE_URL=postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod
NODE_ENV=development

# Google Gemini API Key (Google AI Studio)
GEMINI_API_KEY=AIzaSy...votre_cle_ici...
```

**Redémarrez le serveur :**

```powershell
# Dans le terminal où tourne le serveur
# Ctrl+C pour arrêter
# Puis relancer :
pnpm exec tsx src/server/index.ts
```

---

## Obtenir une clé Google AI Studio

### Étapes détaillées :

1. **Allez sur** https://aistudio.google.com/api-keys

2. **Connectez-vous** avec votre compte Google

3. **Cliquez sur "Create API Key"**
   - Vous pouvez créer la clé dans un projet existant
   - Ou créer un nouveau projet

4. **Copiez la clé** (format : `AIzaSy...`)
   - ⚠️ **Important :** Conservez cette clé en sécurité
   - Elle ne sera affichée qu'une seule fois

5. **Testez la clé** dans Nod :
   - Méthode rapide : copiez-collez dans l'interface web
   - Méthode permanente : ajoutez au fichier `.env`

---

## Vérification de la configuration

### Test 1 : Via les logs serveur

Quand vous démarrez le serveur avec une clé valide, vous devriez voir :

```
[INFO] Google Gemini models loaded
[INFO] Available models: gemini-2.5-flash, gemini-2.5-pro
```

### Test 2 : Via l'API Nod

Une fois connecté à l'interface web, essayez une conversation :

```
Utilisateur : "Hello, quel modèle utilises-tu ?"
Nod : "J'utilise gemini-2.5-flash de Google"
```

### Test 3 : Via curl (test direct)

```bash
curl -X GET "https://generativelanguage.googleapis.com/v1beta/models?key=VOTRE_CLE_API"
```

Si la clé est valide, vous recevrez la liste des modèles disponibles.

---

## Quotas et limites (Google AI Studio gratuit)

| Ressource               | Limite gratuite |
| ----------------------- | --------------- |
| **Requêtes par minute** | 60              |
| **Requêtes par jour**   | 1,500           |
| **Tokens par minute**   | ~32,000         |
| **Coût**                | Gratuit         |

**Pour augmenter les limites :**

- Passez à Google Cloud Vertex AI (facturation au token)
- Ou attendez le prochain jour (réinitialisation quotidienne)

---

## Dépannage

### Erreur : "Google Gemini didn't accept this API key"

**Causes possibles :**

1. **Clé invalide ou expirée**
   - Vérifiez que vous avez copié la clé complète
   - Régénérez une nouvelle clé si nécessaire

2. **Quota dépassé**
   - Vérifiez sur https://aistudio.google.com/api-keys
   - Attendez la réinitialisation (minuit UTC)

3. **API non activée**
   - Activez "Generative Language API" dans Google Cloud Console
   - https://console.cloud.google.com/apis/library

### Erreur : "Models not available"

**Solution :**

```bash
# Vérifiez que la variable d'environnement est définie
echo $env:GEMINI_API_KEY  # Windows PowerShell

# Redémarrez le serveur après modification du .env
pnpm exec tsx src/server/index.ts
```

---

## Comparaison : Google AI Studio vs Vertex AI

| Critère           | Google AI Studio | Google Vertex AI      |
| ----------------- | ---------------- | --------------------- |
| **Configuration** | Simple (1 clé)   | Complexe (projet GCP) |
| **Coût**          | Gratuit (quotas) | Payant (à l'usage)    |
| **Quotas**        | 60 req/min       | Illimité (facturé)    |
| **Usage**         | Dev/Test         | Production            |
| **Modèles**       | Gemini standard  | Gemini + fine-tuning  |
| **SLA**           | Aucun            | Garanti               |

**Recommandation :** Commencez avec **Google AI Studio**, passez à **Vertex AI** si vous dépassez les quotas gratuits.

---

## Résumé rapide

```bash
# 1. Obtenez votre clé
https://aistudio.google.com/api-keys

# 2. Ajoutez au .env
GEMINI_API_KEY=AIzaSy...

# 3. Redémarrez Nod
pnpm exec tsx src/server/index.ts

# 4. Connectez-vous à l'interface web
http://localhost:4310/#access=KXkl8AoKlM3iFaXdP9e9RjCAiyHIyAbbYdchI2DkaRU
```

**C'est tout ! Vous pouvez maintenant utiliser Gemini dans Nod.** 🚀
