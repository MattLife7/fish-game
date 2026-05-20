import {
  Container,
  FillGradient,
  Graphics,
} from 'pixi.js';
import { COLORS } from '../constants';
import type { TankLayout } from './tankLayout';

export class AquariumBackground extends Container {
  private room = new Graphics();
  private water = new Graphics();
  private shimmer = new Graphics();
  private frame = new Graphics();
  readonly glassHighlights = new Graphics();
  private layout!: TankLayout;
  private shimmerPhase = 0;

  constructor() {
    super();
    this.addChild(this.room, this.water, this.shimmer, this.frame);
  }

  rebuild(layout: TankLayout): void {
    this.layout = layout;
    this.drawRoom();
    this.drawWater();
    this.drawShimmer();
    this.drawFrame();
    this.drawGlassHighlights();
  }

  update(dt: number): void {
    this.shimmerPhase += dt * 0.28;
    this.drawShimmer();
  }

  private drawRoom(): void {
    const { screenWidth, screenHeight } = this.layout;
    this.room.clear();
    this.room.rect(0, 0, screenWidth, screenHeight).fill(COLORS.room);

    const vignette = new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.45 },
      innerRadius: 0.1,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.85,
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(40, 58, 78, 0)' },
        { offset: 1, color: 'rgba(8, 14, 24, 0.55)' },
      ],
    });
    this.room.rect(0, 0, screenWidth, screenHeight).fill(vignette);
  }

  private drawWater(): void {
    const { waterX, waterY, waterWidth, waterHeight, cornerRadius } =
      this.layout;

    const gradient = new FillGradient({
      type: 'linear',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: COLORS.waterTop },
        { offset: 0.32, color: COLORS.waterMid },
        { offset: 0.68, color: COLORS.waterDeep },
        { offset: 0.88, color: COLORS.waterDeepFloor },
        { offset: 1, color: COLORS.waterBottomTint },
      ],
    });

    this.water.clear();
    this.water
      .roundRect(waterX, waterY, waterWidth, waterHeight, cornerRadius - 4)
      .fill(gradient);

    const depthTint = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0.5 },
      end: { x: 1, y: 0.5 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(0, 30, 50, 0.1)' },
        { offset: 0.5, color: 'rgba(0, 0, 0, 0)' },
        { offset: 1, color: 'rgba(0, 30, 50, 0.12)' },
      ],
    });
    this.water
      .roundRect(waterX, waterY, waterWidth, waterHeight, cornerRadius - 4)
      .fill(depthTint);

    const bottomDepth = new FillGradient({
      type: 'linear',
      start: { x: 0.5, y: 0.55 },
      end: { x: 0.5, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(0, 0, 0, 0)' },
        { offset: 0.6, color: 'rgba(0, 25, 45, 0.18)' },
        { offset: 1, color: 'rgba(0, 15, 35, 0.42)' },
      ],
    });
    this.water
      .roundRect(waterX, waterY, waterWidth, waterHeight, cornerRadius - 4)
      .fill(bottomDepth);
  }

  private drawShimmer(): void {
    const { waterX, waterY, waterWidth, waterHeight } = this.layout;
    this.shimmer.clear();
    this.shimmer.alpha = 0.16;

    const zones = [
      { yStart: 0.05, yEnd: 0.22, count: 3 },
      { yStart: 0.28, yEnd: 0.48, count: 2 },
    ];

    let idx = 0;
    for (const zone of zones) {
      for (let i = 0; i < zone.count; i++) {
        const t = this.shimmerPhase + idx * 1.1;
        const yNorm = zone.yStart + ((i + 0.5) / zone.count) * (zone.yEnd - zone.yStart);
        const y = waterY + waterHeight * yNorm + Math.sin(t) * 8;
        const w = 40 + (idx % 4) * 18 + Math.sin(t * 1.1) * 12;
        const x =
          waterX +
          waterWidth * (0.2 + (idx * 0.17) % 0.6) +
          Math.cos(t * 0.65) * 24;

        this.shimmer
          .ellipse(x, y, w * 0.45, 10 + Math.sin(t) * 3)
          .fill({ color: 0xffffff, alpha: 0.04 + (idx % 2) * 0.02 });
        idx++;
      }
    }
  }

  private drawFrame(): void {
    const { tankX, tankY, tankWidth, tankHeight, cornerRadius, frameWidth } =
      this.layout;

    this.frame.clear();

    this.frame
      .roundRect(tankX, tankY, tankWidth, tankHeight, cornerRadius)
      .stroke({ width: frameWidth, color: COLORS.frameShadow, alpha: 0.35 });

    this.frame
      .roundRect(tankX + 2, tankY + 2, tankWidth - 4, tankHeight - 4, cornerRadius - 2)
      .stroke({ width: frameWidth * 0.55, color: COLORS.frameOuter, alpha: 0.75 });

    this.frame
      .roundRect(
        tankX + frameWidth * 0.4,
        tankY + frameWidth * 0.4,
        tankWidth - frameWidth * 0.8,
        tankHeight - frameWidth * 0.8,
        cornerRadius - 4,
      )
      .stroke({ width: 2, color: COLORS.frameInner, alpha: 0.5 });
  }

  drawGlassHighlights(): void {
    const { tankX, tankY, tankWidth, tankHeight, cornerRadius } = this.layout;
    this.glassHighlights.clear();
    this.glassHighlights.alpha = 0.65;

    const leftGleam = new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(255, 255, 255, 0.35)' },
        { offset: 0.4, color: 'rgba(200, 230, 255, 0.08)' },
        { offset: 1, color: 'rgba(255, 255, 255, 0)' },
      ],
    });

    this.glassHighlights
      .roundRect(
        tankX + 8,
        tankY + 10,
        tankWidth * 0.22,
        tankHeight * 0.55,
        cornerRadius * 0.6,
      )
      .fill(leftGleam);

    this.glassHighlights
      .moveTo(tankX + tankWidth - 18, tankY + 24)
      .lineTo(tankX + tankWidth - 48, tankY + 18)
      .lineTo(tankX + tankWidth - 36, tankY + 52)
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.12 });

    this.glassHighlights
      .ellipse(
        tankX + tankWidth * 0.72,
        tankY + tankHeight * 0.18,
        tankWidth * 0.08,
        tankHeight * 0.04,
      )
      .fill({ color: 0xffffff, alpha: 0.07 });
  }
}
