# NEON SPRAWL — Colony Protocol · Developer Handoff

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
