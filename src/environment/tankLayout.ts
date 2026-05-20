import {
  GRAVEL_HEIGHT_FRACTION,
  TANK_CORNER_RADIUS,
  TANK_FRAME,
  TANK_PADDING,
} from '../constants';

export interface TankLayout {
  screenWidth: number;
  screenHeight: number;
  tankX: number;
  tankY: number;
  tankWidth: number;
  tankHeight: number;
  cornerRadius: number;
  frameWidth: number;
  /** Interior water bounds (inside the glass frame). */
  waterX: number;
  waterY: number;
  waterWidth: number;
  waterHeight: number;
  floorY: number;
}

export function computeTankLayout(
  screenWidth: number,
  screenHeight: number,
): TankLayout {
  const tankX = TANK_PADDING;
  const tankY = TANK_PADDING;
  const tankWidth = Math.max(200, screenWidth - TANK_PADDING * 2);
  const tankHeight = Math.max(200, screenHeight - TANK_PADDING * 2);
  const cornerRadius = Math.min(
    TANK_CORNER_RADIUS,
    tankWidth * 0.04,
    tankHeight * 0.04,
  );
  const frameWidth = TANK_FRAME;
  const waterX = tankX + frameWidth;
  const waterY = tankY + frameWidth;
  const waterWidth = tankWidth - frameWidth * 2;
  const waterHeight = tankHeight - frameWidth * 2;
  const floorY = waterY + waterHeight * (1 - GRAVEL_HEIGHT_FRACTION);

  return {
    screenWidth,
    screenHeight,
    tankX,
    tankY,
    tankWidth,
    tankHeight,
    cornerRadius,
    frameWidth,
    waterX,
    waterY,
    waterWidth,
    waterHeight,
    floorY,
  };
}
