import * as THREE from "three";

/**
 * Opaque draw order. three.js sorts opaque meshes by their nearest group's
 * renderOrder before anything else, so groups tagged here draw in this
 * sequence after the untagged world (0).
 */
export const DRAW_ORDER = {
  /** The car: its see-through outline first, then the car itself. */
  car: 10,
  /** Grass, flowers and bushes draw after the car, so driving through them never shows the outline. */
  clutter: 20,
};

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    // Pulled toward the camera, so tyres in the dirt or a sill scraping a rock don't count as hidden.
    mv.xyz += vView * 0.4;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // Faint fill, bright where the surface turns away: reads as a glowing border around the car.
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    gl_FragColor = vec4(uColor, 0.2 + 0.75 * smoothstep(0.6, 0.15, facing));
    #include <colorspace_fragment>
  }`;

/**
 * Shows the car's outline through whatever hides it, like games do. Each car
 * mesh gets a twin drawn just before the car with an inverted depth test, so
 * it only lands where something already drawn (a tree, a wall, a hill) is in
 * front. The car's own depth isn't written yet at that point, so it never
 * outlines itself; where the car is visible it then draws over its twin. The
 * stencil lets each pixel take the outline once, so overlapping parts don't
 * stack up. Tag the car's groups with DRAW_ORDER.car for the ordering.
 */
export function addOccludedOutline(root: THREE.Object3D, color: THREE.ColorRepresentation) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) } },
    vertexShader,
    fragmentShader,
    depthFunc: THREE.GreaterDepth,
    depthWrite: false,
    // Custom blending applies in the opaque pass, which the outline must stay in to draw before the car.
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
    fog: false,
  });
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  const twins = meshes.map((m) => {
    const twin = new THREE.Mesh(m.geometry, material);
    twin.renderOrder = m.renderOrder - 1;
    twin.raycast = () => {};
    m.add(twin);
    return twin;
  });
  return () => {
    twins.forEach((t) => t.removeFromParent());
    material.dispose();
  };
}
