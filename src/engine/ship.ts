// 船塢與船的六個模組（v0.70）：第 3 章起在船塢一個一個裝上去。
// 模組 I～V 是長期的可選進度（不列入章節目標）；模組 VI 星際引擎要用信標的核心，只有第 6 章選了「離開」才能裝，裝好就是離開結局。
// 導航以後的模組要用到進口品（貨艙裡的電子元件、稀有金屬、燃料、醫療物資），所以造船跟交易站綁在一起。
import { GameState, Msg, ResKey, msg, notify } from './state';
import { built } from './formulas';
import { GOODS, Good } from './market';

export type ModCost = Partial<Record<ResKey | Good, number>>;
export interface ShipModule { id: string; stage: number; cost: ModCost }
export const MODULES: ShipModule[] = [
  { id: 'hull', stage: 3, cost: { metal: 300, parts: 200, rock: 300 } },
  { id: 'nav', stage: 4, cost: { electronics: 40, parts: 100 } },
  { id: 'life', stage: 4, cost: { tools: 80, electronics: 20, nutrient: 300 } },
  { id: 'supplies', stage: 5, cost: { nutrient: 600, medicine: 40 } },
  { id: 'fuel', stage: 5, cost: { fuel: 120 } },
  { id: 'drive', stage: 6, cost: { raremetal: 50, crystal: 40, tools: 100 } },
];
/** 離開之前要完成的模組數（I～V） */
export const READY_MODS = 5;

export const mods = (s: GameState) => s.ship?.mods ?? 0;
/** 船只差引擎（模組 I～V 都完成） */
export const shipReady = (s: GameState) => mods(s) >= READY_MODS;
/** 第 6 章朱諾取了名字（c6-name）之後，介面才叫它「曙光號」 */
export const shipNamed = (s: GameState) => !!s.story.seen?.includes('c6-name');

const isGood = (k: string): k is Good => (GOODS as string[]).includes(k);
/** 殖民地手上有多少（進口品看貨艙，其他看倉庫） */
export const have = (s: GameState, k: ResKey | Good) => (isGood(k) ? s.cargo?.[k] ?? 0 : s.res[k as ResKey] ?? 0);

/** 下一個模組不能裝的原因；null 表示可以 */
export function moduleBlock(s: GameState): Msg | null {
  const m = MODULES[mods(s)];
  if (!m) return msg('why.maxLevel');
  if (!built(s, 'shipyard')) return msg('why.shipyard');
  if (m.stage > s.stage) return msg('why.stage', { n: m.stage });
  // 星際引擎用的是信標的核心：第 6 章決定離開之後才拆得下來
  if (m.id === 'drive' && s.story.choice6 !== 'leave') return msg('why.drive');
  if (!(Object.entries(m.cost) as [ResKey | Good, number][]).every(([k, v]) => have(s, k) >= v)) return msg('why.afford');
  return null;
}
export function buildModule(s: GameState): boolean {
  if (moduleBlock(s)) return false;
  const m = MODULES[mods(s)];
  for (const [k, v] of Object.entries(m.cost) as [ResKey | Good, number][]) {
    if (isGood(k)) s.cargo[k] -= v; else s.res[k] -= v;
  }
  s.ship.mods++;
  if (m.id === 'drive') { s.finished = true; notify(s, 'n.shipDone', undefined, 'good'); }
  else notify(s, 'n.module', { m: m.id, n: s.ship.mods, t: READY_MODS }, 'good');
  return true;
}
