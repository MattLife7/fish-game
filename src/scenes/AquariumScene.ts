import {
  Application,
  Container,
  FederatedPointerEvent,
  Graphics,
  Rectangle,
} from 'pixi.js';
import { Fish } from '../entities/Fish';
import { AquariumBackground } from '../environment/AquariumBackground';
import { Bubbles } from '../environment/Bubbles';
import { Gravel } from '../environment/Gravel';
import { LightRays } from '../environment/LightRays';
import { Plants } from '../environment/Plants';
import { computeTankLayout, type TankLayout } from '../environment/tankLayout';
import { WaterParticles } from '../environment/WaterParticles';
import { FoodManager } from '../systems/FoodManager';

export class AquariumScene {
  private root = new Container();
  private underwater = new Container();
  private maskGfx = new Graphics();
  private layout!: TankLayout;

  private background = new AquariumBackground();
  private lightRays = new LightRays();
  private gravel = new Gravel();
  private plants = new Plants();
  private food = new FoodManager();
  private fish = new Fish();
  private particles = new WaterParticles();
  private bubbles = new Bubbles();
  private time = 0;

  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.underwater.mask = this.maskGfx;
    this.underwater.addChild(
      this.lightRays,
      this.gravel,
      this.plants.floorShadows,
      this.food,
      this.fish,
      this.plants,
      this.particles,
      this.bubbles,
    );

    this.root.addChild(
      this.background,
      this.underwater,
      this.background.glassHighlights,
    );

    app.stage.addChild(this.root);
    app.ticker.add(this.onTick, this);

    this.fish.setFoodManager(this.food);
    this.setupInput();
  }

  private setupInput(): void {
    this.root.eventMode = 'static';
    this.refreshHitArea();
    this.root.on('pointerdown', this.onPointerDown, this);
    this.app.renderer.on('resize', this.refreshHitArea, this);
  }

  private refreshHitArea = (): void => {
    const { width, height } = this.app.screen;
    this.root.hitArea = new Rectangle(0, 0, width, height);
  };

  private onPointerDown = (e: FederatedPointerEvent): void => {
    const p = this.root.toLocal(e.global);
    this.food.trySpawnAt(p.x, p.y);
  };

  async resize(width: number, height: number): Promise<void> {
    this.layout = computeTankLayout(width, height);
    this.updateMask();

    this.background.rebuild(this.layout);
    this.lightRays.rebuild(this.layout);
    await this.gravel.rebuild(this.layout);
    this.plants.rebuild(this.layout);
    this.food.rebuild(this.layout);
    this.fish.rebuild(this.layout);
    this.particles.rebuild(this.layout);
    this.bubbles.rebuild(this.layout);
  }

  destroy(): void {
    this.app.ticker.remove(this.onTick, this);
    this.app.renderer.off('resize', this.refreshHitArea, this);
    this.root.off('pointerdown', this.onPointerDown, this);
    this.root.destroy({ children: true });
  }

  private updateMask(): void {
    const { waterX, waterY, waterWidth, waterHeight, cornerRadius } =
      this.layout;
    this.maskGfx.clear();
    this.maskGfx
      .roundRect(waterX, waterY, waterWidth, waterHeight, cornerRadius - 4)
      .fill(0xffffff);
  }

  private onTick = (): void => {
    const dt = this.app.ticker.deltaMS / 1000;
    this.time += dt;
    this.background.update(dt);
    this.lightRays.update(dt);
    this.plants.update(dt);
    this.food.update(dt, this.time);
    this.fish.update(dt, this.time);
    this.particles.update(dt);
    this.bubbles.update(dt);
  };
}
