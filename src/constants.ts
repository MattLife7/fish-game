/** Layout and visual tuning for the aquarium scene. */
export const TANK_PADDING = 28;
export const TANK_FRAME = 14;
export const TANK_CORNER_RADIUS = 22;

export const BUBBLE_COUNT = 32;
export const PARTICLE_COUNT = 42;

/** Gravel bed height as a fraction of inner water (≈12–18%). */
export const GRAVEL_HEIGHT_FRACTION = 0.15;

/** Gravel floor texture (served from public/). */
export const GRAVEL_TEXTURE_URL = '/assets/gravel.jpg';

export const COLORS = {
  room: 0x1a2433,
  roomAccent: 0x243044,
  frameOuter: 0xc8dce8,
  frameInner: 0xe8f4fa,
  frameShadow: 0x4a6a80,
  waterTop: 0x5ec8e8,
  waterMid: 0x2a9fd4,
  waterDeep: 0x1568a0,
  waterDeepFloor: 0x0a3d5c,
  waterBottomTint: 0x062a42,
  gravelLight: 0xd4c4a8,
  gravelMid: 0xb8a088,
  gravelDark: 0x8a7868,
  gravelShadow: 0x6a5c50,
  gravelBed: 0x9a8a78,
  sediment: 0xb8b0a4,
  sedimentDark: 0xa39a90,
  plantStem: 0x3d6b48,
  plantStemDark: 0x2a5238,
  plantLeaf: 0x4caf6a,
  plantLeafLight: 0x6fd48a,
  plantDark: 0x2d5a3a,
  plantShadow: 0x041828,
  rock: 0x9a9088,
  rockDark: 0x6e6860,
  shell: 0xf0e6d8,
  shellAccent: 0xe8c8b0,
} as const;
