# NEON SPRAWL — Item / Structure Audit (AUTHORITATIVE)

**Companion to:** `NEON_SPRAWL_Master_Spec.md` §6–7.
**Source:** the real `DEF[]` catalog (`index.html` L842–899) + `AVATAR_OPS` (L1838) + `HQ_STATIONS`
(L4408). Nothing invented.
**Rule under test:** every item/structure has a defined EFFECT at a defined SCOPE; no dead items.
**Policy (Carlo, locked): WIRE THEM ALL** — re-point every city-builder element into an intrigue
function. Nothing stays inert background.

---

## 1. Headline finding

The game is **already saturated with intrigue substrate**, so "wire them all" is mostly *connecting
existing hooks*, not inventing systems:

- **Illicit economy already flagged:** `dealer` (`illegal,selfRun`), `mineshaft`/Data Den
  (`illicit`, runs hacks + sells stolen data, raises heat), `fixercorner` (`illicit`, brokers
  data/gear/favors), `bar`/`stimlab` (stims, heat).
- **Regime targets already tagged:** `roleHome` ties — `mayorhouse`→mayor, `copstation`→enforcer,
  `fixercorner`→fixer. The frame/assassinate ops already use `target:"regime"`.
- **Sabotage targets already wired:** the `sabotage` op uses `target:"utility"` → `powerstation` /
  `waterfac` are *already* its targets (and the Grid-Tap/Hack-the-Grid target in the espionage spec).
- **An intel/contraband resource economy exists:** food / scrap / **data** / chem / parts / **stims** /
  **gear**. Data is intel currency; stims is the drug economy; gear feeds the loadout.
- **Security model exists:** `watchpost` / `copstation` `secRadius` — the espionage spec's
  counter-sweep node is just the anti-version.
- **An influence lever exists:** `hall` already "warms factions toward you."

**No DEAD items found.** Every `DEF` entry has a real function. The rule is satisfied; the work is
re-pointing the *ambient* ones at intrigue.

---

## 2. Verdict taxonomy
- **LIVE-INTRIGUE** — already serves the shadow war. Keep; confirm scope tag.
- **WIRE** — has a real effect that's currently city-builder texture; re-point it at intrigue (per policy).
- **DEAD** — no effect. Forbidden. *(none found.)*

---

## 3. Full audit

### Already LIVE-INTRIGUE (the existing shadow substrate)
| DEF | Current effect | Intrigue role | Connects to |
|---|---|---|---|
| `dealer` (Dealer Spot) | illegal stim sales, self-run, income | drug economy spine; **overdose anchor** | new overdose ambient events; `hooked` |
| `bar` | sells stims, social venue | drug retail + **social-intel hub** | passive intel; gossip |
| `stimlab` | refines Chem+Data→Stims, +heat | drug **production** | heat/exposure; supply |
| `mineshaft` (Data Den) | illicit; produces Data; "run hacks, sell stolen data", +heat | **HACK economy** anchor | `intel`, future Data Heist |
| `fixercorner` (Fixer Corner) | illicit; brokers data/gear/favors; roleHome fixer | **black-market hub** (your gear/intel source) | gear purchase; `intel` |
| `gearshop` | refines Parts+Data→Gear | **gear supply chain** (feeds loadout) | espionage GEAR (spec) |
| `workstation`/`chemlab`/`workshop` | produce Data/Chem/Parts | feed stims+gear chains; **Data = intel currency** | supply; `intel` |
| `mayorhouse` (Admin Villa) | regime seat; roleHome mayor | **prime target** | `frame`/`assassinate` (`target:regime`), infiltrate |
| `copstation` (Precinct) | regime police; secRadius 16; roleHome enforcer | regime **monitoring** + target | `sabotage`/`frame`; anti-player security |
| `watchpost` | suppresses crime, bleeds heat; secRadius 18 | player **security**; counter-sweep precedent | espionage counter-sweep node (spec) |
| `jail` (Holding Cells) | regime lockup; "worst never seen again" | **the stakes** for getting caught; rescue target | `steal`/`assassinate` fail; future rescue op |
| `hall` (Community Hall) | "warms factions toward you", clique loyalty | **influence amplifier** | `dissent`, recruit |
| `powerstation` / `waterfac` | district utilities | **sabotage targets** (already) | `sabotage` (`target:utility`); Grid-Tap (spec) |

### WIRE — city-builder texture → intrigue (per policy)
| DEF | Current effect | → Intrigue role | Wiring hook |
|---|---|---|---|
| Furniture: `pod`,`lamp`,`fridge`,`shower`,`toilet`,`tv`,`gym`,`couch`,`bookshelf`,`art`,`rug` | home comfort/needs/mood; `furnEffect` | **TARGET VULNERABILITY surface** | new `homeVulnerability(npc)` read from furniture quality + unmet needs → lowers `bribe`/`blackmail`/`steal`/recruit DC. Affluent home (`art`) = robbery value; broken fridge / unmet needs = desperate = turnable |
| `park` (Sprawl Park) | recreation, crowds | **meet / dead-drop site**; surveil cover | tag clandestine-meet; `formCrowd` cover modifier to nearby ops |
| `arcade` | premium entertainment, vendor | **front / fence / meet** | illicit-front flag candidate; meet-site |
| `school` (Learning Hub) | trains skills | **recruitment pool / radicalization** | `dissent`/recruit yield modifier in radius; records = minor intel |
| `nursery` | children mature faster | **reputation / moral-stakes site** | ops here spike exposure + faction backlash; protecting = reputation (a restraint lever) |
| `hospital` / `medbed` | treat injury/disease | **overdose+injury sink; records intel; body disposal** | overdoses route here; records = `surveil`/Data-Heist target; wounded-asset extraction |
| `market` (Market Hub) | caravans, trade | **smuggling route** | caravans = cover to move stims/gear/data; intercept/control = supply lever |
| `furnstore` | sells furniture; district cut | **wealth-signal supply + laundering front** | feeds the vulnerability surface above; front-flag candidate |
| `cafeteria` / `streetvendor` / `counter` | food commerce | **social-intel sites + cover jobs** | passive gossip/intel drip; cover-employment slot for an asset |
| `farmplot` / `sporevat` / `loggingcamp` (Salvage Yard, "no questions asked") | outer-ring resources | **off-grid hideout / cache / supply** | remote low-traffic → safehouse/cache candidates (Salvage Yard first) |
| `housing` | adds a home slot | **the influence pool** | population = sympathizers/recruits/witnesses (substrate; indirect) |
| `wall` / `door` | barrier / flow control | **infiltration topology** | shape stealth routes + break-in DC; walled compound (mayorhouse) = higher infiltrate DC |

### Decor (nat:1, placed by genCity) → micro-sites
`dumpster`, `vendmachine`, `crate`, `bench`, `planter`, `streetlamp`, `ruin`, `scrap`, `cache` →
**dead-drop / cache nodes** (the espionage spec's Dead Drop). `scrap`/`cache` already carry salvage
value. Low priority; cheap flavor wins.

---

## 4. The wiring map (grouped by intrigue function)

- **Targets:** mayorhouse, copstation, powerstation, waterfac, jail.
- **Vulnerability surface:** all furniture + needs state → who's bribable / turnable / worth robbing.
- **Supply & contraband:** workstation/chemlab/workshop → stimlab/gearshop → fixercorner; market = smuggling; loggingcamp/farms = off-grid cache.
- **Intel sources:** Data Den, hospital records, cafeteria/streetvendor/bar (social), surveil.
- **Meet / dead-drop / cover:** park, arcade, decor nodes; crowds for cover.
- **Recruitment / influence:** school, hall, dissent radius, housing (the pool).
- **Security (both sides):** watchpost (yours), copstation (theirs); counter-sweep node (spec).
- **Stakes:** jail (caught), nursery (moral/reputation lines).

---

## 5. Build implications

1. **The cheapest, highest-impact wire is the VULNERABILITY surface.** One `homeVulnerability(npc)` read
   makes the entire furniture/needs economy feed `bribe`/`blackmail`/`steal`/recruit at once. Do it first.
2. **The overdose system rides on `dealer`/`stimlab` + `hospital`** — addiction hooks already exist; the
   delta is overdose ambient events flowing to hospital. Don't build new economy; extend.
3. **Sabotage/Grid-Tap is already pointed at utilities** — the espionage spec's HACK pillar slots in
   with minimal new wiring.
4. **Most "civic" buildings become flags + radius modifiers**, not new systems (front-flag, meet-site,
   recruit-radius, intel-drip). Cheap, additive, reuses placement/secRadius machinery.
5. **No deletions.** No dead items, and the policy is wire-not-cut.

> Next concrete step: implement `homeVulnerability(npc)` and tie it to the four social ops, as the proof
> that the city-builder economy now feeds intrigue. Everything else is the same pattern.
