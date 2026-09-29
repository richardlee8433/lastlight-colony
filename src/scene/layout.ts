// 建築位置固定（GDD §5）：指揮艙在中央，階段 1 內圈、階段 2 中圈、階段 3 外圈。
// 地圖四周留一圈空地（OX、OY），邊緣的建築不會被畫面邊界或介面面板擋住；下面的座標都是舊地圖座標，最後統一平移
const OX = 110, OY = 100;
export const MW = 780 + OX * 2, MH = 520 + OY * 2;
export const CENTER = { x: 390 + OX, y: 250 + OY };
export interface Site { id: string; x: number; y: number; r?: number; hub?: boolean }
const RAW_SITES: Site[] = [
  { id: 'command', x: 390, y: 272, r: 34, hub: true },
  { id: 'escape_pod', x: 311, y: 254 },
  { id: 'scrap_heap', x: 469, y: 254 },
  { id: 'algae_tank', x: 390, y: 326 },
  { id: 'hab_pod', x: 222, y: 272 },
  // v0.6 氧氣：再生器在逃生艙與藻類槽之間，電解站在生活艙下方
  { id: 'o2_scrubber', x: 306, y: 352 },
  { id: 'electrolyzer', x: 222, y: 340 },
  { id: 'cargo', x: 306, y: 184 },
  { id: 'lounge', x: 474, y: 184 },
  { id: 'assembly', x: 558, y: 272 },
  { id: 'rock_cutter', x: 474, y: 364 },
  { id: 'databank', x: 212, y: 166 },
  { id: 'metal_mine', x: 568, y: 166 },
  { id: 'forge', x: 568, y: 388 },
  { id: 'rail_line', x: 212, y: 390 },
  // 階段 4：最外圈
  { id: 'memorial', x: 390, y: 126 },
  { id: 'security', x: 654, y: 276 },
  { id: 'water_cycle', x: 390, y: 448 },
  { id: 'crystal_synth', x: 660, y: 452 },
  { id: 'med_bay', x: 612, y: 336 },
  // 階段 6：外圍四個角落
  { id: 'governor', x: 510, y: 466 },
  { id: 'sky_residence', x: 70, y: 390 },
  { id: 'bioeng', x: 726, y: 372 },
  { id: 'orbital_beacon', x: 262, y: 470 },
  // 階段 5：四個角落與上緣
  { id: 'admin', x: 560, y: 74 },
  { id: 'trade_post', x: 220, y: 74 },
  { id: 'xeno_lab', x: 86, y: 152 },
  { id: 'turret', x: 712, y: 150 },
  { id: 'spaceport', x: 132, y: 474 },
];
export const SITES: Site[] = RAW_SITES.map((s) => ({ ...s, x: s.x + OX, y: s.y + OY }));
/** 襲擊時異星生物從哪一側出現（依 incoming.side）：地圖四邊外側 */
export const RAID_SPAWN = [{ x: -14, y: CENTER.y }, { x: MW + 14, y: CENTER.y - 10 }, { x: CENTER.x, y: -14 }, { x: CENTER.x + 10, y: MH + 14 }];
/** 預警結束時異星生物停下的位置：殖民地外圍的空地，不會提早闖進建築群 */
export const RAID_RALLY = [{ x: 60, y: 214 }, { x: 750, y: 214 }, { x: 390, y: 20 }, { x: 480, y: 520 }].map((p) => ({ x: p.x + OX, y: p.y + OY }));
export const HOME = { x: CENTER.x, y: CENTER.y + 30 };

// ── 道路：從指揮艙前方繞開其他建築走到每棟建築門口（A* 網格尋路＋拉直），道路與工人走路共用 ──
export type Pt = { x: number; y: number };
export const ROAD_START: Pt = { x: CENTER.x, y: CENTER.y + 22 };
const START = ROAD_START;
const CELL = 6, GW = Math.ceil(MW / CELL), GH = Math.ceil(MH / CELL);
/** 建築佔地（地圖座標）：寬 ±26，往上 34、往下 10；再外擴一點讓路不貼著牆 */
function rectOf(s: Site, pad = 0) {
  if (s.hub) return { x0: s.x - 46 - pad, x1: s.x + 46 + pad, y0: s.y - 44 - pad, y1: s.y - 4 };
  return { x0: s.x - 26 - pad, x1: s.x + 26 + pad, y0: s.y - 34 - pad, y1: s.y + 10 + pad };
}
function blockedGrid(skip: Site[], free: Pt[]) {
  const g = new Uint8Array(GW * GH);
  for (const s of SITES) {
    if (skip.includes(s)) continue;
    const r = rectOf(s, 4);
    for (let gy = Math.max(0, Math.floor(r.y0 / CELL)); gy <= Math.min(GH - 1, Math.floor(r.y1 / CELL)); gy++)
      for (let gx = Math.max(0, Math.floor(r.x0 / CELL)); gx <= Math.min(GW - 1, Math.floor(r.x1 / CELL)); gx++) g[gy * GW + gx] = 1;
  }
  // 起點、終點附近一律可走（例如指揮艙門口）
  for (const p of free) for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++)
    if (Math.hypot(gx * CELL + 3 - p.x, gy * CELL + 3 - p.y) < 14) g[gy * GW + gx] = 0;
  return g;
}
function clearLine(g: Uint8Array, a: Pt, b: Pt) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || g[gy * GW + gx]) return false;
  }
  return true;
}
/** A* 網格尋路＋拉直：從 a 走到 b，避開所有建築（skip 裡的除外） */
function findPath(a: Pt, b: Pt, skip: Site[] = []): Pt[] {
  const g = blockedGrid(skip, [a, b]);
  if (clearLine(g, a, b)) return [a, b];
  const idx = (p: Pt) => Math.floor(p.y / CELL) * GW + Math.floor(p.x / CELL);
  const s0 = idx(a), s1 = idx(b);
  const cost = new Float32Array(GW * GH).fill(Infinity), from = new Int32Array(GW * GH).fill(-1), done = new Uint8Array(GW * GH);
  const h = (i: number) => Math.hypot((i % GW) - (s1 % GW), Math.floor(i / GW) - Math.floor(s1 / GW));
  const open: number[] = [s0];
  cost[s0] = 0;
  while (open.length) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (cost[open[k]] + h(open[k]) < cost[open[bi]] + h(open[bi])) bi = k;
    const c = open.splice(bi, 1)[0];
    if (c === s1) break;
    if (done[c]) continue;
    done[c] = 1;
    const cx = c % GW, cy = Math.floor(c / GW);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 1 || ny < 1 || nx >= GW - 1 || ny >= GH - 1) continue;
      const n = ny * GW + nx;
      if (g[n] && n !== s1) continue;
      const nc = cost[c] + (dx && dy ? 1.414 : 1);
      if (nc < cost[n]) { cost[n] = nc; from[n] = c; open.push(n); }
    }
  }
  if (from[s1] < 0) return [a, b];
  const cells: Pt[] = [];
  for (let c = s1; c !== s0 && c >= 0; c = from[c]) cells.push({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
  cells.reverse();
  const pts = [a, ...cells.slice(0, -1), b];
  // 拉直：從目前點直接連到看得到的最遠點
  const out: Pt[] = [pts[0]];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !clearLine(g, pts[i], pts[j])) j--;
    out.push({ x: Math.round(pts[j].x), y: Math.round(pts[j].y) });
    i = j;
  }
  // 再拿掉可以直接跳過的轉折點
  for (let k = 1; k < out.length - 1; ) {
    if (clearLine(g, out[k - 1], out[k + 1])) out.splice(k, 1); else k++;
  }
  return out;
}
const doorOf = (s: Site): Pt => ({ x: s.x, y: s.y + 6 });
function findRoute(target: Site, start: Pt = START, skip?: Site): Pt[] {
  return findPath(start, doorOf(target), skip ? [target, skip] : [target]);
}
/** 每棟建築的道路折線（第一點是指揮艙門口，最後一點是建築門口） */
export const ROUTES: Record<string, Pt[]> = Object.fromEntries(SITES.filter((s) => !s.hub).map((s) => [s.id, findRoute(s)]));

/** 還沒有緊急營地時，殖民者以逃生艙為家：從逃生艙門口走到各建築的路線 */
const podSite = SITES.find((s) => s.id === 'escape_pod')!;
export const POD_DOOR: Pt = { x: podSite.x, y: podSite.y + 10 };
const podRoutes: Record<string, Pt[]> = {};
export function routeFromPod(id: string): Pt[] {
  const site = SITES.find((s) => s.id === id);
  if (!site || site === podSite) return [POD_DOOR];
  return (podRoutes[id] ??= findRoute(site, POD_DOOR, podSite));
}

/** 陸戰隊巡邏路線：繞著殖民地外圍的一圈（橢圓上取點，點與點之間用尋路避開建築），首尾相接 */
function patrolLoop(): Pt[] {
  const g = blockedGrid([], []);
  const free = (p: Pt) => {
    for (let r = 0; r < 60; r += 3) for (let a = 0; a < 16; a++) {
      const q = { x: Math.round(p.x + Math.cos((a / 16) * Math.PI * 2) * r), y: Math.round(p.y + Math.sin((a / 16) * Math.PI * 2) * r) };
      const gx = Math.floor(q.x / CELL), gy = Math.floor(q.y / CELL);
      if (gx > 1 && gy > 1 && gx < GW - 2 && gy < GH - 2 && !g[gy * GW + gx]) return q;
    }
    return p;
  };
  const N = 14, ring: Pt[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    ring.push(free({ x: CENTER.x + Math.cos(a) * 318, y: CENTER.y + 20 + Math.sin(a) * 206 }));
  }
  const out: Pt[] = [];
  for (let i = 0; i < N; i++) out.push(...findPath(ring[i], ring[(i + 1) % N]).slice(0, -1));
  out.push(out[0]);
  return out;
}
export const PATROL = patrolLoop();
const PATROL_LEN = PATROL.slice(1).reduce((acc, p, i) => { acc.push(acc[i] + Math.hypot(p.x - PATROL[i].x, p.y - PATROL[i].y)); return acc; }, [0]);
export const PATROL_TOTAL = PATROL_LEN[PATROL_LEN.length - 1];
/** 巡邏路線上距離起點 d 的位置與行進方向 */
export function patrolAt(d: number): { x: number; y: number; dir: number } {
  d = ((d % PATROL_TOTAL) + PATROL_TOTAL) % PATROL_TOTAL;
  let i = 1;
  while (i < PATROL_LEN.length - 1 && PATROL_LEN[i] < d) i++;
  const a = PATROL[i - 1], b = PATROL[i], seg = PATROL_LEN[i] - PATROL_LEN[i - 1] || 1, t = (d - PATROL_LEN[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, dir: Math.sign(b.x - a.x) || 1 };
}

/** 任意兩點之間繞開建築的路線（陸戰隊出擊、回防用） */
export const pathBetween = (a: Pt, b: Pt) => findPath(a, b);
/** 折線上比例 t（0–1）的位置 */
export function along(pts: Pt[], t: number): Pt & { dir: number } {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const d = Math.max(0, Math.min(1, t)) * lens[lens.length - 1];
  let i = 1;
  while (i < pts.length - 1 && lens[i] < d) i++;
  const a = pts[i - 1], b = pts[i] ?? a, seg = lens[i] - lens[i - 1] || 1, u = (d - lens[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, dir: Math.sign(b.x - a.x) || 1 };
}
