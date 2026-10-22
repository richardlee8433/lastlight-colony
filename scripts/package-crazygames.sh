#!/usr/bin/env bash
# 打包成 CrazyGames（入口網站）可上傳的 ZIP：VITE_PORTAL=crazygames 建置到 dist-crazygames/（不送匿名數據、沒有對外連結）。
# CrazyGames 不收壓縮檔、要把檔案直接拖進上傳區，資料夾結構不一定保留：所以配樂、配音全部攤平放在 index.html 旁邊（檔名不重複）。
# 一般版的 dist/ 不受影響。
set -euo pipefail
cd "$(dirname "$0")/.."
VITE_PORTAL=crazygames npx vite build --outDir dist-crazygames --emptyOutDir >/dev/null
# 檢查：入口網站版不能有 GA 與 GitHub 連結
if grep -q "googletagmanager\|github.com/richardlee8433" dist-crazygames/index.html; then echo "入口網站版還有 GA 或 GitHub 連結" >&2; exit 1; fi
# 攤平：music/*.mp3、voice/*.mp3 → 根目錄
mv dist-crazygames/music/*.mp3 dist-crazygames/voice/*.mp3 dist-crazygames/
rmdir dist-crazygames/music dist-crazygames/voice
VERSION=$(node -e "console.log(require('fs').readFileSync('src/ui/Settings.tsx','utf8').match(/VERSION = '([^']+)'/)[1])")
mkdir -p release
OUT="release/lastlight-colony-crazygames-v${VERSION}.zip"
rm -f "$OUT"
(cd dist-crazygames && zip -q -9 "../$OUT" index.html ./*.mp3)
echo "$OUT"
