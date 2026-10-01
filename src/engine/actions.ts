// 玩家操作：建造／升級、升級節點、工人指派、研究
import { COMMAND_CHAIN, DEF, GameState, Msg, makeCheckpoint, msg, notify } from './state';
import { formOf, BOOST_COST, RESEARCH_DEFS, boostActive, boostDuration, built, canAfford, idle, levelCost, pay, workerCap } from './formulas';

export type Why = Msg | null;

/** 不能建造／升級的原因；null 表示可以 */
/** 第 1 章（蓋好緊急營地之前）可以升級的建築與等級上限：拼裝的設備只能撐到這裡 */
export const CH1_CAP: Record<string, number> = { scrap_heap: 3, o2_scrubber: 3, algae_tank: 3 };
export function levelBlock(s: GameState, id: string): Why {
  const d = DEF[id], L = s.b[id].level;
  if (d.stage > s.stage) return msg('why.stage', { n: d.stage });
  if (L >= d.maxLevel) return msg('why.maxLevel');
  // 信標第 3 段之後要先做第 6 章的抉擇（放棄或保留異晶）
  if (id === 'orbital_beacon' && L >= 3 && !s.story.choice6) return msg('why.choice6');
  if (s.stage === 1 && CH1_CAP[id] && L >= CH1_CAP[id]) return msg('why.ch1Cap', { n: CH1_CAP[id] });
  if (d.kind === 'command') {
    const prev = COMMAND_CHAIN[COMMAND_CHAIN.indexOf(id) - 1];
    if (prev && !built(s, prev)) return msg('why.needPrev', { b: prev });
  }
  if (L > 0 && !built(s, 'emergency_camp') && !CH1_CAP[id]) return msg('why.needCamp');
  if (d.requires?.pop && s.pop < d.requires.pop) return msg('why.pop', { n: d.requires.pop });
  for (const [b, n] of Object.entries(d.requires?.levels ?? {})) if (s.b[b].level < n) return msg('why.needLevel', { b, n });
  if (d.requires?.raids && s.raid.won < d.requires.raids) return msg('why.raids', { n: d.requires.raids });
  if (d.requires?.credits && s.gov.creditsEarned < d.requires.credits) return msg('why.credits', { n: d.requires.credits });
  if (!canAfford(s, levelCost(s, id))) return msg('why.afford');
  return null;
}
export function levelUp(s: GameState, id: string): boolean {
  if (levelBlock(s, id)) return false;
  const d = DEF[id];
  pay(s, levelCost(s, id));
  s.b[id].level++;
  if (d.kind === 'command') {
    s.stage = d.commandLevel! + 1;
    notify(s, 'n.cmdBuilt', { b: id, n: s.stage }, 'good'); makeCheckpoint(s);
  } else if (id === 'orbital_beacon') {
    // 分段建造：第五段完成就是結局
    // 放棄異晶的路線：信標的核心拆下來造船，最後兩段改成造船
    const ship = s.story.choice6 === 'leave';
    if (s.b[id].level >= d.maxLevel) { s.finished = true; notify(s, ship ? 'n.shipDone' : 'n.beaconDone', undefined, 'good'); }
    else notify(s, ship && s.b[id].level > 3 ? 'n.shipPhase' : 'n.beaconPhase', { n: s.b[id].level, m: d.maxLevel }, 'good');
  } else notify(s, s.b[id].level === 1 ? 'n.built' : 'n.levelUp', { b: id, n: s.b[id].level }, 'good');
  // 軌道車線：蓋好後整個殖民地的道路鋪上石磚（地圖由 GameScene 依此重畫）
  if (id === 'rail_line' && s.b[id].level === 1) notify(s, 'n.paveStone', undefined, 'good');
  return true;
}

export function nodeBlock(s: GameState, id: string, nodeId: string): Why {
  const n = DEF[id].upgrades?.find((u) => u.id === nodeId);
  if (!n) return msg('why.none');
  if (s.b[id].nodes.includes(nodeId)) return msg('why.done');
  if (!built(s, 'emergency_camp')) return msg('why.campNode');
  if (n.stage && s.stage < n.stage) return msg('why.stage', { n: n.stage });
  if (s.b[id].level < n.minLevel) return msg('why.minLevel', { n: n.minLevel });
  if (!canAfford(s, n.cost)) return msg('why.afford');
  return null;
}
export function buyNode(s: GameState, id: string, nodeId: string): boolean {
  if (nodeBlock(s, id, nodeId)) return false;
  const n = DEF[id].upgrades!.find((u) => u.id === nodeId)!;
  pay(s, n.cost);
  s.b[id].nodes.push(nodeId);
  notify(s, 'n.node', { b: id, node: nodeId }, 'good');
  if (id === 'rail_line' && nodeId === 'double') notify(s, 'n.paveMetal', undefined, 'good');
  return true;
}

/** 改建：換成下一個形態，保留等級、工人與升級線 */
export function nextForm(s: GameState, id: string) {
  const forms = DEF[id].forms;
  return forms?.[s.b[id].form ?? 0] ?? null;
}
export function rebuildBlock(s: GameState, id: string): Why {
  const f = nextForm(s, id);
  if (!f) return msg('why.maxForm');
  if (!built(s, id)) return msg('why.notBuilt');
  if (s.stage < f.stage) return msg('why.stage', { n: f.stage });
  // 第 2 章的改建技術（電解站、生物採集站）是伊涅絲帶來的：要先把她救回來
  if (f.stage <= 2 && !s.story.ines) return msg('why.ines');
  if (!canAfford(s, f.cost)) return msg('why.afford');
  return null;
}
export function rebuild(s: GameState, id: string): boolean {
  if (rebuildBlock(s, id)) return false;
  const f = nextForm(s, id)!;
  pay(s, f.cost);
  s.b[id].form = (s.b[id].form ?? 0) + 1;
  notify(s, 'n.rebuilt', { b: id }, 'good');
  return true;
}
void formOf;

/** 生物工程室：注入異晶，全部產量短時間大幅提高 */
export function boostBlock(s: GameState): Why {
  if (!built(s, 'bioeng')) return msg('why.bioeng');
  if (boostActive(s)) return msg('why.boosting');
  if (!canAfford(s, BOOST_COST)) return msg('why.afford');
  return null;
}
export function startBoost(s: GameState): boolean {
  if (boostBlock(s)) return false;
  pay(s, BOOST_COST);
  s.boost.until = s.t + boostDuration(s);
  s.boost.uses++;
  notify(s, 'n.boost', { n: boostDuration(s) }, 'good');
  return true;
}

export function assign(s: GameState, id: string, delta: number): boolean {
  const b = s.b[id];
  if (delta > 0 && (idle(s) <= 0 || b.workers >= workerCap(s, id))) return false;
  if (delta < 0 && b.workers <= 0) return false;
  b.workers += delta > 0 ? 1 : -1;
  if (delta > 0) s.story.assigned = true;
  return true;
}

/** 加工建築：暫停／恢復（工人留在崗位，但不消耗原料） */
export function togglePause(s: GameState, id: string) {
  s.b[id].paused = !s.b[id].paused;
}

/** 鍛造廠：改做武器的工人數 */
export function setSplit(s: GameState, id: string, n: number) {
  const b = s.b[id];
  b.split = Math.max(0, Math.min(b.workers, n));
}

export function researchBlock(s: GameState, rid: string): Why {
  const r = RESEARCH_DEFS.find((x) => x.id === rid)!;
  if (!built(s, 'databank')) return msg('why.databank');
  if (s.research.done.includes(rid)) return msg('why.done');
  if (r.stage && s.stage < r.stage) return msg('why.stage', { n: r.stage });
  const miss = r.requires?.find((q) => !s.research.done.includes(q));
  if (miss) return msg('why.needRs', { rs: miss });
  if (r.lab && !built(s, 'xeno_lab')) return msg('why.lab');
  if (r.blueprint && !s.exp?.blueprints.includes(r.blueprint)) return msg('why.blueprint', { bp: r.blueprint });
  if (s.research.active) return msg('why.busy');
  if (!canAfford(s, r.cost)) return msg('why.afford');
  return null;
}
export function startResearch(s: GameState, rid: string): boolean {
  if (researchBlock(s, rid)) return false;
  const r = RESEARCH_DEFS.find((x) => x.id === rid)!;
  pay(s, r.cost);
  s.research.active = rid; s.research.progress = 0;
  return true;
}
export function research(s: GameState, dt: number, speed: number, quiet = false) {
  const rid = s.research.active;
  if (!rid) return;
  const r = RESEARCH_DEFS.find((x) => x.id === rid)!;
  s.research.progress += dt * speed;
  if (s.research.progress >= r.time) {
    s.research.done.push(rid); s.research.active = null; s.research.progress = 0;
    if (!quiet) notify(s, 'n.research', { rs: rid }, 'good');
  }
}
