# NEON SPRAWL — City Protocol

Single-file cyberpunk city sandbox (living city sim, not a colony survival roguelike). Redesigned from colony→city 2026-06-16.

## Hard constraints
- **Everything lives in `index.html`.** Vanilla JS + canvas. No frameworks, no build step, no external dependencies. Same architecture as the owner's Neon Dungeon project.
- Function declarations rely on hoisting; script executes top-to-bottom, game starts only after full parse. Keep new code in the matching section (map below).
- Must remain playable by opening `index.html` directly (file://) and via GitHub Pages.
- localStorage **is allowed and now used.** Save/load is **implemented**: `saveGame`/`loadGame` → `serializeState`/`applyState`, key `neonSprawlSave_v1` (SAVE/LOAD buttons, CONTINUE on title, LOAD LAST SAVE on death). (localStorage was forbidden only in the old claude.ai artifact environment.)

## Workflow — non-negotiable
1. Make edits with targeted diffs. Never regenerate the whole file.
2. After ANY change to game logic: `node test/run.js`. All tests must pass before commit.
3. Commit style: short imperative summary + version bump in the header comment block when behavior changes (v0.1 → v0.2 etc.).
4. One feature per commit. Balance changes get their own commits with before/after numbers in the message.

## Architecture map (section order inside the single <script>)
1. Helpers + SFX (WebAudio) + data defs: `DEF` buildings, `WEAP`, `FOED`, `TRAITS`, names. Constants: `T=16` px/tile, `MW=56`, `MH=40`, `TPD=2400` ticks/day, `TPS=10`.
2. Structures/passability (`structAt`, `colCost`, `foeCost`), binary-heap A* (`astar`, 8-dir, no corner cuts), `los`, placement/construction, `genMap` / `genCity`. **Dormant dead code** (intact, do not delete): `powerRecalc` (now a no-op stub).
3. Pawns: `mkPawn`, traits (`tr`) + personality (`pers`: ind/cau/soc/cur/amb/emp/imp/intg), per-pawn daily schedule (`mkSched`, stored on `p.sched`), mood (`moodCalc`, mental break → dazed wander), movement (`gotoCell`). **Home assignment:** each pawn gets `p.home` pointing to a home structure; they sleep, wash, and eat there (free fridge food). Job AI: **`chooseJob`** (hard gates: eat if food≤22, sleep if rest≤18) → **`scoreJobs`** — utility scoring (`base·weight·bias·sched`) over job types weighted by personality, schedule windows, needs and foe-proximity; also consumes one-shot direct orders (`p.cmd`). Job execution in `pawnTick`. Reservations via `s.res` / `it.resv`; unreachable cache `p.unre`. **Dormant dead code:** `findJob` (never called), salvage/cook/haul job branches.
4. Foes & events: **combat is dormant** — `spawnRaid` and the `spawnFoeAt` call inside it are dead code; live game spawns no foes. Combat code intact and test-covered: `foeTick` — foes path through walls/doors at soft cost (door 15, wall 28), breach blockers; groups retreat at ≤34% alive or after 1.2 days. **Note:** `turretTick` was removed in the city redesign; turret/gen types are not in DEF. Live pressure: `fireEvent` (**pod / wander / storm / blackout / mugging / medbill / gigdrought**), the heat-based **non-lethal enforcer crackdown** (~every 100t), and **daily eviction** for citizens who run out of credits. **No win condition** — the extraction-beacon win condition was removed. Lose = all pawns dead (`gameOver`). Master `tick()`. **Note:** re-enabling raids = wiring `spawnRaid` back into `tick`.
5. Rendering: offscreen terrain canvas, per-frame structs/pawns/foes/beams/floats, night lighting overlay (destination-out), storm/vignette screen effects. Wisp task-glyph icons + accent identity rings replace old text job-labels.
6. Input: mouse (marquee select, wall paint-drag, rect designations, RMB commands, wheel zoom, WASD pan), touch (tap/pan/pinch), keyboard (space pause, 1/2/3 speed, R draft, Esc).
7. UI/DOM: HUD shows **POP / CR / EVICTED** (replaced old resource/power readout). Toolbar shows **14 city fixture blueprints** buildable with labor only (no material cost) — colony pieces (synth/vat/gen/turret/beacon) are off the menu. Inspector, log, modals, AI chat (TALK button). `newGame`, main loop (fixed-step, 100ms/speed, ≤10 ticks/frame). `updateFlags` is now a no-op (survival checklist removed). **Dormant dead code:** `renderChecklist`, SALVAGE order, STOCKPILE/ZONES tool, `ST.res` resource HUD, power readout, win-condition beacon.

## City economy
- **Food:** free at a home fridge (`pawn.home`); costs 5 credits at a shop/bar vendor. No salvage, scrap, synth food, or material stockpiles.
- **Credits:** citizens earn credits through work jobs; spent on vendor food, lost to eviction rent, or transferred by crime events.
- **Eviction:** citizens who exhaust credits are evicted (removed from play). HUD tracks the running evicted count.
- **Build cost:** all 14 city fixtures require labor only — no `ST.res` material cost.

## Dormant dead code (do NOT delete)
The roguelike plumbing from the colony era is intentionally preserved for a future cleanup pass or potential re-use: raid spawner (`spawnRaid`), salvage/cook/haul job branches, `powerRecalc` (now a no-op stub), extraction-beacon win condition, survival checklist (`renderChecklist`/`updateFlags`), SALVAGE order.
**Fully removed in city redesign:** `ST.res` material resources, `ST.zone` stockpile zones, `ST.items`, `turretTick`, generator/turret DEF entries — these are gone from the codebase, not merely dormant.

## Testing
`node test/run.js` — extracts the script from index.html, prepends DOM/canvas stubs (test/stubs.js, including an in-memory localStorage shim), runs test/smoke.js. Current tests:
A drafted-pawn kill · B turret kill (dormant stub — turretTick removed) · C city economy (food+credits, 2-day run) · D wall-breach combat primitive · E A* corner-to-corner · F1/F2/F3 job-AI decisions (industrious→build, curious→recreate, hunger hard-gate→eat) · G1–G15 save/load round-trip (Map/Set/Uint8Array rebuild, transient-ref stripping, reservation clearing, post-load AI re-derive, relationship graph, goods persistence).
A/D drive combat by calling `spawnFoeAt` directly (live game spawns no foes). C replaced the old salvage→haul chain test with a city-economy health check. G4 tests `ST.goods` persistence (replaced old zone Set test).

## Balance state — OPEN
Human playtest data does not exist yet. Live difficulty levers: `fireEvent` social-shock frequency/severity, the enforcer **heat** system, eviction credit drain rate, and `scoreJobs` need/economy balance. Do not tune blind; require the owner's playtest verdict first.

## Roadmap (owner-approved candidates, in rough priority)
1. ~~Save/load via localStorage~~ — **DONE** (`saveGame`/`loadGame`, single-slot, regression-tested as smoke test G). JSON export/import backup path still open.
2. Difficulty pass driven by playtest data.
3. Netrunning/hacking mechanic (differentiator vs RimWorld).
4. Medical/downed states instead of instant death.
5. Per-pawn work priorities UI.
Cut from v0.1 by design: research, trading, temperature.
