#!/usr/bin/env bash

set -euo pipefail

# Tek komutta temel frontend ve on-chain dogrulamasini calistirir.
echo "[1/3] npm run lint"
npm run lint

echo "[2/3] npm run build"
npm run build

echo "[3/3] cargo check"
cargo check

echo "Validate tamamlandi."
