#!/bin/bash
# Verifies that every directory containing .tsx files is covered
# by a content path in tailwind.config.ts.
#
# Exit 0 = all good, Exit 1 = missing directories found.

set -euo pipefail

CONFIG="tailwind.config.ts"

if [ ! -f "$CONFIG" ]; then
  echo "ERROR: $CONFIG not found"
  exit 1
fi

# Extract the quoted glob prefixes from the content array
# e.g. './components' from './components/**/*.{ts,tsx}'
CONTENT_DIRS=$(grep -oE "'\\./[^*']+/" "$CONFIG" | sed "s/'//g" | sed 's|/$||' | sort -u)

# Find all directories that contain .tsx files (excluding non-source dirs)
TSX_DIRS=$(find . -name '*.tsx' \
  -not -path './node_modules/*' \
  -not -path './.next/*' \
  -not -path './out/*' \
  -not -path './test-results/*' \
  -not -path './playwright-report/*' \
  -exec dirname {} \; | sort -u)

MISSING=()

for dir in $TSX_DIRS; do
  COVERED=false
  for content_dir in $CONTENT_DIRS; do
    if [[ "$dir" == "$content_dir"* ]]; then
      COVERED=true
      break
    fi
  done
  if [ "$COVERED" = false ]; then
    MISSING+=("$dir")
  fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "✓ All .tsx directories are covered by tailwind.config.ts content paths"
  exit 0
else
  echo "✗ These directories contain .tsx files but are NOT in tailwind.config.ts content paths:"
  for m in "${MISSING[@]}"; do
    echo "  - $m"
  done
  echo ""
  echo "Add them to the 'content' array in $CONFIG"
  exit 1
fi
