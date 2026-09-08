import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { fracturedSolid, lineSegments } from './shared/geometry';
import { NOISE_GLSL, surfaceMaterial } from './shared/material';
import { ParticlePool } from './shared/ParticlePool';
import { WavePool } from './shared/WavePool';
import { random } from './shared/random';
import type { QualitySettings, ThemeContext } from './types';

const MINERAL_SURFACE = `
  vec3 p=vKsPosition+vec3(uSeed,0.,uSeed*.17);
  float mineral=ksFbm(p*6.);
  diffuseColor.rgb*=.65+mineral*.65;
  float fleck=step(.985,ksHash(floor(p*85.)));
  float vein=1.-smoothstep(.012,.045,abs(ksNoise(p*2.8)-.49));
  vein*=smoothstep(.24,.6,mineral);
  totalEmissiveRadiance+=vec3(.16,.28,.58)*vein*(.6+uHeat*2.8)+vec3(.5,.62,.85)*fleck*.5;
  roughnessFactor=.38+mineral*.18;
`;

export default class Orbit extends BaseRuntime {
  private readonly heats: THREE.IUniform<number>[] = [];
  private readonly fragments: { mesh: THREE.Mesh; phase: number; speed: number }[] = [];
  private readonly dust: ParticlePool;
  private readonly waves: WavePool;
  private readonly attraction = { x: 0, y: 0, z: 0, force: 0 };
  private attractionEnd = 0;
  private readonly stars: THREE.Points;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'ORBIT / suspended mineral constellation';
    this.stiffness = 460; this.damping = 25;
    const rng = random(8173);
    const geometries = new Map<string, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      const variant = `${definition.width}:${i % 5}`;
      if (!geometries.has(variant)) geometries.set(variant, fracturedSolid(definition.width - .12, .87, .58, 705 + i % 5, .19, 10, .64));
      const heat = { value: 0 }; this.heats.push(heat);
      const material = surfaceMaterial({ color: definition.tone === 'orange' ? '#454464' : '#30394e', roughness: .45, metalness: .48, envMapIntensity: .65 }, 'orbital-mineral', MINERAL_SURFACE,
        { uSeed: { value: i * .793 }, uHeat: heat }, 'uniform float uSeed; uniform float uHeat;');
      this.addKey(definition, i, geometries.get(variant)!, material, 1.35 + (5.25 - definition.z) * .014, .58, '#bbc9e4');
    });

    const links: number[] = [];
    for (let i = 0; i < this.keys.length; i++) {
      const a = this.keys[i], b = this.keys[i + 1];
      if (b && a.z === b.z) links.push(a.x, 1.03, a.z, b.x, 1.03, b.z);
      const below = this.keys.find(key => key.z > a.z && key.z - a.z < 1.3 && Math.abs(key.x - a.x) < .3);
      if (below && i % 2 === 0) links.push(a.x, 1.03, a.z, below.x, 1.03, below.z);
      links.push(a.x, 1.03, a.z, a.x, 1.31, a.z);
    }
    this.group.add(lineSegments(links, '#6b83b6', .22));
    const sockets = new THREE.InstancedMesh(new THREE.TorusGeometry(.19, .006, 4, 28), new THREE.MeshBasicMaterial({ color: '#7b98ca', transparent: true, opacity: .25, depthWrite: false }), KEYS.length);
    const dummy = new THREE.Object3D(); dummy.rotation.x = Math.PI / 2;
    this.keys.forEach((key, i) => { dummy.position.set(key.x, 1.025, key.z); dummy.updateMatrix(); sockets.setMatrixAt(i, dummy.matrix); });
    this.group.add(sockets);

    const fragmentGeometry = new THREE.DodecahedronGeometry(1, 0);
    const fragmentMaterial = surfaceMaterial({ color: '#42495d', roughness: .65, metalness: .4, emissive: '#111e38', envMapIntensity: .55 }, 'orbital-fragments', 'diffuseColor.rgb*=.7+ksNoise(vKsPosition*8.)*.5;');
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(fragmentGeometry, fragmentMaterial);
      const size = .07 + rng() * .17; mesh.scale.set(size, size * 1.5, size * .8);
      this.fragments.push({ mesh, phase: i * Math.PI / 3 + rng() * .2, speed: .075 + rng() * .045 }); this.group.add(mesh);
    }
    const starPositions: number[] = [];
    for (let i = 0; i < 96; i++) starPositions.push((rng() - .5) * 28, .02 + rng() * .15, (rng() - .5) * 15);
    const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    this.stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#7085b2', size: .02, sizeAttenuation: true, transparent: true, opacity: .6, depthWrite: false }));
    this.group.add(this.stars);
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(24, 11), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `${NOISE_GLSL} varying vec2 vUv; void main(){vec2 p=(vUv-.5)*2.;float fade=pow(max(0.,1.-dot(p,p)),3.);float n=ksFbm(vec3(vUv*5.,2.));gl_FragColor=vec4(.21,.26,.46,n*fade*.12);}`,
    }));
    nebula.rotation.x = -Math.PI / 2; nebula.position.y = .007; this.group.add(nebula);
    this.dust = new ParticlePool(this.group, context.quality.particles, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#c2d7ff', toneMapped: false }), 0, 2);
    this.waves = new WavePool(this.group, context.quality.waves, '#8dacdf', .48);
    this.setQuality(context.quality);
    this.bounds.set(new THREE.Vector3(-10.1, .03, -4.65), new THREE.Vector3(10.1, 2.55, 4.65));
  }

  protected override pose(key: KeyBody, reduced: boolean) {
    const drift = reduced ? 0 : Math.sin(this.time * .85 + key.index * 1.37) * .028;
    key.group.position.y = key.restY + drift - key.state.displacement * (reduced ? .09 : .26);
    key.group.rotation.z = reduced ? 0 : Math.sin(this.time * .7 + key.index) * .008 * (1 - Math.max(0, key.state.displacement));
    this.heats[key.index].value = key.state.heat + (key.state.down ? .12 : 0) + this.rewardAt(key);
  }
  protected override onPress(key: KeyBody, reduced: boolean) {
    if (reduced) return;
    this.attraction.x = key.x; this.attraction.y = key.restY + .2; this.attraction.z = key.z; this.attraction.force = 12;
    this.attractionEnd = this.time + .32;
    this.dust.burst(key.x, key.restY + .1, key.z, this.quality.level === 'low' ? 3 : 6, .15, 2.2, .023);
  }
  protected override onRelease(key: KeyBody, reduced: boolean) {
    if (reduced) return;
    this.waves.emit(key.x, key.restY - .06, key.z, 1.05, .27);
    this.dust.burst(key.x, key.restY + .3, key.z, 3, .35, .15, .02);
  }
  protected override tick(delta: number, reduced: boolean) {
    for (const fragment of this.fragments) {
      const angle = fragment.phase + (reduced ? 0 : this.time * fragment.speed);
      fragment.mesh.position.set(Math.cos(angle) * 9.45, 1.1 + Math.sin(angle * 2) * .22, Math.sin(angle) * 4.05);
      fragment.mesh.rotation.set(angle * .5, angle * 1.4, fragment.phase);
    }
    if (this.time > this.attractionEnd || reduced) this.attraction.force = 0;
    const particles = this.dust.update(delta, this.attraction.force ? this.attraction : undefined);
    const waves = this.waves.update(delta);
    return !reduced || particles || waves;
  }
  protected override clear() { this.dust.clear(); this.waves.clear(); this.attraction.force = 0; }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.dust.setLimit(quality.particles); this.waves.setLimit(quality.waves); this.stars.geometry.setDrawRange(0, quality.level === 'low' ? 40 : 96); }
  override diagnostics() { return { particles: this.dust.active, flames: 0, waves: this.waves.active }; }
}
