# 深色背景的合輯切成單張去背圖（AI 有時把背景畫成深色漸層，process-buildings.cjs 的淺色去背處理不了）
# 背景是平滑漸層、建築有像素紋理和深色外框：從四邊連通的「低梯度」像素當背景。
# 用法：python3 scripts/cut-dark-sheet.py art-src/buildings/sheet-ch5.webp art-src/buildings id1,id2,...（由上到下、由左到右；兩列）
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
fg = ~bg
fg = nd.binary_opening(fg, iterations=2)
# 去掉小碎片
l2, n2 = nd.label(fg); sizes = nd.sum(fg, l2, range(1, n2 + 1))
fg = np.isin(l2, [i + 1 for i, s in enumerate(sizes) if s > 400])
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
