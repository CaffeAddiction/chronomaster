/**
 * Level QA: proves every level 1..N is winnable and prints its difficulty.
 * Usage: node tools/check-levels.js [N=60]
 */
const Solver = require('../js/solver.js');
const Levels = require('../js/levels.js');

const N = parseInt(process.argv[2] || '60', 10);
let failures = 0;
const rows = [];

for (let n = 1; n <= N; n++) {
  const t0 = Date.now();
  let level;
  try {
    level = Levels.getLevel(n);
  } catch (e) {
    console.log(`#${n}: GENERATION FAILED - ${e.message}`);
    failures++;
    continue;
  }
  const ms = Date.now() - t0;
  const model = Solver.buildModel(level);
  const res = Solver.solve(model, level.bufferSize, 500000);
  const hidden = level.screws.filter(s => s.coveredBy.length).length;
  const colors = new Set(level.screws.map(s => s.color)).size;
  const ok = res.solvable === true;
  if (!ok) failures++;
  rows.push({
    n,
    ok: ok ? 'OK' : 'UNSOLVABLE',
    plates: level.plates.length,
    screws: level.screws.length,
    hidden,
    colors,
    minPeak: level.minPeak,
    fail: Math.round(level.difficulty * 100) + '%',
    star3: level.starTray,
    master: level.masterpiece ? '★' : '',
    ms
  });
}

console.table(rows);
const times = rows.map(r => r.ms);
console.log(`levels: ${rows.length}, unsolvable/failed: ${failures}, gen ms max ${Math.max(...times)}, avg ${Math.round(times.reduce((a, b) => a + b, 0) / times.length)}`);
process.exit(failures ? 1 : 0);
