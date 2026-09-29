// 無畫面數值模擬器（GDD §15）：貪婪策略玩完 MVP，輸出各階段抵達時間。
// 用法：npm run sim            （預設按住點擊的時間比例 50%）
//       npm run sim -- 0.2     （比較少點擊的玩家）
import { newGame, DEF, DEFS, GameState, ResKey, RES_KEYS } from '../src/engine/state';
import { step, TICK } from '../src/engine/tick';
import { click } from '../src/engine/click';
import { rebuild, rebuildBlock, assign, boostBlock, buyNode, levelBlock, levelUp, nodeBlock, startBoost, startResearch, researchBlock, setSplit, togglePause } from '../src/engine/actions';
import { resolveEvent } from '../src/engine/events';
import { setTax, toggleCharter, trade, tradeBlock, partnerOpen } from '../src/engine/governance';
import { canAfford } from '../src/engine/formulas';
import { airSafety } from '../src/engine/air';
import { setFoodPerPop, built, foodSafety, idle, levelCost, netRates, popCap, storageCap, workerCap, RESEARCH_DEFS } from '../src/engine/formulas';

const duty = Number(process.argv[2] ?? 0.5);
const dumpAt = Number(process.argv[3] ?? 0);
if (process.env.FOOD) setFoodPerPop(Number(process.env.FOOD));
let starve = 0, lowFood = 0, midFood = 0, hypoxic = 0, lowAir = 0;
const made: Record<string, number> = {}, full: Record<string, number> = {}, empty: Record<string, number> = {};
let prevRes: Record<string, number> = {};   // 除錯用：到達此階段時輸出存檔 JSON 並結束
let seed = 7;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const PRODUCER: Record<ResKey, string[]> = {
  nutrient: ['algae_tank'], oxygen: ['o2_scrubber', 'electrolyzer'], scrap: ['scrap_heap'], rock: ['rock_cutter'],
  parts: ['assembly'], metal: ['metal_mine'], tools: ['forge'], weapon: ['forge'], crystal: ['crystal_synth'], credit: ['trade_post'],
};
const TARGETS = ['emergency_camp', 'central_hub', 'outpost', 'colony_core', 'star_dome'];

function target(s: GameState) {
  const t = TARGETS.find((id) => !built(s, id));
  if (t) return t;
  if (s.b.orbital_beacon.level >= DEF.orbital_beacon.maxLevel) return undefined!;
  // 信標要人口 100：人口不夠時先蓋天幕住宅（否則機器人不會去挖岩材）
  if (s.pop < (DEF.orbital_beacon.requires?.pop ?? 0) && s.b.sky_residence.level < DEF.sky_residence.maxLevel && s.pop >= popCap(s) - 2) return 'sky_residence';
  return 'orbital_beacon';
}
function lacking(s: GameState, id: string | undefined): ResKey | null {
  if (!id) return null;
  const c = levelCost(s, id);
  let worst: ResKey | null = null, gap = 0;
  for (const [k, v] of Object.entries(c) as [ResKey, number][]) {
    const g = (v - s.res[k]) / Math.max(v, 1);
    if (g > gap) { gap = g; worst = k; }
  }
  return worst;
}
function tryBuy(s: GameState, id: string) { return !levelBlock(s, id) && levelUp(s, id); }
function producerFor(s: GameState, k: ResKey): string | null {
  for (const id of PRODUCER[k]) if (built(s, id)) return id;
  return null;
}

function decide(s: GameState) {
  s.story.seenIntro = Math.min(s.stage, 6);   // 玩家看完章節開場（劇情對話與伊涅絲事件要靠它觸發）
  if (s.events.active) {
    const k = s.events.active.kind;
    resolveEvent(s, k === 'rescue_ines' ? (idle(s) >= 2 ? 0 : 1) : k === 'meteor' ? 0 : k === 'envoy' ? (s.gov.corp.demand && canAfford(s, s.gov.corp.demand) ? 0 : 1) : 1);
  }
  if (s.stage >= 5 && built(s, 'admin')) {
    setTax(s, 2);
    if (!s.gov.charters.length) toggleCharter(s, 'double_shift');
  }
  // 賣掉快滿倉、而且目標用不到那麼多的資源
  if (partnerOpen(s, 'corp')) for (const k of ['scrap', 'nutrient', 'tools', 'parts', 'rock'] as ResKey[]) {
    const need = (levelCost(s, target(s) ?? 'star_dome') as any)[k] ?? 0;
    if (s.res[k] > storageCap(s) * 0.9 && s.res[k] - 100 > need && !tradeBlock(s, 'corp', k, 'sell')) trade(s, 'corp', k, 'sell');
  }
  const tgt = target(s);
  if (!tgt) return;
  const need = lacking(s, tgt);
  // 1. 蓋目標或必要的生產鏈
  if (tryBuy(s, tgt)) return;
  if (!rebuildBlock(s, 'algae_tank')) { rebuild(s, 'algae_tank'); rebuilt.push(`改建 ${s.b.algae_tank.form}：${fmt(s.t)}（階段 ${s.stage}、人口 ${s.pop}）`); return; }
  if (s.stage >= 6) {
    for (const id of ['governor', 'bioeng']) if (!built(s, id) && tryBuy(s, id)) return;
    if (s.pop >= popCap(s) - 1 && tryBuy(s, 'sky_residence')) return;
    if (s.res.crystal > 200 && !boostBlock(s)) startBoost(s);
  }
  if (s.stage >= 5) {
    for (const id of ['admin', 'trade_post']) if (!built(s, id) && tryBuy(s, id)) return;
    if (s.b.turret.level < 3 && tryBuy(s, 'turret')) return;
    if (s.b.security.level < 3 && tryBuy(s, 'security')) return;
    if (s.pop >= popCap(s) - 1 && tryBuy(s, 'hab_pod')) return;
  }
  if (s.stage >= 4) {
    if (!built(s, 'security') && tryBuy(s, 'security')) return;
    if (built(s, 'security') && s.b.security.level < 2 && s.b.security.workers >= workerCap(s, 'security') && tryBuy(s, 'security')) return;
    if (built(s, 'security') && s.b.forge.level < 3 && tryBuy(s, 'forge')) return;
  }
  if (s.stage >= 2 && built(s, 'emergency_camp')) {
    const cost = levelCost(s, tgt);
    const maxCost = Math.max(...Object.values(cost) as number[]);
    if (maxCost > storageCap(s) && tryBuy(s, 'cargo')) return;
    const popNeed = DEF[tgt].requires?.pop ?? 0;
    if (s.pop >= popCap(s) - 1 && s.pop < popNeed + 2 && tryBuy(s, 'hab_pod')) return;
  }
  // 氧氣：先蓋再生器、第 2 章蓋電解站；空氣不夠時升級產氧建築
  if (!built(s, 'o2_scrubber') && tryBuy(s, 'o2_scrubber')) return;
  if (s.stage >= 2 && !built(s, 'electrolyzer') && tryBuy(s, 'electrolyzer')) return;
  if (airSafety(s) < 0.5 || netRates(s).oxygen < 0) {
    const p = ['electrolyzer', 'o2_scrubber'].find((x) => built(s, x));
    if (p && s.b[p].workers >= workerCap(s, p) && tryBuy(s, p)) return;
  }
  for (const id of ['algae_tank', 'assembly', 'rock_cutter', 'lounge', 'metal_mine', 'forge', 'databank', 'rail_line', 'security', 'crystal_synth', 'water_cycle'])
    if (!built(s, id) && DEF[id].stage <= s.stage && tryBuy(s, id)) return;
  // 2. 工人位子不夠就升級需要的生產建築
  if (need) {
    const p = producerFor(s, need);
    if (p && s.b[p].workers >= workerCap(s, p) && idle(s) === 0 && tryBuy(s, p)) return;
  }
  if (s.res.nutrient < 10 || foodSafety(s) < 0.3) {
    const p = producerFor(s, 'nutrient');
    if (p && s.b[p].workers >= workerCap(s, p) && tryBuy(s, p)) return;
  }
  // 需要存廢料時暫停組裝工坊
  const scrapNeed = Math.max((levelCost(s, tgt) as any).scrap ?? 0, s.pop >= popCap(s) - 1 ? ((levelCost(s, 'hab_pod') as any).scrap ?? 0) : 0);
  const wantPause = s.res.scrap < scrapNeed && s.res.parts >= 50;
  if (built(s, 'assembly') && !!s.b.assembly.paused !== wantPause) togglePause(s, 'assembly');
  // 3. 升級節點（產量類）與研究
  for (const d of DEFS) for (const n of d.upgrades ?? []) {
    if (!built(s, d.id) || nodeBlock(s, d.id, n.id)) continue;
    if (n.effect.prodAdd || n.effect.clickAdd || n.effect.workerCapAdd || n.effect.housingAdd || n.effect.recipeOut) { buyNode(s, d.id, n.id); return; }
  }
  for (const r of RESEARCH_DEFS) if (!researchBlock(s, r.id)) { startResearch(s, r.id); return; }
}

function reassign(s: GameState) {
  for (const d of DEFS) while (s.b[d.id].workers) assign(s, d.id, -1);
  const tgt = target(s);
  const order: string[] = [];
  const rate = netRates(s);
  const food = foodSafety(s) < 0.8 || rate.nutrient < 0.2;
  // 氧氣：一個一個加人，直到氧氣淨產出為正（優先電解站）
  for (let g = 0; g < 60 && (netRates(s).oxygen < 0.15 + s.pop * 0.01 || airSafety(s) < 0.4 && netRates(s).oxygen < 0.6); g++) {
    const id = ['electrolyzer', 'o2_scrubber'].find((x) => built(s, x) && s.b[x].workers < workerCap(s, x));
    if (!id || !assign(s, id, 1)) break;
  }
  // 糧食：一個一個加人，直到營養淨產出轉正（而不是把糧食建築塞滿）
  for (let g = 0; g < 60 && (netRates(s).nutrient < 0.3 + s.pop * 0.02 || (food && foodSafety(s) < 0.3 && netRates(s).nutrient < 1)); g++) {
    const id = PRODUCER.nutrient.find((x) => built(s, x) && s.b[x].workers < workerCap(s, x));
    if (!id || !assign(s, id, 1)) break;
  }
  if (built(s, 'security')) order.push('security', 'forge');
  if (s.pop >= popCap(s) - 1 && s.res.scrap < ((levelCost(s, 'hab_pod') as any).scrap ?? 0)) order.push('scrap_heap');
  if (built(s, 'databank') && s.research.active) order.push('databank');
  let need = lacking(s, tgt);
  // 需要的資源還沒有產出建築時，改看「蓋那棟建築缺什麼」
  for (let depth = 0; depth < 4 && need && !producerFor(s, need); depth++) {
    const p = PRODUCER[need].find((x) => DEF[x].stage <= s.stage);
    const next = p ? lacking(s, p) : null;
    if (!next) break;
    need = next;
  }
  if (need) {
    if (need === 'parts') order.push('assembly', 'scrap_heap');
    else if (need === 'tools') order.push('forge', 'metal_mine');
    else order.push(...PRODUCER[need]);
  }
  order.push('lounge', ...PRODUCER.nutrient, 'assembly', 'scrap_heap', 'metal_mine', 'forge', 'rock_cutter');
  order.push('crystal_synth');
  let guard = 0;
  while (idle(s) > 0 && guard++ < 200) {
    const id = order.find((x) => built(s, x) && s.b[x].workers < workerCap(s, x));
    if (!id) break;
    assign(s, id, 1);
  }
  // 保全沒有武器就讓一位鍛造工改做武器
  if (s.stage >= 4) setSplit(s, 'forge', s.raid.armed + s.res.weapon < s.b.security.workers ? Math.max(1, s.b.forge.workers - 1) : 0);
}

const s = newGame(0);
const marks: string[] = [];
const rebuilt: string[] = [];
const raids: string[] = [];
const stageAt: Record<number, number> = {};
const marksTime = (st: number) => (stageAt[st] ??= s.t) + 150;
let lastStage = 1, clickAcc = 0;
const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
for (let i = 0; i < (8 * 3600) / TICK && !s.finished && !s.failed; i++) {
  if (i % 5 === 0) { decide(s); if (i % 25 === 0) reassign(s); }
  clickAcc += duty;                          // 每 0.2 秒一次點擊 × 按住比例
  if (clickAcc >= 1) {
    clickAcc -= 1;
    const need = lacking(s, target(s));
    const id = (need && producerFor(s, need)) || 'scrap_heap';
    click(s, id, rng);
  }
  step(s, TICK, { rng });
  if (s.starving) starve += TICK;
  // 資源統計：累計產量、滿倉時間、見底時間（用來看哪種資源過剩、哪種卡關）
  const capNow = storageCap(s);
  for (const k of RES_KEYS) {
    const d = s.res[k] - (prevRes[k] ?? s.res[k]);
    if (d > 0) made[k] = (made[k] ?? 0) + d;
    if (s.res[k] >= capNow - 0.5) full[k] = (full[k] ?? 0) + TICK;
    if (s.stage >= ({ nutrient: 1, scrap: 1, rock: 2, parts: 2, metal: 3, tools: 3, weapon: 4, crystal: 4 } as any)[k] && s.res[k] < 5) empty[k] = (empty[k] ?? 0) + TICK;
  }
  prevRes = { ...s.res };
  if (foodSafety(s) < 0.25) lowFood += TICK;
  if (s.air?.hypoxic) hypoxic += TICK;
  if (airSafety(s) < 0.25) lowAir += TICK;
  if (s.stage >= 2 && s.stage <= 3 && foodSafety(s) < 0.5) midFood += TICK;
  if (s.raid.report) { raids.push(`襲擊 ${s.raid.report.raid}：${fmt(s.t)} ${s.raid.report.kind} ${s.raid.report.won ? '勝' : '敗'}（敵 ${s.raid.report.enemies}，保全 ${s.raid.report.guards}，武裝 ${s.raid.report.armed}，砲塔 ${s.raid.report.turrets ?? 0}）`); s.raid.report = null; }
  if (s.stage !== lastStage) { marks.push(`階段 ${s.stage}：${fmt(s.t)}（人口 ${s.pop}）`); lastStage = s.stage; }
  if (dumpAt && s.stage === dumpAt && s.t > marksTime(dumpAt)) { s.story.seenIntro = Math.min(3, s.stage); s.lastSaved = Date.now(); console.log(JSON.stringify({ ...s, notices: [] })); process.exit(0); }
}
console.log(`按住點擊比例 ${Math.round(duty * 100)}%`);
for (const m of marks) console.log('  ' + m);
for (const m of raids) console.log('  ' + m);
for (const m of rebuilt) console.log('  ' + m);
console.log(`  結束：${s.finished ? '信標點亮' : '未完成'}（信標 ${s.b.orbital_beacon.level}/5），時間 ${fmt(s.t)}，人口 ${s.pop}/${popCap(s)}，士氣 ${s.morale.toFixed(0)}`);
console.log('  資源：' + RES_KEYS.map((k) => `${k} ${Math.floor(s.res[k])}`).join('、'));
console.log('  建築：' + DEFS.filter((d) => built(s, d.id)).map((d) => `${d.name}${s.b[d.id].level}`).join(' '));
console.log(`  缺氧累計 ${fmt(hypoxic)}，空氣安全度低於 25% 累計 ${fmt(lowAir)}；${s.failed ? '殖民地瓦解（' + s.failReason + '）' : ''}`);
console.log(`  缺糧（營養歸零）累計 ${fmt(starve)}，食物安全度低於 25% 累計 ${fmt(lowFood)}；階段 2–3 低於 50% 累計 ${fmt(midFood)}`);
console.log('  資源（累計產量／滿倉時間／見底時間）：');
for (const k of RES_KEYS) console.log(`    ${k.padEnd(9)} ${String(Math.round(made[k] ?? 0)).padStart(6)}  滿 ${fmt(full[k] ?? 0)}  空 ${fmt(empty[k] ?? 0)}`);
console.log('  影片基準：營地 5:00、中央艙 28:00、前哨站 42:00、首次襲擊 65:00');
