/**
 * Dev-only: lets automated tests run the game in a hidden/background browser tab,
 * where requestAnimationFrame is paused and timers are throttled.
 * Load from the console: await import('/tools/test-shim.js')
 */
(function () {
  if (window.__shim) return;
  window.__shim = true;
  const ch = new MessageChannel();
  const frameQueue = [];
  let timers = [];
  let nextId = 1;
  ch.port1.onmessage = () => {
    const now = performance.now();
    const due = timers.filter(t => t.at <= now);
    timers = timers.filter(t => t.at > now);
    due.forEach(t => { try { t.fn(); } catch (e) { console.error(e); } });
    if (frameQueue.length && now - (window.__lastFrame || 0) >= 16) {
      window.__lastFrame = now;
      frameQueue.splice(0).forEach(cb => { try { cb(now); } catch (e) { console.error(e); } });
    }
    ch.port2.postMessage(0);
  };
  window.requestAnimationFrame = cb => { frameQueue.push(cb); return 1; };
  window.setTimeout = (fn, ms) => { const id = nextId++; timers.push({ id, at: performance.now() + (ms || 0), fn }); return id; };
  window.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
  window.setInterval = (fn, ms) => {
    const id = nextId++;
    const rep = () => { fn(); timers.push({ id, at: performance.now() + ms, fn: rep }); };
    timers.push({ id, at: performance.now() + ms, fn: rep });
    return id;
  };
  window.clearInterval = window.clearTimeout;
  ch.port2.postMessage(0);
  if (window.chronoGame) window.chronoGame.startLoop();

  /** Naive auto-player: matching screw first, else any free screw into the tray. */
  window.__auto = async function (maxMoves = 120, gap = 260) {
    const g = window.chronoGame;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const lv = g.lv;
    let moves = 0;
    for (let t = 0; t < 900 && moves < maxMoves; t++) {
      if (lv.ended) return { r: 'won', moves, peak: lv.peakTray };
      if (!g.$('modal-stuck').classList.contains('hidden')) return { r: 'stuck', moves, tray: lv.tray.map(x => x && x.screw.color) };
      const box = g.activeBox();
      const free = lv.screws.filter(s => s.state === 'board' && !g.blockerOf(s));
      if (!free.length || !box) { await sleep(100); continue; }
      const pick = free.find(s => s.color === box.color) || (lv.tray.indexOf(null) !== -1 ? free[0] : null);
      if (!pick) { await sleep(100); continue; }
      const p = g.renderer.virtualToScreen(pick.x, pick.y);
      g.onTap(p.x, p.y);
      moves++;
      await sleep(gap);
    }
    return { r: 'timeout', moves };
  };
})();
