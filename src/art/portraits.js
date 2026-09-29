// 角色半身立繪（程序化像素畫，64×80，放大時用最近鄰）。不依賴 pixi，可以直接輸出 canvas。
// 每個角色由「底圖（背景、身體、頭）＋髮型＋五官＋配件」組成，最後統一描邊。

const W = 64, H = 80;

const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return (Math.round(A[0] + (B[0] - A[0]) * t) << 16) | (Math.round(A[1] + (B[1] - A[1]) * t) << 8) | Math.round(A[2] + (B[2] - A[2]) * t);
};
/** 五階色：[最暗, 暗, 基本, 亮, 最亮] */
const ramp = (c) => [mix(c, 0x120e1c, 0.55), mix(c, 0x120e1c, 0.28), c, mix(c, 0xfff4e0, 0.22), mix(c, 0xfff4e0, 0.45)];

class Pix {
  constructor() { this.d = new Int32Array(W * H).fill(-1); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H && c != null) this.d[y * W + x] = c; }
  get(x, y) { return x < 0 || y < 0 || x >= W || y >= H ? -1 : this.d[y * W + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  /** 填滿橢圓；f(dx, dy) 回傳顏色（dx、dy 是 -1..1 的相對位置），可做光影 */
  ell(cx, cy, rx, ry, f) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) this.set(x, y, typeof f === 'function' ? f(dx, dy, x, y) : f);
    }
  }
  poly(pts, f) {
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]); y1 = Math.max(y1, pts[i]); }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) this.set(x, y, typeof f === 'function' ? f(x, y) : f);
    }
  }
  line(x0, y0, x1, y1, c) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** 外框：透明像素只要鄰接不透明像素就塗成描邊色（背景另外畫，不會被描邊） */
  outline(c) {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (this.get(x, y) !== -1) continue;
      if (this.get(x + 1, y) !== -1 || this.get(x - 1, y) !== -1 || this.get(x, y + 1) !== -1 || this.get(x, y - 1) !== -1) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
  }
}

// ── 共用部件 ──
/** 由左上打光的球面明暗 */
const lit = (R, bias = 0) => (dx, dy) => {
  const l = -0.55 * dx - 0.65 * dy + bias;
  // 大部分用基本色，只在左上打亮、右下邊緣壓暗，臉才不會被切成兩半
  return R[l > 0.85 ? 4 : l > 0.35 ? 3 : l > -0.75 ? 2 : l > -1.05 ? 1 : 0];
};
function body(p, suit, opts = {}) {
  const S = ramp(suit), cx = 32;
  // 肩膀到畫面底部的梯形，左亮右暗
  for (let y = 55; y < H; y++) {
    const hw = Math.min(30, 12 + (y - 55) * 1.7 + (opts.broad ?? 0));
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
      const t = (x - cx) / hw;
      p.set(x, y, S[t < -0.55 ? 3 : t > 0.55 ? 1 : 2]);
    }
  }
  // 衣領縫線
  if (opts.seam !== false) for (let y = 62; y < H; y++) p.set(cx, y, S[1]);
}
function neck(p, skin) {
  const K = ramp(skin);
  p.rect(28, 47, 9, 9, K[2]); p.rect(34, 47, 3, 9, K[1]);
  p.rect(28, 47, 9, 1, K[1]);
}
function head(p, skin, opts = {}) {
  const K = ramp(skin), rx = (opts.rx ?? 11) + 0.8, ry = (opts.ry ?? 13) + 0.6;
  p.ell(32, 35, rx, ry, lit(K));
  // 下巴收一點
  for (const x of [32 - rx, 32 + rx]) for (let y = 43; y < 49; y++) if (p.get(x, y) !== -1) p.set(x, y, -1);
  p.set(21, 36, K[2]); p.set(43, 36, K[1]);   // 耳朵
  p.set(20, 37, K[1]); p.set(44, 37, K[0]);
}
function eyes(p, iris, opts = {}) {
  const y = opts.y ?? 37, gap = opts.gap ?? 5;
  for (const [x, side] of [[32 - gap, -1], [32 + gap - 1, 1]]) {
    if (opts.closed) { p.rect(x - 1, y + 1, 3, 1, 0x2a1a22); continue; }
    p.rect(x - 1, y, 3, 2, 0xf4f0ea);
    p.set(x + (side < 0 ? 1 : 0), y, iris); p.set(x + (side < 0 ? 1 : 0), y + 1, mix(iris, 0x000000, 0.4));
    p.rect(x - 1, y - 1, 3, 1, 0x2a1a22);          // 上眼線
    if (opts.glint !== false) p.set(x + (side < 0 ? 1 : 0), y, mix(iris, 0xffffff, 0.5));
  }
}
function brows(p, color, mood = 'flat') {
  const y = 33;
  const L = mood === 'angry' ? [[24, y], [25, y], [26, y + 1], [27, y + 1]] : mood === 'up' ? [[24, y + 1], [25, y], [26, y], [27, y]] : mood === 'raise' ? [[24, y], [25, y], [26, y], [27, y]] : [[24, y], [25, y], [26, y], [27, y]];
  const R = mood === 'angry' ? [[37, y + 1], [38, y + 1], [39, y], [40, y]] : mood === 'up' ? [[37, y], [38, y], [39, y], [40, y + 1]] : mood === 'raise' ? [[37, y - 2], [38, y - 2], [39, y - 1], [40, y]] : [[37, y], [38, y], [39, y], [40, y]];
  for (const [x, yy] of [...L, ...R]) p.set(x, yy, color);
}
function nose(p, skin) { const K = ramp(skin); p.set(33, 40, K[1]); p.set(33, 41, K[1]); p.set(32, 42, K[0]); }
function mouth(p, kind, skin) {
  const K = ramp(skin), dark = 0x5a2230, lip = mix(skin, 0xc04850, 0.35);
  if (kind === 'smile') { p.set(29, 45, dark); p.rect(30, 46, 5, 1, dark); p.set(35, 45, dark); }
  else if (kind === 'grin') { p.rect(29, 45, 7, 1, dark); p.rect(30, 46, 5, 1, 0xf4f0ea); p.rect(30, 47, 5, 1, dark); }
  else if (kind === 'smirk') { p.rect(30, 46, 4, 1, dark); p.set(34, 45, dark); }
  else if (kind === 'open') { p.rect(30, 45, 4, 3, dark); p.rect(31, 46, 2, 1, 0xd05060); }
  else if (kind === 'polite') { p.rect(30, 46, 5, 1, dark); p.set(29, 45, dark); p.set(35, 45, dark); p.rect(30, 47, 5, 1, lip); }
  else { p.rect(30, 46, 5, 1, dark); }
  p.set(32, 48, K[1]);
}
function cheeks(p, c) { p.set(26, 42, c); p.set(27, 42, c); p.set(37, 42, c); p.set(38, 42, c); }
function background(ctx, c1, c2, seed) {
  // 背景：上下漸層＋少量星點，和遊戲的太空主題一致
  for (let y = 0; y < H; y++) {
    ctx.fillStyle = '#' + mix(c1, c2, y / H).toString(16).padStart(6, '0');
    ctx.fillRect(0, y, W, 1);
  }
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = i % 5 ? 'rgba(255,255,255,0.35)' : 'rgba(255,230,160,0.7)';
    ctx.fillRect(Math.floor(r() * W), Math.floor(r() * 50), 1, 1);
  }
}

// ── 角色 ──
const SKIN = { a: 0xf2c7a0, b: 0xd9a276, c: 0xa86f4c, d: 0x7a4a32, e: 0xe8b894 };

export const PORTRAITS = {
  /** 瑪拉：逃生艙駕駛。短側剃髮、橘色飛行夾克、頭盔密封環、耳機麥克風、臉頰的舊傷 */
  mara(p) {
    const skin = SKIN.c, hair = ramp(0x2a2030);
    body(p, 0xd8742e);
    const J = ramp(0xd8742e);
    p.rect(21, 55, 23, 3, 0x9aa4b8); p.rect(21, 55, 23, 1, 0xd6dce8); // 頭盔密封環
    p.rect(12, 66, 3, 14, J[1]); p.rect(49, 66, 3, 14, J[1]);        // 夾克縫線
    p.rect(40, 66, 5, 3, 0x3a8fd0); p.set(41, 67, 0xe8f4ff);           // 臂章
    neck(p, skin); head(p, skin);
    // 頭髮：頭頂蓬、右側剃短
    p.ell(31, 26, 12, 7, (dx, dy) => hair[dy < -0.4 ? 3 : 2]);
    p.rect(20, 27, 4, 7, hair[1]); p.rect(41, 28, 3, 5, hair[0]);
    p.poly([22, 26, 36, 22, 30, 31, 24, 31], hair[2]);                   // 瀏海往右掃
    eyes(p, 0x4a3020); brows(p, hair[0], 'flat'); nose(p, skin); mouth(p, 'smirk', skin);
    p.line(38, 39, 40, 42, mix(skin, 0x6a2a2a, 0.45));                 // 臉頰舊傷
    // 耳機與麥克風
    p.rect(19, 33, 3, 7, 0x3a3a48); p.rect(19, 34, 1, 5, 0x6a6a7c);
    p.line(21, 40, 27, 45, 0x3a3a48); p.set(27, 45, 0xff5a3a);
  },
  /** 老提歐：礦場老技師。禿頂白髮、大白鬍子、額頭上的護目鏡、油污、背上的扳手 */
  teo(p) {
    const skin = SKIN.e, white = ramp(0xe6e2dc);
    body(p, 0x7a5a3a, { broad: 2 });
    const C = ramp(0x7a5a3a);
    p.rect(20, 62, 4, 18, C[1]); p.rect(40, 62, 4, 18, C[1]);          // 吊帶
    p.rect(20, 66, 4, 2, 0xc0a040); p.rect(40, 66, 4, 2, 0xc0a040);
    // 肩上的大扳手
    p.line(46, 50, 58, 76, 0x8a94a4); p.line(47, 50, 59, 76, 0x5a6474);
    p.ell(45, 48, 4, 4, 0x8a94a4); p.rect(44, 46, 2, 3, -1);
    neck(p, skin); head(p, skin, { rx: 12 });
    // 兩側白髮、禿頂
    p.ell(21, 34, 3, 7, (dx, dy) => white[dx < 0 ? 3 : 2]); p.ell(43, 34, 3, 7, white[1]);
    p.set(28, 24, ramp(skin)[4]); p.set(29, 24, ramp(skin)[4]);         // 頭頂反光
    // 護目鏡戴在額頭
    p.rect(21, 28, 23, 3, 0x4a3a2a);
    p.ell(27, 29, 3, 2, 0x6fd0e0); p.ell(37, 29, 3, 2, 0x6fd0e0); p.set(26, 28, 0xe8ffff); p.set(36, 28, 0xe8ffff);
    eyes(p, 0x3a5a7a, { gap: 5 }); brows(p, white[1], 'up'); nose(p, skin);
    p.rect(32, 40, 2, 3, ramp(skin)[1]);                                  // 大鼻子
    // 大鬍子
    p.poly([25, 44, 31, 42, 34, 42, 40, 44, 38, 49, 33, 47, 31, 47, 26, 49], (x, y) => white[y < 45 ? 3 : 2]);
    p.rect(30, 47, 5, 1, 0x5a2230);
    p.set(24, 39, 0x3a3030); p.set(25, 40, 0x3a3030);                    // 油污
  },
  /** 朱諾：19 歲，最年輕。亂翹的短髮帶青綠挑染、雀斑、大笑、過大的太空衣和補丁、抱著日誌本 */
  juno(p) {
    const skin = SKIN.a, hair = ramp(0x6a3a28), dye = 0x3ad0c0;
    body(p, 0x5a8ac8);
    const S = ramp(0x5a8ac8);
    p.rect(14, 68, 6, 5, 0xe0b040); p.rect(15, 69, 4, 3, 0xf0d070);      // 補丁
    p.rect(44, 64, 5, 5, 0xd05a6a);
    // 抱著的日誌本
    p.poly([20, 70, 40, 66, 44, 80, 22, 80], (x, y) => (y < 70 ? 0xe8d8b0 : 0xd4c090));
    p.line(21, 71, 41, 67, 0x9a7a4a); p.rect(28, 72, 8, 1, 0x7a6a5a); p.rect(28, 75, 10, 1, 0x7a6a5a);
    neck(p, skin); head(p, skin, { rx: 11, ry: 12 });
    // 亂翹短髮
    p.ell(32, 27, 13, 8, (dx, dy) => hair[dy < -0.3 ? 3 : 2]);
    for (const [x, y] of [[20, 24], [23, 20], [28, 18], [36, 18], [41, 21], [44, 25]]) p.rect(x, y, 2, 3, hair[2]);
    p.rect(20, 28, 3, 8, hair[2]); p.rect(42, 28, 3, 8, hair[1]);
    p.poly([22, 27, 30, 25, 34, 31, 26, 31], hair[2]); p.poly([34, 25, 42, 28, 40, 31, 36, 30], hair[1]);
    for (const [x, y] of [[23, 22], [29, 19], [37, 19], [43, 26], [21, 31]]) p.set(x, y, dye);  // 挑染
    eyes(p, 0x3a7a4a, { y: 36 }); brows(p, hair[1], 'up'); nose(p, skin); mouth(p, 'grin', skin);
    for (const [x, y] of [[25, 40], [27, 41], [38, 40], [40, 41], [26, 39]]) p.set(x, y, 0xc07850); // 雀斑
    cheeks(p, 0xf0a090);
  },
  /** 伊涅絲：救回來的工程師。捲髮用頭巾綁起、額頭貼著繃帶、黃色工作背心、肩上工具箱背帶 */
  ines(p) {
    const skin = SKIN.b, hair = ramp(0x8a3a24);
    body(p, 0x5a6070);
    const V = ramp(0xe8b830);
    p.poly([16, 60, 26, 58, 26, 80, 12, 80], (x, y) => V[x < 18 ? 3 : 2]); p.poly([38, 58, 48, 60, 52, 80, 38, 80], V[1]);  // 背心
    p.rect(16, 70, 10, 2, 0xe8ecf0); p.rect(38, 70, 10, 2, 0xc8ccd0);    // 反光條
    p.line(18, 58, 44, 80, 0x3a2a20); p.line(19, 58, 45, 80, 0x5a4030);  // 工具箱背帶
    neck(p, skin); head(p, skin);
    // 蓬鬆捲髮
    for (const [x, y, r] of [[22, 28, 5], [27, 23, 5], [34, 22, 5], [40, 25, 5], [43, 31, 4], [20, 34, 4], [44, 37, 3], [19, 40, 3]])
      p.ell(x, y, r, r, (dx, dy) => hair[dx + dy < -0.6 ? 3 : dx + dy > 0.6 ? 1 : 2]);
    // 頭巾
    p.rect(21, 28, 23, 3, 0x2a8a6a); p.rect(21, 28, 23, 1, 0x4ab08a);
    for (let x = 24; x < 42; x += 4) p.set(x, 29, 0xe8f0e0);
    p.rect(43, 30, 3, 4, 0x2a8a6a);
    // 額頭繃帶
    p.rect(35, 31, 5, 2, 0xf4ece0); p.set(37, 31, 0xd08080);
    eyes(p, 0x3a2a1a); brows(p, hair[0], 'angry'); nose(p, skin); mouth(p, 'flat', skin);
    p.set(30, 45, 0x5a2230);                                              // 抿嘴、有點不服氣
  },
  /** 賽法博士：異星生物學家。長辮子、圓眼鏡、實驗袍、手上發紫光的異晶樣本瓶 */
  sefa(p) {
    const skin = SKIN.d, hair = ramp(0x1a1418);
    // 長辮子垂到肩後
    for (const x of [19, 45]) for (let y = 36; y < 72; y += 3) p.ell(x, y, 2, 2, hair[y % 2 ? 2 : 1]);
    body(p, 0xe8ecf0, { seam: false });
    const L = ramp(0xe8ecf0);
    p.poly([29, 55, 35, 55, 36, 80, 28, 80], 0x3a6a6a);                   // 裡面的深色衣服
    p.line(28, 55, 24, 80, L[1]); p.line(36, 55, 40, 80, L[1]);          // 實驗袍前襟
    p.rect(42, 70, 5, 1, 0x3a8ad0);                                       // 口袋裡的筆
    // 樣本瓶
    p.rect(46, 60, 6, 11, 0xc8e0e8); p.rect(47, 63, 4, 7, 0xb070ff); p.rect(47, 60, 4, 2, 0x8a94a4);
    p.set(48, 64, 0xf0d8ff);
    neck(p, skin); head(p, skin, { ry: 13.5 });
    // 頭髮往後梳、髮際線
    p.ell(32, 25, 12, 6, (dx, dy) => hair[dy < -0.3 ? 3 : 2]);
    p.rect(20, 26, 3, 12, hair[2]); p.rect(42, 26, 3, 12, hair[1]);
    // 圓眼鏡
    for (const x of [27, 37]) { p.ell(x, 37.5, 3.2, 2.8, (dx, dy) => (dx * dx + dy * dy > 0.5 ? 0xd0b060 : null)); }
    p.rect(30, 37, 4, 1, 0xd0b060);
    eyes(p, 0x2a1a10); brows(p, hair[0], 'up'); nose(p, skin); mouth(p, 'open', skin);
    p.set(26, 36, 0xffffff);                                              // 鏡片反光
  },
  /** 沃斯：赫利昂前監工。油頭帶灰白、深藍制服與金色企業徽章、挑眉的冷笑 */
  voss(p) {
    const skin = SKIN.a, hair = ramp(0x3a3438);
    body(p, 0x243050);
    const U = ramp(0x243050);
    p.rect(21, 55, 23, 4, U[3]); p.rect(28, 55, 9, 6, 0xe8ecf0); p.rect(31, 56, 3, 8, 0x8a1a2a);  // 高領與領帶
    p.poly([40, 66, 46, 66, 43, 71], 0xe0b040); p.set(43, 67, 0xfff0a0);  // 赫利昂徽章
    p.rect(14, 60, 6, 2, 0xe0b040); p.rect(44, 60, 6, 2, 0xe0b040);      // 肩章
    neck(p, skin); head(p, skin, { rx: 10.5, ry: 13.5 });
    // 往後梳的油頭，兩鬢灰白
    p.ell(32, 25, 12, 6, (dx, dy) => hair[dy < -0.2 ? 4 : 2]);
    p.poly([20, 26, 44, 26, 44, 30, 36, 28, 26, 28, 20, 31], hair[2]);
    p.rect(20, 29, 2, 7, 0xb8b4b0); p.rect(43, 29, 2, 7, 0xa8a4a0);
    for (let x = 24; x < 42; x += 3) p.set(x, 24, hair[4]);               // 髮油反光
    eyes(p, 0x6a7a8a, { gap: 5 }); brows(p, hair[1], 'raise'); nose(p, skin); mouth(p, 'smirk', skin);
    p.rect(27, 47, 11, 1, ramp(skin)[1]);                                  // 方下巴
  },
  /** 卡爾德使者：赫利昂的使者。整齊側分、圓框小眼鏡、白色高領禮服、寫字板、禮貌微笑 */
  calder(p) {
    const skin = SKIN.e, hair = ramp(0x8a7a60);
    body(p, 0xd8dce4);
    const G = ramp(0xd8dce4);
    p.rect(21, 55, 23, 5, G[3]); p.rect(21, 59, 23, 1, 0xe0b040);       // 高領與金邊
    for (let y = 64; y < 80; y += 4) p.set(32, y, 0xe0b040);              // 金扣
    // 寫字板
    p.poly([10, 64, 26, 62, 28, 80, 12, 80], (x, y) => (y < 65 ? 0x8a6a4a : 0xf0ece0));
    p.rect(16, 61, 6, 3, 0xa0a8b4);
    for (let y = 68; y < 79; y += 3) p.line(14, y, 25, y - 1, 0x9a9aaa);
    p.set(22, 70, 0x3aa060); p.set(23, 69, 0x3aa060);                     // 打勾
    neck(p, skin); head(p, skin, { rx: 10.5 });
    // 整齊側分
    p.ell(32, 26, 12, 6, (dx, dy) => hair[dy < -0.2 ? 3 : 2]);
    p.poly([20, 27, 28, 24, 44, 27, 44, 31, 30, 28, 20, 31], hair[2]);
    p.line(28, 22, 27, 27, hair[4]);                                       // 分線
    // 小圓眼鏡
    for (const x of [27, 37]) p.ell(x, 37.5, 2.6, 2.3, (dx, dy) => (dx * dx + dy * dy > 0.45 ? 0x8a8a9a : null));
    p.rect(30, 37, 4, 1, 0x8a8a9a);
    eyes(p, 0x4a4a5a, { closed: true }); brows(p, hair[1], 'up'); nose(p, skin); mouth(p, 'polite', skin);
  },
};
export const PORTRAIT_BG = {
  mara: [0x3a2a4a, 0x1a1428], teo: [0x3a2e2a, 0x1a1418], juno: [0x2a3a5a, 0x141a2e], ines: [0x2a3a34, 0x121a18],
  sefa: [0x3a2a5a, 0x16102a], voss: [0x1e2638, 0x0c0f18], calder: [0x383a44, 0x16161e],
};

/** 畫出一張立繪，回傳 canvas（64×80）。bg=false 時背景透明 */
export function renderPortrait(id, bg = true) {
  const p = new Pix();
  PORTRAITS[id](p);
  p.outline(0x140e1c);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (bg) { const [a, b] = PORTRAIT_BG[id]; background(ctx, a, b, id.length * 977 + 13); }
  const img = ctx.getImageData(0, 0, W, H);
  for (let i = 0; i < W * H; i++) {
    const c = p.d[i];
    if (c === -1) continue;
    img.data[i * 4] = (c >> 16) & 255; img.data[i * 4 + 1] = (c >> 8) & 255; img.data[i * 4 + 2] = c & 255; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
