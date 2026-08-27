/**
 * NodeMesh3DRenderer.js - Single 3D Dynamic Node Visualizer for CH-4 Laban Effort
 *
 * Renders 1 Single Dynamic Core Node in 3D perspective space.
 * CH-4 Laban Effort (Weight, Time, Space, Flow) directly shapes:
 * - 3D Spatial Orbit Trajectory (Space x3)
 * - Impulse Acceleration & Velocity (Time x2)
 * - Gravity Sag & Squish Deformation (Weight x1)
 * - Viscous Motion Trail & Damping (Flow x4)
 */

class NodeMesh3DRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Camera Orbit Angles
        this.rotX = 0.35;
        this.rotY = 0.5;
        this.distance = 6.5;
        this.fov = 400;

        // Motion Trail History for Single Node
        this.trail = [];
        this.maxTrailLength = 40;

        // Interactive Orbit Dragging
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.initEvents();
        this.resize();
    }

    initEvents() {
        if (!this.canvas) return;

        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastMouseX;
            const dy = e.clientY - this.lastMouseY;

            this.rotY += dx * 0.008;
            this.rotX += dy * 0.008;
            this.rotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.rotX));

            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        window.addEventListener('mouseup', () => { this.isDragging = false; });
        this.canvas.addEventListener('wheel', (e) => {
            this.distance += e.deltaY * 0.005;
            this.distance = Math.max(3.0, Math.min(12.0, this.distance));
        });
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = (rect.width || 400) * window.devicePixelRatio;
        this.canvas.height = (rect.height || 300) * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    project(x, y, z, cx, cy) {
        const x1 = x * Math.cos(this.rotY) + z * Math.sin(this.rotY);
        const z1 = -x * Math.sin(this.rotY) + z * Math.cos(this.rotY);

        const y2 = y * Math.cos(this.rotX) - z1 * Math.sin(this.rotX);
        const z2 = y * Math.sin(this.rotX) + z1 * Math.cos(this.rotX);

        const camZ = z2 + this.distance;
        const scale = this.fov / Math.max(camZ, 0.1);

        return {
            sx: cx + x1 * scale,
            sy: cy - y2 * scale,
            scale: scale,
            depth: camZ
        };
    }

    render(physicsEngine, activeWord) {
        if (!this.canvas || !this.ctx) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const cx = width / 2;
        const cy = height / 2;

        this.ctx.clearRect(0, 0, width, height);

        // 1. Dark Sci-Fi Background Grid
        this.ctx.fillStyle = '#0b0c10';
        this.ctx.fillRect(0, 0, width, height);

        if (!physicsEngine) return;

        // Get 1 Single Dynamic Core Node Position
        const positions = physicsEngine.getNodePositions();
        const p = positions[0] || { x: 0, y: 0, z: 0 };

        // Laban Effort Parameters from CH-4
        const w = activeWord && activeWord.effort ? activeWord.effort.weight : 5;      // Weight (Red)
        const t_att = activeWord && activeWord.effort ? activeWord.effort.time : 5;  // Time (Yellow)
        const sp = activeWord && activeWord.effort ? activeWord.effort.space : 5;     // Space (Green)
        const fl = activeWord && activeWord.effort ? activeWord.effort.flow : 5;      // Flow (Cyan)

        // 10-Channel Volume Matrix Gain
        const vols = (typeof OnomaPetKinematics !== 'undefined' && activeWord)
            ? OnomaPetKinematics.calculateVolumeMatrix(activeWord)
            : new Array(10).fill(128);

        const maxVol = Math.max(...vols);
        const masterGain = maxVol / 255.0;

        // Record Motion Trail for Single Node
        const proj = this.project(p.x, p.y, p.z, cx, cy);
        this.trail.push({ x: p.x, y: p.y, z: p.z, sx: proj.sx, sy: proj.sy, depth: proj.depth, scale: proj.scale });
        if (this.trail.length > this.maxTrailLength) this.trail.shift();

        // 2. Draw 3D Ground Axis Grid Line (Center Reference Plane)
        this.drawGroundGrid(cx, cy);

        // 3. Draw 3D Spatial Orbit Guide Ring (CH-4 Space x3 Visual)
        const orbitRadius = (1.0 + (9.0 - sp) * 0.25) * masterGain * 1.5;
        this.drawOrbitRing(cx, cy, orbitRadius, sp);

        // 4. Render CH-4 Motion Trail Stream (Flow x4 & Time x2 Visual)
        if (this.trail.length > 1) {
            for (let i = 0; i < this.trail.length - 1; i++) {
                const pt1 = this.trail[i];
                const pt2 = this.trail[i + 1];
                const alpha = (i / this.trail.length) * 0.7;

                // Color gradient based on CH-4 Flow (Cyan) & Space (Green)
                this.ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
                this.ctx.lineWidth = Math.max(2 * (pt1.scale * 0.01), 0.5);
                this.ctx.beginPath();
                this.ctx.moveTo(pt1.sx, pt1.sy);
                this.ctx.lineTo(pt2.sx, pt2.sy);
                this.ctx.stroke();
            }
        }

        // 5. Render Vertical Gravity Drop Indicator Line (CH-4 Weight x1 Visual)
        const groundProj = this.project(p.x, -2.5, p.z, cx, cy);
        this.ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; // Red Weight Gravity Line
        this.ctx.lineWidth = 1.2;
        this.ctx.setLineDash([3, 3]);
        this.ctx.beginPath();
        this.ctx.moveTo(proj.sx, proj.sy);
        this.ctx.lineTo(groundProj.sx, groundProj.sy);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Ground Impact Ring
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(groundProj.sx, groundProj.sy, 8 * (groundProj.scale * 0.01), 0, Math.PI * 2);
        this.ctx.stroke();

        // 6. Render 1 Single Dynamic Core Node Body
        const baseRadius = 14 * (proj.scale * 0.012);
        // Squish Deformation (Weight x1 makes node squish horizontally on impact)
        const squishX = 1.0 + (w / 9.0) * 0.35 * Math.sin(physicsEngine.animationTime * 8);
        const squishY = 1.0 / squishX;

        this.ctx.save();
        this.ctx.translate(proj.sx, proj.sy);
        this.ctx.scale(squishX, squishY);

        // Multi-Layer Glow Aura
        const nodeColor = '#a855f7'; // Purple CH-4 Effort Base Color
        this.ctx.fillStyle = nodeColor;
        this.ctx.shadowColor = '#38bdf8';
        this.ctx.shadowBlur = 18;

        this.ctx.beginPath();
        this.ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Inner Bright Core
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, baseRadius * 0.4, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        // 7. Overlay CH-4 Effort Force Vectors HUD
        this.renderEffortHud(proj.sx, proj.sy, w, t_att, sp, fl);

        // Header Title
        this.ctx.font = '600 11px "Outfit", sans-serif';
        this.ctx.fillStyle = '#a5b4fc';
        this.ctx.fillText('1-NODE 3D CH-4 DYNAMIC EFFORT MODEL (ドラッグで3D視点回転)', 12, 18);
    }

    drawGroundGrid(cx, cy) {
        const gridR = 3.0;
        const div = 6;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let i = -div; i <= div; i += 2) {
            const p1 = this.project(i * 0.5, -2.5, -gridR, cx, cy);
            const p2 = this.project(i * 0.5, -2.5, gridR, cx, cy);
            this.ctx.beginPath(); this.ctx.moveTo(p1.sx, p1.sy); this.ctx.lineTo(p2.sx, p2.sy); this.ctx.stroke();

            const p3 = this.project(-gridR, -2.5, i * 0.5, cx, cy);
            const p4 = this.project(gridR, -2.5, i * 0.5, cx, cy);
            this.ctx.beginPath(); this.ctx.moveTo(p3.sx, p3.sy); this.ctx.lineTo(p4.sx, p4.sy); this.ctx.stroke();
        }
    }

    drawOrbitRing(cx, cy, radius, sp) {
        const segs = 32;
        this.ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)'; // Green Space Line
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();

        for (let i = 0; i <= segs; i++) {
            const ang = (i / segs) * Math.PI * 2;
            const ox = Math.cos(ang) * radius;
            const oz = Math.sin(ang) * radius;
            const p = this.project(ox, 0, oz, cx, cy);

            if (i === 0) this.ctx.moveTo(p.sx, p.sy);
            else this.ctx.lineTo(p.sx, p.sy);
        }
        this.ctx.stroke();
    }

    renderEffortHud(sx, sy, w, t_att, sp, fl) {
        // Draw 4 Vector Arrows from the Single Node for CH-4 Efforts
        const hudX = sx + 25;
        const hudY = sy - 20;

        this.ctx.font = '600 10px monospace';
        this.ctx.fillStyle = '#ef4444'; this.ctx.fillText(`W:${w.toFixed(1)}`, hudX, hudY);        // Red Weight
        this.ctx.fillStyle = '#f59e0b'; this.ctx.fillText(`T:${t_att.toFixed(1)}`, hudX, hudY + 12); // Yellow Time
        this.ctx.fillStyle = '#10b981'; this.ctx.fillText(`S:${sp.toFixed(1)}`, hudX, hudY + 24);    // Green Space
        this.ctx.fillStyle = '#06b6d4'; this.ctx.fillText(`F:${fl.toFixed(1)}`, hudX, hudY + 36);    // Cyan Flow
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeMesh3DRenderer;
}
