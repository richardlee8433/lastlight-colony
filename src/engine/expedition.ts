// 探勘站與藍圖（第 3 章）：派殖民者出去搜尋未知文明留下的藍圖。
// 第一次探勘必定帶回一整張藍圖（高壓濾網）和一批異晶；之後每趟隨機帶回資源，有機會帶回藍圖碎片，集滿 3 片拼成下一張藍圖。
// 藍圖本身沒有效果：拿到後科技樹裡對應的「藍圖科技」才能研究。
import { GameState, Msg, msg, notify } from './state';
import { add, built, idle } from './formulas';

/** 這一批的藍圖（依取得順序）；之後章節的藍圖接在後面 */
export const BLUEPRINTS = ['filter', 'resonance'] as const;
export const EXP_TEAM = 2;            // 每趟派出幾人
export const EXP_TIME = 180;          // 每趟幾秒
export const FRAGS_PER_BP = 3;        // 幾片碎片拼成一張藍圖
export const FIRST_CRYSTAL = 30;      // 第一次探勘帶回的異晶

export interface ExpState { until: number; team: number; count: number; frags: number; blueprints: string[] }
export const newExp = (): ExpState => ({ until: 0, team: 0, count: 0, frags: 0, blueprints: [] });

export const expActive = (s: GameState) => (s.exp?.team ?? 0) > 0;
export const expWorkers = (s: GameState) => s.exp?.team ?? 0;
/** 碎片機率：探勘站每級 +10%（Lv1 35%） */
export const fragChance = (s: GameState) => Math.min(0.85, 0.35 + 0.1 * Math.max(0, s.b.expedition.level - 1));
/** 帶回資源的倍率：每級 +25% */
export const lootMul = (s: GameState) => 1 + 0.25 * Math.max(0, s.b.expedition.level - 1);
export const hasBlueprint = (s: GameState, bp: string) => !!s.exp?.blueprints.includes(bp);
/** 下一張靠碎片拼出來的藍圖 */
export const nextBlueprint = (s: GameState) => BLUEPRINTS.find((b) => !hasBlueprint(s, b)) ?? null;

export function expBlock(s: GameState): Msg | null {
  if (!built(s, 'expedition')) return msg('why.notBuilt');
  if (expActive(s)) return msg('why.expBusy');
  if (idle(s) < EXP_TEAM) return msg('why.expIdle', { n: EXP_TEAM });
  return null;
}
export function startExpedition(s: GameState): boolean {
  if (expBlock(s)) return false;
  const e = (s.exp ??= newExp());
  e.team = EXP_TEAM; e.until = s.t + EXP_TIME;
  notify(s, 'n.expGo', { n: EXP_TEAM, t: Math.round(EXP_TIME / 60) });
  return true;
}

/** 每個 tick：探勘隊回來時結算 */
export function expedition(s: GameState, rng = Math.random) {
  const e = s.exp;
  if (!e || !e.team || s.t < e.until || s.events.report) return;   // 上一份報告還沒看完就晚一點回來
  const team = e.team;
  e.team = 0; e.count++;
  const gains: Msg[] = [];
  const give = (r: 'scrap' | 'rock' | 'metal' | 'crystal', n: number) => { n = Math.round(n); if (n > 0) { add(s, r, n); gains.push(msg('l.gain', { r, n })); } };
  const k = lootMul(s);
  give('scrap', 60 * k * (0.7 + rng() * 0.6));
  give('rock', 40 * k * (0.7 + rng() * 0.6));
  give('metal', 15 * k * (0.7 + rng() * 0.6));
  let title = 'exp.title', text = 'exp.text.' + Math.floor(rng() * 3);
  if (e.count === 1) {
    // 第一次：必定帶回第一張藍圖和異晶
    e.blueprints.push(BLUEPRINTS[0]);
    give('crystal', FIRST_CRYSTAL);
    gains.push(msg('g.blueprint', { bp: BLUEPRINTS[0] }));
    title = 'exp.firstTitle'; text = 'exp.firstText';
  } else {
    if (s.stage >= 4 && rng() < 0.5) give('crystal', 8 * k);
    const next = nextBlueprint(s);
    if (next && rng() < fragChance(s)) {
      e.frags++;
      if (e.frags >= FRAGS_PER_BP) {
        e.frags = 0; e.blueprints.push(next);
        gains.push(msg('g.blueprint', { bp: next }));
        title = 'exp.bpTitle'; text = 'exp.bpText';
      } else gains.push(msg('g.frag', { n: e.frags, m: FRAGS_PER_BP }));
    }
    // 第 4 章起：微光獸會攻擊探勘隊，可能有人受傷（走醫療艙流程，康復後變回閒置）
    if (s.stage >= 4 && rng() < 0.2) {
      (s.raid.hurt ??= []).push({ until: s.t + 120, b: null });
      gains.push(msg('g.expHurt'));
    }
  }
  s.events.report = { title: msg(title), text: msg(text, { n: team }), gains };
  notify(s, 'n.expBack', undefined, 'good');
}
