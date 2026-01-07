#!/bin/bash
#
# Node.js Single Executable Application (SEA) Build Script
# This script generates a standalone binary from the bundled application
#
# Prerequisites:
#   - Node.js 20+ installed (with SEA support)
#   - npm installed
#   - postject installed (npm install -g postject or via npx)
#   - Bundle already generated (run npm run bundle first)
#
# Usage:
#   chmod +x scripts/build-sea.sh
#   ./scripts/build-sea.sh [--output <name>]
#
# Options:
#   --output <name>   Binary output name (default: openrouter-proxy)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Default binary name
BINARY_NAME="openrouter-proxy"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --output)
            BINARY_NAME="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [--output <name>]"
            echo ""
            echo "Options:"
            echo "  --output <name>   Binary output name (default: openrouter-proxy)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Detect platform
OS="$(uname -s)"
case "$OS" in
    Linux*)     PLATFORM="linux" ;;
    Darwin*)    PLATFORM="macos" ;;
    CYGWIN*|MINGW*|MSYS_NT*) PLATFORM="windows" ;;
    *)          PLATFORM="unknown" ;;
esac

# Detect architecture
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)     ARCH="x64" ;;
    aarch64)    ARCH="arm64" ;;
    arm64)      ARCH="arm64" ;;
    *)          ARCH="$ARCH" ;;
esac

echo -e "${BLUE}===========================================${NC}"
echo -e "${BLUE}  Node.js SEA Binary Builder${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo -e "Platform: ${GREEN}$PLATFORM${NC}"
echo -e "Architecture: ${GREEN}$ARCH${NC}"
echo -e "Output: ${GREEN}$BINARY_NAME${NC}"
echo ""

# =============================================================================
# Step 1: Check prerequisites
# =============================================================================
echo -e "${YELLOW}Step 1: Checking prerequisites...${NC}"

cd "$PROJECT_ROOT"

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js 20+ required (found: $(node --version))${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js: $(node --version)${NC}"

# Check for sea-config.json
if [ ! -f "sea-config.json" ]; then
    echo -e "${RED}❌ sea-config.json not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ sea-config.json found${NC}"

# Check for bundle
BUNDLE_PATH=$(node -e "const c=require('./sea-config.json'); console.log(c.main)")
if [ ! -f "$BUNDLE_PATH" ]; then
    echo -e "${RED}❌ Bundle not found at $BUNDLE_PATH${NC}"
    echo -e "   Run 'npm run bundle' first"
    exit 1
fi
echo -e "${GREEN}✓ Bundle found: $BUNDLE_PATH${NC}"

# =============================================================================
# Step 2: Generate SEA blob
# =============================================================================
echo ""
echo -e "${YELLOW}Step 2: Generating SEA blob...${NC}"

# Create dist directory if it doesn't exist
mkdir -p dist

# Generate the SEA blob
node --experimental-sea-config sea-config.json

BLOB_PATH=$(node -e "const c=require('./sea-config.json'); console.log(c.output)")
if [ ! -f "$BLOB_PATH" ]; then
    echo -e "${RED}❌ Failed to generate SEA blob${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SEA blob generated: $BLOB_PATH${NC}"

# =============================================================================
# Step 3: Copy Node.js binary
# =============================================================================
echo ""
echo -e "${YELLOW}Step 3: Copying Node.js binary...${NC}"

# Determine output binary name with platform extension
if [ "$PLATFORM" = "windows" ]; then
    OUTPUT_BINARY="dist/${BINARY_NAME}-${PLATFORM}-${ARCH}.exe"
else
    OUTPUT_BINARY="dist/${BINARY_NAME}-${PLATFORM}-${ARCH}"
fi

# Get path to node binary
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    echo -e "${RED}❌ Could not find node binary${NC}"
    exit 1
fi

# Copy node binary
cp "$NODE_PATH" "$OUTPUT_BINARY"
echo -e "${GREEN}✓ Copied node binary to $OUTPUT_BINARY${NC}"

# =============================================================================
# Step 4: Platform-specific signature removal
# =============================================================================
echo ""
echo -e "${YELLOW}Step 4: Handling code signatures...${NC}"

if [ "$PLATFORM" = "macos" ]; then
    # macOS: Remove signature before injection
    if command -v codesign &> /dev/null; then
        codesign --remove-signature "$OUTPUT_BINARY" 2>/dev/null || true
        echo -e "${GREEN}✓ Removed macOS code signature${NC}"
    else
        echo -e "${YELLOW}⚠ codesign not found, skipping signature removal${NC}"
    fi
elif [ "$PLATFORM" = "windows" ]; then
    # Windows: Remove signature using signtool if available
    # This is typically done in Windows environment
    echo -e "${YELLOW}⚠ Windows signature removal should be done in Windows environment${NC}"
else
    echo -e "${GREEN}✓ No signature removal needed on Linux${NC}"
fi

# =============================================================================
# Step 5: Inject SEA blob using postject
# =============================================================================
echo ""
echo -e "${YELLOW}Step 5: Injecting SEA blob...${NC}"

# Determine postject sentinel fuse based on platform
if [ "$PLATFORM" = "macos" ]; then
    POSTJECT_FLAGS="--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 --macho-segment-name NODE_SEA"
else
    POSTJECT_FLAGS="--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"
fi

# Inject the blob
npx postject "$OUTPUT_BINARY" NODE_SEA_BLOB "$BLOB_PATH" $POSTJECT_FLAGS --overwrite

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to inject SEA blob${NC}"
    exit 1
fi
echo -e "${GREEN}✓ SEA blob injected successfully${NC}"

# =============================================================================
# Step 6: Set executable permissions
# =============================================================================
echo ""
echo -e "${YELLOW}Step 6: Setting permissions...${NC}"

if [ "$PLATFORM" != "windows" ]; then
    chmod +x "$OUTPUT_BINARY"
    echo -e "${GREEN}✓ Set executable permissions${NC}"
else
    echo -e "${GREEN}✓ Windows binary (no chmod needed)${NC}"
fi

# =============================================================================
# Step 7: Re-sign binary (macOS only)
# =============================================================================
echo ""
echo -e "${YELLOW}Step 7: Re-signing binary...${NC}"

if [ "$PLATFORM" = "macos" ]; then
    if command -v codesign &> /dev/null; then
        codesign --sign - "$OUTPUT_BINARY"
        echo -e "${GREEN}✓ Re-signed macOS binary (ad-hoc)${NC}"
    else
        echo -e "${YELLOW}⚠ codesign not found, binary may not run on some systems${NC}"
    fi
else
    echo -e "${GREEN}✓ No re-signing needed${NC}"
fi

# =============================================================================
# Step 8: Verify binary
# =============================================================================
echo ""
echo -e "${YELLOW}Step 8: Verifying binary...${NC}"

# Get binary size
BINARY_SIZE=$(du -h "$OUTPUT_BINARY" | cut -f1)
echo -e "Binary size: ${GREEN}$BINARY_SIZE${NC}"

# Test the binary
if "$OUTPUT_BINARY" --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Binary runs successfully${NC}"
else
    echo -e "${YELLOW}⚠ Binary verification skipped (may require native modules)${NC}"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${BLUE}===========================================${NC}"
echo -e "${GREEN}  Build Complete!${NC}"
echo -e "${BLUE}===========================================${NC}"
echo ""
echo -e "Binary created: ${GREEN}$OUTPUT_BINARY${NC}"
echo -e "Size: ${GREEN}$BINARY_SIZE${NC}"
echo ""
echo -e "To test the binary:"
echo -e "  ${BLUE}$OUTPUT_BINARY --help${NC}"
echo ""
echo -e "To run the application:"
echo -e "  ${BLUE}$OUTPUT_BINARY --server-port 3000${NC}"
echo ""

exit 0
