# Critical Infrastructure + Sabotage — Design Note (pre-build map)

This maps how a sabotage system hooks into the EXISTING power/water/disaster/insurrection code so the
actual build goes fast. Nothing here is built yet — it's the blueprint.

## What already exists (the hooks)

### 1. Utility system (power/water) — `index.html` ~line 4251
- Two buildings: `powerstation` (`utility:"power"`) and `waterfac` (`utility:"water"`).
- Each tick, the game computes `hasPower`/`hasWater` = "is there a non-blueprint utility building of this
  type WITH a worker assigned to it?" Stored as `ST.utilPower` / `ST.utilWater`.
- Effects of NO power: every adult gets a `-4` "No power on the block" mood mod.
- Effects of NO water: `-3` mood mod + hygiene drain (`needs.hyg -= 4` daily).
- **KEY INSIGHT:** a utility is "online" only if its building exists, isn't a blueprint, AND has a worker.
  So there are THREE ways to knock out a utility: destroy the building, disable it (broken), or remove its
  worker. Sabotage can target any of these.

### 2. Blackout mechanic — `strikeBlackout()` ~line 3982
- Sets `ST.blackoutUntil = ST.tick + TPD*R(0.3,0.6)` (a timed outage, ~0.3–0.6 day).
- While `ST.blackoutUntil > ST.tick`: production halts (checked at ~line 3305 in the work handler:
  `if(ST.blackoutUntil && ST.tick<ST.blackoutUntil && (d.prod||d.refine))` → no output), +stress, +heat
  (darkness breeds crime), a screen-darkening render pass (~line 5852), and a tasks-panel alert (~line 6377).
- **This is the perfect model for power sabotage** — a sabotage just triggers a blackout (or a longer/worse
  one) but caused by a wisp instead of a random disaster.

### 3. Building damage — buildings have `hp`; `isBroken(s)` (furniture hp<=0); `s.surgeT` (temporary disable)
- A sabotage could set a utility building's `hp` low or set a `s.surgeT`/`s.sabotaged` flag that takes it
  offline for a duration (mirrors how broken furniture is skipped).

### 4. Insurrection layer — `ST.mov` (support/exposure/intel/cells), `insurrectionTick()` ~line 1002
- `ST.mov.stance` = "hidden" | "open". Sabotage is an INSURGENT act → ties here.
- Wisps have `allegiance` (-100..100); `insurgentLever` wisps (the Fixer) and recruited cells are the
  natural saboteurs. Regime-aligned wisps (enforcer/mayor) would NEVER sabotage; they'd RESPOND to it.

## Proposed sabotage design (the build plan)

### Who sabotages
- A disaffected wisp (low `allegiance`, or recruited into a cell, or high-`imp`/low-`intg`) may attempt
  sabotage when the insurrection is active (`ST.mov.support` high enough) OR the player directs it.
- Two flavors:
  1. **Player-directed:** via the avatar / a recruited cell — a deliberate insurgent op (costs intel, has
     a stat check using `opsCheck`, raises exposure if it fails).
  2. **Emergent:** an angry wisp autonomously sabotages when conditions are dire (no pay, evicted, regime
     crackdown) — surfaces as an event.

### What sabotage does (target a utility building)
- A `sabotageUtility(building, saboteur)` function that:
  - Sets `building.sabotaged = ST.tick + duration` (building goes offline — `hasPower`/`hasWater` check
    must also test `!(s.sabotaged>ST.tick)`).
  - For power: also trigger a blackout (`strikeBlackout`-style) for extra bite.
  - Raises `ST.mov.exposure` (the regime notices) and `ST.heat`.
  - Leaves evidence → can tie into the DETECTIVE layer (`ST.cases`): the enforcer/regime can investigate
    who did it (reuse the existing case system — a "sabotage" case type alongside murder/informant).

### How it's repaired
- A worker (or the role-holder) must repair the building — a new job type `repair`, or reuse the existing
  build/work job to clear the `sabotaged` flag once a worker spends time on it.

### Player-facing
- Tasks-panel alert when a utility is sabotaged ("Power station sabotaged — repair it or sit in the dark").
- If player-directed: a button on the avatar / cell wisp ("Sabotage the grid") gated by intel + an ops check.

## Minimal first version (ship-fast scope)
1. Add `s.sabotaged` check to the `hasPower`/`hasWater` computation (1 line each).
2. `sabotageUtility()` — sets the flag, triggers blackout if power, bumps exposure/heat, logs + banners.
3. An emergent trigger: in `insurrectionTick` or a disaster-style roll, a disaffected wisp sabotages when
   support is high + they're desperate. (Reuse `maybeScheduleDisaster` pattern.)
4. Repair: reuse the work/build job to clear the flag.
5. (Later) player-directed sabotage button + detective "sabotage case" investigation.

## Files/lines to touch (when building)
- `~4251` utility computation → add `sabotaged` check
- `~3982` near strikeBlackout → add `sabotageUtility`
- `~1002` insurrectionTick → emergent sabotage trigger
- `~6377` tasks panel → sabotage alert
- save payload (`~7855`) → persist `sabotaged` flags (they're on structs, may already serialize)
- `ST.mov.exposure` / `ST.heat` → consequences

## Risk notes
- Don't let sabotage create a death-spiral (no water → hygiene → sickness → death). Cap frequency; make
  repair reliable. The cafeteria/food work is unrelated but the same caution applies: infrastructure loss
  should be a PRESSURE, not a guaranteed collapse.
- Regime roles must respond, not sabotage (check `allegiance`/`regimeForce`).
- Sabotage during an election or other event should be fine (election is abstract, no pathing conflict).
