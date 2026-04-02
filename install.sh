#!/bin/bash
# Clawable installer — sets up the server to run automatically on login

CLAUDABLE_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_PATH="$(which node)"
PLIST_NAME="com.clawable.server"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

echo "Installing Clawable..."
echo "  Directory: $CLAUDABLE_DIR"
echo "  Node: $NODE_PATH"

# Install dependencies if needed
if [ ! -d "$CLAUDABLE_DIR/node_modules" ]; then
  echo "  Installing dependencies..."
  cd "$CLAUDABLE_DIR" && npm install --production
fi

# Build client if needed
if [ ! -d "$CLAUDABLE_DIR/client/dist" ]; then
  echo "  Building client..."
  cd "$CLAUDABLE_DIR" && npm run build
fi

# Create Launch Agent plist
cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${CLAUDABLE_DIR}/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${CLAUDABLE_DIR}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${CLAUDABLE_DIR}/server.log</string>
    <key>StandardErrorPath</key>
    <string>${CLAUDABLE_DIR}/server.log</string>
</dict>
</plist>
EOF

# Load the agent (starts server immediately)
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo ""
echo "Clawable installed!"
echo "  Server running at http://localhost:3456"
echo "  Auto-starts on login"
echo ""
echo "To uninstall: bash $CLAUDABLE_DIR/uninstall.sh"
