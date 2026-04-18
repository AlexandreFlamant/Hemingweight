const express = require('express');
const http = require('http');
const https = require('https');
const httpProxy = require('http-proxy');
const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// Prevent uncaught errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept alive):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection (server kept alive):', err);
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const fileWss = new WebSocket.Server({ noServer: true });

// Serve static frontend in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.use('/site', express.static(path.join(__dirname, 'site')));
app.use(express.json());

// ── Origin allowlist + per-install token (web-entry flow) ──────────────────
// Browser requests from https://hemingweight.vercel.app reach this server over
// CORS + Private Network Access. The existing extension flow is same-origin
// (its pages load from http://localhost:3456 directly) so it is unaffected.
const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/hemingweight\.vercel\.app$/,
  /^https:\/\/.*\.hemingweight\.vercel\.app$/,
  /^chrome-extension:\/\/oppghhmjfjibmjjbpchmhheelfcnbboo$/,
];
function isAllowedOrigin(origin) {
  return !!origin && ALLOWED_ORIGINS.some(re => re.test(origin));
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hemingweight-Token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PTY_BRIDGE = path.join(__dirname, 'pty-bridge.py');

// ── User config (persisted in ~/.hemingweight/config.json) ─────────────────────
const CONFIG_DIR = path.join(os.homedir(), '.hemingweight');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getProjectsDir() {
  const config = readConfig();
  return config.projectsDir || path.join(os.homedir(), 'Developer');
}

function getOrCreateInstallToken() {
  const cfg = readConfig();
  if (cfg.installToken && typeof cfg.installToken === 'string' && cfg.installToken.length >= 32) {
    return cfg.installToken;
  }
  const token = crypto.randomBytes(24).toString('hex');
  writeConfig({ ...cfg, installToken: token });
  return token;
}
const INSTALL_TOKEN = getOrCreateInstallToken();

// Ensure common binary paths are available (native host may launch with a minimal PATH)
const FULL_PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  .concat((process.env.PATH || '').split(':'))
  .filter((v, i, a) => v && a.indexOf(v) === i)
  .join(':');

const DETECT_PATH = FULL_PATH
  + ':' + (process.env.HOME || '') + '/.npm-global/bin'
  + ':' + (process.env.HOME || '') + '/.local/bin';

// Supported LLM CLIs. state 'ready' = detectable; 'soon' = not wired up yet.
const MODEL_REGISTRY = {
  claude: {
    name: 'Claude',
    state: 'ready',
    cli: 'claude',
    candidates: [
      '/opt/homebrew/bin/claude', '/usr/local/bin/claude',
      path.join(os.homedir(), '.npm-global/bin/claude'),
      path.join(os.homedir(), '.local/bin/claude'),
    ],
  },
  mistral: {
    name: 'Mistral',
    state: 'ready',
    cli: 'vibe',
    candidates: [
      '/opt/homebrew/bin/vibe', '/usr/local/bin/vibe',
      path.join(os.homedir(), '.npm-global/bin/vibe'),
      path.join(os.homedir(), '.local/bin/vibe'),
    ],
  },
  openai: {
    name: 'OpenAI',
    state: 'ready',
    cli: 'codex',
    candidates: [
      '/opt/homebrew/bin/codex', '/usr/local/bin/codex',
      path.join(os.homedir(), '.npm-global/bin/codex'),
      path.join(os.homedir(), '.local/bin/codex'),
    ],
  },
  gemini: {
    name: 'Gemini',
    state: 'ready',
    cli: 'gemini',
    candidates: [
      '/opt/homebrew/bin/gemini', '/usr/local/bin/gemini',
      path.join(os.homedir(), '.npm-global/bin/gemini'),
      path.join(os.homedir(), '.local/bin/gemini'),
    ],
  },
};

function resolveModelBinary(modelKey) {
  const entry = MODEL_REGISTRY[modelKey];
  if (!entry || entry.state !== 'ready') return null;
  try {
    const found = execSync(`which ${entry.cli}`, {
      encoding: 'utf8',
      env: { ...process.env, PATH: DETECT_PATH },
    }).trim();
    if (found && fs.existsSync(found)) return found;
  } catch {}
  return (entry.candidates || []).find(p => fs.existsSync(p)) || null;
}

// Backwards-compatible Claude probe.
app.get('/api/claude-installed', (req, res) => {
  const claudePath = resolveModelBinary('claude');
  res.json({ installed: !!claudePath, path: claudePath });
});

// Per-model install detection for the model switcher widget.
app.get('/api/models', (req, res) => {
  const out = {};
  for (const [key, entry] of Object.entries(MODEL_REGISTRY)) {
    if (entry.state === 'soon') {
      out[key] = { name: entry.name, state: 'soon', installed: false, path: null };
    } else {
      const binPath = resolveModelBinary(key);
      out[key] = {
        name: entry.name,
        state: 'ready',
        installed: !!binPath,
        path: binPath,
        cli: entry.cli,
      };
    }
  }
  res.json(out);
});

// Health check for extension auto-launch and web-entry handshake.
// Token is only revealed when the origin is already allow-listed (which would
// otherwise be enforced by the browser via CORS). Defense in depth.
app.get('/api/health', (req, res) => {
  const origin = req.headers.origin;
  const payload = { status: 'ok' };
  if (isAllowedOrigin(origin)) payload.token = INSTALL_TOKEN;
  res.json(payload);
});

// ── Version + update check ─────────────────────────────────────────────────
// Current version is read from package.json at startup. Latest is polled from
// the raw package.json on the main branch, cached for 30 minutes so we don't
// hammer GitHub.
const PKG_JSON = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); }
  catch { return { version: '0.0.0' }; }
})();
const CURRENT_VERSION = PKG_JSON.version || '0.0.0';
const VERSION_URL = 'https://raw.githubusercontent.com/AlexandreFlamant/hemingweight/main/package.json';
const VERSION_CACHE_MS = 30 * 60 * 1000;
let versionCache = { latest: null, checkedAt: 0, error: null };

function cmpVersion(a, b) {
  const pa = (a || '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = (b || '0').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function fetchLatestVersion() {
  if (versionCache.latest && Date.now() - versionCache.checkedAt < VERSION_CACHE_MS) {
    return versionCache.latest;
  }
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('status ' + res.status);
    const body = await res.json();
    versionCache = { latest: body.version || null, checkedAt: Date.now(), error: null };
    return versionCache.latest;
  } catch (err) {
    versionCache = { latest: versionCache.latest, checkedAt: Date.now(), error: err.message };
    return versionCache.latest;
  }
}

app.get('/api/version', async (req, res) => {
  const latest = await fetchLatestVersion();
  const updateAvailable = latest && cmpVersion(latest, CURRENT_VERSION) > 0;
  res.json({
    current: CURRENT_VERSION,
    latest: latest || null,
    updateAvailable: !!updateAvailable,
    checkedAt: versionCache.checkedAt,
  });
});

app.post('/api/update', (req, res) => {
  const script = path.join(__dirname, 'update.sh');
  if (!fs.existsSync(script)) {
    return res.status(500).json({ error: 'update.sh missing, run the installer curl again' });
  }
  // Spawn detached so the script outlives the server restart it triggers.
  // Log output to ~/.hemingweight/update.log for debugging.
  const logPath = path.join(CONFIG_DIR, 'update.log');
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); } catch {}
  const out = fs.openSync(logPath, 'a');
  const err = fs.openSync(logPath, 'a');
  const child = spawn('bash', [script], {
    detached: true,
    stdio: ['ignore', out, err],
    cwd: __dirname,
    env: { ...process.env, PATH: FULL_PATH },
  });
  child.unref();
  res.json({ started: true, logPath });
});

// Docs page — renders README.md as a wiki-style page
app.get('/docs', (req, res) => {
  const readmePath = path.join(__dirname, 'README.md');
  let md = '';
  try { md = fs.readFileSync(readmePath, 'utf-8'); } catch { md = '# Hemingweight\n\nDocumentation not found.'; }
  // Escape for embedding in HTML
  const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hemingweight Docs</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0e0e10; color: #d4d4d8; display: flex; min-height: 100vh; }
  /* Sidebar */
  nav { width: 260px; flex-shrink: 0; background: #18181b; border-right: 1px solid #27272a; padding: 24px 0; position: fixed; top: 0; left: 0; bottom: 0; overflow-y: auto; }
  nav .logo { display: flex; align-items: center; gap: 10px; padding: 0 20px 20px; border-bottom: 1px solid #27272a; margin-bottom: 12px; }
  nav .logo img { width: 28px; height: 28px; }
  nav .logo span { font-size: 15px; font-weight: 700; color: #e4e4ef; }
  nav .nav-section { padding: 8px 16px 4px; font-size: 10px; font-weight: 700; color: #555570; text-transform: uppercase; letter-spacing: 0.08em; }
  nav a { display: block; padding: 7px 20px; font-size: 13px; color: #a1a1aa; text-decoration: none; border-left: 2px solid transparent; transition: all 0.15s; }
  nav a:hover { color: #e4e4ef; background: rgba(255,255,255,0.03); }
  nav a.active { color: #e07a4b; border-left-color: #e07a4b; background: rgba(224,122,75,0.06); }
  nav a.sub { padding-left: 32px; font-size: 12px; color: #71717a; }
  nav a.sub:hover { color: #a1a1aa; }
  /* Main */
  main { flex: 1; margin-left: 260px; max-width: 820px; padding: 48px 56px 96px; }
  /* Markdown styles */
  main h1 { font-size: 32px; font-weight: 800; color: #e4e4ef; margin-bottom: 8px; border-bottom: 1px solid #27272a; padding-bottom: 16px; }
  main h2 { font-size: 22px; font-weight: 700; color: #e4e4ef; margin-top: 48px; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid #27272a; scroll-margin-top: 24px; }
  main h3 { font-size: 16px; font-weight: 600; color: #e4e4ef; margin-top: 32px; margin-bottom: 10px; scroll-margin-top: 24px; }
  main p { font-size: 15px; line-height: 1.7; color: #a1a1aa; margin-bottom: 16px; }
  main strong { color: #e4e4ef; }
  main a { color: #e07a4b; text-decoration: none; }
  main a:hover { text-decoration: underline; }
  main ul, main ol { margin-bottom: 16px; padding-left: 24px; }
  main li { font-size: 14px; line-height: 1.7; color: #a1a1aa; margin-bottom: 4px; }
  main code { font-family: 'SF Mono', 'Fira Code', Menlo, monospace; font-size: 13px; background: #27272a; color: #e07a4b; padding: 2px 6px; border-radius: 4px; }
  main pre { background: #1a1a1f; border: 1px solid #27272a; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; overflow-x: auto; }
  main pre code { background: none; color: #d4d4d8; padding: 0; font-size: 13px; line-height: 1.6; }
  main table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
  main th { text-align: left; padding: 10px 14px; background: #1a1a1f; color: #e4e4ef; font-weight: 600; border: 1px solid #27272a; }
  main td { padding: 10px 14px; border: 1px solid #27272a; color: #a1a1aa; }
  main hr { border: none; border-top: 1px solid #27272a; margin: 32px 0; }
  main blockquote { border-left: 3px solid #e07a4b; padding: 8px 16px; margin-bottom: 16px; background: rgba(224,122,75,0.05); }
  main blockquote p { color: #a1a1aa; margin: 0; }
  /* Back link */
  .back-link { display: inline-flex; align-items: center; gap: 6px; color: #71717a; font-size: 13px; text-decoration: none; margin-bottom: 24px; }
  .back-link:hover { color: #e07a4b; }
  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
  @media (max-width: 900px) {
    nav { display: none; }
    main { margin-left: 0; padding: 24px 20px 64px; }
  }
</style>
</head>
<body>
<nav id="sidebar">
  <div class="logo">
    <img src="/logo.png" alt="Hemingweight">
    <span>Docs</span>
  </div>
  <div id="nav-links"></div>
</nav>
<main>
  <a href="/" class="back-link">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Back to Hemingweight
  </a>
  <div id="content"></div>
</main>
<script>
  const raw = ${JSON.stringify(md)};
  document.getElementById('content').innerHTML = marked.parse(raw);
  // Build sidebar nav from h2 and h3
  const headings = document.querySelectorAll('main h2, main h3');
  const nav = document.getElementById('nav-links');
  let currentSection = '';
  headings.forEach((h, i) => {
    const id = 'section-' + i;
    h.id = id;
    const a = document.createElement('a');
    a.href = '#' + id;
    a.textContent = h.textContent;
    if (h.tagName === 'H3') a.className = 'sub';
    nav.appendChild(a);
  });
  // Highlight active nav on scroll
  const links = nav.querySelectorAll('a');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        const active = nav.querySelector('a[href="#' + e.target.id + '"]');
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  headings.forEach(h => observer.observe(h));
<\/script>
</body>
</html>`);
});

// ── Settings endpoints ─────────────────────────────────────────────────────
app.get('/api/settings', (req, res) => {
  const config = readConfig();
  const configured = fs.existsSync(CONFIG_FILE);
  const dir = config.projectsDir || path.join(os.homedir(), 'Developer');
  res.json({
    projectsDir: dir,
    projectsDirDisplay: dir.replace(os.homedir(), '~'),
    configured,
  });
});

app.post('/api/settings', (req, res) => {
  const { projectsDir } = req.body;
  if (!projectsDir || typeof projectsDir !== 'string') {
    return res.status(400).json({ error: 'projectsDir is required' });
  }
  const resolved = projectsDir.startsWith('~')
    ? path.join(os.homedir(), projectsDir.slice(1))
    : path.resolve(projectsDir);

  if (!resolved.startsWith(os.homedir())) {
    return res.status(403).json({ error: 'Directory must be under your home folder' });
  }

  try {
    fs.mkdirSync(resolved, { recursive: true });
  } catch (err) {
    return res.status(500).json({ error: `Cannot create directory: ${err.message}` });
  }

  const config = readConfig();
  config.projectsDir = resolved;
  writeConfig(config);
  res.json({
    projectsDir: resolved,
    projectsDirDisplay: resolved.replace(os.homedir(), '~'),
    configured: true,
  });
});

// API to list recent projects (directories)
app.get('/api/projects', (req, res) => {
  const devDir = getProjectsDir();
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

// ── File tree & read endpoints ──────────────────────────────────────────────

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', '.nuxt', '.svelte-kit', 'dist', 'build',
  '.cache', '.turbo', '.vercel', '__pycache__', '.venv', 'venv', 'coverage',
  '.DS_Store',
]);
const IGNORED_FILES = new Set(['.DS_Store', 'Thumbs.db']);

function buildFileTree(dirPath, depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const results = [];
  const sorted = entries
    .filter(e => !IGNORED_DIRS.has(e.name) && !IGNORED_FILES.has(e.name) && !e.name.startsWith('.'))
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push({
        name: entry.name,
        path: fullPath,
        type: 'directory',
        children: buildFileTree(fullPath, depth + 1, maxDepth),
      });
    } else {
      results.push({
        name: entry.name,
        path: fullPath,
        type: 'file',
      });
    }
  }
  return results;
}

app.get('/api/files/tree', (req, res) => {
  const projectPath = req.query.path;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  // Security: ensure path is under home directory
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(buildFileTree(projectPath));
});

app.get('/api/files/read', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path required' });
  const home = os.homedir();
  if (!path.resolve(filePath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const stat = fs.statSync(filePath);
    // Don't read files larger than 1MB
    if (stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (>1MB)' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, path: filePath });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// ── File write endpoint (for CLAUDE.md editor) ────────────────────────────
app.post('/api/files/write', (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'path and content required' });
  const home = os.homedir();
  if (!path.resolve(filePath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create new project ─────────────────────────────────────────────────────
app.post('/api/projects/create', (req, res) => {
  const { name } = req.body;
  if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.status(400).json({ error: 'Project name must be alphanumeric (hyphens/underscores allowed)' });
  }
  const devDir = getProjectsDir();
  const projectPath = path.join(devDir, name);

  if (fs.existsSync(projectPath)) {
    return res.status(409).json({ error: 'A project with this name already exists' });
  }

  try {
    fs.mkdirSync(projectPath, { recursive: true });
    // Initialize with a basic CLAUDE.md
    fs.writeFileSync(path.join(projectPath, 'CLAUDE.md'), `# ${name}\n\nDescribe your project here. Claude Code reads this file to understand context.\n`);
    res.json({ name, path: projectPath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Directory browser (for folder picker UI) ─────────────────────────────
app.get('/api/directories', (req, res) => {
  const home = os.homedir();
  const dirPath = req.query.path || home;
  const resolved = path.resolve(dirPath.replace(/^~/, home));

  // Only allow browsing within home directory
  if (!resolved.startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => e.name)
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    // Compute display path with ~ prefix
    const display = resolved === home ? '~' : '~' + resolved.slice(home.length);

    res.json({ path: resolved, display, dirs, parent: resolved === home ? null : path.dirname(resolved) });
  } catch {
    res.json({ path: resolved, display: resolved, dirs: [], parent: path.dirname(resolved) });
  }
});

// ── Git diff endpoint ──────────────────────────────────────────────────────
app.get('/api/git/diff', (req, res) => {
  const projectPath = req.query.path;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const gitEnv = { ...process.env, PATH: FULL_PATH };
  const safeExec = (cmd, opts = {}) => {
    try { return execSync(cmd, { cwd: projectPath, stdio: 'pipe', env: gitEnv, ...opts }).toString(); }
    catch { return ''; }
  };

  // Check if it's a git repo
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: 'pipe' });
  } catch {
    return res.json({ isGitRepo: false, files: [], diff: '', diffStaged: '', log: '', remote: '' });
  }

  const status = safeExec('git status --porcelain');
  const diff = safeExec('git diff', { maxBuffer: 5 * 1024 * 1024 });
  const diffStaged = safeExec('git diff --staged', { maxBuffer: 5 * 1024 * 1024 });
  const log = safeExec('git log --oneline -10');
  const remote = safeExec('git remote get-url origin').trim();

  const files = status.trim().split('\n').filter(Boolean).map(line => {
    const st = line.substring(0, 2).trim();
    const file = line.substring(3);
    return { status: st, file };
  });

  res.json({ files, diff, diffStaged, log, isGitRepo: true, remote });
});

// ── Git connect endpoint ───────────────────────────────────────────────────
app.post('/api/git/connect', async (req, res) => {
  const { projectPath, repoUrl } = req.body;
  if (!projectPath || !repoUrl) return res.status(400).json({ error: 'projectPath and repoUrl required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  const run = (cmd) => execSync(cmd, { cwd: projectPath, stdio: 'pipe', env: gitEnv }).toString().trim();

  try {
    // Check if already a git repo
    let isGitRepo = false;
    try {
      run('git rev-parse --is-inside-work-tree');
      isGitRepo = true;
    } catch {}

    if (!isGitRepo) {
      run('git init');
      console.log(`Git initialized: ${projectPath}`);
    }

    // Check if remote already exists
    let hasRemote = false;
    try {
      const remotes = run('git remote');
      hasRemote = remotes.includes('origin');
    } catch {}

    if (hasRemote) {
      // Update existing remote
      run(`git remote set-url origin ${repoUrl}`);
    } else {
      run(`git remote add origin ${repoUrl}`);
    }

    // Check if there are any commits
    let hasCommits = false;
    try {
      run('git rev-parse HEAD');
      hasCommits = true;
    } catch {}

    if (!hasCommits) {
      // Create initial commit with everything
      run('git add -A');
      try {
        run('git commit -m "Initial commit"');
      } catch {
        // Nothing to commit (empty project)
      }
    }

    // Try to push — set upstream
    try {
      run('git branch -M main');
      run('git push -u origin main');
      res.json({ ok: true, message: 'Connected and pushed to GitHub' });
    } catch (err) {
      // Push might fail if remote has content — try pull first
      try {
        run('git pull origin main --allow-unrelated-histories --no-edit');
        run('git push -u origin main');
        res.json({ ok: true, message: 'Connected, merged, and pushed to GitHub' });
      } catch (pullErr) {
        res.json({ ok: true, message: 'Connected to GitHub. You may need to push manually if there are conflicts.', warning: pullErr.message });
      }
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Git push/commit endpoints ──────────────────────────────────────────────
app.post('/api/git/push', (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const output = execSync('git push', {
      cwd: projectPath, stdio: 'pipe',
      env: { ...process.env, PATH: FULL_PATH, HOME: home },
    }).toString();
    res.json({ ok: true, output });
  } catch (err) {
    res.status(500).json({ error: err.stderr ? err.stderr.toString() : err.message });
  }
});

app.post('/api/git/commit-and-push', (req, res) => {
  const { projectPath, message, commitOnly } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  try {
    execSync('git add -A', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    const commitMsg = message || 'Update from Hemingweight';
    try {
      execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    } catch {
      // Nothing to commit
    }
    if (commitOnly) {
      return res.json({ ok: true, output: 'Committed locally' });
    }
    const output = execSync('git push', { cwd: projectPath, stdio: 'pipe', env: gitEnv }).toString();
    res.json({ ok: true, output });
  } catch (err) {
    res.status(500).json({ error: err.stderr ? err.stderr.toString() : err.message });
  }
});

// ── Git history & restore ──────────────────────────────────────────────────
app.get('/api/git/history', (req, res) => {
  const projectPath = req.query.path;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const log = execSync(
      'git log --pretty=format:\'{"hash":"%H","short":"%h","message":"%s","author":"%an","date":"%ci"}\' -30',
      { cwd: projectPath, stdio: 'pipe', env: { ...process.env, PATH: FULL_PATH } }
    ).toString();
    const commits = log.trim().split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
    res.json({ commits });
  } catch (err) {
    res.json({ commits: [], error: err.message });
  }
});

// Get diff for a specific commit
app.get('/api/git/commit-diff', (req, res) => {
  const projectPath = req.query.path;
  const hash = req.query.hash;
  if (!projectPath || !hash) return res.status(400).json({ error: 'path and hash required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!/^[a-f0-9]+$/.test(hash)) return res.status(400).json({ error: 'Invalid hash' });

  try {
    const files = execSync(`git diff-tree --no-commit-id --name-status -r ${hash}`, {
      cwd: projectPath, stdio: 'pipe', env: { ...process.env, PATH: FULL_PATH },
    }).toString().trim().split('\n').filter(Boolean).map(line => {
      const [status, ...parts] = line.split('\t');
      return { status, file: parts.join('\t') };
    });

    const diff = execSync(`git show ${hash} --format="" --patch`, {
      cwd: projectPath, stdio: 'pipe', env: { ...process.env, PATH: FULL_PATH },
      maxBuffer: 5 * 1024 * 1024,
    }).toString();

    res.json({ files, diff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/git/restore', (req, res) => {
  const { projectPath, hash } = req.body;
  if (!projectPath || !hash) return res.status(400).json({ error: 'projectPath and hash required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  // Validate hash is alphanumeric
  if (!/^[a-f0-9]+$/.test(hash)) return res.status(400).json({ error: 'Invalid commit hash' });

  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  try {
    // Restore files from that commit, then create a new commit
    execSync(`git checkout ${hash} -- .`, { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    execSync('git add -A', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    execSync(`git commit -m "Restore to ${hash.substring(0, 7)}"`, { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.stderr ? err.stderr.toString() : err.message });
  }
});

// ── Git preview (temporary checkout for viewing) ──────────────────────────
app.post('/api/git/preview-version', (req, res) => {
  const { projectPath, hash } = req.body;
  if (!projectPath || !hash) return res.status(400).json({ error: 'projectPath and hash required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) return res.status(403).json({ error: 'Access denied' });
  if (!/^[a-f0-9]+$/.test(hash)) return res.status(400).json({ error: 'Invalid hash' });

  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  try {
    // Stash any current changes
    execSync('git stash --include-untracked', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    // Checkout the old version's files
    execSync(`git checkout ${hash} -- .`, { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.stderr ? err.stderr.toString() : err.message });
  }
});

app.post('/api/git/preview-restore', (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) return res.status(403).json({ error: 'Access denied' });

  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  try {
    // Restore HEAD files
    execSync('git checkout HEAD -- .', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    // Clean any untracked files from the old version
    execSync('git clean -fd', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    // Restore stashed changes
    try {
      execSync('git stash pop', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    } catch {
      // No stash to pop — that's fine
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.stderr ? err.stderr.toString() : err.message });
  }
});

// Track active sessions
const sessions = new Map();

// ── Supabase integration ──────────────────────────────────────────────

function detectEnvPrefix(projectPath) {
  const deps = {};
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'));
    Object.assign(deps, pkg.dependencies, pkg.devDependencies);
  } catch {}
  if (deps['next']) return 'NEXT_PUBLIC_';
  if (deps['vite'] || deps['@vitejs/plugin-react'] || deps['@vitejs/plugin-vue']) return 'VITE_';
  return '';
}

app.get('/api/supabase/status', (req, res) => {
  const projectPath = req.query.path;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const prefix = detectEnvPrefix(projectPath);

    // Method 1: Check .env files for SUPABASE_URL
    const envFiles = ['.env.local', '.env', '.env.development', '.env.production'];
    for (const envFile of envFiles) {
      const envPath = path.join(projectPath, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        const urlMatch = content.match(/SUPABASE_URL=(.+)/m);
        const hasKey = /SUPABASE_ANON_KEY=.+/m.test(content);
        if (urlMatch && hasKey) {
          return res.json({ connected: true, url: urlMatch[1].trim(), prefix });
        }
      }
    }

    // Method 2: Check for supabase usage in code (hardcoded URLs, imports, config)
    const supabasePattern = /\.supabase\.co/;
    const searchDirs = [projectPath];
    // Also check one level of subdirectories
    try {
      const subs = fs.readdirSync(projectPath, { withFileTypes: true });
      for (const s of subs) {
        if (s.isDirectory() && !IGNORED_DIRS.has(s.name) && !s.name.startsWith('.')) {
          searchDirs.push(path.join(projectPath, s.name));
        }
      }
    } catch {}

    for (const dir of searchDirs) {
      let files;
      try { files = fs.readdirSync(dir); } catch { continue; }
      for (const f of files) {
        if (!/\.(js|ts|jsx|tsx|html|json|env)$/.test(f)) continue;
        const fp = path.join(dir, f);
        try {
          const stat = fs.statSync(fp);
          if (stat.size > 500000) continue; // skip large files
          const content = fs.readFileSync(fp, 'utf-8');
          const urlMatch = content.match(/https?:\/\/[a-z0-9-]+\.supabase\.co/);
          if (urlMatch) {
            return res.json({ connected: true, url: urlMatch[0], prefix });
          }
        } catch {}
      }
      // Check subdirs (shared/, lib/, src/, etc.)
      try {
        const subFiles = fs.readdirSync(dir, { withFileTypes: true });
        for (const sub of subFiles) {
          if (!sub.isDirectory() || IGNORED_DIRS.has(sub.name)) continue;
          let innerFiles;
          try { innerFiles = fs.readdirSync(path.join(dir, sub.name)); } catch { continue; }
          for (const f of innerFiles) {
            if (!/\.(js|ts|jsx|tsx|html|json|env)$/.test(f)) continue;
            const fp = path.join(dir, sub.name, f);
            try {
              const stat = fs.statSync(fp);
              if (stat.size > 500000) continue;
              const content = fs.readFileSync(fp, 'utf-8');
              const urlMatch = content.match(/https?:\/\/[a-z0-9-]+\.supabase\.co/);
              if (urlMatch) {
                return res.json({ connected: true, url: urlMatch[0], prefix });
              }
            } catch {}
          }
        }
      } catch {}
    }

    res.json({ connected: false, prefix });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supabase/connect', (req, res) => {
  const { projectPath, supabaseUrl, supabaseAnonKey, supabaseServiceKey } = req.body;
  if (!projectPath || !supabaseUrl || !supabaseAnonKey) {
    return res.status(400).json({ error: 'projectPath, supabaseUrl, and supabaseAnonKey required' });
  }
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const runEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  const prefix = detectEnvPrefix(projectPath);
  const urlKey = `${prefix}SUPABASE_URL`;
  const anonKeyKey = `${prefix}SUPABASE_ANON_KEY`;

  try {
    // 1. Install @supabase/supabase-js
    const hasYarn = fs.existsSync(path.join(projectPath, 'yarn.lock'));
    const hasPnpm = fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'));
    const installCmd = hasPnpm ? 'pnpm add @supabase/supabase-js'
                     : hasYarn ? 'yarn add @supabase/supabase-js'
                     : 'npm install @supabase/supabase-js';
    execSync(installCmd, { cwd: projectPath, stdio: 'pipe', env: runEnv, timeout: 60000 });

    // 2. Create/update .env.local
    const envPath = path.join(projectPath, '.env.local');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    if (new RegExp(`^${urlKey}=.*`, 'm').test(envContent)) {
      envContent = envContent.replace(new RegExp(`^${urlKey}=.*`, 'm'), `${urlKey}=${supabaseUrl}`);
    } else {
      envContent += `${envContent && !envContent.endsWith('\n') ? '\n' : ''}${urlKey}=${supabaseUrl}\n`;
    }
    if (new RegExp(`^${anonKeyKey}=.*`, 'm').test(envContent)) {
      envContent = envContent.replace(new RegExp(`^${anonKeyKey}=.*`, 'm'), `${anonKeyKey}=${supabaseAnonKey}`);
    } else {
      envContent += `${anonKeyKey}=${supabaseAnonKey}\n`;
    }
    // Service role key (optional)
    if (supabaseServiceKey) {
      const serviceKeyKey = `${prefix}SUPABASE_SERVICE_ROLE_KEY`;
      if (new RegExp(`^${serviceKeyKey}=.*`, 'm').test(envContent)) {
        envContent = envContent.replace(new RegExp(`^${serviceKeyKey}=.*`, 'm'), `${serviceKeyKey}=${supabaseServiceKey}`);
      } else {
        envContent += `${serviceKeyKey}=${supabaseServiceKey}\n`;
      }
    }
    fs.writeFileSync(envPath, envContent, 'utf-8');

    // 3. Create lib/supabase client file
    const hasSrcDir = fs.existsSync(path.join(projectPath, 'src'));
    const libDir = hasSrcDir ? path.join(projectPath, 'src', 'lib') : path.join(projectPath, 'lib');
    if (!fs.existsSync(libDir)) fs.mkdirSync(libDir, { recursive: true });
    const hasTsConfig = fs.existsSync(path.join(projectPath, 'tsconfig.json'));
    const ext = hasTsConfig ? 'ts' : 'js';
    const supabaseFile = path.join(libDir, `supabase.${ext}`);

    // Determine env access pattern
    const envAccess = prefix.startsWith('VITE_')
      ? `import.meta.env.${urlKey}`
      : `process.env.${urlKey}`;
    const envAccessKey = prefix.startsWith('VITE_')
      ? `import.meta.env.${anonKeyKey}`
      : `process.env.${anonKeyKey}`;

    const clientCode = `import { createClient } from '@supabase/supabase-js'

const supabaseUrl = ${envAccess}${hasTsConfig ? '!' : ''}
const supabaseAnonKey = ${envAccessKey}${hasTsConfig ? '!' : ''}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
`;
    fs.writeFileSync(supabaseFile, clientCode, 'utf-8');

    const relLib = hasSrcDir ? 'src/lib' : 'lib';
    res.json({ ok: true, message: `Connected! SDK installed, .env.local updated, ${relLib}/supabase.${ext} created.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Page/route detection ──────────────────────────────────────────────
function detectPages(projectPath) {
  const pages = [];

  // Next.js App Router: app/**/page.{tsx,jsx,js,ts}
  function scanNextAppDir(dir, prefix) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Skip route groups (parenthesized dirs) for the path, but recurse into them
        const segment = e.name.startsWith('(') ? '' : '/' + e.name;
        scanNextAppDir(full, prefix + segment);
      } else if (/^page\.(tsx?|jsx?)$/.test(e.name)) {
        pages.push({ path: prefix || '/', label: prefix || '/' });
      }
    }
  }

  // Next.js Pages Router: pages/**/*.{tsx,jsx,js,ts}
  function scanNextPagesDir(dir, prefix) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name.startsWith('_') || IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanNextPagesDir(full, prefix + '/' + e.name);
      } else if (/\.(tsx?|jsx?)$/.test(e.name) && !e.name.startsWith('_')) {
        const name = e.name.replace(/\.(tsx?|jsx?)$/, '');
        const route = name === 'index' ? (prefix || '/') : prefix + '/' + name;
        pages.push({ path: route, label: route });
      }
    }
  }

  // Static HTML files
  function scanStaticHtml(dir, prefix, depth) {
    if (depth > 3) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.') || IGNORED_DIRS.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        scanStaticHtml(full, prefix + '/' + e.name, depth + 1);
      } else if (e.name.endsWith('.html')) {
        const name = e.name === 'index.html' ? (prefix || '/') : prefix + '/' + e.name.replace('.html', '');
        pages.push({ path: name, label: name });
      }
    }
  }

  // Detect framework and scan accordingly
  const pkgPath = path.join(projectPath, 'package.json');
  let isNext = false;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      isNext = !!deps['next'];
    } catch {}
  }

  if (isNext) {
    // Check App Router first
    const appDir = path.join(projectPath, 'app');
    const srcAppDir = path.join(projectPath, 'src', 'app');
    if (fs.existsSync(appDir)) scanNextAppDir(appDir, '');
    else if (fs.existsSync(srcAppDir)) scanNextAppDir(srcAppDir, '');

    // Check Pages Router
    const pagesDir = path.join(projectPath, 'pages');
    const srcPagesDir = path.join(projectPath, 'src', 'pages');
    if (fs.existsSync(pagesDir)) scanNextPagesDir(pagesDir, '');
    else if (fs.existsSync(srcPagesDir)) scanNextPagesDir(srcPagesDir, '');
  }

  // If no framework pages found, check for static HTML
  if (pages.length === 0) {
    const staticCandidates = [projectPath, path.join(projectPath, 'public'), path.join(projectPath, 'site')];
    for (const dir of staticCandidates) {
      scanStaticHtml(dir, '', 0);
      if (pages.length > 0) break;
    }
  }

  // Dedupe and sort
  const seen = new Set();
  const unique = [];
  for (const p of pages) {
    if (!seen.has(p.path)) { seen.add(p.path); unique.push(p); }
  }
  unique.sort((a, b) => a.path.localeCompare(b.path));
  return unique;
}

app.get('/api/pages', (req, res) => {
  const projectPath = req.query.path;
  if (!projectPath) return res.status(400).json({ error: 'path required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json(detectPages(projectPath));
});

// ── Preview system ─────────────────────────────────────────────────────────
// All preview traffic is proxied through /preview/ on the Hemingweight server.
// Users never see or think about port numbers.

const previewServers = new Map();  // keyed by project path
const proxy = httpProxy.createProxyServer({ ws: true, changeOrigin: true });

// Suppress proxy errors (e.g. dev server restarting)
proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(502, { 'Content-Type': 'text/html' });
    res.end('<html><body style="background:#18181b;color:#71717a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div>Preview is loading...</div></body></html>');
  }
});

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = require('net').createServer();
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true));
    });
    srv.on('error', () => resolve(false));
  });
}

function findFreePort(startPort) {
  return new Promise(async (resolve) => {
    // Try the default port first for predictable URLs (e.g. OAuth redirects)
    if (await isPortFree(startPort)) return resolve(startPort);
    // Fall back to next available port
    let port = startPort + 1;
    while (!(await isPortFree(port))) port++;
    resolve(port);
  });
}

function detectDevSetup(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const scripts = pkg.scripts || {};
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000, portFlag: '--', portArgs: ['-p'] };
      if (deps['vite'] || deps['@vitejs/plugin-react']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173, portFlag: '--', portArgs: ['--port'], noOpen: ['--open=false'] };
      if (deps['react-scripts']) return { cmd: 'npm', args: ['start'], defaultPort: 3000 };
      if (deps['nuxt']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000, portFlag: '--', portArgs: ['--port'], noOpen: ['--no-open'] };
      if (deps['svelte'] || deps['@sveltejs/kit']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173, portFlag: '--', portArgs: ['--port'], noOpen: ['--no-open'] };
      if (deps['astro']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 4321, portFlag: '--', portArgs: ['--port'] };
      if (scripts.dev) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000 };
      if (scripts.start) return { cmd: 'npm', args: ['start'], defaultPort: 3000 };
    } catch {}
  }

  if (fs.existsSync(path.join(projectPath, 'manage.py')))
    return { cmd: 'python3', args: ['manage.py', 'runserver'], defaultPort: 8000 };
  if (fs.existsSync(path.join(projectPath, 'app.py')))
    return { cmd: 'python3', args: ['app.py'], defaultPort: 5000 };

  // Static HTML sites — look for index.html in root or common subdirs
  const staticCandidates = [
    projectPath,
    path.join(projectPath, 'site'),
    path.join(projectPath, 'public'),
    path.join(projectPath, 'dist'),
    path.join(projectPath, 'build'),
    path.join(projectPath, 'www'),
  ];
  for (const dir of staticCandidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) {
      return { type: 'static', staticDir: dir, defaultPort: 8080 };
    }
  }

  return null;
}

function extractPort(text) {
  const urlMatch = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/);
  if (urlMatch) return parseInt(urlMatch[1]);
  const portMatch = text.match(/\bport\s*[:\s]\s*(\d{4,5})\b/i);
  if (portMatch) return parseInt(portMatch[1]);
  return null;
}

function killAllPreviews() {
  for (const [p, entry] of previewServers) {
    if (entry.isStatic && entry.server) {
      try { entry.server.close(); } catch {}
    } else if (entry.proc) {
      try { process.kill(-entry.proc.pid, 'SIGTERM'); } catch {}
    }
    previewServers.delete(p);
  }
}

// Check if node_modules exists, auto-install if missing
function ensureDepsInstalled(projectPath) {
  const pkgPath = path.join(projectPath, 'package.json');
  const nmPath = path.join(projectPath, 'node_modules');
  if (fs.existsSync(pkgPath) && !fs.existsSync(nmPath)) {
    console.log(`Installing dependencies for ${projectPath}...`);
    try {
      execSync('npm install', {
        cwd: projectPath,
        stdio: 'pipe',
        env: { ...process.env, PATH: FULL_PATH, HOME: os.homedir() },
        timeout: 120000,
      });
      console.log(`Dependencies installed for ${projectPath}`);
      return { installed: true };
    } catch (err) {
      console.error('npm install failed:', err.message);
      return { installed: false, error: 'Failed to install dependencies: ' + err.message };
    }
  }
  return { installed: true };
}

// Preview status — client uses the port to load iframe directly
app.get('/api/preview/port', (req, res) => {
  const entry = [...previewServers.values()][0];
  if (!entry || !entry.port) return res.json({ port: null });
  res.json({ port: entry.port });
});

// Start preview dev server
app.post('/api/preview/start', async (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });

  // Kill ALL existing preview servers
  killAllPreviews();

  const setup = detectDevSetup(projectPath);
  if (!setup) return res.status(400).json({ error: 'Could not detect how to preview this project. It needs a package.json with a "dev" script, or an index.html file.' });

  // Static HTML — serve directly, no spawned process needed
  if (setup.type === 'static') {
    const assignedPort = await findFreePort(setup.defaultPort);
    const staticApp = express();
    staticApp.use(express.static(setup.staticDir));
    const staticServer = http.createServer(staticApp);
    staticServer.listen(assignedPort, '127.0.0.1', () => {
      previewServers.set(projectPath, { server: staticServer, port: assignedPort, isStatic: true });
      console.log(`Static preview: ${setup.staticDir} → port ${assignedPort}`);
      return res.json({ ready: true, url: `http://localhost:${assignedPort}` });
    });
    staticServer.on('error', (err) => {
      return res.status(500).json({ error: 'Failed to start static server: ' + err.message });
    });
    return;
  }

  // Auto-install dependencies if missing
  const depsResult = ensureDepsInstalled(projectPath);
  if (!depsResult.installed) {
    return res.status(500).json({ error: depsResult.error });
  }

  // Find a guaranteed-free port
  const assignedPort = await findFreePort(setup.defaultPort);

  let responded = false;
  let detectedPort = assignedPort;

  let args = [...setup.args];
  if (setup.portFlag && setup.portArgs) {
    args.push(setup.portFlag, ...setup.portArgs, String(assignedPort));
    if (setup.noOpen) args.push(...setup.noOpen);
  } else if (setup.noOpen) {
    args.push(...setup.noOpen);
  }

  try {
    const proc = spawn(setup.cmd, args, {
      cwd: projectPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
        BROWSER: 'none',
        DISABLE_OPEN_BROWSER: '1',
        HOME: os.homedir(),
        PATH: FULL_PATH,
        PORT: String(assignedPort),
      },
    });

    previewServers.set(projectPath, { proc, port: assignedPort });
    console.log(`Preview started: ${projectPath} → port ${assignedPort} (pid ${proc.pid})`);

    // Wait until the dev server actually responds before telling the client
    function waitForServer(port, retries = 20) {
      if (responded) return;
      const checkReq = http.get(`http://127.0.0.1:${port}`, (resp) => {
        if (!responded) {
          responded = true;
          res.json({ ready: true, url: `http://localhost:${port}` });
        }
      });
      checkReq.on('error', () => {
        if (retries > 0 && !responded) {
          setTimeout(() => waitForServer(port, retries - 1), 500);
        }
      });
      checkReq.setTimeout(2000, () => checkReq.destroy());
    }

    const onOutput = (data) => {
      const text = data.toString();
      const port = extractPort(text);
      if (port) detectedPort = port;

      const entry = previewServers.get(projectPath);
      if (entry) entry.port = detectedPort;

      // Once we detect a port, start polling until it actually responds
      if (!responded && port) {
        waitForServer(detectedPort);
      }
    };

    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);

    proc.on('error', (err) => {
      console.error('Preview server error:', err.message);
      previewServers.delete(projectPath);
      if (!responded) { responded = true; res.status(500).json({ error: err.message }); }
    });

    proc.on('exit', (code) => {
      console.log(`Preview exited: ${projectPath} (code ${code})`);
      previewServers.delete(projectPath);
    });

    // Timeout: if no port detected after 20s, check if it's responding
    setTimeout(() => {
      if (!responded) {
        responded = true;
        const checkReq = http.get(`http://127.0.0.1:${assignedPort}`, () => {
          res.json({ ready: true, url: `http://localhost:${assignedPort}` });
        });
        checkReq.on('error', () => {
          res.status(500).json({ error: 'Dev server did not start. Check the project has a valid dev command and dependencies are installed.' });
        });
        checkReq.setTimeout(5000, () => {
          checkReq.destroy();
          res.status(500).json({ error: 'Dev server timed out. Try running "npm install" in the project first.' });
        });
      }
    }, 20000);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/preview/stop', (req, res) => {
  const { projectPath } = req.body;
  if (!projectPath || !previewServers.has(projectPath)) return res.json({ stopped: false });
  const entry = previewServers.get(projectPath);
  if (entry.isStatic && entry.server) {
    try { entry.server.close(); } catch {}
  } else if (entry.proc) {
    try { process.kill(-entry.proc.pid, 'SIGTERM'); } catch {}
  }
  previewServers.delete(projectPath);
  console.log(`Preview stopped: ${projectPath}`);
  res.json({ stopped: true });
});

app.post('/api/preview/stop-all', (req, res) => {
  killAllPreviews();
  res.json({ stopped: true });
});

app.get('/api/preview/status', (req, res) => {
  const entry = [...previewServers.values()][0];
  if (!entry) return res.json({ running: false });
  res.json({ running: true });
});

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
          const requestedModel = msg.model && MODEL_REGISTRY[msg.model] ? msg.model : 'claude';
          const modelEntry = MODEL_REGISTRY[requestedModel];
          if (modelEntry.state !== 'ready') {
            throw new Error(`${modelEntry.name} is not available yet.`);
          }
          const binPath = resolveModelBinary(requestedModel);
          if (!binPath) {
            throw new Error(`${modelEntry.name} CLI ("${modelEntry.cli}") not found. Make sure it is installed and on your PATH.`);
          }
          const claudeArgs = [binPath];

          // Use Python PTY bridge to get a real pseudo-terminal
          childProc = spawn('python3', [
            PTY_BRIDGE,
            String(cols),
            String(rows),
            cwd,
            ...claudeArgs
          ], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
              ...process.env,
              TERM: 'xterm-256color',
              FORCE_COLOR: '1',
              HOME: os.homedir(),
              PATH: FULL_PATH,
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

// ── File watcher WebSocket ──────────────────────────────────────────────────
fileWss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const projectPath = url.searchParams.get('path');
  if (!projectPath || !path.resolve(projectPath).startsWith(os.homedir())) {
    ws.close(1008, 'Invalid path');
    return;
  }

  let watcher = null;
  const debounceTimers = new Map();

  try {
    // macOS supports recursive fs.watch natively
    watcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Skip ignored directories
      const parts = filename.split(path.sep);
      if (parts.some(p => IGNORED_DIRS.has(p) || p.startsWith('.'))) return;

      // Debounce: batch rapid changes to the same file (e.g. save + format)
      const key = filename;
      if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
      debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        if (ws.readyState === WebSocket.OPEN) {
          const fullPath = path.join(projectPath, filename);
          const exists = fs.existsSync(fullPath);
          ws.send(JSON.stringify({
            type: 'fileChange',
            event: exists ? eventType : 'delete',
            path: fullPath,
            filename,
          }));
        }
      }, 150));
    });
    console.log(`File watcher started: ${projectPath}`);
  } catch (err) {
    console.error('File watcher error:', err.message);
    ws.close(1011, 'Watch failed');
    return;
  }

  ws.on('close', () => {
    if (watcher) watcher.close();
    for (const t of debounceTimers.values()) clearTimeout(t);
    debounceTimers.clear();
    console.log(`File watcher stopped: ${projectPath}`);
  });
});

// SPA fallback
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});

// Route ALL WebSocket upgrades explicitly. Shared between HTTP and HTTPS
// listeners below so both flows see the same authorization checks.
function handleUpgrade(req, socket, head) {
  const url = new URL(req.url, 'http://localhost');
  const origin = req.headers.origin;

  if (url.pathname === '/ws' || url.pathname === '/ws/files') {
    const tokenFromQuery = url.searchParams.get('token');
    const authorized = isAllowedOrigin(origin) || tokenFromQuery === INSTALL_TOKEN;
    if (!authorized) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const target = url.pathname === '/ws' ? wss : fileWss;
    target.handleUpgrade(req, socket, head, (ws) => target.emit('connection', ws, req));
    return;
  }

  // Proxy to preview dev server (HMR)
  const entry = [...previewServers.values()][0];
  if (entry && entry.port) {
    proxy.ws(req, socket, head, { target: `http://127.0.0.1:${entry.port}` });
  } else {
    socket.destroy();
  }
}

server.on('upgrade', handleUpgrade);

// Clean up preview servers on exit
process.on('SIGTERM', () => { killAllPreviews(); process.exit(0); });
process.on('SIGINT', () => { killAllPreviews(); process.exit(0); });

const PORT = process.env.PORT || 3456;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Hemingweight running at http://localhost:${PORT}`);
});

// ── Optional HTTPS listener for the web-entry flow ──────────────────────────
// Loaded only if a local cert exists at ~/.hemingweight/certs/ (populated by
// dev-https-setup.sh). The extension flow on :3456 is untouched regardless.
const TLS_CERT_DIR = path.join(CONFIG_DIR, 'certs');
const TLS_CERT_PATH = path.join(TLS_CERT_DIR, 'localhost.pem');
const TLS_KEY_PATH = path.join(TLS_CERT_DIR, 'localhost-key.pem');
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 3457;

function tryLoadTlsOptions() {
  try {
    if (fs.existsSync(TLS_CERT_PATH) && fs.existsSync(TLS_KEY_PATH)) {
      return { cert: fs.readFileSync(TLS_CERT_PATH), key: fs.readFileSync(TLS_KEY_PATH) };
    }
  } catch (err) {
    console.warn('Failed to load TLS cert:', err.message);
  }
  return null;
}

const tlsOpts = tryLoadTlsOptions();
if (tlsOpts) {
  const httpsServer = https.createServer(tlsOpts, app);
  httpsServer.on('upgrade', handleUpgrade);
  httpsServer.on('error', (err) => console.error('HTTPS server error:', err.message));
  httpsServer.listen(HTTPS_PORT, '127.0.0.1', () => {
    console.log(`Hemingweight (HTTPS) running at https://localhost:${HTTPS_PORT}`);
  });
} else {
  console.log(`HTTPS disabled: no cert at ${TLS_CERT_PATH} (run ./dev-https-setup.sh to enable)`);
}
