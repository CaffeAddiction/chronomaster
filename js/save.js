/**
 * ChronoMaster Save Store
 * One versioned JSON blob in localStorage. Every access is guarded: private mode,
 * cleared site data or a full quota must never crash the game.
 */
class SaveStore {
  constructor() {
    this.key = 'chronomaster_save_v2';
    this.data = this.load();
  }

  defaults() {
    return {
      v: 2,
      createdAt: Date.now(),
      gears: 150,
      stars: 0,            // spendable on workshop restorations
      starsEarned: 0,      // lifetime
      level: 1,            // next level to play
      levelStars: {},      // level number -> best stars
      boosters: { magnet: 2, slot: 1, loupe: 2 },
      tasksDone: [],
      artifacts: [],
      vitrinClaimAt: 0,
      daily: { last: null, streak: 0 },
      ads: { day: null, counts: {} },
      giftAt: 0,
      settings: { sound: true, ambience: false, haptics: true },
      flags: {},
      stats: { wins: 0, screws: 0, boxes: 0 }
    };
  }

  load() {
    let parsed = null;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) parsed = JSON.parse(raw);
    } catch (e) { parsed = null; }

    const base = this.defaults();
    if (!parsed || typeof parsed !== 'object') return this.migrateV1(base);

    // Shallow-merge nested objects so new fields appear for old saves
    for (const k of Object.keys(base)) {
      if (parsed[k] === undefined) continue;
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        base[k] = Object.assign(base[k], parsed[k]);
      } else {
        base[k] = parsed[k];
      }
    }
    return base;
  }

  /** Carries progress over from the first prototype's separate keys. */
  migrateV1(base) {
    const get = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const gears = parseInt(get('chronomaster_gears'), 10);
    const unlocked = parseInt(get('chronomaster_unlocked'), 10);
    if (Number.isFinite(gears)) base.gears = gears;
    if (Number.isFinite(unlocked) && unlocked > 1) base.level = unlocked;
    return base;
  }

  save() {
    try {
      localStorage.setItem(this.key, JSON.stringify(this.data));
    } catch (e) { /* storage unavailable: keep playing in memory */ }
  }

  reset() {
    this.data = this.defaults();
    this.save();
  }

  static today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  static dayDiff(a, b) {
    if (!a || !b) return Infinity;
    const [ya, ma, da] = a.split('-').map(Number);
    const [yb, mb, db] = b.split('-').map(Number);
    return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
  }
}

window.SaveStore = SaveStore;
