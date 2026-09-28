// 200ms 時間步進：產出 → 消耗與人口 → 研究 → 事件 → 主線
import { GameState } from './state';
import { produce } from './production';
import { population } from './population';
import { research } from './actions';
import { events } from './events';
import { updateStory } from './story';
import { researchSpeed } from './formulas';
import { combat } from './combat';
import { governance } from './governance';

export const TICK = 0.2;

export function step(s: GameState, dt = TICK, opts: { offline?: boolean; rng?: () => number } = {}) {
  if (s.failed) return;
  const eff = opts.offline ? 0.5 : 1;
  produce(s, dt, eff);
  population(s, dt, opts.offline);
  research(s, dt, researchSpeed(s), opts.offline);
  if (!opts.offline) events(s, opts.rng);
  combat(s, opts.offline, opts.rng);
  governance(s, dt, opts.offline ? 0.5 : 1, opts.offline, opts.rng);
  updateStory(s);
  s.t += dt;
}
