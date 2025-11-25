// Very small level system: level definitions and loader
export const levels = [
  {
    id: 0,
    name: 'Basic Training',
    bg: ['#1a1a2e', '#16213e'],
    groundY: 60,
    objects: [
      { x: 300, height: 14, w: 100, type: 'platform', y: 150 },
      { x: 500, height: 14, w: 100, type: 'platform', y: 200 },
      { x: 650, height: 200, w: 14, type: 'wall', y: 60 }
    ],
    enemies: [
      { type: 'walker', x: 800, yOffset: 0 }
    ],
    safeHaven: { x: 100, y: 100, w: 100, h: 100 }
  },
  {
    id: 1,
    name: 'Tutorial Arena',
    bg: ['#081226', '#0b1220'],
    groundY: 60,
    // placeable objects: supports several types (defaults to solid wall)
    // shorthand: { x, height, w } -> solid wall rising from ground
    // full forms: { type: 'platform'|'oneway'|'slope'|'wall', x, y, w, h, ... }
    objects: [
      { x: 220, height: 14, w: 260, type: 'platform', y: 180 },
      { x: 120, height: 12, w: 80, type: 'platform', y: 110 },
      { x: 200, height: 80, w: 14, type: 'wall' , y: 110},
      // floating vertical obstacles
      { x: 280, height: 160, w: 14, type: 'wall' },
      { x: 520, height: 120, w: 14, type: 'wall' }
    ],
    enemies: [
      { type: 'walker', x: 420, yOffset: 0 },
      { type: 'walker', x: 520, yOffset: 0 },
      { type: 'jumper', x: 680, yOffset: -10 }
    ],
    // Safe haven: area where player can hide from enemies
    safeHaven: { x: 600, y: 110, w: 120, h: 150 }
  },
  {
    id: 2,
    name: 'Rush Corridor',
    bg: ['#0b1a2a', '#081726'],
    groundY: 60,
    objects: [
      { x: 300, height: 14, w: 240, type: 'platform', y: 160 },
      { x: 80, height: 12, w: 120, type: 'platform', y: 120 },
      { x: 360, height: 180, w: 14, type: 'wall' },
      { x: 720, height: 200, w: 14, type: 'wall' }
    ],
    enemies: [
      { type: 'walker', x: 360, yOffset: 0 },
      { type: 'chaser', x: 540, yOffset: 0 },
      { type: 'jumper', x: 760, yOffset: -8 },
      { type: 'chaser', x: 880, yOffset: 0 }
    ],
    // Safe haven: area where player can hide from enemies
    safeHaven: { x: 750, y: 400, w: 120, h: 140 }
  },
  {
    id: 3,
    name: 'Gauntlet',
    bg: ['#2b0b1a', '#150612'],
    groundY: 56,
    objects: [
      { x: 420, height: 14, w: 120, type: 'platform', y: 150 },
      { x: 340, height: 12, w: 80, type: 'platform', y: 100 },
      { x: 460, height: 220, w: 14, type: 'wall' },
      { x: 700, x2: 820, w: 160, height: 80, type: 'slope', dir: 'right' },
      { x: 820, height: 140, w: 14, type: 'wall' }
    ],
    enemies: [
      { type: 'jumper', x: 420, yOffset: -12 },
      { type: 'jumper', x: 520, yOffset: -12 },
      { type: 'chaser', x: 700, yOffset: 0 },
      { type: 'walker', x: 820, yOffset: 0 }
    ],
    // Safe haven: area where player can hide from enemies (now dynamically spawned)
  },
  {
    id: 4,
    name: 'Vertical Maze',
    bg: ['#1a0b2a', '#0f0515'],
    groundY: 60,
    objects: [
      { x: 200, height: 200, w: 14, type: 'wall', y: 100 },
      { x: 400, height: 180, w: 14, type: 'wall', y: 120 },
      { x: 600, height: 160, w: 14, type: 'wall', y: 140 },
      { x: 300, height: 14, w: 100, type: 'platform', y: 200 },
      { x: 500, height: 14, w: 100, type: 'platform', y: 180 },
      { x: 700, height: 14, w: 100, type: 'platform', y: 160 }
    ],
    enemies: [
      { type: 'chaser', x: 250, yOffset: 0 },
      { type: 'jumper', x: 450, yOffset: -10 },
      { type: 'chaser', x: 650, yOffset: 0 },
      { type: 'walker', x: 800, yOffset: 0 }
    ]
  },
  {
    id: 5,
    name: 'Platform Rush',
    bg: ['#0b2a1a', '#051510'],
    groundY: 60,
    objects: [
      { x: 150, height: 12, w: 100, type: 'platform', y: 200 },
      { x: 300, height: 12, w: 120, type: 'platform', y: 150 },
      { x: 480, height: 12, w: 100, type: 'platform', y: 200 },
      { x: 630, height: 12, w: 120, type: 'platform', y: 150 },
      { x: 800, height: 12, w: 40, type: 'platform', y: 180 }
    ],
    enemies: [
      { type: 'jumper', x: 200, yOffset: -15 },
      { type: 'chaser', x: 350, yOffset: -10 },
      { type: 'jumper', x: 530, yOffset: -15 },
      { type: 'chaser', x: 680, yOffset: -10 },
      { type: 'walker', x: 850, yOffset: 0 }
    ]
  },
  {
    id: 6,
    name: 'Narrow Pass',
    bg: ['#2a1a0b', '#151005'],
    groundY: 60,
    objects: [
      { x: 300, height: 250, w: 14, type: 'wall', y: 50 },
      { x: 600, height: 250, w: 14, type: 'wall', y: 50 },
      { x: 150, height: 14, w: 80, type: 'platform', y: 120 },
      { x: 450, height: 14, w: 80, type: 'platform', y: 120 },
      { x: 750, height: 14, w: 80, type: 'platform', y: 120 }
    ],
    enemies: [
      { type: 'chaser', x: 200, yOffset: 0 },
      { type: 'roamer', x: 500, yOffset: 0 },
      { type: 'chaser', x: 800, yOffset: 0 }
    ]
  },
  {
    id: 7,
    name: 'Spiral Tower',
    bg: ['#1a2a0b', '#0f1505'],
    groundY: 60,
    objects: [
      { x: 400, height: 220, w: 14, type: 'wall', y: 80 },
      { x: 200, height: 14, w: 180, type: 'platform', y: 200 },
      { x: 420, height: 14, w: 180, type: 'platform', y: 150 },
      { x: 200, height: 14, w: 180, type: 'platform', y: 100 },
      { x: 420, height: 14, w: 180, type: 'platform', y: 250 }
    ],
    enemies: [
      { type: 'jumper', x: 250, yOffset: -10 },
      { type: 'chaser', x: 470, yOffset: -10 },
      { type: 'jumper', x: 250, yOffset: -60 },
      { type: 'chaser', x: 470, yOffset: -60 }
    ]
  },
  {
    id: 8,
    name: 'Chaos Arena',
    bg: ['#2a0b1a', '#150510'],
    groundY: 60,
    objects: [
      { x: 100, height: 14, w: 120, type: 'platform', y: 180 },
      { x: 280, height: 14, w: 120, type: 'platform', y: 140 },
      { x: 460, height: 14, w: 120, type: 'platform', y: 180 },
      { x: 640, height: 14, w: 120, type: 'platform', y: 140 },
      { x: 820, height: 14, w: 60, type: 'platform', y: 160 },
      { x: 250, height: 160, w: 14, type: 'wall', y: 100 },
      { x: 550, height: 160, w: 14, type: 'wall', y: 100 }
    ],
    enemies: [
      { type: 'chaser', x: 150, yOffset: -10 },
      { type: 'jumper', x: 330, yOffset: -10 },
      { type: 'chaser', x: 510, yOffset: -10 },
      { type: 'jumper', x: 690, yOffset: -10 },
      { type: 'roamer', x: 850, yOffset: 0 }
    ]
  },
  {
    id: 9,
    name: 'Final Challenge',
    bg: ['#0b0b2a', '#050515'],
    groundY: 60,
    objects: [
      { x: 150, height: 14, w: 100, type: 'platform', y: 200 },
      { x: 300, height: 14, w: 100, type: 'platform', y: 150 },
      { x: 450, height: 14, w: 100, type: 'platform', y: 200 },
      { x: 600, height: 14, w: 100, type: 'platform', y: 150 },
      { x: 750, height: 14, w: 100, type: 'platform', y: 200 },
      { x: 200, height: 180, w: 14, type: 'wall', y: 80 },
      { x: 500, height: 180, w: 14, type: 'wall', y: 80 },
      { x: 800, height: 180, w: 14, type: 'wall', y: 80 }
    ],
    enemies: [
      { type: 'chaser', x: 200, yOffset: 0 },
      { type: 'jumper', x: 350, yOffset: -10 },
      { type: 'chaser', x: 500, yOffset: 0 },
      { type: 'jumper', x: 650, yOffset: -10 },
      { type: 'chaser', x: 850, yOffset: 0 },
      { type: 'roamer', x: 400, yOffset: 0 }
    ]
  }
];

export default class Level {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.bg = def.bg || ['#081226', '#0b1220'];
    this.groundY = def.groundY || 60;
    this.enemyDefs = def.enemies || [];
    // raw object defs from level: either absolute {x,y,w,h} or shorthand {x,height,w}
    this.objectDefs = def.objects || [];
    // Safe haven: area where player can hide from enemies
    this.safeHaven = def.safeHaven || null;
  }

  // spawn enemies according to defs; factoryFn should create enemy by type
  spawnEnemies(factoryFn) {
    const out = [];
    for (const d of this.enemyDefs) {
      const e = factoryFn(d.type, d.x, d.yOffset || 0);
      out.push(e);
    }
    return out;
  }
}
