import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { fracturedSolid } from './shared/geometry';
import { surfaceMaterial } from './shared/material';
import { ParticlePool } from './shared/ParticlePool';
import { Flames } from './shared/Flames';
import type { QualitySettings, ThemeContext } from './types';

const ROCK_SURFACE = `
  vec3 rockP=vKsPosition*2.6+vec3(uSeed,0.,uSeed*.37);
  float grain=ksFbm(rockP*4.);
  vec2 p=rockP.xz+rockP.y*.28;
  p+=vec2(ksNoise(rockP*1.3),ksNoise(rockP*1.7+9.))*.35;
  vec2 cell=floor(p), f=fract(p); float a=8., b=8.;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
    vec2 offset=vec2(float(x),float(y));
    vec2 site=vec2(ksHash(vec3(cell+offset,1.)),ksHash(vec3(cell+offset,5.)));
    float d=length(offset+site-f);
    if(d<a) { b=a; a=d; } else { b=min(b,d); }
  }
  float crack=1.-smoothstep(.009,.047,b-a);
  crack*=smoothstep(.19,.43,ksNoise(rockP*1.8+4.));
  diffuseColor.rgb*=.58+grain*.68;
  diffuseColor.rgb*=mix(1.,.3,crack);
  roughnessFactor=clamp(.82+grain*.18,.0,1.);
  normal=normalize(normal+vec3(ksNoise(rockP*23.)-.5,ksNoise(rockP*23.+3.)-.5,ksNoise(rockP*23.+7.)-.5)*.13);
  vec3 molten=mix(vec3(.52,.018,.001),vec3(1.,.24,.015),uHeat);
  totalEmissiveRadiance+=molten*crack*(.5+uHeat*3.4);
`;

export default class Inferno extends BaseRuntime {
  private readonly heats: THREE.IUniform<number>[] = [];
  private readonly bodyHeat = { value: .15 };
  private readonly flames: Flames;
  private readonly embers: ParticlePool;
  private nextEmber = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'INFERNO / volcanic assembly';
    this.stiffness = 510; this.damping = 42;
    const bodyMaterial = this.rockMaterial('#201c19', 4, this.bodyHeat);
    const body = new THREE.Mesh(fracturedSolid(18, 7.7, 1.04, 44, .075), bodyMaterial);
    body.position.y = .06; body.castShadow = body.receiveShadow = true;
    this.group.add(body);
    const bed = new THREE.Mesh(fracturedSolid(16.85, 6.58, .08, 25, .02), new THREE.MeshStandardMaterial({ color: '#180c08', emissive: '#691504', emissiveIntensity: .55, roughness: 1 }));
    bed.position.y = 1.05; this.group.add(bed);

    const geometries = new Map<string, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      const heat = { value: 0 }; this.heats.push(heat);
      const variant = `${definition.width}:${i % 4}`;
      if (!geometries.has(variant)) geometries.set(variant, fracturedSolid(definition.width - .1, .9, .53, 81 + i % 4, .12));
      const material = this.rockMaterial(definition.tone === 'orange' ? '#3c261c' : '#24211e', i * .831, heat);
      this.addKey(definition, i, geometries.get(variant)!, material, 1.13 + (5.25 - definition.z) * .012, .53, '#d3c3a8');
    });

    const anchors: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < 32; i++) {
      const key = this.keys[(i * 7) % this.keys.length];
      anchors.push({ x: key.x + key.definition.width * .28, y: 1.12, z: key.z + .48 });
    }
    for (let i = 0; i < 16; i++) anchors.push({ x: -8.3 + (i % 8) * 2.36, y: .92, z: i < 8 ? -3.46 : 3.46 });
    // Keep both perimeter and inter-key fire when low quality takes the first 20.
    const distributed: typeof anchors = [];
    for (let i = 0; i < 16; i++) {
      const edge = 32 + (i % 2) * 8 + Math.floor(i / 2);
      distributed.push(anchors[edge], anchors[i * 2], anchors[i * 2 + 1]);
    }
    this.flames = new Flames(this.group, distributed);
    this.flames.setLimit(context.quality.flames);
    this.embers = new ParticlePool(this.group, context.quality.particles, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ff9c39', toneMapped: false }), .28, .7);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(21, 10), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv; void main(){float d=length((vUv-.5)*vec2(1.,1.35));gl_FragColor=vec4(.6,.055,.004,pow(max(0.,1.-d*2.),3.)*.15);}',
    }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = .009; this.group.add(glow);
    this.bounds.set(new THREE.Vector3(-9.2, 0, -4), new THREE.Vector3(9.2, 2.95, 4.1));
  }

  private rockMaterial(color: string, seed: number, heat: THREE.IUniform<number>) {
    return surfaceMaterial({ color, roughness: .94, metalness: .08, envMapIntensity: .32 }, 'volcanic-rock', ROCK_SURFACE, { uSeed: { value: seed }, uHeat: heat }, 'uniform float uSeed; uniform float uHeat;');
  }

  protected override pose(key: KeyBody, reduced: boolean) {
    super.pose(key, reduced);
    key.group.rotation.x = reduced ? 0 : key.state.displacement * .018;
    this.heats[key.index].value = key.state.heat + (key.state.down ? .17 : 0) + this.rewardAt(key);
  }
  protected override onPress(key: KeyBody, reduced: boolean) {
    if (!reduced) this.embers.burst(key.x, key.restY + .45, key.z, this.quality.level === 'low' ? 3 : 6, 1.7, key.definition.width * .55, .027);
  }
  protected override tick(delta: number, reduced: boolean) {
    this.flames.update(this.time, this.keys, reduced);
    let heat = .1;
    for (const key of this.keys) heat = Math.max(heat, key.state.heat * .45);
    this.bodyHeat.value = heat + this.rewardTier * this.rewardPulse * .09;
    if (!reduced && this.time > this.nextEmber) {
      const key = this.keys[Math.floor(this.time * 17) % this.keys.length];
      this.embers.burst(key.x, 1.1, key.z + .48, 1, .55, .1, .018);
      this.nextEmber = this.time + .65;
    }
    const moving = this.embers.update(delta);
    return !reduced || moving;
  }
  protected override clear() { this.embers.clear(); this.flames.update(0, this.keys, true); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.embers.setLimit(quality.particles); this.flames.setLimit(quality.flames); }
  override diagnostics() { return { particles: this.embers.active, flames: this.flames.mesh.count, waves: 0 }; }
}
