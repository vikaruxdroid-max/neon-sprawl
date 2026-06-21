# NEON SPRAWL — Espionage-Economy Hook Audit
### Build `309e1440` · can gear + infrastructure plug into the existing systems cleanly?

A deep review (the "brains" / directorTick style) tracing the op-resolution pipeline and the build/place system to verify the Espionage-Economy spec's central assumption: that gear modifiers and clandestine infrastructure can hook into mechanics that ALREADY EXIST, rather than requiring a rebuild. **Verdict: mostly YES — the framework is sound — with ONE real architectural caveat (exposure) the spec must account for.**

---

## THE GOOD — clean single-point hooks (gear plugs in trivially)

### Difficulty — ONE chokepoint (the most important finding)
The entire op difficulty calculation funnels into a single line in `resolveAvatarOp` (~line 2665):
```js
const check=opsCheck(op.stat, op.diff + expPenalty + wit.pen + fearPen);
```
Every "diff -N" gear modifier (the most common kind — surveil rig, cyberdeck, spoofer, breach kit) hooks here as **one more added term**: `+ gearMod(opKey,"diff")`. No scattered logic. This single line validates the entire gear-framework approach. ✓

### Witness penalty — ONE function
`witnessPenalty(av,op)` (line 5254) computes the witness difficulty in one place, scaled by `op.witnessK`. A DEFEND gear ("Ghost Protocol Cloak" — reduce witnessK) hooks here cleanly — adjust the `k` multiplier or the result by a gearMod. ✓

### Range — ONE function
`inOpRange(av,op,target)` (line 2474) is the single range gate, reading `op.range`. A range-extending gear hooks by feeding an effective range (`op.range + gearMod(opKey,"range")`). ✓ (Note: `avatarInRange` was aligned to `inOpRange` last session — both now use the same check, so one hook covers both.)

### sightRange — CONSUMED (not a dead field)
Confirmed `op.sightRange` IS read (line 5231: `op?(op.sightRange||7):7` feeds perception). So a SPY gear modifier to sightRange has a real effect, and a MONITOR camera can reuse the same perception concept. ✓

### Cost / duration — trivially in AVATAR_OPS
`op.cost` (intel) and `op.duration` are read directly from the op def at resolve. Gear modifiers to these are simple gearMod terms where the value is read. ✓

---

## THE CAVEAT — exposure has NO single chokepoint (the one real finding)

Unlike difficulty/witness/range, **exposure gain is applied in many scattered places** — bribe trail (1428), blown surveil (~2625), recruit leak (1617), failed pitch (1700), no-jail-cell heat (1242), and more. There is **no single function** where exposure rises. 

**Implication for the spec:** a "reduce exposure" DEFEND gear (Signal Scrambler) CANNOT hook one line. Three options:
1. **A `exposureMod()` helper** applied at each major exposure point (like the existing `resolveMod()` already is at line 1428) — touches several lines but is the cleanest. **Precedent exists:** `resolveMod()` (the Resolve stat) is ALREADY applied to some exposure points this exact way. A gear exposure-modifier extends that established pattern.
2. **Scope the gear to specific exposure sources** (e.g. "Scrambler reduces exposure from BLOWN OPS only") — hooks just the op-failure exposure points, fewer touches, still meaningful.
3. **Defer exposure-reducing gear** to a later pass; ship SPY/HACK gear (clean hooks) first.

**Recommendation:** option 2 for v1 (scope it to op-failure exposure — the most thematically-relevant source, and a small touch-set), with the `exposureMod` helper (option 1) as the general solution if more exposure gear is wanted later. This keeps the first build clean.

---

## INFRASTRUCTURE — the watchpost is a fully reusable template

The spec assumed espionage infrastructure reuses the watchpost's area-effect. **Confirmed — and it's even cleaner than hoped:**

### `securityTick()` (line 5086) is a ready-made engine
It already: scans all structs flagged `security:true`, builds area zones from each one's `secRadius`, caches them in `ST._secZones`, and applies effects (heat bleed, crime suppression) in radius. Plus `underSecurity(x,y)` (line 5106) is a clean "is this point covered?" helper.

**Espionage infrastructure is the IDENTICAL pattern:** add an `espionageTick()` (or extend securityTick) that scans `espionage:true` structs, builds zones from their radius, and applies the espionage effect in radius — cameras reveal wisps + drip intel, wiretaps warn, safehouses reduce exposure inside, counter-sweep nodes blunt regime awareness. The zone-building + radius-check machinery is done. ✓

### Build/place machinery — entirely reusable
Espionage buildings are just new `DEF` entries with `cost:{income}`, `hp`, `secRadius`-style fields, flagged `espionage:true`. The existing placement, payment (`afford`/`pay`), HP, blueprint, and removal systems all apply unchanged. The watchpost (line 884) and copstation (887) are the exact templates. ✓

---

## LOADOUT/EQUIP — genuinely NEW (no duplication risk)

Checked for any existing `equipped`/`loadout`/`av.gear`/`inventory` concept: **none exists.** So the gear loadout is genuinely new — no risk of duplicating or fighting an existing system (unlike the Living City, where Wave C already existed). The avatar gets a new `equipped` array; clean slate. ✓

---

## HACK OPS — reuse the full pipeline

New ops (Hack the Grid, Data Heist, Corrupt Records) are just new `AVATAR_OPS` entries gated on owning the enabling gear/infra (a simple ownership check in the op's availability gate — the same place `needsSecret`/`legend` gates already live). They flow through the SAME resolution pipeline (opsCheck → bands → witness → exposure → cityReact). No new pipeline. The only new logic is the ownership gate + the "remote" range behavior (which the Grid Tap infrastructure enables). ✓

---

## REVISED BUILD PLAN (sharpened by the audit)

The audit changes little but sharpens the order and flags the exposure caveat:

1. **GEAR framework** — `GEAR` catalog + `equipped` array (cap N) + `gearMod(opKey,field)` summing equipped effects. Hook into the **difficulty chokepoint** (line 2665) first — the cleanest, highest-value hook. Start with SPY + HACK-prep gear (diff/range/sightRange modifiers — all clean single-point hooks). Validate: equipped gear measurably changes an op's resolution.
2. **Purchase/outfit UI** — buy + equip with income, respect the loadout cap.
3. **INFRASTRUCTURE framework** — 2-3 `espionage:true` buildings in `DEF` + an `espionageTick()` modeled EXACTLY on `securityTick()`. Camera (reveal + intel drip) first. Validate: placeable with income, passive effect fires in radius, save/load clean.
4. **HACK ops** — new `AVATAR_OPS` gated on gear/infra ownership; reuse the pipeline.
5. **DEFEND gear (the exposure caveat)** — scope to op-failure exposure (option 2), or add the `exposureMod` helper. Do this AFTER the clean-hook gear proves the framework.
6. **Regime counterplay + economy rebalance** — regime sweeps can find/destroy infra; tune costs.

---

## Bottom line

The Espionage-Economy spec is **architecturally sound** — its central assumption holds. Gear hooks into clean single points for difficulty (one line!), witness, range, sightRange, cost, and duration. Infrastructure reuses `securityTick`/`underSecurity` and the build/place system essentially verbatim. The loadout is genuinely new (no duplication). Hack ops reuse the full op pipeline. **The ONE real caveat is exposure** — it has no chokepoint, so exposure-reducing DEFEND gear needs either a scoped approach (recommended for v1: op-failure exposure only) or an `exposureMod` helper (precedent: `resolveMod` already does this). Build the clean-hook gear (SPY/HACK) first to prove the framework, then handle exposure. This is a buildable framework on existing foundations — not a rewrite.
