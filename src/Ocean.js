import Phaser from 'phaser';

export class Ocean {
  constructor(scene) {
    this.scene = scene;
    this.W = scene.WORLD_W;
    this.H = scene.scale.height;
    this.SURFACE_Y = scene.SURFACE_Y;
    this.FLOOR_Y = scene.OCEAN_FLOOR_Y;
    this.THERMO_Y = scene.THERMO_Y;

    this.bg = scene.add.graphics();
    this.waveGfx = scene.add.graphics();
    this.particles = this._createParticles();

    this._drawStaticLayers();
  }

  _drawStaticLayers() {
    const g = this.bg;
    const { W, H, SURFACE_Y, FLOOR_Y, THERMO_Y } = this;

    // Sky / above water
    g.fillStyle(0x000814);
    g.fillRect(0, 0, W, SURFACE_Y);

    // Epipelagic zone (0 – 200m equiv) — lighter
    g.fillGradientStyle(0x001f3d, 0x001f3d, 0x003060, 0x003060, 1);
    g.fillRect(0, SURFACE_Y, W, THERMO_Y - SURFACE_Y);

    // Thermocline band — slight highlight
    g.fillStyle(0x0a4060, 0.4);
    g.fillRect(0, THERMO_Y - 3, W, 12);

    // Mesopelagic zone (200–600m equiv) — darker
    g.fillGradientStyle(0x002040, 0x002040, 0x000810, 0x000810, 1);
    g.fillRect(0, THERMO_Y, W, FLOOR_Y - THERMO_Y);

    // Seafloor
    g.fillStyle(0x1a0e06);
    g.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

    // Seafloor texture bumps
    g.fillStyle(0x2a1a0a, 0.7);
    for (let x = 0; x < W; x += 28) {
      const h = 8 + Math.sin(x * 0.1) * 5 + Math.sin(x * 0.07) * 4;
      g.fillRect(x, FLOOR_Y, 20, h);
    }

    // Depth ruler on left edge
    g.lineStyle(1, 0x1a4a3a, 0.5);
    const totalDepthM = 600;
    const pxPerM = (FLOOR_Y - SURFACE_Y) / totalDepthM;
    for (let m = 0; m <= totalDepthM; m += 50) {
      const y = SURFACE_Y + m * pxPerM;
      g.strokeLineShape(new Phaser.Geom.Line(0, y, m % 200 === 0 ? 20 : 10, y));
    }
  }

  _createParticles() {
    // Simple floating particles simulated in update()
    const particles = [];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * this.W,
        y: this.SURFACE_Y + Math.random() * (this.FLOOR_Y - this.SURFACE_Y),
        vy: -4 - Math.random() * 6,
        alpha: 0.05 + Math.random() * 0.15,
        size: 0.5 + Math.random() * 1.5,
      });
    }
    return particles;
  }

  update(delta, cameraX) {
    const dt = delta / 1000;
    const g = this.waveGfx;
    g.clear();

    // Surface wave line
    const t = Date.now() * 0.001;
    g.lineStyle(1.5, 0x4af0ff, 0.6);
    g.beginPath();
    for (let x = 0; x <= this.W; x += 4) {
      const wx = x + cameraX;
      const wy = this.SURFACE_Y
        + Math.sin(wx * 0.018 + t) * 4
        + Math.sin(wx * 0.04 + t * 1.5) * 2;
      x === 0 ? g.moveTo(x, wy) : g.lineTo(x, wy);
    }
    g.strokePath();

    // Floating particles
    g.fillStyle(0x88ddff, 1);
    for (const p of this.particles) {
      p.y += p.vy * dt;
      if (p.y < this.SURFACE_Y) {
        p.y = this.FLOOR_Y;
        p.x = Math.random() * this.W;
      }
      g.fillStyle(0x88ddff, p.alpha);
      g.fillCircle(p.x, p.y, p.size);
    }

    // Thermocline shimmer
    g.lineStyle(1, 0x00aacc, 0.08 + Math.sin(t * 2) * 0.04);
    g.strokeLineShape(new Phaser.Geom.Line(0, this.THERMO_Y + 3, this.W, this.THERMO_Y + 3));

    // Depth labels
    // (rendered via static text objects created in scene)
  }
}
