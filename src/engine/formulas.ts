// 所有數值公式集中在這裡（GDD §7、§8）
import RESEARCH from '../data/research.json';
import { DEF, DEFS, GameState, ResKey, RES_KEYS, Cost, Effect } from './state';

export const RESEARCH_DEFS = RESEARCH as unknown as { id: string; name: string; desc: string; cost: Cost; time: number; effect: Effect; requires?: string }[];
const RDEF = Object.fromEntries(RESEARCH_DEFS.map((r) => [r.id, r]));

export const built = (s: GameState, id: string) => s.b[id].level > 0;

/** 某建築已購買升級節點的效果加總（乘數型 critMul 相乘，其餘相加；foodWindow / buffDuration / recipeOut 取最後一個）。 */
export function nodeEffect(s: GameState, id: string, key: keyof Effect): number {
  const d = DEF[id];
  let v = key === 'critMul' ? 1 : 0;
  for (const n of d.upgrades ?? []) {
    if (!s.b[id].nodes.includes(n.id) || n.effect[key] == null) continue;
    if (key === 'critMul') v *= n.effect[key]!;
    else if (key === 'foodWindow' || key === 'buffDuration' || key === 'recipeOut') v = n.effect[key]!;
    else v += n.effect[key]!;
  }
  return v;
}
export function researchEffect(s: GameState, key: keyof Effect): number {
  let v = 0;
  for (const id of s.research.done) v += RDEF[id]?.effect[key] ?? 0;
  return v;
}
function sumNodes(s: GameState, key: keyof Effect) {
  let v = 0;
  for (const d of DEFS) if (built(s, d.id)) v += nodeEffect(s, d.id, key);
  return v;
}

export function storageCap(s: GameState): number {
  let cap = 100;
  for (const d of DEFS) {
    const L = s.b[d.id].level;
    if (!L || !d.effects?.storage) continue;
    cap += (d.effects.storage + nodeEffect(s, d.id, 'storagePerLevel')) * L;
  }
  return Math.floor(cap * (1 + researchEffect(s, 'storageMul')));
}
export function popCap(s: GameState): number {
  let cap = 0;
  for (const d of DEFS) {
    const L = s.b[d.id].level;
    if (!L) continue;
    cap += (d.effects?.housing ?? 0) * L + nodeEffect(s, d.id, 'housingAdd');
  }
  // 水循環站：每級生活艙多住 1 人
  if (built(s, 'water_cycle')) cap += (DEF.water_cycle.effects?.habBonus ?? 0) * s.b.hab_pod.level;
  return cap;
}
export function workerCap(s: GameState, id: string): number {
  const d = DEF[id];
  if (!d.workersPerLevel || !built(s, id)) return 0;
  return d.workersPerLevel * s.b[id].level + nodeEffect(s, id, 'workerCapAdd');
}
export function assignedTotal(s: GameState): number {
  let n = 0;
  for (const d of DEFS) n += s.b[d.id].workers;
  return n;
}
export const rescueWorkers = (s: GameState) => s.events.rescue?.workers ?? 0;
export const idle = (s: GameState) => s.pop - assignedTotal(s) - rescueWorkers(s);

/** 每位殖民者每秒消耗的營養（GDD 原值 0.1，實測糧食幾乎不會不夠，調高到 0.25） */
export let FOOD_PER_POP = 0.25;
export const setFoodPerPop = (v: number) => { FOOD_PER_POP = v; };
export const consumption = (s: GameState) => {
  let mul = researchEffect(s, 'consumeMul');
  for (const d of DEFS) if (d.effects?.consumeMul && built(s, d.id)) mul += d.effects.consumeMul;
  return s.pop * FOOD_PER_POP * Math.max(0.3, 1 + mul);
};
export function foodWindow(s: GameState) {
  return nodeEffect(s, 'lounge', 'foodWindow') || 120;
}
export function foodSafety(s: GameState): number {
  const need = s.pop * FOOD_PER_POP * foodWindow(s);
  if (need <= 0) return 1;
  const bonus = 1 + 0.1 * (built(s, 'lounge') ? s.b.lounge.workers : 0);
  return Math.min(1, (s.res.nutrient / need) * bonus);
}
export const birthBonus = (s: GameState) => {
  let v = sumNodes(s, 'birthAdd');
  for (const d of DEFS) if (d.effects?.birth) v += d.effects.birth * s.b[d.id].level;
  return v;
};
export function arrivalInterval(s: GameState): number {
  return 30 / (0.25 + foodSafety(s)) / (1 + birthBonus(s));
}
export function moraleTarget(s: GameState): number {
  let m = 60;
  if (foodSafety(s) > 0.5) m += 10;
  if (s.pop >= popCap(s) * 0.9) m -= 10;
  for (const d of DEFS) if (d.effects?.morale) m += d.effects.morale * s.b[d.id].level;
  m += sumNodes(s, 'moraleAdd');
  return Math.max(0, Math.min(100, m));
}
export const moraleMult = (s: GameState) => 0.8 + 0.4 * (s.morale / 100);

export const buffDuration = (s: GameState, id: string) => nodeEffect(s, id, 'buffDuration') || 5;
export const buffActive = (s: GameState, id: string) => s.t - s.b[id].lastClick <= buffDuration(s, id);
export const clickBuff = (s: GameState, id: string) => (buffActive(s, id) ? 1.25 : 1);
export const disabled = (s: GameState, id: string) => s.b[id].disabledUntil > s.t;

export function gatherBonus(s: GameState): number {
  let v = researchEffect(s, 'gatherAdd');
  if (built(s, 'rail_line')) v += (DEF.rail_line.effects?.gatherAdd ?? 0) + nodeEffect(s, 'rail_line', 'gatherAdd');
  return v;
}
/** 採集建築每秒產量 */
export function gatherRate(s: GameState, id: string): number {
  const d = DEF[id];
  if (!d.produce || !built(s, id) || disabled(s, id)) return 0;
  return s.b[id].workers * d.produce.rate * (1 + nodeEffect(s, id, 'prodAdd') + gatherBonus(s)) * moraleMult(s) * clickBuff(s, id);
}
/** 加工建築每秒「最多」消耗的原料 */
export function processInput(s: GameState, id: string): number {
  const d = DEF[id];
  if (!d.recipe || !built(s, id) || disabled(s, id) || s.b[id].paused) return 0;
  return s.b[id].workers * 1 * (1 + researchEffect(s, 'processAdd')) * moraleMult(s) * clickBuff(s, id);
}
export function recipeRatio(s: GameState, id: string): number {
  const d = DEF[id];
  return (nodeEffect(s, id, 'recipeOut') || d.recipe!.ratio) * (1 + nodeEffect(s, id, 'outMul'));
}

export const clickAmount = (s: GameState, id: string) => 1 + nodeEffect(s, id, 'clickAdd') + researchEffect(s, 'clickAdd');
export const critChance = (s: GameState, id: string) => 0.05 + nodeEffect(s, id, 'critAdd') + researchEffect(s, 'critAdd');
export const critMult = (s: GameState, id: string) => 5 * nodeEffect(s, id, 'critMul');
export const researchSpeed = (s: GameState) => (built(s, 'databank') ? s.b.databank.workers : 0) * (1 + nodeEffect(s, 'databank', 'researchSpeed'));

/** 建造／升級成本：初始成本 × 1.15^(目前等級)；Lv5 以上每級另需 工具 × 等級 */
export function levelCost(s: GameState, id: string): Cost {
  const d = DEF[id], L = s.b[id].level, out: Cost = {};
  for (const [k, v] of Object.entries(d.baseCost) as [ResKey, number][]) if (v) out[k] = Math.ceil(v * Math.pow(1.15, L));
  if (L >= 5) out.tools = (out.tools ?? 0) + L;
  return out;
}
export const canAfford = (s: GameState, c: Cost) => (Object.entries(c) as [ResKey, number][]).every(([k, v]) => s.res[k] >= v);
export const overCap = (s: GameState, c: Cost) => (Object.entries(c) as [ResKey, number][]).some(([, v]) => v > storageCap(s));
export function pay(s: GameState, c: Cost) {
  for (const [k, v] of Object.entries(c) as [ResKey, number][]) s.res[k] -= v;
}
export function add(s: GameState, k: ResKey, v: number, cap = storageCap(s)) {
  s.res[k] = Math.min(cap, s.res[k] + v);
}

/** 鍛造廠：分配到武器的工人比例（GDD §8：每位工人指定產品） */
export const WEAPON_RATIO = 0.3;
export function weaponShare(s: GameState, id: string) {
  const b = s.b[id];
  if (id !== 'forge' || s.stage < 4 || !b.workers) return 0;
  return Math.min(b.split ?? 0, b.workers) / b.workers;
}

/** 每秒淨變化（UI 顯示用） */
export function netRates(s: GameState): Record<ResKey, number> {
  const r = Object.fromEntries(RES_KEYS.map((k) => [k, 0])) as Record<ResKey, number>;
  for (const d of DEFS) if (d.produce) r[d.produce.res] += gatherRate(s, d.id);
  for (const d of DEFS) {
    if (d.recipe) {
      // 原料見底時，加工只能用掉「當下產出的量」：實際消耗＝需求與供給取小
      const supply = s.res[d.recipe.in] > 1 ? Infinity : Math.max(0, r[d.recipe.in]);
      const inp = Math.min(processInput(s, d.id), supply);
      const ws = weaponShare(s, d.id);
      r[d.recipe.in] -= inp;
      r[d.recipe.out] += inp * (1 - ws) * recipeRatio(s, d.id);
      r.weapon += inp * ws * WEAPON_RATIO;
    }
  }
  r.nutrient -= consumption(s);
  return r;
}
