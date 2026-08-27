// OnomaPetSynth.js - Complete Web Audio Synthesizer Engine with Guaranteed Audible Tone & Formants

class OnomaPetSynth {
    constructor() {
        this.ctx = null;
        this.synthBus = null;
        this.reverbNode = null;
        this.delayNode = null;
        this.dryGain = null;
        this.wetGain = null;
        this.masterGain = null;
        this.noiseBuffer = null;
        this.isEnabled = true;
        this.volume = 0.6;
    }

    init() {
        if (this.ctx) {
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    console.log("[OnomaPetSynth] AudioContext resumed successfully.");
                }).catch(e => console.error(e));
            }
            return;
        }

        try {
            if (typeof window === 'undefined') return;
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContextClass();

            // Reverb buffer
            this.reverbNode = this.ctx.createConvolver();
            this.reverbNode.buffer = this.createReverbBuffer(1.2, 2.0);

            // Delay line
            this.delayNode = this.ctx.createDelay(1.0);
            this.delayFeedback = this.ctx.createGain();
            this.delayNode.delayTime.value = 0.18;
            this.delayFeedback.gain.value = 0.2;
            this.delayNode.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delayNode);

            // Master Gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = this.volume;

            // Synth Bus
            this.synthBus = this.ctx.createGain();
            this.synthBus.gain.value = 1.0;

            // FX Mix
            this.dryGain = this.ctx.createGain();
            this.wetGain = this.ctx.createGain();
            this.dryGain.gain.value = 0.85;
            this.wetGain.gain.value = 0.15;

            // Routing
            this.synthBus.connect(this.dryGain);

            this.synthBus.connect(this.reverbNode);
            this.reverbNode.connect(this.wetGain);

            this.synthBus.connect(this.delayNode);
            this.delayNode.connect(this.wetGain);

            this.dryGain.connect(this.masterGain);
            this.wetGain.connect(this.masterGain);
            this.masterGain.connect(this.ctx.destination);

            this.noiseBuffer = this.createNoiseBuffer(2.0);

            console.log("[OnomaPetSynth] Web Audio Context initialized successfully.");
        } catch (e) {
            console.error("[OnomaPetSynth] Failed to init AudioContext:", e);
        }
    }

    setMuted(muted) {
        this.isEnabled = !muted;
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.setValueAtTime(this.isEnabled ? this.volume : 0.0, this.ctx.currentTime);
        }
    }

    setVolume(val) {
        this.volume = Math.min(Math.max(val, 0), 1);
        if (this.masterGain && this.ctx && this.isEnabled) {
            this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
        }
    }

    createReverbBuffer(duration, decay) {
        const sampleRate = this.ctx.sampleRate;
        const len = sampleRate * duration;
        const buffer = this.ctx.createBuffer(2, len, sampleRate);
        for (let c = 0; c < 2; c++) {
            const data = buffer.getChannelData(c);
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

    setMoisture(ms) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const wetRatio = (ms / 9.0) * 0.4;
        const dryRatio = 1.0 - wetRatio * 0.2;
        if (this.wetGain && this.dryGain) {
            this.wetGain.gain.setTargetAtTime(wetRatio, now, 0.05);
            this.dryGain.gain.setTargetAtTime(dryRatio, now, 0.05);
        }
    }

    setBoyle(by) {
        // Reserved
    }

    createFormantFilter(sourceNode, vowel, outputNode, now) {
        const FORMANT_MAP = {
            'a': [{ f: 800, q: 4, g: 0.8 }, { f: 1200, q: 5, g: 0.6 }, { f: 2500, q: 4, g: 0.3 }],
            'i': [{ f: 320, q: 5, g: 0.8 }, { f: 2300, q: 6, g: 0.5 }, { f: 3000, q: 4, g: 0.3 }],
            'u': [{ f: 320, q: 4, g: 0.8 }, { f: 1200, q: 4, g: 0.4 }, { f: 2500, q: 4, g: 0.2 }],
            'e': [{ f: 500, q: 4, g: 0.8 }, { f: 1900, q: 5, g: 0.5 }, { f: 2500, q: 4, g: 0.3 }],
            'o': [{ f: 500, q: 4, g: 0.8 }, { f: 800, q: 5, g: 0.6 }, { f: 2500, q: 4, g: 0.2 }]
        };

        const formants = FORMANT_MAP[vowel] || FORMANT_MAP['u'];
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
        if (!this.isEnabled) return;
        if (!this.ctx) this.init();
        if (!this.ctx) return;

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        const w = word.effort ? word.effort.weight : 5;
        const t_att = word.effort ? word.effort.time : 5;
        const fl = word.effort ? word.effort.flow : 5;
        const hd = word.acoustic ? word.acoustic.hardness : 5;
        const re = word.extended ? word.extended.reynolds_norm : 5;
        const dc = word.acoustic ? word.acoustic.decay : 5;
        const co = word.phrasing ? word.phrasing.contour : 5;

        const wordText = word.word || "";
        const isSibilant = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチ]/.test(wordText);
        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボ]/.test(wordText);

        const getVowelForChar = (char) => {
            if (/[あかさたなはまやらわがざだばぱアカサタナハマヤラワガザダバパァヵ]/.test(char)) return 'a';
            if (/[いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピィ]/.test(char)) return 'i';
            if (/[うくすつぬふむゆるぐずづぶぷウクスツヌフムユルグズヅブプゥッ]/.test(char)) return 'u';
            if (/[えけせてねへめれげぜでべぺエケセテネヘメレゲゼデベペェヶ]/.test(char)) return 'e';
            if (/[おこそとのほもよろごぞどぼぽオコソトノホモヨロゴゾドボポォ]/.test(char)) return 'o';
            return 'u';
        };

        const cleanChars = wordText.replace(/[っッー]/g, '').split('');
        const charIndex = Math.min(beatIndex, Math.max(cleanChars.length - 1, 0));
        const char = cleanChars[charIndex] || '';
        const vowel = getVowelForChar(char);

        // Pitch Freq
        let pitchFreq = (word.acoustic && word.acoustic.freq_hz) ? word.acoustic.freq_hz : 160.0 * Math.pow(1.4, (word.acoustic ? word.acoustic.freq_norm : 5) * 0.33);

        let attackTime = 0.005 + (9 - t_att) * 0.025;
        let decayTime = 0.06 + (9 - dc) * 0.08;
        let sustainLevel = Math.max((9 - dc) * 0.1, 0.1);
        let releaseTime = 0.08 + (9 - dc) * 0.12;

        if (totalBeats > 1) {
            decayTime *= 0.7;
            releaseTime *= 0.7;
        }

        // Long Vowel ('ー'): Extend note decay & sustain (half speed stretch)
        const hasLongVowel = /[ー]/.test(wordText);
        if (hasLongVowel) {
            decayTime *= 2.2;
            releaseTime *= 2.5;
            sustainLevel *= 1.4;
        }

        const noteDuration = attackTime + decayTime + releaseTime;

        // Master Note Envelope
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0.0001, now);
        voiceGain.gain.linearRampToValueAtTime(0.5 + w * 0.05, now + attackTime);
        voiceGain.gain.exponentialRampToValueAtTime(Math.max(sustainLevel * 0.5, 0.001), now + attackTime + decayTime);
        voiceGain.gain.exponentialRampToValueAtTime(0.00001, now + noteDuration);

        // Lowpass filter for tone smoothing
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const cutoff = Math.min(pitchFreq * (2.0 + hd * 1.0), 10000);
        filter.frequency.setValueAtTime(cutoff, now);

        // 1. Primary Tone Generator (Sawtooth / Triangle with rich harmonics)
        const osc = this.ctx.createOscillator();
        osc.type = hd > 4 ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(pitchFreq, now);

        if (co < 4) {
            osc.frequency.exponentialRampToValueAtTime(pitchFreq * 1.3, now + noteDuration * 0.7);
        } else if (co > 6) {
            osc.frequency.exponentialRampToValueAtTime(pitchFreq * 0.7, now + noteDuration * 0.7);
        }

        osc.connect(filter);
        osc.start(now);
        osc.stop(now + noteDuration + 0.1);

        // 2. Extra Sub/Modal Oscillator for High Hardness
        if (hd >= 5) {
            const subOsc = this.ctx.createOscillator();
            subOsc.type = 'sawtooth';
            subOsc.frequency.setValueAtTime(pitchFreq * 1.5, now);

            const subGain = this.ctx.createGain();
            subGain.gain.setValueAtTime(0.2, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

            subOsc.connect(subGain);
            subGain.connect(filter);

            subOsc.start(now);
            subOsc.stop(now + decayTime + 0.05);
        }

        // 3. Fricative Noise for Sibilants (/s, z, sh/)
        if (isSibilant && this.noiseBuffer) {
            const noiseNode = this.ctx.createBufferSource();
            noiseNode.buffer = this.noiseBuffer;
            noiseNode.loop = true;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.setValueAtTime(3500.0, now);

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(0.0, now);
            noiseGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
            noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + attackTime + decayTime);

            noiseNode.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.synthBus);

            noiseNode.start(now);
            noiseNode.stop(now + attackTime + decayTime + 0.05);
        }

        // 4. Plosive Burst Pop (/p, b, t, d/)
        if (isPlosive) {
            const popOsc = this.ctx.createOscillator();
            const popGain = this.ctx.createGain();
            popOsc.frequency.setValueAtTime(150.0, now);
            popOsc.frequency.exponentialRampToValueAtTime(30.0, now + 0.04);

            popGain.gain.setValueAtTime(0.0, now);
            popGain.gain.linearRampToValueAtTime(0.8, now + 0.002);
            popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

            popOsc.connect(popGain);
            popGain.connect(this.synthBus);

            popOsc.start(now);
            popOsc.stop(now + 0.05);
        }

        // Connect Tone Generator to Voice Gain
        filter.connect(voiceGain);

        // DIRECT AUDIBLE PATH (Guarantees fundamental pitch F0 is 100% audible)
        const directGain = this.ctx.createGain();
        directGain.gain.setValueAtTime(0.6, now);
        voiceGain.connect(directGain);
        directGain.connect(this.synthBus);

        // FORMANT RESONANCE PATH
        const formantInput = this.ctx.createGain();
        formantInput.gain.setValueAtTime(0.4, now);
        voiceGain.connect(formantInput);

        const tremoloGain = this.ctx.createGain();
        tremoloGain.gain.setValueAtTime(1.0, now);

        this.createFormantFilter(formantInput, vowel, tremoloGain, now);
        tremoloGain.connect(this.synthBus);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnomaPetSynth;
}
