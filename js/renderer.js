/**
 * ChronoMaster Canvas Renderer
 * Plates and screws are rasterised once into cached sprites (with their soft shadows) and then
 * only blitted with a transform each frame, so low-end phones never re-run shadowBlur at 60 fps.
 */

// roundRect arrived in Chrome 99; older Android WebViews still need this
(function polyfillRoundRect() {
  const impl = function (x, y, w, h, r) {
    const rr = Math.max(0, Math.min(typeof r === 'number' ? r : 0, w / 2, h / 2));
    this.moveTo(x + rr, y);
    this.arcTo(x + w, y, x + w, y + h, rr);
    this.arcTo(x + w, y + h, x, y + h, rr);
    this.arcTo(x, y + h, x, y, rr);
    this.arcTo(x, y, x + w, y, rr);
    this.closePath();
  };
  if (window.CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = impl;
  }
  if (window.Path2D && !Path2D.prototype.roundRect) Path2D.prototype.roundRect = impl;
})();

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = 1;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.particles = [];
    this.texts = [];
    this.rings = [];
    this.shakeT = 0;
    this.shakeMag = 0;
    this.sx = 0;
    this.sy = 0;
    this.plateCache = new WeakMap();
    this.screwCache = new Map();
    this.boardCache = null;
    this.resize();
  }

  // ---------- Layout ----------
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.displayWidth = Math.max(1, rect.width);
    this.displayHeight = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.displayWidth * this.dpr);
    this.canvas.height = Math.round(this.displayHeight * this.dpr);
    const { width, height } = window.Levels.BOARD;
    this.scale = Math.min(this.displayWidth / width, this.displayHeight / height) * 0.97;
    this.offsetX = (this.displayWidth - width * this.scale) / 2;
    this.offsetY = (this.displayHeight - height * this.scale) / 2;
    this.plateCache = new WeakMap();
    this.screwCache.clear();
    this.boardCache = null;
  }

  virtualToScreen(x, y) {
    return { x: this.offsetX + x * this.scale, y: this.offsetY + y * this.scale };
  }

  screenToVirtual(x, y) {
    return { x: (x - this.offsetX) / this.scale, y: (y - this.offsetY) / this.scale };
  }

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---------- Shapes ----------
  /** Traces the plate outline (local units) into a context, or into a Path2D when given. */
  traceShape(target, plate, inset = 0) {
    const ctx = target;
    if (!(target instanceof Path2D)) ctx.beginPath();
    if (plate.type === 'circle') {
      ctx.arc(0, 0, plate.radius - inset, 0, Math.PI * 2);
    } else if (plate.type === 'gear') {
      const r = plate.radius - inset;
      const teeth = plate.teeth || 10;
      const depth = Math.min(16, plate.radius * 0.14);
      for (let i = 0; i < teeth; i++) {
        const a = (i / teeth) * Math.PI * 2;
        const step = (Math.PI * 2) / teeth;
        const pts = [
          [a, r - depth], [a + step * 0.18, r], [a + step * 0.5, r], [a + step * 0.68, r - depth]
        ];
        pts.forEach(([ang, rad], k) => {
          const x = Math.cos(ang) * rad;
          const y = Math.sin(ang) * rad;
          if (i === 0 && k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.arc(0, 0, r - depth, a + step * 0.68, a + step, false);
      }
      ctx.closePath();
    } else {
      const w = plate.width - inset * 2;
      const h = plate.height - inset * 2;
      const r = Math.max(2, Math.min((plate.radius || 12) - inset, w / 2, h / 2));
      ctx.roundRect(-w / 2, -h / 2, w, h, r);
    }
  }

  plateHalf(plate) {
    if (plate.type === 'circle' || plate.type === 'gear') return { hw: plate.radius, hh: plate.radius };
    return { hw: plate.width / 2, hh: plate.height / 2 };
  }

  // ---------- Sprites ----------
  getPlateSprites(plate) {
    let s = this.plateCache.get(plate);
    if (s) return s;
    const { hw, hh } = this.plateHalf(plate);
    const k = this.scale * this.dpr;
    const pad = 6;

    // Plate body with brushed finish and mounting holes
    const body = this.makeCanvas((hw * 2 + pad * 2) * k, (hh * 2 + pad * 2) * k);
    const c = body.getContext('2d');
    c.scale(k, k);
    c.translate(hw + pad, hh + pad);
    const mat = window.Levels.MATERIALS[plate.material] || window.Levels.MATERIALS.brass;
    const grad = c.createLinearGradient(-hw, -hh, hw, hh);
    mat.stops.forEach((col, i) => grad.addColorStop(i / (mat.stops.length - 1), col));
    this.traceShape(c, plate);
    c.fillStyle = grad;
    c.fill();

    c.save();
    this.traceShape(c, plate);
    c.clip();
    const rnd = window.Levels.mulberry32(plate.x * 31 + plate.y * 17 + plate.layer);
    if (plate.material === 'walnut') {
      // Wood grain
      for (let i = 0; i < 26; i++) {
        const y = -hh + rnd() * hh * 2;
        c.strokeStyle = `rgba(30, 14, 4, ${0.12 + rnd() * 0.18})`;
        c.lineWidth = 0.8 + rnd() * 1.8;
        c.beginPath();
        c.moveTo(-hw, y);
        c.bezierCurveTo(-hw / 3, y + (rnd() - 0.5) * 18, hw / 3, y + (rnd() - 0.5) * 18, hw, y + (rnd() - 0.5) * 10);
        c.stroke();
      }
    } else {
      // Brushed metal streaks
      c.rotate(-0.5);
      for (let i = 0; i < 70; i++) {
        const y = -hw - hh + rnd() * (hw + hh) * 2;
        c.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
        c.lineWidth = 0.5 + rnd();
        c.beginPath();
        c.moveTo(-hw * 2, y);
        c.lineTo(hw * 2, y);
        c.stroke();
      }
      c.rotate(0.5);
    }
    // Top sheen
    const sheen = c.createLinearGradient(0, -hh, 0, hh);
    sheen.addColorStop(0, 'rgba(255,255,255,0.22)');
    sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.18)');
    c.fillStyle = sheen;
    c.fillRect(-hw, -hh, hw * 2, hh * 2);
    c.restore();

    // Bevel + engraved inner border
    this.traceShape(c, plate);
    c.lineWidth = 2.4;
    c.strokeStyle = mat.stroke;
    c.globalAlpha = 0.9;
    c.stroke();
    c.globalAlpha = 1;
    if (plate.type !== 'gear') {
      this.traceShape(c, plate, 6);
      c.lineWidth = 1;
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.stroke();
    } else {
      c.beginPath();
      c.arc(0, 0, plate.radius * 0.32, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(0,0,0,0.3)';
      c.lineWidth = 2;
      c.stroke();
    }

    // Mounting holes where screws pass through this plate
    (plate.holes || []).forEach(h => this.drawSocket(c, h.x, h.y, 14));

    // Soft shadow silhouette (blurred once, here)
    const blur = 7;
    const spad = pad + blur * 2;
    const shadow = this.makeCanvas((hw * 2 + spad * 2) * k, (hh * 2 + spad * 2) * k);
    const sc = shadow.getContext('2d');
    sc.scale(k, k);
    const far = 2000;
    sc.translate(hw + spad - far, hh + spad);
    sc.shadowColor = 'rgba(0,0,0,0.55)';
    sc.shadowBlur = blur * k;
    sc.shadowOffsetX = far * k;
    this.traceShape(sc, plate);
    sc.fillStyle = '#000';
    sc.fill();

    // Outline path for the "this plate is in the way" flash
    const outline = new Path2D();
    this.traceShape(outline, plate);

    s = {
      body, bw: hw * 2 + pad * 2, bh: hh * 2 + pad * 2,
      shadow, sw: hw * 2 + spad * 2, sh: hh * 2 + spad * 2,
      outline
    };
    this.plateCache.set(plate, s);
    return s;
  }

  drawSocket(c, x, y, r) {
    const g = c.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.15, x, y, r);
    g.addColorStop(0, '#050302');
    g.addColorStop(0.75, '#140c07');
    g.addColorStop(1, '#2c1c11');
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = 'rgba(255,240,200,0.25)';
    c.beginPath();
    c.arc(x, y, r, 0.1 * Math.PI, 0.9 * Math.PI);
    c.stroke();
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.beginPath();
    c.arc(x, y, r, 1.1 * Math.PI, 1.9 * Math.PI);
    c.stroke();
  }

  getScrewSprite(color) {
    const key = 'screw:' + color;
    if (this.screwCache.has(key)) return this.screwCache.get(key);
    const info = window.Levels.SCREW_TYPES[color] || window.Levels.SCREW_TYPES.gold;
    const r = 17;
    const k = this.scale * this.dpr;
    const size = (r * 2 + 4);
    const cv = this.makeCanvas(size * k, size * k);
    const c = cv.getContext('2d');
    c.scale(k, k);
    c.translate(size / 2, size / 2);
    const rim = c.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
    rim.addColorStop(0, info.stops[0]);
    rim.addColorStop(0.55, info.stops[1]);
    rim.addColorStop(1, info.stops[2]);
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = rim;
    c.fill();
    c.lineWidth = 1.6;
    c.strokeStyle = info.borderHex;
    c.stroke();
    // Domed head ring
    c.beginPath();
    c.arc(0, 0, r * 0.78, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(0,0,0,0.18)';
    c.lineWidth = 1;
    c.stroke();
    // Phillips drive
    c.fillStyle = '#120a05';
    const L = r * 1.05;
    const W = 3.6;
    c.beginPath();
    c.roundRect(-L / 2, -W / 2, L, W, 1.5);
    c.roundRect(-W / 2, -L / 2, W, L, 1.5);
    c.fill();
    if (info.gem) {
      const gg = c.createRadialGradient(-2, -2, 1, 0, 0, r * 0.42);
      gg.addColorStop(0, '#ffffff');
      gg.addColorStop(0.35, info.gem);
      gg.addColorStop(1, info.borderHex);
      c.beginPath();
      c.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      c.fillStyle = gg;
      c.fill();
    }
    // Glint
    c.beginPath();
    c.ellipse(-r * 0.38, -r * 0.42, r * 0.28, r * 0.14, -0.7, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.fill();
    const s = { canvas: cv, size };
    this.screwCache.set(key, s);
    return s;
  }

  getRustSprite() {
    const key = 'rust';
    if (this.screwCache.has(key)) return this.screwCache.get(key);
    const r = 17;
    const k = this.scale * this.dpr;
    const size = r * 2 + 4;
    const cv = this.makeCanvas(size * k, size * k);
    const c = cv.getContext('2d');
    c.scale(k, k);
    c.translate(size / 2, size / 2);
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.clip();
    const rnd = window.Levels.mulberry32(77);
    for (let i = 0; i < 26; i++) {
      c.beginPath();
      c.arc((rnd() - 0.5) * r * 2, (rnd() - 0.5) * r * 2, 2 + rnd() * 5, 0, Math.PI * 2);
      c.fillStyle = `rgba(${120 + rnd() * 50 | 0}, ${55 + rnd() * 30 | 0}, 20, ${0.55 + rnd() * 0.35})`;
      c.fill();
    }
    const s = { canvas: cv, size };
    this.screwCache.set(key, s);
    return s;
  }

  getBoard(level) {
    if (this.boardCache && this.boardCache.level === level) return this.boardCache;
    const k = this.dpr;
    const cv = this.makeCanvas(this.displayWidth * k, this.displayHeight * k);
    const c = cv.getContext('2d');
    c.scale(k, k);
    c.translate(this.offsetX, this.offsetY);
    c.scale(this.scale, this.scale);
    level.screws.forEach(s => this.drawSocket(c, s.x, s.y, 12));
    this.boardCache = { level, canvas: cv };
    return this.boardCache;
  }

  // ---------- Frame ----------
  beginFrame(dt) {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const m = this.shakeMag * Math.max(0, this.shakeT / 220);
      this.sx = (Math.random() - 0.5) * m;
      this.sy = (Math.random() - 0.5) * m;
    } else {
      this.sx = 0;
      this.sy = 0;
    }
  }

  triggerShake(duration = 220, magnitude = 6) {
    this.shakeT = duration;
    this.shakeMag = magnitude;
  }

  setXf(x, y, angle = 0, s = 1) {
    const d = this.dpr * s;
    const cos = Math.cos(angle) * d;
    const sin = Math.sin(angle) * d;
    this.ctx.setTransform(cos, sin, -sin, cos, (x + this.sx) * this.dpr, (y + this.sy) * this.dpr);
  }

  drawBoard(level) {
    const b = this.getBoard(level);
    this.ctx.setTransform(1, 0, 0, 1, this.sx * this.dpr, this.sy * this.dpr);
    this.ctx.drawImage(b.canvas, 0, 0);
  }

  /** pose = {x, y, angle} in virtual units. */
  drawPlate(plate, pose, { alpha = 1, highlight = 0, wobble = 0 } = {}) {
    const s = this.getPlateSprites(plate);
    const p = this.virtualToScreen(pose.x, pose.y);
    const angle = pose.angle + wobble;
    const sc = this.scale;
    const c = this.ctx;
    const lift = (2 + (plate.layer || 1) * 2.4) * sc;
    c.globalAlpha = alpha * 0.9;
    this.setXf(p.x, p.y + lift, angle);
    c.drawImage(s.shadow, -s.sw * sc / 2, -s.sh * sc / 2, s.sw * sc, s.sh * sc);
    c.globalAlpha = alpha;
    this.setXf(p.x, p.y, angle);
    c.drawImage(s.body, -s.bw * sc / 2, -s.bh * sc / 2, s.bw * sc, s.bh * sc);
    if (highlight > 0) {
      this.setXf(p.x, p.y, angle, sc);
      c.lineWidth = 4 / sc * 1.2;
      c.strokeStyle = `rgba(255, 60, 80, ${0.95 * highlight})`;
      c.shadowColor = 'rgba(255, 40, 60, 0.9)';
      c.shadowBlur = 14 * this.dpr;
      c.stroke(s.outline);
      c.shadowBlur = 0;
      c.shadowColor = 'transparent';
    }
    c.globalAlpha = 1;
  }

  /**
   * opts: spin (radians added), lift (0..1 rising out of the hole), blocked, xray, rust, pulse (0..1)
   */
  drawScrew(screw, { spin = 0, lift = 0, blocked = false, xray = false, rust = false, alpha = 1 } = {}) {
    const sp = this.getScrewSprite(screw.color);
    const p = this.virtualToScreen(screw.x, screw.y);
    const sc = this.scale;
    const c = this.ctx;
    const size = sp.size * sc;
    const grow = 1 + lift * 0.4;
    // Contact shadow grows as the screw rises
    c.globalAlpha = alpha * (0.45 - lift * 0.15);
    this.setXf(p.x + lift * 4 * sc, p.y + (2 + lift * 12) * sc, 0);
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(0, 0, 15 * sc * grow, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = alpha * (xray ? 0.7 : 1);
    this.setXf(p.x, p.y - lift * 10 * sc, (screw.rot || 0) + spin, grow);
    c.drawImage(sp.canvas, -size / 2, -size / 2, size, size);
    if (rust) {
      const rs = this.getRustSprite();
      c.drawImage(rs.canvas, -size / 2, -size / 2, size, size);
    }
    if (blocked && !xray) {
      c.fillStyle = 'rgba(8, 4, 2, 0.4)';
      c.beginPath();
      c.arc(0, 0, 17 * sc, 0, Math.PI * 2);
      c.fill();
    }
    if (xray) {
      this.setXf(p.x, p.y, 0);
      c.setLineDash([4 * sc, 3 * sc]);
      c.lineWidth = 2;
      c.strokeStyle = 'rgba(160, 230, 255, 0.95)';
      c.beginPath();
      c.arc(0, 0, 21 * sc, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }
    c.globalAlpha = 1;
  }

  // ---------- Effects (screen space, CSS px) ----------
  spawnSparks(vx, vy, color = '#ffd700', count = 12, { speed = 1, gravity = 0.08, size = 1 } = {}) {
    const p = this.virtualToScreen(vx, vy);
    const room = Math.max(0, 420 - this.particles.length);
    for (let i = 0; i < Math.min(count, room); i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (1.4 + Math.random() * 3.4) * speed;
      this.particles.push({
        x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.1 * speed,
        size: (2 + Math.random() * 3) * size, color, alpha: 1, decay: 0.022 + Math.random() * 0.03,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, g: gravity
      });
    }
  }

  spawnRing(vx, vy, color = 'rgba(255,215,0,0.9)', maxR = 40) {
    const p = this.virtualToScreen(vx, vy);
    this.rings.push({ x: p.x, y: p.y, r: 6, maxR: maxR * this.scale, color, alpha: 1 });
  }

  spawnFloatingText(vx, vy, text, color = '#ffd700', size = 16) {
    const p = this.virtualToScreen(vx, vy);
    this.texts.push({ x: p.x, y: p.y, text, color, alpha: 1, vy: -1.2, size });
  }

  updateEffects(dt) {
    const c = this.ctx;
    const f = Math.min(3, dt / 16.67);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.vy += p.g * f;
      p.alpha -= p.decay * f;
      p.rot += p.vr * f;
      if (p.alpha <= 0) { this.particles.splice(i, 1); continue; }
      c.globalAlpha = p.alpha;
      this.setXf(p.x, p.y, p.rot);
      c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.r += (r.maxR - r.r) * 0.18 * f;
      r.alpha -= 0.045 * f;
      if (r.alpha <= 0) { this.rings.splice(i, 1); continue; }
      c.globalAlpha = r.alpha;
      this.setXf(r.x, r.y, 0);
      c.strokeStyle = r.color;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, r.r, 0, Math.PI * 2);
      c.stroke();
    }
    c.textAlign = 'center';
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y += t.vy * f;
      t.alpha -= 0.016 * f;
      if (t.alpha <= 0) { this.texts.splice(i, 1); continue; }
      c.globalAlpha = Math.min(1, t.alpha * 1.4);
      this.setXf(0, 0, 0);
      c.font = `900 ${t.size}px Cinzel, Georgia, serif`;
      const half = c.measureText(t.text).width / 2 + 8;
      const x = Math.max(half, Math.min(this.displayWidth - half, t.x));
      c.lineWidth = 4;
      c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(t.text, x, t.y);
      c.fillStyle = t.color;
      c.fillText(t.text, x, t.y);
    }
    c.globalAlpha = 1;
  }

  /** Pulsing tutorial ring + finger around a screw. */
  drawHint(vx, vy, time) {
    const p = this.virtualToScreen(vx, vy);
    const c = this.ctx;
    const k = (time % 1000) / 1000;
    this.setXf(p.x, p.y, 0);
    c.globalAlpha = 1 - k;
    c.strokeStyle = '#fff6c9';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, (20 + k * 18) * this.scale, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;
    const bob = Math.sin(time / 180) * 6;
    c.font = `${Math.round(34 * this.scale)}px sans-serif`;
    c.textAlign = 'left';
    c.fillText('👆', 8 * this.scale, (34 + bob) * this.scale);
    c.textAlign = 'center';
  }
}

window.GameRenderer = GameRenderer;
