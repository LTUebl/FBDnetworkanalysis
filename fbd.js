/**
 * fbd.js - Free Body Diagram Renderer & Statics Data Explorer
 * Renders isolated node pin with cut boundaries, all incoming/outgoing force vectors,
 * orthogonal vector components, angle arcs, and exact equilibrium summations.
 */

export class FBDExplorer {
  constructor(canvas, physics, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.physics = physics;

    this.options = Object.assign({
      selectedNodeId: 3, // Default to Node 4 (Bottom pin)
      showComponents: true,
      showAngles: true,
      vectorScale: 2.2
    }, options);

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
  }

  setSelectedNode(nodeId) {
    this.options.selectedNodeId = nodeId;
    this.render();
    this.updateEquilibriumEquations();
  }

  setShowComponents(show) {
    this.options.showComponents = show;
    this.render();
  }

  setShowAngles(show) {
    this.options.showAngles = show;
    this.render();
  }

  /**
   * Main FBD Render
   */
  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    const nodeId = this.options.selectedNodeId;
    if (nodeId === null || nodeId === undefined) return;

    const node = this.physics.nodes[nodeId];
    const unitLabels = this.physics.getUnitLabels();
    const cx = w / 2;
    const cy = h / 2;

    // 1. Background grid & axis lines
    this.drawAxes(cx, cy);

    // 2. Imaginary cut boundary (dashed circular bubble as in Jacobs Fig 3.4/3.5)
    this.drawCutBoundary(cx, cy);

    // 3. Central Pin Joint
    this.drawCenterPin(cx, cy, nodeId);

    // 4. Force Vectors acting ON this pin
    this.drawPinForces(cx, cy, nodeId, unitLabels);
  }

  drawAxes(cx, cy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.8)';
    ctx.lineWidth = 1;

    // +X and +Y axes
    ctx.beginPath();
    ctx.moveTo(15, cy);
    ctx.lineTo(this.width - 15, cy);
    ctx.moveTo(cx, 15);
    ctx.lineTo(cx, this.height - 15);
    ctx.stroke();

    // Axis labels
    ctx.font = '500 11px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText('+x', this.width - 18, cy - 6);
    ctx.textAlign = 'center';
    ctx.fillText('+y', cx + 12, 22);

    ctx.restore();
  }

  drawCutBoundary(cx, cy) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.35)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, Math.PI * 2);
    ctx.stroke();

    // Label: "Imaginary Boundary"
    ctx.font = 'italic 10px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'left';
    ctx.fillText('Imaginary Cut Boundary', cx - 74, cy - 82);
    ctx.restore();
  }

  drawCenterPin(cx, cy, nodeId) {
    const ctx = this.ctx;
    const radius = 18;

    ctx.save();
    const grad = ctx.createRadialGradient(
      cx - radius * 0.35, cy - radius * 0.35, radius * 0.1,
      cx, cy, radius
    );
    grad.addColorStop(0, '#e0f2fe');
    grad.addColorStop(0.35, '#38bdf8');
    grad.addColorStop(0.85, '#0284c7');
    grad.addColorStop(1, '#075985');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Pin ${nodeId + 1}`, cx, cy);

    ctx.restore();
  }

  drawPinForces(cx, cy, nodeId, unitLabels) {
    const ctx = this.ctx;
    const node = this.physics.nodes[nodeId];

    // Collect all forces acting on this node:
    // 1. Spring forces
    const forces = [];

    for (const res of this.physics.memberResults) {
      if (res.nodeA === nodeId) {
        // Force on A from spring
        forces.push({
          type: 'member',
          name: res.shortName,
          state: res.state,
          fx: res.forceOnA.fx,
          fy: res.forceOnA.fy,
          mag: Math.hypot(res.forceOnA.fx, res.forceOnA.fy),
          color: res.state === 'Tension' ? '#2563eb' : (res.state === 'Compression' ? '#dc2626' : '#64748b'),
          label: `F_${res.shortName}`
        });
      } else if (res.nodeB === nodeId) {
        // Force on B from spring
        forces.push({
          type: 'member',
          name: res.shortName,
          state: res.state,
          fx: res.forceOnB.fx,
          fy: res.forceOnB.fy,
          mag: Math.hypot(res.forceOnB.fx, res.forceOnB.fy),
          color: res.state === 'Tension' ? '#2563eb' : (res.state === 'Compression' ? '#dc2626' : '#64748b'),
          label: `F_${res.shortName}`
        });
      }
    }

    // 2. External applied load
    const extMag = Math.hypot(node.fx, node.fy);
    if (extMag > 0.05) {
      forces.push({
        type: 'external',
        name: 'Ext Load',
        state: 'External',
        fx: node.fx,
        fy: node.fy,
        mag: extMag,
        color: '#d97706',
        label: 'F_ext'
      });
    }

    // 3. Support Reactions
    const rx = this.physics.reactions[nodeId].rx;
    const ry = this.physics.reactions[nodeId].ry;
    const rMag = Math.hypot(rx, ry);
    if ((node.fixedX || node.fixedY) && rMag > 0.05) {
      forces.push({
        type: 'reaction',
        name: 'Reaction R',
        state: 'Reaction',
        fx: rx,
        fy: ry,
        mag: rMag,
        color: '#7c3aed',
        label: 'R'
      });
    }

    // Scale vectors so they fit within the FBD canvas nicely
    const maxMag = Math.max(...forces.map(f => f.mag), 1.0);
    const maxLen = 75; // max arrow length in pixels
    const minLen = 26;

    for (const f of forces) {
      if (f.mag < 0.01) continue;

      const norm = f.mag / maxMag;
      const arrowLen = minLen + norm * (maxLen - minLen);

      // Force direction in math: (+fx, +fy)
      // Screen coordinates: dx = +fx, dy = -fy
      const dirX = f.fx / f.mag;
      const dirY = -f.fy / f.mag;

      const pinRadius = 18;
      const startX = cx + dirX * pinRadius;
      const startY = cy + dirY * pinRadius;
      const endX = cx + dirX * (pinRadius + arrowLen);
      const endY = cy + dirY * (pinRadius + arrowLen);

      // Draw dashed orthogonal components if toggled
      if (this.options.showComponents && (Math.abs(f.fx) > 0.1 && Math.abs(f.fy) > 0.1)) {
        this.drawComponentProjections(cx, cy, startX, startY, endX, endY, f, pinRadius, arrowLen, dirX, dirY);
      }

      // Draw vector arrow
      const textLabel = `${f.label} = ${f.mag.toFixed(1)} ${unitLabels.force}`;
      this.drawVectorArrow(ctx, startX, startY, endX, endY, f.color, 3.2, textLabel);

      // Draw angle arc if enabled
      if (this.options.showAngles && Math.abs(f.fx) > 0.05 && Math.abs(f.fy) > 0.05) {
        this.drawAngleArc(cx, cy, dirX, dirY, f);
      }
    }
  }

  drawComponentProjections(cx, cy, startX, startY, endX, endY, f, pinRadius, arrowLen, dirX, dirY) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = f.color;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1.5;

    // Component right triangle from start to end
    // X-component first, then Y-component
    const compCornerX = endX;
    const compCornerY = startY;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(compCornerX, compCornerY);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Component labels
    ctx.globalAlpha = 0.85;
    ctx.font = '500 10px system-ui, sans-serif';
    ctx.fillStyle = f.color;
    ctx.textAlign = 'center';

    const unitLabels = this.physics.getUnitLabels();
    const fxText = `${Math.abs(f.fx).toFixed(1)}`;
    const fyText = `${Math.abs(f.fy).toFixed(1)}`;

    // Draw fx label along horizontal leg
    ctx.fillText(`Fx: ${fxText}`, (startX + compCornerX) / 2, compCornerY + (dirY > 0 ? -6 : 14));
    // Draw fy label along vertical leg
    ctx.textAlign = dirX > 0 ? 'left' : 'right';
    ctx.fillText(`Fy: ${fyText}`, compCornerX + (dirX > 0 ? 5 : -5), (compCornerY + endY) / 2);

    ctx.restore();
  }

  drawAngleArc(cx, cy, dirX, dirY, f) {
    const ctx = this.ctx;
    const angleRad = Math.atan2(Math.abs(f.fy), Math.abs(f.fx));
    const deg = (angleRad * 180 / Math.PI).toFixed(0);

    ctx.save();
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.2;

    const arcR = 30;
    const startAngle = dirX >= 0 ? 0 : Math.PI;
    const sweep = dirY < 0 ? -angleRad : angleRad;
    const endAngle = startAngle + (dirX >= 0 ? (dirY < 0 ? -angleRad : angleRad) : (dirY < 0 ? angleRad : -angleRad));

    ctx.beginPath();
    ctx.arc(cx, cy, arcR, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
    ctx.stroke();

    ctx.font = '500 10px system-ui, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'center';
    ctx.fillText(`${deg}°`, cx + (dirX >= 0 ? 1 : -1) * (arcR + 10), cy + (dirY < 0 ? -1 : 1) * 12);
    ctx.restore();
  }

  drawVectorArrow(ctx, x1, y1, x2, y2, color, lineWidth = 3, label = '') {
    const headLen = 10;
    const angle = Math.atan2(y2 - y1, x2 - x1);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = '600 11px system-ui, sans-serif';
      const textDist = 14;
      const textX = x2 + textDist * Math.cos(angle);
      const textY = y2 + textDist * Math.sin(angle);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fillRect(textX - tw / 2 - 3, textY - 8, tw + 6, 16);

      ctx.fillStyle = color;
      ctx.fillText(label, textX, textY);
    }
    ctx.restore();
  }

  /**
   * Generates equilibrium equations string and statics explanation for DOM
   */
  getEquilibriumDetails(nodeId) {
    const node = this.physics.nodes[nodeId];
    const unitLabels = this.physics.getUnitLabels();
    const componentsX = [];
    const componentsY = [];

    // Members connected
    for (const res of this.physics.memberResults) {
      if (res.nodeA === nodeId) {
        componentsX.push({ name: `F_${res.shortName}x`, val: res.forceOnA.fx, state: res.state });
        componentsY.push({ name: `F_${res.shortName}y`, val: res.forceOnA.fy, state: res.state });
      } else if (res.nodeB === nodeId) {
        componentsX.push({ name: `F_${res.shortName}x`, val: res.forceOnB.fx, state: res.state });
        componentsY.push({ name: `F_${res.shortName}y`, val: res.forceOnB.fy, state: res.state });
      }
    }

    // External force
    if (Math.abs(node.fx) > 0.05) {
      componentsX.push({ name: 'F_ext,x', val: node.fx, state: 'Ext' });
    }
    if (Math.abs(node.fy) > 0.05) {
      componentsY.push({ name: 'F_ext,y', val: node.fy, state: 'Ext' });
    }

    // Reaction force
    const rx = this.physics.reactions[nodeId].rx;
    const ry = this.physics.reactions[nodeId].ry;
    if (node.fixedX && Math.abs(rx) > 0.05) {
      componentsX.push({ name: 'R_x', val: rx, state: 'Reaction' });
    }
    if (node.fixedY && Math.abs(ry) > 0.05) {
      componentsY.push({ name: 'R_y', val: ry, state: 'Reaction' });
    }

    const sumX = componentsX.reduce((acc, c) => acc + c.val, 0);
    const sumY = componentsY.reduce((acc, c) => acc + c.val, 0);

    // Format equation lines
    const eqXStr = componentsX.length > 0
      ? componentsX.map(c => `${c.val >= 0 ? '+' : '-'} ${Math.abs(c.val).toFixed(2)} (${c.name})`).join(' ') + ` = ${sumX.toFixed(2)} ${unitLabels.force}`
      : `0.00 = 0.00 ${unitLabels.force}`;

    const eqYStr = componentsY.length > 0
      ? componentsY.map(c => `${c.val >= 0 ? '+' : '-'} ${Math.abs(c.val).toFixed(2)} (${c.name})`).join(' ') + ` = ${sumY.toFixed(2)} ${unitLabels.force}`
      : `0.00 = 0.00 ${unitLabels.force}`;

    const isBalanced = Math.abs(sumX) < 0.05 && Math.abs(sumY) < 0.05;

    // Statics pedagogical explanation
    let explanation = '';
    if (nodeId === 3) { // Bottom pin
      explanation = `<strong>Pin 4 (Bottom):</strong> The applied downward force <code>F_ext</code> is balanced by the upward vertical components of diagonal springs <code>4-1</code> and <code>4-2</code>. Because both springs pull upward and inward, both are in <strong>Tension</strong>. Their horizontal pull cancels out by symmetry.`;
    } else if (nodeId === 1) { // Left pin
      explanation = `<strong>Pin 2 (Left):</strong> Spring <code>1-2</code> pulls up-and-right, while Spring <code>4-1</code> pulls down-and-right. Both diagonal springs exert a net rightward pull toward the center. To satisfy horizontal equilibrium (&Sigma;Fx = 0), the middle cross-spring <code>2-3</code> must <strong>push leftward</strong> on Pin 2. A member that pushes outward on its endpoints is in <strong>Compression</strong>!`;
    } else if (nodeId === 2) { // Right pin
      explanation = `<strong>Pin 3 (Right):</strong> Symmetrical to Pin 2. Springs <code>1-3</code> and <code>4-2</code> exert a net leftward pull toward the center. Cross-spring <code>2-3</code> pushes rightward on Pin 3, confirming <strong>Compression</strong> across the polymer network waist.`;
    } else if (nodeId === 0) { // Top pin
      explanation = `<strong>Pin 1 (Top / Support):</strong> Diagonal springs <code>1-2</code> and <code>1-3</code> pull downward on this pin with tension. The rigid ceiling support provides an upward reaction force <code>R_y</code> that exactly equals the total applied vertical load.`;
    }

    return {
      nodeName: node.name,
      sumX: sumX,
      sumY: sumY,
      eqXStr: eqXStr.startsWith('+ ') ? eqXStr.substring(2) : eqXStr,
      eqYStr: eqYStr.startsWith('+ ') ? eqYStr.substring(2) : eqYStr,
      isBalanced: isBalanced,
      explanation: explanation
    };
  }

  updateEquilibriumEquations() {
    if (this.onEquationsUpdateCallback) {
      const details = this.getEquilibriumDetails(this.options.selectedNodeId);
      this.onEquationsUpdateCallback(details);
    }
  }
}
