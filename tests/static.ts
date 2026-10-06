// 靜態檢查：不開瀏覽器，直接檢查資料與純邏輯。用法：npx tsx tests/static.ts（tests/run-all.sh 會呼叫）
// 每項輸出 PASS／FAIL 與原因；有任何 FAIL 時結束碼為 1。
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { SCENES } from '../src/data/dialogs';
import { SCENE_IDS, DIALOG_VERSION } from '../src/engine/dialog';
import { CHAPTERS } from '../src/engine/story';
import { STRINGS } from '../src/i18n/strings';
import EN from '../src/i18n/data-en';
import { DEFS } from '../src/engine/state';
import { RESEARCH_DEFS, hasXenoLab, workerCap } from '../src/engine/formulas';
import { newGame } from '../src/engine/state';
import { levelBlock, levelUp, rebuild, rebuildBlock, researchBlock } from '../src/engine/actions';
import { step } from '../src/engine/tick';
import { buyBlock, buyGood, buyPrice, cargoUsed, partner, sellGood, sellPrice, DROP_TIME } from '../src/engine/market';
import { creditsCh5, artId, gatherRate, levelEff, LEVEL_EFF, clickBuff } from '../src/engine/formulas';
import { MODULES, buildModule, moduleBlock, shipReady } from '../src/engine/ship';
import { resolveEvent } from '../src/engine/events';
import { lineOk } from '../src/engine/dialog';
import { market } from '../src/engine/market';
import { healRate, applyMedicine, medBlock } from '../src/engine/combat';
import { PRICE, tradeBlock } from '../src/engine/governance';
import { CHAPTERS as CH, goalDone } from '../src/engine/story';
import { stepFacing } from '../src/art/facing.js';
import { patrolAt, ROUTES as ROADS } from '../src/scene/layout';
import { PACKS } from '../src/i18n/locales';
import { MOOD_TABLES } from '../src/data/moods';
import { existsSync } from 'fs';

const results: { id: string; name: string; ok: boolean; info: string }[] = [];
function check(id: string, name: string, fn: () => string[] | string | void) {
  let errs: string[] = [];
  try { const r = fn(); errs = Array.isArray(r) ? r : r ? [r] : []; } catch (e: any) { errs = ['例外：' + e.message]; }
  results.push({ id, name, ok: errs.length === 0, info: (process.env.ALL ? errs : errs.slice(0, 8)).join('；') + (errs.length > 8 && !process.env.ALL ? `……共 ${errs.length} 項` : '') });
}

// ── 劇情對話 ──
check('S01', '每個觸發條件都有對應的對話內容，每段對話都有觸發條件', () => {
  const errs: string[] = [];
  for (const id of SCENE_IDS) if (!SCENES[id]) errs.push(`觸發 ${id} 沒有對話內容`);
  for (const id of Object.keys(SCENES)) if (!SCENE_IDS.includes(id)) errs.push(`對話 ${id} 沒有觸發條件`);
  return errs;
});
const SPEAKERS = ['mara', 'teo', 'juno', 'ines', 'sefa', 'voss', 'calder', 'narr', 'colonist', 'survivor', 'marine', 'youth', 'alliance', 'trader'];
const ROUTES = [undefined, 'coop', 'resist', 'alien', 'alliance', 'rifle', 'ship', 'noship'];
check('S02', '每句台詞都有中英文、說話者與路線標籤合法、沒有殘留的 {…} 參數', () => {
  const errs: string[] = [];
  for (const [id, sc] of Object.entries(SCENES)) {
    sc.lines.forEach((l, i) => {
      const [who, zh, en, route] = l;
      if (!SPEAKERS.includes(who)) errs.push(`${id}#${i} 說話者 ${who}`);
      if (!zh?.trim() || !en?.trim()) errs.push(`${id}#${i} 缺中文或英文`);
      if (!ROUTES.includes(route)) errs.push(`${id}#${i} 路線 ${route}`);
      for (const t of [zh, en]) for (const m of t.match(/\{[^}]*\}/g) ?? []) if (m !== '{day}') errs.push(`${id}#${i} 參數 ${m}`);
    });
    if (sc.log && (!sc.log[0]?.trim() || !sc.log[1]?.trim())) errs.push(`${id} 日誌缺中文或英文`);
    if (!sc.lines.length && !sc.log) errs.push(`${id} 沒有台詞也沒有日誌`);
  }
  return errs;
});

// ── 主線目標 ──
check('S03', '每章目標 id 不重複、英文目標數量與中文一致', () => {
  const errs: string[] = [];
  CHAPTERS.forEach((c, i) => {
    const ids = c.goals.map((g) => g.gid);
    if (new Set(ids).size !== ids.length) errs.push(`第 ${c.chapter} 章目標 id 重複：${ids.join(',')}`);
    const en = (EN.chapters as any)[i]?.goals ?? [];
    if (en.length !== c.goals.length) errs.push(`第 ${c.chapter} 章英文目標 ${en.length} 項、中文 ${c.goals.length} 項`);
  });
  return errs;
});
check('S04', '第 4 章：合成室排第一；營區、醫療艙標記為第一次襲擊後才出現；目標 id 維持舊值', () => {
  const g = CHAPTERS[3].goals, errs: string[] = [];
  if (g[0].id !== 'crystal_synth') errs.push('第一個目標不是異晶合成室');
  for (const id of ['security', 'med_bay']) if (g.find((x) => x.id === id)?.after !== 'raid1') errs.push(`${id} 沒有 after: raid1`);
  const want: Record<string, string> = { crystal_synth: '4-1', security: '4-0', med_bay: '4-med', colony_core: '4-4' };
  for (const [id, gid] of Object.entries(want)) if (g.find((x) => x.id === id)?.gid !== gid) errs.push(`${id} 的 id 不是 ${gid}`);
  return errs;
});

// ── 文字與翻譯 ──
// unit.*：中文量詞（隻、名），英文本來就沒有
check('S05', '介面字串中英文都不是空的（量詞 unit.* 英文可以空）', () =>
  Object.entries(STRINGS).filter(([k, v]) => !v[1]?.trim() || (!v[0]?.trim() && !k.startsWith('unit.'))).map(([k]) => k));
check('S06', '每棟建築、每個升級節點、每項研究都有英文', () => {
  const errs: string[] = [];
  for (const d of DEFS) {
    const b = (EN.buildings as any)[d.id];
    if (!b?.name || !b?.desc) { errs.push(`建築 ${d.id}`); continue; }
    for (const n of d.upgrades ?? []) if (!b.nodes?.[n.id]) errs.push(`節點 ${d.id}.${n.id}`);
  }
  for (const r of RESEARCH_DEFS) if (!(EN.research as any)[r.id]) errs.push(`研究 ${r.id}`);
  return errs;
});
check('S07', '玩家看得到的文字裡沒有「出生率」（新殖民者是倖存者，不是出生）', () => {
  const errs: string[] = [];
  for (const f of ['src/data/buildings.json', 'src/data/charters.json', 'src/data/research.json', 'src/i18n/strings.ts', 'src/i18n/data-en.ts'])
    if (/出生率|[Bb]irth rate/.test(readFileSync(f, 'utf8'))) errs.push(f);
  return errs;
});

// ── 美術 ──
check('S08', '每棟建築與改建形態都有手繪圖', () => {
  const meta = JSON.parse(readFileSync('src/assets/buildings/meta.json', 'utf8')).buildings;
  const need = DEFS.flatMap((d: any) => [d.id, ...(d.forms ?? []).map((f: any) => f.art).filter(Boolean)]);
  return need.filter((id: string) => !meta[id]).map((id: string) => `缺 ${id}`);
});
check('S09', '小人 sprite sheet 都在（殖民者、陸戰隊、突擊隊、微光獸）', () =>
  ['colonist', 'marine', 'commando', 'glimmer'].filter((k) => { try { readFileSync(`src/assets/sprites/${k}.png`); return false; } catch { return true; } }).map((k) => `缺 ${k}.png`));

// ── 小人轉向（高更新率螢幕不能左右閃） ──
check('S10', '巡邏 2 分鐘：30～165Hz、縮放 2／3 倍，轉向次數都一樣且很少', () => {
  const errs: string[] = [], counts: number[] = [];
  for (const fps of [30, 60, 120, 144, 165]) for (const Z of [2, 3]) {
    const st: any = { facing: 'down', flip: false, moving: true, lx: null, ly: null, vx: 0, vy: 0 };
    let changes = 0, prev = 'down|false';
    for (let f = 0; f < fps * 120; f++) {
      const p = patrolAt((f / fps) * 11);
      stepFacing(st, Math.round(p.x * Z) / Z, Math.round(p.y * Z) / Z);
      const now = `${st.facing}|${st.facing === 'side' && st.flip}`;
      if (now !== prev) changes++;
      prev = now;
    }
    counts.push(changes);
    if (changes > 20) errs.push(`${fps}Hz×${Z}：${changes} 次`);
  }
  if (new Set(counts).size > 2) errs.push(`不同更新率結果差太多：${counts.join(',')}`);
  return errs;
});

check('S11', '建築道路只有水平／垂直線段（都市計畫式的直角道路）', () => {
  const errs: string[] = [];
  if (!ROADS || !Object.keys(ROADS).length) return ['讀不到道路'];
  for (const [id, r] of Object.entries(ROADS) as [string, { x: number; y: number }[]][]) for (let i = 1; i < r.length; i++) if (r[i].x !== r[i - 1].x && r[i].y !== r[i - 1].y) errs.push(`${id} 第 ${i} 段是斜的`);
  return errs;
});

// ── 其他語言（德、日、西、葡）：缺的會退回英文，所以這裡只擋「翻壞」的情況 ──
// 參數名稱要跟英文一致（{n|單|複} 算 n；日文、中文的量詞 {unit} 可以多出來）
const params = (x: string) => new Set([...x.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]).filter((k) => k !== 'unit'));
const sameParams = (a: string, b: string) => { const x = params(a), y = params(b); return x.size === y.size && [...x].every((k) => y.has(k)); };
const flat = (o: any, pre = ''): [string, string][] => typeof o === 'string' ? [[pre, o]] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => flat(v, pre ? `${pre}.${k}` : k)) : [];
check('S12', '德、日、西、葡翻譯：介面與劇情齊全、句數一致、參數沒有翻漏或多出', () => {
  const errs: string[] = [];
  const enData = Object.fromEntries(flat(EN));
  for (const [l, p] of Object.entries(PACKS)) {
    const missUi = Object.keys(STRINGS).filter((k) => !(k in p.ui) && STRINGS[k][0].trim());
    if (missUi.length) errs.push(`${l} 介面缺 ${missUi.length} 條（例：${missUi.slice(0, 3).join(', ')}）`);
    for (const [k, v] of Object.entries(p.ui)) {
      if (!STRINGS[k]) errs.push(`${l} 介面多出不存在的 ${k}`);
      else if (!sameParams(STRINGS[k][0], v)) errs.push(`${l} 介面 ${k} 參數不同`);
    }
    const data = flat(p.data);
    if (!data.length) errs.push(`${l} 沒有資料翻譯`);
    for (const [k, v] of data) {
      if (!(k in enData)) errs.push(`${l} 資料多出 ${k}`);
      else if (!sameParams(enData[k], v)) errs.push(`${l} 資料 ${k} 參數不同`);
    }
    for (const [id, sc] of Object.entries(SCENES)) {
      const t = p.dialogs[id];
      if (!t) { errs.push(`${l} 劇情缺 ${id}`); continue; }
      if (t.lines.length !== sc.lines.length) errs.push(`${l} ${id} 句數 ${t.lines.length}／原文 ${sc.lines.length}`);
      t.lines.forEach((x, i) => { if (!x?.trim()) errs.push(`${l} ${id}#${i} 空白`); else if (sc.lines[i] && !sameParams(sc.lines[i][2], x)) errs.push(`${l} ${id}#${i} 參數不同`); });
      if (!!sc.log !== !!t.log) errs.push(`${l} ${id} 日誌${sc.log ? '缺' : '多出'}`);
    }
  }
  return errs;
});

check('S13', '表情標記都對到存在的台詞，而且真的是那個角色說的；每張表情圖都有對應的預設立繪', () => {
  const errs: string[] = [];
  const CHARS = ['mara', 'teo', 'juno', 'ines', 'sefa', 'voss', 'calder'];
  for (const [who, table] of Object.entries(MOOD_TABLES)) for (const [id, m] of Object.entries(table)) {
    const sc = SCENES[id];
    if (!sc) { errs.push(`沒有 ${id} 這段對話`); continue; }
    for (const i of Object.keys(m)) {
      const line = sc.lines[+i];
      if (!line) errs.push(`${id}#${i} 沒有這句`);
      else if (line[0] !== who) errs.push(`${id}#${i} 是 ${line[0]} 說的，卻標在 ${who} 的表情表`);
    }
    if (!CHARS.includes(who)) errs.push(`${who} 沒有立繪`);
  }
  for (const c of CHARS) for (const mood of ['angry', 'sad', 'joy'])
    if (existsSync(`src/assets/portraits/${c}-${mood}.webp`) && !existsSync(`src/assets/portraits/${c}.webp`)) errs.push(`${c} 有 ${mood} 表情但沒有預設立繪`);
  return errs;
});

check('S17', '新遊戲的對話版本（dlgV）等於 DIALOG_VERSION，不然新存檔一讀進來就被當成舊存檔轉換（會把還沒播的場景標成播過）', () =>
  newGame(0).story.dlgV === DIALOG_VERSION ? [] : [`newGame 的 dlgV ${newGame(0).story.dlgV} ≠ DIALOG_VERSION ${DIALOG_VERSION}`]);

check('S14', '研究院合併：第 5 章科技研究院改建成異星研究院，異星研究線解鎖，研究員名額每級 3 人', () => {
  const errs: string[] = [];
  const s = newGame(0);
  s.b.databank.level = 3;
  const labR = RESEARCH_DEFS.find((r) => r.lab);
  if (!labR) return '找不到異星研究線的研究';
  s.stage = 4;
  if (!rebuildBlock(s, 'databank')) errs.push('第 4 章就能改建');
  s.stage = 5;
  s.research.done = RESEARCH_DEFS.filter((r) => !r.lab).map((r) => r.id);   // 前置研究都做完，只看異星研究院這個條件
  Object.assign(s.res, { rock: 99999, crystal: 99999, parts: 99999 });
  if (researchBlock(s, labR.id)?.k !== 'why.lab') errs.push(`改建前 ${labR.id} 應該卡在「需要異星研究院」，實際 ${researchBlock(s, labR.id)?.k ?? '可研究'}`);
  if (!rebuild(s, 'databank')) errs.push('第 5 章改建失敗：' + (rebuildBlock(s, 'databank')?.k ?? ''));
  if (!hasXenoLab(s)) errs.push('改建後 hasXenoLab 應為 true');
  if (researchBlock(s, labR.id)?.k === 'why.lab') errs.push('改建後異星研究線仍然鎖住');
  if (workerCap(s, 'databank') !== 9) errs.push(`Lv3 改建後研究員上限應為 9，實際 ${workerCap(s, 'databank')}`);
  if (DEFS.some((d) => d.id === 'xeno_lab')) errs.push('xeno_lab 仍是獨立建築');
  return errs;
});

check('S15', '第 4 章貿易：合成室開機後喜鵲來聯絡 → 貿易站解鎖 → 賣出、買進 → 60 秒後貨櫃落地，目標完成、播出 c4-cargo', () => {
  const errs: string[] = [];
  const s = newGame(0);
  s.stage = 4; s.story.seenIntro = 4;
  Object.assign(s.res, { rock: 5000, parts: 5000, metal: 5000, tools: 500, nutrient: 3000, credit: 0 });
  if (!levelBlock(s, 'trade_post')) errs.push('還沒跟喜鵲聯絡就能蓋貿易站');
  s.story.seen!.push('c4-synth');
  step(s);
  if (!s.story.seen!.includes('c4-trader')) errs.push('合成室開機後沒有觸發 c4-trader');
  if (levelBlock(s, 'trade_post')) errs.push('看過 c4-trader 仍然不能蓋貿易站：' + levelBlock(s, 'trade_post')!.k);
  levelUp(s, 'trade_post');
  if (buyBlock(s, 'electronics')?.k !== 'why.credit') errs.push('沒錢時應該不能買');
  const p0 = sellPrice(s, 'metal');
  for (let i = 0; i < 6; i++) sellGood(s, 'metal');
  if (!(sellPrice(s, 'metal') < p0)) errs.push(`賣多了收購價應該下降：${p0} → ${sellPrice(s, 'metal')}`);
  const b0 = buyPrice(s, 'electronics');
  if (!buyGood(s, 'electronics')) errs.push('買電子元件失敗：' + (buyBlock(s, 'electronics')?.k ?? ''));
  if (!(buyPrice(s, 'electronics') > b0)) errs.push('買了之後售價應該上升');
  if (cargoUsed(s) !== 10 || s.cargo.electronics !== 0) errs.push(`下單後應該在路上、還沒進貨艙：已用 ${cargoUsed(s)}、貨艙 ${s.cargo.electronics}`);
  const g = CH[3].goals.find((x) => x.gid === '4-drop');
  if (!g) errs.push('第 4 章沒有 4-drop 目標');
  for (let t = 0; t < DROP_TIME + 1; t += 0.2) step(s);
  if (s.cargo.electronics !== 10) errs.push(`${DROP_TIME} 秒後貨櫃應該落地：貨艙 ${s.cargo.electronics}`);
  if (g && !goalDone(s, g)) errs.push('第一個貨櫃落地後目標沒完成');
  if (!s.story.seen!.includes('c4-cargo')) errs.push('第一個貨櫃落地後沒有觸發 c4-cargo');
  if (s.story.seen!.includes('c4-trader') && !s.story.seen!.includes('c4-trader-ride')) errs.push('c4-cargo 之後沒有接 c4-trader-ride');
  return errs;
});

check('S16', '路線交易條件：合作＝赫利昂市場（電子元件較便宜、四種進口品都買得到）；抵抗＋太空港＝稀有金屬較便宜；第 5 章信用點從進入第 5 章才開始算', () => {
  const errs: string[] = [];
  const base = newGame(0), raw = buyPrice(base, 'electronics'), rawR = buyPrice(base, 'raremetal');
  const coop = newGame(0); coop.story.route = 'coop';
  if (partner(coop) !== 'helion') errs.push('合作路線的交易對象應該是赫利昂');
  if (!(buyPrice(coop, 'electronics') < raw)) errs.push('赫利昂的電子元件應該比較便宜');
  coop.b.trade_post.level = 1; coop.res.credit = 99999;
  for (const k of ['electronics', 'raremetal', 'fuel', 'medicine'] as const) if (buyBlock(coop, k)) errs.push(`赫利昂市場買不到 ${k}：${buyBlock(coop, k)!.k}`);
  const res = newGame(0); res.story.route = 'resist';
  if (partner(res) !== 'magpie') errs.push('抵抗路線應該還是喜鵲');
  res.b.spaceport.level = 1;
  if (!(buyPrice(res, 'raremetal') < rawR)) errs.push('抵抗路線蓋了太空港，稀有金屬應該比較便宜');
  const c5 = newGame(0); c5.gov.creditsEarned = 3000; c5.stage = 4;
  if (creditsCh5(c5) !== 0) errs.push('第 4 章時第 5 章信用點應為 0');
  c5.stage = 5; c5.gov.credits5 = 3000; c5.gov.creditsEarned = 3500;
  if (creditsCh5(c5) !== 500) errs.push(`第 5 章信用點應為 500，實際 ${creditsCh5(c5)}`);
  return errs;
});


check('S18', '船塢：看過 c3-ship 才能蓋 → 模組依章節開放、進口品從貨艙扣 → 第 6 章沒造好不能離開、「先等等」、造好再跳抉擇 → 離開後信標停在第 3 段、裝星際引擎即結局', () => {
  const errs: string[] = [];
  const s = newGame(0);
  const flush = () => { s.story.queue = []; step(s); };
  s.stage = 3; s.story.seenIntro = 3;
  Object.assign(s.res, { rock: 9000, parts: 9000, metal: 9000, tools: 900, nutrient: 3000, crystal: 500, credit: 0 });
  if (levelBlock(s, 'shipyard')?.k !== 'why.scene.c3-ship') errs.push('沒看過 c3-ship 就能蓋船塢');
  s.story.seen!.push('c3-ship');
  if (!levelUp(s, 'shipyard')) errs.push('看過 c3-ship 仍蓋不了船塢：' + levelBlock(s, 'shipyard')?.k);
  flush();
  if (!s.story.seen!.includes('c3-shipyard')) errs.push('蓋好船塢沒播 c3-shipyard');
  if (artId(s, 'shipyard') !== 'shipyard') errs.push('空船塢的圖不對');
  if (!buildModule(s)) errs.push('第 3 章裝不了船體：' + moduleBlock(s)?.k);
  flush();
  if (!s.story.seen!.includes('c3-hull')) errs.push('船體完成沒播 c3-hull');
  if (artId(s, 'shipyard') !== 'shipyard_1') errs.push('船體完成後應該換成骨架圖');
  if (moduleBlock(s)?.k !== 'why.stage') errs.push('第 3 章就能裝導航');
  s.stage = 4;
  if (moduleBlock(s)?.k !== 'why.afford') errs.push('沒有電子元件也能裝導航');
  s.cargo.electronics = 60; s.cargo.medicine = 40; s.cargo.fuel = 120; s.cargo.raremetal = 50;
  buildModule(s); buildModule(s); flush();
  if (s.ship.mods !== 3 || s.cargo.electronics !== 0) errs.push(`導航＋維生後應有 3 個模組、電子元件用完：${s.ship.mods}、${s.cargo.electronics}`);
  if (!s.story.seen!.includes('c4-nav') || !s.story.seen!.includes('c4-life')) errs.push('導航、維生沒播對話');
  // 第 6 章：討論完，船還沒造好
  s.stage = 6; s.story.seenIntro = 6;
  s.b.orbital_beacon.level = 3;
  s.story.seen!.push('c6-beacon1', 'c6-lastlight', 'c6-truth', 'c6-debate');
  flush();
  if (!s.story.seen!.includes('c6-name')) errs.push('看過 c6-lastlight、船體完成，沒播 c6-name');
  if (lineOk(s, 'ship') || !lineOk(s, 'noship')) errs.push('船沒造好時 ship／noship 標籤判斷錯誤');
  flush();
  if (s.events.active?.kind !== 'choice6') errs.push('討論完沒跳出抉擇');
  resolveEvent(s, 0);
  if (s.story.choice6) errs.push('船沒造好也能選離開');
  resolveEvent(s, 2);
  if (s.ship.wait !== 3 || s.events.active) errs.push('選「先等等」應記下 3 個模組並關掉抉擇');
  flush(); flush();
  if (!s.story.seen!.includes('c6-wait')) errs.push('選「先等等」沒播 c6-wait');
  if (s.events.active) errs.push('先等等之後船還沒造好就又跳出抉擇');
  buildModule(s); buildModule(s); flush();
  if (!shipReady(s) || !s.story.seen!.includes('c5-ship-ready')) errs.push('模組 I～V 完成沒播 c5-ship-ready');
  if (artId(s, 'shipyard') !== 'shipyard_3') errs.push('模組 I～V 完成應該是只差引擎的圖');
  flush();
  if (s.events.active?.kind !== 'choice6') errs.push('船造好後沒有再跳出抉擇');
  if (moduleBlock(s)?.k !== 'why.drive') errs.push('還沒決定離開就能裝星際引擎');
  resolveEvent(s, 0);
  if (s.story.choice6 !== 'leave') errs.push('船造好後選不了離開');
  if (levelBlock(s, 'orbital_beacon')?.k !== 'why.coreShip') errs.push('選了離開，信標第 4 段應該被擋下');
  if (!buildModule(s)) errs.push('選了離開裝不了星際引擎：' + moduleBlock(s)?.k);
  if (!s.finished || s.ship.mods !== MODULES.length) errs.push('裝好星際引擎應該是結局');
  flush();
  if (!s.story.seen!.includes('c6-blocked')) errs.push('結局沒播 c6-blocked');
  return errs;
});


check('S19', '第 5 章市場事件：航線中斷讓燃料變貴；封鎖收緊只限抵抗路線、進口品不會賣光；聯盟補給要太空港且會降價。醫療物資要有傷員才能用、讓恢復快 50%。異晶不能交易。太空港只限抵抗路線', () => {
  const errs: string[] = [];
  const mk = (route?: 'coop' | 'resist', port = false) => {
    const s = newGame(0); s.stage = 5; s.b.trade_post.level = 1; s.res.credit = 99999;
    if (route) s.story.route = route;
    if (port) s.b.spaceport.level = 1;
    s.market.nextEvent = 0;
    return s;
  };
  // 依序挑第 0、1、2 個可發生的事件
  const pick = (i: number, n: number) => () => (i + 0.5) / n;
  const c = mk('coop'); const f0 = buyPrice(c, 'fuel');
  market(c, 0.2, pick(0, 1));
  if (c.market.event?.k !== 'disrupt') errs.push('合作路線應該只會發生航線中斷，實際 ' + c.market.event?.k);
  if (!(buyPrice(c, 'fuel') > f0 * 1.3)) errs.push(`航線中斷後燃料應該明顯變貴：${f0.toFixed(1)} → ${buyPrice(c, 'fuel').toFixed(1)}`);
  const r = mk('resist'); const e0 = buyPrice(r, 'electronics');
  market(r, 0.2, pick(1, 2));
  if (r.market.event?.k !== 'embargo') errs.push('抵抗路線（沒有太空港）第二個事件應該是封鎖收緊，實際 ' + r.market.event?.k);
  if (!(buyPrice(r, 'electronics') > e0)) errs.push('封鎖收緊後進口品應該變貴');
  for (let i = 0; i < 40; i++) buyGood(r, 'raremetal');
  for (let i = 0; i < 50; i++) market(r, 0.2);
  if (!((r.market.stock.raremetal ?? 0) >= 20)) errs.push(`封鎖期間進口品庫存不應低於 20：${r.market.stock.raremetal}`);
  const a = mk('resist', true); const m0 = buyPrice(a, 'medicine');
  market(a, 0.2, pick(2, 3));
  if (a.market.event?.k !== 'supply') errs.push('抵抗路線＋太空港第三個事件應該是聯盟補給，實際 ' + a.market.event?.k);
  if (!(buyPrice(a, 'medicine') < m0)) errs.push('聯盟補給後進口品應該變便宜');
  // 醫療物資
  const m = newGame(0); m.b.med_bay.level = 1;
  m.cargo.medicine = 10;
  if (medBlock(m)?.k !== 'why.noPatients') errs.push('沒有傷員時應該不能用醫療物資：' + medBlock(m)?.k);
  m.raid.injured = [m.t + 999]; m.cargo.medicine = 0;
  if (medBlock(m)?.k !== 'why.short') errs.push('沒有醫療物資時應該不能用');
  m.cargo.medicine = 10;
  const h0 = healRate(m);
  if (!applyMedicine(m)) errs.push('有 10 醫療物資卻不能用');
  if (Math.abs(healRate(m) / h0 - 1.5) > 0.01) errs.push(`用了醫療物資恢復速度應為 1.5 倍：${h0} → ${healRate(m)}`);
  m.t += 301;
  if (healRate(m) !== h0) errs.push('5 分鐘後效果應該結束');
  // 異晶不是商品：大宗清單沒有、任何對象都不能買賣
  if (PRICE.crystal) errs.push('大宗資源清單裡不能有異晶');
  const x = newGame(0); x.stage = 5; x.b.trade_post.level = 1; x.res.crystal = 999; x.res.credit = 99999; x.story.route = 'coop';
  if (tradeBlock(x, 'corp', 'crystal', 'sell')?.k !== 'why.notTraded' || tradeBlock(x, 'corp', 'crystal', 'buy')?.k !== 'why.notTraded') errs.push('赫利昂市場不應該能買賣異晶');
  // 太空港
  const sp = newGame(0); sp.stage = 5; Object.assign(sp.res, { metal: 9999, credit: 9999 });
  if (levelBlock(sp, 'spaceport')?.k !== 'why.resistOnly') errs.push('還沒選路線就能蓋太空港');
  sp.story.route = 'coop';
  if (levelBlock(sp, 'spaceport')?.k !== 'why.resistOnly') errs.push('合作路線不應該能蓋太空港');
  sp.story.route = 'resist';
  if (levelBlock(sp, 'spaceport')) errs.push('抵抗路線應該能蓋太空港：' + levelBlock(sp, 'spaceport')!.k);
  return errs;
});


check('S20', '升級線沒有「工人上限 +N」；生產、加工、研究建築每升一級，每位工人效率 +5%；現場督導讓點擊 buff 變 +50%、藻類槽沒有暴擊升級', () => {
  const errs: string[] = [];
  for (const d of DEFS) for (const n of d.upgrades ?? []) if ((n.effect as any).workerCapAdd) errs.push(`${d.id}.${n.id} 還是工人上限節點`);
  const s = newGame(0); s.b.rock_cutter.level = 1; s.b.rock_cutter.workers = 2; s.stage = 2;
  const r1 = gatherRate(s, 'rock_cutter'); s.b.rock_cutter.level = 5; const r5 = gatherRate(s, 'rock_cutter');
  if (Math.abs(r5 / r1 - (1 + 4 * LEVEL_EFF)) > 1e-6) errs.push(`Lv5 每位工人產量應為 Lv1 的 ${1 + 4 * LEVEL_EFF} 倍，實際 ${(r5 / r1).toFixed(3)}`);
  if (levelEff(s, 'hab_pod') !== 1) errs.push('生活艙不該有等級效率');
  // 暴擊／buff 升級（v0.70.2）：藻類槽「精選藻種」改成產量；殘骸堆「現場督導」讓點擊 buff +25% → +50%
  const algae = DEFS.find((d) => d.id === 'algae_tank')!.upgrades!.find((n) => n.id === 'crit_1')!;
  if (!algae.effect.prodAdd || (algae.effect as any).critAdd) errs.push('藻類槽 crit_1 應該改成產量加成');
  const h = newGame(0); h.b.scrap_heap.level = 4; h.b.scrap_heap.lastClick = h.t;
  if (Math.abs(clickBuff(h, 'scrap_heap') - 1.25) > 1e-9) errs.push('點擊 buff 基本應為 +25%');
  h.b.scrap_heap.nodes.push('buff_10');
  if (Math.abs(clickBuff(h, 'scrap_heap') - 1.5) > 1e-9) errs.push(`買了現場督導 buff 應為 +50%，實際 ${clickBuff(h, 'scrap_heap')}`);
  return errs;
});

// ── 輸出 ──
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.ok ? '' : '\n     → ' + r.info}`);
const fail = results.filter((r) => !r.ok).length;
console.log(`\n靜態檢查：${results.length - fail}/${results.length} 通過`);
mkdirSync('tests/out', { recursive: true });
writeFileSync('tests/out/static.json', JSON.stringify(results, null, 1));
process.exit(fail ? 1 : 0);
