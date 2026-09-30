# 建築美術需求（給繪圖工具／畫師）

## 三個時期

| 時期 | 出現時機 | 風格 |
|---|---|---|
| **A 拼裝期** | 第 1～2 章蓋的建築（Lv1～2） | 用逃生艙殘骸拼出來：補丁鐵皮、顏色不一的板子、外露管線、帆布、束線帶、歪斜的天線 |
| **B 藍圖期** | 第 3 章起新蓋的建築；舊建築到第 3 章後升到 Lv3 也換成這個 | 照藍圖生產的標準模組：統一的淺灰面板、鉚釘、分類色條、方正整齊、工業感 |
| **C 殖民地期** | 第 5～6 章的建築；舊建築到第 6 章後升到 Lv5 也換成這個 | 有餘裕講究的永久建築：石材基座、玻璃圓頂、弧線造型、柔和的室內燈光 |

同一棟建築換時期時，**輪廓和代表色不變**，只換材質與細節，玩家升級後才認得出是哪一棟。

**代表色：**
- 氧氣：藍
- 營養：綠
- 工業：橘
- 研究：紫
- 軍事：紅
- 居住：暖白

## 共同規格

- **格式：**一張圖一棟建築，置中，**透明背景**，沒有透明背景就用純色平背景。建議 1024×1024。
- **視角：**高角度的俯視 3/4 視角，跟殖民者小人和地圖素材相同，約 60° 往下看，看得到屋頂和正面。**不要**等角（isometric）。
- **光源：**左上方。陰影落在右下，只畫建築本身，不要畫地面。
- **畫風：**像素風，深色外框，有限色盤，跟小人同一套風格。
- **世界觀：**沒有氧氣的外星沙漠，所以**不能有火焰、煙、火把**。要表現運作中，就用白色蒸氣、電火花、LED 燈、螢幕光。
- **不要**出現文字、字母、標誌、人物。

## 共通提示詞（每張都加在最前面）

```
pixel art game building sprite, single building centered, high top-down three-quarter view (about 60 degrees),
roof and front face visible, not isometric, light from top-left, crisp dark outline, limited color palette,
transparent background, no ground, no text, no people, no fire, no smoke,
sci-fi colony on a red desert planet with no breathable air, cozy colony sim style like Hearth and Hamlet
```

## 時期提示詞（接在共通提示詞後面）

**A 拼裝期：**
```
makeshift survival structure salvaged from a crashed escape pod, mismatched patched metal sheets, riveted scraps,
exposed pipes and cables, canvas tarps, zip ties, dented panels, crooked antenna, improvised but functional, worn and dusty
```

**B 藍圖期：**
```
standardized prefab modular building built from blueprints, clean light-grey panels with rivets, color-coded stripe,
neat right angles, industrial hatches, status LED lights, organized pipes, sturdy and uniform
```

**C 殖民地期：**
```
permanent refined colony architecture, stone block foundation, curved walls, glass dome or large windows,
warm interior lights, elegant and calm, well maintained, advanced but homely
```

---

## 建築清單

每棟建築的提示詞接在「共通提示詞＋時期提示詞」後面。先從第 1 章的五棟開始，確定風格後再往下做。

### 第 1 章

| 建築 | 時期 | 提示詞 |
|---|---|---|
| 逃生艙 escape_pod | 只有 A | `crashed white escape pod capsule half buried in sand, cracked hull, open hatch, blinking amber beacon light, small solar panel propped beside it` |
| 廢料堆 scrap_heap | 只有 A | `pile of twisted spaceship wreckage and hull fragments, bent girders, torn panels, loose bolts, a few salvaged crates` |
| 氧氣再生器 o2_scrubber | A | `blue oxygen scrubber machine cobbled together, boxy tank with cylindrical filters, noisy fan grille, taped hoses, white vapor puff, blue indicator lights` |
| | B | `blue oxygen processing unit, clean cylindrical filter towers, blue stripe, gauges, tidy pipe manifold, soft white vapor` |
| 電解站 o2_scrubber 改建 | B | `blue electrolyzer with a drill rig boring into the ground, ice melting tanks, glowing blue electrolysis cells, white vapor` |
| 藻類槽 algae_tank | A | `row of three glass vats with bubbling bright green algae, mismatched metal frames, patched hoses, small pump` |
| | B | `green algae bioreactor, clean glass tubes in a rack, green stripe, pumps and control panel, glowing green liquid` |
| 生質採集站 algae_tank 改建 | B | `green bio harvester, algae vats plus stacked culture racks with growing organic samples, green grow lights` |
| 水耕農場 algae_tank 改建 | C | `pressurized glass greenhouse dome with rows of leafy green vegetables in hydroponic trays, stone base, warm grow lights` |
| 緊急營地 emergency_camp | A | `cluster of inflatable white pressurized domes connected by short tunnels, radiant heater unit, airlock door, patched fabric, cables on the ground` |

### 第 2 章

| 建築 | 時期 | 提示詞 |
|---|---|---|
| 居住艙 hab_pod | A | `small warm-white living pod made from a repurposed cargo container, round windows, patched roof, ladder, cozy light inside` |
| | B | `modular warm-white habitat units stacked together, round windows, standard airlock, tidy railings` |
| | C | `comfortable residential building with stone base, curved walls, big warm windows, small balcony garden` |
| 補給倉 cargo | A | `stack of salvaged cargo crates under a tarp roof, mismatched containers, orange straps` |
| | B | `orange-striped warehouse with a gantry crane over neatly stacked shipping containers` |
| 休閒艙 lounge | A | `small lounge pod with a hand-painted awning, mismatched chairs visible through a window, string of LED lights` |
| | B | `modular lounge module with big window, purple and pink screen light, tidy bench outside` |
| 岩石切割站 rock_cutter | A | `improvised rock cutting rig, circular saw blade on a scrap frame, stone blocks piled beside it` |
| | B | `industrial stone cutting machine, orange stripe, conveyor belt, neat stacks of cut stone blocks` |
| 組裝站 assembly | A | `makeshift workshop shed with a workbench, robotic arm made from scrap, hanging tools` |
| | B | `clean assembly plant, orange stripe, robotic arms, conveyor, stacked machine parts` |
| 中央艙 central_hub | B | `central command module, large white building with a light-blue dome roof, antenna mast, main airlock, lights along the base` |

### 第 3～4 章（藍圖期）

| 建築 | 提示詞 |
|---|---|
| 金屬礦 metal_mine | `mining derrick tower over a shaft, ore buckets, conveyor to a hopper, orange stripe` |
| 鍛造爐 forge | `sealed electric smelter, glowing orange furnace window, heavy insulated walls, sparks, white steam vent, no smoke` |
| 遠征站 expedition | `expedition garage with a six-wheeled rover parked outside, radio mast, supply racks` |
| 資料庫 databank | `purple-striped data center module, server racks behind glass, blinking lights, satellite dish` |
| 前哨站 outpost | `fortified command outpost, reinforced walls, watch tower, radar dish, floodlights` |
| 軌道線 rail_line | `short monorail track segment with a small cargo car on it, support pylons` |
| 殖民地核心 colony_core | `large central colony core building, layered modules around a tall tower, glowing core light` |
| 晶體合成站 crystal_synth | `crystal synthesis plant, glass chambers growing violet crystals, purple glow` |
| 醫療站 med_bay | `white medical bay with red cross panel, clean windows, stretcher ramp` |
| 紀念碑 memorial | `quiet memorial monument, stone pillar with small LED candles and a metal plaque, no text` |
| 保全站 security | `red-striped security station, armored door, weapon rack, searchlight` |
| 水循環站 water_cycle | `water recycling plant, blue tanks and filtration columns, clear pipes with water` |

### 第 5～6 章（殖民地期）

| 建築 | 提示詞 |
|---|---|
| 行政中心 admin | `elegant administration hall, stone steps, tall glass facade, flag pole without flag` |
| 太空港 spaceport | `landing pad with a small shuttle, control tower, fuel tanks, landing lights` |
| 星城穹頂 star_dome | `grand glass star dome over a small city, stone ring base, warm lights inside` |
| 貿易站 trade_post | `open market building with awnings and crates of goods, warm lights` |
| 砲塔 turret | `automated laser turret on a stone base, red targeting light` |
| 異星研究院 xeno_lab | `xenology research lab, violet glass containment dome with a glowing alien plant specimen` |
| 生物工程實驗室 bioeng | `bioengineering lab with green and violet glass tanks, delicate pipes, soft glow` |
| 總督府 governor | `governor residence, stately stone building with curved glass roof, garden terrace` |
| 天際住宅 sky_residence | `tall elegant residential tower with balconies and warm windows, stone base` |
| 軌道信標 orbital_beacon | `tall slender beacon tower with a glowing light at the top, stone and metal base, antenna rings` |

---

## 建議的做法

1. **先定風格：**用氧氣再生器做 A、B 兩張，確認同一棟建築換時期後還認得出來，再往下做。
2. **一次一棟：**一張圖只放一棟建築，比較好裁切，也方便之後調整大小。
3. **統一比例：**居住艙之類的小建築大約佔畫面 1/2；指揮建築、星城穹頂之類的大建築大約佔畫面 3/4。
