# 🚀 Guide Rapide : Ajouter Google Gemini à Nod

## ✅ Oui, vous pouvez utiliser votre clé Google AI Studio !

### Étape 1 : Obtenez votre clé API (2 minutes)

1. Allez sur : **https://aistudio.google.com/api-keys**
2. Connectez-vous avec votre compte Google
3. Cliquez sur **"Create API Key"**
4. Copiez la clé (format : `AIzaSy...`)

### Étape 2 : Configuration dans Nod

**Option A : Via l'interface web** ⭐ (Recommandé)

1. Connectez-vous à Nod : http://localhost:4310
2. Allez dans **Settings** (⚙️)
3. Section **Models**
4. Cliquez **"Add Connection"**
5. Choisissez **"Google Gemini"**
6. Collez votre clé API
7. Sélectionnez **gemini-2.5-flash** (gratuit, rapide)
8. Enregistrez

**Option B : Via le fichier .env**

```bash
# Ouvrez le fichier .env et ajoutez :
GEMINI_API_KEY=AIzaSy...votre_cle_ici...

# Redémarrez le serveur :
# Ctrl+C dans le terminal, puis :
pnpm exec tsx src/server/index.ts
```

### Étape 3 : Testez

Dans le chat Nod :

```
Vous : "Hello, quel modèle utilises-tu ?"
Nod : "J'utilise gemini-2.5-flash de Google"
```

---

## 💰 Gratuit ou payant ?

### Google AI Studio (Gratuit) ✅

- **60 requêtes par minute**
- **1,500 requêtes par jour**
- Parfait pour développement et usage personnel
- Aucune carte bancaire requise

### Google Vertex AI (Payant)

- Nécessite un compte Google Cloud Platform
- Facturation au token
- Pour production et usage intensif

---

## 🔧 Dépannage rapide

### "API Key invalide"

- Vérifiez que vous avez copié la clé complète (commence par `AIzaSy`)
- Assurez-vous qu'il n'y a pas d'espaces avant/après

### "Quota dépassé"

- Vous avez atteint 60 requêtes/minute ou 1,500/jour
- Attendez la prochaine période (renouvellement quotidien à minuit UTC)

### "Modèle non disponible"

- Redémarrez le serveur après avoir modifié le `.env`
- Vérifiez que `GEMINI_API_KEY` est bien défini

---

## 📊 Modèles disponibles

| Modèle                  | Usage            | Vitesse     | Coût    |
| ----------------------- | ---------------- | ----------- | ------- |
| **gemini-2.5-flash** ⭐ | Général          | Rapide      | Gratuit |
| **gemini-2.5-pro**      | Complexe         | Moyen       | Gratuit |
| **gemini-3.8-flash**    | Dernière version | Très rapide | Gratuit |

**Recommandation :** Commencez avec `gemini-2.5-flash`

---

## ✨ Prochaines étapes

Une fois Gemini configuré :

1. **Testez le système de persistance des tables d'audit**
2. **Configurez n8n pour envoyer les tables vers Nod**
3. **Créez l'interface de modification des tables**

Besoin d'aide ? Consultez `Doc installation nod n8n/07-CONFIGURATION-GOOGLE-GEMINI.md`
