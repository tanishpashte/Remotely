#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}============ Remote Browser Setup Script ============${NC}"

# 1. Check prerequisites
echo -e "\n${BLUE}[1/4] Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js (v18+) first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js is installed ($(node -v))${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm is installed ($(npm -v))${NC}"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH. Please install Docker.${NC}"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running. Please start Docker first.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker is installed and running${NC}"

# 2. Build Docker image
echo -e "\n${BLUE}[2/4] Building Browser Worker Docker image (bld-browser)...${NC}"
docker build -t bld-browser ./backend

# 3. Install backend dependencies
echo -e "\n${BLUE}[3/4] Installing backend dependencies...${NC}"
cd backend
npm install
cd ..

# 4. Install frontend dependencies
echo -e "\n${BLUE}[4/4] Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

echo -e "\n${GREEN}===================================================${NC}"
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e "\nTo run the application:"
echo -e "  1. Start backend orchestrator: ${YELLOW}cd backend && node server.js${NC}"
echo -e "  2. Start frontend dev server:  ${YELLOW}cd frontend && npm run dev${NC}"
echo -e "  3. Open Browser at:            ${YELLOW}http://localhost:3000${NC}\n"
