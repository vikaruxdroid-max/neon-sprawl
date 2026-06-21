# NEON SPRAWL — The Base of Operations
### A Developable HQ · Design Spec v1

You start the game crashing in the **fixer's back room** — borrowed, not yours (the code even flags it `attach:2`, "low attach — it's borrowed, not owned"). The game SETS UP a base but never lets you earn your own. This spec pays that off: **your own developable HQ** — one base you build and grow across a playthrough, adding rooms/stations that unlock capability. And critically, it's **the hub for your espionage infrastructure** — where you build/manage gear, place cameras and taps, and plan ops. The HQ gives the espionage economy a *home*: instead of buying gear from an abstract menu, you outfit your base. The two systems reinforce each other.

**Design principle (the through-line, same as the espionage spec):** the HQ reuses what exists — the `placeRoom`/furniture system, the `DEF` building flags (`vendor`/`security`/`civic`), the structure-interaction model, and it becomes the front-end for the espionage gear/infra economy. No parallel systems.

---

## The Core Concept: the HQ as a Growing Project

The HQ is ONE base (not multiple), developed over time. It starts minimal and grows as you invest income into **stations** — each station is a functional installation that unlocks or houses a capability. You don't place-and-forget; you build it up, and its development IS your progression as an operative.

### How you GET the HQ (the origin)
Two clean options (pick in design):
- **Claim + upgrade the fixer's room** — the borrowed space becomes yours (a story beat: the fixer moves on / you take it over), and you start developing it. Lowest friction — reuses `ST.fixerHome`, and the "borrowed → owned" arc is already half-written in the code.
- **Establish a new HQ** — buy/claim an empty space and found your base there (more agency, more setup).
**Recommendation:** claim-and-upgrade the fixer's room for v1 — it reuses the existing base, pays off the "borrowed" narrative the code already set up, and avoids a placement flow. The HQ can relocate/expand later.

### How you DEVELOP it (the loop)
- The HQ has a set of **station slots** (rooms/installations you can add).
- Each station costs **income** (the espionage-economy currency) to build, and unlocks a capability.
- As you add stations, the HQ visibly grows (more furnished rooms) AND your operative capability expands.
- This is the progression spine: *earn income → develop the HQ → unlock espionage capability → run bigger ops.*

---

## The Stations (mapped to the four espionage pillars)

Each station is a furnished installation in the HQ, flagged with a function (reusing the `DEF` flag pattern). Stations map to the espionage spec's pillars — SPY / DEFEND / MONITOR / HACK — so the HQ is literally the home of the espionage economy.

### Core stations
- **Planning Table (the heart)** — the ops command center. Plan/launch ops from here; possibly a small bonus to op success when planned at the table. The first station — the thing that makes it a base.
- **Workbench / Armory (SPY/general)** — where you **craft/buy + store GEAR** (the espionage-economy gear lives here). Unlocks the gear catalog; equipping happens at the bench.
- **Surveillance Hub (MONITOR)** — manages your **camera/wiretap network** (the espionage infrastructure). View what your placed cameras see; the standing-intel from taps flows here. The brain of your monitoring net.
- **Server Room / Cyberdeck Station (HACK)** — unlocks + houses the **HACK ops** (Hack the Grid, Data Heist). Owning this station is the gate for electronic ops.
- **Safe Room (DEFEND)** — the lie-low space: while based here, exposure recovers faster; a fallback when your cover's blown. Ties into the exposure system.
- **Quarters** — the operative's living space (sleep/rest) — replaces the fixer's pod as your actual home (raises `attach` — it's YOURS now).

### How stations work mechanically
- Each station is a furniture/building entry in `DEF` (like `workstation`, `bar`), flagged with an HQ-function (e.g. `hqStation:"planning"`, `hqStation:"armory"`).
- Building a station = placing it in the HQ room (reuses `placeRoom`/`addBuilt`), paid with income.
- A station's capability is gated on OWNERSHIP: e.g. the gear catalog opens only if you have a Workbench; HACK ops appear only with a Server Room. (Same ownership-gate pattern the espionage spec uses for hack ops, and `needsSecret`/`legend` already use.)
- Interacting with a station (clicking it, or the avatar using it) opens the relevant panel — the gear outfitter at the Workbench, the camera net at the Surveillance Hub, etc.

---

## How the HQ Unifies the Espionage Economy

This is the key structural payoff. The espionage spec defined gear, infrastructure, and hack ops as somewhat free-floating purchases. The HQ gives them a **home and a gate**:
- **GEAR** is crafted/stored at the Workbench station — you can't outfit until you've built it. Outfitting happens AT your base.
- **INFRASTRUCTURE** (cameras/taps) is managed from the Surveillance Hub — your monitoring net has a control room.
- **HACK ops** are unlocked by the Server Room — electronic warfare needs the kit.
- **DEFEND** (exposure recovery) is the Safe Room's standing effect.
So the HQ isn't a separate feature bolted next to the espionage economy — it's the **operational center that economy runs through.** Developing the HQ = unlocking the espionage economy, piece by piece. The two specs become one system.

---

## What the HQ DOES (standing effects)

Beyond housing the espionage economy, the HQ provides standing benefits while you operate from it — earned by developing it:
- **Planning Table** → ops command center (launch point; small planning bonus).
- **Safe Room** → faster exposure recovery while inside; blown-cover fallback.
- **Surveillance Hub** → your camera/tap intel aggregates here (passive intel flow).
- **Quarters** → your real home (rest, high attach — it's yours).
- (Developed enough) the HQ becomes a genuine stronghold — which sets up the regime counterplay below.

---

## Regime Counterplay (the stakes — later pass)

A base worth building is a base worth defending. Tying into the espionage spec's "regime can find/destroy your infrastructure":
- If your exposure runs too high, the regime can eventually **locate and raid the HQ** — a high-stakes event (lose stations, gear, a major exposure spike, or worse).
- This makes the HQ a real asset with real risk — you protect it, and a raid is a genuine setback. (Defer the full raid mechanic to a later pass; v1 establishes the base + stations.)

---

## Build Order (each validated, foundation-first)

1. **Claim the HQ** — convert the fixer's room into the owned base: raise the avatar's `attach`, reflag it as the HQ, a small "this is yours now" beat. Validate: the avatar's home is now the HQ, recognized as owned.
2. **The station framework** — `hqStation`-flagged entries in `DEF` + an HQ data structure tracking which stations are built + the ownership-gate helper (`hasStation(kind)`). Validate: building a station with income works, ownership is tracked, save/load clean.
3. **The Planning Table (first station)** — the ops command center. Validate: built with income, becomes a launch point, the HQ feels like a base.
4. **Wire the espionage economy through stations** — gate the gear catalog on the Workbench, hack ops on the Server Room, etc. (This is where the HQ + espionage specs merge — build them together.) Validate: capabilities unlock only with the right station.
5. **Station interaction UI** — clicking a station opens its panel (gear outfitter, surveillance net). Validate: each station's panel opens.
6. **Standing effects + regime raid** — the Safe Room's exposure recovery, then (later) the regime raid mechanic. Tune costs/effects in play.

Each step headless-validated for logic; the HQ layout, station visuals, and panels need Carlo's in-browser QA.

---

## What This Is NOT (scope discipline)

- **NOT multiple bases** — ONE developable HQ (your decision). It can relocate/expand later, but it's one base you grow.
- **NOT a separate feature from the espionage economy** — it's the HUB that economy runs through. The HQ and espionage specs are designed to merge into one system (gear at the Workbench, hack at the Server Room).
- **NOT a from-scratch building system** — reuses `placeRoom`/`addBuilt`/the `DEF` flag pattern/the structure-interaction model. Stations are flagged furniture; "developing" = unlocking + placing them.
- **NOT removing the fixer's room as a mechanic** — it BECOMES the HQ (claim-and-upgrade), paying off the "borrowed" arc the code already wrote.

---

## Bottom line

Your base of operations is a **developable HQ** — claim the fixer's borrowed room and grow it into your own, adding **stations** (Planning Table, Workbench, Surveillance Hub, Server Room, Safe Room, Quarters) that each unlock a piece of the espionage economy. The HQ is the **operational hub** that economy runs through: gear is crafted at the Workbench, your camera net managed from the Surveillance Hub, hack ops unlocked by the Server Room, exposure recovered in the Safe Room. Developing the HQ IS your progression — *earn income → build stations → unlock espionage capability → run bigger ops* — and it gives the whole espionage economy a home and a gate. Everything reuses existing systems (rooms, furniture, building flags, ownership gates), so the HQ and espionage economy merge into one buildable system. This pays off the "borrowed base" the game already set up, and makes the espionage economy feel like outfitting YOUR stronghold rather than shopping a menu.
