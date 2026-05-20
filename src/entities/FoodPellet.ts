import { Graphics } from 'pixi.js';
import type { FoodBounds } from './foodBounds';

const CRUMB_COLORS = [0xc48a52, 0xb87840, 0xd49a62, 0xa86838];
const CRUMB_EDGE = 0x7a4828;

let nextPelletId = 1;

export class FoodPellet {
  readonly id = nextPelletId++;
  readonly view = new Graphics();
  readonly radius: number;

  x: number;
  y: number;
  private vx: number;
  private vy: number;
  private readonly phase: number;
  private settled = false;
  private age = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.phase = Math.random() * Math.PI * 2;
    this.radius = 2.2 + Math.random() * 2.4;
    this.vx = (Math.random() - 0.5) * 18;
    this.vy = -8 - Math.random() * 14;
    this.drawCrumb();
    this.syncView(0);
  }

  get isSettled(): boolean {
    return this.settled;
  }

  private drawCrumb(): void {
    const g = this.view;
    g.clear();
    const r = this.radius;
    const base = CRUMB_COLORS[Math.floor(Math.random() * CRUMB_COLORS.length)];

    g.circle(0, 0, r).fill({ color: base, alpha: 0.95 });
    g.circle(0, 0, r).stroke({ width: 0.7, color: CRUMB_EDGE, alpha: 0.45 });

    const bump = r * 0.45;
    g.circle(r * 0.35, -r * 0.2, bump).fill({ color: base, alpha: 0.85 });
    g.ellipse(-r * 0.25, r * 0.15, bump * 0.9, bump * 0.7).fill({
      color: 0x000000,
      alpha: 0.08,
    });
  }

  update(dt: number, bounds: FoodBounds, time: number): void {
    this.age += dt;

    if (!this.settled) {
      const sink = 22 + this.radius * 2.2;
      this.vy += sink * dt;
      this.vx += Math.sin(time * 2.1 + this.phase) * 6 * dt;
      this.vy *= 0.992;

      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.x += Math.sin(time * 1.4 + this.phase) * 0.35;
      this.y += Math.cos(time * 1.1 + this.phase) * 0.2;
    }

    const floorY = bounds.floor - this.radius * 0.5;
    if (this.y >= floorY) {
      this.y = floorY;
      this.vy *= 0.25;
      this.vx *= 0.7;
      this.settled = true;
    }

    const pad = this.radius + 1;
    if (this.x < bounds.left + pad) {
      this.x = bounds.left + pad;
      this.vx *= -0.35;
    }
    if (this.x > bounds.right - pad) {
      this.x = bounds.right - pad;
      this.vx *= -0.35;
    }
    if (this.y < bounds.top + pad) {
      this.y = bounds.top + pad;
      this.vy = Math.abs(this.vy) * 0.3;
    }

    if (this.age > 90) {
      const fade = Math.max(0, 1 - (this.age - 90) / 40);
      this.view.alpha = fade;
    }

    this.syncView(time);
  }

  private syncView(time: number): void {
    this.view.x = this.x;
    this.view.y = this.y;
    this.view.rotation =
      Math.sin(time * 1.8 + this.phase) * 0.25 + (this.settled ? 0 : this.vx * 0.01);
  }
}
