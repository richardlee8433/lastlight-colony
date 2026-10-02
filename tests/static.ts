// 靜態檢查：不開瀏覽器，直接檢查資料與純邏輯。用法：npx tsx tests/static.ts（tests/run-all.sh 會呼叫）
// 每項輸出 PASS／FAIL 與原因；有任何 FAIL 時結束碼為 1。
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { SCENES } from '../src/data/dialogs';
import { SCENE_IDS } from '../src/engine/dialog';
import { CHAPTERS } from '../src/engine/story';
import { STRINGS } from '../src/i18n/strings';
import EN from '../src/i18n/data-en';
import { DEFS } from '../src/engine/state';
import { RESEARCH_DEFS } from '../src/engine/formulas';
import { stepFacing } from '../src/art/facing.js';
import { patrolAt, ROUTES as ROADS } from '../src/scene/layout';

const results: { id: string; name: string; ok: boolean; info: string }[] = [];
function check(id: string, name: string, fn: () => string[] | string | void) {
  let errs: string[] = [];
  try { const r = fn(); errs = Array.isArray(r) ? r : r ? [r] : []; } catch (e: any) { errs = ['例外：' + e.message]; }
  results.push({ id, name, ok: errs.length === 0, info: errs.slice(0, 8).join('；') + (errs.length > 8 ? `……共 ${errs.length} 項` : '') });
}

// ── 劇情對話 ──
check('S01', '每個觸發條件都有對應的對話內容，每段對話都有觸發條件', () => {
  const errs: string[] = [];
  for (const id of SCENE_IDS) if (!SCENES[id]) errs.push(`觸發 ${id} 沒有對話內容`);
  for (const id of Object.keys(SCENES)) if (!SCENE_IDS.includes(id)) errs.push(`對話 ${id} 沒有觸發條件`);
  return errs;
});
const SPEAKERS = ['mara', 'teo', 'juno', 'ines', 'sefa', 'voss', 'calder', 'narr', 'colonist', 'survivor', 'marine', 'youth', 'alliance'];
const ROUTES = [undefined, 'coop', 'resist', 'alien', 'alliance', 'rifle'];
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

// ── 輸出 ──
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${r.name}${r.ok ? '' : '\n     → ' + r.info}`);
const fail = results.filter((r) => !r.ok).length;
console.log(`\n靜態檢查：${results.length - fail}/${results.length} 通過`);
mkdirSync('tests/out', { recursive: true });
writeFileSync('tests/out/static.json', JSON.stringify(results, null, 1));
process.exit(fail ? 1 : 0);
