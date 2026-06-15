# NEON SPRAWL — Colony Protocol

Single-file cyberpunk colony sim (RimWorld-style vertical slice). v0.1 built 2026-06-10.

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
2. Structures/passability (`structAt`, `colCost`, `foeCost`), binary-heap A* (`astar`, 8-dir, no corner cuts), `los`, items, stockpile zones, economy (`afford/pay/wealth`), placement/construction, power (`powerRecalc` — deficit disables ALL consumers), `genMap`.
3. Pawns: `mkPawn`, traits (`tr`) + personality (`pers`: ind/cau/soc/cur/amb/emp/imp/intg), per-pawn daily schedule (`mkSched`, stored on `p.sched`), mood (`moodCalc`, mental break → dazed wander), movement (`gotoCell`). Job AI: **`chooseJob`** (hard gates: eat if food≤22, sleep if rest≤18) → **`scoreJobs`** — utility scoring (`base·weight·bias·sched`) over eat/sleep/cook/build/salvage/haul/hygiene/recreate/socialize/work/treat/substance/crime/idle, weighted by personality, schedule windows, needs and foe-proximity; also consumes one-shot direct orders (`p.cmd`). Job execution in `pawnTick` (which calls `chooseJob` at its `if(!p.job)` line). Reservations via `s.res` / `it.resv`; unreachable cache `p.unre`. **Note:** `findJob` still exists but is dead code (never called) — the live picker is `chooseJob`.
4. Foes & events: **combat is currently dormant** — `spawnRaid` (and the only `spawnFoeAt` call, which lives inside it) is dead code; organic raids were cut (commit `37f97ea`), so the live game spawns no foes. Combat code is intact and test-covered: `foeTick` — foes path THROUGH player walls/doors at soft cost (door 15, wall 28) and breach what blocks the route; groups retreat when **≤34% remain alive** (`alive/n0≤.34`, i.e. ~66% losses) or after 1.2 days. Turrets (`turretTick`, rng 9.5, dmg 6–10, powered only). Live pressure: `fireEvent` (**pod / wander / storm / blackout / mugging / medbill / gigdrought** — no raid), the heat-based **non-lethal enforcer crackdown** (in `tick`, ~every 100t), and daily rent/eviction (−34 credits/day). Win = beacon charged a full day (`s.charge>=TPD`); lose = all pawns dead (`gameOver`). Master `tick()`. **Note:** re-enabling raids = wiring `spawnRaid` back into `tick`.
5. Rendering: offscreen terrain canvas, per-frame structs/pawns/foes/beams/floats, night lighting overlay (destination-out), storm/vignette screen effects.
6. Input: mouse (marquee select, wall paint-drag, rect designations, RMB commands, wheel zoom, WASD pan), touch (tap/pan/pinch), keyboard (space pause, 1/2/3 speed, R draft, Esc).
7. UI/DOM: HUD, toolbar+submenus, inspector, log, modals. `newGame`, main loop (fixed-step, 100ms/speed, ≤10 ticks/frame). The legacy `checklist` panel was dropped (CSS `display:none`); `renderChecklist` still runs in `updateFlags` but feeds the hidden element.

## Testing
`node test/run.js` — extracts the script from index.html, prepends DOM/canvas stubs (test/stubs.js, including an in-memory localStorage shim), runs test/smoke.js. Current tests:
A drafted-pawn kill · B turret kill · C salvage→haul · D wall-breach AI · E A* corner-to-corner · F1/F2/F3 job-AI decisions (industrious→build, curious→recreate, hunger hard-gate→eat) · G1–G14 save/load round-trip (Map/Set/Uint8Array rebuild, transient-ref stripping, reservation clearing, post-load AI re-derive).
A/B/D drive combat by calling `spawnFoeAt` directly (the live game no longer spawns foes). The old "8-day auto-player baseline" was replaced by the F1–F3 decision tests.

## Balance state — OPEN
Human playtest data does not exist yet. **Note:** the previously-listed combat levers (raid points curve in `spawnRaid`, turret cost/DPS, `FOED.ganger`, `WEAP`) are **dormant** — raids are cut, so they affect only the test harness, not live difficulty. Live difficulty now lives in the social-sim economy: rent/eviction (−34 credits/day in `tick`), `fireEvent` social-shock frequency/severity, the enforcer **heat** system, and `scoreJobs` need/economy balance. Do not tune blind; require the owner's playtest verdict first.

## Roadmap (owner-approved candidates, in rough priority)
1. ~~Save/load via localStorage~~ — **DONE** (`saveGame`/`loadGame`, single-slot, regression-tested as smoke test G). JSON export/import backup path still open.
2. Difficulty pass driven by playtest data.
3. Netrunning/hacking mechanic (differentiator vs RimWorld).
4. Medical/downed states instead of instant death.
5. Per-pawn work priorities UI.
Cut from v0.1 by design: research, trading, temperature.
