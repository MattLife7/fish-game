import {
  Assets,
  Container,
  FillGradient,
  Graphics,
  Texture,
  TilingSprite,
} from 'pixi.js';
import { GRAVEL_HEIGHT_FRACTION, GRAVEL_TEXTURE_URL } from '../constants';
import type { TankLayout } from './tankLayout';

interface BedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let gravelTexturePromise: Promise<Texture> | null = null;

function loadGravelTexture(): Promise<Texture> {
  if (!gravelTexturePromise) {
    gravelTexturePromise = Assets.load<Texture>(GRAVEL_TEXTURE_URL);
  }
  return gravelTexturePromise;
}

export class Gravel extends Container {
  private floor = new Container();
  private floorMask = new Graphics();
  private gravelTile = new TilingSprite({ texture: Texture.WHITE, width: 1, height: 1 });
  private blendOverlay = new Graphics();
  private topFeather = new Graphics();

  constructor() {
    super();
    this.floor.addChild(this.floorMask, this.gravelTile, this.blendOverlay, this.topFeather);
    this.floor.mask = this.floorMask;
    this.addChild(this.floor);
  }

  async rebuild(layout: TankLayout): Promise<void> {
    const texture = await loadGravelTexture();
    const bed = this.getBedRect(layout);

    this.drawFloorMask(bed.width, bed.height);
    this.layoutGravelTexture(texture, bed);
    this.drawBlendOverlay(bed.width, bed.height);
    this.drawTopFeather(bed.width, bed.height);
  }

  private getBedRect(layout: TankLayout): BedRect {
    const { waterX, waterY, waterWidth, waterHeight } = layout;
    const bedHeight = waterHeight * GRAVEL_HEIGHT_FRACTION;
    const floorBottom = waterY + waterHeight - 4;
    return {
      x: waterX,
      y: floorBottom - bedHeight,
      width: waterWidth,
      height: bedHeight,
    };
  }

  private layoutGravelTexture(texture: Texture, bed: BedRect): void {
    this.floor.x = bed.x;
    this.floor.y = bed.y;

    this.gravelTile.texture = texture;
    this.gravelTile.width = bed.width;
    this.gravelTile.height = bed.height;

    const scale = bed.height / texture.height;
    this.gravelTile.tileScale.set(scale);
    this.gravelTile.tilePosition.set(0, 0);
  }

  /** Wavy top boundary — avoids a perfectly straight rectangular edge. */
  private waveY(x: number, w: number, amplitude: number): number {
    const t = x / w;
    return (
      amplitude * 0.55 +
      Math.sin(t * Math.PI * 2.12 + 0.35) * amplitude * 0.28 +
      Math.sin(t * Math.PI * 4.85) * amplitude * 0.22 +
      Math.sin(t * Math.PI * 7.4 + 1.15) * amplitude * 0.12
    );
  }

  private drawFloorMask(w: number, h: number): void {
    const g = this.floorMask;
    g.clear();

    const amp = Math.min(14, h * 0.07);
    const segments = Math.max(32, Math.floor(w / 32));

    g.moveTo(0, h + 4);
    g.lineTo(w, h + 4);

    for (let i = segments; i >= 0; i--) {
      const x = (i / segments) * w;
      g.lineTo(x, this.waveY(x, w, amp));
    }

    g.closePath();
    g.fill(0xffffff);
  }

  private drawBlendOverlay(w: number, h: number): void {
    const g = this.blendOverlay;
    g.clear();

    g.rect(0, 0, w, h).fill({ color: 0x2a9fd4, alpha: 0.16 });
    g.rect(0, 0, w, h).fill({ color: 0x1568a0, alpha: 0.06 });

    const topFade = new FillGradient({
      type: 'linear',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(48, 145, 185, 0.72)' },
        { offset: 0.12, color: 'rgba(42, 130, 170, 0.45)' },
        { offset: 0.28, color: 'rgba(36, 115, 155, 0.18)' },
        { offset: 0.5, color: 'rgba(30, 100, 140, 0)' },
      ],
    });
    g.rect(0, 0, w, h * 0.62).fill(topFade);

    const bottomDepth = new FillGradient({
      type: 'linear',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(0, 0, 0, 0)' },
        { offset: 0.5, color: 'rgba(0, 22, 40, 0.05)' },
        { offset: 0.82, color: 'rgba(0, 18, 35, 0.14)' },
        { offset: 1, color: 'rgba(0, 12, 28, 0.32)' },
      ],
    });
    g.rect(0, h * 0.3, w, h * 0.7).fill(bottomDepth);
  }

  /** Soft sediment/water strip along the wavy top edge. */
  private drawTopFeather(w: number, h: number): void {
    const g = this.topFeather;
    g.clear();

    const amp = Math.min(14, h * 0.07);
    const featherDepth = h * 0.22;
    const segments = Math.max(32, Math.floor(w / 32));

    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * w;
      const y = this.waveY(x, w, amp);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }

    g.lineTo(w, featherDepth);
    g.lineTo(0, featherDepth);
    g.closePath();

    const featherFill = new FillGradient({
      type: 'linear',
      start: { x: 0.5, y: 0 },
      end: { x: 0.5, y: 1 },
      textureSpace: 'local',
      colorStops: [
        { offset: 0, color: 'rgba(52, 148, 188, 0.5)' },
        { offset: 0.35, color: 'rgba(42, 125, 160, 0.22)' },
        { offset: 1, color: 'rgba(42, 125, 160, 0)' },
      ],
    });
    g.fill(featherFill);
  }
}
