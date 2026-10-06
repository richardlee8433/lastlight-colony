// 階段 5：治理（稅制、殖民憲章，GDD §11）、企業使者（§12）、貿易（§13）
import { GameState, Msg, ResKey, msg, notify } from './state';
import { CHARTER_DEFS, add, built, canAfford, charterSlots, pay, storageCap, taxIncome } from './formulas';

// ── 稅與憲章 ──
export function setTax(s: GameState, level: number) {
  if (!built(s, 'admin')) return;
  s.gov.tax = Math.max(0, Math.min(4, level));
}
export function charterBlock(s: GameState, id: string): Msg | null {
  if (!built(s, 'admin')) return msg('why.admin');
  if (s.gov.charters.includes(id)) return null;
  if (s.gov.charters.length >= charterSlots(s)) return msg('why.slots');
  return null;
}
export function toggleCharter(s: GameState, id: string) {
  const g = s.gov;
  if (g.charters.includes(id)) { g.charters = g.charters.filter((c) => c !== id); notify(s, 'n.charterOff', { c: id }); return; }
  if (charterBlock(s, id)) return;
  g.charters.push(id);
  const c = CHARTER_DEFS.find((x) => x.id === id)!;
  if (c.effect.corp) g.corp.relation += c.effect.corp;
  notify(s, 'n.charterOn', { c: id }, 'good');
}

// ── 大宗資源買賣（固定匯率、一次 100）：以信用點計價 ──
// 異晶是殖民地的祕密，不是商品：任何交易對象都不能買賣（不在清單裡）
export const PRICE: Partial<Record<ResKey, number>> = { nutrient: 0.5, scrap: 0.3, rock: 0.6, parts: 1.5, metal: 2, tools: 4, weapon: 5 };
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
export function tradeBlock(s: GameState, who: Partner, k: ResKey, dir: 'sell' | 'buy', lot = TRADE_LOT): Msg | null {
  if (!partnerOpen(s, who)) return msg(who === 'corp' ? 'why.tradePost' : 'why.spaceport');
  if (!PRICE[k]) return msg('why.notTraded');
  const r = rates(s, who, k);
  if (dir === 'sell') return s.res[k] >= lot ? null : msg('why.short', { r: k, n: lot });
  if (s.res.credit < Math.ceil(r.buy * lot)) return msg('why.credit');
  if (s.res[k] + lot > storageCap(s)) return msg('why.storage');
  return null;
}
export function trade(s: GameState, who: Partner, k: ResKey, dir: 'sell' | 'buy', lot = TRADE_LOT) {
  if (tradeBlock(s, who, k, dir, lot)) return;
  const r = rates(s, who, k);
  if (dir === 'sell') { s.res[k] -= lot; add(s, 'credit', Math.floor(r.sell * lot)); }
  else { s.res.credit -= Math.ceil(r.buy * lot); add(s, k, lot); }
  if (who === 'corp' && s.story.route === 'coop') { s.gov.corp.traded++; if (s.gov.corp.traded % 10 === 0) s.gov.corp.relation += 1; }
}

// 聯盟委託：限時交付某資源，完成拿信用點並提高聲望（匯率變好）
const CONTRACT_RES: ResKey[] = ['metal', 'parts', 'rock', 'tools', 'nutrient'];
export function contractTick(s: GameState, rng = Math.random) {
  const a = s.gov.alliance;
  // 聯盟只在抵抗路線出現：委託由喜鵲穿過封鎖線運送（v0.70）
  if (!built(s, 'spaceport') || s.story.route !== 'resist') return;
  if (a.contract && s.t > a.contract.until) { a.contract = null; a.nextContract = s.t + 60; notify(s, 'n.contractLate', undefined, 'warn'); }
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
  notify(s, 'n.contractDone', { n: c.reward, rep: a.rep }, 'good');
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
  // 第一次使者來要答覆：等卡爾德登場、沃斯說出真相、大家討論完（c5-debate 播完）
  if (c.envoys === 0 && (!s.story.seen?.includes('c5-debate') || s.story.queue?.length)) return;
  c.demand = envoyDemand(s);
  s.events.active = { kind: 'envoy' };
}
export function resolveEnvoy(s: GameState, choice: number) {
  const c = s.gov.corp;
  if (choice === 0) {
    if (!c.demand || !canAfford(s, c.demand)) return false;
    pay(s, c.demand);
    c.paid++; c.relation++;
    notify(s, 'n.envoyPaid');
  } else {
    c.refusals++; c.relation--;
    notify(s, c.refusals >= 3 ? 'n.envoyThreat' : 'n.envoyRefused', undefined, 'warn');
  }
  // 第一次的選擇決定第 5 章的路線
  if (c.envoys === 0) s.story.route = choice === 0 ? 'coop' : 'resist';
  c.envoys++; c.demand = null; c.nextEnvoy = s.t + ENVOY_GAP;
  if (c.envoys === 2) s.story.env2At = s.t;
  return true;
}

/** 每 tick：稅收、聯盟委託、使者 */
export function governance(s: GameState, dt: number, eff = 1, offline = false, rng = Math.random) {
  if (s.stage < 5) return;
  const tax = taxIncome(s);
  if (tax > 0) add(s, 'credit', tax * dt * eff);
  if (!offline) { contractTick(s, rng); envoyTick(s); }
}
