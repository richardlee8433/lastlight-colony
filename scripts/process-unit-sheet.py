# 襲擊單位（赫利昂突擊隊、微光獸）的 sprite sheet：原圖是自由排列的合輯（白底或透明底），
# 這裡挑出需要的格子，排成跟陸戰隊一樣的格式：每列 4 格，
#   0–2 idle 下/上/側、3–5 walk 下/上/側、6–8 攻擊 下/上/側、9 倒地、10 中彈（側面）。側面一律面向右。
# 每格縮回像素圖（取區塊中位數顏色）→ 腳底對齊、水平置中（突擊隊對齊頭盔，微光獸對齊身體重心）。
# 用法：python3 scripts/process-unit-sheet.py [commando|glimmer]（不給就全部；需要 pillow、numpy、scipy，只在更新美術時執行）
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

RES, CELL = 2, 22 * 2          # 跟陸戰隊同格式：22×22，2 倍細節
FOOT = CELL - 2 * RES - 1      # 腳底所在的列（anchor 在格子底部往上 2px）

UNITS = {
    'commando': dict(
        src='art-src/sprites/commando.webp', out='src/assets/sprites/commando.png',
        rows=[10, 9, 8, 5], min_blob=5000, height=33, align='head', ref=(1, 1),
        layout=[
            [(1, 1)] * 4,                          # 0 idle 下
            [(1, 5)] * 4,                          # 1 idle 上
            [(2, 7)] * 4,                          # 2 idle 側（持槍站立）
            [(1, 1), (1, 2), (1, 1), (1, 2)],      # 3 walk 下
            [(1, 5), (1, 6), (1, 5), (1, 6)],      # 4 walk 上
            [(2, 3), (2, 4), (2, 5), (2, 6)],      # 5 walk 側
            [(2, 1)] * 4,                          # 6 shoot 下（瞄準）
            [(2, 9)] * 4,                          # 7 shoot 上
            [(2, 7), (3, 1), (3, 5), (2, 8)],      # 8 shoot 側：瞄準 → 開火（圖上自帶閃光，遊戲不用這格）→ 後座力 → 回位
            [(4, 1), (4, 2), (4, 3), (4, 4)],      # 9 倒地：跪下 → 撲倒 → 躺平
            [(3, 6), (3, 7), (3, 8), (3, 6)],      # 10 中彈
        ]),
    # 微光獸：原圖沒有背面，「上」用正面代替；第 3 列後段、第 4 列（撲擊、鑽地）與特效不用
    'glimmer': dict(
        src='art-src/sprites/glimmer.webp', out='src/assets/sprites/glimmer.png',
        rows=[10, 10, 5, 7, 6], min_blob=4000, height=28, align='body', ref=(1, 1),
        layout=[
            [(1, 1)] * 4,                          # 0 idle 下
            [(1, 5)] * 4,                          # 1 idle 上（正面）
            [(2, 1)] * 4,                          # 2 idle 側
            [(1, 1), (1, 2), (1, 5), (1, 6)],      # 3 walk 下
            [(1, 5), (1, 6), (1, 1), (1, 2)],      # 4 walk 上（正面）
            [(2, 1), (2, 2), (2, 3), (2, 4)],      # 5 walk 側
            [(3, 1), (3, 2), (3, 3), (3, 4)],      # 6 吐晶球（下：用側面）
            [(3, 1), (3, 2), (3, 3), (3, 4)],      # 7 吐晶球（上：用側面）
            [(3, 1), (3, 2), (3, 3), (3, 4)],      # 8 吐晶球：蓄力 → 張口 → 吐出 → 收回
            [(5, 4), (5, 5), (5, 6), (5, 6)],      # 9 倒地：癱倒 → 碎裂 → 剩一堆晶塊
            [(5, 1), (5, 2), (5, 3), (5, 1)],      # 10 中彈
        ]),
}


def process(name, U):
    src = Image.open(U['src']).convert('RGBA')
    white = Image.new('RGBA', src.size, (255, 255, 255, 255)); white.alpha_composite(src)
    im = np.asarray(white.convert('RGB')).astype(np.float32)
    lum = im @ np.array([.3, .6, .1], np.float32)
    sat = im.max(2) - im.min(2)
    # 背景：從四邊連通的淺色、無彩度像素（白底、腳下的灰色陰影、煙霧）
    light = (lum >= 170) & (sat <= 16)
    lab, _ = nd.label(light)
    edge = set(np.unique(np.r_[lab[0], lab[-1], lab[:, 0], lab[:, -1]])) - {0}
    fg = ~np.isin(lab, list(edge))
    # 每個角色（含武器）是一個連通區塊；小碎片（子彈、火花）不算
    grp, n = nd.label(nd.binary_dilation(fg, iterations=3))
    boxes = [s for s, z in zip(nd.find_objects(grp), nd.sum(fg, grp, range(1, n + 1))) if z > U['min_blob']]
    # 分列：依垂直中心排序，間隔超過 100px 就是下一列
    R = []
    for s in sorted(boxes, key=lambda s: s[0].start + s[0].stop):
        cy = (s[0].start + s[0].stop) / 2
        if not R or cy - R[-1][-1][1] > 100: R.append([])
        R[-1].append((s, cy))
    R = [sorted([s for s, _ in r], key=lambda s: s[1].start) for r in R]
    assert [len(r) for r in R] == U['rows'], (name, [len(r) for r in R])
    cell = lambda r, c: R[r - 1][c - 1]
    ref = cell(*U['ref']); scale = (ref[0].stop - ref[0].start) / U['height']

    def frame(s):
        y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
        m = fg[y0:y1, x0:x1].copy()
        # 只留這個區塊自己的像素（旁邊格子的槍口、特效不會混進來）
        ids = np.unique(grp[y0:y1, x0:x1][m]); main = max(ids, key=lambda i: (grp[y0:y1, x0:x1] == i).sum())
        m &= grp[y0:y1, x0:x1] == main
        sub = im[y0:y1, x0:x1]
        top = np.where(m.any(1))[0][0]; bottom = np.where(m.any(1))[0][-1]
        if U['align'] == 'head':
            # 頭盔中心：最上面 30% 的實心像素的水平中心
            hx = np.where(m[top:top + int((y1 - y0) * 0.3)])[1].mean()
        else:
            # 身體重心：下半部（腳與身體）的水平中心，吐出的晶球、背上的晶刺不影響
            hx = np.where(m[(top + bottom) // 2:bottom + 1])[1].mean()
        out = np.zeros((CELL, CELL, 4), np.uint8)
        for oy in range(CELL):
            for ox in range(CELL):
                cy = bottom - (FOOT - oy) * scale; cx = hx + (ox - CELL / 2 + 0.5) * scale
                ya, yb = int(cy - scale * 0.3), int(cy + scale * 0.3) + 1
                xa, xb = int(cx - scale * 0.3), int(cx + scale * 0.3) + 1
                if ya < 0 or xa < 0 or yb > m.shape[0] or xb > m.shape[1]: continue
                mm = m[ya:yb, xa:xb]
                if mm.mean() < 0.5: continue
                out[oy, ox, :3] = np.median(sub[ya:yb, xa:xb][mm], 0); out[oy, ox, 3] = 255
        # 去掉零碎的點
        a = out[..., 3] > 0; l, k = nd.label(a)
        for i in range(1, k + 1):
            if (l == i).sum() < 6: out[l == i] = 0
        return out

    layout = U['layout']
    sheet = np.zeros((CELL * len(layout), CELL * 4, 4), np.uint8)
    cache = {}
    for r, row in enumerate(layout):
        for k, rc in enumerate(row):
            if rc not in cache: cache[rc] = frame(cell(*rc))
            sheet[r * CELL:(r + 1) * CELL, k * CELL:(k + 1) * CELL] = cache[rc]
    Image.fromarray(sheet).save(U['out'])
    print(U['out'], sheet.shape[1], 'x', sheet.shape[0], 'scale', round(scale, 2))


for name in (sys.argv[1:] or UNITS):
    process(name, UNITS[name])
