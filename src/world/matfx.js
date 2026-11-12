// Effets partagés par les matériaux du décor : vent dans le feuillage, neige sur les surfaces tournées vers le ciel.
export const NATURE_U = { uTime: { value: 0 }, uWind: { value: 0.3 }, uSnow: { value: 0 } };

export function natureShader(mat, { wind = 0, snow = true, windHeight = 2.5 } = {}) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, NATURE_U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime, uWind, uSnow;\nvarying float vUp;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = objectNormal.y;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${wind ? `{
          vec3 ip = vec3(0.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix[3].xyz;
          #endif
          float hk = clamp(position.y / ${windHeight.toFixed(2)}, 0.0, 1.5);
          float w = ${wind.toFixed(3)} * (0.25 + uWind * 1.4);
          float ph = uTime * (1.3 + uWind) + ip.x * 0.37 + ip.z * 0.21;
          transformed.x += (sin(ph) + sin(ph * 2.3 + 1.7) * 0.35) * w * hk * hk;
          transformed.z += cos(ph * 0.8 + 0.6) * w * 0.6 * hk * hk;
        }` : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSnow;\nvarying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        ${snow ? 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 1.0), clamp(uSnow * smoothstep(0.35, 0.8, vUp), 0.0, 1.0));' : ''}`);
  };
  mat.customProgramCacheKey = () => `nature-${wind}-${snow}-${windHeight}`;
  return mat;
}
