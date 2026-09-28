// 預覽頁：俯視像素場景＋建築圖鑑（與 art.js 一起打包進 HTML）
const MW = 600, MH = 360;
const BASE = [0, 1, 4, 12, 35, 100, 280];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const fmt = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(n));
const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

const state = { stage: 1, level: 1, buff: false };
const totals = {};
const cam = { x: 0, y: 0 };
let T = 0, Z = 2, scene = null, hold = null, drag = null, selected = null;

// ── 頁面控制 ──
for (let s = 1; s <= 6; s++) {
  const P = STAGES[s];
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'stage-tab'; b.id = 'tab' + s; b.setAttribute('role', 'tab');
  b.innerHTML = `<i class="sw" style="background:linear-gradient(90deg,${hex(P.ground[1])},${hex(P.ground[3])} 55%,${hex(P.path[2])} 55%,${hex(P.path[2])} 80%,${hex(P.trim)} 80%)"></i><span><b>${s}</b>${P.name}</span>`;
  b.addEventListener('click', () => { state.stage = s; buildScene(); });
  $('tabs').appendChild(b);
}
$('lv').addEventListener('click', (e) => {
  const lv = +e.target.dataset?.lv;
  if (!lv) return;
  state.level = lv;
  for (const b of $('lv').children) b.setAttribute('aria-pressed', String(+b.dataset.lv === lv));
  buildScene(true);
});
$('buff').addEventListener('click', () => {
  state.buff = !state.buff;
  $('buff').setAttribute('aria-pressed', String(state.buff));
  if (scene) for (const b of scene.blds) b.ring.visible = state.buff;
  if (selected) openPanel(selected);
});

function renderMeta() {
  const P = STAGES[state.stage];
  for (let s = 1; s <= 6; s++) $('tab' + s).setAttribute('aria-selected', String(s === state.stage));
  const sw = [...P.ground.slice(1, 4), P.path[2], P.hull, P.trim, P.tree].map((c) => `<i style="background:${hex(c)}"></i>`).join('');
  $('stage-meta').innerHTML = `<span class="name">階段 ${P.id} · ${P.name} <span class="en">${P.en}</span></span><span class="mood">${P.mood}</span><span class="swatches">${sw}</span>`;
}

// ── Pixi ──
const host = $('scene');
const app = new Application();
try {
  await app.init({
    width: Math.max(320, host.clientWidth), height: Math.max(180, host.clientHeight),
    antialias: false, background: 0x0a0c12, resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true, roundPixels: true, preference: 'webgl',
  });
} catch (err) {
  host.innerHTML = '<div class="err">這個瀏覽器無法啟動 WebGL，所以互動場景無法顯示；下方圖鑑仍可瀏覽。請換用桌面版 Chrome、Edge 或 Safari 開啟場景。</div>';
  renderLegend(); renderCatalog();
  throw err;
}
host.appendChild(app.canvas);
const world = new Container(), hud = new Container(), fxLayer = new Container();
app.stage.addChild(world, hud, fxLayer);
app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;
const zoomFor = (w) => Math.max(1, Math.min(4, Math.round(w / 400)));
Z = zoomFor(app.screen.width);
let fx = createFx(fxLayer, Z);

function clampCam() {
  const vw = app.screen.width / Z, vh = app.screen.height / Z;
  cam.x = Math.round(vw >= MW ? (MW - vw) / 2 : clamp(cam.x, 0, MW - vw));
  cam.y = Math.round(vh >= MH ? (MH - vh) / 2 : clamp(cam.y, 0, MH - vh));
}
const toScreen = (x, y) => [(x - cam.x) * Z, (y - cam.y) * Z];
const label = (text, size, color = 0xf4efe4, weight = '700') => new Text({
  text, style: { fontFamily: '"Noto Sans TC", sans-serif', fontSize: size, fontWeight: weight, fill: color, stroke: { color: 0x120e18, width: size >= 12 ? 3 : 2 } },
});
const pixel = (canvas, x = 0, y = 0) => { const s = createPixelSprite(canvas); s.scale.set(Z); s.position.set(x * Z, y * Z); return s; };
const tapValue = (b) => Math.round(BASE[state.stage] * (1 + (state.level - 1) * 0.75) * (state.buff ? 2 : 1));

// 拖曳地面移動視角
app.stage.on('pointerdown', (e) => { drag = { x: e.global.x, y: e.global.y, cx: cam.x, cy: cam.y, moved: false }; });
app.stage.on('pointermove', (e) => {
  if (!drag) return;
  const dx = e.global.x - drag.x, dy = e.global.y - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
  cam.x = drag.cx - dx / Z; cam.y = drag.cy - dy / Z;
  clampCam();
});
const pointerUp = () => { if (drag && !drag.moved) closePanel(); drag = null; hold = null; };
app.stage.on('pointerup', pointerUp);
app.stage.on('pointerupoutside', pointerUp);

function tap(b) {
  const d = b.info;
  let v = tapValue(b);
  const crit = Math.random() < 0.15;
  if (crit) v *= 5;
  const [sx, sy] = toScreen(b.x, b.y - b.art.ay + 4);
  fx.pop(sx, sy, `${crit ? '暴擊 ' : ''}+${fmt(v)} ${RES[d.res].name}`, d.color, crit);
  const [cx, cy] = toScreen(b.x, b.y - b.art.ay / 2);
  fx.burst(cx, cy, d.color, crit ? 16 : 6);
  if (crit) b.flash();
  b.squash = 1;
  totals[d.res] = (totals[d.res] || 0) + v;
  renderTotals();
}

// ── 工人 ──
function makeWorker(b) {
  const w = createWorker(state.stage);
  const c = scene.plan.center, j = () => Math.round((Math.random() - 0.5) * 16);
  w.ai = b
    ? { b, phase: 'out', wait: Math.random() * 1.5, home: { x: c.x + j(), y: c.y + 26 + (j() >> 2) }, site: { x: b.x + j(), y: b.y + 5 } }
    : { idle: true, wait: Math.random() * 2, home: { x: c.x + j() * 2, y: c.y + 24 + (j() >> 1) } };
  w.ai.target = w.ai.site ?? w.ai.home;
  w.px = w.ai.home.x; w.py = w.ai.home.y;
  w.position.set(w.px, w.py);
  scene.obj.addChild(w);
  scene.workers.push(w);
  return w;
}
function removeWorker(w) { scene.workers.splice(scene.workers.indexOf(w), 1); w.destroy({ children: true }); }
function setWorkers(b, n) {
  n = clamp(n, 0, 4);
  while (b.workers < n) {
    const idle = scene.workers.find((w) => w.ai.idle);
    if (!idle) break;
    removeWorker(idle); makeWorker(b); b.workers++;
  }
  while (b.workers > n) {
    const w = scene.workers.find((w) => w.ai.b === b);
    removeWorker(w); makeWorker(null); b.workers--;
  }
  updateColonists();
}
function updateWorker(w, dt) {
  const a = w.ai;
  if (a.wait > 0) { a.wait -= dt; w.setMoving(false); }
  else {
    const dx = a.target.x - w.px, dy = a.target.y - w.py, d = Math.hypot(dx, dy);
    if (d < 1) {
      if (a.idle) { a.wait = 1 + Math.random() * 3; a.target = { x: a.home.x + (Math.random() - 0.5) * 60, y: a.home.y + (Math.random() - 0.5) * 16 }; }
      else if (a.target === a.site) { a.target = a.home; a.wait = 1.4 + Math.random(); w.setCarry(a.b.info.color); }
      else {
        a.target = a.site; a.wait = 0.5; w.setCarry(null);
        const k = a.b.info.res;
        totals[k] = (totals[k] || 0) + Math.max(1, Math.round(tapValue(a.b) * 0.5));
        renderTotals();
      }
    } else {
      const st = Math.min(d, 16 * dt);
      w.px += (dx / d) * st; w.py += (dy / d) * st;
      w.setMoving(true); w.setDir(Math.sign(dx) || 1);
    }
  }
  w.position.set(Math.round(w.px), Math.round(w.py));
  w.zIndex = w.py;
  w.update(T);
}

// ── 場景 ──
function buildScene(keepCam = false) {
  if (scene) for (const c of world.removeChildren()) c.destroy({ children: true });
  selected = null; hold = null;
  renderMeta();
  const P = STAGES[state.stage];
  const plan = planMap(state.stage, MW, MH);
  const ground = createGround(state.stage, plan);
  const obj = new Container(); obj.sortableChildren = true;
  const overlay = new Graphics().rect(0, 0, MW, MH).fill(P.ambient); overlay.blendMode = 'multiply';
  const lights = new Container();
  world.addChild(ground, obj, overlay, lights);
  scene = { plan, obj, lights, blds: [], props: [], workers: [], hud: null };

  for (const s of plan.sites) {
    const b = createBuilding(s.id, state.level);
    b.position.set(s.x, s.y); b.zIndex = s.y;
    b.lights.position.set(s.x, s.y);
    const cw = b.art.canvas.width, ch = b.art.canvas.height;
    b.hitArea = new Rectangle(-b.art.ax, -b.art.ay, cw, ch);
    b.eventMode = 'static'; b.cursor = 'pointer';
    b.squash = 0; b.workers = 0; b.site = s;
    b.on('pointerdown', (e) => { e.stopPropagation(); openPanel(b); tap(b); hold = { b, next: 0.32 }; });
    b.ring = createBuffRing(Math.round(cw * 0.42) + 4, Math.round(cw * 0.16) + 3);
    b.ring.position.set(s.x, s.y - 2); b.ring.visible = state.buff;
    obj.addChild(b); lights.addChild(b.lights, b.ring);
    scene.blds.push(b);
  }
  for (const p of plan.props) {
    const c = createProp(p.kind, state.stage, p.seed);
    c.position.set(p.x, p.y); c.zIndex = p.y; c.lights.position.set(p.x, p.y);
    obj.addChild(c); lights.addChild(c.lights);
    scene.props.push(c);
  }
  scene.ambient = createAmbient(state.stage, MW, MH);
  lights.addChild(scene.ambient);
  for (const b of scene.blds) if (!b.site.hub) { makeWorker(b); b.workers = 1; }
  for (let i = 0; i < 2; i++) makeWorker(null);

  if (!keepCam) {
    cam.x = plan.center.x - app.screen.width / Z / 2;
    cam.y = plan.center.y - 10 - app.screen.height / Z / 2;
  }
  clampCam();
  buildHud();
}

// ── 介面（螢幕座標，像素面板依 Z 放大） ──
function buildHud() {
  for (const c of hud.removeChildren()) c.destroy({ children: true });
  const st = state.stage, fs = Z >= 3 ? 16 : Z >= 2 ? 13 : 10;
  const keys = [...new Set(stageBuildings(st).map((d) => d.res))];
  const slot = 50, pw = 6 + keys.length * slot, ph = 17;
  const bar = new Container();
  bar.addChild(pixel(renderPanel(pw, ph, st)));
  const nums = {};
  keys.forEach((key, i) => {
    bar.addChild(pixel(renderIcon(key), 4 + i * slot, 3), pixel(renderPanel(33, 9, st, 'inset'), 15 + i * slot, 4));
    const tx = label('0', fs - 1); tx.anchor.set(0.5); tx.position.set((15 + i * slot + 16.5) * Z, 8.5 * Z);
    bar.addChild(tx); nums[key] = tx;
  });
  bar.position.set(Math.round((app.screen.width - pw * Z) / 2), 6);
  hud.addChild(bar);

  const cp = new Container(), cw = 66, chh = 27;
  cp.addChild(pixel(renderPanel(cw, chh, st)), pixel(renderWorker(st)[0].canvas, 3, 4));
  const tCol = label('', fs - 1), tIdle = label('', fs - 2, 0xc8c2d6, '500');
  tCol.position.set(17 * Z, 4 * Z); tIdle.position.set(17 * Z, 14 * Z);
  cp.addChild(tCol, tIdle);
  cp.position.set(8, app.screen.height - chh * Z - 8);
  hud.addChild(cp);

  const plates = scene.blds.map((b) => {
    const tx = label(b.info.name, fs - 1);
    const w = Math.ceil(tx.width / Z) + 8;
    const c = new Container();
    c.addChild(pixel(renderPanel(w, 11, st, 'plate')), tx);
    tx.anchor.set(0.5); tx.position.set((w * Z) / 2, 5.5 * Z);
    c.pw = w; c.b = b;
    hud.addChild(c);
    return c;
  });
  scene.hud = { nums, tCol, tIdle, plates, sel: null, bar: { x: bar.x, y: bar.y, w: pw * Z, h: ph * Z } };
  renderTotals(); updateColonists();
}
function renderTotals() {
  if (!scene?.hud) return;
  for (const [k, tx] of Object.entries(scene.hud.nums)) tx.text = fmt(totals[k] || 0);
}
function updateColonists() {
  if (!scene?.hud) return;
  const idle = scene.workers.filter((w) => w.ai.idle).length;
  scene.hud.tCol.text = `殖民者 ${scene.workers.length}`;
  scene.hud.tIdle.text = `閒置 ${idle}`;
}
function closePanel() {
  if (scene?.hud?.sel) { scene.hud.sel.destroy({ children: true }); scene.hud.sel = null; }
  selected = null;
}
function openPanel(b) {
  closePanel();
  selected = b;
  const st = state.stage, fs = Z >= 3 ? 16 : Z >= 2 ? 13 : 10, w = 86, h = 42;
  const c = new Container();
  c.addChild(pixel(renderPanel(w, h, st)));
  const title = label(`${b.info.name}  Lv${state.level}`, fs); title.position.set(6 * Z, 4 * Z);
  c.addChild(title);
  if (b.site.hub) {
    const t = label('殖民地中心 · 工人會把資源運回這裡', fs - 3, 0xc8c2d6, '500'); t.position.set(6 * Z, 19 * Z);
    c.addChild(t);
  } else {
    const lw = label('工人', fs - 1, 0xc8c2d6, '500'); lw.position.set(6 * Z, 17 * Z);
    const minus = pixel(renderPanel(9, 9, st, 'button', '-'), 36, 17), plus = pixel(renderPanel(9, 9, st, 'button', '+'), 64, 17);
    const cnt = label(String(b.workers), fs - 1); cnt.anchor.set(0.5); cnt.position.set(54.5 * Z, 21.5 * Z);
    c.addChild(lw, minus, pixel(renderPanel(17, 9, st, 'inset'), 46, 17), plus, cnt);
    for (const [btn, d] of [[minus, -1], [plus, 1]]) {
      btn.eventMode = 'static'; btn.cursor = 'pointer';
      btn.on('pointerdown', (e) => { e.stopPropagation(); setWorkers(b, b.workers + d); cnt.text = String(b.workers); });
    }
  }
  const rate = label(`點擊 +${fmt(tapValue(b))} ${RES[b.info.res].name}${state.buff ? '（Buff ×2）' : ''}`, fs - 3, b.info.color, '500');
  rate.position.set(6 * Z, 30 * Z);
  c.addChild(rate);
  c.eventMode = 'static';
  c.on('pointerdown', (e) => e.stopPropagation());
  c.pw = w; c.ph = h; c.b = b;
  hud.addChild(c);
  scene.hud.sel = c;
}

app.ticker.add((tk) => {
  if (!scene) return;
  const dt = Math.min(0.05, tk.deltaMS / 1000);
  T += dt;
  world.scale.set(Z);
  world.position.set(-cam.x * Z, -cam.y * Z);
  for (const b of scene.blds) {
    b.update(T, dt);
    b.squash *= Math.pow(0.0008, dt);
    const q = b.squash;
    b.sprite.scale.set(1 + 0.08 * q, 1 - 0.1 * q);
    b.flashSprite.scale.copyFrom(b.sprite.scale);
    if (state.buff) b.ring.update(T);
  }
  for (const p of scene.props) p.update(T, dt);
  scene.ambient.update(T, dt);
  for (const w of scene.workers) updateWorker(w, dt);
  if (hold) { hold.next -= dt; if (hold.next <= 0) { tap(hold.b); hold.next = 0.11; } }
  for (const pl of scene.hud.plates) {
    const [sx, sy] = toScreen(pl.b.x, pl.b.y - pl.b.art.ay - 2);
    pl.position.set(Math.round(sx - (pl.pw * Z) / 2), Math.round(sy - 11 * Z));
    const br = scene.hud.bar;
    pl.visible = !(pl.y < br.y + br.h + 2 && pl.x + pl.pw * Z > br.x && pl.x < br.x + br.w);
  }
  const sel = scene.hud.sel;
  if (sel) {
    const b = sel.b, [sx, sy] = toScreen(b.x + b.art.canvas.width - b.art.ax + 4, b.y - b.art.ay);
    let x = sx, y = sy;
    if (x + sel.pw * Z > app.screen.width - 6) x = toScreen(b.x - b.art.ax - 4, 0)[0] - sel.pw * Z;
    sel.position.set(Math.round(clamp(x, 6, app.screen.width - sel.pw * Z - 6)), Math.round(clamp(y, 30 * Z, app.screen.height - sel.ph * Z - 6)));
  }
  fx.update(dt);
});

new ResizeObserver(() => {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h || (w === app.screen.width && h === app.screen.height)) return;
  app.renderer.resize(w, h);
  app.stage.hitArea = app.screen;
  const nz = zoomFor(w);
  if (nz !== Z) { Z = nz; fx = createFx(fxLayer, Z); }
  clampCam();
  if (scene) { const s = selected; buildHud(); if (s) openPanel(s); }
}).observe(host);

buildScene();

// ── 圖鑑與色票（純 canvas，不佔 WebGL） ──
async function renderCatalog() {
  const root = $('catalog');
  for (let s = 1; s <= 6; s++) {
    const P = STAGES[s], defs = stageBuildings(s);
    const group = document.createElement('div');
    group.className = 'stage-group';
    group.innerHTML = `<div class="group-head"><h3><span class="n">${s}</span> ${P.name}</h3><span class="mood">${P.mood} · ${defs.length} 棟</span></div><div class="grid"></div>`;
    root.appendChild(group);
    const grid = group.querySelector('.grid');
    for (const d of defs) {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'card';
      card.setAttribute('aria-label', `${d.name}，在場景中查看階段 ${s}`);
      const c = hex(RES[d.res].color);
      card.innerHTML = `<div class="card-head"><div class="title"><strong>${d.name}${d.hub ? '<em>核心</em>' : ''}</strong><code>${d.id}</code></div><span class="chip"><i class="dot" style="background:${c};color:${c}"></i>${RES[d.res].name}</span></div><div class="levels">${[1, 3, 5].map((lv) => `<div class="lv" data-lv="${lv}"><div class="ph"></div><span>LV${lv}</span></div>`).join('')}</div>`;
      card.addEventListener('click', () => { state.stage = s; buildScene(); host.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
      grid.appendChild(card);
      for (const lv of [1, 3, 5]) {
        const slotEl = card.querySelector(`.lv[data-lv="${lv}"]`);
        const cv = renderThumb(d.id, lv, 3);
        slotEl.replaceChild(cv, slotEl.querySelector('.ph'));
      }
      await nextFrame();
    }
  }
}

function propStrip(stage) {
  const W = 170, H = 44, S = 2;
  const out = document.createElement('canvas');
  out.width = W * S; out.height = H * S;
  const g = out.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(renderGroundPatch(stage, W, H), 0, 0, W * S, H * S);
  const items = [['tree', 20], ['tree', 44], ['rock', 66], ['bush', 86], ['lamp', 104], ['crate', 122]];
  items.forEach(([kind, x], i) => {
    const a = renderProp(kind, stage, i * 31 + stage);
    g.drawImage(a.canvas, (x - a.ax) * S, (38 - a.ay) * S, a.canvas.width * S, a.canvas.height * S);
  });
  const fr = renderWorker(stage);
  [0, 1, 2].forEach((f, i) => g.drawImage(fr[f].canvas, (140 + i * 10 - fr[f].ax) * S, (38 - fr[f].ay) * S, 13 * S, 17 * S));
  return out;
}

function renderLegend() {
  $('legend').innerHTML = '';
  for (const [k, r] of Object.entries(RES)) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const ic = renderIcon(k); ic.className = 'icon';
    chip.append(ic, document.createTextNode(r.name));
    const code = document.createElement('code'); code.textContent = hex(r.color);
    chip.appendChild(code);
    $('legend').appendChild(chip);
  }
  $('palettes').innerHTML = '';
  for (let s = 1; s <= 6; s++) {
    const P = STAGES[s];
    const row = (cs) => `<div class="row">${cs.map((c) => `<i title="${hex(c)}" style="background:${hex(c)}"></i>`).join('')}</div>`;
    const card = document.createElement('div');
    card.className = 'pal';
    card.innerHTML = `<div class="lbl"><strong>${s} · ${P.name}</strong><span>${P.mood}</span></div>${row([...P.ground, ...P.path])}${row([P.hull, P.trim, P.tarp, P.tree, ...P.flora, P.window, P.light])}`;
    const strip = propStrip(s); strip.className = 'strip';
    card.appendChild(strip);
    $('palettes').appendChild(card);
  }
}

renderLegend();
renderCatalog();
