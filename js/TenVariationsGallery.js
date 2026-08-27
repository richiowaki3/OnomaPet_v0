// TenVariationsGallery.js - 10 Differentiated Kinematics with Dynamic 0-255 Volume Matrix

class TenVariationsGallery {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvases = [];
        this.contexts = [];
        this.volBadges = [];
        this.volFills = [];
        this.activeWord = null;

        this.variationNames = [
            { id: 1, name: "1. 瞬発衝撃バースト", color: "#f43f5e", desc: "中心から放射状にパッと弾ける衝撃動点 (バシッ, ドカン)" },
            { id: 2, name: "2. 旋回うねり波", color: "#a855f7", desc: "8の字や円を描いてスムーズに旋回する動点 (ふわふわ, ゆらゆら)" },
            { id: 3, name: "3. 重厚たわみ沈み込み", color: "#ef4444", desc: "底部へドスンと大きく沈み込む重力動点 (どしん, ずっしり)" },
            { id: 4, name: "4. 粒状コロコロ転がり", color: "#ec4899", desc: "2点が歯車のようにコロコロ回る転がり動点 (ころころ, ぽろぽろ)" },
            { id: 5, name: "5. 呼吸・脈動プレッシャー", color: "#fb923c", desc: "風船のように膨らみ↔縮みを繰り返す脈動動点 (むくむく, ぷくぷく)" },
            { id: 6, name: "6. 粘性糸引きスライム", color: "#06b6d4", desc: "ビローンと引き伸びて切れる粘性糸引き動点 (ねばねば, どろどろ)" },
            { id: 7, name: "7. 振り子ゆらぎスイング", color: "#4ade80", desc: "時計のように左右へゆったり振れる振り子動点 (ゆらーり, ブラン)" },
            { id: 8, name: "8. 水滴・パラパラ散乱", color: "#f59e0b", desc: "水滴や小石がパラパラ跳ねる散乱動点 (からから, ぱらぱら)" },
            { id: 9, name: "9. 粒子高周波ジッター", color: "#38bdf8", desc: "雲のように細かく粒子が舞うスプレー動点 (さらさら, しゅわ)" },
            { id: 10, name: "10. 一方通行直線スライド", color: "#818cf8", desc: "氷上を左右一方向にスーッと滑るスライド動点 (かさー, すーっ)" }
        ];

        this.initDOM();
    }

    initDOM() {
        if (!this.container) return;
        this.container.innerHTML = '';
        this.canvases = [];
        this.contexts = [];
        this.volBadges = [];
        this.volFills = [];

        this.variationNames.forEach((varInfo) => {
            const card = document.createElement('div');
            card.className = 'var-card';
            card.style.cssText = `
                background: rgba(30, 41, 59, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 8px;
                padding: 8px 10px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 6px;
                position: relative;
            `;

            // Card Header with Volume Badge (0..255)
            const headerRow = document.createElement('div');
            headerRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; width: 100%;';

            const label = document.createElement('div');
            label.style.cssText = `font-size: 0.8rem; font-weight: 700; color: ${varInfo.color};`;
            label.textContent = varInfo.name;

            const volBadge = document.createElement('div');
            volBadge.style.cssText = `font-family: monospace; font-size: 0.75rem; font-weight: 700; color: ${varInfo.color}; background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 4px; border: 1px solid ${varInfo.color}44;`;
            volBadge.textContent = 'VOL: 0';

            headerRow.appendChild(label);
            headerRow.appendChild(volBadge);

            // Volume Meter Bar (0..255)
            const meterContainer = document.createElement('div');
            meterContainer.style.cssText = 'width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;';
            const meterFill = document.createElement('div');
            meterFill.style.cssText = `width: 0%; height: 100%; background: ${varInfo.color}; transition: width 0.2s ease;`;
            meterContainer.appendChild(meterFill);

            const canvas = document.createElement('canvas');
            canvas.width = 130;
            canvas.height = 85;
            canvas.style.cssText = 'width: 130px; height: 85px; background: rgba(15, 23, 42, 0.95); border-radius: 6px; border: 1px solid rgba(255,255,255,0.06);';

            const desc = document.createElement('div');
            desc.style.cssText = 'font-size: 0.68rem; color: #94a3b8; width: 100%; text-align: left; line-height: 1.25; min-height: 26px;';
            desc.textContent = varInfo.desc;

            card.appendChild(headerRow);
            card.appendChild(meterContainer);
            card.appendChild(canvas);
            card.appendChild(desc);

            this.container.appendChild(card);
            this.canvases.push(canvas);
            this.contexts.push(canvas.getContext('2d'));
            this.volBadges.push(volBadge);
            this.volFills.push(meterFill);
        });
    }

    calculateKinematicVolumes(wordData) {
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

        let vols = new Array(10).fill(0);

        // 1. 瞬発バースト
        vols[0] = Math.round(Math.min(Math.max((isPlosive ? 180 : 20) + t_att * 8 + (isSokuon ? 50 : 0), 0), 255));
        // 2. 旋回うねり波
        vols[1] = Math.round(Math.min(Math.max((9 - sp) * 22 + (9 - fl) * 8, 0), 255));
        // 3. 重厚たわみ沈み込み
        vols[2] = Math.round(Math.min(Math.max(w * 25 + (isPlosive ? 30 : 0), 0), 255));
        // 4. 粒状コロコロ転がり
        vols[3] = Math.round(Math.min(Math.max((isReduplicated ? 160 : 30) + (9 - w) * 10, 0), 255));
        // 5. 呼吸・脈動
        vols[4] = Math.round(Math.min(Math.max((9 - hd) * 20 + fl * 8, 0), 255));
        // 6. 粘性糸引きスライム
        vols[5] = Math.round(Math.min(Math.max((isNasal ? 160 : 10) + fl * 12 + (9 - hd) * 8, 0), 255));
        // 7. 振り子ゆらぎ
        vols[6] = Math.round(Math.min(Math.max((isLongVowel ? 150 : 20) + (9 - t_att) * 15, 0), 255));
        // 8. 水滴・パラパラ散乱
        vols[7] = Math.round(Math.min(Math.max((isRaLine ? 180 : 20) + (isSokuon ? 50 : 0), 0), 255));
        // 9. 粒子高周波ジッター
        vols[8] = Math.round(Math.min(Math.max((isFricative ? 200 : 20) + re * 10, 0), 255));
        // 10. 一方通行直線スライド
        vols[9] = Math.round(Math.min(Math.max((isLongVowel ? 180 : 30) + sp * 10, 0), 255));

        return vols;
    }

    render(currentTime, activeWord) {
        if (!this.canvases || this.canvases.length === 0) return;
        this.activeWord = activeWord;

        // Calculate 0-255 Kinematic Volume Weight Matrix
        const vols = (typeof OnomaPetKinematics !== 'undefined')
            ? OnomaPetKinematics.calculateVolumeMatrix(activeWord)
            : new Array(10).fill(128);

        const t = currentTime;

        for (let idx = 0; idx < 10; idx++) {
            const ctx = this.contexts[idx];
            const canvas = this.canvases[idx];
            const varInfo = this.variationNames[idx];
            const width = canvas.width;
            const height = canvas.height;
            const cx = width / 2;
            const cy = height / 2;

            const vol255 = vols[idx];
            const gain = vol255 / 255.0; // 0.0 .. 1.0 (Dynamic Volume Gain)

            // Update UI Volume Badges & Meters
            if (this.volBadges[idx]) this.volBadges[idx].textContent = `VOL: ${vol255}`;
            if (this.volFills[idx]) this.volFills[idx].style.width = `${Math.round(gain * 100)}%`;

            ctx.clearRect(0, 0, width, height);

            // Grid background axis
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx, 0); ctx.lineTo(cx, height);
            ctx.moveTo(0, cy); ctx.lineTo(width, cy);
            ctx.stroke();

            // Evaluate Kinematic Motion Trajectory F_k(t)
            if (typeof OnomaPetKinematics !== 'undefined') {
                const pt = OnomaPetKinematics.evaluateKinematicFunction(idx + 1, t, gain, cx, cy);
                this.drawPoint(ctx, pt.x, pt.y, varInfo.color, pt.size);
            }
        }
    }

    drawPoint(ctx, x, y, color, size = 5) {
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size, 1), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, Math.max(size * 0.4, 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TenVariationsGallery;
}
