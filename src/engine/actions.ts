// 玩家操作：建造／升級、升級節點、工人指派、研究
import { COMMAND_CHAIN, DEF, GameState, Msg, makeCheckpoint, msg, notify } from './state';
import { RESEARCH_DEFS, built, canAfford, idle, levelCost, pay, workerCap } from './formulas';

export type Why = Msg | null;

/** 不能建造／升級的原因；null 表示可以 */
export function levelBlock(s: GameState, id: string): Why {
  const d = DEF[id], L = s.b[id].level;
  if (d.stage > s.stage) return msg('why.stage', { n: d.stage });
  if (L >= d.maxLevel) return msg('why.maxLevel');
  if (d.kind === 'command') {
    const prev = COMMAND_CHAIN[COMMAND_CHAIN.indexOf(id) - 1];
    if (prev && !built(s, prev)) return msg('why.needPrev', { b: prev });
  }
  if (L > 0 && !built(s, 'emergency_camp')) return msg('why.needCamp');
  if (d.requires?.pop && s.pop < d.requires.pop) return msg('why.pop', { n: d.requires.pop });
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
    if (id === 'star_dome') { s.finished = true; notify(s, 'n.domeDone', undefined, 'good'); }
    else { notify(s, 'n.cmdBuilt', { b: id, n: s.stage }, 'good'); makeCheckpoint(s); }
  } else notify(s, s.b[id].level === 1 ? 'n.built' : 'n.levelUp', { b: id, n: s.b[id].level }, 'good');
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
