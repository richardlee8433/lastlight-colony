# Lastlight Colony — Chapter 3 Building Sprites (Engineering Era)

## Instructions for the image AI

You will create **6 building sprites** for a pixel-art colony sim, **one image per message, in the order listed below**.

- After each image, stop and wait for the user to say **"next"** (or give feedback) before making the next one.
- If the user gives feedback, redo the same building before moving on.
- Every image must follow the **Style Rules**. Keep the style identical across all 6 images, as if one artist drew them all as one set.
- These buildings belong to the same world as an earlier set of salvage-era buildings. If the user attaches images from that set, **match their camera angle, pixel size, outline weight, lighting and level of wear**. Only the building style changes (see "Engineering-era look").
- Use the file name shown for each building (for example `14_metal_mine.png`).

## Style Rules (apply to every image)

```
low resolution pixel art game building sprite, about 64 pixels wide, chunky pixels, bold simple shapes readable at small size,
single building centered, front-facing top-down view like Stardew Valley buildings, camera looking down from the south,
front wall faces the viewer squarely, only the roof and front face visible, no side walls, not isometric, not rotated,
light from top-left, crisp dark outline, limited color palette,
transparent background, no ground, no text, no letters, no logos, no people, no fire, no smoke,
sci-fi colony on a red desert planet with no breathable air, cozy colony sim style like Hearth and Hamlet
```

**Engineering-era look** (all 6 buildings are from this era — the best the colonists can build with their own know-how):

```
standardized prefab modular building, the colonists' own engineering at its best, clean off-white and light-grey panels with rivets,
one color-coded stripe per building, neat right angles, rounded panel corners, industrial hatches and airlock doors,
status LED lights, organized pipes in brackets, sturdy and uniform, lightly dusty but well maintained,
a few leftover salvage touches (a patched tarp or an old crate) so it still feels like the same colony
```

- **Engineering era vs. salvage era:** the colonists can now manufacture parts to a standard. Panels match and fit together, pipes run neatly, and there are far fewer tarps and scraps than before. It is still a frontier colony, though: dusty, practical and a little worn, not shiny.
- **No oxygen on this planet:** never draw fire, flames, torches or dark smoke. To show that a machine is running, use white steam puffs, electric sparks, glowing furnace windows, LED lights or screen glow.
- **Signature color:** each building has one signature color. Use it for the stripe, the lights and the key machine parts, and keep everything else off-white, light grey and rust.
- **Size:** small buildings fill about half the canvas; large buildings (command modules) fill about three quarters.

---

## The buildings, in order

### 14 — Metal Mine · `14_metal_mine.png`
Signature color: orange · Size: medium
```
[Style Rules] + [Engineering-era look] +
mining derrick tower of neat steel girders over a square shaft opening, a hoist cable and ore bucket,
a short conveyor carrying grey-blue metal ore to a hopper, orange stripe on the machine housing, amber work lights
```

### 15 — Forge · `15_forge.png`
Signature color: orange · Size: medium
```
[Style Rules] + [Engineering-era look] +
sealed electric smelter building with thick insulated walls, a round glowing orange furnace window on the front,
a small crucible pouring glowing metal into molds, stacked metal ingots and tools on a rack, electric sparks,
white steam from a vent (no smoke, no flames)
```

### 16 — Expedition Station · `16_expedition.png`
Signature color: orange with a teal accent · Size: medium
```
[Style Rules] + [Engineering-era look] +
expedition garage with a wide open roll-up door, a six-wheeled exploration rover parked in front of it,
a tall radio mast with a small dish, supply racks with crates and gas cylinders, a teal holographic map screen by the door
```

### 17 — Tech Institute · `17_databank.png`
Signature color: purple · Size: medium
```
[Style Rules] + [Engineering-era look] +
research building with server racks visible behind a wide glass window, blinking purple and white lights,
a satellite dish on the roof, a small lab bench with glowing purple screens, purple stripe along the walls
```

### 18 — Rail Line · `18_rail_line.png`
Signature color: grey with yellow · Size: medium, wide and low
```
[Style Rules] + [Engineering-era look] +
short straight section of monorail track on support pylons running left to right, a small boxy cargo car sitting on the track,
a little platform with a yellow-striped edge and a signal light
```

### 19 — Outpost (command Lv3) · `19_outpost.png`
Signature color: off-white with red · Size: large
```
[Style Rules] + [Engineering-era look] +
fortified command outpost built around the earlier domed hub, reinforced modular walls, a tall watchtower with a searchlight
and a rotating radar dish, main airlock door facing the viewer, floodlights at the corners, red warning stripes
```

---

When all 6 are done, send them back as a set. They will be cut out and scaled down to about 64 pixels wide for the game.
