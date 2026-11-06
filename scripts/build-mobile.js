'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'www');

const files = [
  'index.html',
  'style.css',
  'script.js',
  'i18n.js',
  'manifest.webmanifest',
  'threejs/scene.js',
  'threejs/three.module.js',
  'threejs/three.core.js'
];

const dirs = [
  'icons'
];

function copyFile(rel) {
  const from = path.join(root, rel);
  const to = path.join(out, rel);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function copyDir(rel) {
  const from = path.join(root, rel);
  fs.mkdirSync(path.join(out, rel), { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const child = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) copyDir(child);
    else copyFile(child);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const rel of files) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.error('Falta el archivo:', rel);
    process.exit(1);
  }
  copyFile(rel);
}

for (const rel of dirs) {
  if (fs.existsSync(path.join(root, rel))) copyDir(rel);
}

console.log('www generado en', out);
