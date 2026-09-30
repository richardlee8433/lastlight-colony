// 把繪圖工具輸出的建築圖整理成遊戲用的圖：
// 去掉背景（有些工具把「透明」的棋盤格直接畫進圖裡）→ 去掉邊緣的淺色殘邊 → 裁切 → 縮到遊戲大小的 RES 倍。
// 建築在地圖上的寬度（地圖像素）寫在 LIST；輸出的圖是 RES 倍解析度，遊戲裡再縮回去，細節比小人和地面細（見 art.js 的 PAINTED）。
// 用法：node scripts/process-buildings.cjs（需要 playwright 與 Chromium，只在更新美術時執行）
// 原圖：art-src/buildings/*.webp　輸出：src/assets/buildings/*.webp、src/assets/buildings/meta.json
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RES = 4;
// w：在地圖上的寬度（地圖像素，小人約 14 高）；foot：圖最下面幾成是壓在地上的碎石／階梯，錨點往上提
const LIST = [
  { id: 'escape_pod', w: 70, foot: 0.12 },
  { id: 'scrap_heap', w: 58, foot: 0.12 },
  { id: 'o2_scrubber', w: 56, foot: 0.1 },
  { id: 'electrolyzer', w: 70, foot: 0.1 },
  { id: 'algae_tank', w: 60, foot: 0.08 },
  { id: 'bio_harvester', w: 72, foot: 0.08 },
  { id: 'emergency_camp', w: 90, foot: 0.1 },
  { id: 'hab_pod', w: 60, foot: 0.1 },
  { id: 'cargo', w: 66, foot: 0.1 },
  { id: 'lounge', w: 64, foot: 0.1 },
  { id: 'rock_cutter', w: 66, foot: 0.12 },
  { id: 'assembly', w: 66, foot: 0.12 },
  { id: 'central_hub', w: 92, foot: 0.1 },
  { id: 'metal_mine', w: 66, foot: 0.08 },
  { id: 'expedition', w: 68, foot: 0.1 },
  { id: 'rail_line', w: 80, foot: 0.12 },
  { id: 'forge', w: 64, foot: 0.1 },
  { id: 'outpost', w: 94, foot: 0.1 },
  { id: 'databank', w: 64, foot: 0.1 },
];

(async () => {
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'src/assets/buildings');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  const meta = {};
  for (const it of LIST) {
    const file = path.join(root, 'art-src/buildings', it.id + '.webp');
    if (!fs.existsSync(file)) { console.log('skip', it.id); continue; }
    const src = 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64');
    const r = await p.evaluate(async ({ src, W, foot }) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = img.width, h = img.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const im = g.getImageData(0, 0, w, h), d = im.data;
      const lum = (i) => (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
      const sat = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
      // 原圖本來就有透明背景就不用去背
      let hasAlpha = false;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) { hasAlpha = true; break; }
      if (!hasAlpha) {
        // 從四邊往內填：淺色、幾乎沒有彩度的像素（棋盤格、浮水印）都當背景；建築有深色外框，填不進去
        const bg = (i) => lum(i) >= 170 && sat(i) <= 26;
        const seen = new Uint8Array(w * h), st = [];
        const push = (x, y) => { const k = y * w + x; if (!seen[k] && bg(k * 4)) { seen[k] = 1; st.push(k); } };
        for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
        for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
        while (st.length) {
          const k = st.pop(), x = k % w, y = (k / w) | 0;
          d[k * 4 + 3] = 0;
          if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
        }
        // 殘邊：貼著背景的淺灰像素再削兩圈
        for (let pass = 0; pass < 2; pass++) {
          const kill = [];
          for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
            const k = y * w + x, i = k * 4;
            if (!d[i + 3] || lum(i) < 140 || sat(i) > 34) continue;
            if (!d[i - 1] || !d[i + 7] || !d[i - w * 4 + 3] || !d[i + w * 4 + 3]) kill.push(i);
          }
          for (const i of kill) d[i + 3] = 0;
        }
        // 零散的小色塊（浮水印碎點）：只留跟主體相連的最大一塊
        const lab = new Int32Array(w * h).fill(-1), sizes = [];
        for (let k0 = 0; k0 < w * h; k0++) {
          if (lab[k0] >= 0 || !d[k0 * 4 + 3]) continue;
          const id = sizes.length, q = [k0]; lab[k0] = id; let n = 0;
          while (q.length) {
            const k = q.pop(); n++;
            const x = k % w, y = (k / w) | 0;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
              const nk = ny * w + nx; if (lab[nk] < 0 && d[nk * 4 + 3]) { lab[nk] = id; q.push(nk); }
            }
          }
          sizes.push(n);
        }
        const big = Math.max(...sizes);
        for (let k = 0; k < w * h; k++) if (lab[k] >= 0 && sizes[lab[k]] < big * 0.004) d[k * 4 + 3] = 0;
        g.putImageData(im, 0, 0);
      }
      // 裁切
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const ow = Math.round(W), oh = Math.round(ch * ow / cw);
      // 分兩段縮小，邊緣比較乾淨
      const mid = document.createElement('canvas'); mid.width = ow * 2; mid.height = oh * 2;
      const mg = mid.getContext('2d'); mg.imageSmoothingQuality = 'high'; mg.drawImage(cv, x0, y0, cw, ch, 0, 0, mid.width, mid.height);
      const out = document.createElement('canvas'); out.width = ow; out.height = oh;
      const og = out.getContext('2d'); og.imageSmoothingQuality = 'high'; og.drawImage(mid, 0, 0, ow, oh);
      return { url: out.toDataURL('image/webp', 0.92), ow, oh, foot };
    }, { src, W: it.w * RES, foot: it.foot });
    fs.writeFileSync(path.join(outDir, it.id + '.webp'), Buffer.from(r.url.split(',')[1], 'base64'));
    const w = it.w, h = +(r.oh / RES).toFixed(2);
    meta[it.id] = { w, h, ax: w / 2, ay: +(h * (1 - it.foot)).toFixed(2) };
    console.log(it.id, r.ow + 'x' + r.oh, fs.statSync(path.join(outDir, it.id + '.webp')).size);
  }
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ res: RES, buildings: meta }, null, 2) + '\n');
  await b.close();
})();
