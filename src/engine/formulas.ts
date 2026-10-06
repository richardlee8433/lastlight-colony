// 所有數值公式集中在這裡（GDD §7、§8）
import RESEARCH from '../data/research.json';
import { AIR_ENABLED, DEF, DEFS, GameState, ResKey, RES_KEYS, UNCAPPED, Cost, Effect, BuildingForm } from './state';
import { HYPOXIA_PROD, lifeSupportRate, oxygenByproduct, oxygenUse } from './air';
import CHARTERS from '../data/charters.json';

export const CHARTER_DEFS = CHARTERS as unknown as { id: string; name: string; desc: string; cost: string; effect: Record<string, number> }[];
const CDEF = Object.fromEntries(CHARTER_DEFS.map((c) => [c.id, c]));
/** 已生效憲章的某項效果加總 */
export function charterEffect(s: GameState, key: string): number {
  let v = 0;
  for (const id of s.gov?.charters ?? []) v += CDEF[id]?.effect[key] ?? 0;
  return v;
}
/** 全域產量倍率（憲章：雙班制、休息日） */
export const prodMul = (s: GameState) => (1 + charterEffect(s, 'prodMul') + boostBonus(s)) * (s.air?.hypoxic ? HYPOXIA_PROD : 1);
/** 生物工程室：注入異晶後全部產量 +30%／+40%／+50%（依等級），持續 90／120／150 秒 */
export const boostPower = (s: GameState) => 0.2 + 0.1 * (s.b.bioeng?.level ?? 0);
export const boostDuration = (s: GameState) => 60 + 30 * (s.b.bioeng?.level ?? 0);
export const BOOST_COST = { crystal: 40, nutrient: 300 };
export const boostActive = (s: GameState) => !!s.boost && s.t < s.boost.until;
export const boostBonus = (s: GameState) => (boostActive(s) ? boostPower(s) : 0);
/** 單一資源產量加成（憲章與研究：異晶、金屬） */
export function resBonus(s: GameState, k: ResKey): number {
  if (k === 'crystal') return charterEffect(s, 'crystalAdd') + researchEffect(s, 'crystalAdd');
  if (k === 'metal') return charterEffect(s, 'metalAdd');
  if (k === 'oxygen') return researchEffect(s, 'o2Add');   // 藍圖科技：高壓濾網
  if (k === 'credit') return charterEffect(s, 'creditMul');
  return 0;
}

/** 科技樹：branch＝分支（prod 生產、life 民生、war 軍事），tier＝第幾欄，requires＝前置科技 */
export interface ResearchDef { id: string; name: string; desc: string; cost: Cost; time: number; effect: Effect; branch: 'prod' | 'life' | 'war'; tier: number; stage: number; requires?: string[]; lab?: boolean; /** 需要先從探勘取得的藍圖 */ blueprint?: string }
export const RESEARCH_DEFS = RESEARCH as unknown as ResearchDef[];
const RDEF = Object.fromEntries(RESEARCH_DEFS.map((r) => [r.id, r]));

export const built = (s: GameState, id: string) => s.b[id].level > 0;
/** 逃生艙在紀念堂蓋好後退役：不再出現在地圖與建造列，效果（人口、倉儲、求救頻段）照算，併入紀念堂 */
export const retired = (s: GameState, id: string) => id === 'escape_pod' && built(s, 'memorial');
/** 退役時求救頻段還沒買的，直接送（之後沒有地方可以買了） */
export function retirePod(s: GameState) {
  if (retired(s, 'escape_pod') && !s.b.escape_pod.nodes.includes('beacon')) s.b.escape_pod.nodes.push('beacon');
}

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
  cap += researchEffect(s, 'habBonus') * s.b.hab_pod.level;
  return cap;
}
/** 目前的改建形態（沒有改建過是 null） */
export function formOf(s: GameState, id: string): BuildingForm | null {
  const f = s.b[id]?.form ?? 0;
  return f > 0 ? DEF[id].forms?.[f - 1] ?? null : null;
}
/** 畫面用的美術 id（改建後換成新形態的外觀） */
/** 船塢的圖跟著模組換：空船塢 → 骨架（船體）→ 大致成形（導航、維生）→ 只差引擎（補給、燃料以後） */
function shipyardArt(s: GameState) { const m = s.ship?.mods ?? 0; return m >= 4 ? 'shipyard_3' : m >= 2 ? 'shipyard_2' : m >= 1 ? 'shipyard_1' : 'shipyard'; }
export const artId = (s: GameState, id: string) => (id === 'shipyard' ? shipyardArt(s) : formOf(s, id)?.art ?? id);
/** 第 5 章開始後累計賺進的信用點 */
export const creditsCh5 = (s: GameState) => (s.stage >= 5 ? s.gov.creditsEarned - (s.gov.credits5 ?? 0) : 0);
/** 異星研究院：科技研究院在第 5 章改建後的形態（原本是另一棟建築，v0.70 合併） */
export const hasXenoLab = (s: GameState) => built(s, 'databank') && (s.b.databank.form ?? 0) >= 1;
export function workerCap(s: GameState, id: string): number {
  const d = DEF[id];
  if (!d.workersPerLevel || !built(s, id)) return 0;
  return (formOf(s, id)?.workersPerLevel ?? d.workersPerLevel) * s.b[id].level + nodeEffect(s, id, 'workerCapAdd');
}
export function assignedTotal(s: GameState): number {
  let n = 0;
  for (const d of DEFS) n += s.b[d.id].workers;
  return n;
}
export const rescueWorkers = (s: GameState) => s.events.rescue?.workers ?? 0;
/** 戰鬥中受傷、正在休養的一般殖民者 */
export const hurtCivilians = (s: GameState) => s.raid?.hurt?.length ?? 0;
export const idle = (s: GameState) => s.pop - assignedTotal(s) - rescueWorkers(s) - hurtCivilians(s) - (s.exp?.team ?? 0);

/** 每位殖民者每秒消耗的營養（GDD 原值 0.1，實測糧食幾乎不會不夠，調高到 0.25） */
export let FOOD_PER_POP = 0.1;
export const setFoodPerPop = (v: number) => { FOOD_PER_POP = v; };
export const consumption = (s: GameState) => {
  let mul = researchEffect(s, 'consumeMul') + charterEffect(s, 'consumeMul');
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
  let v = sumNodes(s, 'birthAdd') + charterEffect(s, 'birthAdd');
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
  m += charterEffect(s, 'morale') - 5 * (s.gov?.tax ?? 0);
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
  return s.b[id].workers * (formOf(s, id)?.rate ?? d.produce.rate) * (1 + nodeEffect(s, id, 'prodAdd') + gatherBonus(s) + resBonus(s, d.produce.res)) * moraleMult(s) * clickBuff(s, id) * prodMul(s);
}
/** 加工建築每秒「最多」消耗的原料 */
export function processInput(s: GameState, id: string): number {
  const d = DEF[id];
  if (!d.recipe || !built(s, id) || disabled(s, id) || s.b[id].paused) return 0;
  return s.b[id].workers * 1 * (1 + researchEffect(s, 'processAdd')) * moraleMult(s) * clickBuff(s, id) * prodMul(s);
}
export function recipeRatio(s: GameState, id: string): number {
  const d = DEF[id];
  return (nodeEffect(s, id, 'recipeOut') || d.recipe!.ratio) * (1 + nodeEffect(s, id, 'outMul'));
}

export const clickAmount = (s: GameState, id: string) => 1 + nodeEffect(s, id, 'clickAdd') + researchEffect(s, 'clickAdd');
export const critChance = (s: GameState, id: string) => 0.05 + nodeEffect(s, id, 'critAdd') + researchEffect(s, 'critAdd');
export const critMult = (s: GameState, id: string) => 5 * nodeEffect(s, id, 'critMul');
export const researchSpeed = (s: GameState) =>
  (built(s, 'databank') ? s.b.databank.workers : 0) * (1 + nodeEffect(s, 'databank', 'researchSpeed'));
/** 稅收：人口 × 0.02 × 稅率等級（GDD §11），受「企業合約」加成 */
export const taxIncome = (s: GameState) => (built(s, 'admin') ? s.pop * 0.02 * (s.gov?.tax ?? 0) * (1 + resBonus(s, 'credit')) : 0);
export const charterSlots = (s: GameState) => (built(s, 'admin') ? 1 + nodeEffect(s, 'admin', 'charterSlot') + (built(s, 'governor') ? 1 : 0) : 0);

/** 建造／升級成本：初始成本 × 1.15^(目前等級)；Lv5 以上每級另需 工具 × 等級 */
export function levelCost(s: GameState, id: string): Cost {
  const d = DEF[id], L = s.b[id].level, out: Cost = {};
  const cut = 1 + researchEffect(s, 'costMul');   // 藍圖科技：共振工具
  for (const [k, v] of Object.entries(formOf(s, id)?.baseCost ?? d.baseCost) as [ResKey, number][]) if (v) out[k] = Math.ceil(v * (d.flatCost ? 1 : Math.pow(1.15, L)) * cut);
  if (L >= 5 && !d.flatCost) out.tools = (out.tools ?? 0) + L;
  return out;
}
export const canAfford = (s: GameState, c: Cost) => (Object.entries(c) as [ResKey, number][]).every(([k, v]) => s.res[k] >= v);
export const overCap = (s: GameState, c: Cost) => (Object.entries(c) as [ResKey, number][]).some(([k, v]) => !UNCAPPED.includes(k) && v > storageCap(s));
export function pay(s: GameState, c: Cost) {
  for (const [k, v] of Object.entries(c) as [ResKey, number][]) s.res[k] -= v;
}
export function add(s: GameState, k: ResKey, v: number, cap = storageCap(s)) {
  if (UNCAPPED.includes(k)) {
    s.res[k] += v;
    if (k === 'credit' && v > 0 && s.gov) s.gov.creditsEarned += v;
    return;
  }
  s.res[k] = Math.min(cap, s.res[k] + v);
}

/** 鍛造廠：分配到武器的工人比例（GDD §8：每位工人指定產品） */
export const WEAPON_RATIO = 0.3;
/** 金屬換武器的比率，受研究「兵工產線」加成 */
export const weaponRatio = (s: GameState) => WEAPON_RATIO * (1 + researchEffect(s, 'weaponOut'));
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
      r.weapon += inp * ws * weaponRatio(s);
    }
  }
  r.nutrient -= consumption(s);
  if (AIR_ENABLED) r.oxygen += lifeSupportRate(s) + oxygenByproduct(s) - oxygenUse(s);
  r.credit += taxIncome(s);
  return r;
}
