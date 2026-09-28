// 離線收益：50% 效率，上限 8 小時（GDD §8）
import { GameState, RES_KEYS, ResKey } from './state';
import { step } from './tick';

export const OFFLINE_CAP = 8 * 3600;

export function applyOffline(s: GameState, seconds: number) {
  const secs = Math.min(OFFLINE_CAP, Math.max(0, seconds));
  if (secs < 30) return null;
  const before = { ...s.res }, pop0 = s.pop;
  const dt = secs > 3600 ? 5 : 1;
  for (let t = 0; t < secs; t += dt) step(s, dt, { offline: true });
  const gains = Object.fromEntries(RES_KEYS.map((k) => [k, s.res[k] - before[k]])) as Record<ResKey, number>;
  return { seconds: secs, gains, pop: s.pop - pop0 };
}
