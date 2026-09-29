// 異星生物襲擊與自動戰鬥（GDD §10）
// 預警 60 秒 → 回合制自動結算（最多 10 回合）→ 勝利拿戰利品；失敗被搶走某資源 15%、士氣 −10。
// 保全不會死亡，倒下的只會「受傷」一段時間無法參戰。
import { BattleReport, GameState, Msg, RES_UNLOCK, ResKey, msg, notify } from './state';
import { add, built, nodeEffect, researchEffect } from './formulas';

export const FIRST_RAID = 480;      // 進入階段 4 後幾秒發生第一次襲擊
export const RAID_GAP: [number, number] = [360, 540];
export const WARNING = 60;
export const INJURY = 180;

export const guards = (s: GameState) => (built(s, 'security') ? s.b.security.workers : 0);
export const injuredCount = (s: GameState) => s.raid.injured.filter((u) => u > s.t).length;
export const guardHp = (s: GameState) => 10 + nodeEffect(s, 'security', 'guardHp') + researchEffect(s, 'guardHp');
export function guardAtk(s: GameState, armed: boolean) {
  const base = armed ? 5 + nodeEffect(s, 'forge', 'weaponAtk') + researchEffect(s, 'weaponAtk') : 2;
  return base + nodeEffect(s, 'security', 'guardAtk');
}
export const enemyStats = (n: number) => ({ enemies: 3 + 2 * n, atk: 2 * Math.pow(1.1, n), hp: 8 * Math.pow(1.1, n) });
/** 階段 5 起的襲擊：掠奪者數量較少、單體較強；拒絕企業 3 次以上改派突擊隊（強度 ×1.5） */
export function raidFor(s: GameState) {
  const e = enemyStats(s.raid.won);
  if (s.stage < 5) return { ...e, kind: 'alien' as const };
  const commando = s.gov.corp.refusals >= 3 && s.raid.count % 2 === 1;
  const m = commando ? 1.5 : 1;
  // 掠奪者強度從階段 5 重新起算（假設階段 4 大約擊退 3 次）：3 名起跳，每次擊退 +1 名、數值 ×1.1
  const n = Math.max(0, s.raid.won - 3);
  return { enemies: 3 + n, atk: 5 * Math.pow(1.1, n) * m, hp: 18 * Math.pow(1.1, n) * m, kind: commando ? ('commando' as const) : ('raider' as const) };
}
export const turrets = (s: GameState) => (built(s, 'turret') ? s.b.turret.level : 0);
export const turretAtk = (s: GameState) => 8 + researchEffect(s, 'turretAtk');
export const TURRET_HP = 40;

/** 我方可參戰戰力（給 UI 估算用） */
export function defense(s: GameState) {
  const g = guards(s), ready = Math.max(0, g - injuredCount(s));
  const armedReady = Math.min(s.raid.armed, ready);
  const t = turrets(s);
  return {
    guards: g, ready, armed: s.raid.armed, armedReady, turrets: t,
    atk: armedReady * guardAtk(s, true) + (ready - armedReady) * guardAtk(s, false) + t * turretAtk(s),
    hp: ready * guardHp(s) + t * TURRET_HP,
  };
}

/** 每個 tick：配發武器、排程與預警、開打 */
export function combat(s: GameState, offline = false, rng = Math.random) {
  const r = s.raid;
  // 武器配發：保全人數變少時武器退回庫存
  const g = guards(s);
  if (r.armed > g) { add(s, 'weapon', r.armed - g); r.armed = g; }
  while (r.armed < g && s.res.weapon >= 1) { s.res.weapon -= 1; r.armed++; }
  if (r.injured.length > g) r.injured = r.injured.sort((a, b) => b - a).slice(0, g);
  r.injured = r.injured.filter((u) => u > s.t);

  if (s.stage < 4 || s.finished) return;
  if (r.nextAt < 0) r.nextAt = s.t + FIRST_RAID;
  if (offline) { if (r.nextAt < s.t + WARNING + 30) r.nextAt = s.t + WARNING + 30; r.incoming = null; return; }
  if (!r.incoming && s.t >= r.nextAt - WARNING) {
    // 強度只隨「擊退次數」成長：輸了不會越打越難，避免死亡螺旋（GDD 原本按總襲擊次數）
    const e = raidFor(s);
    r.incoming = { at: r.nextAt, enemies: e.enemies, atk: e.atk, hp: e.hp, side: Math.floor(rng() * 4), kind: e.kind };
    notify(s, 'n.raidWarn', { n: e.enemies, kind: e.kind, s: WARNING }, 'warn');
  }
  if (r.incoming && s.t >= r.incoming.at) fight(s, rng);
}

function fight(s: GameState, rng: () => number) {
  const r = s.raid, inc = r.incoming!;
  r.incoming = null;
  const ready = Math.max(0, guards(s) - injuredCount(s));
  const armedReady = Math.min(r.armed, ready);
  const nt = turrets(s);
  // 砲塔排在最前面吸收傷害；保全倒下會受傷，砲塔戰後自動修復
  const ours = [
    ...Array.from({ length: nt }, () => ({ hp: TURRET_HP, atk: turretAtk(s), turret: true })),
    ...Array.from({ length: ready }, (_, i) => ({ hp: guardHp(s), atk: guardAtk(s, i < armedReady), turret: false })),
  ];
  const theirs = Array.from({ length: inc.enemies }, () => ({ hp: inc.hp, atk: inc.atk }));
  const oursMax = ours.reduce((a, u) => a + u.hp, 0), theirsMax = theirs.reduce((a, u) => a + u.hp, 0);
  const sum = (xs: { hp: number }[]) => xs.reduce((a, u) => a + Math.max(0, u.hp), 0);
  const hit = (xs: { hp: number }[], dmg: number) => { for (const u of xs) { if (dmg <= 0) break; if (u.hp <= 0) continue; const d = Math.min(u.hp, dmg); u.hp -= d; dmg -= d; } };
  const rounds: BattleReport['rounds'] = [{ ours: oursMax, theirs: theirsMax, oursMax, theirsMax }];
  for (let i = 0; i < 10 && sum(ours) > 0 && sum(theirs) > 0; i++) {
    const a = ours.filter((u) => u.hp > 0).reduce((x, u) => x + u.atk, 0);
    const b = theirs.filter((u) => u.hp > 0).reduce((x, u) => x + u.atk, 0);
    hit(theirs, a); hit(ours, b);
    rounds.push({ ours: sum(ours), theirs: sum(theirs), oursMax, theirsMax });
  }
  const won = ours.length > 0 && sum(theirs) <= 0;
  const down = ours.filter((u) => u.hp <= 0 && !u.turret).length;
  const heal = INJURY * Math.max(0.2, 1 + nodeEffect(s, 'security', 'injuryMul'));
  for (let i = 0; i < down; i++) r.injured.push(s.t + heal);
  const lines: Msg[] = [];
  r.count++;
  if (won) {
    r.won++;
    const n = inc.enemies;
    const loot: [ResKey, number][] = [['rock', 40 * n], ['metal', 15 * n], ['crystal', 2 * n]];
    for (const [k, v] of loot) { add(s, k, v); lines.push(msg('l.gain', { r: k, n: v })); }
    if (inc.kind === 'commando') { add(s, 'credit', 500); lines.push(msg('l.commando')); }
    notify(s, 'n.raidWon', { kind: inc.kind ?? 'alien', n: r.won }, 'good');
  } else {
    const pool = (Object.keys(s.res) as ResKey[]).filter((k) => RES_UNLOCK[k] <= s.stage && s.res[k] >= 10);
    if (pool.length) {
      const k = pool[Math.floor(rng() * pool.length)], v = Math.floor(s.res[k] * 0.15);
      s.res[k] -= v;
      lines.push(msg('l.stolen', { r: k, n: v }));
    }
    s.morale = Math.max(0, s.morale - 10);
    lines.push(msg('l.morale10'));
    notify(s, ours.length ? 'n.raidLost' : 'n.raidNoDef', { kind: inc.kind ?? 'alien' }, 'warn');
  }
  if (down) lines.push(msg('l.injured', { n: down, m: Math.round(heal / 60 * 10) / 10 }));
  r.report = { won, raid: r.count, enemies: inc.enemies, guards: ready, armed: armedReady, turrets: nt, kind: inc.kind ?? 'alien', rounds, injured: down, lines };
  r.nextAt = s.t + RAID_GAP[0] + rng() * (RAID_GAP[1] - RAID_GAP[0]);
}
