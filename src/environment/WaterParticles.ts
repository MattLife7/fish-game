import { Container, Graphics } from 'pixi.js';
import { PARTICLE_COUNT } from '../constants';
import type { TankLayout } from './tankLayout';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class WaterParticles extends Container {
  private gfx = new Graphics();
  private layout!: TankLayout;
  private particles: Particle[] = [];

  constructor() {
    super();
    this.alpha = 0.9;
    this.addChild(this.gfx);
  }

  rebuild(layout: TankLayout): void {
    this.layout = layout;
    const { waterX, waterY, waterWidth, waterHeight } = layout;

    this.particles = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: waterX + Math.random() * waterWidth,
      y: waterY + Math.random() * waterHeight,
      vx: (Math.random() - 0.5) * 5,
      vy: (Math.random() - 0.5) * 4,
      size: 0.5 + Math.random() * 1.1,
      alpha: 0.03 + Math.random() * 0.07,
    }));
  }

  update(dt: number): void {
    if (!this.layout) return;

    const { waterX, waterY, waterWidth, waterHeight } = this.layout;
    const pad = 8;

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.x < waterX + pad) {
        p.x = waterX + pad;
        p.vx = Math.abs(p.vx);
      }
      if (p.x > waterX + waterWidth - pad) {
        p.x = waterX + waterWidth - pad;
        p.vx = -Math.abs(p.vx);
      }
      if (p.y < waterY + pad) {
        p.y = waterY + pad;
        p.vy = Math.abs(p.vy);
      }
      if (p.y > waterY + waterHeight - pad) {
        p.y = waterY + waterHeight - pad;
        p.vy = -Math.abs(p.vy);
      }
    }

    this.draw();
  }

  private draw(): void {
    this.gfx.clear();
    for (const p of this.particles) {
      this.gfx.circle(p.x, p.y, p.size).fill({
        color: 0xe8f8ff,
        alpha: p.alpha,
      });
    }
  }
}
