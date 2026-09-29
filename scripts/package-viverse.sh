#!/usr/bin/env bash
# 打包成 VIVERSE 可上傳的 ZIP：根目錄只有 index.html（vite-plugin-singlefile 已把 JS/CSS 全部內嵌）
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
VERSION=$(node -e "console.log(require('fs').readFileSync('src/ui/Settings.tsx','utf8').match(/VERSION = '([^']+)'/)[1])")
mkdir -p release
OUT="release/lastlight-colony-viverse-v${VERSION}.zip"
rm -f "$OUT"
(cd dist && zip -q -9 "../$OUT" index.html)
echo "$OUT"
