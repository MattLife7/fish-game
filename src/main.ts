import './style.css';
import { Application } from 'pixi.js';
import { AquariumScene } from './scenes/AquariumScene';

async function main(): Promise<void> {
  const app = new Application();

  await app.init({
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    background: 0x1a2433,
  });

  const mount = document.querySelector<HTMLDivElement>('#app');
  if (!mount) {
    throw new Error('#app element not found');
  }
  mount.appendChild(app.canvas);

  const scene = new AquariumScene(app);
  await scene.resize(app.screen.width, app.screen.height);

  app.renderer.on('resize', () => {
    void scene.resize(app.screen.width, app.screen.height);
  });
}

main().catch((err) => {
  console.error(err);
});
