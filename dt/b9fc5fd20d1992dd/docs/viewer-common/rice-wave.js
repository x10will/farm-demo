// Decorative rice-paddy "wind wave" surface.
//
// A constant ambient effect, like water shimmer: soft bands of lighter and
// darker green roll across every mesh of the `context-rice-paddies` role. It is
// decoration, not state. Nothing here reads a canonical frame, scenario time or
// any simulated value; the only clock is the render loop's own, so the wave
// keeps moving when the scenario is paused, as wind would.
//
// The material is one shared MeshLambertMaterial patched through
// onBeforeCompile, so scene lights (day/dusk/night environment) and fog still
// apply: the wave only tints the diffuse colour before lighting.
//
// Scene space is Z-up, so the wave travels over world X/Y.

export const RICE_PADDY_ROLE = 'context-rice-paddies';

/** Every tunable in one place. Distances are scene units (metres). */
export const RICE_WAVE = Object.freeze({
  // Warm animated-film greens, close to the farm palette (#68963E).
  baseColor: 0x6a9445,
  highlightColor: 0xb3c97a,
  shadowColor: 0x48783a,
  // Main wave: wavelength ~14 m, crest speed ~1.6 m/s, direction in degrees
  // counter-clockwise from +X.
  wavelength: 14,
  speed: 1.6,
  directionDeg: 25,
  // Gust: slower, longer, crossing at an angle, so the bands never repeat
  // as a regular stripe.
  gustWavelength: 41,
  gustSpeed: 0.7,
  gustDirectionDeg: 118,
  gustWeight: 0.45,
  // How far the wave pushes colour toward highlight / shadow (0..1).
  strength: 0.6,
  // Reduced motion keeps a static, subtler stripe.
  reducedStrength: 0.3,
});

function unit(deg) {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r)];
}

/**
 * Uniform values for one render-loop timestamp. Pure so tests can assert that
 * reduced motion freezes the wave and that nothing but `nowMs` drives it.
 */
export function riceWaveUniformValues(nowMs, reducedMotion, cfg = RICE_WAVE) {
  return {
    time: reducedMotion ? 0 : nowMs / 1000,
    strength: reducedMotion ? cfg.reducedStrength : cfg.strength,
  };
}

const VERTEX_DECL = `varying vec2 vRiceXY;\n`;
const VERTEX_BODY = `vRiceXY = (modelMatrix * vec4(transformed, 1.0)).xy;\n`;

const FRAGMENT_DECL = `
varying vec2 vRiceXY;
uniform float uRiceTime;
uniform float uRiceStrength;
uniform vec3 uRiceHighlight;
uniform vec3 uRiceShadow;
uniform vec2 uRiceDir;
uniform vec2 uRiceGustDir;
uniform vec4 uRiceWave;   // k, omega, gust k, gust omega
uniform float uRiceGustWeight;
`;

const FRAGMENT_BODY = `
{
  float band = sin(dot(vRiceXY, uRiceDir) * uRiceWave.x - uRiceTime * uRiceWave.y);
  float gust = sin(dot(vRiceXY, uRiceGustDir) * uRiceWave.z - uRiceTime * uRiceWave.w + 1.7);
  float w = mix(band, gust, uRiceGustWeight);
  w = w * (1.0 - 0.25 * abs(w));           // flatten crests so bands read as soft
  vec3 tinted = w > 0.0
    ? mix(diffuseColor.rgb, uRiceHighlight, w * uRiceStrength)
    : mix(diffuseColor.rgb, uRiceShadow, -w * uRiceStrength);
  diffuseColor.rgb = tinted;
}
`;

/**
 * Create the shared rice material. `THREE` is injected so this module stays
 * engine-neutral for Node tests. Returns `{ material, update, setReducedMotion }`.
 * `update(nowMs)` is the only per-frame work: one uniform write.
 */
export function createRiceWaveMaterial(THREE, { reducedMotion = false, cfg = RICE_WAVE } = {}) {
  const [dx, dy] = unit(cfg.directionDeg);
  const [gx, gy] = unit(cfg.gustDirectionDeg);
  const TAU = Math.PI * 2;
  const uniforms = {
    uRiceTime: { value: 0 },
    uRiceStrength: { value: cfg.strength },
    uRiceHighlight: { value: new THREE.Color(cfg.highlightColor) },
    uRiceShadow: { value: new THREE.Color(cfg.shadowColor) },
    uRiceDir: { value: new THREE.Vector2(dx, dy) },
    uRiceGustDir: { value: new THREE.Vector2(gx, gy) },
    uRiceWave: { value: new THREE.Vector4(
      TAU / cfg.wavelength, (TAU / cfg.wavelength) * cfg.speed,
      TAU / cfg.gustWavelength, (TAU / cfg.gustWavelength) * cfg.gustSpeed,
    ) },
    uRiceGustWeight: { value: cfg.gustWeight },
  };
  const material = new THREE.MeshLambertMaterial({ color: cfg.baseColor, side: THREE.DoubleSide });
  // DoubleSide: a slab authored with the wrong winding still shows its top.
  material.name = 'rice-wave';
  material.userData.dtRiceWave = true;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_DECL}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${VERTEX_BODY}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${FRAGMENT_BODY}`);
  };
  // One program for every rice slab and every site that shares this config.
  material.customProgramCacheKey = () => 'dt-rice-wave-v1';

  let reduced = !!reducedMotion;
  let lastNow = 0;
  const apply = () => {
    const v = riceWaveUniformValues(lastNow, reduced, cfg);
    uniforms.uRiceTime.value = v.time;
    uniforms.uRiceStrength.value = v.strength;
  };
  apply();
  return {
    material,
    uniforms,
    update(nowMs) { lastNow = nowMs; apply(); },
    setReducedMotion(value) { reduced = !!value; apply(); },
    get reducedMotion() { return reduced; },
  };
}
