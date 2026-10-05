// 交易站的市場（v0.70）：喜鵲（獨立行商；合作路線後換成赫利昂）收購殖民地的出口品、販售 4 種殖民地造不出來的進口品。
// 價格由行商的庫存決定：賣得越多收購價越低、買得越多售價越高，庫存會慢慢回到目標值（玩家看得到漲跌的原因，不是隨機）。
// 進口品下單後要等貨櫃從軌道投下來，放進交易站的貨艙（不佔倉庫、不顯示在頂部資源列）。
import { GameState, ResKey, msg, notify, Msg } from './state';
import { add, built } from './formulas';

export type Good = 'electronics' | 'raremetal' | 'fuel' | 'medicine';
export const GOODS: Good[] = ['electronics', 'raremetal', 'fuel', 'medicine'];
/** 行商收購的殖民地產品（異晶是祕密，從不出口） */
export const EXPORTS: ResKey[] = ['metal', 'tools', 'parts', 'nutrient'];
type MKey = Good | ResKey;

/** 基準價（信用點／單位） */
export const BASE: Partial<Record<MKey, number>> = { electronics: 12, raremetal: 15, fuel: 6, medicine: 8, metal: 2, tools: 4, parts: 1.5, nutrient: 0.5 };
/** 行商的目標庫存：庫存低於目標就漲價、高於目標就跌價 */
const TARGET: Partial<Record<MKey, number>> = { electronics: 120, raremetal: 80, fuel: 300, medicine: 150, metal: 800, tools: 300, parts: 600, nutrient: 1500 };
/** 庫存回到目標值的時間常數（秒） */
const RECOVER = 240;
export const IMPORT_LOT = 10, EXPORT_LOT = 50;
/** 下單到貨櫃落地的時間（遊戲秒） */
export const DROP_TIME = 60;

export interface MarketState {
  stock: Partial<Record<MKey, number>>;
  /** 還在路上的貨櫃 */
  pending: { k: Good; n: number; at: number }[];
  /** 落地過幾個貨櫃（第 4 章目標、c4-cargo 用） */
  drops: number;
}

/** 交易對象：合作路線後赫利昂接管，喜鵲不再來 */
export const partner = (s: GameState): 'magpie' | 'helion' => (s.story.route === 'coop' ? 'helion' : 'magpie');
export const marketOpen = (s: GameState) => built(s, 'trade_post');
/** 貨艙容量：交易站 Lv1 200，每升一級 +100 */
export const cargoCap = (s: GameState) => 200 + 100 * Math.max(0, (s.b.trade_post?.level ?? 1) - 1);
export const cargoUsed = (s: GameState) => GOODS.reduce((a, k) => a + (s.cargo?.[k] ?? 0), 0) + (s.market?.pending ?? []).reduce((a, p) => a + p.n, 0);

/** 行商目前的庫存（沒有紀錄的商品視為剛好在目標值） */
const stockOf = (s: GameState, k: MKey) => s.market?.stock[k] ?? TARGET[k] ?? 0;
/** 稀缺係數：(目標庫存 ÷ 目前庫存)^0.5，限制在 0.6～1.8 */
export function scarcity(s: GameState, k: MKey) {
  const t = TARGET[k] ?? 1, st = stockOf(s, k);
  return Math.min(1.8, Math.max(0.6, Math.sqrt(t / Math.max(1, st))));
}
/** 路線帶來的價格修正（只作用在進口品）：合作＝赫利昂的價目；抵抗且蓋了太空港＝聯盟優惠 */
function terms(s: GameState, k: Good) {
  if (partner(s) === 'helion') return ({ electronics: 0.85, fuel: 0.9, raremetal: 1.1, medicine: 1.1 } as Record<Good, number>)[k];
  if (s.story.route === 'resist' && built(s, 'spaceport')) return ({ raremetal: 0.85, medicine: 0.9 } as Partial<Record<Good, number>>)[k] ?? 1;
  return 1;
}
/** 買一單位進口品的價格 */
export const buyPrice = (s: GameState, k: Good) => BASE[k]! * scarcity(s, k) * terms(s, k);
/** 賣一單位出口品給行商的價格（行商要賺一點，打九折） */
export const sellPrice = (s: GameState, k: ResKey) => BASE[k]! * scarcity(s, k) * 0.9;
/** 價格趨勢：↑ 偏高、↓ 偏低、— 穩定（介面只顯示這個，不顯示公式） */
export function trend(s: GameState, k: MKey): 'up' | 'down' | 'flat' {
  const f = scarcity(s, k);
  return f > 1.08 ? 'up' : f < 0.92 ? 'down' : 'flat';
}

export function buyBlock(s: GameState, k: Good, lot = IMPORT_LOT): Msg | null {
  if (!marketOpen(s)) return msg('why.tradePost');
  if (stockOf(s, k) < lot) return msg('why.soldOut');
  if (s.res.credit < Math.ceil(buyPrice(s, k) * lot)) return msg('why.credit');
  if (cargoUsed(s) + lot > cargoCap(s)) return msg('why.cargo');
  return null;
}
/** 下單：先付錢，貨櫃 DROP_TIME 秒後落地 */
export function buyGood(s: GameState, k: Good, lot = IMPORT_LOT) {
  if (buyBlock(s, k, lot)) return false;
  s.res.credit -= Math.ceil(buyPrice(s, k) * lot);
  s.market.stock[k] = stockOf(s, k) - lot;
  s.market.pending.push({ k, n: lot, at: s.t + DROP_TIME });
  if (partner(s) === 'helion') helionTraded(s);
  notify(s, 'n.ordered', { r: k, n: lot, t: DROP_TIME });
  return true;
}
export function sellBlock(s: GameState, k: ResKey, lot = EXPORT_LOT): Msg | null {
  if (!marketOpen(s)) return msg('why.tradePost');
  if (s.res[k] < lot) return msg('why.short', { r: k, n: lot });
  return null;
}
export function sellGood(s: GameState, k: ResKey, lot = EXPORT_LOT) {
  if (sellBlock(s, k, lot)) return false;
  s.res[k] -= lot;
  add(s, 'credit', Math.floor(sellPrice(s, k) * lot));
  s.market.stock[k] = stockOf(s, k) + lot;
  if (partner(s) === 'helion') helionTraded(s);
  return true;
}
/** 跟赫利昂交易：每 10 筆公司關係 +1（沿用原本交易站的規則） */
function helionTraded(s: GameState) {
  const c = s.gov.corp;
  c.traded++;
  if (c.traded % 10 === 0) c.relation += 1;
}

/** 每 tick：庫存回到目標值、到時間的貨櫃落地 */
export function market(s: GameState, dt: number) {
  const m = s.market;
  if (!m) return;
  for (const k of Object.keys(TARGET) as MKey[]) {
    const t = TARGET[k]!, st = m.stock[k] ?? t;
    m.stock[k] = st + (t - st) * Math.min(1, dt / RECOVER);
  }
  if (!m.pending.length) return;
  const landed = m.pending.filter((p) => p.at <= s.t);
  if (!landed.length) return;
  m.pending = m.pending.filter((p) => p.at > s.t);
  for (const p of landed) {
    s.cargo[p.k] += p.n;
    m.drops++;
    notify(s, 'n.drop', { r: p.k, n: p.n }, 'good');
  }
}
