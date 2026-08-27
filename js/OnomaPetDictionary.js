// OnomaPetDictionary.js - Decoupled Dictionary & Source-Filter Kinematic Taxonomy Estimator

class OnomaPetDictionary {
    constructor(dictionaryData = []) {
        this.dictionary = dictionaryData || [];
    }

    setDictionary(data) {
        this.dictionary = data;
    }

    getAllWords() {
        return this.dictionary.map(item => item.word);
    }

    findExact(wordText) {
        if (!wordText) return null;
        const cleanQuery = wordText.trim();
        return this.dictionary.find(item => item.word === cleanQuery) || null;
    }

    levenshteinDistance(str1, str2) {
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
                    track[j][i - 1] + 1,
                    track[j - 1][i] + 1,
                    track[j - 1][i - 1] + indicator
                );
            }
        }
        return track[str2.length][str1.length];
    }

    classifySourceFilter(query) {
        const clean = (query || "").trim();

        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボタチツテトダヂヅデドカキクケコガギグゲゴ]/.test(clean);
        const isFricative = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチハヒフヘホ]/.test(clean);
        const isNasal = /[まみむめもなにぬねのんマミムメモナニヌネノン]/.test(clean);
        const isSokuon = /[っッ]/.test(clean);
        const isLongVowel = /[ー]/.test(clean);
        const isReduplicated = (clean.length >= 4 && clean.substring(0, Math.floor(clean.length / 2)) === clean.substring(Math.floor(clean.length / 2)));

        let articulatoryCenter = 'CENTRAL';
        if (/[ぱぴぷぺぽばびぶべぼマミムメモパピプペポバビブベボ]/.test(clean)) {
            articulatoryCenter = 'BILABIAL_FRONT';
        } else if (/[さしすせそざじずぜぞつちタチツテトダヂヅデド]/.test(clean)) {
            articulatoryCenter = 'ALVEOLAR_MID';
        } else if (/[カキクケコガギグゲゴ]/.test(clean)) {
            articulatoryCenter = 'VELAR_BACK';
        }

        let sourceType = 'VOICED_PERIODIC';
        if (isFricative && !/[ざじずぜぞ]/.test(clean)) sourceType = 'UNVOICED_NOISE';
        if (isPlosive) sourceType = 'TRANSIENT_BURST';

        let impulseType = isPlosive || isSokuon ? 'SUDDEN_KICK' : (isLongVowel ? 'SUSTAINED_DRIFT' : 'MODULATED_WAVE');

        let radialBurstAmp = isPlosive ? 2.5 : 0.2;
        let linearDriftAmp = isLongVowel || isFricative ? 2.0 : 0.5;
        let phaseOffsetWave = isNasal || isFricative ? 1.5 : 0.2;
        let sokuonPauseTime = isSokuon ? 0.12 : 0.0;

        return {
            articulatoryCenter,
            sourceType,
            impulseType,
            stiffnessK: isPlosive ? 8.5 : (isNasal ? 2.0 : 5.0),
            dampingC: isNasal ? 4.5 : 1.2,
            radialBurstAmp,
            linearDriftAmp,
            phaseOffsetWave,
            sokuonPauseTime,
            isReduplicated
        };
    }

    estimatePhoneticBpm(wordData) {
        const w = wordData.effort ? wordData.effort.weight : 5;
        const t_att = wordData.effort ? wordData.effort.time : 5;
        const mt = (wordData.phrasing && wordData.phrasing.meter !== undefined) ? wordData.phrasing.meter : 4;
        const re = wordData.extended ? wordData.extended.reynolds_norm : 5;

        const wordText = wordData.word || '';
        let offset = 0;

        if (/[っッ]/.test(wordText) && !/[ど重ず大]/.test(wordText)) offset += 10;
        if (/[ー]/.test(wordText)) offset -= 18;
        if (/[いきしちにひみりぎじぢびぴイキシチニヒミリギジヂビピィ]/.test(wordText)) offset += 8;
        if (/[おこそとのほもよろごぞどぼぽオコソトノホモヨロゴゾドボポォ]/.test(wordText)) offset -= 12;

        // Recalibrated Human Speech BPM (Center 65, Range 40..135)
        let bpm = 65 + (t_att - 5) * 6.0 - (w - 5) * 5.0 + (mt - 4) * 3.5 + (re - 5) * 2.5 + offset;
        return Math.min(Math.max(Math.round(bpm), 40), 135);
    }

    estimateParameters(query) {
        if (!query) query = "";
        const cleanQuery = query.trim();

        const exactMatch = this.findExact(cleanQuery);
        let est = exactMatch ? JSON.parse(JSON.stringify(exactMatch)) : {
            effort: { weight: 5.0, time: 5.0, space: 5.0, flow: 5.0 },
            acoustic: { hardness: 5.0, moisture: 5.0, freq_norm: 5.0, decay: 5.0, freq_hz: 0 },
            extended: { reynolds_norm: 5.0, boyle: 5.0, temp_ord: 5.0, color_hex: "#6366f1" },
            phrasing: { accent: 5.0, contour: 5.0, meter: 4, regularity: 5 }
        };

        if (!exactMatch) {
            let weightOffset = 0, timeOffset = 0, spaceOffset = 0, flowOffset = 0;
            let hardnessOffset = 0, moistureOffset = 0, freqOffset = 0, decayOffset = 0;
            let reynoldsOffset = 0, boyleOffset = 0, tempOffset = 0;

            const len = cleanQuery.length;
            if (len > 0) {
                for (let i = 0; i < len; i++) {
                    const char = cleanQuery[i];
                    if (/[がぎぐげござじずぜぞだぢづでどばびぶべぼガギグゲゴザジズゼゾダヂヅデドバビブベボ]/.test(char)) {
                        weightOffset += 1.8; hardnessOffset += 1.2; reynoldsOffset += 1.5; freqOffset -= 1.5; boyleOffset += 1.5; tempOffset += 0.5;
                    } else if (/[ぱぴぷぺぽパピプペポ]/.test(char)) {
                        hardnessOffset += 1.5; timeOffset += 1.5; weightOffset += 0.2; boyleOffset += 0.5;
                    } else if (/[さしすせそざじずぜぞつちサシスセソザジズゼゾツチ]/.test(char)) {
                        reynoldsOffset += 2.0; flowOffset += 0.5;
                    } else if (/[まみむめもなにぬねのらりるれろわマミムメモナニヌネノラリルレロワ]/.test(char)) {
                        flowOffset += 1.5; hardnessOffset -= 1.0; moistureOffset += 1.0;
                    }
                }
                const scale = Math.sqrt(len);
                est.effort.weight = Math.min(Math.max(5.0 + weightOffset / scale, 1.0), 9.0);
                est.effort.time = Math.min(Math.max(5.0 + timeOffset / scale, 1.0), 9.0);
                est.effort.space = Math.min(Math.max(5.0 + spaceOffset / scale, 1.0), 9.0);
                est.effort.flow = Math.min(Math.max(5.0 + flowOffset / scale, 1.0), 9.0);
                est.acoustic.hardness = Math.min(Math.max(5.0 + hardnessOffset / scale, 1.0), 9.0);
                est.acoustic.moisture = Math.min(Math.max(5.0 + moistureOffset / scale, 1.0), 9.0);
                est.extended.reynolds_norm = Math.min(Math.max(5.0 + reynoldsOffset / scale, 1.0), 9.0);
            }
        }

        // Attach Source-Filter Kinematic Taxonomy & Estimated BPM
        est.taxonomy = this.classifySourceFilter(cleanQuery);
        est.estimatedBpm = this.estimatePhoneticBpm(est);
        est.word = cleanQuery;
        return est;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnomaPetDictionary;
}
