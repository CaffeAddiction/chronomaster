/**
 * Copies only the files the app needs into www/ (Capacitor's webDir).
 * Dev tools, git history and promo art stay out of the Android package.
 * Usage: node tools/build-web.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const include = ['index.html', 'style.css', 'matter.min.js', 'js', 'fonts', 'privacy.html'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

for (const item of include) {
  const src = path.join(root, item);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(out, item), { recursive: true });
}

const count = dir => fs.readdirSync(dir, { withFileTypes: true })
  .reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
console.log(`www/ hazır: ${count(out)} dosya`);
