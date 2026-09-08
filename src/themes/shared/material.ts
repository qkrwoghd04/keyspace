import * as THREE from 'three';

export const NOISE_GLSL = `
float ksHash(vec3 p) { p = fract(p * .3183099 + vec3(.1,.2,.3)); p *= 17.; return fract(p.x * p.y * p.z * (p.x+p.y+p.z)); }
float ksNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(ksHash(i),ksHash(i+vec3(1,0,0)),f.x),mix(ksHash(i+vec3(0,1,0)),ksHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(ksHash(i+vec3(0,0,1)),ksHash(i+vec3(1,0,1)),f.x),mix(ksHash(i+vec3(0,1,1)),ksHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float ksFbm(vec3 p) { return ksNoise(p)*.57 + ksNoise(p*2.07)*.28 + ksNoise(p*4.1)*.15; }
`;

/** Keep Three's physical lighting/transmission; specialize only the material surface. */
export function surfaceMaterial(
  parameters: THREE.MeshPhysicalMaterialParameters,
  key: string,
  surface: string,
  uniforms: Record<string, THREE.IUniform> = {},
  declarations = '',
) {
  const material = new THREE.MeshPhysicalMaterial(parameters);
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vKsPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKsPosition = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vKsPosition;\n${NOISE_GLSL}\n${declarations}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${surface}`);
  };
  material.customProgramCacheKey = () => `keyspace:${key}`;
  return material;
}
