# NEON SPRAWL — Personality AI Design (v0.2)

> Status: **DESIGN ONLY**. No implementation yet. `index.html` is untouched.
> Target: replace the rigid 3-runner priority colony with 2 personality-driven
> agents the player influences by request/response rather than direct command.
> All line references are against `index.html` as of v0.1 (2026-06-13).

---

## 1. System overview

Today the colony runs on `findJob(p)` ([index.html:472](../index.html#L472)) — a
fixed priority cascade (eat → sleep → cook → build/decon → salvage → haul → idle).
Every runner obeys the same ladder; there is no personality, no player dialogue,
no change over time.

v0.2 replaces that ladder with a **utility scorer**. Each agent has a four-axis
personality vector that weights how appealing each candidate action is. The
agent picks the highest-scoring action every time it needs a new job. On top of
that sit three systems:

- **Request/response** — agents surface dilemmas to the player ("eat raw or
  wait?"). The player's answer nudges that agent's per-action bias. This is the
  *only* way the player steers an undrafted agent.
- **Personality drift** — axes shift slowly at outcome points (survived a raid,
  witnessed a death, salvage paid off). Over a 10-day run an agent visibly
  changes character.
- **Bond** — a single 0–100 scalar between the two agents, moved by proximity,
  shared meals, distress, and conflicting player answers. It feeds mood, rescue
  willingness, and build cooperation.

**Build order (per brief):** (1) utility AI with static vectors replacing
`findJob`; (2) request/response UI; (3) drift; (4) bond. Each is independently
shippable and testable.

**Hard architecture rules carried forward:** single-file vanilla JS, no
dependencies, no build step; new code stays in its mapped section; everything
runs inside the existing 10-tick/second budget (`TPS=10`, `TPD=2400`).

### What survives untouched

The whole *job-execution* layer in `pawnTick` ([index.html:573](../index.html#L573)
`switch(j.t)`) stays as-is. The scorer only decides **which** job object to
create; the existing job builders (`mkEat`, `mkSleep`, the inline cook/build/
salvage/haul constructors) still produce the same job shapes, and the execution
switch consumes them unchanged. This keeps the change surgical and keeps
reservations (`s.res` / `it.resv`), pathing, and the unreachable cache (`p.unre`)
working exactly as today.

---

## 2. Data structures

### 2.1 Agent personality (added to `mkPawn`, [index.html:389](../index.html#L389))

```js
// inside the object returned by mkPawn():
pers: { ind:50, cau:50, soc:50, cur:50 },   // four axes, 0..100
bias: { eat:1, sleep:1, cook:1, build:1,    // per-action player-set multipliers
        salvage:1, haul:1, explore:1, idle:1 },
drift:{ day:0, used:0 },                     // per-day drift budget (clamps whiplash)
seen: { explored:new Set() }                 // frontier memory for the explore action
```

Axes:

| Axis | Field | High value means | Low value means |
|------|-------|------------------|-----------------|
| Industriousness | `ind` | Seeks work (build/cook/salvage/haul), rarely idles | Idles, defers chores |
| Caution | `cau` | Eats/sleeps early, avoids risk, flees sooner | Pushes need timers, takes risks |
| Sociability | `soc` | Stays near the other agent, values shared meals | Loner, indifferent to bond |
| Curiosity | `cur` | Drawn to explore/unknown tiles | Stays in the known base footprint |

`pers` is **distinct from `tr` (traits)**. Traits remain fixed multipliers on
mechanics (`trMul`/`trAdd`, work/move/mood). Personality governs *choice*. They
compose: a Hard-Worker trait still speeds the build; Industriousness decides
whether the agent picks the build at all.

### 2.2 Request (`ST.requests`, new array)

```js
{
  id,                 // uid()
  agentId,            // p.id of the asking agent
  kind,               // 'safety' | 'food' | 'build' | 'social' | 'conflict'
  text,               // display string, e.g. 'Vex wants to know if it's safe…'
  options:[           // 2–3 choices
    { label:'Go ahead',  apply:{ explore:+0.15 } },   // bias deltas, clamped
    { label:'Hold back', apply:{ explore:-0.15, cau:+3 } }
  ],
  created, expires,   // tick stamps; expires ~= created + TPD*0.4
  status              // 'pending' | 'answered' | 'expired'
}
```

`apply` entries keyed by an action name hit `agent.bias[action]`; entries keyed
by an axis name (`ind/cau/soc/cur`) nudge `agent.pers` directly. One small union
type keeps the option handler trivial.

### 2.3 Bond (`ST.bond`, single scalar)

```js
ST.bond = 50;        // 0..100, one number for the 2-agent colony
```

A scalar (not a matrix) because the colony is two agents. If the colony ever
grows past two, this becomes a keyed map — see open question 8.

---

## 3. Utility scoring

### 3.1 Replacement point

`findJob(p)` is replaced by `chooseJob(p)`. The call site is the only edit in
`pawnTick`: [index.html:571](../index.html#L571) `if(!p.job)p.job=findJob(p)` →
`if(!p.job)p.job=chooseJob(p)`. Frequency is identical — the scorer runs only
when an agent has no current job, never every tick.

### 3.2 Hard survival gates (preserved)

`findJob` front-loads two emergencies (`food<=22`, `rest<=18`). These stay as
**hard pre-checks above the scorer**, exactly as today. Personality may make an
agent eat *late*, but it can never starve itself to death by choice. Drafted,
fleeing, and dazed states already short-circuit before job choice in `pawnTick`
([index.html:546–567](../index.html#L546)) and are unchanged.

```js
function chooseJob(p){
  // hard floors — identical to findJob's top
  if(p.needs.food<=22){const j=mkEat(p); if(j) return j;}
  if(p.needs.rest<=18) return mkSleep(p);
  // discretionary band — utility scorer
  return scoreJobs(p);
}
```

### 3.3 The formula

For each candidate action `a`:

```
U(a) = base_need(a) · personality_weight(a) · bias(a) · situational_mod(a)
```

- **base_need(a)** — 0..100, derived purely from game state (how badly the
  action is wanted right now). 0 means the action is currently impossible
  (e.g. no blueprint exists → build base = 0).
- **personality_weight(a)** — maps the dominant axis to a multiplier:
  `0.5 + axis/100`, range **0.5 … 1.5**, so an axis at 50 is neutral (×1.0).
- **bias(a)** — `agent.bias[a]`, the player-set multiplier (default 1.0,
  clamped 0.6 … 1.5). Untouched until the request system ships (phase 2).
- **situational_mod(a)** — contextual multipliers (foe nearby, night, injury).

Highest `U` wins. Ties break toward the lower-index action (stable order).

### 3.4 base_need and axis mapping

| Action | base_need (0..100) | Dominant axis (weight) | Notes |
|--------|--------------------|------------------------|-------|
| eat | `clamp(80 − food, 0, 100)` | Caution | cautious agents eat earlier |
| sleep | `clamp(70 − rest, 0, 100)` | Caution | + night situational |
| cook | `45` if raw≥2 ∧ meal<10 ∧ synth powered, else `0` | Industriousness | |
| build | `50` if any blueprint/decon job free, else `0` | Industriousness | |
| salvage | `40` if designated scrap free, else `0` | Industriousness (+0.1·cur) | |
| haul | `30` if loose item ∧ zone exists, else `0` | Industriousness | |
| explore | `25` (constant pull) | Curiosity | only competitive at high `cur` |
| idle | `10` (floor) | **inverse** Industriousness: `0.5+(100−ind)/100` | lazy agents idle |

Sociability rides on top as situational nudges (shared-meal appeal, "idle near
the other agent") rather than a primary action axis — it mostly expresses
through bond and requests, not raw job choice.

### 3.5 Situational modifiers (multipliers)

| Condition | Affected actions |
|-----------|------------------|
| Foe within ~10 tiles (`foeNear(p,10)`) | explore ×0.2, build/salvage/haul ×0.6, sleep ×0.3, eat ×0.8 |
| Emergency hunger (`food≤22`) | handled by hard gate (×2 fallback if it ever reaches the scorer) |
| Night (`lightLevel(hourN())>0.3`) | sleep ×1.4, explore ×0.7 |
| Injured (`hp<40`) | eat ×1.3, sleep ×1.3 |
| Power deficit | cook already gated to 0 by `s.powered` |

### 3.6 Worked example

**Agent "Static"** — `ind:70, cau:40, soc:50, cur:80`, all biases 1.0.
**State:** food 30, rest 65; a blueprint is waiting; designated scrap exists;
raw 4 / meal 2 with a powered synth; a loose item + a stockpile zone exist;
daytime; no foe nearby.

| Action | base | pers_weight | sit | U |
|--------|-----:|------------:|----:|----:|
| eat | 80−30 = **50** | 0.5+40/100 = 0.90 | 1.0 | **45.0** |
| sleep | 70−65 = **5** | 0.90 | 1.0 (day) | 4.5 |
| cook | **45** | 0.5+70/100 = 1.20 | 1.0 | 54.0 |
| build | **50** | 1.20 | 1.0 | **60.0** |
| salvage | **40** | 1.20 (+cur) | 1.0 | 48.0+ |
| haul | **30** | 1.20 | 1.0 | 36.0 |
| explore | **25** | 0.5+80/100 = 1.30 | 1.0 | 32.5 |
| idle | **10** | 0.5+(100−70)/100 = 0.80 | 1.0 | 8.0 |

**Winner: build (60.0).** Industrious Static gets the wall up before bothering
with a non-urgent meal — a *cautious* agent (low `cau` here = 40) wouldn't have
prioritized eating anyway.

Now drop food to **18** (crosses the emergency floor): the hard gate in
`chooseJob` fires `mkEat` before `scoreJobs` ever runs. Survival is never up for
negotiation. This is the key safety property: **personality governs the
discretionary band only.**

### 3.7 The new `explore` action

There is no fog-of-war today — the whole map renders. "Explore" therefore needs
a *target* to be meaningful (see open question 9). Proposed v1: `mkExplore(p)`
picks the nearest map-frontier tile the agent hasn't stood near (tracked in
`p.seen.explored`), biased toward the map edges / past player barricades, and
walks there via `gotoCell`. It is the behavioral hook the "is it safe past the
eastern barricade?" request hangs on. Frontier lookup must be cached/cheap — no
full `MW·MH` scan per call (budget note, §7).

---

## 4. Request / response UI

### 4.1 Why it exists

The player no longer issues work orders to undrafted agents. Influence flows
through answering requests, which adjust `agent.bias`. Drafting for combat
([index.html:554](../index.html#L554)) remains fully manual and unchanged.

### 4.2 Panel design

Recommendation: a **persistent sidebar** (`#requests`), styled like the existing
`#log` / `#inspect` panels, **not** a modal. Modals (`showModal`,
[index.html:1267](../index.html#L1267)) are full-screen interrupts used for
start/win/lose; routing every "Static is hungry" through one would be intrusive
and would fight the real-time sim. A sidebar lets 0–2 pending requests sit
quietly until answered. (Confirm — open question 5.)

Each pending request renders: asking agent's name (in their accent color), the
`text`, and the option buttons. Click → handler applies `option.apply`, logs a
line via `log()` ([index.html:1258](../index.html#L1258)), marks the request
`answered`, and fades it out.

### 4.3 Lifecycle

```
generate (tick pass, throttled)
   → push to ST.requests (status:'pending')
   → render in #requests sidebar
   → player clicks option  ──► apply bias/axis deltas, status:'answered', remove
        │
        └─ no answer before `expires` ──► status:'expired'
              agent acts on its own personality default
              (optional small autonomy consequence — open question 6)
```

Generation rules (throttled to respect budget, §7):
- **At most one pending request per agent**, and a global minimum gap (e.g.
  `TPD*0.25`) so the player isn't spammed.
- Generated in the master `tick()` ([index.html:820](../index.html#L820)) on a
  coarse cadence (e.g. `ST.tick%30===0`), alongside the existing periodic passes.

### 4.4 Trigger catalogue (examples)

| kind | Fires when | Example text |
|------|-----------|--------------|
| safety | High-`cau` agent wants to explore toward a risky frontier / past a barricade | "Vex wants to know if it's safe past the eastern barricade." |
| food | Food low and only **raw** protein available (no meals) | "Static is hungry and there's no protein — eat raw or wait?" |
| build | Two+ blueprints queued, agent unsure which first | "Vex asks which to raise first: the turret or the wall?" |
| conflict | Both agents target the single free synth/pod | "Static and Vex both want the synth station." |

---

## 5. Personality drift

Axes shift at **outcome points** already present in the code. Each event applies
a small delta, clamped 0..100, and is throttled by a **per-day drift budget**
(`p.drift.used` capped per `dayN()`) so change is visible over 10 days but never
whiplashes within one fight.

### 5.1 Drift trigger table

| Trigger | Code hook | Δ axes |
|---------|-----------|--------|
| Took damage | `damagePawn` [index.html:515](../index.html#L515) | cau **+3** |
| Witnessed an ally's death | `killPawn` loop [index.html:523](../index.html#L523) (already touches every other pawn) | cau **+6**, soc **−3** |
| Killed a foe | `damageFoe`→kill path | cau **−2**, ind **+1** (emboldened) |
| Survived a raid (alive at raid-end) | raid-clear point in `fireEvent`/`tick` | cau **+2** |
| Hit hunger crisis (`food` reached 0) | `pawnTick` starvation [index.html:537](../index.html#L537) | cau **+4** |
| Salvage job completed | salvage case in `pawnTick` switch | ind **+1**, cur **+1** |
| Build job completed | build case [index.html:604](../index.html#L604) | ind **+1** |
| Shared a meal near the other agent | eat completion [index.html:580](../index.html#L580) | soc **+2** |
| Explored a new frontier tile | `mkExplore` arrival | cur **+2** |
| Recovered from a mental break | dazed expiry [index.html:549](../index.html#L549) | cau **+2**, soc **−1** |

Deltas are intentionally small; the 10-day arc is the sum of many events. Exact
numbers are first-pass and tunable after playtest (do not balance blind — same
rule as raids).

---

## 6. Bond mechanics

`ST.bond` (0..100, starts 50) is moved by the events below and read by three
systems.

### 6.1 Bond modifier table

| Event | Code hook | Δbond |
|-------|-----------|-------|
| Proximity (both within ~5 tiles) | `tick` accrual pass | +0.02 / accrual tick |
| Shared meal (both ate near each other in a window) | eat completion [index.html:580](../index.html#L580) | **+3** |
| One rescues the other (drafted toward a fleeing/low-hp ally) | draft move logic | **+5** |
| Witnessing distress but **not** helping | `damagePawn` of the other | **−1** |
| Conflicting player answers (player repeatedly favors one agent) | request handler | **−2** |
| Cooperative build (both on the same blueprint) | build case [index.html:604](../index.html#L604) | **+2** |
| The other agent dies | `killPawn` [index.html:519](../index.html#L519) | (grief via mood; bond largely moot at 1 survivor) |

### 6.2 Bond effects (read points)

| Effect | Where | Behavior |
|--------|-------|----------|
| Mood | `moodCalc` [index.html:411](../index.html#L411) | bond>65 ∧ ally near → +mood; bond<35 ∧ ally near → −mood |
| Rescue willingness | drafted/auto-aid logic | high bond → agent moves to aid a fleeing/downed ally; low bond → ignores |
| Build cooperation | `scoreJobs` build weight | high bond → agents co-locate on one blueprint (faster); low → avoid sharing |

---

## 7. Integration points (what changes in `index.html`)

Grouped by architecture section (the map in CLAUDE.md). **Designs only — none of
this is written yet.**

| # | Function / site | Line | Change |
|---|-----------------|------|--------|
| 1 | `mkPawn` | [389](../index.html#L389) | Add `pers`, `bias`, `drift`, `seen` fields (§2.1) |
| 2 | `newGame` | [1442](../index.html#L1442) | Spawn **2** agents (not 3) with distinct personality seeds + names; init `ST.bond=50`, `ST.requests=[]` |
| 3 | `findJob` → `chooseJob`+`scoreJobs` | [472](../index.html#L472) | Replace cascade with hard gates + utility scorer; reuse existing job builders |
| 4 | `pawnTick` job-pick | [571](../index.html#L571) | `findJob(p)` → `chooseJob(p)` (one-line call swap) |
| 5 | `pawnTick` switch | [573](../index.html#L573) | Add `case "explore"` + `mkExplore(p)` builder |
| 6 | `moodCalc` | [411](../index.html#L411) | Add bond proximity mood term |
| 7 | `damagePawn` | [515](../index.html#L515) | Drift hook (cau+) + bond distress hook |
| 8 | `killPawn` | [519](../index.html#L519) | Drift hook (witnessed death) in the existing all-pawns loop |
| 9 | Job-completion cases (eat/cook/build/salvage) | [580](../index.html#L580)+ | Drift + shared-meal/co-build bond hooks |
| 10 | `tick` master | [820](../index.html#L820) | Add throttled passes: request-gen, drift-apply, bond-proximity accrual |
| 11 | UI: `#requests` panel | new, near `#log`/`#inspect` | New `renderRequests()` + click handler; reuse `log()`/styling, **not** `showModal` |
| 12 | `renderInspect` | [1311](../index.html#L1311) | Show personality bars + bond in pawn inspector |
| 13 | `test/smoke.js` | — | **C** (salvage→haul) and **F** (8-day auto-player) drive `findJob`; replacing it changes their trajectories — migration required (open question 11) |

### Tick-budget assessment

No concern in the common path: the scorer runs **only when `p.job` is null**
(same frequency as `findJob` today), and scoring 8 actions for 2 agents is
trivial arithmetic. The request-gen, drift, and bond passes are throttled to
coarse cadences (`%30` / `%20`) like the existing periodic blocks in `tick()`.
The one watch-item is `mkExplore`'s frontier search — it **must** be cached or
incremental, never a per-call `MW·MH` (56·40 = 2240-cell) scan.

---

## 8. Open design questions

Please answer these in one pass before coding begins — several gate phase 1.

1. **Agent count.** Confirm dropping from 3 runners to **2 agents**? The smoke
   tests and the (unmeasured) difficulty assume 3; 2 agents that sometimes
   decline optimal work are materially weaker.

2. **Survival floor.** The design keeps `food≤22` / `rest≤18` as *hard gates*
   above the scorer, so personality can never self-starve. Acceptable, or should
   extreme Caution/recklessness be allowed to override even survival?

3. **Personality seeds.** Fixed archetypes (e.g. Vex = curious scout, Static =
   industrious homebody) for a designed dynamic, or randomized each run for
   variety?

4. **Save/load.** Roadmap item 1 is localStorage save/load. Should `pers`,
   `bias`, `drift`, and `bond` be persisted? ("Visible change over a 10-day run"
   implies yes, but confirm.)

5. **Request panel form.** Persistent sidebar (recommended) vs modal interrupt?
   And does surfacing a request **pause** the sim, or does it keep running?

6. **Ignoring requests.** When a request expires unanswered, is there a cost
   (e.g. small autonomy/Sociability drift) or is non-engagement neutral?

7. **Bias decay.** Do player-set biases decay back toward 1.0 over time, or
   persist permanently for the run? And confirm the clamp range (proposed
   0.6 … 1.5).

8. **Bond scope.** With only 2 agents, one death makes bond mostly moot. Is the
   bond system worth its complexity at 2 agents, or should the colony be 3 so
   bond (and conflict) has room to matter? (Interacts with Q1.)

9. **Explore target.** There's no fog-of-war — the whole map is visible. Should
   "explore" mean walking to an unvisited map frontier (proposed), or do you want
   actual fog/discovery state added so curiosity has something to reveal?

10. **Combat & personality.** Should Caution drive combat behavior (auto-flee
    thresholds, refusing to advance), or does drafting stay 100% manual as today?

11. **Test migration.** Replacing `findJob` breaks the assumptions in smoke tests
    **C** and **F**. Preferred path: (a) make the scorer reproduce baseline
    economic behavior at a neutral 50/50/50/50 vector so C/F still pass, (b)
    rewrite F to exercise personality agents, or (c) retire F?

12. **Difficulty offset.** If 2 personality agents are weaker than 3 obedient
    runners, do we accept easier-via-fewer-hands for v0.2, or compensate (raid
    curve in `spawnRaid`)? Per CLAUDE.md, no blind tuning — this would wait on a
    playtest verdict regardless.
