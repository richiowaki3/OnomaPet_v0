# Implementation Plan - OnomaPet 00 Audio Synthesis Integration

We will implement a procedural **Web Audio Synthesizer** inside the demo. The sound engine will be mapped to the 16 OnomaDict axes and synchronized frame-accurately with the physics engine's node excitations.

---

## 1. Synthesizer Voice Architecture (Web Audio API)
Each trigger event will spawn a dynamic synthesizer voice consisting of:
- **Tone Generator (Oscillator)**:
  - **Fundamental Pitch**: Derived from the word's `freq_hz` (acoustic.freq_hz), or mapped from `freq_norm`:
    $$f_0 = \text{freq\_hz} \text{ or } 150 \times 1.5^{x_7 \times 0.33}$$
  - **Timbre (Hardness - x5)**:
    - *High Hardness (rigid)*: FM synthesis (Frequency Modulation) with non-harmonic ratios ($f_c:f_m = 1.414$) to create metallic, clanging, or sharp bell-like timbres.
    - *Low Hardness (soft/fluid)*: Sine or triangle wave passed through a low-pass filter to create warm, soft, muffled tones.
- **Friction/Turbulence (Reynolds - x9)**:
  - A white noise buffer node routed through a band-pass filter centered around the fundamental frequency $f_0$.
  - The volume mix ratio of noise to tone is directly proportional to Reynolds ($x_9$). High Reynolds creates breathy, scraping, or rushing noise.
- **Envelope Generator (GainNode)**:
  - **Time (x2)** & **Decay (x8)** & **Accent (x13)** shape the ADSR envelope:
    - *Sudden (high x2)*: Immediate attack time ($0.002\text{s}$) followed by decay.
    - *Sustained (low x2)*: Slow, swelling attack time ($0.15\text{s}$).
    - *Decay/Release (x8)*: Decay rate matches $x_8$. High $x_8$ (rapid decay) yields short clicks/staccatos. Low $x_8$ yields long, ringing tones.
- **FX & Space Routing**:
  - **Compression/Saturation (Boyle - x10)**: Routes through a Waveshaper distortion node. High Boyle values saturate and compress the output.
  - **Moisture (x6)**: Controls a Dry/Wet mixer routing into a procedural feedback delay line and convolutional reverb. Higher moisture increases echo and spatial resonance.

---

## 2. Synchronization of Sound & Motion
- We will divide the physics cycle $T$ into $N$ sub-beats based on **Meter (x15)**:
  $$N = 1 + \text{floor}(x_{15} / 3.0)$$
  - Meter 0-2: 1 beat per cycle.
  - Meter 3-5: 2 beats per cycle (e.g. reduplicated double-kick like "fuwafuwa").
  - Meter 6-9: 4 beats per cycle (rapid repeating rolls).
- **Trigger Event**:
  When the cycle timer wraps around a sub-beat interval ($T_{\text{beat}} = T / N$):
  1. **Acoustic Trigger**: Spawns and triggers a synth voice scheduled precisely in the Web Audio context.
  2. **Physical Impulse**: Applies a corresponding force kick to the 4 nodes, maintaining perfect sync between the audio you hear and the motion you see.

---

## Proposed Changes

### [onomapet00]

#### [MODIFY] [index.html](file:///c:/Users/richi/onomapet00/index.html)
- Add a subtle status message or indicator showing whether the AudioContext is initialized (since modern browsers require a user interaction, like clicking "Execute" or "Random", to start audio).

#### [MODIFY] [app.js](file:///c:/Users/richi/onomapet00/app.js)
- Add the `OnomaSynth` class to handle node creation, reverb buffer generation, waveshaping curves, and voice triggering.
- Initialize the synthesizer on the first user interaction.
- Align the physics update loop with absolute timing intervals, triggering sub-beats that apply both the physical node impulses and trigger the synth notes.

---

## Verification Plan

### Manual Verification
1. Open `index.html` and click "Execute" or "Random" (initializing the audio context).
2. Confirm the sound triggers in sync with the node impulses.
3. Test key contrasts:
   - **`あっ`** (Sudden, High Decay, Rigid): Should make a sharp, metallic "clack" sound with instant decay, synchronized with a sudden rigid kick.
   - **`ふわふわ`** (Sustained, Low Decay, Soft, Reduplicated): Should make two gentle, swelling, warm wave tones per cycle, synchronized with a soft, wavy double-kick.
   - **`がたがた`** (High Reynolds, High Meter, Rigid): Should make a rapid, noisy clattering sound, synchronized with quick, rigid, turbulent vibrations.
