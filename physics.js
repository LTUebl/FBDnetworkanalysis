/**
 * physics.js - Structural Mechanics & Equilibrium Engine for Polymer Network
 * Based on Jacobs, Huang, & Kwon - 'Introduction to Cell Mechanics and Mechanobiology' (Fig 3.3)
 */

export class PolymerNetworkPhysics {
  constructor() {
    // Default geometry parameters (in mm or generic length units)
    this.defaultHalfWidth = 60.0;  // W/2
    this.defaultHalfHeight = 60.0; // H

    // Default Cross-sectional area (mm^2) for stress computation
    this.defaultArea = 2.0;

    // Unit mode: 'macro' (N, mm, kPa) or 'micro' (nN, um, Pa)
    this.unitMode = 'macro';

    // Solver mode: 'nonlinear' (exact energy minimization) or 'linear' (small displacement)
    this.solverMode = 'nonlinear';

    // Deformation display multiplier
    this.dispScale = 1.0;

    this.initModel();
  }

  initModel() {
    const W2 = this.defaultHalfWidth;
    const H = this.defaultHalfHeight;
    const diagL0 = Math.hypot(W2, H);
    const horizL0 = 2 * W2;

    // 4 Nodes: 0: Top, 1: Left, 2: Right, 3: Bottom
    // Coordinates: (X, Y)
    this.nodes = [
      { id: 0, name: 'Node 1 (Top)', label: '1 (Top)', x0: 0, y0: H, fixedX: true, fixedY: true, fx: 0, fy: 0 },
      { id: 1, name: 'Node 2 (Left)', label: '2 (Left)', x0: -W2, y0: 0, fixedX: false, fixedY: false, fx: 0, fy: 0 },
      { id: 2, name: 'Node 3 (Right)', label: '3 (Right)', x0: W2, y0: 0, fixedX: false, fixedY: false, fx: 0, fy: 0 },
      { id: 3, name: 'Node 4 (Bottom)', label: '4 (Bottom)', x0: 0, y0: -H, fixedX: false, fixedY: false, fx: 0, fy: -25.0 } // Default downward load: -25 N
    ];

    // 5 Spring Members:
    // 0: 0-1 (Top-Left)
    // 1: 0-2 (Top-Right)
    // 2: 3-1 (Bottom-Left)
    // 3: 3-2 (Bottom-Right)
    // 4: 1-2 (Middle Horizontal)
    this.members = [
      { id: 0, name: 'Spring 1-2 (Top-Left)', shortName: '1-2', nodeA: 0, nodeB: 1, k: 50.0, L0: diagL0, area: this.defaultArea },
      { id: 1, name: 'Spring 1-3 (Top-Right)', shortName: '1-3', nodeA: 0, nodeB: 2, k: 50.0, L0: diagL0, area: this.defaultArea },
      { id: 2, name: 'Spring 4-1 (Bot-Left)', shortName: '4-1', nodeA: 3, nodeB: 1, k: 50.0, L0: diagL0, area: this.defaultArea },
      { id: 3, name: 'Spring 4-2 (Bot-Right)', shortName: '4-2', nodeA: 3, nodeB: 2, k: 50.0, L0: diagL0, area: this.defaultArea },
      { id: 4, name: 'Spring 2-3 (Middle)', shortName: '2-3', nodeA: 1, nodeB: 2, k: 40.0, L0: horizL0, area: this.defaultArea }
    ];

    // Current state arrays
    this.displacements = [ {u: 0, v: 0}, {u: 0, v: 0}, {u: 0, v: 0}, {u: 0, v: 0} ];
    this.reactions = [ {rx: 0, ry: 0}, {rx: 0, ry: 0}, {rx: 0, ry: 0}, {rx: 0, ry: 0} ];
    this.memberResults = [];

    this.solve();
  }

  setUnitMode(mode) {
    this.unitMode = mode;
  }

  getUnitLabels() {
    if (this.unitMode === 'micro') {
      return { force: 'nN', length: 'μm', disp: 'μm', stiffness: 'nN/μm', stress: 'Pa', energy: 'fJ' };
    }
    return { force: 'N', length: 'mm', disp: 'mm', stiffness: 'N/mm', stress: 'kPa', energy: 'mJ' };
  }

  setAppliedLoad(nodeId, fx, fy) {
    if (this.nodes[nodeId]) {
      this.nodes[nodeId].fx = fx;
      this.nodes[nodeId].fy = fy;
      this.solve();
    }
  }

  setStiffnesses(kOuter, kMiddle) {
    for (let i = 0; i < 4; i++) {
      this.members[i].k = kOuter;
    }
    this.members[4].k = kMiddle;
    this.solve();
  }

  setIndividualStiffness(memberId, k) {
    if (this.members[memberId]) {
      this.members[memberId].k = k;
      this.solve();
    }
  }

  setNodeFixation(nodeId, fixedX, fixedY) {
    if (this.nodes[nodeId]) {
      this.nodes[nodeId].fixedX = fixedX;
      this.nodes[nodeId].fixedY = fixedY;
      this.solve();
    }
  }

  setSolverMode(mode) {
    this.solverMode = mode;
    this.solve();
  }

  /**
   * Main Solver:
   * Chooses between Nonlinear Newton-Raphson or Linear Small-Displacement
   */
  solve() {
    if (this.solverMode === 'linear') {
      this.solveLinear();
    } else {
      this.solveNonlinear();
    }
    this.calculateMemberForcesAndReactions();
  }

  /**
   * Linear Small-Displacement Matrix Analysis
   * K0 * u = F_ext
   */
  solveLinear() {
    const nNodes = this.nodes.length;
    const nDof = nNodes * 2;
    const K = Array.from({ length: nDof }, () => new Float64Array(nDof));
    const F = new Float64Array(nDof);

    // Populate external loads
    for (let i = 0; i < nNodes; i++) {
      F[2 * i] = this.nodes[i].fx;
      F[2 * i + 1] = this.nodes[i].fy;
    }

    // Assemble global linear stiffness matrix at initial coordinates
    for (const m of this.members) {
      const na = m.nodeA;
      const nb = m.nodeB;
      const dx = this.nodes[nb].x0 - this.nodes[na].x0;
      const dy = this.nodes[nb].y0 - this.nodes[na].y0;
      const L = Math.hypot(dx, dy);
      const c = dx / L;
      const s = dy / L;
      const k = m.k;

      const ke = [
        [ c * c * k,  c * s * k, -c * c * k, -c * s * k ],
        [ c * s * k,  s * s * k, -c * s * k, -s * s * k ],
        [-c * c * k, -c * s * k,  c * c * k,  c * s * k ],
        [-c * s * k, -s * s * k,  c * s * k,  s * s * k ]
      ];

      const dofs = [ 2 * na, 2 * na + 1, 2 * nb, 2 * nb + 1 ];
      for (let r = 0; r < 4; r++) {
        for (let cCol = 0; cCol < 4; cCol++) {
          K[dofs[r]][dofs[cCol]] += ke[r][cCol];
        }
      }
    }

    // Apply boundary conditions via penalty or row/col zeroing
    const isFixed = new Uint8Array(nDof);
    for (let i = 0; i < nNodes; i++) {
      if (this.nodes[i].fixedX) isFixed[2 * i] = 1;
      if (this.nodes[i].fixedY) isFixed[2 * i + 1] = 1;
    }

    // Solve reduced linear system
    const freeDofs = [];
    for (let d = 0; d < nDof; d++) {
      if (!isFixed[d]) freeDofs.push(d);
    }

    const nFree = freeDofs.length;
    const K_red = Array.from({ length: nFree }, () => new Float64Array(nFree));
    const F_red = new Float64Array(nFree);

    for (let i = 0; i < nFree; i++) {
      F_red[i] = F[freeDofs[i]];
      for (let j = 0; j < nFree; j++) {
        K_red[i][j] = K[freeDofs[i]][freeDofs[j]];
      }
    }

    const u_red = this.solveLinearSystem(K_red, F_red);

    for (let i = 0; i < nNodes; i++) {
      this.displacements[i].u = 0;
      this.displacements[i].v = 0;
    }
    for (let i = 0; i < nFree; i++) {
      const dof = freeDofs[i];
      const node = Math.floor(dof / 2);
      if (dof % 2 === 0) {
        this.displacements[node].u = u_red[i];
      } else {
        this.displacements[node].v = u_red[i];
      }
    }
  }

  /**
   * Exact Non-Linear Equilibrium via Newton-Raphson
   * Minimizes potential energy Pi(x) = sum( 0.5 * k * (L - L0)^2 ) - F_ext dot u
   */
  solveNonlinear() {
    const nNodes = this.nodes.length;
    const nDof = nNodes * 2;

    const isFixed = new Uint8Array(nDof);
    for (let i = 0; i < nNodes; i++) {
      if (this.nodes[i].fixedX) isFixed[2 * i] = 1;
      if (this.nodes[i].fixedY) isFixed[2 * i + 1] = 1;
    }

    const freeDofs = [];
    for (let d = 0; d < nDof; d++) {
      if (!isFixed[d]) freeDofs.push(d);
    }
    const nFree = freeDofs.length;

    // Start from current displacements or 0
    let u = new Float64Array(nDof);
    for (let i = 0; i < nNodes; i++) {
      u[2 * i] = this.displacements[i].u || 0;
      u[2 * i + 1] = this.displacements[i].v || 0;
    }

    const maxIter = 40;
    const tol = 1e-9;

    for (let iter = 0; iter < maxIter; iter++) {
      // Compute internal forces and tangent stiffness
      const R = new Float64Array(nDof); // Residual = F_ext - F_int
      const KT = Array.from({ length: nDof }, () => new Float64Array(nDof));

      // External load contribution
      for (let i = 0; i < nNodes; i++) {
        R[2 * i] += this.nodes[i].fx;
        R[2 * i + 1] += this.nodes[i].fy;
      }

      // Member contributions
      for (const m of this.members) {
        const na = m.nodeA;
        const nb = m.nodeB;
        const xa = this.nodes[na].x0 + u[2 * na];
        const ya = this.nodes[na].y0 + u[2 * na + 1];
        const xb = this.nodes[nb].x0 + u[2 * nb];
        const yb = this.nodes[nb].y0 + u[2 * nb + 1];

        const dx = xb - xa;
        const dy = yb - ya;
        const L = Math.hypot(dx, dy) || 1e-9;
        const eX = dx / L;
        const eY = dy / L;

        const deltaL = L - m.L0;
        const T = m.k * deltaL; // Positive = tension

        // Internal force on node a from spring (pulls towards b if T > 0)
        // Residual = F_ext - F_int:
        // F_int pulling on a is +T * e. Resisting external load:
        // Net force on a = F_ext_a + T*e. We want Net Force = 0.
        // So R_a = F_ext_a + T*e, R_b = F_ext_b - T*e.
        R[2 * na] += T * eX;
        R[2 * na + 1] += T * eY;
        R[2 * nb] -= T * eX;
        R[2 * nb + 1] -= T * eY;

        // Tangent stiffness: d(F_int)/du
        // For node a: F_int = - T * e (force applied by node to spring is opposite)
        const kConst = m.k;
        const geom = T / L;

        const kxx = kConst * (eX * eX) + geom * (1 - eX * eX);
        const kyy = kConst * (eY * eY) + geom * (1 - eY * eY);
        const kxy = (kConst - geom) * (eX * eY);

        const dofs = [ 2 * na, 2 * na + 1, 2 * nb, 2 * nb + 1 ];
        const ke = [
          [  kxx,  kxy, -kxx, -kxy ],
          [  kxy,  kyy, -kxy, -kyy ],
          [ -kxx, -kxy,  kxx,  kxy ],
          [ -kxy, -kyy,  kxy,  kyy ]
        ];

        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            KT[dofs[r]][dofs[c]] += ke[r][c];
          }
        }
      }

      // Check residual on free DOFs
      let resNorm = 0;
      for (let i = 0; i < nFree; i++) {
        const d = freeDofs[i];
        resNorm = Math.max(resNorm, Math.abs(R[d]));
      }

      if (resNorm < tol) {
        break;
      }

      // Extract free submatrix
      const K_free = Array.from({ length: nFree }, () => new Float64Array(nFree));
      const R_free = new Float64Array(nFree);
      for (let i = 0; i < nFree; i++) {
        // Residual in Newton equation: K * du = R (since R is the out-of-balance force)
        R_free[i] = -R[freeDofs[i]];
        for (let j = 0; j < nFree; j++) {
          K_free[i][j] = KT[freeDofs[i]][freeDofs[j]];
        }
      }

      // Regularize
      for (let i = 0; i < nFree; i++) {
        K_free[i][i] += 1e-12;
      }

      const delta_u = this.solveLinearSystem(K_free, R_free);

      // Apply step
      for (let i = 0; i < nFree; i++) {
        u[freeDofs[i]] -= delta_u[i];
      }
    }

    // Save displacements
    for (let i = 0; i < nNodes; i++) {
      this.displacements[i].u = isFixed[2 * i] ? 0 : u[2 * i];
      this.displacements[i].v = isFixed[2 * i + 1] ? 0 : u[2 * i + 1];
    }
  }

  /**
   * Gaussian elimination with partial pivoting for small square matrix
   */
  solveLinearSystem(A, b) {
    const n = b.length;
    if (n === 0) return new Float64Array(0);

    const M = Array.from({ length: n }, (_, i) => {
      const row = new Float64Array(n + 1);
      row.set(A[i]);
      row[n] = b[i];
      return row;
    });

    for (let p = 0; p < n; p++) {
      let maxRow = p;
      let maxVal = Math.abs(M[p][p]);
      for (let r = p + 1; r < n; r++) {
        if (Math.abs(M[r][p]) > maxVal) {
          maxVal = Math.abs(M[r][p]);
          maxRow = r;
        }
      }
      if (maxRow !== p) {
        const temp = M[p];
        M[p] = M[maxRow];
        M[maxRow] = temp;
      }

      const pivot = M[p][p];
      if (Math.abs(pivot) < 1e-13) {
        continue;
      }

      for (let r = p + 1; r < n; r++) {
        const factor = M[r][p] / pivot;
        for (let c = p; c <= n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }

    const x = new Float64Array(n);
    for (let r = n - 1; r >= 0; r--) {
      let sum = M[r][n];
      for (let c = r + 1; c < n; c++) {
        sum -= M[r][c] * x[c];
      }
      if (Math.abs(M[r][r]) > 1e-13) {
        x[r] = sum / M[r][r];
      } else {
        x[r] = 0;
      }
    }
    return x;
  }

  /**
   * Post-processing: member forces, reactions, stresses, strains, total energy
   */
  calculateMemberForcesAndReactions() {
    this.memberResults = [];
    let totalStrainEnergy = 0;
    let maxStress = 0;
    let criticalMember = null;

    // Reset reactions
    for (let i = 0; i < this.nodes.length; i++) {
      this.reactions[i] = { rx: 0, ry: 0 };
    }

    for (const m of this.members) {
      const na = m.nodeA;
      const nb = m.nodeB;

      const xa = this.nodes[na].x0 + this.displacements[na].u;
      const ya = this.nodes[na].y0 + this.displacements[na].v;
      const xb = this.nodes[nb].x0 + this.displacements[nb].u;
      const yb = this.nodes[nb].y0 + this.displacements[nb].v;

      const dx = xb - xa;
      const dy = yb - ya;
      const currentLength = Math.hypot(dx, dy);
      const deltaL = currentLength - m.L0;
      const force = m.k * deltaL; // Positive = tension, negative = compression
      const strain = deltaL / m.L0;
      const stress = force / m.area;
      const energy = 0.5 * m.k * deltaL * deltaL;

      totalStrainEnergy += energy;

      if (Math.abs(stress) > maxStress) {
        maxStress = Math.abs(stress);
        criticalMember = m.name;
      }

      // Unit vector from A to B
      const ux = dx / currentLength;
      const uy = dy / currentLength;

      // Force on node A: F = force * u (pulls toward B if force > 0)
      // Force on node B: F = -force * u (pulls toward A if force > 0)
      const forceOnA = { fx: force * ux, fy: force * uy };
      const forceOnB = { fx: -force * ux, fy: -force * uy };

      const state = Math.abs(force) < 1e-4 ? 'Neutral' : (force > 0 ? 'Tension' : 'Compression');

      this.memberResults.push({
        id: m.id,
        name: m.name,
        shortName: m.shortName,
        nodeA: na,
        nodeB: nb,
        k: m.k,
        L0: m.L0,
        L: currentLength,
        deltaL: deltaL,
        force: force,
        strain: strain,
        stress: stress,
        energy: energy,
        state: state,
        ux: ux,
        uy: uy,
        forceOnA: forceOnA,
        forceOnB: forceOnB
      });
    }

    // Reactions at each node to satisfy sum(F) = 0:
    // Reaction vector R provides static balance on fixed DOFs
    for (let i = 0; i < this.nodes.length; i++) {
      let sumSpringsX = 0;
      let sumSpringsY = 0;

      for (const res of this.memberResults) {
        if (res.nodeA === i) {
          sumSpringsX += res.forceOnA.fx;
          sumSpringsY += res.forceOnA.fy;
        } else if (res.nodeB === i) {
          sumSpringsX += res.forceOnB.fx;
          sumSpringsY += res.forceOnB.fy;
        }
      }

      const extX = this.nodes[i].fx;
      const extY = this.nodes[i].fy;

      // Reaction is the force needed from external constraint to balance sum
      this.reactions[i] = {
        rx: this.nodes[i].fixedX ? -(extX + sumSpringsX) : 0,
        ry: this.nodes[i].fixedY ? -(extY + sumSpringsY) : 0,
        springNetX: sumSpringsX,
        springNetY: sumSpringsY,
        totalNetX: extX + sumSpringsX + (this.nodes[i].fixedX ? -(extX + sumSpringsX) : 0),
        totalNetY: extY + sumSpringsY + (this.nodes[i].fixedY ? -(extY + sumSpringsY) : 0)
      };
    }

    // Summary statistics
    const botDisp = Math.hypot(this.displacements[3].u, this.displacements[3].v);
    this.status = {
      maxStress: maxStress,
      criticalMember: criticalMember || 'None',
      botDisplacement: botDisp,
      strainEnergy: totalStrainEnergy,
      isEquilibrium: true
    };
  }

  /**
   * Returns current deformed coordinate of a node (taking display scale into account)
   */
  getNodeCurrentPos(nodeId, scale = 1.0) {
    const node = this.nodes[nodeId];
    const disp = this.displacements[nodeId];
    return {
      x: node.x0 + disp.u * scale,
      y: node.y0 + disp.v * scale
    };
  }

  /**
   * Returns analytical prediction according to Jacobs Section 3.2:
   * For symmetric downward load F applied to bottom pin:
   * T_bot = F / (2 * cos(theta))
   * T_top = F / (2 * cos(theta))
   * F_horiz = - F * tan(theta) (Compression)
   * Ceiling reaction R_y = F
   */
  getAnalyticalComparison() {
    const F = Math.abs(this.nodes[3].fy);
    const W2 = this.defaultHalfWidth;
    const H = this.defaultHalfHeight;
    const theta0 = Math.atan2(W2, H); // Angle with vertical axis
    const cosTheta = Math.cos(theta0);
    const tanTheta = Math.tan(theta0);

    const T_diag_analytical = F > 0 ? F / (2 * cosTheta) : 0;
    const C_horiz_analytical = F > 0 ? -F * tanTheta : 0;
    const Ry_analytical = F;

    return {
      theta0Deg: (theta0 * 180 / Math.PI).toFixed(1),
      T_diag: T_diag_analytical,
      C_horiz: C_horiz_analytical,
      Ry: Ry_analytical
    };
  }
}
