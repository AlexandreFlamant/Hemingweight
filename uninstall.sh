#!/bin/bash
# Uninstall Clawable background service

PLIST_NAME="com.clawable.server"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"

if [ -f "$PLIST_PATH" ]; then
  launchctl unload "$PLIST_PATH" 2>/dev/null
  rm "$PLIST_PATH"
  echo "Clawable server stopped and removed from login items."
else
  echo "Clawable is not installed as a service."
fi
