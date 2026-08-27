// OnomaPetEngine.js - Main Facade & Timeline Data Recorder

class OnomaPetEngine {
    constructor(options = {}) {
        const DictClass = typeof OnomaPetDictionary !== 'undefined' ? OnomaPetDictionary : require('./OnomaPetDictionary');
        const PhysClass = typeof OnomaPetPhysics !== 'undefined' ? OnomaPetPhysics : require('./OnomaPetPhysics');
        const SynthClass = typeof OnomaPetSynth !== 'undefined' ? OnomaPetSynth : require('./OnomaPetSynth');

        this.dictionary = new DictClass(options.dictionaryData || []);
        this.physics = new PhysClass({
            nodeCount: options.nodeCount || 1,
            spatialScale: options.spatialScale || 1.0,
            amplitudeScale: options.amplitudeScale || 1.0
        });
        this.synth = new SynthClass();

        this.historyDuration = options.historyDuration || 10.0; // 10 seconds timeline window
        this.timelineBuffer = []; // Rolling time-series data
        this.activeWord = null;
        this.isPlaying = true;
    }

    setDictionaryData(data) {
        this.dictionary.setDictionary(data);
    }

    setWord(wordOrString) {
        let wordData = null;
        if (typeof wordOrString === 'string') {
            wordData = this.dictionary.estimateParameters(wordOrString);
        } else if (typeof wordOrString === 'object' && wordOrString !== null) {
            wordData = wordOrString;
            if (!wordData.estimatedBpm) {
                wordData.estimatedBpm = this.dictionary.estimatePhoneticBpm(wordData);
            }
        }

        if (!wordData) return null;

        this.activeWord = wordData;

        // Automatically set Tempo/BPM from Phonetic Impression
        const autoBpm = wordData.estimatedBpm || 120;
        this.physics.setBpm(autoBpm);

        this.physics.setWord(wordData);
        this.synth.setMoisture(wordData.acoustic ? wordData.acoustic.moisture : 5);
        this.synth.setBoyle(wordData.extended ? wordData.extended.boyle : 0);

        this.clearHistory();
        return wordData;
    }

    setBpm(bpm) {
        if (this.physics) {
            this.physics.setBpm(bpm);
        }
    }

    clearHistory() {
        this.timelineBuffer = [];
    }

    update(dt) {
        if (!this.isPlaying || !this.activeWord) return null;

        const frameResult = this.physics.update(dt);
        if (!frameResult) return null;

        // Trigger Audio if beat occurred
        if (frameResult.beatTriggered) {
            this.synth.playNote(frameResult.beatSubIndex, frameResult.totalBeats, this.activeWord);
        }

        // Record channel snapshot for Seismograph
        const snapshot = {
            time: frameResult.time,
            // Effort channels
            weight: this.activeWord.effort.weight,
            time_att: this.activeWord.effort.time,
            space: this.activeWord.effort.space,
            flow: this.activeWord.effort.flow,
            // Acoustic & Extended
            hardness: this.activeWord.acoustic.hardness,
            reynolds: this.activeWord.extended.reynolds_norm,
            // Physics forces & displacements
            drivingY: frameResult.primaryDrivingY,
            turbulence: frameResult.primaryTurbulence,
            energy: frameResult.totalEnergy,
            beatPulse: frameResult.beatTriggered ? 1.0 : 0.0,
            // Node displacements (Y axis)
            nodeY: frameResult.displacements.map(d => d.dy)
        };

        this.timelineBuffer.push(snapshot);

        // Prune buffer outside window
        const minTime = frameResult.time - this.historyDuration;
        while (this.timelineBuffer.length > 0 && this.timelineBuffer[0].time < minTime) {
            this.timelineBuffer.shift();
        }

        return snapshot;
    }

    getTimelineBuffer() {
        return this.timelineBuffer;
    }

    getActiveWord() {
        return this.activeWord;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnomaPetEngine;
}
