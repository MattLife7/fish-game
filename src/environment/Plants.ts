import { Container, Graphics } from 'pixi.js';
import { COLORS, GRAVEL_HEIGHT_FRACTION } from '../constants';
import type { TankLayout } from './tankLayout';

type PlantKind = 'tallGrass' | 'broadLeaf' | 'thinStem' | 'lowCluster';

interface PlantDef {
  xFactor: number;
  heightFactor: number;
  kind: PlantKind;
  phase: number;
  lean: number;
  scale?: number;
}

interface SwayPart {
  node: Container;
  baseRotation: number;
  swayAmount: number;
  phase: number;
}

interface PlantInstance {
  root: Container;
  shadow: Container;
  shadowGfx: Graphics;
  rootSpot: Graphics;
  swayGroup: Container;
  def: PlantDef;
  parts: SwayPart[];
  plantHeight: number;
  shadowWidth: number;
}

/** Pebble palette matched to the gravel bed texture tones. */
const PEBBLE_COLORS = [
  COLORS.gravelLight,
  COLORS.gravelMid,
  COLORS.gravelDark,
  COLORS.gravelShadow,
  COLORS.sediment,
  COLORS.sedimentDark,
  0xc4b4a0,
  0x8a7a6c,
];

/** Visual scale for all plant geometry (stems, leaves, bases). */
const PLANT_SCALE = 1.48;

function makeSeededRng(seed: number): () => number {
  let state = (Math.abs(Math.floor(seed * 1e4)) % 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Warm dark tones — read on the tan gravel bed. */
const SHADOW_SOFT = 0x1a100c;
const SHADOW_CORE = 0x0a0604;

export class Plants extends Container {
  private time = 0;
  private instances: PlantInstance[] = [];
  /** On the gravel — added to the scene below fish, above gravel. */
  readonly floorShadows = new Container();

  constructor() {
    super();
  }

  private readonly plantDefs: PlantDef[] = [
    { xFactor: 0.05, heightFactor: 0.68, kind: 'tallGrass', phase: 0, lean: 0.07, scale: 1.05 },
    { xFactor: 0.1, heightFactor: 0.5, kind: 'thinStem', phase: 1.3, lean: 0.05 },
    { xFactor: 0.08, heightFactor: 0.36, kind: 'broadLeaf', phase: 2.4, lean: 0.04 },
    { xFactor: 0.14, heightFactor: 0.22, kind: 'lowCluster', phase: 0.8, lean: 0.03 },
    { xFactor: 0.95, heightFactor: 0.66, kind: 'tallGrass', phase: 0.6, lean: -0.06, scale: 1 },
    { xFactor: 0.9, heightFactor: 0.48, kind: 'thinStem', phase: 1.9, lean: -0.05 },
    { xFactor: 0.86, heightFactor: 0.34, kind: 'broadLeaf', phase: 2.8, lean: -0.04 },
    { xFactor: 0.82, heightFactor: 0.21, kind: 'lowCluster', phase: 1.5, lean: -0.03 },
    { xFactor: 0.36, heightFactor: 0.19, kind: 'lowCluster', phase: 2.1, lean: 0.01 },
    { xFactor: 0.64, heightFactor: 0.17, kind: 'thinStem', phase: 2.6, lean: -0.015, scale: 0.9 },
  ];

  rebuild(layout: TankLayout): void {
    this.instances = [];
    this.floorShadows.removeChildren();
    this.removeChildren();

    const { waterX, waterWidth, waterY, waterHeight } = layout;
    const floorBottom = waterY + waterHeight;
    const gravelDepth = waterHeight * GRAVEL_HEIGHT_FRACTION;
    /** Rooted in gravel, slightly above the front (bottom) edge. */
    const baseY = floorBottom - gravelDepth * 0.24;

    for (const def of this.plantDefs) {
      const plantX = waterX + waterWidth * def.xFactor;
      const parts: SwayPart[] = [];
      const h = waterHeight * def.heightFactor * (def.scale ?? 1);
      const shadowWidth =
        def.kind === 'tallGrass' ? 42 : def.kind === 'broadLeaf' ? 32 : 26;

      const { container: shadow, shadowGfx, rootSpot } = this.createPlantShadowContainer(def.kind);
      shadow.x = plantX;
      shadow.y = baseY + 2;
      shadow.scale.set(PLANT_SCALE);
      this.floorShadows.addChild(shadow);

      const root = new Container();
      root.x = plantX;
      root.y = baseY;
      root.scale.set(PLANT_SCALE);

      this.drawPlantBase(root, def);

      const swayGroup = new Container();
      root.addChild(swayGroup);
      this.buildPlant(swayGroup, parts, def, h);
      this.drawStemBurial(root, def);

      this.instances.push({
        root,
        shadow,
        shadowGfx,
        rootSpot,
        swayGroup,
        def,
        parts,
        plantHeight: h,
        shadowWidth,
      });
      this.addChild(root);
    }
  }

  private createPlantShadowContainer(
    kind: PlantKind,
  ): { container: Container; shadowGfx: Graphics; rootSpot: Graphics } {
    const shadow = new Container();

    const rootSpot = new Graphics();
    this.paintStaticRootSpot(rootSpot, kind);
    shadow.addChild(rootSpot);

    const shadowGfx = new Graphics();
    shadow.addChild(shadowGfx);

    return { container: shadow, shadowGfx, rootSpot };
  }

  /** Small fixed contact disc where the stem meets the gravel. */
  private paintStaticRootSpot(g: Graphics, kind: PlantKind): void {
    const rx = kind === 'tallGrass' ? 9 : kind === 'broadLeaf' ? 8 : kind === 'thinStem' ? 6 : 7;
    const ry = rx * 0.55;
    g.ellipse(0, 6, rx, ry).fill({ color: SHADOW_CORE, alpha: 0.5 });
    g.ellipse(0, 5.5, rx * 0.65, ry * 0.7).fill({ color: SHADOW_SOFT, alpha: 0.34 });
  }

  /** Re-paints a plant-shaped shadow from live part positions each frame. */
  private paintPlantShadow(
    g: Graphics,
    inst: PlantInstance,
    canopyX: number,
    lean: number,
    motion: number,
  ): void {
    g.clear();

    const { def, parts, plantHeight: h, shadowWidth: w } = inst;
    const shiftX = canopyX * 0.55;
    const alpha = 0.4 + motion * 0.18;

    switch (def.kind) {
      case 'tallGrass':
        this.paintBladeShadows(g, parts, h, shiftX, alpha);
        this.paintGrassSmear(g, w, h, shiftX, lean, alpha);
        break;
      case 'broadLeaf':
        this.paintLobeShadows(g, parts, h, shiftX, alpha);
        this.paintBroadSmear(g, w, h, shiftX, lean, alpha);
        break;
      case 'thinStem':
        this.paintStemShadow(g, parts, h, shiftX, lean, alpha);
        break;
      case 'lowCluster':
        this.paintTuftShadows(g, parts, w, h, shiftX, lean, alpha);
        break;
    }
  }

  /**
   * Gravel-plane Y for a leaf shadow. Stays on the bed (positive Y) and
   * stretches toward the tank back (negative Y) without crossing the front edge.
   */
  private gravelShadowY(leafDepth: number, plantHeight: number): number {
    const towardBack = Math.min(leafDepth * 0.07, plantHeight * 0.14);
    return 7 - towardBack;
  }

  /** Thin blade strokes projected from each grass leaf. */
  private paintBladeShadows(
    g: Graphics,
    parts: SwayPart[],
    h: number,
    shiftX: number,
    alpha: number,
  ): void {
    for (const part of parts) {
      const depth = Math.abs(part.node.y);
      const rot = part.node.rotation;
      const side = Math.sign(part.baseRotation) || 1;
      const sx = shiftX + Math.sin(rot) * depth * 0.4 + side * (4 + depth * 0.02);
      const sy = this.gravelShadowY(depth, h);
      const len = 5 + depth * 0.045;
      const dx = Math.sin(rot) * len;
      const dy = Math.cos(rot) * len * 0.12;

      g.moveTo(sx - dx, sy - dy)
        .lineTo(sx + dx, sy + dy)
        .stroke({ width: 2.2, color: SHADOW_SOFT, alpha: alpha * 0.82, cap: 'round' });
    }
  }

  private paintGrassSmear(
    g: Graphics,
    w: number,
    h: number,
    shiftX: number,
    lean: number,
    alpha: number,
  ): void {
    const sign = Math.sign(lean) || 1;
    const reach = Math.abs(Math.sin(lean)) * w * 0.55;
    const tipX = shiftX + sign * reach;
    const backY = -Math.min(h * 0.22, 55);
    g.moveTo(shiftX - 3, 7)
      .quadraticCurveTo(shiftX + sign * reach * 0.5, backY * 0.55, tipX, backY)
      .lineTo(tipX - sign * 4, backY + 5)
      .quadraticCurveTo(shiftX + sign * reach * 0.35, 6, shiftX - 2, 7)
      .closePath()
      .fill({ color: SHADOW_SOFT, alpha: alpha * 0.42 });
  }

  /** Rounded lobes under each broad leaf. */
  private paintLobeShadows(
    g: Graphics,
    parts: SwayPart[],
    h: number,
    shiftX: number,
    alpha: number,
  ): void {
    for (const part of parts) {
      const depth = Math.abs(part.node.y);
      const rot = part.node.rotation;
      const side = Math.sign(part.baseRotation) || 1;
      const sx = shiftX + Math.sin(rot) * depth * 0.38 + side * 7;
      const sy = this.gravelShadowY(depth, h);
      const lobeW = 9 + depth * 0.03;
      const lobeH = 4.5;

      g.ellipse(sx, sy, lobeW, lobeH).fill({ color: SHADOW_SOFT, alpha: alpha * 0.72 });
      g.ellipse(sx + Math.sin(rot) * 3, sy - 1, lobeW * 0.55, lobeH * 0.65).fill({
        color: SHADOW_CORE,
        alpha: alpha * 0.48,
      });
    }
  }

  private paintBroadSmear(
    g: Graphics,
    w: number,
    h: number,
    shiftX: number,
    lean: number,
    alpha: number,
  ): void {
    const sign = Math.sign(lean) || 1;
    const reach = Math.abs(Math.sin(lean)) * w * 0.45;
    const backY = -Math.min(h * 0.18, 48);
    g.moveTo(shiftX - w * 0.3, 7)
      .quadraticCurveTo(shiftX + sign * reach * 0.6, backY * 0.6, shiftX + sign * reach, backY)
      .lineTo(shiftX + sign * reach - sign * 6, backY + 4)
      .quadraticCurveTo(shiftX, 6, shiftX - w * 0.25, 7)
      .closePath()
      .fill({ color: SHADOW_SOFT, alpha: alpha * 0.38 });
  }

  /** Narrow stem streak with leaf dots along the nodes. */
  private paintStemShadow(
    g: Graphics,
    parts: SwayPart[],
    h: number,
    shiftX: number,
    lean: number,
    alpha: number,
  ): void {
    const tipX = shiftX + Math.sin(lean) * h * 0.08;
    const backY = -Math.min(h * 0.2, 52);
    g.moveTo(shiftX, 5)
      .quadraticCurveTo(tipX, backY * 0.45, tipX, backY)
      .stroke({ width: 2.5, color: SHADOW_CORE, alpha: alpha * 0.92, cap: 'round' });

    for (const part of parts) {
      const depth = Math.abs(part.node.y);
      const rot = part.node.rotation;
      const sx = shiftX + Math.sin(rot) * depth * 0.35;
      const sy = this.gravelShadowY(depth, h);
      g.ellipse(sx + Math.sin(rot) * 5, sy, 4.5, 2.8).fill({
        color: SHADOW_SOFT,
        alpha: alpha * 0.68,
      });
    }
  }

  /** Short fan of tuft shadows hugging the gravel. */
  private paintTuftShadows(
    g: Graphics,
    parts: SwayPart[],
    w: number,
    h: number,
    shiftX: number,
    lean: number,
    alpha: number,
  ): void {
    const sign = Math.sign(lean) || 1;
    const backY = -Math.min(h * 0.16, 30);
    g.moveTo(shiftX - w * 0.4, 7)
      .quadraticCurveTo(shiftX + sign * 6, backY, shiftX + w * 0.35, 7)
      .lineTo(shiftX + w * 0.3, 9)
      .lineTo(shiftX - w * 0.35, 9)
      .closePath()
      .fill({ color: SHADOW_SOFT, alpha: alpha * 0.42 });

    parts.forEach((part, i) => {
      const rot = part.node.rotation;
      const sx = shiftX + (i - parts.length / 2) * 5 + Math.sin(rot) * 4;
      const sy = this.gravelShadowY(Math.abs(part.node.y) + 8, h);
      const len = 4 + Math.abs(Math.sin(rot)) * 3;
      const dx = Math.sin(rot + 0.3) * len;
      g.moveTo(sx, sy)
        .lineTo(sx + dx, sy - Math.abs(dx) * 0.12)
        .stroke({ width: 2, color: SHADOW_SOFT, alpha: alpha * 0.78, cap: 'round' });
    });
  }

  /** Root pebbles (back) and stem stub so plants feel planted. */
  private drawPlantBase(root: Container, def: PlantDef): void {
    const g = new Graphics();

    this.drawRootGravelStones(g, def, 'back');

    g.moveTo(def.lean * 4, 2)
      .quadraticCurveTo(def.lean * 6, -6, def.lean * 2, -14)
      .quadraticCurveTo(def.lean * -2, -6, def.lean * 0, 2)
      .closePath()
      .fill({ color: COLORS.plantStemDark, alpha: 0.7 });

    root.addChild(g);
  }

  /** Front pebbles and sediment wash — hides stem base in the gravel. */
  private drawStemBurial(root: Container, def: PlantDef): void {
    const g = new Graphics();
    this.drawRootGravelStones(g, def, 'front');
    g.ellipse(def.lean * 3, 2, 12, 5).fill({ color: COLORS.gravelMid, alpha: 0.22 });
    root.addChild(g);
  }

  /**
   * Small gravel pebbles clustered at the plant root.
   * Back layer sits under stems; front layer overlaps the lower stem.
   */
  private drawRootGravelStones(
    g: Graphics,
    def: PlantDef,
    layer: 'back' | 'front',
  ): void {
    const seed = def.xFactor * 997 + def.phase * 131 + def.heightFactor * 53;
    const rnd = makeSeededRng(seed + (layer === 'front' ? 9001 : 0));

    const moundW =
      def.kind === 'tallGrass' ? 44 : def.kind === 'broadLeaf' ? 34 : def.kind === 'thinStem' ? 28 : 22;
    const count = layer === 'back' ? 16 : 8;

    for (let i = 0; i < count; i++) {
      const angle = rnd() * Math.PI * 2;
      const dist = (0.25 + rnd() * 0.75) * moundW * (layer === 'front' ? 0.5 : 0.62);
      const ox = Math.cos(angle) * dist + def.lean * 6;
      const oy =
        Math.sin(angle) * dist * 0.38 +
        (layer === 'front' ? 0 : 2) +
        rnd() * (layer === 'front' ? 3 : 5);

      const size = 1.8 + rnd() * (layer === 'back' ? 4.2 : 3.2);
      const rx = size * (0.85 + rnd() * 0.35);
      const ry = size * (0.55 + rnd() * 0.3);
      const color = PEBBLE_COLORS[Math.floor(rnd() * PEBBLE_COLORS.length)];

      g.ellipse(ox, oy, rx, ry).fill({
        color,
        alpha: 0.72 + rnd() * 0.26,
      });

      if (rnd() > 0.35) {
        g.ellipse(ox - rx * 0.25, oy - ry * 0.3, rx * 0.38, ry * 0.32).fill({
          color: COLORS.gravelLight,
          alpha: 0.18 + rnd() * 0.12,
        });
      }

      if (rnd() > 0.7) {
        g.ellipse(ox + rx * 0.15, oy + ry * 0.2, rx * 0.55, ry * 0.4).fill({
          color: COLORS.gravelShadow,
          alpha: 0.2,
        });
      }
    }
  }

  private buildPlant(
    swayGroup: Container,
    parts: SwayPart[],
    def: PlantDef,
    h: number,
  ): void {
    switch (def.kind) {
      case 'tallGrass':
        this.drawTallGrassPlant(swayGroup, parts, h, def);
        break;
      case 'broadLeaf':
        this.drawBroadLeafPlant(swayGroup, parts, h, def);
        break;
      case 'thinStem':
        this.drawStemPlant(swayGroup, parts, h, def);
        break;
      case 'lowCluster':
        this.drawLowClusterPlant(swayGroup, parts, h, def);
        break;
    }
  }

  private addSwayPart(
    parent: Container,
    parts: SwayPart[],
    draw: (g: Graphics) => void,
    attachY: number,
    baseRotation: number,
    swayAmount: number,
    phase: number,
  ): void {
    const node = new Container();
    node.y = attachY;
    const g = new Graphics();
    draw(g);
    node.addChild(g);
    parent.addChild(node);
    parts.push({ node, baseRotation, swayAmount, phase });
  }

  private drawCurvedStem(
    g: Graphics,
    lean: number,
    h: number,
    width: number,
  ): void {
    const tipX = lean * h * 0.12;
    g.moveTo(0, 0)
      .quadraticCurveTo(tipX * 0.5 + 5, -h * 0.45, tipX, -h)
      .stroke({ width, color: COLORS.plantStem, cap: 'round', join: 'round' });
    g.moveTo(0, 0)
      .quadraticCurveTo(tipX * 0.4 + 2, -h * 0.45, tipX, -h)
      .stroke({ width: width * 0.35, color: COLORS.plantStemDark, alpha: 0.4, cap: 'round' });
  }

  private drawTallGrassPlant(
    parent: Container,
    parts: SwayPart[],
    h: number,
    def: PlantDef,
  ): void {
    const stem = new Graphics();
    this.drawCurvedStem(stem, def.lean, h, 3.8);
    parent.addChild(stem);

    const bladeCount = 7;
    for (let i = 0; i < bladeCount; i++) {
      const t = 0.12 + (i / bladeCount) * 0.82;
      const attachY = -h * t;
      const side = i % 2 === 0 ? 1 : -1;
      const bladeH = h * (0.22 + (1 - t) * 0.35);
      const spread = side * (8 + i * 2.2);
      const color = i % 3 === 0 ? COLORS.plantLeafLight : i % 2 === 0 ? COLORS.plantLeaf : COLORS.plantDark;

      this.addSwayPart(
        parent,
        parts,
        (g) => {
          g.moveTo(0, 0)
            .quadraticCurveTo(spread * 0.4, -bladeH * 0.55, spread, -bladeH)
            .quadraticCurveTo(spread * 0.6, -bladeH * 0.5, 0, 0)
            .closePath()
            .fill({ color, alpha: 0.9 });
          g.moveTo(spread * 0.15, -bladeH * 0.3)
            .lineTo(spread * 0.1, -bladeH * 0.85)
            .stroke({ width: 0.5, color: COLORS.plantLeafLight, alpha: 0.35 });
        },
        attachY,
        side * 0.15,
        0.05 + i * 0.008,
        def.phase + i * 0.4,
      );
    }
  }

  private drawBroadLeafPlant(
    parent: Container,
    parts: SwayPart[],
    h: number,
    def: PlantDef,
  ): void {
    const stem = new Graphics();
    this.drawCurvedStem(stem, def.lean, h * 0.85, 4.2);
    parent.addChild(stem);

    const leafCount = 4;
    for (let i = 0; i < leafCount; i++) {
      const t = 0.2 + (i / leafCount) * 0.65;
      const attachY = -h * t;
      const side = i % 2 === 0 ? 1 : -1;
      const leafW = 14 + (leafCount - i) * 2.5;
      const leafH = 9 + i * 1.2;
      const color = i % 2 === 0 ? COLORS.plantLeaf : COLORS.plantLeafLight;

      this.addSwayPart(
        parent,
        parts,
        (g) => {
          g.ellipse(side * leafW * 0.45, -leafH * 0.35, leafW, leafH).fill({ color, alpha: 0.92 });
          g.ellipse(side * leafW * 0.35, -leafH * 0.45, leafW * 0.5, leafH * 0.35).fill({
            color: COLORS.plantLeafLight,
            alpha: 0.35,
          });
        },
        attachY,
        side * 0.25,
        0.06,
        def.phase + i * 0.55,
      );
    }
  }

  private drawStemPlant(
    parent: Container,
    parts: SwayPart[],
    h: number,
    def: PlantDef,
  ): void {
    const stem = new Graphics();
    this.drawCurvedStem(stem, def.lean, h, 3.2);
    parent.addChild(stem);

    const nodes = 5;
    for (let i = 0; i < nodes; i++) {
      const attachY = -h * (0.18 + (i / nodes) * 0.7);
      const side = i % 2 === 0 ? 1 : -1;
      const leafW = 6.5;
      const leafH = 4;

      this.addSwayPart(
        parent,
        parts,
        (g) => {
          g.ellipse(side * 9, -1, leafW, leafH).fill({
            color: i % 2 === 0 ? COLORS.plantLeaf : COLORS.plantDark,
            alpha: 0.88,
          });
        },
        attachY,
        side * 0.35,
        0.07,
        def.phase + i * 0.35,
      );
    }
  }

  private drawLowClusterPlant(
    parent: Container,
    parts: SwayPart[],
    h: number,
    def: PlantDef,
  ): void {
    const tufts = 5;
    for (let i = 0; i < tufts; i++) {
      const x = (i - tufts / 2) * 7.5 + def.lean * 6;
      const tuftH = h * (0.5 + (i % 3) * 0.15);
      const attachY = -2;

      this.addSwayPart(
        parent,
        parts,
        (g) => {
          g.moveTo(x, 0)
            .quadraticCurveTo(x + 2, -tuftH * 0.5, x + 1, -tuftH)
            .quadraticCurveTo(x - 1, -tuftH * 0.55, x, 0)
            .closePath()
            .fill({ color: COLORS.plantLeaf, alpha: 0.85 });
          g.moveTo(x + 1, -tuftH * 0.4)
            .quadraticCurveTo(x + 2, -tuftH * 0.7, x, -tuftH * 0.95)
            .stroke({ width: 0.4, color: COLORS.plantLeafLight, alpha: 0.4 });
        },
        attachY,
        (i - tufts / 2) * 0.12,
        0.045,
        def.phase + i * 0.5,
      );
    }
  }

  /**
   * Estimate where the plant mass hangs from current rotation so the floor
   * shadow slides and stretches with the sway (not a fixed blob).
   */
  private computeCanopyOffset(inst: PlantInstance): {
    canopyX: number;
    lean: number;
    motion: number;
  } {
    const { swayGroup, parts, plantHeight: h, def } = inst;
    const lean = swayGroup.rotation;

    let canopyX = Math.sin(lean) * h * 0.62;
    let motion = Math.abs(lean);

    for (const part of parts) {
      const y = part.node.y;
      const rot = part.node.rotation;
      canopyX += Math.sin(rot) * Math.abs(y) * 0.14;
      motion += Math.abs(rot - part.baseRotation);
    }
    motion /= Math.max(parts.length, 1);

    const swayVel =
      Math.abs(Math.cos(this.time * 0.75 + def.phase)) * 0.04 +
      Math.abs(Math.cos(this.time * 1.15 + def.phase * 1.2)) * 0.025;
    motion += swayVel;

    return { canopyX, lean, motion };
  }

  private updatePlantShadow(inst: PlantInstance): void {
    const { shadow, shadowGfx, root } = inst;
    const { canopyX, lean, motion } = this.computeCanopyOffset(inst);

    shadow.x = root.x;
    shadow.y = root.y + 2;
    shadow.rotation = 0;
    shadowGfx.rotation = lean * 0.25;
    shadowGfx.x = canopyX * 0.12;

    this.paintPlantShadow(shadowGfx, inst, canopyX, lean, motion);
  }

  update(dt: number): void {
    this.time += dt;

    for (const inst of this.instances) {
      const { swayGroup, def, parts } = inst;
      const mainSway =
        Math.sin(this.time * 0.75 + def.phase) * 0.04 +
        Math.sin(this.time * 1.15 + def.phase * 1.2) * 0.018;
      swayGroup.rotation = mainSway + def.lean * 0.12;

      for (const part of parts) {
        const bend = Math.sin(this.time * 0.9 + part.phase) * part.swayAmount;
        const bend2 = Math.sin(this.time * 1.35 + part.phase * 0.8) * part.swayAmount * 0.4;
        part.node.rotation = part.baseRotation + bend + bend2;
      }

      this.updatePlantShadow(inst);
    }
  }
}
