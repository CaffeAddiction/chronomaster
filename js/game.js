/**
 * ChronoMaster Game Engine & Controller
 * Integrates Matter.js 2D physics, strict layer dependency hierarchies,
 * combo streaks, ASMR audio, dopamine reward unboxing, and Royal Museum progression.
 */

class ChronoMasterGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new GameRenderer(this.canvas);
    this.currentLevelIndex = 0;
    this.gears = parseInt(localStorage.getItem('chronomaster_gears') || '250', 10);
    this.unlockedLevel = parseInt(localStorage.getItem('chronomaster_unlocked') || '1', 10);
    this.unlockedMuseum = JSON.parse(localStorage.getItem('chronomaster_museum') || '[1]');
    this.unlockedWorkshop = JSON.parse(localStorage.getItem('chronomaster_workshop') || '[]');
    this.lastMuseumClaim = parseInt(localStorage.getItem('chronomaster_last_claim') || Date.now().toString(), 10);
    
    // Game State
    this.levelData = null;
    this.boxes = [];
    this.screws = [];
    this.plates = [];
    this.plateBodies = new Map(); // plateId -> Matter.Body
    this.screwConstraints = new Map(); // screwId -> array of Matter.Constraint
    this.bufferSlots = [];
    this.maxBufferSlots = 5;
    this.historyStack = [];
    this.isAnimating = false;
    this.isGameOver = false;
    this.isVictory = false;

    // Dopamine & Combo Tracking
    this.comboStreak = 0;
    this.maxComboThisLevel = 0;
    this.maxBufferOccupiedThisLevel = 0;
    this.chestOpened = false;
    this._comboTimeout = null;

    // Boosters
    this.boosters = {
      magnet: 2,
      slot: 1,
      nudge: 3
    };

    // Physics Engine
    this.engine = null;

    this.initPhysics();
    this.bindDOM();
    this.updateMainMenuUI();
    this.loadLevel(0);
    this.startLoop();
  }

  initPhysics() {
    const { Engine, World } = Matter;
    this.engine = Engine.create({
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 8
    });
    this.engine.gravity.y = 1.2;
    this.engine.gravity.x = 0;
  }

  bindDOM() {
    window.addEventListener('resize', () => {
      this.renderer.resize();
    });

    // ------------------------------------------
    // MAIN MENU NAVIGATION
    // ------------------------------------------
    const mainMenu = document.getElementById('main-menu');
    document.getElementById('btn-menu-play').addEventListener('click', () => {
      window.soundEngine.resume();
      window.soundEngine.playBooster();
      mainMenu.classList.add('hidden');
    });

    document.getElementById('btn-home').addEventListener('click', () => {
      this.updateMainMenuUI();
      mainMenu.classList.remove('hidden');
    });

    document.getElementById('btn-menu-museum').addEventListener('click', () => {
      this.openMuseumModal();
    });

    document.getElementById('btn-close-museum').addEventListener('click', () => {
      document.getElementById('modal-museum').classList.add('hidden');
    });

    document.getElementById('btn-claim-museum').addEventListener('click', () => {
      this.claimMuseumIncome();
    });

    document.getElementById('btn-victory-museum').addEventListener('click', () => {
      document.getElementById('modal-victory').classList.add('hidden');
      this.openMuseumModal();
    });

    // Workshop Modal Buttons
    const btnMenuWorkshop = document.getElementById('btn-menu-workshop');
    if (btnMenuWorkshop) {
      btnMenuWorkshop.addEventListener('click', () => {
        this.openWorkshopModal();
      });
    }

    const btnHudWorkshop = document.getElementById('btn-hud-workshop');
    if (btnHudWorkshop) {
      btnHudWorkshop.addEventListener('click', () => {
        this.openWorkshopModal();
      });
    }

    const btnVictoryWorkshop = document.getElementById('btn-victory-workshop');
    if (btnVictoryWorkshop) {
      btnVictoryWorkshop.addEventListener('click', () => {
        document.getElementById('modal-victory').classList.add('hidden');
        this.openWorkshopModal();
      });
    }

    const btnCloseWorkshop = document.getElementById('btn-close-workshop');
    if (btnCloseWorkshop) {
      btnCloseWorkshop.addEventListener('click', () => {
        document.getElementById('modal-workshop').classList.add('hidden');
      });
    }

    document.getElementById('btn-menu-guide').addEventListener('click', () => {
      document.getElementById('modal-guide').classList.remove('hidden');
    });

    document.getElementById('btn-guide-hud').addEventListener('click', () => {
      document.getElementById('modal-guide').classList.remove('hidden');
    });

    document.getElementById('btn-close-guide').addEventListener('click', () => {
      document.getElementById('modal-guide').classList.add('hidden');
    });

    document.getElementById('btn-close-guide-action').addEventListener('click', () => {
      document.getElementById('modal-guide').classList.add('hidden');
    });

    document.getElementById('btn-menu-levels').addEventListener('click', () => {
      this.openLevelsModal();
    });

    // Sound & Ambience Toggles
    const btnSound = document.getElementById('btn-sound');
    btnSound.addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      document.getElementById('sound-icon').textContent = isMuted ? '🔇' : '🔊';
      document.getElementById('menu-sound-icon').textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-menu-sound').addEventListener('click', () => {
      const isMuted = window.soundEngine.toggleMute();
      document.getElementById('sound-icon').textContent = isMuted ? '🔇' : '🔊';
      document.getElementById('menu-sound-icon').textContent = isMuted ? '🔇' : '🔊';
    });

    document.getElementById('btn-menu-ambience').addEventListener('click', () => {
      window.soundEngine.resume();
      const isActive = window.soundEngine.toggleAmbience();
      document.getElementById('menu-ambience-icon').textContent = isActive ? '🔔' : '⏱️';
    });

    // Restart Button
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.restartLevel();
    });

    // Level Select Modal
    document.getElementById('btn-levels').addEventListener('click', () => {
      this.openLevelsModal();
    });
    document.getElementById('btn-close-levels').addEventListener('click', () => {
      document.getElementById('modal-levels').classList.add('hidden');
    });

    // Interactive Mystery Chest in Victory Modal
    const btnOpenChest = document.getElementById('btn-open-chest');
    if (btnOpenChest) {
      btnOpenChest.addEventListener('click', () => {
        this.openVictoryChest();
      });
    }

    // Victory Modal Buttons
    document.getElementById('btn-next-level').addEventListener('click', () => {
      document.getElementById('modal-victory').classList.add('hidden');
      this.loadLevel(this.currentLevelIndex + 1);
    });
    document.getElementById('btn-replay-level').addEventListener('click', () => {
      document.getElementById('modal-victory').classList.add('hidden');
      this.restartLevel();
    });

    // Game Over Modal Buttons
    document.getElementById('btn-retry-level').addEventListener('click', () => {
      document.getElementById('modal-gameover').classList.add('hidden');
      this.restartLevel();
    });
    document.getElementById('btn-extra-slot-revive').addEventListener('click', () => {
      document.getElementById('modal-gameover').classList.add('hidden');
      this.addExtraBufferSlot();
      this.isGameOver = false;
    });
    document.getElementById('btn-gameover-home').addEventListener('click', () => {
      document.getElementById('modal-gameover').classList.add('hidden');
      this.updateMainMenuUI();
      mainMenu.classList.remove('hidden');
    });

    // Boosters
    document.getElementById('btn-booster-magnet').addEventListener('click', () => this.useBoosterMagnet());
    document.getElementById('btn-booster-slot').addEventListener('click', () => this.addExtraBufferSlot(true));
    document.getElementById('btn-booster-nudge').addEventListener('click', () => this.useBoosterNudge());
    document.getElementById('btn-booster-undo').addEventListener('click', () => this.undoLastMove());

    // Canvas Pointer Events (Click / Tap)
    this.canvas.addEventListener('pointerdown', (e) => this.handleCanvasPointer(e));

    // Prevent default touch gestures (pinch/zoom) on mobile
    this.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  }

  updateMainMenuUI() {
    const totalArtifacts = window.MUSEUM_ARTIFACTS.length;
    const restoredCount = this.unlockedMuseum.length;
    const pct = Math.min(100, Math.round((restoredCount / totalArtifacts) * 100));

    const ranks = [
      'Çırak Saatçi',
      'Kalfa Mekanist',
      'Hassas Kilit Ustası',
      'Kraliyet Horoloğu',
      'Başmühendis & Saat Üstadı'
    ];
    const rankTitle = ranks[Math.min(ranks.length - 1, restoredCount - 1)] || 'Çırak Saatçi';

    document.getElementById('menu-rank').textContent = rankTitle;
    document.getElementById('menu-rank-fill').style.width = `${pct}%`;
    document.getElementById('menu-progress-text').textContent = `${restoredCount} / ${totalArtifacts} Eser Restore Edildi`;
    document.getElementById('menu-gears-count').textContent = this.gears;
    document.getElementById('gear-count').textContent = this.gears;
  }

  loadLevel(levelIndex) {
    this.currentLevelIndex = levelIndex;
    this.isGameOver = false;
    this.isVictory = false;
    this.isAnimating = false;
    this.historyStack = [];
    this.maxBufferSlots = 5;

    // Reset Dopamine Stats
    this.comboStreak = 0;
    this.maxComboThisLevel = 0;
    this.maxBufferOccupiedThisLevel = 0;
    this.chestOpened = false;

    // Hide combo banner
    const comboBanner = document.getElementById('combo-streak-banner');
    if (comboBanner) comboBanner.classList.add('hidden');

    // Reset Matter World
    Matter.World.clear(this.engine.world, false);
    this.plateBodies.clear();
    this.screwConstraints.clear();

    // Fetch Level Data
    if (levelIndex < window.LEVELS.length) {
      this.levelData = JSON.parse(JSON.stringify(window.LEVELS[levelIndex]));
    } else {
      this.levelData = window.generateProceduralLevel(levelIndex + 1);
    }

    // Set Level Info in UI
    document.getElementById('level-name').textContent = this.levelData.name;
    document.getElementById('level-subtitle').textContent = this.levelData.subtitle;
    document.getElementById('gear-count').textContent = this.gears;

    this.boxes = this.levelData.boxes;
    this.screws = this.levelData.screws;
    this.plates = this.levelData.plates;

    // Initialize Buffer Slots
    this.bufferSlots = new Array(this.maxBufferSlots).fill(null);

    // Build Matter.js physics bodies for each plate
    this.buildPhysics();

    // Render HTML UI components
    this.renderBoxesUI();
    this.renderBufferUI();
    this.updateBoosterUI();

    // Update Tutorial Banner
    const banner = document.getElementById('tutorial-banner');
    const bannerText = document.getElementById('banner-text');
    if (banner && bannerText) {
      if (this.levelData.kineticTriggers && this.levelData.kineticTriggers.length > 0) {
        banner.classList.remove('hidden');
        bannerText.textContent = "⚙️ ÇARK MEKANİZMASI: Üst parçayı düşürdüğünüzde gizli dişliler dönerek vidaları kaydırır!";
      } else if (levelIndex === 0) {
        banner.classList.remove('hidden');
        bannerText.textContent = "KURAL: Üst pirinç çıtanın vidalarını sökmeden alttaki gövdeye dokunamazsınız!";
      } else if (levelIndex === 1) {
        banner.classList.remove('hidden');
        bannerText.textContent = "Tek vida kaldığında parçanın sarkaç gibi salınışından yararlanın!";
      } else if (levelIndex === 2) {
        banner.classList.remove('hidden');
        bannerText.textContent = "Çapraz emniyet kolları birbirini kilitliyor. En üstteki kolu bulun!";
      } else {
        banner.classList.add('hidden');
      }
    }

    // Workshop Perk: Velvet Tools (+1 Nudge booster bonus)
    if (this.unlockedWorkshop.includes('tools')) {
      this.boosters.nudge = Math.max(this.boosters.nudge, 4);
      this.updateBoosterUI();
    }

    // Save unlock progress
    if (levelIndex + 1 > this.unlockedLevel) {
      this.unlockedLevel = levelIndex + 1;
      localStorage.setItem('chronomaster_unlocked', this.unlockedLevel);
    }
  }

  restartLevel() {
    this.loadLevel(this.currentLevelIndex);
  }

  buildPhysics() {
    const { Bodies, World, Constraint } = Matter;

    // 1. Create Plate Rigid Bodies with non-interfering layer collision filters
    this.plates.forEach(plate => {
      let body;
      const opts = {
        frictionAir: 0.015,
        restitution: 0.2,
        density: 0.005,
        isSleeping: false,
        collisionFilter: { group: -1, mask: 0, category: 0 }
      };

      if (plate.type === 'rect' || plate.type === 'bar') {
        body = Bodies.rectangle(plate.x, plate.y, plate.width, plate.height, {
          ...opts,
          chamfer: { radius: Math.min(plate.radius || 12, plate.width / 2, plate.height / 2) }
        });
      } else if (plate.type === 'circle' || plate.type === 'gear') {
        body = Bodies.circle(plate.x, plate.y, plate.radius, opts);
      }

      if (plate.angle) {
        Matter.Body.setAngle(body, plate.angle);
      }

      body.plateId = plate.id;
      this.plateBodies.set(plate.id, body);
      World.add(this.engine.world, body);
    });

    // 2. Create Revolute Pin Constraints for each Screw
    this.screws.forEach(screw => {
      const constraints = [];

      screw.plates.forEach(plateId => {
        const body = this.plateBodies.get(plateId);
        if (!body) return;

        const angle = body.angle;
        const dx = screw.x - body.position.x;
        const dy = screw.y - body.position.y;

        const localX = dx * Math.cos(-angle) - dy * Math.sin(-angle);
        const localY = dx * Math.sin(-angle) + dy * Math.cos(-angle);

        const constraint = Constraint.create({
          bodyA: body,
          pointA: { x: localX, y: localY },
          pointB: { x: screw.x, y: screw.y },
          stiffness: 1.0,
          length: 0,
          damping: 0.05
        });

        World.add(this.engine.world, constraint);
        constraints.push(constraint);
      });

      this.screwConstraints.set(screw.id, constraints);
    });

    // 3. Initialize plate states (static if >= 2 screws, dynamic swing if 1, falling if 0)
    this.updatePlatePhysicsStates();
  }

  updatePlatePhysicsStates() {
    this.plates.forEach(plate => {
      if (plate.isCleared) return;
      const body = this.plateBodies.get(plate.id);
      if (!body) return;

      const holdingScrews = this.screws.filter(s => s.plates.includes(plate.id));

      if (holdingScrews.length >= 2) {
        // Matter 0.19 overwrites _original on repeated setStatic(true) → mass=Infinity → NaN pose
        if (!body.isStatic) Matter.Body.setStatic(body, true);
      } else if (holdingScrews.length === 1) {
        if (body.isStatic) {
          Matter.Body.setStatic(body, false);
          // Realistic pendulum swing impulse
          Matter.Body.setAngularVelocity(body, (Math.random() > 0.5 ? 1 : -1) * 0.04);
        }
        Matter.Sleeping.set(body, false);
      } else {
        // 0 screws holding this plate! Full physical detachment!
        if (body.isStatic) {
          Matter.Body.setStatic(body, false);
        }

        // Dopamine pop and spark burst
        window.soundEngine.playPlateRelease();
        this.renderer.spawnSparks(body.position.x, body.position.y, '#ffd700', 25);
        this.renderer.spawnFloatingText(body.position.x, body.position.y, `${plate.name} Serbest! ✨`, '#d4af37');

        Matter.Body.setVelocity(body, {
          x: (Math.random() - 0.5) * 2.0,
          y: Math.max(body.velocity.y, 2.2)
        });
        Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
        Matter.Sleeping.set(body, false);
      }
    });
  }

  // ==========================================
  // UI RENDERING (BOXES & BUFFER)
  // ==========================================

  renderBoxesUI() {
    const track = document.getElementById('boxes-track');
    track.innerHTML = '';

    this.boxes.forEach((box, index) => {
      const boxEl = document.createElement('div');
      boxEl.className = `screw-box ${index === 0 ? 'active' : 'queued'}`;
      boxEl.id = `box-${box.id}`;

      const colorData = window.SCREW_TYPES[box.color] || window.SCREW_TYPES.gold;

      boxEl.innerHTML = `
        <div class="box-header">
          <span class="box-label" style="color:${colorData.hex}">${box.label}</span>
          <span class="box-counter">${box.filled}/${box.capacity}</span>
        </div>
        <div class="box-slots-row">
          ${[0, 1, 2].map(slotIdx => {
            const isFilled = slotIdx < box.filled;
            return `
              <div class="box-hole ${isFilled ? 'filled' : ''}" id="hole-${box.id}-${slotIdx}">
                ${isFilled ? `<div class="screw-icon ${colorData.colorClass}"></div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;

      track.appendChild(boxEl);
    });
  }

  renderBufferUI() {
    const container = document.getElementById('buffer-slots');
    container.innerHTML = '';

    let occupiedCount = 0;

    for (let i = 0; i < this.maxBufferSlots; i++) {
      const screw = this.bufferSlots[i];
      const hole = document.createElement('div');
      hole.className = `buffer-hole ${screw ? 'occupied' : ''}`;
      hole.id = `buffer-hole-${i}`;

      if (screw) {
        occupiedCount++;
        const colorData = window.SCREW_TYPES[screw.color] || window.SCREW_TYPES.gold;
        hole.innerHTML = `<div class="screw-icon ${colorData.colorClass}"></div>`;
      }

      container.appendChild(hole);
    }

    document.getElementById('buffer-status').textContent = `${occupiedCount} / ${this.maxBufferSlots}`;
  }

  updateBoosterUI() {
    document.getElementById('count-magnet').textContent = this.boosters.magnet;
    document.getElementById('count-slot').textContent = this.boosters.slot;
    document.getElementById('count-nudge').textContent = this.boosters.nudge;
  }

  // ==========================================
  // SCREW INTERACTION & LAYER DEPENDENCY ENGINE
  // ==========================================

  handleCanvasPointer(e) {
    if (this.isAnimating || this.isGameOver || this.isVictory) return;

    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const virtPos = this.renderer.screenToVirtual(screenX, screenY);

    let clickedScrew = null;
    let minDist = 26; // virtual hit radius

    for (const screw of this.screws) {
      const dist = Math.hypot(screw.x - virtPos.x, screw.y - virtPos.y);
      if (dist < minDist) {
        clickedScrew = screw;
        minDist = dist;
      }
    }

    if (!clickedScrew) return;

    // Check strict layer hierarchy: Is this screw locked by an overlapping upper plate?
    const blockingPlate = this.findBlockingPlate(clickedScrew);
    if (blockingPlate) {
      this.renderer.triggerShake(220, 6);
      window.soundEngine.playChainRattle();
      this.renderer.setHighlightedPlate(blockingPlate.id);
      this.renderer.spawnFloatingText(clickedScrew.x, clickedScrew.y, `Önce ${blockingPlate.name} Sökülmeli! ⛓️`, "#ff3344");
      return;
    }

    this.processScrewClick(clickedScrew);
  }

  /**
   * Evaluates layer dependency: A screw is strictly blocked if an overlapping upper plate
   * (or a plate specified in dependsOn) still has uncleared screws holding it down!
   */
  findBlockingPlate(screw) {
    // 1. Only the screw's topmost plate decides dependsOn; the plates it passes through below don't
    let topPlate = null;
    for (const plateId of screw.plates) {
      const plate = this.plates.find(p => p.id === plateId);
      if (plate && (!topPlate || plate.layer > topPlate.layer)) topPlate = plate;
    }

    if (topPlate && topPlate.dependsOn) {
      for (const parentId of topPlate.dependsOn) {
        const parentPlate = this.plates.find(p => p.id === parentId);
        if (parentPlate && !parentPlate.isCleared && !screw.plates.includes(parentId)) {
          return parentPlate;
        }
      }
    }

    // 2. Check physical geometrical overlap with any uncleared plate on a higher layer
    const screwMaxLayer = topPlate ? topPlate.layer : 0;

    for (const plate of this.plates) {
      if (plate.isCleared) continue;
      if (plate.layer > screwMaxLayer) {
        const body = this.plateBodies.get(plate.id);
        if (body && this.isPointInPlate(screw.x, screw.y, plate, body)) {
          return plate;
        }
      }
    }
    return null;
  }

  isScrewBlocked(screw) {
    return this.findBlockingPlate(screw) !== null;
  }

  isPointInPlate(px, py, plate, body) {
    const cos = Math.cos(-body.angle);
    const sin = Math.sin(-body.angle);
    const dx = px - body.position.x;
    const dy = py - body.position.y;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;

    if (plate.type === 'rect' || plate.type === 'bar') {
      const halfW = plate.width / 2;
      const halfH = plate.height / 2;
      return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH;
    } else if (plate.type === 'circle' || plate.type === 'gear') {
      return (lx * lx + ly * ly) <= (plate.radius * plate.radius);
    }
    return false;
  }

  // ==========================================
  // CORE UNSCREWING & SORTING ALGORITHM
  // ==========================================

  processScrewClick(screw) {
    const activeBox = this.boxes[0];
    const canFitInActiveBox = activeBox && activeBox.color === screw.color && activeBox.filled < activeBox.capacity;
    const freeBufferIndex = this.bufferSlots.indexOf(null);

    // If active box doesn't accept this screw AND buffer is full -> Cannot unscrew!
    if (!canFitInActiveBox && freeBufferIndex === -1) {
      window.soundEngine.playGameOver();
      const rack = document.getElementById('buffer-rack-container');
      rack.classList.add('danger-pulse');
      setTimeout(() => rack.classList.remove('danger-pulse'), 500);
      this.renderer.spawnFloatingText(screw.x, screw.y, "Yedek Tepsi Dolu!", "#ff4769");
      return;
    }

    this.isAnimating = true;

    // Dopamine Combo Calculation
    if (canFitInActiveBox) {
      this.comboStreak++;
      if (this.comboStreak > this.maxComboThisLevel) {
        this.maxComboThisLevel = this.comboStreak;
      }

      if (this.comboStreak >= 2) {
        window.soundEngine.playCombo(this.comboStreak);
        const comboMultiplier = this.unlockedWorkshop.includes('lamp') ? 10 : 5;
        const bonusGears = this.comboStreak * comboMultiplier;
        this.gears += bonusGears;
        localStorage.setItem('chronomaster_gears', this.gears);
        document.getElementById('gear-count').textContent = this.gears;

        const banner = document.getElementById('combo-streak-banner');
        const bannerText = document.getElementById('combo-streak-text');
        if (banner && bannerText) {
          banner.classList.remove('hidden');
          bannerText.textContent = `${this.comboStreak}x ZİNCİRLEME KOMBO! (+${bonusGears} ⚙️)`;
          clearTimeout(this._comboTimeout);
          const comboDuration = this.unlockedWorkshop.includes('lamp') ? 3500 : 2000;
          this._comboTimeout = setTimeout(() => banner.classList.add('hidden'), comboDuration);
        }
        this.renderer.spawnFloatingText(screw.x, screw.y, `${this.comboStreak}x KOMBO! 🔥`, '#ffaa00');
      }
    } else {
      this.comboStreak = 0;
      const occupied = this.bufferSlots.filter(s => s !== null).length + 1;
      if (occupied > this.maxBufferOccupiedThisLevel) {
        this.maxBufferOccupiedThisLevel = occupied;
      }
    }

    // 1. Trigger Animated Screwdriver Overlay
    this.animateScrewdriver(screw.x, screw.y, () => {
      // 2. Remove Constraints from Physics Engine
      const constraints = this.screwConstraints.get(screw.id) || [];
      constraints.forEach(c => Matter.World.remove(this.engine.world, c));
      this.screwConstraints.delete(screw.id);

      // Remove screw from board active array
      this.screws = this.screws.filter(s => s.id !== screw.id);

      // Save for Undo history
      this.historyStack.push({
        screw: screw,
        constraints: constraints,
        target: canFitInActiveBox ? 'box' : 'buffer',
        bufferIndex: freeBufferIndex
      });

      // Sound & Sparks
      window.soundEngine.playScrewPop();
      this.renderer.spawnSparks(screw.x, screw.y, window.SCREW_TYPES[screw.color].hex, 16);

      // Update plate physics states (transitions to single-screw pendulum or free fall)
      this.updatePlatePhysicsStates();

      // 3. 3D Flying Projectile to Active Box or Buffer Rack
      if (canFitInActiveBox) {
        const targetHole = document.getElementById(`hole-${activeBox.id}-${activeBox.filled}`);
        this.animateFlyingScrew(screw, screw.x, screw.y, targetHole, () => {
          this.sendScrewToBox(screw, activeBox, () => {
            this.isAnimating = false;
            this.checkBoardState();
          });
        });
      } else {
        const targetHole = document.getElementById(`buffer-hole-${freeBufferIndex}`);
        this.animateFlyingScrew(screw, screw.x, screw.y, targetHole, () => {
          this.sendScrewToBuffer(screw, freeBufferIndex, () => {
            this.isAnimating = false;
            this.checkBoardState();
          });
        });
      }
    });
  }

  animateScrewdriver(virtX, virtY, onComplete) {
    const sPos = this.renderer.virtualToScreen(virtX, virtY);
    const tool = document.getElementById('screwdriver-tool');
    tool.style.left = `${sPos.x - 22}px`;
    tool.style.top = `${sPos.y - 120}px`;
    tool.classList.remove('hidden');
    tool.classList.remove('animating');
    void tool.offsetWidth;
    tool.classList.add('animating');

    window.soundEngine.playScrewdriverSound();

    setTimeout(() => {
      tool.classList.add('hidden');
      tool.classList.remove('animating');
      onComplete();
    }, 420);
  }

  animateFlyingScrew(screw, startVirtX, startVirtY, targetDOMEl, callback) {
    if (!targetDOMEl) {
      if (callback) callback();
      return;
    }

    const sPos = this.renderer.virtualToScreen(startVirtX, startVirtY);
    const flyingLayer = document.getElementById('flying-layer') || document.body;

    const proj = document.createElement('div');
    proj.className = `flying-projectile ${window.SCREW_TYPES[screw.color].colorClass}`;
    proj.style.left = `${sPos.x - 14}px`;
    proj.style.top = `${sPos.y - 14}px`;
    flyingLayer.appendChild(proj);

    window.soundEngine.playScrewSwoosh();

    const targetRect = targetDOMEl.getBoundingClientRect();
    const wrapperRect = this.canvas.parentElement.getBoundingClientRect();

    const destX = targetRect.left - wrapperRect.left + (targetRect.width / 2) - 14;
    const destY = targetRect.top - wrapperRect.top + (targetRect.height / 2) - 14;

    const deltaX = destX - (sPos.x - 14);
    const deltaY = destY - (sPos.y - 14);

    requestAnimationFrame(() => {
      proj.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.9) rotate(360deg)`;
      proj.style.opacity = '1';
    });

    setTimeout(() => {
      proj.remove();
      if (callback) callback();
    }, 400);
  }

  sendScrewToBox(screw, box, callback) {
    const targetSlotIdx = box.filled;
    box.filled++;

    const holeEl = document.getElementById(`hole-${box.id}-${targetSlotIdx}`);
    if (holeEl) {
      holeEl.classList.add('filled');
      const colorData = window.SCREW_TYPES[screw.color];
      holeEl.innerHTML = `<div class="screw-icon ${colorData.colorClass}"></div>`;
    }

    const boxEl = document.getElementById(`box-${box.id}`);
    if (boxEl) {
      const counterEl = boxEl.querySelector('.box-counter');
      if (counterEl) counterEl.textContent = `${box.filled}/${box.capacity}`;
    }

    window.soundEngine.playScrewLand();

    if (box.filled >= box.capacity) {
      this.handleBoxCompleted(box, callback);
    } else {
      if (callback) callback();
    }
  }

  sendScrewToBuffer(screw, slotIndex, callback) {
    this.bufferSlots[slotIndex] = screw;
    this.renderBufferUI();
    window.soundEngine.playScrewLand();
    if (callback) callback();
  }

  handleBoxCompleted(box, callback) {
    window.soundEngine.playBoxComplete();
    const boxEl = document.getElementById(`box-${box.id}`);
    if (boxEl) {
      boxEl.classList.add('box-cleared');
    }

    setTimeout(() => {
      this.boxes.shift();
      this.renderBoxesUI();

      this.gears += 30;
      localStorage.setItem('chronomaster_gears', this.gears);
      document.getElementById('gear-count').textContent = this.gears;

      // Check Buffer Autofill Chain Reaction!
      this.checkBufferAutofill(() => {
        if (callback) callback();
      });
    }, 520);
  }

  checkBufferAutofill(callback) {
    const activeBox = this.boxes[0];
    if (!activeBox) {
      if (callback) callback();
      return;
    }

    let foundIndex = -1;
    for (let i = 0; i < this.maxBufferSlots; i++) {
      if (this.bufferSlots[i] && this.bufferSlots[i].color === activeBox.color && activeBox.filled < activeBox.capacity) {
        foundIndex = i;
        break;
      }
    }

    if (foundIndex !== -1) {
      const screw = this.bufferSlots[foundIndex];
      this.bufferSlots[foundIndex] = null;
      this.renderBufferUI();

      this.renderer.spawnFloatingText(200, 200, "ZİNCİRLEME UYUM!", "#ffd700");
      window.soundEngine.playScrewLand();

      this.sendScrewToBox(screw, activeBox, () => {
        this.checkBufferAutofill(callback);
      });
    } else {
      if (callback) callback();
    }
  }

  // ==========================================
  // WIN / LOSE & DOPAMINE CHEST REWARD
  // ==========================================

  checkBoardState() {
    // 1. Check Win
    if (this.boxes.length === 0 || this.screws.length === 0) {
      const remainingInBuffer = this.bufferSlots.filter(s => s !== null).length;
      if (remainingInBuffer === 0 || this.screws.length === 0) {
        this.triggerVictory();
        return;
      }
    }

    // 2. Softlock: screws remain but none can be tapped (falling plates get time to clear first)
    if (this.screws.length > 0 && this.screws.every(s => this.isScrewBlocked(s))) {
      clearTimeout(this._stuckTimeout);
      this._stuckTimeout = setTimeout(() => {
        if (this.isVictory || this.isAnimating || this.screws.length === 0) return;
        // A plate with no screws left is still falling (or the app is paused) → check again later
        const falling = this.plates.some(p => !p.isCleared && !this.screws.some(s => s.plates.includes(p.id)));
        if (falling || document.hidden) {
          this.checkBoardState();
        } else if (this.screws.every(s => this.isScrewBlocked(s))) {
          this.triggerGameOver();
        }
      }, 2500);
    }

    // 3. Check Game Over
    const freeBufferIndex = this.bufferSlots.indexOf(null);
    if (freeBufferIndex === -1) {
      const activeBox = this.boxes[0];
      let hasMatchingScrewAvailable = false;

      for (const screw of this.screws) {
        if (screw.color === activeBox.color && !this.isScrewBlocked(screw)) {
          hasMatchingScrewAvailable = true;
          break;
        }
      }

      if (!hasMatchingScrewAvailable) {
        this.triggerGameOver();
      }
    }
  }

  triggerVictory() {
    if (this.isVictory) return;
    this.isVictory = true;
    this.chestOpened = false;
    window.soundEngine.playVictory();

    // Reset Mystery Chest UI in modal
    const chestBtn = document.getElementById('btn-open-chest');
    const chestRewards = document.getElementById('chest-opened-rewards');
    if (chestBtn) chestBtn.style.display = 'flex';
    if (chestRewards) chestRewards.classList.add('hidden');

    // Calculate Stars
    const star1 = true;
    const star2 = (this.maxBufferOccupiedThisLevel <= 3);
    const star3 = (this.maxComboThisLevel >= 2);

    const starEls = [
      document.getElementById('star-1'),
      document.getElementById('star-2'),
      document.getElementById('star-3')
    ];

    starEls.forEach(el => el.classList.remove('stamped'));

    // Sequential Star Stamps with Audio
    setTimeout(() => {
      starEls[0].classList.add('stamped');
      window.soundEngine.playStarStamp(0);
    }, 400);

    if (star2) {
      setTimeout(() => {
        starEls[1].classList.add('stamped');
        window.soundEngine.playStarStamp(1);
      }, 850);
    }

    if (star3) {
      setTimeout(() => {
        starEls[2].classList.add('stamped');
        window.soundEngine.playStarStamp(2);
      }, 1300);
    }

    document.getElementById('victory-part-name').textContent = this.levelData.partName;

    // Check Museum Unlock
    const currentArtifactId = this.currentLevelIndex + 1;
    if (currentArtifactId <= window.MUSEUM_ARTIFACTS.length) {
      if (!this.unlockedMuseum.includes(currentArtifactId)) {
        this.unlockedMuseum.push(currentArtifactId);
        localStorage.setItem('chronomaster_museum', JSON.stringify(this.unlockedMuseum));
      }
      const art = window.MUSEUM_ARTIFACTS[currentArtifactId - 1];
      document.getElementById('victory-artifact-title').textContent = `${art.icon} ${art.title} Restorasyonu Tamam!`;
      document.getElementById('victory-artifact-desc').textContent = `${art.category} müzeye yerleştirildi. Pasif gelir: +${art.passiveRate} ⚙️/dk.`;
      document.getElementById('victory-unlock-badge').classList.remove('hidden');
    } else {
      document.getElementById('victory-unlock-badge').classList.add('hidden');
    }

    document.getElementById('modal-victory').classList.remove('hidden');

    // Confetti particles
    for (let i = 0; i < 45; i++) {
      this.renderer.spawnSparks(200, 260, i % 2 === 0 ? '#ffd700' : '#4a6984', 24);
    }
  }

  openVictoryChest() {
    if (this.chestOpened) return;
    this.chestOpened = true;

    window.soundEngine.playChestOpen();

    const chestBtn = document.getElementById('btn-open-chest');
    const chestRewards = document.getElementById('chest-opened-rewards');
    chestBtn.style.display = 'none';
    chestRewards.classList.remove('hidden');

    let gearReward = 85 + Math.floor(Math.random() * 40);
    // Workshop Perk: Mahogany Bench (+15% Level Complete gear bonus)
    if (this.unlockedWorkshop.includes('bench')) {
      gearReward = Math.round(gearReward * 1.15);
    }
    // Workshop Perk: Royal Cabinet (+50% Chest rewards)
    if (this.unlockedWorkshop.includes('cabinet')) {
      gearReward = Math.round(gearReward * 1.5);
    }

    this.gears += gearReward;
    localStorage.setItem('chronomaster_gears', this.gears);
    document.getElementById('gear-count').textContent = this.gears;
    document.getElementById('reward-gears-amount').textContent = `+${gearReward}`;

    const boosterPill = document.getElementById('reward-booster-pill');
    const boosterChance = this.unlockedWorkshop.includes('cabinet') ? 0.95 : 0.45;
    if (Math.random() < boosterChance) {
      this.boosters.magnet++;
      this.updateBoosterUI();
      boosterPill.innerHTML = '<span class="reward-icon">🧲</span> +1 Mıknatıs';
      boosterPill.style.display = 'flex';
    } else {
      boosterPill.style.display = 'none';
    }

    this.renderer.spawnSparks(200, 260, '#ffd700', 35);
  }

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    window.soundEngine.playGameOver();
    document.getElementById('modal-gameover').classList.remove('hidden');
  }

  // ==========================================
  // ROYAL HOROLOGY MUSEUM (META GAME PROGRESSION)
  // ==========================================

  openMuseumModal() {
    const gallery = document.getElementById('museum-gallery');
    gallery.innerHTML = '';

    const artifacts = window.MUSEUM_ARTIFACTS;
    const unlockedIds = this.unlockedMuseum;

    document.getElementById('museum-count').textContent = `${unlockedIds.length} / ${artifacts.length}`;

    const minutesElapsed = Math.min(120, Math.floor((Date.now() - this.lastMuseumClaim) / 60000));
    let totalRate = 0;

    artifacts.forEach(art => {
      const isUnlocked = unlockedIds.includes(art.id);
      if (isUnlocked) totalRate += art.passiveRate;

      const card = document.createElement('div');
      card.className = `artifact-card ${isUnlocked ? 'unlocked' : 'locked'}`;

      card.innerHTML = `
        <div class="artifact-icon-wrap">${isUnlocked ? art.icon : '🔒'}</div>
        <div class="artifact-info">
          <div class="artifact-title-row">
            <span class="artifact-name">${art.title}</span>
            <span class="artifact-year">${isUnlocked ? art.year : `Seviye ${art.requiredLevel}`}</span>
          </div>
          <div class="artifact-category">${art.category}</div>
          <p class="artifact-desc">${isUnlocked ? art.desc : 'Bu tarihi eseri müzeye kazandırmak için atölyede restorasyonu tamamlayın.'}</p>
          ${isUnlocked ? `<div class="artifact-passive">⚙️ +${art.passiveRate} Dişli / Dk</div>` : ''}
        </div>
      `;

      gallery.appendChild(card);
    });

    // Workshop Perk: London Longcase Clock doubles museum passive rate
    if (this.unlockedWorkshop.includes('clock')) {
      totalRate *= 2;
    }

    const pendingGears = Math.max(0, minutesElapsed * totalRate);
    document.getElementById('museum-income').textContent = `+${pendingGears} ⚙️`;
    const claimBtn = document.getElementById('btn-claim-museum');
    claimBtn.disabled = (pendingGears <= 0);

    document.getElementById('modal-museum').classList.remove('hidden');
  }

  claimMuseumIncome() {
    const artifacts = window.MUSEUM_ARTIFACTS;
    let totalRate = 0;
    artifacts.forEach(art => {
      if (this.unlockedMuseum.includes(art.id)) totalRate += art.passiveRate;
    });

    // Workshop Perk: London Longcase Clock doubles museum passive rate
    if (this.unlockedWorkshop.includes('clock')) {
      totalRate *= 2;
    }

    const minutesElapsed = Math.min(120, Math.floor((Date.now() - this.lastMuseumClaim) / 60000));
    const pendingGears = Math.max(0, minutesElapsed * totalRate);

    if (pendingGears > 0) {
      this.gears += pendingGears;
      this.lastMuseumClaim = Date.now();
      localStorage.setItem('chronomaster_gears', this.gears);
      localStorage.setItem('chronomaster_last_claim', this.lastMuseumClaim);

      document.getElementById('gear-count').textContent = this.gears;
      document.getElementById('museum-income').textContent = `+0 ⚙️`;
      document.getElementById('btn-claim-museum').disabled = true;

      window.soundEngine.playBooster();
      this.renderer.spawnFloatingText(200, 200, `+${pendingGears} ⚙️ MÜZE GELİRİ ALINDI!`, '#ffd700');
    }
  }

  // ==========================================
  // OPTION 3: WORKSHOP MAKEOVER (SAATÇİ DÜKKANI YENİLEME)
  // ==========================================

  openWorkshopModal() {
    const listEl = document.getElementById('workshop-upgrades-list');
    listEl.innerHTML = '';

    const upgrades = window.WORKSHOP_UPGRADES || [];
    const count = this.unlockedWorkshop.length;
    const total = upgrades.length;
    const pct = Math.round((count / total) * 100);

    const progressBadge = document.getElementById('workshop-progress-badge');
    if (progressBadge) {
      progressBadge.textContent = `Atölye Durumu: %${pct} Yenilendi (${count}/${total})`;
    }
    const availGears = document.getElementById('workshop-available-gears');
    if (availGears) {
      availGears.textContent = this.gears;
    }

    // Update Room Diorama Visuals
    upgrades.forEach(up => {
      const slotEl = document.getElementById(`room-slot-${up.id}`);
      if (slotEl) {
        const isUnlocked = this.unlockedWorkshop.includes(up.id);
        if (isUnlocked) {
          slotEl.classList.add('unlocked');
          const visual = slotEl.querySelector('.slot-visual');
          if (visual) visual.textContent = up.icon;
          const badge = slotEl.querySelector('.slot-badge');
          if (badge) badge.textContent = 'Yenilendi ✨';
        } else {
          slotEl.classList.remove('unlocked');
          const visual = slotEl.querySelector('.slot-visual');
          if (visual) visual.textContent = up.beforeIcon || '🏚️';
          const badge = slotEl.querySelector('.slot-badge');
          if (badge) badge.textContent = 'Eski Durum';
        }
      }
    });

    // Render Upgrade Cards
    upgrades.forEach(up => {
      const isUnlocked = this.unlockedWorkshop.includes(up.id);
      const canAfford = this.gears >= up.cost;

      const card = document.createElement('div');
      card.className = `workshop-upgrade-card ${isUnlocked ? 'unlocked' : ''}`;

      card.innerHTML = `
        <div class="upgrade-icon-box">${isUnlocked ? up.icon : (up.beforeIcon || '🏚️')}</div>
        <div class="upgrade-info">
          <div class="upgrade-title-row">
            <span class="upgrade-title">${up.title}</span>
            <span class="upgrade-category">${up.category}</span>
          </div>
          <p class="upgrade-desc">${up.desc}</p>
          <span class="upgrade-perk">✨ ${up.perk}</span>
        </div>
        <div class="upgrade-action">
          ${isUnlocked ? `
            <div class="badge-upgraded"><span>✅</span> YENİLENDİ</div>
          ` : `
            <button class="btn-buy-upgrade" data-upgrade-id="${up.id}" ${canAfford ? '' : 'disabled'}>
              <span>⚙️</span> ${up.cost} YENİLE
            </button>
          `}
        </div>
      `;

      listEl.appendChild(card);
    });

    // Bind buy buttons
    listEl.querySelectorAll('.btn-buy-upgrade').forEach(btn => {
      btn.addEventListener('click', () => {
        const upId = btn.getAttribute('data-upgrade-id');
        this.buyWorkshopUpgrade(upId);
      });
    });

    document.getElementById('modal-workshop').classList.remove('hidden');
  }

  buyWorkshopUpgrade(upgradeId) {
    const upgrades = window.WORKSHOP_UPGRADES || [];
    const up = upgrades.find(u => u.id === upgradeId);
    if (!up || this.unlockedWorkshop.includes(upgradeId) || this.gears < up.cost) {
      return;
    }

    this.gears -= up.cost;
    this.unlockedWorkshop.push(upgradeId);

    localStorage.setItem('chronomaster_gears', this.gears);
    localStorage.setItem('chronomaster_workshop', JSON.stringify(this.unlockedWorkshop));

    document.getElementById('gear-count').textContent = this.gears;
    document.getElementById('menu-gears-count').textContent = this.gears;

    window.soundEngine.playWorkshopUpgrade();
    this.renderer.spawnSparks(200, 200, '#ffd700', 40);
    this.renderer.spawnFloatingText(200, 160, `${up.title} Kuruldu! ✨`, '#ffd700');

    this.openWorkshopModal();
  }

  // ==========================================
  // BOOSTERS
  // ==========================================

  useBoosterMagnet() {
    if (this.boosters.magnet <= 0 || this.isAnimating) return;
    const activeBox = this.boxes[0];
    if (!activeBox) return;

    const targetScrew = this.screws.find(s => s.color === activeBox.color);
    if (!targetScrew) {
      this.renderer.spawnFloatingText(200, 260, "Uyumlu Vida Yok!", "#ff4769");
      return;
    }

    this.boosters.magnet--;
    this.updateBoosterUI();
    window.soundEngine.playBooster();

    this.renderer.spawnFloatingText(targetScrew.x, targetScrew.y, "MIKNATIS ÇEKTİ! 🧲", "#ffd700");

    const constraints = this.screwConstraints.get(targetScrew.id) || [];
    constraints.forEach(c => Matter.World.remove(this.engine.world, c));
    this.screwConstraints.delete(targetScrew.id);
    this.screws = this.screws.filter(s => s.id !== targetScrew.id);

    this.updatePlatePhysicsStates();

    const targetHole = document.getElementById(`hole-${activeBox.id}-${activeBox.filled}`);
    this.animateFlyingScrew(targetScrew, targetScrew.x, targetScrew.y, targetHole, () => {
      this.sendScrewToBox(targetScrew, activeBox, () => {
        this.checkBoardState();
      });
    });
  }

  addExtraBufferSlot(isBooster = false) {
    if (isBooster) {
      if (this.boosters.slot <= 0) return;
      this.boosters.slot--;
      this.updateBoosterUI();
      window.soundEngine.playBooster();
    }

    this.maxBufferSlots++;
    this.bufferSlots.push(null);
    this.renderBufferUI();
    this.renderer.spawnFloatingText(200, 480, "+1 YUVA AÇILDI! 🔓", "#38a169");
  }

  useBoosterNudge() {
    if (this.boosters.nudge <= 0) return;
    this.boosters.nudge--;
    this.updateBoosterUI();
    window.soundEngine.playBooster();

    this.plateBodies.forEach(body => {
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.25);
      Matter.Body.applyForce(body, body.position, {
        x: (Math.random() - 0.5) * 0.05,
        y: -0.05
      });
      Matter.Sleeping.set(body, false);
    });

    this.renderer.spawnFloatingText(200, 260, "SARSINTI! ⚡", "#ffd700");
  }

  undoLastMove() {
    if (this.historyStack.length === 0 || this.isAnimating) return;
    const lastMove = this.historyStack.pop();

    window.soundEngine.playBooster();

    lastMove.constraints.forEach(c => Matter.World.add(this.engine.world, c));
    this.screwConstraints.set(lastMove.screw.id, lastMove.constraints);
    this.screws.push(lastMove.screw);

    if (lastMove.target === 'box') {
      const activeBox = this.boxes[0];
      if (activeBox && activeBox.filled > 0) {
        activeBox.filled--;
      }
      this.renderBoxesUI();
    } else {
      this.bufferSlots[lastMove.bufferIndex] = null;
      this.renderBufferUI();
    }

    this.updatePlatePhysicsStates();
    this.renderer.spawnFloatingText(lastMove.screw.x, lastMove.screw.y, "GERİ ALINDI ↩️", "#a8cce8");
  }

  // ==========================================
  // LEVEL SELECT DRAWER
  // ==========================================

  openLevelsModal() {
    const grid = document.getElementById('levels-grid');
    grid.innerHTML = '';

    const totalLevels = Math.max(7, this.unlockedLevel + 1);

    for (let i = 0; i < totalLevels; i++) {
      const isLocked = (i + 1) > this.unlockedLevel;
      const isCurrent = i === this.currentLevelIndex;

      const card = document.createElement('div');
      card.className = `level-card ${isLocked ? 'locked' : ''} ${isCurrent ? 'current' : ''}`;
      card.innerHTML = `
        <span class="level-card-num">${i + 1}</span>
        <span class="level-card-stars">${isLocked ? '🔒' : '★★★'}</span>
      `;

      if (!isLocked) {
        card.addEventListener('click', () => {
          document.getElementById('modal-levels').classList.add('hidden');
          document.getElementById('main-menu').classList.add('hidden');
          this.loadLevel(i);
        });
      }

      grid.appendChild(card);
    }

    document.getElementById('modal-levels').classList.remove('hidden');
  }

  // ==========================================
  // OPTION 4: KINETIC GEARS & MECHANICAL TRIGGERS
  // ==========================================

  checkKineticTriggers(fallenPlateId) {
    if (!this.levelData || !this.levelData.kineticTriggers) return;
    this.levelData.kineticTriggers.forEach(trigger => {
      if (trigger.triggerOnFall === fallenPlateId && !trigger.executed) {
        this.executeKineticTrigger(trigger);
      }
    });
  }

  executeKineticTrigger(trigger) {
    trigger.executed = true;
    window.soundEngine.playGearRatchet();
    this.renderer.triggerShake(14, 12);

    const targetPlate = this.plates.find(p => p.id === trigger.targetPlateId);
    if (!targetPlate || targetPlate.isCleared) return;

    const body = this.plateBodies.get(targetPlate.id);
    const cx = targetPlate.x;
    const cy = targetPlate.y;
    const deltaAngle = trigger.rotateAngle || (Math.PI / 4);

    // Mechanical escapement step-by-step ratcheting animation (6 ticks)
    const steps = 6;
    let stepCount = 0;
    const stepAngle = deltaAngle / steps;

    const interval = setInterval(() => {
      stepCount++;

      // Rotate body angle
      if (body) {
        Matter.Body.setAngle(body, body.angle + stepAngle);
      }
      targetPlate.angle = (targetPlate.angle || 0) + stepAngle;

      // Rotate attached designated screws around center of target plate
      if (trigger.rotateScrews && trigger.rotateScrews.length > 0) {
        trigger.rotateScrews.forEach(screwId => {
          const screw = this.screws.find(s => s.id === screwId);
          if (!screw) return;

          const dx = screw.x - cx;
          const dy = screw.y - cy;
          const cos = Math.cos(stepAngle);
          const sin = Math.sin(stepAngle);

          screw.x = cx + (dx * cos - dy * sin);
          screw.y = cy + (dx * sin + dy * cos);

          // Update constraint anchor positions
          const constraints = this.screwConstraints.get(screwId);
          if (constraints) {
            constraints.forEach(c => {
              c.pointB = { x: screw.x, y: screw.y };
            });
          }
        });
      }

      this.renderer.spawnSparks(cx, cy, '#ffd700', 8);
      window.soundEngine.playGearRatchet();

      if (stepCount >= steps) {
        clearInterval(interval);
        const msg = trigger.message || 'Çark Döndü: Vidalar Hizalandı! ⚙️';
        this.renderer.spawnFloatingText(cx, cy - 30, msg, '#ffd700');

        // Show animated banner
        const banner = document.getElementById('combo-streak-banner');
        const bannerText = document.getElementById('combo-streak-text');
        if (banner && bannerText) {
          banner.classList.add('kinetic-banner');
          banner.classList.remove('hidden');
          bannerText.textContent = msg;
          setTimeout(() => {
            banner.classList.remove('kinetic-banner');
            if (this.comboStreak <= 1) {
              banner.classList.add('hidden');
            } else {
              bannerText.textContent = `${this.comboStreak}x KOMBO!`;
            }
          }, 3200);
        }
      }
    }, 65);
  }

  // ==========================================
  // MAIN GAME & PHYSICS LOOP (60 FPS)
  // ==========================================

  startLoop() {
    let lastTime = performance.now();

    const loop = (currentTime) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // 1. Step Matter.js Physics Engine
      Matter.Engine.update(this.engine, dt * 1000);

      // 2. Check for Fallen Plates (Physics Clear)
      this.plates.forEach(plate => {
        if (plate.isCleared) return;
        const body = this.plateBodies.get(plate.id);
        if (body && (body.position.y > 620 || !Number.isFinite(body.position.y))) {
          plate.isCleared = true;
          window.soundEngine.playPlateFall();
          this.renderer.spawnSparks(200, 480, '#d4af37', 20);
          this.renderer.spawnFloatingText(200, 420, `${plate.name} Düştü!`, '#d4af37');
          Matter.World.remove(this.engine.world, body);

          // Check Option 4: Kinetic Mechanical Triggers
          this.checkKineticTriggers(plate.id);
        }
      });

      // 3. Render Canvas
      this.renderer.clear();

      // Draw background holes
      this.screws.forEach(screw => {
        this.renderer.drawHole(screw.x, screw.y);
      });

      // Sort and draw plates by layer
      const sortedPlates = [...this.plates].sort((a, b) => (a.layer || 1) - (b.layer || 1));
      sortedPlates.forEach(plate => {
        if (!plate.isCleared) {
          const body = this.plateBodies.get(plate.id);
          this.renderer.drawPlate(plate, body);
        }
      });

      // Draw Screws (distinguishing dependent-locked screws)
      this.screws.forEach(screw => {
        const blockingPlate = this.findBlockingPlate(screw);
        const isLocked = (blockingPlate !== null);
        this.renderer.drawScrew(screw, false, false, isLocked);
      });

      // Update particle and text effects
      this.renderer.updateEffects();

      // Restore camera shake if active
      this.renderer.restoreShake();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }
}

// Launch Game on Window Load
window.addEventListener('DOMContentLoaded', () => {
  window.chronoGame = new ChronoMasterGame();
});
