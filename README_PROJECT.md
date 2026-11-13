# nod_n8n Client - Version Personnalisée

## 📋 À Propos

Ce projet est une version personnalisée de [Nod par n8n](https://github.com/n8n-io/nod), un assistant IA conversationnel.

**Repository:** https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git

## 🏗️ Basé sur

- **Projet original:** n8n-io/nod
- **Date de fork:** 13 novembre 2026
- **Version:** V0 - 13.11.26

## 🚀 Installation et Démarrage

### Prérequis

- Node.js (version recommandée dans le projet original)
- npm ou pnpm
- Git

### Installation

```powershell
# Cloner le repository
git clone https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git
cd nod_n8n_client_V0_13.11.26

# Installer les dépendances
npm install
# ou
pnpm install

# Copier le fichier d'environnement
Copy-Item .env.example .env

# Configurer les variables d'environnement dans .env
```

### Démarrage

```powershell
# Mode développement
npm run dev

# Mode production
npm run build
npm start
```

## 📁 Structure du Projet

```
nod_n8n/
├── src/                    # Code source
│   ├── server/            # Backend Node.js
│   └── web/               # Frontend React
├── desktop/               # Application Electron
├── docs/                  # Documentation
├── deployment/            # Scripts de déploiement
├── .env.example          # Template variables d'environnement
└── GITHUB_PUSH_GUIDE.md  # Guide de sauvegarde GitHub
```

## 🔧 Configuration

### Fichier .env

Créez un fichier `.env` à la racine du projet avec les variables nécessaires :

```env
# Voir .env.example pour la liste complète des variables
```

⚠️ **Important:** Ne jamais commiter le fichier `.env` contenant vos clés API !

## 📝 Documentation Personnalisée

Ce projet inclut de la documentation supplémentaire :

- `Doc installation nod n8n/` - Guides d'installation
- `Doc workspace team/` - Documentation d'équipe
- `GITHUB_PUSH_GUIDE.md` - Guide de sauvegarde GitHub

## 🔄 Workflow de Développement

### Effectuer des Modifications

1. **Créer une branche pour votre fonctionnalité**

   ```powershell
   git checkout -b feature/ma-nouvelle-fonctionnalite
   ```

2. **Faire vos modifications**

   ```powershell
   # Développer, tester...
   ```

3. **Commiter vos changements**

   ```powershell
   git add .
   git commit -m "feat: Description de la fonctionnalité"
   ```

4. **Pusher vers GitHub**
   ```powershell
   git push origin feature/ma-nouvelle-fonctionnalite
   ```

### Sauvegarder Régulièrement

```powershell
# Vérifier avant de pusher
.\verify-before-push.ps1

# Script automatique de sauvegarde
.\push-to-github.ps1
```

## 🛠️ Scripts Utiles

### Scripts PowerShell Inclus

- `push-to-github.ps1` - Sauvegarde automatique vers GitHub
- `verify-before-push.ps1` - Vérification avant push
- `build-docker.ps1` - Construction de l'image Docker

### Scripts npm

Consultez le `package.json` pour la liste complète des scripts disponibles.

## 🔐 Sécurité

### Fichiers à Ne Jamais Commiter

- `.env` - Variables d'environnement et clés API
- `.local/` - Données locales de l'application
- `node_modules/` - Dépendances npm
- Fichiers de logs personnels
- Clés SSH ou tokens d'accès

Ces fichiers sont déjà listés dans `.gitignore`.

## 🐛 Débogage

### Problèmes Courants

1. **Erreur de dépendances**

   ```powershell
   # Supprimer node_modules et réinstaller
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

2. **Problèmes Git**
   ```powershell
   # Vérifier la configuration
   git config --list
   git remote -v
   ```

## 📞 Support

Pour les questions spécifiques à cette version personnalisée :

- Créer une issue sur le repository GitHub
- Consulter la documentation dans `/docs`

Pour les questions sur le projet original Nod :

- [Documentation officielle Nod](https://github.com/n8n-io/nod)
- [Communauté n8n](https://community.n8n.io/)

## 📜 Licence

Ce projet hérite de la licence du projet original Nod par n8n.
Consultez le fichier LICENSE pour plus de détails.

## 🙏 Remerciements

- Équipe n8n pour le projet original Nod
- Tous les contributeurs du projet open-source

---

**Version:** V0 - 13.11.2026  
**Dernière mise à jour:** 13 novembre 2026  
**Mainteneur:** sekadalle2024
