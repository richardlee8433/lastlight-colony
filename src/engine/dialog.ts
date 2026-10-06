// 劇情對話與殖民地日誌（v0.6）。
// 對話：劇情里程碑達成時把場景排進佇列，UI 依序播放（不暫停遊戲）；每個場景只播一次，記在存檔裡。
// 日誌：朱諾的口吻，按天數記錄劇情場景與重大事件（建成、人口、襲擊、研究、缺氧）。
// 文字在 data/dialogs.ts 與 i18n，這裡只決定「什麼時候」。
import { AIR_ENABLED, DEFS, GameState, Msg } from './state';
import { built, hasXenoLab } from './formulas';
import { lifeSupportLeft } from './air';
import { READY_MODS, mods, shipReady } from './ship';

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
/** 氧氣再生器已改建成電解站 */
const isElec = (s: GameState) => built(s, 'o2_scrubber') && (s.b.o2_scrubber.form ?? 0) >= 1;
/** 進入第 n 章後過了幾天（以日誌的章節開始紀錄為準；還沒開始回傳 -1） */
const daysInChapter = (s: GameState, n: number) => {
  const e = s.journal?.entries.find((x) => x.k === 'log.chapter' && x.p?.n === n);
  return e ? dayOf(s.t) - e.d : -1;
};
/** 某個場景播出後過了幾天（還沒播回傳 -1） */
const daysSince = (s: GameState, id: string) => {
  const e = s.journal?.entries.find((x) => x.k === 'scene' && x.p?.id === id);
  // 舊存檔：場景被標記成播過、但日誌裡沒有紀錄，視為很久以前
  return e ? dayOf(s.t) - e.d : seen(s, id) ? 99 : -1;
};
/** 抵抗路線的策略傾向：第二次拒絕時判定一次並記下來（之後的台詞都看這個紀錄）。
 *  外星科技：異星研究院、砲塔、異晶槍與砲管研究；星際聯盟：太空港、聯盟聲望 */
function decideLean(s: GameState): 'alien' | 'alliance' {
  const alien = (hasXenoLab(s) ? 1 : 0) + (built(s, 'turret') ? 1 : 0) + (s.research.done.includes('xeno_blade') ? 1 : 0) + (s.research.done.includes('xeno_turret') ? 1 : 0);
  const alliance = (built(s, 'spaceport') ? 2 : 0) + Math.min(2, Math.floor((s.gov.alliance.rep ?? 0) / 5));
  return alliance > alien ? 'alliance' : 'alien';
}
/** 一句台詞在目前的路線下要不要播（沒有條件的台詞一律播） */
export function lineOk(s: GameState, r?: string) {
  if (!r) return true;
  // 船的模組 I～V 是否已完成（第 6 章討論時伊涅絲的說法不同）
  if (r === 'ship' || r === 'noship') return shipReady(s) === (r === 'ship');
  if (r === 'coop' || r === 'resist') return s.story.route === r;
  if (s.story.route !== 'resist') return false;
  // 提到異晶槍的台詞：要研究完才播
  if (r === 'rifle') return s.story.lean === 'alien' && s.research.done.includes('xeno_blade');
  return s.story.lean === r;
}
/** 場景觸發條件（依序檢查；前一章的場景要在下一章開場前播完）。
 *  journal：只寫進日誌、不跳對話框的小場景（避免對話太密、一直暫停遊戲） */
const TRIGGERS: { id: string; when: (s: GameState) => boolean; chapterEnd?: boolean; journal?: boolean }[] = [
  // 第 1 章
  { id: 'c1-open', when: (s) => s.stage === 1 && s.story.seenIntro >= 1 },
  { id: 'c1-ls3', when: (s) => AIR_ENABLED && s.stage === 1 && lifeSupportLeft(s) <= 180 && lifeSupportLeft(s) > 0 && !built(s, 'o2_scrubber') },
  { id: 'c1-scrubber', when: (s) => built(s, 'o2_scrubber') },
  { id: 'c1-will', when: (s) => seen(s, 'c1-ls3') && built(s, 'o2_scrubber') },
  // 晶板是第 3 章的伏筆，不能漏：殘骸堆升到 Lv2、第 1 章過了 2 天，或最晚在緊急營地蓋好時（章末對話之前）
  { id: 'c1-coaster', when: (s) => !seen(s, 'c2-open') && (built(s, 'emergency_camp') || (s.stage === 1 && (s.b.scrap_heap.level >= 2 || daysInChapter(s, 1) >= 2))) },
  { id: 'c1-algae', when: (s) => built(s, 'algae_tank') },
  { id: 'c1-f8', journal: true, when: (s) => s.stage === 1 && (s.b.o2_scrubber.level >= 2 || s.b.algae_tank.level >= 2) },
  { id: 'c1-assign', when: (s) => s.story.assigned },
  { id: 'c1-signal', when: (s) => s.stage === 1 && (s.b.algae_tank.level >= 3 || daysInChapter(s, 1) >= 4) },
  { id: 'c1-limit', journal: true, when: (s) => s.stage === 1 && (s.b.o2_scrubber.level >= 3 || s.b.algae_tank.level >= 3) },
  { id: 'hypoxia', when: (s) => !!s.air?.hypoxic },
  { id: 'c1-end', when: (s) => s.stage >= 2, chapterEnd: true },
  // 第 2 章
  { id: 'c2-open', when: (s) => s.stage === 2 && s.story.seenIntro >= 2 },
  { id: 'c2-ines', when: (s) => !!s.story.ines },
  { id: 'c2-elec-i', when: (s) => isElec(s) && seen(s, 'c2-ines') },
  { id: 'c2-upgrade', journal: true, when: (s) => (s.b.algae_tank.form ?? 0) >= 1 && seen(s, 'c2-ines') },
  { id: 'c2-pop10', when: (s) => s.stage >= 2 && s.pop >= 10 && seen(s, 'c2-ines') },
  { id: 'c2-rescue', journal: true, when: (s) => (s.story.rescued ?? 0) > 0 },
  { id: 'c2-assembly', when: (s) => built(s, 'assembly') && seen(s, 'c2-ines') },
  { id: 'c2-lounge', when: (s) => s.stage >= 2 && built(s, 'lounge') },
  { id: 'c2-ship', when: (s) => s.stage >= 2 && s.pop >= 12 && seen(s, 'c2-ines') },
  { id: 'c2-end', when: (s) => s.stage >= 3, chapterEnd: true },
  // 第 3 章
  { id: 'c3-open', when: (s) => s.stage === 3 && s.story.seenIntro >= 3 },
  { id: 'c3-mine', when: (s) => built(s, 'metal_mine') },
  { id: 'c3-forge', when: (s) => built(s, 'forge') },
  { id: 'c3-rail', when: (s) => s.stage >= 3 && s.stage <= 4 && built(s, 'rail_line') },
  { id: 'c3-exp1', when: (s) => (s.exp?.count ?? 0) >= 1 && !s.events.report },
  { id: 'c3-filter', when: (s) => s.research.done.includes('bp_filter') },
  { id: 'c3-wheezy', journal: true, when: (s) => seen(s, 'c3-filter') },
  { id: 'c3-resonance', when: (s) => !!s.exp?.blueprints.includes('resonance') && !s.events.report },
  { id: 'c3-rollcall', when: (s) => s.stage >= 3 && s.stage <= 4 && s.pop >= 25 },
  // 造船：金屬礦井升到 Lv3，或第 3 章進行超過 10 分鐘（保底）
  { id: 'c3-ship', when: (s) => s.stage >= 3 && s.stage <= 4 && seen(s, 'c3-open') && (s.b.metal_mine.level >= 3 || daysInChapter(s, 3) >= 10) },
  { id: 'c3-outpost', when: (s) => built(s, 'outpost') },
  // 船塢（v0.70）：看過 c3-ship 才能蓋；之後每裝好一個模組都有一段小對話（模組可以晚幾章才裝）
  { id: 'c3-shipyard', when: (s) => built(s, 'shipyard') },
  { id: 'c3-hull', when: (s) => mods(s) >= 1 },
  { id: 'c3-end', when: (s) => s.stage >= 4, chapterEnd: true },
  // 第 4 章
  { id: 'c4-open', when: (s) => s.stage === 4 && s.story.seenIntro >= 4 },
  { id: 'c4-synth', when: (s) => built(s, 'crystal_synth') },
  { id: 'c4-warn', when: (s) => s.stage >= 4 && !!s.raid.incoming && s.raid.count === 0 },
  { id: 'c4-raid1', when: (s) => s.raid.count >= 1 && !s.raid.report },
  { id: 'c4-memorial', when: (s) => built(s, 'memorial') && seen(s, 'c4-raid1') },
  { id: 'c4-armor', when: (s) => s.stage >= 4 && s.research.done.includes('weapon_1') },
  // 喜鵲（v0.70）：合成室開機後前哨站收到他的頻道；第一個貨櫃落地；之後問他能不能載大家走
  { id: 'c4-trader', when: (s) => s.stage >= 4 && seen(s, 'c4-synth') },
  { id: 'c4-cargo', when: (s) => (s.market?.drops ?? 0) > 0 },
  { id: 'c4-trader-ride', when: (s) => seen(s, 'c4-cargo') },
  { id: 'c4-nav', when: (s) => mods(s) >= 2 },
  { id: 'c4-life', when: (s) => mods(s) >= 3 },
  { id: 'c4-teach', when: (s) => s.stage === 4 && s.story.asm4 !== undefined && s.b.assembly.level > s.story.asm4 },
  { id: 'c4-sefa', when: (s) => seen(s, 'c4-raid1') && s.pop >= 28 },
  { id: 'c4-guard', when: (s) => seen(s, 'c4-sefa') && s.raid.count >= 2 && !s.raid.report },
  { id: 'c4-names', journal: true, when: (s) => seen(s, 'c4-guard') && s.pop >= 32 },
  { id: 'c4-med', when: (s) => built(s, 'med_bay') },
  { id: 'c4-hydro', journal: true, when: (s) => (s.b.algae_tank.form ?? 0) >= 2 },
  { id: 'c4-gene', when: (s) => seen(s, 'c4-guard') && s.pop >= 36 },
  { id: 'c4-end', when: (s) => s.stage >= 5 && seen(s, 'c4-sefa'), chapterEnd: true },
  // 第 5 章（路線見 story.route／story.lean）
  { id: 'c5-open', when: (s) => s.stage === 5 && s.story.seenIntro >= 5 },
  // 赫利昂戰艦來了以後喜鵲打來（要已經跟他交易過、蓋了交易站）
  { id: 'c5-trader-word', when: (s) => seen(s, 'c5-open') && seen(s, 'c4-trader') && built(s, 'trade_post') },
  { id: 'c5-crowd', when: (s) => s.stage >= 5 && seen(s, 'c5-open') && (s.pop >= 45 || daysInChapter(s, 5) >= 1) },
  { id: 'c5-calder', when: (s) => s.stage >= 5 && built(s, 'admin') },
  { id: 'c5-juno', journal: true, when: (s) => seen(s, 'c5-calder') },
  { id: 'c5-charter', when: (s) => s.gov.charters.length > 0 && seen(s, 'c5-calder') },
  { id: 'c5-voss', when: (s) => daysSince(s, 'c5-calder') >= 1 },
  { id: 'c5-debate', when: (s) => seen(s, 'c5-voss') && s.gov.corp.envoys === 0 && s.t >= s.gov.corp.nextEnvoy - 5 && s.gov.corp.nextEnvoy > 0 },
  { id: 'c5-coop', when: (s) => s.story.route === 'coop' },
  // 合作路線：赫利昂接管，喜鵲道別（之後交易站變成赫利昂的市場）
  { id: 'c5-trader-bye', when: (s) => seen(s, 'c5-coop') && seen(s, 'c4-trader') },
  { id: 'c5-voss-leave', when: (s) => seen(s, 'c5-coop') },
  { id: 'c5-resist', when: (s) => s.story.route === 'resist' },
  { id: 'c5-warn', when: (s) => s.story.route === 'resist' && s.gov.corp.refusals >= 2 },
  { id: 'c5-sefa', when: (s) => !!s.story.env2At && s.t >= s.story.env2At },
  { id: 'c5-corp-help', when: (s) => s.story.route === 'coop' && (s.story.corpHelp ?? 0) > 0 && !s.raid.report },
  { id: 'c5-alliance1', when: (s) => s.story.lean === 'alliance' && built(s, 'spaceport') },
  // 抵抗路線：聯盟付錢請喜鵲穿過封鎖線，聯盟的委託由他運送（聯盟傾向的要先播過聯盟的第一次聯絡）
  { id: 'c5-trader-run', when: (s) => s.story.route === 'resist' && built(s, 'spaceport') && built(s, 'trade_post') && seen(s, 'c4-trader') && (s.story.lean !== 'alliance' || seen(s, 'c5-alliance1')) },
  { id: 'c5-rifle', when: (s) => s.story.lean === 'alien' && s.research.done.includes('xeno_blade') },
  { id: 'c5-commando', when: (s) => s.story.route === 'resist' && (s.story.commandoWon ?? 0) > 0 && !s.raid.report },
  { id: 'c5-alliance2', when: (s) => seen(s, 'c5-commando') && s.story.lean === 'alliance' && built(s, 'spaceport') },
  // 樣本來源依路線：合作路線要等赫利昂士兵打下過微光獸
  { id: 'c5-pattern', when: (s) => hasXenoLab(s) && (s.story.route === 'resist' || (s.story.route === 'coop' && seen(s, 'c5-corp-help'))) },
  { id: 'c5-supplies', when: (s) => mods(s) >= 4 },
  { id: 'c5-ship-ready', when: (s) => mods(s) >= READY_MODS },
  { id: 'c5-end', when: (s) => s.stage >= 6, chapterEnd: true },
  // 第 6 章
  { id: 'c6-open', when: (s) => s.stage === 6 && s.story.seenIntro >= 6 },
  { id: 'c6-wheezy', journal: true, when: (s) => seen(s, 'c6-open') },
  { id: 'c6-governor', when: (s) => built(s, 'governor') },
  { id: 'c6-salary', journal: true, when: (s) => s.stage >= 6 && s.pop >= 90 },
  { id: 'c6-beacon1', when: (s) => s.b.orbital_beacon.level >= 1 },
  { id: 'c6-lastlight', when: (s) => s.b.orbital_beacon.level >= 3 && seen(s, 'c6-beacon1') },
  // 聽完末光號的故事、船體也立起來了：朱諾替船取名「曙光號」
  { id: 'c6-name', when: (s) => seen(s, 'c6-lastlight') && mods(s) >= 1 },
  { id: 'c6-truth', when: (s) => seen(s, 'c6-lastlight') && (s.boost?.uses ?? 0) > 0 },
  { id: 'c6-debate', when: (s) => seen(s, 'c6-truth') },
  { id: 'c6-leave', when: (s) => s.story.choice6 === 'leave' },
  { id: 'c6-wait', when: (s) => s.ship?.wait !== undefined },
  { id: 'c6-stay', when: (s) => s.story.choice6 === 'stay' },
  { id: 'c6-stay-ship', when: (s) => s.story.choice6 === 'stay' && seen(s, 'c6-name') && seen(s, 'c6-stay') },
  { id: 'c6-blocked', when: (s) => s.finished && s.story.choice6 === 'leave', chapterEnd: true },
  { id: 'c6-end', when: (s) => s.finished && s.story.choice6 !== 'leave', chapterEnd: true },
];
/** 對話腳本版本：新增場景時加一，舊存檔讀進來時已經過去的場景標記為播過 */
export const DIALOG_VERSION = 8;
/** 新版本加入的場景：還在這一章（或更早）的舊存檔照常播，不要直接標成播過 */
const REPLAY_IF: Record<string, number> = { 'c4-trader': 4, 'c4-cargo': 4, 'c4-trader-ride': 4 };
export const SCENE_IDS = TRIGGERS.map((x) => x.id);
const CHAPTER_END = new Set(TRIGGERS.filter((x) => x.chapterEnd).map((x) => x.id));

/** 章末場景還沒播完：下一章的開場畫面先等一下 */
/** 結局對話（c6-end／c6-blocked）已經排進佇列：結局畫面要等它播完才出現 */
export const endingQueued = (s: GameState) => seen(s, 'c6-end') || seen(s, 'c6-blocked');
export const chapterEndPending = (s: GameState) => !!s.story.queue?.some((q) => CHAPTER_END.has(q.id));
/** 章末場景屬於第幾章（例如 c3-end → 3）；不是章末場景回傳 0 */
export const endOfChapter = (id: string) => (CHAPTER_END.has(id) ? Number(id.match(/^c(\d+)-/)?.[1] ?? 0) : 0);
/** 正在等著播的章末場景是第幾章（任務欄在它播完前繼續顯示那一章） */
export const endingChapter = (s: GameState) => Math.min(...(s.story.queue ?? []).map((q) => endOfChapter(q.id)).filter((n) => n > 0), Infinity);

export function newJournal(s: GameState): Journal {
  return { entries: [], b: DEFS.filter((d) => built(s, d.id)).map((d) => d.id), pop: Math.floor(s.pop / POP_STEP) * POP_STEP, raids: s.raid?.count ?? 0, rs: s.research.done.length, hyp: !!s.air?.hypoxic };
}
function write(s: GameState, k: string, p?: Msg['p']) {
  const j = s.journal!;
  j.entries.push({ d: dayOf(s.t), k, p });
  if (j.entries.length > MAX_ENTRIES) j.entries.splice(0, j.entries.length - MAX_ENTRIES);
}

/** 排入一個場景（只會播一次） */
export function playScene(s: GameState, id: string, journalOnly = false) {
  const st = s.story;
  if (st.seen?.includes(id)) return;
  (st.seen ??= []).push(id);
  if (!journalOnly) (st.queue ??= []).push({ id, d: dayOf(s.t) });
  write(s, 'scene', { id });
}

/** 每個 tick：檢查劇情里程碑與日誌事件 */
export function dialogs(s: GameState) {
  const j = (s.journal ??= newJournal(s));
  // 日誌：章節開始（玩家看完開場畫面後）
  if (s.story.seenIntro >= s.stage && !j.entries.some((e) => e.k === 'log.chapter' && e.p?.n === s.stage)) write(s, 'log.chapter', { n: s.stage });
  // 第 4 章開始時記下組裝工坊的等級：之後再升級才觸發提歐教年輕人的場景
  if (s.stage >= 4 && s.story.asm4 === undefined) s.story.asm4 = s.b.assembly.level;
  if (s.story.route === 'resist' && s.gov.corp.refusals >= 2 && !s.story.lean) s.story.lean = decideLean(s);
  for (const x of TRIGGERS) if (!seen(s, x.id) && x.when(s)) playScene(s, x.id, x.journal);
  // 第 6 章的抉擇：大家討論完（c6-debate 播完）才跳出選擇
  // 選了「先等等」：船的模組 I～V 完成（c5-ship-ready 播完）時再跳一次；當時船已經造好的話，只能從船塢面板重新打開
  const w = s.ship?.wait;
  if (seen(s, 'c6-debate') && !s.story.choice6 && (w === undefined || (w < READY_MODS && shipReady(s))) && !s.story.queue?.length && !s.events.active) s.events.active = { kind: 'choice6' };
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
  // 第 5～6 章路線（v0.66）加入前的存檔：拒絕過使者算抵抗，否則算合作；已經通關的算保留異晶
  if (s.stage >= 5 && !s.story.route && s.gov.corp.envoys > 0) s.story.route = s.gov.corp.refusals > 0 ? 'resist' : 'coop';
  if (s.story.route === 'resist' && s.gov.corp.refusals >= 2 && !s.story.lean) s.story.lean = decideLean(s);
  if (s.finished && !s.story.choice6) s.story.choice6 = 'stay';
  // 第 3～6 章對話（v0.6.1）加入前的存檔：已經過去的里程碑一樣不補播
  if ((s.story.dlgV ?? 1) < DIALOG_VERSION) {
    for (const x of TRIGGERS) if (!s.story.seen.includes(x.id) && x.when(s) && !(REPLAY_IF[x.id] && s.stage <= REPLAY_IF[x.id])) s.story.seen.push(x.id);
    s.story.dlgV = DIALOG_VERSION;
  }
  // 伊涅絲（v0.6 第 6 步）：已經離開第 2 章的存檔視為早就救回來了，她相關的對話不補播
  if (s.story.ines === undefined && s.stage >= 3) {
    s.story.ines = true;
    for (const id of ['c2-ines', 'c2-elec', 'c2-elec-i', 'c2-assembly', 'c2-coaster']) if (!s.story.seen.includes(id)) s.story.seen.push(id);
  }
}
