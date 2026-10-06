import BUILDINGS from '../data/buildings.json';
import type { Good, MarketState } from './market';

export type ResKey = 'nutrient' | 'oxygen' | 'scrap' | 'rock' | 'parts' | 'metal' | 'tools' | 'weapon' | 'crystal' | 'credit';
export const RES_KEYS: ResKey[] = ['nutrient', 'oxygen', 'scrap', 'rock', 'parts', 'metal', 'tools', 'weapon', 'crystal', 'credit'];
export const RES_UNLOCK: Record<ResKey, number> = { nutrient: 1, oxygen: 1, scrap: 1, rock: 2, parts: 2, metal: 3, tools: 3, weapon: 4, crystal: 3, credit: 4 };
/** 貨幣不受倉容上限限制 */
export const UNCAPPED: ResKey[] = ['credit'];

export type Cost = Partial<Record<ResKey, number>>;
export type Effect = Partial<{
  clickAdd: number; critAdd: number; critMul: number; workerCapAdd: number; buffDuration: number;
  prodAdd: number; housingAdd: number; birthAdd: number; moraleAdd: number; foodWindow: number;
  recipeOut: number; outMul: number; researchSpeed: number; storagePerLevel: number; gatherAdd: number;
  storageMul: number; consumeMul: number; processAdd: number; o2Add: number; costMul: number;
  guardHp: number; guardAtk: number; weaponAtk: number; injuryMul: number; clickCrystal: number; habBonus: number;
  charterSlot: number; crystalAdd: number; turretAtk: number; weaponOut: number; healAdd: number; bedAdd: number;
}>;
export interface UpgradeNode { id: string; name: string; desc: string; minLevel: number; cost: Cost; effect: Effect; stage?: number }
export interface BuildingForm { id: string; stage: number; name: string; desc: string; rate: number; workersPerLevel: number; art: string; cost: Cost; baseCost: Cost; oxygen?: number }
export interface BuildingDef {
  id: string; name: string; stage: number; desc: string;
  kind: 'start' | 'gather' | 'process' | 'command' | 'house' | 'storage' | 'morale' | 'research' | 'rail' | 'defense' | 'utility' | 'governance' | 'trade' | 'medical' | 'beacon' | 'ship';
  /** 改建形態（糧食設施：藻類槽 → 生物採集站 → 水耕農場）；第 0 形態就是建築本身 */
  forms?: BuildingForm[];
  /** 每級成本不隨等級成長（軌道信標的分段建造） */
  flatCost?: boolean;
  baseCost: Cost; maxLevel: number; startLevel?: number; clickable?: boolean; commandLevel?: number;
  produce?: { res: ResKey; rate: number };
  /** 副產氧氣：每位工人每秒（例如藻類槽） */
  oxygen?: number;
  recipe?: { in: ResKey; out: ResKey; ratio: number };
  workersPerLevel?: number;
  effects?: Partial<{ housing: number; storage: number; morale: number; gatherAdd: number; birth: number; consumeMul: number; habBonus: number }>;
  /** scene：要先播過某段劇情才能蓋（例如交易站要先跟喜鵲聯絡上） */
  requires?: { pop?: number; raids?: number; credits?: number; levels?: Record<string, number>; scene?: string };
  upgrades?: UpgradeNode[];
}
export const DEFS = BUILDINGS as unknown as BuildingDef[];
export const DEF: Record<string, BuildingDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const COMMAND_CHAIN = DEFS.filter((d) => d.kind === 'command').sort((a, b) => a.commandLevel! - b.commandLevel!).map((d) => d.id);

export interface ShipState { mods: number; wait?: number }
export interface BState { level: number; workers: number; nodes: string[]; disabledUntil: number; lastClick: number; split?: number; paused?: boolean; form?: number }
export interface ActiveEvent { kind: 'meteor' | 'rescue' | 'rescue_ines' | 'envoy' | 'choice6'; target?: string; cost?: number }
export interface BattleReport {
  won: boolean; raid: number; enemies: number; guards: number; armed: number; turrets?: number; kind?: string;
  rounds: { ours: number; theirs: number; oursMax: number; theirsMax: number }[];
  injured: number;
  /** 受傷的一般殖民者人數 */
  civHurt?: number;
  /** 舊存檔是中文字串，新的是 Msg */
  lines: (Msg | string)[];
}
export interface RaidState {
  count: number; won: number; nextAt: number;
  incoming: { at: number; enemies: number; atk: number; hp: number; side: number; kind?: 'alien' | 'raider' | 'commando' } | null;
  injured: number[]; armed: number; report: BattleReport | null;
  /** 戰鬥中受傷的一般殖民者：復原時間、原本工作的建築（好了會回去） */
  hurt?: { until: number; b: string | null }[];
}
/** 階段 5：治理（稅、憲章）、企業關係、貿易 */
export interface GovState {
  tax: number;
  charters: string[];
  creditsEarned: number;
  /** 進入第 5 章時的累計信用點：第 5 章的信用點目標與星辰穹頂只算之後賺的（第 4 章就能跟行商交易了） */
  credits5?: number;
  corp: { relation: number; refusals: number; paid: number; envoys: number; traded: number; nextEnvoy: number; demand: Cost | null };
  alliance: { rep: number; contract: { res: ResKey; amount: number; reward: number; until: number } | null; nextContract: number };
  signal: { used: number; resetAt: number };
}
export interface AirState { elapsed: number; hypoxic: boolean; hypoxiaTime: number; pause: number; graceUsed: boolean; safeTime?: number }
export const newAir = (): AirState => ({ elapsed: 0, hypoxic: false, hypoxiaTime: 0, pause: 0, graceUsed: false, safeTime: 0 });
export const newGov = (): GovState => ({
  tax: 0, charters: [], creditsEarned: 0,
  corp: { relation: 0, refusals: 0, paid: 0, envoys: 0, traded: 0, nextEnvoy: -1, demand: null },
  alliance: { rep: 0, contract: null, nextContract: 0 },
  signal: { used: 0, resetAt: 0 },
});
/** 顯示文字一律由 UI 依語言翻譯：k 是 i18n 代碼，p 是參數（b=建築 id、r=資源、rs=研究、c=憲章、kind=襲擊者種類會自動換成名稱） */
export interface Msg { k: string; p?: Record<string, string | number> }
export const msg = (k: string, p?: Msg['p']): Msg => (p ? { k, p } : { k });
export interface Notice { id: number; msg: Msg; tone?: 'good' | 'warn' | 'info' }

export interface GameState {
  v: 1;
  t: number;
  stage: number;
  finished: boolean;
  res: Record<ResKey, number>;
  b: Record<string, BState>;
  pop: number;
  arrival: number;
  morale: number;
  starving: boolean;
  /** 連續斷糧秒數；超過 STARVE_GRACE 後殖民者開始離開 */
  starveTime: number;
  failed: boolean;
  /** 瓦解原因：斷糧或缺氧（失敗畫面用） */
  failReason?: 'food' | 'air';
  /** 本章開頭的存檔快照（JSON），失敗時可回到這裡 */
  checkpoint: string | null;
  research: { done: string[]; active: string | null; progress: number };
  events: {
    nextAt: number; active: ActiveEvent | null; rescue: { until: number; workers: number; ines?: boolean } | null;
    /** 事件結果（例如救援隊回來），UI 以對話框顯示，玩家關閉後清除 */
    report?: { title: Msg | string; text: Msg | string; gains: (Msg | string)[] } | null;
  };
  /** done：已完成的目標 id（`章-序號`，例如 "2-0"） */
  story: {
    seenIntro: number; assigned: boolean; done: string[]; tips?: string[];
    /** 播過的劇情場景、等著播放的場景（d：觸發時的天數） */
    seen?: string[]; queue?: { id: string; d: number }[];
    /** 伊涅絲：固定的第一次求救訊號什麼時候響、是否已經救回 */
    inesAt?: number; ines?: boolean;
    /** 對話腳本版本（見 dialog.ts 的 DIALOG_VERSION） */
    dlgV?: number;
    /** 一般求救訊號累計救回的人數；進入第 4 章時組裝工坊的等級（劇情觸發用） */
    rescued?: number; asm4?: number;
    /** 第 5 章：第一次使者來訪的選擇（合作／抵抗）、抵抗路線的策略傾向（第二次拒絕時判定一次）、第二次使者來訪的時間 */
    route?: 'coop' | 'resist'; lean?: 'alien' | 'alliance'; env2At?: number;
    /** 赫利昂軍隊代為擊退微光獸的次數（合作路線）、擊退赫利昂突擊隊的次數、是否和神秘訊號交易過 */
    corpHelp?: number; commandoWon?: number; signalUsed?: boolean;
    /** 第 6 章的抉擇：leave 放棄異晶、造船離開；stay 保留異晶、留下來 */
    choice6?: 'leave' | 'stay';
  };
  /** 探勘站：探勘隊、次數、藍圖碎片、已取得的藍圖 */
  exp?: import('./expedition').ExpState;
  /** 殖民地日誌（朱諾） */
  journal?: import('./dialog').Journal;
  stats: { clicks: number; crits: number };
  raid: RaidState;
  gov: GovState;
  /** 空氣：維生系統已運作秒數、是否缺氧、連續缺氧秒數、新手保護的暫停秒數 */
  air: AirState;
  /** 生物工程室的產量加成：到期時間、累計注入次數 */
  boost: { until: number; uses: number };
  lastSaved: number;
  notices: Notice[];
  /** 交易站的市場（行商庫存、還在路上的貨櫃）與貨艙裡的進口品 */
  market: MarketState;
  cargo: Record<Good, number>;
  /** 船塢（v0.70）：完成幾個模組（0～6）；wait＝第 6 章選了「先等等」時已完成的模組數 */
  ship: ShipState;
  /** 讀檔轉換時要顯示的通知（轉換後才加進 notices） */
  pendingNotice?: string;
}

/** 氧氣系統的總開關：氧氣建築（v0.6 第 2 步）完成前先關閉，避免遊戲裡沒有產氧來源。模擬器與測試可以先打開 */
export let AIR_ENABLED = true;
export function setAirEnabled(on: boolean) { AIR_ENABLED = on; RES_UNLOCK.oxygen = on ? 1 : 99; }

/** 市場初始值：行商庫存從空的開始算（沒有紀錄的商品視為剛好在目標值），貨艙是空的 */
export const newMarket = (): MarketState => ({ stock: {}, pending: [], drops: 0 });
export const newCargo = (): Record<Good, number> => ({ electronics: 0, raremetal: 0, fuel: 0, medicine: 0 });

export const newRaid = (): RaidState => ({ count: 0, won: 0, nextAt: -1, incoming: null, injured: [], armed: 0, report: null });

export function newGame(now = Date.now()): GameState {
  const b: Record<string, BState> = {};
  for (const d of DEFS) b[d.id] = { level: d.startLevel ?? 0, workers: 0, nodes: [], disabledUntil: 0, lastClick: -99 };
  return {
    v: 1, t: 0, stage: 1, finished: false,
    res: { nutrient: 140, oxygen: 150, scrap: 0, rock: 0, parts: 0, metal: 0, tools: 0, weapon: 0, crystal: 0, credit: 0 },
    b, pop: 3, arrival: 0, morale: 60, starving: false, starveTime: 0, failed: false, checkpoint: null,
    research: { done: [], active: null, progress: 0 },
    events: { nextAt: 300, active: null, rescue: null },
    story: { seenIntro: 0, assigned: false, done: [], seen: [], queue: [], dlgV: 7 },   // dlgV 要跟 dialog.ts 的 DIALOG_VERSION 一致
    stats: { clicks: 0, crits: 0 },
    raid: newRaid(),
    gov: newGov(),
    air: newAir(),
    exp: { until: 0, team: 0, count: 0, frags: 0, blueprints: [] },
    boost: { until: 0, uses: 0 },
    market: newMarket(), cargo: newCargo(), ship: { mods: 0 },
    lastSaved: now,
    notices: [],
  };
}

export function makeCheckpoint(s: GameState) {
  s.checkpoint = null;
  s.checkpoint = JSON.stringify({ ...s, notices: [], checkpoint: null });
}

let noticeId = 1;
export function notify(s: GameState, k: string, p?: Msg['p'], tone: Notice['tone'] = 'info') {
  s.notices.push({ id: noticeId++, msg: msg(k, p), tone });
  if (s.notices.length > 6) s.notices.shift();
}
