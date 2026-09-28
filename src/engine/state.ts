import BUILDINGS from '../data/buildings.json';

export type ResKey = 'nutrient' | 'scrap' | 'rock' | 'parts' | 'metal' | 'tools' | 'weapon' | 'crystal' | 'credit';
export const RES_KEYS: ResKey[] = ['nutrient', 'scrap', 'rock', 'parts', 'metal', 'tools', 'weapon', 'crystal', 'credit'];
export const RES_UNLOCK: Record<ResKey, number> = { nutrient: 1, scrap: 1, rock: 2, parts: 2, metal: 3, tools: 3, weapon: 4, crystal: 4, credit: 5 };
export const RES_NAME: Record<ResKey, string> = { nutrient: '營養', scrap: '廢料', rock: '岩材', parts: '零件', metal: '金屬', tools: '工具', weapon: '武器', crystal: '異晶', credit: '信用點' };
/** 貨幣不受倉容上限限制 */
export const UNCAPPED: ResKey[] = ['credit'];

export type Cost = Partial<Record<ResKey, number>>;
export type Effect = Partial<{
  clickAdd: number; critAdd: number; critMul: number; workerCapAdd: number; buffDuration: number;
  prodAdd: number; housingAdd: number; birthAdd: number; moraleAdd: number; foodWindow: number;
  recipeOut: number; outMul: number; researchSpeed: number; storagePerLevel: number; gatherAdd: number;
  storageMul: number; consumeMul: number; processAdd: number;
  guardHp: number; guardAtk: number; weaponAtk: number; injuryMul: number; clickCrystal: number; habBonus: number;
  charterSlot: number; crystalAdd: number; turretAtk: number;
}>;
export interface UpgradeNode { id: string; name: string; desc: string; minLevel: number; cost: Cost; effect: Effect; stage?: number }
export interface BuildingDef {
  id: string; name: string; stage: number; desc: string;
  kind: 'start' | 'gather' | 'process' | 'command' | 'house' | 'storage' | 'morale' | 'research' | 'rail' | 'defense' | 'utility' | 'governance' | 'trade';
  baseCost: Cost; maxLevel: number; startLevel?: number; clickable?: boolean; commandLevel?: number;
  produce?: { res: ResKey; rate: number };
  recipe?: { in: ResKey; out: ResKey; ratio: number };
  workersPerLevel?: number;
  effects?: Partial<{ housing: number; storage: number; morale: number; gatherAdd: number; birth: number; consumeMul: number; habBonus: number }>;
  requires?: { pop?: number; raids?: number; credits?: number };
  upgrades?: UpgradeNode[];
}
export const DEFS = BUILDINGS as unknown as BuildingDef[];
export const DEF: Record<string, BuildingDef> = Object.fromEntries(DEFS.map((d) => [d.id, d]));
export const COMMAND_CHAIN = DEFS.filter((d) => d.kind === 'command').sort((a, b) => a.commandLevel! - b.commandLevel!).map((d) => d.id);

export interface BState { level: number; workers: number; nodes: string[]; disabledUntil: number; lastClick: number; split?: number; paused?: boolean }
export interface ActiveEvent { kind: 'meteor' | 'rescue' | 'envoy'; target?: string; cost?: number }
export interface BattleReport {
  won: boolean; raid: number; enemies: number; guards: number; armed: number; turrets?: number; kind?: string;
  rounds: { ours: number; theirs: number; oursMax: number; theirsMax: number }[];
  injured: number; lines: string[];
}
export interface RaidState {
  count: number; won: number; nextAt: number;
  incoming: { at: number; enemies: number; atk: number; hp: number; side: number; kind?: 'alien' | 'raider' | 'commando' } | null;
  injured: number[]; armed: number; report: BattleReport | null;
}
/** 階段 5：治理（稅、憲章）、企業關係、貿易 */
export interface GovState {
  tax: number;
  charters: string[];
  creditsEarned: number;
  corp: { relation: number; refusals: number; paid: number; envoys: number; traded: number; nextEnvoy: number; demand: Cost | null };
  alliance: { rep: number; contract: { res: ResKey; amount: number; reward: number; until: number } | null; nextContract: number };
  signal: { used: number; resetAt: number };
}
export const newGov = (): GovState => ({
  tax: 0, charters: [], creditsEarned: 0,
  corp: { relation: 0, refusals: 0, paid: 0, envoys: 0, traded: 0, nextEnvoy: -1, demand: null },
  alliance: { rep: 0, contract: null, nextContract: 0 },
  signal: { used: 0, resetAt: 0 },
});
export interface Notice { id: number; text: string; tone?: 'good' | 'warn' | 'info' }

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
  /** 本章開頭的存檔快照（JSON），失敗時可回到這裡 */
  checkpoint: string | null;
  research: { done: string[]; active: string | null; progress: number };
  events: {
    nextAt: number; active: ActiveEvent | null; rescue: { until: number; workers: number } | null;
    /** 事件結果（例如救援隊回來），UI 以對話框顯示，玩家關閉後清除 */
    report?: { title: string; text: string; gains: string[] } | null;
  };
  story: { seenIntro: number; assigned: boolean; done: string[] };
  stats: { clicks: number; crits: number };
  raid: RaidState;
  gov: GovState;
  lastSaved: number;
  notices: Notice[];
}

export const newRaid = (): RaidState => ({ count: 0, won: 0, nextAt: -1, incoming: null, injured: [], armed: 0, report: null });

export function newGame(now = Date.now()): GameState {
  const b: Record<string, BState> = {};
  for (const d of DEFS) b[d.id] = { level: d.startLevel ?? 0, workers: 0, nodes: [], disabledUntil: 0, lastClick: -99 };
  return {
    v: 1, t: 0, stage: 1, finished: false,
    res: { nutrient: 60, scrap: 0, rock: 0, parts: 0, metal: 0, tools: 0, weapon: 0, crystal: 0, credit: 0 },
    b, pop: 3, arrival: 0, morale: 60, starving: false, starveTime: 0, failed: false, checkpoint: null,
    research: { done: [], active: null, progress: 0 },
    events: { nextAt: 300, active: null, rescue: null },
    story: { seenIntro: 0, assigned: false, done: [] },
    stats: { clicks: 0, crits: 0 },
    raid: newRaid(),
    gov: newGov(),
    lastSaved: now,
    notices: [],
  };
}

export function makeCheckpoint(s: GameState) {
  s.checkpoint = null;
  s.checkpoint = JSON.stringify({ ...s, notices: [], checkpoint: null });
}

let noticeId = 1;
export function notify(s: GameState, text: string, tone: Notice['tone'] = 'info') {
  s.notices.push({ id: noticeId++, text, tone });
  if (s.notices.length > 6) s.notices.shift();
}
