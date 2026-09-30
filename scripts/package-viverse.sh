#!/usr/bin/env bash
# 打包成 VIVERSE／itch.io 可上傳的 ZIP：根目錄是 index.html（JS/CSS/圖片已內嵌）＋ music/ 資料夾（延後載入的配樂）
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
VERSION=$(node -e "console.log(require('fs').readFileSync('src/ui/Settings.tsx','utf8').match(/VERSION = '([^']+)'/)[1])")
mkdir -p release
OUT="release/lastlight-colony-viverse-v${VERSION}.zip"
rm -f "$OUT"
(cd dist && zip -q -9 -r "../$OUT" index.html music)
echo "$OUT"
