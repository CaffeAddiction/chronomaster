/**
 * ChronoMaster Workshop: the apprentice's shop that gets restored star by star.
 * The scene is a hand-built SVG; every task swaps a "broken" group for a "restored" one,
 * and the whole room gets lighter and livelier as the player progresses.
 */
const WORKSHOP_CHAPTERS = [
  {
    id: 1,
    title: 'Tozlu Atölye',
    rank: 'Kalfa',
    reward: { gears: 300, boosters: { magnet: 2 } },
    done: 'Atölye yeniden çalışır hâle geldi! Artık sen bir kalfasın, evlat. Sırada saat köşemiz var.',
    tasks: [
      { id: 'cobwebs', title: 'Örümcek ağlarını temizle', icon: '🧹', cost: 1, at: [40, 36],
        line: 'Hah şöyle! Ağlar gidince dükkân nefes aldı.' },
      { id: 'bench', title: 'Çalışma tezgâhını onar', icon: '🪚', cost: 2, at: [150, 262], perk: 'Seviye sonu dişli ödülü +%15',
        line: 'Benim tezgâhım! Kırk yıl bu tezgâhta saat kurdum.' },
      { id: 'lamp', title: 'Tavan lambasını yak', icon: '💡', cost: 2, at: [195, 82], perk: 'Kombo dişlileri 2 katı',
        line: 'Işık olmadan ince iş olmaz. Gözlerine sağlık!' },
      { id: 'tools', title: 'Alet panosunu düzenle', icon: '🔧', cost: 2, at: [108, 158], perk: 'Her seviyede +1 Geri Al',
        line: 'Her aletin bir yeri var. Usta, aletini aramaz.' },
      { id: 'window', title: 'Vitrin penceresini yenile', icon: '🪟', cost: 3, at: [292, 116],
        line: 'Sokaktan geçen herkes içeriyi görsün artık!' }
    ]
  },
  {
    id: 2,
    title: 'Saat Köşesi',
    rank: 'Usta',
    reward: { gears: 500, boosters: { slot: 2, loupe: 2 } },
    done: 'Duvarlar tik-tak sesiyle doldu. Bugünden sonra sana "usta" diyeceğim.',
    tasks: [
      { id: 'wall', title: 'Duvarları boya', icon: '🖌️', cost: 2, at: [222, 206],
        line: 'Bu yeşil, rahmetli hanımın en sevdiği renkti...' },
      { id: 'grandclock', title: 'Ayaklı saati kur', icon: '🕰️', cost: 3, at: [36, 214], perk: 'Vitrin geliri 2 katı',
        line: 'Dedemden kalma! Sarkacı yine sallanıyor, inanamıyorum.' },
      { id: 'wallclocks', title: 'Duvar saatlerini as', icon: '⏰', cost: 3, at: [118, 84],
        line: 'Hepsi aynı saniyede tık ediyor. İşte ustalık budur.' },
      { id: 'floor', title: 'Parkeleri cilala', icon: '✨', cost: 2, at: [300, 380],
        line: 'Parkeler ayna gibi oldu. Ayakkabılarını sil öyle gir!' },
      { id: 'cabinet', title: 'Koleksiyon vitrinini yenile', icon: '🗄️', cost: 3, at: [297, 270], perk: 'Sandık ödülleri +%50',
        line: 'Onardığın şaheserler artık burada sergilenecek.' }
    ]
  },
  {
    id: 3,
    title: 'Büyük Açılış',
    rank: 'Başusta',
    reward: { gears: 800, boosters: { magnet: 3, slot: 2, loupe: 3 } },
    done: 'Halil Usta Saat Atölyesi yeniden açıldı! Bu dükkân artık senin, Başusta.',
    tasks: [
      { id: 'rug', title: 'Halıyı ser', icon: '🧶', cost: 2, at: [180, 398],
        line: 'Bu halıyı annem dokumuştu. Dükkâna sıcaklık kattı.' },
      { id: 'portrait', title: 'Ustanın portresini as', icon: '🖼️', cost: 3, at: [194, 146],
        line: 'Ha ha! Bıyıklarım ne de güzel çıkmış.' },
      { id: 'sign', title: 'Tabelayı yeniden as', icon: '🪧', cost: 3, at: [180, 28],
        line: 'Tabelamız yine pırıl pırıl. Herkes adımızı görsün.' },
      { id: 'counter', title: 'Kapı zilini tak', icon: '🔔', cost: 3, at: [318, 182], perk: "Usta'nın hediyesi 2 kat sık",
        line: 'Çın çın! Müşteri geldiğini hemen duyarız.' },
      { id: 'opening', title: 'Büyük açılışı yap!', icon: '🎉', cost: 4, at: [180, 62],
        line: 'Bütün mahalle burada! Gurur duyuyorum seninle.' }
    ]
  }
];

const MASTER_TIPS = [
  'Önce en üstteki parçaları boşalt; altındaki vidalar kendiliğinden açılır.',
  'Tek vidası kalan parça sallanır, altındaki vidaları engellemez.',
  'Tepsi dolmadan önce kutunun rengine uyan vidaları ara.',
  'Büyüteçle parçaların altındaki gizli vidaları görebilirsin.',
  'Paslı vidayı iki kez çevirmen gerekir. Sabır, evlat.',
  'Yıldızları dükkânı onarmak için kullanıyoruz. Üç yıldız kazanmaya çalış!',
  'Her beş işte bir şaheser gelir; onu onarırsan vitrinimize koyarız.'
];

class Workshop {
  constructor(game) {
    this.game = game;
    this.store = game.store;
    this.sceneEl = null;
    this.svg = null;
    this.busy = false;
    this._bubbleTimer = null;
  }

  get done() { return this.store.data.tasksDone; }
  has(taskId) { return this.done.includes(taskId); }

  allTasks() {
    return WORKSHOP_CHAPTERS.flatMap(ch => ch.tasks.map(t => Object.assign({ chapter: ch }, t)));
  }

  /** Current chapter = first one with unfinished tasks (null when the shop is complete). */
  currentChapter() {
    return WORKSHOP_CHAPTERS.find(ch => ch.tasks.some(t => !this.has(t.id))) || null;
  }

  nextTask() {
    const ch = this.currentChapter();
    if (!ch) return null;
    const t = ch.tasks.find(x => !this.has(x.id));
    return Object.assign({ chapter: ch }, t);
  }

  rank() {
    const completed = WORKSHOP_CHAPTERS.filter(ch => ch.tasks.every(t => this.has(t.id)));
    const title = completed.length ? completed[completed.length - 1].rank : 'Çırak';
    const ch = this.currentChapter();
    if (!ch) return { title, next: null, done: 1, total: 1 };
    return { title, next: ch.rank, done: ch.tasks.filter(t => this.has(t.id)).length, total: ch.tasks.length };
  }

  canAfford(task) {
    return task && this.store.data.stars >= task.cost;
  }

  // ---------- Scene ----------
  mount(sceneEl) {
    this.sceneEl = sceneEl;
    sceneEl.innerHTML = WORKSHOP_SVG;
    this.svg = sceneEl.querySelector('svg');
    this.svg.addEventListener('click', e => {
      const mk = e.target.closest('[data-task]');
      if (mk) this.game.onWorkshopTask(mk.getAttribute('data-task'));
    });
    this.refresh();
  }

  setState(id, restored) {
    const off = this.svg.querySelector(`#ws-${id}-0`);
    const on = this.svg.querySelector(`#ws-${id}-1`);
    if (off) off.style.display = restored ? 'none' : '';
    if (on) on.style.display = restored ? '' : 'none';
  }

  refresh() {
    if (!this.svg) return;
    this.allTasks().forEach(t => this.setState(t.id, this.has(t.id)));
    const n = this.done.length;
    const dark = Math.max(0, 0.46 - n * 0.022 - (this.has('lamp') ? 0.12 : 0) - (this.has('window') ? 0.06 : 0));
    this.svg.querySelector('#ws-dark').setAttribute('opacity', dark.toFixed(2));
    const dust = this.svg.querySelector('#ws-dust');
    dust.style.opacity = this.has('cobwebs') ? Math.max(0, 0.5 - n * 0.06) : 1;
    this.svg.querySelector('#ws-beam').style.display = this.has('window') ? '' : 'none';
    this.renderArtifacts();
    this.renderMarkers();
  }

  renderArtifacts() {
    const g = this.svg.querySelector('#ws-artifacts');
    const owned = this.store.data.artifacts;
    const slots = [[268, 222], [297, 222], [326, 222], [268, 262], [297, 262], [326, 262], [268, 302], [297, 302], [326, 302]];
    g.innerHTML = owned.slice(0, slots.length).map((id, i) => {
      const art = window.Levels.ARTIFACTS.find(a => a.id === id);
      return art ? `<text x="${slots[i][0]}" y="${slots[i][1]}" font-size="17" text-anchor="middle">${art.icon}</text>` : '';
    }).join('');
  }

  renderMarkers() {
    const g = this.svg.querySelector('#ws-markers');
    const t = this.nextTask();
    if (!t || this.busy) { g.innerHTML = ''; return; }
    const ready = this.canAfford(t);
    const [x, y] = t.at;
    // Outer group positions (SVG attribute), inner group animates (CSS) so they don't clash
    g.innerHTML = `
      <g transform="translate(${x} ${y})">
        <g class="ws-marker ${ready ? 'ready' : ''}" data-task="${t.id}">
          <circle r="26" fill="transparent"/>
          <circle class="ws-marker-ring" r="17"/>
          <circle class="ws-marker-dot" r="13"/>
          <text y="5" text-anchor="middle" font-size="14">${ready ? '🔨' : '🔒'}</text>
        </g>
      </g>`;
  }

  // ---------- Restoration sequence ----------
  async restore(taskId) {
    const t = this.allTasks().find(x => x.id === taskId);
    if (!t || this.has(t.id) || this.busy) return false;
    if (!this.canAfford(t)) return false;
    this.busy = true;
    this.renderMarkers();
    const game = this.game;
    const sound = window.soundEngine;
    const data = this.store.data;

    data.stars -= t.cost;
    game.updateCurrencyUI();

    // Zoom the camera onto the item
    const [x, y] = t.at;
    const pt = this.pointToClient(x, y);
    const box = this.svg.getBoundingClientRect();
    this.svg.style.transformOrigin = `${pt.x - box.left}px ${pt.y - box.top}px`;
    this.svg.classList.add('ws-zoom');
    await wait(450);

    // Dust cloud + hammer taps
    const puff = this.svg.querySelector('#ws-puff');
    puff.setAttribute('transform', `translate(${x} ${y})`);
    puff.classList.remove('go');
    void puff.getBoundingClientRect();
    puff.classList.add('go');
    for (let i = 0; i < 3; i++) {
      sound.playHammer(i);
      await wait(220);
    }

    // Swap broken → restored
    data.tasksDone.push(t.id);
    this.store.save();
    this.setState(t.id, true);
    const on = this.svg.querySelector(`#ws-${t.id}-1`);
    if (on) {
      on.classList.remove('ws-pop');
      void on.getBoundingClientRect();
      on.classList.add('ws-pop');
    }
    sound.playWorkshopUpgrade();
    window.fx.burst(this.pointToClient(x, y), { count: 26, spread: 120 });
    this.refresh();
    await wait(700);

    this.svg.classList.remove('ws-zoom');
    await wait(350);
    this.say(t.line, 4200);
    if (t.perk) window.fx.toast(`Yeni usta avantajı: ${t.perk}`, 'perk', 3200);

    // Chapter finished?
    const ch = t.chapter;
    const chapterDone = ch.tasks.every(x => this.has(x.id));
    this.busy = false;
    this.renderMarkers();
    game.updateHomeUI();
    if (chapterDone) {
      await wait(900);
      game.showChapterComplete(ch);
    }
    return true;
  }

  /** Scene coordinates → viewport px (viewBox 0 -34 360 474, xMidYMax meet). */
  pointToClient(x, y) {
    const r = this.svg.getBoundingClientRect();
    const s = Math.min(r.width / 360, r.height / 474);
    const ox = r.left + (r.width - 360 * s) / 2;
    const oy = r.top + (r.height - 474 * s);
    return { x: ox + x * s, y: oy + (y + 34) * s };
  }

  // ---------- Master's speech bubble ----------
  say(text, ms = 3600) {
    const bubble = document.getElementById('master-bubble');
    const txt = document.getElementById('master-text');
    if (!bubble || !txt) return;
    txt.textContent = '';
    bubble.classList.remove('hidden');
    clearTimeout(this._bubbleTimer);
    clearInterval(this._typeTimer);
    let i = 0;
    this._typeTimer = setInterval(() => {
      i += 2;
      txt.textContent = text.slice(0, i);
      if (i % 6 === 0) window.soundEngine.playBlip();
      if (i >= text.length) clearInterval(this._typeTimer);
    }, 28);
    this._bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), ms + text.length * 14);
  }

  randomTip() {
    return MASTER_TIPS[Math.floor(Math.random() * MASTER_TIPS.length)];
  }
}

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/* ------------------------------------------------------------------
 * The shop scene. Groups named ws-<task>-0 are the broken state,
 * ws-<task>-1 the restored one.
 * ------------------------------------------------------------------ */
const WORKSHOP_SVG = `
<svg viewBox="0 -34 360 474" preserveAspectRatio="xMidYMax meet" xmlns="http://www.w3.org/2000/svg" aria-label="Atölye">
  <defs>
    <linearGradient id="g-wall-old" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2c22"/><stop offset="1" stop-color="#241911"/></linearGradient>
    <linearGradient id="g-wall-new" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f5446"/><stop offset="1" stop-color="#1d3a2f"/></linearGradient>
    <pattern id="p-damask" width="26" height="30" patternUnits="userSpaceOnUse">
      <path d="M13 5c4 5 4 10 0 15c-4-5-4-10 0-15z" fill="#d9b85a" opacity="0.16"/>
      <circle cx="0" cy="27" r="1.6" fill="#d9b85a" opacity="0.2"/><circle cx="26" cy="27" r="1.6" fill="#d9b85a" opacity="0.2"/>
    </pattern>
    <pattern id="p-peg" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.1" fill="#2c1a0d"/></pattern>
    <linearGradient id="g-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5432"/><stop offset="1" stop-color="#4f2c16"/></linearGradient>
    <linearGradient id="g-wood-h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6e3f22"/><stop offset=".5" stop-color="#93603a"/><stop offset="1" stop-color="#5c331b"/></linearGradient>
    <linearGradient id="g-floor-old" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3129"/><stop offset="1" stop-color="#211a15"/></linearGradient>
    <linearGradient id="g-floor-new" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6438"/><stop offset="1" stop-color="#5a3519"/></linearGradient>
    <linearGradient id="g-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#d4af37"/><stop offset="1" stop-color="#7a5a12"/></linearGradient>
    <linearGradient id="g-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fd3f5"/><stop offset=".7" stop-color="#f6d9a0"/><stop offset="1" stop-color="#f0b77a"/></linearGradient>
    <radialGradient id="g-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <linearGradient id="g-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity=".28"/><stop offset="1" stop-color="#fff0c0" stop-opacity="0"/></linearGradient>
    <radialGradient id="g-face" cx=".5" cy=".45" r=".55"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#d9ccb0"/></radialGradient>
  </defs>

  <!-- ===== WALL ===== -->
  <g id="ws-wall-0">
    <rect width="360" height="300" fill="url(#g-wall-old)"/>
    <ellipse cx="70" cy="46" rx="48" ry="20" fill="#000" opacity=".22"/>
    <ellipse cx="300" cy="230" rx="40" ry="26" fill="#000" opacity=".2"/>
    <ellipse cx="230" cy="120" rx="26" ry="40" fill="#5b4632" opacity=".25"/>
    <path d="M318 6l-8 22 6 12-12 20 5 10" stroke="#120b07" stroke-width="1.6" fill="none"/>
    <path d="M40 200l10 12-4 14 9 10" stroke="#120b07" stroke-width="1.4" fill="none"/>
    <path d="M205 190l24-7 6 16-20 9z" fill="#4c3a2b"/>
    <rect y="226" width="360" height="74" fill="#2a1d15"/>
    <path d="M0 226h360" stroke="#140d08" stroke-width="3"/>
    <path d="M60 232v62M140 232v40M230 232v62M300 240v54" stroke="#140d08" stroke-width="2"/>
    <path d="M140 272l12 8-6 14" stroke="#140d08" stroke-width="2" fill="none"/>
  </g>
  <g id="ws-wall-1" style="display:none">
    <rect width="360" height="300" fill="url(#g-wall-new)"/>
    <rect width="360" height="224" fill="url(#p-damask)"/>
    <rect y="226" width="360" height="74" fill="url(#g-wood)"/>
    <rect y="221" width="360" height="6" fill="#c9a64a"/>
    <g fill="none" stroke="#3a1f0e" stroke-width="2" opacity=".7">
      <rect x="10" y="236" width="70" height="54" rx="3"/><rect x="96" y="236" width="80" height="54" rx="3"/>
      <rect x="192" y="236" width="80" height="54" rx="3"/><rect x="288" y="236" width="62" height="54" rx="3"/>
    </g>
  </g>
  <!-- Ceiling with beams -->
  <rect y="-34" width="360" height="42" fill="#1a0f08"/>
  <g fill="#2c180c" stroke="#120904" stroke-width="1.5">
    <rect x="-4" y="-34" width="368" height="12"/>
    <path d="M30 -22h22l6 30H24zM160 -22h22l6 30h-34zM290 -22h22l6 30h-34z"/>
  </g>
  <rect y="4" width="360" height="5" fill="#3a2414"/>

  <!-- ===== FLOOR ===== -->
  <g id="ws-floor-0">
    <rect y="300" width="360" height="140" fill="url(#g-floor-old)"/>
    <g stroke="#15100c" stroke-width="2"><path d="M0 330h360M0 364h360M0 402h360"/><path d="M70 300v30M190 330v34M110 364v38M260 300v30M300 364v38M40 402v38M220 402v38"/></g>
    <path d="M150 366l60 0-6 34-48 0z" fill="#0d0907"/>
    <g fill="#5a4a3a" opacity=".8"><rect x="40" y="415" width="10" height="4" transform="rotate(20 45 417)"/><rect x="250" y="345" width="14" height="3"/><circle cx="320" cy="420" r="3"/></g>
  </g>
  <g id="ws-floor-1" style="display:none">
    <rect y="300" width="360" height="140" fill="url(#g-floor-new)"/>
    <g stroke="#3f230f" stroke-width="1.6" opacity=".7"><path d="M0 330h360M0 364h360M0 402h360"/><path d="M70 300v30M190 330v34M110 364v38M260 300v30M300 364v38M40 402v38M220 402v38"/></g>
    <path d="M0 308h360v10H0z" fill="#fff" opacity=".06"/>
    <path d="M30 380h120l-20 40H10z" fill="#fff" opacity=".05"/>
  </g>
  <rect y="296" width="360" height="6" fill="#1a100a"/>

  <!-- ===== WINDOW ===== -->
  <g id="ws-window-0">
    <rect x="246" y="54" width="92" height="124" fill="#1b130d" stroke="#0f0905" stroke-width="5"/>
    <rect x="252" y="60" width="80" height="112" fill="#2a2f33"/>
    <path d="M262 70l20 30-6 20M310 64l-12 40 18 30" stroke="#8a949c" stroke-width="1" opacity=".5" fill="none"/>
    <rect x="236" y="90" width="112" height="14" fill="#5a3d26" transform="rotate(-18 292 97)"/>
    <rect x="236" y="128" width="112" height="14" fill="#4f341f" transform="rotate(14 292 135)"/>
    <g fill="#222"><circle cx="252" cy="108" r="1.8"/><circle cx="332" cy="80" r="1.8"/><circle cx="252" cy="122" r="1.8"/><circle cx="332" cy="148" r="1.8"/></g>
  </g>
  <g id="ws-window-1" style="display:none">
    <rect x="246" y="54" width="92" height="124" fill="url(#g-wood-h)" rx="3"/>
    <rect x="252" y="60" width="80" height="112" fill="url(#g-sky)"/>
    <path d="M252 150l10-12 8 6 12-16 10 10 8-6 14 12 6-4 12 8v20h-80z" fill="#7a5a48" opacity=".6"/>
    <path d="M292 60v112M252 116h80" stroke="#6b4325" stroke-width="4"/>
    <path d="M246 52c10 30 6 70 14 128h-16V52z" fill="#8c1f2b"/><path d="M338 52c-10 30-6 70-14 128h16V52z" fill="#8c1f2b"/>
    <rect x="240" y="176" width="104" height="8" rx="2" fill="url(#g-wood)"/>
    <path d="M318 176h16l-3 -12h-10z" fill="#a0522d"/>
    <path d="M326 164c-8-10-4-18 0-22c4 4 8 12 0 22zM326 164c-12-4-14-12-12-16c4 0 12 6 12 16zM326 164c12-4 14-12 12-16c-4 0-12 6-12 16z" fill="#3f9b52"/>
  </g>

  <!-- ===== SIGN ===== -->
  <g id="ws-sign-0">
    <path d="M140 0v16M220 0v6" stroke="#3a2a1e" stroke-width="1.5"/>
    <g transform="rotate(9 180 30)">
      <rect x="108" y="16" width="144" height="26" rx="3" fill="#4a3424" stroke="#26180e" stroke-width="2"/>
      <text x="180" y="34" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11" fill="#7d6a58" letter-spacing="2">S A T  A T Ö L Y</text>
    </g>
  </g>
  <g id="ws-sign-1" style="display:none">
    <path d="M118 0v14M242 0v14" stroke="#c9a64a" stroke-width="1.6"/>
    <rect x="96" y="12" width="168" height="34" rx="6" fill="url(#g-brass)" stroke="#7a5a12" stroke-width="2"/>
    <text x="180" y="28" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="11" font-weight="900" fill="#3a2508" letter-spacing="1.5">HALİL USTA</text>
    <text x="180" y="40" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="7" fill="#4a3210" letter-spacing="1">SAAT &amp; KİLİT ATÖLYESİ · 1923</text>
  </g>

  <!-- ===== WALL CLOCKS ===== -->
  <g id="ws-wallclocks-0" fill="none" stroke="#000" opacity=".35" stroke-dasharray="3 3">
    <circle cx="90" cy="82" r="17"/><circle cx="126" cy="70" r="12"/><circle cx="146" cy="96" r="10"/>
  </g>
  <g id="ws-wallclocks-1" style="display:none">
    <g><circle cx="90" cy="82" r="18" fill="url(#g-brass)"/><circle cx="90" cy="82" r="14" fill="url(#g-face)"/>
      <line class="ws-hand ws-hand-m" x1="90" y1="82" x2="90" y2="71" stroke="#222" stroke-width="1.6" style="transform-origin:90px 82px"/>
      <line class="ws-hand ws-hand-h" x1="90" y1="82" x2="97" y2="82" stroke="#222" stroke-width="2.2" style="transform-origin:90px 82px"/></g>
    <g><circle cx="126" cy="70" r="13" fill="#5a2e1a"/><circle cx="126" cy="70" r="10" fill="url(#g-face)"/>
      <line class="ws-hand ws-hand-s" x1="126" y1="70" x2="126" y2="62" stroke="#a11" stroke-width="1" style="transform-origin:126px 70px"/>
      <line class="ws-hand ws-hand-m" x1="126" y1="70" x2="131" y2="66" stroke="#222" stroke-width="1.5" style="transform-origin:126px 70px"/></g>
    <g><circle cx="146" cy="96" r="11" fill="#30404a"/><circle cx="146" cy="96" r="8" fill="url(#g-face)"/>
      <line class="ws-hand ws-hand-m" x1="146" y1="96" x2="146" y2="90" stroke="#222" stroke-width="1.3" style="transform-origin:146px 96px"/></g>
  </g>

  <!-- ===== PORTRAIT ===== -->
  <g id="ws-portrait-0"><rect x="172" y="116" width="44" height="56" fill="#000" opacity=".18"/><circle cx="194" cy="112" r="2" fill="#222"/></g>
  <g id="ws-portrait-1" style="display:none">
    <path d="M194 104l-16 12M194 104l16 12" stroke="#c9a64a" stroke-width="1"/>
    <rect x="170" y="114" width="48" height="60" rx="3" fill="url(#g-brass)"/>
    <rect x="175" y="119" width="38" height="50" fill="#2b3b44"/>
    <path d="M178 169c2-12 10-16 16-16s14 4 16 16z" fill="#4a2f22"/>
    <circle cx="194" cy="140" r="9" fill="#e8c09a"/>
    <path d="M185 137c0-8 18-8 18 0c-2-3-16-3-18 0z" fill="#ddd"/>
    <path d="M187 145c3 3 4-1 7 0c3-1 4 3 7 0c-1 4-5 4-7 2c-2 2-6 2-7-2z" fill="#f5f5f5"/>
    <circle cx="198" cy="139" r="3" fill="none" stroke="#c9a64a" stroke-width="1"/>
  </g>

  <!-- ===== TOOL BOARD ===== -->
  <g id="ws-tools-0">
    <rect x="66" y="126" width="84" height="64" fill="#3a2a1e" stroke="#1e140c" stroke-width="2" transform="rotate(-4 108 158)"/>
    <g stroke="#2a2a2a" stroke-width="2"><path d="M80 140l2 6M120 136l-2 6M136 160l3 4"/></g>
    <path d="M92 170l18-6" stroke="#6b5040" stroke-width="3"/>
    <g transform="translate(0 4)"><path d="M90 336l22-6" stroke="#777" stroke-width="2.5"/><rect x="84" y="333" width="10" height="5" fill="#7a3b1a" transform="rotate(-15 89 335)"/><path d="M200 346l14 4" stroke="#888" stroke-width="2"/></g>
  </g>
  <g id="ws-tools-1" style="display:none">
    <rect x="64" y="124" width="88" height="68" rx="3" fill="#7a5232" stroke="#3a2210" stroke-width="2"/>
    <rect x="68" y="128" width="80" height="60" fill="url(#p-peg)"/>
    <g><rect x="74" y="134" width="5" height="14" rx="1.5" fill="#b22"/><rect x="75.6" y="148" width="1.8" height="22" fill="#ccc"/></g>
    <g><rect x="84" y="134" width="5" height="14" rx="1.5" fill="#2a5db0"/><rect x="85.6" y="148" width="1.8" height="18" fill="#ccc"/></g>
    <g><rect x="94" y="134" width="5" height="14" rx="1.5" fill="#d4af37"/><rect x="95.6" y="148" width="1.8" height="14" fill="#ccc"/></g>
    <path d="M110 136l6 28M122 136l-6 28" stroke="#9aa5ad" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M132 136v26M136 136v26" stroke="#c0c6cc" stroke-width="1.4"/>
    <circle cx="140" cy="176" r="6" fill="#bfe3ff" opacity=".7" stroke="#d4af37" stroke-width="2"/>
  </g>

  <!-- ===== GRANDFATHER CLOCK ===== -->
  <g id="ws-grandclock-0">
    <path d="M12 120q24-16 48 0l6 220H8z" fill="#5d5145"/>
    <path d="M22 130l-4 200M38 126v206M52 132l6 198" stroke="#463c33" stroke-width="2" opacity=".7"/>
  </g>
  <g id="ws-grandclock-1" style="display:none">
    <path d="M12 128q24-26 48 0z" fill="#5c2f17"/>
    <rect x="14" y="126" width="44" height="214" rx="3" fill="url(#g-wood)"/>
    <circle cx="36" cy="146" r="14" fill="url(#g-brass)"/><circle cx="36" cy="146" r="11" fill="url(#g-face)"/>
    <line class="ws-hand ws-hand-m" x1="36" y1="146" x2="36" y2="137" stroke="#222" stroke-width="1.4" style="transform-origin:36px 146px"/>
    <rect x="24" y="170" width="24" height="132" rx="2" fill="#20120a"/>
    <rect x="24" y="170" width="24" height="132" rx="2" fill="#bfe3ff" opacity=".08"/>
    <g class="ws-pendulum" style="transform-origin:36px 172px">
      <line x1="36" y1="172" x2="36" y2="270" stroke="#c9a64a" stroke-width="1.6"/>
      <circle cx="36" cy="276" r="8" fill="url(#g-brass)"/>
    </g>
    <rect x="10" y="334" width="52" height="8" rx="2" fill="#3a1d0c"/>
  </g>

  <!-- ===== WORKBENCH ===== -->
  <g id="ws-bench-0">
    <rect x="72" y="238" width="160" height="12" fill="#4a3424" transform="rotate(6 150 244)"/>
    <rect x="80" y="252" width="8" height="78" fill="#3a271a"/>
    <rect x="214" y="262" width="8" height="40" fill="#3a271a" transform="rotate(12 218 282)"/>
    <rect x="100" y="300" width="40" height="30" fill="#2e2016" stroke="#1a110a"/>
    <circle cx="190" cy="324" r="10" fill="none" stroke="#6b5a4a" stroke-width="2"/>
    <path d="M184 320l12 8" stroke="#6b5a4a" stroke-width="1.5"/>
  </g>
  <g id="ws-bench-1" style="display:none">
    <rect x="66" y="236" width="170" height="14" rx="2" fill="url(#g-wood-h)"/>
    <rect x="72" y="250" width="158" height="50" fill="#5a3019"/>
    <g fill="#6e3d20" stroke="#3a1d0c" stroke-width="1.5"><rect x="78" y="256" width="46" height="18" rx="2"/><rect x="128" y="256" width="46" height="18" rx="2"/><rect x="178" y="256" width="46" height="18" rx="2"/><rect x="78" y="278" width="146" height="16" rx="2"/></g>
    <g fill="#d4af37"><circle cx="101" cy="265" r="2.4"/><circle cx="151" cy="265" r="2.4"/><circle cx="201" cy="265" r="2.4"/><circle cx="151" cy="286" r="2.4"/></g>
    <rect x="74" y="300" width="10" height="34" fill="#3a1d0c"/><rect x="218" y="300" width="10" height="34" fill="#3a1d0c"/>
    <rect x="80" y="222" width="22" height="14" rx="2" fill="#6b7680"/><rect x="76" y="218" width="30" height="5" fill="#8b969e"/>
    <circle cx="150" cy="230" r="7" fill="url(#g-brass)"/><circle cx="150" cy="230" r="5" fill="url(#g-face)"/>
    <path d="M196 236v-26h6l14 -10" stroke="#2f5a3a" stroke-width="3" fill="none"/>
    <path d="M206 200l20 -6 4 10-20 6z" fill="#2f6b45"/>
    <ellipse cx="220" cy="206" rx="12" ry="5" fill="#ffe9a8" opacity=".35"/>
  </g>

  <!-- ===== DISPLAY CABINET ===== -->
  <g id="ws-cabinet-0">
    <rect x="250" y="196" width="94" height="148" fill="#2d2119" stroke="#1a110b" stroke-width="3"/>
    <path d="M254 236h86M254 276h86M254 316h86" stroke="#1a110b" stroke-width="3"/>
    <path d="M262 206l20 24-8 20M320 210l-10 30 16 20" stroke="#8a949c" stroke-width="1" opacity=".4" fill="none"/>
  </g>
  <g id="ws-cabinet-1" style="display:none">
    <rect x="248" y="192" width="98" height="152" rx="3" fill="url(#g-wood)"/>
    <rect x="254" y="200" width="86" height="136" fill="#1a0f08"/>
    <path d="M254 236h86M254 276h86M254 316h86" stroke="#c9a64a" stroke-width="2"/>
    <rect x="254" y="200" width="86" height="136" fill="#cfefff" opacity=".1"/>
    <path d="M258 204l20 40M300 204l18 34" stroke="#fff" opacity=".18" stroke-width="3"/>
    <rect x="280" y="340" width="34" height="6" rx="1" fill="url(#g-brass)"/>
  </g>
  <g id="ws-artifacts"></g>

  <!-- ===== COUNTER BELL ===== -->
  <g id="ws-counter-1" style="display:none">
    <path d="M308 192a10 10 0 0 1 20 0z" fill="url(#g-brass)"/><rect x="305" y="191" width="26" height="3" rx="1" fill="#7a5a12"/><circle cx="318" cy="180" r="2" fill="#d4af37"/>
    <rect x="104" y="214" width="34" height="22" rx="3" fill="url(#g-brass)"/><rect x="108" y="218" width="26" height="8" fill="#3a2508"/>
    <g fill="#fff3c4"><circle cx="112" cy="231" r="1.5"/><circle cx="118" cy="231" r="1.5"/><circle cx="124" cy="231" r="1.5"/><circle cx="130" cy="231" r="1.5"/></g>
  </g>

  <!-- ===== RUG ===== -->
  <g id="ws-rug-1" style="display:none">
    <path d="M78 368h204l26 56H52z" fill="#7a1f2b"/>
    <path d="M90 374h180l20 44H70z" fill="none" stroke="#d4af37" stroke-width="2"/>
    <path d="M180 380l24 18-24 18-24-18z" fill="#c9a64a" opacity=".7"/>
    <path d="M120 390l10 8-10 8-10-8zM240 390l10 8-10 8-10-8z" fill="#2f5446"/>
    <path d="M56 426h248" stroke="#e8d3a0" stroke-width="3" stroke-dasharray="2 3"/>
  </g>

  <!-- ===== COBWEBS & DUST ===== -->
  <g id="ws-cobwebs-0" stroke="#cfc6b8" stroke-width=".8" fill="none" opacity=".55">
    <path d="M0 0l60 40M0 0l40 60M0 0l66 14M0 0l14 66"/><path d="M14 10q6 6 10 0M24 18q12 10 22 0M8 24q-2 14 10 10M30 34q10 16 24 4"/>
    <path d="M360 0l-58 38M360 0l-34 58M360 0l-64 12"/><path d="M340 12q-8 8-14 0M326 26q-12 10-22 0M346 30q4 14-8 12"/>
    <path d="M150 300l-30 30M150 300l0 34M150 300l30 30"/><path d="M134 316q16 10 32 0"/>
  </g>
  <g id="ws-dust">
    <circle class="mote m1" cx="60" cy="200" r="1.4" fill="#e8dcc0"/><circle class="mote m2" cx="140" cy="120" r="1.1" fill="#e8dcc0"/>
    <circle class="mote m3" cx="220" cy="240" r="1.6" fill="#e8dcc0"/><circle class="mote m1" cx="300" cy="80" r="1.2" fill="#e8dcc0"/>
    <circle class="mote m2" cx="190" cy="360" r="1.3" fill="#e8dcc0"/><circle class="mote m3" cx="90" cy="300" r="1" fill="#e8dcc0"/>
  </g>

  <!-- ===== DARKNESS & LIGHT ===== -->
  <rect id="ws-dark" y="-34" width="360" height="474" fill="#0b0604" opacity=".45" pointer-events="none"/>
  <g id="ws-lamp-0">
    <line x1="195" y1="0" x2="195" y2="70" stroke="#1a1a1a" stroke-width="1.5"/>
    <circle cx="195" cy="74" r="6" fill="#4a4a4a"/>
    <path d="M190 78l4 7 4-6" stroke="#999" stroke-width="1" fill="none"/>
  </g>
  <g id="ws-lamp-1" style="display:none">
    <circle class="ws-glow" cx="195" cy="110" r="150" fill="url(#g-glow)" pointer-events="none"/>
    <line x1="195" y1="0" x2="195" y2="64" stroke="#c9a64a" stroke-width="1.6"/>
    <path d="M176 86h38l-10-20h-18z" fill="url(#g-brass)" stroke="#7a5a12"/>
    <ellipse cx="195" cy="89" rx="6" ry="4" fill="#fff6d0"/>
  </g>
  <path id="ws-beam" d="M252 172l80 0 20 268H170z" fill="url(#g-beam)" pointer-events="none" style="display:none"/>

  <!-- ===== GRAND OPENING ===== -->
  <g id="ws-opening-1" style="display:none">
    <g transform="translate(0 -20)">
    <path d="M0 20q90 26 180 0q90 26 180 0" stroke="#d4af37" stroke-width="1.4" fill="none"/>
      <path d="M20 23l8 16 8-14z" fill="#c0392b"/><path d="M48 28l8 16 8-14z" fill="#2f6b45"/><path d="M78 31l8 16 8-14z" fill="#d4af37"/>
      <path d="M108 30l8 16 8-14z" fill="#2a5db0"/><path d="M138 25l8 16 8-14z" fill="#c0392b"/><path d="M200 25l8 16 8-14z" fill="#2f6b45"/>
      <path d="M232 30l8 16 8-14z" fill="#d4af37"/><path d="M262 31l8 16 8-14z" fill="#2a5db0"/><path d="M292 28l8 16 8-14z" fill="#c0392b"/><path d="M322 23l8 16 8-14z" fill="#2f6b45"/>
    </g>
    <path d="M282 116l10-10 10 10" stroke="#c9a64a" fill="none"/>
    <rect x="272" y="116" width="40" height="18" rx="3" fill="#2f6b45" stroke="#d4af37"/>
    <text x="292" y="129" text-anchor="middle" font-family="Cinzel, Georgia, serif" font-size="9" font-weight="900" fill="#fff3c4">AÇIK</text>
  </g>

  <g id="ws-puff" pointer-events="none">
    <circle class="pf p1" r="14" fill="#d9cdb8"/><circle class="pf p2" r="11" fill="#cfc2aa"/><circle class="pf p3" r="16" fill="#e6dccb"/>
    <circle class="pf p4" r="10" fill="#d9cdb8"/><circle class="pf p5" r="12" fill="#cfc2aa"/>
  </g>
  <g id="ws-markers"></g>
</svg>`;

window.Workshop = Workshop;
window.WORKSHOP_CHAPTERS = WORKSHOP_CHAPTERS;
