// OnomaPetPhysics.js - Bounded, Multi-Node Spring-Damper Physics Engine with Laban Effort Kinematics & Mora Rhythm

class OnomaPetPhysics {
    constructor(options = {}) {
        this.nodeCount = options.nodeCount || 4;
        this.spatialScale = options.spatialScale || 1.0;
        this.amplitudeScale = options.amplitudeScale || 1.0;
        
        this.bpm = options.bpm || 65;
        this.animationTime = 0;
        this.lastBeatIndex = -1;
        this.activeWord = null;
        this.moraSequence = [];
        this.phraseDuration = 1.0;

        this.baselinePositions = [];
        this.currentPositions = [];
        this.velocities = [];
        this.forces = [];

        this.initTopology(this.nodeCount);
    }

    setBpm(bpm) {
        this.bpm = Math.min(Math.max(bpm, 40), 135);
        if (this.activeWord) {
            this.buildMoraSequence(this.activeWord);
        }
    }

    initTopology(count) {
        this.nodeCount = count;
        this.baselinePositions = [];
        this.currentPositions = [];
        this.velocities = [];
        this.forces = [];

        if (count === 4) {
            const r = 2.0 * this.spatialScale;
            this.baselinePositions = [
                { x: -r, y: 0, z: -r },
                { x:  r, y: 0, z: -r },
                { x:  r, y: 0, z:  r },
                { x: -r, y: 0, z:  r }
            ];
        } else if (count === 1) {
            this.baselinePositions = [{ x: 0, y: 0, z: 0 }];
        } else {
            const radius = 2.0 * this.spatialScale;
            for (let i = 0; i < count; i++) {
                const angle = (i / count) * Math.PI * 2;
                this.baselinePositions.push({
                    x: Math.cos(angle) * radius,
                    y: 0,
                    z: Math.sin(angle) * radius
                });
            }
        }

        for (let i = 0; i < count; i++) {
            this.currentPositions.push({ ...this.baselinePositions[i] });
            this.velocities.push({ x: 0, y: 0, z: 0 });
            this.forces.push({ x: 0, y: 0, z: 0 });
        }
        this.reset();
    }

    reset() {
        this.animationTime = 0;
        this.lastBeatIndex = -1;
        for (let i = 0; i < this.nodeCount; i++) {
            this.currentPositions[i] = { ...this.baselinePositions[i] };
            this.velocities[i] = { x: 0, y: 0, z: 0 };
            this.forces[i] = { x: 0, y: 0, z: 0 };
        }
    }

    setWord(wordData) {
        this.activeWord = wordData;
        this.buildMoraSequence(wordData);
        this.reset();
    }

    buildMoraSequence(wordData) {
        const wordText = (wordData && wordData.word) ? wordData.word : "がたがた";
        const chars = wordText.split('');
        const mt = (wordData && wordData.phrasing && wordData.phrasing.meter !== undefined) ? wordData.phrasing.meter : 4;
        const x13 = (wordData && wordData.phrasing && wordData.phrasing.accent) ? wordData.phrasing.accent : 5;

        // User Specified Speech Speed Rules:
        // - Reduplicated (かさかさ): Current speed (1.0x)
        // - Single (かさ), Extended (かさー), Sokuon (さかっ): Half speed (0.5x)
        const halfLen = Math.floor(chars.length / 2);
        const firstHalf = wordText.substring(0, halfLen);
        const secondHalf = wordText.substring(halfLen);
        const isReduplicated = (firstHalf === secondHalf && chars.length >= 4);
        const userSpeedRatio = isReduplicated ? 1.0 : 0.5;

        const currentBpm = (this.bpm || 65) * userSpeedRatio;
        const baseMoraDuration = (60.0 / currentBpm) * 0.36 * (1.1 - mt * 0.03);

        this.moraSequence = [];
        let totalDur = 0;

        for (let i = 0; i < chars.length; i++) {
            const char = chars[i];
            let dur = baseMoraDuration;
            let isPause = false;
            let isLong = false;

            if (char === 'っ' || char === 'ッ') {
                dur = baseMoraDuration * 0.75;
                isPause = true;
            } else if (char === 'ー') {
                dur = baseMoraDuration * 1.6;
                isLong = true;
            } else if (char === 'ん' || char === 'ン') {
                dur = baseMoraDuration * 1.25;
            }

            let accentFactor = 1.0;
            if (i === 0) {
                accentFactor = 1.25 + (x13 / 9.0) * 0.35;
            } else if (i % 2 === 1) {
                accentFactor = 0.65;
            } else {
                accentFactor = 0.9 + (x13 / 9.0) * 0.2;
            }

            this.moraSequence.push({
                char,
                startTime: totalDur,
                duration: dur,
                endTime: totalDur + dur,
                accentFactor,
                isPause,
                isLong,
                index: i
            });

            totalDur += dur;
        }

        this.phraseDuration = totalDur || 1.0;
    }

    setSpatialScale(scale) {
        this.spatialScale = scale;
        this.initTopology(this.nodeCount);
    }

    setAmplitudeScale(scale) {
        this.amplitudeScale = scale;
    }

    update(dt) {
        if (!this.activeWord) return null;

        const w = this.activeWord.effort.weight;
        const t_att = this.activeWord.effort.time;
        const sp = this.activeWord.effort.space;
        const fl = this.activeWord.effort.flow;
        const hd = this.activeWord.acoustic.hardness;
        const re = this.activeWord.extended.reynolds_norm;
        const dc = this.activeWord.acoustic.decay;
        const by = this.activeWord.extended.boyle || 0;
        const rg = (this.activeWord.phrasing && this.activeWord.phrasing.regularity !== undefined) ? this.activeWord.phrasing.regularity : 5;

        const isPlosive = /[ぱぴぷぺぽばびぶべぼパピプペポバビブベボ]/.test(this.activeWord.word || "");

        const jitter = (Math.random() - 0.5) * (rg / 9.0) * 0.015;
        this.animationTime += dt + jitter;

        const relTime = ((this.animationTime % this.phraseDuration) + this.phraseDuration) % this.phraseDuration;

        let currentMora = this.moraSequence[0] || { char: '', duration: 0.2, accentFactor: 1, isPause: false, index: 0, startTime: 0 };
        for (let m = 0; m < this.moraSequence.length; m++) {
            if (relTime >= this.moraSequence[m].startTime && relTime < this.moraSequence[m].endTime) {
                currentMora = this.moraSequence[m];
                break;
            }
        }

        let beatTriggered = false;
        let beatSubIndex = currentMora.index;
        if (this.lastBeatIndex === -1) {
            beatTriggered = true;
            this.lastBeatIndex = currentMora.index;
        } else if (currentMora.index !== this.lastBeatIndex) {
            beatTriggered = true;
            this.lastBeatIndex = currentMora.index;
        }

        const maxDt = 0.03;
        const subSteps = 4;
        const stepDt = Math.min(dt, maxDt) / subSteps;

        let primaryDrivingY = 0;
        let primaryTurbulence = 0;

        for (let step = 0; step < subSteps; step++) {
            for (let i = 0; i < this.nodeCount; i++) {
                this.forces[i] = { x: 0, y: 0, z: 0 };
            }

            // Pairwise coupling springs
            if (this.nodeCount > 1) {
                const tensionRatio = (fl * 0.04 + by * 0.03);
                const restDist = 3.5 * this.spatialScale * (1.0 - Math.min(tensionRatio, 0.5));
                const k_spring = hd * 0.8;
                const c_damping = fl * 0.35 + 0.1;

                for (let i = 0; i < this.nodeCount; i++) {
                    const j = (i + 1) % this.nodeCount;
                    const dx = this.currentPositions[i].x - this.currentPositions[j].x;
                    const dy = this.currentPositions[i].y - this.currentPositions[j].y;
                    const dz = this.currentPositions[i].z - this.currentPositions[j].z;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;

                    const deltaDist = dist - restDist;
                    const fSpring = -deltaDist * k_spring;

                    const nx = dx / dist;
                    const ny = dy / dist;
                    const nz = dz / dist;

                    const dvx = this.velocities[i].x - this.velocities[j].x;
                    const dvy = this.velocities[i].y - this.velocities[j].y;
                    const dvz = this.velocities[i].z - this.velocities[j].z;
                    const fDamp = (dvx * nx + dvy * ny + dvz * nz) * c_damping;

                    const totalF = fSpring - fDamp;

                    this.forces[i].x += nx * totalF;
                    this.forces[i].y += ny * totalF;
                    this.forces[i].z += nz * totalF;

                    this.forces[j].x -= nx * totalF;
                    this.forces[j].y -= ny * totalF;
                    this.forces[j].z -= nz * totalF;
                }
            }

            // Individual node forces shaping directly from Laban Effort (CH-4)
            for (let i = 0; i < this.nodeCount; i++) {
                const pos = this.currentPositions[i];
                const vel = this.velocities[i];
                const base = this.baselinePositions[i];

                // 1. Weight (x1): Heavy downward gravity sag & mass
                const weightRatio = w / 9.0;
                const gravitySag = -(Math.pow(weightRatio, 1.6)) * 4.5 * this.amplitudeScale;
                this.forces[i].y += gravitySag;

                // 2. Flow (x4): Viscous Drag Damping (Bound vs Free)
                const flowRatio = fl / 9.0;
                const dragLinear = 0.2 + flowRatio * 1.2; // High Flow = Viscous bound restriction
                this.forces[i].x -= vel.x * dragLinear;
                this.forces[i].y -= vel.y * dragLinear;
                this.forces[i].z -= vel.z * dragLinear;

                // Home anchor spring
                const k_home = 1.2;
                this.forces[i].x += (base.x - pos.x) * k_home;
                this.forces[i].y += (base.y - pos.y) * k_home;
                this.forces[i].z += (base.z - pos.z) * k_home;

                // Reynolds turbulence
                if (re > 1) {
                    const timeScale = re >= 4 ? 70.0 : 35.0;
                    const noiseAmp = (re / 9.0) * 1.8 * this.amplitudeScale;
                    const turbX = Math.sin(this.animationTime * timeScale + i * 17.0) * noiseAmp;
                    const turbY = Math.cos(this.animationTime * timeScale + i * 23.0) * noiseAmp;
                    const turbZ = Math.sin(this.animationTime * timeScale * 1.3 + i * 31.0) * noiseAmp;

                    this.forces[i].x += turbX;
                    this.forces[i].y += turbY;
                    this.forces[i].z += turbZ;
                    if (i === 0) primaryTurbulence = turbY;
                }

                // 3. Time (x2) & CH-2 Driving Force in Opposing Phase (N0,N2: +Y UP vs N1,N3: -Y DOWN)
                const phaseSign = (i === 0 || i === 2) ? 1.0 : -1.0;
                const phaseDelay = (i / this.nodeCount) * Math.PI * 2 * (1.0 - hd / 9.0);
                const nodeRelTime = ((this.animationTime - phaseDelay * 0.05) % this.phraseDuration + this.phraseDuration) % this.phraseDuration;
                
                let nodeMora = currentMora;
                for (let m = 0; m < this.moraSequence.length; m++) {
                    if (nodeRelTime >= this.moraSequence[m].startTime && nodeRelTime < this.moraSequence[m].endTime) {
                        nodeMora = this.moraSequence[m];
                        break;
                    }
                }

                const moraProgress = (nodeRelTime - nodeMora.startTime) / (nodeMora.duration || 0.2);
                const timeRatio = t_att / 9.0;
                let driveEnvelope = 0;

                if (!nodeMora.isPause) {
                    if (timeRatio > 0.35) {
                        const kickPower = Math.pow(Math.sin(moraProgress * Math.PI), 1.0 + (9 - t_att) * 0.3);
                        const suddenEnv = kickPower * Math.exp(-dc * 0.25 * moraProgress);
                        driveEnvelope += timeRatio * suddenEnv * 2.2;
                    }
                    if (timeRatio < 0.75) {
                        const waveEnv = Math.sin(moraProgress * Math.PI * 2);
                        driveEnvelope += (1.0 - timeRatio) * waveEnv * 1.2;
                    }
                }

                // 4. Space (x3): Direct (straight line) vs Indirect (orbital swirl)
                const spaceRatio = sp / 9.0;
                const forceAmp = (12.0 + w * 28.0) * nodeMora.accentFactor * this.amplitudeScale;

                // Opposing Phase CH-2 Driving Vector (N0, N2 -> +Y UP, N1, N3 -> -Y DOWN)
                const driveY = phaseSign * driveEnvelope * forceAmp;
                const orbitRadius = (1.0 - spaceRatio) * 1.8;
                const rotAngle = (this.animationTime / this.phraseDuration) * Math.PI * 2 + (i / this.nodeCount) * Math.PI * 2;

                const driveX = Math.cos(rotAngle) * driveEnvelope * forceAmp * orbitRadius;
                const driveZ = Math.sin(rotAngle) * driveEnvelope * forceAmp * orbitRadius;

                this.forces[i].x += driveX;
                this.forces[i].y += driveY;
                this.forces[i].z += driveZ;

                if (i === 0) primaryDrivingY = driveY;

                // Plosive burst
                if (isPlosive && moraProgress < 0.15 && !nodeMora.isPause) {
                    const burstProgress = moraProgress / 0.15;
                    const burstEnv = Math.sin(burstProgress * Math.PI) * Math.exp(-burstProgress * 2.5);
                    const burstF = burstEnv * forceAmp * 2.0;
                    this.forces[i].y += burstF;
                }

                // Integration & Capping
                const mass = 1.0 + w * 0.25;
                const ax = this.forces[i].x / mass;
                const ay = this.forces[i].y / mass;
                const az = this.forces[i].z / mass;

                this.velocities[i].x += ax * stepDt;
                this.velocities[i].y += ay * stepDt;
                this.velocities[i].z += az * stepDt;

                const maxSpeed = 15.0 * this.amplitudeScale;
                const speed = Math.sqrt(this.velocities[i].x ** 2 + this.velocities[i].y ** 2 + this.velocities[i].z ** 2);
                if (speed > maxSpeed) {
                    this.velocities[i].x = (this.velocities[i].x / speed) * maxSpeed;
                    this.velocities[i].y = (this.velocities[i].y / speed) * maxSpeed;
                    this.velocities[i].z = (this.velocities[i].z / speed) * maxSpeed;
                }

                this.currentPositions[i].x += this.velocities[i].x * stepDt;
                this.currentPositions[i].y += this.velocities[i].y * stepDt;
                this.currentPositions[i].z += this.velocities[i].z * stepDt;
            }
        }

        // Kinetic energy
        let totalEnergy = 0;
        for (let i = 0; i < this.nodeCount; i++) {
            const vx = this.velocities[i].x;
            const vy = this.velocities[i].y;
            const vz = this.velocities[i].z;
            totalEnergy += 0.5 * (vx * vx + vy * vy + vz * vz);
        }

        return {
            time: this.animationTime,
            beatTriggered: beatTriggered,
            beatSubIndex: beatSubIndex,
            totalBeats: this.moraSequence.length,
            totalEnergy: totalEnergy,
            primaryDrivingY: primaryDrivingY,
            primaryTurbulence: primaryTurbulence,
            displacements: this.getNodeDisplacements(),
            positions: this.getNodePositions()
        };
    }

    getNodePositions() {
        return this.currentPositions.map(p => ({ ...p }));
    }

    getNodeDisplacements() {
        return this.currentPositions.map((pos, i) => ({
            dx: pos.x - this.baselinePositions[i].x,
            dy: pos.y - this.baselinePositions[i].y,
            dz: pos.z - this.baselinePositions[i].z
        }));
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = OnomaPetPhysics;
}
