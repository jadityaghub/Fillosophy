// Fillosophy Chrome Extension — Packaging Script
// Usage: node package.js <production-backend-url>

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const productionUrl = process.argv[2];
if (!productionUrl) {
  console.error('\nUsage: node package.js <production-backend-url>');
  console.error('Example: node package.js https://fillosophy-backend.onrender.com\n');
  process.exit(1);
}

// Clean trailing slash
const backendUrl = productionUrl.replace(/\/$/, '');

console.log(`[Fillosophy Packager] Packaging extension for production...`);
console.log(`[Fillosophy Packager] Target backend URL: ${backendUrl}`);

const sourceDir = __dirname;
const distDir = path.join(sourceDir, 'dist');
const zipFile = path.join(sourceDir, 'fillosophy-extension.zip');

// Clean old files
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

// Create fresh build directory
fs.mkdirSync(distDir);

const targets = [
  'manifest.json',
  'background',
  'content',
  'popup',
  'utils',
  'icons'
];

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(child => {
      if (child === '.DS_Store' || child === 'package.js' || child === 'dist') return;
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('[Fillosophy Packager] Copying files to build folder...');
targets.forEach(target => {
  const srcPath = path.join(sourceDir, target);
  const destPath = path.join(distDir, target);
  if (fs.existsSync(srcPath)) {
    copyRecursive(srcPath, destPath);
  }
});

function replaceInFile(filePath, target, replacement) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.split(target).join(replacement);
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('[Fillosophy Packager] Swapping localhost URLs with cloud server URL...');
// Replace localhost endpoint references in popup.js
replaceInFile(path.join(distDir, 'popup', 'popup.js'), 'http://localhost:8000', backendUrl);

// Replace host permission match pattern in manifest.json
replaceInFile(path.join(distDir, 'manifest.json'), 'http://localhost:8000/*', `${backendUrl}/*`);

console.log('[Fillosophy Packager] Zipping files...');
try {
  // Use native macOS zip command
  execSync(`zip -r "../fillosophy-extension.zip" .`, { cwd: distDir, stdio: 'ignore' });
  console.log(`\n[Fillosophy Packager] Success! ZIP archive generated at:\n${zipFile}\n`);
} catch (err) {
  console.error('[Fillosophy Packager] Error creating ZIP archive:', err.message);
} finally {
  console.log('[Fillosophy Packager] Cleaning up temporary build directory...');
  fs.rmSync(distDir, { recursive: true, force: true });
}
