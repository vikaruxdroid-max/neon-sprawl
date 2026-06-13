# NEON SPRAWL — Colony Protocol

Single-file cyberpunk colony sim (RimWorld-style vertical slice). v0.1 built 2026-06-10.

## Hard constraints
- **Everything lives in `index.html`.** Vanilla JS + canvas. No frameworks, no build step, no external dependencies. Same architecture as the owner's Neon Dungeon project.
- Function declarations rely on hoisting; script executes top-to-bottom, game starts only after full parse. Keep new code in the matching section (map below).
- Must remain playable by opening `index.html` directly (file://) and via GitHub Pages.
- localStorage **is now allowed** (this was forbidden only in the claude.ai artifact environment). Save/load via localStorage is an approved roadmap item.

## Workflow — non-negotiable
1. Make edits with targeted diffs. Never regenerate the whole file.
2. After ANY change to game logic: `node test/run.js`. All tests must pass before commit.
3. Commit style: short imperative summary + version bump in the header comment block when behavior changes (v0.1 → v0.2 etc.).
4. One feature per commit. Balance changes get their own commits with before/after numbers in the message.

## Architecture map (section order inside the single <script>)
1. Helpers + SFX (WebAudio) + data defs: `DEF` buildings, `WEAP`, `FOED`, `TRAITS`, names. Constants: `T=16` px/tile, `MW=56`, `MH=40`, `TPD=2400` ticks/day, `TPS=10`.
2. Structures/passability (`structAt`, `colCost`, `foeCost`), binary-heap A* (`astar`, 8-dir, no corner cuts), `los`, items, stockpile zones, economy (`afford/pay/wealth`), placement/construction, power (`powerRecalc` — deficit disables ALL consumers), `genMap`.
3. Pawns: `mkPawn`, traits, mood (`moodCalc`, mental break → dazed wander), movement (`gotoCell`), job AI (`findJob` priority: eat → sleep → cook → build/decon → salvage → haul → idle), job execution in `pawnTick`. Reservations via `s.res` / `it.resv`; unreachable cache `p.unre`.
4. Foes: `spawnRaid` (pts = 0.9 + day*0.75 + wealth/550, first raid ≤3, bruisers day 4+, groups retreat at 34% losses or 1.2 days), `foeTick` — foes path THROUGH player walls/doors at soft cost (door 15, wall 28) and breach what blocks the route. Turrets (`turretTick`, rng 9.5, powered only). Events (`fireEvent`: raid/pod/wanderer/net storm/blackout, raids min 0.9 day apart). Win = beacon powered one full day; lose = all pawns dead. Master `tick()`.
5. Rendering: offscreen terrain canvas, per-frame structs/pawns/foes/beams/floats, night lighting overlay (destination-out), storm/vignette screen effects.
6. Input: mouse (marquee select, wall paint-drag, rect designations, RMB commands, wheel zoom, WASD pan), touch (tap/pan/pinch), keyboard (space pause, 1/2/3 speed, R draft, Esc).
7. UI/DOM: HUD, toolbar+submenus, inspector, log, checklist, modals. `newGame`, main loop (fixed-step, 100ms/speed).

## Testing
`node test/run.js` — extracts the script from index.html, prepends DOM/canvas stubs (test/stubs.js), runs test/smoke.js:
A drafted-pawn kill · B turret kill · C salvage→haul economy · D wall-breach AI · E A* · F 8-day auto-player baseline.
The auto-player in F is deliberately dumb (no walls, no kiting). It wiping around day 5 is expected; it surviving day 1-2 is a regression.

## Balance state — OPEN
Human playtest data does not exist yet. Difficulty levers, in order of preference: raid points curve in `spawnRaid`, turret cost/DPS, ganger melee (`FOED.ganger`), `WEAP` stats. Do not tune blind; require the owner's playtest verdict first.

## Roadmap (owner-approved candidates, in rough priority)
1. Save/load via localStorage (+ JSON export/import as backup path).
2. Difficulty pass driven by playtest data.
3. Netrunning/hacking mechanic (differentiator vs RimWorld).
4. Medical/downed states instead of instant death.
5. Per-pawn work priorities UI.
Cut from v0.1 by design: research, trading, temperature.
