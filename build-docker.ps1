# Script pour construire les conteneurs Docker Nod
Write-Host "Configuration des variables d'environnement..."
$env:NOD_POSTGRES_PASSWORD = "B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS"
$env:NOD_DATA_ROOT = "h:\nod_n8n\.local"
$env:DATABASE_URL = "postgresql://nod:B5ZuYyQHPcdVmXg1bA0I_p8GRxEU2nwaKMlNsDitqeL-4C3jkTFzfW7Joh9r6vOS@127.0.0.1:54329/nod"

Write-Host "Démarrage de Docker Compose..."
Set-Location "h:\nod_n8n"

& "C:\Users\LEADER\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe" compose up -d --build --wait --remove-orphans

Write-Host "Construction terminée !"
