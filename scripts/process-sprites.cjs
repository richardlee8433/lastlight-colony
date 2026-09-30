// 把繪圖工具輸出的小人 sprite sheet（放大過、有模糊邊緣與有損壓縮雜訊）整理成乾淨的像素圖：
// 自動找出每一列、固定切成 4 欄 → 每格縮回原始像素（取區塊中心的中位數顏色）→ 去掉雜點 → 腳底對齊、置中。
// 用法：node scripts/process-sprites.cjs（需要 playwright 與 Chromium，只在更新美術時執行）
// 原圖：art-src/sprites/*.webp　輸出：src/assets/sprites/*.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SHEETS = [
  { src: 'colonist.webp', out: 'colonist.png', rows: 12, cell: 16 },
  { src: 'marine.webp', out: 'marine.png', rows: 10, cell: 22 },
];
// 原圖約每 5px 是一個美術像素（角色約 27px 高）；縮成每 10px 取一點（剛好 2×2 個美術像素），角色約 14px 高，跟建築的比例比較合適
const SCALE = 10;
const MIN_BLOB = 6;       // 小於這個像素數的零碎色塊（被切斷的雷射光、碎點）去掉

(async () => {
  const root = path.join(__dirname, '..');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  for (const sh of SHEETS) {
    const src = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'art-src/sprites', sh.src)).toString('base64');
    const url = await p.evaluate(async ({ src, rows, cell, SCALE, MIN_BLOB }) => {
      const img = new Image(); img.src = src; await img.decode();
      const W = img.width, H = img.height;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, W, H).data;
      const solid = (x, y) => d[(y * W + x) * 4 + 3] > 140;
      // 列：有內容的橫條
      const bands = []; let s = -1;
      for (let y = 0; y < H; y++) {
        let any = false; for (let x = 0; x < W && !any; x++) any = solid(x, y);
        if (any && s < 0) s = y; if (!any && s >= 0) { if (y - s > 20) bands.push([s, y - 1]); s = -1; }
      }
      if (s >= 0) bands.push([s, H - 1]);
      if (bands.length !== rows) throw new Error(`expected ${rows} rows, found ${bands.length}`);
      const cols = [0, 1, 2, 3].map((k) => [Math.round((k * W) / 4), Math.round(((k + 1) * W) / 4)]);
      const out = document.createElement('canvas'); out.width = cell * 4; out.height = cell * rows;
      const og = out.getContext('2d'), od = og.createImageData(out.width, out.height);
      const med = (a) => a.sort((m, n) => m - n)[a.length >> 1];
      for (let r = 0; r < rows; r++) for (let k = 0; k < 4; k++) {
        const [y0, y1] = bands[r], [x0, x1] = cols[k];
        let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
        for (let y = Math.max(0, y0 - 8); y <= Math.min(H - 1, y1 + 8); y++) for (let x = x0; x < x1; x++) if (solid(x, y)) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
        const cw = Math.ceil((bx1 - bx0 + 1) / SCALE), ch = Math.ceil((by1 - by0 + 1) / SCALE);
        // 先縮到原始像素
        const px = new Array(cw * ch).fill(null);
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
          const R = [], G = [], B = [], A = [];
          for (let dy = 2; dy <= 7; dy++) for (let dx = 2; dx <= 7; dx++) {
            const x = bx0 + i * SCALE + dx, y = by0 + j * SCALE + dy; if (x > bx1 || y > by1) continue;
            const q = (y * W + x) * 4; R.push(d[q]); G.push(d[q + 1]); B.push(d[q + 2]); A.push(d[q + 3]);
          }
          if (A.length && med(A) >= 128) px[j * cw + i] = [med(R) & 0xf0 | 8, med(G) & 0xf0 | 8, med(B) & 0xf0 | 8];
        }
        // 去掉零碎色塊
        const seen = new Uint8Array(cw * ch);
        for (let q0 = 0; q0 < px.length; q0++) {
          if (!px[q0] || seen[q0]) continue;
          const stack = [q0], blob = []; seen[q0] = 1;
          while (stack.length) {
            const q = stack.pop(); blob.push(q); const x = q % cw, y = (q / cw) | 0;
            for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
              if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
              const n = ny * cw + nx; if (px[n] && !seen[n]) { seen[n] = 1; stack.push(n); }
            }
          }
          if (blob.length < MIN_BLOB) for (const q of blob) px[q] = null;
        }
        // 置中、腳底對齊（格子底部往上 2px）
        const ox = Math.floor((cell - cw) / 2), oy = cell - 2 - ch;
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
          const v = px[j * cw + i]; const X = ox + i, Y = oy + j;
          if (!v || X < 0 || Y < 0 || X >= cell || Y >= cell) continue;
          const o = ((r * cell + Y) * out.width + k * cell + X) * 4;
          od.data[o] = v[0]; od.data[o + 1] = v[1]; od.data[o + 2] = v[2]; od.data[o + 3] = 255;
        }
      }
      og.putImageData(od, 0, 0);
      return out.toDataURL('image/png');
    }, { src, rows: sh.rows, cell: sh.cell, SCALE, MIN_BLOB });
    fs.writeFileSync(path.join(root, 'src/assets/sprites', sh.out), Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', sh.out);
  }
  await b.close();
})();
