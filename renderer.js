/**
 * renderer.js - Procedural Canvas Renderer for Polymer Network Simulation
 * Renders helical spring coils, shaded pin joints, support fixtures, load vectors,
 * and undeformed ghost skeleton with tension/compression color coding.
 */

export class NetworkRenderer {
  constructor(canvas, physics, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.physics = physics;

    this.options = Object.assign({
      showGhost: true,
      showLabels: true,
      showVectors: true,
      showDeformedLength: false,
      zoom: 1.0,
      dispScale: 1.0,
      selectedNodeId: null,
      hoveredNodeId: null,
      hoveredMemberId: null
    }, options);

    // Interaction state
    this.isDragging = false;
    this.draggedNodeId = null;

    this.initEvents();
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.render();
  }

  initEvents() {
    window.addEventListener('resize', () => this.resize());

    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('mouseleave', () => {
      this.options.hoveredNodeId = null;
      this.options.hoveredMemberId = null;
      this.render();
    });

    // Touch support for mobile / tablets
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
          clientX: touch.clientX,
          clientY: touch.clientY
        });
        this.canvas.dispatchEvent(mouseEvent);
      }
    }, { passive: true });

    this.canvas.addEventListener('touchend', () => {
      window.dispatchEvent(new MouseEvent('mouseup'));
    });
  }

  worldToScreen(wx, wy) {
    // Model origin (0, 0) is centered, +X right, +Y up
    const cx = this.width / 2;
    const cy = this.height / 2 - 10; // slightly higher to make room for downward load
    const scale = (Math.min(this.width, this.height) / 230) * this.options.zoom;
    return {
      x: cx + wx * scale,
      y: cy - wy * scale,
      scale: scale
    };
  }

  screenToWorld(sx, sy) {
    const cx = this.width / 2;
    const cy = this.height / 2 - 10;
    const scale = (Math.min(this.width, this.height) / 230) * this.options.zoom;
    return {
      x: (sx - cx) / scale,
      y: -(sy - cy) / scale
    };
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  findNodeAt(sx, sy, hitRadius = 22) {
    for (let i = 0; i < this.physics.nodes.length; i++) {
      const pos = this.physics.getNodeCurrentPos(i, this.options.dispScale);
      const sp = this.worldToScreen(pos.x, pos.y);
      if (Math.hypot(sp.x - sx, sp.y - sy) <= hitRadius) {
        return i;
      }
    }
    return null;
  }

  onMouseDown(e) {
    const m = this.getMousePos(e);
    const nodeId = this.findNodeAt(m.x, m.y);
    if (nodeId !== null) {
      this.isDragging = true;
      this.draggedNodeId = nodeId;
      this.options.selectedNodeId = nodeId;
      if (this.onNodeSelectCallback) {
        this.onNodeSelectCallback(nodeId);
      }
      this.render();
    }
  }

  onMouseMove(e) {
    const m = this.getMousePos(e);

    if (this.isDragging && this.draggedNodeId !== null) {
      const w = this.screenToWorld(m.x, m.y);
      const node = this.physics.nodes[this.draggedNodeId];

      if (!node.fixedX || !node.fixedY) {
        // Dragging acts as interactive load pull
        // Calculate force proportional to displacement from origin or set displacement
        const dx = w.x - node.x0;
        const dy = w.y - node.y0;

        // Apply dynamic force pulling toward mouse
        const kPull = 0.8;
        const fx = node.fixedX ? 0 : (dx - this.physics.displacements[this.draggedNodeId].u) * kPull;
        const fy = node.fixedY ? 0 : (dy - this.physics.displacements[this.draggedNodeId].v) * kPull;

        this.physics.nodes[this.draggedNodeId].fx += fx;
        this.physics.nodes[this.draggedNodeId].fy += fy;
        this.physics.solve();

        if (this.onStateChangeCallback) {
          this.onStateChangeCallback();
        }
      }
      this.render();
      return;
    }

    const hovered = this.findNodeAt(m.x, m.y);
    if (hovered !== this.options.hoveredNodeId) {
      this.options.hoveredNodeId = hovered;
      this.canvas.style.cursor = hovered !== null ? 'pointer' : 'default';
      this.render();
    }
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedNodeId = null;
      this.render();
    }
  }

  /**
   * Main Render Loop
   */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Subtle background grid
    this.drawBackgroundGrid();

    // 1. Draw Ceiling Support fixture (Node 1)
    this.drawCeilingSupport();

    // 2. Draw Ghost (Undeformed) configuration if enabled
    if (this.options.showGhost) {
      this.drawGhostNetwork();
    }

    // 3. Draw Deformed Springs with Helical Coils and Tension/Compression colors
    this.drawSprings();

    // 4. Draw Pins / Spherical Joints
    this.drawNodes();

    // 5. Draw External Forces & Reactions
    if (this.options.showVectors) {
      this.drawForceVectors();
    }

    // 6. Draw Tooltips or Hover Details
    this.drawOverlayInfo();
  }

  drawBackgroundGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.4)';
    ctx.lineWidth = 1;

    const step = 40;
    const cx = this.width / 2;
    const cy = this.height / 2 - 10;

    ctx.beginPath();
    for (let x = cx % step; x < this.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = cy % step; y < this.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // Center crosshairs
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, this.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(this.width, cy);
    ctx.stroke();
    ctx.restore();
  }

  drawCeilingSupport() {
    const ctx = this.ctx;
    const topNode = this.physics.nodes[0];
    const sp = this.worldToScreen(topNode.x0, topNode.y0);

    ctx.save();
    const beamHalfWidth = 65;
    const beamY = sp.y - 14;

    // Horizontal ceiling bar
    ctx.fillStyle = '#64748b';
    ctx.fillRect(sp.x - beamHalfWidth, beamY - 4, beamHalfWidth * 2, 4);

    // Cross-hatch diagonal lines for rigid ground/ceiling
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    const hatchStep = 10;
    for (let x = sp.x - beamHalfWidth; x <= sp.x + beamHalfWidth; x += hatchStep) {
      ctx.moveTo(x, beamY - 4);
      ctx.lineTo(x + 8, beamY - 14);
    }
    ctx.stroke();

    // Small vertical hanger connecting bar to top pin
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sp.x, beamY);
    ctx.lineTo(sp.x, sp.y);
    ctx.stroke();

    // Small hinge bracket
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(sp.x, beamY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawGhostNetwork() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    // Ghost member lines
    for (const m of this.physics.members) {
      const na = this.physics.nodes[m.nodeA];
      const nb = this.physics.nodes[m.nodeB];
      const p1 = this.worldToScreen(na.x0, na.y0);
      const p2 = this.worldToScreen(nb.x0, nb.y0);

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Ghost node rings
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 1.5;

    for (const n of this.physics.nodes) {
      const sp = this.worldToScreen(n.x0, n.y0);
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draws procedural spring coil with helical 3D look
   */
  drawSprings() {
    const ctx = this.ctx;
    const maxF = Math.max(...this.physics.memberResults.map(r => Math.abs(r.force)), 1.0);

    for (const res of this.physics.memberResults) {
      const na = this.physics.nodes[res.nodeA];
      const nb = this.physics.nodes[res.nodeB];

      const p1 = this.worldToScreen(
        na.x0 + this.physics.displacements[res.nodeA].u * this.options.dispScale,
        na.y0 + this.physics.displacements[res.nodeA].v * this.options.dispScale
      );
      const p2 = this.worldToScreen(
        nb.x0 + this.physics.displacements[res.nodeB].u * this.options.dispScale,
        nb.y0 + this.physics.displacements[res.nodeB].v * this.options.dispScale
      );

      // Color mapping:
      // Tension: Blue shades (#2563eb / #0284c7)
      // Compression: Crimson/Orange (#dc2626 / #ea580c)
      // Neutral: Gray (#64748b)
      let springColor = '#64748b';
      let glowColor = 'rgba(100, 116, 139, 0.2)';
      const normalizedForce = Math.min(Math.abs(res.force) / maxF, 1.0);
      const strokeW = 3.0 + normalizedForce * 2.2;

      if (res.state === 'Tension') {
        springColor = res.force > maxF * 0.6 ? '#1d4ed8' : '#2563eb';
        glowColor = 'rgba(37, 99, 235, 0.3)';
      } else if (res.state === 'Compression') {
        springColor = Math.abs(res.force) > maxF * 0.6 ? '#dc2626' : '#ea580c';
        glowColor = 'rgba(234, 88, 12, 0.3)';
      }

      ctx.save();
      // Glow under stroke
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = strokeW + 4;
      this.drawSpringPath(ctx, p1.x, p1.y, p2.x, p2.y, 8, 12);
      ctx.stroke();

      // Main spring body
      ctx.strokeStyle = springColor;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      this.drawSpringPath(ctx, p1.x, p1.y, p2.x, p2.y, 8, 12);
      ctx.stroke();

      // Highlight inner core for 3D helical effect
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1, strokeW * 0.3);
      this.drawSpringPath(ctx, p1.x, p1.y, p2.x, p2.y, 8, 11, 0.8);
      ctx.stroke();

      // Draw force tag near middle of spring if enabled
      if (this.options.showDeformedLength || Math.abs(res.force) > 0.05) {
        this.drawSpringBadge(p1, p2, res);
      }

      ctx.restore();
    }
  }

  /**
   * Procedural helical coil path generator
   */
  drawSpringPath(ctx, x1, y1, x2, y2, coils = 8, amplitude = 12, ampScale = 1.0) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const ux = dx / dist;
    const uy = dy / dist;
    const perpX = -uy;
    const perpY = ux;

    const leadLen = 18; // straight lead connecting pin
    const activeLen = Math.max(10, dist - 2 * leadLen);
    const effAmp = amplitude * ampScale;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + ux * leadLen, y1 + uy * leadLen);

    const stepsPerCoil = 4;
    const totalSteps = coils * stepsPerCoil;

    for (let s = 1; s <= totalSteps; s++) {
      const frac = s / totalSteps;
      const tDist = leadLen + activeLen * frac;
      const midX = x1 + ux * tDist;
      const midY = y1 + uy * tDist;

      // Sinusoidal wave perpendicular to axis
      const phase = frac * coils * Math.PI * 2;
      const offset = Math.sin(phase) * effAmp;

      ctx.lineTo(midX + perpX * offset, midY + perpY * offset);
    }

    ctx.lineTo(x2 - ux * leadLen, y2 - uy * leadLen);
    ctx.lineTo(x2, y2);
  }

  drawSpringBadge(p1, p2, res) {
    const ctx = this.ctx;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const unitLabels = this.physics.getUnitLabels();

    const sign = res.state === 'Compression' ? 'C: ' : (res.state === 'Tension' ? 'T: ' : '');
    const text = `${sign}${Math.abs(res.force).toFixed(1)} ${unitLabels.force}`;

    ctx.save();
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    const textW = ctx.measureText(text).width;
    const pad = 5;

    ctx.fillStyle = res.state === 'Tension' ? 'rgba(239, 246, 255, 0.92)' :
                    (res.state === 'Compression' ? 'rgba(254, 242, 242, 0.92)' : 'rgba(241, 245, 249, 0.92)');
    ctx.strokeStyle = res.state === 'Tension' ? '#3b82f6' :
                     (res.state === 'Compression' ? '#ef4444' : '#94a3b8');
    ctx.lineWidth = 1;

    // Small rounded rect
    const bx = midX - textW / 2 - pad;
    const by = midY - 9;
    const bw = textW + pad * 2;
    const bh = 18;

    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = res.state === 'Tension' ? '#1e40af' :
                    (res.state === 'Compression' ? '#b91c1c' : '#475569');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, midX, midY);

    ctx.restore();
  }

  drawNodes() {
    const ctx = this.ctx;

    for (let i = 0; i < this.physics.nodes.length; i++) {
      const node = this.physics.nodes[i];
      const pos = this.physics.getNodeCurrentPos(i, this.options.dispScale);
      const sp = this.worldToScreen(pos.x, pos.y);

      const isSelected = this.options.selectedNodeId === i;
      const isHovered = this.options.hoveredNodeId === i;
      const radius = isSelected ? 15 : (isHovered ? 14 : 13);

      ctx.save();

      // Selection halo
      if (isSelected) {
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, radius + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shaded metallic sphere
      const grad = ctx.createRadialGradient(
        sp.x - radius * 0.35, sp.y - radius * 0.35, radius * 0.1,
        sp.x, sp.y, radius
      );

      if (node.fixedX && node.fixedY) {
        // Pinned node (Top) - deep slate/steel blue
        grad.addColorStop(0, '#bae6fd');
        grad.addColorStop(0.3, '#38bdf8');
        grad.addColorStop(0.85, '#0284c7');
        grad.addColorStop(1, '#0369a1');
      } else if (i === 3 && Math.abs(node.fy) > 0.1) {
        // Loaded node (Bottom) - vibrant cyan/amber
        grad.addColorStop(0, '#fed7aa');
        grad.addColorStop(0.3, '#f97316');
        grad.addColorStop(0.85, '#c2410c');
        grad.addColorStop(1, '#7c2d12');
      } else {
        // Free nodes (Left, Right) - clean azure sphere
        grad.addColorStop(0, '#e0f2fe');
        grad.addColorStop(0.3, '#38bdf8');
        grad.addColorStop(0.85, '#0284c7');
        grad.addColorStop(1, '#075985');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle edge ring
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Node label
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${i + 1}`, sp.x, sp.y);

      // Name caption
      if (this.options.showLabels) {
        ctx.font = '500 11px system-ui, sans-serif';
        ctx.fillStyle = '#334155';
        let labelOffset = 22;
        if (i === 0) labelOffset = -22; // Top
        if (i === 1) { // Left
          ctx.textAlign = 'right';
          ctx.fillText('Pin 2 (Left)', sp.x - 18, sp.y);
        } else if (i === 2) { // Right
          ctx.textAlign = 'left';
          ctx.fillText('Pin 3 (Right)', sp.x + 18, sp.y);
        } else if (i === 3) { // Bottom
          ctx.textAlign = 'center';
          ctx.fillText('Pin 4 (Bottom)', sp.x, sp.y + labelOffset);
        } else if (i === 0) {
          ctx.textAlign = 'center';
          ctx.fillText('Pin 1 (Support)', sp.x, sp.y + labelOffset);
        }
      }

      ctx.restore();
    }
  }

  drawForceVectors() {
    const ctx = this.ctx;
    const unitLabels = this.physics.getUnitLabels();

    // 1. External load vector at Node 4 (or any loaded node)
    for (let i = 0; i < this.physics.nodes.length; i++) {
      const node = this.physics.nodes[i];
      const fx = node.fx;
      const fy = node.fy;
      const mag = Math.hypot(fx, fy);

      if (mag > 0.1) {
        const pos = this.physics.getNodeCurrentPos(i, this.options.dispScale);
        const sp = this.worldToScreen(pos.x, pos.y);

        // Vector direction on screen: +fx is +X screen, +fy is -Y screen
        const arrowLen = Math.min(80, Math.max(35, mag * 1.6));
        const dirX = fx / mag;
        const dirY = -fy / mag;

        const startX = sp.x;
        const startY = sp.y;
        const endX = startX + dirX * arrowLen;
        const endY = startY + dirY * arrowLen;

        this.drawVectorArrow(
          ctx, startX, startY, endX, endY,
          '#d97706', 3.5,
          `F_ext = ${mag.toFixed(1)} ${unitLabels.force}`
        );
      }
    }

    // 2. Reaction vector at Node 1 (Ceiling reaction)
    for (let i = 0; i < this.physics.nodes.length; i++) {
      const node = this.physics.nodes[i];
      if (node.fixedX || node.fixedY) {
        const rx = this.physics.reactions[i].rx;
        const ry = this.physics.reactions[i].ry;
        const magR = Math.hypot(rx, ry);

        if (magR > 0.1) {
          const pos = this.physics.getNodeCurrentPos(i, this.options.dispScale);
          const sp = this.worldToScreen(pos.x, pos.y);

          const arrowLen = Math.min(70, Math.max(30, magR * 1.4));
          const dirX = rx / magR;
          const dirY = -ry / magR;

          // Reaction points upward on ceiling
          const endX = sp.x;
          const endY = sp.y;
          const startX = endX - dirX * arrowLen;
          const startY = endY - dirY * arrowLen;

          this.drawVectorArrow(
            ctx, startX, startY, endX, endY,
            '#0284c7', 3.0,
            `R = ${magR.toFixed(1)} ${unitLabels.force}`
          );
        }
      }
    }
  }

  drawVectorArrow(ctx, x1, y1, x2, y2, color, lineWidth = 3, label = '') {
    const headLen = 11;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    // Shaft
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Label
    if (label) {
      ctx.font = '600 11px system-ui, sans-serif';
      const textX = x2 + 10 * Math.cos(angle);
      const textY = y2 + 10 * Math.sin(angle);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Background badge
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(textX - tw / 2 - 3, textY - 8, tw + 6, 16);

      ctx.fillStyle = color;
      ctx.fillText(label, textX, textY);
    }

    ctx.restore();
  }

  drawOverlayInfo() {
    // Legend in top-left corner
    const ctx = this.ctx;
    ctx.save();
    const lx = 14;
    const ly = 16;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, ly, 150, 76, 6);
    ctx.fill();
    ctx.stroke();

    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Mechanical State', lx + 10, ly + 16);

    // Tension line
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 32);
    ctx.lineTo(lx + 32, ly + 32);
    ctx.stroke();
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillStyle = '#2563eb';
    ctx.fillText('Tension (Stretched)', lx + 38, ly + 35);

    // Compression line
    ctx.strokeStyle = '#ea580c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 48);
    ctx.lineTo(lx + 32, ly + 48);
    ctx.stroke();
    ctx.fillStyle = '#ea580c';
    ctx.fillText('Compression (Pushed)', lx + 38, ly + 51);

    // Undeformed ghost line
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(lx + 10, ly + 64);
    ctx.lineTo(lx + 32, ly + 64);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.fillText('Undeformed Ghost', lx + 38, ly + 67);

    ctx.restore();
  }
}
