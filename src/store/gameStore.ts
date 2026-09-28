// Zustand store：遊戲狀態本身是可變物件（引擎直接修改），store 只用版本號通知 React 重繪。
import { create } from 'zustand';
import { GameState, makeCheckpoint, newGame, newGov, newRaid } from '../engine/state';
import { CHAPTERS, migrateStoryDone } from '../engine/story';
import { built } from '../engine/formulas';
import { step, TICK } from '../engine/tick';
import { click as engineClick, ClickResult } from '../engine/click';
import { applyOffline } from '../engine/offline';
import * as A from '../engine/actions';
import { resolveEvent } from '../engine/events';
import * as G from '../engine/governance';

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
/** 舊存檔補上新欄位 */
function migrate(s: GameState) {
  const fresh = newGame();
  for (const id of Object.keys(fresh.b)) s.b[id] ??= fresh.b[id];
  s.starveTime ??= 0; s.failed ??= false; s.checkpoint ??= null;
  s.raid ??= newRaid();
  s.res.weapon ??= 0; s.res.crystal ??= 0; s.res.credit ??= 0;
  s.gov ??= newGov();
  // 目標完成紀錄從中文文字改成 id
  s.story.done = migrateStoryDone(s.story.done);
  // 舊存檔：原本前哨站就算 MVP 完成，現在接續第 4 章
  if (s.finished && !built(s, 'star_dome')) s.finished = false;
  s.notices = [];
}
function save(s: GameState) {
  s.lastSaved = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, notices: [] })); } catch { /* 無法存檔時照常遊玩 */ }
}

const boot = load();
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
  reset: () => void;
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
    seenIntro: () => run((s) => { s.story.seenIntro = Math.min(s.stage, CHAPTERS.length); }),
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

// 200ms 時間累加器（GDD §15 tick.ts）。分頁在背景太久時，超過 60 秒的部分用離線收益結算。
let last = performance.now(), acc = 0, sinceSave = 0;
setInterval(() => {
  const now = performance.now();
  acc += (now - last) / 1000;
  last = now;
  if (acc > 60) {
    const rep = applyOffline(game.s, acc - 1);
    if (rep) useGame.setState({ offline: rep });
    acc = 1;
  }
  let n = 0;
  while (acc >= TICK && n < 50) { step(game.s, TICK); acc -= TICK; n++; sinceSave += TICK; }
  if (n) useGame.getState().bump();
  if (sinceSave >= 10) { save(game.s); sinceSave = 0; }
}, 100);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(game.s); });
addEventListener('pagehide', () => save(game.s));
