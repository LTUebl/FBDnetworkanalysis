/**
 * app.js - Main Application Coordinator for Polymer Network Mechanics
 * Connects Physics Engine, Canvas Renderer, FBD Explorer, Controls, and Data Table.
 */

import { PolymerNetworkPhysics } from './physics.js';
import { NetworkRenderer } from './renderer.js';
import { FBDExplorer } from './fbd.js';

class PolymerApp {
  constructor() {
    this.physics = new PolymerNetworkPhysics();
    this.selectedNodeId = 3; // Default to Node 4 (Bottom pin)

    this.initElements();
    this.initViews();
    this.initEventListeners();
    this.applyPreset('textbook');
    this.updateAll();
  }

  initElements() {
    // Sliders
    this.fySlider = document.getElementById('slider-fy');
    this.fyVal = document.getElementById('val-fy');
    this.fxSlider = document.getElementById('slider-fx');
    this.fxVal = document.getElementById('val-fx');

    this.kOuterSlider = document.getElementById('slider-kouter');
    this.kOuterVal = document.getElementById('val-kouter');
    this.kMidSlider = document.getElementById('slider-kmid');
    this.kMidVal = document.getElementById('val-kmid');

    this.scaleSlider = document.getElementById('slider-scale');
    this.scaleVal = document.getElementById('val-scale');

    // Status elements
    this.statMaxStress = document.getElementById('stat-max-stress');
    this.statCritMember = document.getElementById('stat-crit-member');
    this.statDisp = document.getElementById('stat-disp');
    this.statEnergy = document.getElementById('stat-energy');

    // FBD & Statics elements
    this.eqSumX = document.getElementById('eq-sum-x');
    this.eqSumY = document.getElementById('eq-sum-y');
    this.fbdExplanation = document.getElementById('fbd-explanation');
    this.tableBody = document.getElementById('table-body');

    // Modal
    this.theoryModal = document.getElementById('theory-modal');
    this.openTheoryBtn = document.getElementById('btn-open-theory');
    this.closeTheoryBtn = document.getElementById('btn-close-theory');

    // Export buttons
    this.btnExportCsv = document.getElementById('btn-export-csv');
    this.btnReset = document.getElementById('btn-reset');

    // Solver mode select
    this.solverSelect = document.getElementById('select-solver');
    this.unitSelect = document.getElementById('select-units');

    // Checkboxes
    this.chkGhost = document.getElementById('chk-ghost');
    this.chkComponents = document.getElementById('chk-components');
    this.chkAngles = document.getElementById('chk-angles');
  }

  initViews() {
    const simCanvas = document.getElementById('sim-canvas');
    const fbdCanvas = document.getElementById('fbd-canvas');

    this.renderer = new NetworkRenderer(simCanvas, this.physics, {
      selectedNodeId: this.selectedNodeId
    });

    this.fbdExplorer = new FBDExplorer(fbdCanvas, this.physics, {
      selectedNodeId: this.selectedNodeId
    });

    // Wire callbacks
    this.renderer.onNodeSelectCallback = (nodeId) => {
      this.selectNode(nodeId);
    };

    this.renderer.onStateChangeCallback = () => {
      this.syncControlsFromPhysics();
      this.updateAll();
    };

    this.fbdExplorer.onEquationsUpdateCallback = (details) => {
      this.renderEquilibriumDetails(details);
    };
  }

  initEventListeners() {
    // Sliders
    this.fySlider.addEventListener('input', () => {
      const fy = parseFloat(this.fySlider.value);
      const fx = parseFloat(this.fxSlider.value);
      this.physics.setAppliedLoad(3, fx, fy);
      this.fyVal.textContent = `${fy.toFixed(0)} ${this.physics.getUnitLabels().force}`;
      this.updateAll();
    });

    this.fxSlider.addEventListener('input', () => {
      const fx = parseFloat(this.fxSlider.value);
      const fy = parseFloat(this.fySlider.value);
      this.physics.setAppliedLoad(3, fx, fy);
      this.fxVal.textContent = `${fx.toFixed(0)} ${this.physics.getUnitLabels().force}`;
      this.updateAll();
    });

    this.kOuterSlider.addEventListener('input', () => {
      const ko = parseFloat(this.kOuterSlider.value);
      const km = parseFloat(this.kMidSlider.value);
      this.physics.setStiffnesses(ko, km);
      this.kOuterVal.textContent = `${ko.toFixed(0)} ${this.physics.getUnitLabels().stiffness}`;
      this.updateAll();
    });

    this.kMidSlider.addEventListener('input', () => {
      const ko = parseFloat(this.kOuterSlider.value);
      const km = parseFloat(this.kMidSlider.value);
      this.physics.setStiffnesses(ko, km);
      this.kMidVal.textContent = `${km.toFixed(0)} ${this.physics.getUnitLabels().stiffness}`;
      this.updateAll();
    });

    this.scaleSlider.addEventListener('input', () => {
      const scale = parseFloat(this.scaleSlider.value);
      this.renderer.options.dispScale = scale;
      this.scaleVal.textContent = `${scale.toFixed(1)}x`;
      this.renderer.render();
    });

    // Checkboxes
    this.chkGhost.addEventListener('change', () => {
      this.renderer.options.showGhost = this.chkGhost.checked;
      this.renderer.render();
    });

    this.chkComponents.addEventListener('change', () => {
      this.fbdExplorer.setShowComponents(this.chkComponents.checked);
    });

    this.chkAngles.addEventListener('change', () => {
      this.fbdExplorer.setShowAngles(this.chkAngles.checked);
    });

    // Node selection chips
    document.querySelectorAll('.node-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const nodeId = parseInt(chip.getAttribute('data-node'), 10);
        this.selectNode(nodeId);
      });
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset');
        this.applyPreset(preset);
      });
    });

    // Boundary conditions checkboxes (Nodes 1 to 4)
    for (let i = 0; i < 4; i++) {
      const chkFixX = document.getElementById(`fix-${i + 1}-x`);
      const chkFixY = document.getElementById(`fix-${i + 1}-y`);

      if (chkFixX && chkFixY) {
        chkFixX.addEventListener('change', () => {
          this.physics.setNodeFixation(i, chkFixX.checked, chkFixY.checked);
          this.updateAll();
        });
        chkFixY.addEventListener('change', () => {
          this.physics.setNodeFixation(i, chkFixX.checked, chkFixY.checked);
          this.updateAll();
        });
      }
    }

    // Solver mode
    this.solverSelect.addEventListener('change', () => {
      this.physics.setSolverMode(this.solverSelect.value);
      this.updateAll();
    });

    // Units
    this.unitSelect.addEventListener('change', () => {
      this.physics.setUnitMode(this.unitSelect.value);
      this.updateUnitsDisplay();
      this.updateAll();
    });

    // Reset button
    this.btnReset.addEventListener('click', () => {
      this.applyPreset('textbook');
    });

    // Export CSV
    this.btnExportCsv.addEventListener('click', () => {
      this.exportDataCSV();
    });

    // Theory Modal
    this.openTheoryBtn.addEventListener('click', () => {
      this.theoryModal.classList.add('active');
    });

    this.closeTheoryBtn.addEventListener('click', () => {
      this.theoryModal.classList.remove('active');
    });

    this.theoryModal.addEventListener('click', (e) => {
      if (e.target === this.theoryModal) {
        this.theoryModal.classList.remove('active');
      }
    });
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    this.renderer.options.selectedNodeId = nodeId;
    this.fbdExplorer.setSelectedNode(nodeId);

    // Update active UI chips
    document.querySelectorAll('.node-chip').forEach(chip => {
      const id = parseInt(chip.getAttribute('data-node'), 10);
      if (id === nodeId) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    this.renderer.render();
  }

  applyPreset(presetKey) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === presetKey);
    });

    // Reset all nodes to standard fixation
    this.physics.nodes[0].fixedX = true;
    this.physics.nodes[0].fixedY = true;
    this.physics.nodes[1].fixedX = false;
    this.physics.nodes[1].fixedY = false;
    this.physics.nodes[2].fixedX = false;
    this.physics.nodes[2].fixedY = false;
    this.physics.nodes[3].fixedX = false;
    this.physics.nodes[3].fixedY = false;

    // Clear loads
    for (let i = 0; i < 4; i++) {
      this.physics.nodes[i].fx = 0;
      this.physics.nodes[i].fy = 0;
    }

    if (presetKey === 'textbook') {
      // Textbook baseline: -25 N downward at Pin 4, standard stiffnesses
      this.physics.nodes[3].fy = -25.0;
      this.physics.nodes[3].fx = 0.0;
      this.physics.setStiffnesses(50.0, 40.0);
    } else if (presetKey === 'soft-cross') {
      // Soft middle spring (compliant cross-linker)
      this.physics.nodes[3].fy = -30.0;
      this.physics.nodes[3].fx = 0.0;
      this.physics.setStiffnesses(60.0, 8.0);
    } else if (presetKey === 'rigid-cross') {
      // Rigid middle cross-linker
      this.physics.nodes[3].fy = -30.0;
      this.physics.nodes[3].fx = 0.0;
      this.physics.setStiffnesses(50.0, 150.0);
    } else if (presetKey === 'shear') {
      // Asymmetric shear: lateral force at Pin 4
      this.physics.nodes[3].fy = -20.0;
      this.physics.nodes[3].fx = 20.0;
      this.physics.setStiffnesses(50.0, 40.0);
    } else if (presetKey === 'compression-test') {
      // Upward compressive push at Pin 4
      this.physics.nodes[3].fy = +25.0;
      this.physics.nodes[3].fx = 0.0;
      this.physics.setStiffnesses(50.0, 40.0);
    } else if (presetKey === 'biaxial') {
      // Biaxial tension: pull down and pull sides outward
      this.physics.nodes[3].fy = -25.0;
      this.physics.nodes[1].fx = -15.0;
      this.physics.nodes[2].fx = +15.0;
      this.physics.setStiffnesses(50.0, 40.0);
    }

    this.physics.solve();
    this.syncControlsFromPhysics();
    this.updateAll();
  }

  syncControlsFromPhysics() {
    const fy = this.physics.nodes[3].fy;
    const fx = this.physics.nodes[3].fx;
    this.fySlider.value = fy;
    this.fxSlider.value = fx;

    const u = this.physics.getUnitLabels();
    this.fyVal.textContent = `${fy.toFixed(0)} ${u.force}`;
    this.fxVal.textContent = `${fx.toFixed(0)} ${u.force}`;

    const kOuter = this.physics.members[0].k;
    const kMid = this.physics.members[4].k;
    this.kOuterSlider.value = kOuter;
    this.kMidSlider.value = kMid;
    this.kOuterVal.textContent = `${kOuter.toFixed(0)} ${u.stiffness}`;
    this.kMidVal.textContent = `${kMid.toFixed(0)} ${u.stiffness}`;

    // Update fixation checkboxes
    for (let i = 0; i < 4; i++) {
      const cx = document.getElementById(`fix-${i + 1}-x`);
      const cy = document.getElementById(`fix-${i + 1}-y`);
      if (cx) cx.checked = this.physics.nodes[i].fixedX;
      if (cy) cy.checked = this.physics.nodes[i].fixedY;
    }
  }

  updateUnitsDisplay() {
    const u = this.physics.getUnitLabels();
    document.querySelectorAll('.unit-force').forEach(el => el.textContent = u.force);
    document.querySelectorAll('.unit-disp').forEach(el => el.textContent = u.disp);
    document.querySelectorAll('.unit-stiffness').forEach(el => el.textContent = u.stiffness);
    document.querySelectorAll('.unit-stress').forEach(el => el.textContent = u.stress);
    document.querySelectorAll('.unit-energy').forEach(el => el.textContent = u.energy);
  }

  updateAll() {
    const u = this.physics.getUnitLabels();

    // 1. Update Status Dashboard
    this.statMaxStress.textContent = `${this.physics.status.maxStress.toFixed(1)} ${u.stress}`;
    this.statCritMember.textContent = `Member: ${this.physics.status.criticalMember.replace('Spring ', '')}`;
    this.statDisp.textContent = `${this.physics.status.botDisplacement.toFixed(2)} ${u.disp}`;
    this.statEnergy.textContent = `${this.physics.status.strainEnergy.toFixed(1)} ${u.energy}`;

    // 2. Render Simulation Panel
    this.renderer.render();

    // 3. Render FBD Panel
    this.fbdExplorer.render();
    const fbdDetails = this.fbdExplorer.getEquilibriumDetails(this.selectedNodeId);
    this.renderEquilibriumDetails(fbdDetails);

    // 4. Update Analytical Data Table
    this.renderDataTable();
  }

  renderEquilibriumDetails(details) {
    if (!details) return;

    const u = this.physics.getUnitLabels();
    this.eqSumX.innerHTML = `&Sigma;Fx = ${details.eqXStr}`;
    this.eqSumY.innerHTML = `&Sigma;Fy = ${details.eqYStr}`;

    this.eqSumX.className = `eq-val ${Math.abs(details.sumX) < 0.05 ? 'balanced' : 'unbalanced'}`;
    this.eqSumY.className = `eq-val ${Math.abs(details.sumY) < 0.05 ? 'balanced' : 'unbalanced'}`;

    this.fbdExplanation.innerHTML = details.explanation;
  }

  renderDataTable() {
    const u = this.physics.getUnitLabels();
    let html = '';

    for (const res of this.physics.memberResults) {
      const stateBadge = res.state === 'Tension'
        ? `<span class="badge badge-tension">Tension</span>`
        : (res.state === 'Compression'
          ? `<span class="badge badge-compression">Compression</span>`
          : `<span class="badge">Neutral</span>`);

      const forceDisplay = `${res.force >= 0 ? '+' : ''}${res.force.toFixed(2)}`;
      const strainDisplay = `${(res.strain * 100).toFixed(2)}%`;
      const stressDisplay = `${res.stress.toFixed(2)}`;

      html += `
        <tr>
          <td><strong>${res.shortName}</strong></td>
          <td>${res.L0.toFixed(1)}</td>
          <td>${res.L.toFixed(1)}</td>
          <td>${res.deltaL >= 0 ? '+' : ''}${res.deltaL.toFixed(2)}</td>
          <td>${forceDisplay}</td>
          <td>${stressDisplay}</td>
          <td>${strainDisplay}</td>
          <td>${stateBadge}</td>
        </tr>
      `;
    }

    this.tableBody.innerHTML = html;
  }

  exportDataCSV() {
    const u = this.physics.getUnitLabels();
    let csv = `Member,L0 (${u.length}),L (${u.length}),deltaL (${u.length}),k (${u.stiffness}),Force (${u.force}),Stress (${u.stress}),Strain (%),State\n`;

    for (const res of this.physics.memberResults) {
      csv += `"${res.name}",${res.L0.toFixed(2)},${res.L.toFixed(2)},${res.deltaL.toFixed(2)},${res.k.toFixed(1)},${res.force.toFixed(2)},${res.stress.toFixed(2)},${(res.strain * 100).toFixed(2)},"${res.state}"\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `polymer_network_analysis_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.polymerApp = new PolymerApp();
});
