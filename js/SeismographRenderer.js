// SeismographRenderer.js - High-Performance 2D Multi-Channel Strip-Chart Renderer

class SeismographRenderer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.theme = options.theme || 'dark'; // 'dark' or 'paper'
        this.windowSeconds = options.windowSeconds || 8.0; // 8 seconds visible window

        this.channels = [
            { id: 'nodeY', name: 'CH-1 [NODE Y DISPLACEMENT]', color: '#38bdf8', scale: 0.8 },
            { id: 'drivingY', name: 'CH-2 [DRIVING MOTOR FORCE]', color: '#fb923c', scale: 0.05 },
            { id: 'turbulence', name: 'CH-3 [REYNOLDS TURBULENCE]', color: '#f43f5e', scale: 0.25 },
            { id: 'efforts', name: 'CH-4 [DYNAMIC EFFORT FORCES]', color: '#a855f7', scale: 1.0 },
            { id: 'beatPulse', name: 'CH-5 [AUDIO BEAT ENVELOPE]', color: '#4ade80', scale: 0.8 }
        ];

        this.smoothValues = [];
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    setTheme(theme) {
        this.theme = theme;
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = (rect.width || 800) * window.devicePixelRatio;
        this.canvas.height = (rect.height || 600) * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    render(timelineBuffer, currentTime, activeWord) {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        if (width === 0 || height === 0) return;

        const isPaper = this.theme === 'paper';
        const bgColor = isPaper ? '#f5f5f4' : '#0b0c10';
        const gridMinor = isPaper ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        const gridMajor = isPaper ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)';
        const textColor = isPaper ? '#1c1917' : '#f8fafc';
        const subTextColor = isPaper ? '#78716c' : '#94a3b8';

        // 1. Background
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, width, height);

        const headerHeight = 36;
        const marginX = 180; // Left channel label margin
        const rightMargin = 80;
        const plotWidth = width - marginX - rightMargin;
        const plotHeight = height - headerHeight - 20;

        const numChannels = this.channels.length;
        const channelHeight = plotHeight / numChannels;

        // 2. Draw Scientific Header
        this.ctx.fillStyle = isPaper ? '#e7e5e4' : '#1e293b';
        this.ctx.fillRect(0, 0, width, headerHeight);
        this.ctx.strokeStyle = gridMajor;
        this.ctx.beginPath();
        this.ctx.moveTo(0, headerHeight);
        this.ctx.lineTo(width, headerHeight);
        this.ctx.stroke();

        this.ctx.font = '600 13px "Outfit", "Noto Sans JP", monospace';
        this.ctx.fillStyle = textColor;
        const wordLabel = activeWord ? `${activeWord.word} [IPA: ${activeWord.ipa_clean || ''}]` : 'NO WORD SELECTED';
        this.ctx.fillText(`SEISMOGRAPH TRACE  |  WORD: ${wordLabel}`, 15, 23);

        this.ctx.font = '500 11px monospace';
        this.ctx.fillStyle = subTextColor;
        this.ctx.fillText(`PAPER SPEED: 10 mm/s  |  TIME: ${currentTime.toFixed(2)}s  |  WINDOW: ${this.windowSeconds}s`, width - 360, 23);

        // 3. Draw Grid Lines & Channel Baselines
        const minTime = currentTime - this.windowSeconds;

        for (let i = 0; i < numChannels; i++) {
            const chY0 = headerHeight + i * channelHeight;
            const chYMid = chY0 + channelHeight / 2;

            // Channel divider
            this.ctx.strokeStyle = gridMajor;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(0, chY0);
            this.ctx.lineTo(width, chY0);
            this.ctx.stroke();

            // Center baseline (dashed)
            this.ctx.setLineDash([4, 4]);
            this.ctx.strokeStyle = isPaper ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
            this.ctx.beginPath();
            this.ctx.moveTo(marginX, chYMid);
            this.ctx.lineTo(width - rightMargin, chYMid);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Draw Channel Label
            const ch = this.channels[i];
            this.ctx.font = '700 11px "Outfit", monospace';
            this.ctx.fillStyle = ch.color;
            this.ctx.fillText(ch.name, 15, chYMid - 4);

            // Channel Sub-label / status
            this.ctx.font = '400 10px monospace';
            this.ctx.fillStyle = subTextColor;
            this.ctx.fillText(`SCALE: x${ch.scale}`, 15, chYMid + 12);
        }

        // Time Grid Vertical Lines (1-second divisions)
        const startSec = Math.floor(minTime);
        const endSec = Math.ceil(currentTime);
        this.ctx.strokeStyle = gridMinor;
        this.ctx.lineWidth = 1;
        this.ctx.font = '10px monospace';
        this.ctx.fillStyle = subTextColor;

        for (let s = startSec; s <= endSec; s++) {
            const tRatio = (s - minTime) / this.windowSeconds;
            if (tRatio >= 0 && tRatio <= 1) {
                const x = marginX + tRatio * plotWidth;
                this.ctx.beginPath();
                this.ctx.moveTo(x, headerHeight);
                this.ctx.lineTo(x, height);
                this.ctx.stroke();

                // Draw time marker on top header
                this.ctx.fillText(`${s}s`, x - 8, headerHeight - 8);
            }
        }

        if (!timelineBuffer || timelineBuffer.length < 2) return;

        // 4. Render Channel Waveforms
        for (let chIdx = 0; chIdx < numChannels; chIdx++) {
            const ch = this.channels[chIdx];
            const chY0 = headerHeight + chIdx * channelHeight;
            const chYMid = chY0 + channelHeight / 2;
            const maxAmp = channelHeight * 0.42;

            this.ctx.strokeStyle = ch.color;
            this.ctx.lineWidth = 1.8;
            this.ctx.shadowColor = ch.color;
            this.ctx.shadowBlur = isPaper ? 0 : 4;

            if (ch.id === 'nodeY') {
                // Multi-line for Node 0..3
                const colors = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6'];
                for (let nodeI = 0; nodeI < 4; nodeI++) {
                    this.ctx.strokeStyle = colors[nodeI % colors.length];
                    this.ctx.shadowColor = colors[nodeI % colors.length];
                    this.ctx.beginPath();
                    let started = false;

                    for (let i = 0; i < timelineBuffer.length; i++) {
                        const pt = timelineBuffer[i];
                        const tRatio = (pt.time - minTime) / this.windowSeconds;
                        if (tRatio < 0 || tRatio > 1) continue;

                        const x = marginX + tRatio * plotWidth;
                        const val = (pt.nodeY && pt.nodeY[nodeI] !== undefined) ? pt.nodeY[nodeI] : 0;
                        const y = chYMid - val * ch.scale * maxAmp;

                        if (!started) {
                            this.ctx.moveTo(x, y);
                            started = true;
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }
                    this.ctx.stroke();
                }
            } else if (ch.id === 'efforts') {
                // Render 10+ Dynamic Effort Waveform Variations: Weight (Red), Time (Yellow), Space (Green), Flow (Cyan)
                const effortKeys = [
                    { key: 'weight', col: '#ef4444', label: 'Weight' },
                    { key: 'time_att', col: '#f59e0b', label: 'Time' },
                    { key: 'space', col: '#10b981', label: 'Space' },
                    { key: 'flow', col: '#06b6d4', label: 'Flow' }
                ];

                const wordText = (activeWord && activeWord.word) ? activeWord.word : '';
                const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボタチツテトダヂヅデドカキクケコガギグゲゴ]/.test(wordText);
                const isFricative = /[さしすせそざじずぜぞつちサシスセソザジズゼゾツチハヒフヘホ]/.test(wordText);
                const isNasal = /[まみむめもなにぬねのんマミムメモナニヌネノン]/.test(wordText);
                const isSokuon = /[っッ]/.test(wordText);
                const isLongVowel = /[ー]/.test(wordText);
                const w = activeWord && activeWord.effort ? activeWord.effort.weight : 5;
                const hd = activeWord && activeWord.acoustic ? activeWord.acoustic.hardness : 5;
                const isReduplicated = (wordText.length >= 4 && wordText.substring(0, Math.floor(wordText.length / 2)) === wordText.substring(Math.floor(wordText.length / 2)));

                effortKeys.forEach((eff, idx) => {
                    this.ctx.strokeStyle = eff.col;
                    this.ctx.shadowColor = eff.col;
                    this.ctx.lineWidth = 1.6;
                    this.ctx.beginPath();
                    let started = false;

                    for (let i = 0; i < timelineBuffer.length; i++) {
                        const pt = timelineBuffer[i];
                        const tRatio = (pt.time - minTime) / this.windowSeconds;
                        if (tRatio < 0 || tRatio > 1) continue;

                        const x = marginX + tRatio * plotWidth;
                        const baseVal = (pt[eff.key] || 5) / 9.0; // Normalized 0..1
                        const t = pt.time;
                        let dynModulation = 0;

                        // --- 10+ Distinct Dynamic Waveform Variation Patterns ---
                        if (isPlosive && (eff.key === 'weight' || eff.key === 'time_att')) {
                            // Pattern 1: Transient Shock Burst (急激アタック・衝撃波形)
                            const burstPhase = (t * 4.0) % (Math.PI * 2);
                            dynModulation = Math.sin(burstPhase) * Math.exp(-burstPhase * 0.6) * 1.6;
                        } else if (isFricative && (eff.key === 'space' || eff.key === 'flow')) {
                            // Pattern 2: High-Frequency Jitter Trail (高周波摩擦・流動ジッター波形)
                            const jitter = (Math.sin(t * 14.0 + idx * 3.0) + Math.cos(t * 22.0)) * 0.4;
                            dynModulation = jitter;
                        } else if (isNasal && eff.key === 'flow') {
                            // Pattern 3: Viscous Phase Lag & Drag (粘性ねばねば・位相引きずり波形)
                            dynModulation = Math.sin(t * 2.2 - idx * 0.9) * 0.7;
                        } else if (isSokuon && pt.beatPulse > 0.8) {
                            // Pattern 4: Sokuon Tension Release Snap (促音緊張・一気解き放ち波形)
                            dynModulation = (idx % 2 === 0) ? 0.9 : -0.9;
                        } else if (isLongVowel && eff.key === 'time_att') {
                            // Pattern 5: Long Vowel Horizontal Glide Stretch (長音滑走・水平ストレッチ波形)
                            dynModulation = Math.sin(t * 0.8) * 0.2;
                        } else if (w >= 7 && eff.key === 'weight') {
                            // Pattern 6: Heavy Gravitational Sag Trough (重厚たわみ・沈み込み波形)
                            dynModulation = -0.6 - Math.abs(Math.sin(t * 2.5)) * 0.5;
                        } else if (w <= 2 && (eff.key === 'weight' || eff.key === 'space')) {
                            // Pattern 7: Floating Zero-G Harmonic Wave (無重力浮遊・ハーモニック波形)
                            dynModulation = 0.4 + Math.sin(t * 1.8 + idx) * 0.35;
                        } else if (hd >= 7 && eff.key === 'time_att') {
                            // Pattern 8: Sawtooth Staccato Pulse (鋸波スタッカート・ステップ波形)
                            const saw = (t * 3.0) % 1.0;
                            dynModulation = (saw - 0.5) * 0.9;
                        } else if (isReduplicated) {
                            // Pattern 9: Double-Cross Swing Groove (畳語・双方向交差スイング波形)
                            const swing = Math.sin(t * 3.5 + (idx % 2 === 0 ? 0 : Math.PI));
                            dynModulation = swing * 0.65;
                        } else {
                            // Pattern 10: Multi-Harmonic Composite Wave (標準多重調和合成波形)
                            dynModulation = (Math.sin(t * 2.5 + idx * 1.5) + 0.4 * Math.sin(t * 5.0 + idx)) * 0.45;
                        }

                        // Final CH-4 Effort Y Coordinate
                        const effortDynVal = (baseVal - 0.5) * 1.4 + dynModulation * baseVal;
                        const y = chYMid - effortDynVal * maxAmp * 0.75;

                        if (!started) {
                            this.ctx.moveTo(x, y);
                            started = true;
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }
                    this.ctx.stroke();
                });
            } else {
                // Single channel line
                this.ctx.beginPath();
                let started = false;

                for (let i = 0; i < timelineBuffer.length; i++) {
                    const pt = timelineBuffer[i];
                    const tRatio = (pt.time - minTime) / this.windowSeconds;
                    if (tRatio < 0 || tRatio > 1) continue;

                    const x = marginX + tRatio * plotWidth;
                    let val = 0;
                    if (ch.id === 'drivingY') val = pt.drivingY || 0;
                    else if (ch.id === 'turbulence') val = pt.turbulence || 0;
                    else if (ch.id === 'beatPulse') val = pt.beatPulse || 0;

                    const y = chYMid - val * ch.scale * maxAmp;

                    if (!started) {
                        this.ctx.moveTo(x, y);
                        started = true;
                    } else {
                        this.ctx.lineTo(x, y);
                    }
                }
                this.ctx.stroke();
            }

            this.ctx.shadowBlur = 0;

            // Draw current value badge and bouncing independent moving point (独立動点)
            const lastPt = timelineBuffer[timelineBuffer.length - 1];
            if (lastPt) {
                let dispVal = '0.00';
                let curVal = 0;

                if (ch.id === 'nodeY') {
                    curVal = lastPt.nodeY ? lastPt.nodeY[0] : 0;
                    dispVal = curVal.toFixed(2);
                } else if (ch.id === 'drivingY') {
                    curVal = lastPt.drivingY || 0;
                    dispVal = curVal.toFixed(1);
                } else if (ch.id === 'turbulence') {
                    curVal = lastPt.turbulence || 0;
                    dispVal = curVal.toFixed(2);
                } else if (ch.id === 'efforts') {
                    curVal = (lastPt.weight || 5) - 5;
                    dispVal = `W:${lastPt.weight} T:${lastPt.time_att}`;
                } else if (ch.id === 'beatPulse') {
                    curVal = lastPt.beatPulse || 0;
                    dispVal = curVal > 0 ? 'PULSE' : 'IDLE';
                }

                // 1. Text Badge on Right Margin
                this.ctx.font = '600 11px monospace';
                this.ctx.fillStyle = ch.color;
                this.ctx.fillText(dispVal, width - rightMargin + 10, chYMid + 4);

                // TEMPO-dependent Kinematic Inertia Smoothing
                const currentBpm = (activeWord && activeWord.estimatedBpm) ? activeWord.estimatedBpm : 65;
                const tau = Math.max(0.22 - (currentBpm - 40) * 0.0018, 0.03);
                if (this.smoothValues[chIdx] === undefined) this.smoothValues[chIdx] = curVal;
                this.smoothValues[chIdx] += (curVal - this.smoothValues[chIdx]) * Math.min(0.016 / tau, 1.0);

                // 2. INDEPENDENT MOVING POINT (要素別独立動点ボール) on Left Track
                const trackX = marginX - 30;
                const pointY = chYMid - this.smoothValues[chIdx] * ch.scale * maxAmp;

                // CH-4 4-Color Effort Bouncing Points (Weight, Time, Space, Flow)
                if (ch.id === 'efforts' && activeWord) {
                    const w = activeWord.effort ? activeWord.effort.weight : 5;
                    const t_att = activeWord.effort ? activeWord.effort.time : 5;
                    const sp = activeWord.effort ? activeWord.effort.space : 5;
                    const fl = activeWord.effort ? activeWord.effort.flow : 5;

                    const effortData = [
                        { name: 'W', val: w, col: '#ef4444', label: '重さ' },
                        { name: 'T', val: t_att, col: '#f59e0b', label: '時間' },
                        { name: 'S', val: sp, col: '#10b981', label: '空間' },
                        { name: 'F', val: fl, col: '#06b6d4', label: '流動' }
                    ];

                    const startTrackX = marginX - 110;
                    const trackSpacing = 22;

                    effortData.forEach((eff, eIdx) => {
                        const eTrackX = startTrackX + eIdx * trackSpacing;
                        const eValNorm = ((eff.val - 1) / 8.0 - 0.5) * 2.0; // -1 to +1
                        const ePointY = chYMid - eValNorm * (channelHeight * 0.35);

                        // Vertical track guide
                        this.ctx.strokeStyle = isPaper ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
                        this.ctx.lineWidth = 1;
                        this.ctx.beginPath();
                        this.ctx.moveTo(eTrackX, chY0 + 6);
                        this.ctx.lineTo(eTrackX, chY0 + channelHeight - 6);
                        this.ctx.stroke();

                        // Bouncing Effort Ball
                        this.ctx.fillStyle = eff.col;
                        this.ctx.shadowColor = eff.col;
                        this.ctx.shadowBlur = isPaper ? 2 : 6;
                        this.ctx.beginPath();
                        this.ctx.arc(eTrackX, ePointY, 4, 0, Math.PI * 2);
                        this.ctx.fill();
                        this.ctx.shadowBlur = 0;

                        // Effort Label
                        this.ctx.font = '600 8px monospace';
                        this.ctx.fillStyle = eff.col;
                        this.ctx.fillText(`${eff.name}:${eff.val}`, eTrackX - 8, chY0 + channelHeight - 3);
                    });
                } else {
                    // Vertical track line for standard channels
                    this.ctx.strokeStyle = isPaper ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)';
                    this.ctx.lineWidth = 1.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(trackX, chY0 + 6);
                    this.ctx.lineTo(trackX, chY0 + channelHeight - 6);
                    this.ctx.stroke();

                    // Connecting pen line from moving point to seismograph trace
                    this.ctx.strokeStyle = ch.color;
                    this.ctx.lineWidth = 1;
                    this.ctx.setLineDash([2, 2]);
                    this.ctx.beginPath();
                    this.ctx.moveTo(trackX, pointY);
                    this.ctx.lineTo(marginX, pointY);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]);

                    // Bouncing Orb / Moving Point Body
                    this.ctx.fillStyle = ch.color;
                    this.ctx.shadowColor = ch.color;
                    this.ctx.shadowBlur = isPaper ? 2 : 8;

                    this.ctx.beginPath();
                    this.ctx.arc(trackX, pointY, 6.5, 0, Math.PI * 2);
                    this.ctx.fill();

                    // Inner bright core
                    this.ctx.fillStyle = '#ffffff';
                    this.ctx.beginPath();
                    this.ctx.arc(trackX, pointY, 2.5, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SeismographRenderer;
}
