# 深色背景的合輯切成單張去背圖（AI 有時把背景畫成深色漸層，process-buildings.cjs 的淺色去背處理不了）
# 背景是平滑漸層、建築有像素紋理和深色外框：從四邊連通的「低梯度」像素當背景。
# 用法：python3 scripts/cut-dark-sheet.py art-src/buildings/sheet-ch5.webp art-src/buildings id1,id2,...（由上到下、由左到右；兩列）
# 白色背景也適用。兩棟互相疊到時用 CLAIM=x,y,格子編號,ymax：從 (x,y) 沿著冷色、非背景的像素填出被疊的那一角（只取 ymax 以上），歸給指定的格子（1 起算）。
#建築有懸浮零件時加環境變數 GRID=2x2：依格子分配（零件不會被丟掉或分錯棟）
# 輸出有透明度的 webp，process-buildings.cjs 遇到有透明度的原圖會跳過去背。需要 pillow、numpy、scipy。
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
src, out = sys.argv[1], sys.argv[2]
ids = sys.argv[3].split(',')
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
h, w, _ = im.shape
lum = im @ np.array([.3, .6, .1], np.float32)
sat = im.max(2) - im.min(2)
# 背景：平滑漸層。用局部變化量（梯度）判斷：建築有像素紋理與深色外框
sm = nd.gaussian_filter(lum, 1.0)
grad = np.hypot(nd.sobel(sm, 0), nd.sobel(sm, 1))
cand = grad < (float(sys.argv[4]) if len(sys.argv) > 4 else 20)
# 從四邊連通的候選像素才是背景
lab, n = nd.label(cand)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
bg = np.isin(lab, list(edge))
# 白色背景：近白、無彩度、平坦的區塊（含建築中間被圍住的空隙）都是背景
white = (lum >= 251) & (sat <= 5) & (grad < 12)
wl, wn = nd.label(white); ws = nd.sum(white, wl, range(1, wn + 1))
bg |= np.isin(wl, [i + 1 for i, s in enumerate(ws) if s >= 40])
fg = ~bg
fg = nd.binary_opening(fg, iterations=2)
# 殘邊：貼著背景的淺色像素削兩圈
for _ in range(2):
    edge_px = fg & nd.binary_dilation(~fg) & (lum >= 215) & (sat <= 28)
    fg &= ~edge_px
import os
grid = os.environ.get('GRID')
# 去掉小碎片（依格子分時，懸浮的小零件也要留著）
l2, n2 = nd.label(fg); sizes = nd.sum(fg, l2, range(1, n2 + 1))
fg = np.isin(l2, [i + 1 for i, s in enumerate(sizes) if s > (60 if grid else 400)])
if grid:
    # 依格子分組：每個連通區塊按重心歸到所在的格子
    # 相鄰兩棟可能有細細一點黏在一起：先侵蝕切開，分好組後再把每個像素歸給最近的已分組像素
    gc, gr = map(int, grid.split('x'))
    claim = os.environ.get('CLAIM')
    if claim:
        cx0, cy0, cell, ymax = map(int, claim.split(','))
        warm = im[..., 0] - im[..., 2]
        ok = (lum >= 40) & (lum < 240) & (warm < 25)
        win = np.zeros_like(ok); win[max(0, cy0 - 90):cy0 + 60, max(0, cx0 - 70):cx0 + 70] = True
        cl, _ = nd.label(ok & win)
        reg = nd.binary_opening(cl == cl[cy0, cx0], iterations=1) & (np.arange(h)[:, None] <= ymax)
    core = nd.binary_erosion(fg, iterations=4)
    if claim: core &= ~nd.binary_dilation(reg, iterations=6)
    l3, n3 = nd.label(core)
    # 列：看區塊最低點（建築的底座一定在自己的格子裡，尖塔可能伸進上一格）；欄：看重心
    cen = nd.center_of_mass(core, l3, range(1, n3 + 1))
    low = nd.maximum(np.indices(core.shape)[0], l3, range(1, n3 + 1))
    seed = np.zeros_like(l3)
    for i, ((cy, cx), ly) in enumerate(zip(cen, low)):
        seed[l3 == i + 1] = 1 + min(gr - 1, int(ly * gr / h)) * gc + int(cx * gc / w)
    # 太小、侵蝕後消失的零件：按自己的重心分
    l4, n4 = nd.label(fg & ~nd.binary_dilation(core, iterations=6))
    for i, (cy, cx) in enumerate(nd.center_of_mass(fg, l4, range(1, n4 + 1))):
        m = l4 == i + 1
        if not (seed[nd.binary_dilation(m, iterations=7)] > 0).any(): seed[m] = 1 + int(cy * gr / h) * gc + int(cx * gc / w)
    _, (iy, ix) = nd.distance_transform_edt(seed == 0, return_indices=True)
    grp = np.where(fg, seed[iy, ix], 0)
    if claim: grp[reg] = cell; fg |= reg
    rows = []
    for g in range(1, gc * gr + 1):
        ys, xs = np.where(grp == g); rows.append((g, ys.min(), ys.max(), xs.min(), xs.max()))
else:
    # 依建築分組：放大後連通
    grp, ng = nd.label(nd.binary_dilation(fg, iterations=12))
    gs = nd.sum(fg, grp, range(1, ng + 1))
    top = sorted(range(1, ng + 1), key=lambda i: -gs[i - 1])[:len(ids)]
    boxes = []
    for g in top:
        ys, xs = np.where((grp == g) & fg); boxes.append((g, ys.min(), ys.max(), xs.min(), xs.max()))
    rows = sorted(boxes, key=lambda b: (b[1] + b[2]) / 2)
    half = len(ids) // 2
    rows = sorted(rows[:half], key=lambda b: b[3]) + sorted(rows[half:], key=lambda b: b[3])
rgba = np.dstack([im, np.where(fg, 255, 0)]).astype(np.uint8)
for (g, y0, y1, x0, x1), id_ in zip(rows, ids):
    m = (grp == g) & fg
    piece = rgba[y0:y1 + 1, x0:x1 + 1].copy(); piece[..., 3] = np.where(m[y0:y1 + 1, x0:x1 + 1], 255, 0)
    Image.fromarray(piece).save(f'{out}/{id_}.webp', lossless=True)
    print(id_, x1 - x0 + 1, y1 - y0 + 1)
