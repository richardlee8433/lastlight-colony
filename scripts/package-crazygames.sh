#!/usr/bin/env bash
# 打包成 CrazyGames（入口網站）可上傳的 ZIP：VITE_PORTAL=crazygames 建置到 dist-crazygames/（不送匿名數據、沒有對外連結），
# 根目錄是 index.html ＋ music/、voice/。一般版的 dist/ 不受影響。
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_PORTAL=crazygames npx vite build --outDir dist-crazygames --emptyOutDir >/dev/null
# 檢查：入口網站版不能有 GA 與 GitHub 連結
if grep -q "googletagmanager\|github.com/richardlee8433" dist-crazygames/index.html; then echo "入口網站版還有 GA 或 GitHub 連結" >&2; exit 1; fi
VERSION=$(node -e "console.log(require('fs').readFileSync('src/ui/Settings.tsx','utf8').match(/VERSION = '([^']+)'/)[1])")
mkdir -p release
OUT="release/lastlight-colony-crazygames-v${VERSION}.zip"
rm -f "$OUT"
(cd dist-crazygames && zip -q -9 -r "../$OUT" index.html music voice)
echo "$OUT"
