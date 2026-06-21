# NEON SPRAWL — Stat-Gated Dialogue (Authored)
### Design Specification v1

Player↔wisp conversations: authored, choice-based, no AI required. Your operative's six attributes gate which response options you can pick; `opsCheck` resolves the risky ones. Conversations reveal character AND have mechanical payoffs (allegiance, intel, recruitment). The path to building your cell runs through talking.

**Core principle:** this fuses the three zoom levels of the end-goal vision — the operative's RPG attributes (Personal) gate social moves (City) that advance the insurrection (the clandestine-influence verb). It reuses `opsCheck` (built for exactly this) and ties into existing allegiance/intel/recruitment rather than being a standalone toy. Fully buildable now; the AI free-form TALK layer (currently blocked on `AI_PROXY`) can slot into the same framework later.

---

## 1. The Eight Locked Decisions

1. **Purpose:** BOTH character depth AND mechanical payoff. A conversation reveals who a wisp is (grievances, loyalties, personality) and moves allegiance/intel/recruitment.
2. **Gating presentation:** locked options show **grayed-out with their requirement** — `[BOND 6+] "..."` — so the player sees the doors their build hasn't opened. Rewards build investment; creates replay pull.
3. **Structure:** MIXED — most conversations are short (one screen, 2-4 choices, a result); key figures (leads, the Mayor, recruitment targets) get deeper **branching trees**.
4. **Failure of a risky choice:** SCALED — minor/flavor topics are safe (always resolve); high-value pushes (recruit, extract intel, plant ideas) carry real failure risk via `opsCheck`, and failing HURTS.
5. **Recruitment link:** TALK IS THE PATH — build a wisp's allegiance through conversation until recruitment unlocks. Dialogue is the front door to the cell.
6–8. (Folded into the above: attributes gate options; opsCheck resolves; consequences ripple into existing systems.)

---

## 2. How a Conversation Works

1. **Entry:** select a wisp → a **TALK** action (the authored one — distinct from the AI `◆ TALK` button, which stays gated on `aiReady()`). Available on any non-child, non-envoy wisp in range.
2. **A conversation opens** — a panel with:
   - The wisp's current line (authored, varies by their state: allegiance, mood, whether recruited, grievances).
   - A set of **response choices**, each tagged by type and gate.
3. **Choices come in flavors:**
   - **Free** — always available, safe. Flavor, rapport, learning who they are. Small allegiance nudges.
   - **Stat-gated** — only pickable if your attribute meets the bar (e.g. `[BOND 6+]`, `[EDGE 7+]`). Shown grayed-out with the requirement if you don't meet it.
   - **Risky** — fires `opsCheck(attr, difficulty)`; the banded outcome decides the result. High-value (recruit/intel/plant). Failure hurts (scaled).
4. **Resolution** — the choice applies its effect (allegiance shift, intel gain, idea planted, rapport, or backfire), the wisp responds, and the conversation either continues (tree) or ends (short).

---

## 3. The Six Attributes as Conversational Levers

Each operative attribute unlocks a *style* of talking (mapped to the existing `ops` stats — drive/nerve/bond/guard/edge/grit, or whatever the canonical 6 are):

| Attribute | Conversational lever | Example gated option |
|---|---|---|
| **Bond** (social/empathy) | Warmth, rapport, persuasion | `[BOND 6+] "I understand what they took from you."` |
| **Edge** (cunning/intimidation) | Pressure, threats, manipulation | `[EDGE 7+] "You really think the regime protects people like you?"` |
| **Nerve** (boldness) | Direct asks, provocations | `[NERVE 6+] "Join us. Say yes right now."` |
| **Drive** (ambition/conviction) | Inspiring, ideological appeals | `[DRIVE 7+] "Imagine the block free of them."` |
| **Guard** (caution/read) | Reading them, careful probing | `[GUARD 6+] "I can tell you're holding something back."` |
| **Grit** (resolve) | Steadfast, no-flinch lines | `[GRIT 7+] "I've buried friends for this. I'm not afraid."` |

(Final attribute→lever mapping to be confirmed against the canonical 6 names in code at build time. The principle: each stat opens a different *kind* of line, so different builds talk differently.)

Beyond the 6 attributes, options can also gate on: **reputation/legend** (a feared operative unlocks intimidation but loses warmth — ties to the existing `radicalPotential`/legend), **allegiance** (some lines only open once a wisp warms to you), and **intel** (knowing their secret unlocks a pointed line).

---

## 4. Conversation Outcomes (the mechanical payoffs)

A choice can do any of:
- **Shift allegiance** — `+/-` to `p.allegiance` (the recruitment currency). Free choices: small. Risky successes: larger.
- **Extract intel** — `+m.intel`, or reveal the wisp's secret/dossier (ties to surveil/routine).
- **Plant an idea** — a flag that makes future conversations or events land harder (a slow-burn radicalization).
- **Build rapport** — a relationship/`relAdj` bump that opens more options next time.
- **Backfire** (on failure) — anger the wisp (`relAdj -`, emote), raise the regime's suspicion (exposure/awareness), or cost allegiance. Scaled to the stakes of the choice.

**Recruitment path:** once a wisp's allegiance crosses the recruitment threshold (currently `>15` for sympathizers; recruitment uses `radicalPotential`), a **"Recruit"** option appears *in the conversation* — talk has led them to the edge, now you make the ask. This makes dialogue the front door to `recruitWisp`.

---

## 5. Authored Content Structure

- **Short conversations (most wisps):** a small authored set keyed to the wisp's archetype + state. A few opening lines, 2-4 choices, outcomes. Varied enough to not feel identical across wisps.
- **Deep trees (key figures):** the Mayor, faction leads, high-value recruits get multi-node branching trees — choices fork to different follow-up nodes, building toward a payoff (recruitment, a reveal, an alliance, or a betrayal).
- **State-driven lines:** the same wisp says different things based on allegiance (hostile → wary → warm), mood, whether they've witnessed your brutality (ties to the witness-fear system — a terrified wisp won't open up), and whether they're already recruited.

Content lives in a **data structure** (a dialogue table keyed by node), separate from the engine — so adding conversations later (or swapping in AI-generated nodes) doesn't touch the engine.

---

## 6. Reusing Existing Systems (grounded — all verified present)

- **`opsCheck(attr, difficulty)`** (line 3960) — the banded stat-check, BUILT for this ("will gate dialogue checks later"). Returns critwin/success/partial/fail/critfail.
- **The 6 operative attributes** — the `ops` stats (`ops(avatar, attr)`), already drive ops/recruitment.
- **`allegiance`** — the recruitment currency; dialogue shifts it.
- **`recruitWisp(p)`** (line 1675) + **`radicalPotential(p)`** — the recruitment machinery the talk-path feeds into.
- **`relAdj`** — relationship adjustments for rapport/anger.
- **Witness-fear** (`witnessFear`) — a frightened wisp resists conversation (ties the systems together).
- **The inspect/selection UI + panel patterns** (renderEnvoyPanel, renderEventPanel) — the model for the conversation panel.

---

## 7. Build Order (staged, each validated)

1. **The conversation engine** — open/advance/resolve a conversation from a data structure; the panel UI; the TALK entry action.
2. **Stat-gating** — options gate on attributes; locked options render grayed with their requirement.
3. **`opsCheck` resolution** — risky choices roll; banded outcomes apply; scaled failure consequences.
4. **The payoffs** — wire allegiance/intel/rapport/plant/backfire into existing systems.
5. **The recruitment path** — the in-conversation Recruit option once allegiance crosses the threshold.
6. **Authored content** — short conversations for common archetypes + at least one deep tree (the Mayor or a key lead). Tunable/expandable.

Each stage validated headless (engine logic, gating, opsCheck integration, payoffs) before the next. The VISIBLE parts (the panel, grayed options) need in-browser confirmation.

---

## 8. Deferred / Future (not blocking)

- **AI free-form TALK** — the existing `◆ TALK` (gated on `AI_PROXY`). When the proxy's hosted, AI-generated lines can slot into the same conversation framework as an alternative node type. The authored system is designed to make this addition clean.
- **Exact attribute→lever mapping** — confirm against the canonical 6 names at build time.
- **Content volume** — v1 ships a solid core set; conversations are data, so the library grows over time.
- **Tuning** — opsCheck difficulties, allegiance shift magnitudes, the recruitment threshold — all first-draft, tuned in play.
