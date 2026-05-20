import { Container, Graphics } from 'pixi.js';
import type { TankLayout } from './tankLayout';

interface Ray {
  xFactor: number;
  widthFactor: number;
  phase: number;
  speed: number;
  depth: number;
}

export class LightRays extends Container {
  private beams = new Graphics();
  private caustics = new Graphics();
  private layout!: TankLayout;
  private rays: Ray[] = [];
  private time = 0;

  constructor() {
    super();
    this.alpha = 0.5;
    this.addChild(this.beams, this.caustics);
    this.rays = Array.from({ length: 6 }, (_, i) => ({
      xFactor: 0.14 + i * 0.14 + (i % 2) * 0.03,
      widthFactor: 0.055 + (i % 3) * 0.02,
      phase: i * 2.1,
      speed: 0.2 + (i % 4) * 0.06,
      depth: 0.45 + (i % 3) * 0.1,
    }));
  }

  rebuild(layout: TankLayout): void {
    this.layout = layout;
    this.redraw();
  }

  update(dt: number): void {
    this.time += dt;
    this.redraw();
  }

  private redraw(): void {
    if (!this.layout) return;

    const { waterX, waterY, waterWidth, waterHeight } = this.layout;
    this.beams.clear();
    this.caustics.clear();

    for (const ray of this.rays) {
      this.drawOrganicBeam(
        this.beams,
        waterX,
        waterY,
        waterWidth,
        waterHeight,
        ray,
      );
    }

    this.drawCaustics(waterX, waterY, waterWidth, waterHeight);
  }

  private drawOrganicBeam(
    g: Graphics,
    waterX: number,
    waterY: number,
    waterWidth: number,
    waterHeight: number,
    ray: Ray,
  ): void {
    const sway = Math.sin(this.time * ray.speed + ray.phase) * 0.022;
    const cx = waterX + waterWidth * (ray.xFactor + sway);
    const top = waterY + 6;
    const bottom = waterY + waterHeight * ray.depth;
    const halfW = waterWidth * ray.widthFactor;
    const alpha =
      0.028 + 0.018 * (0.5 + 0.5 * Math.sin(this.time * 0.55 + ray.phase));

    const left: { x: number; y: number }[] = [];
    const right: { x: number; y: number }[] = [];
    const segments = 10;

    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const y = top + (bottom - top) * t;
      const spread = halfW * (0.25 + t * 1.1);
      const wobble =
        Math.sin(this.time * 0.8 + ray.phase + t * 4.5) * spread * 0.22;
      const curve = Math.sin(t * Math.PI) * spread * 0.15;

      left.push({ x: cx - spread * 0.35 - wobble + curve, y });
      right.push({ x: cx + spread * 0.55 + wobble - curve, y });
    }

    g.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) {
      const prev = left[i - 1];
      const curr = left[i];
      g.quadraticCurveTo(prev.x, (prev.y + curr.y) * 0.5, curr.x, curr.y);
    }
    for (let i = right.length - 1; i >= 0; i--) {
      const curr = right[i];
      const next = right[i - 1];
      if (i === 0) {
        g.lineTo(curr.x, curr.y);
      } else {
        g.quadraticCurveTo(curr.x, (curr.y + next.y) * 0.5, next.x, next.y);
      }
    }
    g.closePath().fill({ color: 0xffffff, alpha });

    g.moveTo(cx, top);
    for (let s = 1; s <= segments; s++) {
      const t = s / segments;
      const y = top + (bottom - top) * t;
      const innerAlpha = alpha * 0.35 * (1 - t * 0.6);
      const w = halfW * 0.12 * (1 - t * 0.5);
      g.ellipse(cx, y, w, w * 2.2).fill({ color: 0xffffff, alpha: innerAlpha });
    }
  }

  private drawCaustics(
    waterX: number,
    waterY: number,
    waterWidth: number,
    waterHeight: number,
  ): void {
    this.caustics.alpha = 0.35;
    const patches = 8;

    for (let i = 0; i < patches; i++) {
      const phase = this.time * 0.45 + i * 1.8;
      const yBand = i / patches;
      const y =
        waterY +
        waterHeight * (0.06 + yBand * 0.42) +
        Math.sin(phase) * 10;
      const w = 24 + (i % 3) * 14 + Math.sin(phase * 1.3) * 8;
      const x =
        waterX +
        waterWidth * (0.15 + (i * 0.11) % 0.7) +
        Math.cos(phase * 0.9) * 22;

      this.caustics
        .ellipse(x, y, w * 0.55, w * 0.22)
        .fill({ color: 0xffffff, alpha: 0.035 + (i % 2) * 0.015 });

      if (i % 2 === 0) {
        this.caustics
          .ellipse(x + w * 0.3, y + 6, w * 0.3, w * 0.12)
          .fill({ color: 0xc8f0ff, alpha: 0.025 });
      }
    }
  }
}
