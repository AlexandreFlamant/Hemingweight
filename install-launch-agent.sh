#!/bin/bash
set -e

# Hemingweight LaunchAgent installer (macOS)
# ------------------------------------------
# Installs a user-level LaunchAgent so the Hemingweight server auto-starts at
# login and restarts on crash. Required for the web-entry flow (the website at
# hemingweight.vercel.app/test_site cannot start the server on its own).
#
# Uses a distinct label (com.hemingweight.webserver) that does NOT collide with
# the legacy label (com.hemingweight.server) handled by install.sh, so running
# the classic extension installer later will not remove this agent.
#
# Idempotent.

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "This script is macOS-only. For Linux, use a systemd user unit instead."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE="$SCRIPT_DIR/launch-agent/com.hemingweight.webserver.plist.template"
LABEL="com.hemingweight.webserver"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

if [ ! -f "$TEMPLATE" ]; then
  echo "Template not found: $TEMPLATE"
  exit 1
fi

NODE_PATH="$(command -v node || true)"
if [ -z "$NODE_PATH" ]; then
  echo "node not found on PATH. Install Node 18+ and re-run."
  exit 1
fi

echo ""
echo "Hemingweight - LaunchAgent Install"
echo "==================================="
echo ""
echo "  repo:   $SCRIPT_DIR"
echo "  node:   $NODE_PATH"
echo "  plist:  $PLIST"
echo ""

mkdir -p "$HOME/Library/LaunchAgents"
mkdir -p "$HOME/.hemingweight"

# Render the template with absolute paths
sed \
  -e "s|__NODE_PATH__|$NODE_PATH|g" \
  -e "s|__REPO_DIR__|$SCRIPT_DIR|g" \
  -e "s|__HOME__|$HOME|g" \
  "$TEMPLATE" > "$PLIST"

# Unload any previous instance (ignore failure), then load the fresh one
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/$LABEL" 2>/dev/null || true

echo ""
echo "Loaded. The server will start on every login and restart on crash."
echo "Logs:"
echo "  $HOME/.hemingweight/webserver.out.log"
echo "  $HOME/.hemingweight/webserver.err.log"
echo ""
echo "To remove, run: bash \"$SCRIPT_DIR/uninstall-launch-agent.sh\""
echo ""
