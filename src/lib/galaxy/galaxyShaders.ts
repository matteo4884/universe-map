import { ARMS, KPC, SUN_DISTANCE_KPC } from "../../helper/galaxy";
import { CLOUD_BLOBS, CLOUD_REACH_KPC } from "../../helper/darkClouds";

/**
 * The Milky Way is drawn from rules only, the same from every viewpoint:
 * - stars generated on the GPU from their index (no buffers), placed by the
 *   model of helper/galaxy.ts, each with an absolute magnitude;
 * - one photometry for every star: the light reaching the camera from its
 *   absolute magnitude and distance (a magnitude-1 star = 1);
 * - stars near the camera are points, their brightness compressed like a
 *   photo's and their size growing with it;
 * - far away the galaxy's stars can't be told apart: their light is added up
 *   in a buffer of its own, blurred a little like any unresolved light, then
 *   stretched, so the galaxy glows as bright from any distance and on any
 *   screen. Each group of stars turns from points into glow gradually, by
 *   its distance;
 * - dust as a 3D field: each star is dimmed and reddened by the dust between
 *   it and the camera, so dust lanes, the dark line of the edge-on disk and
 *   the rifts of the Milky Way seen from Earth all come from the same rule;
 *   the real dark clouds around the Sun (darkClouds.ts) make the rift ragged;
 * - star-forming nebulae as glowing 3D clouds.
 * Model units are 100 ly; the shaders work in kpc.
 */

export const ARM_COUNT = ARMS.length;
/** Galactic dust: a thin layer (scale height, kpc), traced this far from the plane */
const DUST_HEIGHT = 0.1;
const DUST_SLAB = 0.6;
const DUST_STEPS = 10;
/** The dust map stores √(surface density / this): 8 bits, fine steps where dust is thin */
const DUST_MAP_MAX = 4;
/** The Local Bubble: the Sun sits in a hot cavity almost free of dust, ~150 pc across (kpc) */
const LOCAL_BUBBLE: [number, number] = [0.1, 0.25];
/** Globular clusters: the first stars of the index range, one per cluster */
const GLOBULAR_COUNT = 160;
/** Young stars are born in groups: this many consecutive indices per cluster */
const CLUSTER_SIZE = 16;

const glslFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/** Constants, arm uniforms, random numbers, the arms' geometry */
const COMMON = /* glsl */ `
  #define ARM_COUNT ${ARM_COUNT}
  #define KPC ${KPC.toFixed(4)}
  #define SUN_KPC ${glslFloat(SUN_DISTANCE_KPC)}
  #define TAU 6.28318531

  uniform vec4 uArmA[ARM_COUNT]; // start radius (kpc), start angle, tan(pitch), span
  uniform vec4 uArmB[ARM_COUNT]; // ridge width (kpc), strength, major (0/1), noise seed
  uniform vec3 uBar;             // half-length, half-width (kpc), angle of the near end

  // PCG hash: a fixed stream of random numbers per star
  uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
  }
  float rnd(inout uint s) {
    s = pcg(s);
    return float(s >> 8u) / 16777216.0;
  }
  float gauss(inout uint s) {
    float u = max(rnd(s), 1e-7);
    return sqrt(-2.0 * log(u)) * cos(TAU * rnd(s));
  }
  /** Exponential (Laplace) height above the plane */
  float laplace(inout uint s, float h) {
    float u = max(rnd(s), 1e-7);
    return -h * log(u) * (rnd(s) < 0.5 ? -1.0 : 1.0);
  }
  vec2 rotate(vec2 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }

  /** Point on an arm's ridge, along radians from its start (kpc) */
  vec2 armPoint(int i, float along) {
    float r = uArmA[i].x * exp(along * uArmA[i].z);
    float phi = uArmA[i].y + along;
    return r * vec2(cos(phi), sin(phi));
  }
  /** Unit vector across the arm, pointing outward */
  vec2 armNormal(int i, float along) {
    float k = uArmA[i].z;
    float phi = uArmA[i].y + along;
    vec2 t = vec2(k * cos(phi) - sin(phi), k * sin(phi) + cos(phi));
    return normalize(vec2(t.y, -t.x));
  }
  /** How bright the arm is there (0–1): fading in, out, and with the disk's light */
  float armEnvelope(int i, float along) {
    float span = uArmA[i].w;
    float r = uArmA[i].x * exp(along * uArmA[i].z);
    return clamp(along / 0.35, 0.0, 1.0) * clamp((span - along) / (span * 0.4), 0.0, 1.0) * exp(-(r - uArmA[i].x) / 5.72);
  }
  float armWeight(int i, bool young) {
    return young ? uArmB[i].y : (uArmB[i].z > 0.5 ? 1.0 : 0.25) * uArmB[i].y;
  }
  int pickArm(float u, bool young) {
    float total = 0.0;
    for (int a = 0; a < ARM_COUNT; a++) total += armWeight(a, young);
    float x = u * total;
    for (int a = 0; a < ARM_COUNT; a++) {
      x -= armWeight(a, young);
      if (x <= 0.0) return a;
    }
    return 0;
  }
`;

/** The dust between a point and the camera: optical depth (V band) */
const DUST = /* glsl */ `
  #define DUST_HEIGHT ${glslFloat(DUST_HEIGHT)}
  #define DUST_SLAB ${glslFloat(DUST_SLAB)}
  #define DUST_STEPS ${DUST_STEPS}
  #define CLOUD_COUNT ${CLOUD_BLOBS.length}
  #define CLOUD_REACH ${glslFloat(Math.ceil(CLOUD_REACH_KPC * 100) / 100)}
  uniform sampler2D uDust;    // √(surface density / ${DUST_MAP_MAX}), over ±uDustRadius (kpc)
  uniform float uDustRadius;
  uniform float uDustOpacity; // optical depth per kpc for unit density
  uniform vec3 uCameraKpc;    // camera, model axes, kpc
  uniform vec4 uClouds[CLOUD_COUNT];         // dark clouds near the Sun: center (kpc), σ (kpc)
  uniform vec4 uCloudDepth[CLOUD_COUNT / 4]; // optical depth through each center, four per vector

  float erfApprox(float x) {
    return sign(x) * sqrt(1.0 - exp(-1.2732395 * x * x));
  }
  float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z
    );
  }
  /** Clouds are lumpy and stringy: their dust thickens and thins across them (1–4 pc), average ~1 */
  float lumps(vec3 q) {
    float n = noise3(q * 350.0) * 0.55 + noise3(q * 900.0) * 0.3 + noise3(q * 2200.0) * 0.15;
    return 0.05 + 6.0 * n * n * n;
  }

  /** Optical depth through the dark clouds near the Sun, from p to the camera: Gaussian blobs, integrated exactly */
  float cloudDepth(vec3 p) {
    vec3 d = uCameraKpc - p;
    float len = length(d);
    if (len < 1e-6) return 0.0;
    vec3 u = d / len;
    // Lines of sight passing far from the Sun's neighborhood miss them all
    vec3 toSun = vec3(0.0, -SUN_KPC, 0.0) - p;
    if (length(toSun - u * clamp(dot(toSun, u), 0.0, len)) > CLOUD_REACH) return 0.0;
    float tau = 0.0;
    for (int i = 0; i < CLOUD_COUNT; i++) {
      vec4 c = uClouds[i];
      vec3 m = c.xyz - p;
      float t = dot(m, u);
      vec3 q = m - u * t;
      float perp2 = dot(q, q);
      float s2 = c.w * c.w;
      if (perp2 > 16.0 * s2) continue;
      float k = 0.70710678 / c.w;
      float through = exp(-0.5 * perp2 / s2) * 0.5 * (erfApprox((len - t) * k) + erfApprox(t * k));
      tau += uCloudDepth[i / 4][i % 4] * through * lumps(p + u * t);
    }
    return tau;
  }

  /**
   * Optical depth along the segment from p to the camera: the dust layer
   * (clipped to |z| < DUST_SLAB), sampled more finely near the camera, empty
   * inside the Local Bubble; plus the dark clouds near the Sun
   */
  float dustDepth(vec3 p, float jitter) {
    float clouds = cloudDepth(p);
    vec3 d = uCameraKpc - p;
    float t0 = 0.0;
    float t1 = 1.0;
    if (abs(d.z) > 1e-6) {
      float ta = (-DUST_SLAB - p.z) / d.z;
      float tb = (DUST_SLAB - p.z) / d.z;
      t0 = max(t0, min(ta, tb));
      t1 = min(t1, max(ta, tb));
    } else if (abs(p.z) > DUST_SLAB) {
      return clouds;
    }
    if (t1 <= t0) return clouds;
    float len = length(d) * (t1 - t0);
    float tau = 0.0;
    for (int k = 0; k < DUST_STEPS; k++) {
      float x = (float(k) + jitter) / float(DUST_STEPS);
      vec3 q = p + d * (t1 - (t1 - t0) * x * x);
      float v = texture(uDust, q.xy / (2.0 * uDustRadius) + 0.5).r;
      float bubble = smoothstep(${glslFloat(LOCAL_BUBBLE[0])}, ${glslFloat(LOCAL_BUBBLE[1])}, length(q - vec3(0.0, -SUN_KPC, 0.0)));
      float column = v * v * ${glslFloat(DUST_MAP_MAX)} * bubble;
      tau += column * exp(-abs(q.z) / DUST_HEIGHT) / (2.0 * DUST_HEIGHT) * 2.0 * x / float(DUST_STEPS) * len;
    }
    return tau * uDustOpacity + clouds;
  }
`;

/** Light of a star from its absolute magnitude, distance and the dust in front */
const PHOTOMETRY = /* glsl */ `
  // Dust dims blue light more than red: what shines through turns warmer
  const vec3 REDDENING = vec3(0.75, 1.0, 1.35);
  // Past this optical depth a star is too faint to tell its color: no deeper tint
  const float REDDENING_MAX_DEPTH = 0.8;

  /** The light reaching the camera, relative to a magnitude-1 star (10^(−0.4·Δm)), and the reddened color */
  float photometry(float absMag, float parsecs, float tau, inout vec3 color) {
    float mag = absMag + 5.0 * log2(parsecs / 10.0) * 0.30103 + 1.0857 * tau;
    color *= exp(-min(tau, REDDENING_MAX_DEPTH) * (REDDENING - 1.0));
    // Far past white: kept finite for the half-float buffer
    return min(exp2(-1.328771 * (mag - 1.0)), 1e4);
  }
`;

/** A star seen as a point: brightness compressed like a photo, size growing with it */
const STAR_LOOK = /* glsl */ `
  uniform float uMagLimit;
  uniform float uGain;
  uniform float uDpr;

  /** Alpha and size (px) from the light reaching the camera; false when too faint to draw */
  bool starLook(float flux, out float alpha, out float size) {
    float mag = 1.0 - 2.5 * log2(flux) * 0.30103;
    // Fainter than the limit: lost in the background, like in a long exposure
    float fade = 1.0 - smoothstep(uMagLimit - 1.5, uMagLimit, mag);
    // Capped at white: stars stay sharp points, only the Sun blooms
    alpha = min(pow(flux, 0.42) * uGain, 1.0) * fade;
    // Bright stars spread a little, as in photos; faint ones stay a fine point
    size = (1.4 + 1.6 * clamp(log2(flux) * 0.30103 + 1.0, 0.0, 2.0)) * uDpr;
    return fade > 0.0;
  }
`;

/** The galaxy's light lands in its buffer as points 2 px wide, shared between the pixels around their exact position */
const SPLAT_SIZE = "2.0";

/**
 * Every vertex is a group of the galaxy's stars, generated from its index.
 * Drawn twice: as a point where it's near enough to tell its stars apart
 * (CRISP), as light added to the glow beyond
 */
export const galaxyStarVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  ${COMMON}
  ${DUST}
  ${PHOTOMETRY}
  ${STAR_LOOK}
  uniform float uCount;
  uniform float uParticleMag; // absolute magnitude of a group
  uniform float uScenePerParsec;
  uniform vec2 uResolved;     // camera distance (kpc): a point nearer than x, glow beyond y
  varying vec3 vColor;
  #ifdef CRISP
  uniform float uPointFlux;   // with fewer groups, each point brighter: the band keeps its light
  varying float vAlpha;
  #else
  varying float vFlux;
  #endif

  /** Old stars: mostly pale yellow-white, some orange giants */
  vec3 warm(inout uint s) {
    float t = rnd(s);
    return mix(vec3(1.0, 0.93, 0.84), vec3(1.0, 0.8, 0.6), t * t);
  }

  /** Halo radius with density ∝ r^−3.5 beyond 1 kpc, slightly flattened */
  vec3 haloPosition(inout uint s, float maxR) {
    float r = pow(max(rnd(s), 1e-6), -2.0);
    if (r > maxR) r = 1.0 + (maxR - 1.0) * rnd(s);
    float cosT = rnd(s) * 2.0 - 1.0;
    float sinT = sqrt(1.0 - cosT * cosT);
    float phi = TAU * rnd(s);
    return r * vec3(sinT * cos(phi), sinT * sin(phi), cosT * 0.75);
  }

  /** Radius for a surface density ∝ e^(−R/h), out to maxR (kpc) */
  float diskRadius(inout uint s, float h, float maxR) {
    float r = -h * log(max(rnd(s) * rnd(s), 1e-9));
    return r < maxR ? r : maxR * sqrt(rnd(s));
  }

  void main() {
    int index = gl_VertexID;
    uint s = uint(index) * 2654435761u + 26700u;
    vec3 pos;
    vec3 color;
    float dMag;

    // Population by place in the index range (shares of all stars)
    float f = float(index - ${GLOBULAR_COUNT}) / max(uCount - ${glslFloat(GLOBULAR_COUNT)}, 1.0);
    if (index < ${GLOBULAR_COUNT}) {
      // Globular clusters: old, compact, bright, all around the center
      pos = haloPosition(s, 40.0);
      color = vec3(1.0, 0.9, 0.72);
      dMag = -1.5;
    } else if (f < 0.1) {
      // Bulge: boxy, aligned with the bar, old warm stars, reaching ~1.5 kpc
      // above and below the plane (seen from Earth: the star clouds of
      // Sagittarius, beyond the dust)
      pos = vec3(rotate(vec2(gauss(s), gauss(s) * 0.5), uBar.z), laplace(s, 0.45));
      color = warm(s);
      dMag = 0.3;
    } else if (f < 0.172) {
      // Bar: flat along its length, rounded ends
      float u = (rnd(s) * 2.0 - 1.0) * uBar.x * 0.8 + gauss(s) * 0.4;
      float taper = 1.0 - 0.5 * min(abs(u) / uBar.x, 1.0);
      pos = vec3(rotate(vec2(u, gauss(s) * uBar.y * 0.4 * taper), uBar.z), gauss(s) * 0.18);
      color = warm(s);
      dMag = 0.4;
    } else if (f < 0.502) {
      // Thin disk: exponential, flaring beyond 10 kpc
      float r = diskRadius(s, 2.6, 15.5);
      float phi = TAU * rnd(s);
      float t = rnd(s);
      pos = vec3(r * cos(phi), r * sin(phi), laplace(s, 0.3 * (1.0 + max(r - 10.0, 0.0) * 0.12)));
      color = vec3(1.0, 0.88 + t * 0.08, 0.74 + t * 0.14);
      dMag = 0.5;
    } else if (f < 0.552) {
      // Thick disk: older, puffier
      float r = diskRadius(s, 2.0, 15.5);
      float phi = TAU * rnd(s);
      pos = vec3(r * cos(phi), r * sin(phi), laplace(s, 0.9));
      color = warm(s);
      dMag = 0.9;
    } else if (f < 0.681) {
      // Old stars gathered by the arms (mostly the two major ones)
      int a = pickArm(rnd(s), false);
      float along = uArmA[a].w * rnd(s);
      vec2 n = armNormal(a, along);
      pos = vec3(armPoint(a, along) + n * gauss(s) * uArmB[a].x * 2.4, laplace(s, 0.22));
      color = vec3(1.0, 0.93, 0.84);
      dMag = 0.4 - 2.5 * log2(max(armEnvelope(a, along), 1e-3)) * 0.30103;
    } else if (f < 0.982) {
      // Young stars, born in clusters along the arms' ridges: the cluster
      // comes from the group of consecutive indices, the star from its own
      int first = ${GLOBULAR_COUNT} + int(0.681 * (uCount - ${glslFloat(GLOBULAR_COUNT)}));
      uint c = uint((index - first) / ${CLUSTER_SIZE}) * 2246822519u + 1610u;
      int a = pickArm(rnd(c), true);
      float along = uArmA[a].w * rnd(c);
      vec2 center = armPoint(a, along) + armNormal(a, along) * gauss(c) * uArmB[a].x * 0.8;
      float spread = 0.05 + rnd(c) * 0.12;
      pos = vec3(center + vec2(gauss(s), gauss(s)) * spread, laplace(s, 0.07));
      float t = rnd(s);
      color = vec3(0.66 + t * 0.3, 0.78 + t * 0.18, 1.0);
      dMag = -0.4 - 2.5 * log2(max(armEnvelope(a, along), 1e-3)) * 0.30103;
    } else {
      // Halo: sparse old stars
      pos = haloPosition(s, 30.0);
      color = warm(s);
      dMag = 1.5;
    }

    // Near the Sun the sky's own stars take over (generateSky): thin out
    float keep = smoothstep(0.8, 2.2, length(pos - vec3(0.0, -SUN_KPC, 0.0)));

    // How much of the group shows as a point
    float asPoint = 1.0 - smoothstep(uResolved.x, uResolved.y, length(uCameraKpc - pos));
    #ifdef CRISP
    float share = asPoint;
    #else
    float share = 1.0 - asPoint;
    #endif

    vec4 mvPosition = modelViewMatrix * vec4(pos * KPC, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = 0.0;
    if (share <= 0.0) return;
    float absMag = uParticleMag + dMag + gauss(s);
    float parsecs = max(length(mvPosition.xyz) / uScenePerParsec, 0.01);
    float tau = dustDepth(pos, rnd(s));
    vColor = color;
    float flux = photometry(absMag, parsecs, tau, vColor);
    bool kept = rnd(s) < keep;
    #ifdef CRISP
    float size;
    bool visible = starLook(flux * uPointFlux, vAlpha, size);
    vAlpha *= share;
    gl_PointSize = visible && kept ? size : 0.0;
    #else
    vFlux = flux * share;
    gl_PointSize = kept ? ${SPLAT_SIZE} : 0.0;
    #endif
    #include <logdepthbuf_vertex>
  }
`;

/** The stars around the Sun, from buffers (generateSky), with the same photometry and dust, drawn as points */
export const skyStarVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  ${COMMON}
  ${DUST}
  ${PHOTOMETRY}
  ${STAR_LOOK}
  attribute vec3 aColor;
  attribute float aAbsMag;
  uniform float uScenePerParsec;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float parsecs = max(length(mvPosition.xyz) / uScenePerParsec, 0.01);
    uint s = uint(gl_VertexID) * 2654435761u + 7u;
    float tau = dustDepth(position / KPC, rnd(s));
    vColor = aColor;
    float flux = photometry(aAbsMag, parsecs, tau, vColor);
    float size;
    gl_PointSize = starLook(flux, vAlpha, size) ? size : 0.0;
    #include <logdepthbuf_vertex>
  }
`;

/** A star as a point: a small soft disc */
export const pointFragmentShader = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    #include <logdepthbuf_fragment>
    vec2 c = gl_PointCoord - vec2(0.5);
    gl_FragColor = vec4(vColor * vAlpha * exp(-dot(c, c) * 12.0), 1.0);
  }
`;

/** Light into the glow's buffer, bilinear: all of it lands, wherever the point falls in the pixel grid */
export const splatFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vFlux;

  void main() {
    vec2 d = abs(gl_PointCoord - 0.5) * 2.0;
    float w = max(1.0 - d.x, 0.0) * max(1.0 - d.y, 0.0);
    gl_FragColor = vec4(vColor * vFlux * w, 1.0);
  }
`;

/**
 * Star-forming regions: clouds of hydrogen lit pink by young stars, along the
 * arms, 10–80 ly across. Faint: a few as bright as the Lagoon or Orion
 * nebulae, most far dimmer. Extended objects: up close a soft cloud of
 * constant surface brightness, far away a point with the same total light.
 * Dimmed and reddened by the dust in front, like the stars.
 */
export const nebulaVertexShader = /* glsl */ `
  ${COMMON}
  ${DUST}
  uniform float uScenePerKpc;
  uniform float uFocalPx;
  uniform float uMinPx;
  uniform float uMaxPx;
  uniform float uBrightness; // surface brightness: light per device pixel, a magnitude-1 star = 1
  varying vec3 vColor;
  varying float vFlux;
  varying float vSeed;

  void main() {
    uint s = uint(gl_VertexID) * 2246822519u + 6563u; // Hα, 656.3 nm
    int a = pickArm(rnd(s), true);
    float along = uArmA[a].w * rnd(s);
    vec2 n = armNormal(a, along);
    vec3 pos = vec3(armPoint(a, along) + n * gauss(s) * uArmB[a].x * 0.6, laplace(s, 0.05));
    // Most are small, a few are giant complexes
    float radius = 0.0015 + 0.011 * pow(rnd(s), 3.0); // kpc

    vec4 mvPosition = modelViewMatrix * vec4(pos * KPC, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    float px = 2.0 * radius * uScenePerKpc * uFocalPx / max(length(mvPosition.xyz), 1e-6);
    float tau = dustDepth(pos, rnd(s));
    float t = rnd(s);
    // Hα red with some Hβ and oxygen light: a pale pink
    vColor = vec3(1.0, 0.5 + t * 0.1, 0.6 + t * 0.1) * exp(-tau * vec3(0.75, 1.0, 1.35));
    float lit = 0.1 + 0.9 * pow(rnd(s), 3.0);
    vFlux = uBrightness * lit * armEnvelope(a, along) * min(1.0, (px * px) / (uMinPx * uMinPx));
    vSeed = rnd(s) * 100.0;
    gl_PointSize = clamp(px, uMinPx, uMaxPx);
  }
`;

export const nebulaFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vFlux;
  varying float vSeed;

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

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    // Uneven, wispy: gas, not a disc
    vec2 q = c * 5.0 + vSeed;
    float wisps = noise(q) * 0.65 + noise(q * 2.3) * 0.35;
    float edge = max(1.0 - 4.0 * dot(c, c), 0.0);
    float light = vFlux * exp(-dot(c, c) * 8.0) * edge * edge * (0.45 + 0.55 * smoothstep(0.3, 0.8, wisps));
    gl_FragColor = vec4(vColor * light, 1.0);
  }
`;

/** Full-screen quad: the blur passes, and the stretch under the rest of the scene */
export const screenVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** The glow's blur: one pass of a separable Gaussian */
export const blurFragmentShader = /* glsl */ `
  uniform sampler2D uSource;
  uniform vec2 uStep;   // one pixel along the blur, in uv
  uniform float uSigma; // pixels
  uniform int uRadius;
  varying vec2 vUv;

  void main() {
    vec3 sum = texture2D(uSource, vUv).rgb;
    float total = 1.0;
    for (int i = 1; i <= 64; i++) {
      if (i > uRadius) break;
      float x = float(i);
      float w = exp(-x * x / (2.0 * uSigma * uSigma));
      sum += (texture2D(uSource, vUv + uStep * x).rgb + texture2D(uSource, vUv - uStep * x).rgb) * w;
      total += 2.0 * w;
    }
    gl_FragColor = vec4(sum / total, 1.0);
  }
`;

/**
 * The galaxy's summed light, stretched like an astronomical photo (asinh, as
 * in Lupton et al. 2004): linear for the faintest glow, logarithmic above,
 * the colors kept; the brightest parts turn white
 */
export const stretchFragmentShader = /* glsl */ `
  uniform sampler2D uLight;
  uniform float uPerCssPixel; // device pixels per CSS pixel: light per CSS pixel, the same on every screen
  uniform float uSoftening;   // light where the stretch turns from linear to logarithmic
  uniform float uScale;       // 1 / asinh(white / softening)
  varying vec2 vUv;

  void main() {
    vec3 light = texture2D(uLight, vUv).rgb * uPerCssPixel;
    float luminance = dot(light, vec3(0.2126, 0.7152, 0.0722));
    float shown = asinh(luminance / uSoftening) * uScale;
    vec3 c = min(light * (shown / max(luminance, 1e-12)), 1.0);
    // Back to linear: the output is sRGB-encoded at the end
    gl_FragColor = vec4(mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)), 1.0);
  }
`;

// ---- The dust map: rendered once from the model, a horizontal strip per frame ----

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

/**
 * Dust surface density across the disk (data, never shown): a diffuse
 * layer, clumpy and spread wider than the stars, swept out of the inner
 * galaxy inside the bar; lanes along the arms' inner edges, where most of it
 * gathers; the dense clouds of the very center. Calibrated on measured
 * extinction (A_V): ~1 magnitude per kpc in the plane near the Sun, ~2
 * toward Baade's Window, ~1 six degrees below the Galactic Center
 */
export const dustBakeFragmentShader = /* glsl */ `
  ${COMMON}
  uniform float uRadius; // kpc
  varying vec2 vUv;

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

  void main() {
    vec2 p = (vUv * 2.0 - 1.0) * uRadius;
    float R = max(length(p), 1e-4);
    float theta = atan(p.y, p.x);
    float edge = 1.0 - smoothstep(12.0, 16.0, R);
    float clouds = fbm(p * 1.6);

    float inner = 1.0 - exp(-R * R / 9.0);
    float dust = 0.5 * exp(-R / 4.0) * inner * edge * (0.25 + 1.5 * clouds * clouds);
    for (int i = 0; i < ARM_COUNT; i++) {
      vec4 A = uArmA[i];
      float k = A.z;
      float base = theta - A.y;
      float along = base + TAU * floor((log(R / A.x) / k - base) / TAU + 0.5);
      if (along < 0.0 || along > A.w) continue;
      float ridge = A.x * exp(along * k);
      float off = (R - ridge) * inversesqrt(1.0 + k * k);
      float w = uArmB[i].x * (1.0 + 0.05 * ridge);
      // Lanes along the inner edge: narrow, dense, ragged
      float dOff = off + 0.85 * w;
      float dw = 0.25 * w;
      float lane = exp(-dOff * dOff / (2.0 * dw * dw));
      float ragged = 0.35 + 0.9 * fbm(vec2(along * ridge * 1.8, dOff * 7.0) + uArmB[i].w + 11.0);
      dust += 2.9 * uArmB[i].y * armEnvelope(i, along) * lane * ragged;
    }
    // The Central Molecular Zone
    dust += 0.4 * exp(-R * R / 0.06);
    gl_FragColor = vec4(sqrt(min(dust / ${glslFloat(DUST_MAP_MAX)}, 1.0)), 0.0, 0.0, 1.0);
  }
`;
