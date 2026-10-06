#!/usr/bin/env bash
# 完整測試：build → 靜態檢查 → 四條路線模擬（並存下各章存檔）→ 瀏覽器測試 → 影像檢查 → 報告 tests/out/report.md
# 用法：npm test（需要 playwright、Chromium；影像檢查需要 python3 + pillow，沒有就略過）
cd "$(dirname "$0")/.."
OUT=tests/out
rm -rf "$OUT"; mkdir -p "$OUT"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
REPORT="$OUT/report.md"
STATUS=0

echo "== build"
npm run build >"$OUT/build.log" 2>&1 || { echo "build 失敗"; tail -20 "$OUT/build.log"; exit 1; }

echo "== 靜態檢查"
npx tsx tests/static.ts | tee "$OUT/static.log" || STATUS=1

echo "== 模擬：四條路線"
SIM_ROWS=""
for R in coop resist; do for C in stay leave; do
  SNAP=""; [ "$R$C" = "coopstay" ] && SNAP="$OUT/snaps"
  LOG="$OUT/sim-$R-$C.log"
  SNAPDIR=$SNAP ROUTE=$R CHOICE=$C npx tsx sim/balance.ts >"$LOG" 2>&1
  END=$(grep "結束：" "$LOG" | sed 's/^ *//')
  STAGES=$(grep -E "^  階段 [2-6]" "$LOG" | sed -E 's/^ *階段 ([0-9])：([0-9:]+).*/第\1章 \2/' | tr '\n' ' ')
  if echo "$END" | grep -qE "信標點亮|曙光號點火"; then OK=PASS; else OK=FAIL; STATUS=1; fi
  echo "$OK 模擬 $R/$C：$END"
  SIM_ROWS="$SIM_ROWS| $OK | $R / $C | $STAGES | ${END#結束：} |\n"
done; done

echo "== 瀏覽器測試"
node tests/e2e.cjs | tee "$OUT/e2e.log" || STATUS=1

echo "== 影像檢查（寬螢幕縮到最小不能有黑邊）"
IMG=$(python3 - <<'EOF' 2>&1
import glob
try:
    from PIL import Image
except ImportError:
    print('SKIP 沒有 pillow，略過'); raise SystemExit
bad = []
for f in sorted(glob.glob('tests/out/E05-*.png')):
    im = Image.open(f).convert('RGB'); w, h = im.size
    # 沿四邊各取 20 點（避開上方資源列、下方建造列）；八成以上都很暗（RGB 加總 < 90）就是露出了地圖外的黑底
    edges = {'左緣': [(2, h * (k + 3) // 26) for k in range(20)], '右緣': [(w - 3, h * (k + 3) // 26) for k in range(20)],
             '上緣': [(w * (k + 3) // 26, 2) for k in range(20)], '下緣': [(w * (k + 3) // 26, h - 3) for k in range(20)]}
    for name, pts in edges.items():
        dark = sum(1 for p in pts if sum(im.getpixel(p)) < 90)
        if dark >= 16: bad.append(f'{f.split("/")[-1]} {name}（{dark}/20 點是黑的）')
print('FAIL 黑邊：' + '、'.join(bad) if bad else 'PASS 沒有黑邊')
EOF
)
echo "$IMG"
case "$IMG" in FAIL*) STATUS=1;; esac

# ── 報告 ──
{
  echo "# 測試報告（$(date '+%Y-%m-%d %H:%M')，版本 $(grep -o "VERSION = '[^']*'" src/ui/Settings.tsx | cut -d"'" -f2)）"
  echo
  echo "## 靜態檢查"
  echo
  grep -E "^(PASS|FAIL)|→" "$OUT/static.log" | sed -E 's/^(PASS|FAIL) /- **\1** /; s/^ +→/  - →/'
  echo
  echo "## 模擬（四條路線玩到結局）"
  echo
  echo "| 結果 | 路線 / 抉擇 | 各章抵達時間 | 結局 |"
  echo "|---|---|---|---|"
  printf "$SIM_ROWS"
  echo
  echo "## 瀏覽器測試"
  echo
  grep -E "^(PASS|FAIL)|→" "$OUT/e2e.log" | sed -E 's/^(PASS|FAIL) /- **\1** /; s/^ +→/  - →/'
  echo
  echo "## 影像檢查"
  echo
  echo "- $IMG"
  echo
  echo "截圖在 tests/out/*.png"
} >"$REPORT"
echo
echo "報告：$REPORT"
exit $STATUS
