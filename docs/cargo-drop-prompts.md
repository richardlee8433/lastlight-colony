# Lastlight Colony — Magpie Cargo Drop (2 sprites)

## Instructions for the image AI

You will create **2 small sprites** for a colony sim, **one image per message, in the order listed below**.

- After the first image, stop and wait for the user to say **"next"** (or give feedback) before making the second one.
- If the user gives feedback, redo the same image before moving on.
- Use the file name shown for each image.
- The user will attach the game's **Trading Post** sprite as a style reference. **Match it exactly in rendering style, outline weight, lighting direction and color temperature.** It must look like it was drawn by the same artist for the same game.

### What these are

An independent trader called the Magpie flies past the colony in orbit. When the colony buys goods from him, he drops a **small cargo container under a parachute**. It drifts down next to the Trading Post and lands on the red desert ground. In the game the parachute sways gently on the way down and collapses when the container lands, so the **parachute and the container are two separate images**.

The Magpie is a scrappy, independent freighter pilot, not a big corporation: the container is sturdy and well used, not shiny or corporate.

## Style Rules (apply to both images)

```
hand-painted pixel-art style game sprite matching the attached Trading Post sprite, chunky readable shapes, crisp dark outline,
light from top-left, limited warm color palette, soft painted shading,
single object centered, viewed slightly from above and from the front (same camera as the attached building),
transparent background, no ground, no shadow on the ground, no text, no letters, no numbers, no logos, no people,
sci-fi colony on a red desert planet, cozy colony sim style
```

## 1. `cargo_crate.png` — the container

```
a small rugged cargo container for an air drop, roughly cube-shaped but slightly wider than tall,
painted metal panels in weathered teal and off-white with orange hazard corner bumpers,
reinforced corner frames, two sturdy straps across the top, a small blinking amber beacon light on the top corner,
scratches and dents from many trips, a simple stencilled bird silhouette (a magpie, no text) on the front panel,
four short cable loops on the top corners where parachute cords attach,
square image, the container fills about 70% of the image
```

## 2. `cargo_chute.png` — the parachute

```
a round cargo parachute canopy seen slightly from below and from the front, dome shape, about three times as wide as the container,
alternating panels of faded off-white and orange fabric, a few patched panels, a small vent hole at the top,
eight thin dark cords hanging from the rim and gathering together at a single point at the bottom center of the image,
the cords end at the bottom edge so the container can be attached below in the game,
wide image (about 3:2), the canopy fills the upper two thirds, cords fill the lower third
```
