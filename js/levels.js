/**
 * ChronoMaster: Data catalogue & deterministic level generator.
 * Levels 1-2 are hand-made tutorials; every later level is generated from a fixed seed,
 * then accepted only if the solver proves it winnable and its difficulty fits the curve.
 */
(function (root) {
  const Solver = root.Solver || (typeof require === 'function' ? require('./solver.js') : null);

  const BOARD = { width: 400, height: 520 };
  const BUFFER_SIZE = 5;

  const SCREW_TYPES = {
    gold:    { name: 'Pirinç', colorClass: 'screw-gold',    hex: '#ffd700', borderHex: '#855d14', stops: ['#fff4b8', '#d4af37', '#66470c'] },
    steel:   { name: 'Çelik',  colorClass: 'screw-steel',   hex: '#7fa6cc', borderHex: '#1f2f3d', stops: ['#d8e8f8', '#4a6984', '#1b2936'] },
    ruby:    { name: 'Yakut',  colorClass: 'screw-ruby',    hex: '#ff4769', borderHex: '#5e0c1b', stops: ['#ff99aa', '#d12d4a', '#540b17'], gem: '#ff2d55' },
    copper:  { name: 'Bakır',  colorClass: 'screw-copper',  hex: '#e07a4a', borderHex: '#572511', stops: ['#ffd1be', '#b85d38', '#4f1e0a'] },
    emerald: { name: 'Zümrüt', colorClass: 'screw-emerald', hex: '#34d399', borderHex: '#0d4a2f', stops: ['#c3f7dd', '#2fb67a', '#0b3d26'], gem: '#10e08a' }
  };
  const COLOR_ORDER = ['gold', 'steel', 'ruby', 'copper', 'emerald'];

  const MATERIALS = {
    brass:  { stops: ['#f2d675', '#d4af37', '#a67c1e', '#66490f'], stroke: '#ffeaa7' },
    steel:  { stops: ['#b4c6da', '#6f8aa6', '#45607b', '#26384a'], stroke: '#dbe8f5' },
    copper: { stops: ['#f29b79', '#c96a42', '#8f4222', '#57220e'], stroke: '#ffc0a8' },
    silver: { stops: ['#f4f6f8', '#c3cad2', '#8d97a3', '#59626d'], stroke: '#ffffff' },
    bronze: { stops: ['#c9a36a', '#8f6a36', '#634420', '#3b2711'], stroke: '#e8cf9f' },
    walnut: { stops: ['#9a6b45', '#6e4527', '#4f2f19', '#2e1a0c'], stroke: '#c79b6d' }
  };

  /** Restored masterpieces shown in the shop's display cabinet. Unlocked on every 5th level. */
  const ARTIFACTS = [
    { id: 1,  title: '1892 Altın Cep Saati',     category: 'Avcı Kasa Cep Saati',   year: '1892', icon: '🕰️', rate: 10, desc: 'Demiryolu şefleri için yapılmış, kollu eşapmanlı 18 ayar altın kasalı şaheser.' },
    { id: 2,  title: 'Viyana Regülatör Saati',   category: 'Sarkaçlı Duvar Saati',   year: '1840', icon: '⏰', rate: 14, desc: 'Ağır pirinç sarkacıyla saniyeleri sayan, 8 gün kurmalı salon saati.' },
    { id: 3,  title: '1875 Banka Kasası Kilidi', category: 'Çift Sürgülü Kasa',     year: '1875', icon: '🔐', rate: 18, desc: 'Çapraz emniyet kollu, delinmez çelik gövdeli tarihi banka kasası kilidi.' },
    { id: 4,  title: 'Seyir Usturlabı',          category: 'Bronz Astronomi Aleti', year: '1580', icon: '🧭', rate: 22, desc: 'Yıldızların açısını ölçerek açık denizde rota bulduran bronz alet.' },
    { id: 5,  title: 'Nürnberg Kafes Kilidi',    category: 'Kilitli Zırh Sandığı',  year: '1720', icon: '🗝️', rate: 26, desc: 'Birbirine kenetlenen dikey ve yatay çubuklarla korunan sandık kilidi.' },
    { id: 6,  title: 'Cenevre Müzik Kutusu',     category: 'Silindir & Tarak',      year: '1860', icon: '🎵', rate: 30, desc: 'Yüzlerce pirinç pimiyle çelik tarağa vurup klasik besteler çalar.' },
    { id: 7,  title: 'Kara Orman Guguklu Saati', category: 'Oymalı Duvar Saati',    year: '1905', icon: '🐦', rate: 34, desc: 'Her saat başı ahşap kuşunun ötüşüyle dükkânı neşelendirir.' },
    { id: 8,  title: 'Pirinç Gözlem Teleskobu',  category: 'Optik Alet',            year: '1890', icon: '🔭', rate: 38, desc: 'Üç kademeli pirinç gövdesi ve elle taşlanmış merceğiyle bir hazine.' },
    { id: 9,  title: 'Art Deco Masa Saati',      category: 'Mermer & Krom',         year: '1925', icon: '⌚', rate: 42, desc: 'Geometrik çizgileriyle caz çağının zarafetini taşıyan masa saati.' },
    { id: 10, title: 'Mors Telgraf Makinesi',    category: 'İletişim Aleti',        year: '1880', icon: '📟', rate: 46, desc: 'Şehirden şehre ilk anlık mesajları taşıyan pirinç anahtarlı telgraf.' },
    { id: 11, title: 'Ötücü Kuş Otomatı',        category: 'Mekanik Oyuncak',       year: '1795', icon: '🪶', rate: 52, desc: 'Kafesindeki minik kuş kanat çırpıp gerçek bir kuş gibi öter.' },
    { id: 12, title: 'Deniz Kronometresi H4',    category: 'Ustalık Başyapıtı',     year: '1761', icon: '👑', rate: 60, desc: 'Boylam sorununu çözen, modern denizciliği başlatan efsanevi kronometre.' }
  ];
  const MASTERPIECE_EVERY = 5;

  const CUSTOMERS = ['Leyla Hanım', 'Kaptan Rıza', 'Profesör Nuri', 'Fotoğrafçı Agop', 'Mimar Kemal',
    'Terzi Mihran', 'Eczacı Selma', 'Muallim Cemil', 'Kitapçı Ruhi', 'Doktor Feride', 'Berber Yaşar',
    'Kuyumcu Aram', 'Ressam Nazlı', 'Postacı Hilmi', 'Çiçekçi Melek', 'Avukat Sabri', 'Kemancı Lale'];
  const ITEMS = ['Cep Saati', 'Masa Saati', 'Pirinç Pusula', 'Gramofon Kolu', 'Daktilo Mekanizması',
    'Kurmalı Oyuncak', 'Sandık Kilidi', 'Fener Saati', 'Barometre', 'Metronom', 'Dürbün', 'Duvar Saati',
    'Fotoğraf Makinesi', 'Çalar Saat', 'Kol Saati', 'Telgraf Anahtarı', 'Termometre', 'Pandül Saati',
    'Pirinç Terazi', 'Dikiş Makinesi'];

  // ---------- Hand-made tutorial levels ----------
  const HANDMADE = {
    1: {
      job: { customer: 'Halil Usta', item: 'Eski Cep Saati Kapağı' },
      boxes: ['gold', 'steel'],
      plates: [
        { id: 'base', layer: 1, type: 'rect', x: 200, y: 300, width: 270, height: 190, radius: 22, material: 'steel' },
        { id: 'bar', layer: 2, type: 'bar', x: 200, y: 245, width: 270, height: 52, radius: 14, material: 'brass' }
      ],
      screws: [
        { x: 95, y: 245, color: 'gold', on: 'bar' },
        { x: 200, y: 245, color: 'gold', on: 'bar' },
        { x: 305, y: 245, color: 'gold', on: 'bar' },
        { x: 148, y: 250, color: 'steel', on: 'base' },
        { x: 110, y: 350, color: 'steel', on: 'base' },
        { x: 290, y: 350, color: 'steel', on: 'base' }
      ]
    },
    2: {
      job: { customer: 'Leyla Hanım', item: 'Pirinç Masa Saati' },
      boxes: ['ruby', 'gold', 'steel'],
      plates: [
        { id: 'base', layer: 1, type: 'rect', x: 200, y: 290, width: 290, height: 250, radius: 24, material: 'walnut' },
        { id: 'mid', layer: 2, type: 'bar', x: 200, y: 290, width: 52, height: 236, radius: 14, material: 'steel' },
        { id: 'top', layer: 3, type: 'bar', x: 200, y: 235, width: 260, height: 52, radius: 14, material: 'brass' }
      ],
      screws: [
        { x: 95, y: 235, color: 'ruby', on: 'top' },
        { x: 150, y: 235, color: 'gold', on: 'top' },
        { x: 300, y: 235, color: 'gold', on: 'top' },
        { x: 200, y: 238, color: 'ruby', on: 'mid' },
        { x: 200, y: 330, color: 'steel', on: 'mid' },
        { x: 200, y: 385, color: 'gold', on: 'mid' },
        { x: 92, y: 385, color: 'ruby', on: 'base' },
        { x: 308, y: 385, color: 'steel', on: 'base' },
        { x: 95, y: 183, color: 'steel', on: 'base' }
      ]
    }
  };

  // ---------- Seeded RNG ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
  const range = (rng, a, b) => a + rng() * (b - a);
  function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ---------- Difficulty curve ----------
  function isMasterpiece(n) { return n % MASTERPIECE_EVERY === 0; }

  function tierFor(n) {
    const t = {
      plates: n < 6 ? 3 : n < 14 ? 4 : n < 30 ? 5 : 6,
      screws: n < 5 ? 12 : n < 12 ? 15 : n < 25 ? 18 : 21,
      colors: n < 6 ? 3 : n < 20 ? 4 : 5,
      hidden: n < 6 ? 0.15 : n < 15 ? 0.22 : 0.3, // share of screws that start under another plate
      fail: n < 6 ? [0.05, 0.3] : n < 15 ? [0.2, 0.45] : n < 30 ? [0.3, 0.6] : [0.4, 0.7],
      peak: n < 6 ? [1, 2] : n < 15 ? [1, 3] : [2, 4]
    };
    if (isMasterpiece(n)) {
      t.plates += 1;
      t.screws = Math.min(24, t.screws + 3);
      t.fail = [t.fail[0] + 0.1, Math.min(0.85, t.fail[1] + 0.1)];
    }
    return t;
  }

  // ---------- Geometry helpers ----------
  const SCREW_GAP = 48; // virtual px between screw centres (tap radius is 26)

  function extents(p) {
    if (p.type === 'circle' || p.type === 'gear') return { hx: p.radius, hy: p.radius };
    const a = p.angle || 0;
    const c = Math.abs(Math.cos(a));
    const s = Math.abs(Math.sin(a));
    return { hx: (p.width / 2) * c + (p.height / 2) * s, hy: (p.width / 2) * s + (p.height / 2) * c };
  }

  function insideBoard(p) {
    const e = extents(p);
    return p.x - e.hx >= 18 && p.x + e.hx <= BOARD.width - 18 && p.y - e.hy >= 40 && p.y + e.hy <= BOARD.height - 20;
  }

  function toWorld(p, lx, ly) {
    const a = p.angle || 0;
    return { x: p.x + lx * Math.cos(a) - ly * Math.sin(a), y: p.y + lx * Math.sin(a) + ly * Math.cos(a) };
  }

  function randomPointOnPlate(rng, p) {
    const pad = 30;
    if (p.type === 'circle' || p.type === 'gear') {
      const r = Math.sqrt(rng()) * Math.max(0, p.radius * 0.8 - pad);
      const t = rng() * Math.PI * 2;
      return toWorld(p, Math.cos(t) * r, Math.sin(t) * r);
    }
    return toWorld(p, range(rng, -(p.width / 2 - pad), p.width / 2 - pad), range(rng, -(p.height / 2 - pad), p.height / 2 - pad));
  }

  /** Tidy screw positions for a plate, like real mechanism mounting holes. */
  function plateSlots(rng, p) {
    const pts = [];
    if (p.type === 'bar') {
      const horizontal = p.width >= p.height;
      const half = (horizontal ? p.width : p.height) / 2 - 24;
      const k = Math.floor((2 * half) / 54) + 1;
      for (let i = 0; i < k; i++) {
        const t = k === 1 ? 0 : -half + (i * 2 * half) / (k - 1);
        pts.push(horizontal ? toWorld(p, t, 0) : toWorld(p, 0, t));
      }
    } else if (p.type === 'rect') {
      const hw = p.width / 2 - 26;
      const hh = p.height / 2 - 26;
      const nx = Math.floor((2 * hw) / 56) + 1;
      const ny = Math.floor((2 * hh) / 56) + 1;
      for (let i = 0; i < nx; i++) {
        for (let j = 0; j < ny; j++) {
          const lx = nx === 1 ? 0 : -hw + (i * 2 * hw) / (nx - 1);
          const ly = ny === 1 ? 0 : -hh + (j * 2 * hh) / (ny - 1);
          pts.push(toWorld(p, lx + range(rng, -5, 5), ly + range(rng, -5, 5)));
        }
      }
    } else {
      const outer = (p.type === 'gear' ? p.radius * 0.8 : p.radius) - 24;
      pts.push(toWorld(p, 0, 0));
      for (const rr of [outer * 0.55, outer]) {
        if (rr < 36) continue;
        const count = Math.floor((2 * Math.PI * rr) / 58);
        const off = rng() * Math.PI * 2;
        for (let i = 0; i < count; i++) {
          const t = off + (i / count) * Math.PI * 2;
          pts.push(toWorld(p, Math.cos(t) * rr, Math.sin(t) * rr));
        }
      }
    }
    return shuffle(rng, pts.filter(pt =>
      pt.x >= 28 && pt.x <= BOARD.width - 28 && pt.y >= 48 && pt.y <= BOARD.height - 28));
  }

  function makeBasePlate(rng) {
    const kind = pick(rng, ['rect', 'rect', 'circle', 'gear']);
    const material = pick(rng, ['walnut', 'steel', 'bronze', 'silver']);
    if (kind === 'rect') {
      return { id: 'p1', layer: 1, type: 'rect', x: 200, y: 280, width: Math.round(range(rng, 290, 340)),
        height: Math.round(range(rng, 320, 390)), radius: Math.round(range(rng, 18, 34)), angle: 0, material };
    }
    return { id: 'p1', layer: 1, type: kind, x: 200, y: 280, radius: Math.round(range(rng, 158, 172)),
      teeth: 16 + Math.floor(rng() * 6), material };
  }

  function makeUpperPlate(rng, layer, base) {
    const deg = Math.PI / 180;
    const kind = pick(rng, ['bar', 'bar', 'bar', 'rect', 'circle', 'gear']);
    const material = pick(rng, ['brass', 'steel', 'copper', 'silver', 'bronze']);
    for (let tries = 0; tries < 40; tries++) {
      const anchor = randomPointOnPlate(rng, base);
      let p;
      if (kind === 'bar') {
        p = { type: 'bar', width: Math.round(range(rng, 170, 290)), height: Math.round(range(rng, 48, 56)),
          radius: 14, angle: pick(rng, [0, 0, 90, 20, -20, 35, -35, 55, -55, 70, -70]) * deg };
      } else if (kind === 'rect') {
        p = { type: 'rect', width: Math.round(range(rng, 125, 190)), height: Math.round(range(rng, 105, 160)),
          radius: 16, angle: pick(rng, [0, 0, 12, -12, 25, -25]) * deg };
      } else {
        p = { type: kind, radius: Math.round(range(rng, 66, 94)), teeth: 9 + Math.floor(rng() * 4), angle: 0 };
      }
      Object.assign(p, { id: 'p' + layer, layer, material, x: Math.round(anchor.x), y: Math.round(anchor.y) });
      if (insideBoard(p)) return p;
    }
    return null;
  }

  /** One random layout+colouring. Returns a level (not yet judged) or null. */
  function buildCandidate(rng, tier, stats = {}) {
    const fail = r => { stats[r] = (stats[r] || 0) + 1; return null; };
    const base = makeBasePlate(rng);
    const plates = [base];
    const screws = [];
    let remaining = tier.screws;

    const freeSlots = p => {
      const free = [];
      for (const pt of plateSlots(rng, p)) {
        if (screws.concat(free).some(s => Math.hypot(s.x - pt.x, s.y - pt.y) < SCREW_GAP)) continue;
        free.push({ x: Math.round(pt.x), y: Math.round(pt.y), on: p.id });
      }
      return free;
    };

    // Build top-down so each plate's mounting holes avoid the screws of plates above it;
    // upper plates take 2-3 screws, the base plate takes whatever is left.
    for (let layer = tier.plates; layer >= 2; layer--) {
      const want = Math.min(remaining - 2 * (layer - 1), 2 + (rng() < 0.45 ? 1 : 0));
      let placed = false;
      for (let tries = 0; tries < 30 && !placed; tries++) {
        const p = makeUpperPlate(rng, layer, base);
        if (!p) continue;
        const free = freeSlots(p);
        if (free.length < want) continue;
        plates.push(p);
        screws.push(...free.slice(0, want));
        remaining -= want;
        placed = true;
      }
      if (!placed) return fail('screwFit');
    }
    const baseFree = freeSlots(base);
    if (baseFree.length < remaining) return fail('baseFit');
    screws.push(...baseFree.slice(0, remaining));
    plates.sort((a, b) => a.layer - b.layer);

    // Colours: 3 per box, boxes cycle through the active palette then get shuffled
    const palette = shuffle(rng, COLOR_ORDER.slice(0, tier.colors));
    const boxCount = screws.length / 3;
    const boxes = [];
    for (let b = 0; b < boxCount; b++) boxes.push(palette[b % palette.length]);
    shuffle(rng, boxes);
    const pool = shuffle(rng, boxes.flatMap(c => [c, c, c]));
    screws.forEach((s, i) => { s.color = pool[i]; });

    const level = { plates, screws, boxes };
    Solver.resolveLevel(level);
    const hidden = screws.filter(s => s.coveredBy.length > 0).length;
    if (hidden < Math.max(2, Math.floor(screws.length * tier.hidden))) return fail('hidden');
    return level;
  }

  function judge(level, rng, tier) {
    const model = Solver.buildModel(level);
    const peak = Solver.minPeak(model, BUFFER_SIZE - 1, 30000);
    if (peak === null || peak === Infinity) return null;
    const fail = Solver.naiveFailRate(model, 50, BUFFER_SIZE, rng);
    const peakMiss = peak < tier.peak[0] ? tier.peak[0] - peak : peak > tier.peak[1] ? peak - tier.peak[1] : 0;
    const failMiss = fail < tier.fail[0] ? tier.fail[0] - fail : fail > tier.fail[1] ? fail - tier.fail[1] : 0;
    return { peak, fail, score: peakMiss + failMiss * 5 };
  }

  // ---------- Public API ----------
  const cache = new Map();

  function jobFor(n, rng) {
    if (isMasterpiece(n)) {
      const art = ARTIFACTS[n / MASTERPIECE_EVERY - 1];
      if (art) return { customer: 'Koleksiyon Şaheseri', item: art.title, artifactId: art.id };
    }
    const year = 1860 + Math.floor(rng() * 90);
    return { customer: pick(rng, CUSTOMERS), item: `${year} ${pick(rng, ITEMS)}` };
  }

  function finalize(n, raw, metrics, job) {
    const level = {
      n,
      name: `SEVİYE ${n}`,
      job,
      masterpiece: !!job.artifactId,
      bufferSize: BUFFER_SIZE,
      plates: raw.plates,
      screws: raw.screws.map((s, i) => Object.assign({ id: 's' + (i + 1) }, s)),
      boxes: raw.boxes.map((c, i) => ({ id: 'b' + (i + 1), color: c, capacity: Solver.BOX_CAPACITY })),
      minPeak: metrics.peak,
      difficulty: metrics.fail,
      // 3 stars = never hold more than this many screws in the tray at once (and no revive)
      starTray: Math.min(BUFFER_SIZE - 1, metrics.peak + 2)
    };
    Solver.resolveLevel(level);
    return level;
  }

  function generate(n) {
    const rng = mulberry32((n * 2654435761) ^ 0x5bd1e995);
    const tier = tierFor(n);
    let best = null;
    for (let attempt = 0; attempt < 120; attempt++) {
      const cand = buildCandidate(rng, tier);
      if (!cand) continue;
      const m = judge(cand, rng, tier);
      if (!m) continue;
      if (!best || m.score < best.m.score) best = { cand, m };
      if (m.score === 0) break;
    }
    if (!best) throw new Error('Level generation failed for ' + n);
    return finalize(n, best.cand, best.m, jobFor(n, rng));
  }

  function getLevel(n) {
    if (!cache.has(n)) {
      if (HANDMADE[n]) {
        const raw = JSON.parse(JSON.stringify(HANDMADE[n]));
        const level = { plates: raw.plates, screws: raw.screws, boxes: raw.boxes };
        Solver.resolveLevel(level);
        const model = Solver.buildModel(level);
        const peak = Solver.minPeak(model, BUFFER_SIZE - 1, 200000);
        const fail = Solver.naiveFailRate(model, 50, BUFFER_SIZE, mulberry32(n));
        cache.set(n, finalize(n, level, { peak, fail }, raw.job));
      } else {
        cache.set(n, generate(n));
      }
    }
    // Fresh copy: the game mutates screws/boxes while playing
    return JSON.parse(JSON.stringify(cache.get(n)));
  }

  const Levels = {
    BOARD, BUFFER_SIZE, SCREW_TYPES, COLOR_ORDER, MATERIALS, ARTIFACTS, MASTERPIECE_EVERY,
    getLevel, isMasterpiece, tierFor, mulberry32,
    _internal: { buildCandidate, judge } // for tools/check-levels.js diagnostics
  };

  if (typeof module === 'object' && module.exports) module.exports = Levels;
  else root.Levels = Levels;
})(typeof window !== 'undefined' ? window : this);
