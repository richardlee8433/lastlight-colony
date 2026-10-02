// Pixi 場景：地圖、建築／工地、工人、點擊回饋。狀態來自引擎，每次版本號改變時同步。
import { Application, Container, Graphics, Point, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import {
  STAGES, RES, planMap, createGround, createBuilding, createProp, createWorker, createBuffRing,
  createAmbient, createFx, createPixelSprite, renderPanel, renderIcon, pixelTexture, tierOf, createAlien, createCommando, createMarine, setNight, loadSprites, hasTerrain, setCharZoom,
} from '../art/art.js';
import { game, gamePaused, useGame } from '../store/gameStore';
import { COMMAND_CHAIN, DEF } from '../engine/state';
import { artId, buffActive, built, disabled, idle, retired, workerCap } from '../engine/formulas';
import { MW, MH, CENTER, SITES, HOME, Site, RAID_SPAWN, RAID_RALLY, ROUTES, POD_DOOR, routeFromPod, PATROL, PATROL_TOTAL, patrolAt, pathBetween, along } from './layout';
import { WARNING, defense, injuredCount, medBeds } from '../engine/combat';
import { bName, lang, resName, t, useSettings } from '../i18n';
import { sfx } from '../audio/audio';

type View = Container & { key: string; site: Site; bid: string | null; plate?: Container; ring?: any; sel?: any; building?: any; lights?: Container; shadow?: Sprite & { smask?: ShadowMask } };
/** 對話泡泡的小圖示（像素圖，每行一列，# 是深色、. 是空白）：…、愛心、！、？、音符、笑 */
const BUBBLE_ICONS = [
  ['.....', '.....', '#.#.#', '.....'],
  ['.#.#.', '#####', '.###.', '..#..'],
  ['..#..', '..#..', '.....', '..#..'],
  ['.##..', '...#.', '..#..', '..#..'],
  ['..##.', '..#.#', '###..', '##...'],
  ['#...#', '.....', '#...#', '.###.'],
];
const BUBBLE_TEX = new Map<number, Texture>();
/** 白色圓角泡泡＋左下的小尾巴，裡面放一個圖示；最近鄰取樣保持像素感 */
function bubbleTexture(k: number): Texture {
  let t = BUBBLE_TEX.get(k);
  if (t) return t;
  const cv = document.createElement('canvas'); cv.width = 11; cv.height = 10;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#2a1e1a'; g.fillRect(1, 0, 9, 1); g.fillRect(1, 7, 9, 1); g.fillRect(0, 1, 1, 6); g.fillRect(10, 1, 1, 6);
  g.fillRect(2, 8, 2, 1); g.fillRect(2, 9, 1, 1);
  g.fillStyle = '#fff8ec'; g.fillRect(1, 1, 9, 6); g.fillRect(3, 7, 1, 1);
  g.fillStyle = k === 1 ? '#d8405a' : '#3a2a24';
  BUBBLE_ICONS[k].forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') g.fillRect(3 + x, 2 + y, 1, 1); }));
  t = Texture.from(cv); t.source.scaleMode = 'nearest';
  BUBBLE_TEX.set(k, t);
  return t;
}
/** 影子的實心範圍（建築圖的不透明像素），用來判斷小人是不是站在影子裡 */
type ShadowMask = { a: Uint8Array; w: number; h: number };
const MASKS = new Map<HTMLCanvasElement, ShadowMask>();
function shadowMask(cv: HTMLCanvasElement): ShadowMask {
  let m = MASKS.get(cv);
  if (!m) {
    const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data, a = new Uint8Array(cv.width * cv.height);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    MASKS.set(cv, (m = { a, w: cv.width, h: cv.height }));
  }
  return m;
}
type Walker = Container & { ai: any; px: number; py: number; setMoving: any; setDir: any; setCarry: any; setWork?: (w: boolean) => void; update: any };

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 地圖上畫幾個走動的殖民者：人口 10 以內全部，之後每 10 人多 1 個 */
export const walkerBudget = (pop: number) => (pop <= 10 ? pop : 10 + Math.floor((pop - 10) / 10));
/** 影子翻轉線在建築高度的多少比例處（從正面底邊往上算） */
const SHADOW_FOOT = 0.15;
/** 影子最深的不透明度（清晨、黃昏）；太淡在紅沙地上幾乎看不出來 */
const SHADOW_ALPHA = 0.58;

export class GameScene {
  app = new Application();
  world = new Container();
  obj = new Container();
  lightL = new Container();
  /** 建築的影子（在地面之上、建築之下），方向和長短跟著日夜的太陽走 */
  shadowL = new Container();
  /** 斜射光：清晨、黃昏從一側照過來的淡淡光線 */
  sunRay = new Sprite();
  /** 腳印（每幀重畫）：每個小人身後最多 3 個，只留在沙地上 */
  footG = new Graphics();
  /** 小人腳下的影子（每幀重畫） */
  unitShadowG = new Graphics();
  /** 目前的太陽：影子長度、斜度（弧度）、影子濃度 */
  sun = { len: 0.5, lean: 0.6, alpha: 0.3 };
  hud = new Container();
  fxL = new Container();
  ground: (Container & { roads?: Sprite | null; paved?: (x: number, y: number) => boolean }) | null = null;
  overlay = new Graphics();
  ambient: any = null;
  props: any[] = [];
  views = new Map<string, View>();
  walkers: Walker[] = [];
  aliens: any[] = [];
  /** 擊退後倒在地上的突擊隊、微光獸：播完倒地動畫、躺一下再淡出 */
  fallen: any[] = [];
  /** 出去迎戰的陸戰隊員（預警期間從營區走到防線，戰後走回去） */
  defenders: any[] = [];
  /** 平時沿外圍巡邏的陸戰隊員；受傷的在醫療艙（沒有醫療艙就在營區）門口休養 */
  patrols: any[] = [];
  patrolKey = '';
  patients: any[] = [];
  /** 飛行中的彈道（地圖座標）：bullet 曳光彈、spit 酸液；beam 是瞬間雷射，只淡出 */
  shots: { x: number; y: number; vx: number; vy: number; t: number; life: number; kind: 'bullet' | 'spit'; hit: any; tx: number; ty: number }[] = [];
  beams: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];
  shotG = new Graphics();
  turretCd = 0;
  raidKey = '';
  groundStage = 0;
  Z = 3;
  cam = { x: 0, y: 0 };
  camGoal: { x: number; y: number } | null = null;
  drag: any = null;
  hold: { id: string; next: number } | null = null;
  pressed: string | null = null;
  hover: string | null = null;
  fx: any;
  T = 0;
  unsub: (() => void) | null = null;
  lastFocus = 0;
  lastRaidLook = 0;
  walkCamp: boolean | null = null;
  raidMark: any = null;

  async init(host: HTMLElement) {
    await this.app.init({
      width: Math.max(320, host.clientWidth), height: Math.max(200, host.clientHeight),
      antialias: false, background: 0x0a0c12, resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true, roundPixels: true, preference: 'webgl',
    });
    host.appendChild(this.app.canvas);
    // 手繪小人的 sprite sheet；載入失敗就用程序化小人
    await loadSprites().catch(() => {});
    this.obj.sortableChildren = true;
    this.world.addChild(this.obj, this.shotG, this.overlay, this.lightL);
    this.app.stage.addChild(this.world, this.hud, this.fxL);
    // 舞台是 static（拖曳用），子層會繼承互動模式；不需要點擊的層一律關掉，避免擋住建築
    for (const c of [this.overlay, this.lightL, this.fxL, this.shotG, this.shadowL]) c.eventMode = 'none';
    // 斜射光：一張斜向漸層（左上亮、往右下淡出），用加亮混合疊在環境光上
    { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d')!;
      const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      this.sunRay.texture = Texture.from(cv); this.sunRay.width = MW; this.sunRay.height = MH; this.sunRay.blendMode = 'add'; this.sunRay.alpha = 0; this.sunRay.eventMode = 'none'; }
    this.lightL.addChildAt(this.sunRay, 0);
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.Z = this.zoomFor(this.app.screen.width);
    (window as any).__scene = this;   // 測試用：瀏覽器測試讀場景狀態（不影響遊戲）
    setCharZoom(this.Z);
    this.fx = createFx(this.fxL, this.Z);
    this.bindInput();
    this.sync();
    this.cam.x = CENTER.x - this.app.screen.width / this.Z / 2;
    this.cam.y = CENTER.y - this.app.screen.height / this.Z / 2;
    this.clampCam();
    this.unsub = useGame.subscribe((st, prev) => {
      if (st.v !== prev.v || st.selected !== prev.selected) this.sync();
      if (st.focus && st.focus.n !== this.lastFocus) { this.lastFocus = st.focus.n; this.focusOn(st.focus.id); }
      if (st.raidLook !== this.lastRaidLook) { this.lastRaidLook = st.raidLook; this.lookAtRaid(); }
    });
    this.app.ticker.add((tk) => this.frame(Math.min(0.05, tk.deltaMS / 1000)));
    new ResizeObserver(() => this.resize(host)).observe(host);
  }

  /** 玩家用滾輪選的縮放；null 表示依視窗寬度自動決定 */
  userZ: number | null = null;
  zoomFor(w: number) { return Math.max(this.minZ(), this.userZ ?? clampN(Math.round(w / 400), 2, 4)); }
  /** 最小縮放：地圖要蓋滿整個畫面（整數倍；再縮小地圖外會露出黑邊） */
  minZ() { return clampN(Math.ceil(Math.max(this.app.screen.width / MW, this.app.screen.height / MH) - 1e-6), 1, 5); }
  /** 換縮放倍率（整數倍，像素才不會糊）；anchor 是螢幕座標，縮放時它底下的地圖點保持不動 */
  setZoom(z: number, anchor?: [number, number]) {
    z = clampN(z, this.minZ(), 5);
    if (z === this.Z) return;
    const [ax, ay] = anchor ?? [this.app.screen.width / 2, this.app.screen.height / 2];
    const wx = this.cam.x + ax / this.Z, wy = this.cam.y + ay / this.Z;
    this.userZ = z; this.Z = z;
    this.cam.x = wx - ax / z; this.cam.y = wy - ay / z; this.camGoal = null;
    this.resetFx(z);
    for (const v of this.views.values()) v.key = '';
    this.sync();
    this.clampCam();
  }
  /** 縮放改變時重建特效器，並清掉舊特效（不然播到一半的「+1 岩材」會永遠留在畫面上） */
  resetFx(z: number) {
    setCharZoom(z);
    this.fx?.clear();
    this.fx = createFx(this.fxL, z);
  }
  resize(host: HTMLElement) {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === this.app.screen.width && h === this.app.screen.height)) return;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = this.app.screen;
    const z = this.zoomFor(w);
    if (z !== this.Z) { this.Z = z; this.resetFx(z); for (const v of this.views.values()) v.key = ''; this.sync(); }
    this.clampCam();
  }
  clampXY(x: number, y: number) {
    const vw = this.app.screen.width / this.Z, vh = this.app.screen.height / this.Z;
    return { x: vw >= MW ? (MW - vw) / 2 : clampN(x, 0, MW - vw), y: vh >= MH ? (MH - vh) / 2 : clampN(y, 0, MH - vh) };
  }
  clampCam() {
    const c = this.clampXY(this.cam.x, this.cam.y);
    this.cam.x = Math.round(c.x); this.cam.y = Math.round(c.y);
  }
  toScreen(x: number, y: number): [number, number] { return [(x - this.cam.x) * this.Z, (y - this.cam.y) * this.Z]; }
  focusOn(id: string) {
    const site = SITES.find((s) => s.id === id || (s.id === 'command' && COMMAND_CHAIN.includes(id)));
    if (!site) return;
    this.camGoal = this.clampXY(site.x - this.app.screen.width / this.Z / 2, site.y - 20 - this.app.screen.height / this.Z / 2);
  }

  /** 建築面板打開後，若建築被面板蓋住，把鏡頭移到面板以外的區域 */
  keepVisible(v: View) {
    const W = this.app.screen.width, H = this.app.screen.height, top = v.building?.art.ay ?? 30;
    const [sx, sy] = this.toScreen(v.x, v.y - top / 2);
    const area = W > 640 ? { x0: 0, x1: W - 360, y0: 60, y1: H - 80 } : { x0: 0, x1: W, y0: 60, y1: H * 0.4 };
    const m = 40;
    if (sx > area.x0 + m && sx < area.x1 - m && sy > area.y0 + m && sy < area.y1 - m) return;
    const cx = (area.x0 + area.x1) / 2, cy = (area.y0 + area.y1) / 2;
    this.camGoal = this.clampXY(this.cam.x + (sx - cx) / this.Z, this.cam.y + (sy - cy) / this.Z);
  }

  bindInput() {
    const st = this.app.stage;
    // 滑鼠滾輪縮放（以游標位置為中心），鍵盤 + / - 也可以
    let wheelAcc = 0;
    this.app.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      wheelAcc += e.deltaY;
      if (Math.abs(wheelAcc) < 60) return;
      const r = this.app.canvas.getBoundingClientRect();
      this.setZoom(this.Z + (wheelAcc < 0 ? 1 : -1), [e.clientX - r.left, e.clientY - r.top]);
      wheelAcc = 0;
    }, { passive: false });
    addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return;
      if (e.key === '+' || e.key === '=') this.setZoom(this.Z + 1);
      else if (e.key === '-' || e.key === '_') this.setZoom(this.Z - 1);
    });
    st.on('pointerdown', (e) => { this.drag = { x: e.global.x, y: e.global.y, cx: this.cam.x, cy: this.cam.y, moved: false }; this.camGoal = null; });
    st.on('pointermove', (e) => {
      if (!this.drag) return;
      const dx = e.global.x - this.drag.x, dy = e.global.y - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) this.drag.moved = true;
      this.cam.x = this.drag.cx - dx / this.Z; this.cam.y = this.drag.cy - dy / this.Z;
      this.clampCam();
    });
    const up = () => { if (this.drag && !this.drag.moved) useGame.getState().select(null); this.drag = null; };
    st.on('pointerup', up); st.on('pointerupoutside', up);
    // 按住採集：放開前不論游標移到哪裡都持續點擊；放開後才打開建築面板，避免面板蓋住正在按的建築
    const release = () => {
      const v = this.pressed ? this.views.get(this.pressed) : null;
      if (v?.bid) { useGame.getState().select(v.bid); this.keepVisible(v); }
      this.pressed = null; this.hold = null;
    };
    addEventListener('pointerup', release);
    addEventListener('pointercancel', release);
    addEventListener('blur', () => { this.pressed = null; this.hold = null; });
  }

  // ── 建築 id：指揮艙格子顯示「目前最高級的指揮艙」，沒有的話顯示下一個要蓋的 ──
  siteBuilding(site: Site): string | null {
    const s = game.s;
    if (site.id !== 'command') return DEF[site.id].stage <= s.stage && !retired(s, site.id) ? site.id : null;
    const builtCmd = [...COMMAND_CHAIN].reverse().find((id) => built(s, id));
    return builtCmd ?? COMMAND_CHAIN[0];
  }

  sync() {
    const s = game.s;
    const gStage = Math.min(6, s.stage);
    const selected = useGame.getState().selected;
    // 地面（道路、地基、鋪面）只跟著已蓋好的建築與它們的鋪面等級變：蓋好一棟或升級時才重畫
    const gKey = `${gStage}|${this.groundRes()}|${this.mapSites().map((x) => `${x.id}:${x.tier}`).join(',')}`;
    if (gKey !== this.groundKey) { this.groundKey = gKey; this.buildMap(gStage); }
    // 地面解析度剛好等於縮放倍數時用最近鄰（最銳利），否則平滑取樣；縮放時只換取樣方式，不用重畫
    if (this.ground?.roads) this.ground.roads.texture.source.scaleMode = this.groundRes() === this.Z ? 'nearest' : 'linear';
    for (const site of SITES) {
      let bid = this.siteBuilding(site);
      const lvl = bid ? s.b[bid].level : 0;
      // 還沒蓋的建築不出現在地圖上；在建造列選取時才顯示半透明預覽（會蓋在這裡）
      const picked = !!bid && (selected === bid || (site.id === 'command' && !!selected && COMMAND_CHAIN.includes(selected)));
      if (bid && lvl === 0 && !picked) bid = null;
      const key = !bid ? 'none' : lvl > 0 ? `${artId(s, bid)}:${tierOf(lvl)}:${this.Z}` : `site:${bid}:${this.Z}`;
      let v = this.views.get(site.id);
      if (!v || v.key !== key) { if (v) this.dropView(v); v = this.makeView(site, bid, key) ?? undefined; if (v) this.views.set(site.id, v); else this.views.delete(site.id); }
      if (!v || !bid) continue;
      let text = lvl > 0 ? (DEF[bid].kind === 'command' || DEF[bid].maxLevel === 1 ? bName(bid) : `${bName(bid)} Lv${lvl}`) : t('sc.build', { b: bName(bid) });
      // 醫療艙（沒有醫療艙時是陸戰隊營區）名稱牌顯示室內休養的傷員人數
      if (lvl > 0 && (bid === 'med_bay' || (bid === 'security' && !built(s, 'med_bay')))) {
        const n = bid === 'med_bay' ? this.patientSplit().inside : Math.max(0, injuredCount(s) - this.defenders.filter((d) => d.patient).length);
        if (n > 0) text += ` ✚${n}`;
      }
      const dis = lvl > 0 && disabled(s, bid);
      const card = lvl > 0 && DEF[bid].clickable;
      const plateKey = card ? `card|${bid}|${this.Z}|${Math.min(6, s.stage)}|${lang()}` : `${text}|${dis}|${this.Z}`;
      if (!v.plate || (v.plate as any).k !== plateKey) {
        v.plate?.destroy({ children: true });
        v.plate = card ? this.makeCard(v) : this.makePlate(dis ? t('sc.stopped', { x: text }) : text, lvl > 0 ? (dis ? 'inset' : 'plate') : 'inset');
        (v.plate as any).k = plateKey; this.hud.addChild(v.plate);
      }
      (v.plate as any).refresh?.();
      if (v.building) v.building.sprite.tint = dis ? 0x6a6a74 : 0xffffff;
      if (v.sel) v.sel.visible = selected === bid || (site.id === 'command' && !!selected && COMMAND_CHAIN.includes(selected));
    }
    this.syncWorkers();
    this.syncRaid();
    this.syncPatrols();
  }

  groundKey = '';
  /** 地面解析度：跟著畫面縮放，最多 3 倍（再高的話記憶體和重畫時間划不來） */
  groundRes() { return clampN(this.Z, 2, 3); }
  /** 已蓋好的建築位置與它的道路／地基鋪面等級（0 沙路、1 金屬地磚、2 石磚）：
   *  整個殖民地一致，由軌道車線決定：還沒蓋時不畫路（小人走過留腳印）、蓋好鋪石磚、升級雙線運轉後換成金屬地磚 */
  mapSites() {
    const s = game.s;
    const out: (Site & { r: number; tier: number })[] = [];
    const paving = s.b.rail_line?.nodes.includes('double') ? 1 : built(s, 'rail_line') ? 2 : 0;
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      if (!bid || !built(s, bid)) continue;
      out.push({ ...site, r: site.r ?? 24, tier: paving });
    }
    return out;
  }
  buildMap(stage: number) {
    // 換章節或第一次蓋好中央營地時（工人的家與路線改變）才重建工人；其他時候只重畫地面
    const hubNow = this.mapSites().some((x) => x.hub);
    const resetWalkers = stage !== this.groundStage || hubNow !== this.groundHub;
    this.groundStage = stage; this.groundHub = hubNow;
    for (const p of this.props) { p.lights.destroy({ children: true }); p.destroy({ children: true }); }
    this.props = [];
    // 道路層的貼圖每次重畫都是新的，要一起釋放；手繪底圖共用，不釋放
    this.ground?.roads?.destroy(true);
    this.ground?.destroy({ children: true });
    this.ambient?.destroy({ children: true });
    const s = game.s;
    const sites = this.mapSites();
    // 還沒有中央營地時，路從逃生艙拉出去；有了之後從中央廣場連到各建築
    const hub = sites.some((x) => x.hub);
    const routes = hub ? ROUTES : Object.fromEntries(sites.filter((x) => !x.hub && x.id !== 'escape_pod').map((x) => [x.id, routeFromPod(x.id)]));
    const plan = planMap(stage, MW, MH, 90 + stage, { center: CENTER, sites, routes, plaza: hub, hubTier: sites.find((x) => x.hub)?.tier ?? 0, tiers: Object.fromEntries(sites.map((x) => [x.id, x.tier])) });
    void s;
    // 手繪底圖：裝飾物一律用第 1 章的配色（不再每章換一種風貌）
    const propStage = hasTerrain() ? 1 : stage;
    const ground = createGround(stage, plan, this.groundRes());
    ground.eventMode = 'none';
    this.ground = ground;
    this.world.addChildAt(ground, 0);
    this.world.addChildAt(this.shadowL, 1);
    this.shadowL.addChild(this.unitShadowG);
    this.shadowL.addChildAt(this.footG, 0);
    for (const p of plan.props) {
      const c = createProp(p.kind, propStage, p.seed);
      c.position.set(p.x, p.y); c.zIndex = p.y; c.lights.position.set(p.x, p.y);
      c.eventMode = 'none';
      this.obj.addChild(c); this.lightL.addChild(c.lights);
      this.props.push(c);
    }
    // 環境光：白色底，顏色由 dayLight() 用 tint 每幀調整（白天暖白、黃昏橘、夜晚藍、清晨淡紫）
    this.overlay.clear().rect(0, 0, MW, MH).fill(0xffffff);
    this.dayTint = hasTerrain() ? 0xfff2ea : STAGES[stage].ambient;
    this.overlay.blendMode = 'multiply';
    this.ambient = createAmbient(stage, MW, MH);
    this.lightL.addChild(this.ambient);
    if (resetWalkers) { for (const w of this.walkers) w.destroy({ children: true }); this.walkers = []; }
  }
  groundHub = false;

  makePlate(text: string, kind: string) {
    const Z = this.Z, fs = Z >= 3 ? 15 : Z >= 2 ? 12 : 10;
    const tx = new Text({ text, style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: fs, fontWeight: '700', fill: kind === 'plate' ? 0xfff8ec : 0xc9c3d6, stroke: { color: 0x120e18, width: fs >= 12 ? 3 : 2 } } });
    const w = Math.ceil(tx.width / Z) + 8;
    const c = new Container() as any;
    const bg = createPixelSprite(renderPanel(w, 11, Math.min(6, game.s.stage), kind));
    bg.scale.set(Z);
    tx.anchor.set(0.5); tx.position.set((w * Z) / 2, 5.5 * Z);
    c.addChild(bg, tx); c.pw = w; c.ph = 11;
    c.eventMode = 'none';
    return c as Container;
  }

  makeView(site: Site, bid: string | null, key: string): View | null {
    if (!bid) return null;
    const s = game.s;
    const v = new Container() as View;
    v.key = key; v.site = site; v.bid = bid;
    v.position.set(site.x, site.y); v.zIndex = site.y;
    const L = s.b[bid].level;
    const b: any = createBuilding(artId(s, bid), Math.max(1, L));
    v.building = L > 0 ? b : null;
    if (L > 0) {
      v.addChild(b);
      b.lights.position.set(site.x, site.y);
      this.lightL.addChild(b.lights);
      v.lights = b.lights;
      // 影子：建築本身的圖染成黑色、壓扁翻到地上，再依太陽方向斜切（只有手繪建築）
      if (b.art?.emissive) {
        const sh = new Sprite(b.sprite.texture);
        // 建築是斜上方視角畫的，地面接觸面從正面底邊往後延伸；影子從接觸面中間翻下去，才會貼著建築
        const fp = b.art.ay * SHADOW_FOOT;
        sh.anchor.set(b.sprite.anchor.x, (b.art.ay - fp) / b.art.h); sh.tint = 0x000000; sh.position.set(site.x, site.y - fp);
        (sh as any).base = b.sprite.scale.x;
        (sh as any).smask = shadowMask(b.art.canvas);
        // 小人影子那層要在建築影子之上
        this.shadowL.addChildAt(sh, Math.max(0, this.shadowL.children.length - 1)); v.shadow = sh;
      }
    } else {
      b.alpha = 0.35;
      b.sprite.tint = 0xb8c0d8;
      v.addChild(b);
      b.lights.destroy({ children: true });
      const sign = createProp('site', Math.min(6, s.stage), 3);
      sign.position.set(0, 6);
      sign.lights.destroy({ children: true });
      v.addChild(sign);
    }
    const w = b.art.w;
    v.hitArea = new Rectangle(-b.art.ax, -b.art.ay, w, b.art.h + 8);
    v.eventMode = 'static'; v.cursor = 'pointer';
    v.on('pointerdown', (e) => {
      e.stopPropagation();
      const id = v.bid!;
      this.pressed = site.id;
      void id;
    });
    v.on('pointerover', () => { this.hover = site.id; });
    v.on('pointerout', () => { if (this.hover === site.id) this.hover = null; });
    v.ring = createBuffRing(Math.round(w * 0.42) + 4, Math.round(w * 0.16) + 3);
    v.ring.position.set(site.x, site.y - 2); v.ring.visible = false;
    v.sel = createBuffRing(Math.round(w * 0.46) + 6, Math.round(w * 0.18) + 4, 0x9fe8ff);
    v.sel.position.set(site.x, site.y - 1); v.sel.visible = false;
    this.lightL.addChild(v.ring, v.sel);
    this.obj.addChild(v);
    return v;
  }
  dropView(v: View) {
    v.shadow?.destroy();
    v.lights?.destroy({ children: true });
    v.ring?.destroy(); v.sel?.destroy();
    v.plate?.destroy({ children: true });
    v.destroy({ children: true });
  }

  /** 浮在建築上方的採集卡。平常收合成一顆採集按鈕；滑鼠停留或選中時展開，多出工人 −／＋ 列 */
  makeCard(v: View) {
    const Z = this.Z, st = Math.min(6, game.s.stage), id = v.bid!, d = DEF[id];
    const res = (d.produce?.res ?? d.recipe!.out) as string;
    const fs = Z >= 3 ? 15 : Z >= 2 ? 12 : 10;
    const txt = (text: string, size: number, fill: number) => new Text({ text, style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: size, fontWeight: '900', fill, stroke: { color: 0x120e18, width: size >= 12 ? 3 : 2 } } });
    // 卡片寬度跟著最長的按鈕文字（英文資源名比中文長）
    const words = [resName(res), t('sc.halt'), t('sc.paused')];
    const textW = Math.max(...words.map((w) => { const m = txt(w, fs, 0); const n = m.width; m.destroy(); return n; })) / Z;
    const CW = Math.max(34, Math.ceil(textW) + 18), W = Math.max(52, Math.ceil(textW) + 24), H = 37, CH = 14;
    const c: any = new Container();
    const bg = createPixelSprite(renderPanel(W, H, st, 'panel')); bg.scale.set(Z);
    c.addChild(bg);
    // 採集按鈕（展開與收合各一張底圖）
    const btn: any = new Container();
    const texBig = pixelTexture(renderPanel(W - 6, 14, st, 'plate')), texSmall = pixelTexture(renderPanel(CW, CH, st, 'plate'));
    const face = new Sprite(texBig); face.scale.set(Z);
    const icon = createPixelSprite(renderIcon(res)); icon.scale.set(Z); icon.position.set(3 * Z, 1.5 * Z);
    const label = txt(resName(res), fs, 0xfff8ec); label.anchor.set(0.5);
    btn.addChild(face, icon, label);
    btn.eventMode = 'static'; btn.cursor = 'pointer';
    btn.on('pointerdown', (e: any) => {
      e.stopPropagation();
      if (!built(game.s, id)) return;
      this.doClick(v, [c.x + (c.pw / 2) * Z, c.y]);
      this.hold = { id: v.site.id, next: 0.2 };
    });
    c.addChild(btn);
    // 工人列（只在展開時顯示）
    const row = new Container();
    const wl = txt(t('bp.workers'), fs - 3, 0xc9c3d6); wl.anchor.set(0.5); wl.position.set((W / 2) * Z, 5 * Z);
    const minus = createPixelSprite(renderPanel(9, 9, st, 'button', '-')); minus.scale.set(Z); minus.position.set(4 * Z, 9 * Z);
    const plus = createPixelSprite(renderPanel(9, 9, st, 'button', '+')); plus.scale.set(Z); plus.position.set((W - 13) * Z, 9 * Z);
    const inset = createPixelSprite(renderPanel(W - 30, 9, st, 'inset')); inset.scale.set(Z); inset.position.set(15 * Z, 9 * Z);
    const cnt = txt('', fs - 2, 0xf4efe4); cnt.anchor.set(0.5); cnt.position.set((W / 2) * Z, 13.5 * Z);
    for (const [b, dlt] of [[minus, -1], [plus, 1]] as [any, number][]) {
      b.eventMode = 'static'; b.cursor = 'pointer';
      b.on('pointerdown', (e: any) => { e.stopPropagation(); useGame.getState().assign(id, dlt); sfx('assign'); });
    }
    row.addChild(wl, minus, inset, plus, cnt);
    c.addChild(row);
    c.eventMode = 'static';
    c.on('pointerover', () => { this.hover = v.site.id; });
    c.on('pointerout', () => { if (this.hover === v.site.id) this.hover = null; });
    let expanded: boolean | null = null, pressed = false;
    const layout = () => {
      // 展開時按鈕放在卡片底部，和收合時的位置對齊，游標下的按鈕不會跳走
      const by = expanded ? 21 : 0, bx = expanded ? 3 : 0;
      btn.position.set(bx * Z, (by + (pressed ? 1 : 0)) * Z);
      face.alpha = pressed ? 0.85 : 1;
    };
    c.setExpanded = (e: boolean) => {
      if (e === expanded) return;
      expanded = e;
      bg.visible = row.visible = e;
      face.texture = e ? texBig : texSmall;
      c.pw = e ? W : CW; c.ph = e ? H - 2 : CH;
      label.position.set(e ? ((W - 6) / 2 + 5) * Z : (CW / 2 + 5) * Z, 7 * Z);
      layout();
    };
    c.setPressed = (p: boolean) => { if (p !== pressed) { pressed = p; layout(); } };
    c.refresh = () => {
      const s = game.s, dis = disabled(s, id), buff = buffActive(s, id);
      cnt.text = `${s.b[id].workers}/${workerCap(s, id)}`;
      const paused = !!s.b[id].paused;
      label.text = dis ? t('sc.halt') : paused ? t('sc.paused') : resName(res);
      const tint = dis || paused ? 0x6a6a74 : 0xffffff;
      if (face.tint !== tint) { face.tint = tint; icon.tint = tint; }
      label.style.fill = dis ? 0xb0aabb : buff ? 0xffe08a : 0xfff8ec;
    };
    c.isCard = true;
    c.setExpanded(false);
    return c as Container;
  }

  doClick(v: View, at?: [number, number]) {
    const r = useGame.getState().click(v.bid!);
    if (!r) return;
    const b = v.building;
    const [sx, sy] = at ?? this.toScreen(v.x, v.y - b.art.ay + 4);
    const name = resName(r.res);
    sfx(r.amount <= 0 ? 'empty' : r.crit ? 'crit' : 'collect');
    if (r.amount > 0) this.fx.pop(sx, sy, `${r.crit ? t('sc.crit') + ' ' : ''}+${Math.round(r.amount * 10) / 10} ${name}`, RES[r.res].color, r.crit);
    else this.fx.pop(sx, sy, t('sc.noInput'), 0xc8c2d6, false);
    const [cx, cy] = this.toScreen(v.x, v.y - b.art.ay / 2);
    this.fx.burst(cx, cy, RES[r.res].color, r.crit ? 14 : 4);
    if (r.crit) b.flash();
  }

  /** 名稱牌與採集卡防重疊：優先度高的（展開中、採集卡）先放，其餘遇到重疊就往上錯開 */
  resolveLabels(items: { pl: any; x: number; y: number; w: number; h: number; prio: number }[]) {
    items.sort((a, b) => b.prio - a.prio || b.y - a.y);
    const placed: typeof items = [];
    const gap = 2;
    for (const it of items) {
      let y = it.y;
      for (let n = 0; n < 6; n++) {
        const hit = placed.find((p) => it.x < p.x + p.w + gap && it.x + it.w + gap > p.x && y < p.y + p.h + gap && y + it.h + gap > p.y);
        if (!hit) break;
        y = hit.y - it.h - gap;
      }
      it.y = y;
      it.pl.position.set(it.x, y);
      it.pl.zIndex = it.prio * 10000 + Math.round(it.y + it.h);
      placed.push(it);
    }
    this.hud.sortableChildren = true;
  }

  // ── 襲擊：預警期間異星生物從地圖邊緣走向殖民地，開打時消失並噴出碎片 ──
  syncRaid() {
    const inc = game.s.raid?.incoming;
    const key = inc ? `${inc.at}` : '';
    if (key === this.raidKey) return;
    this.raidKey = key;
    // 擊退時：有倒地動畫的（突擊隊、微光獸）播倒地、躺一下再淡出；打輸或沒有圖時照舊噴出碎片後消失
    const won = !!game.s.raid?.report?.won;
    for (const a of this.aliens) {
      if (a.die && won && !inc) { a.die(); a.fallT = 0; this.fallen.push(a); continue; }
      const [x, y] = this.toScreen(a.x, a.y - 5);
      this.fx.burst(x, y, a.commando ? 0x9aa4b4 : 0xb04a8a, 6);
      a.destroy({ children: true });
    }
    this.aliens = [];
    // 戰鬥結束：陸戰隊員走回營區，場上的彈道清掉
    this.shots = []; this.beams = [];
    const hurt = game.s.raid?.report?.injured ?? 0;
    this.defenders.forEach((d, i) => {
      d.from = { x: d.x, y: d.y }; d.back = 0;
      d.patient = i < hurt;
      d.to = d.patient ? this.clinicDoor() : this.nearestPatrol(d.x, d.y);
      d.path = pathBetween(d.from, d.to);
      // 回程用走的速度（約每秒 22 像素）
      d.backDur = Math.max(3, d.path.slice(1).reduce((acc: number, q: any, k: number) => acc + Math.hypot(q.x - d.path[k].x, q.y - d.path[k].y), 0) / 22);
    });
    if (!inc) return;
    const side = inc.side % RAID_SPAWN.length, from = RAID_SPAWN[side], to = RAID_RALLY[side];
    const n = Math.min(18, inc.enemies);
    for (let i = 0; i < n; i++) {
      const a: any = inc.kind === 'commando' ? createCommando() : createAlien();
      a.eventMode = 'none';
      // 起點在地圖外，終點是邊緣內側的集結點；兩者都錯開一點，讓群體看起來散開
      const jx = (Math.random() - 0.5) * (side < 2 ? 30 : 110), jy = (Math.random() - 0.5) * (side < 2 ? 110 : 26);
      a.from = { x: from.x + jx, y: from.y + jy };
      a.to = { x: to.x + jx * 0.8, y: to.y + jy * 0.8 };
      a.lag = Math.random() * 0.15;
      // 掠奪者偏橘褐、企業突擊隊偏鋼藍，和異星生物區分
      if (inc.kind === 'raider') a.tint = 0xe0b080;
      a.position.set(a.from.x, a.from.y);
      this.obj.addChild(a);
      this.aliens.push(a);
    }
    this.spawnDefenders(side);
  }
  /** 可參戰的陸戰隊員從營區出發，走到敵人集結點與殖民地之間的防線 */
  spawnDefenders(side: number) {
    for (const d of this.defenders) d.destroy({ children: true });
    this.defenders = [];
    const s = game.s, df = defense(s);
    const site = SITES.find((x) => x.id === 'security');
    if (!site || !built(s, 'security')) return;
    // 從巡邏中的位置直接出發
    const starts = this.patrols.map((m) => ({ x: m.x, y: m.y }));
    const rally = RAID_RALLY[side];
    const vx = CENTER.x - rally.x, vy = CENTER.y - rally.y, len = Math.hypot(vx, vy) || 1;
    const ux = vx / len, uy = vy / len, px = -uy, py = ux;
    const n = Math.min(10, df.ready);
    for (let i = 0; i < n; i++) {
      const m: any = createMarine(i < df.armedReady);
      m.armed = i < df.armedReady;
      m.eventMode = 'none';
      const spread = (i - (n - 1) / 2) * 12, depth = 46 + (i % 2) * 10;
      m.home = { x: site.x + (Math.random() - 0.5) * 20, y: site.y + 8 };
      m.from = starts[i] ?? m.home;
      m.to = { x: rally.x + ux * depth + px * spread, y: rally.y + uy * depth + py * spread * 0.6 };
      m.lag = Math.random() * 0.1;
      m.path = pathBetween(m.from, m.to);
      m.position.set(m.from.x, m.from.y);
      this.obj.addChild(m);
      this.defenders.push(m);
    }
  }
  moveDefenders(dt: number) {
    const inc = game.s.raid?.incoming;
    const p0 = inc ? 1 - (inc.at - game.s.t) / WARNING : 1;
    for (const d of [...this.defenders]) {
      let p: number;
      if (d.back != null) {
        d.back += dt / (d.backDur ?? 5);
        p = Math.min(1, d.back);
        if (p >= 1) { this.defenders.splice(this.defenders.indexOf(d), 1); d.destroy({ children: true }); this.patrolKey = ''; this.syncPatrols(); continue; }
      } else p = Math.max(0, Math.min(1, (p0 - 0.05 - d.lag) / 0.5));
      // 沿著繞開建築的路線走
      const q = along(d.path, p), x = q.x, y = q.y;
      const moving = p > 0 && p < 1;
      // 到了防線就面向敵人
      const target = this.aliens.length ? this.raidCenter()! : d.to;
      d.setDir(moving ? q.dir : Math.sign(target.x - x) || 1);
      d.setMoving(moving);
      d.position.set(this.snap(x), this.snap(y)); d.zIndex = y;
      d.update(this.T, dt);
    }
    // 雙方都就位後交火：陸戰隊點放子彈、砲塔打雷射、微光獸吐晶球（仿 RimWorld 的曳光彈，會有落空）
    if (inc && p0 > 0.72 && this.defenders.length && this.aliens.length) this.skirmish(dt);
  }
  /** 交火：每位陸戰隊員各自冷卻，持槍的一次點放 3 發；砲塔每隔一段時間打一道雷射；微光獸偶爾吐晶球 */
  skirmish(dt: number) {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    for (const d of this.defenders) {
      if (d.back != null) continue;
      d.cd = (d.cd ?? Math.random() * 1.2) - dt;
      if (d.cd > 0) continue;
      if (!d.burstLeft) { d.burstLeft = d.armed ? 3 : 1; d.target = pick(this.aliens); }
      const a = d.target;
      if (!a || a.destroyed) { d.burstLeft = 0; continue; }
      d.burstLeft--;
      d.cd = d.burstLeft ? 0.09 : 0.9 + Math.random() * 0.9;
      d.fire();
      const dir = a.x >= d.x ? 1 : -1;
      this.shoot(d.x + dir * 8, d.y - 7, a.x, a.y - 5, a, 'bullet', d.armed ? 0.2 : 0.4);
      sfx('shot');
    }
    const s = game.s;
    if (built(s, 'turret')) {
      this.turretCd -= dt;
      if (this.turretCd <= 0) {
        this.turretCd = 1.1 / Math.max(1, s.b.turret.level) + Math.random() * 0.4;
        const site = SITES.find((x) => x.id === 'turret')!, a = pick(this.aliens);
        this.beams.push({ x1: site.x + 2, y1: site.y - 24, x2: a.x, y2: a.y - 5, t: 0 });
        sfx('laser');
        this.hitAlien(a, 0x7fe8ff);
      }
    }
    for (const a of this.aliens) {
      a.cd = (a.cd ?? 1 + Math.random() * 2) - dt;
      if (a.cd > 0) continue;
      a.cd = 1.6 + Math.random() * 1.6;
      const d = pick(this.defenders.filter((x) => x.back == null));
      if (!d) continue;
      // 突擊隊：舉槍點放，打曳光彈；微光獸吐晶球
      if (a.commando) {
        const dir = d.x >= a.x ? 1 : -1;
        a.setDir(dir); a.fire();
        this.shoot(a.x + dir * 9, a.y - 9, d.x, d.y - 6, d, 'bullet', 0.35); sfx('shot');
      } else {
        // 微光獸吐紫色晶球
        a.setDir(d.x >= a.x ? 1 : -1); a.fire?.();
        this.shoot(a.x, a.y - 6, d.x, d.y - 6, d, 'spit', 0.3); sfx('spit');
      }
    }
  }
  /** 發射一發彈道；miss 是落空機率，落空時子彈從目標旁邊飛過去 */
  shoot(x: number, y: number, tx: number, ty: number, target: any, kind: 'bullet' | 'spit', miss: number) {
    const hit = Math.random() >= miss;
    if (!hit) { tx += (Math.random() - 0.5) * 26; ty += (Math.random() - 0.5) * 14; }
    const dx = tx - x, dy = ty - y, len = Math.hypot(dx, dy) || 1, speed = kind === 'bullet' ? 300 : 110;
    // 落空的子彈多飛一段才消失
    const life = (len + (hit ? 0 : 30)) / speed;
    this.shots.push({ x, y, vx: (dx / len) * speed, vy: (dy / len) * speed, t: 0, life, kind, hit: hit ? target : null, tx, ty });
  }
  hitAlien(a: any, color: number) {
    if (!a || a.destroyed) return;
    a.hitT = 0.12;
    a.hurt?.();
    const [x, y] = this.toScreen(a.x, a.y - 5);
    this.fx.burst(x, y, color, 3);
  }
  /** 每幀更新彈道與雷射，全部畫在同一個 Graphics 上 */
  drawShots(dt: number) {
    const g = this.shotG;
    g.clear();
    for (const sh of [...this.shots]) {
      sh.t += dt;
      if (sh.t >= sh.life) {
        this.shots.splice(this.shots.indexOf(sh), 1);
        if (sh.hit && !sh.hit.destroyed) {
          if (sh.kind === 'bullet') this.hitAlien(sh.hit, 0xffe08a);
          else { sh.hit.hitT = 0.12; const [x, y] = this.toScreen(sh.tx, sh.ty); this.fx.burst(x, y, 0xc98aff, 3); }
        }
        continue;
      }
      const x = sh.x + sh.vx * sh.t, y = sh.y + sh.vy * sh.t;
      if (sh.kind === 'bullet') {
        // 曳光彈：一小段亮線，尾巴往回拖
        const k = 9 / Math.hypot(sh.vx, sh.vy);
        g.moveTo(x - sh.vx * k, y - sh.vy * k).lineTo(x, y).stroke({ color: 0xffb347, width: 2, alpha: 0.35 });
        g.moveTo(x - sh.vx * k * 0.6, y - sh.vy * k * 0.6).lineTo(x, y).stroke({ color: 0xfff6c0, width: 1 });
      } else {
        // 晶球：紫色小光團，走拋物線
        const p = sh.t / sh.life, lift = Math.sin(p * Math.PI) * 10;
        g.rect(Math.round(x) - 2, Math.round(y - lift) - 2, 4, 4).fill({ color: 0xa04dff, alpha: 0.35 });
        g.rect(Math.round(x) - 1, Math.round(y - lift) - 1, 2, 2).fill({ color: 0xe6c8ff });
      }
    }
    for (const b of [...this.beams]) {
      b.t += dt;
      if (b.t > 0.22) { this.beams.splice(this.beams.indexOf(b), 1); continue; }
      const a = 1 - b.t / 0.22;
      g.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ color: 0x7fe8ff, width: 2, alpha: 0.35 * a });
      g.moveTo(b.x1, b.y1).lineTo(b.x2, b.y2).stroke({ color: 0xe8ffff, width: 1, alpha: a });
    }
    // 結局：軌道信標點亮後，一道光束直上天際
    const bv = [...this.views.values()].find((v) => v.bid === 'orbital_beacon');
    if (game.s.finished && bv?.building) {
      const top = bv.y - bv.building.art.ay + 6, a = 0.55 + 0.25 * Math.sin(this.T * 3);
      g.rect(bv.x - 4, top - 600, 8, 600).fill({ color: 0x7fd8ff, alpha: 0.18 * a });
      g.rect(bv.x - 2, top - 600, 4, 600).fill({ color: 0x9fe8ff, alpha: 0.45 * a });
      g.rect(bv.x - 1, top - 600, 2, 600).fill({ color: 0xffffff, alpha: 0.9 * a });
    }
    // 被打中的單位閃一下（半透明）
    for (const u of [...this.aliens, ...this.defenders]) {
      if (u.hitT > 0) { u.hitT -= dt; u.alpha = 0.55; } else u.alpha = 1;
    }
  }
  /** 傷員去的地方：有醫療艙就去醫療艙，否則回營區 */
  clinicDoor() {
    const id = built(game.s, 'med_bay') ? 'med_bay' : 'security';
    const site = SITES.find((x) => x.id === id)!;
    return { x: site.x, y: site.y + 10 };
  }
  nearestPatrol(x: number, y: number) {
    let best = PATROL[0], bd = Infinity;
    for (const p of PATROL) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  /** 巡邏隊與傷員的人數跟著遊戲狀態走；襲擊期間巡邏隊改由 defenders 表現 */
  syncPatrols() {
    const s = game.s;
    const fighting = !!s.raid?.incoming || this.defenders.length > 0;
    const df = built(s, 'security') ? defense(s) : null;
    const n = !df || fighting ? 0 : Math.min(8, df.ready), armed = df ? Math.min(n, df.armedReady) : 0;
    const walkingHurt = this.defenders.filter((d) => d.patient).length;
    // 傷員進醫療艙躺病床；病床不夠的在門口排隊。沒有醫療艙時陸戰隊員在營區、殖民者在家休養（都在室內）
    const { waiting } = this.patientSplit(walkingHurt);
    const key = `${n}|${armed}|${waiting.marines}|${waiting.civ}`;
    if (key === this.patrolKey) return;
    this.patrolKey = key;
    for (const m of [...this.patrols, ...this.patients]) m.destroy({ children: true });
    this.patrols = []; this.patients = [];
    const phase = Math.random() * PATROL_TOTAL;
    for (let i = 0; i < n; i++) {
      const m: any = createMarine(i < armed);
      m.eventMode = 'none';
      m.offset = phase + (i * PATROL_TOTAL) / n;
      this.obj.addChild(m);
      this.patrols.push(m);
    }
    // 門口排隊：從門的右邊排出去
    const door = this.clinicDoor();
    const queue = [...Array(waiting.marines).fill('m'), ...Array(waiting.civ).fill('c')].slice(0, 6);
    queue.forEach((kind, i) => {
      const u: any = kind === 'm' ? createMarine(false) : createWorker(Math.min(6, s.stage));
      u.eventMode = 'none';
      u.tint = 0xffc4c4; u.alpha = 0.9;
      u.position.set(Math.round(door.x + 16 + i * 9), Math.round(door.y + 4 + (i % 2) * 2));
      u.zIndex = u.y;
      u.setDir(-1); u.update(0, 0);
      this.obj.addChild(u);
      this.patients.push(u);
    });
  }
  /** 傷員分配：醫療艙病床上幾人（在室內）、門口排隊幾人 */
  patientSplit(walkingHurt = this.defenders.filter((d) => d.patient).length) {
    const s = game.s;
    const marines = built(s, 'security') ? Math.max(0, injuredCount(s) - walkingHurt) : 0;
    const civ = s.raid?.hurt?.length ?? 0;
    if (!built(s, 'med_bay')) return { inside: marines + civ, waiting: { marines: 0, civ: 0 } };
    const beds = medBeds(s);
    const mIn = Math.min(marines, beds), cIn = Math.min(civ, beds - mIn);
    return { inside: mIn + cIn, waiting: { marines: marines - mIn, civ: civ - cIn } };
  }
  movePatrols(dt: number) {
    for (const m of this.patrols) {
      const p = patrolAt(m.offset + this.T * 11);
      m.position.set(this.snap(p.x), this.snap(p.y)); m.zIndex = p.y;
      m.setDir(p.dir); m.setMoving(true);
      m.update(this.T, dt);
    }
  }
  /** 敵群目前的中心（地圖座標） */
  raidCenter() {
    if (!this.aliens.length) return null;
    let x = 0, y = 0;
    for (const a of this.aliens) { x += a.x; y += a.y; }
    return { x: x / this.aliens.length, y: y / this.aliens.length };
  }
  lookAtRaid() {
    if (!this.aliens.length) return;
    // 鏡頭對準集結點（敵群最後會停在那裡），邊走邊看得到牠們接近
    const c = { x: 0, y: 0 };
    for (const a of this.aliens) { c.x += a.to.x / this.aliens.length; c.y += a.to.y / this.aliens.length; }
    this.camGoal = this.clampXY(c.x - this.app.screen.width / this.Z / 2, c.y - this.app.screen.height / this.Z / 2);
  }
  /** 敵群在畫面外時，在畫面邊緣顯示指向牠們的紅色箭頭與數量；點擊就把鏡頭移過去 */
  updateRaidMark() {
    const c = this.raidCenter(), inc = game.s.raid?.incoming;
    if (!c || !inc) { if (this.raidMark) this.raidMark.visible = false; return; }
    if (!this.raidMark) {
      const m: any = new Container();
      const g = new Graphics();
      g.circle(0, 0, 17).fill({ color: 0x2a0d14 }).stroke({ color: 0xff5a5a, width: 3 });
      g.poly([22, 0, 12, -8, 12, 8]).fill({ color: 0xff5a5a });
      const tx = new Text({ text: '', style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: 14, fontWeight: '900', fill: 0xffd0d0 } });
      tx.anchor.set(0.5);
      m.addChild(g, tx); m.arrow = g; m.label = tx;
      m.eventMode = 'static'; m.cursor = 'pointer';
      m.on('pointerdown', (e: any) => { e.stopPropagation(); this.lookAtRaid(); });
      m.zIndex = 1e6;
      this.hud.addChild(m);
      this.raidMark = m;
    }
    const m = this.raidMark, W = this.app.screen.width, H = this.app.screen.height;
    const [sx, sy] = this.toScreen(c.x, c.y - 6);
    const pad = 40, top = 110, bottom = 110;
    const off = sx < 0 || sx > W || sy < top - 40 || sy > H - bottom + 40;
    m.visible = off;
    if (!off) return;
    const cx = W / 2, cy = H / 2, dx = sx - cx, dy = sy - cy;
    // 從畫面中心往敵群方向射線，停在畫面邊框內側
    const k = Math.min(Math.abs((W / 2 - pad) / (dx || 1e-6)), Math.abs((H / 2 - (dy < 0 ? top : bottom)) / (dy || 1e-6)));
    m.position.set(Math.round(cx + dx * k), Math.round(cy + dy * k));
    m.arrow.rotation = Math.atan2(dy, dx);
    m.label.text = String(inc.enemies);
    const pulse = 1 + 0.08 * Math.sin(this.T * 8);
    m.scale.set(pulse);
  }
  /** 位置完全由倒數決定：預警開始在地圖外，倒數結束剛好抵達集結點 */
  moveAliens(dt: number) {
    // 倒地的突擊隊、微光獸：0.6 秒倒下、躺 2.5 秒、1 秒淡出
    for (const a of [...this.fallen]) {
      a.fallT += dt;
      a.update(this.T, false);
      a.alpha = a.fallT < 3.1 ? 1 : Math.max(0, 1 - (a.fallT - 3.1));
      if (a.fallT > 4.1) { this.fallen.splice(this.fallen.indexOf(a), 1); a.destroy({ children: true }); }
    }
    const inc = game.s.raid?.incoming;
    if (!inc) return;
    const p0 = 1 - (inc.at - game.s.t) / WARNING;
    for (const a of this.aliens) {
      const p = Math.max(0, Math.min(1, (p0 - a.lag) / (1 - a.lag)));
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const x = a.from.x + (a.to.x - a.from.x) * e, y = a.from.y + (a.to.y - a.from.y) * e;
      a.setDir(Math.sign(a.to.x - a.from.x) || 1);
      a.position.set(this.snap(x), this.snap(y)); a.zIndex = y;
      a.update(this.T, p < 1);
    }
  }

  // ── 工人：每棟建築依指派人數顯示走動的殖民者，閒置的在中央廣場附近閒晃 ──
  syncWorkers() {
    const s = game.s;
    // 緊急營地建成的那一刻，大家的家從逃生艙搬到營地：重新產生工人
    const camp = built(s, 'emergency_camp');
    if (camp !== this.walkCamp) {
      this.walkCamp = camp;
      for (const w of this.walkers) w.destroy({ children: true });
      this.walkers = [];
    }
    // 地圖上的小人是「代表」：人口 10 以內全部畫出來，超過後每多 10 人才多畫 1 個（30 人 12 個、90 人 18 個），
    // 人少一點，作息與聊天才看得清楚，也比較省效能。名額先讓每個有工人的建築至少 1 個，其餘按人數多的分，每棟最多 5 個
    const raw: [string, number][] = [];
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      // 陸戰隊由巡邏與迎戰顯示，不在這裡
      if (bid && bid !== 'security' && built(s, bid) && s.b[bid].workers > 0) raw.push([bid, s.b[bid].workers]);
    }
    raw.push(['__idle', Math.max(0, idle(s))]);
    const want = new Map<string, number>(raw.map(([k]) => [k, 0]));
    const people = raw.reduce((n, [, v]) => n + v, 0);
    let budget = Math.min(people, walkerBudget(s.pop));
    const order = raw.filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
    for (const [k] of order) { if (budget <= 0) break; want.set(k, 1); budget--; }
    while (budget > 0) {
      let best: string | null = null, score = 0;
      for (const [k, v] of order) { const n = want.get(k)!; if (n < Math.min(5, v) && v / (n + 1) > score) { score = v / (n + 1); best = k; } }
      if (!best) break;
      want.set(best, want.get(best)! + 1); budget--;
    }
    const have = new Map<string, Walker[]>();
    for (const w of this.walkers) { const k = w.ai.bid ?? '__idle'; if (!have.has(k)) have.set(k, []); have.get(k)!.push(w); }
    for (const [k, list] of have) {
      const n = want.get(k) ?? 0;
      for (const w of list.slice(n)) { this.walkers.splice(this.walkers.indexOf(w), 1); w.destroy({ children: true }); }
    }
    for (const [k, n] of want) {
      const cur = have.get(k)?.length ?? 0;
      for (let i = cur; i < n; i++) this.addWalker(k === '__idle' ? null : k);
    }
  }
  addWalker(bid: string | null) {
    const w = (bid === 'security' ? createMarine(true) : createWorker(Math.min(6, game.s.stage))) as Walker;
    const j = () => Math.round((Math.random() - 0.5) * 18);
    const site = bid ? SITES.find((x) => x.id === bid || (x.id === 'command' && COMMAND_CHAIN.includes(bid)))! : null;
    // 還沒有緊急營地時以逃生艙為家，資源搬回逃生艙
    const camp = built(game.s, 'emergency_camp');
    const home = camp ? HOME : POD_DOOR;
    // 沿著道路走（中間的轉折點），不直線穿過其他建築
    const path = site ? (camp ? ROUTES[site.id] : routeFromPod(site.id)) : null;
    // 轉角點只偏 1～2 像素，走的時候不會踩出路面
    const via = path ? path.slice(1, -1).map((p) => ({ x: p.x + (j() >> 3), y: p.y + (j() >> 4) })) : [];
    w.ai = bid
      ? { bid, phase: 'out', via, queue: [...via], wait: Math.random() * 2, home: { x: home.x + j(), y: home.y + (j() >> 2) }, site: { x: site!.x + (j() >> 1), y: site!.y + 6 } }
      : { bid: null, wait: Math.random() * 2, home: { x: home.x + j() * 2, y: home.y + (j() >> 1) } };
    w.ai.target = w.ai.queue?.length ? w.ai.queue.shift() : w.ai.site ?? w.ai.home;
    w.px = w.ai.home.x; w.py = w.ai.home.y;
    w.position.set(w.px, w.py);
    w.eventMode = 'none';
    this.obj.addChild(w);
    this.walkers.push(w);
  }
  /** 會走動的小人對齊「螢幕像素」而不是美術像素：放大 3 倍時每次只移動 1 個螢幕像素，斜走才不會一頓一頓 */
  snap(v: number) { return Math.round(v * this.Z) / this.Z; }
  moveWalker(w: Walker, dt: number) {
    const a = w.ai;
    // 走在石磚、金屬路上才會加速
    const speed = this.ground?.paved?.(w.px, w.py) ? 24 : 16;
    a.jit ??= Math.random() * 0.03;
    const ph = this.schedule(a.jit);
    if (ph !== 'work') {
      this.offDuty(w, ph, dt, speed);
      w.position.set(this.snap(w.px), this.snap(w.py)); w.zIndex = w.py; w.update(this.T);
      return;
    }
    if (a.off) {
      a.chatting = false; a.meal = undefined;
      // 回到白天：從家門口出來，先走回自己的家，接著照常上工
      a.off = null; w.visible = true; w.alpha = 1;
      a.queue = this.roadPath({ x: w.px, y: w.py }, null, a.home); a.target = a.queue.shift() ?? a.home; a.wait = Math.random() * 1.5;
    }
    if (a.wait > 0) {
      a.wait -= dt; w.setMoving(false); w.setWork?.(!!a.working);
      // 進建築：前 0.3 秒淡出、最後 0.3 秒淡入
      if (a.inside > 0) { const el = a.inside - a.wait; w.alpha = Math.max(0, Math.min(1, Math.max(1 - el / 0.3, 1 - a.wait / 0.3))); if (a.wait <= 0) { a.inside = 0; w.alpha = 1; } }
      // 在建築旁工作完，扛著產出走回家
      if (a.wait <= 0 && a.working) {
        a.working = false; w.setWork?.(false);
        const d = DEF[a.bid];
        const res = d.produce?.res ?? d.recipe?.out;
        w.setCarry(res ? RES[res].color : null);
      }
    }
    else {
      const dx = a.target.x - w.px, dy = a.target.y - w.py, d = Math.hypot(dx, dy);
      if (d < 1 && a.queue?.length) a.target = a.queue.shift();
      else if (d < 1) {
        if (!a.bid) {
          a.wait = 1 + Math.random() * 3;
          // 閒置的人在廣場附近晃；鋪了路之後落腳點要在路面上
          const q = { x: a.home.x + (Math.random() - 0.5) * 50, y: a.home.y + (Math.random() - 0.5) * 12 };
          a.target = !built(game.s, 'rail_line') || this.ground?.paved?.(q.x, q.y) ? q : { x: w.px, y: w.py };
        }
        else if (a.target === a.site) {
          a.queue = [...a.via].reverse(); a.queue.push(a.home); a.target = a.queue.shift(); a.wait = 2.5 + Math.random() * 2; a.working = true;
          // 一半的機會走進建築裡做事（淡出），做完再出來
          a.inside = Math.random() < 0.5 ? a.wait : 0;
        } else { a.queue = [...a.via, a.site]; a.target = a.queue.shift(); a.wait = 0.4; w.setCarry(null); }
      } else {
        const st = Math.min(d, speed * dt);
        w.px += (dx / d) * st; w.py += (dy / d) * st;
        w.setMoving(true); w.setDir(Math.sign(dx) || 1);
      }
    }
    w.position.set(this.snap(w.px), this.snap(w.py));
    w.zIndex = w.py;
    w.update(this.T);
  }

  /** 日夜（純畫面，不影響數值）：畫面上的一天 5 分鐘，跟著遊戲時間走（暫停時也停） */
  dayTint = 0xfff2ea;
  /** 對話泡泡（傍晚在休閒艙前聊天時冒出來） */
  bubbles: { s: Sprite; w: any; t: number }[] = [];
  addBubble(w: any) {
    // 附近已經有泡泡就不冒，避免疊在一起
    if (this.bubbles.some((b) => !b.w.destroyed && Math.abs(b.w.x - w.x) < 16 && Math.abs(b.w.y - w.y) < 12)) return;
    const s = new Sprite(bubbleTexture(Math.floor(Math.random() * BUBBLE_ICONS.length)));
    s.anchor.set(0.5, 1); s.eventMode = 'none'; s.zIndex = 1e6;
    this.obj.addChild(s);
    this.bubbles.push({ s, w, t: 0 });
  }
  /** 泡泡跟著說話的人，往上飄一點，2.2 秒後淡出 */
  moveBubbles(dt: number) {
    for (const b of [...this.bubbles]) {
      b.t += dt;
      const gone = b.t > 2.2 || b.w.destroyed || !b.w.visible || !b.w.ai?.chatting;
      if (gone) { b.s.alpha -= dt * 4; if (b.s.alpha <= 0) { b.s.destroy(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; } }
      else b.s.alpha = Math.min(1, b.t * 5);
      if (!b.w.destroyed) b.s.position.set(this.snap(b.w.x + 4), this.snap(b.w.y - 17 - Math.min(2, b.t * 2)));
    }
  }
  /** 一天裡的時間比例（0～1）；作息用 */
  dayP = 0.2;
  visT: number | null = null;
  visDt = 0;
  /** 作息（純畫面）：白天工作、傍晚去休閒艙、晚上回生活艙睡覺、清晨出門。jit 讓每個人出發時間錯開 */
  schedule(jit: number): 'work' | 'evening' | 'night' {
    const p = (this.dayP - jit + 1) % 1;
    return p < 0.6 ? 'work' : p < 0.71 ? 'evening' : p < 0.95 ? 'night' : 'work';
  }
  /** 鋪好路（軌道車線蓋好）之後，殖民者沿著道路走：從目前位置投影到最近的路段，沿那條路走回中央廣場，
   *  再沿目的地建築的路走過去。還沒鋪路時直接繞開建築走（沙地上留腳印）。toSite 為 null 時走回廣場（家） */
  roadPath(from: { x: number; y: number }, toSite: string | null, end: { x: number; y: number }) {
    if (!built(game.s, 'rail_line')) return [...pathBetween(from, end).slice(1)];
    let best = { d: Infinity, k: '', i: 0, p: from };
    for (const [k, r] of Object.entries(ROUTES)) for (let i = 1; i < r.length; i++) {
      const a = r[i - 1], b = r[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
      const t = clampN(((from.x - a.x) * dx + (from.y - a.y) * dy) / l2, 0, 1), p = { x: a.x + dx * t, y: a.y + dy * t };
      const d = Math.hypot(from.x - p.x, from.y - p.y);
      if (d < best.d) best = { d, k, i, p };
    }
    const out: { x: number; y: number }[] = [best.p];
    if (toSite && best.k === toSite) { out.push(...ROUTES[toSite].slice(best.i)); }
    else {
      out.push(...ROUTES[best.k].slice(0, best.i).reverse());   // 走回廣場
      if (toSite && ROUTES[toSite]) out.push(...ROUTES[toSite].slice(1));
    }
    out.push(end);
    return out;
  }
  /** 作息的目的地：傍晚去休閒艙（沒有就回中央廣場），晚上回生活艙（沒有就回營地或逃生艙） */
  offDutySpot(kind: 'evening' | 'night'): { x: number; y: number } {
    // 建築正前方再往外一點（不要擠在牆上）
    const s = game.s, at = (id: string) => { const q = SITES.find((x) => x.id === id)!; return { x: q.x, y: q.y + 12 }; };
    const camp = built(s, 'emergency_camp');
    if (kind === 'evening' && built(s, 'lounge')) return at('lounge');
    if (kind === 'night' && built(s, 'hab_pod')) return at('hab_pod');
    return camp ? HOME : POD_DOOR;
  }
  /** 下班時間的移動：沿著繞開建築的路走到目的地；傍晚在休閒艙附近閒晃，晚上進門（看不見）；回到白天就走回家再照常上工 */
  offDuty(w: Walker, kind: 'evening' | 'night', dt: number, speed: number) {
    const a = w.ai;
    if (a.off !== kind) {
      const prevDoor = a.off === 'evening' && kind === 'night' && a.meal != null && a.meal <= 0 ? a.door : null;
      a.off = kind; a.offAt = this.offDutySpot(kind); a.meal = undefined; a.chatting = false; a.inside = 0;
      const j = () => (Math.random() - 0.5) * 16;
      // 門口：建築正面底邊中央（休閒艙吃飯、生活艙睡覺都從這裡進出）
      a.door = { x: a.offAt.x + j() * 0.15, y: a.offAt.y - 10 };
      // 傍晚吃完飯在休閒艙前散開成幾小群；鋪了路之後只在建築前的地坪上（不踩沙地）
      // 吃完飯在休閒艙門前散開成幾小群：鋪了路、門正前方有路面就站在路面上；
      // 門前沒有路面（只有旁邊的路）就站在門前空地，不然大家會擠在門口或在旁邊的路上排成一列
      if (kind === 'evening') {
        const base = a.offAt, pv = this.ground?.paved;
        let q = { x: base.x + (Math.random() - 0.5) * 70, y: base.y + Math.random() * 18 };
        if (built(game.s, 'rail_line') && pv) for (let i = 0; i < 20; i++) { const c = { x: base.x + (Math.random() - 0.5) * 36, y: base.y + Math.random() * 6 }; if (pv(c.x, c.y)) { q = c; break; } }
        a.offAt = q;
      } else a.offAt = a.door;
      const dest = kind === 'evening' ? (built(game.s, 'lounge') ? 'lounge' : null) : (built(game.s, 'hab_pod') ? 'hab_pod' : null);
      // 從休閒艙門前的空地回家：先走回休閒艙門口再上路，不要斜穿沙地去找最近的路
      const from = prevDoor ?? { x: w.px, y: w.py };
      a.offPath = this.roadPath(from, dest, a.door);
      if (prevDoor) a.offPath.unshift(prevDoor);
      a.offPath.push(a.door);
      a.working = false; w.setWork?.(false); w.setCarry(null);
      w.visible = true; w.alpha = 1;
    }
    const tgt = a.offPath[0];
    if (tgt) {
      const dx = tgt.x - w.px, dy = tgt.y - w.py, d = Math.hypot(dx, dy);
      if (d < 1) a.offPath.shift();
      else { const st = Math.min(d, speed * dt); w.px += (dx / d) * st; w.py += (dy / d) * st; w.setMoving(true); w.setDir(Math.sign(dx) || 1); }
    } else if (kind === 'night') {
      // 到家：淡出（進門睡覺）
      w.setMoving(false); w.alpha = Math.max(0, w.alpha - dt * 2); if (w.alpha <= 0) w.visible = false;
    } else {
      // 傍晚：先進休閒艙吃飯（淡出 8～14 秒），再出來在門前聊天（閒晃＋對話泡泡）
      w.setMoving(false);
      a.meal ??= 8 + Math.random() * 6;
      if (a.meal > 0) {
        // 在門口淡出進去吃飯；吃完在門口淡入，再走到門前空地聊天
        a.meal -= dt;
        w.alpha = a.meal > 0.3 ? Math.max(0, w.alpha - dt * 3) : Math.min(1, w.alpha + dt * 3);
        w.visible = w.alpha > 0.01 || a.meal <= 0.3;
        if (a.meal <= 0) { w.alpha = 1; w.visible = true; a.offPath = [a.offAt]; a.offWait = 2 + Math.random() * 3; }
        return;
      }
      a.chatting = true;
      a.offWait = (a.offWait ?? 0) - dt;
      if (a.offWait <= 0) {
        a.offWait = 2 + Math.random() * 4;
        const q = { x: a.offAt.x + (Math.random() - 0.5) * 16, y: a.offAt.y + (Math.random() - 0.5) * 4 };
        // 站在廣場上的只在路面上走動；站在空地上的就在附近走動
        const onRoad = built(game.s, 'rail_line') && this.ground?.paved?.(a.offAt.x, a.offAt.y);
        if (!onRoad || this.ground?.paved?.(q.x, q.y)) a.offPath = [q];
      }
      // 對話泡泡：偶爾冒一個，同時最多 4 個
      a.chatCd = (a.chatCd ?? 1 + Math.random() * 4) - dt;
      if (a.chatCd <= 0) { a.chatCd = 3 + Math.random() * 5; if (this.bubbles.length < 4 && Math.random() < 0.6) this.addBubble(w); }
    }
  }
  dayLight() {
    // 設定頁關掉日夜變化：固定在上午（影子適中、沒有夜晚）
    // 畫面用的時鐘：game.s.t 只在遊戲 tick（每 0.2 秒）前進，直接用會讓影子一格一格跳；
    // 改成每幀照實際經過時間往前推，跟遊戲時間差太多（讀檔、離線補算）才對齊回去
    const gt = game.s.t;
    if (this.visT == null || Math.abs(this.visT - gt) > 10) this.visT = gt;
    else { const dt = this.visDt; this.visT += dt + (gt - this.visT) * Math.min(1, dt * 1.5); }
    const DAY = 300, p = useSettings.getState().dayNight ? (((this.visT % DAY) + DAY) % DAY) / DAY : 0.2;
    this.dayP = p;
    // 關鍵影格：[時間比例, 環境光顏色, 亮燈程度]；白天：夜晚約 3：1（白天到黃昏 0～0.7、夜晚到清晨 0.7～1）
    const K: [number, number, number][] = [
      [0, this.dayTint, 0], [0.62, this.dayTint, 0], [0.68, 0xffb48a, 0.4], [0.73, 0x5a68a4, 1],
      [0.93, 0x5a68a4, 1], [0.97, 0xc8b4dc, 0.35], [1, this.dayTint, 0],
    ];
    let i = 1; while (i < K.length - 1 && K[i][0] < p) i++;
    const [p0, c0, n0] = K[i - 1], [p1, c1, n1] = K[i], f = (p - p0) / (p1 - p0 || 1);
    const mix = (a: number, b: number, sh: number) => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * f);
    this.overlay.tint = (mix(c0, c1, 16) << 16) | (mix(c0, c1, 8) << 8) | mix(c0, c1, 0);
    const night = n0 + (n1 - n0) * f;
    setNight(night);
    // 太陽：白天（p 0～0.68）從東升到西落。影子一律落在右下（跟手繪圖左上打光一致），只改角度與長短：
    // 清晨長、往右斜很多；中午短；黃昏長、幾乎往正下方
    const u = clampN(p / 0.68, 0, 1), low = 1 - Math.sin(Math.PI * u);
    // lean：斜切角度（弧度），tan 值就是影子往右偏的比例；清晨約 1.7 倍、中午約 0.9 倍、黃昏約 0.5 倍
    const len = 0.5 + 0.45 * low, lean = 1.05 - 0.6 * u;
    const shAlpha = SHADOW_ALPHA * (1 - night) * (0.8 + 0.2 * low);
    this.sun = { len, lean, alpha: shAlpha };
    for (const v of this.views.values()) {
      const sh = v.shadow; if (!sh) continue;
      const k = (sh as any).base;
      // Pixi 的 skew 是把 y 軸轉一個角度（會把影子轉平、縮在建築後面）；除以 cos 變成真的斜切：
      // 影子的垂直長度維持 len，頂端往右推 tan(lean)·len，矮胖的建築影子也能伸出建築外
      sh.scale.set(k, (-k * len) / Math.cos(lean)); sh.skew.x = lean; sh.alpha = shAlpha;
    }
    // 斜射光：清晨、黃昏比較明顯，中午和夜晚幾乎沒有；顏色跟著環境光
    this.sunRay.alpha = 0.16 * low * (1 - night);
    this.sunRay.tint = this.overlay.tint;
  }
  /** 腳印：小人每走 7 像素在腳下留一個（左右腳交錯），每人身後保持 3 個；
   *  第 4 個出現時最舊的那個不是瞬間消失，而是 0.6 秒淡出；停下來 4 秒後也慢慢淡掉。鋪過的路面上不留 */
  footprints() {
    const g = this.footG, paved = this.ground?.paved, T = this.T;
    const STRIDE = 7, KEEP = 3, FADE = 0.6, IDLE = 4;
    g.clear();
    const units: any[] = [...this.walkers, ...this.patrols, ...this.defenders, ...this.aliens];
    for (const u of units) {
      if (u.destroyed || !u.visible) continue;
      // prints：{ x, y, t 留下的時間, gone 開始淡出的時間 }
      const prints: { x: number; y: number; t: number; gone?: number }[] = (u.prints ??= []);
      if (u.fx == null) { u.fx = u.x; u.fy = u.y; u.step = 0; }
      const dx = u.x - u.fx, dy = u.y - u.fy, d = Math.hypot(dx, dy);
      if (d > 30) { u.fx = u.x; u.fy = u.y; prints.length = 0; }   // 瞬移（重新產生、換位置）不留腳印
      else if (d >= STRIDE) {
        // 左右腳：垂直於行進方向偏 1 像素多一點
        const side = (u.step++ % 2 ? 1 : -1), nx = -dy / d, ny = dx / d;
        const px = u.x + nx * side * 1.3, py = u.y + ny * side * 0.7;
        if (!paved?.(px, py)) {
          prints.push({ x: px, y: py, t: T });
          const live = prints.filter((q) => q.gone == null);
          if (live.length > KEEP) live[0].gone = T;
        }
        u.fx = u.x; u.fy = u.y;
      }
      for (const q of prints) if (q.gone == null && T - q.t > IDLE) q.gone = T;   // 停下來太久：慢慢淡掉
      for (let i = prints.length - 1; i >= 0; i--) if (prints[i].gone != null && T - prints[i].gone! > FADE) prints.splice(i, 1);
      const live = prints.filter((q) => q.gone == null);
      for (const q of prints) {
        // 越新越深（最新 0.65、最舊 0.35）；淡出中的從目前的深淺降到 0
        const rank = q.gone == null ? live.indexOf(q) : -1;
        const base = rank >= 0 ? 0.35 + 0.3 * (rank / Math.max(1, KEEP - 1)) : 0.35;
        const a = q.gone == null ? base : base * Math.max(0, 1 - (T - q.gone) / FADE);
        if (a > 0.01) g.ellipse(q.x, q.y, 1.5, 0.9).fill({ color: 0x4a1c10, alpha: a });
      }
    }
  }
  /** 小人：腳下畫小影子（跟建築影子同方向）；走進建築影子裡慢慢變暗 40%，走出來再恢復 */
  unitShadows(dt: number) {
    const g = this.unitShadowG, { len, lean, alpha } = this.sun;
    g.clear();
    const units: any[] = [...this.walkers, ...this.patrols, ...this.defenders, ...this.aliens, ...this.fallen, ...this.patients];
    const off = Math.tan(lean) * len * 5, rx = 2.6 + len * 1.6;
    const shadows = [...this.views.values()].map((v) => v.shadow).filter((s): s is Sprite & { smask: ShadowMask } => !!s?.smask && s.alpha > 0.02);
    const pt = new Point(), loc = new Point();
    const debug = (window as any).__shadeDebug;   // 測試用：設成 true 時，站在影子裡的小人標成紅色
    for (const u of units) {
      if (u.destroyed || !u.visible) continue;
      // 影子中心壓在腳底（不能往下偏，不然看起來腳離地），只往太陽的反方向（右）稍微拉長
      if (alpha > 0.02) g.ellipse(u.x + off * 0.25, u.y - 0.3, rx, 1.2 + len * 0.3).fill({ color: 0x000000, alpha: alpha * 0.9 });
      // 是否在某棟建築的影子裡：把腳的位置換算回影子圖的像素，看那裡是不是實心
      let inside = false;
      pt.set(u.x, u.y);
      for (const sh of shadows) {
        sh.toLocal(pt, this.shadowL, loc);
        const t = sh.texture, px = Math.floor(loc.x + sh.anchor.x * t.width), py = Math.floor(loc.y + sh.anchor.y * t.height);
        if (px < 0 || py < 0 || px >= sh.smask.w || py >= sh.smask.h) continue;
        if (sh.smask.a[py * sh.smask.w + px]) { inside = true; break; }
      }
      const want = inside ? 1 : 0;
      u.shade = (u.shade ?? 0) + (want - (u.shade ?? 0)) * Math.min(1, dt * 6);
      u.baseTint ??= u.tint ?? 0xffffff;
      if (u.tint !== u.lastTint) u.baseTint = u.tint;   // 別處改了顏色（傷員、掠奪者）：以那個為基準
      const k = 1 - 0.4 * u.shade * (alpha / SHADOW_ALPHA);
      const bt = debug && inside ? 0xff4040 : u.baseTint;
      const r = Math.round(((bt >> 16) & 255) * k), gg = Math.round(((bt >> 8) & 255) * k), b = Math.round((bt & 255) * k);
      u.tint = (r << 16) | (gg << 8) | b; u.lastTint = u.tint;
    }
  }
  frame(rdt: number) {
    // 遊戲暫停時畫面上的人、建築動畫也停住；鏡頭照常可以移動
    const dt = gamePaused() ? 0 : rdt;
    this.T += dt;
    this.visDt = dt;
    this.dayLight();
    const s = game.s, Z = this.Z;
    if (this.camGoal) {
      this.cam.x += (this.camGoal.x - this.cam.x) * Math.min(1, rdt * 6);
      this.cam.y += (this.camGoal.y - this.cam.y) * Math.min(1, rdt * 6);
      if (Math.abs(this.camGoal.x - this.cam.x) < 0.5 && Math.abs(this.camGoal.y - this.cam.y) < 0.5) { this.cam.x = this.camGoal.x; this.cam.y = this.camGoal.y; this.camGoal = null; }
    }
    this.world.scale.set(Z);
    this.world.position.set(-Math.round(this.cam.x) * Z, -Math.round(this.cam.y) * Z);
    for (const p of this.props) p.update(this.T, dt);
    this.ambient?.update(this.T, dt);
    const labels: { pl: any; x: number; y: number; w: number; h: number; prio: number }[] = [];
    for (const v of this.views.values()) {
      const b = v.building;
      if (b) {
        b.update(this.T, dt);
        const on = !!v.bid && built(s, v.bid) && DEF[v.bid].clickable && buffActive(s, v.bid);
        v.ring.visible = on;
        if (on) v.ring.update(this.T);
      }
      if (v.sel?.visible) v.sel.update(this.T * 0.4);
      if (v.plate) {
        const top = (v.building ?? v.children[0] as any).art?.ay ?? 30;
        const [sx, sy] = this.toScreen(v.x, v.y - top - 2);
        const pl: any = v.plate;
        const sel = useGame.getState().selected;
        const focus = this.hover === v.site.id || (!!sel && sel === v.bid) || (!!this.hold && this.hold.id === v.site.id);
        pl.setExpanded?.(focus);
        pl.setPressed?.(!!this.hold && this.hold.id === v.site.id);
        labels.push({ pl, x: Math.round(sx - (pl.pw * Z) / 2), y: Math.round(sy - pl.ph * Z), w: pl.pw * Z, h: pl.ph * Z, prio: focus ? 2 : pl.isCard ? 1 : 0 });
      }
    }
    this.resolveLabels(labels);
    for (const w of this.walkers) this.moveWalker(w, dt);
    this.moveAliens(dt);
    this.moveDefenders(dt);
    this.movePatrols(dt);
    this.drawShots(dt);
    this.footprints();
    this.moveBubbles(dt);
    this.unitShadows(dt);
    this.updateRaidMark();
    if (this.hold) {
      this.hold.next -= dt;
      if (this.hold.next <= 0) {
        this.hold.next += 0.2;
        const v = this.views.get(this.hold.id);
        if (v?.bid && built(s, v.bid)) this.doClick(v); else this.hold = null;
      }
    }
    this.fx.update(dt);
  }
}
