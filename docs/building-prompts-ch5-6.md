# Lastlight Colony — Chapter 5–6 Building Sprites (Colony City Era)

## Instructions for the image AI

You will create **11 building sprites** for a pixel-art colony sim, **one image per message, in the order listed below**.

- After each image, stop and wait for the user to say **"next"** (or give feedback) before making the next one.
- If the user gives feedback, redo the same building before moving on.
- Use the file name shown for each building (for example `admin.png`).

### What this set is about

The colony has grown into a small city. It now builds in **three different styles**, and the player should be able to tell them apart at a glance:

1. **Colony-made (city):** the colonists' own buildings. They continue the clean pearl-white materials of the previous set, but feel more civic, settled and lived-in: warm amber windows, plants, banners without text.
2. **Corporate:** built by an off-world mining corporation. Cold, standardized, prefabricated, efficient, a little unfriendly.
3. **Xenotech:** built from alien blueprints the colonists don't fully understand. Each of these buildings is a **human structure fused with alien technology**: human steel frames, cables and workbenches joined to flowing alien shells. The alien part grows larger from building to building, as the "alien share" for each one shows.

**Don't** copy the look of any existing game. Build the alien style only from the descriptions below.

### Keep consistent with the earlier sets

The user may attach images from the earlier buildings. **Match them exactly in camera angle, pixel size, outline weight, lighting direction and shadow style.** Only the construction style and materials change. It must look like the same game, drawn by the same artist.

## Style Rules (apply to every image)

```
low resolution pixel art game building sprite, about 64 pixels wide, chunky pixels, bold simple shapes readable at small size,
single building centered, front-facing top-down view like Stardew Valley buildings, camera looking down from the south,
front wall faces the viewer squarely, only the roof and front face visible, no side walls, not isometric, not rotated,
light from top-left, crisp dark outline, limited color palette,
transparent background, no ground, no text, no letters, no logos, no people, no fire, no smoke,
sci-fi colony on a red desert planet with no breathable air, cozy colony sim style like Hearth and Hamlet
```

**Colony city look** (buildings marked "city"):

```
mature colony city building, smooth pearl-white curved shell panels with a few visible seams,
warm amber lit windows, thin teal light lines, small planters with green plants, simple cloth banners with no text,
civic and lived-in, practical but proud, a few small human touches (benches, crates, a lamp post)
```

**Corporate look** (buildings marked "corporate"):

```
high-tech corporate outpost from a powerful interstellar company, sleek angular armored panels in cold gunmetal and blue-grey,
sharp chamfered edges and hexagonal plating, glowing cyan light strips in precise straight lines,
standardized modular design that looks mass-produced in an orbital factory, holographic display panels with no text,
a blank glowing sign panel with no logo or text, cool white and cyan light,
far more advanced than a modern warehouse, efficient and impersonal, clearly not built by the colonists
```

**Xenotech look** (buildings marked "xeno", with the alien share given for each):

```
human-built structure fused with alien technology, human steel frame, cables and work tools on one side,
joined to a flowing alien shell with water-like curved lines, pearl-white surface with a faint rainbow sheen,
softly glowing violet crystals, thin pale gold trim, floating segments held in place by violet light
```

### Color and material guide

| Style | Main material | Accent colors | Construction |
|---|---|---|---|
| Earlier chapters (for reference only) | worn cream-white metal, then clean pearl white | orange, rust, teal, violet | rivets → seamless curved panels |
| **City** | pearl white | **warm amber windows, teal, green plants** | curved panels, civic details |
| **Corporate** | **cold gunmetal and blue-grey armor** | cyan light strips, holograms, a little yellow-black | angular, chamfered, mass-produced modules |
| **Xeno** | pearl white with a rainbow sheen | **violet crystal glow, pale gold trim** | flowing water-like curves joined to a human frame |

- **No oxygen on this planet:** never draw fire, flames, torches or dark smoke. Use crystal glow, energy lines, LED light, screen glow or white vapor.
- **Size:** small buildings fill about half the canvas; large buildings (command modules and the beacon) fill about three quarters.

---

## The buildings, in order

### 1 — Hydroponic Farm (Chapter 4 food building) · `hydro_farm.png`
Style: **Blueprint-era, adapted** (the same look as the previous set's Med Bay and Water Recycler) · Size: medium
```
[Style Rules] +
colony building rebuilt with new high-tech materials, smooth pearl-white curved shell panels with only a few visible seams,
thin glowing teal energy lines, a small violet crystal power cell, cleaner and more elegant than older colony buildings +
hydroponic farm, a long curved glass greenhouse roof over stacked rows of bright green leafy plants,
soft pink-white grow lights inside, clear water channels along the base, a few seed crates and a watering hose beside it
```

### 2 — Administration Center · `admin.png`
Style: **city** · Size: medium
```
[Style Rules] + [Colony city look] +
administration center, a wide two-level civic building with a curved pearl-white front,
a balcony over the main door, a row of amber windows, a small antenna on the roof,
a notice board with blank paper notes beside the door, a bench and a planter in front
```

### 3 — Trade Post · `trade_post.png`
Style: **corporate** · Size: medium
```
[Style Rules] + [Corporate look] +
futuristic corporate trade post, a sleek angular gunmetal hub with a tall chamfered front,
a wide cargo gate sealed by a glowing cyan energy field instead of a door,
sealed hexagonal cargo pods hovering above small anti-gravity pads beside it,
a holographic trade screen with abstract charts and no text floating by the gate,
a small automated drone dock on the roof with a parked delivery drone, thin yellow-black warning stripes on the ground plates
```

### 4 — Spaceport · `spaceport.png`
Style: **city** · Size: large
```
[Style Rules] + [Colony city look] +
small colony spaceport, a round landing pad with teal guide lights, a short control tower with an amber-lit window,
a tall communication dish pointed at the sky, mismatched cargo crates from different places stacked beside the pad,
a patched fuel line and a small handmade windsock pole
```

### 5 — Defense Turret · `turret.png`
Style: **xeno**, alien share about 50% · Size: small
```
[Style Rules] + [Xenotech look] +
defense turret, a squat human-built steel base with sandbag-style barriers and an ammo crate,
topped by a smooth flowing alien turret head with a long tapered barrel,
a violet crystal glowing at the back of the barrel, thin pale gold trim on the barrel
```

### 6 — Xeno Research Institute · `xeno_lab.png`
Style: **xeno**, alien share about 50% · Size: medium
```
[Style Rules] + [Xenotech look] +
xeno research lab, the left half a human lab module with a big window, monitors and a cluttered workbench,
the right half a flowing alien pod with water-like curves, holding a floating violet crystal under a glass dome,
human cables and sensor clamps attached to the alien pod, a microscope and specimen jars by the door
```

### 7 — Star Dome (command Lv5) · `star_dome.png`
Style: **city** · Size: large
```
[Style Rules] + [Colony city look] +
large colony command dome, a huge transparent glass dome on a wide pearl-white ring base,
inside the dome small trees, green parks and tiny amber-lit houses are visible,
the older colony core tower rising through the center of the dome, a grand main gate facing the viewer
```

### Chapter 6 (redraw with the chapter 5 sheet as reference)

The chapter 5 buildings were drawn as one sheet (`art-src/buildings/sheet-ch5.webp`), and chapter 6 must match it. **Attach the chapter 5 sheet and the first chapter 6 attempt as references.** Then draw the four buildings below in one sheet, 2 × 2, in this order: Governor's Hall, Sky Residence, Bioengineering Lab, Orbital Beacon.

Shared instructions for the whole sheet:

```
Redraw these four buildings as one 2x2 sheet, matching the attached chapter 5 sheet exactly:
same front-facing top-down camera, same pixel density, same outline weight, same light from top-left,
same palette of warm pearl-white stone panels, dark graphite frames, blue banners with a gold emblem, blue glowing light strips,
small spires topped with blue or white LED light columns (never candle flames, never fire),
plain white background, each building separated with plenty of empty space, no text, no letters
```

### 8 — Governor's Hall · `governor.png`
Style: **city** · Size: medium

Keep from the first attempt: the symmetrical front, the wide staircase, the blue banners, the planters and the violet crystal fountains by the stairs.
Change: it reads as a cathedral or royal palace. Make it calmer and more civic: fewer and shorter spires, a lower and wider front, more windows, a small public plaza in front.
```
governor's hall, a dignified civic building with a symmetrical pearl-white front, lower and wider than a palace,
only one modest central tower and two short side spires, tall columns made of smooth curved panels,
a wide staircase up to a warm amber-lit main door, two blue banners with the gold emblem,
a row of amber windows across the front, a small plaza in front with benches, planters and two small violet crystal fountains,
calm and proud, a place where colonists meet, not a royal palace or a cathedral
```

### 9 — Sky Residence · `sky_residence.png`
Style: **city** · Size: medium

Keep from the first attempt: the rings of round apartment pods, the many amber windows, the rooftop gardens and the sky bridges.
Change: make it taller and more clearly a home. Add balconies with hanging plants and laundry lines, and a transparent canopy roof on top.
```
tall residential tower, stacked rounded pearl-white apartment pods rising in three tiers, many warm amber windows,
small balconies with hanging plants and laundry lines between them, rooftop gardens on every tier,
thin glass sky bridges glowing blue between the pods, a large transparent glass canopy roof over the top tier,
a small ground-floor door with a cargo cart, planters and a bench, lived-in and cozy, less like a fortress
```

### 10 — Bioengineering Lab · `bioeng.png`
Style: **xeno**, alien share about 70% · Size: medium

Keep from the first attempt: the glass tanks and the glowing green life inside them.
Change: it looks like a city greenhouse. It should look **mostly not made by humans**: a flowing alien structure with water-like curves, a faint rainbow sheen and violet crystals. Only the base keeps a few human parts.
```
bioengineering lab that looks mostly alien, a flowing organic structure with smooth water-like curves and no straight walls,
pearl-white surface with a faint rainbow sheen, thin pale gold trim, curved segments that float slightly apart held by violet light,
three tall curved glass tanks filled with glowing green liquid, violet crystal shards floating inside each tank,
soft violet light pulsing between the tanks,
only at the base: a small human control desk with monitors, a few graphite metal brackets, cables plugged into the alien shell and a supply crate,
keep the same palette as the chapter 5 sheet so it still belongs to the same colony
```

### 11 — Orbital Beacon · `orbital_beacon.png`
Style: **xeno**, alien share about 70% (the most alien building in the game) · Size: large

Keep from the first attempt: the orbiting rings, the violet energy core, the crystals at the base.
Change: **remove the light beam** (the game draws the beam when the beacon is lit; until then it must look unlit). The spire should look less like a city tower and more like a flowing alien spire with segments floating apart. Add human scaffolding around the base, because the colonists are still building it.
```
orbital beacon, a very tall slender flowing spire made of smooth water-like curved segments,
several segments floating apart from each other, held in place by soft violet light,
two thin rings orbiting around the spire, a large violet crystal core near the top, glowing softly,
pale gold lines spiraling up the spire, pearl-white surface with a faint rainbow sheen,
the very top of the spire is dark and inactive, no light beam, no beam of light going up into the sky,
at the base: human-built graphite scaffolding, ladders, cables, a work platform and supply crates around the alien spire,
two small violet crystals on pedestals in front
```

---

When all 11 are done, send them back as a set. They will be cut out and scaled down to about 64 pixels wide for the game.
