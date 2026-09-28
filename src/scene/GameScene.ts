// Pixi 場景：地圖、建築／工地、工人、點擊回饋。狀態來自引擎，每次版本號改變時同步。
import { Application, Container, Graphics, Rectangle, Sprite, Text } from 'pixi.js';
import {
  STAGES, RES, planMap, createGround, createBuilding, createProp, createWorker, createBuffRing,
  createAmbient, createFx, createPixelSprite, renderPanel, renderIcon, pixelTexture, tierOf, createAlien,
} from '../art/art.js';
import { game, useGame } from '../store/gameStore';
import { COMMAND_CHAIN, DEF } from '../engine/state';
import { buffActive, built, disabled, idle, workerCap } from '../engine/formulas';
import { MW, MH, CENTER, SITES, HOME, Site, RAID_SPAWN, RAID_RALLY } from './layout';
import { WARNING } from '../engine/combat';

type View = Container & { key: string; site: Site; bid: string | null; plate?: Container; ring?: any; sel?: any; building?: any; squash: number; lights?: Container };
type Walker = Container & { ai: any; px: number; py: number; setMoving: any; setDir: any; setCarry: any; update: any };

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

  async init(host: HTMLElement) {
    await this.app.init({
      width: Math.max(320, host.clientWidth), height: Math.max(200, host.clientHeight),
      antialias: false, background: 0x0a0c12, resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true, roundPixels: true, preference: 'webgl',
    });
    host.appendChild(this.app.canvas);
    this.obj.sortableChildren = true;
    this.world.addChild(this.obj, this.overlay, this.lightL);
    this.app.stage.addChild(this.world, this.hud, this.fxL);
    // 舞台是 static（拖曳用），子層會繼承互動模式；不需要點擊的層一律關掉，避免擋住建築
    for (const c of [this.overlay, this.lightL, this.fxL]) c.eventMode = 'none';
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
    });
    this.app.ticker.add((tk) => this.frame(Math.min(0.05, tk.deltaMS / 1000)));
    new ResizeObserver(() => this.resize(host)).observe(host);
  }

  zoomFor(w: number) { return clampN(Math.round(w / 400), 2, 4); }
  resize(host: HTMLElement) {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h || (w === this.app.screen.width && h === this.app.screen.height)) return;
    this.app.renderer.resize(w, h);
    this.app.stage.hitArea = this.app.screen;
    const z = this.zoomFor(w);
    if (z !== this.Z) { this.Z = z; this.fx = createFx(this.fxL, z); for (const v of this.views.values()) v.key = ''; this.sync(); }
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
    const gStage = Math.min(4, s.stage);
    if (gStage !== this.groundStage) this.buildMap(gStage);
    const selected = useGame.getState().selected;
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      const lvl = bid ? s.b[bid].level : 0;
      const key = !bid ? 'none' : lvl > 0 ? `${bid}:${tierOf(lvl)}:${this.Z}` : `site:${bid}:${this.Z}`;
      let v = this.views.get(site.id);
      if (!v || v.key !== key) { if (v) this.dropView(v); v = this.makeView(site, bid, key) ?? undefined; if (v) this.views.set(site.id, v); else this.views.delete(site.id); }
      if (!v || !bid) continue;
      const text = lvl > 0 ? (DEF[bid].kind === 'command' || DEF[bid].maxLevel === 1 ? DEF[bid].name : `${DEF[bid].name} Lv${lvl}`) : `建造：${DEF[bid].name}`;
      const dis = lvl > 0 && disabled(s, bid);
      const card = lvl > 0 && DEF[bid].clickable;
      const plateKey = card ? `card|${bid}|${this.Z}|${Math.min(4, s.stage)}` : `${text}|${dis}|${this.Z}`;
      if (!v.plate || (v.plate as any).k !== plateKey) {
        v.plate?.destroy({ children: true });
        v.plate = card ? this.makeCard(v) : this.makePlate(dis ? `${text}（停工）` : text, lvl > 0 ? (dis ? 'inset' : 'plate') : 'inset');
        (v.plate as any).k = plateKey; this.hud.addChild(v.plate);
      }
      (v.plate as any).refresh?.();
      if (v.building) v.building.sprite.tint = dis ? 0x6a6a74 : 0xffffff;
      if (v.sel) v.sel.visible = selected === bid || (site.id === 'command' && !!selected && COMMAND_CHAIN.includes(selected));
    }
    this.syncWorkers();
    this.syncRaid();
  }

  buildMap(stage: number) {
    this.groundStage = stage;
    for (const p of this.props) { p.lights.destroy({ children: true }); p.destroy({ children: true }); }
    this.props = [];
    this.ground?.destroy();
    this.ambient?.destroy({ children: true });
    const s = game.s;
    const sites = SITES.filter((x) => x.id === 'command' || DEF[x.id].stage <= s.stage).map((x) => ({ ...x, r: x.r ?? 24 }));
    const plan = planMap(stage, MW, MH, 90 + stage, { center: CENTER, sites });
    const ground: Sprite = createGround(stage, plan);
    ground.eventMode = 'none';
    this.ground = ground;
    this.world.addChildAt(ground, 0);
    for (const p of plan.props) {
      const c = createProp(p.kind, stage, p.seed);
      c.position.set(p.x, p.y); c.zIndex = p.y; c.lights.position.set(p.x, p.y);
      c.eventMode = 'none';
      this.obj.addChild(c); this.lightL.addChild(c.lights);
      this.props.push(c);
    }
    this.overlay.clear().rect(0, 0, MW, MH).fill(STAGES[stage].ambient);
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
    const bg = createPixelSprite(renderPanel(w, 11, Math.min(4, game.s.stage), kind));
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
    const b: any = createBuilding(bid, Math.max(1, L));
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
      const sign = createProp('site', Math.min(4, s.stage), 3);
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
    const Z = this.Z, st = Math.min(4, game.s.stage), id = v.bid!, d = DEF[id];
    const res = (d.produce?.res ?? d.recipe!.out) as string;
    const W = 52, H = 37, CW = 34, CH = 14, fs = Z >= 3 ? 15 : Z >= 2 ? 12 : 10;
    const txt = (text: string, size: number, fill: number) => new Text({ text, style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: size, fontWeight: '900', fill, stroke: { color: 0x120e18, width: size >= 12 ? 3 : 2 } } });
    const c: any = new Container();
    const bg = createPixelSprite(renderPanel(W, H, st, 'panel')); bg.scale.set(Z);
    c.addChild(bg);
    // 採集按鈕（展開與收合各一張底圖）
    const btn: any = new Container();
    const texBig = pixelTexture(renderPanel(W - 6, 14, st, 'plate')), texSmall = pixelTexture(renderPanel(CW, CH, st, 'plate'));
    const face = new Sprite(texBig); face.scale.set(Z);
    const icon = createPixelSprite(renderIcon(res)); icon.scale.set(Z); icon.position.set(3 * Z, 1.5 * Z);
    const label = txt(RES[res].name, fs, 0xfff8ec); label.anchor.set(0.5);
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
    const wl = txt('工人', fs - 3, 0xc9c3d6); wl.anchor.set(0.5); wl.position.set((W / 2) * Z, 5 * Z);
    const minus = createPixelSprite(renderPanel(9, 9, st, 'button', '-')); minus.scale.set(Z); minus.position.set(4 * Z, 9 * Z);
    const plus = createPixelSprite(renderPanel(9, 9, st, 'button', '+')); plus.scale.set(Z); plus.position.set((W - 13) * Z, 9 * Z);
    const inset = createPixelSprite(renderPanel(W - 30, 9, st, 'inset')); inset.scale.set(Z); inset.position.set(15 * Z, 9 * Z);
    const cnt = txt('', fs - 2, 0xf4efe4); cnt.anchor.set(0.5); cnt.position.set((W / 2) * Z, 13.5 * Z);
    for (const [b, dlt] of [[minus, -1], [plus, 1]] as [any, number][]) {
      b.eventMode = 'static'; b.cursor = 'pointer';
      b.on('pointerdown', (e: any) => { e.stopPropagation(); useGame.getState().assign(id, dlt); });
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
      label.text = dis ? '停工' : paused ? '暫停' : RES[res].name;
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
    const name = RES[r.res].name;
    if (r.amount > 0) this.fx.pop(sx, sy, `${r.crit ? '暴擊 ' : ''}+${Math.round(r.amount * 10) / 10} ${name}`, RES[r.res].color, r.crit);
    else this.fx.pop(sx, sy, `原料不足`, 0xc8c2d6, false);
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
      a.position.set(a.from.x, a.from.y);
      this.obj.addChild(a);
      this.aliens.push(a);
    }
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
      a.position.set(Math.round(x), Math.round(y)); a.zIndex = y;
      a.update(this.T, p < 1);
    }
  }

  // ── 工人：每棟建築依指派人數顯示走動的殖民者，閒置的在中央廣場附近閒晃 ──
  syncWorkers() {
    const s = game.s;
    const want = new Map<string, number>();
    for (const site of SITES) {
      const bid = this.siteBuilding(site);
      if (bid && built(s, bid) && s.b[bid].workers > 0) want.set(bid, Math.min(5, s.b[bid].workers));
    }
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
    const w = createWorker(Math.min(4, game.s.stage)) as Walker;
    const j = () => Math.round((Math.random() - 0.5) * 18);
    const site = bid ? SITES.find((x) => x.id === bid || (x.id === 'command' && COMMAND_CHAIN.includes(bid)))! : null;
    const home = built(game.s, 'emergency_camp') ? HOME : { x: 241 + 14, y: 210 };
    w.ai = bid
      ? { bid, phase: 'out', wait: Math.random() * 2, home: { x: home.x + j(), y: home.y + (j() >> 2) }, site: { x: site!.x + j(), y: site!.y + 6 } }
      : { bid: null, wait: Math.random() * 2, home: { x: home.x + j() * 2, y: home.y + (j() >> 1) } };
    w.ai.target = w.ai.site ?? w.ai.home;
    w.px = w.ai.home.x; w.py = w.ai.home.y;
    w.position.set(w.px, w.py);
    w.eventMode = 'none';
    this.obj.addChild(w);
    this.walkers.push(w);
  }
  moveWalker(w: Walker, dt: number) {
    const a = w.ai;
    const speed = built(game.s, 'rail_line') ? 24 : 16;
    if (a.wait > 0) { a.wait -= dt; w.setMoving(false); }
    else {
      const dx = a.target.x - w.px, dy = a.target.y - w.py, d = Math.hypot(dx, dy);
      if (d < 1) {
        if (!a.bid) { a.wait = 1 + Math.random() * 3; a.target = { x: a.home.x + (Math.random() - 0.5) * 50, y: a.home.y + (Math.random() - 0.5) * 12 }; }
        else if (a.target === a.site) {
          a.target = a.home; a.wait = 1.2 + Math.random();
          const d = DEF[a.bid];
          const res = d.produce?.res ?? d.recipe?.out;
          w.setCarry(res ? RES[res].color : null);
        } else { a.target = a.site; a.wait = 0.4; w.setCarry(null); }
      } else {
        const st = Math.min(d, speed * dt);
        w.px += (dx / d) * st; w.py += (dy / d) * st;
        w.setMoving(true); w.setDir(Math.sign(dx) || 1);
      }
    }
    w.position.set(Math.round(w.px), Math.round(w.py));
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
