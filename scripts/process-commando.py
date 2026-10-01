# 赫利昂突擊隊的 sprite sheet：原圖是自由排列的白底合輯（art-src/sprites/commando.webp），
# 這裡挑出需要的格子，排成跟陸戰隊一樣的格式（每列 4 格；idle 下/上/側、walk 下/上/側、shoot 下/上/側、倒地）。
# 每格縮回像素圖（取區塊中位數顏色）→ 腳底對齊、以頭盔中心置中。
# 用法：python3 scripts/process-commando.py（需要 pillow、numpy、scipy，只在更新美術時執行）
import numpy as np
from PIL import Image
from scipy import ndimage as nd

SRC, OUT = 'art-src/sprites/commando.webp', 'src/assets/sprites/commando.png'
RES, CELL = 2, 22 * 2          # 跟陸戰隊同格式：22×22，2 倍細節
FOOT = CELL - 2 * RES - 1      # 腳底所在的列（anchor 在格子底部往上 2px）
HEIGHT = 33                    # 站姿身高（輸出像素）；陸戰隊約 29

im = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
lum = im @ np.array([.3, .6, .1], np.float32)
sat = im.max(2) - im.min(2)
# 背景：從四邊連通的淺色、無彩度像素（白底、腳下的灰色陰影、煙霧）
light = (lum >= 170) & (sat <= 16)
lab, _ = nd.label(light)
edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
fg = ~np.isin(lab, list(edge))
# 每個角色（含槍）是一個連通區塊；小碎片（子彈、火花）不算
grp, n = nd.label(nd.binary_dilation(fg, iterations=3))
boxes = [s for s, z in zip(nd.find_objects(grp), nd.sum(fg, grp, range(1, n + 1))) if z > 5000]
# 分列：依垂直中心排序，間隔超過 100px 就是下一列
R = []
for s in sorted(boxes, key=lambda s: s[0].start + s[0].stop):
    cy = (s[0].start + s[0].stop) / 2
    if not R or cy - R[-1][-1][1] > 100: R.append([])
    R[-1].append((s, cy))
R = [sorted([s for s, _ in r], key=lambda s: s[1].start) for r in R]
assert [len(r) for r in R] == [10, 9, 8, 5], [len(r) for r in R]
cell = lambda r, c: R[r - 1][c - 1]

# 站姿的原圖高度 → 縮放比例（全部格子共用，大小一致）
ref = cell(1, 1); SCALE = (ref[0].stop - ref[0].start) / HEIGHT

def frame(s):
    y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
    m = fg[y0:y1, x0:x1].copy()
    # 只留這個區塊自己的像素（旁邊格子的槍口不會混進來）
    ids = np.unique(grp[y0:y1, x0:x1][m]); main = max(ids, key=lambda i: (grp[y0:y1, x0:x1] == i).sum())
    m &= grp[y0:y1, x0:x1] == main
    sub = im[y0:y1, x0:x1]
    # 頭盔中心：最上面 30% 的實心像素的水平中心
    top = np.where(m.any(1))[0][0]; lim = top + int((y1 - y0) * 0.3)
    hx = np.where(m[top:lim])[1].mean()
    bottom = np.where(m.any(1))[0][-1]
    out = np.zeros((CELL, CELL, 4), np.uint8)
    for oy in range(CELL):
        for ox in range(CELL):
            # 輸出 (ox, oy) 對應原圖：頭盔中心對到格子中央，腳底對到 FOOT
            cy = bottom - (FOOT - oy) * SCALE; cx = hx + (ox - CELL / 2 + 0.5) * SCALE
            ya, yb = int(cy - SCALE * 0.3), int(cy + SCALE * 0.3) + 1
            xa, xb = int(cx - SCALE * 0.3), int(cx + SCALE * 0.3) + 1
            if ya < 0 or xa < 0 or yb > m.shape[0] or xb > m.shape[1]: continue
            mm = m[ya:yb, xa:xb]
            if mm.mean() < 0.5: continue
            px = sub[ya:yb, xa:xb][mm]
            out[oy, ox, :3] = np.median(px, 0); out[oy, ox, 3] = 255
    # 去掉零碎的點
    a = out[..., 3] > 0; l, k = nd.label(a)
    for i in range(1, k + 1):
        if (l == i).sum() < 6: out[l == i] = 0
    return out

# 格子對應（列, 欄）：側面一律面向右
LAYOUT = [
    [(1, 1)] * 4,                          # 0 idle 下
    [(1, 5)] * 4,                          # 1 idle 上
    [(2, 7)] * 4,                          # 2 idle 側（持槍站立）
    [(1, 1), (1, 2), (1, 1), (1, 2)],      # 3 walk 下
    [(1, 5), (1, 6), (1, 5), (1, 6)],      # 4 walk 上
    [(2, 3), (2, 4), (2, 5), (2, 6)],      # 5 walk 側
    [(2, 1)] * 4,                          # 6 shoot 下（瞄準）
    [(2, 9)] * 4,                          # 7 shoot 上
    [(2, 7), (3, 1), (3, 5), (2, 8)],      # 8 shoot 側：瞄準 → 開火（圖上自帶閃光，遊戲不用這格）→ 後座力 → 回位
    [(4, 2), (4, 3), (4, 4), (4, 5)],      # 9 倒地
]
sheet = np.zeros((CELL * len(LAYOUT), CELL * 4, 4), np.uint8)
cache = {}
for r, row in enumerate(LAYOUT):
    for k, rc in enumerate(row):
        if rc not in cache: cache[rc] = frame(cell(*rc))
        sheet[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL] = cache[rc]
Image.fromarray(sheet).save(OUT)
print(OUT, sheet.shape[1], 'x', sheet.shape[0], 'scale', round(SCALE, 2))
