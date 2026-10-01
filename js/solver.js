/**
 * ChronoMaster Puzzle Logic Model & Solver
 * Pure logic (no DOM, no physics) so the same rules run in the game, the level generator
 * and the Node level-check tool.
 *
 * Rules (mirrors game.js):
 *  - A screw pins its own plate plus every lower plate under its point.
 *  - A plate is "static" while ≥2 screws pin it; with 1 it swings, with 0 it falls.
 *  - A screw is blocked while a STATIC plate on a higher layer than its own covers it.
 *  - Tapped screw goes to the active box if colours match and there is room, else to the tray.
 *  - When a box fills, the next box opens and matching tray screws jump into it.
 */
(function (root) {
  const BOX_CAPACITY = 3;
  const COVER_MARGIN = 10; // virtual px: a plate edge this close to a screw centre hides its head

  // ---------- Geometry ----------
  function toLocal(px, py, cx, cy, angle) {
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const dx = px - cx;
    const dy = py - cy;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  /** Is (px,py) inside plate shape grown by `margin`? Uses pose override when given. */
  function pointInPlate(px, py, plate, margin = 0, pose = null) {
    const cx = pose ? pose.x : plate.x;
    const cy = pose ? pose.y : plate.y;
    const angle = pose ? pose.angle : (plate.angle || 0);
    const l = toLocal(px, py, cx, cy, angle);
    if (plate.type === 'circle' || plate.type === 'gear') {
      const r = plate.radius + margin;
      return l.x * l.x + l.y * l.y <= r * r;
    }
    return Math.abs(l.x) <= plate.width / 2 + margin && Math.abs(l.y) <= plate.height / 2 + margin;
  }

  /** Fills in screw.plates (pins) and screw.layer from screw.on; returns covering plate ids per screw. */
  function resolveLevel(level) {
    const byId = new Map(level.plates.map(p => [p.id, p]));
    level.screws.forEach(s => {
      if (!s.plates) {
        const own = byId.get(s.on);
        s.plates = [s.on].concat(level.plates
          .filter(p => p.layer < own.layer && pointInPlate(s.x, s.y, p, -4))
          .sort((a, b) => b.layer - a.layer)
          .map(p => p.id));
      }
      s.layer = Math.max(...s.plates.map(id => byId.get(id).layer));
      s.coveredBy = level.plates
        .filter(p => p.layer > s.layer && pointInPlate(s.x, s.y, p, COVER_MARGIN))
        .map(p => p.id);
    });
    return level;
  }

  // ---------- Compact model for search ----------
  function popcount(x) {
    let c = 0;
    while (x) { x &= x - 1; c++; }
    return c;
  }

  function buildModel(level) {
    resolveLevel(level);
    const colorIndex = new Map();
    const colorOf = c => {
      if (!colorIndex.has(c)) colorIndex.set(c, colorIndex.size);
      return colorIndex.get(c);
    };
    const n = level.screws.length;
    if (n > 30) throw new Error('Solver supports at most 30 screws');
    const plateIdx = new Map(level.plates.map((p, i) => [p.id, i]));
    const pinMask = new Array(level.plates.length).fill(0);
    level.screws.forEach((s, i) => s.plates.forEach(pid => { pinMask[plateIdx.get(pid)] |= (1 << i); }));
    const cover = level.screws.map(s => s.coveredBy.map(pid => plateIdx.get(pid)));
    const color = level.screws.map(s => colorOf(s.color));
    const boxes = level.boxes.map(b => colorOf(typeof b === 'string' ? b : b.color));
    return { n, pinMask, cover, color, boxes, colorCount: colorIndex.size, full: n === 30 ? 0x3fffffff : (1 << n) - 1 };
  }

  function isBlocked(model, mask, s) {
    const cov = model.cover[s];
    for (let k = 0; k < cov.length; k++) {
      if (popcount(mask & model.pinMask[cov[k]]) >= 2) return true;
    }
    return false;
  }

  /**
   * Apply a tap to a logical state. state = {mask, buffer:int[] (color counts), bufTotal, placed}
   * Returns new state or null if the tap is illegal.
   */
  function applyMove(model, st, s, bufferSize) {
    const boxIdx = Math.floor(st.placed / BOX_CAPACITY);
    const active = model.boxes[boxIdx];
    const col = model.color[s];
    const buffer = st.buffer.slice();
    let bufTotal = st.bufTotal;
    let placed = st.placed;
    if (col === active) {
      placed++;
    } else {
      if (bufTotal >= bufferSize) return null;
      buffer[col]++;
      bufTotal++;
    }
    // Tray screws matching the open box jump in (cascades across box changes)
    for (;;) {
      const b = Math.floor(placed / BOX_CAPACITY);
      if (b >= model.boxes.length || buffer[model.boxes[b]] === 0) break;
      buffer[model.boxes[b]]--;
      bufTotal--;
      placed++;
    }
    return { mask: st.mask & ~(1 << s), buffer, bufTotal, placed };
  }

  function initialState(model) {
    return { mask: model.full, buffer: new Array(model.colorCount).fill(0), bufTotal: 0, placed: 0 };
  }

  /** DFS with memo. Returns {solvable:true|false|null(budget hit), path:[screw indices]} */
  function solve(model, bufferSize = 5, budget = 200000) {
    const seen = new Set();
    let nodes = 0;
    const path = [];

    function dfs(st) {
      if (st.mask === 0) return st.bufTotal === 0;
      if (++nodes > budget) throw new Error('budget');
      const key = st.mask + '|' + st.buffer.join(',');
      if (seen.has(key)) return false;
      seen.add(key);

      const active = model.boxes[Math.floor(st.placed / BOX_CAPACITY)];
      const matching = [];
      const others = [];
      for (let s = 0; s < model.n; s++) {
        if (!(st.mask & (1 << s)) || isBlocked(model, st.mask, s)) continue;
        (model.color[s] === active ? matching : others).push(s);
      }
      // Dominance: dropping a matching screw into the open box is never worse than parking one.
      const moves = matching.length ? matching : others;
      for (const s of moves) {
        const next = applyMove(model, st, s, bufferSize);
        if (!next) continue;
        path.push(s);
        if (dfs(next)) return true;
        path.pop();
      }
      return false;
    }

    try {
      const ok = dfs(initialState(model));
      return { solvable: ok, path: ok ? path.slice() : null, nodes };
    } catch (e) {
      if (e.message === 'budget') return { solvable: null, path: null, nodes };
      throw e;
    }
  }

  /** Smallest tray size that still allows a win (0 = tray never needed). */
  function minPeak(model, maxBuffer = 5, budget = 150000) {
    for (let b = 0; b <= maxBuffer; b++) {
      const r = solve(model, b, budget);
      if (r.solvable === null) return null;
      if (r.solvable) return b;
    }
    return Infinity;
  }

  /** Share of runs a careless player (random legal taps, matching first) loses. */
  function naiveFailRate(model, runs = 60, bufferSize = 5, rand = Math.random) {
    let fails = 0;
    for (let r = 0; r < runs; r++) {
      let st = initialState(model);
      while (st.mask !== 0) {
        const active = model.boxes[Math.floor(st.placed / BOX_CAPACITY)];
        const matching = [];
        const others = [];
        for (let s = 0; s < model.n; s++) {
          if (!(st.mask & (1 << s)) || isBlocked(model, st.mask, s)) continue;
          (model.color[s] === active ? matching : others).push(s);
        }
        const pool = matching.length ? matching : others;
        if (!pool.length) { st = null; break; }
        const next = applyMove(model, st, pool[Math.floor(rand() * pool.length)], bufferSize);
        if (!next) { st = null; break; }
        st = next;
      }
      if (!st || st.bufTotal !== 0) fails++;
    }
    return fails / runs;
  }

  const Solver = {
    BOX_CAPACITY, COVER_MARGIN,
    pointInPlate, resolveLevel, buildModel, isBlocked, applyMove, initialState,
    solve, minPeak, naiveFailRate, popcount
  };

  if (typeof module === 'object' && module.exports) module.exports = Solver;
  else root.Solver = Solver;
})(typeof window !== 'undefined' ? window : this);
