// 建造計時（v0.71）：建造與升級不再瞬間完成，付了材料之後要等工地蓋好。
// 同一時間只能有一個工地（buildSlots，之後可以由科技或建築加開第二個）；
// 視窗開著時遊戲暫停，工地跟著停；離線時照常施工（跟研究不一樣，不打折）。
import { COMMAND_CHAIN, DEF, GameState, makeCheckpoint, notify } from './state';
import { retirePod } from './formulas';

/** 各章建築的基本工期（秒），依建築解鎖的章節：第 1 章幾秒、中期 20～60 秒 */
const STAGE_BASE = [0, 4, 15, 30, 45, 60, 75];
/** 指揮建築與信標：章節的里程碑，最長 2～3 分鐘 */
const CMD_TIME: Record<string, number> = { emergency_camp: 10, central_hub: 45, outpost: 75, colony_core: 120, star_dome: 150, orbital_beacon: 150 };
/** 第一次蓋的幾棟（新手前一分鐘）幾乎不用等 */
const FIRST: Record<string, number> = { o2_scrubber: 2, algae_tank: 3 };
/** 每升一級工期多 12%，但一般建築最多 3 分鐘 */
const LEVEL_MUL = 0.12, MAX_TIME = 180;
/** 催工（點擊工地加速）：引擎有實作，但 v0.71 先不開放給玩家（Richard 決定），介面與地圖都沒有接。每次省的秒數＝工期的 1%（至少 0.3 秒），累計最多省一半 */
export const HURRY_CAP = 0.5;
export const hurryStep = (need: number) => Math.max(0.3, need * 0.01);

/** 同時可以開工的工地數（之後的科技／建築可以加到 2） */
export const buildSlots = (_s: GameState) => 1;

/** 蓋到下一級要幾秒 */
export function buildTime(s: GameState, id: string): number {
  const d = DEF[id], L = s.b[id].level;
  if (CMD_TIME[id]) return CMD_TIME[id];
  if (L === 0 && FIRST[id]) return FIRST[id];
  let t = STAGE_BASE[Math.min(6, d.stage)] ?? 60;
  if (d.maxLevel === 1) t *= 1.5;              // 一次蓋完的設施（軌道車線、水循環、行政中心…）
  else t *= 1 + LEVEL_MUL * L;
  return Math.min(MAX_TIME, Math.round(t));
}

/** 正在施工的建築 id（最多 buildSlots 個） */
export function activeBuilds(s: GameState): string[] {
  const out: string[] = [];
  for (const id in s.b) if (s.b[id].build) out.push(id);
  return out;
}
export const isBuilding = (s: GameState, id: string) => !!s.b[id]?.build;
/** 施工進度 0～1 */
export const buildProgress = (s: GameState, id: string) => { const b = s.b[id].build; return b ? Math.min(1, b.done / b.need) : 0; };
/** 還要幾秒 */
export const buildLeft = (s: GameState, id: string) => { const b = s.b[id].build; return b ? Math.max(0, b.need - b.done) : 0; };

/** 開工：材料已經付過，記下目標等級與工期 */
export function startBuild(s: GameState, id: string) {
  s.b[id].build = { to: s.b[id].level + 1, need: buildTime(s, id), done: 0, hurried: 0 };
}

/** 點擊工地加速；回傳實際省下的秒數（0 表示已經到上限或沒有在施工） */
export function hurryBuild(s: GameState, id: string): number {
  const b = s.b[id].build;
  if (!b) return 0;
  const room = b.need * HURRY_CAP - b.hurried;
  const gain = Math.min(room, hurryStep(b.need));
  if (gain <= 0) return 0;
  b.hurried += gain; b.done += gain;
  return gain;
}

/** 每個 tick：工地往前推；蓋好就升級 */
export function construction(s: GameState, dt: number, quiet = false) {
  for (const id of activeBuilds(s)) {
    const b = s.b[id].build!;
    b.done += dt;
    if (b.done >= b.need) finishBuild(s, id, quiet);
  }
}

/** 完工：等級 +1，指揮建築推進章節（測試與模擬器也直接呼叫它，跳過等待） */
export function finishBuild(s: GameState, id: string, quiet = false) {
  const b = s.b[id];
  if (!b.build) return;
  const d = DEF[id];
  b.level = Math.max(b.level, b.build.to);
  delete b.build;
  if (d.kind === 'command') {
    s.stage = d.commandLevel! + 1;
    if (s.stage === 5) s.gov.credits5 = s.gov.creditsEarned;
    notify(s, 'n.cmdBuilt', { b: id, n: s.stage }, 'good'); makeCheckpoint(s);
  } else if (id === 'orbital_beacon') {
    // 分段建造：第五段完成就是結局（離開的路線改在船塢裝星際引擎，見 ship.ts）
    if (b.level >= d.maxLevel) { s.finished = true; notify(s, 'n.beaconDone', undefined, 'good'); }
    else notify(s, 'n.beaconPhase', { n: b.level, m: d.maxLevel }, 'good');
  } else if (!quiet) notify(s, b.level === 1 ? 'n.built' : 'n.levelUp', { b: id, n: b.level }, 'good');
  // 紀念堂蓋好：逃生艙退役（最後的外殼用在紀念堂上）
  if (id === 'memorial' && b.level === 1) { retirePod(s); notify(s, 'n.podRetired', undefined, 'good'); }
  // 軌道車線：蓋好後整個殖民地的道路鋪上石磚（地圖由 GameScene 依此重畫）
  if (id === 'rail_line' && b.level === 1) notify(s, 'n.paveStone', undefined, 'good');
}
/** 把所有工地立刻蓋完（測試、模擬器用） */
export function finishAllBuilds(s: GameState) { for (const id of activeBuilds(s)) finishBuild(s, id, true); }
void COMMAND_CHAIN;
