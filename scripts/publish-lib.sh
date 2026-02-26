#!/usr/bin/env bash
# Publish ngx-blocks-studio to npm.
#
# If you see "ngx-blocks-studio@0.0.1 is not in this registry" when installing,
# the package has not been published yet. Run: npm run publish:lib (no --dry-run).
#
# Usage:
#   npm run publish:lib              # publish (requires: npm login)
#   npm run publish:lib:dry          # build + dry-run only (does NOT publish)
#   npm run publish:lib -- --tag next   # publish with tag "next"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist/blocks-studio"

echo "Building ngx-blocks-studio..."
cd "$ROOT_DIR"
npm run build

if [[ ! -d "$DIST_DIR" ]]; then
  echo "Error: dist not found at $DIST_DIR"
  exit 1
fi

echo "Publishing from $DIST_DIR..."
cd "$DIST_DIR"
npm publish "$@"
