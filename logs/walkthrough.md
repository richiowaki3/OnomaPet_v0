# Walkthrough - OnomaPet 00 Physics Simulation Upgrade

We have upgraded **OnomaPet 00** to a **relational peer-to-peer physical simulation**. The 4 nodes now behave as point masses with velocities and momentum, operating within a simulated fluid medium where each node calculates its physical relationships (spring coupling, relative damping, and twisting torques) with the other 3 nodes.

---

## Pairwise Node-Relationship Mechanics

Rather than relying on global offsets, every node $i$ explicitly calculates its interactions with the other 3 nodes $j \neq i$ in the system. The total relational force on node $i$ is the sum of pairwise forces:
$$\mathbf{F}_{\text{relational}, i} = \sum_{j \neq i} \left( \mathbf{F}_{\text{spring}, ij} + \mathbf{F}_{\text{damping}, ij} + \mathbf{F}_{\text{twist}, ij} \right)$$

For each pair $(i, j)$, let $\mathbf{r}_{ij} = \mathbf{x}_i - \mathbf{x}_j$, $d_{ij} = \|\mathbf{r}_{ij}\|$, and $\mathbf{u}_{ij} = \frac{\mathbf{r}_{ij}}{d_{ij}}$.

### 1. Nodes Gather Inward under Tension (Flow - x4, Boyle - x10)
- When a word has high tension or compression qualities (high Flow $x_4$ or high Boyle $x_{10}$), the rest distances $L_{ij}$ between all pairs contract. This pulls all 4 nodes closer together towards the center.
  $$L_{ij} = L_{\text{baseline}, ij} \times \left(1.0 - \text{min}\left(x_4 \times 0.05 + x_{10} \times 0.04, \, 0.65\right)\right)$$
  - **Tense/Bound words**: The plane physically contracts/shrinks.
  - **Relaxed/Free words**: The plane maintains its wide, loose shape.
- The spring force acting on node $i$ from node $j$ is:
  $$\mathbf{F}_{\text{spring}, ij} = -k_{\text{relation}} \left(d_{ij} - L_{ij}\right) \mathbf{u}_{ij}$$
  where $k_{\text{relation}} = x_5 \times 1.5$ (Hardness).

### 2. Staggered Start Sequence / Shear Damping (Flow - x4)
- Resistance/damping between nodes is modeled as a **relative shear damping force** that opposes relative velocities between node pairs:
  $$\mathbf{F}_{\text{damping}, ij} = -c_{\text{relative}} \left(\mathbf{v}_i - \mathbf{v}_j\right)$$
  where $c_{\text{relative}} = x_4 \times 0.45$.
  - **High Flow/Resistance**: Large relative damping resists independent movements, pulling neighboring nodes along but with a physical lag. This generates a staggered start sequence (動き出す順番のズレ) where motion ripples organically across the surface.
  - **Low Flow/Free**: Relative damping is zero, letting nodes accelerate independently.

### 3. Twist Torque (ひねり / Space - x3, Flow - x4)
- Twisting is modeled as an **alternating tangential force** computed along the perpendicular unit vector of the pairwise direction in the horizontal plane $\mathbf{t}_{ij} = (u_{ij, z}, \, 0, \, -u_{ij, x})$:
  $$\mathbf{F}_{\text{twist}, ij} = \mathbf{t}_{ij} \times \text{twistDrive} \times \text{twistSign}_i$$
  - Node 0 & 2 get clockwise torque, Node 1 & 3 get counterclockwise torque ($\text{twistSign}_i = \pm 1.0$).
  - Twist drive magnitude is scaled by the envelope, Weight, and Space:
    $$\text{twistDrive} \propto (1.0 - x_3 / 9.0)$$
  - This forces opposing corners to rotate in opposite directions relative to each other, physically twisting the quad plane.

---

## Core Simulation Loop

A numerical integration loop (Euler-Cromer) runs 4 sub-steps per frame to ensure high numerical stability.

The total force on each particle $i$ is calculated as:
$$\mathbf{F}_i = \mathbf{F}_{\text{relational}, i} + \mathbf{F}_{\text{home}, i} + \mathbf{F}_{\text{drag}, i} + \mathbf{F}_{\text{turbulent}, i} + \mathbf{F}_{\text{drive}, i} + \mathbf{F}_{\text{gravity}, i}$$

- **Viscous Drag**:
  $$\mathbf{F}_{\text{drag}, i} = - \left( c_{\text{laminar}} + c_{\text{quadratic}} \|\mathbf{v}_i\| \right) \mathbf{v}_i$$
- **Drive Excitation Force**:
  - Blended by **Time (x2)** and **Decay (x8)**.
  - **Sustained**: Continuous sinusoidal wave drive.
  - **Sudden**: Short-duration impulse kicks.

---

## Phonetic-Acoustic & Physical Enhancements

To align the simulation more closely with Japanese phonetics, we map linguistic character classes to specific physical forces and synthesis parameters:

### 1. Vowel Formant Filters (母音フォルマント合成)
- **Acoustics**: Maps each character's vowel (`a`, `i`, `u`, `e`, `o`) to corresponding vocal tract formant frequencies ($F_1, F_2, F_3$) using parallel bandpass filter banks.
- **Dynamic Transition**: As the beats progress, the synthesizer articulates the vowels of the word. For example, `ふわふわ` alternates formants `/u/` $\rightarrow$ `/a/` $\rightarrow$ `/u/` $\rightarrow$ `/a/`, making the synth physically "speak" the onomatopoeia vowels.

### 2. Modal Impact Resonance (モーダル衝突音合成)
- **Acoustics**: For rigid words with high hardness ($x_5 \ge 5$ and $x_9 < 4$ e.g. `がたがた`, `かんかん`), the system spawns 5 non-harmonic resonance modes ($1.0f_0, 1.52f_0, 2.18f_0, 2.94f_0, 3.85f_0$) that decay exponentially instead of a single oscillator tone, generating wood/metal impact acoustic properties.

### 3. Granular Synthesis (グラニュラー合成)
- **Acoustics**: For particle words with high Reynolds numbers ($x_9 \ge 4$ e.g. `さらさら`, `ざらざら`), the synthesizer scatters 10-15 overlapping short grains (20ms - 60ms) with randomized pitch and time offsets, mimicking sand pouring or rain crackling.

### 4. Sibilants / Fricatives (さ・し・す・せ・そ etc.)
- **Acoustics**: Detects sibilant characters and blends high-pass filtered (above 4500Hz) white noise to represent high-frequency friction sibilance.
- **Timbre (Friction/Roughness)**: Switch to a sharp `sawtooth` wave when friction ($x_4$ Flow or $x_9$ Reynolds) is high ($\ge 4$) to generate buzzy, rough textures.

### 5. Plosives / Explosives (ぱ・ぴ・ぷ・ぺ・ぽ etc.)
- **Physics**: Triggers a sudden, high-amplitude, radial outward force from the center `(0, 0, 0)` at the beginning of each beat, forcing nodes to explode outwards and snap back.
- **Acoustics**: Triggers a low-frequency envelope-swept (80Hz to 10Hz) transient pop at note start to simulate plosive release.

---

## Verification Results
- **Formant Pronunciation**: Try a word with distinct vowel transitions like `ぴかぴか` (/i/ and /a/). Listen to the vowel modulation ("i" $\rightarrow$ "a" $\rightarrow$ "i" $\rightarrow$ "a").
- **Modal Collision Impact**: Try `がたがた` or `こつこつ`. Hear the rigid, wooden/metallic impact sound created by parallel modal resonance decaying oscillators.
- **Granular Particle Scatter**: Try `さらさら` or `ざらざら`. Listen to the micro-grain scattering texture created by granular synthesis.
- **Plosive Outward Explosion**: Try `ぱっ` or `ばらばら`. Watch the spheres explode outwards radially and snap back, while hearing a distinct acoustic "pop" transient.
- **Sibilant Friction**: Try `さささ` or `しとしと`. Hear the high-frequency high-pass white noise accompanying the tones, simulating friction.
