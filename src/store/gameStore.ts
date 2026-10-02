// Zustand store：遊戲狀態本身是可變物件（引擎直接修改），store 只用版本號通知 React 重繪。
import { create } from 'zustand';
import { observe } from '../analytics';
import { AIR_ENABLED, DEF, DEFS, GameState, makeCheckpoint, newAir, newGame, newGov, newRaid, notify } from '../engine/state';
import { LIFE_SUPPORT } from '../engine/air';
import { CHAPTERS, migrateStoryDone } from '../engine/story';
import { built, idle, retirePod, storageCap, workerCap } from '../engine/formulas';
import { oxygenByproduct, oxygenUse } from '../engine/air';
import { step, TICK } from '../engine/tick';
import { migrateDialogs } from '../engine/dialog';
import { newExp, startExpedition } from '../engine/expedition';
import { SCENES } from '../data/dialogs';
import { click as engineClick, ClickResult } from '../engine/click';
import { applyOffline } from '../engine/offline';
import * as A from '../engine/actions';
import { resolveEvent } from '../engine/events';
import * as G from '../engine/governance';
import { setMood } from '../audio/audio';
import { setFormGetter } from '../i18n';

const SAVE_KEY = 'lastlight-colony-save-v1';
export type OfflineReport = NonNullable<ReturnType<typeof applyOffline>>;

function load(): { s: GameState; offline: OfflineReport | null } {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as GameState;
      if (s.v === 1) {
        migrate(s);
        if (!s.checkpoint) makeCheckpoint(s);
        const offline = applyOffline(s, (Date.now() - s.lastSaved) / 1000);
        return { s, offline };
      }
    }
  } catch { /* 沒有存檔或無法讀取：開新局 */ }
  const s = newGame();
  makeCheckpoint(s);
  return { s, offline: null };
}
/** 舊存檔（v0.6 以前）補建氧氣設施：已改建成電解站的氧氣再生器，等級與工人足夠呼吸，不夠的人手從工人最多的建築調過來 */
function giveAirSupply(s: GameState) {
  const need = oxygenUse(s) * 1.25 - oxygenByproduct(s);
  const elec = s.b.o2_scrubber, form = DEF.o2_scrubber.forms![0], per = form.rate, wpl = form.workersPerLevel;
  elec.form = Math.max(elec.form ?? 0, 1);
  const workers = Math.max(1, Math.ceil(need / per));
  elec.level = Math.min(DEF.o2_scrubber.maxLevel, Math.max(elec.level, 1, Math.ceil(workers / wpl)));
  for (let i = 0; i < workers && elec.workers < workerCap(s, 'o2_scrubber'); i++) {
    if (idle(s) <= 0) {
      let best: string | null = null;
      for (const d of DEFS) if (!['security', 'algae_tank', 'o2_scrubber'].includes(d.id) && s.b[d.id].workers > 0 && (!best || s.b[d.id].workers > s.b[best].workers)) best = d.id;
      if (!best) break;
      s.b[best].workers--;
    }
    elec.workers++;
  }
  s.pendingNotice = 'n.airMigrated';
}

/** 舊存檔補上新欄位 */
function migrate(s: GameState) {
  const fresh = newGame();
  for (const id of Object.keys(fresh.b)) s.b[id] ??= fresh.b[id];
  s.starveTime ??= 0; s.failed ??= false; s.checkpoint ??= null;
  s.raid ??= newRaid();
  s.res.weapon ??= 0; s.res.crystal ??= 0; s.res.credit ??= 0;
  s.gov ??= newGov();
  // 糧食設施合併：舊存檔的生物採集站、水耕農場併進藻類槽（改建成最高的形態，工人位子不少於原本三棟的總和）
  const old = s.b as Record<string, any>, bio = old.bio_harvester, hyd = old.hydro_farm;
  if ((bio?.level ?? 0) > 0 || (hyd?.level ?? 0) > 0) {
    const a = s.b.algae_tank, form = hyd?.level ? 2 : 1, wpl = DEF.algae_tank.forms![form - 1].workersPerLevel;
    const capOld = 3 * a.level + 2 * (bio?.level ?? 0) + 4 * (hyd?.level ?? 0) + (hyd?.nodes?.includes('cap_2') ? 2 : 0);
    a.form = Math.max(a.form ?? 0, form);
    a.level = Math.min(DEF.algae_tank.maxLevel, Math.max(a.level, 1, Math.ceil(capOld / wpl)));
    a.workers += (bio?.workers ?? 0) + (hyd?.workers ?? 0);
    const map: Record<string, string> = { prod_25: 'guide', crit_1: 'crit_1' };
    for (const n of bio?.nodes ?? []) if (map[n] && !a.nodes.includes(map[n])) a.nodes.push(map[n]);
    for (const n of hyd?.nodes ?? []) if ((n === 'prod_25' || n === 'cap_2') && !a.nodes.includes(n)) a.nodes.push(n);
    delete old.bio_harvester; delete old.hydro_farm;
  }
  // 氧氣設施合併：舊存檔（v0.6 測試版）的電解站併進氧氣再生器，改建成電解站形態，工人位子不少於原本兩棟的總和
  const el = old.electrolyzer;
  if ((el?.level ?? 0) > 0) {
    const o = s.b.o2_scrubber, capOld = 2 * o.level + (o.nodes.includes('cap_1') ? 1 : 0) + 2 * el.level + (el.nodes?.includes('cap_1') ? 1 : 0);
    o.form = Math.max(o.form ?? 0, 1);
    o.level = Math.min(DEF.o2_scrubber.maxLevel, Math.max(o.level, 1, Math.ceil(capOld / 2)));
    o.workers = Math.min(workerCap(s, 'o2_scrubber'), o.workers + (el.workers ?? 0));   // 超過上限的人變成閒置
    if (el.nodes?.includes('prod_30') && !o.nodes.includes('coil')) o.nodes.push('coil');
  }
  delete old.electrolyzer;
  // 目標完成紀錄從中文文字改成 id
  s.story.done = migrateStoryDone(s.story.done);
  // 舊存檔：原本前哨站就算 MVP 完成，現在接續第 4 章
  // 第 6 章：結局改成軌道信標完成；舊存檔在星城穹頂就結束的，接續第 6 章
  if (s.finished && s.b.orbital_beacon.level < DEF.orbital_beacon.maxLevel) s.finished = false;
  s.boost ??= { until: 0, uses: 0 };
  // 已經蓋好紀念堂的舊存檔：逃生艙退役（求救頻段沒買的直接送）
  retirePod(s);
  // v0.6 氧氣：舊存檔補上氧氣（裝滿）；已經離開第 1 章的，維生系統視為已經衰竭
  const hadAir = !!s.air;
  s.res.oxygen ??= s.stage >= 2 ? storageCap(s) : 120;
  s.air ??= { ...newAir(), elapsed: s.stage >= 2 ? LIFE_SUPPORT.duration : 0, graceUsed: s.stage >= 2 };
  // 已經過了第 1 章的舊存檔：免費蓋好氧氣再生器與電解站並派人，讀進來不會立刻缺氧
  if (!hadAir && AIR_ENABLED && s.stage >= 2) giveAirSupply(s);
  // 探勘站（第 3 章改版）：已經過了第 3 章的存檔，視為做過第一次探勘、拿到第一張藍圖
  if (!s.exp) { s.exp = newExp(); if (s.stage >= 4) { s.exp.count = 1; s.exp.blueprints = ['filter']; } }
  // v0.6 對話與日誌：已經過去的里程碑不補播
  migrateDialogs(s);
  s.notices = [];
  if (s.pendingNotice) { notify(s, s.pendingNotice, undefined, 'info'); delete s.pendingNotice; }
}
function save(s: GameState) {
  s.lastSaved = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, notices: [] })); } catch { /* 無法存檔時照常遊玩 */ }
}

const boot = load();
setFormGetter((id) => game.s.b[id]?.form ?? 0);
export const game: { s: GameState } = { s: boot.s };

interface Store {
  v: number;
  selected: string | null;
  focus: { id: string; n: number } | null;
  offline: OfflineReport | null;
  bump: () => void;
  select: (id: string | null) => void;
  focusOn: (id: string) => void;
  closeOffline: () => void;
  click: (id: string) => ClickResult | null;
  levelUp: (id: string) => void;
  buyNode: (id: string, node: string) => void;
  assign: (id: string, d: number) => void;
  research: (rid: string) => void;
  choose: (i: number) => void;
  dismissReport: () => void;
  dismissBattle: () => void;
  setSplit: (id: string, n: number) => void;
  togglePause: (id: string) => void;
  trade: null | 'corp' | 'alliance' | 'signal';
  openTrade: (t: null | 'corp' | 'alliance' | 'signal') => void;
  doTrade: (who: G.Partner, k: any, dir: 'sell' | 'buy') => void;
  fulfill: () => void;
  signal: () => void;
  setTax: (n: number) => void;
  toggleCharter: (id: string) => void;
  restoreCheckpoint: () => void;
  seenIntro: () => void;
  saveNow: () => void;
  boost: () => void;
  rebuild: (id: string) => void;
  raidLook: number;
  tech: boolean;
  openTech: (o: boolean) => void;
  lookAtRaid: () => void;
  reset: () => void;
  expedition: () => void;
  /** 目前的對話場景播完（或跳過） */
  dialogNext: () => void;
  journal: boolean;
  openJournal: (o: boolean) => void;
  /** 首頁：開啟時遊戲暫停 */
  title: boolean;
  closeTitle: () => void;
  settings: boolean;
  openSettings: (o: boolean) => void;
  /** 玩家按下的暫停（訊息視窗與對話另外自動暫停） */
  paused: boolean;
  setPaused: (p: boolean) => void;
}

export const useGame = create<Store>((set, get) => {
  const run = (fn: (s: GameState) => unknown) => { fn(game.s); get().bump(); };
  return {
    v: 0, selected: null, focus: null, offline: boot.offline,
    bump: () => set((st) => ({ v: st.v + 1 })),
    select: (id) => set({ selected: id }),
    focusOn: (id) => set((st) => ({ selected: id, focus: { id, n: (st.focus?.n ?? 0) + 1 } })),
    closeOffline: () => set({ offline: null }),
    click: (id) => engineClick(game.s, id),
    levelUp: (id) => run((s) => A.levelUp(s, id)),
    buyNode: (id, node) => run((s) => A.buyNode(s, id, node)),
    assign: (id, d) => run((s) => A.assign(s, id, d)),
    research: (rid) => run((s) => A.startResearch(s, rid)),
    choose: (i) => run((s) => resolveEvent(s, i)),
    dismissReport: () => run((s) => { s.events.report = null; }),
    dismissBattle: () => run((s) => { s.raid.report = null; }),
    setSplit: (id, n) => run((s) => A.setSplit(s, id, n)),
    togglePause: (id) => run((s) => A.togglePause(s, id)),
    trade: null,
    openTrade: (t) => set({ trade: t }),
    doTrade: (who, k, dir) => run((s) => G.trade(s, who, k, dir)),
    fulfill: () => run((s) => G.fulfillContract(s)),
    signal: () => run((s) => G.signalTrade(s, 5)),
    setTax: (n) => run((s) => G.setTax(s, n)),
    toggleCharter: (id) => run((s) => G.toggleCharter(s, id)),
    expedition: () => run((s) => startExpedition(s)),
    dialogNext: () => run((s) => { s.story.queue?.shift(); }),
    journal: false,
    title: true,
    closeTitle: () => set({ title: false }),
    settings: false,
    openSettings: (o) => set({ settings: o }),
    paused: false,
    setPaused: (p) => set({ paused: p }),
    openJournal: (o) => set({ journal: o }),
    seenIntro: () => run((s) => { s.story.seenIntro = Math.min(s.stage, CHAPTERS.length); }),
    raidLook: 0,
    tech: false,
    openTech: (o) => set({ tech: o, selected: o ? null : get().selected }),
    lookAtRaid: () => set((st) => ({ raidLook: st.raidLook + 1 })),
    boost: () => run((s) => A.startBoost(s)),
    rebuild: (id) => run((s) => A.rebuild(s, id)),
    saveNow: () => { save(game.s); get().bump(); },
    restoreCheckpoint: () => {
      const cp = game.s.checkpoint;
      if (!cp) return get().reset();
      const s = JSON.parse(cp) as GameState;
      migrate(s);
      s.checkpoint = cp; s.failed = false; s.starveTime = 0;
      s.lastSaved = Date.now();
      game.s = s;
      save(s);
      set((st) => ({ v: st.v + 1, selected: null, offline: null }));
    },
    reset: () => {
      try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
      game.s = newGame();
      makeCheckpoint(game.s);
      set((st) => ({ v: st.v + 1, selected: null, offline: null }));
    },
  };
});

/** 有正在播放的劇情對話 */
const dialogOpen = () => { const q = game.s.story.queue?.[0]; return !!q && !!SCENES[q.id] && !game.s.failed; };
/** 目前開著的訊息視窗數（Modal 開啟時加一、關閉時減一） */
export const modalHold = { n: 0 };
/** 遊戲時間停止：玩家暫停、首頁、劇情對話、任何訊息視窗（事件、報告、章節開場、科技樹、設定、日誌…） */
export const gamePaused = () => { const st = useGame.getState(); return st.paused || st.title || !!st.trade || dialogOpen() || modalHold.n > 0; };

// 200ms 時間累加器（GDD §15 tick.ts）。分頁在背景太久時，超過 60 秒的部分用離線收益結算。
let last = performance.now(), acc = 0, sinceSave = 0;
setInterval(() => {
  const now = performance.now();
  // 暫停時不累積時間：關掉視窗、對話播完或按下繼續就接著跑
  if (gamePaused()) { last = now; return; }
  acc += (now - last) / 1000;
  last = now;
  if (acc > 60) {
    const rep = applyOffline(game.s, acc - 1);
    if (rep) useGame.setState({ offline: rep });
    acc = 1;
  }
  let n = 0;
  while (acc >= TICK && n < 50) { step(game.s, TICK); acc -= TICK; n++; sinceSave += TICK; }
  if (n) {
    observe(game.s);
    useGame.getState().bump();
    setMood({ stage: Math.min(6, game.s.stage), raid: !!game.s.raid?.incoming, finished: game.s.finished });
  }
  if (sinceSave >= 10) { save(game.s); sinceSave = 0; }
}, 100);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(game.s); });
addEventListener('pagehide', () => save(game.s));
