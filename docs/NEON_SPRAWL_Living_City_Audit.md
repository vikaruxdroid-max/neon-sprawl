# NEON SPRAWL — Living-City Systems Audit
### Build `93a7e65e` · a start-to-finish review of the wisp/city aliveness layer

A deep review (the kind done for the "brains" / directorTick audit) of the existing wisp and city systems, to ground the Living City spec in what's *actually* there before building on top. **Headline finding: most of the proposed Living City already exists as a system called "Wave C."** The genuine gaps are narrow and specific. This is the same pattern as the roadmap audit — the spec's instinct was right, but a lot of it is already built.

---

## What ALREADY EXISTS (and is deep)

### The emote/expression vocabulary — COMPLETE
21+ distinct emotes (`EMOTES`, line 8578): heart, love, music, happy, party, sweat, shock, anger, cry, sleepy, scheme, evil, smug, greed, idea, gross, dizzy, ghost, etc. A rich, characterful palette. Rendered via `drawEmotes`/`tickEmotes`, triggered via `tryEmote`/`emote`. **65 emote-trigger call sites** across the codebase — the city is already emoting constantly from life events.

### `emotionalReact` — "WAVE C: EMOTIONAL REACTIVITY" — LARGELY IS LAYER A+B
This is the big finding. A code comment already states the exact philosophy of the Living City spec: *"A single place that makes a wisp's feelings VISIBLE and proportional to what just happened... Interactions used to change stats silently; now they read on the wisp's face."*

`emotionalReact(p, kind, intensity, opts)` (line ~8627) has **14 emotional profiles** — joy, delight, amused, connected, inspired, proud, anger, fear, distress, disgust, shame, grief, betrayed, unsettled, relief — each mapping to: an emote + a mood delta + a stress delta + (strong moments) a lasting memory + (if AI enabled) a spoken reaction + relationship coloring + a float. **24 reactivity call sites.** This is a sophisticated, complete per-wisp reactivity system. It already does most of what Layer A ("surface inner life") and the per-wisp half of Layer B intended.

### `onlookersReact` — THE COLLECTIVE-RIPPLE PRIMITIVE ALREADY EXISTS
`onlookersReact(x, y, kind, radius)` (line 8618) makes nearby wisps emote in response to an event. **Already fires on:** fights, snapping, robberies, paybacks, disasters, grid failures. This IS Layer B's "ripple" — wisps near a dramatic event already visibly react. (What it lacks: staggered *outward-wave* timing — see gaps.)

### `animaColor` — MOOD/STRESS IS ALREADY VISUALLY ENCODED
`animaColor(p)` (line 8493): every wisp's color is **already derived from mood + stress** — calm blue-cyan when content and low-stress, shifting through to red as stress climbs, brightness scaled by mood. So a core piece of Layer A ("a wisp's emotional state, readable at a glance") **already ships** — the crowd is already color-coded by feeling. An attentive player can already read the city's emotional temperature in the wisp colors.

### The social/relationship simulation — DEEP
gossip (opinions spread by proximity), partnerships (form between compatible close pawns), cliques (`rebuildCliques`/`cliqueTick`/clique petitions), typed bonds, mentorship, fights with friends taking sides, `relAdjAll` (a wronged act shifts the whole block's opinion). All live.

### Political state per wisp — TRACKED (but not visually surfaced)
`radicalPotential(p)` (line 1162) blends allegiance + mood + disillusion + integrity + informant status into a single "ripeness for recruitment" score. Every wisp already carries `allegiance`, `disillusion`, `recruited`, `informant`. The DATA exists.

---

## The GENUINE GAPS (what the Living City spec should actually build)

The audit narrows the spec from "build a reactivity system" to these specific, real gaps:

### GAP 1 — Political lean is NOT visually surfaced (the real Layer A)
`animaColor` encodes **mood/stress** but NOT **political lean**. You can see who's *stressed*, but not at a glance who's a **loyalist vs simmering sympathizer vs your cell vs an informant**. This is the genuine Layer A gap: a subtle cue (an aura tint, a mark) keyed to `radicalPotential`/allegiance, layered onto the existing mood-color, so you can read the city's *political* temperature — pockets of sympathy spreading or being stamped out. The data (`radicalPotential`) is ready; it's purely a rendering addition in `drawPawn`.

### GAP 2 — Ripples are instant, not a visible WAVE
`onlookersReact` fires all nearby emotes *simultaneously*. The spec's "a wave of feeling crosses the crowd" needs **staggered timing** — nearest react first, farther a beat later — so it reads as a propagating wave, not a flashbulb. A small enhancement to `onlookersReact` (distance-based delay), not a new system.

### GAP 3 — No physical CROWD FORMATION
Wisps *emote* in response to events but don't *physically congregate*. There's no protest-gathering, no mourning-cluster, no scatter-from-crackdown (beyond individual flee). This is the most genuinely *new* piece: a temporary "gather/scatter goal" (like the existing flee→home or socialize goals) that pulls disposition-appropriate wisps toward (or away from) an event point, then releases them. THIS is the biggest real build in the spec.

### GAP 4 — No central event hook + no CITY-WIDE shift from player ops
There's no single `cityReact(event, x, y, magnitude)` that the big beats route through, and player ops (assassinate/sabotage/dissent) don't trigger a *collective* response or a city-wide mood/temperature shift — they have local witness effects but the city as a whole doesn't visibly respond to YOUR insurrection. Wiring the existing `emotionalReact`/`onlookersReact` (+ the new crowd goal) into a `cityReact` hook fired by player ops and regime crackdowns is the connective tissue that makes the city react *to you as a population*.

---

## Revised Build Plan (much smaller than the original spec)

Given how much exists, the Living City build is far smaller than a from-scratch reactivity system:

1. **GAP 1 — political-lean cue** in `drawPawn` (layer an allegiance/radicalPotential tint onto the existing animaColor). Pure rendering; data ready.
2. **GAP 2 — staggered ripple** — add distance-based delay to `onlookersReact` so it reads as a wave.
3. **GAP 3 — crowd formation** — a temporary gather/scatter goal (the one genuinely new system), disposition-gated.
4. **GAP 4 — `cityReact` hook + city-wide shift** — a central event router wired into player ops + crackdowns, applying ripple + crowd + a global mood/temperature nudge (via the existing `mov`/`regime` numbers).

Layers A's mood half, the per-wisp reactivity (Wave C), the ripple primitive, the emote vocabulary, and the political data are all **already done** — we're filling 4 specific gaps, not building the whole thing.

---

## Bottom line

The city is **even more alive than the spec assumed** — `emotionalReact`/"Wave C" already makes wisps' feelings read on their faces with 14 emotional profiles, `animaColor` already color-codes the crowd by mood, `onlookersReact` already ripples reactions through bystanders, and the social sim (gossip/cliques/partnerships) is deep. The Living City work is therefore NOT "build reactivity" — it's **four targeted additions**: (1) surface *political* lean visually (not just mood), (2) make ripples a staggered *wave*, (3) add physical *crowd formation*, (4) a central `cityReact` hook so the city responds *collectively to the player's insurrection* with a city-wide temperature shift. That's a tight, buildable scope sitting on a rich existing foundation — and it's exactly the emergent aliveness the dormant-city model will later preserve.
