// 天氣（v0.70.3）：沙塵暴、霜夜、異晶極光。每 15 分鐘一次、每次 1 分鐘，開始前 30 秒預告。
// 效果都輕而且短，不會讓殖民地崩潰；同一時間只有一種，襲擊預警期間不會開始；離線時沒有天氣。
// 數值效果寫在 formulas.ts 的 weatherMul／consumption（避免循環引用），這裡只負責排程與通知。
import { GameState, notify } from './state';

export type WeatherKind = 'dust' | 'frost' | 'aurora';
export interface WeatherState {
  /** 進行中的天氣（null＝晴天） */
  k: WeatherKind | null;
  at: number; until: number;
  /** 下一次天氣開始的時間（-1＝還沒開始排程） */
  next: number;
  /** 已經預告、即將開始的天氣 */
  pending?: WeatherKind | null;
  /** 上一次是什麼（下一次換別種） */
  last?: WeatherKind;
  /** 沙塵暴：清理濾網的點擊次數 */
  cleared?: number;
}
export const WEATHER_GAP = 900, WEATHER_TIME = 60, WEATHER_WARN = 30;
/** 第 2 章的第一場天氣（一定是沙塵暴）在進入第 2 章後這麼久開始：第 2 章通常不到 15 分鐘 */
export const WEATHER_FIRST = 180;
/** 沙塵暴時在產氧建築上按住採集，點這麼多下（約 3 秒）就把濾網清乾淨 */
export const CLEAR_CLICKS = 15;

export const newWeather = (): WeatherState => ({ k: null, at: 0, until: 0, next: -1 });

/** 這一章可能出現的天氣：沙塵暴第 2 章起；霜夜要伊涅絲在（電解站是她的設計）；極光要有異晶（第 4 章起） */
export function weatherKinds(s: GameState): WeatherKind[] {
  const out: WeatherKind[] = [];
  if (s.stage >= 2) out.push('dust');
  if (s.stage >= 2 && s.story.ines) out.push('frost');
  if (s.stage >= 4) out.push('aurora');
  return out;
}
export const dustClogged = (s: GameState) => s.weather?.k === 'dust' && (s.weather.cleared ?? 0) < CLEAR_CLICKS;

/** 沙塵暴期間在產氧建築上點擊：累積到 CLEAR_CLICKS 下就把濾網清乾淨 */
export function clearFilter(s: GameState) {
  const w = s.weather;
  if (!w || w.k !== 'dust' || (w.cleared ?? 0) >= CLEAR_CLICKS) return;
  w.cleared = (w.cleared ?? 0) + 1;
  if (w.cleared >= CLEAR_CLICKS) notify(s, 'n.weather.cleared', undefined, 'good');
}

export function weather(s: GameState, offline = false, rng = Math.random) {
  const w = (s.weather ??= newWeather());
  // 離線：沒有天氣；回來之後至少隔 2 分鐘才會有下一次
  if (offline) {
    w.k = null; w.pending = null;
    if (w.next >= 0 && w.next < s.t + 120) w.next = s.t + 120;
    return;
  }
  if (s.finished) { w.k = null; w.pending = null; return; }
  if (w.k) {
    if (s.t >= w.until) { w.last = w.k; w.k = null; w.next = s.t + WEATHER_GAP; }
    return;
  }
  const kinds = weatherKinds(s);
  if (!kinds.length) return;
  if (w.next < 0) { w.next = s.t + (s.stage === 2 ? WEATHER_FIRST : WEATHER_GAP); return; }
  // 襲擊預警期間不開始（也不預告），延後 1 分鐘
  if (s.raid?.incoming && s.t >= w.next - WEATHER_WARN) { w.next = Math.max(w.next, s.t + 60); return; }
  if (!w.pending && s.t >= w.next - WEATHER_WARN) {
    const pick = !w.last ? ['dust' as const] : kinds.length > 1 ? kinds.filter((k) => k !== w.last) : kinds;
    w.pending = pick[Math.floor(rng() * pick.length)];
    notify(s, 'n.weather.warn.' + w.pending, { s: Math.max(0, Math.ceil(w.next - s.t)) }, w.pending === 'aurora' ? 'info' : 'warn');
  }
  if (w.pending && s.t >= w.next) {
    w.k = w.pending; w.pending = null; w.at = s.t; w.until = s.t + WEATHER_TIME; w.cleared = 0;
    notify(s, 'n.weather.' + w.k, undefined, w.k === 'aurora' ? 'good' : 'warn');
  }
}
