#!/bin/bash
# Clean Git History Script
# ========================
# Removes sensitive files from git history using BFG Repo-Cleaner
# 
# WARNING: This rewrites git history. All collaborators must re-clone.

set -e

echo "[LOCK] Sound It - Git History Cleanup"
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if BFG is installed
if ! command -v bfg &> /dev/null; then
    echo -e "${YELLOW}BFG Repo-Cleaner not found. Installing...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install bfg
        else
            echo -e "${RED}Homebrew not found. Please install BFG manually:${NC}"
            echo "https://rtyley.github.io/bfg-repo-cleaner/"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo wget -O /usr/local/bin/bfg https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
        sudo chmod +x /usr/local/bin/bfg
    else
        echo -e "${RED}Unsupported OS. Please install BFG manually:${NC}"
        echo "https://rtyley.github.io/bfg-repo-cleaner/"
        exit 1
    fi
fi

# Get repo information
read -p "Enter your git repository URL (e.g., git@github.com:user/repo.git): " REPO_URL

if [ -z "$REPO_URL" ]; then
    echo -e "${RED}Repository URL is required${NC}"
    exit 1
fi

# Extract repo name
REPO_NAME=$(basename "$REPO_URL" .git)

echo ""
echo -e "${YELLOW}WARNING: This will rewrite git history permanently!${NC}"
echo -e "${YELLOW}All collaborators will need to re-clone the repository.${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

echo ""
echo "[BOX] Cloning repository (mirror)..."
git clone --mirror "$REPO_URL"

cd "$REPO_NAME.git"

echo ""
echo "[FIND] Files to be removed from history:"
echo "  - .env.production"
echo "  - .env"
echo "  - *.key"
echo "  - *.pem"
echo ""

# Remove sensitive files
bfg --delete-files .env.production
bfg --delete-files .env
bfg --delete-files '*.key'
bfg --delete-files '*.pem'

# Replace text patterns (optional)
echo ""
read -p "Do you want to replace exposed secrets with ***REMOVED***? (yes/no): " REPLACE_TEXT

if [ "$REPLACE_TEXT" == "yes" ]; then
    echo "Replacing common secret patterns..."
    bfg --replace-text <(echo "SG.*=***REMOVED***" "AC.*=***REMOVED***" "sk_live_=***REMOVED***")
fi

# Clean up
echo ""
echo "[CLEAN] Cleaning up..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo -e "${GREEN}[OK] Local cleanup complete!${NC}"
echo ""
echo "[SEND] Ready to push changes."
echo ""
echo -e "${YELLOW}Review the changes before pushing:${NC}"
echo "  cd $TEMP_DIR/$REPO_NAME.git"
echo "  git log --oneline -5"
echo ""
read -p "Push changes to remote? This is IRREVERSIBLE! (yes/no): " PUSH_CONFIRM

if [ "$PUSH_CONFIRM" == "yes" ]; then
    echo ""
    echo "[PUSH] Pushing to remote..."
    git push --force
    
    echo ""
    echo -e "${GREEN}[OK] Git history cleaned successfully!${NC}"
    echo ""
    echo "[WARN]  IMPORTANT NEXT STEPS:"
    echo "   1. All collaborators must delete their local copies"
    echo "   2. Re-clone the repository: git clone $REPO_URL"
    echo "   3. Update .gitignore to prevent future commits:"
    echo "      echo '.env.production' >> .gitignore"
    echo ""
else
    echo ""
    echo "Push cancelled. Changes are in: $TEMP_DIR/$REPO_NAME.git"
    echo "You can manually push later with: cd $TEMP_DIR/$REPO_NAME.git && git push --force"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
echo "Done!"
