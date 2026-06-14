# NEON SPRAWL — Social Sim Design (v0.3)

> Status: **DESIGN ONLY**. No implementation yet. `index.html` is untouched.
> Target: pivot from extraction colony-builder to a **persistent cyberpunk social
> sim** — two characters living independent lives in a procedural city, driven by
> hidden stats and four interlocking pressure systems, observed and narrated by a
> Claude enrichment layer. Sandbox, no win/lose, endless churn.
> All references are against `index.html` as of v0.2 (phases 1–4 shipped).

---

## 0. Continuity — what v0.2 becomes

The pivot is **evolution, not rewrite**. The phase 1–4 AI substrate is the
behavioral core of the social sim. Nothing built is thrown away:

| v0.2 system | Becomes in v0.3 |
|-------------|-----------------|
| `chooseJob`/`scoreJobs` utility scorer | The character **behavior brain** — gains social, job, crime, hygiene, recreation actions |
| `pers` (4 axes) | Layer A of the expanded **hidden stat model** (§2) |
| `bias` (player multipliers) | The **player order** channel (still set via the requests panel) |
| `drift` (axis shift at outcomes) | The **doom-loop** wiring — trauma, addiction, success shift personality |
| `bond` (single scalar) | Expands to a **relationship matrix** (§7) |
| `ST.requests` + sidebar | The **influence channel** — gains new request kinds tied to pressures |
| `gotoCell` + structure/`use` pattern | Unchanged — every social verb is *walk to object, use it, get result* |
| Fog of war (`ST.fog`) | Retain or repurpose (open question 8) |

The architectural rule holds: single-file vanilla JS, no dependencies, no build
step, everything inside the 10-tick/second budget (`TPS=10`, `TPD=2400`).

The key reuse insight: the existing job-execution layer already does the exact
social-sim verb. `mkEat` is "walk to food, consume, change mood." "Work" is walk
to a workstation and use it. "Cook" is walk to a stove and use it. "Sleep"
already exists. Adding apartments, stoves, beds, and job terminals is **new
object types on the same grid the engine already paths across** — incremental,
not a new engine.

---

## 1. System overview

Two characters live in a procedural city block. They are autonomous: a utility
scorer (extended from v0.2) picks each character's next action from a large
action set, weighted by hidden personality stats, current needs, money, and
situational pressure. The player never issues direct movement orders to
undrafted characters — influence flows through **orders** (bias nudges) and
**zoning** (designating areas), exactly as v0.2's request system already works.

Four pressure systems run continuously and **interlock into a doom-loop** that is
the story engine:

```
   POVERTY ──▶ pushes toward CRIME ──▶ risks VIOLENCE ──▶ inflicts TRAUMA
      ▲                                                          │
      │                                                          ▼
  loses job ◀── BREAKDOWN ◀── high stress ◀── trauma + addiction accrue
```

A character with low credits and low integrity slides toward crime; crime risks
violence; violence raises stress and lowers health; stress triggers mental
breaks; breaks stop them working; lost income deepens poverty. Characters can
fall into this loop **or claw out of it** — a high-integrity, high-industrious
character grinds legal work and stays clear. The drama is emergent: it comes from
hidden stats meeting systemic pressure, not from scripted events.

**Death and churn.** Any pressure can kill (starvation, violence, overdose,
untreated disease). When a character dies, the city **repopulates** via the
existing wanderer-arrival mechanism. The city is the persistent entity; its
population churns. Stories rise and fall. (Survival mode — all-die = game over —
is a later add, §10 Phase G.)

**Two-layer architecture.** The entire game above runs **deterministically with
zero API calls**. The Claude enrichment layer (§9) sits on top, reads state
asynchronously, and generates *meaning* (inference, narration, dialogue, crime
proposals, faction reactions). If the proxy is down or the call budget is spent,
the game falls back to deterministic templated text and keeps running. The API is
never on the critical path.

---

## 2. Hidden stat model

All stats are **hidden** from the player. The player infers character through
behavior (and through Pillar 1's surfaced observations, §9). Three layers:

### 2.1 Layer A — Personality axes (drive choice, drift slowly)

Extends v0.2 `pers`. Range 0–100. These weight the utility scorer and gate
pressure vulnerability.

| Axis | Field | High means |
|------|-------|------------|
| Industriousness | `ind` | Seeks work, rarely idles *(existing)* |
| Caution | `cau` | Risk-averse, avoids crime/violence *(existing)* |
| Sociability | `soc` | Needs company, values relationships *(existing)* |
| Curiosity | `cur` | Explores, tries new things *(existing)* |
| Ambition | `amb` | Driven to earn and rise; tolerates risk for payoff |
| Empathy | `emp` | Concern for others; resists harming, aids the distressed |
| Impulsiveness | `imp` | Acts without weighing consequences; prone to crime/addiction |
| Integrity | `intg` | Resistance to crime, corruption, betrayal |

### 2.2 Layer B — Needs (deplete over time, drive urgent action)

Extends v0.2 `needs`. Range 0–100, decay continuously, hard floors trigger
emergency action above the scorer (as `food`/`rest` already do).

| Need | Field | Restored by |
|------|-------|-------------|
| Hunger | `food` | Eating (cook or buy) *(existing)* |
| Energy | `rest` | Sleeping in a bed *(existing)* |
| Hygiene | `hyg` | Shower / toilet use |
| Fun | `fun` | Recreation — TV, bar, exercise, entertainment |
| Social | `socN` | Interacting with another character |
| Health | `hp` | Recovers slowly when fed/rested; harmed by violence/disease *(existing as hp)* |

### 2.3 Layer C — Condition / status (states that gate behavior)

| Field | Range | Notes |
|-------|-------|-------|
| `credits` | 0+ | Money. Drives the entire economic pressure system |
| `stress` | 0–100 | Trauma accumulator. High → mental break risk |
| `addiction` | 0–100 | Grows with substance use; withdrawal raises stress |
| `rep` | map | Per-faction reputation: `{corp, gang, neighbors, city}` each −100..100 |
| `sk` | 0–10 each | Work skills — extends existing `sk` (sal/bld/cook/sht + new: tech, social, hustle) |
| `relations` | map | Per-other-character scalar (§7) |

### 2.4 Pressure → stat mapping

Each pressure reads specific stats, which makes the doom-loop deterministic and
tunable:

| Pressure | Reads | Worsened by |
|----------|-------|-------------|
| Economic | `credits`, `amb`, `ind`, work `sk` | Rent due, no income, poverty |
| Crime & violence | `intg`, `emp`, `imp`, `cau`, `rep.gang` | Low credits + low integrity → crime; crime → violence |
| Survival needs | `food`, `rest`, `hyg`, `hp`, `addiction` | Neglect, no money for food/medical |
| Mental & social | `socN`, `stress`, `soc`, `relations` | Isolation, trauma, betrayal, withdrawal |

### 2.5 Temperament color layer

The eight axes (§2.1) plus condition stats (§2.3) are the **hidden mechanical
truth** that drives the scorer. Characters are also **generated from and displayed
via six temperament color groups** — a *derived* layer on top of the stats, never
a replacement. The point: characters look distinct and randomized, and their color
suggests *disposition*, but the player cannot read *morality* (criminal vs saint)
off the color.

**The six groups.** Five are the existing palette (`--mg`, `--rd`, `--gn`, `--cy`,
`--or`); purple is the one addition.

| Temperament | Hue | Blend of axes |
|-------------|-----|---------------|
| Drive | magenta `#ff2d95` | `amb` + `ind` |
| Nerve | red `#ff4757` | `imp` + (100−`cau`) |
| Bond | green `#39ff88` | `soc` + `emp` |
| Guard | cyan `#00e5ff` | `cau` + `intg` |
| Edge | purple `#b06fff` | `cur` + (100−`intg`) |
| Grit | orange `#ff9f2d` | `ind` + (100−`emp`) |

**The masking principle — color encodes temperament, not morality.** The three
morality-relevant axes each appear in **two** groups with **opposite signs**:

- `intg` → raises Guard, lowers Edge
- `emp` → raises Bond, lowers Grit
- `cau` → raises Nerve (inverted), raises Guard

No single hue isolates "criminal." To read integrity off the display you would have
to disentangle it from caution in Guard *and* from curiosity in Edge at the same
time, across two blended colors — not possible from the two-tone sprite. Whether a
character turns to crime is decided by hidden `intg` plus the doom-loop
circumstance (§1), neither of which the color exposes.

**Generation.** `mkPawn` rolls the **six temperament values** (the colors), then
expands them into the eight axes + condition stats. The 6→8 expansion is
underdetermined, so add small randomness in the expansion for variety. Color is
then a faithful read on disposition while staying ambiguous on outcome.

**Display — nearly free.** Each character renders **two-tone**: primary hue (top
temperament) = body, secondary (second temperament) = the accent stripe. `drawBody`
([index.html] body base + accent stripe) already does exactly this — map
primary→body, secondary→accent. The cycling `ACC` palette is replaced by these six
hues. Almost no new render code.

**Caveat (accepted).** The mapping is deterministic, so over many runs players will
learn *soft* correlations ("warm-colored ones seem to get into more fights"). This
is **suspicion without certainty** — better drama than total opacity, so it is kept
by design. Optional small per-character hue jitter can make the mapping noisier if
playtest shows it is too learnable (open question 1).

---

## 3. The four pressure systems

All deterministic. Each runs on a throttled tick pass (coarse cadence like v0.2's
`%30` blocks) and writes to Layer C.

### 3.1 Economic

- **Rent** accrues per game day on each occupied apartment. Unpaid past a grace
  window → **eviction** → character becomes homeless (no bed → `rest` and `hyg`
  tank, `stress` climbs).
- **Income** comes from working a job (legal) or crime (illegal). Wage credited on
  shift completion.
- **Expenses**: food (buy or ingredients), recreation, substances, medical.
- **Debt**: spending past zero credits is allowed into negative (loan-shark
  territory) — raises `stress`, may trigger gang `rep` interactions.

### 3.2 Crime & violence

- A character with low `credits` + low `intg` + high `imp` has a high utility
  score on **crime actions** (§8). The scorer naturally pushes desperate, low-
  integrity characters toward hustles.
- Crime resolution is a deterministic roll modified by skill, `cau`, and target.
  Outcomes: payoff, nothing, or **violence** (injury, `hp` loss) and/or
  **heat** (corp/city `rep` drops, enforcer event risk).
- **Enforcer / gang raids** reuse v0.2's `spawnRaid` machinery — escalate with
  accumulated heat.

### 3.3 Survival needs

- Needs decay as in v0.2; new needs (`hyg`, `fun`, `socN`) added.
- **Disease**: random low-probability infection, raised by low `hyg`. Untreated
  (no clinic visit / no credits) → `hp` decay → death.
- **Addiction**: substance use restores `fun`/lowers `stress` short-term but
  raises `addiction`; high `addiction` forces compulsive use and withdrawal
  `stress` spikes.

### 3.4 Mental & social

- `socN` decays; isolation (no interaction) accelerates it.
- `stress` accumulates from violence, eviction, betrayal, withdrawal, low needs.
- High `stress` + low mood → **mental break** (extends v0.2's existing dazed/break
  mechanic) — character stops working, may lash out, may self-destruct.
- **Relationships** (§7) feed mood and `socN`; betrayal (theft from, abandonment
  of) a bonded character is a major `stress` and `relations` hit to both.

---

## 4. Economy

The credit loop is the spine of the economic pressure system.

### 4.1 Jobs (legal income)

Each job is a workplace building + a workstation object + a skill. Working =
walk to the station, use it for a shift, get credited.

| Job | Building | Skill | Pay |
|-----|----------|-------|-----|
| Corp drone | Corp office | `tech` | Steady, high |
| Shop clerk | Shop | `social` | Steady, low |
| Mechanic | Garage | `bld` | Mid |
| Courier | (street) | `cur`/move | Variable |
| Ripperdoc | Clinic | `tech` | High, gated by skill |

### 4.2 Crime (illegal income)

Higher payout, risk of violence/heat, raises gang `rep`, lowers corp/city `rep`.
See §8.

### 4.3 Expenses

| Expense | Trigger | Effect if unmet |
|---------|---------|-----------------|
| Rent | Per game day | Eviction → homeless |
| Food | `food` low | Starvation if no food + no credits |
| Recreation | `fun` low | Mood/`stress` worsen |
| Substances | Addiction-driven | Withdrawal `stress` spike |
| Medical | Disease/injury | `hp` decay → death |

### 4.4 Numbers

All starting numbers are **first-pass and tunable after playtest** (same rule as
v0.2 raids — no blind balancing). Exact wages, rent, and costs are open question 2.

---

## 5. The city

### 5.1 Spatial model

Single grid, top-down (RimWorld model, confirmed). Buildings are walls + floor +
door tiles + furniture objects, all on the existing grid. No roof rendered — you
see inside every building from above. No separate interior view, no camera
transition. Characters path through doors into rooms that are part of the same
grid. **Reuses the entire existing renderer and pathing.**

### 5.2 Building & object types

**Buildings** (footprints with interior rooms):

| Building | Contains | Purpose |
|----------|----------|---------|
| Apartment | bed, stove, fridge, toilet, shower, TV | Home — sleep, cook, hygiene, fun |
| Corp office | workstations | Legal job (tech) |
| Shop | counter, shelves | Buy food/goods; clerk job |
| Garage | workbench | Mechanic job |
| Clinic | medbed | Disease/injury treatment; ripperdoc job |
| Bar | bar counter, seats | Recreation, socializing, dealing |
| Gang hideout | (varies) | Crime hub, gang `rep` interactions |

**Objects** (the `use` targets that drive actions): bed, stove, fridge, toilet,
shower, TV, exercise rig, workstation, shop counter, bar counter, medbed, dealer
spot. Each maps to a job-execution case (§6).

### 5.3 City generation

- **Fixed core** (always present, consistent placement each run): 2 apartments
  (the two starting characters' homes), 1 workplace, 1 shop, 1 clinic, connecting
  streets. This guarantees a functional starting economy.
- **Procedural surround** (random each run): additional apartments, workplaces,
  bars, gang hideouts, alleys, corp offices; random layout; scrap/resource
  scatter. Generated by an extension of the existing map-gen.
- Map size: keep `MW=56 × MH=40` or expand for a denser city — open question 5.

---

## 6. Behavior — extending the utility scorer

`scoreJobs` gains a larger action set. Each action: `base_need · personality_weight
· bias · situational_mod` (the v0.2 formula, unchanged). Hard need floors stay
above the scorer.

New / extended actions:

| Action | base_need | Dominant stat | Notes |
|--------|-----------|---------------|-------|
| eat | `clamp(80−food)` | Caution | *(existing)* — cook or buy |
| sleep | `clamp(70−rest)` | Caution | *(existing)* — needs a bed |
| hygiene | `clamp(70−hyg)` | — | shower/toilet |
| recreate | `clamp(60−fun)` | Curiosity | TV, bar, exercise |
| socialize | `clamp(60−socN)` | Sociability | seek another character |
| work | `f(credits, rent_due)` | Ambition/Industriousness | walk to job, do shift |
| crime | `f(credits_low, 100−intg, imp)` | Impulsiveness (−Integrity) | §8; gated by desperation |
| substance | `f(addiction, stress)` | Impulsiveness | restores fun, raises addiction |
| idle | `10` | inverse Industriousness | *(existing)* |

Situational modifiers extend v0.2's table: enforcer nearby suppresses crime,
night suppresses work/raises sleep, high `stress` raises substance/recreation,
homelessness raises work urgency, etc.

The doom-loop falls out of the scorer naturally: as `credits` drops and `intg` is
low, the `crime` action's `base_need` rises until it outscores `work`. No special-
case code — the weighting *is* the behavior.

---

## 7. Relationships

v2's `ST.bond` scalar expands to a **per-pair matrix** `ST.relations` (still
trivially small at 2 characters; scales to a keyed map as population churns).

Each pair holds a scalar −100..100 moved by: proximity, shared meals, shared
recreation, cooperative crime, aid during distress, **betrayal** (theft,
abandonment), and conflicting player orders. Read points (extend v0.2's bond
reads):

- **Mood** — strong positive relation + ally near → +mood; strong negative → −mood
- **Aid willingness** — high relation → move to help a distressed/downed partner
- **Crime cooperation** — high relation → characters run hustles together (higher
  payoff, shared heat)
- **Social need** — interacting with a liked character restores `socN` more

Betrayal is the key dramatic lever: a desperate low-integrity character may steal
from a bonded partner, cratering the relation and spiking both characters'
`stress` — a doom-loop accelerant and a prime Pillar 2 narration trigger.

---

## 8. Crime system

Deterministic core; Claude *proposes* in Phase F but never executes (§9).

### 8.1 Crime actions

| Crime | Skill | Target | Payoff | Risk |
|-------|-------|--------|--------|------|
| Theft | `hustle` | shop, apartment | Low–mid | Heat, violence if caught |
| Dealing | `hustle`/`social` | bar, street | Mid, recurring | Gang `rep`, enforcer heat |
| Hacking | `tech` | corp office | High | High heat if failed |
| Mugging | `sht`/`hustle` | another character | Low | Violence, relation damage |

### 8.2 Resolution

Deterministic roll: `success = base + skill·k − target_difficulty − caution_penalty`.
Outcomes branch into payoff / nothing / violence / heat. Heat accumulates to the
city/corp `rep` and feeds enforcer-raid probability (reuses `spawnRaid`).

### 8.3 Guardrail for Phase F

When the Claude layer proposes a crime (Pillar 3), the deterministic resolver
**validates feasibility and computes the outcome**. Claude supplies the *framing
and proposal*; the sim owns the *mechanics*. LLM output never directly mutates
`credits`, `hp`, or `rep`.

---

## 9. The Claude enrichment layer

### 9.1 Two-layer architecture (non-negotiable)

**Layer 0 — deterministic core.** Everything in §1–§8 runs with zero API calls.
Offline-complete, playtestable for hours at no token cost, outage-proof.

**Layer 1 — Claude enrichment.** Reads Layer 0 state asynchronously, generates
meaning. Never blocks the tick. On failure or budget overflow, **falls back to
deterministic templated text** silently.

### 9.2 The proxy

Same pattern as Chroma (:3002) and ValidateAI (:3001): **game → Azure Node.js
proxy → Claude API**. The proxy holds the key (never in the client bundle — direct
lesson from the ValidateAI plaintext-key finding). PM2-managed. The client speaks
only to the proxy.

### 9.3 Call-budget discipline

The thing that makes this affordable. A game-day is 2400 ticks ≈ 4 min real-time
at 1×; naive narration would be 10–30 calls/min. Controls:

- **Salience threshold** — only call Claude for events above a significance bar
  (a death, a betrayal, a doom-loop transition — not every meal).
- **Batching** — collect several salient events and resolve them in **one** call.
- **Hard per-minute cap** — a fixed ceiling; over it, degrade to templates.
- **Template bank** — every Claude-generated surface has a deterministic fallback
  string, so the game is never blocked or blank.

### 9.4 The five pillars, sequenced by risk

| Pillar | Function | State access | Risk | Phase |
|--------|----------|--------------|------|-------|
| 1. Personality inference | Surfaces behavior observations ("Mira hasn't taken a legal job in days") | **Read-only** | Low | D |
| 5. City-as-character | Narrates city mood from aggregate state | **Read-only** | Low | D |
| 2. Relationship memory | Compressed interaction log → contextual dialogue & requests | Read + memory store | Medium | E |
| 3. Crime engine | Proposes heists/hustles from state; player approves; **sim resolves** | Proposes only | High | F |
| 4. Reputation economy | Generates faction *reactions* to player decisions | Proposes only | High | F |

Pillars 1 and 5 ship first because they are read-only and cheap — they prove the
proxy, throttle, and fallback pipe under real conditions before any pillar is
allowed to touch mechanics. Pillars 3 and 4 ship last, behind the §8.3 guardrail.

> Note on Pillar 2 storage: "relationship memory" is **structured text logs with
> retrieval**, not embedding vectors — there is no embedding model in single-file
> vanilla JS. Correction from the initial brainstorm.

---

## 10. Build phases

Each phase independently shippable and testable. Phases A–C are pure deterministic
core (no API); D–F add the enrichment layer; G is the later survival mode.

| Phase | Scope | API? |
|-------|-------|------|
| **A** | City generation (fixed core + procedural) · building/object system · new needs (`hyg`/`fun`/`socN`) · economy core (`credits`, jobs, rent) | No |
| **B** | Four pressure systems · expanded hidden stats (Layers A–C) · doom-loop wiring (extends `drift`/`moodCalc`) | No |
| **C** | Relationship matrix (`ST.relations`) · crime system (§8 deterministic) · betrayal mechanics | No |
| **D** | Pillar 1 + Pillar 5 (read-only) · proxy + throttle + template fallback — **proves the pipe** | Yes |
| **E** | Pillar 2 (relationship memory + contextual dialogue/requests) | Yes |
| **F** | Pillars 3 + 4 (crime proposals + faction reactions) behind the §8.3 guardrail | Yes |
| **G** | *(later)* Survival mode — all-die = game over, escalating threats | No |

---

## 11. Integration points in `index.html`

Designs only — none written yet. Referenced by function name (line numbers will be
mapped at implementation time).

| # | Site | Change |
|---|------|--------|
| 1 | `mkPawn` | Roll six temperament values → expand to Layer A axes (§2.5); add Layer B needs; add Layer C (`credits`, `stress`, `addiction`, `rep`, `relations`, new skills); set two-tone body/accent from temperament |
| 2 | `newGame` | Generate city (fixed core + procedural); spawn 2 characters (seeded or rolled — open Q1); init economy + factions + `ST.relations`; replace `ACC` cycling with temperament hues |
| 3 | `scoreJobs` | Add action set from §6 (hygiene, recreate, socialize, work, crime, substance) |
| 4 | `pawnTick` switch | Add job-execution cases for each new action (use bed/stove/shower/TV/workstation/counter/etc.) |
| 5 | `DEF` table | New building + object definitions (§5.2) |
| 6 | Map-gen | Fixed-core placement + procedural district generation (§5.3) |
| 7 | `tick` master | New throttled passes: rent/eviction, need decay, stress, addiction, disease, heat→raid |
| 8 | `drift` | Doom-loop personality shifts (trauma, addiction, success) |
| 9 | `moodCalc` | Extend with new needs, `stress`, relationship terms |
| 10 | `damagePawn`/`killPawn` | Death → repopulation hook; trauma/relation hits |
| 11 | Repopulation | Extend the existing wanderer-arrival event for churn |
| 12 | Requests panel | New request kinds tied to pressures (rent, crime, relationship, faction) |
| 13 | **New API module** | Proxy client, salience filter, batcher, per-minute cap, template bank, the 5 pillar callsites |
| 14 | `renderInspect` | (Debug only) hidden-stat readout for development; player-facing inference comes from Pillar 1 |
| 15 | `test/smoke.js` | New tests: economy loop, pressure decay, doom-loop transition, crime resolution, fallback-when-API-down |

---

## 12. Open questions

> To be owner-resolved before each phase, RimWorld/v0.2 style (locked decisions in
> §13; these are the proposals you can override).

1. **Starting character profiles.** Generation mechanism **resolved** — `mkPawn`
   rolls the six temperament values and expands to the eight axes + condition
   (§2.5). Remaining sub-question: are the two **fixed starters** hand-seeded for
   deliberate contrast (one Edge/Nerve-leaning who slides toward crime, one
   Guard/Drive-leaning who grinds legal work) or rolled like every other resident?
   And: per-character hue jitter on or off at launch?
2. **Economy numbers.** Rent amount, job wages, crime payouts, food/medical/
   substance costs. First-pass values, tuned after playtest.
3. **Recreation & substances.** Which substances exist, addiction curve shape,
   what "fun" sources are available.
4. **Faction list.** Confirm `{corp, gang, neighbors, city}` — add/remove any?
5. **Map size.** Keep `56×40` or expand for a denser city? Affects pathing budget.
6. **Crime resolution authority.** Phase C resolves crime deterministically. In
   Phase F, does Claude only *propose* (recommended, §8.3) or also influence odds?
7. **Save/load.** Roadmap item — persist the full stat model, economy, relations,
   factions, city layout, pending requests. Confirm scope.
8. **Fog of war.** Keep `ST.fog` (characters reveal as they move — fits "watch the
   city wake up") or remove it for a fully-visible city? Or repurpose as "districts
   you haven't influenced yet"?
9. **Population ceiling.** Churn implies growth — cap the live population (perf) and
   at what number?
10. **Player verbs.** Confirm the full order set beyond v0.2's bias nudges — can the
    player designate jobs, forbid crime, assign apartments, set curfews?

---

## 13. Decisions (locked)

Owner-resolved during the v0.3 design session. Final for v0.3 implementation.

1. **Codebase.** Evolve the existing `index.html`. Single-file vanilla JS, no
   build step. Phase 1–4 systems are reused as the behavioral substrate (§0).
2. **City.** Procedural with a **fixed functional core** (2 apartments, workplace,
   shop, clinic, streets); everything else random each run.
3. **Characters.** Start with **two**; comprehensive **hidden** stat model (§2);
   autonomous; player influences **indirectly** (orders + zoning), never direct
   movement of undrafted characters.
4. **Mode.** Sandbox — **no win/lose** — but with constant systemic pressure (not a
   goalless screensaver). Survival mode is a later add (Phase G).
5. **Pressure.** **All four** systems — economic, crime/violence, survival needs,
   mental/social — interlocking into the **doom-loop** (§1) as the story engine.
6. **Behavior.** **Needs-and-stats-driven autonomy** (Sims-style) on the existing
   utility scorer. **No rigid player-set work schedules** (not RimWorld-style).
7. **Spatial model.** Single grid, **top-down RimWorld interiors** — see inside
   every building, no separate interior view, reuses the renderer and pathing.
8. **Death & churn.** Pressures can kill. On death, the city **repopulates** via
   new arrivals — endless churn; the city persists, individuals don't.
9. **Architecture.** **Two-layer**: deterministic core (Layer 0) runs the whole
   game with zero API calls; Claude enrichment (Layer 1) is async, throttled, and
   **falls back to templates** on failure/budget overflow. API never on the
   critical path.
10. **Proxy.** **Azure Node.js proxy** (same pattern as Chroma/ValidateAI); key
    lives on the proxy, **never in the client bundle**.
11. **AI pillars.** **All five**, sequenced by risk: read-only Pillars 1 & 5
    first (prove the pipe), then Pillar 2, then mechanics-touching Pillars 3 & 4
    behind the propose-don't-execute guardrail (§8.3).
12. **Budget discipline.** Salience threshold + batching + hard per-minute cap +
    deterministic template bank for every Claude-generated surface.
13. **Temperament color layer (§2.5).** Characters are generated by rolling **six
    temperament values** (the colors: Drive/Nerve/Bond/Guard/Edge/Grit) and
    expanding to the eight hidden axes + condition. Displayed **two-tone** via the
    existing `drawBody` (primary hue = body, secondary = accent stripe), replacing
    the cycling `ACC` palette. Morality-relevant axes (`intg`, `emp`, `cau`) are
    **split across two color groups with opposite signs** so no single hue exposes
    criminal-vs-saint. Color = temperament, never morality. Deterministic mapping
    (soft-learnable) is accepted as *suspicion without certainty*; optional hue
    jitter held in reserve.
