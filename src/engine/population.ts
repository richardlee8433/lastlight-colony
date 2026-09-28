// 食物安全度、營養消耗、殖民者抵達、士氣（GDD §7）
import { DEFS, GameState, notify } from './state';
import { arrivalInterval, consumption, idle, moraleTarget, popCap } from './formulas';

export const STARVE_GRACE = 60;   // 斷糧多久後開始有人離開（秒）
export const LEAVE_EVERY = 30;    // 之後每隔多久離開一人（秒）

/** 一位殖民者離開：先走閒置的，再從工人最多的建築走 */
function leave(s: GameState) {
  if (idle(s) <= 0) {
    let best: string | null = null;
    for (const d of DEFS) if (s.b[d.id].workers > 0 && (!best || s.b[d.id].workers > s.b[best].workers)) best = d.id;
    if (best) s.b[best].workers--;
  }
  s.pop -= 1;
}

export function population(s: GameState, dt: number, quiet = false) {
  const need = consumption(s) * dt;
  if (s.res.nutrient >= need) { s.res.nutrient -= need; s.starving = false; }
  else {
    if (!s.starving && !quiet) notify(s, 'n.starving', undefined, 'warn');
    s.res.nutrient = 0; s.starving = true;
  }
  const cap = popCap(s);
  if (!s.starving && s.pop < cap) {
    s.arrival += dt / arrivalInterval(s);
    if (s.arrival >= 1) {
      s.arrival = 0; s.pop += 1;
      if (!quiet) notify(s, 'n.arrived', { n: s.pop }, 'good');
    }
  } else if (s.pop >= cap) s.arrival = Math.min(s.arrival, 0.99);
  // 斷糧惡化：超過寬限期後，每隔一段時間有人離開；只剩 1 人時殖民地瓦解（離線時不會發生）
  if (s.starving) {
    const before = s.starveTime;
    s.starveTime += dt;
    if (!quiet && s.starveTime >= STARVE_GRACE) {
      const n = Math.floor((s.starveTime - STARVE_GRACE) / LEAVE_EVERY) + 1;
      const m = before < STARVE_GRACE ? 0 : Math.floor((before - STARVE_GRACE) / LEAVE_EVERY) + 1;
      if (n > m) {
        leave(s);
        if (s.pop <= 1) { s.failed = true; notify(s, 'n.lastLeft', undefined, 'warn'); }
        else notify(s, 'n.left', { n: s.pop }, 'warn');
      }
    }
  } else s.starveTime = 0;
  if (s.starving) s.morale = Math.max(0, s.morale - dt);
  else {
    const d = moraleTarget(s) - s.morale;
    s.morale += Math.max(-0.5 * dt, Math.min(0.5 * dt, d));
  }
}
