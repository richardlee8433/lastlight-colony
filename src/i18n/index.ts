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

function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) { const v = JSON.parse(raw); if (v.lang === 'zh' || v.lang === 'en') return v.lang; }
  } catch { /* 沒有設定：用預設 */ }
  return 'en';
}

interface Settings { lang: Lang; setLang: (l: Lang) => void }
export const useSettings = create<Settings>((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify({ lang })); } catch { /* 無法儲存時只在本次生效 */ }
    applyDocLang(lang);
    set({ lang });
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
export const bName = (id: string) => (zh() ? DEF[id]?.name : EN.buildings[id]?.name) ?? id;
export const bDesc = (id: string) => (zh() ? DEF[id]?.desc : EN.buildings[id]?.desc) ?? '';
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
  if (typeof m === 'string') return m;
  const p: Params = { ...(m.p ?? {}) };
  if (typeof p.b === 'string') {
    if (typeof p.node === 'string') { const [n, d] = nodeText(p.b, p.node); p.node = n; p.nodeDesc = d; }
    p.b = bName(p.b);
  }
  if (typeof p.r === 'string') p.r = resName(p.r);
  if (typeof p.rs === 'string') { const [n, d] = researchText(p.rs); p.rs = n; p.rsDesc = d; }
  if (typeof p.c === 'string') { const [n, d] = charterText(p.c); p.c = n; p.cDesc = d; }
  if (typeof p.kind === 'string') { p.unit = t('unit.' + p.kind); p.kind = raidName(p.kind); }
  return t(m.k, p);
}

/** 目前章節（給沒有 import story 的地方用） */
export const chapterCount = () => CHAPTERS.length;
