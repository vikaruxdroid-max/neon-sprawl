# NEON SPRAWL — Master Spec · The Brain: GM, Story Grammar & System-of-Record

**Status:** design contract for the narrative/AI layer. Companion to `CLAUDE.md`, not a replacement.
**Scope:** the *new* layer — the Game-Master (Director), the d20 resolution formalization, the
effect/scope model, the conversation + side-quest model, and the story grammar/compiler. Binds to the
existing deterministic engine catalogued in `CLAUDE.md`; references it rather than duplicating it.
**Sequencing:** this is **city-completion work**, inside the locked "finish the single city before any
world layer" contract. Nothing here touches the world/4X layer.

---

## 0. How to use this document

This is three things at once, by design:

1. **The grammar** — the controlled vocabulary every story compiles against (stats, objective verbs,
   effects, scopes, city-deltas, NPC primitives). Define it once; every story binds to it forever.
2. **The system-of-record** — the single place that says how the systems connect, so when an
   interaction breaks, a plot hole appears, or an outcome surprises us, we diagnose *against this doc*
   instead of guessing.
3. **The story template** — the fill-in beat-sheet (§11) you write stories into.

When a story or feature needs something this grammar doesn't have, **add the primitive here once**,
then everything downstream can use it. That is the revision mechanism: gaps surface → grammar grows →
all future content benefits.

---

## 1. The architecture in one picture

```
        ┌─────────────────────────────────────────────────────────────┐
        │   PLAYER  — controls exactly one thing: the avatar's actions  │
        └───────────────┬─────────────────────────────────────────────┘
                        │ chooses from generated options
                        ▼
   ┌────────────────────────────────────┐        reads digest        ┌────────────────────────┐
   │  DETERMINISTIC ENGINE  (CANON)      │ ─────────────────────────▶ │  GM / DIRECTOR (LLM)   │
   │  the city that already exists       │                            │  the fiction           │
   │  - utility AI, social sim, gangs    │ ◀───────────────────────── │  - frames situations   │
   │  - economy, security, events        │   structured directives    │  - voices NPCs         │
   │  - opsCheck resolution (the dice)   │   (sanctioned only)        │  - narrates outcomes   │
   │  - items → effects → city-deltas    │                            │  - sequences events    │
   │  OWNS all state. OWNS the dice.      │                            │  NEVER touches dice.   │
   └────────────────────────────────────┘                            │  NEVER fabricates canon│
                                                                      └────────────────────────┘
```

### The three laws (every design decision derives from these)

1. **The engine is canon.** Only the deterministic engine holds truth. The GM cannot make a thing true
   by saying it, and cannot retcon what already happened.
2. **The GM directs through the engine, never around it.** It can fire *sanctioned* events, escalate,
   complicate, voice anyone, thread a story. It cannot invent new physics, mint items/effects that
   aren't in this grammar, or decide outcomes the dice should decide.
3. **The player owns the avatar; nothing else.** The avatar's actions are the one input the GM never
   authors. The avatar affects the otherwise-untouchable city **only through items and actions** — so
   items are the entire causal bridge between player agency and the world (see §6–7).

---

## 2. The deterministic engine = canon (the brain that already exists)

The "living city brain" Carlo wants is **mostly already built.** The master doc's job is to catalog the
*hooks* the new layer binds to, not re-document them. Full detail lives in `CLAUDE.md`. The substrate
the GM/story layer sits on top of:

| System | Existing hook(s) | Role for the new layer |
|---|---|---|
| Op resolution | `opsCheck(stat, diff+expPenalty+wit.pen+fearPen)` ~L2665 | **The dice.** d20 formalization plugs in here (§4). |
| NPC emotion | `emotionalReact(p,kind,intensity,opts)` ~L8627 (14 profiles, 24 sites); `onlookersReact`; `animaColor` | GM narration *reads* these; never overrides. |
| Political lean | `politicalTint(p)`; `alleg`, `radicalPotential` | Faction-grip city-delta target. |
| Crowds | `formCrowd(mode,...)`, `gatherDriver`, `reactWaveTick` | Sanctioned event effect (protest/mourn/gawk/scatter). |
| Security/infra | `securityTick`, `secRadius`; infrastructure reuses these verbatim | District-scope security delta. |
| Exposure | scoped via `resolveMod()` (only chokepoint precedent) | Failure-writes-exposure (fail-forward). |
| HQ | `ST.hq`, `HQ_STATIONS` (planning/workbench/survhub/serverroom/saferoom), `claimHQ()`, `buildStation()`, `hasStation()`, `hqUnlocks(cap)` | Passive-tier items (§7); capability gates. |
| Economy | vendor sales, upkeep (`ST.lastUpkeep`), furniture/stores | Economic city-delta targets (prices/income). |
| 4 NPC pillars | Work & Ambition · Ownership & Wealth · Relationships (gossip/cliques/partnerships) · Crime & gangs | The social truth the GM voices and quests perturb. |
| Save | `serializeState` ~L12410 / `applyState` | Narrative state folds in here (§13). |

> **Invariant:** before building any "new" system, grep the code first. CLAUDE.md documents a prior
> ~170-line duplication caused by a stale roadmap. This doc is not exempt — verify against `git log` and
> `index.html`, not memory.

---

## 3. Cost, hosting & degradation (settled: single-user)

- **Audience: you only** (personal + business-relax). No public LLM exposure, no financial-DoS surface.
- **Key path:** the Anthropic key lives behind a **VPS proxy** (pattern already proven: Chroma :3002,
  ValidateAI :3001). The single-file client never holds the key.
- **Public Pages deploy** stays playable on the **deterministic floor**; the full GM only activates when
  *you* play against your proxy.
- **Degradation is mandatory:** no key / offline / rate-limited → the game runs fully on the engine,
  just quieter and unvoiced. The LLM is enhancement, never a dependency.
- **Cost levers:** beat **cadence** (event-driven, §8) × **digest** size. Local-scope effects never call
  the LLM at all (§6). Keep both lean; single-user cost is negligible.

---

## 4. Resolution: the d20 chassis (engine owns the dice)

We adopt the **d20 resolution mechanic** — proven, and either uncopyrightable game-mechanics or covered
by the **D&D SRD under CC BY 4.0** (attribution-only; SRD 5.1/5.2 both CC BY 4.0, irrevocable). We do
**not** adopt D&D content — no ability names, classes, monsters, or setting. Our flavor is cyberpunk.

**This is a formalization of `opsCheck`, not a new system.** `op.stat` → the gating attribute;
`op.diff` → the base DC; the existing penalty terms (exposure/witness/fear) → DC modifiers.

### Division of labor (non-negotiable)
- **Engine owns the math:** rolls, DC tables, attribute modifiers, success degree. Fair, consistent,
  free, replayable. *A GM that fudges rolls isn't running a game; an LLM that decides its own outcomes
  is incoherent and a token sink.*
- **GM owns the fiction:** frames the situation, generates the player's options, voices the NPC, and
  **narrates what the roll produced.** It never touches the dice.

### Degrees of success (not binary) + fail-forward
Resolution returns one of: `CRIT_FAIL · FAIL · PARTIAL · SUCCESS · CRIT_SUCCESS`.
**Failure writes a city-delta too** — a blown break-in doesn't merely stop you; it raises district alert,
flags the avatar, may seed a manhunt thread. Tension lives in graduated, consequential failure.

> `opsCheck` extension TODO: return a degree enum + the roll breakdown (for optional surfacing), instead
> of a bare pass/fail. Verify current return shape in `index.html` before editing.

---

## 5. Operative Attributes & stat-mapping (FIRST DRAFT — needs Carlo's sign-off)

The six attributes (from the character creator): **Guile · Insight · Nerve · Presence · Tradecraft ·
Resolve**. We keep these and run them through d20 math — we do **not** import D&D's six.

First-draft check → attribute mapping (the queued decision; revise freely):

| Check / action | Primary | Notes |
|---|---|---|
| Stealth, covert movement | Tradecraft | |
| Lockpick / break-in | Tradecraft | |
| Hack (hands-on: bug, tap, breach) | Tradecraft | analysis-flavored hacks may use Insight |
| Plant device / sabotage | Tradecraft | |
| Surveil / tail / spot a tail | Tradecraft + Insight | act vs read |
| Deceive, con, disguise, lie | Guile | |
| Frame / plant evidence | Guile (+ Tradecraft) | construct vs plant = two checks |
| Read a person / detect lie / deduce | Insight | |
| Intimidate / hold composure exposed | Nerve | |
| Bluff under pressure | Nerve | |
| Persuade / recruit / rally | Presence | |
| Command, leadership, reputation plays | Presence | |
| Resist interrogation / endure setbacks | Resolve | already wired: `resolveMod` |
| Recover from exposure | Resolve | `resolveMod` precedent |

**Compound actions take multiple checks** (e.g., *frame* = Guile to construct + Tradecraft to plant).
The degree of each feeds the fail-forward consequences.

---

## 6. The effect/scope model (the spine)

**Rule: every item and action has a defined effect at a defined SCOPE.** "No dead items" doesn't mean
"everything shakes the whole city" — most things are local. Three tiers:

| Scope | Blast radius | Wakes the GM? | Examples |
|---|---|---|---|
| **LOCAL** | one NPC / interaction / room | No (engine-only, free) | a bribe lands, an NPC's mood/relationship shifts, a single overdose |
| **DISTRICT** | a block/zone | Maybe (threshold) | alert level rises, faction grip tips, prices move, a turf shift |
| **CITY** | global | Yes (rare, earns a beat) | a regime crackdown, a market crash, a faction toppled |

Scope is also the **cost lever**: local effects stay inside the engine and never call the LLM; only
district/city effects bubble up to *potentially* trigger a Director beat. Bigger blast radius → more
likely the GM speaks. Ties directly to event-driven cadence (§8).

### City-delta vocabulary (the legal effects, bound to existing hooks)
`security` (`securityTick`/`secRadius`) · `alert/exposure` (`resolveMod`-scoped) · `faction_grip`
(`alleg`/`radicalPotential`) · `economy` (prices/income/upkeep) · `mood` (`emotionalReact`/`animaColor`)
· `relationship/gossip` (social sim) · `population/health` (e.g., overdose, injury).
**New stories may only write deltas from this list.** Need a new one → add it here once.

---

## 7. Items: two tiers, no dead items

- **Active / consumable GEAR** — you *use* it to perform an action that writes a city-delta. Lockpick →
  break-in → district security drops. Bug → intel feed. Bribe credits → NPC disposition shift. Boosts
  ops via the `op.diff` term (the one clean chokepoint).
- **Passive / installed INFRASTRUCTURE** — the **HQ stations**. Capability/state by *ownership*, read
  through `hasStation()`/`hqUnlocks()`. Workbench gates gear; Server Room gates hack; etc.

**The 4 pillars** (existing): `spy · defend · monitor · hack`. Every item declares a pillar, an effect,
and a scope. **Hard rule: no item ships without a defined city-delta.** Decorative items are forbidden.

> First build task of this phase: **audit the existing item set** against this rule — map each to its
> effect + scope, flag any dead ones.

---

## 8. The GM / Director layer

**Authority boundary (restate of the three laws, operationally):** the GM *directs the deck the engine
can deal* — it does not print new cards. It can: select/sequence sanctioned events, escalate, voice any
NPC, narrate roll outcomes, thread stories. It cannot: roll dice, set its own outcomes, fabricate
canon, or mint items/effects/deltas outside this grammar.

### Timing (settled)
Real-time sim. **The sim pauses into a turn during conversations**; ambient beats apply asynchronously
without pausing. The turn boundary is a *feature* — "the city reacting," not "the API being slow."

### Cadence: event-driven (settled)
The GM speaks unprompted only when a sim event crosses a **significance threshold** (a body drops, a
faction tips, an op gets made) — i.e., district/city scope. Narration always means something; cost
tracks drama, not the clock. Threshold sensitivity = tunable.

### The state digest (contract; build-time detail)
The GM call is **one beat over a compressed snapshot**, strict JSON in/out:
```
IN  : { time, district_tensions, recent_player_ops[], key_npcs[{state,rels,memory_digest}], avatar_status, active_story_state }
OUT : { atmosphere, ambient_events[](sanctioned ids only), npc_lines[], directives[](legal only) }
```
The engine parses OUT and applies **only** what's legal. Keep the digest lean (cost + coherence).

---

## 9. Conversations (the core loop of a spy game)

- **Generated choice menu, not free text** (settled — keeps the LLM in control, unjailbreakable). Each
  turn the GM builds a small option set from the avatar's stats, history, and active storylines; the
  player picks; the GM voices the NPC reply; the engine resolves the outcome.
- **Outcomes are owned by the engine**, via the shipped stat-gated dialogue layer (`opsCheck`-fed,
  committed `bcf397f`). The GM may *propose* an outcome; the engine validates it against stats + the
  roll and is final.
- NPC lines are conditioned on **stats + prior interactions + world/other storylines** — "as real as
  possible," never trivial filler.
- Conversations that matter **spawn side quests** (§10).

---

## 10. Stories & side quests

### One intermediate representation, three sources
All three produce the **same beat-sheet** (§11), which compiles (§12) to a runnable quest:

1. **Authored** — Carlo's hand-written beat-sheets. Fixed canon beats; the GM voices/paces but cannot
   deviate. Branching; introduced slowly for quality. **These take priority** over procedural filler
   when their triggers match.
2. **Procedural soft-arc** — GM-generated from the sanctioned event/objective library; fills the space
   so the city always has something developing. (Matches CLAUDE.md's "procedural for texture.")
3. **Player-directed (CAPSTONE — deferred to post-production tuning)** — player declares intent ("take
   out a drug dealer, sabotage a power plant"); an LLM planner decomposes it into sanctioned objectives,
   casts NPCs/locations from the live city, and emits the same beat-sheet. A *front-end swap*, free if
   the grammar stays clean and machine-emittable.

### Side quest = a chain of sanctioned objectives
Objective verbs (the controlled set; extend via the co-evolution loop):
`GO · OBSERVE · PLANT · EXTRACT · SABOTAGE · RECRUIT · ELIMINATE · PROTECT · DELIVER · FRAME`.
Each objective consumes **real items** and writes a **real city-delta at a declared scope** (often
LOCAL — quests and interactions need not touch the whole city). Quest state is **tracked in save**.

### End-state: soft arcs (settled)
A storyline resolves (topple a faction, get extracted, get caught) — but finishing one **opens the
next** rather than ending the game. The GM threads toward a destination without a hard game-over.

---

## 11. STORY BEAT-SHEET TEMPLATE (semi-structured — write into this)

Prose for beats/dialogue/flavor (the GM voices these); the **load-bearing pieces are tagged** in the
controlled vocabulary so the compile is deterministic. Copy this block per story.

```yaml
story_id: <unique_snake_case>
title: <name>
source: authored            # authored | procedural | player_directed
priority: spine | texture

trigger:                    # conditions that surface this story
  reputation: <op>          # e.g. ">=2 in district X"
  district_state: <...>     # alert/grip/economy thresholds
  background: <char bg?>    # optional gate on the operative's Background
  time: <window?>

cast:                       # required NPCs/locations (engine must have or spawn)
  npcs: [ <role_or_named> ]
  locations: [ <zone/room> ]

beats:
  - id: b1
    lock: canon | gm_fill   # canon = GM hits it as written; gm_fill = GM improvises the glue
    prose: |
      <what happens / scene direction / sample dialogue intent>
    objective:              # the mechanical action (omit for pure-narrative beats)
      verb: PLANT           # from the objective set
      item: <gear_id>       # must exist (or be added to grammar)
      check: { attr: Tradecraft, dc: <n> }
      on:                   # fail-forward: every outcome writes something
        CRIT_SUCCESS: { delta: <type>, scope: LOCAL|DISTRICT|CITY, value: <...> }
        SUCCESS:      { delta: ..., scope: ... }
        PARTIAL:      { delta: ..., scope: ... }
        FAIL:         { delta: alert, scope: DISTRICT, value: +1 }
        CRIT_FAIL:    { delta: ..., scope: ..., spawn_thread: manhunt }

branches:                   # where choices/outcomes fork
  - at: b<n>
    on: <choice_or_degree>
    goto: b<m> | ending:<id>

endings:
  - id: <id>
    prose: |
      <authored ending for this fork>
    world_delta: { ... }    # what persists after resolution
    opens: <next_story_id?> # soft-arc handoff
```

**Compiler contract:** any `item`, `verb`, `delta`, `attr`, or `location` not in this grammar is a
**hard error at compile** — reported, never silently dropped. That report is your signal to add the
primitive to the grammar once.

---

## 12. The compiler (translation engine) — LOWER PRIORITY

Carlo's call: build it for *polish/ease later*; it is **not** what makes the game good. The game is
alive without it (a story can be hand-wired). Three jobs:

1. **Validate** — every referenced primitive exists; scopes consistent; rough balance sane (no
   impossible DC stacks, no reward/risk mismatch). *(This is what Carlo meant by "optimization.")*
2. **Bind** — resolve narrative tags → live engine objects; emit a runnable, wired quest.
3. **Assist (optional)** — an LLM pre-pass that turns looser prose into the tagged form and proposes
   grammar additions for gaps. Authoring-time only; never runtime.

**Co-evolution loop:** stories surface gaps → gaps added to this grammar once → all future stories
benefit. That is the "work once, then revise" leverage.

> **De-risk order (do NOT build the compiler against an unproven grammar):**
> (1) write this spec → (2) hand-wire ONE story against it (also = your first authored story) →
> (3) only then build the compiler to automate the proven process.

---

## 13. Persistence (settled: persist; fallback = fresh random opening)

Narrative state folds into the existing save (`serializeState`/`applyState`): the situation summary,
per-NPC `memory_digest`, reputation, active story/quest state. **Load a save → resume the story; no
save → the randomized, character-aware authored opening.** Both coexist; no either/or.
Keep the saved narrative blob compact (a digest, not a transcript).

---

## 14. AUTO mode (settled: simple)

AUTO = the avatar runs the **same deterministic daily-life utility AI as any wisp** (work/move/idle).
A relaxing "watch a day in the city" mode. **Zero LLM, zero ops.** All engaging, GM-driven strategy is
**user-driven only.** (This *reverses* the retired "autonomous insurrection on AUTO" goal; recoverable
later only as a separate optional spectate mode, never as default AUTO.)

---

## 15. Invariants & troubleshooting (the system-of-record in action)

When something breaks, check the violated invariant — diagnose against this list, don't guess:

1. **Canon integrity** — did the GM assert/imply state the engine doesn't hold? (Law 1 violation.)
2. **Dice ownership** — did an outcome come from the LLM instead of `opsCheck`? (Law 2.)
3. **Grammar closure** — does the failing content reference an item/verb/delta/attr NOT in this doc?
   (Then the grammar has a gap — add it, don't patch the story.)
4. **Scope consistency** — is a LOCAL effect rippling city-wide, or a CITY effect failing to wake the
   GM? (§6 mis-tag.)
5. **Fail-forward completeness** — does any objective outcome write *nothing*? (Every degree must write
   a delta; a "nothing happens" failure is the bug.)
6. **Degradation** — does the feature hard-depend on the LLM? (It must survive key-absent.)
7. **Save round-trip** — does narrative/quest state survive serialize→apply? (Transient fields nulled,
   live refs re-linked — same discipline as `ST.hq`.)

---

## 16. Build order (de-risked)

1. **This spec** — the grammar + system-of-record (this document). ← *current step*
2. **Item audit** (§7) — map existing items to effect+scope; flag dead items.
3. **Stat-mapping sign-off** (§5) — confirm/revise the first-draft table.
4. **Wire the GM layer** onto the existing brain — digest, proxy call, sanctioned-event application,
   conversation menu, `opsCheck` degree-of-success extension.
5. **Hand-author ONE story** against §11 — proves the grammar is complete and usable.
6. **The compiler** (§12) — automate the proven authoring process. *Lower priority.*
7. **Player-directed generation** (§10.3) — capstone, after production tuning.

---

## 17. Open items

- [ ] **Stat-mapping** (§5) — first draft; needs Carlo's confirmation/edits.
- [ ] **`opsCheck` return shape** — verify in `index.html` before extending to degrees-of-success (§4).
- [ ] **Code hooks marked "verify"** — confirm exact signatures against `index.html`, not memory.
- [ ] **Spec-triage consolidation** — fold the parked loose `.md` specs (Espionage Economy + Audit,
      Base of Operations, Living City Audit) into `docs/`; this master spec is their umbrella. Delete
      duplicates, commit the rest.
- [ ] **Significance-threshold values** (§8) — set + tune from play.
```
