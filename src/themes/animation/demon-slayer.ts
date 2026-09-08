import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { curvedTube, fracturedSolid } from '../shared/geometry';
import { surfaceMaterial } from '../shared/material';
import { ParticlePool } from '../shared/ParticlePool';
import { AnimationRuntime } from './AnimationRuntime';
import { RibbonPool, type Point3 } from './RibbonPool';
import { box, part } from './parts';

/** Lacquer, ceramic and a structural sword rail, drawn through with water-breathing arcs. */
export default class DemonSlayer extends AnimationRuntime {
  private readonly flow = { value: 0 };
  private readonly trails: RibbonPool;
  private readonly hero: RibbonPool;
  private readonly drops: ParticlePool;
  private readonly recent: string[] = [];
  private last: Point3 | null = null;
  private sinceStrike = Infinity;
  private readonly relief: THREE.Mesh[] = [];

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'DEMON SLAYER / water-breathing instrument';
    const lacquer = surfaceMaterial({ color: '#15352f', roughness: .34, clearcoat: .5, metalness: .12 }, 'slayer-checkered-lacquer',
      'float tile=mod(floor(vKsPosition.x*2.)+floor(vKsPosition.z*2.)+floor(vKsPosition.y*2.),2.); diffuseColor.rgb*=mix(.42,1.25,tile);');
    const black = new THREE.MeshStandardMaterial({ color: '#152621', roughness: .52, metalness: .18 });
    const brass = new THREE.MeshStandardMaterial({ color: '#ba9b58', roughness: .36, metalness: .7 });
    const ceramic = [new THREE.MeshStandardMaterial({ color: '#dbe6d5', roughness: .61 }), new THREE.MeshStandardMaterial({ color: '#5f9e8b', roughness: .64 }), new THREE.MeshStandardMaterial({ color: '#29483f', roughness: .48 })];
    box(this.group, [17.7, .67, 7.22], lacquer, [0, .44, 0], .19);
    box(this.group, [16.8, .14, 6.58], black, [0, .83, 0], .08);
    for (const z of [-3.35, 3.35]) box(this.group, [17.25, .065, .09], brass, [0, .72, z]);
    const water = surfaceMaterial({ color: '#316c78', roughness: .28, metalness: .25, emissive: '#123d42', emissiveIntensity: .15 }, 'slayer-carved-wave',
      'float line=sin(vKsPosition.x*3.-uFlow*1.1+vKsPosition.y*5.); diffuseColor.rgb*=.85+line*.12;', { uFlow: this.flow }, 'uniform float uFlow;');
    for (let layer = 0; layer < 3; layer++) {
      const points = Array.from({ length: 21 }, (_, i) => new THREE.Vector3(-8.8 + i * .88, .31 + layer * .13 + Math.sin(i * .72 + layer) * .1, 3.7 + layer * .08));
      this.relief.push(part(this.group, curvedTube(points, .11), water));
    }
    // The sword rail is geometry, with a wrapped hilt and a metal guard, not a logo.
    const steel = new THREE.MeshStandardMaterial({ color: '#b5d4ce', roughness: .18, metalness: .9 });
    const blade = new THREE.Shape(); blade.moveTo(-6.8, -.12); blade.lineTo(7.65, -.06); blade.lineTo(8.5, .13); blade.lineTo(7.25, .25); blade.lineTo(-6.8, .14); blade.closePath();
    const edge = part(this.group, new THREE.ExtrudeGeometry(blade, { depth: .055, bevelEnabled: false }), steel, 0, 1.05, -3.78);
    edge.rotation.x = -Math.PI / 2;
    const handle = part(this.group, new THREE.CylinderGeometry(.19, .19, 2.45, 16), lacquer, -8, 1.04, -3.8); handle.rotation.z = Math.PI / 2;
    const guard = part(this.group, new THREE.TorusGeometry(.38, .065, 8, 24), brass, -6.75, 1.04, -3.8); guard.rotation.y = Math.PI / 2;
    for (const x of [-9.2, -6.82]) { const band = part(this.group, new THREE.CylinderGeometry(.21, .21, .13, 16), brass, x, 1.04, -3.8); band.rotation.z = Math.PI / 2; }
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, fracturedSolid(definition.width - .11, .9, .42, 33, .015, 20, .25));
      const dark = definition.tone === 'gray';
      this.addKey(definition, i, geometries.get(definition.width)!, ceramic[definition.tone === 'orange' ? 1 : dark ? 2 : 0], .94, .42, dark ? '#d7e7ce' : '#344f44');
    });
    this.trails = new RibbonPool(this.group, Math.max(2, context.quality.waves - 2));
    this.hero = new RibbonPool(this.group, 2);
    this.drops = new ParticlePool(this.group, context.quality.particles, new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: '#b9f1ed' }), -2.6, 1.2);
    this.bounds.set(new THREE.Vector3(-9.7, 0, -4.2), new THREE.Vector3(9.4, 3.55, 4.3));
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    if (this.sinceStrike > 1.05) { this.last = null; this.recent.length = 0; }
    const point = { x: key.x, y: key.restY + .53, z: key.z };
    this.recent.push(key.definition.code); if (this.recent.length > 7) this.recent.shift();
    if (!reduced) {
      const from = this.last && Math.hypot(this.last.x - point.x, this.last.z - point.z) > .05 ? this.last : { x: key.x - .5, y: point.y, z: key.z + .25 };
      this.trails.emit(from, point, '#1e929e', .16, .32, .82, false, .3);
      this.trails.emit({ x: from.x, y: from.y + .03, z: from.z - .06 }, { ...point, y: point.y + .05 }, '#d3f7ef', .035, .48, .56, true, -.18);
      this.drops.burst(key.x, point.y, key.z, 3, .9, .28, .028);
    }
    this.last = point; this.sinceStrike = 0;
    if (this.signature.start(key.definition.code, reduced)) {
      if (this.signature.kind === 'enter') {
        this.hero.emit({ x: -8.6, y: 1.25, z: 2.8 }, { x: 8.6, y: 1.25, z: -2.9 }, '#147585', .55, 1.8, 1.15, false, .5);
        this.hero.emit({ x: -8.6, y: 1.28, z: 2.8 }, { x: 8.6, y: 1.28, z: -2.9 }, '#e4f6d8', .065, 2.02, .85, true, .5);
      } else {
        this.hero.emit({ x: -8.3, y: .88, z: 3.45 }, { x: 8.3, y: .88, z: 3.45 }, '#268d9b', .47, 1.8, 1.15, false, -2.6);
        this.hero.emit({ x: 8.3, y: .88, z: -3.3 }, { x: -8.3, y: .88, z: -3.3 }, '#6fbfbd', .3, 1.5, 1.05, false, -2.7);
      }
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    this.flow.value = this.time; this.sinceStrike += delta;
    this.relief.forEach((mesh, i) => { mesh.position.y = reduced ? 0 : Math.sin(this.time * 1.3 + i) * .018; });
    const trails = this.trails.update(delta, reduced), hero = this.hero.update(delta, reduced), drops = this.drops.update(delta);
    return !reduced || trails || hero || drops;
  }
  protected override clear() { this.trails.clear(); this.hero.clear(); this.drops.clear(); this.last = null; this.recent.length = 0; this.sinceStrike = Infinity; }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.trails.setLimit(Math.max(2, quality.waves - 2)); this.drops.setLimit(quality.particles); }
  override diagnostics() { return { ...super.diagnostics(), waves: this.trails.active + this.hero.active, particles: this.drops.active, recentKeys: [...this.recent], mechanism: { connectedTrails: this.trails.active } }; }
}
