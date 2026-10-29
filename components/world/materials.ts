import * as THREE from "three";

/** Uniforms shared by every animated material, ticked once per frame. */
export const sharedUniforms = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  /** Dense grass field around the car: xy = centre, z = radius (0 when off). */
  uField: { value: new THREE.Vector3(0, 0, 0) },
};

export const palette = {
  grassA: new THREE.Color("#8cc56a"),
  grassB: new THREE.Color("#5f9e4f"),
  meadow: new THREE.Color("#b9c96b"),
  forestFloor: new THREE.Color("#4f8a47"),
  dirt: new THREE.Color("#c2a072"),
  sand: new THREE.Color("#ead39b"),
  rockA: new THREE.Color("#d2a26c"),
  rockB: new THREE.Color("#b07a4f"),
  rockC: new THREE.Color("#8a5d43"),
  underwater: new THREE.Color("#3f8f8a"),
  road: new THREE.Color("#d9b98a"),
  roadEdge: new THREE.Color("#a9845a"),
  dirtPath: new THREE.Color("#a7825a"),
  wood: new THREE.Color("#9c6440"),
  woodDark: new THREE.Color("#6e4128"),
  roof: new THREE.Color("#c4543d"),
  cream: new THREE.Color("#f6ead2"),
  charcoal: new THREE.Color("#2b2733"),
  coral: new THREE.Color("#ff6b4a"),
};

/**
 * Standard material with a vertex-shader sway. Displacement grows with the
 * square of height above `bendStart`, phase comes from the instance position
 * so neighbouring trees never move in lockstep.
 *
 * `fieldFade` shrinks instances inside the dense grass field so tufts hand
 * over to it; `leaves` adds per-leaf flutter and keeps the canopy's rounded
 * normals on both faces of each leaf card.
 */
export function makeWindMaterial(
  params: THREE.MeshStandardMaterialParameters,
  opts: { amp: number; freq: number; bendStart: number; fieldFade?: boolean; leaves?: boolean },
) {
  const mat = new THREE.MeshStandardMaterial(params);
  mat.defines = {
    WIND_AMP: opts.amp.toFixed(4),
    WIND_FREQ: opts.freq.toFixed(3),
    WIND_BEND: opts.bendStart.toFixed(3),
    ...(opts.fieldFade ? { FIELD_FADE: "" } : {}),
    ...(opts.leaves ? { LEAF_FLUTTER: "" } : {}),
  };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.uniforms.uField = sharedUniforms.uField;
    if (opts.leaves) {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        "#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;",
      );
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uTime;\nuniform float uWind;\nuniform vec3 uField;",
      )
      // Instance colour only tints light vertices (foliage), never the dark trunks.
      .replace(
        "#include <color_vertex>",
        `vColor = vec4(1.0);
        #ifdef USE_COLOR
          vColor.rgb *= color.rgb;
        #endif
        #ifdef USE_INSTANCING_COLOR
          #ifdef USE_COLOR
            vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, step(0.6, min(color.r, min(color.g, color.b))));
          #else
            vColor.rgb *= instanceColor.rgb;
          #endif
        #endif`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iPos = vec3(0.0);
        #endif
        float bendH = max(0.0, position.y - WIND_BEND);
        float ph = iPos.x * 0.21 + iPos.z * 0.17;
        float sway = sin(uTime * WIND_FREQ + ph) * 0.65 + sin(uTime * WIND_FREQ * 2.3 + ph * 1.7) * 0.25;
        transformed.x += sway * WIND_AMP * uWind * bendH * bendH;
        transformed.z += cos(uTime * WIND_FREQ * 0.8 + ph) * WIND_AMP * 0.55 * uWind * bendH * bendH;
        #ifdef LEAF_FLUTTER
          float lph = dot(position, vec3(9.1, 7.3, 8.7)) + ph;
          transformed += objectNormal * sin(uTime * 6.5 + lph) * 0.045 * uWind;
          transformed.y += sin(uTime * 4.1 + lph * 1.3) * 0.025 * uWind;
        #endif
        #ifdef FIELD_FADE
          if (uField.z > 0.0) transformed *= smoothstep(uField.z * 0.6, uField.z * 0.88, distance(iPos.xz, uField.xy));
        #endif`,
      );
  };
  return mat;
}

/** Bake a solid colour into a geometry as a vertex colour attribute. */
export function paint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute("uv");
  return g;
}
