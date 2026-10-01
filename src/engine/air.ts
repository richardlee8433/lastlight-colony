// 氧氣（v0.6）：這顆星球的空氣不能呼吸，每一口氧氣都要自己造。
// 規則和營養同一套：產出、消耗、空氣安全度；缺氧時產量與士氣大降，拖太久開始有人倒下，最後殖民地瓦解。
// 離線時照常產出與消耗，但不會有人倒下、士氣也不因缺氧下降。
import { AIR_ENABLED, DEFS, GameState, newAir, notify } from './state';
import { add, built, formOf, moraleMult } from './formulas';

export const O2_PER_POP = 0.18;         // 每位殖民者每秒耗氧：氧氣是主線，消耗比營養（0.14）高
export const AIR_WINDOW = 120;          // 空氣安全度：存量能撐幾秒算 100%
export const LIFE_SUPPORT = { rate: 0.6, duration: 600 };   // 逃生艙維生系統：開局每秒 0.6，10 分鐘內線性衰減到 0；三個人大約撐 12 分鐘
export const HYPOXIA_PROD = 0.5;        // 缺氧時產量倍率
export const HYPOXIA_MORALE = 1.5;      // 缺氧時士氣每秒下降
export const HYPOXIA_GRACE = 90;        // 缺氧多久後開始有人倒下
export const COLLAPSE_EVERY = 40;       // 之後每隔多久倒下一人
export const COLLAPSE_TIME = 150;       // 倒下後要休養多久（沒有醫療艙時兩倍，見 combat.treat）
export const HYPOXIA_FAIL = 480;        // 連續缺氧多久殖民地瓦解
export const GRACE_PAUSE = 60;          // 新手保護：維生系統快耗盡、還沒有氧氣再生器時，暫停倒數一次

export const airOn = () => AIR_ENABLED;
/** 維生系統目前每秒產氧 */
export function lifeSupportRate(s: GameState) {
  const a = s.air;
  if (!a || a.elapsed >= LIFE_SUPPORT.duration) return 0;
  return LIFE_SUPPORT.rate * (1 - a.elapsed / LIFE_SUPPORT.duration);
}
export const lifeSupportLeft = (s: GameState) => Math.max(0, LIFE_SUPPORT.duration - (s.air?.elapsed ?? LIFE_SUPPORT.duration));
/** 每秒耗氧；星城穹頂封城後減半 */
export function oxygenUse(s: GameState) {
  return s.pop * O2_PER_POP * (built(s, 'star_dome') ? 0.5 : 1);
}
/** 建築工人的副產氧氣（藻類槽等），跟著士氣與缺氧懲罰 */
export function oxygenByproduct(s: GameState) {
  let v = 0;
  for (const d of DEFS) {
    const per = formOf(s, d.id)?.oxygen ?? d.oxygen;
    if (per && built(s, d.id)) v += s.b[d.id].workers * per;
  }
  return v * moraleMult(s) * hypoxiaMul(s);
}
export const hypoxiaMul = (s: GameState) => (s.air?.hypoxic ? HYPOXIA_PROD : 1);
export function airSafety(s: GameState) {
  if (!AIR_ENABLED) return 1;
  const need = oxygenUse(s) * AIR_WINDOW;
  return need <= 0 ? 1 : Math.min(1, s.res.oxygen / need);
}

/** 一位殖民者倒下：從工人最多的建築（或閒置的人）裡選一位，送去休養；康復後回原崗位 */
function collapse(s: GameState) {
  let best: string | null = null;
  for (const d of DEFS) if (d.id !== 'security' && s.b[d.id].workers > 0 && (!best || s.b[d.id].workers > s.b[best].workers)) best = d.id;
  if (best) s.b[best].workers--;
  (s.raid.hurt ??= []).push({ until: s.t + COLLAPSE_TIME, b: best });
}

export function air(s: GameState, dt: number, offline = false) {
  if (!AIR_ENABLED) return;
  const a = (s.air ??= newAir());
  // 維生系統倒數（新手保護期間暫停）
  if (a.pause > 0) a.pause = Math.max(0, a.pause - dt);
  else a.elapsed += dt;
  if (!offline && !a.graceUsed && lifeSupportLeft(s) < 45 && lifeSupportLeft(s) > 0 && s.b.o2_scrubber && !built(s, 'o2_scrubber')) {
    a.graceUsed = true; a.pause = GRACE_PAUSE;
    notify(s, 'n.lsGrace', { n: GRACE_PAUSE }, 'warn');
  }
  const eff = offline ? 0.5 : 1;
  add(s, 'oxygen', (lifeSupportRate(s) + oxygenByproduct(s)) * dt * eff);
  // 空氣安全度連續達到 60% 的秒數（第 2 章目標）
  a.safeTime = airSafety(s) >= 0.6 ? (a.safeTime ?? 0) + dt : 0;
  // 消耗
  const need = oxygenUse(s) * dt;
  if (s.res.oxygen >= need) {
    s.res.oxygen -= need;
    if (a.hypoxic && !offline) notify(s, 'n.airBack', undefined, 'good');
    a.hypoxic = false; a.hypoxiaTime = 0;
    return;
  }
  s.res.oxygen = 0;
  if (offline) return;
  if (!a.hypoxic) notify(s, 'n.hypoxia', undefined, 'warn');
  a.hypoxic = true;
  const before = a.hypoxiaTime;
  a.hypoxiaTime += dt;
  s.morale = Math.max(0, s.morale - HYPOXIA_MORALE * dt);
  // 超過寬限期後，每 COLLAPSE_EVERY 秒倒下一人
  if (a.hypoxiaTime >= HYPOXIA_GRACE) {
    const n = Math.floor((a.hypoxiaTime - HYPOXIA_GRACE) / COLLAPSE_EVERY) + 1;
    const m = before < HYPOXIA_GRACE ? 0 : Math.floor((before - HYPOXIA_GRACE) / COLLAPSE_EVERY) + 1;
    if (n > m) { collapse(s); notify(s, 'n.collapsed', { n: s.raid.hurt?.length ?? 0 }, 'warn'); }
  }
  const standing = s.pop - (s.raid.hurt?.length ?? 0);
  if (a.hypoxiaTime >= HYPOXIA_FAIL || standing <= 0) { s.failed = true; s.failReason = 'air'; notify(s, 'n.suffocated', undefined, 'warn'); }
}
