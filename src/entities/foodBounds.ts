import type { TankLayout } from '../environment/tankLayout';

export interface FoodBounds {
  left: number;
  right: number;
  top: number;
  /** Pellets settle at or above this Y (just above gravel). */
  floor: number;
}

/** Spawn/sink region — inside glass, above gravel surface. */
export function computeFoodBounds(layout: TankLayout): FoodBounds {
  const padX = Math.max(12, layout.waterWidth * 0.022);
  const padTop = Math.max(16, layout.waterHeight * 0.045);
  const aboveGravel = Math.max(10, layout.waterHeight * 0.028);

  return {
    left: layout.waterX + padX,
    right: layout.waterX + layout.waterWidth - padX,
    top: layout.waterY + padTop,
    floor: layout.floorY - aboveGravel,
  };
}

export function isInsideWater(
  layout: TankLayout,
  x: number,
  y: number,
): boolean {
  return (
    x >= layout.waterX &&
    x <= layout.waterX + layout.waterWidth &&
    y >= layout.waterY &&
    y <= layout.waterY + layout.waterHeight
  );
}
