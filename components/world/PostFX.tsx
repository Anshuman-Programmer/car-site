"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Blur spread per tap at the very corners, in CSS pixels. */
const BLUR = 2.2;
/** 0 = centre, 1 = corner: where the blur starts and where it reaches full strength. */
const BLUR_START = 0.5;
const BLUR_FULL = 1.0;

/**
 * One direction of a separable Gaussian whose radius grows with distance from
 * the screen centre, so the middle stays crisp and only the corners soften.
 */
const CornerBlurShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: new THREE.Vector2() },
    uAspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
      float r = length(p) / length(vec2(uAspect, 1.0) * 0.5);
      vec2 o = uDir * smoothstep(${BLUR_START.toFixed(2)}, ${BLUR_FULL.toFixed(2)}, r);
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270;
      sum += (texture2D(tDiffuse, vUv + o) + texture2D(tDiffuse, vUv - o)) * 0.1945;
      sum += (texture2D(tDiffuse, vUv + o * 2.0) + texture2D(tDiffuse, vUv - o * 2.0)) * 0.1216;
      sum += (texture2D(tDiffuse, vUv + o * 3.0) + texture2D(tDiffuse, vUv - o * 3.0)) * 0.0540;
      sum += (texture2D(tDiffuse, vUv + o * 4.0) + texture2D(tDiffuse, vUv - o * 4.0)) * 0.0162;
      gl_FragColor = sum;
    }`,
};

/** Soft blur in the screen corners for a miniature, lens-like feel. Takes over rendering while mounted. */
export function PostFX() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const fx = useRef<{ composer: EffectComposer; h: ShaderPass; v: ShaderPass } | null>(null);

  useEffect(() => {
    // Stencil for the car's see-through outline (xray.ts).
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, stencilBuffer: true });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const h = new ShaderPass(CornerBlurShader);
    const v = new ShaderPass(CornerBlurShader);
    composer.addPass(h);
    composer.addPass(v);
    composer.addPass(new OutputPass());
    fx.current = { composer, h, v };
    return () => {
      fx.current = null;
      composer.dispose();
    };
  }, [gl, scene, camera]);

  useEffect(() => {
    const f = fx.current;
    if (!f) return;
    f.composer.setPixelRatio(dpr);
    f.composer.setSize(size.width, size.height);
    const aspect = size.width / size.height;
    f.h.uniforms.uDir.value.set(BLUR / size.width, 0);
    f.v.uniforms.uDir.value.set(0, BLUR / size.height);
    f.h.uniforms.uAspect.value = aspect;
    f.v.uniforms.uAspect.value = aspect;
  }, [gl, scene, camera, size, dpr]);

  useFrame((state, dt) => {
    // Until the composer exists, draw directly so the first frames aren't blank.
    if (fx.current) fx.current.composer.render(dt);
    else state.gl.render(state.scene, state.camera);
  }, 1);
  return null;
}
