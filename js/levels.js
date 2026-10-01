/**
 * ChronoMaster: Antique Clock & Mechanism Levels
 * Hand-crafted puzzle layouts with realistic horology components and strict layer dependencies.
 */

const SCREW_TYPES = {
  gold: { name: 'Pirinç Vida', colorClass: 'screw-gold', hex: '#ffd700', borderHex: '#855d14' },
  steel: { name: 'Mavi Çelik Vida', colorClass: 'screw-steel', hex: '#638eb4', borderHex: '#1f2f3d' },
  ruby: { name: 'Yakut Taşlı Vida', colorClass: 'screw-ruby', hex: '#d12d4a', borderHex: '#5e0c1b' },
  copper: { name: 'Eski Bakır Vida', colorClass: 'screw-copper', hex: '#b85d38', borderHex: '#572511' }
};

const MUSEUM_ARTIFACTS = [
  {
    id: 1,
    key: 'pocket_watch',
    title: '1892 Londra Altın Cep Saati',
    category: 'Avcı Kasa Cep Saati',
    year: '1892',
    icon: '🕰️',
    desc: 'İsviçre kollu eşapmanlı ve 18 ayar altın avcı kasalı şaheser. Demiryolu şeflerinin dakikliği için üretilmiştir.',
    passiveRate: 5,
    requiredLevel: 1
  },
  {
    id: 2,
    key: 'pendulum_clock',
    title: 'Viyana Saray Duvar Saati',
    category: 'Regülatör Sarkaç',
    year: '1840',
    icon: '⏰',
    desc: 'Ağır pirinç sarkaç ile yerçekimi enerjisini saniyelere bölen, 8 günlük rezervli saray salon saati.',
    passiveRate: 10,
    requiredLevel: 2
  },
  {
    id: 3,
    key: 'chubb_safe',
    title: '1875 Chubb & Sons Çelik Kasası',
    category: 'Aşılmaz Kasa Kilidi',
    year: '1875',
    icon: '🔐',
    desc: 'İngiltere Bankası için üretilen, çapraz emniyet kollu ve delinmez manganez çelik gövdeli tarihi kasa.',
    passiveRate: 15,
    requiredLevel: 3
  },
  {
    id: 4,
    key: 'astrolabe',
    title: '16. Yüzyıl Seyir Usturlabı',
    category: 'Venedik Astronomi Çarkı',
    year: '1580',
    icon: '🧭',
    desc: 'Açık denizlerde yıldızların ve güneşin açısını ölçerek rotayı belirleyen bronz seyir ve yön aleti.',
    passiveRate: 20,
    requiredLevel: 4
  },
  {
    id: 5,
    key: 'lattice_lock',
    title: '1720 Nürnberg Kafes Kilidi',
    category: 'Interlocking Zırh Kilidi',
    year: '1720',
    icon: '🗝️',
    desc: 'Birbirini kilitleyen dikey ve yatay çelik kafes kollarıyla korunan tarihi kasa sandığı.',
    passiveRate: 25,
    requiredLevel: 5
  },
  {
    id: 6,
    key: 'music_box',
    title: '1860 Cenevre Kraliyet Müzik Kutusu',
    category: 'Pirinç Silindir & Tarak',
    year: '1860',
    icon: '🎵',
    desc: 'Çelik tarak dişlerine çarparak klasik besteleri çalan yüzlerce minik pirinç pimli antika müzik kutusu.',
    passiveRate: 30,
    requiredLevel: 6
  },
  {
    id: 7,
    key: 'chronometer_h4',
    title: '1761 Harrison H4 Deniz Kronometresi',
    category: 'Kraliyet Başyapıtı',
    year: '1761',
    icon: '👑',
    desc: 'Boylam sorununu çözen, okyanus dalgalarına ve ısıya meydan okuyarak modern denizciliği başlatan başyapıt.',
    passiveRate: 45,
    requiredLevel: 7
  }
];

const WORKSHOP_UPGRADES = [
  {
    id: 'bench',
    title: 'Maun Usta Tezgahı',
    category: 'Çalışma Alanı',
    cost: 150,
    icon: '🪵',
    beforeIcon: '🏚️',
    desc: 'Eski kırık tahtadan, pirinç kakmalı ve cilalı masif maun ağacı tezgaha yükseltme.',
    perk: '+%15 Bölüm Sonu Dişli Bonusu'
  },
  {
    id: 'lamp',
    title: 'Viktorya Gaz Avizesi',
    category: 'Aydınlatma',
    cost: 250,
    icon: '🏮',
    beforeIcon: '🕯️',
    desc: 'Titrek gaz lambasından, sıcak amber ışığı yayan pirinç kollu Viktorya avizesine yükseltme.',
    perk: 'Kombo Süresini ve Şansını Artırır'
  },
  {
    id: 'clock',
    title: 'Londra Ayaklı Sarkaç Saati',
    category: 'Zaman Ölçer',
    cost: 400,
    icon: '🕰️',
    beforeIcon: '📦',
    desc: 'Dükkanın köşesine yerleştirilen 8 günlük rezervli pirinç ağırlıklı görkemli salon saati.',
    perk: 'Müze Pasif Gelirini x2 Yapar'
  },
  {
    id: 'tools',
    title: 'Kadife Alet Standı & Büyüteç',
    category: 'Saatçi Ekipmanı',
    cost: 350,
    icon: '🪛',
    beforeIcon: '🔧',
    desc: 'Paslı dağınık aletler yerine bordo kadife astarlı pirinç cımbız ve tornavida seti.',
    perk: 'Her Seviyeye +1 Bedava Geri Al ile Başla'
  },
  {
    id: 'cabinet',
    title: 'Kraliyet Cam Vitrini',
    category: 'Koleksiyon Vitrini',
    cost: 500,
    icon: '💎',
    beforeIcon: '🕸️',
    desc: 'Örümcek ağlı eski raflar yerine kristal camlı ve kadife zeminli antika teşhir dolabı.',
    perk: 'Bölümlerde Sandıktan %50 Fazla Ödül'
  },
  {
    id: 'rug',
    title: 'Pers Saray Halısı',
    category: 'Dekor & Prestij',
    cost: 300,
    icon: '🧶',
    beforeIcon: '🪵',
    desc: 'Çıplak tozlu zemin tahtalarını örten el dokuması antika pers halısı.',
    perk: 'Atölye Prestijini Zirveye Taşır'
  }
];

const LEVELS = [
  // ==========================================
  // SEVİYE 1: Cep Saati Arka Kapağı (Giriş & Katman Kuralı)
  // ==========================================
  {
    id: 1,
    name: "SEVİYE 1",
    subtitle: "Cep Saati Arka Kapağı",
    partName: "1892 İsviçre Cep Saati Kapağı",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b2', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' }
    ],
    plates: [
      {
        id: 'p_base',
        layer: 1,
        type: 'rect',
        x: 200,
        y: 260,
        width: 260,
        height: 180,
        radius: 20,
        angle: 0,
        material: 'steel',
        name: 'Ana Çelik Gövde',
        dependsOn: ['p_top_bar'] // KURAL: p_top_bar tamamen sökülüp düşmeden p_base vidaları sökülemez!
      },
      {
        id: 'p_top_bar',
        layer: 2,
        type: 'bar',
        x: 200,
        y: 220,
        width: 220,
        height: 50,
        radius: 14,
        angle: 0,
        material: 'brass',
        name: 'Üst Pirinç Çıta',
        dependsOn: []
      }
    ],
    screws: [
      // 3 gold screws on top brass bar
      { id: 's1', x: 120, y: 220, color: 'gold', plates: ['p_top_bar', 'p_base'] },
      { id: 's2', x: 200, y: 220, color: 'gold', plates: ['p_top_bar', 'p_base'] },
      { id: 's3', x: 280, y: 220, color: 'gold', plates: ['p_top_bar', 'p_base'] },
      // 3 steel screws on base plate (Locked until p_top_bar is unpinned and cleared!)
      { id: 's4', x: 120, y: 310, color: 'steel', plates: ['p_base'] },
      { id: 's5', x: 200, y: 310, color: 'steel', plates: ['p_base'] },
      { id: 's6', x: 280, y: 310, color: 'steel', plates: ['p_base'] }
    ]
  },

  // ==========================================
  // SEVİYE 2: Sarkaç & Kovan (Salınım & Sarkaç Fiziği)
  // ==========================================
  {
    id: 2,
    name: "SEVİYE 2",
    subtitle: "Duvar Saati Sarkacı",
    partName: "Viyana Tipi Sarkaçlı Duvar Saati",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' },
      { id: 'b2', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' }
    ],
    plates: [
      {
        id: 'p_pendulum_bob',
        layer: 1,
        type: 'circle',
        x: 200,
        y: 350,
        radius: 65,
        material: 'brass',
        name: 'Sarkaç Çanı',
        dependsOn: ['p_pendulum_arm']
      },
      {
        id: 'p_pendulum_arm',
        layer: 2,
        type: 'bar',
        x: 200,
        y: 230,
        width: 44,
        height: 220,
        radius: 12,
        angle: 0,
        material: 'copper',
        name: 'Sarkaç Kolu',
        dependsOn: []
      }
    ],
    screws: [
      { id: 's1', x: 200, y: 150, color: 'steel', plates: ['p_pendulum_arm'] },
      { id: 's2', x: 200, y: 230, color: 'steel', plates: ['p_pendulum_arm'] },
      { id: 's3', x: 200, y: 310, color: 'steel', plates: ['p_pendulum_arm', 'p_pendulum_bob'] },
      // Screws on bob (locked until arm falls!)
      { id: 's4', x: 155, y: 370, color: 'gold', plates: ['p_pendulum_bob'] },
      { id: 's5', x: 245, y: 370, color: 'gold', plates: ['p_pendulum_bob'] },
      { id: 's6', x: 200, y: 395, color: 'gold', plates: ['p_pendulum_bob'] }
    ]
  },

  // ==========================================
  // SEVİYE 3: Antika Kasa Sürgüsü (3 Katmanlı Çapraz Kollar)
  // ==========================================
  {
    id: 3,
    name: "SEVİYE 3",
    subtitle: "Antika Kasa Sürgüsü",
    partName: "1875 Chubb & Sons Kasa Kilidi",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'ruby', capacity: 3, filled: 0, label: 'YAKUT KUTUSU' },
      { id: 'b2', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b3', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' }
    ],
    plates: [
      {
        id: 'p_plate_back',
        layer: 1,
        type: 'rect',
        x: 200,
        y: 260,
        width: 250,
        height: 250,
        radius: 20,
        angle: 0,
        material: 'steel',
        name: 'Arka Çelik Zırh',
        dependsOn: ['p_cross_1', 'p_cross_2']
      },
      {
        id: 'p_cross_1',
        layer: 2,
        type: 'bar',
        x: 200,
        y: 260,
        width: 240,
        height: 48,
        radius: 12,
        angle: 40 * (Math.PI / 180),
        material: 'brass',
        name: 'Alt Emniyet Kolu',
        dependsOn: ['p_cross_2'] // Cross 2 sits on top of Cross 1!
      },
      {
        id: 'p_cross_2',
        layer: 3,
        type: 'bar',
        x: 200,
        y: 260,
        width: 240,
        height: 48,
        radius: 12,
        angle: -40 * (Math.PI / 180),
        material: 'copper',
        name: 'Üst Emniyet Kolu',
        dependsOn: []
      }
    ],
    screws: [
      // Top layer Cross 2 (Ruby)
      { id: 's1', x: 120, y: 190, color: 'ruby', plates: ['p_cross_2', 'p_plate_back'] },
      { id: 's2', x: 200, y: 260, color: 'ruby', plates: ['p_cross_2', 'p_cross_1', 'p_plate_back'] },
      { id: 's3', x: 280, y: 330, color: 'ruby', plates: ['p_cross_2', 'p_plate_back'] },
      // Cross 1 (Gold - locked until Cross 2 falls!)
      { id: 's4', x: 120, y: 330, color: 'gold', plates: ['p_cross_1', 'p_plate_back'] },
      { id: 's5', x: 280, y: 190, color: 'gold', plates: ['p_cross_1', 'p_plate_back'] },
      { id: 's6', x: 200, y: 350, color: 'gold', plates: ['p_plate_back'] },
      // Back plate (Steel - locked until both Cross bars fall!)
      { id: 's7', x: 105, y: 260, color: 'steel', plates: ['p_plate_back'] },
      { id: 's8', x: 295, y: 260, color: 'steel', plates: ['p_plate_back'] },
      { id: 's9', x: 200, y: 170, color: 'steel', plates: ['p_plate_back'] }
    ]
  },

  // ==========================================
  // SEVİYE 4: Eşmerkezli Saat Çarkları (Eşapman & Çarklar)
  // ==========================================
  {
    id: 4,
    name: "SEVİYE 4",
    subtitle: "Denizci Usturlabı",
    partName: "16. Yüzyıl Pirinç Seyir Usturlabı",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b2', color: 'ruby', capacity: 3, filled: 0, label: 'YAKUT KUTUSU' },
      { id: 'b3', color: 'copper', capacity: 3, filled: 0, label: 'BAKIR KUTUSU' },
      { id: 'b4', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' }
    ],
    plates: [
      {
        id: 'p_gear_large',
        layer: 1,
        type: 'gear',
        x: 200,
        y: 270,
        radius: 110,
        teeth: 12,
        material: 'steel',
        name: 'Büyük Güneş Çarkı',
        dependsOn: ['p_gear_small', 'p_pointer_bar']
      },
      {
        id: 'p_gear_small',
        layer: 2,
        type: 'gear',
        x: 200,
        y: 270,
        radius: 70,
        teeth: 8,
        material: 'brass',
        name: 'Gezegen Çarkı',
        dependsOn: ['p_pointer_bar']
      },
      {
        id: 'p_pointer_bar',
        layer: 3,
        type: 'bar',
        x: 200,
        y: 270,
        width: 250,
        height: 42,
        radius: 10,
        angle: 15 * (Math.PI / 180),
        material: 'copper',
        name: 'Usturlap İbresi (Alidade)',
        dependsOn: []
      }
    ],
    screws: [
      // Pointer bar (Gold)
      { id: 's1', x: 100, y: 245, color: 'gold', plates: ['p_pointer_bar', 'p_gear_large'] },
      { id: 's2', x: 200, y: 270, color: 'gold', plates: ['p_pointer_bar', 'p_gear_small', 'p_gear_large'] },
      { id: 's3', x: 300, y: 295, color: 'gold', plates: ['p_pointer_bar', 'p_gear_large'] },
      // Small gear (Ruby - locked until pointer falls!)
      { id: 's4', x: 200, y: 215, color: 'ruby', plates: ['p_gear_small', 'p_gear_large'] },
      { id: 's5', x: 155, y: 305, color: 'ruby', plates: ['p_gear_small', 'p_gear_large'] },
      { id: 's6', x: 245, y: 305, color: 'ruby', plates: ['p_gear_small', 'p_gear_large'] },
      // Large gear outer (Copper)
      { id: 's7', x: 200, y: 180, color: 'copper', plates: ['p_gear_large'] },
      { id: 's8', x: 120, y: 270, color: 'copper', plates: ['p_gear_large'] },
      { id: 's9', x: 280, y: 270, color: 'copper', plates: ['p_gear_large'] },
      // Anchor (Steel)
      { id: 's10', x: 140, y: 345, color: 'steel', plates: ['p_gear_large'] },
      { id: 's11', x: 260, y: 345, color: 'steel', plates: ['p_gear_large'] },
      { id: 's12', x: 200, y: 360, color: 'steel', plates: ['p_gear_large'] }
    ],
    kineticTriggers: [
      {
        id: 'kt_astrolabe',
        triggerOnFall: 'p_pointer_bar',
        targetPlateId: 'p_gear_small',
        rotateAngle: 75 * (Math.PI / 180),
        message: 'Gezegen Çarkı Döndü: Vidalar Hizalandı! ⚙️',
        rotateScrews: ['s4', 's5', 's6']
      }
    ]
  },

  // ==========================================
  // SEVİYE 5: Nürnberg Kafes Kilidi (İç İçe Dokuma Çubuklar)
  // ==========================================
  {
    id: 5,
    name: "SEVİYE 5",
    subtitle: "Kafes Mekanizması",
    partName: "1720 Nürnberg Kafes Zırh Kilidi",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'copper', capacity: 3, filled: 0, label: 'BAKIR KUTUSU' },
      { id: 'b2', color: 'ruby', capacity: 3, filled: 0, label: 'YAKUT KUTUSU' },
      { id: 'b3', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b4', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' }
    ],
    plates: [
      {
        id: 'p_lattice_base',
        layer: 1,
        type: 'rect',
        x: 200,
        y: 260,
        width: 270,
        height: 270,
        radius: 25,
        angle: 0,
        material: 'steel',
        name: 'Kafes Taban Plakası',
        dependsOn: ['p_h_bar1', 'p_v_bar1', 'p_h_bar2']
      },
      {
        id: 'p_h_bar1',
        layer: 2,
        type: 'bar',
        x: 200,
        y: 200,
        width: 230,
        height: 44,
        radius: 10,
        angle: 0,
        material: 'brass',
        name: 'Alt Yatay Emniyet Çubuğu',
        dependsOn: ['p_v_bar1']
      },
      {
        id: 'p_v_bar1',
        layer: 3,
        type: 'bar',
        x: 200,
        y: 260,
        width: 44,
        height: 230,
        radius: 10,
        angle: 0,
        material: 'steel',
        name: 'Orta Dikey Kilit Mili',
        dependsOn: ['p_h_bar2']
      },
      {
        id: 'p_h_bar2',
        layer: 4,
        type: 'bar',
        x: 200,
        y: 310,
        width: 230,
        height: 44,
        radius: 10,
        angle: 0,
        material: 'copper',
        name: 'Üst Mandallı Sürgü',
        dependsOn: [] // En üst katman!
      }
    ],
    screws: [
      // Top Layer h_bar2 (Copper)
      { id: 's1', x: 120, y: 310, color: 'copper', plates: ['p_h_bar2', 'p_lattice_base'] },
      { id: 's2', x: 200, y: 310, color: 'copper', plates: ['p_h_bar2', 'p_v_bar1', 'p_lattice_base'] },
      { id: 's3', x: 280, y: 310, color: 'copper', plates: ['p_h_bar2', 'p_lattice_base'] },
      // Middle Layer v_bar1 (Ruby - locked until h_bar2 drops!)
      { id: 's4', x: 200, y: 160, color: 'ruby', plates: ['p_v_bar1', 'p_lattice_base'] },
      { id: 's5', x: 200, y: 200, color: 'ruby', plates: ['p_v_bar1', 'p_h_bar1', 'p_lattice_base'] },
      { id: 's6', x: 200, y: 360, color: 'ruby', plates: ['p_v_bar1', 'p_lattice_base'] },
      // Lower Layer h_bar1 (Gold - locked until v_bar1 drops!)
      { id: 's7', x: 120, y: 200, color: 'gold', plates: ['p_h_bar1', 'p_lattice_base'] },
      { id: 's8', x: 280, y: 200, color: 'gold', plates: ['p_h_bar1', 'p_lattice_base'] },
      { id: 's9', x: 160, y: 200, color: 'gold', plates: ['p_h_bar1', 'p_lattice_base'] },
      // Base plate (Steel - locked until all bars drop!)
      { id: 's10', x: 100, y: 150, color: 'steel', plates: ['p_lattice_base'] },
      { id: 's11', x: 300, y: 150, color: 'steel', plates: ['p_lattice_base'] },
      { id: 's12', x: 200, y: 110, color: 'steel', plates: ['p_lattice_base'] }
    ]
  },

  // ==========================================
  // SEVİYE 6: Cenevre Müzik Kutusu Tamburu
  // ==========================================
  {
    id: 6,
    name: "SEVİYE 6",
    subtitle: "Müzik Kutusu Tamburu",
    partName: "1860 Cenevre Kraliyet Müzik Kutusu",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'ruby', capacity: 3, filled: 0, label: 'YAKUT KUTUSU' },
      { id: 'b2', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b3', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' },
      { id: 'b4', color: 'copper', capacity: 3, filled: 0, label: 'BAKIR KUTUSU' }
    ],
    plates: [
      {
        id: 'p_cylinder_base',
        layer: 1,
        type: 'rect',
        x: 200,
        y: 270,
        width: 270,
        height: 250,
        radius: 20,
        angle: 0,
        material: 'steel',
        name: 'Akustik Rezonans Tablası',
        dependsOn: ['p_comb', 'p_drum']
      },
      {
        id: 'p_drum',
        layer: 2,
        type: 'rect',
        x: 200,
        y: 290,
        width: 210,
        height: 100,
        radius: 16,
        angle: 0,
        material: 'brass',
        name: 'Nota Pim Silindiri',
        dependsOn: ['p_comb']
      },
      {
        id: 'p_comb',
        layer: 3,
        type: 'bar',
        x: 200,
        y: 200,
        width: 230,
        height: 52,
        radius: 12,
        angle: 0,
        material: 'copper',
        name: 'Çelik Titreşim Tarağı',
        dependsOn: []
      }
    ],
    screws: [
      // On Comb (Ruby)
      { id: 's1', x: 120, y: 200, color: 'ruby', plates: ['p_comb', 'p_cylinder_base'] },
      { id: 's2', x: 200, y: 200, color: 'ruby', plates: ['p_comb', 'p_cylinder_base'] },
      { id: 's3', x: 280, y: 200, color: 'ruby', plates: ['p_comb', 'p_cylinder_base'] },
      // On Drum (Gold - locked until comb falls!)
      { id: 's4', x: 130, y: 270, color: 'gold', plates: ['p_drum', 'p_cylinder_base'] },
      { id: 's5', x: 200, y: 270, color: 'gold', plates: ['p_drum', 'p_cylinder_base'] },
      { id: 's6', x: 270, y: 270, color: 'gold', plates: ['p_drum', 'p_cylinder_base'] },
      // Drum Lower Screws (Steel)
      { id: 's7', x: 130, y: 320, color: 'steel', plates: ['p_drum', 'p_cylinder_base'] },
      { id: 's8', x: 200, y: 320, color: 'steel', plates: ['p_drum', 'p_cylinder_base'] },
      { id: 's9', x: 270, y: 320, color: 'steel', plates: ['p_drum', 'p_cylinder_base'] },
      // Base Perimeter (Copper)
      { id: 's10', x: 95, y: 360, color: 'copper', plates: ['p_cylinder_base'] },
      { id: 's11', x: 305, y: 360, color: 'copper', plates: ['p_cylinder_base'] },
      { id: 's12', x: 200, y: 375, color: 'copper', plates: ['p_cylinder_base'] }
    ],
    kineticTriggers: [
      {
        id: 'kt_music_cylinder',
        triggerOnFall: 'p_comb',
        targetPlateId: 'p_drum',
        rotateAngle: 45 * (Math.PI / 180),
        message: 'Müzik Silindiri Döndü: Notalar Hizalandı! 🎵',
        rotateScrews: ['s4', 's5', 's6']
      }
    ]
  },

  // ==========================================
  // SEVİYE 7: Harrison H4 Deniz Kronometresi (Kraliyet Başyapıtı)
  // ==========================================
  {
    id: 7,
    name: "SEVİYE 7",
    subtitle: "Kraliyet Deniz Kronometresi",
    partName: "1761 John Harrison H4 Kronometresi",
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: [
      { id: 'b1', color: 'ruby', capacity: 3, filled: 0, label: 'YAKUT KUTUSU' },
      { id: 'b2', color: 'steel', capacity: 3, filled: 0, label: 'ÇELİK KUTUSU' },
      { id: 'b3', color: 'gold', capacity: 3, filled: 0, label: 'PİRİNÇ KUTUSU' },
      { id: 'b4', color: 'copper', capacity: 3, filled: 0, label: 'BAKIR KUTUSU' }
    ],
    plates: [
      {
        id: 'p_base_octagon',
        layer: 1,
        type: 'rect',
        x: 200,
        y: 260,
        width: 270,
        height: 270,
        radius: 35,
        angle: 0,
        material: 'brass',
        name: 'Pirinç Taban Tablası',
        dependsOn: ['p_escapement_left', 'p_escapement_right', 'p_center_hub']
      },
      {
        id: 'p_escapement_left',
        layer: 2,
        type: 'bar',
        x: 155,
        y: 260,
        width: 48,
        height: 220,
        radius: 12,
        angle: -10 * (Math.PI / 180),
        material: 'steel',
        name: 'Sol Maşa Köprüsü',
        dependsOn: ['p_center_hub']
      },
      {
        id: 'p_escapement_right',
        layer: 2,
        type: 'bar',
        x: 245,
        y: 260,
        width: 48,
        height: 220,
        radius: 12,
        angle: 10 * (Math.PI / 180),
        material: 'steel',
        name: 'Sağ Maşa Köprüsü',
        dependsOn: ['p_center_hub']
      },
      {
        id: 'p_center_hub',
        layer: 3,
        type: 'circle',
        x: 200,
        y: 260,
        radius: 55,
        material: 'copper',
        name: 'Balans Çarkı Yatağı',
        dependsOn: [] // En üst katman!
      }
    ],
    screws: [
      // Top layer center hub (Ruby)
      { id: 's1', x: 200, y: 225, color: 'ruby', plates: ['p_center_hub', 'p_escapement_left', 'p_base_octagon'] },
      { id: 's2', x: 175, y: 280, color: 'ruby', plates: ['p_center_hub', 'p_escapement_left', 'p_base_octagon'] },
      { id: 's3', x: 225, y: 280, color: 'ruby', plates: ['p_center_hub', 'p_escapement_right', 'p_base_octagon'] },
      // Left and right steel bridges (Steel - locked until hub falls!)
      { id: 's4', x: 145, y: 170, color: 'steel', plates: ['p_escapement_left', 'p_base_octagon'] },
      { id: 's5', x: 165, y: 350, color: 'steel', plates: ['p_escapement_left', 'p_base_octagon'] },
      { id: 's6', x: 255, y: 170, color: 'steel', plates: ['p_escapement_right', 'p_base_octagon'] },
      // Gold screws on right bridge & base
      { id: 's7', x: 235, y: 350, color: 'gold', plates: ['p_escapement_right', 'p_base_octagon'] },
      { id: 's8', x: 100, y: 260, color: 'gold', plates: ['p_base_octagon'] },
      { id: 's9', x: 300, y: 260, color: 'gold', plates: ['p_base_octagon'] },
      // Copper screws on base perimeter
      { id: 's10', x: 105, y: 155, color: 'copper', plates: ['p_base_octagon'] },
      { id: 's11', x: 295, y: 155, color: 'copper', plates: ['p_base_octagon'] },
      { id: 's12', x: 200, y: 375, color: 'copper', plates: ['p_base_octagon'] }
    ]
  }
];

// Procedural Level Generator for Infinite Play
function generateProceduralLevel(levelNum) {
  const colors = ['gold', 'steel', 'ruby', 'copper'];
  const numColors = Math.min(4, 2 + Math.floor(levelNum / 3));
  const activeColors = colors.slice(0, numColors);
  
  const numBoxes = Math.min(5, 3 + Math.floor(levelNum / 2));
  const boxes = [];
  const colorPool = [];

  for (let i = 0; i < numBoxes; i++) {
    const col = activeColors[i % activeColors.length];
    boxes.push({
      id: `gen_b_${i}`,
      color: col,
      capacity: 3,
      filled: 0,
      label: SCREW_TYPES[col].name.toUpperCase() + ' KUTUSU'
    });
    colorPool.push(col, col, col);
  }

  // Shuffle screw colors for puzzle challenge
  for (let i = colorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorPool[i], colorPool[j]] = [colorPool[j], colorPool[i]];
  }

  const plates = [
    {
      id: 'gen_p_base',
      layer: 1,
      type: 'rect',
      x: 200,
      y: 260,
      width: 260,
      height: 240,
      radius: 20,
      angle: 0,
      material: 'brass',
      name: `Usta Parça #${levelNum}`,
      dependsOn: ['gen_p_bar1', 'gen_p_bar2']
    },
    {
      id: 'gen_p_bar1',
      layer: 2,
      type: 'bar',
      x: 170,
      y: 260,
      width: 50,
      height: 200,
      radius: 12,
      angle: 0.15,
      material: 'steel',
      name: 'Ara Kol',
      dependsOn: ['gen_p_bar2']
    },
    {
      id: 'gen_p_bar2',
      layer: 3,
      type: 'bar',
      x: 230,
      y: 260,
      width: 50,
      height: 200,
      radius: 12,
      angle: -0.15,
      material: 'copper',
      name: 'Üst Bağlantı',
      dependsOn: []
    }
  ];

  const screws = [];
  const coords = [
    { x: 170, y: 180, p: ['gen_p_bar1', 'gen_p_base'] },
    { x: 170, y: 260, p: ['gen_p_bar1', 'gen_p_base'] },
    { x: 170, y: 340, p: ['gen_p_bar1', 'gen_p_base'] },
    { x: 230, y: 180, p: ['gen_p_bar2', 'gen_p_base'] },
    { x: 230, y: 260, p: ['gen_p_bar2', 'gen_p_base'] },
    { x: 230, y: 340, p: ['gen_p_bar2', 'gen_p_base'] },
    { x: 100, y: 200, p: ['gen_p_base'] },
    { x: 100, y: 320, p: ['gen_p_base'] },
    { x: 300, y: 200, p: ['gen_p_base'] },
    { x: 300, y: 320, p: ['gen_p_base'] },
    { x: 200, y: 160, p: ['gen_p_base'] },
    { x: 200, y: 360, p: ['gen_p_base'] },
    { x: 100, y: 260, p: ['gen_p_base'] },
    { x: 300, y: 260, p: ['gen_p_base'] },
    { x: 200, y: 260, p: ['gen_p_bar1', 'gen_p_bar2', 'gen_p_base'] }
  ];

  for (let i = 0; i < colorPool.length && i < coords.length; i++) {
    screws.push({
      id: `gen_s_${i}`,
      x: coords[i].x,
      y: coords[i].y,
      color: colorPool[i],
      plates: coords[i].p
    });
  }

  return {
    id: levelNum,
    name: `SEVİYE ${levelNum}`,
    subtitle: `Antika Mekanizma #${levelNum}`,
    partName: `Saat Ustası Koleksiyonu #${levelNum}`,
    virtualWidth: 400,
    virtualHeight: 520,
    boxes: boxes,
    plates: plates,
    screws: screws
  };
}

window.SCREW_TYPES = SCREW_TYPES;
window.MUSEUM_ARTIFACTS = MUSEUM_ARTIFACTS;
window.WORKSHOP_UPGRADES = WORKSHOP_UPGRADES;
window.LEVELS = LEVELS;
window.generateProceduralLevel = generateProceduralLevel;
