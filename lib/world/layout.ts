import { angleDiff, valueNoise } from "./noise";

/**
 * Hand-placed island layout. Everything else (terrain, roads, scatter, map)
 * is derived from these numbers, so tweak the world here.
 */

export const SEA_LEVEL = 0;
export const LAKE_LEVEL = 1.6;
export const LAND_BASE = 2.8;

export const WORLD_HALF = 175;

// ---------------------------------------------------------------- island shape

const PENINSULA_ANGLE = Math.PI; // west, for the lighthouse
const BEACH_ANGLE = 1.2; // south-south-east

export function islandRadius(theta: number): number {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const ripple = (valueNoise(c * 3 + 10, s * 3 + 10, 7) - 0.5) * 9;
  const pen = angleDiff(theta, PENINSULA_ANGLE) / 0.17;
  return (
    128 +
    12 * Math.sin(2 * theta + 0.6) +
    8 * Math.sin(3 * theta + 2.1) +
    5 * Math.sin(5 * theta + 0.4) +
    3 * Math.sin(7 * theta + 1.3) +
    20 * Math.exp(-pen * pen) +
    ripple
  );
}

/** 0 = cliff coast, 1 = sandy beach. */
export function beachFactor(theta: number): number {
  const d = angleDiff(theta, BEACH_ANGLE) / 0.32;
  return Math.exp(-d * d);
}

// ---------------------------------------------------------------- lake & stream

export const LAKE_CENTER: [number, number] = [6, -6];

export function lakeRadius(phi: number): number {
  return 24 + 3 * Math.sin(3 * phi + 1) + 2 * Math.sin(5 * phi + 0.3);
}

/** Stream from the lake's east shore to a waterfall on the south-east cliff. */
export const STREAM_POINTS: [number, number][] = [
  [28, 6],
  [40, 16],
  [52, 30],
  [64, 44],
  [80, 58],
  [96, 70],
  [112, 82],
];

// ---------------------------------------------------------------- roads

export type RoadKind = "main" | "spur" | "dirt";

export interface RoadDef {
  id: string;
  kind: RoadKind;
  closed: boolean;
  width: number;
  points: [number, number][];
  /** Hidden roads are not drawn on the map (the secret path). */
  hidden?: boolean;
  /** Spurs start by snapping their first point onto the main loop. */
  snapStart?: boolean;
}

export const ROADS: RoadDef[] = [
  {
    id: "loop",
    kind: "main",
    closed: true,
    width: 8,
    points: [
      [0, 61],
      [32, 56],
      [54, 36],
      [66, 10],
      [67, -20],
      [54, -48],
      [28, -62],
      [-6, -66],
      [-38, -60],
      [-58, -34],
      [-66, -4],
      [-58, 28],
      [-32, 54],
    ],
  },
  {
    id: "garage",
    kind: "spur",
    closed: false,
    width: 7,
    snapStart: true,
    points: [
      [66, -6],
      [74, -6],
      [80, -6],
    ],
  },
  {
    id: "skills",
    kind: "spur",
    closed: false,
    width: 7,
    snapStart: true,
    points: [
      [20, -64],
      [21, -70],
      [22, -74],
    ],
  },
  {
    id: "tower",
    kind: "spur",
    closed: false,
    width: 7,
    snapStart: true,
    points: [
      [-51, -45],
      [-60, -50],
      [-67, -55],
      [-69, -62],
    ],
  },
  {
    id: "lighthouse",
    kind: "spur",
    closed: false,
    width: 7,
    snapStart: true,
    points: [
      [-66, -2],
      [-80, -1],
      [-94, 2],
      [-106, 4],
    ],
  },
  {
    id: "offroad-spur",
    kind: "dirt",
    closed: false,
    width: 5,
    snapStart: true,
    points: [
      [-59, -34],
      [-68, -35],
      [-76, -35],
    ],
  },
  {
    id: "offroad",
    kind: "dirt",
    closed: true,
    width: 6,
    points: [
      [-76, -35],
      [-78, -45],
      [-86, -51],
      [-97, -50],
      [-104, -42],
      [-105, -31],
      [-99, -22],
      [-89, -19],
      [-80, -24],
    ],
  },
  {
    id: "secret",
    kind: "dirt",
    closed: false,
    width: 4,
    hidden: true,
    snapStart: true,
    points: [
      [-16, -64],
      [-20, -78],
      [-26, -90],
      [-29, -95],
    ],
  },
];

// ---------------------------------------------------------------- flat pads

export interface Pad {
  x: number;
  z: number;
  r: number;
  /** Extra blend distance around the pad. */
  blend: number;
}

export const PADS: Pad[] = [
  { x: -10, z: 74, r: 11, blend: 8 }, // home cabin yard
  { x: 88, z: -6, r: 14, blend: 8 }, // garage forecourt
  { x: 22, z: -84, r: 12, blend: 7 }, // skills grove clearing
  { x: -66, z: -70, r: 9, blend: 10 }, // tower hilltop
  { x: -114, z: 4, r: 11, blend: 6 }, // lighthouse plaza
  { x: -30, z: -99, r: 6, blend: 5 }, // secret clearing
];

/** Gaussian hills: [x, z, height, radius]. */
export const HILLS: [number, number, number, number][] = [
  [-70, -72, 6, 24], // experience tower hill
  [70, -50, 3.5, 22],
  [-40, 70, 2.5, 20],
  [-95, -40, 4, 22],
  [95, 30, 2.5, 18],
  [-10, -100, 3, 18],
];

/** Off-road park on the western hill: a dirt loop with rocks, jumps and smashable props. */
export const COURSE = { x: -90, z: -35, radius: 20 };

/** Car start: on the loop just east of Home Base, facing east. */
export const START: { x: number; z: number; heading: number } = { x: 6, z: 61, heading: Math.PI / 2 };
