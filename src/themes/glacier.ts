import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { fracturedSolid, lineSegments } from './shared/geometry';
import { NOISE_GLSL, surfaceMaterial } from './shared/material';
import { random } from './shared/random';
import { ParticlePool } from './shared/ParticlePool';
import { WavePool } from './shared/WavePool';
import type { QualitySettings, ThemeContext } from './types';

const ICE_SURFACE = `
  vec3 p=vKsPosition+vec3(uSeed,0.,uSeed*.7);
  float edge=max(abs(vKsPosition.x)/uHalfWidth,abs(vKsPosition.z)/uHalfDepth);
  float frost=smoothstep(.52,.98,edge)*(.58+ksNoise(p*32.)*.42);
  frost+=smoothstep(.68,.88,ksFbm(p*9.))*.18;
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.61,.67),frost*.8);
  roughnessFactor=mix(.085,.88,clamp(frost,0.,1.));
  float fracture=1.-smoothstep(.013,.055,abs(sin(p.x*6.4+sin(p.z*7.1+p.y*8.)*.9)));
  totalEmissiveRadiance+=vec3(.24,.66,.86)*fracture*uHeat*1.3;
`;

export default class Glacier extends BaseRuntime {
  private readonly heats: THREE.IUniform<number>[] = [];
  private readonly crackMaterials: THREE.LineBasicMaterial[] = [];
  private readonly shards: ParticlePool;
  private readonly waves: WavePool;
  private readonly mistTime = { value: 0 };
  private nextGlint = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'GLACIER / fractured ice';
    this.stiffness = 840; this.damping = 44;
    const rng = random(1121);
    const body = new THREE.Mesh(fracturedSolid(18.2, 7.75, 1.0, 911, .11, 28, .27), this.iceMaterial('#b9d8df', 3, 9.1, 3.875, { value: 0 }, 1.25));
    body.position.y = .07; body.castShadow = body.receiveShadow = true; this.group.add(body);

    // Suspended seams and bubbles are opaque inclusions, visible to transmission.
    const seams: number[] = [];
    for (let row = 0; row < 3; row++) for (let step = 0; step < 12; step++) {
      const x = -7.9 + step * 1.3;
      const y = .27 + row * .16;
      const z = -2.8 + row * 2.4;
      seams.push(x, y, z + Math.sin(step * .8) * .4, x + 1.3, y + (rng() - .5) * .06, z + Math.sin((step + 1) * .8) * .4);
    }
    this.group.add(lineSegments(seams, '#87adb6'));
    const trappedLayer = new THREE.Mesh(fracturedSolid(16.1, 6.15, .13, 54, .08, 18), surfaceMaterial(
      { color: '#6c929f', roughness: .65, metalness: 0 }, 'trapped-ice-layer',
      'float n=ksFbm(vKsPosition*1.9); if(n<.5) discard; diffuseColor.rgb*=.75+ksNoise(vKsPosition*8.)*.25;',
    ));
    trappedLayer.position.y = .46; this.group.add(trappedLayer);
    const geometries = new Map<string, THREE.BufferGeometry>();
    const bubbleGeometry = new THREE.SphereGeometry(.018, 7, 5);
    const bubbleMaterial = new THREE.MeshBasicMaterial({ color: '#b1d0d4' });
    KEYS.forEach((definition, i) => {
      const variant = `${definition.width}:${i % 4}`;
      if (!geometries.has(variant)) geometries.set(variant, fracturedSolid(definition.width - .08, .93, .64, 200 + i % 4, .17, 12, .48));
      const heat = { value: 0 }; this.heats.push(heat);
      const material = this.iceMaterial(definition.tone === 'orange' ? '#aad6df' : '#d5eff1', i * .78, (definition.width - .08) / 2, .465, heat, .72);
      const key = this.addKey(definition, i, geometries.get(variant)!, material, 1.1 + (5.25 - definition.z) * .014, .64, '#496e7b');
      const points: number[] = [];
      let x = -.17, y = .12, z = .22;
      for (let segment = 0; segment < 5; segment++) {
        const nx = (rng() - .5) * (definition.width - .3), ny = .14 + segment * .09, nz = (rng() - .5) * .5;
        points.push(x, y, z, nx, ny, nz);
        if (segment % 2 === 0) points.push(nx, ny, nz, nx + .12, ny - .12, nz + .06);
        x = nx; y = ny; z = nz;
      }
      const cracks = lineSegments(points, '#91b6bf'); key.group.add(cracks); this.crackMaterials.push(cracks.material);
      if (i % 3 === 0) for (let bubble = 0; bubble < 2; bubble++) {
        const inclusion = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        inclusion.position.set((rng() - .5) * .45, .15 + rng() * .3, (rng() - .5) * .45);
        inclusion.scale.y = 1.8; key.group.add(inclusion);
      }
    });

    const mistMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: this.mistTime }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `${NOISE_GLSL} uniform float uTime; varying vec2 vUv;
        void main(){ vec2 p=(vUv-.5)*2.; float mask=pow(max(0.,1.-dot(p,p)),2.); float n=ksFbm(vec3(vUv*8.+vec2(uTime*.06,0.),uTime*.07)); float a=smoothstep(.38,.72,n)*mask*.13; gl_FragColor=vec4(.73,.85,.87,a); }`,
    });
    const mistGeometry = new THREE.PlaneGeometry(21, 10.4);
    for (let i = 0; i < 3; i++) {
      const mist = new THREE.Mesh(mistGeometry, mistMaterial); mist.rotation.x = -Math.PI / 2;
      mist.position.set((i - 1) * .35, .06 + i * .09, .5); this.group.add(mist);
    }
    this.shards = new ParticlePool(this.group, context.quality.particles, new THREE.OctahedronGeometry(1, 0), new THREE.MeshPhysicalMaterial({ color: '#deffff', roughness: .16, metalness: .15, emissive: '#8db8cc', emissiveIntensity: .2 }), -2.3, .65);
    this.waves = new WavePool(this.group, context.quality.waves, '#b8edff', .65);
    this.bounds.set(new THREE.Vector3(-9.4, 0, -4), new THREE.Vector3(9.4, 2.45, 4.1));
  }

  private iceMaterial(color: string, seed: number, halfWidth: number, halfDepth: number, heat: THREE.IUniform<number>, thickness: number) {
    return surfaceMaterial({ color, transmission: .82, opacity: 1, thickness, ior: 1.31, roughness: .18, metalness: 0, specularIntensity: .65, envMapIntensity: .38, attenuationColor: '#91c1cb', attenuationDistance: 2.4 }, 'glacial-ice', ICE_SURFACE,
      { uSeed: { value: seed }, uHalfWidth: { value: halfWidth }, uHalfDepth: { value: halfDepth }, uHeat: heat },
      'uniform float uSeed; uniform float uHalfWidth; uniform float uHalfDepth; uniform float uHeat;');
  }
  protected override pose(key: KeyBody, reduced: boolean) {
    super.pose(key, reduced);
    this.heats[key.index].value = key.state.heat + this.rewardAt(key);
    const heat = this.heats[key.index].value;
    this.crackMaterials[key.index].color.setRGB(.28 + heat * .52, .48 + heat * .42, .55 + heat * .45);
  }
  protected override onPress(key: KeyBody, reduced: boolean) {
    if (reduced) return;
    this.shards.burst(key.x, key.restY + .43, key.z, this.quality.level === 'low' ? 3 : 6, 1.35, .6, .045);
    this.waves.emit(key.x, 1.08, key.z, 1.5, .4);
  }
  protected override tick(delta: number, reduced: boolean) {
    this.mistTime.value = reduced ? 0 : this.time;
    if (!reduced && this.time > this.nextGlint) {
      this.nextGlint = this.time + 1.6;
      const key = this.keys[Math.floor(this.time * 11) % this.keys.length];
      this.shards.burst(key.x + .36, key.restY + .57, key.z, 1, .03, .1, .017);
    }
    const particles = this.shards.update(delta), waves = this.waves.update(delta);
    return !reduced || particles || waves;
  }
  protected override clear() { this.shards.clear(); this.waves.clear(); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.shards.setLimit(quality.particles); this.waves.setLimit(quality.waves); }
  override diagnostics() { return { particles: this.shards.active, flames: 0, waves: this.waves.active }; }
}
