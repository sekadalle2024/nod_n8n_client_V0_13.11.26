# Script de Push Interactif vers GitHub
# Version guidée étape par étape

$ErrorActionPreference = "Continue"

function Write-Title {
    param($Text)
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Yellow
    Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param($Number, $Text)
    Write-Host ""
    Write-Host "📍 Étape $Number : $Text" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────" -ForegroundColor Gray
}

function Pause-AndContinue {
    Write-Host ""
    Write-Host "Appuyez sur Entrée pour continuer..." -ForegroundColor Yellow
    $null = Read-Host
}

function Test-GitInstalled {
    try {
        $gitVersion = git --version 2>$null
        return $true
    }
    catch {
        return $false
    }
}

# Bannière de démarrage
Clear-Host
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║     🚀 PUSH VERS GITHUB - MODE INTERACTIF 🚀        ║" -ForegroundColor Yellow
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "║     Repository: nod_n8n_client_V0_13.11.26          ║" -ForegroundColor White
Write-Host "║                                                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérification Git
Write-Step "0" "Vérification de Git"
if (-not (Test-GitInstalled)) {
    Write-Host "❌ Git n'est pas installé ou pas dans le PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "📥 Installez Git depuis : https://git-scm.com/download/win" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Appuyez sur Entrée pour quitter"
    exit 1
}
else {
    $gitVersion = git --version
    Write-Host "✅ Git est installé : $gitVersion" -ForegroundColor Green
}

Pause-AndContinue

# Se positionner dans le projet
Set-Location "h:\nod_n8n"

# Étape 1 : État actuel
Write-Step "1" "État Actuel du Repository"
Write-Host "Répertoire actuel : $(Get-Location)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration du remote :" -ForegroundColor Cyan
git remote -v
Write-Host ""
Write-Host "Branche actuelle :" -ForegroundColor Cyan
git branch

Pause-AndContinue

# Étape 2 : Voir les fichiers modifiés
Write-Step "2" "Fichiers à Sauvegarder"
Write-Host "Voici les fichiers qui seront ajoutés :" -ForegroundColor Cyan
Write-Host ""
$status = git status --short
if ($status) {
    $statusArray = $status -split "`n"
    $count = $statusArray.Count
    
    if ($count -le 30) {
        $status
    }
    else {
        $statusArray | Select-Object -First 30
        Write-Host "... et $($count - 30) fichiers supplémentaires" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "📊 Total : $count fichiers" -ForegroundColor Yellow
}
else {
    Write-Host "✓ Aucun fichier modifié (déjà à jour)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Voulez-vous continuer avec ces fichiers ? (O/N)" -ForegroundColor Yellow
$continue = Read-Host
if ($continue -ne "O" -and $continue -ne "o" -and $continue -ne "") {
    Write-Host "❌ Annulation du push" -ForegroundColor Red
    exit 0
}

# Étape 3 : Ajouter les fichiers
Write-Step "3" "Ajout des Fichiers"
Write-Host "Ajout de tous les fichiers modifiés..." -ForegroundColor Cyan
git add .
Write-Host "✅ Fichiers ajoutés" -ForegroundColor Green

Pause-AndContinue

# Étape 4 : Créer le commit
Write-Step "4" "Création du Commit"
$defaultMessage = "Premier push - Sauvegarde nod_n8n - $(Get-Date -Format 'dd.MM.yyyy HH:mm')"
Write-Host "Message de commit par défaut :" -ForegroundColor Cyan
Write-Host "  $defaultMessage" -ForegroundColor White
Write-Host ""
Write-Host "Voulez-vous utiliser ce message ? (O/N)" -ForegroundColor Yellow
Write-Host "Tapez N pour entrer votre propre message" -ForegroundColor Gray
$useDefault = Read-Host

if ($useDefault -eq "N" -or $useDefault -eq "n") {
    Write-Host ""
    Write-Host "Entrez votre message de commit :" -ForegroundColor Yellow
    $commitMessage = Read-Host
}
else {
    $commitMessage = $defaultMessage
}

Write-Host ""
Write-Host "Création du commit avec : $commitMessage" -ForegroundColor Cyan
git commit -m "$commitMessage"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit créé avec succès" -ForegroundColor Green
}
else {
    Write-Host "⚠️ Aucun changement à commiter ou erreur" -ForegroundColor Yellow
}

Pause-AndContinue

# Étape 5 : Configuration du remote
Write-Step "5" "Configuration du Repository GitHub"
$newRemote = "https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git"
Write-Host "Nouveau repository : $newRemote" -ForegroundColor Cyan
Write-Host ""
Write-Host "Configuration du remote origin..." -ForegroundColor Cyan
git remote set-url origin $newRemote

Write-Host ""
Write-Host "Vérification :" -ForegroundColor Cyan
git remote -v
Write-Host ""
Write-Host "✅ Remote configuré" -ForegroundColor Green

Pause-AndContinue

# Étape 6 : Information sur l'authentification
Write-Step "6" "Authentification GitHub"
Write-Host "⚠️  IMPORTANT : Authentification Requise" -ForegroundColor Yellow
Write-Host ""
Write-Host "Lors du push, GitHub vous demandera vos identifiants." -ForegroundColor White
Write-Host ""
Write-Host "🔑 Options d'authentification :" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Option 1 : Personal Access Token (Recommandé)" -ForegroundColor Green
Write-Host "    1. Allez sur GitHub.com → Settings → Developer settings" -ForegroundColor Gray
Write-Host "    2. Personal access tokens → Generate new token (classic)" -ForegroundColor Gray
Write-Host "    3. Cochez la permission 'repo'" -ForegroundColor Gray
Write-Host "    4. Copiez le token généré" -ForegroundColor Gray
Write-Host "    5. Utilisez-le comme mot de passe lors du push" -ForegroundColor Gray
Write-Host ""
Write-Host "  Option 2 : GitHub CLI" -ForegroundColor Green
Write-Host "    Exécutez dans un autre terminal : gh auth login" -ForegroundColor Gray
Write-Host ""
Write-Host "📝 Lors du push, entrez :" -ForegroundColor Cyan
Write-Host "   Username : sekadalle2024" -ForegroundColor White
Write-Host "   Password : <votre_token_ou_mot_de_passe>" -ForegroundColor White
Write-Host ""
Write-Host "Êtes-vous prêt à continuer ? (O/N)" -ForegroundColor Yellow
$ready = Read-Host

if ($ready -ne "O" -and $ready -ne "o" -and $ready -ne "") {
    Write-Host ""
    Write-Host "❌ Push annulé. Préparez votre authentification et relancez le script." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "💡 Conseil : Générez votre token maintenant et revenez ensuite !" -ForegroundColor Cyan
    exit 0
}

# Étape 7 : Push vers GitHub
Write-Step "7" "Push vers GitHub"
Write-Host "🚀 Envoi vers GitHub..." -ForegroundColor Cyan
Write-Host ""
Write-Host "⏳ Ceci peut prendre quelques minutes selon la taille du projet..." -ForegroundColor Yellow
Write-Host ""

$pushStartTime = Get-Date
git push -u origin main
$pushExitCode = $LASTEXITCODE
$pushDuration = (Get-Date) - $pushStartTime

Write-Host ""
if ($pushExitCode -eq 0) {
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                       ║" -ForegroundColor Green
    Write-Host "║            ✅ PUSH RÉUSSI AVEC SUCCÈS ! ✅           ║" -ForegroundColor Green
    Write-Host "║                                                       ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "⏱️  Durée : $([math]::Round($pushDuration.TotalSeconds, 2)) secondes" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "🌐 Votre projet est maintenant sur GitHub :" -ForegroundColor Yellow
    Write-Host "   https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Prochaines étapes :" -ForegroundColor Yellow
    Write-Host "   1. Vérifiez votre repository sur GitHub" -ForegroundColor White
    Write-Host "   2. Pour les futurs push, utilisez simplement : git push" -ForegroundColor White
    Write-Host "   3. Consultez GITHUB_PUSH_GUIDE.md pour plus d'infos" -ForegroundColor White
    Write-Host ""
}
else {
    Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║                                                       ║" -ForegroundColor Red
    Write-Host "║              ❌ ERREUR LORS DU PUSH ❌              ║" -ForegroundColor Red
    Write-Host "║                                                       ║" -ForegroundColor Red
    Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔍 Problèmes possibles :" -ForegroundColor Yellow
    Write-Host "   1. Authentification incorrecte" -ForegroundColor White
    Write-Host "   2. Le repository n'existe pas sur GitHub" -ForegroundColor White
    Write-Host "   3. Pas de connexion internet" -ForegroundColor White
    Write-Host "   4. Permissions insuffisantes sur le repository" -ForegroundColor White
    Write-Host ""
    Write-Host "💡 Solutions :" -ForegroundColor Yellow
    Write-Host "   - Vérifiez vos identifiants GitHub" -ForegroundColor White
    Write-Host "   - Créez le repository sur GitHub si nécessaire" -ForegroundColor White
    Write-Host "   - Vérifiez votre connexion internet" -ForegroundColor White
    Write-Host "   - Consultez INSTRUCTIONS_PUSH_GITHUB.md" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "Appuyez sur Entrée pour fermer..." -ForegroundColor Gray
Read-Host
