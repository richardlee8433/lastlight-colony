// 工地畫面（v0.71）：全部用程式畫，不用新美術。
//   新建：地基 + 鷹架先出現，建築圖跟著進度由下往上「長」出來（上面是原本的半透明預覽）
//   升級：既有建築外面搭鷹架，進度看腳下的進度環
// 之後想換成手繪的共用工地圖（地基、鋼架、帆布鷹架三張）：呼叫 setSiteArt({ foundation, frame, tarp }) 填入貼圖，
// 有貼圖的部分就用圖、沒有的部分照舊用程式畫；三張圖都以「正面地面中心」為原點，寬度會依建築寬度縮放。
import { Container, Graphics, Sprite, Texture } from 'pixi.js';

export interface SiteArt { foundation?: Texture; frame?: Texture; tarp?: Texture }
const ART: SiteArt = {};
export function setSiteArt(a: SiteArt) { Object.assign(ART, a); }

const C = {
  slab: 0x4a4650, slabHi: 0x6a6672, slabLo: 0x2e2b34,
  pole: 0xb08a4a, poleHi: 0xd8b070, poleLo: 0x7a5a2a,
  steel: 0x9aa4b0, steelHi: 0xc8d0da, stripe: 0xffd24a, stripeDark: 0x2a2630, tarp: 0x6fb0d8,
};

/** 建築圖的尺寸（美術像素；原點＝正面地面中心） */
export interface ArtBox { w: number; h: number; ax: number; ay: number }

function slabSprite(tex: Texture, w: number) {
  const s = new Sprite(tex); s.anchor.set(0.5, 0.5); s.width = w; s.scale.y = s.scale.x; return s;
}

/** 地基：建築腳下一塊壓平的板，寬度跟建築一樣 */
export function drawFoundation(g: Graphics, box: ArtBox, p: number) {
  const w = box.w + 4, x0 = -box.ax - 2, h = 7;
  g.rect(x0, -h / 2 + 1, w, h).fill({ color: C.slab });
  g.rect(x0, -h / 2 + 1, w, 1).fill({ color: C.slabHi });
  g.rect(x0, h / 2, w, 1).fill({ color: C.slabLo });
  // 板上畫幾道格線，剛開工時更明顯
  for (let x = x0 + 4; x < x0 + w - 2; x += 6) g.rect(x, -h / 2 + 2, 1, h - 2).fill({ color: C.slabLo, alpha: 0.5 * (1 - p) + 0.25 });
}

/** 鷹架：兩側木樁、每 7 像素一道橫桿與斜撐，高度領先施工進度一截；頂上一條黃黑警示帶 */
export function drawScaffold(g: Graphics, box: ArtBox, p: number, t: number, upgrade: boolean) {
  const H = box.h, top = Math.min(H, Math.ceil(H * Math.min(1, p + 0.18)) + 6);
  const xl = -box.ax - 2, xr = -box.ax + box.w + 1;
  const pole = upgrade ? C.steel : C.pole, poleHi = upgrade ? C.steelHi : C.poleHi;
  for (const x of [xl, xr]) {
    g.rect(x, -top, 2, top).fill({ color: pole });
    g.rect(x, -top, 1, top).fill({ color: poleHi });
  }
  for (let y = 6; y <= top; y += 7) {
    g.rect(xl, -y, xr - xl + 2, 1).fill({ color: pole });
    // 斜撐：左右交錯
    const dir = ((y / 7) | 0) % 2 ? 1 : -1;
    g.moveTo(dir > 0 ? xl + 1 : xr + 1, -y + 7).lineTo(dir > 0 ? xr + 1 : xl + 1, -y).stroke({ color: C.poleLo, width: 1, alpha: 0.8 });
  }
  // 頂部警示帶（黃黑相間，慢慢流動）
  const y = -top - 1, w = xr - xl + 2, off = Math.floor(t * 6) % 4;
  for (let i = 0; i < w; i++) g.rect(xl + i, y, 1, 1).fill({ color: ((i + off) >> 1) % 2 ? C.stripe : C.stripeDark });
  // 升級：帆布一塊，蓋在中段
  if (upgrade) {
    const th = Math.max(4, Math.floor(H * 0.35));
    g.rect(xl + 2, -Math.floor(H * 0.55), w - 4, th).fill({ color: C.tarp, alpha: 0.35 });
    g.rect(xl + 2, -Math.floor(H * 0.55), w - 4, 1).fill({ color: C.steelHi, alpha: 0.6 });
  }
}

export interface SiteView extends Container {
  art: ArtBox;
  setProgress: (p: number, t: number) => void;
}

/** 新建的工地：地基 + 鷹架 + 預覽 + 由下往上長出的建築。building 是 createBuilding 回來的容器（會被收進來）。 */
export function createSite(building: any, box: ArtBox, upgrade: boolean): SiteView {
  const c = new Container() as SiteView;
  c.art = box;
  const found = ART.foundation ? slabSprite(ART.foundation, box.w + 4) : new Graphics();
  const scaf = new Graphics();
  const tarp = ART.tarp ? slabSprite(ART.tarp, box.w) : null;
  if (tarp) { tarp.anchor.set(0.5, 1); tarp.position.set(box.w / 2 - box.ax, -Math.floor(box.h * 0.2)); tarp.alpha = 0.8; }
  let ghost: any = null, grow: any = null, mask: Graphics | null = null;
  if (!upgrade) {
    // 半透明預覽（原本「選取時顯示會蓋在這裡」的樣子）
    ghost = new Sprite(building.sprite.texture);
    ghost.anchor.copyFrom(building.sprite.anchor); ghost.scale.copyFrom(building.sprite.scale);
    ghost.alpha = 0.28; ghost.tint = 0xb8c0d8;
    grow = building; mask = new Graphics(); grow.mask = mask;
    c.addChild(found, ghost, grow, mask, scaf);
  } else {
    c.addChild(found, scaf);
  }
  if (tarp && upgrade) c.addChild(tarp);
  let last = -1;
  c.setProgress = (p: number, t: number) => {
    const q = Math.max(0, Math.min(1, p));
    if (mask) {
      const hh = Math.ceil(box.h * q);
      mask.clear();
      mask.rect(-box.ax - 2, box.h - box.ay - hh, box.w + 4, hh + 2).fill({ color: 0xffffff });
    }
    // 鷹架每 0.15 秒重畫一次（警示帶流動），進度變了也重畫
    const frame = Math.floor(t * 6);
    if (frame !== last) {
      last = frame;
      if (found instanceof Graphics) { found.clear(); drawFoundation(found, box, q); }
      if (!ART.frame) { scaf.clear(); drawScaffold(scaf, box, q, t, upgrade); }
      else if (!scaf.children.length) { const f = slabSprite(ART.frame, box.w + 4); f.anchor.set(0.5, 1); f.position.set(box.w / 2 - box.ax, 2); scaf.addChild(f); }
    }
  };
  c.setProgress(0, 0);
  return c;
}

/** 進度環：建築腳下一圈像素點，亮的部分＝進度；放在發光層 */
export function createProgressRing(rx: number, ry: number) {
  const g = new Graphics() as Graphics & { update: (p: number, t: number) => void };
  g.blendMode = 'add';
  g.update = (p: number, t: number) => {
    g.clear();
    const N = 36, lit = Math.round(p * N);
    for (let i = 0; i < N; i++) {
      const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * rx), y = Math.round(Math.sin(a) * ry);
      const on = i < lit, head = i === lit && Math.sin(t * 8) > 0;
      g.rect(x, y, 1, 1).fill({ color: on ? 0xffd24a : head ? 0xfff0b0 : 0x6a6050, alpha: on ? (Math.sin(a) > 0 ? 1 : 0.6) : head ? 1 : 0.35 });
    }
  };
  g.update(0, 0);
  return g;
}
