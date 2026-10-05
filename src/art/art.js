// 末光殖民地 Lastlight Colony — 像素美術模組 v0.2（俯視 3/4 視角）
// 所有素材都在程式裡逐像素畫出來，再轉成 Pixi.js v8 的材質；不需要任何圖檔。
//
// 純像素（回傳 canvas，可用在任何引擎或 DOM）
//   renderBuilding(id, level)   → { canvas, ax, ay, glows, beacons, smokes }
//   renderProp(kind, stage, seed)→ 同上（樹、岩石、燈柱、貨箱…）
//   planMap(stage, MW, MH)      → 建築位置、道路、道具配置
//   renderGround(stage, plan)   → 整張地圖的地表 canvas
//   renderWorker(stage)         → 3 張影格（站立、走路 A/B）
//   renderIcon(res) / renderPanel(w, h, stage, kind) / renderThumb(id, level)
//
// Pixi 包裝（world 以「美術像素」為單位，外層容器整數縮放）
//   createBuilding(id, level) / createProp(kind, stage, seed)
//       → Container，.lights 是發光層（放在環境光遮罩之上），.update(t, dt)
//   createGround(stage, plan) / createWorker(stage) / createPixelSprite(canvas)
//   createBuffRing(rx, ry) / createAmbient(stage, MW, MH) / createFx(layer)
//
// 座標約定：建築與道具的原點＝正面地面中心，y 往下為正（往上畫就是負值）。
// 升級外觀：Lv1–2 = 第 1 階、Lv3–4 = 第 2 階、Lv5 以上 = 第 3 階（tierOf）。

import { Container, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import colonistSheetURL from '../assets/sprites/colonist.png';
import marineSheetURL from '../assets/sprites/marine.png';
import commandoSheetURL from '../assets/sprites/commando.png';
import { stepFacing } from './facing.js';
import glimmerSheetURL from '../assets/sprites/glimmer.png';
import terrainURL from '../assets/terrain.webp';
import paintedMeta from '../assets/buildings/meta.json';

// 手繪建築圖（scripts/process-buildings.cjs 產生）：res 倍解析度，遊戲裡縮回地圖大小，細節比小人和地面細
const PAINTED_URLS = import.meta.glob('../assets/buildings/*.webp', { eager: true, query: '?url', import: 'default' });

// ───────────────────────────── 工具 ─────────────────────────────

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mix(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** 由一個基色產生 5 階色帶 [最暗, 暗, 基色, 亮, 最亮]；暗部偏紫、亮部偏暖。 */
export function ramp(base) {
  return [mix(base, 0x241a33, 0.58), mix(base, 0x241a33, 0.3), base, mix(base, 0xfff4d6, 0.28), mix(base, 0xfff4d6, 0.55)];
}

export const tierOf = (level) => (level >= 5 ? 3 : level >= 3 ? 2 : 1);

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function noise2(seed) {
  const h = (a, b) => { const n = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453; return n - Math.floor(n); };
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = h(ix, iy) + (h(ix + 1, iy) - h(ix, iy)) * u;
    const b = h(ix, iy + 1) + (h(ix + 1, iy + 1) - h(ix, iy + 1)) * u;
    return a + (b - a) * v;
  };
}
const fbm = (n, x, y) => n(x, y) * 0.55 + n(x * 2.1 + 17, y * 2.1 + 9) * 0.3 + n(x * 4.3 + 3, y * 4.3 + 41) * 0.15;

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

// ───────────────────────────── 像素緩衝 ─────────────────────────────

class Pix {
  constructor(w, h, ox = 0, oy = 0) {
    this.w = w; this.h = h; this.ox = ox; this.oy = oy;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 255) {
    x = Math.round(x) + this.ox; y = Math.round(y) + this.oy;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (a >= 255 || d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.max(a, d[i + 3]); return; }
    const t = a / 255;
    d[i] += (r - d[i]) * t; d[i + 1] += (g - d[i + 1]) * t; d[i + 2] += (b - d[i + 2]) * t;
    d[i + 3] = Math.max(d[i + 3], a);
  }
  rect(x, y, w, h, c, a) { x = Math.round(x); y = Math.round(y); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a); }
  hline(x0, x1, y, c, a) { for (let x = Math.round(Math.min(x0, x1)); x <= Math.round(Math.max(x0, x1)); x++) this.set(x, y, c, a); }
  vline(x, y0, y1, c, a) { for (let y = Math.round(Math.min(y0, y1)); y <= Math.round(Math.max(y0, y1)); y++) this.set(x, y, c, a); }
  line(x0, y0, x1, y1, c, a) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  ell(cx, cy, rx, ry, c, a) {
    cx = Math.round(cx); cy = Math.round(cy); rx = Math.round(rx); ry = Math.round(ry);
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / ((rx + 0.5) ** 2) + (dy * dy) / ((ry + 0.5) ** 2) <= 1) this.set(cx + dx, cy + dy, c, a);
    }
  }
  poly(pts, c, a) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) { x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]); y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]); }
    const n = pts.length;
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const px = x + 0.5, py = y + 0.5;
      let inside = false;
      for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
        const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (inside) this.set(x, y, c, a);
    }
  }
  alphaAt(rx, ry) { return rx < 0 || ry < 0 || rx >= this.w || ry >= this.h ? 0 : this.d[(ry * this.w + rx) * 4 + 3]; }
  outline(col) {
    const { w, h } = this;
    const A = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) A[i] = this.d[i * 4 + 3];
    const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (A[i] >= 100) continue;
      const n = (x > 0 && A[i - 1] >= 160) || (x < w - 1 && A[i + 1] >= 160) || (y > 0 && A[i - w] >= 160) || (y < h - 1 && A[i + w] >= 160);
      if (n) { const j = i * 4; this.d[j] = r; this.d[j + 1] = g; this.d[j + 2] = b; this.d[j + 3] = 255; }
    }
  }
  bbox() {
    let x0 = this.w, y0 = this.h, x1 = -1, y1 = -1;
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.d[(y * this.w + x) * 4 + 3] > 0) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x1 < 0 ? { x0: 0, y0: 0, x1: 0, y1: 0 } : { x0, y0, x1, y1 };
  }
  shadow(cx, cy, rx, ry, col, a) {
    cx = Math.round(cx) + this.ox; cy = Math.round(cy) + this.oy;
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      if ((dx * dx) / ((rx + 0.5) ** 2) + (dy * dy) / ((ry + 0.5) ** 2) > 1) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue;
      const i = (y * this.w + x) * 4;
      if (this.d[i + 3] === 0) { this.d[i] = (col >> 16) & 255; this.d[i + 1] = (col >> 8) & 255; this.d[i + 2] = col & 255; this.d[i + 3] = a; }
    }
  }
  crop(pad = 0) {
    const b = this.bbox();
    const x0 = Math.max(0, b.x0 - pad), y0 = Math.max(0, b.y0 - pad);
    const w = Math.min(this.w, b.x1 + pad + 1) - x0, h = Math.min(this.h, b.y1 + pad + 1) - y0;
    const cv = makeCanvas(w, h);
    const img = cv.getContext('2d').createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(this.d.subarray(((y + y0) * this.w + x0) * 4, ((y + y0) * this.w + x0 + w) * 4), y * w * 4);
    cv.getContext('2d').putImageData(img, 0, 0);
    return { canvas: cv, ax: this.ox - x0, ay: this.oy - y0 };
  }
  toCanvas() {
    const cv = makeCanvas(this.w, this.h);
    const img = cv.getContext('2d').createImageData(this.w, this.h);
    img.data.set(this.d);
    cv.getContext('2d').putImageData(img, 0, 0);
    return cv;
  }
}

// ───────────────────────────── 資源 ─────────────────────────────

export const RES = {
  nutrient: { name: '營養', color: 0x6fe38a },
  oxygen: { name: '氧氣', color: 0x8fd8ff },
  scrap: { name: '廢料', color: 0xd9743e },
  rock: { name: '岩材', color: 0xcdb892 },
  parts: { name: '零件', color: 0x4fb2ff },
  metal: { name: '金屬', color: 0xaec6dc },
  tools: { name: '工具', color: 0xffb347 },
  weapon: { name: '武器', color: 0xff4d4d },
  crystal: { name: '異晶', color: 0xb970ff },
  credit: { name: '信用點', color: 0xffd54a },
  // v0.70 進口品（只在貨艙，不在頂部資源列）
  electronics: { name: '電子元件', color: 0x4fd39a },
  raremetal: { name: '稀有金屬', color: 0x9fd6ee },
  fuel: { name: '燃料', color: 0xff8a3d },
  medicine: { name: '醫療物資', color: 0xeef0f4 },
};

// ───────────────────────────── 階段色調 ─────────────────────────────
// ground / path 都是由暗到亮 5 階與 4 階；ambient 是整張地圖的乘色（營造時段感）。

export const STAGES = {
  1: {
    id: 1, name: '墜毀營地', en: 'Crash Site', mood: '鏽紅荒原 · 殘骸與營火',
    ground: [0x4e2a2c, 0x6e3a33, 0x8c4d3b, 0xa8643f, 0xc4844f], path: [0x6e5040, 0x8e6a52, 0xae8a68, 0xcaa882],
    flora: [0xe8683c, 0xf2b04a, 0xb03a4a], hull: 0xd9d2c4, trim: 0xf07a3a, tarp: 0xd8c29a, metal: 0x8a8e96,
    rock: 0x7a5a52, tree: 0xc8503c, trunk: 0x5a2a2e, treeKind: 'coral', suit: 0xe8883a,
    window: 0xffd27a, light: 0xffa050, outline: 0x221418, ambient: 0xf6dccc, particles: 'ember',
  },
  2: {
    id: 2, name: '營地', en: 'Camp', mood: '冷白雪原 · 冰晶與暖窗',
    ground: [0x8a9ab4, 0xa9b9cc, 0xc6d3e0, 0xdde6ee, 0xf2f6fa], path: [0x6e6a72, 0x8a8690, 0xa6a2aa, 0xc0bcc4],
    flora: [0x7fd0d8, 0xb8e8ee, 0x4a8aa8], hull: 0xe9eef3, trim: 0x4f9ee8, tarp: 0xc9d6e2, metal: 0x8f9aa8,
    rock: 0x8a96a6, tree: 0x3f7a7a, trunk: 0x5a4a4a, treeKind: 'pine', suit: 0xe8883a,
    window: 0xffe2a0, light: 0xfff0c8, outline: 0x1a2030, ambient: 0xeef4ff, particles: 'snow',
  },
  3: {
    id: 3, name: '轉型期', en: 'Steelworks', mood: '鋼灰苔原 · 礦井與鐵軌',
    ground: [0x2e3a3a, 0x3e4c4a, 0x506058, 0x667a66, 0x82967a], path: [0x5a5e66, 0x72767e, 0x8c9098, 0xa8acb2],
    flora: [0x9ab86a, 0xc8d890, 0x5f8a7a], hull: 0xb4bcc6, trim: 0x4fc0f0, tarp: 0x8a9aa8, metal: 0x7a8490,
    rock: 0x6a7078, tree: 0x2f5a52, trunk: 0x4a3e3a, treeKind: 'pine', suit: 0xe0b23a,
    window: 0xcfe8ff, light: 0xcfe8ff, outline: 0x141a1e, ambient: 0xe4e8ee, particles: 'dust',
  },
  4: {
    id: 4, name: '前哨', en: 'Outpost', mood: '暖綠草原 · 黃昏燈火',
    ground: [0x2e4a32, 0x3e6238, 0x507a40, 0x6a944a, 0x8ab05a], path: [0x7a5236, 0x9a6a44, 0xb68658, 0xcca070],
    flora: [0xf0a040, 0xf6d25a, 0xe0604a], hull: 0xe0d4be, trim: 0xf0a83a, tarp: 0xd8c8a0, metal: 0x8a8a8e,
    rock: 0x7e7a70, tree: 0x3f8a6a, trunk: 0x5a3e2e, treeKind: 'bulb', suit: 0x5aa0e0,
    window: 0xffcf70, light: 0xffb450, outline: 0x1a1a14, ambient: 0xf2dcc6, particles: 'firefly',
  },
  5: {
    id: 5, name: '殖民地', en: 'Colony', mood: '異晶紫原 · 晶簇與螢光菇',
    ground: [0x2a2248, 0x3a2e62, 0x4c3c7c, 0x604e94, 0x7a66ae], path: [0x6a5e8a, 0x857aa6, 0xa298c0, 0xbeb6d6],
    flora: [0x7af0e0, 0xc890ff, 0xf07ad0], hull: 0xd8d2ea, trim: 0xb070ff, tarp: 0xb8aad8, metal: 0x7a7494,
    rock: 0x5a5078, tree: 0x8a4ac0, trunk: 0xd8cce8, treeKind: 'mushroom', suit: 0x4fd0c0,
    window: 0xe8ccff, light: 0xc890ff, outline: 0x140e22, ambient: 0xd0c2ec, particles: 'mote',
  },
  6: {
    id: 6, name: '星城', en: 'Star City', mood: '紫金花園 · 金色石板大道',
    ground: [0x2a3050, 0x363e66, 0x444e7e, 0x566496, 0x6e7eb0], path: [0x9a7a4a, 0xbc9a5e, 0xd8b878, 0xeed49a],
    flora: [0xffd24a, 0xf07ad0, 0xb8e0ff], hull: 0xf2ecf6, trim: 0xffc83a, tarp: 0xe8d8f0, metal: 0x9a8cb0,
    rock: 0x6a6488, tree: 0xb06ad0, trunk: 0x4a3a5a, treeKind: 'blossom', suit: 0xffc83a,
    window: 0xffe08a, light: 0xffd070, outline: 0x16102a, ambient: 0xdccce8, particles: 'gold',
  },
};

function mats(P) {
  return {
    hull: ramp(P.hull), trim: ramp(P.trim), tarp: ramp(P.tarp), metal: ramp(P.metal), stone: ramp(P.rock),
    dark: ramp(0x4a4f5e), glass: ramp(0x7ccbe6), crate: ramp(0xb07840), rust: ramp(0xa45a38), gold: ramp(0xe6b448),
    green: ramp(0x4fc86a), yellow: ramp(0xe0b23a), brick: ramp(0x9a5e48), water: ramp(0x4aa8e0), solar: ramp(0x34508a),
    concrete: ramp(0x9a9ea4),
  };
}

// ───────────────────────────── 繪圖工具組 ─────────────────────────────

function makeKit(stage, accColor, tier, W = 240, H = 220, OX = 120, OY = 196) {
  const P = STAGES[stage];
  const b = new Pix(W, H, OX, OY);
  const M = mats(P);
  const glows = [], beacons = [], smokes = [];
  const k = { b, P, M, tier, acc: tier === 3 ? M.trim : ramp(accColor), res: accColor, glows, beacons, smokes };
  const R = Math.round;

  k.px = (x, y, c, a) => (b.set(x, y, c, a), k);
  k.rect = (x, y, w, h, c, a) => (b.rect(x, y, w, h, c, a), k);
  k.hl = (x0, x1, y, c, a) => (b.hline(x0, x1, y, c, a), k);
  k.vl = (x, y0, y1, c, a) => (b.vline(x, y0, y1, c, a), k);
  k.line = (x0, y0, x1, y1, c, a) => (b.line(x0, y0, x1, y1, c, a), k);
  k.poly = (pts, c, a) => (b.poly(pts, c, a), k);
  k.ell = (cx, cy, rx, ry, c, a) => (b.ell(cx, cy, rx, ry, c, a), k);
  k.ellO = (cx, cy, rx, ry, c, a) => {
    cx = R(cx); cy = R(cy);
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const o = (dx * dx) / ((rx + 0.5) ** 2) + (dy * dy) / ((ry + 0.5) ** 2) <= 1;
      const i = rx > 1 && ry > 0 && (dx * dx) / ((rx - 0.5) ** 2) + (dy * dy) / ((ry - 0.5) ** 2) <= 1;
      if (o && !i) b.set(cx + dx, cy + dy, c, a);
    }
    return k;
  };
  k.glow = (x, y, r, c, a = 0.5, flicker = false) => (glows.push({ x, y, r, c, a, flicker }), k);
  k.smoke = (x, y, c = 0xd8d4d0) => (smokes.push({ x, y, c }), k);
  k.beacon = (x, y, c = 0xff4a4a) => { b.set(x, y, c); beacons.push({ x, y, c }); return k; };

  // 盒子：(x, y) 是正面左下角，w 寬、d 深（頂面的像素高）、h 高
  k.box = (x, y, w, d, h, m, o = {}) => {
    x = R(x); y = R(y);
    const top = y - h - d;
    for (let yy = top; yy < y - h; yy++) {
      const inset = o.round && yy === top ? 1 : 0;
      b.hline(x + inset, x + w - 1 - inset, yy, yy === y - h - 1 ? m[4] : m[3]);
    }
    if (h > 0) {
      b.rect(x, y - h, w, h, m[2]);
      b.vline(x, y - h, y - 1, m[3]);
      b.vline(x + w - 1, y - h, y - 1, m[1]);
      b.hline(x, x + w - 1, y - 1, m[1]);
      if (o.seam) for (let sx = x + o.seam; sx < x + w - 1; sx += o.seam) b.vline(sx, y - h + 1, y - 2, m[1]);
      if (o.band != null) b.hline(x + 1, x + w - 2, y - h + o.band, (o.bandM ?? M.trim)[2]);
    }
    return k;
  };
  // 帶光影的橢圓體（光從左上）
  k.blob = (cx, cy, rx, ry, m, o = {}) => {
    cx = R(cx); cy = R(cy); rx = R(rx); ry = R(ry);
    for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) {
      const nx = dx / (rx + 0.5), ny = dy / (ry + 0.5), q = nx * nx + ny * ny;
      if (q > 1) continue;
      const l = -0.5 * nx - 0.55 * ny + 0.65 * Math.sqrt(1 - q);
      b.set(cx + dx, cy + dy, m[clamp(Math.floor((l + 0.45) * 2.3 + bayer(cx + dx, cy + dy) * 0.9), 0, 4)], o.a);
    }
    return k;
  };
  // 直立圓柱（y 為正面接地點）
  k.cyl = (cx, y, rx, h, m, o = {}) => {
    cx = R(cx); y = R(y); rx = R(rx);
    const ry = Math.max(1, R(rx * 0.5)), cb = y - ry, ct = cb - h;
    for (let dx = -rx; dx <= rx; dx++) {
      const t = dx / (rx + 0.5), ext = R((ry + 0.3) * Math.sqrt(1 - t * t));
      const idx = clamp(Math.floor((-0.7 * t + 0.95) * 2.2 + bayer(cx + dx, 0) * 0.9 - 0.9), 0, 3);
      for (let yy = ct; yy <= cb + ext; yy++) b.set(cx + dx, yy, m[idx], o.a);
      if (o.glass && dx === -R(rx * 0.5)) b.vline(cx + dx, ct + 1, cb + ext - 1, m[4], o.a);
    }
    b.ell(cx, ct, rx, ry, o.top ?? m[3], o.a);
    for (let dx = -rx + 1; dx < rx; dx++) b.set(cx + dx, ct + R(ry * Math.sqrt(1 - (dx / (rx + 0.5)) ** 2)), o.top ? mix(o.top, 0xffffff, 0.3) : m[4], o.a);
    if (o.top) k.glow(cx, ct, rx * 2 + 8, o.top, 0.55, true);
    return k;
  };
  // 半球頂（玻璃罩或艙頂）
  k.dome = (cx, y, rx, h, m, o = {}) => {
    cx = R(cx); y = R(y);
    const fr = Math.max(1, R(rx * 0.45)), cy = y - fr;
    for (let dy = -h; dy <= fr; dy++) for (let dx = -rx; dx <= rx; dx++) {
      let l;
      if (dy <= 0) {
        const nx = dx / (rx + 0.5), ny = dy / (h + 0.5), q = nx * nx + ny * ny;
        if (q > 1) continue;
        l = -0.45 * nx - 0.35 * ny + 0.6 * Math.sqrt(1 - q);
      } else {
        const nx = dx / (rx + 0.5), ny = dy / (fr + 0.5);
        if (nx * nx + ny * ny > 1) continue;
        l = -0.45 * nx + 0.1 - ny * 0.35;
      }
      b.set(cx + dx, cy + dy, m[clamp(Math.floor((l + 0.4) * 2.4 + bayer(cx + dx, cy + dy) * 0.9), 0, 4)], o.a);
    }
    if (o.glass) {
      const sx = cx - R(rx * 0.45), sy = cy - R(h * 0.55);
      b.set(sx, sy, 0xffffff, o.a); b.set(sx + 1, sy, 0xffffff, o.a); b.set(sx, sy + 1, 0xffffff, o.a); b.set(sx + 2, sy - 1, m[4], o.a);
    }
    return k;
  };
  // 帳篷：三角柱，沿深度方向延伸
  k.tent = (cx, y, w, d, h, m) => {
    const L = cx - (w >> 1), Rr = cx + (w >> 1);
    b.poly([L, y, cx, y - h, cx, y - h - d, L, y - d], m[3]);
    b.poly([cx, y - h, Rr, y, Rr, y - d, cx, y - h - d], m[1]);
    b.poly([L, y, cx, y - h, Rr, y], m[2]);
    b.line(L + 1, y - 1, cx, y - h, m[3]);
    b.poly([cx - 3, y, cx, y - R(h * 0.55), cx + 3, y], m[0]);
    b.line(cx, y - h, cx, y - h - d, m[4]);
    return k;
  };
  k.win = (x, y, w, h, c) => {
    c = c ?? P.window;
    b.rect(x, y, w, h, c);
    b.set(x, y, mix(c, 0xffffff, 0.55));
    if (h > 2) b.hline(x, x + w - 1, y + h - 1, mix(c, 0x000000, 0.2));
    return k.glow(x + w / 2, y + h / 2, 5 + Math.max(w, h) * 2, c, 0.32);
  };
  k.door = (x, y, w, h) => { b.rect(x, y, w, h, M.dark[0]); b.vline(x, y, y + h - 1, M.dark[1]); b.set(x + w - 2, y + (h >> 1), P.window); return k; };
  k.porthole = (cx, cy, r) => { b.ell(cx, cy, r + 1, r + 1, M.metal[1]); b.ell(cx, cy, r, r, P.window); b.set(cx - 1, cy - 1, 0xffffff); return k.glow(cx, cy, 10 + r * 3, P.window, 0.4); };
  k.lamp = (x, y, c, r = 12, a = 0.55, fl = false) => { b.set(x, y, c ?? P.light); return k.glow(x, y, r, c ?? P.light, a, fl); };
  k.glowRect = (x, y, w, h, c, a) => { b.rect(x, y, w, h, c, a); return k.glow(x + w / 2, y + h / 2, Math.max(w, h) * 1.2 + 6, c, 0.35); };
  k.mast = (x, y, h, c) => { b.vline(x, y - h, y - 1, M.metal[1]); b.set(x, y - h, M.metal[3]); return k.beacon(x, y - h - 1, c ?? 0xff4a4a); };
  k.post = (x, y, h, c) => {
    b.vline(x, y - h, y - 1, M.dark[2]); b.set(x - 1, y - h, M.dark[1]); b.set(x + 1, y - h, M.dark[1]); b.set(x, y - 1, M.dark[0]);
    return k.lamp(x, y - h - 1, c ?? 0xd8f2ff, 30, 0.5);   // 冷白 LED 泛光燈（沒有氧氣，不會有燃燒的燈）
  };
  k.dish = (cx, y, r, m = M.metal) => {
    b.vline(cx, y - 2, y - 1, m[1]);
    const ry = Math.max(1, R(r * 0.55)), cy = y - 3 - ry;
    b.ell(cx, cy, r, ry, m[3]);
    b.ell(cx + 1, cy, Math.max(1, r - 2), Math.max(1, ry - 1), m[1]);
    b.line(cx, cy, cx + 1, cy - r, m[0]);
    return k.lamp(cx + 1, cy - r - 1, k.acc[3], 8, 0.5);
  };
  k.solar = (x, y, w, d) => {
    b.vline(x + 1, y - 2, y - 1, M.dark[1]); b.vline(x + w - 2, y - 2, y - 1, M.dark[1]);
    b.rect(x, y - 2 - d, w, d, M.solar[2]);
    for (let gx = x + 3; gx < x + w - 1; gx += 3) b.vline(gx, y - 2 - d, y - 3, M.solar[1]);
    b.hline(x, x + w - 1, y - 2 - Math.ceil(d / 2), M.solar[1]);
    b.hline(x, x + w - 1, y - 2 - d, M.solar[4]);
    b.hline(x, x + w - 1, y - 2, M.solar[0]);
    return k;
  };
  k.crate = (x, y, s, m = M.crate) => {
    k.box(x, y, s, Math.max(2, R(s * 0.5)), s - 1, m);
    b.hline(x, x + s - 1, y - Math.ceil(s / 2), m[1]);
    b.vline(x + (s >> 1), y - s + 2, y - 2, m[1]);
    return k;
  };
  k.barrel = (cx, y, r, m = M.rust) => { k.cyl(cx, y, r, r * 2 + 1, m); b.hline(cx - r, cx + r, y - R(r * 0.5) - r - 1, m[1]); return k; };
  k.pipe = (pts, m = M.metal) => {
    for (let i = 0; i < pts.length - 2; i += 2) {
      b.line(pts[i], pts[i + 1] + 1, pts[i + 2], pts[i + 3] + 1, m[1]);
      b.line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], m[2]);
      b.line(pts[i], pts[i + 1] - 1, pts[i + 2], pts[i + 3] - 1, m[3]);
    }
    return k;
  };
  k.plant = (x, y, c) => { b.set(x, y, mix(c, 0x000000, 0.35)); b.set(x - 1, y - 1, c); b.set(x + 1, y - 1, c); b.set(x, y - 2, mix(c, 0xffffff, 0.35)); return k; };
  k.fire = (cx, y) => {
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.set(cx + R(Math.cos(a) * 4), y - 2 + R(Math.sin(a) * 2), i < 5 ? M.stone[1] : M.stone[3]); }
    b.poly([cx - 3, y - 1, cx - 1, y - 7, cx, y - 5, cx + 1, y - 9, cx + 3, y - 1], 0xff7a28);
    b.poly([cx - 2, y - 1, cx, y - 6, cx + 2, y - 1], 0xffc850);
    b.set(cx, y - 2, 0xfff4c0); b.set(cx, y - 3, 0xfff4c0);
    k.glow(cx, y - 3, 70, 0xff9a40, 0.55, true);
    k.glow(cx, y - 3, 20, 0xffd080, 0.7, true);
    return k.smoke(cx, y - 11, 0x8a7a70);
  };
  // 充氣加壓艙：半圓頂＋骨架＋前方氣閘
  k.pod = (cx, y, w, h, m) => {
    const rx = w >> 1, fr = Math.max(1, R(rx * 0.45)), cy = y - fr;
    k.dome(cx, y, rx, h, m);
    for (const off of [-0.5, 0, 0.5]) for (let dy = -h + 1; dy <= 0; dy++) {
      const x = cx + R(off * rx * Math.sqrt(Math.max(0, 1 - (dy / (h + 0.5)) ** 2)));
      b.set(x, cy + dy, m[1]);
    }
    b.hline(cx - rx + 1, cx + rx - 1, cy, M.trim[2]);
    k.box(cx - 3, y + 1, 6, 2, 6, M.metal);
    b.rect(cx - 1, y - 4, 2, 3, P.window);
    return k.glow(cx, y - 3, 10, P.window, 0.35);
  };
  // 輻射加熱器：金屬機身＋發光線圈（不需要氧氣）
  k.heater = (cx, y) => {
    k.box(cx - 4, y, 9, 4, 2, M.dark);
    k.box(cx - 3, y - 3, 7, 3, 7, M.metal);
    for (let i = 0; i < 3; i++) b.vline(cx - 2 + i * 2, y - 9, y - 5, i === 1 ? 0xffd070 : 0xff8a30);
    b.hline(cx - 2, cx + 2, y - 11, M.metal[4]);
    k.glow(cx, y - 7, 64, 0xff9a40, 0.5, true);
    return k.glow(cx, y - 7, 18, 0xffd080, 0.6, true);
  };
  k.crystal = (cx, y, h, c) => {
    const Rm = ramp(c), w = Math.max(2, R(h * 0.3)), ys = y - R(h * 0.3);
    b.poly([cx - w, y, cx - w, ys, cx, y - h, cx, y], Rm[3]);
    b.poly([cx, y - h, cx + w, ys, cx + w, y, cx, y], Rm[1]);
    b.line(cx, y - h + 1, cx, y - 1, Rm[4]);
    b.set(cx - w + 1, ys, Rm[4]);
    return k.glow(cx, y - h / 2, h * 2.2 + 6, c, 0.45);
  };
  k.greenhouse = (x, y, w, d, h) => {
    k.box(x, y, w, d, h, M.glass);
    for (let yy = y - h - d + 1; yy < y - h - 1; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx++) if ((xx + yy) % 3) b.set(xx, yy, M.green[(xx * 7 + yy) % 5 ? 2 : 3]);
    for (let xx = x + 1; xx < x + w - 1; xx++) { b.set(xx, y - 2, M.green[xx % 2 ? 1 : 2]); if (xx % 3 === 0) b.set(xx, y - 3, M.green[3]); }
    for (let gx = x + 3; gx < x + w - 1; gx += 4) { b.vline(gx, y - h, y - 2, M.metal[3]); b.vline(gx, y - h - d, y - h - 1, M.metal[2]); }
    return k.glow(x + w / 2, y - h, w + 6, 0x8cf09a, 0.2);
  };
  k.lattice = (x, y, w, h, m = M.metal) => {
    b.vline(x, y - h, y - 1, m[1]); b.vline(x + w - 1, y - h, y - 1, m[2]);
    let dir = 0;
    for (let yy = y - 1; yy > y - h + w; yy -= w) { dir ? b.line(x, yy, x + w - 1, yy - w + 1, m[2]) : b.line(x + w - 1, yy, x, yy - w + 1, m[2]); dir ^= 1; }
    return k;
  };
  k.tower = (cx, y, rb, rw, rt, h, m) => {
    for (let i = 0; i < h; i++) {
      const t = i / h;
      const r = R(t < 0.72 ? rw + (rb - rw) * ((0.72 - t) / 0.72) ** 2 : rw + (rt - rw) * ((t - 0.72) / 0.28) ** 2);
      for (let dx = -r; dx <= r; dx++) {
        const tt = dx / (r + 0.5);
        b.set(cx + dx, y - 1 - i, m[clamp(Math.floor((-0.7 * tt + 0.95) * 2.2 + bayer(cx + dx, i) * 0.9 - 0.9), 0, 3)]);
      }
    }
    const ry = Math.max(1, R(rt * 0.45));
    b.ell(cx, y - h, rt, ry, m[4]);
    b.ell(cx, y - h, rt - 1, Math.max(1, ry - 1), m[0]);
    k.smoke(cx - 2, y - h - 2, 0xf2f4f8);
    return k.smoke(cx + 2, y - h - 4, 0xf2f4f8);
  };
  k.helix = (cx, y, h, c1, c2) => {
    for (let i = 0; i < h; i++) {
      const yy = y - i, s = Math.sin(i * 0.45), x1 = cx + R(s * 4), x2 = cx - R(s * 4);
      if (i % 3 === 0) b.hline(x1, x2, yy, mix(c1, c2, 0.5), 110);
      b.set(x1, yy, c1, 150); b.set(x2, yy, c2, 150);
      if (i % 8 === 0) k.glow(cx, yy, 14, c1, 0.3);
    }
    return k;
  };

  k.finish = (o = {}) => {
    b.outline(P.outline);
    if (o.shadow !== false) {
      const bb = b.bbox(), w = bb.x1 - bb.x0;
      const rx = Math.max(4, R(w * 0.46));
      b.shadow((bb.x0 + bb.x1) / 2 - b.ox + 2, -1, rx, Math.max(2, R(rx * 0.26)), 0x0c0a14, 80);
    }
    return { ...b.crop(1), glows, beacons, smokes };
  };
  return k;
}

// ───────────────────────────── 建築 ─────────────────────────────
// draw(k, t)：t = 外觀階段 1/2/3。hub = 該階段地圖中央的核心建築。

const tankUnit = (k, cx, y, rx, h) => {
  const { M } = k;
  k.cyl(cx, y, rx, 2, M.metal);
  k.cyl(cx, y - 2, rx, h, M.green, { glass: true });
  k.cyl(cx, y - 2 - h, rx, 1, M.metal);
  for (let i = 0; i < 3; i++) k.px(cx - 1 + i, y - 5 - ((i * 5) % Math.max(1, h - 4)), 0xd8ffd8);
  k.glow(cx, y - 2 - h / 2, rx * 3 + 10, 0x6fe38a, 0.45);
};
const container = (k, x, y, len, col) => { const m = ramp(col); k.box(x, y, len, 7, 7, m, { seam: 3 }); k.vl(x + len - 2, y - 6, y - 2, m[0]); };
const stall = (k, x, y, col) => {
  const { M } = k, Rm = ramp(col);
  k.box(x, y, 13, 5, 4, M.crate);
  k.px(x + 3, y - 7, 0x6fe38a).px(x + 6, y - 7, 0xffd54a).px(x + 9, y - 7, 0xff6ad5);
  k.vl(x, y - 12, y - 5, M.metal[1]).vl(x + 12, y - 12, y - 5, M.metal[1]);
  k.box(x - 1, y - 11, 15, 6, 1, Rm);
  for (let i = 1; i < 15; i += 3) k.vl(x - 1 + i, y - 18, y - 13, 0xfff4e8);
};

const B = (id, name, stage, res, draw, hub = false) => ({ id, name, stage, res, draw, hub });

export const BUILDINGS = [
  // ── 階段 1 墜毀營地 ──
  B('escape_pod', '逃生艙', 1, 'parts', (k, t) => {
    const { M } = k;
    if (t === 1) {
      k.box(-22, 1, 6, 3, 2, M.metal);
      k.blob(0, -7, 14, 7, M.hull);
      k.blob(11, -6, 5, 5, M.metal);
      k.hl(-11, 6, -8, M.trim[2]);
      k.porthole(-4, -10, 2);
      k.line(-9, -3, -3, -1, M.hull[0]);
      k.box(16, 2, 5, 2, 2, M.metal);
      k.smoke(12, -11).beacon(-8, -13, 0xff5a3a);
      return;
    }
    if (t === 3) {
      k.box(-34, -3, 18, 8, 11, M.hull, { seam: 6, band: 3 });
      k.win(-31, -11, 3, 3).win(-25, -11, 3, 3);
      k.dish(-26, -15, 4);
      k.box(-16, -5, 6, 3, 3, M.metal);
    }
    k.line(-8, 0, -5, -6, M.metal[1]).line(8, 0, 5, -6, M.metal[1]).vl(0, -5, 0, M.metal[1]);
    k.blob(0, -15, 9, 11, M.hull);
    k.hl(-8, 8, -12, M.trim[2]);
    k.porthole(-2, -19, 2);
    k.mast(5, -24, 7);
    k.solar(12, 0, 13, 6);
    k.crate(-19, 1, 6);
    if (t === 3) { k.hl(-8, 8, -9, M.trim[3]); k.post(26, 2, 12); }
  }),
  B('scrap_heap', '殘骸堆', 1, 'scrap', (k, t) => {
    const { M } = k, R = Math.round;
    const heap = (x, y, s) => {
      k.blob(x - R(5 * s), y - R(4 * s), R(7 * s), R(4 * s), M.rust);
      k.blob(x + R(5 * s), y - R(4 * s), R(7 * s), R(5 * s), M.rust);
      k.blob(x, y - R(8 * s), R(6 * s), R(5 * s), M.rust);
      k.box(x - R(3 * s), y - R(7 * s), R(5 * s), 2, 2, M.metal);
      k.line(x + R(2 * s), y - R(13 * s), x + R(7 * s), y - R(7 * s), M.metal[3]);
      k.box(x + R(6 * s), y - 1, R(4 * s), 2, R(3 * s), M.hull);
    };
    if (t >= 2) {
      heap(-20, -7, 0.6);
      k.lattice(12, -8, 3, 30);
      k.line(13, -38, -2, -34, M.metal[2]).line(13, -37, -2, -33, M.metal[1]);
      k.vl(-2, -33, -22, M.dark[0]).rect(-4, -22, 5, 2, M.metal[1]);
      k.beacon(13, -39, 0xffa040);
    }
    heap(0, 0, 1);
    k.lamp(-3, -12, 0xffe0a0, 8, 0.5).lamp(8, -6, 0xffd080, 6, 0.4);
    if (t >= 2) k.crate(-28, 3, 6);
    if (t === 3) {
      k.box(8, 3, 10, 3, 2, M.dark);
      k.box(18, 1, 16, 8, 12, M.metal, { seam: 5 });
      k.glowRect(21, -8, 9, 4, 0xff8a30);
      k.box(29, -13, 4, 3, 9, M.dark).smoke(31, -26);
      k.crate(-36, 4, 5, M.rust);
    }
  }),
  B('algae_tank', '藻類槽', 1, 'nutrient', (k, t) => {
    const { M, P } = k;
    if (t === 3) tankUnit(k, 14, -6, 5, 16);
    if (t >= 2) { tankUnit(k, -13, -4, 5, 11); k.pipe([-8, -9, -5, -9]); }
    tankUnit(k, 0, 0, 6, 13);
    k.pipe([6, -8, 10, -8]);
    k.box(9, 2, 8, 5, 6, M.metal);
    k.win(11, -2, 3, 2, 0x8cf09a);
    if (t === 3) { k.post(-22, 2, 14, 0xb8ffb8); k.plant(-18, 3, P.flora[0]).plant(20, 4, P.flora[1]); }
  }),
  // 氧氣再生器「阿喘」：用逃生艙殘骸拼成的機器，正面一具大風扇，管線接到儲氣罐
  B('o2_scrubber', '氧氣再生器', 1, 'oxygen', (k, t) => {
    const { M } = k;
    const O2 = 0x8fd8ff;
    if (t === 3) { k.cyl(-20, 2, 5, 13, M.water, { glass: true }); k.pipe([-15, -6, -11, -6]); k.glow(-20, -6, 14, O2, 0.35); }
    if (t >= 2) { k.cyl(18, 2, 4, 10, M.metal); k.pipe([10, -5, 14, -5]); k.lamp(18, -10, O2, 8, 0.5); }
    k.box(-11, 1, 22, 10, 10, M.hull, { seam: 7 });
    k.box(-9, -9, 6, 3, 4, M.rust);                         // 拼裝的鏽鐵片
    // 正面風扇
    k.ellO(1, -4, 5, 4, M.metal[1]);
    k.ell(1, -4, 4, 3, M.dark[0]);
    k.line(-2, -6, 4, -2, M.metal[3]).line(-2, -2, 4, -6, M.metal[2]);
    k.px(1, -4, M.metal[4]);
    k.vl(9, -18, -9, M.metal[1]).px(9, -19, M.metal[3]);    // 排氣管
    k.smoke(9, -21, 0xd8f0ff);
    k.glowRect(-8, -2, 2, 1, O2);
  }),
  // 電解站：鑽進冰層的鑽塔，旁邊一藍（氧）一灰（氫）兩個儲氣罐
  B('electrolyzer', '電解站', 2, 'oxygen', (k, t) => {
    const { M } = k;
    const O2 = 0x8fd8ff;
    if (t === 3) { k.cyl(24, 3, 4, 12, M.water, { glass: true }); k.pipe([12, -6, 20, -6]); }
    k.box(-16, 2, 20, 10, 7, M.concrete, { seam: 5 });
    k.lattice(-10, -5, 6, 26);                               // 鑽塔
    k.hl(-11, -3, -31, M.metal[3]).beacon(-7, -32, 0xffb050);
    k.vl(-7, -5, 2, M.dark[1]);                               // 鑽桿
    k.cyl(9, 2, 5, 14, M.water, { glass: true });             // 氧氣罐（藍）
    k.glow(9, -8, 16, O2, 0.4);
    k.cyl(17, 3, 3, 9, M.metal);                              // 氫氣罐（灰）
    k.pipe([4, -3, 6, -3]);
    if (t >= 2) { k.box(-22, 3, 6, 5, 5, M.metal); k.win(-21, -1, 3, 2, O2); k.smoke(-4, -30, 0xe8f4ff); }
    for (const [x, y] of [[-14, 3], [-3, 4], [-12, 5]]) k.px(x, y, 0xdff4ff);   // 噴出的冰屑
  }),
  B('emergency_camp', '緊急營地', 1, 'tools', (k, t) => {
    const { M } = k;
    if (t === 3) {
      k.box(8, -14, 22, 8, 12, M.hull, { seam: 6, band: 2 });
      k.win(12, -23, 3, 3).win(24, -23, 3, 3).door(17, -20, 4, 6);
    }
    if (t >= 2) { k.pod(-27, -7, 16, 9, M.hull); k.pipe([-19, -10, -17, -10]); }
    k.box(2, -7, 11, 2, 2, M.metal);
    k.pod(-8, 0, 22, 12, M.hull);
    k.heater(11, 2);
    k.crate(19, -3, 6);
    if (t >= 2) { k.post(27, 3, 13); k.barrel(-20, 4, 3); }
    if (t === 3) {
      k.lattice(-40, 2, 3, 26);
      k.box(-42, -24, 7, 3, 3, M.dark);
      k.lamp(-39, -26, 0xfff0c0, 44, 0.5);
    }
  }, true),

  // ── 階段 2 營地 ──
  B('hab_pod', '生活艙', 2, 'nutrient', (k, t) => {
    const { M } = k;
    if (t === 3) { k.cyl(-20, -6, 8, 2, M.metal); k.dome(-20, -8, 8, 8, M.hull); k.win(-22, -12, 2, 2); }
    if (t >= 2) {
      k.box(9, -3, 16, 9, 9, M.hull, { band: 2 });
      k.win(13, -9, 3, 3).win(19, -9, 3, 3);
      k.box(7, -5, 4, 4, 5, M.metal);
      if (t === 3) k.mast(21, -15, 8);
    }
    k.cyl(0, 0, 12, 2, M.metal);
    k.dome(0, -2, 12, 11, M.hull);
    k.hl(-11, 11, -7, M.trim[2]);
    k.door(-2, -8, 4, 6);
    k.win(-8, -10, 2, 2).win(6, -10, 2, 2);
    if (t === 3) k.dome(0, -17, 4, 4, M.glass, { glass: true });
  }),
  B('bio_harvester', '生物採集站', 2, 'nutrient', (k, t) => {
    const { M, P } = k;
    if (t >= 2) k.greenhouse(-2, -9, t === 3 ? 30 : 22, 9, 9);
    k.box(-16, 0, 15, 8, 10, M.hull, { band: 2 });
    k.win(-13, -7, 5, 2, 0x8cf09a);
    k.line(-1, -9, 6, -4, M.metal[2]).vl(6, -4, 0, M.metal[1]);
    k.cyl(-20, 3, 3, 6, M.green, { glass: true });
    k.plant(9, 2, P.flora[0]).plant(13, 3, P.flora[1]);
    if (t === 3) {
      k.box(-8, -34, 9, 4, 2, M.metal);
      k.hl(-11, 3, -39, M.metal[3]);
      k.beacon(-4, -36, 0x6fe38a).glow(-4, -26, 16, 0x6fe38a, 0.25);
      k.crate(18, 4, 5);
    }
  }),
  B('cargo', '物資庫', 2, 'scrap', (k, t) => {
    const { M } = k;
    if (t >= 2) container(k, -14, -9, 22, 0x4a8ac8);
    container(k, -12, 0, 24, 0xd0703a);
    if (t >= 2) { container(k, -10, -7, 20, 0x5aa05a); container(k, 14, 2, 14, 0xd8c060); }
    if (t === 3) {
      container(k, -34, 2, 18, 0xa84a4a);
      k.vl(-27, -42, 1, M.metal[1]).vl(-26, -42, 1, M.metal[3]).vl(26, -42, 1, M.metal[1]).vl(27, -42, 1, M.metal[3]);
      k.hl(-27, 27, -43, M.trim[2]).hl(-27, 27, -42, M.trim[1]);
      k.box(-3, -40, 7, 2, 3, M.dark).vl(0, -37, -24, M.dark[0]).rect(-2, -24, 5, 2, M.yellow[2]);
      k.beacon(-26, -44).beacon(26, -44);
    }
  }),
  B('lounge', '休閒艙', 2, 'credit', (k, t) => {
    const { M } = k, pink = 0xff6ad5;
    if (t === 3) { k.cyl(24, -3, 8, 2, M.metal); k.dome(24, -5, 8, 7, M.glass, { glass: true }); k.glow(24, -10, 22, pink, 0.35); }
    k.box(-15, 0, 30, 10, 11, M.hull, { round: true });
    k.win(-11, -9, 15, 5, 0xffe2a0);
    k.door(7, -8, 5, 7);
    k.box(-8, -12, 14, 1, 5, M.dark);
    k.glowRect(-7, -16, 5, 2, pink).glowRect(-1, -16, 5, 2, k.acc[3]);
    if (t >= 2) {
      k.vl(10, -26, -13, M.metal[1]);
      k.ell(10, -27, 6, 2, ramp(pink)[2]).hl(6, 12, -28, ramp(pink)[3]);
      k.box(-15, 3, 3, 2, 3, M.stone).plant(-14, -3, 0x6fe38a);
    }
    if (t === 3) {
      for (let i = 0; i <= 10; i++) {
        const x = -16 + i * 4, y = -22 + Math.round(Math.sin((i / 10) * Math.PI) * 3);
        k.lamp(x, y, i % 2 ? pink : 0xffe08a, 7, 0.5);
        if (i < 10) k.line(x + 1, y, x + 3, -22 + Math.round(Math.sin(((i + 1) / 10) * Math.PI) * 3), M.dark[1]);
      }
    }
  }),
  B('assembly', '組裝工坊', 2, 'parts', (k, t) => {
    const { M } = k;
    if (t === 3) {
      k.box(-44, -3, 22, 9, 12, M.hull, { band: 2 });
      k.rect(-40, -12, 12, 9, M.dark[1]);
      for (let yy = -11; yy < -3; yy += 2) k.hl(-40, -29, yy, M.dark[0]);
      k.glowRect(-40, -4, 12, 1, k.acc[3]);
    }
    k.box(-17, 0, 28, 11, 14, M.hull, { band: 2 });
    k.rect(-13, -11, 13, 11, M.dark[2]);
    for (let yy = -10; yy < -1; yy += 2) k.hl(-13, -1, yy, M.dark[1]);
    for (let x = -13; x < 0; x += 2) { k.px(x, -1, M.yellow[2]); k.px(x + 1, -1, M.dark[0]); }
    k.win(3, -10, 5, 3);
    if (t >= 2) { k.box(-13, -14, 6, 3, 3, M.metal).box(-4, -14, 6, 3, 3, M.metal); k.crate(-26, 3, 6).crate(-25, -2, 5); }
    k.box(13, 2, 5, 3, 2, M.dark);
    k.line(15, -2, 19, -10, M.trim[2]).line(16, -2, 20, -10, M.trim[1]).line(19, -10, 24, -7, M.trim[2]);
    k.lamp(24, -6, 0x9ad8ff, 10, 0.6);
    if (t === 3) { k.box(4, -15, 3, 2, 10, M.dark).smoke(5, -28); k.beacon(-16, -26, k.acc[3]); }
  }),
  B('rock_cutter', '岩層切割機', 2, 'rock', (k, t) => {
    const { M } = k, Y = M.yellow, r = t >= 2 ? 7 : 6;
    k.blob(18, -4, 8, 5, M.stone).blob(24, -3, 5, 4, M.stone).blob(14, -2, 4, 3, M.stone);
    if (t >= 2) {
      k.box(-38, 3, 16, 3, 2, M.dark);
      for (let x = -37; x < -23; x += 3) k.px(x, -1, M.metal[3]);
      k.box(-35, -1, 5, 3, 4, M.stone).box(-29, 0, 5, 3, 4, M.stone);
    }
    k.box(-18, 2, 24, 6, 3, M.dark, { seam: 3 });
    k.box(-15, -1, 17, 8, 9, Y, { band: 1 });
    k.win(-13, -8, 5, 3, 0xcfeaff);
    k.line(1, -6, 8, -9, M.metal[1]);
    const sx = 10, sy = -9;
    k.ell(sx, sy, r, r, M.metal[3]).ell(sx, sy, r - 2, r - 2, M.metal[2]);
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; k.px(sx + Math.round(Math.cos(a) * (r + 1)), sy + Math.round(Math.sin(a) * (r + 1)), M.metal[0]); }
    k.px(sx, sy, M.dark[0]);
    k.lamp(15, -2, 0xffd080, 8, 0.5).lamp(17, -5, 0xffe0a0, 6, 0.4);
    if (t === 3) {
      k.box(-12, -17, 9, 5, 6, Y);
      k.win(-11, -21, 5, 2, 0xcfeaff);
      k.mast(-6, -24, 8);
      k.glowRect(17, -9, 12, 1, 0xff5050);
    }
  }),
  B('central_hub', '中央艙', 2, 'parts', (k, t) => {
    const { M } = k;
    if (t >= 2) {
      k.box(-34, -3, 14, 8, 9, M.hull, { band: 2 }).win(-31, -9, 3, 3).win(-26, -9, 3, 3);
      k.box(20, -3, 14, 8, 9, M.hull, { band: 2 }).win(23, -9, 3, 3).win(28, -9, 3, 3);
    }
    k.box(-18, 0, 36, 15, 11, M.hull, { band: 3, seam: 9 });
    for (let i = 0; i < 5; i++) if (i !== 2) k.win(-15 + i * 7, -8, 3, 3);
    k.door(-2, -7, 5, 7);
    k.dome(0, -15, 10, 9, M.glass, { glass: true });
    if (t === 2) k.mast(12, -20, 8);
    if (t === 3) {
      k.vl(0, -50, -26, M.metal[1]).vl(1, -50, -26, M.metal[3]);
      k.ellO(0, -38, 6, 2, M.trim[3], 170).ellO(0, -45, 4, 1, M.trim[3], 170);
      k.glow(0, -40, 20, k.P.trim, 0.35).beacon(0, -51, M.trim[4]);
      for (let x = -16; x <= 16; x += 8) k.lamp(x, 2, 0x8fd0ff, 8, 0.5);
    }
  }, true),

  // ── 階段 3 轉型期 ──
  B('databank', '資料庫', 3, 'parts', (k, t) => {
    const { M } = k, D = ramp(mix(M.hull[2], 0x2a3040, 0.55));
    const rack = (x, y, w, h) => {
      k.box(x, y, w, 9, h, D);
      for (let r = 0; r < Math.floor((h - 3) / 3); r++) for (let c = 0; c < Math.floor((w - 3) / 3); c++) {
        const on = (r * 7 + c * 3) % 5 !== 0;
        k.px(x + 2 + c * 3, y - h + 2 + r * 3, on ? [0x6fffa0, 0x6fc8ff, 0xffc060][(r + c) % 3] : D[1]);
      }
      k.glow(x + w / 2, y - h / 2, w + 8, 0x6fc8ff, 0.25);
    };
    if (t >= 2) rack(-30, -4, 14, 13);
    rack(-12, 0, 24, 17);
    k.ell(-5, -22, 3, 2, D[0]).px(-5, -22, D[3]).ell(5, -22, 3, 2, D[0]).px(5, -22, D[3]);
    if (t === 3) {
      k.dish(-24, -17, 4);
      k.vl(0, -35, -27, 0x6fe0ff, 120);
      k.ellO(0, -38, 10, 3, 0x6fe0ff, 150).ellO(0, -38, 6, 2, 0x6fe0ff, 120);
      k.px(0, -40, 0xcff8ff, 150).glow(0, -38, 26, 0x6fe0ff, 0.4);
    }
  }),
  B('rail_line', '軌道車線', 3, 'metal', (k, t) => {
    const { M, P } = k;
    if (t === 3) { k.box(-44, -12, 20, 8, 13, M.hull, { band: 2 }); k.win(-41, -21, 3, 3).win(-35, -21, 3, 3).win(-29, -21, 3, 3); }
    k.box(-34, -6, 30, 6, 3, M.concrete);
    for (let x = -38; x <= 38; x += 3) k.vl(x, -5, 0, M.crate[1]);
    k.hl(-40, 40, -4, M.metal[3]).hl(-40, 40, -1, M.metal[3]);
    if (t >= 2) {
      k.vl(-31, -22, -9, M.metal[1]).vl(-9, -22, -9, M.metal[1]);
      k.box(-34, -22, 28, 6, 2, M.trim);
      k.glowRect(-30, -22, 20, 1, P.window);
    }
    const car = (x) => {
      k.box(x, -1, 20, 6, 9, M.hull, { band: 3 });
      for (let i = 0; i < 4; i++) k.win(x + 2 + i * 5, -8, 3, 2);
      k.px(x + 3, -1, M.dark[0]).px(x + 16, -1, M.dark[0]);
    };
    car(-8);
    if (t >= 2) car(13);
    k.vl(-40, -16, -1, M.metal[1]).lamp(-40, -17, t === 3 ? 0x6fe0ff : 0x6fff9a, 10, 0.6);
    if (t === 3) { k.glowRect(-8, -1, 41, 1, 0x6fe0ff); k.hl(-44, 40, -30, M.metal[2]).vl(40, -30, -1, M.metal[1]); }
  }),
  B('metal_mine', '金屬礦井', 3, 'metal', (k, t) => {
    const { M } = k;
    if (t === 3) { k.lattice(22, -8, 3, 24); k.ellO(23, -34, 3, 3, M.metal[3]); }
    k.ell(0, -4, 8, 3, M.stone[1]).ell(0, -4, 6, 2, M.dark[0]);
    k.line(-7, -2, -2, -28, M.metal[1]).line(-6, -2, -1, -28, M.metal[3]).line(7, -2, 2, -28, M.metal[1]).line(6, -2, 1, -28, M.metal[2]);
    k.line(-5, -10, 4, -16, M.metal[2]).line(5, -10, -4, -16, M.metal[2]).line(-4, -20, 3, -24, M.metal[2]);
    k.ellO(0, -30, 4, 4, M.metal[3]).line(-3, -30, 3, -30, M.metal[2]).line(0, -33, 0, -27, M.metal[2]);
    k.vl(-3, -27, -5, M.dark[0]);
    k.box(10, 1, 15, 8, 9, M.hull, { seam: 5 }).win(13, -6, 3, 3).win(19, -6, 3, 3);
    k.line(3, -30, 12, -17, M.dark[1]);
    if (t >= 2) {
      k.box(-26, 1, 11, 6, 7, M.rust);
      for (let i = 0; i < 5; i++) k.px(-24 + i * 2, -12 + (i % 2), M.metal[4]);
      k.hl(-24, -10, 4, M.metal[3]).box(-14, 4, 6, 3, 3, M.dark);
    }
    if (t === 3) { k.pipe([-15, -7, -8, -14]); k.post(-30, 4, 12); k.lamp(-22, -11, 0xcfe8ff, 8, 0.4); }
  }),
  B('forge', '鍛造廠', 3, 'tools', (k, t) => {
    const { M } = k, Bk = M.brick;
    if (t === 3) {
      k.box(-44, -4, 24, 10, 15, Bk, { seam: 6 });
      for (let i = 0; i < 3; i++) k.win(-41 + i * 7, -14, 3, 4, 0xffa040);
      k.box(-38, -20, 4, 3, 12, M.dark).smoke(-36, -36);
    }
    k.box(-18, 0, 28, 12, 13, Bk, { seam: 7 });
    k.rect(-13, -10, 10, 9, 0x2a1410);
    k.glowRect(-12, -8, 8, 7, 0xff8a30).rect(-10, -5, 4, 4, 0xffe080);
    k.glow(-8, -5, 46, 0xff8a30, 0.55, true);
    k.win(2, -10, 3, 3, 0xffa040);
    if (t >= 2) k.box(-12, -18, 4, 3, 10, M.dark).smoke(-10, -33);
    k.box(1, -16, 5, 4, 14, M.dark).smoke(3, -35);
    k.box(14, 3, 7, 3, 3, M.dark).rect(15, -4, 3, 1, 0xffa040).glow(16, -4, 10, 0xffa040, 0.5);
    if (t >= 2) k.cyl(26, 1, 4, 4, M.dark, { top: 0xff9a30 });
    if (t === 3) k.glowRect(-40, 1, 58, 1, 0xff8a30);
  }, true),
  B('outpost', '前哨站', 3, 'weapon', (k, t) => {
    const { M } = k;
    if (t >= 2) {
      k.box(-38, 2, 18, 4, 7, M.concrete, { seam: 6 });
      for (let x = -37; x < -20; x += 3) k.rect(x, -12, 2, 2, M.concrete[3]);
      k.beacon(-30, -13);
    }
    k.box(10, 2, 14, 8, 8, M.hull, { band: 2 }).door(15, -4, 4, 5);
    k.line(-5, -6, -3, -20, M.metal[0]).line(5, -6, 3, -20, M.metal[0]);
    k.line(-7, 0, -4, -20, M.metal[1]).line(7, 0, 4, -20, M.metal[1]);
    k.line(-6, -6, 5, -14, M.metal[2]).line(6, -6, -5, -14, M.metal[2]);
    k.box(-7, -20, 14, 8, 7, M.hull, { band: 1 });
    k.win(-5, -25, 10, 2, 0xffe0a0);
    k.box(-8, -27, 16, 9, 2, M.trim);
    k.lamp(8, -24, 0xffffff, 26, 0.5);
    if (t === 3) {
      k.dome(0, -31, 4, 3, M.metal);
      k.line(3, -35, 11, -38, M.dark[2]).line(3, -34, 11, -37, M.dark[1]);
      k.beacon(-6, -38, 0xff4d4d);
    }
  }),

  // 探勘站（第 3 章）：車庫、探勘車、天線；屋頂上的偵測燈對異晶發紫光
  B('expedition', '探勘站', 3, 'crystal', (k, t) => {
    const { M } = k;
    const XENO = 0xc08aff;
    k.box(-22, 0, 30, 12, 11, M.hull, { band: 2 });
    k.rect(-18, -9, 14, 9, M.dark[0]).hl(-18, -5, -9, M.metal[3]);
    for (let y = -8; y < -1; y += 2) k.hl(-17, -6, y, M.dark[1]);
    k.win(0, -8, 3, 3).win(4, -8, 3, 3);
    const rover = (x) => {
      k.box(x, 4, 13, 5, 5, M.rust);
      k.win(x + 8, 0, 3, 2, 0xcfe8ff);
      k.ell(x + 2, 5, 2, 2, M.dark[0]).ell(x + 10, 5, 2, 2, M.dark[0]);
      k.px(x + 2, 5, M.metal[3]).px(x + 10, 5, M.metal[3]);
    };
    rover(12);
    if (t >= 2) { rover(-38); k.lamp(-25, -6, 0xffe0a0, 8, 0.35); }
    k.vl(-18, -30, -12, M.metal[1]).vl(-17, -30, -12, M.metal[3]);
    k.ellO(-17, -31, 4, 2, M.metal[3]).line(-17, -31, -13, -35, M.metal[2]);
    k.beacon(-13, -36, 0x6fffc8);
    k.dome(2, -13, 4, 3, M.glass, { glass: true });
    k.glow(2, -15, 14, XENO, 0.55, true).px(2, -15, 0xf0e0ff);
    if (t === 3) {
      k.lattice(20, -10, 3, 18);
      k.ellO(21, -30, 6, 3, M.metal[3]).line(21, -30, 26, -35, M.metal[2]);
      k.beacon(26, -36, XENO);
    }
  }),

  // ── 階段 4 前哨 ──
  B('hydro_farm', '水耕農場', 4, 'nutrient', (k, t) => {
    const { M, P } = k;
    if (t === 3) {
      k.box(-40, -6, 12, 9, 26, M.glass);
      for (let yy = -9; yy > -30; yy -= 4) k.hl(-39, -30, yy, M.green[3]).hl(-39, -30, yy + 1, M.green[1]);
      k.vl(-35, -31, -7, M.metal[3]);
      k.lamp(-37, -38, 0xff7ad0, 10, 0.4).lamp(-32, -38, 0xff7ad0, 10, 0.4);
    }
    if (t >= 2) k.greenhouse(4, -12, 24, 9, 8);
    k.greenhouse(-20, 0, 28, 11, 9);
    k.cyl(16, 2, 4, 9, M.water, { glass: true });
    k.plant(-24, 3, P.flora[0]).plant(12, 4, P.flora[1]);
  }),
  B('memorial', '紀念堂', 4, 'credit', (k, t) => {
    const { M, P } = k, Wm = ramp(0xe6ddc8);
    k.box(-15, 2, 30, 14, 2, M.stone).box(-11, -1, 22, 9, 2, M.stone);
    if (t >= 2) {
      k.box(-19, -8, 4, 4, 20, M.stone).box(15, -8, 4, 4, 20, M.stone);
      for (let i = 0; i <= 20; i++) {
        const a = Math.PI + (i / 20) * Math.PI, x = Math.round(Math.cos(a) * 17), y = -31 + Math.round(Math.sin(a) * 8);
        k.px(x, y, M.stone[3]).px(x, y + 1, M.stone[1]);
      }
    }
    k.box(-3, -4, 6, 4, 20, Wm);
    k.poly([-3, -27, 0, -31, 3, -27], Wm[3]);
    k.glowRect(-1, -20, 2, 11, 0xffd54a, 200);
    k.plant(-12, 4, P.flora[0]).plant(-8, 5, P.flora[1]).plant(9, 5, P.flora[0]).plant(13, 4, P.flora[2]);
    if (t === 3) {
      k.cyl(0, 7, 4, 2, M.metal);
      k.poly([-2, 2, 0, -4, 2, 2], 0xff9a30).px(0, 0, 0xffe080);
      k.glow(0, -1, 40, 0xffa040, 0.55, true);
      k.ellO(0, -34, 6, 2, 0xffe08a, 150).glow(0, -34, 18, 0xffe08a, 0.4);
      k.post(-24, 6, 14).post(24, 6, 14);
    }
  }),
  B('crystal_synth', '異晶合成室', 4, 'crystal', (k, t) => {
    const { M } = k, C = 0xb970ff;
    if (t >= 2) {
      k.cyl(-28, -4, 3, 4, M.metal);
      k.vl(-28, -20, -9, M.metal[2]).blob(-28, -22, 3, 3, M.metal);
      k.line(-26, -24, -22, -28, 0xe0c0ff, 150).line(-22, -28, -19, -25, 0xe0c0ff, 150);
      k.glow(-28, -22, 22, C, 0.45, true);
    }
    k.box(-20, 0, 22, 10, 12, M.hull, { band: 2 });
    k.win(-17, -9, 4, 3, 0xd9b8ff).win(-10, -9, 4, 3, 0xd9b8ff);
    k.cyl(12, 2, 7, 2, M.metal);
    k.cyl(12, 0, 7, 13, M.glass, { glass: true, a: 200 });
    k.crystal(12, -3, 11, C);
    k.cyl(12, -13, 7, 2, M.metal);
    if (t === 3) {
      k.crystal(-6, -28, 14, C);
      k.ellO(-6, -35, 9, 3, 0xe0b8ff, 150).ellO(-6, -35, 6, 2, 0xe0b8ff, 120);
    }
  }),
  B('security', '保全站', 4, 'weapon', (k, t) => {
    const { M } = k;
    if (t === 3) {
      k.box(-44, 2, 18, 11, 1, M.dark);
      k.ellO(-35, -4, 5, 2, M.yellow[2]).px(-35, -4, M.yellow[3]);
      k.box(-39, -20, 9, 4, 2, M.metal);
      k.hl(-42, -35, -27, M.metal[3]).hl(-34, -27, -27, M.metal[3]);
      k.beacon(-35, -24, 0xff4d4d);
    }
    k.box(-18, 0, 36, 13, 8, M.concrete, { seam: 9 });
    k.glowRect(-12, -6, 24, 1, 0xff5050);
    k.door(-2, -5, 5, 5);
    k.beacon(-16, -15, 0xff4d4d).beacon(16, -15, 0xff4d4d);
    k.box(-24, 5, 6, 3, 3, M.yellow).box(18, 5, 6, 3, 3, M.yellow);
    if (t >= 2) { k.dish(7, -12, 5); k.box(-12, -13, 4, 3, 3, M.metal).lamp(-10, -17, 0xffffff, 28, 0.45); }
  }),
  B('water_cycle', '水循環站', 4, 'parts', (k, t) => {
    const { M } = k;
    if (t === 3) k.tower(-26, -6, 9, 6, 7, 24, M.concrete);
    if (t >= 2) k.cyl(26, -4, 5, 10, M.water, { glass: true });
    k.tower(-4, 0, 11, 7, 8, 22, M.concrete);
    k.cyl(14, 2, 6, 11, M.water, { glass: true });
    k.pipe([5, -4, 9, -4]);
    if (t >= 2) k.pipe([19, -6, 22, -8]);
    k.glow(14, -6, 16, 0x5fd8ff, 0.3);
  }),
  // 醫療艙：白色加壓模組＋玻璃治療艙，青綠色十字燈（太空站風格，不用紅十字帳篷）
  B('med_bay', '醫療艙', 4, 'parts', (k, t) => {
    const { M } = k;
    const MED = 0x5fffc8;
    if (t === 3) {
      k.box(22, 4, 14, 9, 6, M.hull, { band: 2 }).win(25, -4, 3, 3).win(30, -4, 3, 3);
      k.box(24, -8, 9, 3, 4, M.metal);
      k.beacon(28, -14, MED);
    }
    if (t >= 2) { k.cyl(-25, 3, 5, 12, M.water, { glass: true }); k.glow(-25, -3, 14, MED, 0.35); k.pipe([-20, -2, -16, -2]); }
    k.box(-16, 1, 32, 12, 8, M.hull, { band: 2 });
    k.win(-12, -6, 3, 3).win(9, -6, 3, 3);
    k.door(-2, -4, 5, 5);
    k.dome(0, -12, 9, 7, M.glass, { glass: true });
    k.glowRect(-1, -19, 2, 6, MED).glowRect(-3, -17, 6, 2, MED);
    k.glow(0, -16, 26, MED, 0.45, true);
    k.beacon(-14, -12, MED).beacon(14, -12, MED);
  }),
  B('colony_core', '殖民地核心', 4, 'tools', (k, t) => {
    const { M, P } = k;
    if (t >= 2) {
      k.box(-38, -4, 15, 8, 9, M.hull, { band: 2 }).win(-35, -10, 3, 3).win(-30, -10, 3, 3);
      k.box(23, -4, 15, 8, 9, M.hull, { band: 2 }).win(26, -10, 3, 3).win(31, -10, 3, 3);
    }
    k.box(-20, 2, 40, 18, 4, M.metal, { seam: 10 });
    k.vl(-16, -32, -19, M.metal[1]).vl(16, -32, -19, M.metal[1]);
    k.beacon(-16, -33, k.acc[3]).beacon(16, -33, k.acc[3]);
    k.dome(0, -6, 13, 12, M.glass, { glass: true });
    k.blob(0, -13, 4, 4, ramp(0xffb040));
    k.glow(0, -13, 64, 0xffa040, 0.55, true).glow(0, -13, 20, 0xffe0a0, 0.7, true);
    if (t >= 2) k.ellO(0, -13, 18, 5, M.trim[3], 150);
    k.vl(-18, -18, -3, M.metal[1]).vl(18, -18, -3, M.metal[1]);
    k.beacon(-18, -19, k.acc[3]).beacon(18, -19, k.acc[3]);
    if (t === 3) {
      k.vl(0, -52, -24, M.metal[1]).vl(1, -52, -24, M.metal[3]);
      k.ellO(0, -36, 7, 2, M.trim[3], 150).ellO(0, -45, 5, 2, M.trim[3], 150);
      for (let yy = -72; yy < -53; yy++) k.px(0, yy, 0xffe0a0, Math.min(150, Math.round(30 + (yy + 72) * 7)));
      k.glow(0, -58, 26, P.light, 0.45).beacon(0, -53, M.trim[4]);
    }
  }, true),

  // ── 階段 5 殖民地 ──
  B('admin', '行政中心', 5, 'credit', (k, t) => {
    const { M } = k, H = [0, 26, 34, 42][t];
    k.box(-22, -2, 12, 8, 10, M.hull, { band: 2 }).win(-20, -8, 3, 2).win(-15, -8, 3, 2);
    k.box(10, -2, 12, 8, 10, M.hull, { band: 2 }).win(12, -8, 3, 2).win(17, -8, 3, 2);
    k.box(-9, 1, 18, 10, H, M.hull, { band: 3 });
    for (let yy = 1 - H + 5; yy < -5; yy += 5) for (let c = 0; c < 3; c++) k.win(-6 + c * 5, yy, 3, 2);
    k.door(-2, -4, 5, 5);
    if (t === 3) {
      k.box(-8, 1 - H, 16, 10, 1, M.dark);
      k.vl(-3, -H - 8, -H - 4, M.yellow[3]).vl(3, -H - 8, -H - 4, M.yellow[3]).hl(-3, 3, -H - 6, M.yellow[3]);
      k.lamp(-7, -H - 1, 0x8fe8ff, 6, 0.5).lamp(7, -H - 1, 0x8fe8ff, 6, 0.5).lamp(-7, -H - 10, 0x8fe8ff, 6, 0.5).lamp(7, -H - 10, 0x8fe8ff, 6, 0.5);
    } else k.mast(5, -H - 3, 9, M.trim[3]);
  }),
  B('trade_post', '交易站', 5, 'credit', (k, t) => {
    const { M } = k;
    if (t >= 2) stall(k, -40, -6, 0x6fd0a0);
    if (t === 3) {
      k.box(12, -12, 24, 12, 1, M.dark);
      k.ellO(24, -18, 6, 3, M.yellow[3]);
      k.blob(24, -22, 8, 4, M.hull);
      k.poly([16, -22, 12, -18, 18, -20], M.trim[2]).poly([32, -22, 36, -18, 30, -20], M.trim[2]);
      k.win(26, -25, 3, 2, 0x9ae0ff).beacon(13, -14, k.acc[3]);
    }
    stall(k, -26, 1, 0xe05a5a);
    stall(k, -8, 2, 0x5ab0e0);
    k.vl(14, -20, 1, M.metal[1]);
    k.rect(9, -28, 12, 8, 0xffd54a, 120);
    k.hl(11, 15, -26, 0xffffff, 170).hl(11, 18, -24, 0xffffff, 170).hl(11, 16, -22, 0xffffff, 170);
    k.glow(15, -24, 24, 0xffd54a, 0.4);
    if (t >= 2) k.crate(24, 4, 6).crate(25, -1, 5);
  }),
  B('spaceport', '太空港', 5, 'parts', (k, t) => {
    const { M } = k;
    k.box(-28, 4, 56, 24, 2, M.concrete, { seam: 14 });
    k.ellO(0, -10, 14, 6, M.yellow[3]).ellO(0, -10, 13, 5, M.yellow[2]);
    for (let x = -26; x <= 26; x += 8) k.lamp(x, 1, 0x8fd0ff, 6, 0.5);
    if (t >= 2) { k.lattice(18, -12, 4, 40); k.hl(4, 21, -44, M.metal[2]).hl(4, 21, -43, M.metal[1]); k.beacon(20, -53); }
    if (t < 3) {
      k.poly([-5, -9, -9, -5, -5, -5], M.trim[2]).poly([5, -9, 9, -5, 5, -5], M.trim[2]);
      k.blob(0, -17, 5, 10, M.hull);
      k.win(-1, -22, 3, 2, 0x9ae0ff);
      k.glowRect(-2, -7, 5, 1, 0xffb050);
    } else {
      k.poly([-5, -18, -11, -6, -5, -8], M.trim[2]).poly([5, -18, 11, -6, 5, -8], M.trim[1]);
      k.cyl(0, -6, 5, 34, M.hull);
      k.poly([-5, -43, 0, -58, 5, -43], M.hull[3]).poly([0, -58, 5, -43, 0, -43], M.hull[1]);
      k.hl(-5, 5, -20, M.trim[2]).hl(-5, 5, -34, M.trim[2]);
      k.porthole(0, -38, 1);
      k.glowRect(-3, -7, 7, 2, 0xffb050).glow(0, -4, 30, 0xffa050, 0.5, true);
      k.ellO(0, -10, 24, 9, M.trim[3], 150);
    }
  }),
  B('turret', '防禦砲塔', 5, 'weapon', (k, t) => {
    const { M } = k;
    if (t === 3) { k.box(-30, -2, 9, 6, 6, M.concrete).beacon(-26, -12); k.box(21, -2, 9, 6, 6, M.concrete).beacon(25, -12); }
    k.box(-13, 1, 26, 13, 6, M.concrete, { seam: 6 });
    k.dome(0, -8, 9, 8, M.metal);
    const bar = (dy, len, th) => {
      for (let i = 0; i < th; i++) k.line(5, -15 + dy + i, 5 + len, -21 + dy + i, i === 0 ? M.dark[3] : M.dark[1]);
      k.lamp(5 + len, -21 + dy, 0xff6a6a, 6, 0.5);
    };
    if (t === 1) bar(0, 12, 2);
    if (t === 2) { bar(-2, 13, 2); bar(2, 13, 2); }
    if (t === 3) {
      bar(0, 18, 3);
      for (let a = 0; a <= 60; a += 2) { const ang = Math.PI + (a / 60) * Math.PI; k.px(Math.round(Math.cos(ang) * 26), -6 + Math.round(Math.sin(ang) * 20), 0x8fe8ff, 130); }
      k.glow(0, -14, 44, 0x8fe8ff, 0.16);
    }
    k.px(-4, -15, 0xff4d4d).glow(-4, -15, 8, 0xff4d4d, 0.5);
  }),
  B('xeno_lab', '異星研究院', 5, 'crystal', (k, t) => {
    const { M } = k, C = 0xb970ff;
    k.box(-24, 0, 22, 10, 12, M.hull, { band: 2 });
    for (let i = 0; i < 3; i++) k.win(-21 + i * 6, -9, 4, 3, 0xe0c4ff);
    if (t >= 2) {
      k.box(-22, -12, 16, 6, 8, M.hull, { band: 1 }).win(-19, -18, 10, 2, 0xe0c4ff);
      k.mast(-19, -22, 8, k.acc[3]);
      k.hl(-2, 1, -8, C).glow(0, -8, 8, C, 0.4);
    }
    k.cyl(10, 2, 10, 2, M.metal);
    k.dome(10, 0, 10, 9, M.glass, { glass: true });
    k.crystal(10, -3, 9, C);
    if (t === 3) {
      for (let yy = -24; yy < -14; yy += 2) k.px(10, yy, 0xe0b8ff, 120);
      k.crystal(10, -26, 12, C);
      k.ellO(10, -32, 9, 3, 0xe0b8ff, 150).ellO(10, -32, 13, 4, 0xe0b8ff, 110);
      k.glow(10, -30, 30, C, 0.35);
    }
  }),
  B('star_dome', '星城穹頂', 5, 'crystal', (k, t) => {
    const { M, P } = k, R = [0, 22, 26, 30][t], Hh = [0, 18, 21, 24][t];
    k.cyl(0, 2, R, 2, M.metal);
    for (let i = -2; i <= 2; i++) {
      const h = 8 + (((i + 2) * 5) % 9), y = -3 - Math.abs(i);
      k.box(i * 8 - 3, y, 6, 4, h, M.hull);
      k.win(i * 8 - 2, y - h + 2, 2, 2);
    }
    k.blob(-13, -6, 3, 3, ramp(0x8a4ac0)).blob(12, -6, 3, 3, ramp(0x8a4ac0));
    k.dome(0, 0, R, Hh, M.glass, { glass: true, a: 170 });
    const fr = Math.max(1, Math.round(R * 0.45)), cy = -fr;
    for (const off of [-0.55, 0, 0.55]) for (let dy = -Hh; dy <= 0; dy++) {
      k.px(Math.round(off * R * Math.sqrt(Math.max(0, 1 - (dy / (Hh + 0.5)) ** 2))), cy + dy, M.glass[4], 90);
    }
    k.glow(0, -10, R * 2, P.window, 0.3);
    if (t === 3) {
      const top = cy - Hh;
      k.vl(0, top - 16, top, M.metal[3]).beacon(0, top - 17, M.trim[3]);
      k.ellO(0, cy, R + 6, Math.round(R * 0.5) + 2, M.trim[3], 140);
    }
  }, true),

  // ── 階段 6 星城 ──
  B('governor', '總督府', 6, 'credit', (k, t) => {
    const { M } = k, G = M.gold, H = [0, 18, 24, 30][t];
    if (t === 3) {
      k.box(-44, -2, 16, 8, 10, M.hull, { band: 2, bandM: G }).win(-41, -9, 3, 3).win(-35, -9, 3, 3);
      k.box(28, -2, 16, 8, 10, M.hull, { band: 2, bandM: G }).win(31, -9, 3, 3).win(37, -9, 3, 3);
    }
    if (t >= 2) { k.cyl(-22, -3, 7, 3, M.hull); k.dome(-22, -6, 7, 7, G); k.cyl(22, -3, 7, 3, M.hull); k.dome(22, -6, 7, 7, G); }
    k.box(-20, 4, 40, 12, 2, M.stone);
    k.box(-18, 2, 36, 12, 12, M.hull, { band: 2, bandM: G });
    for (let x = -15; x <= 15; x += 5) k.vl(x, -8, 0, M.hull[4]).vl(x + 1, -8, 0, M.hull[1]);
    k.door(-2, -5, 5, 6).hl(-2, 2, -6, G[3]);
    k.box(-7, -13, 14, 8, H, M.hull, { band: 2, bandM: G });
    for (let yy = -13 - H + 4; yy < -16; yy += 5) k.win(-4, yy, 3, 3).win(2, yy, 3, 3);
    const y0 = -13 - H;
    k.poly([-8, y0, -8, y0 - 5, -5, y0 - 2, -2, y0 - 7, 0, y0 - 3, 2, y0 - 7, 5, y0 - 2, 8, y0 - 5, 8, y0], G[3]);
    k.lamp(0, y0 - 4, 0xffe08a, 16, 0.45);
    if (t === 3) {
      for (let yy = y0 - 40; yy < y0 - 8; yy++) k.px(0, yy, 0xffe08a, Math.min(150, Math.round((yy - y0 + 40) * 5)));
      k.glow(0, y0 - 20, 28, 0xffd24a, 0.4);
      k.rect(-13, -9, 2, 5, ramp(0x8a3aff)[2]).rect(11, -9, 2, 5, ramp(0x8a3aff)[2]);
    }
  }, true),
  B('sky_residence', '天幕住宅', 6, 'crystal', (k, t) => {
    const { M, P } = k;
    if (t === 3) { k.box(-40, 2, 12, 8, 22, M.hull, { band: 2, bandM: M.gold }); for (let yy = -17; yy < -2; yy += 5) k.win(-38, yy, 3, 2).win(-33, yy, 3, 2); }
    let y = 0, w = 40, x0 = -20;
    for (let i = 0; i < t + 1; i++) {
      k.box(x0, y, w, 8, 8, M.hull, { band: 1, bandM: M.gold });
      for (let wx = x0 + 3; wx < x0 + w - 4; wx += 5) k.win(wx, y - 6, 3, 3);
      k.hl(x0 + 1, x0 + w - 2, y - 10, M.green[2]);
      for (let gx = x0 + 1; gx < x0 + w - 1; gx += 2) k.px(gx, y - 9, P.flora[(gx >> 1) % 3 === 0 ? 1 : 0]);
      y -= 11; x0 += 4; w -= 8;
    }
    const topY = y + 11 - 16;
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * 1.08 + (i / 40) * Math.PI * 0.84, x = Math.round(Math.cos(a) * 24), yy = topY + 8 + Math.round(Math.sin(a) * 14);
      k.px(x, yy, M.glass[3], 170).px(x, yy + 1, M.glass[1], 130);
    }
    k.beacon(0, topY - 7, M.gold[3]).glow(0, topY - 2, 30, k.P.light, 0.25);
  }),
  B('bioeng', '生物工程室', 6, 'nutrient', (k, t) => {
    const { M } = k, H = [0, 16, 22, 30][t];
    if (t >= 2) {
      k.cyl(-14, -8, 9, 2, M.metal);
      k.dome(-14, -10, 9, 8, M.glass, { glass: true });
      for (let i = 0; i < 5; i++) k.px(-19 + i * 2, -14 - (i % 2), 0x6fe38a);
    }
    k.box(-26, 0, 24, 10, 11, M.hull, { band: 2 });
    for (let i = 0; i < 3; i++) k.win(-23 + i * 6, -8, 4, 3, 0x9af0b0);
    k.cyl(10, 2, 7, 2, M.metal);
    k.helix(10, -3, H, 0x6fe38a, 0x7ad8ff);
    k.glow(10, -3 - H / 2, H + 12, 0x6fe38a, 0.35);
    if (t === 3) { k.ellO(10, -4 - H, 6, 2, 0x9af0b0, 150); k.box(22, 2, 12, 7, 8, M.hull, { band: 2 }).win(25, -4, 5, 2, 0x9af0b0); }
  }),
  B('orbital_beacon', '軌道信標', 6, 'credit', (k, t) => {
    const { M } = k, G = M.gold, H = [0, 34, 46, 58][t];
    if (t >= 2) k.dish(-18, 2, 5).dish(18, 2, 5);
    k.box(-12, 2, 24, 12, 4, M.metal, { seam: 6 });
    for (let i = 0; i < H; i++) {
      const yy = -8 - i, w = Math.max(1, Math.round(4 - (i / H) * 3));
      k.hl(-w, -1, yy, M.metal[3]).hl(0, w, yy, M.metal[1]);
      if (i % 6 === 3) k.hl(-w, w, yy, M.metal[0]);
    }
    const ty = -8 - H;
    k.blob(0, ty - 3, 3, 3, G).glow(0, ty - 3, 24, 0xffd24a, 0.6);
    for (let yy = ty - 32; yy < ty - 6; yy++) k.px(0, yy, 0xffe08a, Math.min(150, Math.round((yy - ty + 32) * 6)));
    k.ellO(0, ty + 4, 5, 2, G[3], 150);
    if (t >= 2) k.ellO(0, -8 - Math.round(H * 0.5), 7, 2, G[3], 150);
    if (t === 3) { k.ellO(0, ty - 14, 9, 3, 0xffe08a, 120); k.beacon(-10, -6, G[4]).beacon(10, -6, G[4]); }
  }),
];

export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
export const stageBuildings = (stage) => BUILDINGS.filter((b) => b.stage === stage);

const buildCache = new Map();
/** 建築像素圖。回傳 { canvas, ax, ay, glows, beacons, smokes }（ax/ay＝原點在 canvas 中的位置）。 */
export function renderBuilding(id, level = 1) {
  const tier = tierOf(level), key = id + ':' + tier;
  if (PAINTED.has(id)) return paintedArt(id);
  if (buildCache.has(key)) return buildCache.get(key);
  const def = BUILDING_MAP[id];
  if (!def) throw new Error(`未知建築：${id}`);
  const k = makeKit(def.stage, RES[def.res].color, tier);
  def.draw(k, tier);
  const art = k.finish();
  art.w = art.canvas.width; art.h = art.canvas.height; art.res = 1;
  buildCache.set(key, art);
  return art;
}

// ── 手繪建築 ──
// 目前只有拼裝期（第 1～2 章）的圖，各等級共用；之後加上藍圖期、殖民地期時依等級換圖
const PAINTED = new Map();
// 光暈位置用圖上的比例（0～1）：[x, y, 半徑, 顏色, 強度]
const PAINTED_FX = {
  escape_pod: [[0.41, 0.2, 16, 0xffb040, 0.55]],
  o2_scrubber: [[0.6, 0.4, 26, 0x5ab0ff, 0.3]],
  electrolyzer: [[0.66, 0.55, 30, 0x5ab0ff, 0.35]],
  algae_tank: [[0.5, 0.55, 42, 0x6fe38a, 0.4]],
  bio_harvester: [[0.42, 0.55, 40, 0x6fe38a, 0.4], [0.8, 0.5, 24, 0xb8ff6a, 0.35]],
  emergency_camp: [[0.52, 0.8, 22, 0xffb040, 0.4], [0.8, 0.8, 18, 0xff9a3a, 0.4], [0.2, 0.62, 14, 0xffc060, 0.35], [0.83, 0.62, 14, 0xffc060, 0.35]],
  hab_pod: [[0.33, 0.58, 16, 0xffc060, 0.4], [0.75, 0.58, 16, 0xffc060, 0.4]],
  cargo: [[0.59, 0.42, 12, 0xffb040, 0.35]],
  lounge: [[0.28, 0.6, 26, 0xffc060, 0.4], [0.74, 0.6, 26, 0xffc060, 0.4]],
  rock_cutter: [[0.55, 0.45, 18, 0xffa040, 0.35], [0.8, 0.5, 14, 0xffa040, 0.3]],
  assembly: [[0.5, 0.55, 26, 0xffb040, 0.45], [0.92, 0.6, 12, 0xff9a3a, 0.35]],
  central_hub: [[0.49, 0.45, 26, 0x6ac8ff, 0.4], [0.49, 0.72, 16, 0xffb040, 0.4]],
  metal_mine: [[0.7, 0.72, 16, 0xffa040, 0.4], [0.12, 0.5, 10, 0xffb040, 0.35], [0.4, 0.5, 10, 0xffb040, 0.35]],
  expedition: [[0.5, 0.6, 26, 0xffb040, 0.45], [0.3, 0.62, 12, 0x5ae0f0, 0.4]],
  rail_line: [[0.68, 0.12, 12, 0xffb040, 0.45], [0.45, 0.58, 18, 0xffb040, 0.3]],
  forge: [[0.47, 0.6, 28, 0xff9030, 0.55], [0.47, 0.82, 16, 0xffb040, 0.45]],
  outpost: [[0.5, 0.36, 22, 0xffb040, 0.4], [0.5, 0.7, 16, 0xffb040, 0.45], [0.08, 0.38, 12, 0xffc060, 0.4], [0.93, 0.38, 12, 0xffc060, 0.4]],
  databank: [[0.5, 0.45, 26, 0x5ae0f0, 0.45], [0.5, 0.7, 14, 0xffb040, 0.4]],
  colony_core: [[0.5, 0.3, 30, 0xb070ff, 0.55], [0.5, 0.55, 26, 0x5ae0f0, 0.35], [0.5, 0.82, 14, 0x5ae0f0, 0.4]],
  crystal_synth: [[0.5, 0.3, 30, 0xb070ff, 0.55], [0.5, 0.72, 14, 0xb070ff, 0.4]],
  security: [[0.5, 0.62, 22, 0x5ae0f0, 0.4]],
  med_bay: [[0.62, 0.55, 24, 0x5ae0f0, 0.4], [0.93, 0.5, 10, 0xb070ff, 0.35]],
  water_cycle: [[0.3, 0.45, 18, 0x5ab0ff, 0.4], [0.68, 0.45, 18, 0x5ab0ff, 0.4]],
  memorial: [[0.5, 0.65, 22, 0xffb040, 0.5]],
};
// 會冒白色蒸氣的出氣口（圖上的比例位置）：原圖的蒸氣去背時會被削掉，改由遊戲畫
const PAINTED_STEAM = {
  water_cycle: [[0.6, 0.12]],
};
async function loadPainted() {
  const { res, buildings } = paintedMeta;
  await Promise.all(Object.entries(buildings).map(async ([id, m]) => {
    const url = PAINTED_URLS[`../assets/buildings/${id}.webp`];
    if (!url) return;
    const img = new Image(); img.src = url; await img.decode();
    const cv = makeCanvas(img.width, img.height); cv.getContext('2d').drawImage(img, 0, 0);
    const emissive = emissiveCanvas(cv), halo = haloCanvas(emissive, HALO_PAD * res, 3 * res);
    const glows = (PAINTED_FX[id] ?? []).map(([fx, fy, r, c, a]) => ({ x: fx * m.w - m.ax, y: fy * m.h - m.ay, r, c, a }));
    // 蒸氣出口：手寫的 PAINTED_STEAM，或處理圖時從畫死的白煙位置算出來的（meta.steam）
    const smokes = [...(PAINTED_STEAM[id] ?? []), ...(m.steam ? [m.steam] : [])].map(([fx, fy]) => ({ x: fx * m.w - m.ax, y: fy * m.h - m.ay, c: 0xeef2f6 }));
    PAINTED.set(id, { canvas: cv, ax: m.ax, ay: m.ay, w: m.w, h: m.h, res, glows, beacons: [], smokes, emissive, halo });
  }));
}
const paintedArt = (id) => PAINTED.get(id);

// ───────────────────────────── 日夜：夜晚建築亮燈 ─────────────────────────────
// 不用另外畫夜間圖：從手繪建築圖挑出「本來就是燈」的像素（暖黃窗光、青色與藍色燈條、紫色晶體），
// 夜晚用加亮混合疊上去，再加一層模糊的光暈。NIGHT（0 白天～1 深夜）由 GameScene 依時間設定。
let NIGHT = 0;
export const setNight = (n) => { NIGHT = n; };
const HALO_PAD = 8;   // 光暈外擴的空間（地圖像素）
function emissiveCanvas(cv) {
  const w = cv.width, h = cv.height, src = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h), g = out.getContext('2d'), im = g.createImageData(w, h), d = im.data;
  for (let i = 0; i < src.length; i += 4) {
    if (src[i + 3] < 128) continue;
    const r = src[i], gg = src[i + 1], b = src[i + 2];
    // 暖黃窗光：比帆布、屋頂亮而且偏黃（帆布是 224,160,96 一類，綠色通道到不了 185）
    const warm = r >= 235 && gg >= 185 && b <= 150 && r - b >= 70;
    const cyan = gg >= 170 && b >= 170 && r <= 170 && b - r >= 50;                    // 青色燈條
    const blue = b >= 200 && b - r >= 90 && gg >= 90;                                 // 藍色燈柱
    const violet = r >= 140 && b >= 180 && gg <= 150 && b - gg >= 60;                 // 紫色晶體
    if (!(warm || cyan || blue || violet)) continue;
    d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return out;
}
function haloCanvas(em, pad, blur) {
  const out = makeCanvas(em.width + pad * 2, em.height + pad * 2), g = out.getContext('2d');
  g.filter = `blur(${blur}px)`;
  g.drawImage(em, pad, pad); g.drawImage(em, pad, pad); g.drawImage(em, pad, pad);
  return out;
}
/** 手繪建築載入後會換掉程式畫的圖：介面縮圖的快取要跟著換 */
export const paintedCount = () => PAINTED.size;

// ───────────────────────────── 道具（樹、岩石、燈…） ─────────────────────────────

export const PROP_KINDS = ['tree', 'rock', 'bush', 'crate', 'barrel', 'lamp', 'debris', 'snow', 'pipe', 'statue'];

export function renderProp(kind, stage, seed = 1) {
  const k = makeKit(stage, 0xffffff, 1, 80, 80, 40, 72);
  const { M, P } = k, R = rng(seed), T = ramp(P.tree), Tr = ramp(P.trunk), rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
  switch (kind) {
    case 'tree': {
      const s = P.treeKind;
      if (s === 'bulb') {
        k.rect(-1, -7, 3, 7, Tr[2]).vl(-1, -7, -1, Tr[3]).vl(1, -7, -1, Tr[1]);
        const r = rnd(7, 9);
        k.blob(-5, -12, 5, 4, T).blob(5, -12, 5, 4, T).blob(0, -15 - (r - 7), r, r - 2, T);
        for (let i = 0; i < 5; i++) k.px(-4 + rnd(-2, 3), -17 + rnd(-3, 2), T[4]);
      } else if (s === 'pine') {
        k.rect(-1, -4, 2, 4, Tr[2]);
        const tiers = rnd(3, 4);
        for (let i = 0; i < tiers; i++) {
          const yb = -3 - i * 5, w = 8 - i * 2, h = 8;
          k.poly([-w, yb, 0, yb - h, 0, yb], T[3]).poly([0, yb - h, w, yb, 0, yb], T[1]);
          k.hl(-w + 1, w - 1, yb - 1, T[0]);
          if (stage === 2) { k.line(0, yb - h, -w + 2, yb - 2, 0xf2f6fa); k.line(1, yb - h + 1, w - 3, yb - 3, 0xd8e2ee); }
        }
      } else if (s === 'coral') {
        k.vl(0, -8, -1, Tr[2]).vl(1, -8, -1, Tr[1]);
        k.line(0, -6, -5, -12, Tr[2]).line(1, -8, 5, -14, Tr[2]).line(-5, -12, -7, -16, Tr[2]).line(0, -9, -1, -15, Tr[2]);
        k.blob(-7, -17, 2, 2, T).blob(5, -15, 3, 2, T).blob(-1, -16, 2, 2, T).blob(-5, -12, 2, 1, T);
        k.px(-7, -19, P.flora[1]).px(5, -17, P.flora[1]);
      } else if (s === 'mushroom') {
        const Sm = ramp(P.trunk), h = rnd(8, 12), r = rnd(7, 10);
        k.rect(-2, -h, 4, h, Sm[2]).vl(-2, -h, -1, Sm[3]).vl(1, -h, -1, Sm[1]);
        k.blob(0, -h - 3, r, 5, T);
        k.hl(-r + 2, r - 2, -h + 1, T[0]);
        for (let i = 0; i < 4; i++) k.lamp(rnd(-r + 3, r - 3), -h - rnd(3, 6), P.flora[0], 8, 0.4);
      } else if (s === 'blossom') {
        k.box(-5, 1, 10, 4, 3, M.gold);
        k.vl(0, -10, -3, Tr[2]);
        k.blob(0, -15, 7, 6, T).blob(-5, -12, 4, 3, T).blob(5, -12, 4, 3, T);
        for (let i = 0; i < 6; i++) k.px(rnd(-6, 6), -15 + rnd(-4, 4), P.flora[1]);
      }
      break;
    }
    case 'rock': {
      if (stage === 5) {
        const c = R() < 0.5 ? 0xb970ff : 0x7af0e0;
        k.crystal(-3, 0, rnd(5, 8), c).crystal(2, 1, rnd(8, 13), c).crystal(5, 1, rnd(4, 6), c);
        break;
      }
      const Sr = ramp(P.rock);
      k.blob(0, -3, rnd(4, 7), rnd(3, 4), Sr);
      if (R() < 0.6) k.blob(rnd(4, 7), -2, rnd(2, 3), 2, Sr);
      if (stage === 2) k.hl(-3, 2, -6, 0xf2f6fa).hl(-2, 1, -7, 0xf2f6fa);
      if (stage === 3) k.px(-2, -4, M.metal[4]).px(1, -3, 0xe0b060).glow(0, -3, 6, 0xcfe8ff, 0.2);
      break;
    }
    case 'bush': {
      const Bm = ramp(stage === 2 ? 0x6aa8b8 : P.tree);
      k.blob(-2, -3, 4, 3, Bm).blob(3, -3, 3, 3, Bm);
      for (let i = 0; i < 3; i++) k.px(rnd(-4, 4), rnd(-5, -2), P.flora[i % 3]);
      break;
    }
    case 'crate': k.crate(-3, 0, rnd(5, 7)); if (R() < 0.4) k.crate(3, 1, 5); break;
    case 'barrel': k.barrel(0, 0, 3, R() < 0.5 ? M.rust : M.water); break;
    case 'lamp': k.post(0, 0, 12); break;
    case 'debris': {
      k.poly([-7, 0, -5, -4, 3, -3, 6, 0], M.metal[2]).line(-5, -4, 3, -3, M.metal[4]);
      k.poly([4, 1, 7, -5, 9, -4, 8, 1], M.rust[2]);
      k.px(-2, -2, M.rust[1]).px(0, -1, M.rust[1]);
      break;
    }
    case 'snow': k.blob(0, -2, rnd(5, 8), 3, ramp(0xe0eaf4)); break;
    case 'pipe': k.pipe([-10, -2, 10, -2]); k.box(-2, 0, 4, 2, 4, M.metal).lamp(0, -4, 0x6fe0ff, 6, 0.4); break;
    case 'site': {
      // 工地：兩根樁、黃黑相間的圍欄、角錐與一箱材料
      k.vl(-9, -7, -1, M.crate[1]).vl(9, -7, -1, M.crate[1]);
      for (let x = -9; x <= 9; x++) { k.px(x, -6, (x >> 1) % 2 ? M.yellow[3] : M.dark[0]); k.px(x, -5, (x >> 1) % 2 ? M.yellow[2] : M.dark[1]); }
      k.poly([-14, 0, -12, -5, -10, 0], 0xf07a3a).hl(-13, -11, -2, 0xffffff);
      k.crate(4, 2, 5);
      break;
    }
    case 'statue': {
      k.box(-4, 0, 8, 4, 5, M.stone);
      k.rect(-1, -16, 3, 8, M.gold[2]).vl(-1, -16, -9, M.gold[3]);
      k.blob(0, -18, 2, 2, M.gold).line(2, -14, 5, -18, M.gold[2]);
      k.glow(0, -14, 16, 0xffd24a, 0.25);
      break;
    }
  }
  return k.finish({ shadow: kind !== 'snow' });
}

// ───────────────────────────── 地圖配置與地表 ─────────────────────────────

/** 規劃某階段的地圖：核心建築在中央，其他建築環狀排列，道路連回中央，周圍散佈道具。 */
export function planMap(stage, MW = 600, MH = 360, seed = stage * 131 + 7, layout = null) {
  const R = rng(seed);
  let center, sites;
  if (layout) {
    // 固定配置：{ center:{x,y}, sites:[{ id, x, y, r, hub }] }（遊戲本體用，建築位置跨階段不變）
    center = layout.center;
    sites = layout.sites.map((s) => ({ r: 24, ...s }));
  } else {
    const defs = stageBuildings(stage);
    const hub = defs.find((d) => d.hub) || defs[0];
    const others = defs.filter((d) => d !== hub);
    center = { x: MW >> 1, y: Math.round(MH * 0.52) };
    sites = [{ id: hub.id, x: center.x, y: center.y + 18, r: 34, hub: true }];
    const n = others.length, rx = Math.min(MW * 0.3, 172), ry = Math.min(MH * 0.27, 96);
    others.forEach((d, i) => {
      const a = -Math.PI / 2 + Math.PI / n + (i * 2 * Math.PI) / n;
      sites.push({ id: d.id, x: Math.round(center.x + Math.cos(a) * rx), y: Math.round(center.y + 18 + Math.sin(a) * ry), r: 24 });
    });
  }
  // 道路：layout 有給折線就照著畫（繞開建築），否則從中心直線連到各建築
  // 每段路帶一個鋪面等級（layout.tiers：0 沙路、1 金屬踏板、2 石磚），共用的路段取最高的等級
  const tierOfSite = (s) => layout?.tiers?.[s.id] ?? 0;
  const segs = layout?.routes
    ? sites.filter((s) => !s.hub && layout.routes[s.id]).flatMap((s) => layout.routes[s.id].slice(1).map((p, i) => { const a = layout.routes[s.id][i]; return [a.x, a.y, p.x, p.y, tierOfSite(s)]; }))
    : sites.filter((s) => !s.hub).map((s) => [center.x, center.y + 22, s.x, s.y + 4, 0]);
  { const best = new Map(); for (const g of segs) { const k = g.slice(0, 4).join(','); if (!best.has(k) || best.get(k)[4] < g[4]) best.set(k, g); } segs.splice(0, segs.length, ...best.values()); }
  const plaza = layout?.plaza ?? true;
  const wob = noise2(seed + 3);
  const field = new Float32Array(MW * MH), tier = new Uint8Array(MW * MH);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const w = (wob(x / 9, y / 9) - 0.5) * 3;
    let v = 1e9, tv = 0;
    const take = (d, t) => { if (d < v) { v = d; tv = t; } };
    for (const [x0, y0, x1, y1, t0] of segs) {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1;
      const t = clamp(((x - x0) * dx + (y - y0) * dy) / l2, 0, 1);
      const ex = x - (x0 + dx * t), ey = y - (y0 + dy * t);
      // 鋪過的路（石磚、金屬）寬度一致、邊緣筆直；沒鋪的維持原本自然的寬窄
      take(Math.sqrt(ex * ex + ey * ey) - (t0 ? 4.5 : 3.4 + w), t0);
    }
    if (plaza) {
      const px = (x - center.x) / 50, py = (y - center.y - 6) / 32;
      take((Math.sqrt(px * px + py * py) - 1) * 32 + w * 1.5, layout?.hubTier ?? 0);
    }
    for (const s of sites) {
      if (s.hub) continue;
      const qx = (x - s.x) / s.r, qy = (y - s.y + 8) / (s.r * 0.62);
      take((Math.sqrt(qx * qx + qy * qy) - 1) * s.r * 0.62 + w, tierOfSite(s));
    }
    field[y * MW + x] = v; tier[y * MW + x] = tv;
  }
  const clear = (x, y, m) => {
    if (x < 4 || y < 10 || x >= MW - 4 || y >= MH - 2) return false;
    if (field[(y | 0) * MW + (x | 0)] < m) return false;
    for (const s of sites) { const dx = (x - s.x) / (s.r + 14), dy = (y - s.y + 12) / ((s.r + 14) * 0.8); if (dx * dx + dy * dy < 1) return false; }
    return true;
  };
  const props = [];
  const place = (kind, x, y, m = 5) => { x = Math.round(x); y = Math.round(y); if (clear(x, y, m) && !props.some((p) => Math.abs(p.x - x) < 9 && Math.abs(p.y - y) < 5)) { props.push({ kind, x, y, seed: (R() * 1e6) | 0 }); return true; } return false; };
  // 有手繪底圖時，樹、灌木、岩石都在底圖裡，只在建築旁擺人造物
  const counts = TERRAIN.img ? [0, 0, 0] : { 1: [13, 12, 8], 2: [28, 10, 10], 3: [22, 12, 8], 4: [30, 8, 18], 5: [22, 14, 12], 6: [16, 5, 16] }[stage];
  for (let i = 0, got = 0; i < 900 && got < counts[0]; i++) {
    const x = R() * MW, y = R() * MH, ex = (x - center.x) / (MW * 0.46), ey = (y - center.y) / (MH * 0.46);
    if ((ex * ex + ey * ey > 0.62 || R() < 0.08) && place('tree', x, y, 7)) got++;
  }
  for (let i = 0, got = 0; i < 600 && got < counts[1]; i++) if (place('rock', R() * MW, R() * MH)) got++;
  for (let i = 0, got = 0; i < 600 && got < counts[2]; i++) if (place('bush', R() * MW, R() * MH)) got++;
  // 有手繪底圖時不擺任何小物件（路燈、木箱、油桶、碎石都是舊的像素圖，跟手繪建築不搭）
  if (TERRAIN.img) return { stage, MW, MH, center, sites, segs, field, tier, props, seed };
  const extras = { 1: ['debris', 'debris', 'crate', 'barrel'], 2: ['snow', 'snow', 'crate', 'barrel'], 3: ['pipe', 'crate', 'barrel', 'crate'], 4: ['crate', 'barrel', 'crate'], 5: ['crate', 'barrel'], 6: ['statue'] }[stage];
  // 每棟建築旁的雜物用自己的亂數（蓋新建築、地圖重畫時，舊建築旁的東西不會換位置）
  for (const s of sites) {
    const Rs = rng(seed * 7 + s.x * 131 + s.y * 17);
    for (let j = 0; j < 3; j++) {
      const kind = extras[(j + s.x) % extras.length];
      for (let tries = 0; tries < 12; tries++) if (place(kind, s.x + (Rs() - 0.5) * (s.r * 2.6), s.y + (Rs() - 0.3) * 18, 3)) break;
    }
  }
  for (const [x0, y0, x1, y1] of segs) {
    if (Math.hypot(x1 - x0, y1 - y0) < 50) continue;
    const t = 0.55, nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny);
    place('lamp', x0 + (x1 - x0) * t + (nx / l) * 9, y0 + (y1 - y0) * t + (ny / l) * 9, 2);
  }
  if (stage === 1) for (let i = 0, got = 0; i < 300 && got < 8; i++) if (place('debris', R() * MW, R() * MH)) got++;
  if (stage === 2) for (let i = 0, got = 0; i < 300 && got < 10; i++) if (place('snow', R() * MW, R() * MH)) got++;
  return { stage, MW, MH, center, sites, segs, field, tier, props, seed };
}

function paintGround(stage, W, H, field, seed, decals = true) {
  const P = STAGES[stage], G = P.ground, PA = P.path;
  const nA = noise2(seed + 1), nB = noise2(seed + 11), nC = noise2(seed + 23), R = rng(seed + 5);
  const cv = makeCanvas(W, H), ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = 255; };
  const fAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 99 : field[y * W + x]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = field[y * W + x], bz = bayer(x, y);
    let c;
    if (v < 0) {
      if (stage === 6 || stage === 3) {
        const row = Math.floor(y / 5), tx = x + (row % 2) * 4;
        c = y % 5 === 0 || tx % 8 === 0 ? PA[0] : PA[nC(Math.floor(tx / 8), row) > 0.6 ? 3 : 2];
        if (v > -1.5) c = stage === 6 ? PA[3] : PA[0];
      } else {
        const pn = nC(x / 6, y / 6) * 0.6 + nA(x / 20, y / 20) * 0.4 + (bz - 0.5) * 0.25;
        c = PA[pn < 0.36 ? 1 : pn < 0.64 ? 2 : 3];
        if (v > -1.3 && bz < 0.5) c = PA[0];
      }
    } else if (v < 1.3 && bz < 0.45) c = PA[0];
    else {
      const gn = fbm(nA, x / 48, y / 48) * 0.72 + nB(x / 10, y / 10) * 0.28 + (bz - 0.5) * 0.22;
      c = G[gn < 0.4 ? 1 : gn < 0.62 ? 2 : 3];
      if (stage === 6 && ((x + y) >> 4) % 2 && c === G[2]) c = mix(G[2], G[3], 0.35);
    }
    put(x, y, c);
  }
  // 草叢、暗塊、花、碎石
  const area = W * H;
  for (let i = 0; i < area / 70; i++) {
    const x = (R() * W) | 0, y = (R() * H) | 0;
    if (fAt(x, y) < 2) continue;
    if (R() < 0.55) { put(x, y, G[4]); put(x, y + 1, G[3]); put(x + 1, y + 1, G[0]); put(x - 1, y + 1, G[3]); }
    else { put(x, y, G[0]); put(x + 1, y, G[0]); put(x, y - 1, G[1]); }
  }
  const flowers = { 1: 0.3, 2: 0.15, 3: 0.3, 4: 1.3, 5: 0.9, 6: 0.8 }[stage];
  for (let i = 0; i < (area / 900) * flowers * 3; i++) {
    const x = (R() * W) | 0, y = (R() * H) | 0;
    if (fAt(x, y) < 2) continue;
    const c = P.flora[(R() * 3) | 0];
    put(x, y, c); if (R() < 0.6) { put(x + 2, y + 1, c); put(x + 1, y + 2, mix(c, 0xffffff, 0.4)); }
  }
  for (let i = 0; i < area / 500; i++) {
    const x = (R() * W) | 0, y = (R() * H) | 0;
    if (fAt(x, y) > -1.5 || stage === 6) continue;
    put(x, y, PA[3]); put(x, y + 1, PA[0]);
  }
  // 各階段地面特徵
  if (decals && stage === 1) for (let i = 0; i < 7; i++) {
    const cx = (R() * W) | 0, cy = (R() * H) | 0, r = 6 + ((R() * 8) | 0);
    if (fAt(cx, cy) < r * 2.4 || fAt(cx - r * 2, cy) < 2 || fAt(cx + r * 2, cy) < 2) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) {
      const q = (dx * dx) / (4 * r * r) + (dy * dy) / (r * r);
      if (q < 0.55) put(cx + dx, cy + dy, (dx + dy) % 2 ? G[1] : G[0]);
      else if (q < 1) put(cx + dx, cy + dy, dy < 0 ? G[0] : G[4]);
    }
  }
  if (decals && stage === 2) for (let i = 0; i < 26; i++) {
    let x = R() * W, y = R() * H;
    for (let s = 0; s < 14; s++) { if (fAt(x | 0, y | 0) > 2) put(x | 0, y | 0, G[1]); x += (R() - 0.3) * 3; y += (R() - 0.5) * 2; }
  }
  if (decals && stage === 3) for (let i = 0; i < 14; i++) {
    const x = (R() * W) | 0, y = (R() * H) | 0;
    if (fAt(x, y) < 12) continue;
    for (let yy = 0; yy < 7; yy++) for (let xx = 0; xx < 12; xx++) put(x + xx, y + yy, yy === 0 || xx === 0 || yy === 6 || xx === 11 ? PA[0] : PA[1]);
    put(x + 2, y + 2, PA[3]); put(x + 9, y + 2, PA[3]); put(x + 2, y + 4, PA[3]); put(x + 9, y + 4, PA[3]);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** 整張地圖的地表（道路、廣場、建築地基、草叢、花、地面特徵）。 */
export function renderGround(stage, plan) {
  return paintGround(stage, plan.MW, plan.MH, plan.field, plan.seed);
}

/** 純草地的小區塊（做展示條、縮圖背景用）。 */
export function renderGroundPatch(stage, W, H, seed = 3) {
  return paintGround(stage, W, H, new Float32Array(W * H).fill(20), seed, false);
}

// ───────────────────────────── 工人 ─────────────────────────────

/** 殖民者影格：[站立, 走路 A, 走路 B]，canvas 13×17，原點在 (6, 15)。 */
// ───────────────────────────── 手繪小人（sprite sheet） ─────────────────────────────
// 兩張 sprite sheet（scripts/process-sprites.cjs 產生）：每列一種「動作＋方向」，每列 4 格。
//   殖民者 16×16：idle 下/上/側（0–2）、walk（3–5）、carry 搬貨箱（6–8）、work 工作（9–11）
//   陸戰隊 22×22：idle（0–2）、walk（3–5）、shoot 射擊（6–8）、down 倒地（9）
// 側面圖面向右，往左走時水平翻轉。腳底在格子底部往上 2px。載入前用下面的程序化小人代替。
// res：sprite sheet 的解析度倍數（scripts/process-sprites.cjs 的 RES）。圖是 2 倍細節，畫的時候縮回一半，在地圖上的大小不變
const SHEETS = {
  colonist: { url: colonistSheetURL, cell: 32, rows: 12, res: 2 },
  marine: { url: marineSheetURL, cell: 44, rows: 10, res: 2 },
  // 赫利昂突擊隊（scripts/process-unit-sheet.py 產生，格式同陸戰隊）
  commando: { url: commandoSheetURL, cell: 44, rows: 11, res: 2 },
  // 微光獸（同上；沒有背面，「上」用正面代替）
  glimmer: { url: glimmerSheetURL, cell: 44, rows: 11, res: 2 },
};
/** 切好的影格（放在 Map：寫在物件字面值裡的 null 會被打包工具當成常數摺疊掉） */
const FRAMES = new Map();
/** 小人在地圖上的縮放（建築是 1:1 像素） */
export const CHAR_SCALE = 1;
const FACING = { down: 0, up: 1, side: 2 };
/** 載入小人的 sprite sheet 並切成影格（GameScene 開始前呼叫一次） */
export async function loadSprites() {
  await Promise.all(Object.entries(SHEETS).map(async ([key, sh]) => {
    const img = new Image(); img.src = sh.url; await img.decode();
    const base = pixelTexture(img);
    const frames = [];
    for (let r = 0; r < sh.rows; r++) {
      const row = [];
      for (let k = 0; k < 4; k++) row.push(new Texture({ source: base.source, frame: new Rectangle(k * sh.cell, r * sh.cell, sh.cell, sh.cell) }));
      frames.push(row);
    }
    FRAMES.set(key, frames);
    SHEET_SRC.set(key, base.source);
  }));
  setCharZoom(CHAR_ZOOM);
  const t = new Image(); t.src = terrainURL; await t.decode(); TERRAIN.img = t;
  await loadPainted();
}
const SHEET_SRC = new Map();
let CHAR_ZOOM = 3;
/** 畫面縮放改變時呼叫：小人縮放後剛好是整數倍時用最近鄰取樣（像素銳利），不是整數倍時改平滑取樣，避免像素寬窄不一、走路時閃爍 */
export function setCharZoom(z) {
  CHAR_ZOOM = z;
  for (const [key, src] of SHEET_SRC) {
    const k = (z * CHAR_SCALE) / SHEETS[key].res;
    src.scaleMode = Math.abs(k - Math.round(k)) < 1e-6 ? 'nearest' : 'linear';
  }
}
/** 手繪地形底圖（整顆星球同一種風貌，不隨章節換色；變化只在殖民地的道路與地基上） */
const TERRAIN = { img: null, tex: null };
/** 小人 Container 的共用部分：依移動方向自動轉向（上／下／側面），側面往左時翻轉 */
function spriteCharacter(sh, frames) {
  const c = new Container();
  const s = new Sprite(frames[0][0]);
  const k = CHAR_SCALE / sh.res;
  s.anchor.set(0.5, (sh.cell - 2 * sh.res) / sh.cell);
  s.scale.set(k);
  c.addChild(s);
  const st = { facing: 'down', flip: false, moving: false, lx: null, ly: null, vx: 0, vy: 0 };
  c.sprite = s; c.st = st;
  c.setMoving = (m) => { st.moving = m; };
  // 走路時左右由 turn() 依平滑後的移動方向決定；setDir 只在停下來時生效（例如射擊時面向敵人），避免每格被覆蓋而左右抖動
  c.setDir = (d) => { if (!st.moving) st.flip = d < 0; };
  /** 面向某個方向（例如工作時面向建築、射擊時面向敵人） */
  c.face = (f) => { st.facing = f; };
  /** 依位置變化更新面向；回傳目前的方向列索引 */
  c.turn = () => {
    stepFacing(st, c.x, c.y);
    s.scale.x = k * (st.facing === 'side' && st.flip ? -1 : 1);
    return FACING[st.facing];
  };
  return c;
}
function spriteWorker() {
  const sh = SHEETS.colonist, fr = FRAMES.get('colonist'), c = spriteCharacter(sh, fr), st = c.st;
  let carry = false, work = false;
  c.setCarry = (col) => { carry = col != null; };
  /** 在建築旁工作（面向建築） */
  c.setWork = (w) => { if (w && !work) st.facing = 'up'; work = w; };
  c.update = (t) => {
    const f = c.turn();
    let row, k;
    if (work && !st.moving) { row = 9 + f; k = Math.floor(t * 4) % 4; }
    else if (carry) { row = 6 + f; k = st.moving ? Math.floor(t * 8) % 4 : 0; }
    else if (st.moving) { row = 3 + f; k = Math.floor(t * 8) % 4; }
    else { row = f; k = 0; }
    c.sprite.texture = fr[row][k];
  };
  return c;
}
function spriteMarine(armed) {
  const sh = SHEETS.marine, fr = FRAMES.get('marine'), c = spriteCharacter(sh, fr), st = c.st;
  // 槍口閃光：由遊戲畫（圖上的閃光方向不一定對），位置跟著面向
  const flash = new Sprite(dotTexture()); flash.width = 3; flash.height = 3; flash.tint = 0xbff8ff; flash.visible = false;
  const glow = glowSprite(0, 0, 10, 0x6fe8ff, 0.8); glow.visible = false;
  c.addChild(glow, flash);
  let shootT = 0, flashT = 0;
  c.fire = () => { if (!armed) return; shootT = 0.3; flashT = 0.08; st.facing = 'side'; };
  c.setCarry = () => {};
  c.update = (t, dt = 0) => {
    const f = c.turn();
    shootT -= dt; flashT -= dt;
    let row, k;
    if (shootT > 0) { row = 6 + f; k = shootT > 0.2 ? 0 : shootT > 0.1 ? 2 : 3; }   // 瞄準 → 後座力 → 回位（略過圖上自帶閃光的那一格）
    else if (st.moving) { row = 3 + f; k = Math.floor(t * 8) % 4; }
    else { row = f; k = 0; }
    c.sprite.texture = fr[row][k];
    const m = st.facing === 'side' ? { x: (st.flip ? -1 : 1) * 8, y: -8 } : st.facing === 'down' ? { x: 3, y: -5 } : { x: 2, y: -13 };
    flash.position.set(m.x - 1, m.y - 1); glow.position.set(m.x, m.y);
    flash.visible = glow.visible = flashT > 0;
  };
  return c;
}

export function renderWorker(stage) {
  const P = STAGES[stage], S = ramp(P.suit), Hm = ramp(0xeef0f4), D = ramp(0x3a3f4e);
  return [0, 1, 2].map((f) => {
    const b = new Pix(13, 17, 6, 15);
    const legs = f === 0 ? [-1, 1] : f === 1 ? [-2, 1] : [-1, 2];
    for (const lx of legs) b.vline(lx, -2, -1, D[1]);
    b.rect(-3, -6, 1, 3, D[2]);
    b.rect(-2, -6, 5, 4, S[2]); b.vline(-2, -6, -3, S[3]); b.vline(2, -6, -3, S[1]); b.hline(-2, 2, -3, S[1]);
    b.rect(-2, -10, 5, 4, Hm[2]); b.hline(-1, 1, -11, Hm[3]); b.vline(-2, -10, -8, Hm[3]); b.vline(2, -10, -7, Hm[1]);
    b.hline(0, 2, -8, 0x6fe0ff); b.set(1, -9, 0xbff4ff);
    b.outline(P.outline);
    return { canvas: b.toCanvas(), ax: 6, ay: 15 };
  });
}

/** 陸戰隊員：深藍灰裝甲、橘色護目鏡；armed 時手上有步槍。三張影格（站、走 1、走 2），canvas 15×17，原點 (6, 15)。 */
export function renderMarine(armed) {
  const A = ramp(0x4a5f7a), Hm = ramp(0x6d84a0), D = ramp(0x262c38), G = ramp(0x2a2e36);
  return [0, 1, 2].map((f) => {
    const b = new Pix(15, 17, 6, 15);
    const legs = f === 0 ? [-1, 1] : f === 1 ? [-2, 1] : [-1, 2];
    for (const lx of legs) { b.vline(lx, -2, -1, D[1]); b.set(lx, -1, D[0]); }
    b.rect(-3, -7, 1, 4, D[2]);
    b.rect(-2, -7, 5, 5, A[2]); b.vline(-2, -7, -3, A[3]); b.vline(2, -7, -3, A[1]); b.hline(-2, 2, -3, A[1]);
    b.hline(-1, 1, -6, A[3]); b.set(0, -5, 0xffb347);
    b.rect(-2, -11, 5, 4, Hm[2]); b.hline(-1, 1, -12, Hm[3]); b.vline(-2, -11, -8, Hm[3]); b.vline(2, -11, -8, Hm[1]);
    b.hline(0, 2, -9, 0xff9a3a); b.set(1, -10, 0xffd08a);
    if (armed) { b.hline(1, 6, -5, G[2]); b.set(6, -6, G[3]); b.set(2, -4, G[1]); }
    b.outline(0x10141c);
    return { canvas: b.toCanvas(), ax: 6, ay: 15 };
  });
}
const marineFrames = new Map();
/** 陸戰隊員 Container：setMoving、setDir、update(t)、fire()（槍口閃光） */
export function createMarine(armed) {
  if (FRAMES.has('marine')) return spriteMarine(armed);
  if (!marineFrames.has(armed)) marineFrames.set(armed, renderMarine(armed).map((f) => pixelTexture(f.canvas)));
  const tex = marineFrames.get(armed);
  const c = new Container();
  const s = new Sprite(tex[0]); s.anchor.set(6 / 15, 15 / 17);
  const flash = new Sprite(dotTexture()); flash.width = 2; flash.height = 2; flash.tint = 0xffe08a; flash.position.set(7, -7); flash.visible = false;
  c.addChild(s, flash);
  let moving = false, flashT = 0;
  c.setMoving = (m) => { moving = m; };
  c.setDir = (d) => { s.scale.x = d < 0 ? -1 : 1; flash.x = d < 0 ? -9 : 7; };
  c.fire = () => { if (armed) flashT = 0.08; };
  c.setCarry = () => {};
  c.update = (t, dt = 0) => {
    s.texture = moving ? tex[1 + (Math.floor(t * 8) % 2)] : tex[0];
    flashT -= dt; flash.visible = flashT > 0;
  };
  return c;
}

/** 襲擊單位的手繪小人（scripts/process-unit-sheet.py 產生，格式同陸戰隊；第 6–8 列攻擊、9 倒地、10 中彈）。
 *  介面同 createAlien（setDir、update(t, moving)），另有 fire() 攻擊、hurt() 中彈、die() 倒地（停在最後一格）。
 *  o.attack：攻擊動作秒數；o.frameAt(p)：攻擊進度 0–1 對到第幾格；o.flash：槍口閃光顏色（沒有就不畫）；o.muzzle：側面時的閃光位置 */
function spriteRaider(key, o) {
  const sh = SHEETS[key], fr = FRAMES.get(key), c = spriteCharacter(sh, fr), st = c.st;
  const flash = new Sprite(dotTexture()); flash.width = 3; flash.height = 3; flash.tint = o.flash ?? 0xffffff; flash.visible = false;
  const glow = glowSprite(0, 0, 10, o.glow ?? 0xffffff, 0.8); glow.visible = false;
  c.addChild(glow, flash);
  let atkT = 0, flashT = 0, hurtT = 0, deadT = -1, last = 0;
  c.fire = () => { if (deadT < 0 && hurtT <= 0) { atkT = o.attack; flashT = o.flash ? 0.08 : 0; st.facing = 'side'; } };
  // 中彈：往後縮一下（側面）
  c.hurt = () => { if (deadT < 0) { hurtT = 0.36; atkT = 0; st.facing = 'side'; } };
  c.die = () => { if (deadT < 0) { deadT = 0; atkT = hurtT = flashT = 0; } };
  c.update = (t, moving) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
    c.setMoving(!!moving);
    const f = c.turn();
    atkT -= dt; flashT -= dt; hurtT -= dt;
    let row, k;
    if (deadT >= 0) { deadT += dt; row = 9; k = Math.min(3, Math.floor(deadT / 0.16)); }
    else if (hurtT > 0) { row = 10; k = Math.min(3, Math.floor((0.36 - hurtT) / 0.09)); }
    else if (atkT > 0) { row = 6 + f; k = o.frameAt(1 - atkT / o.attack); }
    else if (moving) { row = 3 + f; k = Math.floor(t * 8) % 4; }
    else { row = f; k = 0; }
    c.sprite.texture = fr[row][k];
    const m = st.facing === 'side' ? { x: (st.flip ? -1 : 1) * o.muzzle.x, y: o.muzzle.y } : st.facing === 'down' ? { x: 3, y: -6 } : { x: 2, y: -14 };
    flash.position.set(m.x - 1, m.y - 1); glow.position.set(m.x, m.y);
    flash.visible = glow.visible = flashT > 0;
  };
  return c;
}

/** 赫利昂突擊隊（企業突擊隊襲擊用）：舉槍點放。圖還沒載入時用染成鋼藍色的異星生物代替 */
export function createCommando() {
  if (!FRAMES.has('commando')) { const a = createAlien(); a.tint = 0x9fb8e0; return a; }
  const c = spriteRaider('commando', {
    attack: 0.3, flash: 0xffe0b0, glow: 0xffb070, muzzle: { x: 9, y: -9 },
    // 瞄準 → 後座力 → 回位（略過圖上自帶閃光的那一格）
    frameAt: (p) => (p < 0.33 ? 0 : p < 0.66 ? 2 : 3),
  });
  c.commando = true;
  return c;
}

/** 異星生物（襲擊用）：兩張走路影格，canvas 15×13，原點在 (7, 11)。 */
export function renderAlien() {
  const body = ramp(0x8a3a6a), spike = ramp(0x5a2a5a);
  return [0, 1].map((f) => {
    const b = new Pix(15, 13, 7, 11);
    const legs = f ? [-4, -1, 2, 5] : [-3, 0, 3, 5];
    for (const x of legs) { b.set(x, -1, body[0]); b.set(x + (f ? 1 : -1), 0, body[0]); }
    for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) {
      const q = (dx * dx) / 30 + (dy * dy) / 12;
      if (q > 1) continue;
      const l = -0.5 * (dx / 5) - 0.6 * (dy / 3.5) + 0.5;
      b.set(dx, -4 + dy, body[clamp(Math.floor((l + 0.5) * 2.2 + bayer(dx + 7, dy) * 0.8), 0, 4)]);
    }
    for (const [x, y] of [[-3, -8], [0, -9], [3, -8]]) { b.set(x, y, spike[2]); b.set(x, y + 1, spike[1]); }
    b.set(-2, -5, 0x9fffb0); b.set(2, -5, 0x9fffb0); b.set(-2, -4, 0x4fd080); b.set(2, -4, 0x4fd080);
    b.outline(0x1a0a18);
    return { canvas: b.toCanvas(), ax: 7, ay: 11 };
  });
}
const alienFrames = { t: null };
/** 異星生物 Container：update(t, moving) 切換走路影格 */
export function createAlien() {
  // 手繪的微光獸：吐晶球（蓄力 → 張口 → 吐出 → 收回，晶球畫在圖上）
  if (FRAMES.has('glimmer')) return spriteRaider('glimmer', { attack: 0.45, muzzle: { x: 10, y: -8 }, frameAt: (p) => Math.min(3, Math.floor(p * 4)) });
  if (!alienFrames.t) alienFrames.t = renderAlien().map((f) => pixelTexture(f.canvas));
  const tex = alienFrames.t;
  const c = new Container();
  const s = new Sprite(tex[0]); s.anchor.set(7 / 15, 11 / 13);
  const eyes = glowSprite(0, -5, 6, 0x9fffb0, 0.5);
  c.addChild(s, eyes);
  c.setDir = (d) => { s.scale.x = d < 0 ? -1 : 1; };
  c.update = (t, moving) => { s.texture = moving ? tex[Math.floor(t * 6) % 2] : tex[0]; };
  c.fire = () => {};
  return c;
}

// ───────────────────────────── 介面素材 ─────────────────────────────

/** 資源圖示 11×11。 */
export function renderIcon(key) {
  const b = new Pix(11, 11, 1, 1), Rm = ramp(RES[key].color);
  switch (key) {
    case 'oxygen': b.ell(4, 5, 4, 4, Rm[2]); b.ell(3, 4, 2, 2, Rm[3]); b.set(2, 3, Rm[4]); b.ell(8, 1, 1, 1, Rm[3]); b.hline(3, 5, 5, Rm[0]); b.set(4, 6, Rm[0]); break;
    case 'nutrient': b.poly([1, 8, 2, 3, 6, 0, 9, 0, 8, 4, 4, 8], Rm[2]); b.line(2, 7, 7, 2, Rm[4]); b.poly([1, 8, 2, 3, 4, 3, 3, 7], Rm[3]); break;
    case 'scrap': b.poly([0, 6, 2, 2, 5, 3, 8, 1, 9, 5, 6, 8, 3, 8], Rm[2]); b.line(2, 3, 5, 4, Rm[4]); b.set(6, 6, Rm[0]); b.set(3, 6, Rm[1]); break;
    case 'rock': b.ell(4, 5, 4, 3, Rm[2]); b.ell(3, 4, 2, 1, Rm[3]); b.set(2, 3, Rm[4]); b.hline(2, 7, 8, Rm[0]); break;
    case 'parts': b.ell(4, 4, 4, 4, Rm[2]); for (const [x, y] of [[4, -1], [4, 9], [-1, 4], [9, 4]]) b.set(x, y, Rm[2]); b.ell(4, 4, 1, 1, 0x1a2030); b.set(2, 2, Rm[4]); b.set(3, 1, Rm[3]); break;
    case 'metal': b.poly([0, 8, 2, 3, 7, 3, 9, 8], Rm[2]); b.hline(2, 6, 3, Rm[4]); b.hline(1, 8, 8, Rm[0]); b.line(1, 7, 2, 4, Rm[3]); break;
    case 'tools': b.line(1, 8, 6, 3, Rm[2]); b.line(2, 8, 7, 3, Rm[1]); b.ell(7, 2, 2, 2, Rm[3]); b.set(8, 1, 0x1a1410); b.set(7, 1, Rm[4]); break;
    case 'weapon': b.rect(1, 3, 7, 3, Rm[2]); b.hline(1, 7, 3, Rm[4]); b.rect(2, 6, 2, 3, Rm[1]); b.set(8, 4, 0xffe0e0); break;
    case 'crystal': b.poly([4, 0, 8, 4, 4, 9, 0, 4], Rm[2]); b.poly([4, 0, 4, 9, 0, 4], Rm[3]); b.line(4, 1, 4, 8, Rm[4]); break;
    // 電子元件：晶片＋兩側針腳
    case 'electronics': b.rect(2, 2, 6, 6, Rm[1]); b.rect(3, 3, 4, 4, Rm[2]); b.set(3, 3, Rm[4]); for (const y of [2, 4, 6]) { b.set(0, y + 1, 0xc8c8c8); b.set(9, y + 1, 0xc8c8c8); b.set(1, y + 1, 0x9a9a9a); b.set(8, y + 1, 0x9a9a9a); } break;
    // 稀有金屬：發亮的梯形錠＋閃光
    case 'raremetal': b.poly([0, 8, 2, 4, 7, 4, 9, 8], Rm[2]); b.hline(2, 7, 4, Rm[4]); b.hline(1, 8, 8, Rm[0]); b.line(1, 7, 2, 5, Rm[3]); b.set(8, 1, 0xffffff); b.set(7, 1, Rm[4]); b.set(8, 0, Rm[4]); b.set(9, 1, Rm[4]); b.set(8, 2, Rm[4]); break;
    // 燃料：油桶＋提把
    case 'fuel': b.rect(2, 2, 6, 7, Rm[2]); b.vline(2, 2, 8, Rm[3]); b.vline(7, 2, 8, Rm[1]); b.hline(3, 6, 5, Rm[0]); b.rect(3, 0, 3, 2, 0x5a4a40); b.set(4, 0, 0x2a201a); b.set(3, 3, Rm[4]); break;
    // 醫療物資：白箱＋紅十字
    case 'medicine': b.rect(1, 2, 8, 7, Rm[2]); b.hline(1, 8, 2, Rm[4]); b.hline(1, 8, 8, Rm[0]); b.rect(4, 3, 2, 5, 0xe0393e); b.rect(2, 4, 6, 2, 0xe0393e); b.rect(3, 0, 4, 2, Rm[1]); break;
    case 'credit': b.ell(4, 4, 4, 4, Rm[2]); b.ell(4, 4, 3, 3, Rm[3]); b.vline(4, 2, 6, Rm[0]); b.hline(3, 5, 2, Rm[0]); b.hline(3, 5, 6, Rm[0]); b.set(2, 2, Rm[4]); break;
  }
  b.outline(0x120e18);
  return b.toCanvas();
}

/** 面板 canvas：kind = 'panel'（外框）、'inset'（數字框）、'plate'（名牌）、'button'（+/-）。 */
export function renderPanel(w, h, stage, kind = 'panel', glyph = '') {
  const P = STAGES[stage], b = new Pix(w, h), OL = P.outline;
  const base = ramp(mix(P.metal, 0x2a3040, 0.35)), fill = mix(base[1], OL, 0.35), T = ramp(P.trim);
  if (kind === 'panel') {
    b.rect(0, 0, w, h, OL);
    b.rect(1, 1, w - 2, h - 2, base[3]);
    b.rect(2, 2, w - 3, h - 3, base[0]);
    b.rect(2, 2, w - 4, h - 4, base[2]);
    b.rect(3, 3, w - 6, h - 6, fill);
    b.hline(4, w - 5, 2, T[3]);
    for (const [x, y] of [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]]) b.set(x, y, base[4]);
  } else if (kind === 'inset') {
    b.rect(0, 0, w, h, mix(fill, 0x000000, 0.35));
    b.hline(0, w - 1, 0, mix(fill, 0x000000, 0.6)); b.vline(0, 0, h - 1, mix(fill, 0x000000, 0.6));
    b.hline(0, w - 1, h - 1, base[3]);
  } else if (kind === 'plate' || kind === 'button') {
    b.rect(0, 0, w, h, OL);
    b.rect(1, 1, w - 2, h - 2, T[2]);
    b.hline(1, w - 2, 1, T[4]); b.hline(1, w - 2, h - 2, T[0]);
    b.vline(1, 2, h - 3, T[3]); b.vline(w - 2, 2, h - 3, T[1]);
    if (kind === 'plate') { b.set(2, 2, T[4]); b.set(w - 3, 2, T[4]); }
    if (glyph) {
      const cx = w >> 1, cy = h >> 1;
      b.hline(cx - 2, cx + 2, cy, 0xffffff);
      if (glyph === '+') b.vline(cx, cy - 2, cy + 2, 0xffffff);
    }
  }
  return b.toCanvas();
}

/** 圖鑑縮圖：地面小區塊＋建築＋光暈，放大 scale 倍、邊緣保持銳利。 */
export function renderThumb(id, level, scale = 3) {
  const def = BUILDING_MAP[id], stage = def.stage, TW = 80, TH = 68, GX = 40, GY = 58;
  const field = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
    const qx = (x - GX) / 32, qy = (y - GY + 6) / 15;
    field[y * TW + x] = (Math.sqrt(qx * qx + qy * qy) - 1) * 18;
  }
  const ground = paintGround(stage, TW, TH, field, 17 + stage, false);
  const art = renderBuilding(id, level);
  const fit = Math.min(1, (TW - 2) / art.w, (GY - 1) / art.ay);
  const s = fit >= 1 ? scale : Math.max(1, Math.floor(scale * fit * 2) / 2);
  const out = makeCanvas(TW * scale, TH * scale), g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(ground, 0, 0, TW * scale, TH * scale);
  const ox = GX * scale - art.ax * s, oy = GY * scale - art.ay * s;
  if (art.res > 1) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; }
  g.drawImage(art.canvas, ox, oy, art.w * s, art.h * s);
  g.imageSmoothingEnabled = false;
  g.globalCompositeOperation = 'lighter';
  for (const gl of [...art.glows, ...art.beacons.map((b) => ({ ...b, r: 8, a: 0.6 }))]) {
    const cx = ox + (art.ax + gl.x) * s, cy = oy + (art.ay + gl.y) * s, r = gl.r * s * 0.5;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
    const col = `${(gl.c >> 16) & 255},${(gl.c >> 8) & 255},${gl.c & 255}`;
    grad.addColorStop(0, `rgba(${col},${gl.a * 0.55})`);
    grad.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = grad;
    g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  return out;
}

// ───────────────────────────── Pixi 包裝 ─────────────────────────────

export function pixelTexture(canvas) {
  const t = Texture.from(canvas);
  t.source.scaleMode = 'nearest';
  return t;
}
/** 高解析度的手繪圖：縮小顯示，用平滑取樣 */
function smoothSprite(art) {
  const t = Texture.from(art.canvas);
  t.source.scaleMode = 'linear';
  const s = new Sprite(t);
  s.anchor.set(art.ax / art.w, art.ay / art.h);
  return s;
}
export function createPixelSprite(canvas, ax = 0, ay = 0) {
  const s = new Sprite(pixelTexture(canvas));
  s.anchor.set(ax / canvas.width, ay / canvas.height);
  return s;
}
let _glowTex = null, _dotTex = null, _smokeTex = null;
function glowTexture() {
  if (_glowTex) return _glowTex;
  const cv = makeCanvas(64, 64), g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _glowTex = Texture.from(cv);
  _glowTex.source.scaleMode = 'linear';
  return _glowTex;
}
function dotTexture() {
  if (_dotTex) return _dotTex;
  const cv = makeCanvas(1, 1); const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1, 1);
  return (_dotTex = pixelTexture(cv));
}
/** 手繪建築的蒸氣：柔邊的白色圓團（16×16，放射漸層） */
let _puffTex = null;
function puffTexture() {
  if (_puffTex) return _puffTex;
  const cv = makeCanvas(16, 16), g = cv.getContext('2d'), gr = g.createRadialGradient(8, 8, 1, 8, 8, 8);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  _puffTex = Texture.from(cv); _puffTex.source.scaleMode = 'linear';
  return _puffTex;
}
function smokeTexture() {
  if (_smokeTex) return _smokeTex;
  const b = new Pix(5, 5, 2, 2); b.ell(0, 0, 2, 2, 0xd8d8d8); b.set(-1, -1, 0xffffff); b.set(1, 1, 0xa8a8a8);
  return (_smokeTex = pixelTexture(b.toCanvas()));
}
function glowSprite(x, y, r, c, a) {
  const s = new Sprite(glowTexture());
  s.anchor.set(0.5); s.position.set(x, y); s.width = s.height = r * 2; s.tint = c; s.alpha = a; s.blendMode = 'add';
  return s;
}

function fromArt(art) {
  const c = new Container();
  const res = art.res ?? 1;
  const spr = res > 1 ? smoothSprite(art) : createPixelSprite(art.canvas, art.ax, art.ay);
  spr.base = 1 / res; spr.scale.set(spr.base);
  const flash = new Sprite(spr.texture);
  flash.anchor.copyFrom(spr.anchor); flash.scale.copyFrom(spr.scale); flash.blendMode = 'add'; flash.alpha = 0;
  const smokeL = new Container();
  c.addChild(spr, flash, smokeL);
  const lights = new Container();
  const glows = art.glows.map((g) => { const s = glowSprite(g.x, g.y, g.r, g.c, g.a * 0.75); s.base = g.a * 0.75; s.flicker = g.flicker; s.ph = Math.random() * 6; lights.addChild(s); return s; });
  const beacons = art.beacons.map((b) => {
    const d = new Sprite(dotTexture()); d.position.set(b.x, b.y); d.tint = b.c; d.blendMode = 'add';
    const g = glowSprite(b.x + 0.5, b.y + 0.5, 7, b.c, 0.7);
    lights.addChild(g, d);
    return { d, g, ph: Math.random() * 6, sp: 2 + Math.random() };
  });
  // 夜晚亮燈（只有手繪建築有）：燈本身＋光暈，亮度跟著 NIGHT
  let nightL = null, haloL = null;
  if (art.emissive) {
    const mk = (cv, ax, ay) => { const t = Texture.from(cv); t.source.scaleMode = 'linear'; const s = new Sprite(t); s.anchor.set(ax / cv.width, ay / cv.height); s.scale.set(spr.base); s.blendMode = 'add'; s.alpha = 0; return s; };
    haloL = mk(art.halo, art.ax * res + HALO_PAD * res, art.ay * res + HALO_PAD * res);
    nightL = mk(art.emissive, art.ax * res, art.ay * res);
    lights.addChild(haloL, nightL);
  }
  const puffs = [];
  let acc = 0;
  Object.assign(c, { sprite: spr, lights, art, flashSprite: flash });
  c.flash = () => { flash.alpha = 1; };
  c.update = (t, dt = 1 / 60) => {
    if (nightL) { nightL.alpha = NIGHT; haloL.alpha = NIGHT; }
    for (const s of glows) s.alpha = s.flicker ? s.base * (0.82 + 0.18 * Math.sin(t * 9 + s.ph) * Math.sin(t * 5.3 + s.ph * 2)) : s.base;
    for (const b of beacons) { const on = Math.sin(t * b.sp + b.ph) > 0.2; b.d.alpha = on ? 1 : 0.15; b.g.alpha = on ? 0.7 : 0.05; }
    if (flash.alpha > 0) flash.alpha = Math.max(0, flash.alpha - dt * 4);
    acc += dt;
    if (art.smokes.length && acc > 0.45) {
      acc = 0;
      for (const e of art.smokes) {
        const soft = res > 1;   // 手繪建築用柔邊圓團，程式畫的建築維持像素方塊
        const p = new Sprite(soft ? puffTexture() : smokeTexture()); p.anchor.set(0.5); p.tint = e.c; p.position.set(e.x + (soft ? (Math.random() - 0.5) * 2 : 0), e.y); p.alpha = soft ? 0.9 : 0.7;
        smokeL.addChild(p); puffs.push({ p, life: 0, vx: 2 + Math.random() * 3, soft });
      }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i]; q.life += dt;
      q.p.y -= 7 * dt; q.p.x += q.vx * dt;
      // 柔邊蒸氣：一邊上升一邊慢慢變大變淡（直徑約 4 → 12 像素）；方塊煙維持原本兩段大小
      if (q.soft) q.p.scale.set(0.25 + q.life * 0.22);
      else q.p.scale.set(q.life < 1.2 ? 1 : 2);
      q.p.alpha = Math.max(0, (q.soft ? 0.9 : 0.7) - q.life * (q.soft ? 0.34 : 0.28));
      if (q.life > 2.5) { q.p.destroy(); puffs.splice(i, 1); }
    }
  };
  c.update(0);
  return c;
}

/** 建築：Container（原點＝正面地面中心）。.lights 需另外加到發光層並同步位置。 */
export function createBuilding(id, level = 1) {
  const def = BUILDING_MAP[id];
  const art = renderBuilding(id, level);
  const c = fromArt(art);
  c.info = { ...def, level, tier: tierOf(level), color: RES[def.res].color };
  return c;
}
export function createProp(kind, stage, seed = 1) {
  const c = fromArt(renderProp(kind, stage, seed));
  c.info = { kind, stage };
  return c;
}
/** 地面 = 手繪底圖（固定，只載入一次）＋ 道路與地基層（蓋好建築時重畫）。
 *  res：道路層的解析度倍數（相對於地圖像素），畫得比地圖細、顯示時縮回去，邊緣和鋪面紋路比較細緻。
 *  回傳的 Container 上有 roads（道路層 Sprite），縮放時可以切換它的取樣方式。 */
export function createGround(stage, plan, res = 2) {
  if (!TERRAIN.img) { const s = new Sprite(pixelTexture(renderGround(stage, plan))); s.roads = null; return s; }
  TERRAIN.tex ??= Texture.from(TERRAIN.img);
  TERRAIN.tex.source.scaleMode = 'linear';
  const c = new Container();
  const base = new Sprite(TERRAIN.tex); base.width = plan.MW; base.height = plan.MH;
  c.addChild(base);
  const r = paintRoads(stage, plan, res);
  c.roads = null;
  c.paved = () => false;
  if (r) {
    const t = Texture.from(r.canvas); t.source.scaleMode = 'linear';
    const s = new Sprite(t); s.scale.set(1 / res); s.position.set(r.x, r.y);
    c.addChild(s); c.roads = s;
    // 地圖座標 (x, y) 是不是鋪過的路面（石磚、金屬地磚）：腳印只留在沙地上
    const a = r.canvas.getContext('2d').getImageData(0, 0, r.canvas.width, r.canvas.height).data, w = r.canvas.width, h = r.canvas.height;
    c.paved = (x, y) => {
      const px = Math.floor((x - r.x) * res), py = Math.floor((y - r.y) * res);
      return px >= 0 && py >= 0 && px < w && py < h && a[(py * w + px) * 4 + 3] > 128;
    };
  }
  return c;
}
/** 道路與建築地基層（透明底）。每條路、每塊地基依各自的鋪面等級（plan.tier）：0 踩出來的沙路、1 金屬踏板、2 石磚。
 *  只畫有道路的範圍；距離場用雙線性取樣，邊緣平滑；紋路尺寸以地圖像素為單位。 */
function paintRoads(stage, plan, R) {
  const W = plan.MW, H = plan.MH, field = plan.field;
  // 道路範圍（地圖像素）
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (field[y * W + x] < 4) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  if (bx1 < 0) return null;
  const CW = (bx1 - bx0 + 1) * R, CH = (by1 - by0 + 1) * R;
  const cv = makeCanvas(CW, CH), ctx = cv.getContext('2d');
  const img = ctx.createImageData(CW, CH), d = img.data;
  const PLATE = [0x4a4e58, 0x6a707c, 0x868c98, 0xa4aab4], TILE = [0x6e5a4a, 0xa89078, 0xc4ac90, 0xd8c4a8];
  const nA = noise2(plan.seed + 1);
  const put = (i, c, a) => { d[i] = (c >> 16) & 255; d[i + 1] = (c >> 8) & 255; d[i + 2] = c & 255; d[i + 3] = Math.round(a * 255); };
  const F = (x, y) => field[clamp(y, 0, H - 1) * W + clamp(x, 0, W - 1)];
  const seam = 1 / R;   // 接縫寬度：一個像素
  // 只處理道路和地基附近的格子（距離場每格最多變化約 1.5，離得遠的格子不可能被蓋到），每格再細分成 R×R 個像素
  for (let gy = by0; gy <= by1; gy++) for (let gx = bx0; gx <= bx1; gx++) if (field[gy * W + gx] < 4) for (let sy = 0; sy < R; sy++) for (let sx = 0; sx < R; sx++) {
    const X = gx * R + sx, Y = gy * R + sy;
    const mx = (X + 0.5) / R - 0.5, my = (Y + 0.5) / R - 0.5;
    const x0 = Math.floor(mx), y0 = Math.floor(my), fx = mx - x0, fy = my - y0;
    const v = (F(x0, y0) * (1 - fx) + F(x0 + 1, y0) * fx) * (1 - fy) + (F(x0, y0 + 1) * (1 - fx) + F(x0 + 1, y0 + 1) * fx) * fy;
    if (v >= 1.5) continue;
    const cov = clamp((1.5 - v) * R, 0, 1);   // 邊緣反鋸齒
    const i = ((Y - by0 * R) * CW + (X - bx0 * R)) * 4, edge = v > -1.3, tr = plan.tier ? plan.tier[clamp(Math.round(my), 0, H - 1) * W + clamp(Math.round(mx), 0, W - 1)] : stage <= 2 ? 0 : stage <= 5 ? 1 : 2;
    // 沙地不畫路：小人走過留下腳印（GameScene.footprints）就是路
    if (tr === 0) continue;
    if (tr === 1) {
      // 金屬踏板：6×4 一塊，接縫較暗，接縫下方一條亮邊
      const px = mx - Math.floor(mx / 6) * 6, py = my - Math.floor(my / 4) * 4;
      const c = edge ? PLATE[0] : px < seam || py < seam ? PLATE[1] : py < seam * 2 ? PLATE[3] : PLATE[((Math.floor(mx / 6) + Math.floor(my / 4)) % 3) ? 2 : 3];
      put(i, c, (edge ? 0.6 : 1) * cov);
    } else {
      const row = Math.floor(my / 5), tx = mx + (row % 2) * 4, px = tx - Math.floor(tx / 8) * 8, py = my - row * 5;
      put(i, edge ? TILE[0] : py < seam || px < seam ? TILE[1] : TILE[nA(Math.floor(tx / 8), row) > 0.6 ? 3 : 2], (edge ? 0.6 : 1) * cov);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cv, x: bx0, y: by0 };
}

const workerFrames = new Map();
/** 工人：setMoving(bool)、setDir(±1)、setCarry(color|null)、update(t)。 */
export function createWorker(stage) {
  if (FRAMES.has('colonist')) return spriteWorker();
  if (!workerFrames.has(stage)) workerFrames.set(stage, renderWorker(stage).map((f) => pixelTexture(f.canvas)));
  const tex = workerFrames.get(stage);
  const c = new Container();
  const s = new Sprite(tex[0]); s.anchor.set(6 / 13, 15 / 17);
  const carry = new Container();
  const box = new Sprite(dotTexture()); box.width = 3; box.height = 3; box.position.set(-1, -15);
  const hi = new Sprite(dotTexture()); hi.position.set(-1, -15); hi.alpha = 0.7;
  carry.addChild(box, hi); carry.visible = false;
  c.addChild(s, carry);
  let moving = false;
  c.setMoving = (m) => { moving = m; };
  c.setDir = (d) => { s.scale.x = d < 0 ? -1 : 1; };
  c.setCarry = (col) => { carry.visible = col != null; if (col != null) box.tint = col; };
  c.update = (t) => { s.texture = moving ? tex[1 + (Math.floor(t * 8) % 2)] : tex[0]; carry.y = moving ? -(Math.floor(t * 8) % 2) : 0; };
  return c;
}

/** Buff 光環：金色像素點繞行的橢圓，放在發光層。 */
export function createBuffRing(rx, ry, color = 0xffd24a) {
  const g = new Graphics();
  g.blendMode = 'add';
  g.update = (t) => {
    g.clear();
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + t * 0.9;
      const on = (i + Math.floor(t * 6)) % 4 !== 0;
      if (!on) continue;
      g.rect(Math.round(Math.cos(a) * rx), Math.round(Math.sin(a) * ry), 1, 1).fill({ color, alpha: Math.sin(a) > 0 ? 1 : 0.5 });
    }
    for (let i = 0; i < 4; i++) {
      const u = (t * 0.6 + i / 4) % 1, x = Math.round(Math.cos(i * 2.1) * rx * 0.7);
      g.rect(x, Math.round(-u * 26), 1, 1).fill({ color: 0xfff0b0, alpha: 1 - u });
    }
  };
  g.update(0);
  return g;
}

/** 氣氛粒子（餘燼、雪、灰塵、螢火、光點、金粉），座標為地圖像素。 */
export function createAmbient(stage, MW, MH) {
  const kind = TERRAIN.img ? 'dust' : STAGES[stage].particles, R = rng(stage * 99);
  const cfg = { ember: [50, 0xff7a3a], snow: [140, 0xffffff], dust: [50, 0xb8c0c8], firefly: [40, 0xffd070], mote: [60, 0xc890ff], gold: [50, 0xffd24a] }[kind];
  const c = new Container(), ps = [];
  for (let i = 0; i < cfg[0]; i++) {
    const s = new Sprite(dotTexture()); s.tint = i % 3 === 0 && kind === 'mote' ? 0x7af0e0 : cfg[1];
    if (kind !== 'snow' && kind !== 'dust') s.blendMode = 'add';
    const p = { s, x: R() * MW, y: R() * MH, ph: R() * 6.28, sp: 0.5 + R() };
    c.addChild(s); ps.push(p);
  }
  c.update = (t, dt) => {
    for (const p of ps) {
      if (kind === 'ember') { p.y -= 10 * p.sp * dt; p.x += Math.sin(t + p.ph) * 6 * dt; if (p.y < 0) { p.y = MH; p.x = R() * MW; } p.s.alpha = 0.5 + 0.5 * Math.sin(t * 3 + p.ph); }
      else if (kind === 'snow') { p.y += 14 * p.sp * dt; p.x += (Math.sin(t + p.ph) * 6 - 4) * dt; if (p.y > MH) { p.y = 0; p.x = R() * MW; } if (p.x < 0) p.x += MW; p.s.alpha = 0.9; }
      else if (kind === 'dust') { p.x += 12 * p.sp * dt; if (p.x > MW) { p.x = 0; p.y = R() * MH; } p.s.alpha = 0.35; }
      else if (kind === 'firefly') { p.x += Math.cos(t * 0.7 + p.ph) * 6 * dt; p.y += Math.sin(t * 0.9 + p.ph * 2) * 5 * dt; p.s.alpha = Math.max(0, Math.sin(t * 2 * p.sp + p.ph)); }
      else if (kind === 'mote') { p.y -= 4 * p.sp * dt; p.x += Math.sin(t * 0.8 + p.ph) * 4 * dt; if (p.y < 0) { p.y = MH; p.x = R() * MW; } p.s.alpha = 0.3 + 0.7 * Math.abs(Math.sin(t + p.ph)); }
      else { p.y += 4 * p.sp * dt; if (p.y > MH) { p.y = 0; p.x = R() * MW; } p.s.alpha = Math.max(0, Math.sin(t * 3 * p.sp + p.ph)) ** 3; }
      p.s.position.set(Math.round(p.x), Math.round(p.y));
    }
  };
  return c;
}

/** 點擊回饋（螢幕座標）：pop 數字、burst 像素碎片。scale＝一個美術像素的螢幕大小。 */
export function createFx(layer, scale = 2) {
  const list = [];
  return {
    pop(x, y, text, color, crit = false) {
      const tx = new Text({
        text,
        style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: crit ? 22 : 14, fontWeight: '900', fill: crit ? 0xffffff : color, stroke: { color: crit ? color : 0x120e18, width: crit ? 5 : 4 } },
      });
      tx.anchor.set(0.5);
      tx.position.set(Math.round(x + (Math.random() - 0.5) * 14), Math.round(y));
      layer.addChild(tx);
      list.push({ o: tx, t: 0, life: crit ? 1.1 : 0.85, vy: crit ? -46 : -38, kind: 'pop', crit });
    },
    burst(x, y, color, n = 8) {
      for (let i = 0; i < n; i++) {
        const s = new Sprite(dotTexture()); s.tint = i % 3 ? color : 0xffffff; s.width = s.height = scale; s.position.set(x, y);
        layer.addChild(s);
        const a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 80;
        list.push({ o: s, t: 0, life: 0.55, kind: 'spark', vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60 });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]; p.t += dt;
        const u = p.t / p.life;
        if (p.kind === 'pop') {
          p.o.y += p.vy * dt; p.vy *= 0.93;
          p.o.alpha = u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35;
          if (p.crit) p.o.scale.set(u < 0.1 ? 0.6 + u * 7 : 1.3 - Math.min(0.3, u));
        } else {
          p.o.x += p.vx * dt; p.o.y += p.vy * dt; p.vy += 260 * dt;
          p.o.x = Math.round(p.o.x / scale) * scale;
          p.o.alpha = 1 - u;
        }
        if (u >= 1) { p.o.destroy(); list.splice(i, 1); }
      }
    },
    /** 清掉還在播放的特效（縮放時換新的特效器，舊的不清會殘留在畫面上） */
    clear() {
      for (const p of list) p.o.destroy();
      list.length = 0;
    },
  };
}

/** 是否使用手繪地形底圖（GameScene 用來決定是否套用各章的環境色） */
export const hasTerrain = () => !!TERRAIN.img;
