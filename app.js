// OnomaPet 00 - Three.js Application Logic with Integrated Web Audio Synthesizer

let scene, camera, renderer, controls;
let nodes = [];
let planeMesh, lineOutline;

let baselinePositions = [
    new THREE.Vector3(-2, 0, -2), // Node 0 (Back-Left)
    new THREE.Vector3(2, 0, -2),  // Node 1 (Back-Right)
    new THREE.Vector3(2, 0, 2),   // Node 2 (Front-Right)
    new THREE.Vector3(-2, 0, 2)   // Node 3 (Front-Left)
];

// Physical Simulation States
let currentPositions = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
];
let velocities = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
];
// Persistent driving force vectors for lagging/filtering
let activeForces = [
    new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
];

let activeWord = null;
let animationTime = 0;
let lastBeatIndex = -1;
const clock = new THREE.Clock();

// Web Audio Synthesizer Class
class OnomaSynth {
    constructor() {
        this.ctx = null;
        this.synthBus = null;
        this.distortionNode = null;
        this.reverbNode = null;
        this.delayNode = null;
        this.dryGain = null;
        this.wetGain = null;
        this.masterGain = null;
        this.noiseBuffer = null;
    }

    init() {
        if (this.ctx) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();

            // Reverb (procedural decay white noise)
            this.reverbNode = this.ctx.createConvolver();
            this.reverbNode.buffer = this.createReverbBuffer(1.5, 2.0);

            // Feedback Delay Line
            this.delayNode = this.ctx.createDelay(1.5);
            this.delayFeedback = this.ctx.createGain();
            this.delayNode.delayTime.value = 0.22;
            this.delayFeedback.gain.value = 0.25;
            this.delayNode.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delayNode);

            // Distortion (Boyle compression Waveshaper)
            this.distortionNode = this.ctx.createWaveShaper();
            this.distortionNode.curve = this.makeDistortionCurve(0);
            this.distortionNode.oversample = '4x';

            // Master Gain Node
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.35;

            // Synth Bus routing
            this.synthBus = this.ctx.createGain();
            this.synthBus.gain.value = 1.0;

            // FX Mix nodes
            this.dryGain = this.ctx.createGain();
            this.wetGain = this.ctx.createGain();
            this.dryGain.gain.value = 1.0;
            this.wetGain.gain.value = 0.0;

            // Wiring
            this.synthBus.connect(this.distortionNode);
            
            // Dry path
            this.distortionNode.connect(this.dryGain);

            // Wet path (reverb and delay)
            this.distortionNode.connect(this.reverbNode);
            this.reverbNode.connect(this.wetGain);

            this.distortionNode.connect(this.delayNode);
            this.delayNode.connect(this.wetGain);

            this.dryGain.connect(this.masterGain);
            this.wetGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            // Noise buffer (Reynolds turbulence source)
            this.noiseBuffer = this.createNoiseBuffer(2.0);

            console.log("[OnomaSynth] Web Audio Context initialized successfully.");
        } catch (e) {
            console.error("[OnomaSynth] Failed to initialize AudioContext:", e);
        }
    }

    createReverbBuffer(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const len = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, len, sampleRate);
        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return buffer;
    }

    createNoiseBuffer(duration) {
        const sampleRate = this.ctx.sampleRate;
        const len = sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, len, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 0;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    setMoisture(ms) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const wetRatio = (ms / 9.0) * 0.7; // Max 70% wet
        const dryRatio = 1.0 - wetRatio * 0.3;
        this.wetGain.gain.setTargetAtTime(wetRatio, now, 0.05);
        this.dryGain.gain.setTargetAtTime(dryRatio, now, 0.05);
    }

    setBoyle(by) {
        if (!this.ctx) return;
        const distAmount = by * 8.0; // Waveshaping amount
        this.distortionNode.curve = this.makeDistortionCurve(distAmount);
    }

    createFormantFilter(sourceNode, vowel, outputNode, now) {
        const FORMANT_MAP = {
            'a': [
                { f: 800,  q: 8,  g: 1.0 },
                { f: 1200, q: 10, g: 0.75 },
                { f: 2500, q: 6,  g: 0.4 }
            ],
            'i': [
                { f: 320,  q: 10, g: 1.0 },
                { f: 2300, q: 15, g: 0.55 },
                { f: 3000, q: 8,  g: 0.35 }
            ],
            'u': [
                { f: 320,  q: 8,  g: 1.0 },
                { f: 1200, q: 8,  g: 0.4 },
                { f: 2500, q: 6,  g: 0.25 }
            ],
            'e': [
                { f: 500,  q: 8,  g: 1.0 },
                { f: 1900, q: 12, g: 0.6 },
                { f: 2500, q: 8,  g: 0.4 }
            ],
            'o': [
                { f: 500,  q: 8,  g: 1.0 },
                { f: 800,  q: 12, g: 0.8 },
                { f: 2500, q: 6,  g: 0.25 }
            ]
        };

        const formants = FORMANT_MAP[vowel] || FORMANT_MAP['u'];
        
        // Pass source through each formant filter in parallel
        formants.forEach(fParams => {
            const bp = this.ctx.createBiquadFilter();
            bp.type = 'bandpass';
            bp.frequency.setValueAtTime(fParams.f, now);
            bp.Q.setValueAtTime(fParams.q, now);
            
            const gNode = this.ctx.createGain();
            gNode.gain.setValueAtTime(fParams.g, now);
            
            sourceNode.connect(bp);
            bp.connect(gNode);
            gNode.connect(outputNode);
        });
    }

    playNote(beatIndex, totalBeats, word) {
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;

        const w = word.effort.weight;
        const t_att = word.effort.time;
        const fl = word.effort.flow;
        const hd = word.acoustic.hardness;
        const re = word.extended.reynolds_norm;
        const dc = word.acoustic.decay;
        const co = word.phrasing.contour;

        const wordText = word.word || "";
        const isSibilant = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチ]/.test(wordText);
        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボ]/.test(wordText);

        // Map beatIndex to vowel
        const getVowelForChar = (char) => {
            if (/[あかさたなはまやらわがざだばぱアカサタナハマヤラワガザダバパァヵ]/.test(char)) return 'a';
            if (/[いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピィ]/.test(char)) return 'i';
            if (/[うくすつぬふむゆるぐずづぶぷウクスツヌフムユルグズヅブプゥッ]/.test(char)) return 'u';
            if (/[えけせてねへめれげぜでべぺエケセテネヘメレゲゼデベペェヶ]/.test(char)) return 'e';
            if (/[おこそとのほもよろごぞどぼぽオコソトノホモヨロゴゾドボポォ]/.test(char)) return 'o';
            return 'u';
        };

        const cleanChars = wordText.replace(/[っッー]/g, '').split('');
        const charIndex = Math.min(beatIndex, cleanChars.length - 1);
        const char = cleanChars[charIndex] || '';
        const vowel = getVowelForChar(char);

        // 1. Pitch Definition
        let pitchFreq = word.acoustic.freq_hz || (130.0 * Math.pow(1.5, word.acoustic.freq_norm * 0.33));

        // 2. Setup Envelope (ADSR)
        let attackTime = 0.003 + (9 - t_att) * 0.035; // Sudden has short attack
        let decayTime = 0.03 + (9 - dc) * 0.05 + (9 - t_att) * 0.04;
        let sustainLevel = Math.max((9 - dc) * 0.07, 0.001);
        let releaseTime = 0.05 + (9 - dc) * 0.15;

        // Shorten overlapping beats in high meter
        if (totalBeats > 1) {
            decayTime *= 0.5;
            releaseTime *= 0.5;
            sustainLevel *= 0.4;
        }

        const noteDuration = attackTime + decayTime + releaseTime;

        // Sound Synthesis Categorization:
        const isGranular = re >= 4;
        const isModal = hd >= 5 && !isGranular;
        const isNormal = !isModal && !isGranular;

        // Common filter for smoothing normal / modal tones
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const frictionCoeff = Math.max(re, fl);
        const cutoff = pitchFreq * (1.2 + hd * 0.8 + (frictionCoeff >= 4 ? 0.6 : 0));
        filter.frequency.setValueAtTime(cutoff, now);

        // 3. Spawning Tone Generators (based on category)
        const osc = this.ctx.createOscillator();
        let fmOsc = null;
        let fmGain = null;

        if (isNormal) {
            if (hd > 5) {
                // High hardness metallic clang (FM)
                osc.type = 'triangle';
                fmOsc = this.ctx.createOscillator();
                fmGain = this.ctx.createGain();

                fmOsc.frequency.value = pitchFreq * 1.414;
                fmGain.gain.value = pitchFreq * (hd - 4) * 0.7;

                fmOsc.connect(fmGain);
                fmGain.connect(osc.frequency);

                fmOsc.start(now);
                fmOsc.stop(now + noteDuration + 0.1);
            } else {
                osc.type = (hd > 2) ? 'triangle' : 'sine';
            }
            osc.frequency.setValueAtTime(pitchFreq, now);

            // Pitch Contour
            if (co < 4) {
                osc.frequency.exponentialRampToValueAtTime(pitchFreq * 1.4, now + noteDuration * 0.7);
            } else if (co > 6) {
                osc.frequency.exponentialRampToValueAtTime(pitchFreq * 0.65, now + noteDuration * 0.7);
            }
            osc.connect(filter);
        } else if (isModal) {
            // Modal Impact Synthesis (Spawn resonance modes instead of single tone)
            const modes = [1.0, 1.52, 2.18, 2.94, 3.85];
            const modeGains = [1.0, 0.5, 0.35, 0.2, 0.1];
            const modeDecays = [1.0, 1.4, 1.8, 2.2, 2.6];

            modes.forEach((ratio, idx) => {
                const modeOsc = this.ctx.createOscillator();
                modeOsc.type = 'sine';
                modeOsc.frequency.setValueAtTime(pitchFreq * ratio, now);

                const modeGain = this.ctx.createGain();
                modeGain.gain.setValueAtTime(0, now);
                modeGain.gain.linearRampToValueAtTime(modeGains[idx] * (0.35 + w * 0.05), now + 0.001);
                
                const modeDecayTime = decayTime / modeDecays[idx];
                modeGain.gain.exponentialRampToValueAtTime(0.00001, now + modeDecayTime);

                modeOsc.connect(modeGain);
                modeGain.connect(filter);

                modeOsc.start(now);
                modeOsc.stop(now + modeDecayTime + 0.05);
            });
        }

        // 4. Setup Noise (Reynolds - x9 / Turbulence)
        let noiseNode = null;
        let noiseGain = null;

        if (re > 1 && !isGranular) {
            noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = this.noiseBuffer;
            noiseNode.loop = true;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.setValueAtTime(pitchFreq * 1.25, now);
            noiseFilter.Q.setValueAtTime(1.0 + (9 - re) * 0.25, now);

            noiseGain = this.ctx.createGain();
            const noiseVolume = (re / 9.0) * 0.38;
            noiseGain.gain.setValueAtTime(noiseVolume, now);

            noiseNode.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            
            noiseNode.start(now);
        }

        // 5. Setup voice envelopes & formant input bus
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0, now);
        
        if (isNormal || isModal) {
            voiceGain.gain.linearRampToValueAtTime(0.35 + w * 0.05, now + attackTime);
            voiceGain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.0001), now + attackTime + decayTime);
            voiceGain.gain.setValueAtTime(sustainLevel, now + attackTime + decayTime);
            voiceGain.gain.exponentialRampToValueAtTime(0.00001, now + noteDuration);
        }

        const formantInput = this.ctx.createGain();
        formantInput.gain.setValueAtTime(1.0, now);

        if (isNormal || isModal) {
            filter.connect(voiceGain);
            voiceGain.connect(formantInput);
            if (noiseGain) {
                noiseGain.connect(formantInput);
            }
        }

        // Granular Particle Synthesis
        if (isGranular) {
            const numGrains = 10 + Math.floor(re * 1.5);
            const grainSpacing = 0.015; // 15ms spacing

            for (let g = 0; g < numGrains; g++) {
                const grainTime = now + g * grainSpacing + (Math.random() - 0.5) * 0.01;
                const grainDuration = 0.02 + Math.random() * 0.04;
                const grainPitch = pitchFreq * (1.0 + (Math.random() - 0.5) * 0.18 * (re / 9.0));

                const grainOsc = this.ctx.createOscillator();
                grainOsc.type = (frictionCoeff >= 4) ? 'sawtooth' : 'triangle';
                grainOsc.frequency.setValueAtTime(grainPitch, grainTime);

                const grainGain = this.ctx.createGain();
                grainGain.gain.setValueAtTime(0, grainTime);
                grainGain.gain.linearRampToValueAtTime(0.06 + w * 0.03, grainTime + grainDuration * 0.3);
                grainGain.gain.exponentialRampToValueAtTime(0.00001, grainTime + grainDuration);

                const grainFilter = this.ctx.createBiquadFilter();
                grainFilter.type = 'lowpass';
                grainFilter.frequency.setValueAtTime(grainPitch * (1.2 + hd * 0.5), grainTime);

                grainOsc.connect(grainFilter);
                grainFilter.connect(grainGain);
                grainGain.connect(formantInput);

                grainOsc.start(grainTime);
                grainOsc.stop(grainTime + grainDuration + 0.05);
            }
        }

        // 6. Setup Tremolo/Grainy amplitude modulation (Reynolds >= 4)
        const tremoloGain = this.ctx.createGain();
        tremoloGain.gain.setValueAtTime(1.0, now);
        
        let lfo = null;
        if (re >= 4) {
            lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.setValueAtTime(15.0 + re * 6.0, now); // 15Hz to 69Hz rapid vibration
            lfoGain.gain.setValueAtTime((re - 4) * 0.12, now); // up to 60% modulation depth
            lfo.connect(lfoGain);
            lfoGain.connect(tremoloGain.gain);
            lfo.start(now);
            lfo.stop(now + noteDuration + 0.1);
        }

        // Route formantInput through the parallel formant filters to tremoloGain
        this.createFormantFilter(formantInput, vowel, tremoloGain, now);

        // 7. Dynamic Fricative Noise (High frequency sibilant noise for さ/し/す etc. - bypasses vowel formant)
        let sibNoiseNode = null;
        if (isSibilant) {
            sibNoiseNode = this.ctx.createBufferSource();
            sibNoiseNode.buffer = this.noiseBuffer;
            sibNoiseNode.loop = true;

            const sibFilter = this.ctx.createBiquadFilter();
            sibFilter.type = 'highpass';
            sibFilter.frequency.setValueAtTime(4500.0, now);

            const sibGain = this.ctx.createGain();
            const sibVolume = 0.28 + (re / 9.0) * 0.15;
            sibGain.gain.setValueAtTime(0.0, now);
            sibGain.gain.linearRampToValueAtTime(sibVolume, now + 0.015);
            sibGain.gain.exponentialRampToValueAtTime(0.0001, now + attackTime + decayTime * 1.5);

            sibNoiseNode.connect(sibFilter);
            sibFilter.connect(sibGain);
            sibGain.connect(tremoloGain);

            sibNoiseNode.start(now);
            sibNoiseNode.stop(now + attackTime + decayTime * 1.5 + 0.1);
        }

        // 8. Dynamic Plosive Burst (Low frequency pop for ぱ/ば etc. - bypasses vowel formant)
        let popOsc = null;
        if (isPlosive) {
            popOsc = this.ctx.createOscillator();
            const popGain = this.ctx.createGain();
            popOsc.frequency.setValueAtTime(80.0, now);
            popOsc.frequency.exponentialRampToValueAtTime(10.0, now + 0.025);

            popGain.gain.setValueAtTime(0.0, now);
            popGain.gain.linearRampToValueAtTime(0.75, now + 0.002);
            popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

            popOsc.connect(popGain);
            popGain.connect(tremoloGain);

            popOsc.start(now);
            popOsc.stop(now + 0.03);
        }

        // Connect the modulated master voice path to the main bus
        tremoloGain.connect(this.synthBus);

        // Playback trigger
        if (isNormal) {
            osc.start(now);
            osc.stop(now + noteDuration + 0.1);
        }

        if (noiseNode) {
            noiseNode.stop(now + noteDuration + 0.1);
        }
    }
}

// Global Synthesizer instance
const onomaSynth = new OnomaSynth();

// Initialize Three.js environment
function initThree() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0c10);
    scene.fog = new THREE.FogExp2(0x0b0c10, 0.05);

    // Camera
    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 6, 9);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 3;
    controls.maxDistance = 20;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 12, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Point Light near the center
    const pointLight = new THREE.PointLight(0xffffff, 0.8, 15);
    pointLight.position.set(0, 3, 0);
    scene.add(pointLight);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(20, 20, 0x4f46e5, 0x1e293b);
    gridHelper.position.y = -2.5;
    scene.add(gridHelper);

    // Floor Plane
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
        color: 0x090a0f,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.51;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create 4 Nodes (Spheres)
    const sphereGeo = new THREE.SphereGeometry(0.22, 32, 32);
    for (let i = 0; i < 4; i++) {
        const material = new THREE.MeshStandardMaterial({
            color: 0x6366f1,
            roughness: 0.1,
            metalness: 0.2,
            emissive: 0x6366f1,
            emissiveIntensity: 0.4
        });
        const sphere = new THREE.Mesh(sphereGeo, material);
        sphere.castShadow = true;
        scene.add(sphere);
        nodes.push(sphere);
    }

    // Create Plane Mesh
    const planeGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array(12);
    planeGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    planeGeo.setIndex([0, 1, 2, 0, 2, 3]);

    const planeMat = new THREE.MeshStandardMaterial({
        color: 0x6366f1,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        roughness: 0.2,
        metalness: 0.3,
        flatShading: true
    });
    planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.castShadow = true;
    planeMesh.receiveShadow = true;
    scene.add(planeMesh);

    // Create Outline
    const lineGeo = new THREE.BufferGeometry();
    const lineVerts = new Float32Array(15);
    lineGeo.setAttribute('position', new THREE.BufferAttribute(lineVerts, 3));
    const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 3,
        transparent: true,
        opacity: 0.9
    });
    lineOutline = new THREE.Line(lineGeo, lineMat);
    scene.add(lineOutline);

    resetNodesToBaseline();

    clock.start();
    animate();

    window.addEventListener('resize', onWindowResize);
}

// Levenshtein distance helper to find closest words in corpus
function levenshteinDistance(str1, str2) {
    const track = Array(str2.length + 1).fill(null).map(() =>
        Array(str1.length + 1).fill(null));
    for (let i = 0; i <= str1.length; i += 1) {
        track[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
        track[j][0] = j;
    }
    for (let j = 1; j <= str2.length; j += 1) {
        for (let i = 1; i <= str1.length; i += 1) {
            const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
            track[j][i] = Math.min(
                track[j][i - 1] + 1, // deletion
                track[j - 1][i] + 1, // insertion
                track[j - 1][i - 1] + indicator // substitution
            );
        }
    }
    return track[str2.length][str1.length];
}

// Predict phonetic, acoustic and physical parameters for unregistered words
function estimateWordParameters(query) {
    let est = {
        effort: { weight: 5.0, time: 5.0, space: 5.0, flow: 5.0 },
        acoustic: { hardness: 5.0, moisture: 5.0, freq_norm: 5.0, decay: 5.0, freq_hz: 0 },
        extended: { reynolds_norm: 5.0, boyle: 5.0, temp_ord: 5.0, color_hex: "#6366f1" },
        phrasing: { accent: 5.0, contour: 5.0, meter: 4, regularity: 5 }
    };
    
    let weightOffset = 0;
    let timeOffset = 0;
    let spaceOffset = 0;
    let flowOffset = 0;
    let hardnessOffset = 0;
    let moistureOffset = 0;
    let freqOffset = 0;
    let decayOffset = 0;
    let reynoldsOffset = 0;
    let boyleOffset = 0;
    let tempOffset = 0;
    
    const len = query.length;
    if (len === 0) return est;
    
    for (let i = 0; i < len; i++) {
        const char = query[i];
        
        // Consonant features (Sound Symbolism)
        if (/[がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ]/.test(char)) {
            weightOffset += 1.8;
            hardnessOffset += 1.2;
            reynoldsOffset += 1.5;
            freqOffset -= 1.5;
            boyleOffset += 1.5;
            tempOffset += 0.5;
        } else if (/[ぱぴぷぺぽパピプペポ]/.test(char)) {
            hardnessOffset += 1.5;
            timeOffset += 1.5;
            weightOffset += 0.2;
            boyleOffset += 0.5;
        } else if (/[さしすせそざじずぜぞつちサシスセソザジズゼゾツチ]/.test(char)) {
            reynoldsOffset += 2.0;
            flowOffset += 0.5;
        } else if (/[まみむめもなにぬねのらりるれろわマミムメモナニヌネノラリルレロワ]/.test(char)) {
            flowOffset += 1.5;
            hardnessOffset -= 1.0;
            moistureOffset += 1.0;
        }
        
        // Vowel features
        if (/[あかさたなはまやらわがざだばぱアカサタナハマヤラワガザダバパァヵ]/.test(char)) {
            spaceOffset += 1.0;
            freqOffset -= 0.5;
            tempOffset += 0.8;
        } else if (/[いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピィ]/.test(char)) {
            spaceOffset -= 1.5;
            freqOffset += 2.0;
            tempOffset -= 1.0;
            hardnessOffset += 0.5;
        } else if (/[うくすつぬふむゆるぐずづぶぷウクスツヌフムユルグズヅブプゥ]/.test(char)) {
            spaceOffset -= 0.5;
            freqOffset -= 0.2;
            tempOffset -= 0.2;
        } else if (/[おこそとのほもよろごぞどぼぽオコソトノホモヨロゴゾドボポォ]/.test(char)) {
            spaceOffset += 1.5;
            freqOffset -= 1.0;
            weightOffset += 0.8;
            tempOffset += 0.4;
        }
        
        // Special moras
        if (char === 'っ' || char === 'ッ') {
            timeOffset += 3.0;
            decayOffset += 3.0;
            hardnessOffset += 1.0;
        } else if (char === 'ん' || char === 'ン') {
            moistureOffset += 2.0;
            flowOffset += 1.0;
            decayOffset -= 1.0;
        } else if (char === 'ー') {
            timeOffset -= 2.5;
            decayOffset -= 3.0;
            flowOffset += 1.5;
        }
    }
    
    // Average offsets over word length to keep scaling balanced
    const scale = Math.sqrt(len);
    est.effort.weight = Math.min(Math.max(5.0 + weightOffset / scale, 1.0), 9.0);
    est.effort.time = Math.min(Math.max(5.0 + timeOffset / scale, 1.0), 9.0);
    est.effort.space = Math.min(Math.max(5.0 + spaceOffset / scale, 1.0), 9.0);
    est.effort.flow = Math.min(Math.max(5.0 + flowOffset / scale, 1.0), 9.0);
    
    est.acoustic.hardness = Math.min(Math.max(5.0 + hardnessOffset / scale, 1.0), 9.0);
    est.acoustic.moisture = Math.min(Math.max(5.0 + moistureOffset / scale, 1.0), 9.0);
    est.acoustic.freq_norm = Math.min(Math.max(5.0 + freqOffset / scale, 1.0), 9.0);
    est.acoustic.decay = Math.min(Math.max(5.0 + decayOffset / scale, 1.0), 9.0);
    
    est.extended.reynolds_norm = Math.min(Math.max(5.0 + reynoldsOffset / scale, 1.0), 9.0);
    est.extended.boyle = Math.min(Math.max(5.0 + boyleOffset / scale, 1.0), 9.0);
    est.extended.temp_ord = Math.min(Math.max(5.0 + tempOffset / scale, 1.0), 9.0);
    
    est.acoustic.freq_hz = 130.0 * Math.pow(1.5, est.acoustic.freq_norm * 0.33);
    
    // Set Meter based on repeating patterns (reduplication)
    const halfLen = Math.floor(len / 2);
    const firstHalf = query.substring(0, halfLen);
    const secondHalf = query.substring(halfLen);
    if (firstHalf === secondHalf && len >= 4) {
        est.phrasing.meter = 6;
        est.phrasing.regularity = 7;
    } else if (/[っッ]/.test(query)) {
        est.phrasing.meter = 2;
        est.phrasing.regularity = 8;
    } else {
        est.phrasing.meter = 4;
        est.phrasing.regularity = 5;
    }
    
    est.phrasing.accent = est.effort.weight;
    est.phrasing.contour = Math.min(Math.max(5.0 - freqOffset / scale, 1.0), 9.0);
    
    // 3. Find 3 Nearest Neighbors in Corpus (using Levenshtein)
    let candidates = ONOMA_DICT.map(item => {
        return {
            item: item,
            dist: levenshteinDistance(query, item.word)
        };
    });
    
    candidates.sort((a, b) => a.dist - b.dist);
    const neighbors = candidates.slice(0, 3);
    
    // Blend neighbor average with phonetic estimation
    if (neighbors.length > 0) {
        let avg = {
            weight: 0, time: 0, space: 0, flow: 0,
            hardness: 0, moisture: 0, freq_norm: 0, decay: 0,
            reynolds: 0, boyle: 0, temp: 0
        };
        
        let totalWeight = 0;
        neighbors.forEach(n => {
            const w_n = 1.0 / (n.dist + 1);
            totalWeight += w_n;
            avg.weight += n.item.effort.weight * w_n;
            avg.time += n.item.effort.time * w_n;
            avg.space += n.item.effort.space * w_n;
            avg.flow += n.item.effort.flow * w_n;
            
            avg.hardness += n.item.acoustic.hardness * w_n;
            avg.moisture += n.item.acoustic.moisture * w_n;
            avg.freq_norm += n.item.acoustic.freq_norm * w_n;
            avg.decay += n.item.acoustic.decay * w_n;
            
            avg.reynolds += n.item.extended.reynolds_norm * w_n;
            avg.boyle += (n.item.extended.boyle || 0) * w_n;
            avg.temp += n.item.extended.temp_ord * w_n;
        });
        
        avg.weight /= totalWeight;
        avg.time /= totalWeight;
        avg.space /= totalWeight;
        avg.flow /= totalWeight;
        avg.hardness /= totalWeight;
        avg.moisture /= totalWeight;
        avg.freq_norm /= totalWeight;
        avg.decay /= totalWeight;
        avg.reynolds /= totalWeight;
        avg.boyle /= totalWeight;
        avg.temp /= totalWeight;
        
        const closestDist = neighbors[0].dist;
        let neighborBlendRatio = 0.65;
        if (closestDist > 3) {
            neighborBlendRatio = 0.25; // Far neighbors, rely mostly on rules
        } else if (closestDist === 0) {
            neighborBlendRatio = 1.0;
        }
        
        const ruleRatio = 1.0 - neighborBlendRatio;
        
        est.effort.weight = est.effort.weight * ruleRatio + avg.weight * neighborBlendRatio;
        est.effort.time = est.effort.time * ruleRatio + avg.time * neighborBlendRatio;
        est.effort.space = est.effort.space * ruleRatio + avg.space * neighborBlendRatio;
        est.effort.flow = est.effort.flow * ruleRatio + avg.flow * neighborBlendRatio;
        
        est.acoustic.hardness = est.acoustic.hardness * ruleRatio + avg.hardness * neighborBlendRatio;
        est.acoustic.moisture = est.acoustic.moisture * ruleRatio + avg.moisture * neighborBlendRatio;
        est.acoustic.freq_norm = est.acoustic.freq_norm * ruleRatio + avg.freq_norm * neighborBlendRatio;
        est.acoustic.decay = est.acoustic.decay * ruleRatio + avg.decay * neighborBlendRatio;
        
        est.extended.reynolds_norm = est.extended.reynolds_norm * ruleRatio + avg.reynolds * neighborBlendRatio;
        est.extended.boyle = est.extended.boyle * ruleRatio + avg.boyle * neighborBlendRatio;
        est.extended.temp_ord = est.extended.temp_ord * ruleRatio + avg.temp * neighborBlendRatio;
        
        est.acoustic.freq_hz = 130.0 * Math.pow(1.5, est.acoustic.freq_norm * 0.33);
    }
    
    // Round values
    est.effort.weight = Math.round(est.effort.weight * 10) / 10;
    est.effort.time = Math.round(est.effort.time * 10) / 10;
    est.effort.space = Math.round(est.effort.space * 10) / 10;
    est.effort.flow = Math.round(est.effort.flow * 10) / 10;
    est.acoustic.hardness = Math.round(est.acoustic.hardness * 10) / 10;
    est.acoustic.moisture = Math.round(est.acoustic.moisture * 10) / 10;
    est.acoustic.freq_norm = Math.round(est.acoustic.freq_norm * 10) / 10;
    est.acoustic.decay = Math.round(est.acoustic.decay * 10) / 10;
    est.extended.reynolds_norm = Math.round(est.extended.reynolds_norm * 10) / 10;
    est.extended.boyle = Math.round(est.extended.boyle * 10) / 10;
    est.extended.temp_ord = Math.round(est.extended.temp_ord * 10) / 10;
    
    // Hex color generator from temp and moisture
    const r = Math.min(Math.max(Math.floor((est.extended.temp_ord / 9) * 200 + (est.acoustic.hardness / 9) * 55), 0), 255);
    const g = Math.min(Math.max(Math.floor(80 + (est.effort.flow / 9) * 80 - (est.extended.temp_ord / 9) * 50), 0), 255);
    const b = Math.min(Math.max(Math.floor(255 - (est.extended.temp_ord / 9) * 150 + (est.acoustic.moisture / 9) * 50), 0), 255);
    
    const componentToHex = (c) => {
        const hex = c.toString(16);
        return hex.length == 1 ? "0" + hex : hex;
    };
    est.extended.color_hex = "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    
    est.rationale = `未開拓の言葉「${query}」を音象徴特徴およびコーパスの近傍語（${neighbors.map(n => n.item.word).join(', ')}）から推定した物理モデリング。`;
    est.ipa_clean = query;
    est.word = query;
    
    return est;
}

// Populate datalist and bind UI events
function initUI() {
    const list = document.getElementById('onomato-list');
    const input = document.getElementById('onomato-input');
    const btnExecute = document.getElementById('btn-execute');
    const btnClear = document.getElementById('btn-clear');
    const btnRandom = document.getElementById('btn-random');

    // Populate suggestions
    ONOMA_DICT.forEach(item => {
        const option = document.createElement('option');
        option.value = item.word;
        list.appendChild(option);
    });

    // Lazy initialize AudioContext on first user interaction
    const initAudioOnInteraction = () => {
        onomaSynth.init();
    };

    // Execute input
    const triggerExecute = () => {
        initAudioOnInteraction();
        const query = input.value.trim();
        if (!query) return;

        const found = ONOMA_DICT.find(item => item.word === query);
        if (found) {
            selectWord(found);
        } else {
            // Predict parameters dynamically for unregistered words
            const estimated = estimateWordParameters(query);
            selectWord(estimated);
        }
    };

    btnExecute.addEventListener('click', triggerExecute);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            triggerExecute();
        }
    });

    // Reset / Clear input
    if (btnClear) {
        btnClear.addEventListener('click', () => {
            initAudioOnInteraction();
            input.value = '';
            activeWord = null;
            const infoSec = document.getElementById('info-section');
            if (infoSec) infoSec.style.display = 'none';
            resetNodesToBaseline();
        });
    }

    // Pick random word
    btnRandom.addEventListener('click', () => {
        initAudioOnInteraction();
        const randomIndex = Math.floor(Math.random() * ONOMA_DICT.length);
        const randomWord = ONOMA_DICT[randomIndex];
        input.value = randomWord.word;
        selectWord(randomWord);
    });
}

// Reset nodes and physical state
function resetNodesToBaseline() {
    animationTime = 0;
    lastBeatIndex = -1;
    for (let i = 0; i < 4; i++) {
        currentPositions[i].copy(baselinePositions[i]);
        nodes[i].position.copy(baselinePositions[i]);
        velocities[i].set(0, 0, 0);
        activeForces[i].set(0, 0, 0);
    }
    updatePlaneAndOutline();
}

// Select word and update panels/visual parameters
function selectWord(word) {
    resetNodesToBaseline();
    
    activeWord = word;

    // Show metadata display (null-safe)
    const infoSection = document.getElementById('info-section');
    if (infoSection) infoSection.style.display = 'flex';

    const infoWord = document.getElementById('info-word');
    if (infoWord) infoWord.textContent = word.word;

    const infoIpa = document.getElementById('info-ipa');
    if (infoIpa) infoIpa.textContent = `[${word.ipa_clean || word.ipa_original}]`;

    const infoRationale = document.getElementById('info-rationale');
    if (infoRationale) infoRationale.textContent = word.rationale;

    // Set badges and sliders
    updateUIBadge('x1', word.effort.weight);
    updateUIBadge('x2', word.effort.time);
    updateUIBadge('x3', word.effort.space);
    updateUIBadge('x4', word.effort.flow);

    updateUIBadge('x5', word.acoustic.hardness);
    updateUIBadge('x6', word.acoustic.moisture);
    updateUIBadge('x7', Math.round(word.acoustic.freq_norm));
    updateUIBadge('x8', word.acoustic.decay);

    updateUIBadge('x9', Math.round(word.extended.reynolds_norm));
    updateUIBadge('x10', word.extended.boyle);
    updateUIBadge('x11', word.extended.temp_ord);

    updateUIBadge('x13', word.phrasing.accent);
    updateUIBadge('x14', word.phrasing.contour);
    updateUIBadge('x15', word.phrasing.meter);
    updateUIBadge('x16', word.phrasing.regularity);

    // Apply color
    const colorHex = word.extended.color_hex || '#6366f1';
    const color = new THREE.Color(colorHex);
    
    const colorBadge = document.getElementById('info-color-badge');
    if (colorBadge) colorBadge.style.backgroundColor = colorHex;

    // Update material colors
    nodes.forEach(node => {
        node.material.color.copy(color);
        node.material.emissive.copy(color);
    });
    planeMesh.material.color.copy(color);
    lineOutline.material.color.copy(color).addScalar(0.2);

    // Update Synthesizer parameters (FX)
    onomaSynth.setMoisture(word.acoustic.moisture);
    onomaSynth.setBoyle(word.extended.boyle || 0);
}

function updateUIBadge(id, value) {
    const valEl = document.getElementById(`val-${id}`);
    if (valEl) {
        valEl.textContent = value;
    }
    const fillEl = document.getElementById(`fill-${id}`);
    if (fillEl) {
        const percentage = Math.min(Math.max((value / 9) * 100, 0), 100);
        fillEl.style.width = `${percentage}%`;
    }
}

// Update BufferGeometries of plane and line, and sync sphere node positions
function updatePlaneAndOutline() {
    const posAttr = planeMesh.geometry.attributes.position;
    for (let i = 0; i < 4; i++) {
        posAttr.setXYZ(i, currentPositions[i].x, currentPositions[i].y, currentPositions[i].z);
        if (nodes[i]) {
            nodes[i].position.copy(currentPositions[i]);
        }
    }
    posAttr.needsUpdate = true;
    planeMesh.geometry.computeVertexNormals();

    const linePosAttr = lineOutline.geometry.attributes.position;
    for (let i = 0; i < 4; i++) {
        linePosAttr.setXYZ(i, currentPositions[i].x, currentPositions[i].y, currentPositions[i].z);
    }
    linePosAttr.setXYZ(4, currentPositions[0].x, currentPositions[0].y, currentPositions[0].z);
    linePosAttr.needsUpdate = true;
}

// Physics simulation step with integrated sub-beat trigger
function updatePhysics(dt) {
    if (!activeWord) return;

    // Parameters
    const w = activeWord.effort.weight;
    const t_att = activeWord.effort.time;
    const sp = activeWord.effort.space;
    const fl = activeWord.effort.flow;
    const hd = activeWord.acoustic.hardness;
    const re = activeWord.extended.reynolds_norm;
    const dc = activeWord.acoustic.decay;
    const by = activeWord.extended.boyle || 0;
    const x13 = activeWord.phrasing.accent;
    const mt = activeWord.phrasing.meter;
    const rg = activeWord.phrasing.regularity;

    const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボ]/.test(activeWord.word);

    // Loop frequency & beat subdivision
    const baseFreq = 0.4 + mt * 0.25;
    const T = 1.0 / baseFreq;
    const N = 1 + Math.floor(mt / 3.0); // Beats per cycle (Meter x15 determines repetition)
    const T_beat = T / N;

    // Time progression with regularity jitter
    const jitter = (Math.random() - 0.5) * (rg / 9.0) * 0.05;
    animationTime += dt + jitter;

    // 1. FRAME-ACCURATE AUDIO TRIGGER SYNCHRONIZATION
    // Check if the timeline crossed sub-beat thresholds and play sound
    const currentBeatIndex = Math.floor(animationTime / T_beat);
    if (lastBeatIndex === -1) {
        onomaSynth.playNote(0, N, activeWord);
        lastBeatIndex = 0;
    } else if (currentBeatIndex > lastBeatIndex) {
        for (let b = lastBeatIndex + 1; b <= currentBeatIndex; b++) {
            onomaSynth.playNote(b % N, N, activeWord);
        }
        lastBeatIndex = currentBeatIndex;
    }

    // 2. RUN PHYSICS SIMULATION SUB-STEPS
    const maxDt = 0.03;
    const subSteps = 4;
    const stepDt = Math.min(dt, maxDt) / subSteps;

    // Rest length contraction based on Tension
    const tensionRatio = (fl * 0.05 + by * 0.04);
    const restSide = 4.0 * (1.0 - Math.min(tensionRatio, 0.65));
    const restDiag = Math.sqrt(2) * restSide;

    for (let step = 0; step < subSteps; step++) {
        
        let accumulatedForces = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

        // Relational calculations with the other 3 nodes
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                if (i === j) continue;

                const posI = currentPositions[i];
                const posJ = currentPositions[j];
                const velI = velocities[i];
                const velJ = velocities[j];

                const vecIJ = new THREE.Vector3().subVectors(posI, posJ);
                const dist = vecIJ.length();
                if (dist === 0) continue;
                const dir = vecIJ.clone().normalize();

                const indexDiff = Math.abs(i - j);
                const isAdjacent = (indexDiff === 1 || indexDiff === 3);
                const currentRestLen = isAdjacent ? restSide : restDiag;

                // Pairwise Spring Coupling
                const k_relation = hd * 1.5;
                const F_spring = dir.clone().multiplyScalar( -(dist - currentRestLen) * k_relation );
                accumulatedForces[i].add(F_spring);

                // Relative Damping (Shear Damping / Staggered sequence)
                const c_relative = fl * 0.45;
                const velDiff = new THREE.Vector3().subVectors(velI, velJ);
                const F_relative_damping = velDiff.multiplyScalar( -c_relative );
                accumulatedForces[i].add(F_relative_damping);

                // Pairwise Twisting Torque
                const twistDrive = (40.0 + w * 55.0) * (1.0 - fl * 0.08) * 0.16 * (1.0 - sp / 9.0);
                const tangent = new THREE.Vector3(dir.z, 0, -dir.x).normalize();
                const twistSign = (i % 2 === 0) ? 1.0 : -1.0;
                const F_twist = tangent.multiplyScalar(twistDrive * twistSign);
                accumulatedForces[i].add(F_twist);
            }
        }

        // Apply external forces on nodes
        for (let i = 0; i < 4; i++) {
            const pos = currentPositions[i];
            const vel = velocities[i];
            const basePos = baselinePositions[i];
            
            let force = new THREE.Vector3();

            // Relational forces
            force.add(accumulatedForces[i]);

            // Home Anchor
            const k_home = 1.0;
            const F_home = new THREE.Vector3().subVectors(basePos, pos).multiplyScalar(k_home);
            force.add(F_home);

            // Drag
            const dragLinear = 0.8 / (1.0 + re * 0.25) + fl * 0.2;
            const dragQuadratic = re * 0.03;
            const speed = vel.length();
            const F_drag = vel.clone().multiplyScalar( -(dragLinear + dragQuadratic * speed) );
            force.add(F_drag);

            // Turbulence / Grainy vibration
            if (re > 1) {
                const isHighReynolds = re >= 4;
                const timeScale = isHighReynolds ? 95.0 : 45.0; // Higher frequency for fine grain vibrations
                const noiseAmp = (re / 9.0) * (isHighReynolds ? 5.5 : 3.5) * (1.0 + speed * 0.5);
                const F_turbulent = new THREE.Vector3(
                    Math.sin(animationTime * timeScale + i * 17.0) * Math.cos(animationTime * timeScale * 0.8),
                    Math.cos(animationTime * timeScale + i * 23.0) * Math.sin(animationTime * timeScale * 1.2),
                    Math.sin(animationTime * timeScale * 1.5 + i * 31.0)
                ).multiplyScalar(noiseAmp);
                force.add(F_turbulent);
            }

            // Motor drive forces (aligned with beat phase)
            const phaseDelay = i * (Math.PI / 2) * (1.0 - hd / 9.0);
            const nodeTime = animationTime - (phaseDelay / (Math.PI * 2 * baseFreq));
            
            // Sub-beat envelope
            const s = ((nodeTime % T_beat) + T_beat) % T_beat / T_beat;

            const forceAmp = (40.0 + w * 55.0) * (1.0 - fl * 0.08);
            const accentShift = (x13 / 9.0) * 0.45;
            const s_shifted = (s + 1.0 - accentShift) % 1.0;
            
            const ratioSudden = t_att / 9.0;
            let driveEnvelope = 0;

            if (s_shifted < 0.15) {
                const kickProgress = s_shifted / 0.15;
                const kickEnv = Math.sin(kickProgress * Math.PI) * Math.exp(-dc * 0.3 * kickProgress);
                driveEnvelope += ratioSudden * kickEnv * 2.5;
            }

            const waveEnv = Math.sin(s_shifted * Math.PI * 2);
            driveEnvelope += (1.0 - ratioSudden) * waveEnv;

            const spaceRatio = sp / 9.0;
            const F_drive_y = driveEnvelope * forceAmp;
            
            const rotAngle = animationTime * baseFreq * Math.PI * 2 + i * Math.PI / 2;
            const F_drive_x = Math.cos(rotAngle) * driveEnvelope * forceAmp * 0.9 * (1.0 - spaceRatio);
            const F_drive_z = Math.sin(rotAngle) * driveEnvelope * forceAmp * 0.9 * (1.0 - spaceRatio);

            const F_drive = new THREE.Vector3(F_drive_x, F_drive_y, F_drive_z);
            force.add(F_drive);

            // Plosive outward burst force
            if (isPlosive && s_shifted < 0.12) {
                const burstProgress = s_shifted / 0.12;
                const burstEnv = Math.sin(burstProgress * Math.PI) * Math.exp(-burstProgress * 3.0);
                const radialDir = currentPositions[i].clone().normalize();
                const F_burst = radialDir.multiplyScalar(burstEnv * forceAmp * 3.5);
                force.add(F_burst);
            }

            // Gravity sag
            force.y += -w * 3.0;

            // Integration
            const mass = 1.0 + w * 0.4;
            const accel = force.divideScalar(mass);
            
            velocities[i].addScaledVector(accel, stepDt);
            
            const maxSpeed = 35.0;
            if (velocities[i].length() > maxSpeed) {
                velocities[i].setLength(maxSpeed);
            }

            currentPositions[i].addScaledVector(velocities[i], stepDt);
        }
    }

    updatePlaneAndOutline();
}

// Render loop
function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();
    updatePhysics(dt);

    controls.update();
    renderer.render(scene, camera);
}

// Handle resizing
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

// Auto-initialize when DOM content is loaded
window.addEventListener('DOMContentLoaded', () => {
    initThree();
    initUI();
});
