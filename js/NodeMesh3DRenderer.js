/**
 * NodeMesh3DRenderer.js - 3D 4-Node Inter-Particle Elastic Mesh Visualizer
 *
 * Renders 4 dynamic 3D nodes in perspective space with 6 pairwise spring coupling edges.
 * Nodes expand outward and contract inward based on the 10-Channel Kinematic Volume Matrix.
 */

class NodeMesh3DRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // Camera Orbit Angles
        this.rotX = 0.4;
        this.rotY = 0.6;
        this.distance = 7.0;
        this.fov = 380;

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
            this.distance = Math.max(3.0, Math.min(15.0, this.distance));
        });
    }

    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = (rect.width || 400) * window.devicePixelRatio;
        this.canvas.height = (rect.height || 300) * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Transform 3D Point (x,y,z) to 2D Projected Screen (screenX, screenY, depth)
     */
    project(x, y, z, cx, cy) {
        // Rotate around Y axis
        const x1 = x * Math.cos(this.rotY) + z * Math.sin(this.rotY);
        const z1 = -x * Math.sin(this.rotY) + z * Math.cos(this.rotY);

        // Rotate around X axis
        const y2 = y * Math.cos(this.rotX) - z1 * Math.sin(this.rotX);
        const z2 = y * Math.sin(this.rotX) + z1 * Math.cos(this.rotX);

        // Camera Depth offset
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

        // Background grid floor
        this.ctx.fillStyle = '#0b0c10';
        this.ctx.fillRect(0, 0, width, height);

        if (!physicsEngine) return;

        const positions = physicsEngine.getNodePositions(); // 4 3D Node positions {x, y, z}
        const nodeCount = positions.length;

        // Compute 0-255 Kinematic Volumes if available
        const vols = (typeof OnomaPetKinematics !== 'undefined' && activeWord)
            ? OnomaPetKinematics.calculateVolumeMatrix(activeWord)
            : new Array(10).fill(128);

        const expandGain = vols[1] / 255.0; // F2 Swirl / Expansion
        const pulseGain = vols[4] / 255.0;  // F5 Pulsation

        // Project all 4 nodes to 2D Screen Coordinates
        const projectedNodes = positions.map((p, idx) => {
            const proj = this.project(p.x, p.y, p.z, cx, cy);
            return {
                id: idx,
                x: p.x, y: p.y, z: p.z,
                sx: proj.sx, sy: proj.sy,
                scale: proj.scale, depth: proj.depth
            };
        });

        // 1. Draw 6 Pairwise Coupling Spring Edges between the 4 nodes
        const edges = [
            [0, 1], [1, 2], [2, 3], [3, 0], // Outer 4 square ring edges
            [0, 2], [1, 3]                  // 2 Diagonal cross edges
        ];

        // Rest distance baseline
        const restDist = 3.5 * (1.0 + expandGain * 0.6 - pulseGain * 0.4);

        edges.forEach(([i, j]) => {
            const n1 = projectedNodes[i];
            const n2 = projectedNodes[j];

            // 3D Distance between Node i and Node j
            const dx = n1.x - n2.x;
            const dy = n1.y - n2.y;
            const dz = n1.z - n2.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // Stretch tension vs Compression color
            const tensionRatio = dist / restDist;
            let edgeCol = '#38bdf8'; // Normal (cyan)
            if (tensionRatio > 1.15) {
                edgeCol = '#ef4444'; // Stretched / Expended (Red)
            } else if (tensionRatio < 0.85) {
                edgeCol = '#a855f7'; // Compressed / Approached (Purple)
            }

            const alpha = Math.min(Math.max(1.2 - ((n1.depth + n2.depth) / 2) * 0.1, 0.2), 0.95);

            this.ctx.strokeStyle = edgeCol;
            this.ctx.globalAlpha = alpha;
            this.ctx.lineWidth = 1.8 * ((n1.scale + n2.scale) / 2) * 0.01;
            this.ctx.beginPath();
            this.ctx.moveTo(n1.sx, n1.sy);
            this.ctx.lineTo(n2.sx, n2.sy);
            this.ctx.stroke();

            // Render Distance Indicator Text at Edge Center
            const midSx = (n1.sx + n2.sx) / 2;
            const midSy = (n1.sy + n2.sy) / 2;
            this.ctx.font = '600 9px monospace';
            this.ctx.fillStyle = edgeCol;
            this.ctx.fillText(`d:${dist.toFixed(1)}`, midSx + 4, midSy - 4);
        });

        this.ctx.globalAlpha = 1.0;

        // 2. Sort Nodes by Depth (Painter's Algorithm for 3D Rendering)
        projectedNodes.sort((a, b) => b.depth - a.depth);

        // 3. Render 4 Glowing 3D Nodes
        projectedNodes.forEach((node) => {
            const radius = Math.max(8 * (node.scale * 0.012), 3);
            const nodeCols = ['#38bdf8', '#fb923c', '#4ade80', '#f43f5e'];
            const col = nodeCols[node.id % 4];

            // Outer Glow Aura
            this.ctx.fillStyle = col;
            this.ctx.shadowColor = col;
            this.ctx.shadowBlur = 12;

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
            this.ctx.font = '700 10px monospace';
            this.ctx.fillStyle = col;
            this.ctx.fillText(`N${node.id}`, node.sx + radius + 4, node.sy + 3);
        });

        // Overlay Title & Camera Hint
        this.ctx.font = '600 10px "Outfit", sans-serif';
        this.ctx.fillStyle = '#94a3b8';
        this.ctx.fillText('3D 4-NODE INTER-PARTICLE KINEMATIC MESH (ドラッグで3D回転)', 12, 18);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NodeMesh3DRenderer;
}
