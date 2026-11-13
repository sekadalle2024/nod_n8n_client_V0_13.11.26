#!/usr/bin/env node
/**
 * Script de démarrage simplifié pour Nod
 * Contourne le problème du keystore pour développement
 */

import { spawn } from 'node:child_process';

console.log('🚀 Démarrage de Nod en mode développement...\n');

// Lancer le serveur backend
const server = spawn('pnpm', ['exec', 'tsx', 'watch', 'src/server/index.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    NOD_SKIP_COMPOSIO: 'true', // Skip Composio pour éviter keystore
  },
});

server.on('error', (err) => {
  console.error('❌ Erreur serveur:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`\n⚠️  Serveur arrêté (code ${code})`);
  process.exit(code);
});

// Gérer Ctrl+C proprement
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arrêt du serveur...');
  server.kill('SIGINT');
});

console.log('✅ Serveur en cours de démarrage...');
console.log('📝 Logs ci-dessous:\n');
