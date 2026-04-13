# Clawable Install Testing Guide

Self-contained instructions for testing the install flow on a fresh Mac. No prior context needed — just follow the steps.

---

## Option A: Test on a New macOS User Account

### Create the test user

1. Open **System Settings** → **Users & Groups**
2. Click the **+** button (you may need to unlock with your password)
3. Create a new user:
   - Name: `Test User`
   - Account type: Administrator (needed for Homebrew install)
   - Password: anything you'll remember
4. Log out of your account (Apple menu → Log Out)
5. Log into the **Test User** account

### What to test

You're now on a clean Mac user account. This simulates a new user who just found Clawable.

---

## The Install Flow (What the User Does)

### Step 1: Install Node.js

Go to https://nodejs.org and download the LTS installer. Run it. This gives you `node` and `npm`.

To verify, open Terminal (`Cmd + Space` → type `Terminal` → Enter):
```
node --version
npm --version
```

### Step 2: Install Claude Code

In Terminal, run:
```
npm install -g @anthropic-ai/claude-code
```

Then start Claude Code:
```
claude
```

It will prompt you to authenticate. Sign in with your Claude account (you need Claude Max or an API key).

### Step 3: Paste the Install Prompt

Once Claude Code is running, paste this entire block and press Enter:

```
Install Clawable on this machine. Here's exactly what to do:

1. Check prerequisites: make sure node (v18+), python3, and git are available. If anything is missing, install it via Homebrew (install Homebrew first if needed on macOS).

2. Clone the repo: if ~/Developer/clawable exists, cd into it and run "git pull". Otherwise run "git clone https://github.com/AlexandreFlamant/clawable.git ~/Developer/clawable". Create ~/Developer if it doesn't exist.

3. Install dependencies: run "npm install --production" in ~/Developer/clawable, then "npm install" in ~/Developer/clawable/client.

4. Build the client: run "npm run build" in ~/Developer/clawable/client. Verify that ~/Developer/clawable/client/dist/index.html exists after.

5. Compute the Chrome extension ID from the key in the extension manifest — do NOT use the file path. Run this command:

   python3 -c "
   import json, hashlib, base64, os
   manifest = json.load(open(os.path.expanduser('~/Developer/clawable/extension/manifest.json')))
   key_bytes = base64.b64decode(manifest['key'])
   digest = hashlib.sha256(key_bytes).hexdigest()[:32]
   print(''.join(chr(ord('a') + int(c, 16)) for c in digest))
   "

   The result must be oppghhmjfjibmjjbpchmhheelfcnbboo. If it is not, stop and report the error.

6. Register Chrome native messaging: read the template at ~/Developer/clawable/native-host/com.clawable.server.json.template. Replace CLAWABLE_HOST_SH_PATH with the absolute path to ~/Developer/clawable/native-host/clawable-host.sh, and set allowed_origins to ["chrome-extension://oppghhmjfjibmjjbpchmhheelfcnbboo/"]. Write the result to the Chrome NativeMessagingHosts directory — on macOS that's "~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.clawable.server.json", on Linux it's "~/.config/google-chrome/NativeMessagingHosts/com.clawable.server.json". Create the directory if needed.

7. Make the host script executable: run "chmod +x ~/Developer/clawable/native-host/clawable-host.sh"

When everything is done, tell me to open Chrome, go to chrome://extensions, enable Developer mode (top right toggle), click Load unpacked, and select ~/Developer/clawable/extension.
```

Watch what Claude does. Approve each command it asks to run. Note any errors.

### Step 4: Load the Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Navigate to your home folder → Developer → clawable → extension
   - The full path is: `/Users/testuser/Developer/clawable/extension`
   - (Replace `testuser` with whatever username you created)
6. The Clawable claw icon should appear in the Chrome toolbar

### Step 5: Verify It Works

1. Click the Clawable icon
2. Choose "Side Panel" or "Window"
3. It should connect to the local server and show the Clawable interface
4. Try creating a project and typing a prompt

---

## What to Watch For (Checklist)

### During Claude install (Step 3):

- [ ] Did Claude find or install Homebrew?
- [ ] Did Claude find or install python3?
- [ ] Did Claude find or install git?
- [ ] Did `npm install --production` succeed in the root?
- [ ] Did `npm install` succeed in the client?
- [ ] Did `npm run build` succeed in the client?
- [ ] Did Claude compute the extension ID from the manifest key using python3?
- [ ] Did Claude create the native messaging manifest?
- [ ] Did Claude set allowed_origins to `["chrome-extension://oppghhmjfjibmjjbpchmhheelfcnbboo/"]`?
- [ ] Did Claude make clawable-host.sh executable?

### During Chrome extension load (Step 4):

- [ ] Does the extension load without errors?
- [ ] Does the Clawable icon appear in the toolbar?

### During first use (Step 5):

- [ ] Does clicking the icon open the panel?
- [ ] Does the server start automatically (no Terminal needed)?
- [ ] Can you see and select/create a project?
- [ ] Does the terminal connect and show Claude Code?
- [ ] Can you type a prompt and get a response?
- [ ] Does the live preview work?

---

## Reset for Another Test (Uninstall Script)

To test again, run this in Terminal to fully reset Clawable:

```bash
# Stop Clawable server if running
pkill -f "node.*server.js" 2>/dev/null

# Remove Clawable files
rm -rf ~/Developer/clawable

# Remove native messaging registration
rm -f ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.clawable.server.json

# Remove server logs
rm -rf ~/.clawable

# Remove the extension from Chrome manually:
# Go to chrome://extensions and click "Remove" on Clawable

echo "Clawable fully removed. Ready to test install again."
```

After running this, go back to **Step 3** (paste the prompt into Claude) to re-test.

If you want a completely clean test (including Node/Homebrew), also run:
```bash
# Remove Homebrew (nuclear option — only if testing fresh install)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/uninstall.sh)"

# Remove Node.js (if installed via .pkg)
sudo rm -rf /usr/local/lib/node_modules
sudo rm -rf /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx

# Remove Claude Code
npm uninstall -g @anthropic-ai/claude-code 2>/dev/null
```

---

## Quick Reference

| Item | Location |
|------|----------|
| Clawable repo | `~/Developer/clawable` |
| Server code | `~/Developer/clawable/server.js` |
| Extension files | `~/Developer/clawable/extension/` |
| Client build output | `~/Developer/clawable/client/dist/` |
| Native messaging manifest | `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.clawable.server.json` |
| Native host script | `~/Developer/clawable/native-host/clawable-host.sh` |
| Server logs | `~/.clawable/server.log` |
| Server port | `localhost:3456` |

## Debugging

If something doesn't work after install:

**Server won't start:**
```bash
# Check if server is running
curl http://localhost:3456/api/health

# Check server logs
cat ~/.clawable/server.log

# Try starting manually
cd ~/Developer/clawable && node server.js
```

**Extension can't connect to server:**
```bash
# Verify native messaging manifest exists and is correct
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.clawable.server.json

# Verify the host script path in the manifest points to a real file
# Verify allowed_origins contains the computed extension ID (not a wildcard)
```

**Claude Code won't start in the browser terminal:**
```bash
# Check which claude path is in server.js
grep "claudeArgs" ~/Developer/clawable/server.js

# Compare with actual location
which claude
```

---

## Landing Page (Live)

https://clawable-xi.vercel.app

Password: `ErnestoHemingweight`
