#!/usr/bin/env node
'use strict';

/**
 * Clawable setup script.
 *
 * Installs dependencies, builds the client, computes the Chrome extension ID
 * from the key in manifest.json, and writes the native messaging manifest
 * to the correct OS-specific location — zero manual config required.
 *
 * Usage:  node setup.js
 */

const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const CLIENT = path.join(ROOT, 'client');
const EXT = path.join(ROOT, 'extension');
const NATIVE_HOST_DIR = path.join(ROOT, 'native-host');
const HOST_SCRIPT = path.join(NATIVE_HOST_DIR, 'clawable-host.sh');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(msg) {
  console.log(`\n→ ${msg}`);
}

function run(cmd, cwd = ROOT) {
  console.log(`  $ ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

/**
 * Compute the Chrome extension ID from the "key" field in manifest.json.
 * Chrome derives the ID by:
 *   1. Base64-decode the key (DER-encoded public key)
 *   2. SHA-256 hash it
 *   3. Take the first 16 bytes of the hash
 *   4. Map each byte to a character: 0→a, 1→b, …, 15→p
 */
function computeExtensionId(base64Key) {
  const keyBytes = Buffer.from(base64Key, 'base64');
  const hash = crypto.createHash('sha256').update(keyBytes).digest();
  let id = '';
  for (let i = 0; i < 16; i++) {
    id += String.fromCharCode('a'.charCodeAt(0) + (hash[i] >> 4));
    id += String.fromCharCode('a'.charCodeAt(0) + (hash[i] & 0x0f));
  }
  return id;
}

/**
 * Return the OS-specific directory for Chrome NativeMessagingHosts.
 */
function getNativeMessagingDir() {
  const platform = os.platform();
  const home = os.homedir();

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
  }
  if (platform === 'linux') {
    return path.join(home, '.config', 'google-chrome', 'NativeMessagingHosts');
  }
  if (platform === 'win32') {
    // Windows uses registry, but the manifest still goes here for reference
    return path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'NativeMessagingHosts');
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

try {
  // 1. Install dependencies
  log('Installing server dependencies…');
  run('npm install --production', ROOT);

  log('Installing client dependencies…');
  run('npm install', CLIENT);

  // 2. Build client
  log('Building client…');
  run('npm run build', CLIENT);

  const distIndex = path.join(CLIENT, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    throw new Error('Client build failed — dist/index.html not found');
  }
  console.log('  ✓ client/dist/index.html exists');

  // 3. Compute extension ID from key in manifest.json
  log('Computing Chrome extension ID…');
  const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));

  if (!manifest.key) {
    throw new Error('No "key" field in extension/manifest.json — cannot compute a stable extension ID');
  }

  const extensionId = computeExtensionId(manifest.key);
  console.log(`  ✓ Extension ID: ${extensionId}`);

  // 4. Write native messaging manifest
  log('Registering Chrome native messaging host…');

  const nmDir = getNativeMessagingDir();
  fs.mkdirSync(nmDir, { recursive: true });

  const nmManifest = {
    name: 'com.clawable.server',
    description: 'Clawable — auto-start local server for Claude Code in the browser',
    path: HOST_SCRIPT,
    type: 'stdio',
    allowed_origins: [`chrome-extension://${extensionId}/`],
  };

  const nmPath = path.join(nmDir, 'com.clawable.server.json');
  fs.writeFileSync(nmPath, JSON.stringify(nmManifest, null, 2) + '\n');
  console.log(`  ✓ Wrote ${nmPath}`);
  console.log(`  ✓ allowed_origins: chrome-extension://${extensionId}/`);

  // 5. Make host script executable
  log('Making native host script executable…');
  fs.chmodSync(HOST_SCRIPT, 0o755);
  console.log(`  ✓ ${HOST_SCRIPT}`);

  // Done
  log('Setup complete!\n');
  console.log('Next steps:');
  console.log('  1. Open Chrome → chrome://extensions');
  console.log('  2. Enable "Developer mode" (top-right toggle)');
  console.log('  3. Click "Load unpacked"');
  console.log(`  4. Select: ${EXT}`);
  console.log('');

} catch (err) {
  console.error(`\n✗ Setup failed: ${err.message}`);
  process.exit(1);
}
