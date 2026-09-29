// 劇情對話與殖民地日誌（v0.6）。
// 對話：劇情里程碑達成時把場景排進佇列，UI 依序播放（不暫停遊戲）；每個場景只播一次，記在存檔裡。
// 日誌：朱諾的口吻，按天數記錄劇情場景與重大事件（建成、人口、襲擊、研究、缺氧）。
// 文字在 data/dialogs.ts 與 i18n，這裡只決定「什麼時候」。
import { AIR_ENABLED, DEFS, GameState, Msg } from './state';
import { built } from './formulas';
import { lifeSupportLeft } from './air';

/** 一天有幾秒（日誌的「第幾天」） */
export const DAY = 60;
export const dayOf = (t: number) => Math.floor(t / DAY) + 1;

export interface Journal {
  entries: (Msg & { d: number })[];
  /** 已經記過的建築、人口里程碑、襲擊次數、研究數量、是否正在缺氧（用來找出新事件） */
  b: string[]; pop: number; raids: number; rs: number; hyp: boolean;
}
const MAX_ENTRIES = 300;
const POP_STEP = 5;

const seen = (s: GameState, id: string) => !!s.story.seen?.includes(id);
/** 場景觸發條件（依序檢查；前一章的場景要在下一章開場前播完） */
const TRIGGERS: { id: string; when: (s: GameState) => boolean; chapterEnd?: boolean }[] = [
  { id: 'c1-open', when: (s) => s.stage === 1 && s.story.seenIntro >= 1 },
  { id: 'c1-ls3', when: (s) => AIR_ENABLED && s.stage === 1 && lifeSupportLeft(s) <= 180 && lifeSupportLeft(s) > 0 && !built(s, 'o2_scrubber') },
  { id: 'c1-scrubber', when: (s) => built(s, 'o2_scrubber') },
  { id: 'c1-will', when: (s) => seen(s, 'c1-ls3') && built(s, 'o2_scrubber') },
  { id: 'c1-algae', when: (s) => built(s, 'algae_tank') },
  { id: 'c1-assign', when: (s) => s.story.assigned },
  { id: 'hypoxia', when: (s) => !!s.air?.hypoxic },
  { id: 'c1-end', when: (s) => s.stage >= 2, chapterEnd: true },
  { id: 'c2-open', when: (s) => s.stage === 2 && s.story.seenIntro >= 2 },
  { id: 'c2-ines', when: (s) => !!s.story.ines },
  { id: 'c2-elec', when: (s) => built(s, 'electrolyzer') && !seen(s, 'c2-ines') && !seen(s, 'c2-elec-i') },
  { id: 'c2-elec-i', when: (s) => built(s, 'electrolyzer') && seen(s, 'c2-ines') && !seen(s, 'c2-elec') },
  { id: 'c2-pop10', when: (s) => s.stage >= 2 && s.pop >= 10 },
  { id: 'c2-assembly', when: (s) => built(s, 'assembly') && seen(s, 'c2-ines') },
  { id: 'c2-coaster', when: (s) => seen(s, 'c2-ines') && s.pop >= 11 },
  { id: 'c2-end', when: (s) => s.stage >= 3, chapterEnd: true },
];
export const SCENE_IDS = TRIGGERS.map((x) => x.id);
const CHAPTER_END = new Set(TRIGGERS.filter((x) => x.chapterEnd).map((x) => x.id));

/** 章末場景還沒播完：下一章的開場畫面先等一下 */
export const chapterEndPending = (s: GameState) => !!s.story.queue?.some((q) => CHAPTER_END.has(q.id));

export function newJournal(s: GameState): Journal {
  return { entries: [], b: DEFS.filter((d) => built(s, d.id)).map((d) => d.id), pop: Math.floor(s.pop / POP_STEP) * POP_STEP, raids: s.raid?.count ?? 0, rs: s.research.done.length, hyp: !!s.air?.hypoxic };
}
function write(s: GameState, k: string, p?: Msg['p']) {
  const j = s.journal!;
  j.entries.push({ d: dayOf(s.t), k, p });
  if (j.entries.length > MAX_ENTRIES) j.entries.splice(0, j.entries.length - MAX_ENTRIES);
}

/** 排入一個場景（只會播一次） */
export function playScene(s: GameState, id: string) {
  const st = s.story;
  if (st.seen?.includes(id)) return;
  (st.seen ??= []).push(id);
  (st.queue ??= []).push({ id, d: dayOf(s.t) });
  write(s, 'scene', { id });
}

/** 每個 tick：檢查劇情里程碑與日誌事件 */
export function dialogs(s: GameState) {
  const j = (s.journal ??= newJournal(s));
  // 日誌：章節開始（玩家看完開場畫面後）
  if (s.story.seenIntro >= s.stage && !j.entries.some((e) => e.k === 'log.chapter' && e.p?.n === s.stage)) write(s, 'log.chapter', { n: s.stage });
  for (const x of TRIGGERS) if (!seen(s, x.id) && x.when(s)) playScene(s, x.id);
  for (const d of DEFS) if (!j.b.includes(d.id) && built(s, d.id)) { j.b.push(d.id); write(s, 'log.built', { b: d.id, v: j.b.length % 3 }); }
  if (s.pop >= j.pop + POP_STEP) { j.pop = Math.floor(s.pop / POP_STEP) * POP_STEP; write(s, 'log.pop', { n: j.pop }); }
  if (s.raid.count > j.raids) {
    j.raids = s.raid.count;
    const rep = s.raid.report;
    write(s, rep?.won === false ? 'log.raidLost' : 'log.raidWon', { kind: rep?.kind ?? 'alien' });
  }
  if (s.research.done.length > j.rs) { j.rs = s.research.done.length; write(s, 'log.research', { rs: s.research.done.at(-1) ?? '' }); }
  const hyp = !!s.air?.hypoxic;
  if (hyp && !j.hyp) write(s, 'log.hypoxia');
  if (!hyp && j.hyp) write(s, 'log.airBack');
  j.hyp = hyp;
}

/** 舊存檔：已經過去的里程碑視為播過（不補播），日誌從今天開始記 */
export function migrateDialogs(s: GameState) {
  if (!s.story.seen) {
    s.story.seen = s.stage >= 2 || s.t > 5 ? TRIGGERS.filter((x) => x.when(s)).map((x) => x.id) : [];
    s.story.queue = [];
    s.journal = newJournal(s);
    if (s.t > 5) write(s, 'log.migrated');
  }
  // 伊涅絲（v0.6 第 6 步）：已經離開第 2 章的存檔視為早就救回來了，她相關的對話不補播
  if (s.story.ines === undefined && s.stage >= 3) {
    s.story.ines = true;
    for (const id of ['c2-ines', 'c2-elec', 'c2-elec-i', 'c2-assembly', 'c2-coaster']) if (!s.story.seen.includes(id)) s.story.seen.push(id);
  }
}
