import { ARMS, KPC } from "../../helper/galaxy";

export const ARM_COUNT = ARMS.length;

// ---- Stars: real photometry. Every star (and every cluster of the galaxy) is
// drawn from its absolute magnitude and its distance to the camera: brighter
// up close, fainter far away, nothing else ----

export const starVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 aColor;
  attribute float aAbsMag;
  uniform float uScenePerParsec;
  uniform float uMagLimit;
  uniform float uGain;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float parsecs = max(length(mvPosition.xyz) / uScenePerParsec, 0.01);
    float mag = aAbsMag + 5.0 * log2(parsecs / 10.0) * 0.30103;
    // Light relative to a magnitude-1 star (10^(−0.4·Δm)), compressed like a photo
    float flux = exp2(-1.328771 * (mag - 1.0));
    float fade = 1.0 - smoothstep(uMagLimit - 1.5, uMagLimit, mag);
    vAlpha = min(pow(flux, 0.42) * uGain, 1.6) * fade;
    // Bright stars spread a little, as in photos; faint ones stay a fine point
    gl_PointSize = fade > 0.0 ? (1.4 + 1.6 * clamp(log2(flux) * 0.30103 + 1.0, 0.0, 2.0)) * uDpr : 0.0;
    vColor = aColor;
    #include <logdepthbuf_vertex>
  }
`;

export const starFragmentShader = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - vec2(0.5);
    float a = vAlpha * exp(-dot(c, c) * 12.0);
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

// ---- The disk's glow: rendered once from the model, a horizontal strip per frame ----

/** Full-screen quad, drawn in strips: uStrip is the strip's range of v */
export const bakeVertexShader = /* glsl */ `
  uniform vec2 uStrip;
  varying vec2 vUv;

  void main() {
    float v = mix(uStrip.x, uStrip.y, uv.y);
    vUv = vec2(uv.x, v);
    gl_Position = vec4(position.x, v * 2.0 - 1.0, 0.0, 1.0);
  }
`;

/** Noise and the arms' geometry */
const MODEL_GLSL = /* glsl */ `
  #define ARM_COUNT ${ARM_COUNT}
  #define KPC ${KPC.toFixed(4)}
  #define TAU 6.28318531

  uniform vec4 uArmA[ARM_COUNT]; // start radius (kpc), start angle, tan(pitch), span
  uniform vec4 uArmB[ARM_COUNT]; // ridge width (kpc), strength, major (0/1), noise seed
  uniform vec3 uBar;             // half-length, half-width (kpc), angle of the near end

  // Hash without sine (Dave Hoskins): stable on every GPU
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int o = 0; o < 5; o++) {
      v += a * noise(p);
      p = p * 2.07 + vec2(17.1, 9.2);
      a *= 0.5;
    }
    return v / 0.96875;
  }

  /** The bar's frame: x along the bar */
  vec2 barFrame(vec2 p) {
    float c = cos(uBar.z);
    float s = sin(uBar.z);
    return vec2(c * p.x + s * p.y, -s * p.x + c * p.y);
  }

  /**
   * Where arm i crosses the ray from the center through (R, theta): offset from
   * its ridge (kpc, > 0 outside), angle along the arm, ridge width and brightness.
   * The windings cross the ray at r·e^{(θ + 2πj − angle)·k}: take the nearest
   */
  bool armCrossing(int i, float R, float theta, out float off, out float along, out float w, out float env) {
    vec4 A = uArmA[i];
    vec4 B = uArmB[i];
    float k = A.z;
    float base = theta - A.y;
    along = base + TAU * floor((log(R / A.x) / k - base) / TAU + 0.5);
    off = 0.0;
    w = 1.0;
    env = 0.0;
    if (along < 0.0 || along > A.w) return false;
    float ridge = A.x * exp(along * k);
    off = (R - ridge) * inversesqrt(1.0 + k * k);
    w = B.x * (1.0 + 0.05 * ridge); // arms widen outward
    env = B.y
      * smoothstep(0.0, 0.4, along)
      * (1.0 - smoothstep(0.55 * A.w, A.w, along))
      * exp(-(ridge - A.x) / 7.0);
    return true;
  }
`;

/** The disk seen face-on: model coordinates out to ±uRadius (model units) */
export const diskBakeFragmentShader = /* glsl */ `
  ${MODEL_GLSL}
  uniform float uRadius;
  varying vec2 vUv;

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uRadius / KPC;
    float R = max(length(p), 1e-4);
    float theta = atan(p.y, p.x);

    // Old stars: exponential disk, bar, boxy bulge, nucleus
    float disk = exp(-R / 2.6) * (1.0 - smoothstep(12.5, 16.5, R));
    vec2 q = barFrame(p);
    float bar = exp(-pow(abs(q.x) / uBar.x, 3.0) - pow(q.y / (uBar.y * 0.55), 2.0));
    vec2 qb = q / vec2(1.4, 0.9);
    float bulge = exp(-dot(qb, qb));
    float nucleus = exp(-R * R / 0.02);
    float old = 0.32 * disk * (0.75 + 0.5 * fbm(p * 1.3)) + 0.5 * bar + 0.85 * bulge + 1.4 * nucleus;

    float young = 0.0;
    float nebula = 0.0;
    float dust = 0.0;
    for (int i = 0; i < ARM_COUNT; i++) {
      float off, along, w, env;
      if (!armCrossing(i, R, theta, off, along, w, env) || abs(off) > 7.0 * w) continue;
      // Coordinates along / across the arm: streaks and clumps follow it
      float s = along * (R - off);
      vec2 st = vec2(s * 0.9, off * 2.2) + uArmB[i].w;
      float clumps = fbm(st);
      float profile = exp(-off * off / (2.0 * w * w));
      young += env * profile * (0.25 + 1.3 * clumps * clumps);

      float wo = w * 2.6;
      old += env * uArmB[i].z * 0.32 * exp(-off * off / (2.0 * wo * wo));

      // Star-forming regions glowing pink with hydrogen
      nebula += env * profile * smoothstep(0.62, 0.82, fbm(st * 3.3 + 5.0));

      // Dust lane along the inner edge, ragged
      float dOff = off + 0.85 * w;
      float dw = 0.4 * w;
      dust += env * exp(-dOff * dOff / (2.0 * dw * dw))
        * (0.35 + 0.9 * fbm(vec2(s * 1.8, dOff * 7.0) + uArmB[i].w + 11.0));
    }

    vec3 col = old * vec3(1.0, 0.79, 0.56)
             + young * vec3(0.56, 0.7, 1.0)
             + nebula * vec3(1.0, 0.3, 0.48) * 0.9;
    col *= 1.0 - min(dust * 0.9, 0.85);
    // Display colors (gamma-encoded: finer steps in the dark parts), linearized when drawn
    gl_FragColor = vec4(1.0 - exp(-col * 0.95), 1.0);
  }
`;

// ---- Drawing the baked textures ----

/** The face-on glow on the disk */
export const diskVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uRadius;
  varying vec3 vModel;
  varying vec2 vUv;

  void main() {
    vModel = position;
    vUv = position.xy / (2.0 * uRadius) + 0.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

/**
 * A thin disk seen at a slant looks brighter (the line of sight crosses more of
 * it, ×1/cos of the tilt): edge-on it's a bright line. Only the most grazing
 * rays fade, since a plane has no thickness.
 */
export const diskFragmentShader = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D uGlow;
  uniform vec3 uCamera; // model units
  uniform float uOpacity;
  varying vec3 vModel;
  varying vec2 vUv;

  void main() {
    #include <logdepthbuf_fragment>
    float slant = abs(normalize(vModel - uCamera).z);
    float gain = min(1.0 / max(slant, 1e-3), 2.5) * smoothstep(0.01, 0.08, slant);
    vec3 glow = pow(texture2D(uGlow, vUv).rgb, vec3(2.2));
    gl_FragColor = vec4(glow * gain * uOpacity, 1.0);
  }
`;
