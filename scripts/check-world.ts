import { getWorld, surfaceAt, coastT, heightAt, roadEdgeAt, waterAt } from "../lib/world/terrain";
// The whole world is drivable now; "drivable" here means dry land.
const isDrivable = (x: number, z: number) => surfaceAt(x, z) >= waterAt(x, z);
import { destinations } from "../data/locations";
import { islandRadius } from "../lib/world/layout";
const t0 = performance.now();
const w = getWorld();
console.log("bake ms", Math.round(performance.now() - t0));
for (const d of destinations) {
  const [x, z] = d.position;
  const c = coastT(x, z);
  console.log(d.id.padEnd(11), "t=", c.t.toFixed(3), "R=", islandRadius(Math.atan2(z, x)).toFixed(1), "h=", surfaceAt(x, z).toFixed(2), "drivable", isDrivable(x, z), "roadEdge", roadEdgeAt(x,z).toFixed(1));
}
for (const r of w.roads) {
  let bad = 0, minY = 99, maxY = -99, maxSlope = 0;
  r.samples.forEach((s, i) => {
    if (!isDrivable(s.x, s.z)) bad++;
    minY = Math.min(minY, s.y); maxY = Math.max(maxY, s.y);
    if (i) maxSlope = Math.max(maxSlope, Math.abs(s.y - r.samples[i - 1].y));
  });
  console.log(r.def.id.padEnd(11), "len", r.length.toFixed(0), "samples", r.samples.length, "undrivable", bad, "y", minY.toFixed(2), maxY.toFixed(2), "maxSlope", maxSlope.toFixed(3), "bridge", r.samples.filter(s=>s.bridge).length);
}
console.log("fallIndex", w.fallIndex, "/", w.stream.length, "fall at", w.stream[w.fallIndex].x.toFixed(1), w.stream[w.fallIndex].z.toFixed(1));
// drivable fraction
let ok = 0;
for (let x = -170; x < 170; x += 4) for (let z = -170; z < 170; z += 4) { if (isDrivable(x, z)) ok++; }
console.log("drivable area m2 ~", ok * 16);
console.log("lake center h", heightAt(6,-6).toFixed(2), "start h", surfaceAt(6,61).toFixed(2));
