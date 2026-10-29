import { getScatter } from "./scatter";
import { registerStructureColliders } from "./structures";
import { getWorld } from "./terrain";

let ready = false;

/** Bake terrain, register colliders and scatter vegetation — once per page load. */
export function initWorld() {
  if (ready) return;
  getWorld();
  registerStructureColliders();
  getScatter();
  ready = true;
}
