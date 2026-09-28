// 階段 5：治理（稅制、殖民憲章，GDD §11）、企業使者（§12）、貿易（§13）
import { GameState, RES_NAME, ResKey, notify } from './state';
import { CHARTER_DEFS, add, built, canAfford, charterSlots, pay, storageCap, taxIncome } from './formulas';

// ── 稅與憲章 ──
export function setTax(s: GameState, level: number) {
  if (!built(s, 'admin')) return;
  s.gov.tax = Math.max(0, Math.min(4, level));
}
export function charterBlock(s: GameState, id: string): string | null {
  if (!built(s, 'admin')) return '需要行政中心';
  if (s.gov.charters.includes(id)) return null;
  if (s.gov.charters.length >= charterSlots(s)) return '憲章欄位已滿';
  return null;
}
export function toggleCharter(s: GameState, id: string) {
  const g = s.gov;
  if (g.charters.includes(id)) { g.charters = g.charters.filter((c) => c !== id); notify(s, `廢止憲章：${name(id)}`, 'info'); return; }
  if (charterBlock(s, id)) return;
  g.charters.push(id);
  const c = CHARTER_DEFS.find((x) => x.id === id)!;
  if (c.effect.corp) g.corp.relation += c.effect.corp;
  notify(s, `通過憲章：${c.name}（${c.desc}）`, 'good');
}
const name = (id: string) => CHARTER_DEFS.find((x) => x.id === id)?.name ?? id;

// ── 貿易：以信用點計價。赫利昂匯率最好；聯盟匯率普通但完成委託會變好 ──
export const PRICE: Partial<Record<ResKey, number>> = { nutrient: 0.5, scrap: 0.3, rock: 0.6, parts: 1.5, metal: 2, tools: 4, weapon: 5, crystal: 20 };
export type Partner = 'corp' | 'alliance';
export function rates(s: GameState, who: Partner, k: ResKey) {
  const base = PRICE[k] ?? 1;
  if (who === 'corp') return { sell: base * 0.9, buy: base * 1.1 };
  const rep = Math.min(5, s.gov.alliance.rep);
  return { sell: base * (0.7 + 0.04 * rep), buy: base * (1.4 - 0.05 * rep) };
}
export function partnerOpen(s: GameState, who: Partner) {
  return who === 'corp' ? built(s, 'trade_post') : built(s, 'spaceport');
}
export const TRADE_LOT = 100;
export function tradeBlock(s: GameState, who: Partner, k: ResKey, dir: 'sell' | 'buy', lot = TRADE_LOT): string | null {
  if (!partnerOpen(s, who)) return who === 'corp' ? '需要交易站' : '需要太空港';
  const r = rates(s, who, k);
  if (dir === 'sell') return s.res[k] >= lot ? null : `${RES_NAME[k]}不足 ${lot}`;
  if (s.res.credit < Math.ceil(r.buy * lot)) return '信用點不足';
  if (s.res[k] + lot > storageCap(s)) return '倉庫放不下';
  return null;
}
export function trade(s: GameState, who: Partner, k: ResKey, dir: 'sell' | 'buy', lot = TRADE_LOT) {
  if (tradeBlock(s, who, k, dir, lot)) return;
  const r = rates(s, who, k);
  if (dir === 'sell') { s.res[k] -= lot; add(s, 'credit', Math.floor(r.sell * lot)); }
  else { s.res.credit -= Math.ceil(r.buy * lot); add(s, k, lot); }
  if (who === 'corp') { s.gov.corp.traded++; if (s.gov.corp.traded % 10 === 0) s.gov.corp.relation += 1; }
}

// 聯盟委託：限時交付某資源，完成拿信用點並提高聲望（匯率變好）
const CONTRACT_RES: ResKey[] = ['metal', 'parts', 'rock', 'tools', 'nutrient'];
export function contractTick(s: GameState, rng = Math.random) {
  const a = s.gov.alliance;
  if (!built(s, 'spaceport')) return;
  if (a.contract && s.t > a.contract.until) { a.contract = null; a.nextContract = s.t + 60; notify(s, '聯盟委託逾期，對方取消了訂單。', 'warn'); }
  if (!a.contract && s.t >= a.nextContract) {
    const res = CONTRACT_RES[Math.floor(rng() * CONTRACT_RES.length)];
    const amount = Math.round((200 + a.rep * 80) / 50) * 50;
    a.contract = { res, amount, reward: Math.round(amount * (PRICE[res] ?? 1) * 1.6), until: s.t + 300 };
  }
}
export function fulfillContract(s: GameState) {
  const a = s.gov.alliance, c = a.contract;
  if (!c || s.res[c.res] < c.amount) return;
  s.res[c.res] -= c.amount;
  add(s, 'credit', c.reward);
  a.rep++; a.contract = null; a.nextContract = s.t + 45;
  notify(s, `完成聯盟委託：+${c.reward} 信用點，聯盟聲望 ${a.rep}（匯率變好）`, 'good');
}

// 神秘訊號：唯一能用廢料換異晶的管道，每 10 分鐘限量 30 異晶
export const SIGNAL_LIMIT = 30, SIGNAL_RATE = 40, SIGNAL_PERIOD = 600;
export const signalOpen = (s: GameState) => built(s, 'spaceport') && built(s, 'xeno_lab');
export function signalLeft(s: GameState) {
  if (s.t >= s.gov.signal.resetAt) return SIGNAL_LIMIT;
  return SIGNAL_LIMIT - s.gov.signal.used;
}
export function signalTrade(s: GameState, n = 5) {
  if (!signalOpen(s)) return;
  const g = s.gov.signal;
  if (s.t >= g.resetAt) { g.used = 0; g.resetAt = s.t + SIGNAL_PERIOD; }
  n = Math.min(n, SIGNAL_LIMIT - g.used, Math.floor(s.res.scrap / SIGNAL_RATE));
  if (n <= 0) return;
  s.res.scrap -= n * SIGNAL_RATE; g.used += n;
  add(s, 'crystal', n);
}

// ── 企業使者：階段 5 起週期性出現，要求上繳；拒絕 3 次以上會派突擊隊 ──
export const ENVOY_GAP = 420;
export function envoyDemand(s: GameState) {
  return s.res.credit >= 300 ? { credit: Math.max(200, Math.round(s.res.credit * 0.2 / 10) * 10) } : { metal: 200 };
}
export function envoyTick(s: GameState) {
  if (s.stage < 5 || s.finished) return;
  const c = s.gov.corp;
  if (c.nextEnvoy < 0) c.nextEnvoy = s.t + 240;
  if (s.events.active || s.t < c.nextEnvoy) return;
  c.demand = envoyDemand(s);
  s.events.active = { kind: 'envoy' };
}
export function resolveEnvoy(s: GameState, choice: number) {
  const c = s.gov.corp;
  if (choice === 0) {
    if (!c.demand || !canAfford(s, c.demand)) return false;
    pay(s, c.demand);
    c.paid++; c.relation++;
    notify(s, '使者滿意地離開了。企業關係 +1。', 'info');
  } else {
    c.refusals++; c.relation--;
    notify(s, c.refusals >= 3 ? '使者冷冷地說：「企業會記住的。」下一次襲擊可能是企業突擊隊。' : '你拒絕了使者。企業關係 −1。', 'warn');
  }
  c.envoys++; c.demand = null; c.nextEnvoy = s.t + ENVOY_GAP;
  return true;
}

/** 每 tick：稅收、聯盟委託、使者 */
export function governance(s: GameState, dt: number, eff = 1, offline = false, rng = Math.random) {
  if (s.stage < 5) return;
  const tax = taxIncome(s);
  if (tax > 0) add(s, 'credit', tax * dt * eff);
  if (!offline) { contractTick(s, rng); envoyTick(s); }
}
