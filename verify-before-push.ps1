# Script de vérification avant push vers GitHub

Write-Host "=== Vérification avant push vers GitHub ===" -ForegroundColor Cyan
Write-Host ""

# Se positionner dans le répertoire du projet
Set-Location "h:\nod_n8n"

# 1. Configuration actuelle
Write-Host "📍 Configuration Git Actuelle" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
git remote -v
Write-Host ""

# 2. Branche actuelle
Write-Host "🌿 Branche Actuelle" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
git branch
Write-Host ""

# 3. Statut des fichiers
Write-Host "📝 Statut des Fichiers" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
git status
Write-Host ""

# 4. Fichiers qui seront ajoutés
Write-Host "📦 Fichiers Modifiés/Nouveaux (aperçu)" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
git status --short | Select-Object -First 20
$totalFiles = (git status --short | Measure-Object).Count
if ($totalFiles -gt 20) {
    Write-Host "... et $($totalFiles - 20) fichiers supplémentaires" -ForegroundColor Gray
}
Write-Host ""

# 5. Dernier commit
Write-Host "💾 Dernier Commit" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
git log -1 --oneline
Write-Host ""

# 6. Fichiers ignorés vérification
Write-Host "🚫 Vérification des fichiers sensibles" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
$sensitiveFiles = @(".env", "node_modules", ".local")
$found = $false
foreach ($file in $sensitiveFiles) {
    if (Test-Path $file) {
        $isIgnored = git check-ignore $file 2>$null
        if ($isIgnored) {
            Write-Host "✓ $file est ignoré (OK)" -ForegroundColor Green
        } else {
            Write-Host "✗ ATTENTION: $file n'est pas ignoré !" -ForegroundColor Red
            $found = $true
        }
    }
}
if (-not $found) {
    Write-Host "✓ Tous les fichiers sensibles sont correctement ignorés" -ForegroundColor Green
}
Write-Host ""

# 7. Résumé
Write-Host "📊 Résumé" -ForegroundColor Yellow
Write-Host "─────────────────────────────────" -ForegroundColor Gray
Write-Host "Repository cible: https://github.com/sekadalle2024/nod_n8n_client_V0_13.11.26.git" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prêt pour le push ?" -ForegroundColor Yellow
Write-Host "  → Exécutez: .\push-to-github.ps1" -ForegroundColor Green
Write-Host ""
