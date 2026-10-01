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
corporate prefab building, boxy standardized modules in cold blue-grey steel, flat roofs, rows of identical small windows,
yellow and black hazard stripes, a blank square sign panel with no logo or text, cool white floodlights,
efficient and impersonal, clearly not built by the colonists
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
| **Corporate** | **cold blue-grey steel** | yellow-black stripes, cool white light | boxy prefab modules |
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
trade post, a boxy blue-grey prefab warehouse with a wide roll-up cargo door,
stacked standardized shipping containers beside it, a small landing pad for cargo drones on the roof,
a blank sign panel over the door, a weighing scale platform with yellow-black stripes in front
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

### 8 — Governor's Hall · `governor.png`
Style: **city** · Size: medium
```
[Style Rules] + [Colony city look] +
governor's hall, a dignified civic building with a symmetrical pearl-white front, tall columns made of smooth curved panels,
a wide staircase up to the main door, two cloth banners with no text, a small round window above the door,
planters on both sides, calm and proud but not grand or royal
```

### 9 — Sky Residence · `sky_residence.png`
Style: **city** · Size: medium
```
[Style Rules] + [Colony city look] +
tall residential tower, stacked rounded pearl-white apartment pods, many warm amber windows,
small balconies with hanging plants and laundry lines, a transparent canopy roof on top,
a small door with a bicycle-like cart and a planter at the base
```

### 10 — Bioengineering Lab · `bioeng.png`
Style: **xeno**, alien share about 70% · Size: medium
```
[Style Rules] + [Xenotech look] +
bioengineering lab, mostly a flowing alien structure with water-like curves and a rainbow sheen,
three tall glass tanks filled with glowing green liquid and floating violet crystal shards,
violet light pulsing between the tanks, only a small human control desk and a few cables at the base
```

### 11 — Orbital Beacon · `orbital_beacon.png`
Style: **xeno**, alien share about 70% (the most alien building in the game) · Size: large
```
[Style Rules] + [Xenotech look] +
orbital beacon, a very tall slender flowing spire pointing at the sky, made of smooth water-like curved segments,
some segments floating apart, held in place by violet light, a large violet crystal core near the top,
pale gold lines spiraling up the spire, a human-built scaffold, cables and a work platform around the base,
no light beam, the beam is drawn by the game
```

---

When all 11 are done, send them back as a set. They will be cut out and scaled down to about 64 pixels wide for the game.
