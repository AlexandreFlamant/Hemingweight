const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Prevent uncaught errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server kept alive):', err);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static frontend in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.use(express.json());

const PTY_BRIDGE = path.join(__dirname, 'pty-bridge.py');

// API to list recent projects (directories)
app.get('/api/projects', (req, res) => {
  const home = os.homedir();
  const devDir = path.join(home, 'Developer');
  try {
    const dirs = fs.readdirSync(devDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => ({
        name: d.name,
        path: path.join(devDir, d.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(dirs);
  } catch {
    res.json([]);
  }
});

// Track active sessions
const sessions = new Map();

wss.on('connection', (ws) => {
  let childProc = null;

  ws.on('message', (data) => {
    const msg = JSON.parse(data);

    switch (msg.type) {
      case 'start': {
        const cwd = msg.cwd || process.cwd();
        const cols = msg.cols || 120;
        const rows = msg.rows || 40;

        // Kill existing process if any
        if (childProc) {
          childProc.kill('SIGTERM');
          childProc = null;
        }

        try {
          // Use Python PTY bridge to get a real pseudo-terminal
          childProc = spawn('python3', [
            PTY_BRIDGE,
            String(cols),
            String(rows),
            cwd,
            '/opt/homebrew/bin/claude'
          ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              FORCE_COLOR: '1',
              HOME: os.homedir(),
              PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
            },
          });

          sessions.set(ws, { proc: childProc, cwd });
          console.log(`Session started: ${cwd} (pid ${childProc.pid})`);

          childProc.stdout.on('data', (data) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
            }
          });

          childProc.stderr.on('data', (data) => {
            console.error('PTY stderr:', data.toString());
          });

          childProc.on('exit', (code) => {
            console.log(`Session exited: ${cwd} (code ${code})`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'exit', code: code || 0 }));
            }
            sessions.delete(ws);
            childProc = null;
          });

          childProc.on('error', (err) => {
            console.error('Process error:', err.message);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: `\r\n\x1b[31m  Error: ${err.message}\x1b[0m\r\n`
              }));
              ws.send(JSON.stringify({ type: 'exit', code: 1 }));
            }
          });

          ws.send(JSON.stringify({ type: 'started', cwd }));
        } catch (err) {
          console.error('Failed to spawn claude:', err.message);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'output',
              data: `\r\n\x1b[31m  Error: Failed to start Claude Code: ${err.message}\x1b[0m\r\n`
            }));
            ws.send(JSON.stringify({ type: 'exit', code: 1 }));
          }
        }
        break;
      }

      case 'input': {
        if (childProc && childProc.stdin.writable) {
          childProc.stdin.write(msg.data);
        }
        break;
      }

      case 'resize': {
        // Send resize escape sequence to the PTY bridge
        if (childProc && childProc.stdin.writable) {
          const cols = msg.cols || 120;
          const rows = msg.rows || 40;
          childProc.stdin.write(`\x1b[R${cols};${rows}\x00`);
        }
        break;
      }

      case 'stop': {
        if (childProc) {
          childProc.kill('SIGTERM');
          childProc = null;
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (childProc) {
      childProc.kill('SIGTERM');
    }
    sessions.delete(ws);
  });
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`Clawable running at http://localhost:${PORT}`);
});
