/**
 * ChronoMaster UI Effects (DOM layer above everything)
 * Coins and stars that fly into their counters, number count-ups, toasts and sparkle bursts:
 * the small "juice" that makes every reward feel earned.
 */
class FX {
  constructor() {
    this.root = document.getElementById('game-container');
    this.layer = document.getElementById('fx-layer');
  }

  /** Point (centre of element or {x,y} in viewport px) → coords inside the game container. */
  local(target) {
    const r = this.root.getBoundingClientRect();
    if (target && target.getBoundingClientRect) {
      const t = target.getBoundingClientRect();
      return { x: t.left - r.left + t.width / 2, y: t.top - r.top + t.height / 2 };
    }
    return { x: target.x - r.left, y: target.y - r.top };
  }

  toast(text, kind = 'info', ms = 2200) {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.layer.appendChild(el);
    setTimeout(() => el.classList.add('out'), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  /**
   * Fly `count` icons from → to along an arc. onEach(i) fires as each one lands (for ticking counters).
   */
  fly({ from, to, html = '⚙️', count = 6, duration = 650, stagger = 70, size = 26, onEach, onDone }) {
    const a = this.local(from);
    const b = this.local(to);
    const n = Math.max(1, count);
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'fly-icon';
      el.style.fontSize = `${size}px`;
      el.innerHTML = html;
      el.style.left = `${a.x}px`;
      el.style.top = `${a.y}px`;
      this.layer.appendChild(el);
      const spread = (Math.random() - 0.5) * 70;
      const lift = 60 + Math.random() * 60;
      const midX = (b.x - a.x) * 0.35 + spread;
      const midY = Math.min(0, b.y - a.y) * 0.4 - lift;
      const delay = i * stagger;
      if (el.animate) {
        el.animate([
          { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4)', opacity: 0 },
          { transform: `translate(-50%,-50%) translate(${spread * 0.4}px,${-lift * 0.3}px) scale(1.25)`, opacity: 1, offset: 0.18 },
          { transform: `translate(-50%,-50%) translate(${midX}px,${midY}px) scale(1.05)`, opacity: 1, offset: 0.55 },
          { transform: `translate(-50%,-50%) translate(${b.x - a.x}px,${b.y - a.y}px) scale(0.55)`, opacity: 0.9 }
        ], { duration, delay, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      }
      setTimeout(() => {
        el.remove();
        if (onEach) onEach(i);
        if (i === n - 1 && onDone) onDone();
      }, duration + delay);
    }
  }

  /** Animated number change inside an element. */
  countUp(el, from, to, ms = 700, format = v => String(v)) {
    if (!el) return;
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = format(Math.round(from + (to - from) * eased));
      if (t < 1) requestAnimationFrame(step);
      else el.textContent = format(to);
    };
    requestAnimationFrame(step);
    // Fallback if frames are paused (backgrounded app)
    setTimeout(() => { el.textContent = format(to); }, ms + 120);
  }

  bump(el, cls = 'bump') {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  /** Radial sparkle burst at an element / point (DOM, so it shows above modals). */
  burst(target, { count = 18, colors = ['#ffd700', '#fff4b8', '#ffb347'], spread = 110, size = 7 } = {}) {
    const p = this.local(target);
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'spark';
      const c = colors[i % colors.length];
      el.style.background = c;
      el.style.boxShadow = `0 0 8px ${c}`;
      el.style.width = el.style.height = `${size * (0.6 + Math.random() * 0.8)}px`;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
      this.layer.appendChild(el);
      const ang = Math.random() * Math.PI * 2;
      const dist = spread * (0.4 + Math.random() * 0.6);
      const dx = Math.cos(ang) * dist;
      const dy = Math.sin(ang) * dist;
      if (el.animate) {
        el.animate([
          { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
          { transform: `translate(-50%,-50%) translate(${dx}px,${dy + 30}px) scale(0.2)`, opacity: 0 }
        ], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      }
      setTimeout(() => el.remove(), 1000);
    }
  }

  /** Short text that rises and fades over a DOM point. */
  floatText(target, text, color = '#ffd700') {
    const p = this.local(target);
    const el = document.createElement('div');
    el.className = 'float-text';
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.style.color = color;
    el.textContent = text;
    this.layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }
}

window.FX = FX;
