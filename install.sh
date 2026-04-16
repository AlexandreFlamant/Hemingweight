#!/bin/bash
set -e

# Hemingweight — one-time setup for native messaging auto-launch
# This registers the native messaging host with Chrome so the extension
# can auto-start the server without needing a terminal.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_SCRIPT="$SCRIPT_DIR/native-host/hemingweight-host.sh"
TEMPLATE="$SCRIPT_DIR/native-host/com.hemingweight.server.json.template"
MANIFEST_NAME="com.hemingweight.server.json"

# Detect OS and set native messaging directories (install to all supported browsers)
if [[ "$OSTYPE" == "darwin"* ]]; then
  NM_DIRS=(
    "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    "$HOME/Library/Application Support/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  )
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  NM_DIRS=(
    "$HOME/.config/google-chrome/NativeMessagingHosts"
    "$HOME/.config/BraveSoftware/Brave-Browser/NativeMessagingHosts"
  )
else
  echo "Unsupported OS: $OSTYPE (supported: macOS, Linux)"
  exit 1
fi

echo ""
echo "Hemingweight — Native Messaging Setup"
echo "======================================"
echo ""

# Unload old LaunchAgent if present (migration from previous install)
OLD_PLIST="$HOME/Library/LaunchAgents/com.hemingweight.server.plist"
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

# Step 3: Generate manifest for each browser
echo ""
echo "Generating native messaging manifest..."
for NM_DIR in "${NM_DIRS[@]}"; do
  mkdir -p "$NM_DIR"
  sed -e "s|HEMINGWEIGHT_HOST_SH_PATH|$HOST_SCRIPT|g" \
      "$TEMPLATE" > "$NM_DIR/$MANIFEST_NAME"
  echo "  -> $NM_DIR/$MANIFEST_NAME"
done

# Step 4: Make host script executable
chmod +x "$HOST_SCRIPT"

# Done
echo ""
echo "Setup complete!"
echo ""
echo "You can now use Hemingweight by clicking the extension icon."
echo "The server will start automatically — no terminal needed."
echo ""
echo "To uninstall, run:"
echo "  bash \"$SCRIPT_DIR/uninstall.sh\""
echo ""
