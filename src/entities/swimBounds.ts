import type { TankLayout } from '../environment/tankLayout';

export interface SwimBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

/** Safe open-water region — inside glass, above gravel, with modest padding. */
export function computeSwimBounds(layout: TankLayout): SwimBounds {
  const padX = Math.max(14, layout.waterWidth * 0.025);
  const padTop = Math.max(18, layout.waterHeight * 0.05);
  const padBottom = Math.max(12, layout.waterHeight * 0.035);

  const left = layout.waterX + padX;
  const right = layout.waterX + layout.waterWidth - padX;
  const top = layout.waterY + padTop;
  const bottom = layout.floorY - padBottom;

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) * 0.5,
    centerY: (top + bottom) * 0.5,
  };
}
