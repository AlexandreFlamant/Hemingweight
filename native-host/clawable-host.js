#!/usr/bin/env node
'use strict';

/**
 * Chrome Native Messaging Host for Clawable.
 *
 * Chrome launches this script when the extension sends a native message.
 * It starts the Clawable server (if not already running), then replies
 * with the server status so the extension knows it can proceed.
 *
 * Protocol: Chrome native messaging uses stdin/stdout with
 * 4-byte little-endian length prefix before each JSON message.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const os = require('os');

const SERVER_PORT = 3456;
const SERVER_JS = path.join(__dirname, '..', 'server.js');
const LOG_FILE = path.join(os.homedir(), '.clawable', 'server.log');

// --- Native messaging helpers ---

function readMessage() {
  return new Promise((resolve) => {
    let buf = Buffer.alloc(0);
    process.stdin.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= 4) {
        const len = buf.readUInt32LE(0);
        if (buf.length >= 4 + len) {
          const msg = JSON.parse(buf.slice(4, 4 + len).toString());
          resolve(msg);
        }
      }
    });
  });
}

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const len = Buffer.byteLength(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(len, 0);
  process.stdout.write(header);
  process.stdout.write(json);
}

// --- Server management ---

function pingServer() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${SERVER_PORT}/api/health`, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.status === 'ok');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startServer() {
  // Ensure log directory exists
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFd = fs.openSync(LOG_FILE, 'a');

  // Start server as a detached background process so it survives
  // after this native host script exits.
  const child = spawn(process.execPath, [SERVER_JS], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      PORT: String(SERVER_PORT),
    },
  });

  child.unref();
  fs.closeSync(logFd);
  return child.pid;
}

async function waitForServer(maxWaitMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (await pingServer()) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// --- Main ---

(async () => {
  try {
    const msg = await readMessage();

    if (msg.type === 'ping' || msg.type === 'start') {
      const alreadyRunning = await pingServer();

      if (alreadyRunning) {
        sendMessage({ status: 'ok', wasRunning: true });
      } else {
        const pid = startServer();
        const ready = await waitForServer();
        if (ready) {
          sendMessage({ status: 'ok', wasRunning: false, pid });
        } else {
          sendMessage({ status: 'error', message: 'Server failed to start in time' });
        }
      }
    } else {
      sendMessage({ status: 'error', message: `Unknown message type: ${msg.type}` });
    }
  } catch (err) {
    sendMessage({ status: 'error', message: err.message });
  }

  // Exit after replying — the server continues in the background
  process.exit(0);
})();
