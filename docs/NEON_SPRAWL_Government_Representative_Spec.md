# NEON SPRAWL — Government Representative (The Envoy)
### Design Specification v1

A recurring, high-stakes event that ties the existing "outsider arrives" hook into the insurrection. A regime envoy comes to confer with the Mayor. The visit is a **decision under pressure**: ignore it and the regime tightens the noose, or use your operative toolkit to spy on or disrupt the meeting — at real risk.

The core principle: **this introduces NO new interaction grammar.** It reuses the ops you already have (surveil, sabotage, frame, assassinate) and the infrastructure you've built (the cell). The envoy's visit simply turns the meeting location, the envoy's route, and the envoy themselves into actionable targets for a limited window. It is a pressure-test of the insurrection the player has built.

---

## 1. The Arc

1. **Arrival** — A government representative enters the district from an edge. Logged + bannered. The arrival is **triggered by a mix of the player's heat and randomness**: the higher the regime's awareness / the player's exposure, the more likely the envoy is dispatched. The regime is *responding to the heat the player generated* — this is a consequence of the insurrection, not a pure random event.

2. **Approach** — The envoy walks to the **Mayor** (or, if no clear Mayor location, a civic/government building). This is the telegraph: the player sees the envoy arrive and head to the meeting. A camera ping + banner makes it unmissable.

3. **The Meeting Window** — For a limited time (a fraction of a day), THREE things become live targets:
   - **The venue** (where they meet) — sabotage it (cut power / plant) to disrupt or delay the conference, blunting the crackdown.
   - **The envoy's route** (especially on departure — exposed, away from the Mayor) — ambush / strike there.
   - **The envoy themselves, via a recruited cell member** — the avatar isn't risked; a cell member acts, risking *them* instead. (Only available if the player HAS recruited cell members.)

4. **Spying** — Surveilling the meeting (positioning an operative or cell member near it) reveals **what the regime is planning** — turning the crackdown from a surprise into something the player saw coming, and granting a partial counter (reduced crackdown severity).

5. **Resolution:**
   - **Ignored** → the conference concludes. The crackdown lands (see §3).
   - **Disrupted / struck** → a major blow to the regime (see §4), scaled by the method, with high exposure / retaliation risk.

---

## 2. Trigger (Mix: heat-driven + random)

- Checked periodically (piggyback on the existing caravan/event cadence so it doesn't add a hot loop).
- Base chance is low; **scales up with `REG().awareness` and the movement's `exposure`.** Rough shape: `chance = base + k * (awareness/100) * (exposure/100)`, clamped.
- Cooldown after a visit (`lastEnvoy` tick) so they don't stack — a few days minimum between envoys.
- Some randomness so it's not perfectly predictable — a quiet, careful player might still occasionally get a visit; a loud one gets them often.
- Reuses the caravan's "one special arrival at a time" guard — no envoy while a caravan or another envoy is active.

**Why this is the good design:** the envoy becomes the regime's *reaction* to the player. Play loud and reckless → the regime keeps sending officials to crack down. Play careful → they rarely bother. The player's style shapes the threat.

---

## 3. The Threat — Ignoring the Envoy (BOTH: crackdown + compromised sympathizer)

When the meeting concludes uninterrupted, two things happen:

**(a) A hard crackdown (temporary, not permanent):**
- Spike `REG().awareness` (a large jump).
- Spike `REG().grip`.
- Trigger / accelerate a regime **sweep** (set `lastSweep` so patrols intensify).
- Lasts a few days — real and painful, but it *recovers*. (Deliberately NOT a permanent tier escalation: a permanent penalty for missing a semi-random event would feel punishing; a temporary-but-real crackdown creates urgency without being unfair.)

**(b) They compromise a sympathizer:**
- The regime IDs one of the player's **sympathizers** (`allegiance>15 && !recruited && !informant`) and turns them — flipping them toward `informant` (reusing the existing snitch/informant flip at ~line 1195).
- Logged as a story beat: the regime learned who's been sympathetic, and one of them is now feeding information.
- This is the sharper, more personal cost — the player loses ground in their network, not just a stat hit.

If the player **spied** on the meeting (§4 surveil option), the crackdown severity is **reduced** (they saw it coming and prepared) — but the sympathizer compromise may still land unless they actively disrupted.

---

## 4. The Options — How the Player Acts (reuses existing ops)

When the envoy is present, the player can respond. Each reuses an existing op type, pointed at the meeting. Each has a **cost (intel)**, a **risk (exposure / failure / retaliation)**, and a **payoff**.

| Approach | Reuses | Risk | Payoff |
|---|---|---|---|
| **Surveil the meeting** | surveil/tail | Low | Learn the regime's plan → reduced crackdown, partial counter |
| **Sabotage the venue** | sabotage | Medium | Disrupt/delay the conference → blunts the crackdown |
| **Frame the envoy** | frame | Medium | Turn the regime against its own official → internal distrust, the envoy leaves discredited |
| **Strike on the route/departure** | assassinate (on route) | High | A major blow to the regime — bigger than a local enforcer kill |
| **Strike via a cell member** | assassinate (delegated) | High (risks the CELL member, not the avatar) | Same big blow, avatar stays clean — but a cell member is exposed/endangered |

**Spatial logic (the "how, without standing next to the rep" answer = ALL of the above):**
- **Venue sabotage** — act on the *building* where they meet (cut power via the existing blackout/sabotage system, or plant).
- **Route/departure strike** — the envoy is most vulnerable *leaving*, away from the Mayor. The strike targets their path out, not the guarded meeting.
- **Cell member** — a recruited wisp carries out the act; the avatar never has to be present. **Only offered if `ST.pawns.some(p => p.recruited && !isChild(p))`** — it rewards players who built a cell. No cell → this option is hidden.

The violent/disruptive options carry **high exposure** and possible **retaliation** (the regime responds hard to an attack on its envoy — a worse crackdown if you try and *fail*). High risk, high reward.

---

## 5. Reusing Existing Systems (grounded — all verified present)

- **Arrival/spot/leave-timer machinery** → the caravan system (`ST.caravan`, `caravanSpot()`, `caravanTick()`, leave-timer pattern). The envoy is a new special-arrival type alongside `outsiders`/`buy`/`sell`.
- **The Mayor** → the existing mayor role-wisp (`p.role==="mayor"`).
- **Recruited cell** → `p.recruited` flag; cell = `ST.pawns.filter(p=>p.recruited && !isChild(p))`.
- **Sympathizers** → `allegiance>15 && !recruited && !informant`.
- **Informant flip** → the existing snitch mechanic (~line 1195) — reused to compromise a sympathizer.
- **Crackdown** → `REG().awareness`, `REG().grip`, `REG().lastSweep` — all exist.
- **Ops** → surveil, sabotage, frame, assassinate already exist with tuned difficulty/exposure; the envoy options route through them.
- **Blackout/sabotage on a building** → `gridDown()`, `ST.blackoutUntil`, the sabotage lifecycle — reused for venue sabotage.

---

## 6. Build Order (when we implement)

1. **The envoy arrival** — new caravan-type (or parallel `ST.envoy` state): trigger logic (§2), arrival log/banner/ping, the envoy walks to the Mayor.
2. **The meeting + window** — envoy reaches the Mayor, they "confer" (a visible co-located state), a countdown to conference-conclusion.
3. **The threat resolution** (§3) — on conclusion uninterrupted: crackdown + sympathizer compromise.
4. **The response options** (§4) — surface the choices (surveil / sabotage venue / frame / strike route / strike via cell), gated by availability (cell option needs a cell), each routing through the existing op with envoy-specific payoffs.
5. **Spying counter** — surveilling reduces crackdown severity.
6. **Departure** — the envoy leaves (uninterrupted, discredited, or dead), with the appropriate consequence.

Each step validated headless (smoke + behavior tests) before the next, per the usual workflow. The VISIBLE parts (the envoy walking, the meeting visual, the banners) will need in-browser confirmation since rendered visuals can't be validated headless.

---

## 7. Open / Deferred (not blocking the build)

- **Exact tuning numbers** — crackdown magnitudes, op costs/difficulty for envoy targets, the trigger probability constants — all first-draft, need in-play tuning.
- **Visual treatment of the envoy** — a distinct sprite/marker so they read as "government, not local." (Lower priority; can start with a clear marker.)
- **The meeting visual** — how "conferring with the Mayor" is shown. Start simple (co-located + a marker), polish later.
- **Multiple envoys over a long game** — escalating stakes on repeat visits? (Future; v1 treats each visit consistently.)
