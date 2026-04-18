#!/bin/bash
set -e

# Removes the Hemingweight web-entry LaunchAgent installed by
# install-launch-agent.sh. Leaves the rest of Hemingweight untouched.

if [[ "$OSTYPE" != "darwin"* ]]; then
  echo "macOS-only."
  exit 1
fi

LABEL="com.hemingweight.webserver"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

if [ -f "$PLIST" ]; then
  rm -f "$PLIST"
  echo "Removed $PLIST"
else
  echo "No plist at $PLIST (already removed)."
fi

echo "Done. The Hemingweight server will no longer auto-start at login."
