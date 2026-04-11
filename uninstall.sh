#!/bin/bash
# Clawable uninstaller — removes the Chrome native messaging manifest,
# stops the running server, and cleans up local state.

MANIFEST_NAME="com.clawable.server.json"
SERVER_PORT=3456
LOG_DIR="$HOME/.clawable"

if [[ "$OSTYPE" == "darwin"* ]]; then
  CHROME_NM_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  CHROME_NM_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
else
  echo "Unsupported OS: $OSTYPE (supported: macOS, Linux)"
  exit 1
fi

echo ""
echo "Clawable — Uninstall"
echo "===================="
echo ""

# 1. Remove Chrome native messaging manifest
MANIFEST_PATH="$CHROME_NM_DIR/$MANIFEST_NAME"
if [ -f "$MANIFEST_PATH" ]; then
  rm -f "$MANIFEST_PATH"
  echo "  - Removed native messaging manifest"
else
  echo "  - Native messaging manifest not found (already removed)"
fi

# 2. Stop any running Clawable server on SERVER_PORT
PIDS="$(lsof -ti tcp:$SERVER_PORT 2>/dev/null || true)"
if [ -n "$PIDS" ]; then
  # shellcheck disable=SC2086
  kill $PIDS 2>/dev/null || true
  sleep 1
  STILL="$(lsof -ti tcp:$SERVER_PORT 2>/dev/null || true)"
  if [ -n "$STILL" ]; then
    # shellcheck disable=SC2086
    kill -9 $STILL 2>/dev/null || true
  fi
  echo "  - Stopped server on port $SERVER_PORT"
else
  echo "  - No running server on port $SERVER_PORT"
fi

# 3. Remove legacy LaunchAgent (from pre-native-messaging installs)
OLD_PLIST="$HOME/Library/LaunchAgents/com.clawable.server.plist"
if [ -f "$OLD_PLIST" ]; then
  launchctl unload "$OLD_PLIST" 2>/dev/null || true
  rm -f "$OLD_PLIST"
  echo "  - Removed legacy LaunchAgent"
fi

# 4. Optionally remove local log/state directory
if [ -d "$LOG_DIR" ]; then
  printf "  - Remove local state at %s? [y/N] " "$LOG_DIR"
  read -r REPLY < /dev/tty || REPLY=""
  case "$REPLY" in
    y|Y|yes|YES)
      rm -rf "$LOG_DIR"
      echo "    Removed."
      ;;
    *)
      echo "    Kept."
      ;;
  esac
fi

echo ""
echo "Uninstall complete."
echo ""
echo "Note: this does not remove the Chrome extension itself or the"
echo "cloned repo. To fully remove Clawable:"
echo "  - Remove the extension at chrome://extensions"
echo "  - Delete the repo directory if you no longer need it"
echo ""
