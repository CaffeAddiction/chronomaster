/**
 * ChronoMaster Audio Engine (Web Audio API)
 * Procedural ASMR sound synthesis for antique clockwork, ratchets, screws, and brass collisions.
 * 100% self-contained, zero external asset dependencies!
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.muted = false;
    this.hapticsOn = true;
    this.paused = false;
    this.ducked = false;
    this.initAudioContext();
  }

  initAudioContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.9;
      this.out.connect(this.ctx.destination);
    }
  }

  resume() {
    if (this.paused || this.ducked) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /** App went to background / came back. */
  setPaused(paused) {
    this.paused = paused;
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else if (!this.ducked) this.ctx.resume();
  }

  /** Silence everything while a full-screen ad plays. */
  duck(on) {
    this.ducked = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else if (!this.paused) this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (muted) this.stopClockworkAmbience();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  vibrate(pattern = [15, 30, 15]) {
    if (!this.hapticsOn) return;
    const total = (Array.isArray(pattern) ? pattern : [pattern]).reduce((a, b) => a + b, 0);
    const haptics = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (haptics) {
      haptics.impact({ style: total > 150 ? 'HEAVY' : total > 50 ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      return;
    }
    if (navigator.vibrate) {
      try {
        // Keep web vibration short; long buzzes feel cheap
        navigator.vibrate((Array.isArray(pattern) ? pattern : [pattern]).map(v => Math.min(v, 40)));
      } catch (e) {}
    }
  }

  /** Small helper for one-shot tones used by the newer effects. */
  tone(freq, start, dur, { type = 'sine', vol = 0.25, toFreq = null } = {}) {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (toFreq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  ready() {
    if (this.muted || this.paused) return false;
    this.resume();
    return !!this.ctx;
  }

  // Gear coin landing in the counter (pitch rises with the streak)
  playCoin(i = 0) {
    if (!this.ready()) return;
    const f = 1320 * Math.pow(1.06, Math.min(i, 12));
    this.tone(f, 0, 0.09, { vol: 0.12 });
    this.tone(f * 1.5, 0.04, 0.12, { vol: 0.08 });
  }

  // Master's speech bubble blips
  playBlip() {
    if (!this.ready()) return;
    this.tone(880, 0, 0.05, { type: 'triangle', vol: 0.08, toFreq: 660 });
  }

  // Rusty screw loosening: gritty creak
  playRust() {
    if (!this.ready()) return;
    this.vibrate([25]);
    for (let i = 0; i < 4; i++) this.tone(180 + i * 35, i * 0.045, 0.05, { type: 'sawtooth', vol: 0.12, toFreq: 90 });
  }

  // Tapping a covered plate: dull wood/metal knock
  playThud() {
    if (!this.ready()) return;
    this.vibrate([12]);
    this.tone(160, 0, 0.09, { type: 'triangle', vol: 0.25, toFreq: 70 });
  }

  // Tray one slot from full
  playWarning() {
    if (!this.ready()) return;
    this.tone(520, 0, 0.12, { type: 'square', vol: 0.06 });
    this.tone(440, 0.14, 0.14, { type: 'square', vol: 0.06 });
  }

  // Star flying into the counter
  playStarCollect(i = 0) {
    if (!this.ready()) return;
    this.tone(1046.5 * Math.pow(1.122, i), 0, 0.25, { vol: 0.18 });
  }

  // Hammer taps during a workshop restoration
  playHammer(i = 0) {
    if (!this.ready()) return;
    this.vibrate([20]);
    this.tone(300 - i * 20, 0, 0.08, { type: 'square', vol: 0.18, toFreq: 80 });
    this.tone(2200, 0, 0.05, { vol: 0.06 });
  }

  // Big moments: chapter done, rank up
  playFanfare() {
    if (!this.ready()) return;
    this.vibrate([40, 40, 80]);
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => {
      this.tone(f, i * 0.11, 0.5, { vol: 0.22 });
    });
  }

  // ASMR Screwdriver Ratchet (Quick multi-click mechanical turn)
  playScrewdriverSound() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([10, 20, 10, 20, 15]);

    const now = this.ctx.currentTime;
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      const clickTime = now + i * 0.04;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400 + i * 180, clickTime);
      osc.frequency.exponentialRampToValueAtTime(300, clickTime + 0.025);

      gain.gain.setValueAtTime(0.2, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.025);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(clickTime);
      osc.stop(clickTime + 0.03);
    }
  }

  // Screw Unpinned / Popped Out (High metallic ping)
  playScrewPop() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1850, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.09);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  // Screw Landing in Box or Buffer (Solid brass clink/thud)
  playScrewLand() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([15]);

    const now = this.ctx.currentTime;
    
    // Low thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(now);
    osc.stop(now + 0.09);

    // High metallic ping resonance
    const ringOsc = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ringOsc.type = 'sine';
    ringOsc.frequency.setValueAtTime(1600, now);
    ringGain.gain.setValueAtTime(0.15, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    ringOsc.connect(ringGain);
    ringGain.connect(this.out);
    ringOsc.start(now);
    ringOsc.stop(now + 0.22);
  }

  // Box (Tray) 3/3 Full & Shuts (Mechanical latch + chime)
  playBoxComplete() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([30, 40, 60]);

    const now = this.ctx.currentTime;
    // Chime notes: E5 (659.25Hz) -> G#5 (830.6Hz) -> B5 (987.77Hz)
    const notes = [659.25, 830.6, 987.77];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + idx * 0.08;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });

    // Mechanical latch snap
    const latchOsc = this.ctx.createOscillator();
    const latchGain = this.ctx.createGain();
    latchOsc.type = 'square';
    latchOsc.frequency.setValueAtTime(320, now + 0.24);
    latchOsc.frequency.exponentialRampToValueAtTime(70, now + 0.32);
    latchGain.gain.setValueAtTime(0.2, now + 0.24);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    latchOsc.connect(latchGain);
    latchGain.connect(this.out);
    latchOsc.start(now + 0.24);
    latchOsc.stop(now + 0.33);
  }

  // Plate Detaches & Falls off (Deep heavy brass clatter)
  playPlateFall() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([40, 60]);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.28);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Level Complete / Victory Fanfare (Antique music box arpeggio)
  playVictory() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([40, 40, 60, 40, 100]);

    const now = this.ctx.currentTime;
    // Music box vintage chime arpeggio: C5, E5, G5, C6, G5, C6
    const melody = [
      { f: 523.25, t: 0.00 },
      { f: 659.25, t: 0.12 },
      { f: 783.99, t: 0.24 },
      { f: 1046.50, t: 0.36 },
      { f: 1318.51, t: 0.52 },
      { f: 1567.98, t: 0.70 }
    ];

    melody.forEach(n => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const startTime = now + n.t;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.6);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(startTime);
      osc.stop(startTime + 0.65);
    });
  }

  // Game Over / Jammed Sound
  playGameOver() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([100, 50, 100]);

    const now = this.ctx.currentTime;
    const chords = [350, 310, 260];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const time = now + idx * 0.15;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.3, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(time);
      osc.stop(time + 0.35);
    });
  }

  // Booster Activation
  playBooster() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Blocked / Covered Screw Error Clink
  playBlockedSound() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([25, 20, 25]);

    const now = this.ctx.currentTime;
    [0, 0.08].forEach(dt => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, now + dt);
      osc.frequency.exponentialRampToValueAtTime(80, now + dt + 0.04);
      gain.gain.setValueAtTime(0.18, now + dt);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.05);
      osc.connect(gain);
      gain.connect(this.out);
      osc.start(now + dt);
      osc.stop(now + dt + 0.06);
    });
  }

  // Flying Screw Swoosh
  playScrewSwoosh() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.3);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Museum Artifact Unlocked Fanfare
  playMuseumFanfare() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([40, 50, 40, 50, 120]);

    const now = this.ctx.currentTime;
    const chordNotes = [392.00, 523.25, 659.25, 783.99, 1046.50]; // G4, C5, E5, G5, C6
    chordNotes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = now + idx * 0.1;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.35, st);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.8);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(st);
      osc.stop(st + 0.85);
    });
  }

  // Subtle Antique Mechanical Clock Ticking Loop
  toggleAmbience() {
    this.ambienceActive = !this.ambienceActive;
    if (this.ambienceActive) {
      this.startClockworkAmbience();
    } else {
      this.stopClockworkAmbience();
    }
    return this.ambienceActive;
  }

  startClockworkAmbience() {
    this.ambienceActive = true;
    if (this.ambienceInterval) clearInterval(this.ambienceInterval);
    
    let isTick = true;
    this.ambienceInterval = setInterval(() => {
      if (this.muted || !this.ambienceActive || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      // Tick is slightly higher pitch than Tock
      const freq = isTick ? 1150 : 880;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.015);

      gain.gain.setValueAtTime(0.045, now); // Gentle background volume
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(now);
      osc.stop(now + 0.025);

      isTick = !isTick;
    }, 600); // 100 BPM clock ticking rhythm
  }

  stopClockworkAmbience() {
    this.ambienceActive = false;
    if (this.ambienceInterval) {
      clearInterval(this.ambienceInterval);
      this.ambienceInterval = null;
    }
  }

  // Metallic Chain Rattle (When clicking a locked/dependent layer)
  playChainRattle() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([40, 25, 50]);

    const now = this.ctx.currentTime;
    const links = [0, 0.04, 0.09];
    links.forEach((dt, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450 - i * 80, now + dt);
      osc.frequency.exponentialRampToValueAtTime(120, now + dt + 0.06);

      gain.gain.setValueAtTime(0.22, now + dt);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dt + 0.07);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(now + dt);
      osc.stop(now + dt + 0.08);
    });
  }

  // Dopamine Combo Chime (Ascends with multiplier!)
  playCombo(multiplier = 2) {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([15, 20, 25]);

    const now = this.ctx.currentTime;
    const baseFreq = 523.25 * Math.pow(1.05946, Math.min(8, (multiplier - 2) * 2));
    const count = Math.min(4, multiplier);

    for (let i = 0; i < count; i++) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = now + i * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * (1 + i * 0.25), st);

      gain.gain.setValueAtTime(0.28, st);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.3);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(st);
      osc.stop(st + 0.35);
    }
  }

  // Plate Disassembly / Release Pop
  playPlateRelease() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([20, 40]);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Star Stamp on Victory Screen
  playStarStamp(idx = 0) {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([25]);

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33 + idx * 130, now); // D5, E5, F#5
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.2);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.out);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  // Interactive Chest Open & Gold Reward Shimmer
  playChestOpen() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([50, 40, 80]);

    const now = this.ctx.currentTime;
    // Latch click
    const latchOsc = this.ctx.createOscillator();
    const latchGain = this.ctx.createGain();
    latchOsc.type = 'square';
    latchOsc.frequency.setValueAtTime(240, now);
    latchOsc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
    latchGain.gain.setValueAtTime(0.3, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    latchOsc.connect(latchGain);
    latchGain.connect(this.out);
    latchOsc.start(now);
    latchOsc.stop(now + 0.09);

    // Gold cascade chime
    const notes = [659.25, 783.99, 1046.50, 1318.51, 1567.98];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = now + 0.08 + idx * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.5);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(st);
      osc.stop(st + 0.55);
    });
  }

  // Kinetic Gear Train Ratcheting (When gears engage & spin)
  playGearRatchet() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([15, 10, 15, 10, 20]);

    const now = this.ctx.currentTime;
    const teeth = 8;
    for (let i = 0; i < teeth; i++) {
      const clickTime = now + i * 0.035;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800 + (i % 2) * 200, clickTime);
      osc.frequency.exponentialRampToValueAtTime(150, clickTime + 0.02);

      gain.gain.setValueAtTime(0.25, clickTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.022);

      osc.connect(gain);
      gain.connect(this.out);

      osc.start(clickTime);
      osc.stop(clickTime + 0.025);
    }
  }

  // Workshop Renovation Upgrade Sound (Anvil hammer strike + golden bell)
  playWorkshopUpgrade() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    this.vibrate([40, 60, 80]);

    const now = this.ctx.currentTime;
    // Anvil strike
    const anvilOsc = this.ctx.createOscillator();
    const anvilGain = this.ctx.createGain();
    anvilOsc.type = 'sawtooth';
    anvilOsc.frequency.setValueAtTime(420, now);
    anvilOsc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
    anvilGain.gain.setValueAtTime(0.4, now);
    anvilGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    anvilOsc.connect(anvilGain);
    anvilGain.connect(this.out);
    anvilOsc.start(now);
    anvilOsc.stop(now + 0.2);

    // Triumphant chime chord (D5, F#5, A5, D6)
    const chord = [587.33, 739.99, 880.00, 1174.66];
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const st = now + 0.05 + idx * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, st);
      gain.gain.setValueAtTime(0.3, st);
      gain.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
      osc.connect(gain);
      gain.connect(this.out);
      osc.start(st);
      osc.stop(st + 0.75);
    });
  }
}

// Global instance
window.soundEngine = new SoundEngine();

// Auto-resume AudioContext on first user interaction anywhere
window.addEventListener('pointerdown', () => {
  if (window.soundEngine) {
    window.soundEngine.resume();
  }
}, { once: true });
