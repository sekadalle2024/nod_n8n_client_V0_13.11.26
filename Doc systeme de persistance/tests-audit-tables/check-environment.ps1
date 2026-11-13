# Script de vérification de l'environnement pour les tests

Write-Host "🔍 VÉRIFICATION DE L'ENVIRONNEMENT" -ForegroundColor Cyan
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""

# 1. Docker
Write-Host "1️⃣  Docker Desktop" -ForegroundColor Yellow
try {
    $dockerVersion = docker version 2>&1
    if ($LASTEXITCODE -eq 0) {
        $versionLine = ($dockerVersion | Select-String "Version:").Line -split ":" | Select-Object -Last 1
        Write-Host "   ✅ Docker installé$versionLine" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Docker ne répond pas" -ForegroundColor Red
        Write-Host "   → Démarrer Docker Desktop" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Docker non accessible" -ForegroundColor Red
}
Write-Host ""

# 2. Images Docker
Write-Host "2️⃣  Images Docker" -ForegroundColor Yellow
try {
    $images = docker images --format "{{.Repository}}:{{.Tag}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $imageCount = ($images | Measure-Object).Count
        Write-Host "   ✅ $imageCount images trouvées" -ForegroundColor Green
        
        $requiredImages = @(
            "nod_n8n-workspace",
            "nod_n8n-browser",
            "postgres"
        )
        
        foreach ($img in $requiredImages) {
            $found = $images | Select-String $img
            if ($found) {
                Write-Host "   ✅ $img" -ForegroundColor Green
            } else {
                Write-Host "   ❌ $img manquante" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "   ❌ Impossible de lister les images" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification des images" -ForegroundColor Red
}
Write-Host ""

# 3. Containers en cours
Write-Host "3️⃣  Containers Docker" -ForegroundColor Yellow
try {
    $containers = docker ps --format "{{.Names}}: {{.Status}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $containerCount = ($containers | Measure-Object).Count
        if ($containerCount -gt 0) {
            Write-Host "   ✅ $containerCount containers actifs" -ForegroundColor Green
            $containers | ForEach-Object {
                Write-Host "   ✅ $_" -ForegroundColor Green
            }
        } else {
            Write-Host "   ⚠️  Aucun container actif" -ForegroundColor Yellow
            Write-Host "   → Exécuter: docker compose up -d" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification des containers" -ForegroundColor Red
}
Write-Host ""

# 4. PostgreSQL
Write-Host "4️⃣  Base de données PostgreSQL" -ForegroundColor Yellow
try {
    $pgCheck = docker exec nod_n8n-postgres-1 pg_isready -U nod 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ PostgreSQL répond" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PostgreSQL ne répond pas" -ForegroundColor Red
        Write-Host "   → Vérifier: docker ps | findstr postgres" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠️  Container PostgreSQL non trouvé" -ForegroundColor Yellow
}
Write-Host ""

# 5. Node.js et pnpm
Write-Host "5️⃣  Node.js et pnpm" -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Node.js $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Node.js non trouvé" -ForegroundColor Red
    }
    
    $pnpmVersion = pnpm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ pnpm $pnpmVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ pnpm non trouvé" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification Node/pnpm" -ForegroundColor Red
}
Write-Host ""

# 6. Fichiers de test
Write-Host "6️⃣  Fichiers de test" -ForegroundColor Yellow
$testFiles = @(
    "run-tests.mjs",
    "test-all-tables.mjs",
    "01-table-feuille-couverture-comptes-dormants.json",
    "02-table-feuille-revision-comptable.json",
    "03-table-matrice-surveillance-permanente.json",
    "04-table-plan-recommandations.json",
    "05-document-extraction-core-banking.json"
)

$testDir = "h:\nod_n8n\tests-audit-tables"
foreach ($file in $testFiles) {
    $filePath = Join-Path $testDir $file
    if (Test-Path $filePath) {
        Write-Host "   ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file manquant" -ForegroundColor Red
    }
}
Write-Host ""

# 7. Configuration
Write-Host "7️⃣  Configuration" -ForegroundColor Yellow
$envPath = Join-Path $testDir ".env"
if (Test-Path $envPath) {
    Write-Host "   ✅ Fichier .env trouvé" -ForegroundColor Green
    $envContent = Get-Content $envPath
    if ($envContent -match "NOD_API_TOKEN") {
        Write-Host "   ✅ NOD_API_TOKEN configuré" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  NOD_API_TOKEN manquant dans .env" -ForegroundColor Yellow
    }
} else {
    Write-Host "   ⚠️  Fichier .env manquant" -ForegroundColor Yellow
    Write-Host "   → Créer tests-audit-tables/.env avec:" -ForegroundColor Yellow
    Write-Host "     NOD_API_URL=http://localhost:4310" -ForegroundColor Gray
    Write-Host "     NOD_API_TOKEN=votre_token" -ForegroundColor Gray
}
Write-Host ""

# 8. Serveur Nod
Write-Host "8️⃣  Serveur Nod" -ForegroundColor Yellow
try {
    $nodProcess = Get-Process -Name node -ErrorAction SilentlyContinue
    if ($nodProcess) {
        Write-Host "   ✅ Processus Node.js actif (PID: $($nodProcess.Id))" -ForegroundColor Green
        
        # Tester l'API
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4310" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
            Write-Host "   ✅ Serveur Nod répond sur http://localhost:4310" -ForegroundColor Green
        } catch {
            Write-Host "   ⚠️  Serveur Nod ne répond pas encore" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️  Aucun serveur Node.js actif" -ForegroundColor Yellow
        Write-Host "   → Démarrer: pnpm exec tsx src/server/index.ts" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Erreur lors de la vérification du serveur" -ForegroundColor Red
}
Write-Host ""

# Résumé
Write-Host ("=" * 60) -ForegroundColor Gray
Write-Host ""
Write-Host "📊 RÉSUMÉ" -ForegroundColor Cyan
Write-Host ""

try {
    $dockerTest = docker version 2>&1
    $dockerOk = $LASTEXITCODE -eq 0
} catch {
    $dockerOk = $false
}

try {
    $containersTest = docker ps 2>&1
    $containersOk = ($LASTEXITCODE -eq 0) -and (($containersTest | Measure-Object).Count -gt 0)
} catch {
    $containersOk = $false
}

try {
    $postgresTest = docker exec nod_n8n-postgres-1 pg_isready -U nod 2>&1
    $postgresOk = $LASTEXITCODE -eq 0
} catch {
    $postgresOk = $false
}

$filesOk = (Test-Path (Join-Path $testDir "run-tests.mjs"))

if ($dockerOk -and $containersOk -and $postgresOk -and $filesOk) {
    Write-Host "✅ ENVIRONNEMENT PRÊT POUR LES TESTS" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Cyan
    Write-Host "1. Démarrer le serveur: pnpm exec tsx src/server/index.ts" -ForegroundColor White
    Write-Host "2. Copier le token depuis l'URL affichee" -ForegroundColor White
    Write-Host "3. Configurer tests-audit-tables/.env" -ForegroundColor White
    Write-Host "4. Exécuter: node tests-audit-tables/run-tests.mjs" -ForegroundColor White
} else {
    Write-Host "⚠️  ENVIRONNEMENT INCOMPLET" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions requises:" -ForegroundColor Cyan
    if (-not $dockerOk) {
        Write-Host "❌ Démarrer Docker Desktop" -ForegroundColor Red
    }
    if (-not $containersOk) {
        Write-Host "❌ Démarrer les containers: docker compose up -d" -ForegroundColor Red
    }
    if (-not $postgresOk) {
        Write-Host "❌ Vérifier PostgreSQL" -ForegroundColor Red
    }
}

Write-Host ""
