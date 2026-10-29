/**
 * High-frequency state lives in plain mutable objects, not React state.
 * The physics step writes here; the HUD and camera read it each frame.
 */

export const vehicle = {
  x: 0,
  y: 0,
  z: 0,
  heading: 0,
  /** Signed forward speed, m/s. */
  speed: 0,
  steer: 0,
  throttle: 0,
  onRoad: true,
  /** Seconds the driver has been pushing against something without moving. */
  stuckTime: 0,
  /** Set by UI to request a reset to the last safe point. */
  resetRequested: false,
  /** Last collision strength, 0..1. */
  impact: 0,
  /** Dev/testing hook: place the car here on the next frame. */
  teleportTo: null as { x: number; z: number; heading: number } | null,
};

export const input = {
  keyThrottle: 0,
  keyBrake: 0,
  keySteer: 0,
  keyHandbrake: false,
  touchThrottle: 0,
  touchBrake: 0,
  touchSteer: 0,
};

export function clearInput() {
  input.keyThrottle = 0;
  input.keyBrake = 0;
  input.keySteer = 0;
  input.keyHandbrake = false;
  input.touchThrottle = 0;
  input.touchBrake = 0;
  input.touchSteer = 0;
}
