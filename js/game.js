/**
 * ChronoMaster Game Controller
 * Screens (workshop home / level), level play on Matter.js, rewards, rewarded-ad placements,
 * daily return loops and the apprentice story.
 */
const HIT_RADIUS = 28;
const SPIN_MS = 220;
const FLY_MS = 380;
const MAX_TRAY = 7;
const PRICES = { magnet: 150, slot: 120, loupe: 100, undo: 60, revive: 120 };
const BOOSTER_INFO = {
  magnet: { icon: '🧲', title: 'Mıknatıs', desc: 'Kutunun rengindeki bir vidayı, üstü kapalı olsa bile çekip kutuya koyar.' },
  slot: { icon: '➕', title: 'Ekstra Yuva', desc: 'Bu seviye boyunca yedek tepsiye bir yuva ekler.' },
  loupe: { icon: '🔍', title: 'Büyüteç', desc: 'Parçaların altında saklanan vidaları 6 saniye boyunca gösterir.' },
  undo: { icon: '↩️', title: 'Geri Al', desc: 'Son hamleni geri alır (kutu kapanana kadar).' }
};
const DAILY_REWARDS = [
  { gears: 80 },
  { boosters: { magnet: 1 } },
  { gears: 150 },
  { boosters: { loupe: 1, slot: 1 } },
  { gears: 250 },
  { boosters: { magnet: 2 } },
  { gears: 400, stars: 1, boosters: { slot: 1, loupe: 1 } }
];
const COMBO_WORDS = [[12, 'EFSANE!'], [8, 'USTACA!'], [5, 'HARİKA!'], [3, 'GÜZEL!']];
const GIFT_COOLDOWN_H = 4;
const VITRIN_CAP_H = 8;
const PRIVACY_URL = 'https://example.com/chronomaster/gizlilik'; // TODO: kendi gizlilik politikası adresin
const APP_VERSION = '1.0.0';

class ChronoMasterGame {
  constructor() {
    this.store = new SaveStore();
    this.sound = window.soundEngine;
    this.applySettings();
    this.ads = new AdService(this.store);
    this.fx = window.fx = new FX();
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(this.canvas);
    this.workshop = new Workshop(this);

    this.engine = Matter.Engine.create({ enableSleeping: false, positionIterations: 8, velocityIterations: 8 });
    this.engine.gravity.y = 1.15;

    this.screen = 'home';
    this.lv = null;          // live level session
    this.clock = 0;          // game time (ms), frozen while paused/backgrounded
    this.timers = [];
    this.modalStack = [];
    this.physicsAcc = 0;

    this.bindDOM();
    this.workshop.mount(document.getElementById('ws-scene'));
    this.updateHomeUI();
    this.startLoop();
    this.setupLifecycle();

    if (!this.save.flags.intro) {
      this.openModal('modal-intro');
    } else {
      this.afterReal(600, () => this.greet());
    }
  }

  get save() { return this.store.data; }

  applySettings() {
    const s = this.save.settings;
    this.sound.setMuted(!s.sound);
    this.sound.hapticsOn = !!s.haptics;
    if (s.ambience && s.sound) this.sound.startClockworkAmbience();
  }

  // ==========================================================
  // TIMING: game-time timers pause with the game, real timers don't
  // ==========================================================
  after(ms, fn) {
    this.timers.push({ at: this.clock + ms, fn });
  }

  afterReal(ms, fn) {
    setTimeout(fn, ms);
  }

  runTimers() {
    if (!this.timers.length) return;
    const due = this.timers.filter(t => t.at <= this.clock);
    if (!due.length) return;
    this.timers = this.timers.filter(t => t.at > this.clock);
    due.forEach(t => t.fn());
  }

  // ==========================================================
  // DOM BINDINGS
  // ==========================================================
  $(id) { return document.getElementById(id); }

  on(id, fn) {
    const el = this.$(id);
    if (el) el.addEventListener('click', e => { this.sound.resume(); fn(e); });
  }

  bindDOM() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
      if (this.lv) this.renderer.getBoard(this.lv.level);
    });

    // Home
    this.on('btn-play', () => this.startLevel(this.save.level));
    this.on('btn-task', () => {
      const t = this.workshop.nextTask();
      if (t) this.onWorkshopTask(t.id);
    });
    this.on('home-rank', () => this.workshop.say(this.workshop.randomTip(), 4000));
    this.on('master', () => this.workshop.say(this.workshop.randomTip(), 4000));
    this.on('btn-settings', () => this.openSettings());
    this.on('btn-daily', () => this.openDaily());
    this.on('btn-gift', () => this.claimGift());
    this.on('btn-vitrin', () => this.openVitrin());
    this.on('btn-guide', () => this.openModal('modal-guide'));
    this.on('btn-intro-start', () => {
      this.closeModal('modal-intro');
      this.save.flags.intro = true;
      this.store.save();
      this.afterReal(500, () => this.workshop.say('Önce bir iş bitir ve yıldız kazan. İlk yıldızla şu örümcek ağlarını temizleriz!', 5200));
    });

    // Level HUD
    this.on('btn-pause', () => this.openPause());
    this.on('btn-magnet', () => this.useBooster('magnet'));
    this.on('btn-slot', () => this.useBooster('slot'));
    this.on('btn-loupe', () => this.useBooster('loupe'));
    this.on('btn-undo', () => this.useBooster('undo'));
    this.on('level-intro', () => this.$('level-intro').classList.add('hidden'));

    // Pause
    this.on('btn-resume', () => this.closeModal('modal-pause'));
    this.on('btn-pause-restart', () => { this.closeModal('modal-pause'); this.startLevel(this.lv.n); });
    this.on('btn-pause-home', () => { this.closeModal('modal-pause'); this.goHome(); });
    this.on('btn-pause-guide', () => this.openModal('modal-guide'));
    this.on('btn-pause-sound', () => this.toggleSetting('sound'));

    // Victory
    this.on('btn-chest', () => this.openChest());
    this.on('btn-chest-double', () => this.doubleChest());
    this.on('btn-victory-next', () => { this.closeModal('modal-victory'); this.startLevel(this.save.level); });
    this.on('btn-victory-home', () => { this.closeModal('modal-victory'); this.goHome(); });
    this.on('btn-victory-task', () => {
      this.closeModal('modal-victory');
      this.goHome();
      const t = this.workshop.nextTask();
      if (t) this.afterReal(500, () => this.onWorkshopTask(t.id));
    });

    // Stuck
    this.on('btn-stuck-ad', () => this.reviveWithAd());
    this.on('btn-stuck-gears', () => this.reviveWithGears());
    this.on('btn-stuck-retry', () => { this.closeModal('modal-stuck'); this.startLevel(this.lv.n); });
    this.on('btn-stuck-home', () => { this.closeModal('modal-stuck'); this.goHome(); });

    // Booster offer
    this.on('btn-offer-ad', () => this.buyOffer('ad'));
    this.on('btn-offer-gears', () => this.buyOffer('gears'));

    // Daily / vitrin / settings / chapter
    this.on('btn-daily-claim', () => this.claimDaily(false));
    this.on('btn-daily-double', () => this.claimDaily(true));
    this.on('btn-vitrin-claim', () => this.claimVitrin(false));
    this.on('btn-vitrin-double', () => this.claimVitrin(true));
    this.on('set-sound', () => this.toggleSetting('sound'));
    this.on('set-ambience', () => this.toggleSetting('ambience'));
    this.on('set-haptics', () => this.toggleSetting('haptics'));
    this.on('set-privacy', () => window.open(PRIVACY_URL, '_blank'));
    this.on('set-adprivacy', async () => {
      const ok = await this.ads.showPrivacyOptions();
      if (!ok) this.fx.toast('Reklam tercihleri Android sürümünde açılır.');
    });
    this.on('set-reset', () => this.confirm('Tüm ilerleme silinsin mi?', 'Atölye, yıldızlar ve seviyeler sıfırlanır. Bu geri alınamaz.', () => {
      this.store.reset();
      location.reload();
    }));
    this.on('btn-chapter-ok', () => this.closeModal('modal-chapter'));
    this.on('btn-confirm-yes', () => { const fn = this._confirmFn; this.closeModal('modal-confirm'); if (fn) fn(); });
    this.on('btn-confirm-no', () => this.closeModal('modal-confirm'));

    // Generic close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal(btn.getAttribute('data-close')));
    });

    // Canvas taps
    this.canvas.addEventListener('pointerdown', e => {
      this.sound.resume();
      const r = this.canvas.getBoundingClientRect();
      this.onTap(e.clientX - r.left, e.clientY - r.top);
    });
    this.canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    document.addEventListener('contextmenu', e => e.preventDefault());
  }

  setupLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sound.setPaused(true);
        this.store.save();
      } else {
        this.sound.setPaused(false);
        this.lastFrame = performance.now();
        if (this.screen === 'home') this.updateHomeUI();
      }
    });

    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.addListener) {
      App.addListener('backButton', () => this.handleBack());
      App.addListener('pause', () => this.store.save());
    }
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.handleBack();
    });
  }

  handleBack() {
    if (this.ads.busy) return;
    const top = this.modalStack[this.modalStack.length - 1];
    if (top) {
      if (['modal-victory', 'modal-intro'].includes(top)) return;
      if (top === 'modal-stuck') { this.closeModal('modal-stuck'); this.goHome(); return; }
      this.closeModal(top);
      return;
    }
    if (this.screen === 'play') {
      this.openPause();
      return;
    }
    const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (App && App.minimizeApp) App.minimizeApp().catch(() => App.exitApp && App.exitApp());
    else if (App && App.exitApp) App.exitApp();
  }

  // ==========================================================
  // MODALS
  // ==========================================================
  openModal(id) {
    const el = this.$(id);
    if (!el) return;
    el.classList.remove('hidden');
    this.modalStack = this.modalStack.filter(m => m !== id);
    this.modalStack.push(id);
    if (this.screen === 'play' && ['modal-pause', 'modal-offer', 'modal-guide', 'modal-stuck'].includes(id)) {
      this.paused = true;
    }
  }

  closeModal(id) {
    const el = this.$(id);
    if (el) el.classList.add('hidden');
    this.modalStack = this.modalStack.filter(m => m !== id);
    const stillPausing = this.modalStack.some(m => ['modal-pause', 'modal-offer', 'modal-guide', 'modal-stuck'].includes(m));
    if (!stillPausing) this.paused = false;
  }

  confirm(title, text, fn) {
    this.$('confirm-title').textContent = title;
    this.$('confirm-text').textContent = text;
    this._confirmFn = fn;
    this.openModal('modal-confirm');
  }

  // ==========================================================
  // SCREENS
  // ==========================================================
  showScreen(name) {
    this.screen = name;
    this.$('screen-home').classList.toggle('hidden', name !== 'home');
    this.$('screen-play').classList.toggle('hidden', name !== 'play');
    document.getElementById('game-container').classList.toggle('in-level', name === 'play');
    this.$('master-bubble').classList.add('hidden');
    if (name === 'play') this.renderer.resize();
  }

  goHome() {
    this.endLevelSession();
    this.showScreen('home');
    this.workshop.refresh();
    this.updateHomeUI();
    const t = this.workshop.nextTask();
    if (t && this.workshop.canAfford(t)) {
      this.afterReal(400, () => this.workshop.say(`Yıldızların yetiyor! Hadi şu işi halledelim: ${t.title.toLowerCase()}.`, 3600));
    }
  }

  greet() {
    const t = this.workshop.nextTask();
    if (this.dailyAvailable()) {
      this.workshop.say('Günaydın evlat! Bugünün hediyesi masada seni bekliyor.', 3600);
    } else if (t && this.workshop.canAfford(t)) {
      this.workshop.say(`Hoş geldin! Yıldızların hazır, ${t.title.toLowerCase()} zamanı.`, 3600);
    } else {
      this.workshop.say('Hoş geldin! Müşteriler kapıda sıra oldu, işe koyulalım.', 3200);
    }
  }

  updateCurrencyUI() {
    const s = this.save;
    ['stars-count', 'victory-stars-total'].forEach(id => { const el = this.$(id); if (el) el.textContent = s.stars; });
    ['gears-count', 'gear-count', 'victory-gears-total', 'vitrin-gears'].forEach(id => { const el = this.$(id); if (el) el.textContent = s.gears; });
  }

  updateHomeUI() {
    const s = this.save;
    this.updateCurrencyUI();
    const rank = this.workshop.rank();
    this.$('home-rank-title').textContent = rank.title;
    this.$('home-rank-sub').textContent = rank.next ? `${rank.next} olmaya ${rank.total - rank.done} onarım` : 'Atölye tamamen yenilendi!';
    this.$('home-rank-fill').style.width = `${Math.round((rank.done / rank.total) * 100)}%`;

    const t = this.workshop.nextTask();
    const card = this.$('task-card');
    if (t) {
      const ch = t.chapter;
      const done = ch.tasks.filter(x => this.workshop.has(x.id)).length;
      card.classList.remove('hidden');
      this.$('task-chapter').textContent = `Bölüm ${ch.id}: ${ch.title}`;
      this.$('task-chapter-count').textContent = `${done}/${ch.tasks.length}`;
      this.$('task-progress-fill').style.width = `${(done / ch.tasks.length) * 100}%`;
      this.$('task-icon').textContent = t.icon;
      this.$('task-title').textContent = t.title;
      const ready = this.workshop.canAfford(t);
      this.$('task-cost').textContent = `⭐ ${Math.min(s.stars, t.cost)}/${t.cost}`;
      const btn = this.$('btn-task');
      btn.textContent = ready ? 'ONAR 🔨' : 'Yıldız kazan';
      btn.classList.toggle('ready', ready);
      card.classList.toggle('ready', ready);
    } else {
      card.classList.add('hidden');
    }

    const n = s.level;
    const master = window.Levels.isMasterpiece(n);
    this.$('play-label').textContent = `SEVİYE ${n}`;
    this.$('play-sub').textContent = master ? '★ Şaheser restorasyonu' : 'Müşteri siparişi';
    this.$('btn-play').classList.toggle('masterpiece', master);

    this.$('daily-badge').classList.toggle('hidden', !this.dailyAvailable());
    this.updateGiftUI();
    const income = this.vitrinIncome();
    const vb = this.$('vitrin-badge');
    vb.classList.toggle('hidden', income.amount < 1);
    vb.textContent = income.amount > 999 ? '999+' : `+${income.amount}`;
  }

  // ==========================================================
  // LEVEL SETUP
  // ==========================================================
  startLevel(n) {
    this.endLevelSession();
    const level = window.Levels.getLevel(n);
    const tools = this.workshop.has('tools') ? 1 : 0;
    const lv = this.lv = {
      n,
      level,
      plates: [],
      plateById: new Map(),
      screws: [],
      boxes: level.boxes.map(b => Object.assign({ reserved: 0, filled: 0, done: false }, b)),
      traySize: level.bufferSize,
      tray: new Array(level.bufferSize).fill(null),
      history: [],
      undoLeft: 3 + tools,
      revived: false,
      reviveCost: PRICES.revive,
      adRevives: 0,
      peakTray: 0,
      combo: 0,
      maxCombo: 0,
      gearsEarned: 0,
      inFlight: 0,
      ended: false,
      xrayUntil: 0,
      highlight: null,
      hint: null,
      startedAt: this.clock
    };

    Matter.Composite.clear(this.engine.world, false);
    this.timers = [];
    this.physicsAcc = 0;

    // Plates (+ mounting holes in local coordinates)
    level.plates.forEach(def => {
      const plate = Object.assign({}, def, { holes: [], cleared: false, falling: false, wobbleT: 0 });
      const opts = { frictionAir: 0.02, restitution: 0.1, density: 0.004, collisionFilter: { group: -1, mask: 0, category: 0 } };
      plate.body = (plate.type === 'circle' || plate.type === 'gear')
        ? Matter.Bodies.circle(plate.x, plate.y, plate.radius, opts)
        : Matter.Bodies.rectangle(plate.x, plate.y, plate.width, plate.height, opts);
      if (plate.angle) Matter.Body.setAngle(plate.body, plate.angle);
      Matter.Body.setStatic(plate.body, true);
      Matter.Composite.add(this.engine.world, plate.body);
      lv.plates.push(plate);
      lv.plateById.set(plate.id, plate);
    });

    // Rusty screws from level 6 on (deterministic per level)
    const rng = window.Levels.mulberry32(n * 97 + 13);
    const rustCount = n >= 6 ? Math.min(4, 1 + Math.floor((n - 6) / 5)) : 0;
    const rusty = new Set();
    while (rusty.size < Math.min(rustCount, level.screws.length)) rusty.add(Math.floor(rng() * level.screws.length));

    level.screws.forEach((def, i) => {
      const screw = Object.assign({}, def, { state: 'board', rust: rusty.has(i) ? 1 : 0, rot: rng() * Math.PI, constraints: [], anim: null });
      screw.plates.forEach(pid => {
        const plate = lv.plateById.get(pid);
        const a = plate.angle || 0;
        const dx = screw.x - plate.x;
        const dy = screw.y - plate.y;
        const lx = dx * Math.cos(-a) - dy * Math.sin(-a);
        const ly = dx * Math.sin(-a) + dy * Math.cos(-a);
        plate.holes.push({ x: lx, y: ly });
        const c = Matter.Constraint.create({
          bodyA: plate.body, pointA: { x: lx, y: ly }, pointB: { x: screw.x, y: screw.y },
          stiffness: 0.9, damping: 0.1, length: 0
        });
        Matter.Composite.add(this.engine.world, c);
        screw.constraints.push(c);
      });
      lv.screws.push(screw);
    });

    this.showScreen('play');
    this.renderer.particles = [];
    this.renderer.texts = [];
    this.renderer.rings = [];
    this.renderer.getBoard(level);
    this.$('level-name').textContent = level.masterpiece ? `ŞAHESER · ${n}` : `SEVİYE ${n}`;
    this.$('level-subtitle').textContent = `${level.job.customer} · ${level.job.item}`;
    this.$('screen-play').classList.toggle('masterpiece', level.masterpiece);
    this.$('combo-banner').classList.add('hidden');
    this.syncBoxes();
    this.syncTray();
    this.updateBoosterUI();
    this.updateCurrencyUI();
    this.showLevelIntro();
    this.levelTutorials();
  }

  endLevelSession() {
    if (!this.lv) return;
    this.lv.ended = true;
    this.lv = null;
    this.timers = [];
    this.$('boxes-track').innerHTML = '';
    this.$('fx-layer').querySelectorAll('.flying-projectile').forEach(el => el.remove());
  }

  showLevelIntro() {
    const lv = this.lv;
    const el = this.$('level-intro');
    this.$('intro-kicker').textContent = lv.level.masterpiece ? 'ŞAHESER RESTORASYONU' : `${lv.level.job.customer} getirdi`;
    this.$('intro-item').textContent = lv.level.job.item;
    this.$('intro-goal').textContent = `⭐⭐⭐ için: tepside en fazla ${lv.level.starTray} vida, devam hakkı kullanmadan`;
    el.classList.toggle('masterpiece', lv.level.masterpiece);
    el.classList.remove('hidden');
    this.after(2600, () => el.classList.add('hidden'));
  }

  levelTutorials() {
    const n = this.lv.n;
    const f = this.save.flags;
    const say = (key, text, delay = 900) => {
      if (f[key]) return;
      f[key] = true;
      this.store.save();
      this.after(delay, () => this.workshop.say(text, 4800));
    };
    if (n === 1) {
      this.lv.hint = 's1';
      say('t1', 'Üstteki kutu PİRİNÇ vida istiyor. Parlayan pirinç vidaya dokun!', 2700);
    } else if (n === 3) {
      say('t3', 'Tek vidası kalan parça sallanır ve altındaki vidaları artık engellemez.', 2700);
    } else if (n === 4) {
      say('t4', 'Zorlanırsan alttaki aletler senin: Mıknatıs, +1 Yuva, Büyüteç ve Geri Al.', 2700);
    }
    if (this.lv.screws.some(s => s.rust)) say('trust', 'Paslı vidalar var! Önce bir kez dokunup pasını çöz, sonra sök.', 2900);
  }

  // ==========================================================
  // RULES
  // ==========================================================
  pinCount(plate) {
    let n = 0;
    for (const s of this.lv.screws) if (s.state === 'board' && s.plates.includes(plate.id)) n++;
    return n;
  }

  /** The static plate covering this screw, or null when it can be unscrewed. */
  blockerOf(screw) {
    for (const pid of screw.coveredBy) {
      const p = this.lv.plateById.get(pid);
      if (p && !p.cleared && p.body.isStatic) return p;
    }
    return null;
  }

  activeBox() {
    return this.lv.boxes.find(b => b.reserved < b.capacity) || null;
  }

  trayCount() {
    return this.lv.tray.filter(Boolean).length;
  }

  /** Static ≥2 screws, swinging with 1, falling with 0. */
  updatePlates(silent = false) {
    for (const plate of this.lv.plates) {
      if (plate.cleared) continue;
      const pins = this.pinCount(plate);
      const body = plate.body;
      if (pins >= 2) {
        if (!body.isStatic) Matter.Body.setStatic(body, true);
      } else if (pins === 1) {
        if (body.isStatic) {
          Matter.Body.setStatic(body, false);
          if (!silent) Matter.Body.setAngularVelocity(body, (Math.random() > 0.5 ? 1 : -1) * 0.035);
        }
      } else if (!plate.falling) {
        if (body.isStatic) Matter.Body.setStatic(body, false);
        plate.falling = true;
        if (!silent) {
          Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 2, y: Math.max(body.velocity.y, 2.5) });
          Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.08);
          this.sound.playPlateRelease();
          this.renderer.spawnSparks(body.position.x, body.position.y, '#ffd700', 18);
        }
      }
    }
  }

  // ==========================================================
  // INPUT
  // ==========================================================
  onTap(sx, sy) {
    const lv = this.lv;
    if (!lv || lv.ended || this.paused || this.screen !== 'play') return;
    this.$('level-intro').classList.add('hidden');
    const v = this.renderer.screenToVirtual(sx, sy);

    const near = lv.screws
      .filter(s => s.state === 'board')
      .map(s => ({ s, d: Math.hypot(s.x - v.x, s.y - v.y) }))
      .filter(o => o.d <= HIT_RADIUS)
      .sort((a, b) => a.d - b.d);
    const free = near.find(o => !this.blockerOf(o.s));

    if (free) {
      const screw = free.s;
      if (screw.rust) {
        this.loosenRust(screw);
      } else {
        this.removeScrew(screw);
      }
      return;
    }

    // Tapped a covered screw or just a plate: knock on the topmost static plate there
    const plate = this.topPlateAt(v.x, v.y);
    if (plate) {
      plate.wobbleT = 260;
      this.sound.playThud();
      const covered = near.find(o => this.blockerOf(o.s));
      if (covered && !window.Solver.pointInPlate(covered.s.x, covered.s.y, this.blockerOf(covered.s), 0)) {
        // Partly visible screw under an edge: say why it won't move
        lv.highlight = { id: this.blockerOf(covered.s).id, until: this.clock + 700 };
        this.renderer.spawnFloatingText(covered.s.x, covered.s.y - 18, 'Üstünde parça var!', '#ff6b7f', 14);
      }
    }
  }

  topPlateAt(x, y) {
    const hits = this.lv.plates
      .filter(p => !p.cleared && p.body.isStatic && window.Solver.pointInPlate(x, y, p, 0))
      .sort((a, b) => b.layer - a.layer);
    return hits[0] || null;
  }

  loosenRust(screw) {
    screw.rust = 0;
    screw.rot += 0.6;
    this.sound.playRust();
    this.renderer.spawnSparks(screw.x, screw.y, '#8b4a1c', 14, { speed: 0.6, gravity: 0.12 });
    this.renderer.spawnFloatingText(screw.x, screw.y - 20, 'Pas çözüldü!', '#e0a060', 13);
  }

  // ==========================================================
  // CORE MOVE
  // ==========================================================
  removeScrew(screw, { magnet = false } = {}) {
    const lv = this.lv;
    const box = this.activeBox();
    let target;
    if (box && box.color === screw.color) {
      target = { type: 'box', box, slot: box.reserved };
      box.reserved++;
    } else {
      if (magnet) return false;
      const idx = lv.tray.indexOf(null);
      if (idx === -1) {
        this.sound.playGameOver();
        this.fx.bump(this.$('tray-container'), 'danger-pulse');
        this.renderer.spawnFloatingText(screw.x, screw.y - 18, 'Tepsi dolu!', '#ff4769', 15);
        return false;
      }
      target = { type: 'tray', idx };
      lv.tray[idx] = { screw, state: 'incoming' };
    }

    // Undo snapshot (magnet moves are not undoable)
    if (!magnet) {
      lv.history.push({
        screw,
        target,
        combo: lv.combo,
        gears: 0,
        poses: lv.plates.map(p => ({
          p, x: p.body.position.x, y: p.body.position.y, angle: p.body.angle, cleared: p.cleared, falling: p.falling
        }))
      });
    } else {
      lv.history = [];
    }
    const entry = magnet ? null : lv.history[lv.history.length - 1];

    // Off the board
    screw.state = 'leaving';
    screw.anim = { t0: this.clock };
    screw.constraints.forEach(c => Matter.Composite.remove(this.engine.world, c));
    this.updatePlates();
    this.sound.playScrewdriverSound();
    this.save.stats.screws++;

    if (target.type === 'box') {
      lv.combo++;
      lv.maxCombo = Math.max(lv.maxCombo, lv.combo);
      if (lv.combo >= 3) {
        const mult = this.workshop.has('lamp') ? 2 : 1;
        const bonus = lv.combo * mult;
        this.addGears(bonus, entry);
        this.showCombo(screw);
      }
      this.syncBoxes();
    } else {
      lv.combo = 0;
      this.$('combo-banner').classList.add('hidden');
      const occ = this.trayCount();
      lv.peakTray = Math.max(lv.peakTray, occ);
      this.syncTray();
      if (occ === lv.traySize - 1) {
        this.sound.playWarning();
        this.fx.bump(this.$('tray-container'), 'warn-pulse');
      }
      if (this.lv.n === 2) {
        const f = this.save.flags;
        if (!f.t2) {
          f.t2 = true;
          this.after(500, () => this.workshop.say('Kutuya uymayan vida yedek tepsiye gider. Tepsi dolarsa sıkışırsın, dikkat!', 4800));
        }
      }
    }
    if (lv.hint === screw.id) lv.hint = null;

    lv.inFlight++;
    this.after(SPIN_MS, () => {
      if (lv.ended) return;
      this.sound.playScrewPop();
      this.renderer.spawnSparks(screw.x, screw.y, window.Levels.SCREW_TYPES[screw.color].hex, 10);
      screw.state = 'out';
      const from = this.canvasPoint(screw.x, screw.y);
      const toEl = target.type === 'box' ? this.$(`hole-${target.box.id}-${target.slot}`) : this.$(`tray-${target.idx}`);
      this.flyScrew(screw.color, from, toEl, () => this.land(screw, target));
    });

    // First time a hidden screw comes out from under a plate
    if (!this.save.flags.t1b) {
      const revealed = lv.screws.find(s => s.state === 'board' && s.coveredBy.length && !this.blockerOf(s));
      if (revealed) {
        this.save.flags.t1b = true;
        lv.hint = revealed.id;
        this.after(700, () => this.workshop.say('Gördün mü? Parçanın altında saklı bir vida vardı. Üstteki parça gevşeyince ortaya çıktı!', 4800));
      }
    }
    return true;
  }

  canvasPoint(vx, vy) {
    const p = this.renderer.virtualToScreen(vx, vy);
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + p.x, y: r.top + p.y };
  }

  /** DOM projectile with an arc; landing is driven by game time so pauses can't desync it. */
  flyScrew(color, from, toEl, onLand) {
    const lv = this.lv;
    const layer = this.$('fx-layer');
    const proj = document.createElement('div');
    proj.className = `flying-projectile ${window.Levels.SCREW_TYPES[color].colorClass}`;
    const a = this.fx.local(from);
    const b = toEl ? this.fx.local(toEl) : a;
    proj.style.left = `${a.x}px`;
    proj.style.top = `${a.y}px`;
    layer.appendChild(proj);
    this.sound.playScrewSwoosh();
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (proj.animate) {
      proj.animate([
        { transform: 'translate(-50%,-50%) scale(1.25) rotate(0deg)' },
        { transform: `translate(-50%,-50%) translate(${dx * 0.45}px,${dy * 0.45 - 50}px) scale(1.15) rotate(220deg)`, offset: 0.5 },
        { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.85) rotate(400deg)` }
      ], { duration: FLY_MS, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'forwards' });
    }
    this.after(FLY_MS, () => {
      proj.remove();
      if (lv.ended) return;
      onLand();
    });
  }

  land(screw, target) {
    const lv = this.lv;
    lv.inFlight--;
    this.sound.playScrewLand();
    if (target.type === 'box') {
      this.fillBox(target.box);
    } else {
      const slot = lv.tray[target.idx];
      if (slot && slot.screw === screw) slot.state = 'here';
      this.syncTray();
      this.autofill();
    }
    this.checkEnd();
  }

  fillBox(box) {
    box.filled++;
    this.syncBoxes();
    if (box.filled >= box.capacity) this.completeBox(box);
  }

  completeBox(box) {
    const lv = this.lv;
    lv.history = []; // can't undo into a closed box
    this.sound.playBoxComplete();
    this.save.stats.boxes++;
    const el = this.$(`box-${box.id}`);
    if (el) el.classList.add('box-closing');
    this.addGears(5, null, el);
    this.after(520, () => {
      box.done = true;
      this.syncBoxes();
      this.checkEnd();
    });
    this.autofill();
  }

  /** Tray screws jump into the open box when colours match. */
  autofill() {
    const lv = this.lv;
    let box = this.activeBox();
    while (box) {
      const idx = lv.tray.findIndex(t => t && t.state === 'here' && t.screw.color === box.color);
      if (idx === -1) break;
      const slot = lv.tray[idx];
      slot.state = 'leaving';
      lv.history = [];
      const target = { type: 'box', box, slot: box.reserved };
      box.reserved++;
      lv.inFlight++;
      const from = this.$(`tray-${idx}`);
      this.syncBoxes();
      const fromPt = from ? from.getBoundingClientRect() : null;
      this.flyScrew(slot.screw.color, fromPt ? { x: fromPt.left + fromPt.width / 2, y: fromPt.top + fromPt.height / 2 } : { x: 0, y: 0 },
        this.$(`hole-${box.id}-${target.slot}`), () => {
          lv.inFlight--;
          lv.tray[idx] = null;
          this.syncTray();
          this.sound.playScrewLand();
          this.fillBox(box);
          this.checkEnd();
        });
      this.syncTray();
      this.renderer.spawnFloatingText(200, 470, 'Tepsiden kutuya!', '#9ae6b4', 14);
      box = this.activeBox();
    }
  }

  showCombo(screw) {
    const lv = this.lv;
    const word = (COMBO_WORDS.find(([n]) => lv.combo >= n) || [0, ''])[1];
    const banner = this.$('combo-banner');
    this.$('combo-text').textContent = `${lv.combo}x KOMBO · ${word}`;
    banner.classList.remove('hidden');
    this.fx.bump(banner, 'combo-pop');
    this.sound.playCombo(lv.combo);
    clearTimeout(this._comboTimer);
    this._comboTimer = setTimeout(() => banner.classList.add('hidden'), 1800);
    this.renderer.spawnRing(screw.x, screw.y, 'rgba(255,190,60,0.9)', 46);
  }

  addGears(amount, entry = null, fromEl = null) {
    const lv = this.lv;
    this.save.gears += amount;
    if (lv) lv.gearsEarned += amount;
    if (entry) entry.gears += amount;
    const counter = this.$('hud-gears');
    if (fromEl && counter) {
      this.fx.fly({ from: fromEl, to: counter, html: '⚙️', count: Math.min(5, Math.ceil(amount / 3)), size: 18,
        onEach: i => this.sound.playCoin(i), onDone: () => { this.updateCurrencyUI(); this.fx.bump(counter); } });
    } else {
      this.updateCurrencyUI();
      if (counter) this.fx.bump(counter);
    }
  }

  // ==========================================================
  // END STATES
  // ==========================================================
  checkEnd() {
    const lv = this.lv;
    if (!lv || lv.ended) return;
    if (lv.boxes.every(b => b.filled >= b.capacity)) {
      if (lv.boxes.every(b => b.done)) this.victory();
      return;
    }
    if (lv.inFlight > 0) return;
    const box = this.activeBox();
    if (!box) return;
    if (lv.tray.indexOf(null) !== -1) return;
    const canPlace = lv.screws.some(s => s.state === 'board' && s.color === box.color && !this.blockerOf(s));
    if (!canPlace) this.outOfMoves();
  }

  outOfMoves() {
    const lv = this.lv;
    this.sound.playGameOver();
    this.renderer.triggerShake(260, 7);
    const adOk = lv.adRevives < 2 && this.ads.isAvailable('revive');
    this.$('btn-stuck-ad').disabled = !adOk;
    this.$('btn-stuck-ad').classList.toggle('hidden', lv.adRevives >= 2);
    this.$('stuck-gear-cost').textContent = lv.reviveCost;
    this.$('btn-stuck-gears').disabled = this.save.gears < lv.reviveCost || lv.traySize >= MAX_TRAY;
    this.after(450, () => this.openModal('modal-stuck'));
  }

  async reviveWithAd() {
    const ok = await this.ads.showRewarded('revive');
    if (!ok || !this.lv) return;
    this.lv.adRevives++;
    this.revive();
  }

  reviveWithGears() {
    const lv = this.lv;
    if (!lv || this.save.gears < lv.reviveCost) return;
    this.save.gears -= lv.reviveCost;
    lv.reviveCost *= 2;
    this.store.save();
    this.updateCurrencyUI();
    this.revive();
  }

  revive() {
    const lv = this.lv;
    lv.revived = true;
    this.closeModal('modal-stuck');
    this.addTraySlot();
    this.fx.toast('+1 yuva açıldı, devam!', 'good');
  }

  addTraySlot() {
    const lv = this.lv;
    if (lv.traySize >= MAX_TRAY) return false;
    lv.traySize++;
    lv.tray.push(null);
    this.syncTray();
    this.sound.playBooster();
    const el = this.$(`tray-${lv.traySize - 1}`);
    if (el) this.fx.burst(el, { count: 14, spread: 60 });
    return true;
  }

  // ==========================================================
  // BOOSTERS & UNDO
  // ==========================================================
  useBooster(kind) {
    const lv = this.lv;
    if (!lv || lv.ended || this.paused) return;
    const have = kind === 'undo' ? lv.undoLeft : this.save.boosters[kind];
    if (have <= 0) {
      this.openOffer(kind);
      return;
    }
    let used = false;
    if (kind === 'magnet') used = this.boosterMagnet();
    else if (kind === 'slot') used = this.addTraySlot();
    else if (kind === 'loupe') used = this.boosterLoupe();
    else if (kind === 'undo') used = this.undo();
    if (!used) return;
    if (kind === 'undo') lv.undoLeft--;
    else this.save.boosters[kind]--;
    this.store.save();
    this.updateBoosterUI();
  }

  boosterMagnet() {
    const lv = this.lv;
    const box = this.activeBox();
    if (!box) return false;
    const pool = lv.screws.filter(s => s.state === 'board' && s.color === box.color);
    if (!pool.length) {
      this.fx.toast('Tahtada bu kutunun renginde vida kalmadı.');
      return false;
    }
    // Prefer a screw the player can't reach yet
    const target = pool.find(s => this.blockerOf(s)) || pool[0];
    target.rust = 0;
    this.sound.playBooster();
    this.renderer.spawnFloatingText(target.x, target.y - 20, 'Mıknatıs! 🧲', '#ffd700', 15);
    this.renderer.spawnRing(target.x, target.y, 'rgba(120,200,255,0.9)', 50);
    return this.removeScrew(target, { magnet: true });
  }

  boosterLoupe() {
    const lv = this.lv;
    const hidden = lv.screws.filter(s => s.state === 'board' && this.blockerOf(s)).length;
    if (!hidden) {
      this.fx.toast('Şu an saklı vida yok, büyüteci sakla!');
      return false;
    }
    lv.xrayUntil = this.clock + 6000;
    this.sound.playBooster();
    this.fx.toast(`🔍 ${hidden} saklı vida görünüyor`, 'good', 1800);
    return true;
  }

  undo() {
    const lv = this.lv;
    if (lv.inFlight > 0) return false;
    const entry = lv.history.pop();
    if (!entry) {
      this.fx.toast('Geri alınacak hamle yok (kapanan kutu geri açılmaz).');
      return false;
    }
    const { screw, target } = entry;
    if (target.type === 'box') {
      target.box.filled--;
      target.box.reserved--;
    } else {
      lv.tray[target.idx] = null;
    }
    // Restore plates exactly as they were
    entry.poses.forEach(ps => {
      const p = ps.p;
      if (p.cleared && !ps.cleared) Matter.Composite.add(this.engine.world, p.body);
      p.cleared = ps.cleared;
      p.falling = ps.falling;
      if (!p.body.isStatic) {
        Matter.Body.setVelocity(p.body, { x: 0, y: 0 });
        Matter.Body.setAngularVelocity(p.body, 0);
      }
      Matter.Body.setPosition(p.body, { x: ps.x, y: ps.y });
      Matter.Body.setAngle(p.body, ps.angle);
    });
    screw.state = 'board';
    screw.anim = null;
    screw.constraints.forEach(c => Matter.Composite.add(this.engine.world, c));
    this.updatePlates(true);
    lv.combo = entry.combo;
    if (entry.gears) {
      this.save.gears -= entry.gears;
      lv.gearsEarned -= entry.gears;
    }
    this.sound.playBooster();
    this.renderer.spawnRing(screw.x, screw.y, 'rgba(168,204,232,0.9)', 40);
    this.syncBoxes();
    this.syncTray();
    this.updateCurrencyUI();
    return true;
  }

  updateBoosterUI() {
    const lv = this.lv;
    const set = (kind, n) => {
      const badge = this.$(`cnt-${kind}`);
      badge.textContent = n > 0 ? n : '+';
      badge.classList.toggle('empty', n <= 0);
    };
    set('magnet', this.save.boosters.magnet);
    set('slot', this.save.boosters.slot);
    set('loupe', this.save.boosters.loupe);
    set('undo', lv ? lv.undoLeft : 0);
  }

  openOffer(kind) {
    const info = BOOSTER_INFO[kind];
    this._offerKind = kind;
    this.$('offer-icon').textContent = info.icon;
    this.$('offer-title').textContent = info.title;
    this.$('offer-desc').textContent = info.desc;
    const amount = kind === 'undo' ? 2 : 1;
    this.$('offer-ad-label').textContent = `Reklam izle · +${amount}`;
    this.$('offer-gears-label').textContent = `${PRICES[kind]} ⚙️ · +${amount}`;
    this.$('btn-offer-ad').disabled = !this.ads.isAvailable(kind === 'undo' ? 'undo' : 'booster');
    this.$('btn-offer-gears').disabled = this.save.gears < PRICES[kind];
    this.openModal('modal-offer');
  }

  async buyOffer(how) {
    const kind = this._offerKind;
    const amount = kind === 'undo' ? 2 : 1;
    if (how === 'ad') {
      const ok = await this.ads.showRewarded(kind === 'undo' ? 'undo' : 'booster');
      if (!ok) return;
    } else {
      if (this.save.gears < PRICES[kind]) return;
      this.save.gears -= PRICES[kind];
    }
    if (kind === 'undo') {
      if (this.lv) this.lv.undoLeft += amount;
    } else {
      this.save.boosters[kind] += amount;
    }
    this.store.save();
    this.closeModal('modal-offer');
    this.updateBoosterUI();
    this.updateCurrencyUI();
    const btn = this.$(`btn-${kind}`);
    if (btn) {
      this.fx.burst(btn, { count: 14, spread: 60 });
      this.fx.bump(btn);
    }
    this.sound.playBooster();
  }

  // ==========================================================
  // VICTORY & REWARDS
  // ==========================================================
  victory() {
    const lv = this.lv;
    if (lv.ended) return;
    lv.ended = true;
    const s = this.save;
    const level = lv.level;
    const stars = 1 + (lv.revived ? 0 : 1) + (!lv.revived && lv.peakTray <= level.starTray ? 1 : 0);
    const prev = s.levelStars[lv.n] || 0;
    const newStars = Math.max(0, stars - prev);
    s.levelStars[lv.n] = Math.max(prev, stars);
    s.stars += newStars;
    s.starsEarned += newStars;
    s.level = Math.max(s.level, lv.n + 1);
    s.stats.wins++;

    let gears = 20 + stars * 10;
    if (this.workshop.has('bench')) gears = Math.round(gears * 1.15);
    s.gears += gears;

    let artifact = null;
    if (level.job.artifactId && !s.artifacts.includes(level.job.artifactId)) {
      artifact = window.Levels.ARTIFACTS.find(a => a.id === level.job.artifactId);
      s.artifacts.push(artifact.id);
      if (!s.vitrinClaimAt) s.vitrinClaimAt = Date.now();
    }
    this.store.save();

    this.sound.playVictory();
    for (let i = 0; i < 6; i++) {
      this.after(i * 120, () => this.renderer.spawnSparks(80 + Math.random() * 240, 140 + Math.random() * 240,
        i % 2 ? '#ffd700' : '#9cb8d4', 26, { speed: 1.4 }));
    }
    this.after(900, () => this.showVictory({ stars, newStars, gears, artifact, replay: prev > 0 && newStars === 0 }));
  }

  showVictory({ stars, newStars, gears, artifact, replay }) {
    const lv = this.lv;
    const s = this.save;
    const level = lv ? lv.level : null;
    this.$('victory-item').textContent = level.job.item;
    this.$('victory-thanks').textContent = level.masterpiece
      ? 'Şaheser yeniden hayat buldu! Koleksiyon vitrinine yerleştirildi.'
      : `${level.job.customer} çok memnun kaldı. Ellerine sağlık!`;
    this.$('victory-stars-total').textContent = s.stars - newStars;
    this.$('victory-gears-total').textContent = s.gears - gears;
    const starEls = [1, 2, 3].map(i => this.$(`vstar-${i}`));
    starEls.forEach(el => el.classList.remove('stamped'));
    this.$('victory-reward-stars').textContent = `+${newStars}`;
    this.$('victory-reward-gears').textContent = `+${gears}`;
    this.$('victory-rewards').classList.add('hidden');
    this.$('victory-best').classList.toggle('hidden', !replay);

    const banner = this.$('victory-artifact');
    banner.classList.toggle('hidden', !artifact);
    if (artifact) {
      this.$('victory-artifact-icon').textContent = artifact.icon;
      this.$('victory-artifact-title').textContent = `${artifact.title} vitrine kondu!`;
      this.$('victory-artifact-desc').textContent = `Vitrin geliri: saatte +${artifact.rate} ⚙️`;
    }

    // Chest resets
    this._chest = null;
    this.$('btn-chest').classList.remove('hidden', 'opened');
    this.$('chest-rewards').classList.add('hidden');
    this.$('btn-chest-double').classList.add('hidden');

    this.renderNextTaskProgress();
    this.openModal('modal-victory');

    // Star stamps → rewards fly into the totals
    for (let i = 0; i < stars; i++) {
      this.afterReal(350 + i * 380, () => {
        starEls[i].classList.add('stamped');
        this.sound.playStarStamp(i);
        this.fx.burst(starEls[i], { count: 10, spread: 50 });
      });
    }
    this.afterReal(450 + stars * 380, () => {
      this.$('victory-rewards').classList.remove('hidden');
      if (newStars > 0) {
        this.fx.fly({ from: this.$('victory-reward-stars'), to: this.$('victory-stars-pill'), html: '⭐', count: newStars, size: 24, stagger: 160,
          onEach: i => { this.sound.playStarCollect(i); this.$('victory-stars-total').textContent = s.stars - newStars + i + 1; this.fx.bump(this.$('victory-stars-pill')); },
          onDone: () => this.renderNextTaskProgress(true) });
      }
      this.fx.fly({ from: this.$('victory-reward-gears'), to: this.$('victory-gears-pill'), html: '⚙️', count: 7, size: 20, stagger: 60,
        onEach: i => this.sound.playCoin(i),
        onDone: () => { this.fx.countUp(this.$('victory-gears-total'), s.gears - gears, s.gears, 500); this.fx.bump(this.$('victory-gears-pill')); } });
    });
  }

  renderNextTaskProgress(animate = false) {
    const t = this.workshop.nextTask();
    const card = this.$('victory-next');
    const btnTask = this.$('btn-victory-task');
    const btnNext = this.$('btn-victory-next');
    if (!t) {
      card.classList.add('hidden');
      btnTask.classList.add('hidden');
      btnNext.classList.remove('secondary-look');
      return;
    }
    const have = this.save.stars;
    const ready = have >= t.cost;
    card.classList.remove('hidden');
    card.classList.toggle('ready', ready);
    this.$('victory-next-icon').textContent = t.icon;
    this.$('victory-next-title').textContent = ready ? `${t.title} — hazır!` : `Sıradaki onarım: ${t.title}`;
    this.$('victory-next-count').textContent = `⭐ ${Math.min(have, t.cost)}/${t.cost}`;
    this.$('victory-next-fill').style.width = `${Math.min(100, (have / t.cost) * 100)}%`;
    btnTask.classList.toggle('hidden', !ready);
    btnNext.classList.toggle('secondary-look', ready);
    if (animate && ready) {
      this.fx.bump(card, 'ready-pop');
      this.sound.playBoxComplete();
    }
  }

  openChest() {
    if (this._chest) return;
    const cabinet = this.workshop.has('cabinet');
    let gears = 40 + Math.floor(Math.random() * 50);
    if (cabinet) gears = Math.round(gears * 1.5);
    const boosterRoll = Math.random() < (cabinet ? 0.9 : 0.45);
    const kinds = ['magnet', 'slot', 'loupe'];
    const booster = boosterRoll ? kinds[Math.floor(Math.random() * kinds.length)] : null;
    this._chest = { gears, booster, doubled: false };
    this.save.gears += gears;
    if (booster) this.save.boosters[booster]++;
    this.store.save();

    this.sound.playChestOpen();
    const chestBtn = this.$('btn-chest');
    chestBtn.classList.add('opened');
    this.fx.burst(chestBtn, { count: 30, spread: 130 });
    this.afterReal(350, () => {
      chestBtn.classList.add('hidden');
      this.$('chest-gears').textContent = `+${gears}`;
      const bp = this.$('chest-booster');
      bp.classList.toggle('hidden', !booster);
      if (booster) bp.innerHTML = `<span>${BOOSTER_INFO[booster].icon}</span> +1 ${BOOSTER_INFO[booster].title}`;
      this.$('chest-rewards').classList.remove('hidden');
      this.fx.fly({ from: this.$('chest-gears'), to: this.$('victory-gears-pill'), html: '⚙️', count: 6, size: 20,
        onEach: i => this.sound.playCoin(i),
        onDone: () => this.fx.countUp(this.$('victory-gears-total'), this.save.gears - gears, this.save.gears, 400) });
      const dbl = this.$('btn-chest-double');
      dbl.classList.toggle('hidden', !this.ads.isAvailable('double'));
      dbl.disabled = false;
    });
  }

  async doubleChest() {
    const c = this._chest;
    if (!c || c.doubled) return;
    const ok = await this.ads.showRewarded('double');
    if (!ok) return;
    c.doubled = true;
    this.save.gears += c.gears;
    if (c.booster) this.save.boosters[c.booster]++;
    this.store.save();
    this.$('btn-chest-double').classList.add('hidden');
    this.$('chest-gears').textContent = `+${c.gears * 2}`;
    this.fx.burst(this.$('chest-rewards'), { count: 30, spread: 140 });
    this.sound.playChestOpen();
    this.fx.fly({ from: this.$('chest-gears'), to: this.$('victory-gears-pill'), html: '⚙️', count: 8, size: 20,
      onEach: i => this.sound.playCoin(i),
      onDone: () => this.fx.countUp(this.$('victory-gears-total'), this.save.gears - c.gears, this.save.gears, 400) });
  }

  // ==========================================================
  // WORKSHOP
  // ==========================================================
  async onWorkshopTask(taskId) {
    const t = this.workshop.allTasks().find(x => x.id === taskId);
    if (!t || this.workshop.busy) return;
    if (!this.workshop.canAfford(t)) {
      const missing = t.cost - this.save.stars;
      this.workshop.say(`Bunun için ${missing} yıldız daha lazım. Bir iş daha bitirelim!`, 3200);
      this.fx.bump(this.$('btn-play'), 'bump');
      return;
    }
    await this.workshop.restore(taskId);
    this.updateHomeUI();
  }

  showChapterComplete(ch) {
    const s = this.save;
    s.gears += ch.reward.gears;
    Object.entries(ch.reward.boosters || {}).forEach(([k, v]) => { s.boosters[k] += v; });
    this.store.save();
    this.$('chapter-title').textContent = `Bölüm ${ch.id} tamam: ${ch.title}`;
    this.$('chapter-rank').textContent = ch.rank.toUpperCase();
    this.$('chapter-text').textContent = ch.done;
    const items = [`<div class="reward-pill">⚙️ +${ch.reward.gears}</div>`]
      .concat(Object.entries(ch.reward.boosters || {}).map(([k, v]) => `<div class="reward-pill highlight">${BOOSTER_INFO[k].icon} +${v}</div>`));
    this.$('chapter-rewards').innerHTML = items.join('');
    const next = WORKSHOP_CHAPTERS.find(c => c.id === ch.id + 1);
    this.$('chapter-next').textContent = next ? `Sıradaki bölüm: ${next.title}` : 'Tüm atölye yenilendi! Siparişler ve şaheserler seni bekliyor.';
    this.sound.playFanfare();
    this.openModal('modal-chapter');
    this.fx.burst(this.$('chapter-rank'), { count: 40, spread: 170 });
    this.updateHomeUI();
  }

  // ==========================================================
  // DAILY REWARD
  // ==========================================================
  dailyAvailable() {
    return this.save.daily.last !== SaveStore.today();
  }

  dailyIndex() {
    const d = this.save.daily;
    const gap = SaveStore.dayDiff(d.last, SaveStore.today());
    if (gap === 1) return d.streak % DAILY_REWARDS.length;
    return 0; // first claim or streak broken
  }

  openDaily() {
    const avail = this.dailyAvailable();
    const idx = avail ? this.dailyIndex() : (this.save.daily.streak - 1) % DAILY_REWARDS.length;
    this.$('daily-grid').innerHTML = DAILY_REWARDS.map((r, i) => {
      const state = i < idx || (!avail && i === idx) ? 'claimed' : i === idx ? 'today' : '';
      return `<div class="daily-cell ${state} ${i === 6 ? 'big' : ''}">
        <span class="daily-day">${i + 1}. gün</span>
        <span class="daily-icon">${this.rewardIcon(r)}</span>
        <span class="daily-label">${this.rewardText(r)}</span>
      </div>`;
    }).join('');
    this.$('btn-daily-claim').disabled = !avail;
    this.$('btn-daily-claim').textContent = avail ? 'AL' : 'Yarın tekrar gel';
    this.$('btn-daily-double').classList.toggle('hidden', !avail || !this.ads.isAvailable('daily'));
    this.openModal('modal-daily');
  }

  rewardIcon(r) {
    if (r.stars) return '🎁';
    if (r.boosters) return Object.keys(r.boosters).map(k => BOOSTER_INFO[k].icon).join('');
    return '⚙️';
  }

  rewardText(r) {
    const parts = [];
    if (r.gears) parts.push(`${r.gears} ⚙️`);
    if (r.stars) parts.push(`${r.stars} ⭐`);
    if (r.boosters) Object.entries(r.boosters).forEach(([k, v]) => parts.push(`${v} ${BOOSTER_INFO[k].title}`));
    return parts.join(' + ');
  }

  grant(r, mult = 1) {
    const s = this.save;
    if (r.gears) s.gears += r.gears * mult;
    if (r.stars) { s.stars += r.stars * mult; s.starsEarned += r.stars * mult; }
    if (r.boosters) Object.entries(r.boosters).forEach(([k, v]) => { s.boosters[k] += v * mult; });
  }

  async claimDaily(doubled) {
    if (!this.dailyAvailable()) return;
    if (doubled) {
      const ok = await this.ads.showRewarded('daily');
      if (!ok) return;
    }
    const idx = this.dailyIndex();
    const r = DAILY_REWARDS[idx];
    this.grant(r, doubled ? 2 : 1);
    this.save.daily = { last: SaveStore.today(), streak: idx + 1 };
    this.store.save();
    this.sound.playChestOpen();
    const cell = this.$('daily-grid').children[idx];
    if (cell) this.fx.burst(cell, { count: 26, spread: 110 });
    this.fx.toast(`${doubled ? '2 kat! ' : ''}${this.rewardText(r)}${doubled ? ' ×2' : ''} alındı`, 'good');
    this.afterReal(700, () => {
      this.closeModal('modal-daily');
      this.updateHomeUI();
    });
  }

  // ==========================================================
  // MASTER'S GIFT (rewarded ad on a cooldown)
  // ==========================================================
  giftCooldownMs() {
    return (this.workshop.has('counter') ? GIFT_COOLDOWN_H / 2 : GIFT_COOLDOWN_H) * 3600 * 1000;
  }

  updateGiftUI() {
    const left = this.save.giftAt - Date.now();
    const btn = this.$('btn-gift');
    const label = this.$('gift-timer');
    if (left <= 0) {
      btn.classList.add('ready');
      label.textContent = 'HAZIR';
    } else {
      btn.classList.remove('ready');
      const mins = Math.ceil(left / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      label.textContent = h > 0 ? `${h}s ${m}dk` : `${m}dk`;
    }
  }

  async claimGift() {
    if (this.save.giftAt > Date.now()) {
      this.workshop.say('Hediyemi biraz sonra hazırlarım, sabırlı ol evlat.', 2600);
      return;
    }
    const ok = await this.ads.showRewarded('gift');
    if (!ok) return;
    const roll = Math.random();
    const r = roll < 0.5 ? { gears: 60 + Math.floor(Math.random() * 90) }
      : roll < 0.8 ? { boosters: { [['magnet', 'slot', 'loupe'][Math.floor(Math.random() * 3)]]: 1 } }
        : { gears: 50, boosters: { magnet: 1 } };
    this.grant(r);
    this.save.giftAt = Date.now() + this.giftCooldownMs();
    this.store.save();
    this.sound.playChestOpen();
    this.fx.burst(this.$('btn-gift'), { count: 24, spread: 100 });
    this.workshop.say(`Al bakalım: ${this.rewardText(r)}. Hak ettin!`, 3000);
    this.updateHomeUI();
  }

  // ==========================================================
  // VITRIN (collection + passive income)
  // ==========================================================
  vitrinRate() {
    const rate = this.save.artifacts
      .map(id => window.Levels.ARTIFACTS.find(a => a.id === id))
      .reduce((sum, a) => sum + (a ? a.rate : 0), 0);
    return this.workshop.has('grandclock') ? rate * 2 : rate;
  }

  vitrinIncome() {
    const rate = this.vitrinRate();
    if (!rate || !this.save.vitrinClaimAt) return { rate, amount: 0 };
    const hours = Math.min(VITRIN_CAP_H, Math.max(0, (Date.now() - this.save.vitrinClaimAt) / 3600000));
    return { rate, amount: Math.floor(hours * rate) };
  }

  openVitrin() {
    const owned = this.save.artifacts;
    const inc = this.vitrinIncome();
    this.$('vitrin-count').textContent = `${owned.length} / ${window.Levels.ARTIFACTS.length}`;
    this.$('vitrin-rate').textContent = `${inc.rate} ⚙️/saat`;
    this.$('vitrin-amount').textContent = `+${inc.amount} ⚙️`;
    this.$('btn-vitrin-claim').disabled = inc.amount < 1;
    this.$('btn-vitrin-double').classList.toggle('hidden', inc.amount < 1 || !this.ads.isAvailable('vitrin'));
    this.$('vitrin-gallery').innerHTML = window.Levels.ARTIFACTS.map((a, i) => {
      const has = owned.includes(a.id);
      const lvl = (i + 1) * window.Levels.MASTERPIECE_EVERY;
      return `<div class="artifact-card ${has ? 'unlocked' : 'locked'}">
        <div class="artifact-icon-wrap">${has ? a.icon : '🔒'}</div>
        <div class="artifact-info">
          <div class="artifact-title-row"><span class="artifact-name">${has ? a.title : '???'}</span>
          <span class="artifact-year">${has ? a.year : `Seviye ${lvl}`}</span></div>
          <div class="artifact-category">${a.category}</div>
          <p class="artifact-desc">${has ? a.desc : `${lvl}. seviyedeki şaheser restorasyonunu tamamla.`}</p>
          ${has ? `<div class="artifact-passive">⚙️ +${a.rate}/saat</div>` : ''}
        </div></div>`;
    }).join('');
    this.openModal('modal-vitrin');
  }

  async claimVitrin(doubled) {
    const inc = this.vitrinIncome();
    if (inc.amount < 1) return;
    if (doubled) {
      const ok = await this.ads.showRewarded('vitrin');
      if (!ok) return;
    }
    const amount = inc.amount * (doubled ? 2 : 1);
    this.save.gears += amount;
    this.save.vitrinClaimAt = Date.now();
    this.store.save();
    this.sound.playChestOpen();
    this.fx.fly({ from: this.$('vitrin-amount'), to: this.$('vitrin-gears-pill'), html: '⚙️', count: 8, size: 20,
      onEach: i => this.sound.playCoin(i),
      onDone: () => this.fx.countUp(this.$('vitrin-gears'), this.save.gears - amount, this.save.gears, 400) });
    this.$('vitrin-amount').textContent = '+0 ⚙️';
    this.$('btn-vitrin-claim').disabled = true;
    this.$('btn-vitrin-double').classList.add('hidden');
    this.updateHomeUI();
  }

  // ==========================================================
  // PAUSE & SETTINGS
  // ==========================================================
  openPause() {
    if (!this.lv || this.lv.ended) return;
    this.$('pause-sound').textContent = this.save.settings.sound ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
    this.openModal('modal-pause');
  }

  openSettings() {
    this.syncSettingsUI();
    this.$('set-version').textContent = `Sürüm ${APP_VERSION}`;
    this.$('set-adprivacy').classList.toggle('hidden', !this.ads.native);
    this.openModal('modal-settings');
  }

  syncSettingsUI() {
    const s = this.save.settings;
    [['sound', 'set-sound'], ['ambience', 'set-ambience'], ['haptics', 'set-haptics']].forEach(([k, id]) => {
      const el = this.$(id);
      if (el) el.classList.toggle('on', !!s[k]);
    });
    const ps = this.$('pause-sound');
    if (ps) ps.textContent = s.sound ? '🔊 Ses: Açık' : '🔇 Ses: Kapalı';
  }

  toggleSetting(key) {
    const s = this.save.settings;
    s[key] = !s[key];
    this.store.save();
    this.sound.setMuted(!s.sound);
    this.sound.hapticsOn = !!s.haptics;
    if (s.ambience && s.sound) this.sound.startClockworkAmbience();
    else this.sound.stopClockworkAmbience();
    if (key === 'haptics' && s.haptics) this.sound.vibrate([30]);
    this.syncSettingsUI();
  }

  // ==========================================================
  // UI SYNC: boxes & tray
  // ==========================================================
  syncBoxes() {
    const lv = this.lv;
    const track = this.$('boxes-track');
    const visible = lv.boxes.filter(b => !b.done);
    const shown = visible.slice(0, 3);
    const active = this.activeBox();
    const want = new Set(shown.map(b => `box-${b.id}`));
    [...track.children].forEach(el => { if (!want.has(el.id) && !el.classList.contains('more-pill')) el.remove(); });

    shown.forEach((box, i) => {
      let el = this.$(`box-${box.id}`);
      const info = window.Levels.SCREW_TYPES[box.color];
      if (!el) {
        el = document.createElement('div');
        el.id = `box-${box.id}`;
        el.className = 'screw-box enter';
        el.style.setProperty('--box-color', info.hex);
        el.innerHTML = `
          <div class="box-header"><span class="box-label">${info.name.toUpperCase()}</span><span class="box-counter"></span></div>
          <div class="box-slots-row">${[0, 1, 2].map(k => `<div class="box-hole" id="hole-${box.id}-${k}"></div>`).join('')}</div>`;
        track.appendChild(el);
      }
      el.style.order = String(i);
      el.classList.toggle('active', box === active || (box.filled < box.capacity && box.reserved >= box.capacity && i === 0));
      el.classList.toggle('queued', box !== active && box.reserved < box.capacity);
      el.querySelector('.box-counter').textContent = `${box.filled}/${box.capacity}`;
      for (let k = 0; k < 3; k++) {
        const hole = this.$(`hole-${box.id}-${k}`);
        const filled = k < box.filled;
        if (filled && !hole.firstChild) hole.innerHTML = `<div class="screw-icon ${info.colorClass}"></div>`;
        if (!filled && hole.firstChild) hole.innerHTML = '';
        hole.classList.toggle('filled', filled);
      }
    });

    let more = track.querySelector('.more-pill');
    const rest = visible.length - shown.length;
    if (rest > 0) {
      if (!more) {
        more = document.createElement('div');
        more.className = 'more-pill';
        track.appendChild(more);
      }
      more.style.order = '9';
      more.textContent = `+${rest}`;
    } else if (more) {
      more.remove();
    }
  }

  syncTray() {
    const lv = this.lv;
    const wrap = this.$('tray-slots');
    while (wrap.children.length < lv.traySize) {
      const i = wrap.children.length;
      const hole = document.createElement('div');
      hole.className = 'buffer-hole';
      hole.id = `tray-${i}`;
      wrap.appendChild(hole);
    }
    while (wrap.children.length > lv.traySize) wrap.lastChild.remove();
    let occupied = 0;
    lv.tray.forEach((slot, i) => {
      const hole = this.$(`tray-${i}`);
      if (slot) occupied++;
      const show = slot && slot.state !== 'incoming';
      const cls = show ? window.Levels.SCREW_TYPES[slot.screw.color].colorClass : '';
      if (show && (!hole.firstChild || !hole.firstChild.classList.contains(cls))) {
        hole.innerHTML = `<div class="screw-icon ${cls}"></div>`;
      } else if (!show && hole.firstChild) {
        hole.innerHTML = '';
      }
      hole.classList.toggle('occupied', !!slot);
      hole.classList.toggle('leaving', !!slot && slot.state === 'leaving');
    });
    this.$('tray-status').textContent = `${occupied} / ${lv.traySize}`;
    const danger = lv.traySize - occupied <= 1;
    this.$('tray-container').classList.toggle('danger', danger);
  }

  // ==========================================================
  // MAIN LOOP
  // ==========================================================
  startLoop() {
    this.lastFrame = performance.now();
    const loop = now => {
      const dt = Math.min(50, Math.max(0, now - this.lastFrame));
      this.lastFrame = now;
      this.tick(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    setInterval(() => { if (this.screen === 'home' && !document.hidden) this.updateGiftUI(); }, 30000);
  }

  /** Advances the game by dt ms. Exposed so tests can drive time without frames. */
  tick(dt) {
    if (this.paused) return;
    this.clock += dt;
    this.runTimers();
    const lv = this.lv;
    if (this.screen !== 'play' || !lv) return;

    // Fixed-step physics: identical feel on 60/90/120 Hz screens
    this.physicsAcc += dt;
    let steps = 0;
    while (this.physicsAcc >= 1000 / 60 && steps < 4) {
      Matter.Engine.update(this.engine, 1000 / 60);
      this.physicsAcc -= 1000 / 60;
      steps++;
    }
    if (steps === 4) this.physicsAcc = 0;

    for (const p of lv.plates) {
      if (p.cleared) continue;
      const y = p.body.position.y;
      if (y > 760 || !Number.isFinite(y)) {
        p.cleared = true;
        Matter.Composite.remove(this.engine.world, p.body);
        this.sound.playPlateFall();
      }
      if (p.wobbleT > 0) p.wobbleT -= dt;
    }
    this.render(dt);
  }

  render(dt) {
    const lv = this.lv;
    const r = this.renderer;
    r.beginFrame(dt);
    r.drawBoard(lv.level);

    const xray = this.clock < lv.xrayUntil;
    const highlightId = lv.highlight && this.clock < lv.highlight.until ? lv.highlight.id : null;
    const board = lv.screws.filter(s => s.state === 'board');
    const blocked = new Set(board.filter(s => this.blockerOf(s)));
    const maxLayer = lv.plates.reduce((m, p) => Math.max(m, p.layer), 1);

    // Static plates bottom-up; covered screws sit right above their own plate so higher plates hide them
    for (let L = 1; L <= maxLayer; L++) {
      for (const p of lv.plates) {
        if (p.cleared || p.layer !== L || !p.body.isStatic) continue;
        const wob = p.wobbleT > 0 ? Math.sin(p.wobbleT / 26) * 0.025 * (p.wobbleT / 260) : 0;
        r.drawPlate(p, { x: p.body.position.x, y: p.body.position.y, angle: p.body.angle },
          { highlight: p.id === highlightId ? 1 : 0, wobble: wob });
      }
      for (const s of blocked) if (s.layer === L) r.drawScrew(s, { blocked: true, rust: !!s.rust });
    }
    // Swinging / falling plates float above
    for (const p of lv.plates) {
      if (p.cleared || p.body.isStatic) continue;
      r.drawPlate(p, { x: p.body.position.x, y: p.body.position.y, angle: p.body.angle }, { alpha: p.falling ? 0.95 : 0.9 });
    }
    // Reachable screws on top
    for (const s of board) if (!blocked.has(s)) r.drawScrew(s, { rust: !!s.rust });
    for (const s of lv.screws) {
      if (s.state !== 'leaving' || !s.anim) continue;
      const t = Math.min(1, (this.clock - s.anim.t0) / SPIN_MS);
      r.drawScrew(s, { spin: -t * Math.PI * 3, lift: t });
    }
    if (xray) for (const s of blocked) r.drawScrew(s, { xray: true });
    if (lv.hint) {
      const hs = lv.screws.find(s => s.id === lv.hint && s.state === 'board');
      if (hs) r.drawHint(hs.x, hs.y, this.clock);
    }
    r.updateEffects(dt);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.chronoGame = new ChronoMasterGame();
});
