# Clawable

**Claude Code in the browser.** A local IDE that wraps [Claude Code](https://claude.ai/claude-code) with a visual interface — live preview, file browser, version control, and one-click integrations.

---

## Quick Start

```bash
git clone https://github.com/AlexandreFlamant/clawable.git
cd clawable
./install.sh
```

Then open **http://localhost:3456** in your browser.

### One-Line Install (Recommended)

If you're setting up from scratch, this single command installs everything you need:

```bash
curl -fsSL https://raw.githubusercontent.com/AlexandreFlamant/clawable/main/install-remote.sh | bash
```

This installs Node.js, Python 3, Git, Claude Code CLI, downloads Clawable, builds it, and registers the Chrome extension. After it finishes:

1. Open Chrome → go to `chrome://extensions`
2. Turn on **Developer mode** (top right toggle)
3. Click **Load unpacked** → select `~/Developer/clawable/extension`
4. Click the Clawable extension icon
5. Sign in to your Claude account when prompted
6. Start building!

---

## Onboarding Guide

New to Clawable? Here's everything you need to get started:

### Step 1: Install

Open your Terminal (press Cmd+Space, type "Terminal", press Enter) and paste:

```bash
curl -fsSL https://raw.githubusercontent.com/AlexandreFlamant/clawable/main/install-remote.sh | bash
```

This takes about 2 minutes. You'll see green checkmarks as each component is installed.

### Step 2: Add the Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions` (type it in the address bar)
3. Turn on **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Navigate to `~/Developer/clawable/extension` and select it

You'll see the Clawable claw icon appear in your Chrome toolbar.

### Step 3: Sign in to Claude

1. Click the Clawable extension icon
2. Open Clawable (Side Panel or Popup Window)
3. Select any project — Claude Code will start
4. On first launch, Claude Code will ask you to sign in. You need either:
   - **Claude Max** ($100/month, unlimited) — sign up at [claude.ai](https://claude.ai)
   - **Anthropic API key** (pay as you go) — get one at [console.anthropic.com](https://console.anthropic.com)

### Step 4: Start Building

1. Click the project dropdown and select **New Project**
2. Give it a name (e.g., "my-website")
3. In the terminal, describe what you want: *"Build me a landing page for a bakery with a menu and contact form"*
4. Watch Claude build it — the preview updates automatically
5. Keep chatting to refine: *"Make the header dark green"*, *"Add a photo gallery"*

### What's What

| Part of the screen | What it does |
|---|---|
| **Left panel** | Chat with Claude — type what you want built |
| **Preview tab** | See your website as it's being built |
| **Code tab** | Browse the files Claude created |
| **CLAUDE.md tab** | Edit the file that gives Claude context about your project |
| **Integrations** | Connect GitHub (save your code) and Supabase (add a database) |
| **Clock icon** | See version history — go back to any previous version |

### Requirements

- **Node.js** (v18+)
- **Python 3** (for terminal PTY)
- **Claude Code CLI** installed at `/opt/homebrew/bin/claude` ([install guide](https://claude.ai/claude-code))
- **Git** (for version control features)

---

## How It Works

Clawable runs a local Node.js server on port 3456 that:

1. Serves the browser UI
2. Spawns a real Claude Code terminal session via a Python PTY bridge
3. Detects and launches your project's dev server for live preview
4. Watches files for changes and auto-refreshes the preview
5. Provides git operations, integrations, and a code viewer

Your projects live in `~/Developer/`. Select or create one, and Claude Code starts in that directory.

---

## The Interface

### Left Panel — Terminal

This is Claude Code running in a real terminal. Type prompts, approve tool use, and watch Claude work — exactly like the CLI, but in your browser.

**Bottom bar** has three git quick-actions:

| Button | What it does |
|--------|-------------|
| **Commit** | `git add -A && git commit` — saves a local snapshot |
| **Push** | `git push` — uploads existing commits to GitHub |
| **Commit & Push** | Both in one step |

### Right Panel — Tabs

| Tab | Purpose |
|-----|---------|
| **Preview** | Live preview of your app in an iframe. Auto-refreshes on file changes. |
| **Code** | Read-only file browser with syntax highlighting. |
| **CLAUDE.md** | View and edit your project's CLAUDE.md (the file that gives Claude context). |
| **Integrations** | Connect GitHub, Supabase, and more. |

---

## Preview System

Click **Run Preview** and Clawable auto-detects your project type:

| Framework | How it's detected | Command |
|-----------|-------------------|---------|
| Next.js | `next` in dependencies | `npm run dev -p <port>` |
| Vite / React | `vite` in dependencies | `npm run dev --port <port>` |
| Create React App | `react-scripts` in dependencies | `npm start` |
| Nuxt | `nuxt` in dependencies | `npm run dev --port <port>` |
| SvelteKit | `svelte` or `@sveltejs/kit` | `npm run dev --port <port>` |
| Astro | `astro` in dependencies | `npm run dev --port <port>` |
| Django | `manage.py` exists | `python3 manage.py runserver` |
| Flask | `app.py` exists | `python3 app.py` |
| Static HTML | `index.html` found | Express static server |

Dependencies are auto-installed if `node_modules` is missing.

### Page Navigator

The address bar in the preview toolbar doubles as a page navigator. Click it to see a dropdown of all detected routes:

- **Next.js App Router**: scans `app/**/page.tsx`
- **Next.js Pages Router**: scans `pages/**/*.tsx`
- **Static sites**: finds all `.html` files

Click a page to navigate the preview. The "open in new tab" arrow opens the dev server URL directly.

---

## Version Control (Git)

### From the Git Panel

Open **Integrations > GitHub** to access the full Git panel:

- **Connect a repo**: paste a GitHub URL to initialize git and set the remote
- **View changes**: see modified/added/deleted files with colored diffs
- **Commit history**: browse the last 30 commits; expand any to see its diff
- **Restore**: roll back to any previous commit (creates a new commit on top)

### From the Terminal Bottom Bar

The three buttons at the bottom of the chat panel give you quick access without leaving the terminal:

- **Commit** — saves a snapshot with message "Update from Clawable"
- **Push** — pushes to the remote
- **Commit & Push** — both at once

### Version History

Click the clock icon in the left panel header to open the version history overlay. Each commit shows:

- Full commit message (no truncation)
- Short hash and timestamp
- Expand arrow to see changed files and the diff
- **View** button to temporarily preview that version
- **Restore** button to roll back

---

## Integrations

Click **Integrations** in the tab bar to open the integrations dropdown.

### GitHub

Connects your project to a GitHub repository.

**To connect:**
1. Create a repo on [github.com](https://github.com/new)
2. Copy the repo URL (e.g. `https://github.com/you/my-project.git`)
3. Open Integrations > GitHub > paste the URL > click **Connect**

Clawable will initialize git (if needed), add the remote, create an initial commit, and push.

### Supabase

One-click setup for [Supabase](https://supabase.com) — auth, database, and storage.

**To connect:**
1. Create a project at [supabase.com](https://supabase.com/dashboard)
2. Go to **Settings > API** in your Supabase dashboard
3. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
4. Copy the **anon/public key** (starts with `eyJ...`)
5. Open Integrations > Supabase > paste both values > click **Connect**

**What happens when you connect:**
- Installs `@supabase/supabase-js` via npm (or yarn/pnpm if detected)
- Creates `.env.local` with your credentials
- Generates `lib/supabase.ts` (or `src/lib/supabase.ts` if you have a `src/` directory)

**Framework-aware:** Clawable auto-detects your framework and uses the right env variable prefix:

| Framework | Env var names |
|-----------|--------------|
| Next.js | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| Vite | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Other | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

The generated client file also uses the correct env access pattern (`process.env.*` vs `import.meta.env.*`).

After connecting, just tell Claude Code: *"Add Supabase auth to the login page"* and it will use the configured client.

### Vercel & Netlify

Coming soon.

---

## Code Viewer

The **Code** tab gives you a read-only view of your project files:

- **File tree** on the left with color-coded icons by file type
- **Search** to filter files by name
- **Multiple tabs** — open several files at once
- **Syntax highlighting** for JS, TS, HTML, CSS, JSON, Python, Bash, Markdown, YAML, SQL, and more
- **Live updates** — open files auto-refresh when changed, with an orange dot indicator

---

## CLAUDE.md Editor

The **CLAUDE.md** tab lets you view and edit your project's `CLAUDE.md` file — the file that tells Claude Code about your project's architecture, conventions, and context.

If your project doesn't have one, click **Create CLAUDE.md** to start with a template.

---

## Chrome Extension

Clawable includes a Chrome extension for quick access:

- **Side panel mode** — opens Clawable as a browser side panel alongside any webpage
- **Popup mode** — opens Clawable in a standalone window (1400x900)
- **Auto-launch** — the extension automatically starts the Clawable server if it's not running (via native messaging host)

To install the extension:
1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder

---

## FAQ

### Where do my projects live?

All projects are in `~/Developer/`. Clawable lists every directory in that folder as a project.

### Can I use an existing project?

Yes. Any folder in `~/Developer/` shows up automatically. Just select it from the project dropdown.

### How do I stop the preview?

Click the red **Stop** button in the preview toolbar. This kills the dev server process.

### The preview isn't loading — what's wrong?

- Make sure `package.json` has a `dev` or `start` script
- Check if `node_modules` exists (Clawable auto-installs, but it can timeout on slow connections)
- Try running `npm install` in the project directory first

### Can I change the port?

Set the `PORT` environment variable before starting:
```bash
PORT=8080 node server.js
```

### Claude Code isn't starting

Make sure Claude Code CLI is installed:
```bash
which claude
```

It should be at `/opt/homebrew/bin/claude`. If it's elsewhere, you'll need to update the path in `server.js`.

### How do I update?

```bash
git pull
cd client && npm run build
```

Then restart the server.

### Is my code sent anywhere?

No. Clawable runs entirely locally. Your code stays on your machine. The only network calls are:
- Claude Code's own API calls to Anthropic (same as using the CLI)
- Git push/pull to your configured remote
- npm install from the npm registry

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │   Terminal    │  │   Preview / Code /     │   │
│  │  (xterm.js)  │  │   CLAUDE.md / Git      │   │
│  └──────┬───────┘  └───────────┬────────────┘   │
│         │ WebSocket            │ HTTP            │
└─────────┼──────────────────────┼────────────────┘
          │                      │
┌─────────┼──────────────────────┼────────────────┐
│         ▼          Server (:3456)                │
│  ┌──────────────┐  ┌──────────────────────┐     │
│  │  PTY Bridge  │  │   REST API + Proxy   │     │
│  │  (Python)    │  │   (Express)          │     │
│  └──────┬───────┘  └──────────┬───────────┘     │
│         │                     │                  │
│         ▼                     ▼                  │
│  ┌──────────────┐  ┌──────────────────────┐     │
│  │  Claude Code │  │  Dev Server (Vite,   │     │
│  │  CLI         │  │  Next.js, etc.)      │     │
│  └──────────────┘  └──────────────────────┘     │
└─────────────────────────────────────────────────┘
```

---

## License

MIT
