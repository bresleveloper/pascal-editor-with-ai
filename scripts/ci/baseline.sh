#!/usr/bin/env bash
set -euo pipefail

echo "=== Pascal Editor Baseline CI ==="

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

# 1. Install
echo "--- [1/6] Installing dependencies ---"
bun install

# 2. Check (lint + format)
echo "--- [2/6] Running lint/format check ---"
bun check

# 3. Type check (core + viewer — editor has pre-existing issues)
echo "--- [3/6] Type checking core package ---"
cd packages/core && bun run build && cd "$REPO_ROOT"

echo "--- [3/6] Type checking viewer package ---"
cd packages/viewer && bun run build && cd "$REPO_ROOT"

# 4. Build
echo "--- [4/6] Running production build ---"
bun run build

# 5. Unit tests
echo "--- [5/6] Running unit tests ---"
# bun test (agent packages — once created)

# 6. Smoke
echo "--- [6/6] Checking artifact paths ---"
test -d packages/core/dist && echo "✅ Core dist exists"
test -d packages/viewer/dist && echo "✅ Viewer dist exists"
test -d apps/editor/.next && echo "✅ Next.js build exists"

echo "=== Baseline CI complete ==="