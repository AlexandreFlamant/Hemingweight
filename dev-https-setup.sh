#!/bin/bash
set -e

# Hemingweight dev HTTPS setup
# -----------------------------
# Generates a locally-trusted TLS cert for the Hemingweight server on 127.0.0.1,
# so the web-entry flow at hemingweight.vercel.app/test_site can talk to
# https://localhost:3457 without browser warnings.
#
# This is a DEV-ONLY tool. The cert is only trusted on this machine. Shipping to
# real users requires a real wildcard cert tied to a domain we control (Plex
# model). That work is deferred until a domain is provisioned.
#
# Idempotent: safe to run multiple times.

CERT_DIR="$HOME/.hemingweight/certs"
CERT_FILE="$CERT_DIR/localhost.pem"
KEY_FILE="$CERT_DIR/localhost-key.pem"

echo ""
echo "Hemingweight - Dev HTTPS Setup"
echo "==============================="
echo ""

# Step 1: ensure mkcert is installed
if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Installing via Homebrew..."
  if ! command -v brew >/dev/null 2>&1; then
    echo "Homebrew is not installed. Install it from https://brew.sh and re-run this script."
    exit 1
  fi
  brew install mkcert
  # nss is needed so Firefox trusts mkcert certs. Optional but cheap.
  brew list nss >/dev/null 2>&1 || brew install nss
else
  echo "mkcert is installed ($(mkcert -version 2>/dev/null || echo 'unknown version'))."
fi

# Step 2: install local root CA (adds to system + browser trust stores)
echo ""
echo "Installing local root CA (you may be prompted for your password)..."
mkcert -install

# Step 3: generate the cert for the two hostnames the server binds to
mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

echo ""
echo "Generating cert at $CERT_FILE..."
cd "$CERT_DIR"
mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" localhost 127.0.0.1 ::1
chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo ""
echo "Done."
echo ""
echo "  cert: $CERT_FILE"
echo "  key:  $KEY_FILE"
echo ""
echo "Restart server.js to pick up the cert. It will then listen on:"
echo "  http://localhost:3456   (extension flow, unchanged)"
echo "  https://localhost:3457  (web-entry flow, new)"
echo ""
echo "To revoke trust for the local CA later, run: mkcert -uninstall"
echo ""
