# 🔄 Procédures de Rollback - SaaS Multi-Utilisateurs

Ce document détaille comment **annuler** chaque modification en cas de problème.

---

## ⚠️ Principe Général

**Avant toute modification critique** :

1. Créer un backup
2. Tester dans un environnement isolé si possible
3. Garder ce document ouvert pour rollback rapide

---

## 🗄️ Rollback Base de Données

### Annuler la Migration SQL

#### Option 1 : Restaurer depuis Backup

**Si vous avez créé un backup (Phase 1.1)** :

```bash
# Arrêter le serveur Nod
# Ctrl+C dans le terminal où il tourne

# Restaurer le backup
docker exec -i nod-postgres-1 psql -U nod -d nod < backup-YYYYMMDD-HHMMSS.sql

# Redémarrer le serveur
pnpm exec tsx src/server/index.ts
```

**Validation** :

- ✅ Tables `users` et `user_sessions` n'existent plus
- ✅ Schémas `user_X` supprimés
- ✅ Base de données identique à avant migration

---

#### Option 2 : Rollback Manuel (Sans Backup)

**Si pas de backup, script de rollback SQL** :

**Fichier** : `migrations/rollback-001-multi-user-schema.sql`

```sql
BEGIN;

-- Supprimer le trigger
DROP TRIGGER IF EXISTS create_user_schema_trigger ON public.users;

-- Supprimer la fonction
DROP FUNCTION IF EXISTS create_user_schema();

-- Supprimer tous les schémas user_X
DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN
    SELECT nspname FROM pg_namespace WHERE nspname LIKE 'user_%'
  LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', schema_name);
  END LOOP;
END $$;

-- Supprimer les tables publiques
DROP TABLE IF EXISTS public.user_sessions CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Supprimer la fonction de trigger updated_at
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

COMMIT;
```

**Exécuter** :

```bash
docker exec -it nod-postgres-1 psql -U nod -d nod

# Copier-coller le contenu ci-dessus
# Ou
\i /chemin/vers/migrations/rollback-001-multi-user-schema.sql
```

**Validation** :

```sql
-- Vérifier que les tables n'existent plus
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('users', 'user_sessions');
-- Doit retourner 0 ligne

-- Vérifier que les schémas user_X sont supprimés
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'user_%';
-- Doit retourner 0 ligne
```

---

## 🔌 Rollback Backend (Code)

### Annuler Module Auth

**Supprimer les fichiers créés** :

```bash
# Supprimer tout le dossier auth
Remove-Item -Recurse -Force "h:\nod_n8n\src\server\auth"

# Supprimer multi-tenant
Remove-Item -Force "h:\nod_n8n\src\server\db\multi-tenant.ts"

# Supprimer routes auth
Remove-Item -Force "h:\nod_n8n\src\server\routes\auth.ts"
```

---

### Restaurer Serveur Principal (index.ts)

**Si vous avez créé un backup (Phase 3.5)** :

```bash
# Restaurer le backup
Copy-Item "h:\nod_n8n\src\server\index.ts.backup" "h:\nod_n8n\src\server\index.ts" -Force
```

**Si pas de backup, restaurer depuis Git** :

```bash
cd h:\nod_n8n

# Vérifier les modifications
git diff src/server/index.ts

# Annuler les modifications
git checkout src/server/index.ts
```

**Validation** :

```bash
# Compiler
pnpm run build

# Doit compiler sans erreur et sans référence à 'auth'
```

---

## 🎨 Rollback Frontend (React)

### Annuler Composants Auth

**Supprimer les fichiers créés** :

```bash
# Supprimer hook useAuth
Remove-Item -Force "h:\nod_n8n\src\web\hooks\useAuth.ts"

# Supprimer LoginPage
Remove-Item -Force "h:\nod_n8n\src\web\pages\LoginPage.tsx"

# Supprimer PrivateRoute
Remove-Item -Force "h:\nod_n8n\src\web\components\PrivateRoute.tsx"
```

---

### Restaurer App.tsx

**Si vous avez créé un backup (Phase 4.4)** :

```bash
Copy-Item "h:\nod_n8n\src\web\App.tsx.backup" "h:\nod_n8n\src\web\App.tsx" -Force
```

**Si pas de backup, restaurer depuis Git** :

```bash
git checkout src/web/App.tsx
```

**Validation** :

```bash
pnpm run build
# Doit compiler sans erreur
```

---

## 📦 Rollback Dépendances NPM

### Désinstaller Packages Auth

```bash
cd h:\nod_n8n

# Désinstaller bcrypt et jsonwebtoken
pnpm remove bcrypt jsonwebtoken
pnpm remove -D @types/bcrypt @types/jsonwebtoken

# Réinstaller dépendances propres
pnpm install
```

**Validation** :

```bash
# Vérifier package.json
cat package.json | grep -E "(bcrypt|jsonwebtoken)"
# Ne doit rien retourner
```

---

## 🔐 Rollback Variables d'Environnement

### Supprimer JWT_SECRET

**Éditer `.env`** :

```bash
# Ouvrir .env
notepad h:\nod_n8n\.env

# Supprimer la ligne
JWT_SECRET=...

# Sauvegarder et fermer
```

---

## 🐳 Rollback Docker (Optionnel)

### Si Vous Avez Modifié Docker

**Restaurer compose.yaml** :

```bash
git checkout compose.yaml
```

**Recréer les conteneurs** :

```bash
docker compose down
docker compose up -d --build
```

---

## ✅ Validation Complète du Rollback

### Checklist de Vérification

- [ ] Base de données restaurée (pas de tables `users`, `user_sessions`)
- [ ] Schémas `user_X` supprimés
- [ ] Fichiers auth supprimés
- [ ] `src/server/index.ts` restauré
- [ ] `src/web/App.tsx` restauré
- [ ] Packages NPM désinstallés
- [ ] `.env` nettoyé
- [ ] Projet compile sans erreur
- [ ] Serveur démarre sans erreur
- [ ] Accès à Nod fonctionne comme avant

---

### Test de Régression

**Vérifier que l'ancienne version fonctionne** :

```bash
# Compiler
pnpm run build

# Démarrer le serveur
pnpm exec tsx src/server/index.ts

# Accéder à Nod
# http://localhost:4310/#access=<token>

# Doit fonctionner comme avant la modification
```

**Validation** :

- ✅ Serveur démarre sans erreur
- ✅ Pas de mention de "auth" ou "login" dans les logs
- ✅ Chat accessible avec l'ancien système de token

---

## 🆘 Rollback d'Urgence (Nuclear Option)

### Si Tout Échoue

**Option 1 : Restaurer depuis Git**

```bash
cd h:\nod_n8n

# Annuler TOUTES les modifications
git reset --hard HEAD

# Nettoyer les fichiers non trackés
git clean -fd

# Réinstaller dépendances
pnpm install

# Rebuild
pnpm run build
```

**Option 2 : Réinstallation Complète**

```bash
# Sauvegarder .env
Copy-Item "h:\nod_n8n\.env" "h:\nod_n8n\.env.backup"

# Supprimer le dossier
Remove-Item -Recurse -Force "h:\nod_n8n"

# Recloner
git clone https://github.com/n8n-io/nod.git h:\nod_n8n
cd h:\nod_n8n

# Restaurer .env
Copy-Item "h:\.env.backup" ".env"

# Réinstaller
pnpm install
pnpm run build
```

---

## 📝 Logs de Rollback

### Template de Rapport

```markdown
# Rapport de Rollback

Date : __________
Raison : __________

## Actions Effectuées

- [ ] Rollback base de données
- [ ] Restauration fichiers backend
- [ ] Restauration fichiers frontend
- [ ] Désinstallation packages NPM
- [ ] Nettoyage .env

## Validation

- [ ] Projet compile
- [ ] Serveur démarre
- [ ] Nod accessible

## Problèmes Rencontrés

1. ...
2. ...

## État Final

- [ ] ✅ Système restauré à l'état initial
- [ ] ⚠️ Partiellement restauré
- [ ] ❌ Échec du rollback (voir Nuclear Option)

## Notes

...
```

---

## 🎯 Prévention

### Pour Éviter les Rollbacks

1. **Tester d'abord sur une copie** :

   ```bash
   # Dupliquer le dossier
   Copy-Item -Recurse "h:\nod_n8n" "h:\nod_n8n_test"

   # Tester dans la copie
   cd h:\nod_n8n_test
   # ... effectuer les modifications

   # Si OK, appliquer sur l'original
   ```

2. **Commits Git fréquents** :

   ```bash
   git add .
   git commit -m "Checkpoint: before auth migration"
   ```

3. **Backup automatique PostgreSQL** :
   ```bash
   # Cron job ou tâche planifiée
   docker exec nod-postgres-1 pg_dump -U nod nod > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

---

**En cas de doute, n'hésitez pas à faire un rollback complet plutôt que de perdre des données ! 🛟**
