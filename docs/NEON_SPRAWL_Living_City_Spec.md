# NEON SPRAWL — The Living City
### Making the City Feel Alive & Reactive · Design Spec v1

The city sim is already deep — wisps have needs, moods, emotions, typed relationships, gossip, careers, aspirations, memory, aging, partnerships, mentorship, and inherited politics. **The gap is not simulation depth — it's PERCEPTION and COLLECTIVE response.** All that rich inner life happens under the hood where the player can't see it, and the city doesn't visibly react *as a population* to the player's insurrection. This spec closes both gaps. It's the right thing to finish before the dormant-city model, because "what makes this city feel alive" is exactly what the dormant model must preserve.

Two complementary layers, both built on existing primitives (the `EMOTES` system, `drawPawn`'s color, gossip, `radicalPotential`):

- **Layer A — Surface the inner life:** subtle always-on cues that hint at a wisp's hidden state (mood, politics, allegiance) — readable if you look, never cluttering.
- **Layer B — Collective reactions:** when something big happens, the city responds as a population — reactions ripple, crowds form, the ambient mood shifts.

---

## LAYER A — Surfacing the Inner Life (subtle ambient cues)

**Decision: subtle always-on cues, NOT a HUD overlay.** A wisp's hidden state is hinted through their appearance/behavior, readable to an attentive player, invisible as clutter. This extends the established philosophy (a code comment already notes "interactions now read on the wisp's face").

### What state to surface (all already tracked)
- **Mood / stress** — content vs miserable.
- **Political lean toward the insurrection** — `radicalPotential(p)` already blends allegiance + mood + disillusion + integrity into a single "how ripe for recruitment" score. THIS is the key number to surface: at a glance, who's a regime loyalist, who's a simmering sympathizer, who's yours.
- **Allegiance role** — recruited (your cell), informant (turned), neutral.

### The cues (subtle, layered, all hooking `drawPawn` + `EMOTES`)
1. **A faint aura/underglow tint** keyed to political lean — the most important cue. A cool/neutral tint for loyalists, a warm/ember tint that intensifies as a wisp radicalizes toward you, a distinct mark for your cell, a cold/wrong tint for informants. So scanning the crowd, you can *feel* the city's political temperature — pockets of warmth (sympathy) spreading or being stamped out. Very low opacity; it reads as atmosphere, not a healthbar.
2. **Mood through existing emotes, but ambient** — a miserable wisp occasionally shows a quiet sad/stressed emote unprompted; a content one, a calm/happy beat. Already have the emotes; this makes them *idle ambient* (low frequency) not just event-triggered, so the crowd visibly has feelings.
3. **Posture/pace hints** (lightweight) — the stressed move differently than the content (already partially true via flee/daze). A subtle lean on animation speed by mood.

### The discipline
- **Opacity/frequency tuned to "atmosphere, not UI."** If it reads as a status overlay, it's too strong. The test: a casual player feels the city has a mood; an attentive one can *read* individuals.
- **Cell/informant marks are slightly stronger** (you need to find your people), but still diegetic.
- All cues are *derived* from existing state each frame — no new state to store, nothing to serialize.

---

## LAYER B — Collective Reactions (the city responds to YOU)

**Decision: one unified system — events RIPPLE, crowds FORM, ambient mood SHIFTS.** When something significant happens (caused by you or the regime), the city responds as a population, not just scattered individuals. This is the city pulsing with life and reacting to the insurrection.

### The trigger: significant events
A central hook — `cityReact(event, x, y, magnitude)` — fired by the meaningful beats that already exist:
- **You spread dissent / rally** → hope ripples.
- **You strike a regime figure (assassinate/sabotage)** → shock + fear + (for sympathizers) emboldened.
- **The regime cracks down / sweeps / makes an arrest** → fear ripples, sympathizers cowed or angered.
- **A public death, a blackout, a disaster** → collective alarm.
- **A recruitment / a turning** → quiet ripples of allegiance.

Each event has a **valence** (hope / fear / anger / grief / shock) and a **magnitude** (how big).

### The three responses (one system, fired together, scaled by magnitude)

**1. RIPPLE — a visible wave of reactions through nearby wisps.**
From the event's epicenter, wisps react in an outward wave (nearest first, a beat later for those farther) — emotes matching the valence (fear → sweat, hope → the warm emote, anger → anger, grief → sad). Visually it reads as a *wave* of feeling crossing the crowd. Magnitude sets the radius + how many react. Reuses `tryEmote` + the gossip-radius pattern; the new part is the *staggered outward timing* that makes it a visible wave, and the valence→emote mapping.

**2. CROWD — wisps physically congregate.**
For larger events, nearby wisps (whose disposition fits) break their routine and *gather*:
- **Protest/rally** (after dissent, or a sympathetic reaction to a regime atrocity) — sympathizers converge on the spot, cluster, emote defiance. A visible knot of dissent.
- **Mourn** — after a notable death, bonded wisps gather at the spot.
- **Flee/scatter** — after a violent regime crackdown, the fearful disperse *away* (reuses the existing flee primitive).
- **Gawk** — a crowd rubbernecks at a dramatic event.
Implemented as a temporary `gather` goal (like the existing flee→home / socialize goals): pulls eligible wisps toward (or away from) a point for a duration, then releases them back to routine. Who joins is gated by disposition (a loyalist won't join your protest; a sympathizer will).

**3. AMBIENT SHIFT — the whole city's temperature moves.**
Beyond the local crowd, the *global* mood nudges: a successful strike on the regime lifts city-wide sympathizer mood + emboldens (a small `radicalPotential` bump across the disaffected); a brutal crackdown chills it (fear up, sympathizers cowed). This connects to the existing `mov.support` / `regime.awareness` so the collective number *and* the visible texture move together. The audio bed (which already shifts with intensity) can lean into it. So the city doesn't just react locally then forget — its baseline *temperature* shifts, and you feel the insurrection gaining or losing ground across the whole block.

### The payoff
You assassinate an enforcer in the market. A wave of shock ripples out from the body (Layer B ripple). Fearful wisps scatter; a knot of emboldened sympathizers gathers, emotes defiance (Layer B crowd). City-wide, the disaffected's mood ticks up — and via Layer A, you can *see* the warm political tint spread a little across the crowd (the layers reinforcing). The city *felt* what you did, as a population. That's aliveness + reactivity in one moment.

---

## Build Order (each validated)

1. **Layer A cues** — derive + draw the political-lean tint/aura in `drawPawn`; ambient idle emotes by mood; the cell/informant marks. Validate: cues render, derive from real state, no per-frame cost issue.
2. **`cityReact` + RIPPLE** — the central event hook + the staggered outward emote wave with valence mapping. Validate: an event sends a visible wave; valence maps correctly.
3. **CROWD** — the temporary gather/scatter goal; disposition-gated joining. Validate: sympathizers gather for a protest, the fearful scatter from a crackdown, wisps return to routine after.
4. **AMBIENT SHIFT** — the global mood/temperature nudge wired to the existing mov/regime numbers. Validate: a strike lifts city sympathy, a crackdown chills it, the visible tint (Layer A) moves with it.
5. **Wire to real events** — fire `cityReact` from the actual beats (dissent, assassinate, sabotage, crackdown, death, recruitment). Validate: each beat produces the right collective response.

Each step headless-validated for *logic + stability*; the VISIBLE result (the tints, the waves, the crowds) needs in-browser confirmation — this is heavily visual, so Carlo QAs each layer.

---

## What This Is NOT (scope discipline)

- **NOT new simulation depth for its own sake** — the wisps are already deep. This SURFACES what exists + adds COLLECTIVE response. We're not adding more needs/careers/systems.
- **NOT a HUD/overlay** — Layer A is diegetic atmosphere, not a stats panel (you rejected the overlay option).
- **NOT performance-heavy** — cues derive from existing state (no new storage); ripples/crowds reuse existing emote/goal primitives; the work is timing + mapping, not new heavy systems. (Tick budget has huge headroom — 5-8ms of 100ms.)
- **NOT serialized bloat** — cues are derived live; a transient crowd/gather is in-flight state, not saved. (This keeps the dormant-city model clean — the "aliveness" is emergent from the numbers + named NPCs the dormant model already keeps, not extra state it'd have to compress.)

---

## Bottom line

The city is already deeply alive *under the hood* — this makes that aliveness **visible** (Layer A: subtle political/mood cues you can read in the crowd) and makes the city **react to you as a population** (Layer B: ripples + crowds + ambient temperature shifts when you strike, rally, or the regime cracks down). Both build on existing primitives (emotes, gossip, flee, the mov/regime numbers), add no serialized bloat, and finish the single city into something that *feels* alive — which is exactly the thing worth preserving when we later compress it into a dormant summary.
