# NEON SPRAWL — Tuning Knobs Reference
### Build `d10fa64d` · for playtest feedback

Every first-draft number in the new systems, with its current value, location, and what changing it does. When something feels off during testing, point to the row and say "too high / too low" — I'll know exactly what to change.

All `TPD` = 2400 ticks = one in-game day. Game runs at 10 ticks/sec, so 1 real second ≈ 10 ticks.

---

## THE GOVERNMENT ENVOY

### Trigger — how often an envoy shows up
| Knob | Current | Line | What it does |
|---|---|---|---|
| Base chance | `0.004` | 6385 | The floor chance per check (≈hourly). ~0.4% when your heat is zero. **Raise** → envoys even when you're quiet. **Lower** → near-zero unless you're hot. |
| Heat multiplier | `heat * 0.05` | 6385 | How much your heat ramps the chance. At max heat ≈ +5%/check. **Raise** → loud play summons envoys aggressively. **Lower** → heat matters less. |
| Heat formula | `awareness*0.6 + exposure*0.4` | 6383 | The blend of regime-awareness vs your-exposure that defines "heat." Shift the weights to make one matter more. |
| Cooldown | `TPD * 3` (3 days) | 6379 | Minimum gap between envoys. **Raise** → rarer, more special. **Lower** → they can come back-to-back. |
| Population gate | `pop >= 4` | 6377 | No envoy until the district has ≥4 people. |
| Early-game gate | `tick >= TPD*2` (day 2) | 6377 | No envoy in the first 2 days. |

**Current behavior (measured):** ~0 spawns/check when cold, ~5.4%/check at max heat. Feels: envoys are a consequence of playing loud.

### Timing — how long the visit lasts
| Knob | Current | Line | What it does |
|---|---|---|---|
| Confer duration | `TPD * 0.45` (~10.8h) | 6405 | How long the meeting runs once the envoy reaches the Mayor = **your window to act**. **Raise** → more time to respond (easier). **Lower** → frantic, must act fast (harder). |
| Hard leave cap | `TPD * 0.9` (~21.6h) | 6406 | Absolute cap on the whole visit; the envoy can never linger past this. |

### The Threat — crackdown magnitude (when ignored)
| Knob | Current | Line | What it does |
|---|---|---|---|
| Awareness spike (ignored) | `RI(18,28)` | 6490 | How hard regime awareness jumps. **The main "this hurt" number.** |
| Awareness spike (spied) | `RI(8,14)` | 6490 | The blunted version when you surveilled the meeting first. |
| Grip spike (ignored) | `RI(8,14)` | 6491 | How much the regime's grip tightens. |
| Grip spike (spied) | `RI(3,6)` | 6491 | Blunted grip spike when spied. |
| Sympathizer allegiance hit | `-25` | 6514 | How much the compromised sympathizer's allegiance drops when turned informant. |

**Note:** the crackdown also runs a full `regimeSweep(false)` (burns/turns cell members) — that's the existing sweep, tunable separately in `regimeSweep`.

### Strike payoffs — reward for hitting the envoy
| Knob | Current | Line | What it does |
|---|---|---|---|
| Direct strike grip drop | `RI(12,20)` | ~6549 | How hard killing the envoy hurts the regime's grip. |
| Direct strike support gain | `RI(8,15)` | ~6550 | How much support the kill rallies. |
| Frame grip drop | `RI(5,9)` | ~6541 | Discrediting the envoy's grip hit (less than a kill). |
| Surveil intel reward | `RI(4,8)` | ~6525 | Intel gained from spying on the meeting. |

### Cell-member strike — the delegated hit
| Knob | Current | Line | What it does |
|---|---|---|---|
| Success formula | `0.5 + allegiance/200 - grip/300` (clamped 0.15–0.9) | 6587 | Chance the cell member pulls it off. Higher member allegiance = better odds; higher regime grip = worse. **Raise the base (0.5)** → cell strikes more reliable. |
| Failure → informant chance | `0.5` | ~6601 | If caught, 50% the burned member becomes an informant. |
| Failure awareness spike | `RI(15,25)` | ~6603 | How hard the regime reacts to a *failed* strike attempt. |

---

## SURVEIL REWORK (active tail + detection)

| Knob | Current | Line | What it does |
|---|---|---|---|
| Tail distance | `max(2.5, range-0.5)` | 2602 | How close the operative shadows the target. |
| Detection roll cadence | every `30` ticks (~3s) | 2609 | How often the "are you spotted?" check fires. **Lower** → checked more often (riskier). **Raise** → safer tailing. |
| Spot chance formula | `vis*0.35 - (tradecraft-5)*0.03` (clamped 0.02–0.6) | 2613 | Base spot risk from visibility, reduced by tradecraft (1–10). At tradecraft 10 ≈ -0.15; at 1 ≈ +0.12. |
| Too-close penalty | `+0.12` if within `2.2` tiles | ~2615 | Extra spot risk for shadowing on top of them. |
| Caught: exposure | `RI(6,12)` | ~2621 | Exposure spike when the tail is blown. |
| Caught: awareness | `RI(2,5)` | ~2622 | Awareness spike when caught. |

**Current behavior (measured):** 39/40 caught when shadowing close with bad tradecraft; 10/40 for an elite operative keeping distance. Feels: skill + positioning matter.

---

## How to give feedback

Examples of immediately-actionable notes:
- "Envoys come too often even when I'm careful" → lower the **base chance** (6385).
- "The crackdown is brutal, I can't recover" → lower the **awareness spike** (6490).
- "The meeting window is too short to react" → raise **confer duration** (6405).
- "Cell strikes always fail" → raise the **base** in the success formula (6587).
- "Tailing gets me caught instantly" → raise the **detection cadence** (6609) or lower the **vis weight** (2613).

Just name the feeling; I'll map it to the knob.
