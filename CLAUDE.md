# NEON SPRAWL — Colony Protocol · Developer Handoff

## ★ END-GOAL VISION (LOCKED — the north star for all future work) ★
A **clandestine grand-strategy game**: three genres fused by ONE verb — *clandestine influence* — at
three zoom levels:
- **Personal (RPG):** the operative/avatar (6 Operative Attributes), grows + persists across cities.
- **City (social sim):** the full simulation that exists today — ONE city fully live at a time.
- **World (4X by ESPIONAGE ONLY):** many cities competing via misinformation, sabotage, economic
  leverage, cyberattacks, turning populations. NEVER armies. A war of shadows.

**CORE TECHNICAL COMMITMENT — one live city at a time.** Running 4-6 full sims simultaneously is
NOT feasible in a single-file browser game (perf + memory). Instead: the ACTIVE city runs the full
sim as now; DORMANT neighbors are compressed SUMMARY state (population, regime grip, stability,
economy, your influence, key NPCs, ongoing ops) advanced by a lightweight OFFSCREEN MODEL. You
TRAVEL to a neighbor → its full sim is generated/restored from summary (same city system, fresh
instance) and your home city goes dormant. The operative is the BRIDGE — moves between cities
carrying stats/reputation. The fiction (a lone shadow-architect who travels) matches the constraint
(one live city at a time) EXACTLY — the limitation IS the design.

**Political world:** global oligarchy = overarching enemy controlling many cities, BUT cities have
local flavor — some oligarch-held, some rival-faction-run, some independent. A varied map.

**Stories:** a light AUTHORED spine (designed beats + named characters, hand-placed, keyed to world
state) for memorable moments + PROCEDURAL story events (extending the storyteller) seeded by world
state for replay. Authored for the spine; procedural for texture.

**SEQUENCING CONTRACT (agreed):** finish + harden the SINGLE CITY first — creation screen → dialogue
→ visuals → deep testing — before ANY world-layer work. Do not touch the world layer until the city
is genuinely complete and fun. Three risks each get a dedicated DESIGN PASS before implementation
when we get there: (1) the offscreen-city model (making dormant cities feel alive on return),
(2) clean city state-swapping in/out of live ST with the operative persisting, (3) rival-faction AI
that runs ops against you. The world is the cathedral; the city is the foundation — and it isn't
done yet.

**IMMEDIATE city-first work queue:** ~~character-CREATION SCREEN~~ (DONE) → stat-gated DIALOGUE
(opsCheck/ops built to feed it) → job/farming VISUALS + litter → deep testing/tuning.

---

## ⚡ LATEST STATE (read this first — reconciled from the live VM, June 2026) ⚡

**JAIL KEYSTONE + VISUAL FIXES (most recent session) — first checkpoint of a LARGE multi-session op-rework.**
Carlo asked to deeply rework all 9 avatar ops into an interconnected hard-gated tech tree (intel reveals
hidden stats → surveil maps routine → secrets unlock blackmail/frame → assassinate hard-gated on completed
surveil + weakened target), add a PHYSICAL jail, and rework each op's mechanics + consequences. His design
locks: build it all (multi-session), HARD gates (strict tech tree), jail = active escalating risk (repeat
incarceration → execution territory). THIS SESSION shipped the JAIL (the keystone everything else needs)
+ two visual fixes. The op-rework spine (intel revelation, surveil routine-mapping, the hard gates, per-op
consequence reworks) is STILL TO BUILD — that's the bulk of the vision, next sessions.

**VISUAL FIXES (both validated):**
- AVATAR CHEVRON REMOVED — the little triangle above the operative is gone; the pulsing cyan ring alone
  marks the avatar (cleaner read, Carlo's request).
- DOCK FLICKER FIXED — the actions dock was calling `renderOpDock()` (full innerHTML rebuild) every 3 ticks
  while an op ran / the avatar moved, thrashing the DOM (flicker + eating button clicks → "have to go
  through every action"). NEW `updateOpDockLive()` does a LIGHTWEIGHT update (only the progress bar +
  status text via querySelector, guarded), called on the periodic refresh instead of the full rebuild.

**JAIL SYSTEM (the keystone — physical lockup with escalating consequence):**
- New `jail` building DEF ("Holding Cells", ⛓ icon, in BUILD_ORDER + icon map). Placed at worldgen right
  beside the precinct (room at 122,82, with pods as cells).
- `jailPawn(p,severity,crime)` — severity 1=petty/2=serious/3=capital. Increments `p.jailCount` (priors).
  Sentence = `TPD*(severity*0.6+priors*0.4)` days, ESCALATING. capital (severity≥3, OR severity≥2 with ≥3
  priors) → execution. Sets `p.jailed={cell,jx,jy,until,severity,crime,capital,arrivedAt}` + walks them to
  the cell (`{t:"goto",adj:1}`). No jail building → fallback fine+heat.
- `jailTick()` (every tick) — holds pawns at the cell (arrival <2.9), counts down, RELEASES when served
  (jail RADICALIZES: disillusion+allegiance up unless informant; relief emote) or EXECUTES capital after
  ~0.4 day (a public execution radicalizes witnesses/neighbors — regime overreach). pawnTick has a guard
  holding jailed pawns at/heading-to the cell. `jailed`/`jailCount` serialize automatically (snapPawn
  Object.assign) — VERIFIED persists through save/load.
- `bribeOutOfJail()` (avatar) — cost = `40*severity*(1+jailCount*0.3)` credits + 8 intel; blocked for
  capital; leaves an exposure trail. Wired to a dock `od-bribeout` button (the dock shows IMPRISONED status
  + bribe-out when the operative is jailed, hiding the ops grid).
- WIRED INTO OP FAILURES: `opFailure` now arrests on caught serious crimes — `JAILABLE={steal:2,sabotage:2,
  assassinate:3}`. Caught = botched OR an enforcer saw you (canSee) OR (high exposure + 50% roll). A botched
  assassination = capital = execution. VERIFIED: botched steal → jail → bribe out works; botched
  assassination → capital → bribe correctly blocked.
- VERIFIED end-to-end: arrest → walk to physical cell → hold → release (radicalized) / capital execution,
  escalating priors, full day stable (max stuck 51, 13 survive), save/load clean, surfaces clean.

**STILL TO BUILD (the bulk of Carlo's op-rework vision — next sessions, in dependency order):**
1. INTEL → progressive stat revelation: NPC hidden stats (pers: amb/imp/soc/emp/cur/intg, already
   randomized + hidden) get UNVEILED incrementally by gathering intel on a target (disposition → traits →
   secret). Resistance: high integrity + low curiosity + regime loyalty = they clam up / notice prying.
2. SURVEIL → routine mapping: shadow a wisp to learn home/work/schedule + VULNERABLE WINDOWS (alone, where,
   when) — which is what makes assassination targeting possible. Resist: cautious+perceptive notice the tail.
3. HARD GATES across the ops (strict tech tree): assassinate REQUIRES completed surveil (known routine) +
   weakened/framed target; sabotage requires intel on the building first; frame requires bribery done; etc.
   Need a per-target "what have I discovered/completed" tracker to gate on.
4. PER-OP CONSEQUENCE REWORKS: dissent (propaganda, npcs resist/report), bribe (police bribe / random info,
   resist/report), frame (multi-step, needs prior ops), blackmail (extract money, bad debuff), sabotage
   (guard posted after first attack to stop spam), steal (resist/fight back/always calls police → jail),
   assassinate (success effects scaled by victim's role; failure → seen/jail/execution), LIE LOW (rework:
   miss work / go to ground physically, not just an exposure-reducer).
   CARLO IS OPEN TO DESIGN IDEAS on every one of these — engage as a design partner, not just an implementer.
- Plus still-pending from before: Wave 4 CHARACTER-CREATION overhaul (text-clipping), Phase 3-5 embodied
  ops (animations/audio — Claude can't validate), pawn-AI perf (parked). AI reaction + op-readout FEEL are
  Carlo's to judge at runtime.

---

## ⚡ SEPARATE ACTIONS MENU + PATRONIZE (prior session) ⚡

**SEPARATE ACTIONS MENU — the ops toolkit, now always-reachable:** the avatar ops were only in the inspect
panel (you had to find + select your operative in the world first). Now they're ALSO in the OPERATIVE dock
(bottom-left, collapsible), so you can operate from one always-open place. Refactored to SHARE one
implementation:
- `renderOpsGrid(opts)` — returns the categorized op-button HTML (INTELLIGENCE/INFLUENCE/DIRECT ACTION,
  live state per op: ready/armed/disabled, risk tier signaled, cost shown). Used by BOTH the inspect panel
  and the dock panel — one source of truth (removed the duplicated inline version in inspect).
- `dispatchOpButton(opBtn)` — shared click handler: direct ops (intel/dissent) run now; targeted ops
  (sabotage/frame/etc.) arm targeting mode. Called from both the inspect `.i-op` handler AND the dock's
  click handler. The `i-lielow` button also works from both.
- The dock panel now shows: Intel/Exposure stat, progress bar, SELECT/FOLLOW/MODE row, then an OPERATIONS
  section with the full grid. VERIFIED: 9 op buttons render in both surfaces, dispatch runs direct ops +
  arms targeted ops, dock + inspect both render clean.

**PATRONIZE — economic intervention (the improvement, ties economy → insurrection):** a new action on any
non-recruited wisp in the inspect panel. Slip a struggling wisp credits (`i-patron`): costs YOUR district
income (20c if they're struggling — homeless/in rent debt/broke/desperate — else 12c), relieves their
credits + knocks down a point of rent debt, pulls them back from `desperate`, and wins real allegiance
(+12-20 if struggling, +5-9 otherwise — they remember who helped when it mattered) + a relief/joy emotional
reaction + a memory + a small avatar-rep bump. A direct lever from the economy's hardship into recruitment:
bail out a wisp facing eviction and they lean toward your cause. VERIFIED: detects struggling wisps, spends
income, relieves hardship, wins goodwill, button renders.

**COMPREHENSIVE PASS:** structure clean (JS valid, smoke 20/20, no dead/dupe — the refactor REMOVED
duplication, CSS balanced). Full day stable (max stuck 57, 13 survive). Save/load clean. All interactive
surfaces clean (dock w/ ops, inspect for avatar + wisp, render, HUD).

**Carlo deployed the prior build (op-readout terminal) and is play-testing. Note: the op-readout VISUAL FEEL
+ AI reaction LINE QUALITY remain the untestable pieces (Carlo judges at runtime).**

**STILL PENDING:** Wave 4 CHARACTER-CREATION overhaul (still outstanding — wants it rethought + the text-
clipping on the right edge of background descriptions fixed; this is now the main remaining UI item). Deeper:
Phase 3-5 embodied ops (per-op action animations — `anim` keys staged but not driving distinct animations
yet; NPC behavioral reactions; stealth depth; polish — Claude can't validate visuals/audio). The pawn-AI
perf pass (parked, ~1.9ms/pawn). A sound-design pass on the op readout (terminal beeps/tones — Claude can't
hear). The mechanics-completeness audit could go deeper.

---

## ⚡ OP READOUT TERMINAL + comprehensive pass (prior session) ⚡

**OP READOUT — the action-resolution visual:** a terminal panel streams above the avatar while a staged op
performs, building suspense, then resolves into the verdict tinted by the banded roll that already happens
in `resolveAvatarOp`. Purely visual — rides on the existing staged-op lifecycle + `opsCheck` bands.
- `OPREADOUT` (transient global, NOT serialized — verdict shouldn't survive a reload). `OP_TERM_SCRIPT`
  has per-op flavour (sabotage→"BREACHING GRID NODE"/"INJECTING FAULT"…; steal→"ACCESSING ASSETS"…; etc.,
  9 ops + a generic default).
- `opReadoutStart(opKey,op)` boots it (called in runAvatarOp). `opReadoutResolve(p,op,band)` maps the band
  to a verdict: critwin/success→"ACCESS GRANTED" (green), partial→"PARTIAL BREACH" (amber), fail→"ACCESS
  DENIED" (red), critfail→"TRACE DETECTED" (pink). Called from resolveAvatarOp after the consequence fires.
- `opReadoutTick(av)` (called each frame from drawOpReadout) streams work lines progressively by
  `activeOp.prog/duration`, holds the verdict ~140 ticks then auto-clears, and clears if the op aborts.
- `drawOpReadout()` renders in SCREEN SPACE (last in render(), on top): dark CRT panel above the avatar,
  bright top border (verdict-colored on reveal), faint scanlines, a connector line down to the avatar, a
  glitch/scramble effect on the verdict text for the first ~10 ticks before it locks, blinking cursor while
  running. Clamped to stay on screen. Op-abandon points (lines ~7229/7251) also clear OPREADOUT.
- VERIFIED: full lifecycle (boot→stream all work lines→reveal→auto-clear), all 5 verdict bands map+render
  correctly, render overhead negligible (only renders during an op), clean with night+blackout+rain+storm
  stacked.

**COMPREHENSIVE PRE-PLAYTEST PASS (Carlo is about to play):** STRUCTURE clean (JS valid, smoke 20/20, no
dead/dupe, CSS + script tags balanced). STABILITY: clean full day, max stuck 3 (readout doesn't touch pawn
AI), economy healthy (~820 credits). SAVE/LOAD: succeeds with an op active, runs after load, 13 survive
(OPREADOUT correctly does NOT persist). PERFORMANCE: render ~1ms/frame, readout overhead negligible.
INTEGRATION: all bands map correctly, full render clean with everything stacked. INTERACTIVE SURFACES: all
7 play-readiness checks clean (inspect panels for avatar/wisp/building, click-to-move, op dock, HUD sync,
weather menu sync, render+drawPawn, overlays).

**Carlo deployed the prior build (economy/day-night/attendants/AI) — confirmed live (he ran git pull on the
VM). The remote had one extra commit (the abort-on-move audit) that the local build already incorporated;
resolved by merging with local files authoritative.**

**STILL PENDING (Carlo's accumulated batches):** the SEPARATE ACTIONS MENU (avatar-ops out of the inspect
panel into its own panel — partially done via Wave-1 click-to-target). Wave 4 CHARACTER-CREATION overhaul
(still outstanding, wants it rethought + text-clipping fixed). Deeper: Phase 3-5 embodied ops (NPC
reactions/animations/stealth-depth/polish — Claude can't validate visuals/audio), the pawn-AI perf pass
(parked, ~1.9ms/pawn). AI reaction LINE QUALITY remains the untestable piece (endpoint unreachable from
sandbox — Carlo watches at runtime). The op-readout VISUAL FEEL (suspense timing, glitch effect, placement)
is also something only Carlo can judge on screen.

---

## ⚡ ECONOMY + DAY/NIGHT + ATTENDANTS + AI REACTIONS (prior session) ⚡

**ECONOMIC LOOP:** daily pay → rent accrues DAILY but is DUE WEEKLY (a buffer — one bad day ≠ eviction) →
personality-driven leisure spending. In the daily `ST.tick%TPD===0` block: subsist income (+9, +6 homeless);
rent accrues per-day scaled by home quality (`q.rentAccrued`); on the weekly rent day (dayNum%7===0,
guarded by `_lastRentDay`) the balance settles — pay it (relief emote if comfortable) or it becomes
rentDebt → eviction at debt≥3 (grief emote). LEISURE is personality-driven in chooseJob: sociable wisps →
bar, impulsive → arcade. GAMBLING at the arcade: impulsive wisps (imp>52) bet, 38% win rate (house edge),
big losses sting + push toward desperation (disillusion up). VERIFIED: daily accrual (8/day), weekly
settlement fires, gambling swings credits, economy sane (~900 credits, not runaway), employment healthy.

**DAY/NIGHT VISUAL CYCLE:** the map now visually darkens at night, tied to the SAME `lightLevel(hourN())`
the wisp schedules use (so the world dims when they go home to sleep). Screen-space tint in render() before
the blackout overlay: cool blue night wash (up to 0.6 alpha at deep night) + faint dusk/dawn warmth band.
Render cost negligible (~1ms/frame, night ≈ day). Ties the visual to the rhythm from the prior session.

**WEATHER CONSOLIDATION:** the two loose HUD toggles (☂ rain+fog `b-atmo`, ⚡ lightning `b-storm`) are now
ONE weather button (☁ `b-weather`) opening a small `#weather-menu` panel with both toggles inside (icons
kept). `syncWeatherMenu()` reflects on/off state; click-outside closes it. NO orphaned refs to the old
buttons.

**UNIVERSAL ATTENDANTS:** robots now staff ANY building left unstaffed (max coverage) in roboTick — but
WISPS GET FIRST CLAIM: a building must sit unstaffed `patience` days (utilities 1 day [urgent], others 3)
before a robot fills it, and auto-staffed robots YIELD to unemployed wisps (freed each day if an idle worker
exists). `s.autoStaffed`/`s._unstaffedDays` track auto vs player-chosen. VERIFIED: ~78% coverage,
employment stays 100% (robots fill the genuine excess — 81 buildings vs 12 adults — without starving wisps).

**AI REACTIONS (Claude API, wired fully — CANNOT validate live responses, endpoint unreachable from
sandbox):** `aiReactLine(p,event)` — a watched wisp speaks an AI-generated line reacting to a dramatic moment
(uses the existing aiChat → Cloudflare Worker proxy, AI_MODEL_AMBIENT). Gated (aiReady + AMBIENT.enabled +
playerWatching), throttled (120t min gap), 50% chance (keeps it special), budget-aware, and FAILS GRACEFULLY
when no proxy is set (silent no-op, no crash). Wired into `emotionalReact` via an `aiEvent` opt + directly
at the blackout. Active events: robbery ("robbed at knifepoint…"), eviction ("evicted… nowhere to sleep"),
blackout ("power just went out…"). VERIFIED: hooks fire + safe when AI not configured. **Carlo must watch at
runtime whether the LINES feel good — that's the untestable piece.**

**COMPREHENSIVE VALIDATION PASS (Carlo asked, wants to play-test after):** structure clean (JS valid, smoke
20/20, no dead/dupe, CSS balanced, 0 orphaned weather refs). SAVE/LOAD round-trip with all new state: day/
pop/credits preserved exactly, loaded game runs 500t stable, 13 survive. PERFORMANCE: render ~1ms/frame
(day/night tint negligible), roboTick 0.3ms (daily), tick ~16ms (pre-existing pawn-AI cost, NOT a
regression — parked). INTEGRATION/CHAINING confirmed: disillusion→recruit potential (+10), poor+sick→
desperate→crime, emotionalReact wired into economy, full render clean with night+blackout+rain+storm
stacked. 1-day stability: clean, max stuck 60, 13 survive, economy healthy.

**STILL PENDING (Carlo's accumulated batches):** the SEPARATE ACTIONS MENU (pull avatar-ops out of the
inspect panel into its own panel — partially done via Wave-1 click-to-target). Wave 4 CHARACTER-CREATION
overhaul (still outstanding, wants it rethought + text-clipping fixed). Deeper: Phase 3-5 embodied ops
(NPC reactions/animations/stealth-depth/polish — Claude can't validate visuals/audio), pre-commit witness
readout (design Q), the pawn-AI perf pass (parked). The mechanics-completeness audit could go deeper.

---

## ⚡ WAVES C+D+E — emotional reactivity, mechanics pass, infection loop (prior session) ⚡

**WAVE C — EMOTIONAL REACTIVITY:** interactions now produce VISIBLE, proportional emotion (the sim used to
change stats silently). New `emotionalReact(p,kind,intensity,opts)` — one place that applies a fitting
emote + mood/stress shift scaled by intensity (0..1), plus optional memory (strong events) + relationship
colouring + a float. 14 emotional profiles (joy/delight/connected/anger/fear/distress/grief/betrayed/etc.).
Wired into: ROBBERY victim (was silent stress → now visible distress, "ROBBED!" float, grudge); BURGLARY
victim (fear, "BURGLED!", feels unsafe); a GOOD CONVERSATION (both wisps lift, scaled by their bond —
friends get a bigger boost, flavour connected/joy/amused by relationship). VERIFIED: distress drops mood +
raises stress, joy lifts mood, intensity scales correctly (0.2→+2.8, 1.0→+14), strong events leave memory.

**WAVE E — INFECTION STRATIFIED BY WEALTH (full loop):** the divide now has teeth. Poor wisps (credits<15)
catch infections 1.8× more, decay 1.6× faster, recover 0.6× slower. Comfortable wisps (credits>60) catch
0.45×, resist contagion (0.5×), decay 0.6×, recover 1.6× (constant care). DESPERATION: a poor + sick +
failing (hp<45) wisp gets `p.desperate` set → chooseJob spikes crime/steal (×2.4) + burgle (×1.8) + treat
(×1.5) → the divide drives survival crime. They also emote distress + remember the grievance. VERIFIED:
poor averaged 2.3 infected/sample vs wealthy 0.0 — stark divide; poor+sick+failing wisp correctly marked
desperate. Ties start-to-finish: poverty → infection → decay → desperation → desperate action.

**WAVE D — MECHANICS-COMPLETENESS PASS:** audited player abilities/activities for dead-ends. FINDINGS: the
avatar ops (all 9) already have complete consequence chains (success/partial/failure with real effects —
blackmail turns informants, etc.); RECRUITMENT is a complete loop (intel cost → radicalPotential+Guile
chance → success recruits/fail risks exposure+informant); informants DO feed the regime (raise awareness).
The real GAP was ANONYMOUS TIPS — they had no visible story. BUILT: when exposure>35, an informant
occasionally (4% per insurrection tick, 0.6-day cooldown) drops a VISIBLE anonymous tip → heat +8-16,
awareness up, a narrative leak ("your cell's meeting spot"/"a face seen at the last action"/etc.), banner +
chronicle, and nearby recruited wisps notice + resent the snitch (relationship + anger reaction). Also added
emotional payoff to recruitment (a joining wisp feels "inspired"). VERIFIED: tips fire + produce heat
repercussions. NOTE: this connects to Wave B — sabotage disillusionment feeds radicalPotential feeds
recruitment, so the systems now CHAIN.

**STABILITY (touched core infection + chooseJob + interactions):** clean full day, max stuck 28, 13 survive,
employment 100%, save/load round-trip stable with all new state. Smoke 20/20, no dead/dupe, CSS balanced.
`p.desperate`/`p.disillusion` are transient pawn fields (don't need explicit serialization — they re-derive).

**STILL PENDING (Carlo's batch):** the SEPARATE ACTIONS MENU (pull avatar-ops out of the inspect panel into
its own easy-access panel — partially addressed by the Wave-1 click-to-target menu but Carlo wants it fully
separate). Wave 4 CHARACTER-CREATION overhaul (still outstanding, Carlo wants it rethought + the text-
clipping fixed). Deeper passes: Phase 3-5 of embodied ops (NPC reactions/animations/stealth-depth/polish —
Claude can't validate visuals/audio), the perf finding (pawnTick ~1.9ms/pawn, parked), pre-commit witness
readout (design Q). The Wave-D audit could go deeper (it hit the highest-impact gaps: tips; the ops + 
recruitment were already complete) — more activities could be swept if Carlo wants an exhaustive pass.

---

## ⚡ DAY/NIGHT RHYTHM + SABOTAGE LOOP (prior session) ⚡

**WAVE A — DAY/NIGHT RHYTHM (foundational):**
- Strengthened the EXISTING per-wisp schedule (`p.sched` w/ sleepAt/wake/workStart etc., generated from
  personality ~line 2967, already had an `owl` night-owl chronotype). The enforcement was too weak (sleep
  multiplier only 1.9×). NOW: in their sleep window the pull to sleep is 4.5× (dominant), outside it sleep
  only wins if genuinely exhausted (rest<15), and daytime sleep is actively suppressed (×0.3 when rested).
- RESULT: **night is now the operative's window** — verified 92% of adults asleep at 3am, only 8% at noon.
  Staggered as Carlo chose: owls + enforcer stay up, so night is SAFER not EMPTY. Full-day stable, max
  stuck 55t, 13 survive, rest needs healthy (avg 86), full activity variety intact.

**WAVE B — THE SABOTAGE LOOP (start to finish, the centerpiece):** A sabotage now sets a whole sequence in
motion, every stage visible. New system near insurrectionTick: `registerSabotage(s,perp,crit)` +
`sabotageTick()` (runs EVERY tick) + `resolveSabotageInvestigation(s,enf)`.
  1. **TARGET:** power stations exist (`utility:"power"`). Sabotage op now calls `registerSabotage` →
     snapshots WITNESSES by how much each saw (Phase 2 `canSee`), seeds the scene state on the struct
     (`s.sabState`).
  2. **EFFECT:** `ST.blackoutUntil` set → the city goes dark (existing blackout visual + production halt).
  3. **REACTION:** while down, nearby wisps (within 22) feel it every 20 ticks — emote anger/sweat/gross,
     mood/stress hit, and gain `p.disillusion` (moderate, builds over time — Carlo's call: a nudge, not an
     instant flip) + a small allegiance lean toward the cause + sometimes a memory.
  4. **CONSEQUENCE:** `disillusion` feeds `radicalPotential` (+0.25× per point) → disillusioned wisps are
     more recruitable / turnable. Verified +3 potential swing.
  5. **REPAIR:** an assigned worker or nearby loyal-ish wisp (who'll INTERRUPT their routine — power is
     urgent) walks to the station (`_repairing` flag holds them on task) and repairs over 90 ticks → power
     restores. Verified completes.
  6. **INVESTIGATION (full arc):** after 60-140t the enforcer is dispatched (`_investigating` holds them on
     task), walks to the scene (stage 1→2), questions wisps (stage 2→3). `resolveSabotageInvestigation`: the
     strongest WILLING witness (loyal-ish, not a sympathizer, not gang) fingers you by how much they saw —
     strength>0.8 = clean ID (heat +12-20, awareness up, enforcer MARKS you); >0.3 = vague description
     (suspicion); else the trail goes cold. EMERGENT: a witness the sabotage radicalized won't snitch.
- **KEY BUG FIXED:** the `goto` job used `gotoCell(...,0)` (path ONTO the tile) but station tiles are solid,
  so repair/investigation walkers stalled ~5 tiles out and gave up. Added an `adj` field to the goto job
  (`gotoCell(...,j.adj||0)`); all sabotage gotos use `adj:1` (path ADJACENT). Also added `_repairing`/
  `_investigating` guards in pawnTick so routine AI doesn't pull the fixer/enforcer off task.
- VERIFIED end-to-end: all investigation stages 0→1→2→3, repair 90/90, disillusionment accrues, blackout
  fires. **STABILITY (touched pawnTick + goto): clean full day, max stuck 4, 13 survive, employment 100%,
  avatar goto still works.** Smoke 20/20, no dead/dupe, CSS balanced, render-with-blackout clean.
- State: `ST.sabotages` (key list) added to init + serialize + deserialize; `s.sabState` rides on the struct.

**STILL PENDING (Carlo's batch, in planned order):** Wave C = emotional reactivity between wisps (robbed
victim angers/distresses, good conversation lifts both — sim under-reacts now). Wave D = mechanics-
completeness AUDIT (every activity/ability/interaction → find dead-ends, build the missing end using the
sabotage loop as the template). Wave E = infection loop (wealthy wisps get constant care → infected less;
poor wisps infected more → stat decay → desperate/scripted actions). SEPARATE ACTIONS MENU (pull the
avatar-ops action menu out of the inspect panel into its own easy panel). Also Wave 4 character-creation
overhaul from the prior batch. NOTE: a PARTIAL/failed sabotage doesn't register the full scene (only
opSuccess does) — by design, but could add a weaker scene for partials later if Carlo wants.

---

## ⚡ PLAYTEST WAVES 1+2 — control model + station depth (prior session) ⚡

**WAVE 1 — control model + daily-annoyance UI fixes:**
- **INSPECT PANEL CLOSE BUTTON (+Esc):** the always-on character panel now has a top-right × (`#insp-close`)
  that clears ST.sel + hides it; Esc also closes it. Fixed "panel is hard to close, always on screen."
- **CLICK-TO-TARGET ACTION MENU (the big control fix):** "we are the avatar" — clicking a wisp now surfaces
  an OPERATIONS section right in their panel showing the ops valid AGAINST them (surveil/bribe/blackmail/
  frame/assassinate), range-aware + gated (blackmail needs a known secret, frame/assassinate need a regime
  target). Clicking an op runs it directly on that wisp — NO more "pick op, then click target." Researched
  the convention (immersive-sim/CRPG: select+act-in-one-gesture beats radial menus for readability). Wired
  via `.wisp-op` buttons + `data-wop` handler in the inspect click listener. `→` marks out-of-range ops.
- **AUTO/MANUAL TOGGLE (`ST.avatarManual`):** the operative dock now has a MODE button. AUTO = avatar lives
  autonomously between commands (old behavior). MANUAL = avatar waits idle for your orders (no autonomy
  fighting your control) — BUT still handles critical survival (eats when food<18, sleeps when rest<12) so
  neglect can't kill your operative. Gated in pawnTick before chooseJob. Switching to manual drops current
  busywork. VERIFIED: auto acts (jobs picked), manual idles (0 busywork), manual+starving seeks food,
  manual still accepts move/op commands.

**WAVE 2 — unique-use stations + capacity + emotional reactions:**
- **UNIQUE-USE STATIONS:** the root problem was `nearestStruct(p,isWorkable)` ignored occupancy — any number
  of wisps piled on one station. NOW: `workersAt(s,exclude)` counts current workers, `workCapacity(s)` is
  the seat limit (most stations = 1 seat; farmplot/loggingcamp/mineshaft/sporevat = 3; cafeteria/market/bar
  = 2; override per-DEF via `workSlots`), `hasFreeWorkSlot(s,p)` gates selection. `isOpenWork` replaces
  `isWorkable` in the work-picker so wisps only claim a station with a free seat. VERIFIED: a single
  workstation now seats ≤1 wisp at a time (was unlimited); employment stays 100% healthy (72 workable
  structures / 133 capacity / 12 adults in a fresh map).
- **FRUSTRATION REACTION:** when a wisp wants to work but EVERY fitting station is full (`allWorkFull`), they
  react — emote anger/sweat/gross/cry, take a stress (+3-7) and mood (−2-5) hit, a small allegiance dent,
  sometimes a memory ("sick of waiting to work"), and back off retrying briefly. Throttled per-wisp
  (workFrustCd). VERIFIED: 4 wisps hit frustration when forced to compete for one station.
- **STABILITY:** full day clean, max stuck 39t (well under 140 cap), 13 survive, economy intact (touched
  core job AI — stuck-loop + employment + economy all re-validated). Smoke 20/20, no dead/dupe, CSS balanced.

**STILL PENDING (Carlo's playtest batch):** Wave 3 = a sabotage TEST SCENARIO (the stealth loop is already
built — Phase 2 perception + embodied ops — so this is mostly runnable instructions, implement only if a gap
shows). Wave 4 = FULL character-creation overhaul (Carlo wants it rethought, not just de-clipped — current
screen at the YOUR OPERATIVE modal; CC working state via `window.PENDING_AVATAR`, `CC` object,
`ccStats/ccPointsUsed/ccRemaining` helpers, #modal handler data-ccbg/ccinc/ccdec/cc-begin/cc-back). NOTE:
text clipping on the right edge of background descriptions was visible in Carlo's screenshot — fix in Wave 4.
Also still open from before: pre-commit witness readout (design Q unanswered), Phase 3-5 (reactions/
animations/stealth-depth/polish), the perf finding (pawnTick ~1.9ms/pawn, parked).

---

## ⚡ FULL DOC-VS-CODE AUDIT + ABORT-ON-MOVE (prior session) ⚡

- **AUDIT RESULT — all doc-claimed systems verified:** canSee, witnessPenalty, runWitnessCheck,
  advanceActiveOp, resolveAvatarOp, inOpRange, resolveOpTarget, opState, bribeReceptivity, renderOpDock,
  opDockState all present + wired (call sites confirmed). The 5 "Findings" the doc claims fixed all hold in
  code: F1 move-to-tile works, F2 AI doesn't interrupt an op (the critical one — 0 jobs grabbed mid-op),
  F3 stuck-detector exempt, F4 zero drift against a crowd, F5 snapPawn nulls activeOp + clean serialize.
  Behavioral claims verified: positioning gates the op (far blocked/near stages), op holds position +
  advances, a witness arriving MID-op affects the outcome (resolve-time computation works), darkness blinds
  witnesses at range.
- **DOC-VS-CODE DISCREPANCY FOUND + FIXED:** the doc says "a move command mid-op ABORTS the op (Operation
  abandoned)," but the Phase 1 code actually BLOCKED movement during an op (the `!selA.activeOp` guard).
  Code now matches the doc (and the better UX): clicking to move during an op ABORTS it ("Operation
  abandoned.") and starts the walk — you can break off if the heat shifts. Fixed in BOTH clickSelect +
  tapAction. VERIFIED: mid-op move-click clears activeOp + issues the goto.
- **DOC-VS-CODE NAMING DRIFT (not a bug):** the doc's pseudocode names a `beginAvatarOp` staging function;
  the actual staging logic lives INSIDE `runAvatarOp` (same behavior — validates cost/range/secret then
  sets activeOp). Functionality is complete; only the name differs. Noted, not changed.
- **PERFORMANCE PROFILE (honest finding, NOT fixed — out of scope + risky):** Phase 2 perception is
  negligible (witnessPenalty 0.002ms, only runs at resolve; separatePawns 0% of tick; renderOpDock
  0.001ms). BUT the core `pawnTick` is ~1.9ms/pawn (95% of tick time) — pre-existing AI/pathing cost, NOT
  from the ops/UI work. At normal speed it's a non-issue (~1 tick per 6 frames); only at MAX fast-forward
  could 10 ticks/frame approach the budget. chooseJob is 0.18ms, gotoCell 0.011ms — the cost is spread
  across the rest of the per-pawn AI (needs/mood/relationships). Optimizing the core sim is a deep, risky,
  separate undertaking that could destabilize the validated simulation — deliberately NOT attempted here.
  Flagged for a future dedicated perf pass if max-speed stutter ever bothers Carlo.
- **VALIDATION:** smoke 20/20, no dead/dupe, CSS balanced, full render clean (dock + reactive panel + op +
  ring all active).

---

## ⚡ EMBODIED OPS PHASE 2 — PERCEPTION & WITNESSES (prior session) ⚡
NPCs who can see you raise the difficulty of an op's roll, and being seen escalates fallout. Stealth
positioning (where + WHEN you act) is now a real mechanic.

- **canSee(obs, av, op):** the reusable perception query. Returns 0 (can't see) or a positive weight (how
  damning the witness is). Factors: distance vs `op.sightRange`, DARKNESS (`lightLevel(hourN())>0.3` shrinks
  sight ×0.62 — acting at night lets you slip closer unseen; a `nearLamp` hook ×1.4 is stubbed for later),
  ATTENTION (working ×0.6 / socializing ×0.7 / sleeping ×0.2 / idle 1.0), PROXIMITY falloff, and WHO is
  watching (enforcer/regime ×2.6, hostile loyalist ×1.8, sympathizer ×0.5, gang ×0.15, children/sleepers 0).
- **witnessPenalty(av, op):** sums the weighted witnesses who can currently see you → `{pen, count}`,
  scaled by `op.witnessK` (loudness). Wired into `resolveAvatarOp`'s difficulty: `opsCheck(stat,
  diff+expPenalty+wit.pen)`. Computed at RESOLVE time, so a wisp who wandered into view mid-op still counts
  — long ops in busy/lit places are genuinely riskier.
- **AVATAR_OPS loudness profile:** each op gained `sightRange` + `witnessK`. Quiet ops (bribe/blackmail
  sight4/K0.4, intel/surveil sight5/K0.5) vs loud (assassinate sight8/K1.4, sabotage sight8/K1.2,
  dissent sight9/K0.8). A whispered bribe is barely noticed; a loud assassination is seen from across the block.
- **runWitnessCheck(p, op, check, count, pen):** post-act fallout, generalizing witnessCrime. If anyone
  saw it: awareness + heat rise (scaled by count + whether the op failed/botched); an enforcer who can see
  you MARKS you (`grudgeTarget`, especially on a visible failure); witnesses emote alarm (excl/shock);
  sympathizers look away. Nobody saw = clean getaway, no extra fallout.
- **VERIFIED:** alone = 0 witnesses/penalty; enforcer adjacent = penalty 5 + canSee 2.44; +3 wisps = 4
  witnesses/penalty 11; sleeping enforcer = 0 (blind); DARKNESS proven — a witness at 6 tiles sees you at
  midday (canSee 0.63) but is COMPLETELY BLIND at deep night (canSee 0, penalty 0). Full-day stability:
  16 ops, no crash, 13 survive. Witnessed steal → awareness 14 + heat 5 + enforcer mark vs ~0 alone.
  Smoke 20/20, no dead/dupe, CSS balanced.
- **BUG FIXED THIS SESSION:** a str_replace inserting `runWitnessCheck` consumed the `function opSuccess`
  declaration → "unexpected }" cascade. LESSON RE-CONFIRMED: `node --check` reads a temp file; must
  RE-EXTRACT the script before every check or a stale "valid" misleads. Diagnosed via per-function brace-depth walk.

**STILL PENDING — Phases 3-5 (NOT built this session):** Phase 3 = NPC behavioral reactions (flee/
investigate/gossip beyond the emotes) + per-op ACTION ANIMATIONS (the `anim` field — plant/strike/confer/
tail/rally/lift — is set on every activeOp and ready to drive drawPawn) + a live on-map witness pip. Phase
4 = stealth depth (the `nearLamp` hook, enforcer patrol gaps, diversion synergy, cover/line-of-sight).
Phase 5 = animation polish + AI-narrated outcomes + audio (NOTE: Claude CANNOT see animations or hear audio
— Phase 5 needs Carlo's eyes/ears). The architecture doc Section 7 has the full plan.
**PRE-COMMIT READOUT (open design Q):** showing witness count + difficulty BEFORE committing an op is
designed but NOT built — Carlo was asked which he prefers (readable pre-commit vs opaque read-the-room) and
hasn't answered yet. That's the natural Phase 3 UI addition.

---

## ⚡ REACTIVE OPS UI + OPERATIVE DOCK (prior session) ⚡
A focused UI pass for the avatar-driven embodied-ops play, built to Carlo's preference for "organized,
reactive, hideable menus." Guiding rule: **disable the impossible, signal the dangerous, hide the
irrelevant.** Also did 5 deep verification passes on Phase 1 first (all green) + a pending-mechanics audit.

- **REACTIVE OPS PANEL:** the operations menu is now organized into 3 CATEGORIES (INTELLIGENCE:
  intel/surveil · INFLUENCE: dissent/bribe/blackmail/frame · DIRECT ACTION: sabotage/steal/assassinate)
  via `OP_CATEGORY`/`OP_CAT_ORDER`. New `opState(opKey)` is the brain: returns `{ok,reason,risk,targeted}`.
  PREREQUISITES (no intel / no secret) → the button is DISABLED (real impossibility). RISK (exposure +
  REG().awareness) → the op stays AVAILABLE but shows a danger tier (low/raised/high/extreme) with a
  colored dot (◈/◈◈/⚠) — loud ops (strike/plant anims) get +1 risk at high heat. Design choice (deliberate,
  defensible): heat NEVER blocks an op — a desperate high-risk strike in a hot district is a story beat, not
  a bug. Only impossibility disables. CSS: `.opcat`, `.i-op.armed` (pulsing glow when targeting), `.opdis`.
- **OPERATIVE DOCK (collapsible):** a quiet persistent status strip bottom-LEFT (`#op-dock`, doesn't
  collide with the centered toolbar) that ALWAYS shows what your operative is doing (idle / "Moving to
  position…" / "Gather Intel — 33%" with a live progress bar) and EXPANDS on tap into a control panel
  (SELECT = jump camera+select, FOLLOW = camera toggle, intel/exposure readout). Collapses when tapped
  again. `renderOpDock()` + `opDockState(av)` + `OP_DOCK_OPEN` flag; called from `syncHUD` and refreshed
  every 3 ticks in the loop while an op/goto is live so progress animates. Uses existing `--cy`/`--disp`
  tokens — native to the established cyberpunk look. Click handler on `#op-dock` (strip toggle + jump +
  follow). Mobile-responsive (@media narrows it).
- **REPUTATION-GATED BRIBES (pending mechanic, now built):** `bribeReceptivity(target)` — a FEARED
  operative (rep < -20) buys silence more easily (+0.18), a BELOVED one meets more resistance to outright
  corruption (-0.12), scaled by the target's integrity. Wired into the bribe partial-outcome refusal check
  (was a flat intg>60; now reputation shifts the threshold). VERIFIED: feared 0.63 vs beloved 0.33
  receptivity on the same target.

**VERIFICATION — Phase 1 re-audited (5 passes, all green) BEFORE the UI work:** (1) all 9 ops individually
through staging — each stages+resolves; (2) integration seams — non-avatar pawns never get activeOp, avatar
autonomy intact, state transitions clean (work→goto→op→resumed), old p.cmd works; (3) edge cases — target
dies mid-op (clean abort), double-stage rejected, low-intel rejected, avatar dies mid-op (no crash); (4)
assassinate→election cascade intact through staging; (5) full save→load round-trip (activeOp cleared on
load, dossier preserved, loaded game runs 400t stable, can stage ops after load). **UI: 3 cycles green** —
reactive states + render, dock in all states, full-day stability (48 renders, 13 survive). Smoke 20/20, no
dead/dupe, CSS balanced, full render clean.

**PENDING MECHANICS AUDIT (Carlo asked):** Still pending — Phase 2 perception/witnesses (the big next one:
canSee, witnessPenalty, pre-commit readout); AI-narrated op outcomes; richer investigation layer; agent
requests (REQUESTS_ENABLED=false, deferred); weekly city-council session (the recurring "natural next");
building footprint reorg/resize + furniture for new buildings; rain/thunder audio (can't verify); camera
auto-pan (only button built). NOTE: exposure→op-availability gating is now PARTLY addressed (signaled in
the reactive panel, not hard-blocked — by design). HONEST UNTESTED: the dock + reactive panel are
structurally validated but Claude can't SEE them render — Carlo should eyeball the dock strip/expand feel,
the category layout, the risk-dot colors, and that the dock doesn't overlap anything at his resolution.

---

## ⚡ EMBODIED OPS PHASE 1 (prior session) ⚡
Implemented all four outstanding audit findings + the activeOp staging machinery. Ops are no longer
instant menu-buttons — the avatar now physically performs them over time, in position.

- **STAGING MACHINERY:** `runAvatarOp(opKey,target)` no longer resolves instantly — it STAGES an
  `activeOp={opKey,target:desc,prog,duration,startTick,anim}` on the avatar (after validating intel cost,
  range, and secret-gate), then nulls `p.job`. `advanceActiveOp(p)` ticks `prog` each tick and aborts if
  the target vanishes. `resolveAvatarOp(p)` fires the banded `opsCheck` roll + consequence switch (the
  former runAvatarOp body — opSuccess/opPartial/opFailure, all unchanged) ONLY on completion. Targets are
  stored as serialization-safe descriptors (`{kind:"s",key}` or `{kind:"pawn",id}`), resolved live via
  `resolveOpTarget()`. `inOpRange(av,op,target)` gates targeted ops (range-0 ops always pass).
- **AVATAR_OPS extended:** each op gained `range`, `duration`, `anim` fields. intel(r0,d60), surveil(r3.5,
  d90), dissent(r0,d70), sabotage(r1.8,d100), steal(r0,d80), bribe(r1.8,d55), frame(r1.8,d90), blackmail
  (r1.8,d60), assassinate(r1.6,d75).
- **FINDING 2 (the critical one) FIXED:** `if(p.isAvatar&&p.activeOp){advanceActiveOp(p);return;}` is now
  placed in pawnTick BEFORE the `if(!p.job)p.job=chooseJob(p)` line, so an in-flight op holds and the AI
  does NOT re-grab a job. VERIFIED: 30 ticks into an op, zero jobs grabbed, avatar held position.
- **FINDING 4 FIXED:** `separatePawns` now exempts `activeOp` avatars (`if(a.activeOp)continue` +
  `if(b.activeOp)continue`). VERIFIED: avatar held with ZERO drift even when 3 pawns crowded onto it
  through 20 separation passes.
- **FINDING 5 FIXED:** `snapPawn` now nulls `activeOp` (added to its Object.assign null-list). VERIFIED:
  full serialize+stringify mid-op succeeds (182KB, no circular-ref crash); saved avatar has null activeOp.
  An op cancels cleanly on reload (acceptable/safe).
- **RANGE-AWARE TARGETING:** the `clickSelect` op-targeting branches (utility/regime/anyPawn) now check
  `inOpRange` BEFORE staging; out of range → "Too far — walk your operative next to it, then pick it
  again" and KEEPS targeting active so the player can move + re-click. VERIFIED: sabotage from dist 88
  REJECTED, from dist 0.7 STAGED.
- **IN-FLIGHT UI:** the OPERATIONS panel shows "▸ OPNAME — performing… N%" + a progress bar + "Move your
  operative to abandon" instead of the op grid while an op runs. The avatar gets an on-map filling
  progress RING in drawPawn, tinted by op type (strike=red, confer=gold, plant=orange, lift=green,
  rally=cyan, tail=purple). VERIFIED: panel + ring render clean; grid returns after resolve.
- **MOVE-GUARD:** the existing avatar move-on-click is gated by `!selA.activeOp`, so you can't walk the
  avatar mid-op (the op holds). NOTE: this is "can't move during op," NOT "move aborts op" — a deliberate
  simpler choice that reinforces the commit-to-the-deed tension. Flipping to abort-on-move is a small
  change if Carlo prefers it.

**VALIDATION: all 5 cycles + the full battery pass.** Cycle 1 (stage/hold/perform/resolve + Finding 2),
Cycle 2 (range gate far-rejected/near-staged + sabotage success path), Cycle 3 (Finding 4 zero-drift +
Finding 5 clean save), Cycle 4 (full-day stability, 14 ops, max stuck 4t, 0 overlaps, 13 survive), Cycle 5
(move-guard holds + in-flight render clean). Smoke 20/20, no dead/dupe, CSS balanced.

**NEXT: Phase 2 (perception/witness pressure)** — `canSee(observer,avatar,op)`, `witnessPenalty` into
resolveAvatarOp's difficulty, generalize `witnessCrime` into `runWitnessCheck`, pre-commit difficulty +
witness readout. The architecture doc (Section 7) has the full Phase 2-5 plan. The `anim` field is set on
every activeOp and ready for the Phase 3 action animations (plant/strike/confer/tail/rally/lift in
drawPawn). HONEST UNTESTED: the on-map ring + panel are structurally validated but Claude can't SEE them
render — Carlo should eyeball that the ring fills smoothly and the tints read right.

---

## ⚡ AVATAR CLICK-TO-MOVE + ARCHITECTURE PLAN (prior session) ⚡

- **AVATAR CLICK-TO-MOVE (shipped, validated):** the player can now directly position the avatar. With the
  operative SELECTED, clicking an empty walkable tile issues a new `goto` job (`{t:"goto",x,y}`) that walks
  it there via `gotoCell`, then CLEARS on arrival so the avatar RESUMES its autonomy (it goes back to
  living its life — eats/sleeps/works). You take the wheel only when you choose to. Wired into BOTH click
  handlers (`clickSelect` ~6470 and `tapAction`), gated by `selA.isAvatar && !selA.activeOp &&
  colCost(c.x,c.y)>=0`. The `goto` case was added to the pawnTick job switch (right after `idle`). The
  `!selA.activeOp` guard is a safe forward-reference (activeOp doesn't exist yet — it's Phase 1 of the ops
  build — so the guard is always true now and correctly future-proofs). VERIFIED end-to-end: avatar walks
  from (51,71) to a clicked tile, job clears at arrival, resumes normal AI (picked up a work job after);
  no stuck-loops (max 3t), spacing intact (0 overlaps), 13 survive. This RESOLVES "Finding 1" of the
  architecture audit (the missing move-to-tile prerequisite).

- **EMBODIED OPERATIONS ARCHITECTURE PLAN (16-page Word doc):** a comprehensive technical design for
  turning avatar ops from instant menu-buttons into PHYSICAL DEEDS the avatar travels to and performs in a
  world that witnesses and reacts. Owner's 3 decisions drive it: (1) manual positioning gates the op (walk
  into range, button arms), (2) witnesses RAISE dice difficulty live + stealth positioning is the core
  skill, (3) mechanics + animation both, in phases. Core insight: difficulty becomes a function of
  who-can-see-you, computed at RESOLVE time (so a witness wandering in mid-act still counts). Built on
  existing systems: the job model (`gotoCell→arr→prog`), `witnessCrime`/`onlookersReact` (perception),
  banded `opsCheck` (the live-difficulty lever), `drawPawn` procedural animation. 5 subsystems, 5 validated
  phases. **The doc includes a SECOND-PASS CODE AUDIT (Section 10)** that stress-tested the plan against
  index.html and found 5 real issues (now corrected in the doc):
    1. Move-to-tile didn't exist — NOW RESOLVED (the click-to-move above).
    2. CRITICAL: setting `avatar.job=null` during an op does NOT suspend AI — line ~3549
       `if(!p.job)p.job=chooseJob(p)` runs every tick and immediately re-grabs a job. The `activeOp` check
       must intercept + `return` BEFORE that line.
    3. The 140t stuck-detector is already exempt (it gates on `p.job`; activeOp lives outside job).
    4. `separatePawns` would push a performing avatar off its spot — needs an `activeOp` exemption + position pin.
    5. `snapPawn` doesn't null `activeOp` — store target as ID/key (not object ref) + null on save, cancel on load.
  The plan is build-ready. NEXT: Phase 1 of the embodied-ops build (the `activeOp` job machinery), with the
  move-to-tile foundation already in place.

---

## ⚡ INFILTRATOR SYSTEMS (prior session) ⚡
Carlo's vision: the avatar is the lone infiltrator who brings down the regime through subterfuge; make
sessions organic via investigation + the dice as the engine of risk/consequence. Built in 4 validated
stages:

1. **WISP SPACING/SEPARATION (structural):** `separatePawns()` runs each tick after movement — a soft
   boids-style push so wisps occupy personal space and don't stack (MIND=0.62 tiles). EXEMPTS sleepers (in
   pods) and socializing pairs (`socWith` — they SHOULD stand close), and never pushes a wisp into a wall.
   Kept subtle so it never fights A* pathing. VERIFIED: 0 overlapping pairs after a day, socializers stay
   close (0.30), non-social get pushed to 0.62, no wall-clipping, no stuck-loops.
2. **DICE-AS-STORY (the engine):** `opsCheck` now returns a BANDED outcome (`critfail`/`fail`/`partial`/
   `success`/`critwin`) derived from margin + the raw d10 (natural 1 always ≥fumble, natural 10 always
   ≥success — luck and skill each have a floor). Still returns `pass`/`margin`/`roll`/`die`/`stat` so old
   callers are compatible. `runAvatarOp` branches on the band: crit = bonus + minimal trace; success =
   clean; PARTIAL = it half-works but leaves a complication (the interesting new middle — e.g. a partial
   sabotage = shorter outage + you were nearly seen); critfail = botched. Each band has its own exposure
   cost. The roll SELECTS WHICH STORY you get, not just pass/fail.
3. **SECRETS & INFORMATION (observe→leverage spine):** wisps carry discoverable dirt (`wispSecret()` —
   informant/gang/affair/addiction/graft/framed). `surveil` op or a crit `intel` op reveals a wisp's secret
   (`maybeSurfaceSecret`), marking it `secretKnown` + logging it to the avatar's `dossier`. A KNOWN secret
   is leverage — it GATES the blackmail op. This is the two-act subterfuge loop: find the secret, then use
   it. VERIFIED end-to-end: surveil → secret known → blackmail succeeds using it.
4. **5 NEW OPS (the toolkit, now 9 total):** added `surveil` (insight, find a wisp's secret), `steal`
   (tradecraft, skim regime funds → grip down + intel), `bribe` (guile, buy a wisp's loyalty/silence;
   principled wisps may refuse + report), `blackmail` (presence, needs a known secret, coerce a wisp — turn
   an informant, force compliance, they resent you), `assassinate` (nerve, diff 16, kills a regime figure
   via `killPawn` → triggers the death/election cascade; partial = wounded + regime on full alert; the
   ultimate feared act). Each has success/partial/fail branches. Target types: `utility` (buildings),
   `regime` (loyalists/enforcers/informants), `anyPawn` (surveil/bribe/blackmail). The `clickSelect`
   targeting flow handles all types + the blackmail secret-gate.

- **UI:** the OPERATIONS panel (avatar status tab) now shows all 9 ops in a 2-col grid with short labels +
  intel costs, a 🔒 lock on blackmail until you hold dirt on someone, the intel/exposure/reputation line, a
  high-exposure warning, the LIE LOW button, and the targeting prompt. Verified: 9 buttons render, lock
  shows correctly.
- **Persistence:** all new state (`secretKnown`/`secret`/`bribed`/`coerced`/`dossier`/`opXp`/`rep`) lives on
  pawns/avatar which `snapPawn` copies wholesale; `sabotaged` on structs via `snapStruct`. Fresh on newGame.
- **Validation:** ALL TESTS PASS, no dead/dupe code, CSS balanced, render clean, spacing holds (0 overlaps),
  no systemic stuck-loops (baseline 117t = a legit `learn` job; the game's own 140t stuck-detector handles
  edge cases). All 9 ops tested end-to-end incl the observe→leverage chain and the assassination→election
  cascade. NOTE on testing: a stale pawn reference after `killPawn` can confuse harness loops — re-fetch the
  target each iteration (the kill path itself is correct).

**DESIGN NOTE — where this goes next (Carlo's vision, still expanding):** the infiltrator loop is
observe→leverage→act→reckon. Possible next: deepen the AI-narrated outcomes (each op result as a little
story via the cheap model), make exposure/awareness feed back into what's AVAILABLE (high awareness =
streets crawling, some ops locked), reputation gating which wisps will take a bribe, and a richer
investigation layer feeding the secrets system. The bones are all in place.

---

## ⚡ AVATAR OPERATIONS (prior session — the original 4-op toolkit) ⚡

The player's avatar now has a full insurgent OPERATIONS toolkit — turning the avatar from a passive
influencer (recruit/force/back-election) into an active protagonist. Design (Carlo): a toolkit of ops,
HIGH-RISK (failure spikes exposure + can get you caught), WITH progression (stats grow with use + district
reputation builds).

- **The toolkit (`AVATAR_OPS`, 4 ops):**
  - **Sabotage Infrastructure** (tradecraft, 10 intel, targets a power/water building): knocks the utility
    offline for 1–1.5 days (`s.sabotaged=ST.tick+...`), triggers a blackout if power, +heat, +support,
    −regime grip. The flagship insurgent strike. Reputation −6 (feared).
  - **Gather Intel** (insight, free, no target): +6–12 intel. Rep +2.
  - **Spread Dissent** (presence, 6 intel, no target): +support, nearby wisps warm to the cause. Rep +5
    (championing people earns goodwill).
  - **Frame a Regime Asset** (guile, 14 intel, targets a loyalist/enforcer/informant): plants evidence,
    turns the block against them, −regime grip. Hardest/riskiest. Rep −4.
- **The core runner (`runAvatarOp`):** spends intel, applies an EXPOSURE PENALTY to difficulty
  (`Math.floor(exposure/25)` — the more suspected you are, the riskier everything is), rolls `opsCheck`,
  branches to `opSuccess`/`opFailure`. Big-margin successes leave less trace.
- **HIGH RISK (`opFailure`):** failure spikes exposure (+12, or +22 if botched) and regime awareness; a
  botched op can draw an enforcer's grudge. Verified: spamming ops drove exposure to 64 over a day — the
  tension is real, you can't just spam.
- **PROGRESSION:** `trainOpStat` grows the used stat via `avatar.opXp` (need 4+stat*2 reps, harder as it
  climbs, caps at 10) — "you get better at what you practice." District REPUTATION (`avatar.rep.district`,
  −100 feared .. +100 beloved) shifts by op nature: sabotage/frame lower it (feared), dissent/intel raise
  it. Shown as FEARED/RUTHLESS/UNKNOWN/RESPECTED/BELOVED.
- **UI:** an OPERATIONS panel on the avatar's STATUS inspect tab — shows intel/exposure/reputation, the 4
  op buttons (greyed if unaffordable), a LIE LOW button (reduce exposure), and a high-exposure warning.
  Targeted ops (sabotage/frame) enter a TARGETING mode: the panel prompts you to click a building/asset on
  the map, and `clickSelect` intercepts the click to run the op on that target (with validation — must be a
  utility building / a regime asset). Non-target ops (intel/dissent) run on click.
- **Sabotage hook:** the `hasPower`/`hasWater` utility computation (~line 4394) now also tests
  `!(s.sabotaged>ST.tick)`, so a sabotaged building genuinely goes offline. NOTE the utility mood-effect
  computation runs on a DAILY cadence (`ST.tick%TPD===0`), so sabotage duration was set to 1–1.5 days to
  reliably span a daily check; the blackout effect (`ST.blackoutUntil`) is immediate regardless.
- **Persistence:** `snapPawn`/`snapStruct` copy ALL fields (`Object.assign`), so `rep`/`opXp`/`framed` (on
  pawns) and `sabotaged` (on structs) serialize automatically; `mov`/`regime` (intel/exposure/support) were
  already saved. Targeting state (`ST.opTargeting`) resets on newGame. Validated: clean, no stuck-loops
  (max 47t), all 4 ops work end-to-end, UI renders, progression + reputation + exposure all function.

---

## ⚡ HEALTH AUDIT + BALANCE (prior session) ⚡

- **Broad health scan (economy / mood / population / disease over multi-day runs)** to find degenerate
  trends. Findings:
  - **Chronic sickness (REAL weak spot — FIXED):** infection recovery used to STRICTLY require `hyg>50 &&
    hp>50`, but sickness blocks work (→ no income → hygiene hard to maintain), so sick pawns got trapped
    below the hygiene gate and stayed chronically ill — the city trended toward everyone-sick. FIX:
    recovery now works at ANY health above hp>35 with a tiered chance (clean+healthy 14%, ok-hygiene 7%,
    rough 3.5% per 80 ticks) — better hygiene still speeds it, but being sick is no longer a near-permanent
    trap. VERIFIED: sickness now OSCILLATES (peaks ~5/13, ebbs back via recoveries) instead of ratcheting to
    everyone — a managed disease pressure, not a death spiral.
  - **Income (FALSE alarm):** a 2-day snapshot showed income at 29 (looked like insolvency), but the real
    trajectory is healthy — climbs 200→236, settles ~137; no crisis, no debt, pawns accumulate credits
    (avg 62). Economy is stable and self-sustaining. No change needed.
  - **Mood/social/feedback/onboarding — all SOLID:** mood drifts gently (60→49 over 2d, not collapse);
    relationships richly drive behavior (47 `relGet` uses — socializing, partnerships, grudges, revenge,
    rivalry); ~30 events get visible BANNERS; 15 contextual first-time HINTS onboard the player. The game
    is in genuinely good shape — most systems are well-built, so this pass was honest auditing + targeted
    fixes rather than manufacturing problems.
- **Election visual presence (enhancement):** the election was mechanically clean but INVISIBLE (candidates
  didn't gather or signal). Added performative CAMPAIGN EMOTES during a race — schemers (low intg) smirk
  with scheme/smug, idealists (high amb) beam with party/happy — fired every ~55 ticks, NO forced pathing
  (preserves the no-crowd-jam property). Now you can spot who's running on the map. Verified clean through
  full election cycles, no loops.

---

## ⚡ AUDIT + CORE-FABRIC (prior session) ⚡

- **Cafeteria death-spiral — VERIFIED end-to-end:** simulated an eviction wave (5 pawns forced homeless +
  broke + hungry) WITH vs WITHOUT a cafeteria. With it, hungry victims kept avg food 58 vs 37 without;
  pawns actively eat at the cafeteria (26 eat-ticks/day) and it consumes the communal farm stockpile (so it
  genuinely "serves the grown food"). HONEST nuance: the death-spiral was never catastrophic at baseline
  (the counter/bar already serve as fallback food + a subsistence-income mechanic exists), but the cafeteria
  measurably improves food access and gives a dedicated thematic place. Verdict: working as intended.
- **Election crowd stuck-loop hunt — CLEAN:** the election is purely ABSTRACT — it does NOT send pawns to
  city hall or make them congregate (no `chooseJob`/`scoreJobs` changes), so there's no crowd-jam risk. Max
  stuck-streak during a full campaign = 6t (cap is 140t). Candidates live normally during the campaign
  (12–40 job changes). NOTE the tradeoff: the election is mechanically clean but less VISUALLY present
  (nobody walks anywhere) — a future enhancement could stage a physical gathering if desired.
- **Sabotage system — PRE-INVESTIGATED (design note written to SABOTAGE_DESIGN.md):** mapped exactly how a
  power/water sabotage system hooks into the existing utility computation (~line 4251: `hasPower`/`hasWater`
  = building exists + not blueprint + has a worker — so 3 ways to knock it out), the blackout mechanic
  (`strikeBlackout` ~3982 is the model), building damage (`hp`/`isBroken`/`surgeT`), and the insurrection
  layer (`ST.mov`, `allegiance`, `insurgentLever`). Minimal first version + exact lines-to-touch documented
  so the build goes fast. Not built yet — it's the blueprint.
- **CUTER EMOTES (your "cute even if evil" ask):** redesigned the emote set — 21 emotes now (was 17). Every
  emote gets a SOFT GLOW BLOOM behind it (`glowSprite`, per-emote `bloom` factor) + a CUTE bounce-in pop
  (spring up past full size, overshoot, settle). Upgraded glyphs to rounder/softer forms (florettes,
  sparkles, rounded heavy !/?, heart-! for anger so even mad reads cute). Added an "EVIL BUT CUTE" set:
  `scheme` (smug dark smiley), `evil` (violet heart — cute menace), `smug` (pleased spark), `greed`
  (sparkle-eyes for $$). Wired them: a content-but-crooked wisp (low intg / gang / addicted) shows
  scheme/evil instead of plain cheer; an ambitious flush wisp shows greed; a low-intg high-amb wisp preens
  with smug even when neutral. All render validated.
- **CORE FABRIC — attribute influence deepened (audit found `cur`/`emp`/`cau` underused):** mapped how much
  each personality attribute drives behavior — `intg`(23 refs), `amb`(19) well-used; `cur` was barely used
  (3 refs), `emp`(8), `cau`(7) thin. Enhancements: CURIOSITY now strongly drives learning (`learn` weight
  `cur/150` + base scaled by cur) and reduces idling (curious wisps would rather DO something) — but EASES
  when a need is critical (a bored wisp still picks fun over a textbook, preserving smoke test F2). EMPATHY
  now drives `treat` (empathetic wisps rush to tend the sick, `emp/120`) and `visit` (warm wisps check on
  friends). VERIFIED: curious wisps now learn ~32% more per capita than incurious ones (1761 vs 1332
  learn-ticks/2d) — a real, measurable behavioral difference where before `cur` did almost nothing. Tuning
  lesson (recurring): boosting an attribute's job-weight can break the personality-fidelity smoke tests
  (F1/F2/F3) — scale the boost so a CRITICAL need still wins; don't let a trait override survival/pressing
  needs. No stuck-loops introduced (max 62t, cap 140t).

---

## ⚡ ELECTION HARDENING (prior session) ⚡
- **Concurrent elections (bug):** `ST.election` was singular, so if a 2nd role-holder died while an election
  ran, the 2nd vacancy OVERWROTE the first — the first seat would sit empty forever. FIX: added an
  `ST.electionQueue`; a vacancy that arrives mid-election is queued, and the next queued election kicks off
  when the current one resolves. Verified: kill doctor + shopkeeper together → both seats refill, all 6
  roles restored. (Matters in real play when a fire/raid kills multiple role-holders at once.)
- **Save/load (bug):** `ST.election`/`ST.electionQueue` were NOT in the save payload, and load explicitly
  reset them to null — so saving mid-campaign LOST the election (seat empty forever on reload). FIX: added
  both to the save payload + restore them on load; removed the stale null-reset in `applyState` that was
  wiping the restored value. Verified: election is in the save payload + survives reload.
- **Endorsement balance (tuning):** measured how often the player's backed candidate wins when backing the
  WEAKEST (lowest-fit) candidate — was 63% (too close to a rubber stamp). Reduced the endorsement weight
  from `0.15` to `0.10` per voter → now 38%, the ideal range: your backing clearly MATTERS, but the block
  can override a genuinely-poor pick most of the time. Makes the "can you override the wisps' judgment?"
  tension feel right — real influence, but not a dictator; backing a bad candidate is a gamble.

---

## ⚡ ELECTION SYSTEM (same session — the feature itself) ⚡

- **ELECTIONS (big new system):** when a public role-holder DIES, that seat opens and the block elects a
  replacement. Design choices (Carlo): trigger ONLY on death; the seat sits EMPTY during the campaign
  (~0.6 day) so the loss is felt; candidates self-nominate by ambition OR role-fit; the PLAYER can propose/
  back a candidate (who competes, doesn't auto-win). Voters score each candidate by role-fit (`roleFit()`
  = closeness of pers to the role's `persLean`) + relationship + a small pitch-bump + the player's
  endorsement (weighted by the voter's allegiance), colored by voter empathy (empathetic voters weigh
  relationships, pragmatic weigh fit). Winner installed via `installRole()`; ambitious losers take a mood
  hit + a grudge toward the victor; backing the winner/loser nudges the avatar's standing. Functions:
  `openElection`, `proposeCandidate`, `tallyElection`, `resolveElection`, `installRole`, `electableRole`,
  `roleFit`. State in `ST.election` (reset on newGame/load). Triggered from `killPawn`; resolved in the
  tick loop when `ST.tick>=election.voteAt`. AUTO-FILL fallback: if nobody runs, the best-fit wisp is
  pressed into the role so the city isn't crippled. The secret informant never holds elections.
  - **AI showcase layer (`tickElectionPitches`, gated like NPC convos):** each candidate generates a short
    in-character campaign PITCH via the cheap model (revealing personality), and a couple of swing voters
    voice their reasoning ("I'd back X but Y shows up when it matters"). Pitches show as `sayLine` bubbles +
    log entries. Self-gated: only spends while an election is active + when player is watching the speaker.
    AI can't fire headless (no proxy) but all machinery validated; the non-AI vote works fully on its own.
  - **UI:** an election ALERT in the tasks panel (shows the role, candidates, days-left, who you're
    backing); a "BACK FOR <ROLE>" button on the pawn inspect panel (when a vote's underway and the wisp is
    eligible). Verified end-to-end: doctor dies → election opens → seat empty → 4 candidates self-nominate →
    player backs one → vote resolves after the campaign → winner installed as the new doctor. Stable through
    full election cycles, no stuck-loops.
- **Cafeteria building (`cafeteria`, 🍽, Commerce menu):** a public canteen serving communal food
  (`canteen:true`). Added as an eat source in `mkEat` (now `fridge||counter||bar||cafeteria`). This is the
  FIX for the death-spiral: homeless pawns can't use home fridges, so without a public food source they
  starve after eviction — the cafeteria gives them somewhere to eat. Verified: a homeless hungry pawn
  correctly targets the cafeteria.
- **Death cadence — investigated:** deaths are RARE at baseline (2 full days = 0 deaths, pop stable at 13).
  Starvation requires food→0 THEN ~1.25 days of continuous starving to kill (slow, from prolonged neglect).
  Five causes: combat, starvation, untreated infection, murder. The real risk is the eviction→homeless→
  can't-reach-food→starve spiral — which the cafeteria addresses. No pathological fast-death found.
- **Agent requests REMOVED (reversibly):** all 4 generators (`genRequests`, `maybeCliquePetition`,
  `genWorkPetitions`, `genExpansionPetition`) gated behind `const REQUESTS_ENABLED=false;` (near AI_CAP_USD).
  They were too intrusive; flip the flag to restore once tied into the game properly (e.g. via the planned
  weekly council / quests). Verified: zero requests generate.
- **Wisp area readability cleanup:** names render BELOW the wisp with visibility scaled to ZOOM — your
  operative + named roles + the selected wisp are always legible; ordinary wisps' names fade in only as you
  zoom in (`ordinaryVis=clamp((cam.z-1.0)/0.6,0,1)`), so a busy map isn't a wall of overlapping labels.
  Every visible name now gets a consistent dark backing. Emotes SKIP a pawn that has an active speech
  bubble, so they don't stack/overlap above the head. Emotions above, names below — clean separation.

---

## ═══ STILL PENDING (from Carlo's batch) ═══
- **Critical infrastructure + SABOTAGE** (wisps sabotage power/water — BIG, ties to insurrection). NOT started.
- **Real rain/thunder AUDIO** when the weather toggles are on (moderate; Claude can't hear to verify).
- **The requests proper game integration** (Carlo deferred — "put in work later").

---

## ⚡ DEBUG STATE (prior session) ⚡
- **Social-lock infinite loop (SELF-INFLICTED by last session's side-by-side feature):** a stuck-loop
  detector caught pawns holding the `socWith` lock for 184t→1052t (design was 45t). Root cause traced via
  tick-by-tick logging: the SOCIAL HOLD path (`p.job=null` to freeze the partner) was ALSO firing on the
  conversation INITIATOR, killing its own socialize-job progress every other tick, so `prog` never climbed
  to 40 and the pair re-initiated forever every ~8t. FIX: (a) the social hold now only applies if the pawn
  is NOT running its own socialize job (`!(p.job&&p.job.t==="socialize")`); (b) conversation completes on
  job-prog≥40 OR a hard elapsed cap (`elapsed>=70`); (c) post-chat cooldowns (`socCd`, `lastSocPartner`/
  `lastSocT`) stop immediate re-initiation with the same partner. Verified: max lock now ~39t, bounded.
- **Frozen pawns (pre-existing):** pawns stuck 600t+ at a workstation, `prog` frozen at 20 — a pathing
  dead-end (couldn't squeeze the last tile to a work target whose adjacent tiles were tight). Added a
  general STUCK DETECTOR in pawnTick: if a pawn has a job but hasn't moved AND `prog` hasn't advanced for
  ~140t, drop the job, `markUnre` the target, re-choose. IMPORTANT: it checks BOTH no-move AND no-prog, so
  pawns legitimately working/learning in place (which advance prog) are NOT killed. Verified: genuinely-
  stuck incidents went 11 → 0.
- **Phantom "power" good (real bug):** the Power Station had `prod:"power"`, so working it accumulated a
  `ST.goods.power` good that nothing consumes and the HUD never shows (the goods object is data/chem/parts/
  stims/gear/food/scrap). Its SIBLING the Water Facility correctly had NO `prod` — power is a UTILITY, not
  a good. FIX: removed `prod:"power"`. The utility effect (no staffed power building → every adult gets a
  -4 "No power" mood mod; no water → -3 + hygiene drain) is fully implemented at lines ~4136 and works;
  the building still does everything its description promises, minus the phantom good.
- **Audit method:** built a stuck-loop detector (tracks per-pawn position-stillness, job-thrash rate,
  social-lock duration) + a missing-item scan (building types referenced but not in DEF, goods referenced
  but not in the goods object, emote kinds not in EMOTES). Most missing-item hits were false positives
  (`murder`/`informant` are CASE types not buildings; `text` is an AI block type) — only `power` was real.

---

## ⚡ FEATURES STATE (prior session) ⚡
- **Avatar motel/fixer-room start (+ sleep-anywhere fix):** the avatar was sleeping on the ground because
  `mkSleep` targets sleep-PODS and the avatar didn't reliably own one. FIX + feature: the avatar now spawns
  living in the FIXER'S BACK ROOM (`ST.fixerHome`, registered as a reserved cityHome at world ~51,71) with
  its own claimed pod, low `attach` (it's borrowed). Regular pawns skip the fixer home. This is the "start
  in a motel/the fixer's room while you build up" beginning. Avatar sickness confirmed working-as-designed
  (gets infected, blocked from work, recovers when hyg/hp allow — not a bug).
- **Caravan made visible (fixed the "phantom popup"):** the caravan was a real trade deal with NO map
  presence, so "CARAVAN ARRIVES" felt fake. Now `ST.caravan` has an {x,y} (via `caravanSpot()` — next to a
  Market if built, else a road edge) and `drawCaravan()` renders a glowing trader cart with a BUY/SELL goods
  banner. The event now corresponds to something you can see + walk to.
- **Side-by-side socializing (`socWith`):** when two wisps socialize they now LOCK into a stable adjacent
  pair — both pause, hold position, face each other, and emit alternating chat/happy emotes — so the
  interaction is legible (you can see both thought bubbles). Added a `chat` emote (speech mark). The social
  hold is in pawnTick (a `socWith`+`socUntil` lock the partner respects). Verified: pairs lock to distance 0.
- **Lightning toggle (`STORM`, ⚡ button):** mirrors the rain toggle, off by default. `drawLightning()`
  schedules flashes (~2–7s apart) with a cool-white screen flash, occasional jagged bolts, and double-flash
  flicker. CRUCIAL hookup: `stampGlow()` boosts every glow by `STORM.flash` during a strike, so ALL the map's
  neon/sprites POP on each flash (your request). `stormGlow()` exposes the 0..1 flash factor.
- **Expanded NPC routines (daily rhythm):** `mkSched` already produced wake/work/meal times; ADDED an
  evening LEISURE WINDOW (`leisureStart`/`leisureEnd`, sociable wisps start earlier + stay out later). In
  `scoreJobs`, recreate/socialize/visit are biased UP (~1.8x) during the leisure window and gently down
  outside it — but the out-of-window penalty EASES as the need grows (a genuinely bored/lonely wisp still
  goes out), so it biases TIMING without suppressing real needs. Result: daytime is work-heavy, evenings
  shift to leisure. (NOTE: an over-aggressive 0.5x penalty initially broke smoke test F2 — softened to a
  need-scaled `max(0.78, 1-need/220)`; lesson: don't hard-suppress needs, bias timing.)
- **NPC-to-NPC AI conversation (`tickNpcConvo`):** the big one. When two wisps are socializing side-by-side
  AND the player is WATCHING (`playerWatching()` = on-screen + `cam.z>=1.15`), occasionally generate a short
  in-character AI exchange between them using the CHEAP ambient model (`AI_MODEL_AMBIENT`/Haiku) + the shared
  budget guards (`AI_CAP_USD`, leaves 15% headroom for player TALK). Pair cooldowns prevent chatter. Lines
  show as `sayLine()` speech bubbles (`drawSays()` + `roundRectPath()`, wrapped, fade in/out, tail). The
  "only when watching" gate means a handful of API calls per session, only for conversations you can see.
  Called at `ST.tick%40===0`, self-gated internally. AI can't fire headless (no proxy) but all machinery —
  detection, gating, display, tick wiring — is validated; `playerWatching` correctly true zoomed-in /
  false zoomed-out.

---

## ⚡ AUDIT STATE (prior session) ⚡
- **Structural integrity: CLEAN.** No dead functions, no duplicate definitions, no const redeclarations,
  no calls to undefined functions, no leftover debug/console.log, no `debugger`. Removed the one piece of
  dead weight: the empty retired `updateFlags(){}` (and its 3 call sites). `powerRecalc` already gone.
- **Feature-presence: ALL WIRED.** Every system claimed DONE exists in code AND is referenced/called in
  the loop — verified ~22 systems (economy, jobs, eviction, mood, crime, gangs, heists, disasters,
  caravans, dynasties, factions, insurrection, detective, role-wisps, requests, events, relationships,
  cliques, mentorship, room-quality, commerce, spore-vat, blobs). No phantom features.
- **Behavioral validation (ran the sim 5–12 days, measured effects):** Economy active (income → 1442/10d,
  goods flow). Roles correctly assigned to workplaces, **38% on-duty during work hours** (in the 37–82%
  target). Relationships form naturally (**67 pairs in 5 days**, positive+negative, strong bonds ≥30).
  Cliques form. Caravans arrive (~6 days/10). Disasters fire (telegraphed). Insurrection support+intel
  rise (support 20, intel 18). Events schedule+fire (nextEv advances). **Crime/gang/heat loop WORKS**
  (seeded a gang: gangHeat rose, racket bank → 1955, district heat rose).
  - **KEY DESIGN NOTE (not a bug):** the crime system is GATED — `crimeTick()` starts with
    `if(!ST.gangs.length)return;`. Gangs only form when the PLAYER sanctions a "gang" request (gang
    requests DO generate autonomously; the player opts in). So crime/heat is correctly dormant until the
    first gang exists. A headless run with no player input will show 0 gangs / 0 heat — that is correct.
  - Cases (detective) need informants first; informant cases trigger at `ST.tick%TPD===0` when
    `REG().informants.length>0` (25% chance). The detective layer is wired but sparse by design.
- **Optimization (POP=12): the render path is already well-optimized** (prior viewport-culling + cached
  vignette). Found + fixed the ONE genuine per-frame hotspot: **puddle shimmer** was allocating a fresh
  `createRadialGradient` per puddle per frame — now builds the gradient ONCE (`_puddleGrad`, module-level)
  and `translate()`s it per puddle. Other candidates (per-pawn `performance.now()` ≈ 4µs/frame total; the
  two O(n²) pawn loops = 66 checks at POP=12, one gated to %5 ticks, one daily) are NEGLIGIBLE at the
  game's actual scale (one city, ~12–30 pawns) — deliberately NOT "optimized" since that would add
  regression risk for unmeasurable gain.
- **Validation harness note:** when writing headless test harnesses, pawns use `px`/`py` (float tile
  positions, e.g. `x+.5`), NOT `x`/`y`. Relationships live in the GLOBAL `ST.rel` map (keyed by pawn-pair
  via `relKey`), NOT on `p.rel`. `p.assigned` stores a tile KEY (`K(x,y)`), looked up via
  `ST.structs.get(p.assigned)`. (Getting these wrong produces false "broken" readings.)

---

## ⚡ PRIOR STATE (reconciled from the live VM) ⚡

**⚠ MULTI-SESSION DIVERGENCE WARNING — READ BEFORE EDITING.** Work happens on this game in MORE THAN
ONE place. A separate session (or the user's own edits) built features DIRECTLY into the live VM that
never came back to any single container. This caused a real divergence that took a full session to
untangle. **At the START of any session that will modify the game, the user must upload their current
`index.html` from the repo FIRST**, so the work is based on the true latest. The md5 is the tripwire:
if the hash you're working from ≠ the VM's hash (`md5sum /var/www/game/neon-sprawl/index.html`), the
files have diverged and you MUST reconcile before writing anything. The canonical source of truth is
the VM file, NOT any container copy.

**Features that originated on the VM (from a parallel session) — DO NOT clobber or duplicate these:**
- **Spore Vat building** (`sporevat`, "Spore Vat", income-cost building) + `vatTier()` (tier logic) +
  `initBlobs()` (floating bio-blob rendering) + `togglePerfHUD()` (a performance HUD toggle).
- **A generative PIANO instrument with C418-style reverb/echo** woven into the audio engine: an `echo`
  delay bus, `echoFb`/`echoLp` feedback+filter, a `pianoIn` send, and a `stopMelody` cleanup. (NOTE:
  this was the basis the audio was later rewritten on — see below.)
- A richer ROAD network with thematic district comments ("THE DIVIDE — underclass | corporate sector",
  "labor | civic divide").

**This session's work (applied ON TOP of the VM base, all validated + shipped):**
1. **Rain/fog atmosphere toggle** — the ☂ HUD button (id `b-atmo`) toggles `ATMO.on` (OFF by default so
   it never costs framerate). `drawAtmosphere()` + `initRain()` render drifting smog + diagonal rain,
   screen-space, only when on. The button uses a `.hud-icon` span (a bare 🌧 emoji rendered BLANK in the
   HUD font — that was a real bug; use ☂ in a hud-icon span).
2. **More ambient floating elements** — MOTES 12→18 (less edge-biased so they drift through the core),
   BLOBS 10→16. Tasteful bump, render-cheap.
3. **AUDIO ENGINE FULLY REWRITTEN to kill a persistent "hum"** — THE KEY LESSON: the hum was NOT a
   composition problem, it was a SYNTHESIS defect. **Any raw OscillatorNode held open with no amplitude
   envelope IS an electrical hum** (a steady unchanging waveform = electrical noise; detuned sustained
   oscillators beating against each other = "two currents near each other"). Three failed attempts
   removed the wrong sustained source each time (drone → pads → chord-engine bass) — the problem was that
   ANYTHING sustained at all, not which notes. The FIX is architectural: **NOTHING sustains.** Every
   voice (`piano`, `bell`, `padSwell`, `bassPulse`) is created, ramped up, held, ramped down, and
   AUTO-STOPPED. Pads BREATHE (fade in/hold/fade out, retriggered by a scheduler) instead of being held.
   Verified mechanically: every `.start()` in the file has a matching `.stop()`; ZERO continuous sound
   sources remain (the old looping vinyl-hiss `nsrc.loop=true` is also gone). Added a procedural
   convolution REVERB (3.2s tail from exp-decay noise, no file). Procedural composition (C-pentatonic/
   Lydian, original — deliberately NOT Subwoofer Lullaby's C-Am-F-G-Em): `_bars` lays chords (bassPulse +
   padSwell) every ~5.2s, `_melody` sparse piano every 3–7.5s, `_bells` rare shimmer every 9–20s. Matches
   the user's spec: 55–70 BPM feel, sparse, long reverb, soft pads, bell harmonics, no percussion,
   procedural, seamless loop, CPU-friendly. **CAVEAT: Claude cannot hear audio** — the STRUCTURE is
   correct + the hum is structurally eliminated, but mix balance (bass vs piano loudness, chord pace) is
   untested and may need ear-tuning. There is a headless AUDIO ENGINE TEST now (Web Audio mock) that
   confirms ambientStart/ambientSet/toggleMute build + run without throwing.

**Validation harness in container** (`/home/claude/work`): `build_smoke.js` (15 gates, expect ALL TESTS
PASS), a RENDER smoke-test (mock canvas → drawStruct on all structs + drawTerrain + drawAtmosphere), an
AUDIO engine test (Web Audio mock), dead-fn/dupe checks, CSS brace balance, trimmed ≤8-day stability run.
POP=12 makes full-length probes exceed the in-container bash timeout — use TRIMMED ≤8-day runs (this is a
harness-timing artifact, not a game bug; real-time ticks are ~0.35ms, smooth).

---


- **Character-creation screen** — DONE. NEW DISTRICT now routes through `showCharCreate()` before
  newGame: pick 1 of 5 backgrounds (live stat preview), distribute OPS_POINT_BUDGET(4) extra points
  via +/- per attribute (capped 0-10, remaining counter), enter a codename. BEGIN sets
  window.PENDING_AVATAR={name,bg,stats} → newGame spawns exactly that operative. `CC` working state,
  `ccStats/ccPointsUsed/ccRemaining/ccSyncName` helpers, wired in the #modal click handler
  (data-ccbg/ccinc/ccdec/cc-begin/cc-back). Default fallback intact if skipped. Probe-verified: base
  spreads, point math, 10-cap, bg-switch, full creation→spawn pipeline all correct.
- **Professions + new buildings + cyberpunk resource re-theme** — DONE. (1) ROLES now work at the
  CORRECT location instead of drifting to generic terminals: each role's workType points at its real
  workplace (doctor→medbed, shopkeeper→counter, enforcer→copstation, mayor→mayorhouse, fixer→
  fixercorner). genCity builds these role workplaces in the civic zone; newGame spawns each role NEXT to
  their post and sets p.assigned=K(building). The work system already prefers p.assigned, plus a ROLE
  ANCHOR in chooseJob sends a role-wisp to its post during work hours (08-19) unless a need is pressing,
  and role work-desirability gets a 1.6x boost. Result: roles on-duty ~37-82% of work hours (citizens
  can reliably find the Doctor at the clinic, etc.). (2) NEW BUILDINGS w/ defs, icons, build-menu
  categories, city placement: Precinct (copstation, Enforcer's post, security), Street Vendor
  (streetvendor, cheap food cart), Admin Villa (mayorhouse, Mayor's seat, civic), Fixer Corner
  (fixercorner, Fixer's black-market node). New build categories: Utility (power/water), expanded Order
  (watchpost+copstation). (3) CYBERPUNK RESOURCE RE-THEME: wood→scrap (Salvage Yard, ex-logging camp,
  strips scrap from dead sectors), materials→data (Data Den, ex-mine shaft, grey-market hacking).
  Updated EVERYWHERE: goods object (3 init sites), production trickle, vendor sales, PRICES, BASE,
  CARAVAN_GOODS, HUD pips + sync loop, economy/market panels, zone signs (THE WOODS→SALVAGE SECTOR,
  OLD MINE→DATA SLUMS), help text, data-den glow. Scavenger vocation (ex-laborer). ZERO wood/materials
  refs remain (verified). Validated: scrap/data accumulate + sell, roles assigned + survive save/load,
  stable 9-day run, bounds + economy valid. STILL PENDING: NPC request pacing (too frequent → weekly
  city-council idea), tabs-shouldn't-resize-window + bigger character window, building reorg/resize
  pass, furniture for new buildings, general UI/GUI check.
- **Rain toggle fix + removed the music hum** — DONE. (1) RAIN BUTTON wasn't rendering — the 🌧 emoji
  was a blank glyph in the HUD font, so there was no button to click ("rain didn't work" = no toggle
  visible). Swapped to a ☂ umbrella in a .hud-icon span (matches the other HUD buttons, renders
  reliably). Also made the rain CLEARLY visible when on: density up (VW*VH/9000 → /5500), brighter
  streaks (rgba(170,205,240,0.9) cool-white), stronger slant, fade tied to ATMO.fog. Verified via
  render smoke-test (186 drops, 0 errors). (2) MUSIC HUM REMOVED — the constant low "humming" was the
  base DRONE: two detuned 55Hz triangle oscillators at gain 0.42 under everything. Removed it entirely
  (o1/o2/droneG gone, no orphan refs). The warm Am9 sine PAD (L1) is now the base bed — always gently
  present (was gated at intensity>0.10) — so the music is melodic and calm with NO droning fundamental.
  Vinyl hiss + L2/L3 layers kept. LFO now modulates the pad filter. Validated: tests pass, audio engine
  intact, stable 8-day run. SCREENSHOTS confirmed the visual pass landed well (neon signs NEXUS CORP/
  BODEGA/CHROME BAR/MEDCENTER reading clearly, color-coded buildings). STILL PENDING: building footprint
  reorg/resize, furniture for new buildings, weekly city-council.
- **Visual cyberpunk city pass** — DONE. The terrain renderer had a strong COMPETING aesthetic
  (bioluminescent mushrooms/spores carpeting the ground = alien-forest, not cyberpunk). Per user, KEPT
  the psychedelic accent but made the city read cyberpunk-first. (1) MUSHROOMS dialed back from 12%→6%
  of walkable tiles, spore-seep .82→.87 — now punctuation, not carpet. (2) CYBERPUNK STREET-GRIME layer
  added to drawTerrain (static, drawn once to tctx, ZERO per-frame cost): oil slicks w/ iridescent
  cyan/magenta sheen, scattered trash/debris flecks w/ metallic glints, exposed conduit/cable runs w/
  live-current glow pips. This is the dominant ground texture now. (3) RAIN/FOG ATMOSPHERE TOGGLE — the
  🌧 HUD button (id b-atmo) toggles ATMO.on (OFF by default so it never costs framerate). drawAtmosphere()
  renders drifting layered smog gradients + diagonal rain streaks, screen-space, fades in. ATMO state +
  initRain particle pool. (4) NEON MARQUEE SIGNS — the biggest top-down "cyberpunk city" signal: NEON_SIGNS
  map (17 landmark types → {label,color}), rendered above each as a flickering glowing sign w/ additive
  glow halo, dark backing, neon underline tube, position-keyed brownout flicker. Per-frame but only for
  visible landmarks. e.g. CLINIC (green), GEAR (amber), PRECINCT (red), ADMIN (purple), FIXER (orange),
  NOODLES, ARCADE, STIMS. Caught + fixed a `t` scoping bug via a headless render smoke-test (drawStruct
  on all 414 structs + drawTerrain + drawAtmosphere = 0 errors). Validated: tests pass, stable 8-day run,
  all roles alive, no dead/dupes. Perf-respectful (grime static, atmo opt-in, signs cull to viewport).
  STILL PENDING: building footprint reorg/resize (structures are 1-tile icons; a multi-tile building
  redesign is a separate deep pass), furniture for new buildings, weekly city-council session.
- **Character panel sizing + request pacing** — DONE. (1) Inspect panel now FIXED SIZE (360px wide ×
  560px tall, max-height calc(100vh-130px), overflow-y:auto) so switching tabs NEVER resizes the window
  — and it's wider for readability. Narrow-screen variant gets max-height:50vh. (2) NPC REQUEST PACING:
  was a flood (~13 wisps × one per 600 ticks). Now a global cooldown (900 ticks min between any two
  petitions), a hard cap of 3 simultaneous pending, longer per-wisp gap (2400 ticks ≈ once/day), and
  picks ONE eligible wisp at random per cycle instead of all at once. Measured ~3/day, max 3 pending.
  STILL PENDING: weekly city-council session (to batch routine flashpoints — noted as the natural next
  feature), building reorg/resize visual pass, furniture for the new buildings, deeper UI/GUI polish.
- **UI cluster + mechanics document** — DONE. (1) CHARACTER PANEL rebuilt into 4 TABS: STATUS (vital
  bars + mood drivers + task/credits/stress), PERSON (operative attrs, role desc, vocation, skills,
  TEMPERAMENT personality readout), TIES (allegiance, clique/gang, rep, relationships), MIND (thoughts
  + memories). Tab state INSPECT_TAB; switch via data-itab buttons. Actions (recruit/orders/talk/follow)
  always-visible below tabs. (2) wispThoughts(p) — surfaces inner state as thoughts: outliers (mood/
  stress/needs extremes, homeless, sick, addiction), critical-event reactions (evicted/robbed/witnessed
  violence from recent memories), insurrection stance, + some stable-per-day mundane chatter when calm.
  Capped at 3, no AI cost. (3) FORCE COMPLIANCE button — appears when p.refusedOrder set; costs 10 intel
  + adds resentment (mood -12, allegiance -8, stress +10). REFUSAL logic in scoreJobs: a wisp may refuse
  a direct order if too tired (rest 20-32), defiant (allegiance<-25 + ind>62), or frayed (stress>78);
  sets refusedOrder + pendingForceCmd. Avatar never refuses. Note: starving/exhausted intercepted by
  chooseJob (eats/sleeps first) by design. (4) Event VIEW button — events with a focusId show a button
  that jumps camera to the focal wisp (wired on the defector event; pattern reusable). (5) Collapsible
  AGENT REQUESTS — header click toggles window.REQ_COLLAPSED, shows count + arrow. All validated: tabs
  render 0-error for avatar/role/ordinary, thoughts never crash, refusal fires for stress/defiant,
  requests collapse clean, stable 9-day run, bounds valid.
  DOCUMENT: NEON_SPRAWL_Mechanics_Reference.docx — polished in-game reference (docx@9.6.1 at the global
  path /home/claude/.npm-global/lib/node_modules/docx; npm registry BLOCKED so reference by abs path).
  13 sections + TOC, 12 styled tables (US Letter, Arial, navy headings): overview, resources, vital
  signs, temperament, operative (+attrs +backgrounds), insurrection (4 metrics + flow), investigation,
  named roles (+regime-cast behavior), directing wisps (+tabs +force), buildings (production/civic/
  utility), items/furniture, events/disasters/crime/housing, reading-the-game tips. Validated via
  docx validate.py (340 paragraphs, all checks pass). gendoc.js is the generator. STILL PENDING from
  the 25-item batch: emotion-clarity review, further music chill pass, utility-WORKER roles, camera
  AUTO-pan (only the button was built), event-engages-avatar for ALL events (only cache wired so far).
- **Fixes & balance batch (test-build hardening)** — DONE. (1) EVICTION SPIRAL fixed: rent lowered
  (28→11/day, crisis 42→16) + baseline SUBSISTENCE income (10/day employed-or-not, homeless 6) so the
  unemployed aren't doomed + 4-day debt grace with a warning at day 2 (was instant eviction). Result:
  ~2 evicted of 13 after 6 days (was near-total collapse). (2) NO DECIMALS: addMod rounds values at
  source; allegiance/mood displays rounded. (3) NAMES under every wisp always-on — player operative
  bold cyan, role-wisps bold in role-accent + a colored diamond marker above (the cast is findable);
  ordinary wisps dim, names BELOW (emotions/alerts above — clean separation). (4) CRIME: Enforcer now
  reliably reports robberies in range (+14 heat, it's their job); theft thresholds tightened (intg<28,
  credits<8, addiction>30) + cooldown after each theft (no serial pickpocketing); steal triggers
  witnessCrime. (5) UTILITIES: new Power Station (⚡) + Water Facility (💧) buildings — staffed = block
  runs clean; absent = mood drag (no power) + gradual hygiene/health decline (no water, softened to
  once-daily so it's not an instant epidemic). ST.utilPower/utilWater flags. (6) Cache event now runs
  through the OPERATIVE (Tradecraft check shifts odds, names them in the log). (7) All RimWorld refs
  stripped from comments (were never player-facing anyway). VERIFIED NON-BUGS: collision is solid (0%
  wall-clip over 5029 samples — perceived clipping was wisps crossing walkable decor); roles DO spawn
  + survive save/load (the "missing roles" was loading a pre-build save; "lost on load" test was a
  false alarm counting ===6 after eviction deaths). Stable, all bounds valid. NOTE: probe_final.js +
  correct.js now exceed in-container timeouts (POP 7→12 × their huge tick-batches) — game runs smooth
  (0.35ms/tick); use trimmed ≤10-day runs. STILL PENDING from the 25-item request: camera lock-to-wisp
  on events, flippable/rebalanced character panel, override-refusal button + thoughts display
  (outliers/critical only), collapsible requests window, emotion-clarity review, further music chill
  pass, utility-worker roles, and the DOCX mechanics document.
- **Named ROLE-WISPS — the city's power structure** — DONE. 6 named characters spawn from turn one
  (POP bumped 7→12 so roles + generic citizens coexist): Doctor (civic, clinic), Shopkeeper (civic,
  store), Enforcer (REGIME force), Mayor (REGIME force), Informant (secret regime snitch), Fixer
  (insurgent lever). `ROLES{}` defines each (title/fname/align/accent/desc/persLean/allegianceLean +
  function flags regimeForce/secretInformant/insurgentLever). `mkRoleWisp(x,y,key)` spawns them —
  ingrains the role's personality lean into pers stats (so behavior fits the role, keeping individual
  variation), sets allegiance lean (regime roles start hostile), flags functions. Spawned first in
  newGame, then generics fill to POP. Inspect panel shows role + alignment (REGIME/CIVIC/INSURGENT
  color-coded). AI DIALOGUE: `wispSystemPrompt` extended with a ROLE CONTEXT block — station, regime/
  informant/broker framing, and STAT-DRIVEN disposition (intg<40 = bribable, intg>65 = principled;
  allegiance shapes their stance on resistance). ~527 tok/prompt. ACTIVE REGIME FORCES via
  `roleForcesTick()` (in insurrectionTick): loyal Mayor props up grip (+0.1-0.2/day by ambition),
  TURNED mayor undermines it (−0.3/day +support); loyal Enforcer raises exposure + halves your lie-low
  fade rate + can bust a cell on a failed Nerve opsCheck, TURNED enforcer shields you; Informants raise
  regime awareness. Probe-verified: spawn, stat-leaning, AI prompt, all force dynamics (grip up/down,
  exposure pressure), save/load, stable 3/3. Perf fine (0.35ms/tick @ 14 pawns; roleForcesTick 0.005ms).
  NOTE: correct.js now runs slow in-container (POP=12 × its 130k-tick batch exceeds the timeout) — game
  itself is smooth; use trimmed (≤10-day) correctness runs in-container. NEXT: turn/bribe/expose role
  actions via dialogue, deeper civic effects (Doctor heals faster, Shopkeeper prices).
- **Music → melancholy lofi + UI/GUI consistency pass** — DONE (prior "proper test build").
  MUSIC: the BGM is PROCEDURAL Web Audio synth (no audio file — can't generate/host one). Re-composed
  the ambience engine from a dark sawtooth city-drone to melancholy lofi: soft TRIANGLE drone (was
  sawtooth), Am9 warm sine pad as the soothing core, gentle vinyl-hiss (lowpass noise, was harsh
  bandpass wind), the danger/intensity layer is now a LOW WARM SWELL (felt not heard, was a tense
  sawtooth pulse), slower 2.2s glides. Dynamic layers kept but ALL chill — intensity adds warmth, never
  harshness. UI: `.mbox` now `text-align:center` + `.big` buttons full-width block (modals/title/
  creation now properly centered & consistent); creation BACK/BEGIN kept side-by-side with inline
  styling. INFO (priority #1 = insurrection state): the COMMAND-menu MOVEMENT panel gained an ADAPTIVE
  guidance line — reads the player's support/exposure/grip/intel/recruited state and tells them what it
  means + what to do next (7 situational tips: high-exposure warning, recruit prompts, grip-cracking
  encouragement, near-victory). Probe-verified: all panels render across all states, 0 errors, stable
  5/5. NEXT: deeper info for cases/avatar/events (priorities 2-4), then job/farming visuals + litter.

---

## ⚡ DIRECTION SHIFT (current arc): INSURRECTION SIM + DETECTIVE MERGE
The player is the hidden architect of an underground movement vs. an oligarch regime that controls
the governments/AI/world. NEW MERGE: investigation/detective layer — espionage IS detective work.
The city generates mysteries (murders, regime informants, conspiracies) and you SOLVE them to earn
intel + weaken the regime. Clues are DERIVED from existing sim state (grudges=motive, position=
proximity, memory/witnesses=testimony), not invented. Vibe: a god's-eye conspiracy-investigation
sim (Shadows of Doubt meets a colony sim), NOT a single-protagonist detective game. Insurrection
build order still open: Espionage(DONE) → Influence → Generational/education → Resource-leverage →
endgame; detective layer interleaves (Layer 1 DONE below).

- **Fullscreen + job clarity + AVATAR foundation** — DONE (partial push; creation-screen + visuals
  still pending). (1) Fullscreen toggle button (⛶) in HUD controls, cross-browser. (2) Job clarity:
  clicking a wisp now shows VOCATION + ASSIGNED-TO building + an inline unassign button (i-unassign
  works from the pawn panel now, not just the building side). (3) THE AVATAR — a controllable special
  pawn (`isAvatar`) with 6 OPERATIVE ATTRIBUTES (`ops{guile,insight,nerve,presence,tradecraft,
  resolve}`, 0-10). `OPS_ATTRS`, `OPS_BACKGROUNDS` (5: analyst/fixer/defector/ideologue/ghost, each a
  balanced stat spread), `OPS_POINT_BUDGET=4`. `mkAvatar(x,y,spec)` (committed: allegiance 100,
  recruited leader, cyan accent), `theAvatar()`, `ops(p,k)` safe accessor, `opsCheck(attr,diff)`
  (d10+stat). Spawned in newGame from `window.PENDING_AVATAR` spec (or default), auto-selected, given
  a home. Distinct map marker (pulsing cyan ring + chevron). Inspect panel shows the 6 attributes +
  background. STATS MATTER NOW: Guile→recruit success (+3%/pt), Tradecraft→intel baseline + exposure
  shielding, Nerve→opsCheck on regime sweeps (composure blunts burns + cuts exposure). Persists via
  snapPawn Object.assign; probe-verified (spawn/spec/save-load/stable). NEXT: character-CREATION
  SCREEN (background pick + point-buy at new game), job/farming VISUALS, litter, then later the
  stat-gated DIALOGUE that opsCheck/ops are built to feed.
- **Furniture life-bar → inspect (UX)** — DONE. Removed the world-drawn HP bar for FURNITURE
  (kept for structural/defensive pieces where damage is tactical). Furniture condition now shows in
  the click/inspect panel as "QUALITY: <tier> · CONDITION: good/worn/failing (N%)" + owner. Cleaner
  map.
- **Storyteller events (ENGAGEMENT — the #1 fix)** — DONE. Beyond disasters, an insurrection-themed
  decision-event system that interrupts the routine and forces a CHOICE (RimWorld's loop-breaker).
  `STORY_EVENTS[]` (defector/cache/crackdown_warning/sympathizer_rally), each with `when()` gating +
  `gen()` producing a 2-3 option dilemma that ripples through movement/regime/intel. `maybeStoryEvent`
  (~18%/day, one at a time, early grace) rolled in disasterTick's 30-tick cadence. `activeEvent` +
  `renderEventPanel` (centered modal w/ option buttons) + `resolveEvent`. Probe-verified: events fire,
  resolve cleanly, all generators valid, no crash. NOTE: stubs.js gained document.addEventListener +
  element.remove/setAttribute/dataset for the test harness; game listener is defensively guarded
  (`typeof document!=="undefined"`). NEXT in this push: more visible job variety + the AVATAR
  (embodied organizer the player directs).
- **Audit (post-Layer-1)** — PASSED. Structural clean (no dead code/dupes, CSS+JS valid). 50-day
  organic run: cases fire from the homicide hook, 0 unsolvable (answer always in suspects), 0 clue
  overflow, no leak, no NaN, no crash. Save/load: 14-field round trip PERFECT incl. case clues +
  hidden answer; loaded case fully playable. Edge cases handled (dead suspect, resolved case, no-
  mole, 0-intel all graceful). Perf: tick 0.54ms, render 1.19ms, caseTick 0.0002ms, A* short-path
  ~0.09ms. Stability 6/6.
- **Detective merge — Layer 1 (murder + informant cases)** — DONE. `ST.cases[]` + `ST.caseSeq`.
  Case types: murder (`openMurderCase` — hooked into the lethal homicide branch; suspects = grudge-
  holders + nearby + gang ties, capped 3-6; `genMurderClues` derives motive/proximity/gang/witness/
  red-herring clues weighted toward the truth), informant (`openInformantCase` — deduce the regime
  mole; auto-opens occasionally via caseTick when informants exist). Player loop: `investigateCase`
  (spend 6 intel → reveal strongest unrevealed clue), `accuseSuspect` (correct → +15 intel +4
  support, culprit exposed/mole cleared; wrong → −6 support +8 exposure). `caseTick` (daily) auto-
  opens informant hunts + expires cold cases (>12 days). `relAdjAll` helper for public disgrace.
  UI: INVESTIGATIONS panel in COMMAND menu (open cases, revealed clues color-coded, Investigate +
  per-suspect Accuse buttons). Full serialize/restore + newGame reset. Probe-verified end-to-end +
  stable. Intel now has a SINK (investigations) + SOURCE (solving) — closes the audit's "intel piles
  up" gap. NEXT (Layer 2+): conspiracy cases, interrogation (AI dialogue → catch lies), evidence-
  board UI, then finish insurrection phases (influence/generational/endgame).

The player is the hidden architect of an underground movement vs. an oligarch regime that controls
the governments/AI/world. Reframing the existing crime/gang conflict layer into intrigue/influence.
Player fantasy: spymaster + revolutionary + generational long-game. Build order: Espionage(+regime
skeleton, DONE) → Influence → Generational/education → Resource-leverage → full Goal/endgame.
Regime pressure is the "cure"; player chooses to stay hidden or go loud.

- **Full audit (pre-Phase-2)** — DONE. Structural sweep clean (no dead code, no dupes, 326 fns,
  CSS balanced, JS compiles). Fixes from the audit:
  1. **Intel bootstrap deadlock (critical)** — intel previously came ONLY from recruited wisps, but
     you need intel to recruit → the loop couldn't start. Fixed: intel now layers a BASELINE (1.2/day
     from your own legwork — bootstraps from nothing) + SYMPATHIZER scraps (sympathizers*0.15) +
     NETWORK (recruited*0.5 + cells*0.7), ×0.6 if stance is "open". Verified: player makes first
     recruit by ~day 10 now.
  2. **Grip erosion too slow** — even a dominant movement took 148+ days to break the regime. Recalibrated:
     `grip -= (support-40)*0.03 + cells*0.06`. Now solid play (70% support, 3 cells) cracks the regime
     in ~51 days, strong (85%/5) in ~34, dominant (95%/7) in ~27; below 40% support the regime RECONSOLIDATES
     (grip rises). Proper difficulty gradient.
  3. **mkChild missing insurrection fields (bug)** — colony-born children had `allegiance:undefined`.
     Fixed + made generational: children now INHERIT a political lean from parents
     (avg*0.6 + jitter). Also backfill on load for pre-insurrection saves.
  4. **isChild null-safety** — hardened `isChild(p)` to tolerate null/undefined (called in many hot paths).
  5. **A* perf optimization** — A* called `homeOwnerAt` (loops all pawns) per tile examined. Now
     precomputes the pawn's forbidden-home rects ONCE per path. Short paths (common case) ~0.075ms;
     property-respect behavior unchanged (trespass still ~0%). tick() 0.27ms, render 1.2ms, daily
     systems <0.02ms — all healthy.
  Known non-issue: probe_final occasionally prints PROBLEM when an UNMANAGED colony collapses to 0
  (crashed:false always) — seed variance, not a fault.
- **Commerce auto-wrap** — DONE. `autoWrapStore(s)` (after placeRoom): when a player-placed
  vendor/refiner blueprint finishes, it auto-generates a 4×4 walled store around the counter
  (walls + south door + counter inside + a rug display fixture). DEFENSIVE: only builds on
  empty+in-bounds tiles, aborts gracefully (leaves bare counter) if the space is crowded; skips
  if already in a room (starter shops are pre-wrapped via placeRoom in genCity). Idempotent
  (s.wrapped flag). Hooked in finishBuild for `vendor||refine` defs. Floats "STORE".
- **Visible store worker** — DONE. Vendor earning loop sets `s.staffedBy` = "robot" | clerk id |
  "self" (cleared to null when idle). drawStruct draws a badge above operating stores: ⚙ blue for
  robot, ◔ green + a pulsing "open" tint for a human clerk. Makes "this store works, by whom"
  legible at a glance. Self-corrects in real time as clerks come/go.
- **Studying → visible activities** — DONE. `learn` now branches by VENUE: bookshelf/school →
  READING (trains sal/cook), workstation → TRAINING (trains bld), gym → PRACTICE (trains sht).
  schoolStr selection widened to include workstation+gym. Each has its own glyph (open book /
  code-terminal / dumbbell), color, float (+READ/+TRAIN/+DRILL), and inspect label
  (Reading/Training/Drilling). p.studyKind remembers the last kind. drawTaskGlyph call routes the
  learn sub-type from j.s.type.
- **Insurrection foundation (Phase 1)** — DONE. `ST.mov{support,exposure,intel,cells,stance,
  doctrine}` + `ST.regime{grip,awareness,lastSweep,informants}`. Pawns gained `allegiance`
  (-100 loyalist .. +100 committed), `recruited`, `cellRole`, `informant`, `secret`.
  `insurrectionTick()` (daily): recruited wisps generate INTEL (0.4 each + cells), SUPPORT drifts
  toward population's allegiance lean, EXPOSURE leaks (slow if hidden / fast if open) → regime
  AWARENESS → `regimeSweep()` burns cells + turns informants when awareness>55. `radicalPotential(p)`
  (broke/evicted/low-mood/low-integrity radicalize). Actions: `recruitWisp(p)` (8 intel, %=f(potential),
  failure risks exposure), `goToGround()` (12 intel, −exposure). UI: HUD readout (✊support ◆intel
  ◎exposure ⛓grip), RECRUIT button + allegiance line in pawn inspect, COMMAND-menu MOVEMENT panel
  (status + Go to Ground + Go Loud/Quiet stance toggle). Full serialize/restore + newGame reset; old
  saves default safely. NEXT: deepen espionage (secrets/agents/ops) → Influence → Generational →
  Resource-leverage → endgame.

A single-file, vanilla-JS, canvas-rendered cyberpunk colony sim (RimWorld-flavored). No
frameworks, no build step. The entire game is `index.html` (~4,700 lines: one `<style>`
block, the DOM scaffold, and one `<script>`).

> This doc is the orientation layer for a fresh dev session. Read it first; it will save you
> from re-discovering the architecture, the deploy flow, and the hard-won gotchas.

---

## 1. Repo / deploy

- **Repo:** github.com/vikaruxdroid-max/neon-sprawl (public, `main`)
- **Live (GitHub Pages):** https://vikaruxdroid-max.github.io/neon-sprawl/
- **VPS:** Azure `vikarux@20.118.225.255`, nginx serving `/var/www/game/neon-sprawl/`
- **Local dev dir (user's Windows git-bash):** `C:\dev\neon-sprawl`, tests at `test/smoke.js`

### Deploy workflow (user runs these — Claude builds the file, user moves/commits)
```bash
cp "$(ls -t ~/Downloads/index*.html | head -1)" /c/dev/neon-sprawl/index.html
node test/run.js                       # expect ALL TESTS PASS (19 assertions)
git add index.html && git commit -m "..." && git push
# VPS pull is MANUAL — SSH from the user's shell is blocked (see Gotchas):
ssh vikarux@20.118.225.255 "cd /var/www/game/neon-sprawl && git pull"
```

### How Claude ships a build
1. Edit `/home/claude/work/index.html` (the working copy).
2. Validate (see §5).
3. `cp /home/claude/work/index.html /mnt/user-data/outputs/index.html`
4. `present_files` it. User downloads from there.

---

## 2. Core constants & loop

```
T=16        tile size in px
MW=140, MH=100   map width/height in tiles (2.5x the original small map)
TPD=2400    ticks per in-game day
TPS=10      ticks per second at 1x speed
POP=7       starting population
```
- `ST` is the single global game-state object. `tick()` advances one game tick;
  `render()` draws one frame; `loop(ts)` is the rAF driver (decouples sim ticks from frames).
- Day starts 06:00. `hourN()` returns the float hour. `dayN()` the day number.

---

## 3. Architecture map (where things live)

| System | Key functions / anchors |
|---|---|
| **Tile keys** | `K(x,y)=x*MH+y` (NUMERIC, not string), `KX(k)`, `KY(k)`. Used for `ST.structs` Map, gang turf Sets, `unre`/paint Sets. |
| **Pathfinding** | `astar()`, `gotoCell()`, `terCost()` (roads = type-3 terrain, cost 0.55 → pawns prefer streets). `buildRoadTiles()` writes roads into `ST.ter`. |
| **Pawn AI** | `pawnTick(p)`, `chooseJob(p)` / `scoreJobs(p)` (utility scoring), job execution in a big `switch` inside `pawnTick`. Jobs: eat/sleep/build/hygiene/recreate/socialize/work/treat/substance/crime/steal/learn/idle. |
| **Needs/mood** | `p.needs{food,rest,hyg,fun,socN}`, `moodCalc(p)`, `addMod(p,id,label,val,dur)` (timed mood modifiers), `p.stress`, `faceExpr(p)` → 8-bit face. |
| **Economy** | Buildings cost CREDITS only (`cost.income`), charged at placement in `placeBp` (refunded by `cancelBp`). `ST.goods{food,wood,materials,data,chem,parts,stims,gear}` are commodities. Vendors sell commodities → district income. |
| **Work & Ambition** | `initCareer()`, `VOCATIONS{}`, `vocationOf(p)`, `fitsVocation()`, `ethicMul()`, `careerAfterShift()`, `careerTick()` (daily), `genWorkPetitions()`. Career data on `p.career{voc,ethic,asp,sat,specialist,gripe,lastRaiseDay}`. |
| **Ownership & Wealth** | `netWorth(p)` (credit debt floored at 0 + owned property), `wealthTier(p)` (WEALTH_TIERS), `claimHome()`, `loseProperty()`, `inherit(dead)` (estate → closest bond or district). `p.attach` = property attachment, grows daily with tenure. |
| **Relationships** | `ST.rel` = scalar -100..100 per pair (`relKey/relGet/relAdj`). `ST.relMeta` = per-pair flags (`{partner, mentor}`). `relType(a,b)` derives typed label. `tryFormPartnership()`, `partnerOf()`, `gossip()` (proximity reputation spread), `defendInFight()`. |
| **Cliques** | `ST.cliques[]` = `{id,name,members[],formed,loyalty,rival}`. `rebuildCliques()` (daily, BFS on friendship graph ≥CLIQUE_FRIEND=32, components ≥3, preserves identity by overlap), `cliqueOf()`, `sameClique()`, `cliqueTick()` (loyalty, rivalries, group petitions), `maybeCliquePetition()` (kind:"clique"). Members prefer to socialize together (distance bias in mate-select); whole clique grieves a lost member. |
| **Mentorship** | `relMeta.mentor` holds the MENTOR's id. `mentorFor(apprentice)`, `apprenticesOf(mentor)`, `tryMentor(p)` (daily, from careerTick; mentor skill ≥5 and ≥2 ahead, same vocation, nearby). Apprentices get 2× vocation XP; mentor gains satisfaction. Mostly fires early-game / on new arrivals (skills max out fast). |
| **Crime & gangs** | `ST.gangs[]` = `{id,name,color,crewIds[],turf:Set,gangHeat,tension,bank}`. `gangTick()` (turf/war, every 200t), `crimeTick()` (recruitment/rackets, runs each tick but gated by `tick%180`/`%240`), `witnessCrime()` (snitching→heat), `seekRevenge()` (grudges via `p.grudgeTarget`). `pawnGang(p)`, `tileInTurf` removed (dead). |
| **Progression** | `TIERS[]` (Dead Block→Neon Sprawl), `currentTier()`, `prosperity()` (0-100 live blend), `prospRank()`, `checkTier()`. `ST.tierReached`. |
| **Camera** | `cam{x,y,z,follow}`. `tickFollow()` eases toward `cam.follow` (pawn id). `setFollow()/stopFollow()`. Pan or Esc cancels. |
| **Overlays (full-screen windows)** | `OV{view,crewFocus,slotMode}`, `openOverlay()/closeOverlay()/renderOverlay()`. Views: `diary`, `crew` (+ `crewFocus` detail), `tasks`, `district`, `slots`. Icon buttons in HUD: 📖📋👥📊. Hotkeys J/K/L/T. |
| **Tasks/alerts** | `collectAlerts()` (sick/hurt/evicted/broke/miserable + crisis + gang-recruitment risk), `pendingRequests()`, `taskCount()`, `refreshTaskBadge()`, `applyRequest(id,optIdx)` (handles kinds: work/feud/epidemic/gang/theft). |
| **Command bar** | Bottom 3-mode bar: ⛏ BUILD (categorized cards, live affordability), ▦ ZONE (decon/cancel/salvage), ⚇ COMMAND (select pawns → orders). `BUILD_CATS`, `BUILD_ICON`, `renderSub()`. |
| **Saves** | Multi-slot: 3 manual (`neonSprawlSlot_1..3`) + autosave (`neonSprawlSlot_auto`, daily). `saveToSlot/loadFromSlot/slotMeta`. `serializeState()/applyState()`. `saveGame()`=slot 1, `loadGame()`=most recent (these two are what the smoke test calls — keep them functional). |
| **Charm/visuals** | `EMOTES{}` + `emote(p,kind)` (floating reaction bubbles), `tombstones`, `drawPawn` (bouncy idle motion), GLOW_CACHE (cached pawn glow sprites), cached vignette gradient (`vignetteGradient`). |

---

## 4. State shape (`ST`) — serialized fields

`serializeState()` persists: `tick, grp, rel, relMeta, nextEv, lastCrackdown, goods, income,
debtDays, crisis, gangs (turf as array), stats, flags, milestones, tierReached, ter (array),
structs (array), pawns (snapPawn-stripped), rooms`.

Transient (rebuilt/reset on load, NOT persisted): `beams, floats, emotes, tombs, sel, path,
job, carry, unre (fresh Map)`.

`applyState()` backfills `p.career` for pre-career saves. **When adding a new pawn field that
must persist, confirm it survives the snapPawn → applyState round-trip (the smoke G-suite
checks this).**

---

## 5. Validation (ALWAYS before shipping)

```bash
cd /home/claude/work
# 1. brace balance
python3 -c "import re;h=open('index.html').read();s=re.search(r'<script>([\s\S]*?)</script>',h).group(1);print('braces:',s.count('{')==s.count('}'))"
# 2. syntax
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);fs.writeFileSync('/tmp/check.js',m[1])" && node --check /tmp/check.js
# 3. headless test suite (19 assertions)
node build_smoke.js          # expect ALL TESTS PASS
# 4. stability probes (see the diag_*.js / probe_*.js scratch files)
node probe_final.js          # 15-day full run, must end STABLE + COMPLETE
```

### Test harness
- `smoke.js` = the 19 assertions (C economy, E pathing, F1-F3 job AI, G1-G14 save/load).
- `build_smoke.js` = bundles `stubs.js` + the `<script>` + `smoke.js` into `smoke_bundle.js`, runs it.
- `stubs.js` = DOM/canvas/localStorage stubs for headless node.
- The combat tests (old A/B/D) were REMOVED — the foe/combat system is gone. Don't re-add
  references to `spawnFoeAt`, `foeAt`, etc.
- Scratch probes (`diag_*.js`, `probe_*.js`) are ad-hoc; they bundle the same way. Use the
  `global.performance={now:()=>Date.now()}` stub when the code path hits `drawPawn`.

---

## 6. GOTCHAS (read these — they have bitten us)

1. **SSH from the user's shell is BLOCKED** (ssh-agent not forwarded to their git-bash). The
   VPS `git pull` is always done manually by the user. Don't assume `ssh ... git pull` will
   work in their deploy script.
2. **Tile keys are NUMERIC** (`x*MH+y`). Never write code that does `key.split(",")` — use
   `KX(k)/KY(k)`. Old string-keyed saves are incompatible (already migrated past).
3. **Em-dashes / full-width chars** in string literals cause "Invalid token" — when doing
   multi-block edits via python heredocs, watch for them.
4. **After `str_replace`, earlier `view` output is stale** — re-view before the next edit to
   the same region.
5. **Removing a function block** can orphan a brace (we lost the `pawnTick` header once this
   way). Always brace-check after deletions.
6. **`saveGame()`/`loadGame()` must stay functional round-trip helpers** — the smoke G-suite
   calls them. The slot *picker* UI is separate (`openSaveSlots/openLoadSlots`).
7. **Mood-mod tuning philosophy:** negative mods (grief, property loss, destitute, bad-work)
   compound into death spirals in UNMANAGED colonies. Always measure with a 12-seed sample,
   not 5 (variance is wide: 1-6 survivors). The bar: a MANAGED colony (player keeps citizens
   solvent) should survive ~7/7; an unmanaged one is *supposed* to struggle. Don't flatten the
   drama chasing unmanaged survival.
8. **`git pull` BEFORE deploying a downloaded `index.html`.** A stale/fresh clone (e.g. a
   different PC) can have an older `smoke.js` than the remote, which causes phantom
   `spawnFoeAt is not defined` test failures (the combat system was removed; old tests still
   reference it). This has bitten us 3×. Pull first so `index.html` and the test files are
   from the same generation. Only `index.html` + `CLAUDE.md` should change on a normal deploy —
   don't let an agent regenerate the test files.
9. **Emergent-system rates need verification, not assumption.** Partnerships, mentorships, and
   clique petitions are all gated behind conditions a stable colony rarely hits. We've twice
   shipped a system that fired ~zero times in normal play until measured and re-tuned (lower
   thresholds, daily-check fallbacks). When adding a gated emergent behavior, measure its
   firing rate over 6+ runs before declaring it done.

---

## 7. Current tuning state (data-backed, as of this handoff)

Measured over managed 14-day runs (player keeps everyone ≥45 credits):
- **Survival:** managed = 7/7 every seed. Unmanaged = ~3.8 avg (the NPC-loss systems cost
  ~0.5 survivors vs a no-mood baseline of ~4.3 — intended).
- **Partnerships:** ~0.3/run after the rate fix (threshold lowered 62→48, bond growth 2→3.5
  per socialize, + a daily 25%-chance pairing check for eligible pairs). Romance is occasional
  by design.
- **Wealth classes:** a managed colony sits uniformly at "Comfortable" (~245 net worth).
  Stratification (Destitute/Affluent/Kingpin) only emerges when the economy diverges — correct.
- **Gang activity (recruit/racket):** only fires when citizens are broke/disaffected near
  turf. A well-run colony sees ~none. A struggling one sees recruitment (with a TASKS alert
  warning you).

> If something feels too rare in a real playthrough, these are all single-number tweaks. The
> emergent systems are intentionally gated behind the conditions that make them thematic.

---

## 8. Roadmap / opportunities

**BUILT & SHIPPED (do not rebuild — verify against code first):**
- **Render perf** — DONE. Structure-draw loop now iterates `ST.structs` directly + viewport-culls
  each (was: scan every viewport tile w/ Map lookup). ~35× faster at zoom-out. In `render()`.
- **Onboarding** — DONE. `checkContextualHints()` + `hintOnce(id,msg)` fire once when the player
  first encounters each system (clique, mentor, gang, partner, wealth, heat, tier). `ST.hintsSeen`
  persists. Plus the day-1 `showTutorialHints()`.
- **Audio atmosphere** — DONE. `SFX.ambientStart/ambientSet/ambientStop` — generative drone +
  noise pad + 3 threshold-gated music layers. `driveAmbience()` blends heat/gang-tension/bustle
  into intensity each ~10s. Untested by EAR (no AudioContext headless) — levels are first-pass.
- **Heists & contraband** — DONE. In `crimeTick()`: heists (flush gang, 3+ crew, big score + heat
  + injury risk), contraband (gangs cook illicit goods). `ST.contrabandPolicy` "crackdown"|"allow"
  is the player lever (District panel toggle `d-contra`). Surfaced in TASKS.
- **Dynasties / generational** — DONE. Pawns have `age`, `birthDay` (null=arrived adult),
  `surname`, `parents`, `child`. `mkChild(pa,pb)` blends traits/surname; `tryConception()` (daily,
  housed+content+solvent partners, pop-cap 14); `ageTick()`+`matureChild()` (ADULT_AGE=14 days).
  Children don't work/pay rent/get recruited. `isChild(p)` gates those.
- **Faction politics** — DONE. Cliques have `stance` (-100..100 toward operator), set by petition
  responses, decays daily. In `cliqueTick()`: supportive blocs lift morale, hostile influential
  blocs raise heat + can defect to a gang (`c.alignedGang`). Shown in District panel.
- **Gang suppression** — DONE. `watchpost` building (DEF, "Security" build cat, `security:true`,
  `secRadius`). `securityTick()` bleeds heat + caches `ST._secZones`; `underSecurity(x,y)`
  suppresses recruitment + heists in range.
- **Revenge (wired)** — DONE. `seekRevenge(p)` (was dead code) now fires in pawnTick's
  relationship block: a grudge-holder (`p.grudgeTarget`, set on robbery) confronts the target
  when close, discharging the grudge. Hooks gossip + witnessCrime.
- **Disasters** — DONE. `disasterTick()` → `maybeScheduleDisaster()` (telegraphed via
  `telegraphDisaster()`, ~4%/day + pressure) → `strikeFire/strikeBlackout/strikeRaid`.
  `ST.pendingDisaster={kind,strikeAt,x,y,warned}`, `ST.blackoutUntil` (halts production).
  Watch posts can pre-empt raids. Surfaced in TASKS. Fallout ties to wealth/grief/heat.
- **Trade caravans** — DONE. `caravanTick()` → `maybeCaravan()` (~6%/day). `ST.caravan={mode:
  "buy"|"sell",good,rate|price,qty,leaveAt}`. Buyers pay a premium for your surplus on
  departure; sellers let the district stock up cheap. `PRICES` hoisted to module level.
- **Mood soft-floor (balance)** — DONE. moodCalc bottoms deep misery at ~6 not 0, so a
  struggling colony can recover instead of spiraling. Managed colonies ~8.8 survivors (grows
  via dynasties); unmanaged ~1.9 (dies mainly to untreated infection — correct, player's job).
- **Test suite** — now 20 assertions (added G15 goods save/load).
- **New civic buildings** — DONE. `nursery` (speeds child maturation, `ageTick` reads
  `countBuilt("nursery")`), `market` (boosts caravan freq+rates in `maybeCaravan`), `hall`
  (lifts clique loyalty+stance in `cliqueTick`). `countBuilt(type)` helper. drawStruct now has
  a `default` case so any new building renders a generic tinted box + glyph (don't rely on it
  for hero buildings — add a real case for those).
- **District Chronicle** — DONE. `CHRONICLE[]` + `chronicle(text,icon)` records major beats
  (births, deaths, comings-of-age, partnerships, fire/blackout/raid, tier-ups). Surfaced as the
  "SAGA" tab in the diary overlay (`renderChronicle()`, default tab). Serialized — persists
  across save/load as the district's history.
- **Visual legibility (checkup)** — children render at 0.62 scale + flagged in inspect;
  watch-post coverage rings; blackout screen-darkening.
- **UI readability pass** — DONE (CSS only, no logic touched). Priority was readability. Changes:
  `--dim` #5a7a9a→#8aa8c8 (the big one — secondary text was too low-contrast everywhere); `--tx`
  brighter (#e4f4ff); accent colors nudged brighter/more saturated for dark-bg contrast. Font
  bumps: hud-label 9→10px, hud-pip 10→11px, hud-val 13→14px, hud-day 11→12px, inspect base
  11→12px + .sub 10→11px, overlay h4 9→11px + srow 11→12px, buttons 11→12px w/ more padding.
  Mobile inspect widened 220→260px (was cramped). All panels read clearer at a glance; cyberpunk
  vibe intact. (ui_preview.html in container is a standalone HUD/inspect preview for eyeballing.)
- **Private-property barging — FIXED (was incomplete)** — the earlier fix only gated `randNear`
  (wandering); wisps still entered homes via job pathing. Now fixed at three layers: (1) A* adds
  a heavy finite trespass cost (40) for tiles in homes the pawn can't enter, so paths route
  AROUND them (the goal tile is exempt; `gotoCell` passes `{pawn:p}`); (2) `nearestStruct` skips
  fixtures inside un-enterable homes (no pathing to a stranger's couch/tv); (3) socialize target
  selection skips people standing in un-enterable homes, and the socialize execution ABANDONS if
  the target ducks into one. Result: trespass went 0.31% → 0.00% over a 12-day sim; legit entries
  (invited visits, family, crime jobs) still work. Perf unaffected (~0.4ms/path).
- **Home visiting & private property** — DONE. Wisps know whose home is whose (`homeOwnerAt`)
  and respect it by relationship tier: `canEnterHome(p,owner)` — own/family(`areFamily`:
  partner or parent/child) → free; friend (rel>50) → ok; stranger → no (except crime). Property
  respect enforced in `randNear` (wandering wisps won't pick tiles in homes they can't enter).
  New job actions: VISIT (friend/partner home — mutual social + rel boost, close friends may
  pair up; "visited"/"hosted" mods); BURGLE (low-integrity desperate wisp robs a stranger's
  HOME — bigger than pickpocketing, far likelier caught if owner home, breeds grudges); HOMICIDE
  (GATED: deep grudge rel<-70 OR gang vendetta + violent/low-integrity wisp; telegraphed via
  "stalked" mod; 60% lethal else wounds; +30 heat; witnesses lose rel & loved ones swear
  revenge). All gated by personality (intg/imp) + cooldowns (crimeCd/killCd). Job labels added.
  FIXED a latent pre-existing bug: `steal` (and new `burgle`) referenced an out-of-scope `night`
  var that would throw on completion — both now compute `lightLevel(hourN())` locally.
- **Smoke test fix** — `E A* corner-to-corner` was flaky (~10% fail): it pathfound the maximal
  far-corner diagonal which sits at A*'s node-expansion cap (route exists but search gives up).
  Proven independent of game code (test runs before any AI). Test now uses a mid-range path
  (2,2 → map center); 12/12 stable. (astar's search cap itself is unchanged/by-design.)
- **Commerce staffing + build UI (graphics-overhaul push, part 1)** — DONE. (1) Build menu now
  DISMISSES when you pick an item to place (closeSub on build-tool select). (2) Removed the
  inspect-panel CANCEL button on blueprints (+ its dead handler); ZONE tool still cancels via
  cancelBp. (3) STORES NOW REQUIRE STAFFING: vendor income loop only runs if a store has a
  working robot OR an assigned human present (DIST<3.5); unstaffed → `s.idle=true`, earns nothing.
  `selfRun` flag (dealer) exempts off-books vendors. staffMul: content human 1.25× / ok human
  1.05× / robot 0.85× / self-run 0.7×. Idle stores show a pulsing amber ⚠ on the map + "IDLE —
  needs a worker" in inspect + "staffstore" onboarding hint. NOTE: wisps do NOT auto-assign to
  stores (player assigns) — so a fresh colony has ~9/11 stores idle until staffed; this is the
  intended "you manage commerce" design but watch starting-economy balance in play.
  REMAINING in this push (not yet built): commerce buildings → rooms/interiors; visible worker
  inside store; studying → distinct visible activities (read/train/practice).
- **Home layout (Living Homes Phase 2)** — DONE. `home(x0,y0,variant)` now arranges furniture
  into functional ZONES (sleep nook + lamp, clustered utility/hygiene wall, living area with
  couch over rug facing tv) instead of scattering fixtures along the top wall. 3 layout VARIANTS
  (living-focused / studious-w-bookshelf / cozy) so the block isn't identical stamped homes —
  picked per-home via RI(0,2). Bed ref follows the actual pod position per variant (was
  hardcoded). Verified: 3 distinct layouts across 7 homes, 0 fixtures on wall/edge tiles (all
  accessible), wisps use homes normally. NEXT: Phase 3 graphics (per-item vector art reflecting
  state), Phase 4 verification.
- **Coverage/wiring audit (Living Homes Phase 1.5)** — DONE. Audited which NPC interactions
  actually FIRE in real play (instrumented mod/job tracking over long runs). Found + fixed two
  real gaps: (1) furniture decay was ~82 days (never seen) → wear rate R(1.6,3.0) so standard
  breaks in ~25-30 days, visible; (2) starter homes were packed with no free tile, so wisps
  couldn't buy aspirational items (art never appeared → admireart never fired) → homes enlarged
  to 6×5 with a free interior row + seeded with couch+rug. Confirmed working-as-designed (NOT
  bugs, left alone): theft/vengeance (suppressed by good management — correct), politics
  backop/opposeop mood (need player petition-answers — correct), mentor (rare), upgradefurn/
  expanded (wealth/space-gated aspirational states). Verified post-fix: brokefurn, newfurn,
  couchsocial, art-bought, admireart ALL fire in a 50-day run.
- **Furniture interactivity (Living Homes Phase 1)** — DONE. Decorative items became real
  use-spots where it makes sense: COUCH is a recreation source (added to `funStr`); its recreate
  case gives stress relief (×quality) + a SOCIAL bonus when shared (two wisps near a couch bond,
  `couchsocial`/`couchrelax` mods). ART: idling wisps near owned working art "admire" it for a
  brief mood lift scaled by wealth (`admireart` in the idle case, rate-limited). BOOKSHELF is now
  an active STUDY spot (added to `schoolStr` so the learn task targets it; was passive-XP only).
  RUG/LAMP stay ambient (no forced interaction). NEXT (planned): Phase 2 layout (arrange furniture
  like a lived-in room), Phase 3 graphics (detailed per-item vector art reflecting state).
- **Room quality (RimWorld-direction, showcase on homes)** — DONE. `computeRoomQuality(rm)` →
  0..100 from SPACE (tiles/occupant), BEAUTY (`ROOM_BEAUTY` furniture sums × quality tier), minus
  UPKEEP (broken items). Cached `rm.qual`/`rm.qualDay` (daily). `roomQuality()`, `roomQTier()`
  (Squalid→Luxurious), `structsInRoom`, `roomOccupants`, `homeRoom(p)`. Feeds occupant MOOD in
  moodCalc (−6 squalid .. +10 luxurious). Visuals: `drawPod` now quality-scaled — brighter glow,
  themed floor grid w/ seams, corner neon nodes at quality≥45. Shown in pawn inspect ("HOME:
  Pleasant (quality 65)"). This is the PROOF on one room type; pattern extends to other rooms.
- **Sprite layer** — proved-then-retired for buildings. The vector renderer is the chosen path
  (sprites clashed with top-down projection — confirmed in-engine). `SPRITE_SRC` now EMPTY;
  getSprite/drawSprite infra kept dormant + harmless for possible future hero/landmark art.
  furnstore reverted to 1-tile. (sprites/ folder in repo can be removed if desired.)
- **Store robots (automation)** — DONE. A vendor store can be AUTOMATED (`automateStore` →
  `s.roboStaffed`, `s.roboHp`): inspect-panel button, costs `ROBO_INSTALL`=160c +
  `ROBO_UPKEEP`=4c/day. `roboTick()` (daily) decays roboHp (~slow, breaks in ~tens of days) +
  drains upkeep; a broken robot (`roboBroken`) takes the store OFFLINE (no sales) until
  `repairRobo` (48c). `deautomateStore` reverts to human. Economic tradeoff in the vendor sales
  loop via `staffMul`: content human clerk (mood≥55, present) 1.25× · ok human 1.05× · working
  robot 0.85× — humans win when content, robots win when you're short-staffed (a store that'd
  sit unstaffed still earns reliably). Humans no longer pulled to work robo stores (`isWorkable`
  excludes `roboStaffed`). Map cue: cyan ⚙ on robo stores (red if broken). Hint: "robot".
  All state on the struct (serializes automatically).
- **Optional sprite layer** — DONE (proven on ONE building: furnstore). `SPRITE_SRC{type:file}`
  registry + `getSprite()` (lazy-loads `sprites/<file>`, caches, guards `typeof Image`) +
  `drawSprite()`. In drawStruct's finished-building branch: `if(sprite ready) draw it; else`
  the vector switch. Purely ADDITIVE — missing/failed sprite → silent vector fallback, nothing
  breaks. Overlays (HP/broken/quality) still draw over sprites. Multi-tile via
  `DEF[type].spriteTiles=[w,h]`. Title screen has an optional `sprites/title.png` painted-hero
  slot (absent → text-only). **DEPLOY CHANGE:** if `sprites/` has art, it must sync to the VPS
  too (still single-file engine; sprites are an optional sibling folder). Spec: `sprites/README.md`.
  Rights: AI-gen art governed by tool terms — verify before committing to a public repo.
- **Refinement pass (UX/legibility/pacing)** — DONE.
  · IA: build menu regrouped by life-area (Home/Comfort/Work/Commerce/Civic/Order/Growth — no
    bloated category; previously-orphaned stimlab/gearshop/hospital/arcade/dealer/farmplot/
    loggingcamp/mineshaft now categorized). `collectAlerts()` aggregates per-pawn alerts into
    summaries ("3 citizens infected"), sorts crit→warn→info, caps total (no overwhelm).
  · Visibility (map-first): pawn map badges expanded — sick(+), evicted(H), grudge(!),
    gang(◆ in turf color), hooked(~). Inspect shows top 3 mood drivers (the hidden mod math).
  · Pacing: daily district UPKEEP (`ST.lastUpkeep`) — ~1.5c/day per major building (work≥140/
    civic/security/vendor; excludes fixtures/walls/pods). Gentle brake so income can't run away
    (was 363→2675 over 20d unbounded; now a softer slope). TUNE the 1.5 rate from real play.
  · Onboarding: 9 new `hintOnce` triggers in checkContextualHints (dynasty, furndecay,
    furnstore, politics, watchpost, disaster, expand) — the deep systems now teach themselves.
- **Furniture / personal economy** — DONE. `DEF[...].furn:true` marks ownable, decaying
  furniture (pod/lamp/fridge/toilet/shower/tv/gym + new couch/bookshelf/art/rug). `QUALITY[]`
  tiers (cheap/standard/premium → `s.qual`) affect decay/effect/price. `furnitureDecayTick()`
  (daily, slow) wears items down; at hp<=0 they break (`isBroken`), stop working
  (`furnEffective` gates fridge/shower/lamp/etc. + `homeFixture`/`nearestStruct` skip broken),
  and render a red spark + dark tile. `tryFurnish(p)` (daily/pawn): residents repair broken,
  buy missing FURN_WANTS, or upgrade — from their own credits, gated by `wealthTier`.
  `furnstore` building (`hasStore()`) enables buying; district takes a 40% cut via
  `spendAtStore`. New items' effects: couch/rug/art → home comfort mood in `moodCalc`;
  bookshelf → bonus XP in `gainXp` (2x for children). House expansion: `genExpansionPetition()`
  (cramped + tier≥2 + adjacent space) → `applyRequest` kind `"expand"` → `doExpand()` grows the
  home rect. `FURN_PRICE`, `furnPrice()`, `homeStructs()`, `freeHomeTile()`, `expansionRoom()`
  helpers. All save/load via struct/pawn props (qual backfilled in applyState).
- **Cliques, mentorship** — DONE earlier (see Architecture map §3).
- The four NPC pillars — Work & Ambition, Ownership & Wealth (w/ inheritance), Relationships
  (typed + gossip + partnerships), Crime & gangs — all DONE.

**Still open / next opportunities:**
- Puddle-shimmer gradients still per-frame (minor perf).
- More building types; inter-district trade beyond caravans; deeper supply chains.
- **Audio levels need an ear-test pass** — intensity thresholds (0.12/0.42/0.70) and master
  volume (0.16) are guesses; tune once heard in-browser.
- **Disaster/economy tuning** — `ADULT_AGE=14` (dynasty maturation), disaster base rate
  (~4%/day +pressure), caravan rate (~6%/day) are all first-pass; tune from real play.

**⚠ Before building ANY "new" system, grep the code first** — several systems were built across
sessions and a stale roadmap once caused ~170 lines of duplicate clique/mentor code. Verify
against `git log` and the actual file, not memory or this doc alone.

---

## 9. User working style (important)

- **One command at a time** for deploys/debugging. Wait for output before the next step.
- Blunt, data-driven, technical. Challenge unsupported ideas. No praise unless earned.
- Validate EVERY build before shipping (the user runs the tests independently and will catch
  a skipped validation).
- The user builds features in big ranked batches and likes emergent, interlocking systems over
  shallow ones. When tuning, show the data, not a guess.
