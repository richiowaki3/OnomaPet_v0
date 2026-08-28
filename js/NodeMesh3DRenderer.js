/**
 * NodeMesh3DRenderer.js - 5-Node 3D Elastic Mesh (N0 Center Flight + N1..N4 Surface Plane)
 *
 * Renders 5 3D Nodes:
 * - N0: Central 3D Trajectory Flight Node (CH-1 Driver - 蝶 / 蜂 / ハエ)
 * - N1, N2, N3, N4: 4 Surface Plane Nodes forming the 3D Quad Mesh surrounding N0
 */

class NodeMesh3DRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Camera Orbit Angles
        this.rotX = 0.42;
        this.rotY = 0.55;
        this.distance = 6.8;
        this.fov = 420;

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
            this.distance = Math.max(3.0, Math.min(14.0, this.distance));
        });
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = (rect.width || 500) * window.devicePixelRatio;
        this.canvas.height = (rect.height || 380) * window.devicePixelRatio;
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

        // 1. Dark Background
        this.ctx.fillStyle = '#0b0c10';
        this.ctx.fillRect(0, 0, width, height);

        if (!physicsEngine) return;

        const positions = physicsEngine.getNodePositions();
        if (!positions || positions.length < 5) return;

        // 10-Channel Volume Matrix Gain
        const vols = (typeof OnomaPetKinematics !== 'undefined' && activeWord)
            ? OnomaPetKinematics.calculateVolumeMatrix(activeWord)
            : new Array(10).fill(128);

        const expandGain = vols[1] / 255.0; // F2 Swirl
        const pulseGain = vols[4] / 255.0;  // F5 Pulsation

        // Project all 5 nodes to 2D Screen Coordinates
        const projectedNodes = positions.map((p, idx) => {
            const proj = this.project(p.x, p.y, p.z, cx, cy);
            return {
                id: idx,
                x: p.x, y: p.y, z: p.z,
                sx: proj.sx, sy: proj.sy,
                scale: proj.scale, depth: proj.depth,
                isCenter: idx === 0
            };
        });

        // 2. Render Ground Grid Reference
        this.drawGroundPlane(cx, cy);

        // 3. Draw Pairwise Coupling Edges:
        // Outer Surface Ring Edges (N1-N2, N2-N3, N3-N4, N4-N1) + Central Spokes (N0-N1, N0-N2, N0-N3, N0-N4)
        const edges = [
            [1, 2], [2, 3], [3, 4], [4, 1], // Outer Surface Plane Ring
            [0, 1], [0, 2], [0, 3], [0, 4]  // Central Spokes connecting N0 to Surface Plane
        ];

        const restDist = 3.2 * (1.0 + expandGain * 0.5 - pulseGain * 0.35);

        edges.forEach(([i, j]) => {
            const n1 = projectedNodes[i];
            const n2 = projectedNodes[j];

            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dz = n1.z - n2.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            const tensionRatio = dist / restDist;
            let edgeCol = '#38bdf8'; // Cyan (Normal)
            if (tensionRatio > 1.15) {
                edgeCol = '#ef4444'; // Red (Stretched)
            } else if (tensionRatio < 0.85) {
                edgeCol = '#a855f7'; // Purple (Compressed)
            }

            const isSpoke = (i === 0 || j === 0);
            const alpha = Math.min(Math.max(1.2 - ((n1.depth + n2.depth) / 2) * 0.08, 0.25), 0.95);

            this.ctx.strokeStyle = isSpoke ? 'rgba(251, 146, 60, 0.6)' : edgeCol;
            this.ctx.globalAlpha = alpha;
            this.ctx.lineWidth = isSpoke ? 1.4 : Math.max(2.2 * ((n1.scale + n2.scale) / 2) * 0.009, 1.0);
            this.ctx.beginPath();
            this.ctx.moveTo(n1.sx, n1.sy);
            this.ctx.lineTo(n2.sx, n2.sy);
            this.ctx.stroke();
        });

        this.ctx.globalAlpha = 1.0;

        // 4. Sort Nodes by Depth (Painter's Algorithm)
        projectedNodes.sort((a, b) => b.depth - a.depth);

        // 5. Render 5 Dynamic Spheres (N0 Center Star + N1..N4 Surface Nodes)
        const nodeCols = ['#38bdf8', '#fb923c', '#4ade80', '#f43f5e', '#a855f7'];

        projectedNodes.forEach((node) => {
            const radius = node.isCenter
                ? Math.max(16 * (node.scale * 0.011), 8)  // N0 Center Flight Core (Larger)
                : Math.max(11 * (node.scale * 0.011), 5); // N1..N4 Surface Nodes

            const col = nodeCols[node.id % 5];

            // Ground Drop Line
            const groundProj = this.project(node.x, -2.5, node.z, cx, cy);
            this.ctx.strokeStyle = `${col}33`;
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([2, 2]);
            this.ctx.beginPath();
            this.ctx.moveTo(node.sx, node.sy);
            this.ctx.lineTo(groundProj.sx, groundProj.sy);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Outer Glow Aura
            this.ctx.fillStyle = col;
            this.ctx.shadowColor = col;
            this.ctx.shadowBlur = node.isCenter ? 18 : 12;

            this.ctx.beginPath();
            this.ctx.arc(node.sx, node.sy, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Inner Bright Core
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(node.sx, node.sy, radius * 0.45, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowBlur = 0;

            // Node ID Tag
            const labelText = node.isCenter ? `N0 (飛翔)` : `N${node.id}`;
            this.ctx.font = node.isCenter ? '700 11px monospace' : '600 10px monospace';
            this.ctx.fillStyle = col;
            this.ctx.fillText(labelText, node.sx + radius + 4, node.sy + 3);
        });

        // 6. Draw Top-Down Geometric Radar Overlay in Top-Right Corner
        this.drawTopDownRadar(width, height, positions, activeWord);

        // Render Active Insect Flight Mode Badge (CH-1)
        const flightMode = physicsEngine.activeFlightMode || 'BUTTERFLY';
        let modeText = '🦋 蝶フライト (Slow 8-Figure Orbit)';
        let modeCol = '#4ade80';

        if (flightMode === 'BEE') {
            modeText = '🐝 蜂ホバリング (High-Freq Hovering)';
            modeCol = '#fb923c';
        } else if (flightMode === 'FLY') {
            modeText = '🪰 ハエジッター (Erratic Jump Flight)';
            modeCol = '#f43f5e';
        }

        this.ctx.font = '700 11px monospace';
        this.ctx.fillStyle = modeCol;
        this.ctx.fillText(`CH-1 飛翔軌道 N0: ${modeText}`, 12, 36);

        // Header Title
        this.ctx.font = '600 11px "Outfit", sans-serif';
        this.ctx.fillStyle = '#a5b4fc';
        this.ctx.fillText('5-NODE 3D MESH (N0: CH-1飛翔中心ノード ＋ N1..N4: 四頂点・面構成ノード)', 12, 18);
    }

    drawGroundPlane(cx, cy) {
        const gridR = 3.2;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;

        for (let i = -3; i <= 3; i += 2) {
            const p1 = this.project(i * 0.9, -2.5, -gridR, cx, cy);
            const p2 = this.project(i * 0.9, -2.5, gridR, cx, cy);
            this.ctx.beginPath(); this.ctx.moveTo(p1.sx, p1.sy); this.ctx.lineTo(p2.sx, p2.sy); this.ctx.stroke();

            const p3 = this.project(-gridR, -2.5, i * 0.9, cx, cy);
            const p4 = this.project(gridR, -2.5, i * 0.9, cx, cy);
            this.ctx.beginPath(); this.ctx.moveTo(p3.sx, p3.sy); this.ctx.lineTo(p4.sx, p4.sy); this.ctx.stroke();
        }
    }

    drawTopDownRadar(width, height, positions, activeWord) {
        const radarCenterX = width - 70;
        const radarCenterY = 58;
        const radarRadius = 34;

        // Background Radar Box
        this.ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.rect(radarCenterX - radarRadius - 8, radarCenterY - radarRadius - 16, radarRadius * 2 + 16, radarRadius * 2 + 28);
        this.ctx.fill();
        this.ctx.stroke();

        // Label
        this.ctx.font = '700 9px monospace';
        this.ctx.fillStyle = '#38bdf8';
        this.ctx.fillText('俯瞰 TOP-DOWN', radarCenterX - 30, radarCenterY - radarRadius - 5);

        // Radar Axis
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.beginPath();
        this.ctx.moveTo(radarCenterX - radarRadius, radarCenterY); this.ctx.lineTo(radarCenterX + radarRadius, radarCenterY);
        this.ctx.moveTo(radarCenterX, radarCenterY - radarRadius); this.ctx.lineTo(radarCenterX, radarCenterY + radarRadius);
        this.ctx.stroke();

        // Map N1..N4 Surface Perimeter nodes around N0 Center
        const radarNodes = positions.map((p) => ({
            rx: radarCenterX + p.x * 6.5,
            ry: radarCenterY + p.z * 6.5
        }));

        // Draw Surface Polygon (N1-N2-N3-N4-N1)
        this.ctx.strokeStyle = '#a855f7';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.moveTo(radarNodes[1].rx, radarNodes[1].ry);
        this.ctx.lineTo(radarNodes[2].rx, radarNodes[2].ry);
        this.ctx.lineTo(radarNodes[3].rx, radarNodes[3].ry);
        this.ctx.lineTo(radarNodes[4].rx, radarNodes[4].ry);
        this.ctx.closePath();
        this.ctx.stroke();

        // Draw Center N0 Dot + N1..N4 Surface Dots
        const nodeCols = ['#38bdf8', '#fb923c', '#4ade80', '#f43f5e', '#a855f7'];
        radarNodes.forEach((rn, i) => {
            this.ctx.fillStyle = nodeCols[i];
            this.ctx.beginPath();
            this.ctx.arc(rn.rx, rn.ry, i === 0 ? 4 : 2.5, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeMesh3DRenderer;
}
