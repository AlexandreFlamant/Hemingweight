#!/bin/bash
set -e

# Clawable — one-time setup for native messaging auto-launch
# This registers the native messaging host with Chrome so the extension
# can auto-start the server without needing a terminal.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/native-host/clawable-host.sh"
TEMPLATE="$SCRIPT_DIR/native-host/com.clawable.server.json.template"
MANIFEST_NAME="com.clawable.server.json"

# Detect OS and set Chrome native messaging directory
if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_NM_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE (supported: macOS, Linux)"
  exit 1
fi

echo ""
echo "Clawable — Native Messaging Setup"
echo "======================================"
echo ""

# Unload old LaunchAgent if present (migration from previous install)
OLD_PLIST="$HOME/Library/LaunchAgents/com.clawable.server.plist"
if [ -f "$OLD_PLIST" ]; then
  echo "Removing old LaunchAgent (migrating to native messaging)..."
  launchctl unload "$OLD_PLIST" 2>/dev/null || true
  rm -f "$OLD_PLIST"
fi

# Step 1: Install npm dependencies (if needed)
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo ""
  echo "Installing dependencies..."
  cd "$SCRIPT_DIR" && npm install --production
fi

# Step 2: Build client (if needed)
if [ ! -f "$SCRIPT_DIR/client/dist/index.html" ]; then
  echo ""
  echo "Building client..."
  cd "$SCRIPT_DIR/client" && npm install && npm run build
fi

# Step 3: Generate manifest
echo ""
echo "Generating native messaging manifest..."
mkdir -p "$CHROME_NM_DIR"

sed -e "s|CLAWABLE_HOST_SH_PATH|$HOST_SCRIPT|g" \
    "$TEMPLATE" > "$CHROME_NM_DIR/$MANIFEST_NAME"

echo "  -> $CHROME_NM_DIR/$MANIFEST_NAME"

# Done
echo ""
echo "Setup complete!"
echo ""
echo "You can now use Clawable by clicking the extension icon."
echo "The server will start automatically — no terminal needed."
echo ""
echo "To uninstall, run:"
echo "  bash \"$SCRIPT_DIR/uninstall.sh\""
echo ""
