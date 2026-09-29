// 建築位置固定（GDD §5）：指揮艙在中央，階段 1 內圈、階段 2 中圈、階段 3 外圈。
export const MW = 780, MH = 520;
export const CENTER = { x: 390, y: 250 };
export interface Site { id: string; x: number; y: number; r?: number; hub?: boolean }
export const SITES: Site[] = [
  { id: 'command', x: 390, y: 272, r: 34, hub: true },
  { id: 'escape_pod', x: 311, y: 254 },
  { id: 'scrap_heap', x: 469, y: 254 },
  { id: 'algae_tank', x: 390, y: 326 },
  { id: 'hab_pod', x: 222, y: 272 },
  { id: 'bio_harvester', x: 306, y: 364 },
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
  { id: 'hydro_farm', x: 130, y: 282 },
  { id: 'security', x: 654, y: 276 },
  { id: 'water_cycle', x: 390, y: 448 },
  { id: 'crystal_synth', x: 660, y: 452 },
  // 階段 5：四個角落與上緣
  { id: 'admin', x: 560, y: 74 },
  { id: 'trade_post', x: 220, y: 74 },
  { id: 'xeno_lab', x: 86, y: 152 },
  { id: 'turret', x: 712, y: 150 },
  { id: 'spaceport', x: 132, y: 474 },
];
/** 襲擊時異星生物從哪一側出現（依 incoming.side） */
export const RAID_SPAWN = [{ x: -14, y: 250 }, { x: 794, y: 240 }, { x: 390, y: -14 }, { x: 400, y: 536 }];
/** 預警結束時異星生物停下的位置：殖民地外圍的空地（避開左上、左下的介面面板），不會提早闖進建築群 */
export const RAID_RALLY = [{ x: 104, y: 214 }, { x: 706, y: 214 }, { x: 390, y: 44 }, { x: 480, y: 496 }];
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
function blockedGrid(target: Site, start: Pt, skip?: Site) {
  const g = new Uint8Array(GW * GH);
  for (const s of SITES) {
    if (s === target || s === skip) continue;
    const r = rectOf(s, 4);
    for (let gy = Math.max(0, Math.floor(r.y0 / CELL)); gy <= Math.min(GH - 1, Math.floor(r.y1 / CELL)); gy++)
      for (let gx = Math.max(0, Math.floor(r.x0 / CELL)); gx <= Math.min(GW - 1, Math.floor(r.x1 / CELL)); gx++) g[gy * GW + gx] = 1;
  }
  // 起點附近一律可走（指揮艙門口）
  for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++)
    if (Math.hypot(gx * CELL + 3 - start.x, gy * CELL + 3 - start.y) < 14) g[gy * GW + gx] = 0;
  return g;
}
function clearLine(g: Uint8Array, a: Pt, b: Pt) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
  for (let i = 0; i <= n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n, y = a.y + ((b.y - a.y) * i) / n;
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH || g[gy * GW + gx]) return false;
  }
  return true;
}
function findRoute(target: Site, ROAD_START: Pt = START, skip?: Site): Pt[] {
  const end: Pt = { x: target.x, y: target.y + 6 };
  const g = blockedGrid(target, ROAD_START, skip);
  if (clearLine(g, ROAD_START, end)) return [ROAD_START, end];
  const idx = (p: Pt) => Math.floor(p.y / CELL) * GW + Math.floor(p.x / CELL);
  const s0 = idx(ROAD_START), s1 = idx(end);
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
  if (from[s1] < 0) return [ROAD_START, end];
  const cells: Pt[] = [];
  for (let c = s1; c !== s0 && c >= 0; c = from[c]) cells.push({ x: (c % GW) * CELL + CELL / 2, y: Math.floor(c / GW) * CELL + CELL / 2 });
  cells.reverse();
  const pts = [ROAD_START, ...cells.slice(0, -1), end];
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
