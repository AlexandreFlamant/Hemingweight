#!/bin/bash
set -e

# Hemingweight Remote Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/AlexandreFlamant/hemingweight/main/install-remote.sh | bash

HEMINGWEIGHT_DIR="$HOME/Developer/hemingweight"
ORANGE='\033[38;2;224;122;75m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
RESET='\033[0m'

echo ""
echo -e "${ORANGE}🟠 Hemingweight Installer${RESET}"
echo "====================="
echo ""

# --- Check/install Homebrew (macOS) ---
if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! command -v brew &>/dev/null; then
    echo -e "${DIM}Installing Homebrew...${RESET}"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Add Homebrew to PATH for this session
    if [ -f /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
    echo -e "${GREEN}✅ Homebrew installed${RESET}"
  else
    echo -e "${GREEN}✅ Homebrew found${RESET}"
  fi
fi

# --- Check/install Node.js ---
if ! command -v node &>/dev/null; then
  echo -e "${DIM}Installing Node.js...${RESET}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install node
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
  echo -e "${GREEN}✅ Node.js installed${RESET}"
else
  echo -e "${GREEN}✅ Node.js found ($(node --version))${RESET}"
fi

# --- Check/install Python 3 ---
if ! command -v python3 &>/dev/null; then
  echo -e "${DIM}Installing Python 3...${RESET}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install python3
  fi
  echo -e "${GREEN}✅ Python 3 installed${RESET}"
else
  echo -e "${GREEN}✅ Python 3 found${RESET}"
fi

# --- Check/install Git ---
if ! command -v git &>/dev/null; then
  echo -e "${DIM}Installing Git...${RESET}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install git
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo apt-get install -y git
  fi
  echo -e "${GREEN}✅ Git installed${RESET}"
else
  echo -e "${GREEN}✅ Git found${RESET}"
fi

# --- Check/install Claude Code ---
if ! command -v claude &>/dev/null; then
  echo -e "${DIM}Installing Claude Code...${RESET}"
  npm install -g @anthropic-ai/claude-code
  echo -e "${GREEN}✅ Claude Code installed${RESET}"
else
  echo -e "${GREEN}✅ Claude Code found${RESET}"
fi

# --- Download/update Hemingweight ---
mkdir -p "$HOME/Developer"

if [ -d "$HEMINGWEIGHT_DIR" ]; then
  echo -e "${DIM}Updating Hemingweight...${RESET}"
  cd "$HEMINGWEIGHT_DIR" && git pull --quiet
  echo -e "${GREEN}✅ Hemingweight updated${RESET}"
else
  echo -e "${DIM}Downloading Hemingweight...${RESET}"
  git clone --quiet https://github.com/AlexandreFlamant/hemingweight.git "$HEMINGWEIGHT_DIR"
  echo -e "${GREEN}✅ Hemingweight downloaded${RESET}"
fi

# --- Install dependencies ---
echo -e "${DIM}Installing dependencies...${RESET}"
cd "$HEMINGWEIGHT_DIR" && npm install --production --quiet 2>/dev/null
cd "$HEMINGWEIGHT_DIR/client" && npm install --quiet 2>/dev/null

# --- Build client ---
echo -e "${DIM}Building client...${RESET}"
cd "$HEMINGWEIGHT_DIR/client" && npm run build --quiet 2>/dev/null
echo -e "${GREEN}✅ Dependencies installed & client built${RESET}"

# --- Set up web-entry flow (macOS only for now) ---
# Installs a locally-trusted TLS cert and a LaunchAgent so the server is always
# reachable at https://localhost:3457. The site at hemingweight.com/direct
# probes that endpoint and hands off to the local app when it answers.
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo ""
  echo -e "${ORANGE}Setting up web entry...${RESET}"
  echo -e "${DIM}(You may be prompted for your password to trust the local HTTPS cert.)${RESET}"
  cd "$HEMINGWEIGHT_DIR" && bash dev-https-setup.sh
  echo -e "${GREEN}✅ Local HTTPS ready on :3457${RESET}"

  echo -e "${DIM}Enabling auto-start at login...${RESET}"
  cd "$HEMINGWEIGHT_DIR" && bash install-launch-agent.sh > /dev/null
  echo -e "${GREEN}✅ Server will auto-start on every login${RESET}"
fi

# --- Done ---
echo ""
echo -e "${GREEN}🎉 Hemingweight is installed!${RESET}"
echo ""
echo "Opening Hemingweight in your browser..."
echo ""

# Bounce the user back to the landing with ?installed=1 so the site remembers
# them as installed on the very first visit. The page reads the param, writes
# the flag to localStorage, probes the local server, and hands off.
LANDING_URL="https://www.hemingweight.com/direct/?installed=1"
if [[ "$OSTYPE" == "darwin"* ]]; then
  open "$LANDING_URL" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$LANDING_URL" 2>/dev/null || true
fi

echo -e "${DIM}If the browser didn't open, go to: $LANDING_URL${RESET}"
echo -e "${DIM}Installed at: $HEMINGWEIGHT_DIR${RESET}"
echo -e "${DIM}To stop auto-start: bash $HEMINGWEIGHT_DIR/uninstall-launch-agent.sh${RESET}"
echo ""
