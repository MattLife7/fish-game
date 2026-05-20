import { Container, Graphics } from 'pixi.js';
import type { TankLayout } from '../environment/tankLayout';
import type { FoodManager } from '../systems/FoodManager';
import { computeSwimBounds, type SwimBounds } from './swimBounds';

type FishState =
  | 'cruise'
  | 'explore'
  | 'hover'
  | 'burst'
  | 'seeking_food'
  | 'eating_food';

const FOOD_DETECT_RADIUS = 290;
const FOOD_INSTANT_RADIUS = 105;
/** Bite when the mouth (not body center) reaches the pellet. */
const FOOD_MOUTH_EAT_DISTANCE = 11;
const FOOD_NEARBY_AFTER_EAT = 130;
const MOUTH_LOCAL_X = 35.5;
const MOUTH_LOCAL_Y = 4;
const VISUAL_SCALE = 1.52;

const BODY = 0xffa868;
const BODY_MID = 0xff8c42;
const BODY_DARK = 0xe07030;
const BODY_LIGHT = 0xffd4a8;
const BELLY = 0xffe8c8;
const FIN = 0xe06028;
const FIN_DARK = 0xb84818;
const STRIPE = 0xf08040;
const OUTLINE = 0x8c3810;

export class Fish extends Container {
  private readonly rig = new Container();
  private readonly tail = new Graphics();
  private readonly tailFork = new Graphics();
  private readonly dorsalFin = new Graphics();
  private readonly sideFin = new Graphics();
  private readonly pelvicFin = new Graphics();
  private readonly bodyGfx = new Graphics();
  private readonly cheekPatch = new Graphics();
  private readonly eye = new Graphics();
  private readonly floorShadow = new Graphics();

  private bounds!: SwimBounds;
  private spawned = false;

  private state: FishState = 'cruise';
  private stateTimer = 0;
  private targetX = 0;
  private targetY = 0;
  private lastZoneId = -1;
  private wallRecoverTimer = 0;

  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;

  private swimPhase = 0;
  private facing = 1;
  private smoothedVx = 0;
  private smoothedVy = 0;
  private tiltAngle = 0;
  private wanderPhase = 0;

  /** Min horizontal speed before the fish will flip facing (prevents left-right twitch). */
  private readonly facingFlipThreshold = 34;

  private readonly maxSpeed = 145;
  private readonly cruiseSpeed = 105;
  private readonly burstSpeed = 175;
  private readonly maxForce = 220;
  private speedMul = 1;

  private foodManager: FoodManager | null = null;
  private foodTargetId: number | null = null;
  private noticeTimer = 0;
  private eatTimer = 0;

  constructor() {
    super();
    this.buildVisuals();
    this.addChild(this.floorShadow, this.rig);
  }

  rebuild(layout: TankLayout): void {
    this.bounds = computeSwimBounds(layout);

    if (!this.spawned) {
      this.px = this.bounds.centerX;
      this.py = this.bounds.centerY;
      this.vx = this.cruiseSpeed * 0.55;
      this.vy = 0;
      this.spawned = true;
      this.enterState('explore');
    } else {
      this.px = Math.min(this.bounds.right, Math.max(this.bounds.left, this.px));
      this.py = Math.min(this.bounds.bottom, Math.max(this.bounds.top, this.py));
    }

    this.syncTransform();
  }

  setFoodManager(manager: FoodManager): void {
    this.foodManager = manager;
  }

  update(dt: number, time: number): void {
    if (!this.bounds) return;

    const clampedDt = Math.min(dt, 0.05);
    this.stateTimer -= clampedDt;
    this.swimPhase += clampedDt * (5.8 + Math.min(3, Math.hypot(this.vx, this.vy) / 28));
    this.wanderPhase += clampedDt * 1.7;

    if (this.wallRecoverTimer > 0) {
      this.wallRecoverTimer -= clampedDt;
    } else if (this.isNearWall() && this.state !== 'eating_food') {
      this.applyWallRecovery();
    }

    this.updateFoodBehavior(clampedDt);
    if (this.state !== 'seeking_food' && this.state !== 'eating_food') {
      this.updateStateMachine();
    }
    this.applySteering(clampedDt);
    this.integrate(clampedDt);
    this.softClampToBounds();
    this.updateOrientation(clampedDt);
    this.syncTransform();
    this.animateSwim(time);
  }

  private buildVisuals(): void {
    this.rig.addChild(
      this.tail,
      this.tailFork,
      this.dorsalFin,
      this.bodyGfx,
      this.cheekPatch,
      this.sideFin,
      this.pelvicFin,
      this.eye,
    );
    this.drawBody();
    this.drawFins();
    this.drawCheek();
    this.drawEye();
    this.drawFloorShadow();
    this.rig.scale.set(VISUAL_SCALE);
  }

  private drawBody(): void {
    const g = this.bodyGfx;
    g.clear();

    g.moveTo(-28, 1)
      .quadraticCurveTo(-12, -16, 18, -13)
      .quadraticCurveTo(34, -11, 42, -3)
      .quadraticCurveTo(36, 6, 20, 12)
      .quadraticCurveTo(0, 17, -28, 1)
      .closePath()
      .fill({ color: BODY, alpha: 1 });

    g.moveTo(-28, 1)
      .quadraticCurveTo(-12, -16, 18, -13)
      .quadraticCurveTo(34, -11, 42, -3)
      .quadraticCurveTo(36, 6, 20, 12)
      .quadraticCurveTo(0, 17, -28, 1)
      .closePath()
      .stroke({ width: 1.6, color: OUTLINE, alpha: 0.4 });

    g.moveTo(-10, 4)
      .quadraticCurveTo(6, 14, 22, 10)
      .quadraticCurveTo(8, 8, -10, 4)
      .closePath()
      .fill({ color: BELLY, alpha: 0.55 });

    g.ellipse(8, -2, 20, 10).fill({ color: BODY_LIGHT, alpha: 0.38 });
    g.ellipse(-6, 4, 14, 6).fill({ color: BODY_DARK, alpha: 0.2 });

    g.moveTo(-2, -9)
      .quadraticCurveTo(10, -11, 22, -6)
      .stroke({ width: 2.2, color: STRIPE, alpha: 0.35, cap: 'round' });
    g.moveTo(0, 2)
      .quadraticCurveTo(14, 4, 26, 1)
      .stroke({ width: 1.8, color: STRIPE, alpha: 0.28, cap: 'round' });

    g.ellipse(30, 2, 5, 3.5).fill({ color: BODY_MID, alpha: 0.45 });
    g.moveTo(34, 3)
      .quadraticCurveTo(37, 4, 36, 5.5)
      .stroke({ width: 0.8, color: OUTLINE, alpha: 0.3 });
    g.circle(35, 4.5, 0.9).fill({ color: OUTLINE, alpha: 0.35 });
  }

  private drawFins(): void {
    this.tail.clear();
    this.tail.x = -30;
    this.tail.y = 0;
    this.tail
      .moveTo(0, 0)
      .quadraticCurveTo(-16, -14, -22, -12)
      .lineTo(-18, 0)
      .quadraticCurveTo(-16, 14, -22, 12)
      .lineTo(-18, 0)
      .closePath()
      .fill({ color: FIN, alpha: 0.96 });
    this.tail
      .moveTo(-2, 0)
      .quadraticCurveTo(-12, -8, -16, -6)
      .lineTo(-14, 0)
      .quadraticCurveTo(-12, 8, -16, 6)
      .lineTo(-14, 0)
      .closePath()
      .fill({ color: FIN_DARK, alpha: 0.4 });

    this.tailFork.clear();
    this.tailFork.x = -30;
    this.tailFork.y = 0;
    this.tailFork
      .moveTo(-18, 0)
      .lineTo(-26, -5)
      .lineTo(-22, 0)
      .lineTo(-26, 5)
      .lineTo(-18, 0)
      .closePath()
      .fill({ color: FIN_DARK, alpha: 0.55 });

    this.dorsalFin.clear();
    this.dorsalFin.rotation = 0;
    // Under body: spine-matched base + inner wedge so no gap shows at the back.
    const spineCpX = -12;
    const spineCpY = -16;
    const rearX = -10.5;
    const rearY = -10;
    const frontX = 13;
    const frontY = -11.8;
    const rootDepth = 3.6;
    const peakX = 5;
    const peakY = -28;

    const innerCpY = spineCpY - rootDepth + 3;

    this.dorsalFin
      .moveTo(rearX, rearY)
      .quadraticCurveTo(spineCpX, spineCpY, frontX, frontY)
      .quadraticCurveTo(peakX + 7, -27, peakX, peakY)
      .quadraticCurveTo(peakX - 8.5, -23.5, rearX, rearY + rootDepth)
      .quadraticCurveTo(spineCpX, innerCpY, frontX, frontY + rootDepth)
      .quadraticCurveTo(spineCpX, spineCpY, rearX, rearY)
      .fill({ color: FIN, alpha: 0.92 });
    this.dorsalFin
      .moveTo(rearX + 0.5, rearY + 0.2)
      .quadraticCurveTo(spineCpX, spineCpY, frontX - 0.5, frontY + 0.2)
      .quadraticCurveTo(peakX + 6, -24, peakX, -24.2)
      .quadraticCurveTo(peakX - 6.5, -21.5, rearX + 0.5, rearY + rootDepth - 0.4)
      .quadraticCurveTo(spineCpX, innerCpY + 0.5, frontX - 0.5, frontY + rootDepth - 0.4)
      .quadraticCurveTo(spineCpX, spineCpY, rearX + 0.5, rearY + 0.2)
      .fill({ color: FIN_DARK, alpha: 0.2 });

    this.sideFin.clear();
    this.sideFin.x = 6;
    this.sideFin.y = 8;
    this.sideFin
      .moveTo(0, 0)
      .quadraticCurveTo(10, 6, 6, 14)
      .quadraticCurveTo(0, 10, -4, 4)
      .closePath()
      .fill({ color: FIN_DARK, alpha: 0.88 });
    this.sideFin
      .moveTo(2, 2)
      .quadraticCurveTo(6, 8, 4, 11)
      .stroke({ width: 0.8, color: FIN, alpha: 0.4 });

    this.pelvicFin.clear();
    this.pelvicFin.x = -4;
    this.pelvicFin.y = 10;
    this.pelvicFin
      .moveTo(0, 0)
      .quadraticCurveTo(4, 8, 0, 12)
      .quadraticCurveTo(-3, 7, 0, 0)
      .closePath()
      .fill({ color: FIN, alpha: 0.75 });
  }

  private drawCheek(): void {
    this.cheekPatch.clear();
    this.cheekPatch.x = 22;
    this.cheekPatch.y = 4;
    this.cheekPatch.circle(0, 0, 4.5).fill({ color: BODY_MID, alpha: 0.35 });
  }

  private drawEye(): void {
    const g = this.eye;
    g.clear();
    g.x = 26;
    g.y = -5;
    g.circle(0, 0, 4.2).fill({ color: 0x1a1208, alpha: 0.96 });
    g.circle(0, 0, 4.2).stroke({ width: 0.8, color: OUTLINE, alpha: 0.25 });
    g.circle(1.2, -1.2, 1.5).fill({ color: 0xffffff, alpha: 0.95 });
    g.circle(-0.8, 1, 0.7).fill({ color: 0xffffff, alpha: 0.35 });
  }

  private drawFloorShadow(): void {
    this.floorShadow.clear();
    this.floorShadow.ellipse(0, 20, 22, 7).fill({ color: 0x0a1520, alpha: 0.22 });
    this.floorShadow.ellipse(0, 20, 14, 4).fill({ color: 0x0a1520, alpha: 0.14 });
  }

  private enterState(next: FishState): void {
    this.state = next;

    switch (next) {
      case 'cruise':
        this.stateTimer = 4 + Math.random() * 4;
        this.speedMul = 0.88 + Math.random() * 0.22;
        this.pickTarget();
        break;
      case 'explore':
        this.stateTimer = 5 + Math.random() * 4;
        this.speedMul = 0.95 + Math.random() * 0.15;
        this.pickTarget(true);
        break;
      case 'burst':
        this.stateTimer = 2 + Math.random() * 2.5;
        this.speedMul = 1.05 + Math.random() * 0.12;
        this.pickTarget(true);
        break;
      case 'hover':
        this.stateTimer = 1.4 + Math.random() * 2.2;
        break;
      case 'seeking_food':
        this.speedMul = 1.02 + Math.random() * 0.08;
        break;
      case 'eating_food':
        this.eatTimer = 0.3 + Math.random() * 0.1;
        this.vx *= 0.5;
        this.vy *= 0.5;
        break;
    }
  }

  private startSeekingFood(pelletId: number): void {
    this.foodTargetId = pelletId;
    this.noticeTimer = 0;
    this.wallRecoverTimer = 0;
    this.state = 'seeking_food';
    this.speedMul = 1.05;
  }

  private returnFromFood(): void {
    this.foodTargetId = null;
    this.noticeTimer = 0;
    this.enterState('cruise');
  }

  private tryPickFoodTarget(maxDist = FOOD_NEARBY_AFTER_EAT): boolean {
    const pellet = this.foodManager?.findNearest(this.px, this.py, maxDist);
    if (!pellet) return false;
    this.startSeekingFood(pellet.id);
    return true;
  }

  private updateFacingTowardFood(foodX: number): void {
    const dx = foodX - this.px;
    if (dx > 14) this.facing = 1;
    else if (dx < -14) this.facing = -1;
  }

  private getMouthWorld(): { x: number; y: number } {
    const sx = this.facing * VISUAL_SCALE;
    const sy = VISUAL_SCALE;
    const c = Math.cos(this.tiltAngle);
    const s = Math.sin(this.tiltAngle);
    const ox = this.rig.x + MOUTH_LOCAL_X * sx * c - MOUTH_LOCAL_Y * sy * s;
    const oy = this.rig.y + MOUTH_LOCAL_X * sx * s + MOUTH_LOCAL_Y * sy * c;
    return { x: this.px + ox, y: this.py + oy };
  }

  private getApproachTargetForPellet(
    pelletX: number,
    pelletY: number,
  ): { x: number; y: number } {
    const mouthLead = MOUTH_LOCAL_X * VISUAL_SCALE;
    return {
      x: pelletX - this.facing * mouthLead,
      y: pelletY,
    };
  }

  private updateFoodBehavior(dt: number): void {
    const food = this.foodManager;
    if (!food) return;

    if (this.state === 'eating_food') {
      this.eatTimer -= dt;
      this.targetX = this.px;
      this.targetY = this.py;
      this.vx *= 0.78;
      this.vy *= 0.78;

      if (this.eatTimer <= 0) {
        if (this.foodTargetId != null) {
          food.eatPellet(this.foodTargetId);
        }
        this.foodTargetId = null;
        if (!this.tryPickFoodTarget()) {
          this.returnFromFood();
        }
      }
      return;
    }

    if (this.state === 'seeking_food') {
      const pellet = food.getById(this.foodTargetId);
      if (!pellet || pellet.view.alpha < 0.5) {
        if (!this.tryPickFoodTarget(FOOD_DETECT_RADIUS)) {
          this.returnFromFood();
        }
        return;
      }

      this.updateFacingTowardFood(pellet.x);
      const aim = this.getApproachTargetForPellet(pellet.x, pellet.y);
      this.targetX = aim.x;
      this.targetY = aim.y;

      const mouth = this.getMouthWorld();
      const mouthDist =
        Math.hypot(pellet.x - mouth.x, pellet.y - mouth.y) - pellet.radius;
      if (mouthDist < FOOD_MOUTH_EAT_DISTANCE) {
        this.enterState('eating_food');
      }
      return;
    }

    if (!food.hasEdiblePellets()) {
      this.noticeTimer = 0;
      return;
    }

    const nearest = food.findNearest(this.px, this.py, FOOD_DETECT_RADIUS);
    if (!nearest) {
      this.noticeTimer = 0;
      return;
    }

    const dist = Math.hypot(nearest.x - this.px, nearest.y - this.py);
    if (dist < FOOD_INSTANT_RADIUS) {
      this.startSeekingFood(nearest.id);
      return;
    }

    if (this.noticeTimer <= 0) {
      this.noticeTimer =
        0.35 + (dist / FOOD_DETECT_RADIUS) * 0.85 + Math.random() * 0.25;
    } else {
      this.noticeTimer -= dt;
      if (this.noticeTimer <= 0) {
        this.startSeekingFood(nearest.id);
      }
    }
  }

  private updateStateMachine(): void {
    if (this.stateTimer > 0) return;

    const roll = Math.random();

    switch (this.state) {
      case 'cruise':
        if (roll < 0.45) this.enterState('explore');
        else if (roll < 0.7) this.enterState('burst');
        else if (roll < 0.82) this.enterState('hover');
        else this.enterState('cruise');
        break;
      case 'explore':
        if (roll < 0.4) this.enterState('burst');
        else if (roll < 0.75) this.enterState('cruise');
        else this.enterState('explore');
        break;
      case 'burst':
        if (roll < 0.55) this.enterState('explore');
        else this.enterState('cruise');
        break;
      case 'hover':
        if (roll < 0.75) this.enterState('explore');
        else if (roll < 0.9) this.enterState('burst');
        else this.enterState('cruise');
        break;
    }
  }

  /** ~72% far targets across tank zones; explore/burst always far. */
  private pickTarget(forceFar = false): void {
    const useFar = forceFar || Math.random() < 0.72;
    const point = useFar ? this.pickFarTarget() : this.pickLocalTarget();

    this.targetX = point.x;
    this.targetY = point.y;
  }

  /** Six zones covering the full swim area — avoids left-right ping-pong. */
  private getZoneId(x: number, y: number): number {
    const { left, top, width, height } = this.bounds;
    const col = x < left + width * 0.5 ? 0 : 1;
    const row = y < top + height * 0.34 ? 0 : y < top + height * 0.67 ? 1 : 2;
    return col * 3 + row;
  }

  private pickFarTarget(): { x: number; y: number } {
    const { left, top, width, height } = this.bounds;
    const zones = [
      { u: 0.03, v: 0.04, uw: 0.44, vh: 0.3 },
      { u: 0.03, v: 0.36, uw: 0.44, vh: 0.3 },
      { u: 0.03, v: 0.68, uw: 0.44, vh: 0.28 },
      { u: 0.53, v: 0.04, uw: 0.44, vh: 0.3 },
      { u: 0.53, v: 0.36, uw: 0.44, vh: 0.3 },
      { u: 0.53, v: 0.62, uw: 0.44, vh: 0.34 },
    ];

    const here = this.getZoneId(this.px, this.py);
    let zoneId = here;
    let attempts = 0;

    while (attempts < 16) {
      zoneId = Math.floor(Math.random() * zones.length);
      if (zoneId !== here && zoneId !== this.lastZoneId) break;
      attempts++;
    }

    if (zoneId === here || zoneId === this.lastZoneId) {
      const choices = zones.map((_, i) => i).filter((i) => i !== here && i !== this.lastZoneId);
      zoneId = choices[Math.floor(Math.random() * choices.length)] ?? (here + 3) % 6;
    }

    this.lastZoneId = zoneId;
    const z = zones[zoneId];
    const tx = left + width * (z.u + Math.random() * z.uw);
    const ty = top + height * (z.v + Math.random() * z.vh);

    const minTravel = Math.max(width * 0.32, height * 0.28, 140);
    const dist = Math.hypot(tx - this.px, ty - this.py);
    if (dist >= minTravel) {
      return { x: tx, y: ty };
    }

    return this.pickDistantPointInZone(zoneId, minTravel);
  }

  private pickDistantPointInZone(zoneId: number, minTravel: number): { x: number; y: number } {
    const { left, top, width, height } = this.bounds;
    const zones = [
      { u: 0.03, v: 0.04, uw: 0.44, vh: 0.3 },
      { u: 0.03, v: 0.36, uw: 0.44, vh: 0.3 },
      { u: 0.03, v: 0.68, uw: 0.44, vh: 0.28 },
      { u: 0.53, v: 0.04, uw: 0.44, vh: 0.3 },
      { u: 0.53, v: 0.36, uw: 0.44, vh: 0.3 },
      { u: 0.53, v: 0.62, uw: 0.44, vh: 0.34 },
    ];
    const z = zones[zoneId] ?? zones[3];

    for (let i = 0; i < 8; i++) {
      const tx = left + width * (z.u + Math.random() * z.uw);
      const ty = top + height * (z.v + Math.random() * z.vh);
      if (Math.hypot(tx - this.px, ty - this.py) >= minTravel) {
        return { x: tx, y: ty };
      }
    }

    const dx = left + width * (z.u + z.uw * 0.5) - this.px;
    const dy = top + height * (z.v + z.vh * 0.5) - this.py;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: this.px + (dx / len) * minTravel,
      y: this.py + (dy / len) * minTravel,
    };
  }

  private pickLocalTarget(): { x: number; y: number } {
    const { left, top, width, height } = this.bounds;
    const tx = left + width * (0.1 + Math.random() * 0.8);
    const ty = top + height * (0.12 + Math.random() * 0.76);
    return { x: tx, y: ty };
  }

  private isNearWall(): boolean {
    const m = 48;
    return (
      this.px - this.bounds.left < m ||
      this.bounds.right - this.px < m ||
      this.py - this.bounds.top < m ||
      this.bounds.bottom - this.py < m
    );
  }

  private applyWallRecovery(): void {
    if (this.state === 'hover') return;
    const { centerX, centerY, width, height } = this.bounds;
    this.targetX = centerX + (Math.random() - 0.5) * width * 0.55;
    this.targetY = centerY + (Math.random() - 0.5) * height * 0.55;
    this.wallRecoverTimer = 2.5;
  }

  private applySteering(dt: number): void {
    let ax = 0;
    let ay = 0;

    ax += this.wallAvoidance().x;
    ay += this.wallAvoidance().y;

    if (this.state === 'eating_food') {
      ax -= this.vx * 2.2;
      ay -= this.vy * 2.2;
    } else if (this.state !== 'hover') {
      const seek = this.seekForce();
      ax += seek.x;
      ay += seek.y;

      const wander =
        this.state === 'seeking_food'
          ? { x: this.wanderForce().x * 0.35, y: this.wanderForce().y * 0.35 }
          : this.wanderForce();
      ax += wander.x;
      ay += wander.y;
    } else {
      ax += (this.targetX - this.px) * 0.08;
      ay += (this.targetY - this.py) * 0.08;
    }

    if (this.state === 'hover') {
      ax *= 0.2;
      ay *= 0.2;
    }

    const accelLen = Math.hypot(ax, ay);
    if (accelLen > this.maxForce) {
      const s = this.maxForce / accelLen;
      ax *= s;
      ay *= s;
    }

    this.vx += ax * dt;
    this.vy += ay * dt;

    const drag =
      this.state === 'hover' ? 0.88 : this.state === 'burst' ? 0.985 : 0.975;
    this.vx *= drag;
    this.vy *= drag;

    const speedCap = this.getSpeedCap();
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > speedCap) {
      const s = speedCap / speed;
      this.vx *= s;
      this.vy *= s;
    }
  }

  private getSpeedCap(): number {
    switch (this.state) {
      case 'hover':
        return 28;
      case 'eating_food':
        return 18;
      case 'seeking_food':
        return this.maxSpeed * this.speedMul;
      case 'burst':
        return this.burstSpeed * this.speedMul;
      case 'explore':
        return this.maxSpeed * this.speedMul;
      case 'cruise':
      default:
        return this.cruiseSpeed * this.speedMul;
    }
  }

  private seekForce(): { x: number; y: number } {
    const dx = this.targetX - this.px;
    const dy = this.targetY - this.py;
    const dist = Math.hypot(dx, dy) || 1;

    let desired = this.getSpeedCap();

    const slowRadius = this.state === 'seeking_food' ? 48 : 50;
    if (dist < slowRadius) {
      desired *= 0.5 + (dist / slowRadius) * 0.5;
    }

    const desiredVx = (dx / dist) * desired;
    const desiredVy = (dy / dist) * desired;

    return {
      x: (desiredVx - this.vx) * 2.4,
      y: (desiredVy - this.vy) * 2.4,
    };
  }

  private wanderForce(): { x: number; y: number } {
    const speed = Math.hypot(this.vx, this.vy) || 1;
    const nx = -this.vy / speed;
    const ny = this.vx / speed;
    const wobble = Math.sin(this.wanderPhase) * 12;
    return { x: nx * wobble, y: ny * wobble };
  }

  private wallAvoidance(): { x: number; y: number } {
    const margin = 56;
    let fx = 0;
    let fy = 0;
    const strength = 120;

    const dl = this.px - this.bounds.left;
    const dr = this.bounds.right - this.px;
    const dt = this.py - this.bounds.top;
    const db = this.bounds.bottom - this.py;

    if (dl < margin) fx += ((margin - dl) / margin) ** 2 * strength;
    if (dr < margin) fx -= ((margin - dr) / margin) ** 2 * strength;
    if (dt < margin) fy += ((margin - dt) / margin) ** 2 * strength;
    if (db < margin) fy -= ((margin - db) / margin) ** 2 * strength;

    return { x: fx, y: fy };
  }

  private integrate(dt: number): void {
    this.px += this.vx * dt;
    this.py += this.vy * dt;
  }

  private updateOrientation(dt: number): void {
    const velSmooth = 1 - Math.exp(-7 * dt);
    this.smoothedVx += (this.vx - this.smoothedVx) * velSmooth;
    this.smoothedVy += (this.vy - this.smoothedVy) * velSmooth;

    if (this.state !== 'seeking_food' && this.state !== 'eating_food') {
      if (this.smoothedVx > this.facingFlipThreshold) {
        this.facing = 1;
      } else if (this.smoothedVx < -this.facingFlipThreshold) {
        this.facing = -1;
      }
    }

    const speed = Math.hypot(this.smoothedVx, this.smoothedVy);
    let targetTilt = 0;
    if (speed > 28) {
      targetTilt =
        Math.atan2(this.smoothedVy, Math.abs(this.smoothedVx) + 2) * 0.14 * this.facing;
      targetTilt = Math.max(-0.16, Math.min(0.16, targetTilt));
    }

    const tiltSmooth = 1 - Math.exp(-5 * dt);
    this.tiltAngle += (targetTilt - this.tiltAngle) * tiltSmooth;
  }

  private softClampToBounds(): void {
    const pad = 3;
    if (this.px < this.bounds.left + pad) this.px = this.bounds.left + pad;
    if (this.px > this.bounds.right - pad) this.px = this.bounds.right - pad;
    if (this.py < this.bounds.top + pad) this.py = this.bounds.top + pad;
    if (this.py > this.bounds.bottom - pad) this.py = this.bounds.bottom - pad;
  }

  private syncTransform(): void {
    this.x = this.px;
    this.y = this.py;
    this.rig.rotation = this.tiltAngle;
    this.rig.scale.x = this.facing * VISUAL_SCALE;
    this.rig.scale.y = VISUAL_SCALE;
  }

  private animateSwim(time: number): void {
    const speed = Math.hypot(this.vx, this.vy);
    const swimIntensity = Math.min(1.2, 0.3 + speed / 55);
    const tailSpeed = 2.4 + swimIntensity * 1.1;

    const tailSwing = Math.sin(this.swimPhase * tailSpeed) * (0.32 + swimIntensity * 0.22);
    this.tail.rotation = tailSwing;
    this.tailFork.rotation = tailSwing * 0.85;

    const finFlutter = Math.sin(this.swimPhase * 3.8 + 0.5) * (0.22 + swimIntensity * 0.2);
    this.sideFin.rotation = 0.3 + finFlutter;
    this.pelvicFin.rotation = -0.15 + finFlutter * 0.6;

    const hoverBob = this.state === 'hover' ? Math.sin(time * 2.8) * 1.6 : 0;
    const swimBob =
      Math.sin(time * 2.4 + this.swimPhase * 0.25) * swimIntensity * 0.9;

    let eatNudge = 0;
    let eatScale = 1;
    if (this.state === 'eating_food' && this.eatTimer > 0) {
      const bite = 1 - this.eatTimer / 0.4;
      eatNudge = Math.sin(bite * Math.PI) * 3.5 * this.facing;
      eatScale = 1 + Math.sin(bite * Math.PI) * 0.04;
    }

    this.rig.x = eatNudge;
    this.rig.y = hoverBob + swimBob;
    this.rig.scale.y = VISUAL_SCALE * eatScale;

    this.floorShadow.alpha = 0.16 + swimIntensity * 0.1;
    this.floorShadow.scale.set(1 + swimIntensity * 0.14, 1);
  }
}
