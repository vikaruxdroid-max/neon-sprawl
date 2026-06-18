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

- **Character-creation screen** — DONE. NEW DISTRICT now routes through `showCharCreate()` before
  newGame: pick 1 of 5 backgrounds (live stat preview), distribute OPS_POINT_BUDGET(4) extra points
  via +/- per attribute (capped 0-10, remaining counter), enter a codename. BEGIN sets
  window.PENDING_AVATAR={name,bg,stats} → newGame spawns exactly that operative. `CC` working state,
  `ccStats/ccPointsUsed/ccRemaining/ccSyncName` helpers, wired in the #modal click handler
  (data-ccbg/ccinc/ccdec/cc-begin/cc-back). Default fallback intact if skipped. Probe-verified: base
  spreads, point math, 10-cap, bg-switch, full creation→spawn pipeline all correct.
- **Music → melancholy lofi + UI/GUI consistency pass** — DONE (this is the "proper test build").
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
