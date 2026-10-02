// 匿名遊玩數據（Google Analytics 4 自訂事件）：只記事件與遊玩時間，不記任何個人資料。
// 只在正式網站上送（itch.io、VIVERSE 等 http(s) 網址）；本機檔案、Artifact 預覽、自動化測試都不送。
// 玩家可以在設定頁「畫面 → 傳送匿名遊玩數據」關掉。
import type { GameState } from './engine/state';
import { useSettings } from './i18n';
import { VERSION } from './ui/Settings';

const GA_ID = 'G-1E6L28ZG6Z';
const HEARTBEAT = 600;   // 每玩 10 分鐘（遊戲時間）送一次「還在玩」

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void } }

const allowedHost = () =>
  /^https?:$/.test(location.protocol) && !/claude|localhost|127\.0\.0\.1|^$/.test(location.hostname) && !navigator.webdriver;
const on = () => allowedHost() && useSettings.getState().analytics;

let loaded = false;
function load() {
  if (loaded || !on()) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer!.push(arguments); };
  window.gtag('js', new Date());
  // 遊戲在 itch.io 的 iframe 裡（不同網域）：cookie 要允許跨站
  window.gtag('config', GA_ID, { cookie_flags: 'SameSite=None;Secure', app_version: VERSION });
  const sc = document.createElement('script');
  sc.async = true; sc.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  document.head.appendChild(sc);
}

/** 送一個事件（關掉或不在正式網站時什麼都不做） */
export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  if (!on()) return;
  load();
  window.gtag?.('event', name, { ...params, game_version: VERSION });
}

const minutes = (s: GameState) => Math.round(s.t / 60);
let seen: { stage: number; raids: number; route?: string; finished: boolean; beat: number } | null = null;

/** 遊戲開始（從標題畫面進入）：fresh＝新遊戲 */
export function trackStart(s: GameState, fresh: boolean) {
  seen = null;
  track('game_start', { new_game: fresh, chapter: s.stage, play_minutes: minutes(s) });
}

/** 每次遊戲時間前進後呼叫：章節、第一次襲擊、路線、結局、每 10 分鐘心跳 */
export function observe(s: GameState) {
  if (!on()) return;
  // 讀檔後第一次：記下現在的狀態，不補送已經發生過的事
  if (!seen) { seen = { stage: s.stage, raids: s.raid.count, route: s.story.route, finished: s.finished, beat: Math.floor(s.t / HEARTBEAT) }; return; }
  if (s.stage > seen.stage) { for (let c = seen.stage + 1; c <= s.stage; c++) track('chapter_reached', { chapter: c, play_minutes: minutes(s) }); seen.stage = s.stage; }
  if (seen.raids === 0 && s.raid.count > 0) track('first_raid', { play_minutes: minutes(s) });
  seen.raids = s.raid.count;
  if (!seen.route && s.story.route) track('route_chosen', { route: s.story.route, play_minutes: minutes(s) });
  seen.route = s.story.route;
  if (!seen.finished && s.finished) track('ending', { choice: s.story.choice6 ?? 'stay', route: s.story.route ?? 'none', play_minutes: minutes(s) });
  seen.finished = s.finished;
  const beat = Math.floor(s.t / HEARTBEAT);
  if (beat > seen.beat) { track('heartbeat', { chapter: s.stage, play_minutes: minutes(s) }); seen.beat = beat; }
}
