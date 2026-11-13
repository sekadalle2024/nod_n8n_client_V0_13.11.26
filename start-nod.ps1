# Script de démarrage de Nod avec Node.js 24.21.0
# Configuration des chemins
$nodePath = "C:\Users\LEADER\AppData\Local\nvm\v24.21.0"
$dockerPath = "C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin"
$pnpmPath = "C:\nvm4w\nodejs"

# Mise à jour du PATH pour ce processus et ses enfants
$env:Path = "$nodePath;$dockerPath;$pnpmPath;$env:Path"

# Vérification
Write-Host "Node version: $(& "$nodePath\node.exe" --version)"
Write-Host "Docker version: $(& "$dockerPath\docker.exe" --version)"
Write-Host "pnpm version: $(pnpm --version)"

# Changement de répertoire
Set-Location "h:\nod_n8n"

# Démarrage de Nod
& "$nodePath\node.exe" scripts/start.mjs --production
