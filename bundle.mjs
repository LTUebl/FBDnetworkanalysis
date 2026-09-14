import fs from 'fs';
import path from 'path';

const dir = 'c:/Users/emeyer/Documents/Work/Teaching/Mechanobiology/F2026/FBDnetworkanalysis';
const artifactDir = 'C:/Users/emeyer/.gemini/antigravity/brain/7fbcda87-5df2-4060-8178-a95d4f8d371d';

const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf-8');
const indexHtml = fs.readFileSync(path.join(dir, 'index.html'), 'utf-8');
let physicsJs = fs.readFileSync(path.join(dir, 'physics.js'), 'utf-8');
let rendererJs = fs.readFileSync(path.join(dir, 'renderer.js'), 'utf-8');
let fbdJs = fs.readFileSync(path.join(dir, 'fbd.js'), 'utf-8');
let appJs = fs.readFileSync(path.join(dir, 'app.js'), 'utf-8');

// Strip export/import statements for single script bundle
physicsJs = physicsJs.replace(/export class PolymerNetworkPhysics/g, 'class PolymerNetworkPhysics');
rendererJs = rendererJs.replace(/export class NetworkRenderer/g, 'class NetworkRenderer');
fbdJs = fbdJs.replace(/export class FBDExplorer/g, 'class FBDExplorer');

appJs = appJs.replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?/g, '');

const combinedJs = `
// Bundled Polymer Network Simulation Engine
${physicsJs}

${rendererJs}

${fbdJs}

${appJs}
`;

// Replace <link rel="stylesheet" href="./style.css"> with <style>...</style>
let standaloneHtml = indexHtml.replace(
  '<link rel="stylesheet" href="./style.css">',
  `<style>\n${css}\n</style>`
);

// Replace <script type="module" src="./app.js"></script> with <script>...</script>
standaloneHtml = standaloneHtml.replace(
  '<script type="module" src="./app.js"></script>',
  `<script>\n${combinedJs}\n</script>`
);

// Write index_standalone.html
fs.writeFileSync(path.join(dir, 'index_standalone.html'), standaloneHtml, 'utf-8');
console.log('Successfully wrote index_standalone.html in project folder.');

// Also write to artifactDir for antigravity artifact viewing
fs.writeFileSync(path.join(artifactDir, 'polymer_network_simulator.html'), standaloneHtml, 'utf-8');
console.log('Successfully wrote polymer_network_simulator.html in artifact directory.');
