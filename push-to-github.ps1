# Script de sauvegarde vers GitHub
# Repository cible: https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git

Write-Host "=== Sauvegarde du projet nod_n8n vers GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Se positionner dans le répertoire du projet
Set-Location "h:\nod_n8n"

# 1. Vérifier l'état actuel
Write-Host "1. État actuel du repository..." -ForegroundColor Yellow
git status

# 2. Ajouter tous les fichiers modifiés
Write-Host ""
Write-Host "2. Ajout de tous les fichiers..." -ForegroundColor Yellow
git add .

# 3. Créer le commit
Write-Host ""
Write-Host "3. Création du commit..." -ForegroundColor Yellow
$dateCommit = Get-Date -Format "dd.MM.yyyy HH:mm"
git commit -m "Premier push - Sauvegarde nod_n8n - $dateCommit"

# 4. Changer l'URL du remote origin
Write-Host ""
Write-Host "4. Configuration du nouveau repository..." -ForegroundColor Yellow
git remote set-url origin https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git

# 5. Vérifier la configuration
Write-Host ""
Write-Host "5. Vérification de la connexion..." -ForegroundColor Yellow
git remote -v

# 6. Afficher la branche actuelle
Write-Host ""
Write-Host "6. Branche actuelle..." -ForegroundColor Yellow
git branch

# 7. Push vers GitHub
Write-Host ""
Write-Host "7. Envoi vers GitHub..." -ForegroundColor Yellow
Write-Host "   (Vous devrez peut-être entrer vos identifiants GitHub)" -ForegroundColor Gray
git push -u origin main

Write-Host ""
Write-Host "=== Sauvegarde terminée avec succès ! ===" -ForegroundColor Green
Write-Host "Repository: https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26" -ForegroundColor Green
