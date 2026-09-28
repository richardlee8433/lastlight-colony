// 玩家操作：建造／升級、升級節點、工人指派、研究
import { COMMAND_CHAIN, DEF, GameState, makeCheckpoint, notify } from './state';
import { RESEARCH_DEFS, built, canAfford, idle, levelCost, pay, workerCap } from './formulas';

export type Why = string | null;

/** 不能建造／升級的原因；null 表示可以 */
export function levelBlock(s: GameState, id: string): Why {
  const d = DEF[id], L = s.b[id].level;
  if (d.stage > s.stage) return `階段 ${d.stage} 解鎖`;
  if (L >= d.maxLevel) return '已達最高等級';
  if (d.kind === 'command') {
    const prev = COMMAND_CHAIN[COMMAND_CHAIN.indexOf(id) - 1];
    if (prev && !built(s, prev)) return `需要先建成${DEF[prev].name}`;
  }
  if (L > 0 && !built(s, 'emergency_camp')) return '建成緊急營地後才能升級';
  if (d.requires?.pop && s.pop < d.requires.pop) return `需要人口 ${d.requires.pop}`;
  if (d.requires?.raids && s.raid.won < d.requires.raids) return `需要擊退 ${d.requires.raids} 次襲擊`;
  if (!canAfford(s, levelCost(s, id))) return '資源不足';
  return null;
}
export function levelUp(s: GameState, id: string): boolean {
  if (levelBlock(s, id)) return false;
  const d = DEF[id];
  pay(s, levelCost(s, id));
  s.b[id].level++;
  if (d.kind === 'command') {
    s.stage = d.commandLevel! + 1;
    if (id === 'colony_core') { s.finished = true; notify(s, '殖民地核心啟動了！第 4 章完成。', 'good'); }
    else { notify(s, `${d.name}建成，進入階段 ${s.stage}！`, 'good'); makeCheckpoint(s); }
  } else notify(s, s.b[id].level === 1 ? `${d.name}建成了。` : `${d.name}升到 Lv${s.b[id].level}。`, 'good');
  return true;
}

export function nodeBlock(s: GameState, id: string, nodeId: string): Why {
  const n = DEF[id].upgrades?.find((u) => u.id === nodeId);
  if (!n) return '不存在';
  if (s.b[id].nodes.includes(nodeId)) return '已完成';
  if (!built(s, 'emergency_camp')) return '建成緊急營地後解鎖';
  if (n.stage && s.stage < n.stage) return `階段 ${n.stage} 解鎖`;
  if (s.b[id].level < n.minLevel) return `需要 Lv${n.minLevel}`;
  if (!canAfford(s, n.cost)) return '資源不足';
  return null;
}
export function buyNode(s: GameState, id: string, nodeId: string): boolean {
  if (nodeBlock(s, id, nodeId)) return false;
  const n = DEF[id].upgrades!.find((u) => u.id === nodeId)!;
  pay(s, n.cost);
  s.b[id].nodes.push(nodeId);
  notify(s, `${DEF[id].name}：${n.name}（${n.desc}）`, 'good');
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
  if (!built(s, 'databank')) return '需要資料庫';
  if (s.research.done.includes(rid)) return '已完成';
  if (s.research.active) return '正在研究其他項目';
  if (r.requires && !s.research.done.includes(r.requires)) return '需要先完成前一項';
  if (!canAfford(s, r.cost)) return '資源不足';
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
    if (!quiet) notify(s, `研究完成：${r.name}（${r.desc}）`, 'good');
  }
}
