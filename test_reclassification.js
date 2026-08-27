// test_reclassification.js - Source-Filter & Kinematic Taxonomy Classifier Test

const dictData = require('./onomatopoeia_dictionary.js');

class SourceFilterKinematicClassifier {
    constructor() {
        this.dictionary = dictData || [];
    }

    classify(query) {
        if (!query) return null;
        const clean = query.trim();

        // 1. Phonetic Features Analysis
        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボタチツテトダヂヅデドカキクケコガギグゲゴ]/.test(clean);
        const isFricative = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチハヒフヘホ]/.test(clean);
        const isNasal = /[まみむめもなにぬねのんマミムメモナニヌネノン]/.test(clean);
        const isSokuon = /[っッ]/.test(clean);
        const isLongVowel = /[ー]/.test(clean);
        const isReduplicated = (clean.length >= 4 && clean.substring(0, Math.floor(clean.length / 2)) === clean.substring(Math.floor(clean.length / 2)));

        // Articulatory Location
        let articulatoryCenter = 'CENTRAL'; // Default
        if (/[ぱぴぷぺぽばびぶべぼマミムメモパピプペポバビブベボ]/.test(clean)) {
            articulatoryCenter = 'BILABIAL_FRONT'; // 唇（前部）
        } else if (/[さしすせそざじずぜぞつちタチツテトダヂヅデド]/.test(clean)) {
            articulatoryCenter = 'ALVEOLAR_MID'; // 歯茎・硬口蓋（中央）
        } else if (/[カキクケコガギグゲゴ]/.test(clean)) {
            articulatoryCenter = 'VELAR_BACK'; // 軟口蓋（奥部）
        }

        // 2. Source & Drive Mapping
        let sourceType = 'VOICED_PERIODIC';
        if (isFricative && !/[ざじずぜぞ]/.test(clean)) sourceType = 'UNVOICED_NOISE';
        if (isPlosive) sourceType = 'TRANSIENT_BURST';

        let impulseType = isPlosive || isSokuon ? 'SUDDEN_KICK' : (isLongVowel ? 'SUSTAINED_DRIFT' : 'MODULATED_WAVE');

        // 3. Filter & Topology Kinematics
        let radialBurstAmp = isPlosive ? 2.5 : 0.2;
        let linearDriftAmp = isLongVowel || isFricative ? 2.0 : 0.5;
        let phaseOffsetWave = isNasal || isFricative ? 1.5 : 0.2;
        let sokuonPauseTime = isSokuon ? 0.12 : 0.0;

        // 4. Return Structured Taxonomy Map
        return {
            word: clean,
            phonetics: {
                articulatoryCenter,
                isPlosive,
                isFricative,
                isNasal,
                isSokuon,
                isReduplicated
            },
            source: {
                type: sourceType,
                impulseType,
                baseFreqHz: isPlosive ? 180 : (isFricative ? 320 : 130),
                turbulenceNoiseAmp: isFricative ? 3.5 : (isPlosive ? 1.2 : 0.3)
            },
            filterTopology: {
                articulatoryBias: articulatoryCenter,
                stiffnessK: isPlosive ? 8.5 : (isNasal ? 2.0 : 5.0),
                dampingC: isNasal ? 4.5 : 1.2,
                sokuonTensionPause: sokuonPauseTime
            },
            kinematics: {
                radialBurstAmp,
                linearDriftAmp,
                phaseOffsetWave
            }
        };
    }
}

// Run test on representative words
const classifier = new SourceFilterKinematicClassifier();
const testWords = ['バシッ', 'がたがた', 'さらさら', 'ねばねば', 'しゅわしゅわ', 'ずっしり'];

console.log('===========================================================');
console.log(' 新・音源フィルタ運動分類体系 (Source-Filter Kinematic Taxonomy)');
console.log('===========================================================');

testWords.forEach(w => {
    const res = classifier.classify(w);
    console.log(`\n【単語: ${res.word}】`);
    console.log(`  発声部位: ${res.phonetics.articulatoryCenter}`);
    console.log(`  音源タイプ: ${res.source.type} (Impulse: ${res.source.impulseType})`);
    console.log(`  共振・剛性: Stiffness k=${res.filterTopology.stiffnessK}, Damping c=${res.filterTopology.dampingC}`);
    console.log(`  運動成分  : 放射爆発=${res.kinematics.radialBurstAmp}, 直線伸長=${res.kinematics.linearDriftAmp}, うねり位相=${res.kinematics.phaseOffsetWave}`);
});
