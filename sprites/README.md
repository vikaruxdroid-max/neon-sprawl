# NEON SPRAWL — Sprite Specs

The game renders buildings with live vector art by default. You can OPTIONALLY
override any building with a pixel-art image sprite by dropping a PNG here and
registering it in `SPRITE_SRC` (in index.html). If a sprite is missing or fails
to load, the game silently falls back to vector art — nothing breaks.

## Tile sprites (buildings)

- **Format:** PNG, transparent background (alpha)
- **Size:** 16×16 px for a 1-tile building. For multi-tile buildings, size =
  (16 × tilesWide) by (16 × tilesTall), and set `DEF[type].spriteTiles=[w,h]`.
  Recommended authoring size: 32×32 or 64×64, the engine scales down crisply
  (nearest-neighbor / no smoothing) — make it at a clean multiple of 16.
- **Style:** top-down (the game is top-down). The building viewed from above,
  filling the tile, transparent around the edges.
- **Palette:** cyberpunk neon on dark — magenta (#a259ff), cyan (#00d4ff),
  green (#39ff88), amber (#ffd84a) accents on near-black bodies. Match the
  in-game glow aesthetic.
- **Filename:** lowercase, matches the type, e.g. `furnstore.png`.

### Currently wired (proof-of-concept)
- `furnstore.png` — the Furnishings Store. Drop a 32×32 or 64×64 transparent
  top-down pixel sprite here and it appears in-game immediately.

### To add more
1. Make `sprites/<type>.png`
2. In index.html, add to `SPRITE_SRC`:  `<type>:"<type>.png",`
3. (multi-tile only) add `spriteTiles:[w,h]` to that type's DEF entry.

## Hero / painted art (menus)

- `title.png` — optional painted hero image shown on the start screen. Any size
  (displays at max 420px wide). This is the place for illustrated/painted art
  (Gemini/Midjourney style). Absent = title stays text-only.

## ⚠ Rights
Only ship art you have the right to redistribute in a public repo. AI-generated
art is governed by the generating tool's terms — verify commercial/redistribution
rights for your source (Gemini, Midjourney, etc.) before committing art here.

## Tooling note
For pixel TILE sprites, a local pixel-art pipeline (e.g. ComfyUI) produces cleaner
transparent results than painted-image generators. Use the painted generators for
the hero/menu art instead.
