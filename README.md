# Polymer Network Mechanics Simulator
**Interactive Pin-Jointed Deformable Body & Free Body Diagram Explorer**  
*Based on Figure 3.3 ("Schematic of a polymer network") in Christopher R. Jacobs, Hayden Huang, and Ronald Y. Kwon, Introduction to Cell Mechanics and Mechanobiology.*

🌐 **Live Web App**: [https://ltuebl.github.io/FBDnetworkanalysis/](https://ltuebl.github.io/FBDnetworkanalysis/)

---

## Overview

This educational simulation is designed for mechanobiology, biomechanics, and deformable bodies courses. It allows students to apply tensile, compressive, and shear loads to a diamond polymer network with a transverse cross-spring, and observe:
1. **Kinematics & Deformation**: How the network geometry alters under external forces.
2. **Internal Member Forces**: Instant color-coding of **Tension** (Blue) vs. **Compression** (Coral/Red).
3. **The Compression Paradox**: Why the horizontal cross-spring experiences **compression** when the overall network is pulled in vertical tension.
4. **Free Body Diagrams (FBDs)**: Isolated pins with dynamic force vectors, orthogonal components ($F_x, F_y$), angles ($\theta$), and exact equilibrium summations ($\sum F_x = 0$, $\sum F_y = 0$).
5. **Analytical Practice**: Live calculation of rest length ($L_0$), deformed length ($L$), elongation ($\Delta L$), force ($F$), stress ($\sigma$), and strain ($\epsilon$) with CSV export.

---

## Layout & Functional Areas

The interface is structured into three dedicated functional panels:

### 1. Main Simulation Panel (Left)
- **Procedural Spring Rendering**: Authentic helical coil spring representations with stroke glow and force badges.
- **Support & Fixture Graphics**: Pinned ceiling fixture with mechanical cross-hatch ground symbols at Node 1.
- **Undeformed Ghost Reference**: Dashed outline showing the original configuration to easily see relative displacements.
- **Interactive Manipulation**: Students can click and drag pins directly on the canvas to feel the mechanical response.
- **Deformation Scale Slider**: Magnifies subtle displacements for small-strain visualization.

### 2. Controls & Status Panel (Center)
- **Applied Load Controls**: Sliders for vertical load $F_y$ (tensile or compressive) and horizontal load $F_x$ (shear).
- **Stiffness Tuning**: Independent adjustment of outer diagonal spring stiffness ($k_{outer}$) and middle cross-linker stiffness ($k_{mid}$).
- **Boundary Condition Toggles**: Full control over $X$ and $Y$ fixation for all 4 pins.
- **Live Status Dashboard**:
  - Maximum normal stress ($\sigma_{max}$) with critical member identification.
  - Loaded pin total displacement ($|\Delta\mathbf{u}|$).
  - Total strain energy ($U = \sum \frac{1}{2} k \Delta L^2$).
  - Stable equilibrium validation indicator.
- **Solver Framework**: Toggle between **Exact Nonlinear (Large Strain)** via Newton-Raphson potential energy minimization and **Linear (Small Strain)** matrix structural analysis.
- **Units Toggle**: Macro engineering units ($\text{N, mm, kPa}$) or Cellular Mechanobiology units ($\text{nN, }\mu\text{m, Pa}$).
- **Curated Educational Presets**:
  1. *Textbook Baseline*: Standard Jacobs Fig 3.3 tensile pull.
  2. *Soft Cross-Linker*: High compliance in the middle polymer.
  3. *Rigid Cross-Linker*: High transverse stiffness resisting inward necking.
  4. *Asymmetric Shear*: Lateral distortion and asymmetric member forces.
  5. *Network Compression*: Upward push flipping outer springs to compression and middle to tension!
  6. *Biaxial Pull*: Simultaneous vertical and lateral outward stretching.

### 3. FBD & Data Explorer (Right)
- **Node Selection Matrix**: Single-click isolation of Pin 1 (Top/Support), Pin 2 (Left), Pin 3 (Right), or Pin 4 (Bottom/Loaded).
- **Dynamic Isolated Free Body Diagram**:
  - Shows the isolated pin with an imaginary dashed cut boundary.
  - Force vectors pointing in true physical directions (tension pulls away, compression pushes toward pin).
  - Toggles for orthogonal Cartesian components ($F_x, F_y$) and angle arcs ($\theta$).
- **Equilibrium Equations**:
  $$\sum F_x = 0.00\text{ N}, \quad \sum F_y = 0.00\text{ N}$$
- **Statics Walkthrough**: Real-time qualitative and quantitative explanation of why forces balance.
- **Analytical Data Table**: Full summary table of all 5 members with 1-click **Export CSV** for student lab reports and homework assignments.

---

## Running the Application

### Option A: Standalone File (Recommended - No Server Required)
Simply double-click `index_standalone.html` in Windows Explorer or open it in any web browser (Chrome, Edge, Firefox, Safari). It is completely self-contained with embedded styles and scripts.

### Option B: Local Web Server (For ES Modules)
If running a local development server:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000/index.html`.

---

## File Structure

```
FBDnetworkanalysis/
├── index_standalone.html   # Fully self-contained single-file version
├── index.html              # Modular HTML5 application
├── style.css               # Modern UI design system & responsive layout
├── physics.js              # Newton-Raphson & linear elasticity solver
├── renderer.js             # Canvas renderer with helical springs & ghost overlay
├── fbd.js                  # Isolated Free Body Diagram & statics evaluator
├── app.js                  # Main UI controller, event manager & CSV exporter
├── bundle.mjs              # Build script to generate standalone HTML
└── README.md               # Documentation & student guide
```
