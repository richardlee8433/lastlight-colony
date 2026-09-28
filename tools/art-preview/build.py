import re, sys, html
local = len(sys.argv) > 1 and sys.argv[1] == 'local'
import os
HERE = os.path.dirname(os.path.abspath(__file__))
art = open(os.path.join(HERE, '../../src/art/art.js')).read()
art = re.sub(r"^import \{[^}]*\} from 'pixi.js';\n", "", art, flags=re.M)
art = re.sub(r"^export ", "", art, flags=re.M)
prev = open(os.path.join(HERE, 'preview.js')).read()
bundle = "(async () => {\nconst { Application, Container, Graphics, Sprite, Text, Texture, Rectangle } = PIXI;\n" + art + "\n" + prev + "\n})().catch((e) => console.error(e));"
snippet = """import { Application, Container } from 'pixi.js';
import { planMap, createGround, createBuilding, createProp, STAGES } from './art.js';

const app = new Application();
await app.init({ width: 960, height: 540, antialias: false, roundPixels: true });

const Z = 2;                                    // 1 個美術像素 = 2 個螢幕像素
const world = new Container();                  // 以美術像素為單位
const objects = new Container();                // 建築、道具、工人：依 y 排序
const lights = new Container();                 // 發光層
objects.sortableChildren = true;
world.scale.set(Z);
world.addChild(objects, lights);
app.stage.addChild(world);

const plan = planMap(3, 720, 420);              // 階段 3 的地圖配置
world.addChildAt(createGround(3, plan), 0);
for (const s of plan.sites) {
  const b = createBuilding(s.id, 5);            // Lv5 外觀
  b.position.set(s.x, s.y); b.zIndex = s.y;
  b.lights.position.set(s.x, s.y);
  objects.addChild(b); lights.addChild(b.lights);
}

let t = 0;
app.ticker.add((tk) => {
  const dt = tk.deltaMS / 1000; t += dt;
  for (const b of objects.children) b.update?.(t, dt);   // 燈號、火光、煙
});"""
esc = html.escape(snippet)
esc = re.sub(r"(//[^\n]*)", r'<span class="c">\1</span>', esc)
tpl = open(os.path.join(HERE, 'preview.template.html')).read()
out = tpl.replace('__SNIPPET__', esc).replace('__BUNDLE__', bundle)
out = out.replace('__PIXI_SRC__', 'pixi.min.js' if local else 'https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.js')
open(os.path.join(HERE, 'local-test.html' if local else 'art-preview.html'),'w').write(out)
print(len(out))
