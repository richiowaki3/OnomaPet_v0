/**
 * OnomaPetKinematics.js - Pure Mathematical Kinematic Functions & 0-255 Volume Matrix Engine
 *
 * Encapsulates the 10-Channel Kinematic Function Weight Matrix and kinematic trajectory formulas.
 * Each volume V_k in [0, 255] represents the extrusion gain/strength of kinematic function F_k(t).
 */

class OnomaPetKinematics {
    /**
     * Calculate 0-255 Kinematic Volume Weights V_1 .. V_10 for a given word profile
     * @param {Object} wordData - Parameter object from OnomaPetDictionary
     * @returns {Array<number>} 10-element array of integer volume values in [0, 255]
     */
    static calculateVolumeMatrix(wordData) {
        if (!wordData) return new Array(10).fill(128);

        const w = wordData.effort ? wordData.effort.weight : 5;
        const t_att = wordData.effort ? wordData.effort.time : 5;
        const sp = wordData.effort ? wordData.effort.space : 5;
        const fl = wordData.effort ? wordData.effort.flow : 5;
        const hd = wordData.acoustic ? wordData.acoustic.hardness : 5;
        const re = wordData.extended ? wordData.extended.reynolds_norm : 5;

        const wordText = wordData.word || '';
        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボタチツテトダヂヅデドカキクケコガギグゲゴ]/.test(wordText);
        const isFricative = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチハヒフヘホ]/.test(wordText);
        const isNasal = /[まみむめもなにぬねのんマミムメモナニヌネノン]/.test(wordText);
        const isSokuon = /[っッ]/.test(wordText);
        const isLongVowel = /[ー]/.test(wordText);
        const isReduplicated = (wordText.length >= 4 && wordText.substring(0, Math.floor(wordText.length / 2)) === wordText.substring(Math.floor(wordText.length / 2)));
        const isRaLine = /[らりるれろラリルレロ]/.test(wordText);

        const clamp255 = (val) => Math.round(Math.min(Math.max(val, 0), 255));

        return [
            // F1: Transient Shock Burst (瞬発バースト)
            clamp255((isPlosive ? 180 : 20) + t_att * 8 + (isSokuon ? 50 : 0)),

            // F2: Swirling Orbital Wave (旋回うねり波)
            clamp255((9 - sp) * 22 + (9 - fl) * 8),

            // F3: Heavy Gravitational Sag (重厚沈み込み)
            clamp255(w * 25 + (isPlosive ? 30 : 0)),

            // F4: Rolling Particle Swarm (粒状コロコロ転がり)
            clamp255((isReduplicated ? 160 : 30) + (9 - w) * 10),

            // F5: Pulsating Pressure (呼吸・脈動プレッシャー)
            clamp255((9 - hd) * 20 + fl * 8),

            // F6: Slime Stretch & Tear (粘性糸引きスライム)
            clamp255((isNasal ? 160 : 10) + fl * 12 + (9 - hd) * 8),

            // F7: Pendulum Swing (振り子ゆらぎ)
            clamp255((isLongVowel ? 150 : 20) + (9 - t_att) * 15),

            // F8: Rattling Drops (水滴・パラパラ散乱)
            clamp255((isRaLine ? 180 : 20) + (isSokuon ? 50 : 0)),

            // F9: Fine Particle Spray (粒子高周波ジッター)
            clamp255((isFricative ? 200 : 20) + re * 10),

            // F10: Linear Skate Slide (一方通行直線スライド)
            clamp255((isLongVowel ? 180 : 30) + sp * 10)
        ];
    }

    /**
     * Compute 2D Displacement Trajectory (x, y) for Kinematic Function F_k(t)
     * @param {number} patternIndex - 1 to 10
     * @param {number} t - Current animation time in seconds
     * @param {number} gain - Volume gain normalized [0.0, 1.0] (V_k / 255.0)
     * @param {number} cx - Center origin X
     * @param {number} cy - Center origin Y
     * @returns {Object} { x, y, size }
     */
    static evaluateKinematicFunction(patternIndex, t, gain, cx, cy) {
        let x = cx;
        let y = cy;
        let size = 4 + gain * 3;

        switch (patternIndex) {
            case 1: { // F1: Transient Shock Burst
                const phase = (t * 3.5) % (Math.PI * 2);
                const r = Math.sin(phase) * Math.exp(-phase * 0.7) * 35.0 * gain;
                x = cx + Math.cos(t * 4) * r;
                y = cy + Math.sin(t * 4) * r;
                break;
            }
            case 2: { // F2: Swirling Orbital Wave (8-figure orbit)
                x = cx + Math.sin(t * 2.0) * 36.0 * gain;
                y = cy + Math.sin(t * 4.0) * 22.0 * gain;
                break;
            }
            case 3: { // F3: Heavy Gravitational Sag
                x = cx;
                y = cy + (12.0 + Math.abs(Math.sin(t * 2.2)) * 26.0) * gain;
                size = 4 + gain * 4;
                break;
            }
            case 4: { // F4: Rolling Particle Swarm
                const rotR = 18.0 * gain;
                const rollX = cx + Math.sin(t * 1.5) * 20.0 * gain;
                x = rollX + Math.cos(t * 4.0) * rotR;
                y = cy + Math.sin(t * 4.0) * rotR;
                break;
            }
            case 5: { // F5: Pulsating Pressure
                const pulseR = 8.0 + (Math.abs(Math.sin(t * 2.5)) * 26.0) * gain;
                x = cx + Math.cos(t * 2.5) * pulseR;
                y = cy + Math.sin(t * 2.5) * pulseR;
                break;
            }
            case 6: { // F6: Slime Stretch & Tear
                const stretchPhase = (t * 1.5) % (Math.PI * 1.5);
                let slimeY = cy - 20.0 + (Math.pow(stretchPhase / (Math.PI * 1.5), 2.2) * 55.0) * gain;
                if (stretchPhase > Math.PI * 1.3) slimeY = cy - 20.0;
                x = cx;
                y = slimeY;
                break;
            }
            case 7: { // F7: Pendulum Swing
                const pendAngle = Math.sin(t * 1.8) * 0.8 * gain;
                const len = 35.0;
                x = cx + Math.sin(pendAngle) * len;
                y = (cy - 20) + Math.cos(pendAngle) * len;
                break;
            }
            case 8: { // F8: Rattling Drops
                const dropPhase = (t * 4.0) % 1.5;
                x = cx + Math.sin(t * 8.0) * 6.0 * gain;
                y = (cy - 25) + dropPhase * 38.0 * gain;
                break;
            }
            case 9: { // F9: Fine Particle Spray
                x = cx + (Math.sin(t * 15.0) + Math.cos(t * 22.0)) * 20.0 * gain;
                y = cy + (Math.cos(t * 18.0)) * 15.0 * gain;
                size = 2 + gain * 2;
                break;
            }
            case 10: { // F10: Linear Skate Slide
                x = cx + (Math.sin(t * 1.2)) * 42.0 * gain;
                y = cy;
                break;
            }
            default:
                break;
        }

        return { x, y, size };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnomaPetKinematics;
}
