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
  { id: 'hydro_farm', w: 76, foot: 0.08 },
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
  // 第 4 章（藍圖期）：原圖是一張合輯（見 SHEETS）
  { id: 'colony_core', w: 96, foot: 0.1 },
  { id: 'crystal_synth', w: 66, foot: 0.1 },
  { id: 'security', w: 64, foot: 0.1 },
  { id: 'med_bay', w: 68, foot: 0.1 },
  { id: 'water_cycle', w: 60, foot: 0.1 },
  { id: 'memorial', w: 46, foot: 0.12 },
  // 第 5～6 章
  { id: 'admin', w: 80, foot: 0.08 },
];
// 一張圖裡有好幾棟建築的合輯：整張去背後依連通區塊分開，由上到下、由左到右對應 ids
// holes：建築中間被圍住的棋盤格（例如管線之間）也去掉
const SHEETS = [
  { src: 'sheet-ch4.webp', rows: 2, holes: true, ids: ['colony_core', 'crystal_synth', 'security', 'med_bay', 'water_cycle', 'memorial'] },
];

// ── 在瀏覽器裡執行：去背 ──
const PAGE_LIB = `
window.removeBg = function (g, w, h, holes) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  const lum = (i) => (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10;
  const sat = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) { hasAlpha = true; break; }
  if (hasAlpha) return;
  // 從四邊往內填：淺色、幾乎沒有彩度的像素（棋盤格、浮水印）都當背景；建築有深色外框，填不進去
  const bg = (i) => lum(i) >= 170 && sat(i) <= 26;
  const seen = new Uint8Array(w * h), st = [], tones = [];
  const push = (x, y) => { const k = y * w + x; if (!seen[k] && bg(k * 4)) { seen[k] = 1; st.push(k); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) {
    const k = st.pop(), x = k % w, y = (k / w) | 0;
    if ((k & 63) === 0) tones.push(lum(k * 4));
    d[k * 4 + 3] = 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  if (holes && tones.length) {
    // 棋盤格的兩種灰：取背景亮度的上下四分位
    tones.sort((a, b) => a - b);
    const t1 = tones[(tones.length * 0.2) | 0], t2 = tones[(tones.length * 0.8) | 0];
    const near = (i, t) => Math.abs(lum(i) - t) <= 9 && sat(i) <= 12;
    for (let k0 = 0; k0 < w * h; k0++) {
      if (seen[k0] || !bg(k0 * 4)) continue;
      const q = [k0], reg = []; seen[k0] = 1;
      while (q.length) {
        const k = q.pop(); reg.push(k); const x = k % w, y = (k / w) | 0;
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const n = ny * w + nx; if (!seen[n] && bg(n * 4)) { seen[n] = 1; q.push(n); }
        }
      }
      if (reg.length < 60) continue;
      let a = 0, b = 0;
      for (const k of reg) { if (near(k * 4, t1)) a++; else if (near(k * 4, t2)) b++; }
      // 兩種灰都佔一定比例（邊緣有反鋸齒，合計過半就算）：是被圍住的棋盤格；白色外殼的明暗只會落在其中一種
      if (a + b > reg.length * 0.5 && Math.min(a, b) > reg.length * 0.15) for (const k of reg) d[k * 4 + 3] = 0;
    }
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
  g.putImageData(im, 0, 0);
};
// 連通區塊（4 鄰接）：回傳 { lab, sizes, boxes }
window.blobs = function (d, w, h) {
  const lab = new Int32Array(w * h).fill(-1), sizes = [], boxes = [];
  for (let k0 = 0; k0 < w * h; k0++) {
    if (lab[k0] >= 0 || !d[k0 * 4 + 3]) continue;
    const id = sizes.length, q = [k0]; lab[k0] = id; let n = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    while (q.length) {
      const k = q.pop(); n++;
      const x = k % w, y = (k / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx; if (lab[nk] < 0 && d[nk * 4 + 3]) { lab[nk] = id; q.push(nk); }
      }
    }
    sizes.push(n); boxes.push({ x0, y0, x1, y1 });
  }
  return { lab, sizes, boxes };
};
`;

(async () => {
  const root = path.join(__dirname, '..');
  const outDir = path.join(root, 'src/assets/buildings');
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  await p.addScriptTag({ content: PAGE_LIB });
  const meta = {};
  // 合輯先切成單張（已去背的 PNG），交給下面的流程
  const fromSheet = {};
  for (const sh of SHEETS) {
    const file = path.join(root, 'art-src/buildings', sh.src);
    if (!fs.existsSync(file)) continue;
    const src = 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64');
    const parts = await p.evaluate(async ({ src, n, rows, holes }) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = img.width, h = img.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      removeBg(g, w, h, holes);
      const d = g.getImageData(0, 0, w, h).data;
      const { lab, sizes, boxes } = blobs(d, w, h);
      // 最大的 n 塊是建築；其他碎塊（蒸氣、掉在旁邊的小零件）併進最近的建築，太小的丟掉
      const order = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]);
      const main = order.slice(0, n), owner = new Int32Array(sizes.length).fill(-1);
      main.forEach((m, i) => { owner[m] = i; });
      const gap = (a, b) => Math.max(0, a.x0 - b.x1, b.x0 - a.x1) + Math.max(0, a.y0 - b.y1, b.y0 - a.y1);
      for (let i = 0; i < sizes.length; i++) {
        if (owner[i] >= 0 || sizes[i] < 40) continue;
        let best = -1, bd = 1e9;
        main.forEach((m, j) => { const gd = gap(boxes[i], boxes[m]); if (gd < bd) { bd = gd; best = j; } });
        if (bd < 24) owner[i] = best;
      }
      // 由上到下、由左到右排序
      const cy = (m) => (boxes[m].y0 + boxes[m].y1) / 2, cx = (m) => (boxes[m].x0 + boxes[m].x1) / 2;
      const idx = main.map((m, i) => i).sort((a, b) => (Math.floor(cy(main[a]) / (h / rows)) - Math.floor(cy(main[b]) / (h / rows))) || (cx(main[a]) - cx(main[b])));
      return idx.map((i) => {
        let x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (let k = 0; k < w * h; k++) if (lab[k] >= 0 && owner[lab[k]] === i) { const x = k % w, y = (k / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const c = document.createElement('canvas'); c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
        const cg = c.getContext('2d'), out = cg.createImageData(c.width, c.height);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const k = y * w + x; if (lab[k] < 0 || owner[lab[k]] !== i) continue;
          const o = ((y - y0) * c.width + (x - x0)) * 4; out.data.set(d.subarray(k * 4, k * 4 + 4), o);
        }
        cg.putImageData(out, 0, 0);
        return c.toDataURL('image/png');
      });
    }, { src, n: sh.ids.length, rows: sh.rows, holes: !!sh.holes });
    sh.ids.forEach((id, i) => { fromSheet[id] = parts[i]; });
  }
  for (const it of LIST) {
    const file = path.join(root, 'art-src/buildings', it.id + '.webp');
    if (!fromSheet[it.id] && !fs.existsSync(file)) { console.log('skip', it.id); continue; }
    const src = fromSheet[it.id] ?? 'data:image/webp;base64,' + fs.readFileSync(file).toString('base64');
    const r = await p.evaluate(async ({ src, W, foot }) => {
      const img = new Image(); img.src = src; await img.decode();
      const w = img.width, h = img.height;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      const hadAlpha = (() => { const d = g.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) return true; return false; })();
      removeBg(g, w, h, false);
      const im = g.getImageData(0, 0, w, h), d = im.data;
      if (!hadAlpha) {
        // 零散的小色塊（浮水印碎點）：只留跟主體相連的大塊
        const { lab, sizes } = blobs(d, w, h);
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
