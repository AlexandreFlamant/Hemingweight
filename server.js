const express = require('express');
const http = require('http');
const httpProxy = require('http-proxy');
const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
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
const wss = new WebSocket.Server({ noServer: true });
const fileWss = new WebSocket.Server({ noServer: true });

// Serve static frontend in production
app.use(express.static(path.join(__dirname, 'client/dist')));
app.use(express.json());

const PTY_BRIDGE = path.join(__dirname, 'pty-bridge.py');

// Ensure common binary paths are available (native host may launch with a minimal PATH)
const FULL_PATH = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin']
  .concat((process.env.PATH || '').split(':'))
  .filter((v, i, a) => v && a.indexOf(v) === i)
  .join(':');

// Health check for extension auto-launch
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// API to list recent projects (directories)
app.get('/api/projects', (req, res) => {
  const home = os.homedir();
  const devDir = path.join(home, 'Developer');
  try {
    const dirs = fs.readdirSync(devDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const projPath = path.join(devDir, d.name);
        let gitConnected = false;
        try {
          execSync('git remote get-url origin', { cwd: projPath, stdio: 'pipe' });
          gitConnected = true;
        } catch {}
        return { name: d.name, path: projPath, gitConnected };
      })
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
  const home = os.homedir();
  const devDir = path.join(home, 'Developer');
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
  const { projectPath, message } = req.body;
  if (!projectPath) return res.status(400).json({ error: 'projectPath required' });
  const home = os.homedir();
  if (!path.resolve(projectPath).startsWith(home)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const gitEnv = { ...process.env, PATH: FULL_PATH, HOME: home };
  try {
    execSync('git add -A', { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    const commitMsg = message || 'Update from Clawable';
    try {
      execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: projectPath, stdio: 'pipe', env: gitEnv });
    } catch {
      // Nothing to commit
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
    const envPath = path.join(projectPath, '.env.local');
    if (!fs.existsSync(envPath)) return res.json({ connected: false, prefix });
    const content = fs.readFileSync(envPath, 'utf-8');
    const urlKey = `${prefix}SUPABASE_URL`;
    const anonKey = `${prefix}SUPABASE_ANON_KEY`;
    const urlMatch = content.match(new RegExp(`^${urlKey}=(.+)$`, 'm'));
    const hasKey = new RegExp(`^${anonKey}=.+`, 'm').test(content);
    res.json({
      connected: !!urlMatch && hasKey,
      url: urlMatch ? urlMatch[1].trim() : undefined,
      prefix,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/supabase/connect', (req, res) => {
  const { projectPath, supabaseUrl, supabaseAnonKey } = req.body;
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
// All preview traffic is proxied through /preview/ on the Clawable server.
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

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const srv = require('net').createServer();
    srv.listen(startPort, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', () => resolve(findFreePort(startPort + 1)));
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
      if (deps['vite'] || deps['@vitejs/plugin-react']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173, portFlag: '--', portArgs: ['--port'] };
      if (deps['react-scripts']) return { cmd: 'npm', args: ['start'], defaultPort: 3000 };
      if (deps['nuxt']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 3000, portFlag: '--', portArgs: ['--port'] };
      if (deps['svelte'] || deps['@sveltejs/kit']) return { cmd: 'npm', args: ['run', 'dev'], defaultPort: 5173, portFlag: '--', portArgs: ['--port'] };
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

// Route ALL WebSocket upgrades explicitly
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else if (url.pathname === '/ws/files') {
    fileWss.handleUpgrade(req, socket, head, (ws) => {
      fileWss.emit('connection', ws, req);
    });
  } else {
    // Proxy to preview dev server (HMR)
    const entry = [...previewServers.values()][0];
    if (entry && entry.port) {
      proxy.ws(req, socket, head, { target: `http://127.0.0.1:${entry.port}` });
    } else {
      socket.destroy();
    }
  }
});

// Clean up preview servers on exit
process.on('SIGTERM', () => { killAllPreviews(); process.exit(0); });
process.on('SIGINT', () => { killAllPreviews(); process.exit(0); });

const PORT = process.env.PORT || 3456;
server.listen(PORT, () => {
  console.log(`Clawable running at http://localhost:${PORT}`);
});
