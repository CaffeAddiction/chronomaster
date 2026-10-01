/**
 * ChronoMaster Canvas Renderer
 * High-definition 2D antique horology rendering with realistic metallic gradients,
 * dynamic drop-shadows, gear teeth, screw heads, and visual particle feedback.
 */

class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.highlightedPlateId = null;
    this._highlightTimeout = null;
    this.shakeDuration = 0;
    this.shakeMagnitude = 0;
    this.resize();
  }

  triggerShake(duration = 240, magnitude = 6) {
    this.shakeDuration = duration;
    this.shakeMagnitude = magnitude;
  }

  setHighlightedPlate(plateId) {
    this.highlightedPlateId = plateId;
    if (this._highlightTimeout) clearTimeout(this._highlightTimeout);
    this._highlightTimeout = setTimeout(() => {
      this.highlightedPlateId = null;
    }, 950);
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.displayWidth = rect.width;
    this.displayHeight = rect.height;

    // Virtual game area is 400x520
    const virtW = 400;
    const virtH = 520;
    this.scale = Math.min(this.displayWidth / virtW, this.displayHeight / virtH) * 0.94;
    this.offsetX = (this.displayWidth - virtW * this.scale) / 2;
    this.offsetY = (this.displayHeight - virtH * this.scale) / 2;
  }

  virtualToScreen(x, y) {
    return {
      x: this.offsetX + x * this.scale,
      y: this.offsetY + y * this.scale
    };
  }

  screenToVirtual(x, y) {
    return {
      x: (x - this.offsetX) / this.scale,
      y: (y - this.offsetY) / this.scale
    };
  }

  // Clear Canvas and Draw Background Details (with Camera Shake)
  clear() {
    this.ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
    
    if (this.shakeDuration > 0) {
      const sx = (Math.random() - 0.5) * this.shakeMagnitude;
      const sy = (Math.random() - 0.5) * this.shakeMagnitude;
      this.ctx.save();
      this.ctx.translate(sx, sy);
      this.shakeDuration -= 16;
    }
  }

  restoreShake() {
    if (this.shakeDuration > 0) {
      this.ctx.restore();
    }
  }

  // Add Particle Burst
  spawnSparks(x, y, color = '#ffd700', count = 12) {
    const sPos = this.virtualToScreen(x, y);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      this.particles.push({
        x: sPos.x,
        y: sPos.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 2 + Math.random() * 3,
        color: color,
        alpha: 1,
        decay: 0.025 + Math.random() * 0.03,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.3
      });
    }
  }

  // Add Floating Score / ASMR Text
  spawnFloatingText(x, y, text, color = '#ffd700') {
    const sPos = this.virtualToScreen(x, y);
    this.floatingTexts.push({
      x: sPos.x,
      y: sPos.y,
      text: text,
      color: color,
      alpha: 1,
      vy: -1.4
    });
  }

  // Draw Dynamic Plate (from Matter.js body or static definition)
  drawPlate(plate, body) {
    this.ctx.save();

    // Use current physics position & rotation if available, else definition
    let px = body ? body.position.x : plate.x;
    let py = body ? body.position.y : plate.y;
    let pAngle = body ? body.angle : (plate.angle || 0);

    const sPos = this.virtualToScreen(px, py);

    this.ctx.translate(sPos.x, sPos.y);
    this.ctx.rotate(pAngle);
    this.ctx.scale(this.scale, this.scale);

    // Dynamic Layer Drop Shadow
    const shadowDist = 4 + (plate.layer || 1) * 5;
    const shadowBlur = 6 + (plate.layer || 1) * 4;
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    this.ctx.shadowBlur = shadowBlur;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = shadowDist;

    // Material Styling
    let strokeStyle = '#ffd700';
    let fillGradient;

    if (plate.material === 'brass') {
      fillGradient = this.ctx.createLinearGradient(-100, -100, 100, 100);
      fillGradient.addColorStop(0, '#f2d675');
      fillGradient.addColorStop(0.3, '#d4af37');
      fillGradient.addColorStop(0.7, '#a67c1e');
      fillGradient.addColorStop(1, '#66490f');
      strokeStyle = '#ffeaa7';
    } else if (plate.material === 'steel') {
      fillGradient = this.ctx.createLinearGradient(-100, -100, 100, 100);
      fillGradient.addColorStop(0, '#a1b5cc');
      fillGradient.addColorStop(0.35, '#5c7a99');
      fillGradient.addColorStop(0.7, '#3b526b');
      fillGradient.addColorStop(1, '#233242');
      strokeStyle = '#d6e5f5';
    } else if (plate.material === 'copper') {
      fillGradient = this.ctx.createLinearGradient(-100, -100, 100, 100);
      fillGradient.addColorStop(0, '#f29b79');
      fillGradient.addColorStop(0.35, '#c96a42');
      fillGradient.addColorStop(0.7, '#8f4222');
      fillGradient.addColorStop(1, '#57220e');
      strokeStyle = '#ffc0a8';
    } else {
      fillGradient = this.ctx.createLinearGradient(-100, -100, 100, 100);
      fillGradient.addColorStop(0, '#e0cfb8');
      fillGradient.addColorStop(1, '#5e4f3e');
      strokeStyle = '#f5e9da';
    }

    const isHighlighted = (this.highlightedPlateId === plate.id);
    if (isHighlighted) {
      strokeStyle = '#ff3344';
      this.ctx.shadowColor = 'rgba(255, 51, 68, 0.95)';
      this.ctx.shadowBlur = 24;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 0;
    }

    this.ctx.fillStyle = fillGradient;

    // Draw Shape
    if (plate.type === 'rect' || plate.type === 'bar') {
      const w = plate.width;
      const h = plate.height;
      const r = Math.min(plate.radius || 12, w / 2, h / 2);

      this.ctx.beginPath();
      this.ctx.roundRect(-w / 2, -h / 2, w, h, r);
      this.ctx.fill();

      // Outer Bevel Highlight (or Red Warning if blocking)
      this.ctx.shadowColor = isHighlighted ? 'rgba(255, 51, 68, 0.9)' : 'transparent';
      this.ctx.shadowBlur = isHighlighted ? 15 : 0;
      this.ctx.lineWidth = isHighlighted ? 4 : 2.5;
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.stroke();

      // Inner Engraving Border
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.beginPath();
      this.ctx.roundRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, Math.max(2, r - 4));
      this.ctx.stroke();

    } else if (plate.type === 'circle') {
      const r = plate.radius;

      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowColor = 'transparent';
      this.ctx.lineWidth = 3;
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.stroke();

      // Concentric circles for antique clockwork look
      this.ctx.lineWidth = 1.5;
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      this.ctx.stroke();

    } else if (plate.type === 'gear') {
      const r = plate.radius;
      const teeth = plate.teeth || 10;
      const toothDepth = r * 0.16;

      this.ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = a1 + (Math.PI / teeth) * 0.4;
        const a3 = a1 + (Math.PI / teeth) * 0.6;
        const a4 = a1 + (Math.PI / teeth);

        const rOuter = r;
        const rInner = r - toothDepth;

        const x1 = Math.cos(a1) * rInner;
        const y1 = Math.sin(a1) * rInner;
        const x2 = Math.cos(a2) * rOuter;
        const y2 = Math.sin(a2) * rOuter;
        const x3 = Math.cos(a3) * rOuter;
        const y3 = Math.sin(a3) * rOuter;
        const x4 = Math.cos(a4) * rInner;
        const y4 = Math.sin(a4) * rInner;

        if (i === 0) this.ctx.moveTo(x1, y1);
        else this.ctx.lineTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.lineTo(x3, y3);
        this.ctx.lineTo(x4, y4);
      }
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.shadowColor = 'transparent';
      this.ctx.lineWidth = 2.5;
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.stroke();

      // Gear Spokes
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      for (let s = 0; s < 4; s++) {
        const spokeAngle = (s / 4) * Math.PI * 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 0);
        this.ctx.lineTo(Math.cos(spokeAngle) * (r - toothDepth * 1.5), Math.sin(spokeAngle) * (r - toothDepth * 1.5));
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  // Draw Hole (Background socket where screw was or can be placed)
  drawHole(x, y, radius = 15) {
    const sPos = this.virtualToScreen(x, y);
    const r = radius * this.scale;

    this.ctx.save();
    this.ctx.translate(sPos.x, sPos.y);

    // Dark cavity gradient
    const grad = this.ctx.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#050302');
    grad.addColorStop(0.7, '#140c07');
    grad.addColorStop(1, '#2c1c11');

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Metallic Brass Chamfer Rim
    this.ctx.lineWidth = 2 * this.scale;
    this.ctx.strokeStyle = '#5a3d24';
    this.ctx.stroke();

    // Screw thread ridges inside hole
    this.ctx.lineWidth = 1 * this.scale;
    this.ctx.strokeStyle = 'rgba(212, 175, 55, 0.15)';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Draw Physical Screw Head
  drawScrew(screw, isHovered = false, isBlocked = false, isDependentLocked = false) {
    const sPos = this.virtualToScreen(screw.x, screw.y);
    const r = 18 * this.scale;

    this.ctx.save();
    this.ctx.translate(sPos.x, sPos.y);

    // Drop shadow
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    this.ctx.shadowBlur = 6 * this.scale;
    this.ctx.shadowOffsetY = 3 * this.scale;

    const info = window.SCREW_TYPES[screw.color] || window.SCREW_TYPES.gold;

    // Screw Outer Rim Gradient
    const rimGrad = this.ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    if (screw.color === 'gold') {
      rimGrad.addColorStop(0, '#fff4b8');
      rimGrad.addColorStop(0.5, '#d4af37');
      rimGrad.addColorStop(1, '#66470c');
    } else if (screw.color === 'steel') {
      rimGrad.addColorStop(0, '#d8e8f8');
      rimGrad.addColorStop(0.5, '#4a6984');
      rimGrad.addColorStop(1, '#1b2936');
    } else if (screw.color === 'ruby') {
      rimGrad.addColorStop(0, '#ff99aa');
      rimGrad.addColorStop(0.5, '#d12d4a');
      rimGrad.addColorStop(1, '#540b17');
    } else { // copper
      rimGrad.addColorStop(0, '#ffd1be');
      rimGrad.addColorStop(0.5, '#b85d38');
      rimGrad.addColorStop(1, '#4f1e0a');
    }

    this.ctx.beginPath();
    this.ctx.arc(0, 0, r, 0, Math.PI * 2);
    this.ctx.fillStyle = rimGrad;
    this.ctx.fill();

    // Outer border ring
    this.ctx.shadowColor = 'transparent';
    this.ctx.lineWidth = 1.8 * this.scale;
    this.ctx.strokeStyle = isHovered ? '#ffffff' : (isDependentLocked ? '#443322' : info.borderHex);
    this.ctx.stroke();

    // Inner screw drive socket (Phillips Cross)
    const slotLength = r * 1.1;
    const slotWidth = 3.2 * this.scale;

    this.ctx.fillStyle = '#110a06';

    // Horizontal slot
    this.ctx.beginPath();
    this.ctx.roundRect(-slotLength / 2, -slotWidth / 2, slotLength, slotWidth, 1.5);
    this.ctx.fill();

    // Vertical slot
    this.ctx.beginPath();
    this.ctx.roundRect(-slotWidth / 2, -slotLength / 2, slotWidth, slotLength, 1.5);
    this.ctx.fill();

    // Gemstone center for Ruby screws
    if (screw.color === 'ruby') {
      const gemGrad = this.ctx.createRadialGradient(-2, -2, 1, 0, 0, r * 0.45);
      gemGrad.addColorStop(0, '#ff8099');
      gemGrad.addColorStop(0.6, '#ff0037');
      gemGrad.addColorStop(1, '#7a0018');

      this.ctx.beginPath();
      this.ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      this.ctx.fillStyle = gemGrad;
      this.ctx.fill();
      this.ctx.strokeStyle = '#ffe0e6';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    }

    // If blocked or dependent-locked, show translucent shadow + lock indicator
    if (isBlocked || isDependentLocked) {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, r, 0, Math.PI * 2);
      this.ctx.fillStyle = isDependentLocked ? 'rgba(10, 6, 4, 0.65)' : 'rgba(0, 0, 0, 0.55)';
      this.ctx.fill();

      // Lock icon with metallic reflection
      this.ctx.fillStyle = isDependentLocked ? '#ffbb33' : '#ffcc00';
      this.ctx.font = `${Math.floor(13 * this.scale)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(isDependentLocked ? '⛓️' : '🔒', 0, 0);
    }

    this.ctx.restore();
  }

  // Update & Draw Particles and Floating Texts
  updateEffects() {
    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.alpha -= p.decay;
      p.rotation += p.vRot;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      this.ctx.restore();
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.y += t.vy;
      t.alpha -= 0.02;

      if (t.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, t.alpha);
      this.ctx.fillStyle = t.color;
      this.ctx.font = `bold 16px 'Cinzel', serif`;
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(t.text, t.x, t.y);
      this.ctx.restore();
    }
  }
}

window.GameRenderer = GameRenderer;
