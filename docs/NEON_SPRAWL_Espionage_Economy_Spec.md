# NEON SPRAWL — The Espionage Economy
### Gear + Clandestine Infrastructure · Design Spec v1

A core identity fix. Right now district **income** buys city-builder infrastructure — housing, hospitals, parks, furniture. But this isn't a colony sim; it's **clandestine influence — intrigue and espionage.** So the money you earn should serve the shadow-war: making you a better operative, not furnishing rooms. This spec gives income a real espionage sink, in two halves of one system:

- **GEAR** — portable equipment the operative carries/equips that boosts your operations.
- **INFRASTRUCTURE** — fixed clandestine assets you place in the city that give standing capability.

**Paid for with district income** (the money already earned). The economy stops being SimCity and starts being a spy's war chest.

**Design principle (the through-line):** every purchase must plug into a mechanic that ALREADY EXISTS. Ops key off real, modifiable values — `stat`, `diff` (difficulty), `range`, `cost` (intel), `duration`, `sightRange`, `witnessK` (witness penalty) — plus `exposure`/`awareness` (heat) and the watchpost's `secRadius` area-effect model. Gear/infra modify THESE. No invented stats.

---

## The Four Pillars (your words: spy / defend / monitor / hack)

Everything maps to four operative needs, so the catalog reads as organized intent, not a junk drawer:

1. **SPY** — get better intel, surveil faster/safer, see more.
2. **DEFEND** — reduce exposure, resist the regime's detection, evade witnesses.
3. **MONITOR** — standing awareness of the district (cameras, taps) — passive intel + early warning.
4. **HACK** — cyber-ops: tap the grid, corrupt regime data, electronic sabotage.

Each pillar has both GEAR (portable) and INFRASTRUCTURE (placed).

---

## HALF ONE — GEAR (portable, equipped)

Items the operative carries. Bought with income, equipped to a small loadout, each modifies REAL op values. A loadout cap (e.g. 3 slots) forces meaningful choices — you can't carry everything, so your gear expresses your playstyle.

### Examples grounded in real op fields
- **SPY**
  - *Optic Suite* — `sightRange +N` on surveil/intel (see targets from farther).
  - *Surveil Rig* — surveil `duration -N` (tail faster) + `diff -N` (cleaner reads).
  - *Contact Network Chip* — intel-gather yields more per success.
- **DEFEND**
  - *Ghost Protocol Cloak* — `witnessK` reduced across all ops (witnesses penalize you less — pairs with the witness-fear system).
  - *Signal Scrambler* — exposure gain on a blown op reduced (pairs with `resolveMod`).
  - *Counter-Surveillance Kit* — lowers the chance surveil gets "spotted/blown."
- **HACK**
  - *Cyberdeck* — unlocks/【boosts】electronic ops (see new ops below); sabotage on utility `diff -N`.
  - *Spoofer* — frame/blackmail `diff -N` (better at planting digital evidence).
- **GENERAL**
  - *Lockpicks/Breach Kit* — steal/sabotage `range +` or `diff -`.
  - *Burner Credits* — bribe more effective (cheaper silence).

Each is a flat, legible modifier to an existing op field. Tunable numbers.

### How gear works mechanically
- A `GEAR` catalog (like `AVATAR_OPS`) — each item: `{name, pillar, cost:{income}, effect}` where `effect` is a modifier applied to op resolution.
- The avatar has an `equipped` array (cap N). Buying adds to inventory; equipping moves it to the loadout.
- Op resolution reads the equipped gear and applies modifiers — a single `gearMod(opKey, field)` helper that sums equipped effects for that op/field. Clean hook: ops already compute `diff`, `range`, `witnessK` etc. at resolve; gearMod adjusts them.
- Equipped gear can show as small icons near the operative or in the op dock.

---

## HALF TWO — INFRASTRUCTURE (placed, standing capability)

Fixed clandestine assets you build in the city (paid with income), each projecting a standing benefit — the espionage answer to the watchpost. Unlike gear (boosts an active op), infrastructure gives PASSIVE, AREA, or ENABLING capability. These replace the colony buildings as what income builds.

### Examples grounded in real mechanics
- **MONITOR**
  - *Hidden Camera* — a small `sightRange`-like radius that passively reveals wisp activity + slowly generates intel (a covert, player-owned watchpost). Place several to build a surveillance net.
  - *Wiretap / Server Tap* — placed on/near a regime building; passively drips intel + reveals regime awareness changes (early warning before a crackdown).
- **SPY/DEFEND**
  - *Safehouse* — a clandestine base (distinct from the fixer's room): a place to lie low that reduces exposure over time while inside; a fallback if your cover's blown. Could store gear.
  - *Dead Drop* — a placed node that lets your cell pass intel without meeting (lore + a small passive intel flow from recruited members).
- **HACK**
  - *Grid Tap* — placed on power infra; enables remote electronic sabotage (sabotage without physically approaching — a HACK op) and skims a passive resource.
  - *Signal Relay* — extends the range/reach of your hack ops across the district.
- **DEFEND**
  - *Counter-Sweep Node* — an area where the regime's `awareness`/sweep effectiveness is reduced (your turf is harder to monitor — the anti-watchpost).

### How infrastructure works mechanically
- These are new entries in `DEF` (the structure catalog) — same build/place system as existing buildings, but flagged `espionage:true` and categorized by pillar. They reuse the entire placement, cost, HP, and `secRadius`-style area-effect machinery the watchpost already uses.
- A passive tick (like the watchpost's security effect) applies their standing benefit: cameras reveal + drip intel, taps warn, safehouses reduce exposure, counter-sweep nodes blunt regime awareness in radius.
- **The regime can find + destroy them** (ties into awareness/sweeps) — so your network is a real asset you protect, raising the stakes. A discovered wiretap is a setback + an exposure spike.

---

## NEW OPS THIS ENABLES (the HACK pillar — genuinely new gameplay)

The HACK pillar isn't just modifiers — it unlocks new ops (gated on owning a Cyberdeck / Grid Tap), extending the existing `AVATAR_OPS` toolkit:
- **Hack the Grid** — remote electronic sabotage of a power/water building (a ranged sabotage, enabled by a Grid Tap — no physical approach, but needs the infrastructure).
- **Data Heist** — breach a regime building's records remotely for a big intel payout (high diff, needs a Cyberdeck + a nearby tap).
- **Corrupt Records** — a digital frame (alter regime data to discredit a loyalist) — frame's electronic cousin, enabled by gear.
These reuse the entire op-resolution pipeline (opsCheck, bands, witness, exposure) — they're new `AVATAR_OPS` entries gated on gear/infra ownership.

---

## Reshaping the Existing Economy (the identity fix)

The point isn't just to ADD espionage spending — it's to REFOCUS the economy. Concretely:
- **Income's primary sink becomes espionage** (gear + clandestine infrastructure), not colony buildings.
- **The colony buildings don't vanish** — the city still needs to function (the wisps live there, and a functioning district is what generates your income + cover). But they shift from "the point of the game" to "the substrate you operate within + your revenue base." You maintain the city as cover and cashflow; you SPEND the proceeds on the shadow-war.
- This reframes the loop: *run the district (income) → invest in espionage capability (gear + infra) → run bigger ops → topple the regime.* The city-building becomes the MEANS; the espionage is the END. That's the genre the game actually is.

---

## Build Order (each validated, framework-first)

1. **The GEAR framework** — the `GEAR` catalog + `equipped` loadout + `gearMod(opKey,field)` hook into op resolution. Start with 3-4 gear items across pillars. Validate: buying with income works, equipping respects the cap, an equipped item measurably changes an op's resolution.
2. **A purchase UI** — where you buy/equip gear (an "Operative Outfitter" panel, paid with income). Validate: the catalog renders, income is spent, the loadout updates.
3. **The INFRASTRUCTURE framework** — 2-3 espionage buildings in `DEF` (camera, wiretap, safehouse) flagged `espionage:true`, reusing the build/place + watchpost area-effect system. A passive tick applying their benefit. Validate: placeable with income, the passive effect fires (camera reveals + drips intel), save/load clean.
4. **The HACK ops** — 1-2 new `AVATAR_OPS` (Hack the Grid, Data Heist) gated on owning the enabling gear/infra. Validate: ops appear only when you own the prerequisite, resolve through the existing pipeline.
5. **Regime counterplay** — the regime can discover + destroy your infrastructure (ties into sweeps/awareness). Validate: a sweep can find a wiretap, destroying it spikes exposure.
6. **Economy rebalance** — tune income generation + gear/infra costs so the espionage sink is the meaningful spend. (In-play tuning — Carlo's feel.)

Each step headless-validated for logic; the UI + visual placement need Carlo's in-browser QA.

---

## What This Is NOT (scope discipline)

- **NOT removing the city sim** — the district still runs (cover + cashflow + the living world we just built). We're refocusing what income BUYS, not deleting the colony.
- **NOT a sprawling item shop** — four pillars (spy/defend/monitor/hack), each with a FEW meaningful items, not dozens of trinkets. Every item is a legible modifier to a real mechanic.
- **NOT invented stats** — gear/infra modify EXISTING op fields (diff/range/witnessK/exposure/sightRange) and reuse EXISTING systems (the build/place machinery, the watchpost area-effect, the op-resolution pipeline).
- **NOT a separate currency** — uses district income (your decision), giving the money you already earn a reason to matter.

---

## Bottom line

The espionage economy gives district income a real purpose: **gear** (portable, equipped, boosts your active ops) + **clandestine infrastructure** (placed, standing capability — cameras, taps, safehouses, grid taps) across four pillars — spy, defend, monitor, hack — with the HACK pillar unlocking genuinely new remote ops. It reframes the whole loop: the city-building becomes the *means* (cover + cashflow), the espionage becomes the *end*. Everything plugs into mechanics that already exist (op fields, the watchpost area-effect, the build/place system, the op pipeline), so it's a focused, buildable framework — not a bolt-on shop. This is the change that makes the game's economy finally match the game's soul.
