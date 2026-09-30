// Pixi 場景：地圖、建築／工地、工人、點擊回饋。狀態來自引擎，每次版本號改變時同步。
import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import {
  STAGES, RES, planMap, createGround, createBuilding, createProp, createWorker, createBuffRing,
  createAmbient, createFx, createPixelSprite, renderPanel, renderIcon, pixelTexture, tierOf, createAlien, createMarine, loadSprites, hasTerrain,
} from '../art/art.js';
import { game, useGame } from '../store/gameStore';
import { COMMAND_CHAIN, DEF } from '../engine/state';
import { artId, buffActive, built, disabled, idle, workerCap } from '../engine/formulas';
import { MW, MH, CENTER, SITES, HOME, Site, RAID_SPAWN, RAID_RALLY, ROUTES, POD_DOOR, routeFromPod, PATROL, PATROL_TOTAL, patrolAt, pathBetween, along } from './layout';
import { WARNING, defense, injuredCount, medBeds } from '../engine/combat';
import { bName, lang, resName, t } from '../i18n';
import { sfx } from '../audio/audio';

type View = Container & { key: string; site: Site; bid: string | null; plate?: Container; ring?: any; sel?: any; building?: any; squash: number; lights?: Container };
type Walker = Container & { ai: any; px: number; py: number; setMoving: any; setDir: any; setCarry: any; setWork?: (w: boolean) => void; update: any };

const clampN = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class GameScene {
  app = new Application();
  world = new Container();
  obj = new Container();
  lightL = new Container();
  hud = new Container();
  fxL = new Container();
  ground: Sprite | null = null;
  overlay = new Graphics();
  ambient: any = null;
  props: any[] = [];
  views = new Map<string, View>();
  walkers: Walker[] = [];
  aliens: any[] = [];
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
    for (const c of [this.overlay, this.lightL, this.fxL, this.shotG]) c.eventMode = 'none';
    this.app.stage.eventMode = 'static';
    this.app.stage.hitArea = this.app.screen;
    this.Z = this.zoomFor(this.app.screen.width);
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
  zoomFor(w: number) { return this.userZ ?? clampN(Math.round(w / 400), 2, 4); }
  /** 換縮放倍率（整數倍，像素才不會糊）；anchor 是螢幕座標，縮放時它底下的地圖點保持不動 */
  setZoom(z: number, anchor?: [number, number]) {
    z = clampN(z, 1, 5);
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
    return { x: vw >= MW ? (MW - vw) / 2 : clampN(x, 0, MW - vw), y: vh >= MH ? (MH - vh) / 2 : clampN(y, -24, MH - vh + 40) };
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
    if (site.id !== 'command') return DEF[site.id].stage <= s.stage ? site.id : null;
    const builtCmd = [...COMMAND_CHAIN].reverse().find((id) => built(s, id));
    return builtCmd ?? COMMAND_CHAIN[0];
  }

  sync() {
    const s = game.s;
    const gStage = Math.min(6, s.stage);
    if (gStage !== this.groundStage) this.buildMap(gStage);
    const selected = useGame.getState().selected;
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      const lvl = bid ? s.b[bid].level : 0;
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

  buildMap(stage: number) {
    this.groundStage = stage;
    for (const p of this.props) { p.lights.destroy({ children: true }); p.destroy({ children: true }); }
    this.props = [];
    this.ground?.destroy();
    this.ambient?.destroy({ children: true });
    const s = game.s;
    const sites = SITES.filter((x) => x.id === 'command' || DEF[x.id].stage <= s.stage).map((x) => ({ ...x, r: x.r ?? 24 }));
    const plan = planMap(stage, MW, MH, 90 + stage, { center: CENTER, sites, routes: ROUTES });
    // 手繪底圖：裝飾物一律用第 1 章的配色（不再每章換一種風貌）
    const propStage = hasTerrain() ? 1 : stage;
    const ground: Sprite = createGround(stage, plan);
    ground.eventMode = 'none';
    this.ground = ground;
    this.world.addChildAt(ground, 0);
    for (const p of plan.props) {
      const c = createProp(p.kind, propStage, p.seed);
      c.position.set(p.x, p.y); c.zIndex = p.y; c.lights.position.set(p.x, p.y);
      c.eventMode = 'none';
      this.obj.addChild(c); this.lightL.addChild(c.lights);
      this.props.push(c);
    }
    this.overlay.clear().rect(0, 0, MW, MH).fill(hasTerrain() ? 0xfff2ea : STAGES[stage].ambient);
    this.overlay.blendMode = 'multiply';
    this.ambient = createAmbient(stage, MW, MH);
    this.lightL.addChild(this.ambient);
    for (const w of this.walkers) w.destroy({ children: true });
    this.walkers = [];
  }

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
    v.key = key; v.site = site; v.bid = bid; v.squash = 0;
    v.position.set(site.x, site.y); v.zIndex = site.y;
    const L = s.b[bid].level;
    const b: any = createBuilding(artId(s, bid), Math.max(1, L));
    v.building = L > 0 ? b : null;
    if (L > 0) {
      v.addChild(b);
      b.lights.position.set(site.x, site.y);
      this.lightL.addChild(b.lights);
      v.lights = b.lights;
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
    const w = b.art.canvas.width;
    v.hitArea = new Rectangle(-b.art.ax, -b.art.ay, w, b.art.canvas.height + 8);
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
    v.squash = 1;
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
    for (const a of this.aliens) {
      const [x, y] = this.toScreen(a.x, a.y - 5);
      this.fx.burst(x, y, 0xb04a8a, 6);
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
      const a: any = createAlien();
      a.eventMode = 'none';
      // 起點在地圖外，終點是邊緣內側的集結點；兩者都錯開一點，讓群體看起來散開
      const jx = (Math.random() - 0.5) * (side < 2 ? 30 : 110), jy = (Math.random() - 0.5) * (side < 2 ? 110 : 26);
      a.from = { x: from.x + jx, y: from.y + jy };
      a.to = { x: to.x + jx * 0.8, y: to.y + jy * 0.8 };
      a.lag = Math.random() * 0.15;
      // 掠奪者偏橘褐、企業突擊隊偏鋼藍，和異星生物區分
      if (inc.kind === 'raider') a.tint = 0xe0b080; else if (inc.kind === 'commando') a.tint = 0x9fb8e0;
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
    // 雙方都就位後交火：陸戰隊點放子彈、砲塔打雷射、異星生物吐酸液（仿 RimWorld 的曳光彈，會有落空）
    if (inc && p0 > 0.72 && this.defenders.length && this.aliens.length) this.skirmish(dt);
  }
  /** 交火：每位陸戰隊員各自冷卻，持槍的一次點放 3 發；砲塔每隔一段時間打一道雷射；異星生物偶爾吐酸液 */
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
      if (d) { this.shoot(a.x, a.y - 6, d.x, d.y - 6, d, 'spit', 0.3); sfx('spit'); }
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
          else { sh.hit.hitT = 0.12; const [x, y] = this.toScreen(sh.tx, sh.ty); this.fx.burst(x, y, 0x9fff6a, 3); }
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
        // 酸液：綠色小團，走拋物線
        const p = sh.t / sh.life, lift = Math.sin(p * Math.PI) * 10;
        g.rect(Math.round(x) - 1, Math.round(y - lift) - 1, 2, 2).fill({ color: 0x9fff6a });
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
  moveAliens() {
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
    const want = new Map<string, number>();
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      if (bid && built(s, bid) && s.b[bid].workers > 0) want.set(bid, Math.min(5, s.b[bid].workers));
    }
    // 陸戰隊出去迎戰時，營區附近不再顯示閒晃的隊員
    want.delete('security');
    want.set('__idle', Math.min(8, Math.max(0, idle(s))));
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
    const via = path ? path.slice(1, -1).map((p) => ({ x: p.x + (j() >> 2), y: p.y + (j() >> 3) })) : [];
    w.ai = bid
      ? { bid, phase: 'out', via, queue: [...via], wait: Math.random() * 2, home: { x: home.x + j(), y: home.y + (j() >> 2) }, site: { x: site!.x + j(), y: site!.y + 6 } }
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
    const speed = built(game.s, 'rail_line') ? 24 : 16;
    if (a.wait > 0) {
      a.wait -= dt; w.setMoving(false); w.setWork?.(!!a.working);
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
        if (!a.bid) { a.wait = 1 + Math.random() * 3; a.target = { x: a.home.x + (Math.random() - 0.5) * 50, y: a.home.y + (Math.random() - 0.5) * 12 }; }
        else if (a.target === a.site) {
          a.queue = [...a.via].reverse(); a.queue.push(a.home); a.target = a.queue.shift(); a.wait = 2.5 + Math.random() * 2; a.working = true;
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

  frame(dt: number) {
    this.T += dt;
    const s = game.s, Z = this.Z;
    if (this.camGoal) {
      this.cam.x += (this.camGoal.x - this.cam.x) * Math.min(1, dt * 6);
      this.cam.y += (this.camGoal.y - this.cam.y) * Math.min(1, dt * 6);
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
        v.squash *= Math.pow(0.0008, dt);
        b.sprite.scale.set(1 + 0.08 * v.squash, 1 - 0.1 * v.squash);
        b.flashSprite.scale.copyFrom(b.sprite.scale);
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
    this.moveAliens();
    this.moveDefenders(dt);
    this.movePatrols(dt);
    this.drawShots(dt);
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
