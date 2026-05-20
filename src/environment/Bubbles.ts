import { Container, Graphics } from 'pixi.js';
import { BUBBLE_COUNT } from '../constants';
import type { TankLayout } from './tankLayout';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  wobblePhase: number;
  wobbleSpeed: number;
  wobbleAmp: number;
  alpha: number;
}

export class Bubbles extends Container {
  private gfx = new Graphics();
  private layout!: TankLayout;
  private bubbles: Bubble[] = [];

  constructor() {
    super();
    this.addChild(this.gfx);
  }

  rebuild(layout: TankLayout): void {
    this.layout = layout;
    this.bubbles = Array.from({ length: BUBBLE_COUNT }, () =>
      this.createBubble(true),
    );
  }

  update(dt: number): void {
    if (!this.layout) return;

    const { waterX, waterY, waterWidth, waterHeight } = this.layout;
    const top = waterY + 12;
    const bottom = waterY + waterHeight - 28;

    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i];
      b.wobblePhase += dt * b.wobbleSpeed;
      b.y -= b.speed * dt * 60;
      b.x += Math.sin(b.wobblePhase) * b.wobbleAmp * dt;

      if (b.y < top) {
        this.bubbles[i] = this.createBubble(false);
      }

      b.x = Math.max(waterX + 16, Math.min(waterX + waterWidth - 16, b.x));
      b.y = Math.max(top, Math.min(bottom, b.y));
    }

    this.draw();
  }

  private createBubble(randomY: boolean): Bubble {
    const { waterX, waterY, waterWidth, waterHeight } = this.layout;
    const bottom = waterY + waterHeight - 28;
    const top = waterY + waterHeight * 0.25;

    return {
      x: waterX + 20 + Math.random() * (waterWidth - 40),
      y: randomY
        ? waterY + 40 + Math.random() * (waterHeight - 80)
        : bottom - Math.random() * (bottom - top) * 0.35,
      radius: 1.5 + Math.random() * 5,
      speed: 0.35 + Math.random() * 0.9,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 1.2 + Math.random() * 2,
      wobbleAmp: 8 + Math.random() * 18,
      alpha: 0.12 + Math.random() * 0.28,
    };
  }

  private draw(): void {
    this.gfx.clear();

    for (const b of this.bubbles) {
      this.gfx.circle(b.x, b.y, b.radius).fill({
        color: 0xffffff,
        alpha: b.alpha * 0.35,
      });
      this.gfx.circle(b.x - b.radius * 0.25, b.y - b.radius * 0.3, b.radius * 0.22).fill({
        color: 0xffffff,
        alpha: b.alpha * 0.7,
      });
      this.gfx.circle(b.x, b.y, b.radius).stroke({
        width: 0.8,
        color: 0xffffff,
        alpha: b.alpha * 0.5,
      });
    }
  }
}
