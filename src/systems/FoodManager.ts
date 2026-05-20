import { Container, Graphics } from 'pixi.js';
import type { TankLayout } from '../environment/tankLayout';
import { FoodPellet } from '../entities/FoodPellet';
import {
  computeFoodBounds,
  isInsideWater,
  type FoodBounds,
} from '../entities/foodBounds';

const MAX_PELLETS = 45;
const CLUSTER_MIN = 3;
const CLUSTER_MAX = 6;

export class FoodManager extends Container {
  private bounds!: FoodBounds;
  private layout!: TankLayout;
  private readonly pellets: FoodPellet[] = [];
  private readonly eatPops: { gfx: Graphics; life: number }[] = [];

  rebuild(layout: TankLayout): void {
    this.layout = layout;
    this.bounds = computeFoodBounds(layout);
  }

  update(dt: number, time: number): void {
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const p = this.pellets[i];
      p.update(dt, this.bounds, time);
      if (p.view.alpha <= 0.01) {
        this.removePelletAt(i);
      }
    }

    for (let i = this.eatPops.length - 1; i >= 0; i--) {
      const pop = this.eatPops[i];
      pop.life -= dt;
      pop.gfx.alpha = Math.max(0, pop.life / 0.35);
      pop.gfx.scale.set(1 + (0.35 - pop.life) * 0.6);
      if (pop.life <= 0) {
        pop.gfx.destroy();
        this.eatPops.splice(i, 1);
      }
    }
  }

  trySpawnAt(x: number, y: number): boolean {
    if (!this.layout || !isInsideWater(this.layout, x, y)) {
      return false;
    }

    let sx = x;
    let sy = y;

    const spawnPad = 12;
    if (sy > this.bounds.floor - spawnPad) {
      sy = this.bounds.floor - spawnPad - Math.random() * 10;
    }

    sx = Math.min(this.bounds.right - 8, Math.max(this.bounds.left + 8, sx));
    sy = Math.min(this.bounds.floor - 6, Math.max(this.bounds.top + 8, sy));

    const room = MAX_PELLETS - this.pellets.length;
    if (room <= 0) {
      this.trimOldest(CLUSTER_MIN);
    }

    const count = Math.min(
      CLUSTER_MIN + Math.floor(Math.random() * (CLUSTER_MAX - CLUSTER_MIN + 1)),
      MAX_PELLETS - this.pellets.length,
    );

    if (count <= 0) return false;

    for (let i = 0; i < count; i++) {
      const px = sx + (Math.random() - 0.5) * 22;
      const py = sy + (Math.random() - 0.5) * 14;
      this.addPellet(px, py);
    }

    return true;
  }

  findNearest(
    x: number,
    y: number,
    maxDist: number,
  ): FoodPellet | null {
    let best: FoodPellet | null = null;
    let bestDist = maxDist;

    for (const p of this.pellets) {
      if (p.view.alpha < 0.5) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    return best;
  }

  getById(id: number | null): FoodPellet | null {
    if (id == null) return null;
    return this.pellets.find((p) => p.id === id) ?? null;
  }

  eatPellet(id: number): void {
    const idx = this.pellets.findIndex((p) => p.id === id);
    if (idx < 0) return;

    const p = this.pellets[idx];
    this.spawnEatPop(p.x, p.y);
    this.removePelletAt(idx);
  }

  hasEdiblePellets(): boolean {
    return this.pellets.some((p) => p.view.alpha > 0.5);
  }

  private addPellet(x: number, y: number): void {
    const pellet = new FoodPellet(x, y);
    this.pellets.push(pellet);
    this.addChild(pellet.view);
  }

  private trimOldest(count: number): void {
    const remove = Math.min(count, this.pellets.length);
    for (let i = 0; i < remove; i++) {
      this.removePelletAt(0);
    }
  }

  private removePelletAt(index: number): void {
    const [p] = this.pellets.splice(index, 1);
    p.view.destroy();
  }

  private spawnEatPop(x: number, y: number): void {
    const g = new Graphics();
    g.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.35 });
    g.circle(1, -1, 1.2).fill({ color: 0xffffff, alpha: 0.55 });
    g.x = x;
    g.y = y;
    this.addChild(g);
    this.eatPops.push({ gfx: g, life: 0.35 });
  }
}
