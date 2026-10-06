// 異星生物襲擊與自動戰鬥（GDD §10）
// 預警 60 秒 → 回合制自動結算（最多 10 回合）→ 勝利拿戰利品；失敗被搶走某資源 15%、士氣 −10。
// 保全不會死亡，倒下的只會「受傷」一段時間無法參戰。
import { BattleReport, DEFS, GameState, Msg, RES_UNLOCK, ResKey, msg, notify } from './state';
import { add, built, hurtCivilians, idle, nodeEffect, researchEffect, workerCap } from './formulas';
import { leave } from './population';

export const FIRST_RAID = 480;      // （舊存檔用）進入階段 4 後幾秒發生第一次襲擊
/** 第一次襲擊是劇情事件：異晶合成室啟動後多久來（含預警） */
export const SYNTH_RAID = 120;
export const RAID_GAP: [number, number] = [360, 540];
export const WARNING = 60;
export const INJURY = 180;

/** 醫療艙：每級 2 張病床（加護病床 +1/級）；躺在病床上的傷員，每位醫護員讓復原速度 +60%（自動診斷再 ×1.5） */
export const medBeds = (s: GameState) => (built(s, 'med_bay') ? s.b.med_bay.level * (2 + nodeEffect(s, 'med_bay', 'bedAdd')) : 0);
// 科技「戰地醫療」：不論有沒有醫療艙，傷員恢復都快 50%
export const healRate = (s: GameState) => (built(s, 'med_bay') ? (1 + s.b.med_bay.workers * 0.6 * (1 + nodeEffect(s, 'med_bay', 'healAdd'))) * (medActive(s) ? MED_BOOST : 1) : 1) * (1 + researchEffect(s, 'healAdd'));
// 醫療物資（v0.70 進口品）：醫療艙每用 10 單位，傷員恢復快 50%，持續 5 分鐘（可以疊加時間）。
// 醫療物資也是船的長程補給模組的材料：現在救治、還是留給長期計畫，是個小取捨
export const MED_LOT = 10, MED_TIME = 300, MED_BOOST = 1.5;
export const medActive = (s: GameState) => s.t < (s.raid.medUntil ?? 0);
export function medBlock(s: GameState): Msg | null {
  if (!built(s, 'med_bay')) return msg('why.medbay');
  // 沒有傷員就不用：醫療物資是進口品，也是船的補給模組材料
  if (injuredCount(s) + hurtCivilians(s) === 0) return msg('why.noPatients');
  if ((s.cargo?.medicine ?? 0) < MED_LOT) return msg('why.short', { r: 'medicine', n: MED_LOT });
  return null;
}
export function applyMedicine(s: GameState) {
  if (medBlock(s)) return false;
  s.cargo.medicine -= MED_LOT;
  s.raid.medUntil = Math.max(s.t, s.raid.medUntil ?? 0) + MED_TIME;
  notify(s, 'n.medicine', { n: MED_LOT }, 'good');
  return true;
}
/** 傷員治療：最快好的那幾位佔用病床，剩餘時間按 healRate 倒數 */
function treat(s: GameState, dt: number) {
  const r = s.raid;
  // 沒有醫療艙：傷員只能自己慢慢好，復原時間變兩倍（倒數速度減半）
  if (!built(s, 'med_bay')) {
    for (let i = 0; i < r.injured.length; i++) if (r.injured[i] > s.t) r.injured[i] += dt * 0.5;
    for (const h of r.hurt ?? []) if (h.until > s.t) h.until += dt * 0.5;
    return;
  }
  const beds = medBeds(s), rate = healRate(s);
  if (!beds || rate <= 1) return;
  // 陸戰隊員與受傷的殖民者共用病床，誰先快好就先躺
  const list: { u: number; set: (v: number) => void }[] = [
    ...r.injured.map((u, i) => ({ u, set: (v: number) => { r.injured[i] = v; } })),
    ...(r.hurt ?? []).map((h) => ({ u: h.until, set: (v: number) => { h.until = v; } })),
  ].filter((x) => x.u > s.t).sort((a, b) => a.u - b.u).slice(0, beds);
  for (const x of list) x.set(x.u - dt * (rate - 1));
}
/** 受傷的殖民者好了：回到原本的崗位（還有空位的話），否則變成閒置 */
function recover(s: GameState) {
  const r = s.raid;
  if (!r.hurt?.length) return;
  const done = r.hurt.filter((h) => h.until <= s.t);
  if (!done.length) return;
  r.hurt = r.hurt.filter((h) => h.until > s.t);
  for (const h of done) if (h.b && built(s, h.b) && s.b[h.b].workers < workerCap(s, h.b)) s.b[h.b].workers++;
  notify(s, 'n.recovered', { n: done.length }, 'good');
}
/** 戰鬥波及一般殖民者的機率：一定低於陸戰隊的受傷比例（陸戰隊倒下比例 × 0.3，打輸再 +2%）；沒人迎戰時 10%。一次最多 5 人 */
export function civHurtChance(won: boolean, fought: number, down: number) {
  if (!fought) return 0.1;
  const frac = down / fought;
  return won ? 0.3 * frac : Math.min(0.12, 0.3 * frac + 0.02);
}
function woundCivilians(s: GameState, p: number, heal: number, rng: () => number, max = 5) {
  const r = s.raid;
  r.hurt ??= [];
  // 候選人：各建築的工人（陸戰隊除外）與閒置的人
  const pool: (string | null)[] = [];
  for (const d of DEFS) if (d.id !== 'security' && built(s, d.id)) for (let i = 0; i < s.b[d.id].workers; i++) pool.push(d.id);
  for (let i = 0; i < idle(s); i++) pool.push(null);
  let n = 0;
  for (const b of pool) {
    if (n >= max) break;
    if (rng() >= p) continue;
    if (b) s.b[b].workers--;
    r.hurt.push({ until: s.t + heal, b });
    n++;
  }
  return n;
}
export const guards = (s: GameState) => (built(s, 'security') ? s.b.security.workers : 0);
export const injuredCount = (s: GameState) => s.raid.injured.filter((u) => u > s.t).length;
export const guardHp = (s: GameState) => 10 + nodeEffect(s, 'security', 'guardHp') + researchEffect(s, 'guardHp');
export function guardAtk(s: GameState, armed: boolean) {
  const base = armed ? 5 + nodeEffect(s, 'forge', 'weaponAtk') + researchEffect(s, 'weaponAtk') : 2;
  return base + nodeEffect(s, 'security', 'guardAtk');
}
export const enemyStats = (n: number) => ({ enemies: 3 + 2 * n, atk: 2 * Math.pow(1.1, n), hp: 8 * Math.pow(1.1, n) });
/** 階段 5 起的襲擊：仍是微光獸，數量較少、單體較強；拒絕企業 3 次以上改派赫利昂突擊隊（強度 ×1.5）。
 *  （「掠奪者」只留給舊存檔裡已經在路上的襲擊） */
export function raidFor(s: GameState) {
  const e = enemyStats(s.raid.won);
  if (s.stage < 5) return { ...e, kind: 'alien' as const };
  const commando = s.gov.corp.refusals >= 3 && s.raid.count % 2 === 1;
  const m = commando ? 1.5 : 1;
  // 強度從階段 5 重新起算（假設階段 4 大約擊退 3 次）：3 隻起跳，每次擊退 +1、數值 ×1.1
  const n = Math.max(0, s.raid.won - 3);
  return { enemies: 3 + n, atk: 5 * Math.pow(1.1, n) * m, hp: 18 * Math.pow(1.1, n) * m, kind: commando ? ('commando' as const) : ('alien' as const) };
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
export function combat(s: GameState, offline = false, rng = Math.random, dt = 0.2) {
  const r = s.raid;
  r.hurt ??= [];
  treat(s, dt);
  if (!offline) recover(s);
  // 武器配發：保全人數變少時武器退回庫存
  const g = guards(s);
  if (r.armed > g) { add(s, 'weapon', r.armed - g); r.armed = g; }
  while (r.armed < g && s.res.weapon >= 1) { s.res.weapon -= 1; r.armed++; }
  if (r.injured.length > g) r.injured = r.injured.sort((a, b) => b - a).slice(0, g);
  r.injured = r.injured.filter((u) => u > s.t);

  if (s.stage < 4 || s.finished) return;
  // 第一次襲擊：合成室啟動時的異晶共振把微光獸引來（劇情固定事件，見 fight）
  if (r.nextAt < 0) {
    if (r.count === 0 && !built(s, 'crystal_synth')) return;
    r.nextAt = s.t + (r.count === 0 ? SYNTH_RAID : FIRST_RAID);
  }
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
  // 第一次襲擊是劇情固定事件：一定擊退（殖民地不會因此失敗），但固定有兩名殖民者死亡、三人受傷，跟防禦強弱無關
  const scripted = r.count === 0;
  // 合作路線：微光獸來襲時，赫利昂駐軍有機會代為擊退（不用我們出戰，也不會有人受傷）
  if (!scripted && s.story.route === 'coop' && s.stage >= 5 && inc.kind !== 'commando' && rng() < 0.4) {
    r.count++; r.won++; s.story.corpHelp = (s.story.corpHelp ?? 0) + 1;
    notify(s, 'n.corpHelp', undefined, 'good');
    r.report = { won: true, raid: r.count, enemies: inc.enemies, guards: 0, armed: 0, turrets: 0, kind: inc.kind ?? 'alien', rounds: [], injured: 0, civHurt: 0, lines: [msg('l.corpHelp')] };
    r.nextAt = s.t + RAID_GAP[0] + rng() * (RAID_GAP[1] - RAID_GAP[0]);
    return;
  }
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
  const won = scripted || (ours.length > 0 && sum(theirs) <= 0);
  if (scripted && sum(theirs) > 0) rounds.push({ ours: sum(ours), theirs: 0, oursMax, theirsMax });
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
    if (inc.kind === 'commando') { add(s, 'credit', 500); lines.push(msg('l.commando')); s.story.commandoWon = (s.story.commandoWon ?? 0) + 1; }
    notify(s, 'n.raidWon', { kind: inc.kind ?? 'alien', n: r.won }, 'good');
  } else {
    const pool = (Object.keys(s.res) as ResKey[]).filter((k) => k !== 'oxygen' && RES_UNLOCK[k] <= s.stage && s.res[k] >= 10);
    if (pool.length) {
      const k = pool[Math.floor(rng() * pool.length)], v = Math.floor(s.res[k] * 0.15);
      s.res[k] -= v;
      lines.push(msg('l.stolen', { r: k, n: v }));
    }
    s.morale = Math.max(0, s.morale - 10);
    lines.push(msg('l.morale10'));
    notify(s, ours.length ? 'n.raidLost' : 'n.raidNoDef', { kind: inc.kind ?? 'alien' }, 'warn');
  }
  // 沒有醫療艙時實際休養時間是兩倍
  const slow = built(s, 'med_bay') ? 1 : 2;
  if (down) lines.push(msg('l.injured', { n: down, m: Math.round((heal * slow) / 60 * 10) / 10 }));
  if (scripted) {
    const dead = s.pop > 4 ? 2 : 0;
    for (let i = 0; i < dead; i++) leave(s);
    if (dead) lines.push(msg('l.died', { n: dead }));
  }
  const civ = woundCivilians(s, scripted ? 1 : civHurtChance(won, ready, down), INJURY * 0.8, rng, scripted ? Math.max(0, 3 - down) : 5);
  if (civ) lines.push(msg('l.civHurt', { n: civ, m: Math.round((INJURY * 0.8 * slow) / 60 * 10) / 10 }));
  // 第一次有人受傷而且還沒有醫療艙：提示去蓋
  if ((down || civ) && !built(s, 'med_bay') && !s.story.tips?.includes('med')) {
    (s.story.tips ??= []).push('med');
    if (!s.events.report) s.events.report = { title: msg('tip.medTitle'), text: msg('tip.medText'), gains: [] };
    notify(s, 'tip.medTitle', undefined, 'info');
  }
  r.report = { won, raid: r.count, enemies: inc.enemies, guards: ready, armed: armedReady, turrets: nt, kind: inc.kind ?? 'alien', rounds, injured: down, civHurt: civ, lines };
  r.nextAt = s.t + RAID_GAP[0] + rng() * (RAID_GAP[1] - RAID_GAP[0]);
}
