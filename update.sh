#!/bin/bash
# Hemingweight updater
# --------------------
# Pulls the latest code from the main branch, rebuilds the client, and
# restarts the LaunchAgent. Idempotent. Safe to run manually or from the
# in-app Update button (server.js spawns this detached so it can replace
# the running server mid-run).
#
# Usage:
#   bash ~/Developer/hemingweight/update.sh        (explicit path)
#   bash update.sh                                  (from inside the repo)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ORANGE='\033[38;2;224;122;75m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${ORANGE}Hemingweight update${RESET}"
echo "====================="
echo ""
echo "  repo: $SCRIPT_DIR"
echo ""

# Stash anything the user has locally so pull never clobbers their work.
STASHED=0
if ! git diff --quiet HEAD -- 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo -e "${DIM}Local changes detected, stashing before pull...${RESET}"
  if git stash push -u -m "hemingweight-update-autostash" > /dev/null 2>&1; then
    STASHED=1
  else
    echo -e "${RED}Could not stash local changes, aborting.${RESET}"
    exit 1
  fi
fi

echo -e "${DIM}Pulling latest from origin/main...${RESET}"
OLD_COMMIT=$(git rev-parse HEAD)
git fetch origin main --quiet
git reset --hard origin/main
NEW_COMMIT=$(git rev-parse HEAD)

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  echo -e "${GREEN}Already up to date at $(git rev-parse --short HEAD).${RESET}"
else
  echo -e "${GREEN}Updated $(git rev-parse --short "$OLD_COMMIT") -> $(git rev-parse --short "$NEW_COMMIT")${RESET}"
fi

echo -e "${DIM}Installing server dependencies...${RESET}"
npm install --production --quiet 2>/dev/null

echo -e "${DIM}Installing and building client...${RESET}"
(cd client && npm install --quiet 2>/dev/null && npm run build --quiet 2>/dev/null)

# Restore the user's stashed work, if any.
if [ "$STASHED" = "1" ]; then
  if git stash pop > /dev/null 2>&1; then
    echo -e "${DIM}Restored your local changes.${RESET}"
  else
    echo -e "${RED}Couldn't auto-apply stashed changes. Run 'git stash list' and 'git stash pop' manually in $SCRIPT_DIR${RESET}"
  fi
fi

# Restart the LaunchAgent so the server picks up the new code. Best-effort;
# if the user isn't using the LaunchAgent (running node server.js manually),
# they'll need to restart it themselves.
if launchctl print "gui/$(id -u)/com.hemingweight.webserver" >/dev/null 2>&1; then
  echo -e "${DIM}Restarting Hemingweight server...${RESET}"
  launchctl kickstart -k "gui/$(id -u)/com.hemingweight.webserver" 2>/dev/null || true
  echo -e "${GREEN}✅ Server restarted${RESET}"
else
  echo -e "${DIM}No LaunchAgent detected. Restart your 'node server.js' manually to pick up the update.${RESET}"
fi

echo ""
echo -e "${GREEN}Update complete.${RESET}"
echo ""
