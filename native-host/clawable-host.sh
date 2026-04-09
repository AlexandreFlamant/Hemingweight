#!/bin/bash

# Chrome launches native messaging hosts with a minimal PATH.
# We need to find node — check common locations.

NODE=""

# Check common node locations
for candidate in \
  /opt/homebrew/bin/node \
  /usr/local/bin/node \
  "$HOME/.nvm/versions/node"/*/bin/node \
  "$HOME/.volta/bin/node" \
  "$HOME/.fnm/aliases/default/bin/node" \
  /usr/bin/node; do
  if [ -x "$candidate" ]; then
    NODE="$candidate"
    break
  fi
done

if [ -z "$NODE" ]; then
  # Last resort: try sourcing shell profile
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
  NODE="$(which node 2>/dev/null || true)"
fi

if [ -z "$NODE" ]; then
  echo '{"status":"error","message":"node not found"}' >&2
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
exec "$NODE" "$DIR/clawable-host.js"
