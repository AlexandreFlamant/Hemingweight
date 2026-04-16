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

# --- Register Chrome native messaging host ---
echo -e "${DIM}Registering Chrome extension...${RESET}"
cd "$HEMINGWEIGHT_DIR" && bash install.sh 2>/dev/null
echo -e "${GREEN}✅ Chrome native messaging registered${RESET}"

# --- Done ---
echo ""
echo -e "${GREEN}🎉 Hemingweight is installed!${RESET}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Open Chrome"
echo "  2. Go to chrome://extensions"
echo "  3. Turn on \"Developer mode\" (top right toggle)"
echo "  4. Click \"Load unpacked\""
echo "  5. Select this folder: $HEMINGWEIGHT_DIR/extension"
echo "  6. Click the Hemingweight extension icon and start building!"
echo ""
echo -e "${DIM}Hemingweight installed at: $HEMINGWEIGHT_DIR${RESET}"
echo ""
