// 中英文切換：介面文字查 strings.ts；建築、研究、憲章、章節、事件等資料文字，中文直接用 data/*.json，英文查 data-en.ts。
// 引擎不產生任何顯示文字，只留下 Msg（代碼＋參數），由這裡翻譯。
import { create } from 'zustand';
import { STRINGS } from './strings';
import EN from './data-en';
import { DEF, Msg, ResKey } from '../engine/state';
import { CHARTER_DEFS, RESEARCH_DEFS } from '../engine/formulas';
import { CHAPTERS, Chapter } from '../engine/story';
import EVENTS from '../data/events.json';

export type Lang = 'en' | 'zh';
export const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'zh', label: '繁體中文' }];
const SETTINGS_KEY = 'lastlight-colony-settings';

function loadSettings(): { lang: Lang; dayNight: boolean } {
  let lang: Lang = 'en', dayNight = true;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) { const v = JSON.parse(raw); if (v.lang === 'zh' || v.lang === 'en') lang = v.lang; if (v.dayNight === false) dayNight = false; }
  } catch { /* 沒有設定：用預設 */ }
  return { lang, dayNight };
}

/** dayNight：日夜變化（純畫面效果，關掉時永遠是白天） */
interface Settings { lang: Lang; dayNight: boolean; setLang: (l: Lang) => void; setDayNight: (on: boolean) => void }
const saveSettings = (v: { lang: Lang; dayNight: boolean }) => {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); } catch { /* 無法儲存時只在本次生效 */ }
};
export const useSettings = create<Settings>((set, get) => ({
  ...loadSettings(),
  setLang: (lang) => {
    saveSettings({ lang, dayNight: get().dayNight });
    applyDocLang(lang);
    set({ lang });
  },
  setDayNight: (dayNight) => {
    saveSettings({ lang: get().lang, dayNight });
    set({ dayNight });
  },
}));
export const lang = () => useSettings.getState().lang;
export const useLang = () => useSettings((s) => s.lang);

export function applyDocLang(l: Lang = lang()) {
  document.documentElement.lang = l === 'zh' ? 'zh-Hant' : 'en';
  document.title = l === 'zh' ? '末光殖民地' : 'Lastlight Colony';
}

type Params = Record<string, unknown>;
/** 介面文字。{name} 換成參數；英文可用 {n|one|many} 依數量選單複數 */
export function t(key: string, p?: Params): string {
  const e = STRINGS[key];
  let s = e ? (lang() === 'zh' ? e[1] : e[0]) : key;
  if (!p) return s;
  s = s.replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (_, k, one, many) => (Number(p[k]) === 1 ? one : many));
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));
}

// ── 資料文字 ──
const zh = () => lang() === 'zh';
export const resName = (k: ResKey | string) => t('res.' + k);
// 改建過的建築（糧食設施）名稱與說明跟著形態走；形態由 store 提供，i18n 不直接讀遊戲狀態
let formGetter: (id: string) => number = () => 0;
export const setFormGetter = (fn: (id: string) => number) => { formGetter = fn; };
function formKey(id: string, form = formGetter(id)) {
  const f = form > 0 ? DEF[id]?.forms?.[form - 1] : null;
  return f ? { f, key: `${id}:${f.id}` } : null;
}
export const bName = (id: string, form?: number) => {
  const k = formKey(id, form);
  if (k) return (zh() ? k.f.name : EN.buildings[k.key]?.name) ?? k.f.name;
  return (zh() ? DEF[id]?.name : EN.buildings[id]?.name) ?? id;
};
export const bDesc = (id: string, form?: number) => {
  const k = formKey(id, form);
  if (k) return (zh() ? k.f.desc : EN.buildings[k.key]?.desc) ?? k.f.desc;
  return (zh() ? DEF[id]?.desc : EN.buildings[id]?.desc) ?? '';
};
export function nodeText(bid: string, nid: string): [string, string] {
  if (!zh()) { const n = EN.buildings[bid]?.nodes?.[nid]; if (n) return n; }
  const n = DEF[bid]?.upgrades?.find((u) => u.id === nid);
  return n ? [n.name, n.desc] : [nid, ''];
}
export function researchText(id: string): [string, string] {
  if (!zh() && EN.research[id]) return EN.research[id];
  const r = RESEARCH_DEFS.find((x) => x.id === id);
  return r ? [r.name, r.desc] : [id, ''];
}
/** [名稱, 效果, 代價] */
export function charterText(id: string): [string, string, string] {
  if (!zh() && EN.charters[id]) return EN.charters[id];
  const c = CHARTER_DEFS.find((x) => x.id === id);
  return c ? [c.name, c.desc, c.cost] : [id, '', ''];
}
export function chapterText(ch: Chapter): { title: string; subtitle: string; intro: string[]; goals: string[] } {
  const e = EN.chapters[ch.chapter - 1];
  if (!zh() && e) return e;
  return { title: ch.title, subtitle: ch.subtitle, intro: ch.intro, goals: ch.goals.map((g) => g.label) };
}
export function eventText(kind: string): { title: string; text: string; options: string[] } {
  return zh() ? (EVENTS as any)[kind] : EN.events[kind];
}
export const raidName = (kind?: string) => t('raid.' + (kind ?? 'alien'));
export const kindName = (kind: string) => t('kind.' + kind);
export const costText = (c: Partial<Record<ResKey, number>>) =>
  Object.entries(c).filter(([, v]) => v).map(([k, v]) => (zh() ? `${v} ${resName(k)}` : `${v} ${resName(k)}`)).join(zh() ? '、' : ', ');

/** 引擎訊息（通知、不能操作的原因、戰報、事件結果）。舊存檔可能是純文字，原樣顯示 */
export function tm(m: Msg | string | null | undefined): string {
  if (!m) return '';
  if (typeof m === 'string') { const x = fromLegacy(m); if (!x) return m; m = x; }
  const p: Params = { ...(m.p ?? {}) };
  if (typeof p.b === 'string') {
    if (typeof p.node === 'string') { const [n, d] = nodeText(p.b, p.node); p.node = n; p.nodeDesc = d; }
    p.b = bName(p.b);
  }
  if (typeof p.r === 'string') p.r = resName(p.r);
  if (typeof p.rs === 'string') { const [n, d] = researchText(p.rs); p.rs = n; p.rsDesc = d; }
  if (typeof p.c === 'string') { const [n, d] = charterText(p.c); p.c = n; p.cDesc = d; }
  if (typeof p.kind === 'string') { p.unit = t('unit.' + p.kind); p.kind = raidName(p.kind); }
  if (typeof p.bp === 'string') p.bp = t('blueprint.' + p.bp);
  return t(m.k, p);
}

// ── 舊存檔：戰報、事件結果以前直接存中文字串。用中文字典反推回代碼，才能在英文模式下翻譯 ──
type Pattern = { re: RegExp; key: string; names: string[]; lit: number };
let patterns: Pattern[] | null = null;
const rev = (prefix: string) => Object.fromEntries(Object.entries(STRINGS).filter(([k]) => k.startsWith(prefix)).map(([k, v]) => [v[1], k.slice(prefix.length)]));
function fromLegacy(str: string): Msg | null {
  str = str.replace(/保全/g, '陸戰隊員');
  if (!patterns) {
    patterns = Object.entries(STRINGS)
      .filter(([k]) => /^(l|g|rescue|n)\./.test(k))
      .map(([key, v]) => {
        const parts = v[1].split(/\{(\w+)\}/), names: string[] = [];
        let src = '', lit = 0;
        parts.forEach((x, i) => {
          if (i % 2) { names.push(x); src += '(.+?)'; } else { src += x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); lit += x.length; }
        });
        return { re: new RegExp('^' + src + '$'), key, names, lit };
      })
      .sort((a, b) => b.lit - a.lit);
  }
  const res = rev('res.'), raid = rev('raid.');
  const bld = Object.fromEntries(Object.values(DEF).map((d) => [d.name, d.id]));
  for (const pt of patterns) {
    const m = pt.re.exec(str);
    if (!m) continue;
    const p: Record<string, string | number> = {};
    let ok = true;
    pt.names.forEach((n, i) => {
      const v = m[i + 1];
      if (n === 'r') { if (res[v]) p.r = res[v]; else ok = false; }
      else if (n === 'kind') { if (raid[v]) p.kind = raid[v]; else ok = false; }
      else if (n === 'b') { if (bld[v]) p.b = bld[v]; else ok = false; }
      else if (n !== 'unit') p[n] = v;
    });
    if (ok) return { k: pt.key, p };
  }
  return null;
}

/** 目前章節（給沒有 import story 的地方用） */
export const chapterCount = () => CHAPTERS.length;
