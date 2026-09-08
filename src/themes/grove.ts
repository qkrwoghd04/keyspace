import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { curvedTube, fracturedSolid } from './shared/geometry';
import { surfaceMaterial } from './shared/material';
import { random } from './shared/random';
import { ParticlePool } from './shared/ParticlePool';
import type { QualitySettings, ThemeContext } from './types';

const WOOD_SURFACE = `
  vec3 p=vKsPosition;
  float warp=ksNoise(vec3(p.x*.6,p.y*2.,p.z*2.)+uSeed)*3.;
  float ring=sin(p.z*39.+p.y*14.+warp+sin(p.x*1.1)*1.3);
  float fine=sin(p.z*132.+p.y*28.+warp*2.);
  float grain=smoothstep(-.8,.65,ring)*.23+fine*.025;
  diffuseColor.rgb*=.71+grain+ksNoise(p*17.+uSeed)*.17;
  roughnessFactor=.62+ksNoise(p*11.)*.2;
`;

function leafGeometry() {
  const positions: number[] = [], indices: number[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, width = Math.sin(t * Math.PI) ** .8 * .105;
    positions.push(-width, t * .37, 0, 0, t * .37, Math.sin(t * Math.PI) * .025, width, t * .37, 0);
    if (i < 8) { const o = i * 3; indices.push(o, o + 3, o + 1, o + 1, o + 3, o + 4, o + 1, o + 4, o + 2, o + 2, o + 4, o + 5); }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export default class Grove extends BaseRuntime {
  private readonly plants: { group: THREE.Group; key: KeyBody; angle: number; phase: number }[] = [];
  private readonly moss: { mesh: THREE.Mesh; key: KeyBody }[] = [];
  private readonly pollen: ParticlePool;
  private nextPollen = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'GROVE / living rootstock';
    this.stiffness = 530; this.damping = 32;
    const rng = random(649);
    const bark = this.wood('#503c2b', 3);
    const lighterBark = this.wood('#6d5237', 5);
    const core = new THREE.Mesh(fracturedSolid(17.25, 7.0, .57, 431, .075, 24, .34), bark);
    core.position.y = .12; core.castShadow = core.receiveShadow = true; this.group.add(core);
    const paths = [
      [[-9.7,.1,3.5],[-8.1,.3,3.1],[-4.3,.48,3.18],[-1,.3,3.35],[3.8,.25,3.24],[8.8,.08,4.15]],
      [[-9.4,.04,-3.5],[-8.5,.35,-2.6],[-8.1,.5,.1],[-8.6,.33,2.7],[-7.4,.1,4.05]],
      [[8.8,.03,-3.9],[8.45,.27,-1.8],[8.55,.35,.5],[8.1,.29,2.8],[9.2,.05,3.2]],
      [[-8.1,.16,-3.2],[-4.8,.37,-3.36],[-1,.46,-3.08],[4,.35,-3.17],[8.4,.12,-3.5]],
      [[-8.4,.13,2.5],[-9.1,.18,2.9],[-9.85,.04,2.6]],
      [[6.8,.2,3.3],[7.3,.13,4.1],[8.2,.04,4.25]],
      [[-6.9,.22,-3.2],[-7.5,.09,-3.95],[-8.35,.03,-4.1]],
    ];
    paths.forEach((points, i) => {
      const root = new THREE.Mesh(curvedTube(points.map(p => new THREE.Vector3(...p as [number, number, number])), i < 4 ? .22 + i * .025 : .095, 9), i % 2 ? lighterBark : bark);
      root.castShadow = root.receiveShadow = true; this.group.add(root);
    });

    const seedGeometry = new Map<number, THREE.BufferGeometry>();
    const woods = { ivory: this.wood('#b0844e', 1), gray: this.wood('#895b33', 2), orange: this.wood('#98a163', 6) };
    const mossMaterial = surfaceMaterial({ color: '#667141', roughness: 1, metalness: 0 }, 'forest-moss', 'float n=ksNoise(vKsPosition*75.); diffuseColor.rgb*=.6+n*.75; normal=normalize(normal+vec3(n-.5,0.,n-.5)*.12);');
    const mossGeometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!seedGeometry.has(definition.width)) {
        const geometry = new THREE.SphereGeometry(1, 22, 14);
        geometry.scale((definition.width - .11) / 2, .255, .445); geometry.translate(0, .255, 0); seedGeometry.set(definition.width, geometry);
      }
      const radiusX = (definition.width - .11) / 2;
      const key = this.addKey(definition, i, seedGeometry.get(definition.width)!, woods[definition.tone], .74 + (5.25 - definition.z) * .012, .51, '#443220',
        (x, z) => .255 + .255 * Math.sqrt(Math.max(.04, 1 - (x / radiusX) ** 2 - (z / .445) ** 2)));
      if (i % 4 === 0) {
        if (!mossGeometries.has(definition.width)) {
          const patch = new THREE.SphereGeometry(1, 13, 8);
          patch.scale((definition.width - .06) / 2, .13, .43); patch.translate(0, .07, 0);
          mossGeometries.set(definition.width, patch);
        }
        const patch = new THREE.Mesh(mossGeometries.get(definition.width)!, mossMaterial);
        patch.position.set(key.x, .67, key.z); patch.receiveShadow = true; this.group.add(patch); this.moss.push({ mesh: patch, key });
      }
    });

    const leaf = leafGeometry();
    const leafMaterials = ['#385832', '#537337', '#7b903e'].map(color => new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide }));
    const stemMaterial = new THREE.MeshStandardMaterial({ color: '#667446', roughness: 1 });
    for (let i = 0; i < 20; i++) {
      const key = this.keys[(i * 13 + 2) % this.keys.length];
      const plant = new THREE.Group();
      plant.position.set(key.x + key.definition.width * .36, .7, key.z + .47);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.009, .013, .35, 5), stemMaterial);
      stem.position.y = .16; stem.rotation.z = .17; plant.add(stem);
      for (let side = -1; side <= 1; side += 2) {
        const foliage = new THREE.Mesh(leaf, leafMaterials[i % 3]);
        foliage.position.set(0, .14, 0); foliage.rotation.set(.35 + rng() * .25, side * .5, side * .78);
        foliage.scale.setScalar(.7 + rng() * .45); plant.add(foliage);
      }
      const angle = (rng() - .5) * .3;
      this.plants.push({ group: plant, key, angle, phase: rng() * 6 }); this.group.add(plant);
    }

    const edgePlants = [[-8.75, 2.5], [-8.7, -2.4], [8.65, 2.8], [8.6, -2.7], [-6.7, 3.55], [6.9, -3.4]];
    edgePlants.forEach(([x, z], i) => {
      const plant = new THREE.Group(); plant.position.set(x, .66, z);
      const key = this.keys.reduce((closest, candidate) => Math.hypot(candidate.x - x, candidate.z - z) < Math.hypot(closest.x - x, closest.z - z) ? candidate : closest);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(.013, .022, .55, 6), stemMaterial); stem.position.y = .25; plant.add(stem);
      for (let j = 0; j < 4; j++) {
        const foliage = new THREE.Mesh(leaf, leafMaterials[(i + j) % 3]);
        foliage.position.y = .13 + j * .095; foliage.rotation.set(.4, j * 2.1, (j % 2 ? 1 : -1) * .75);
        foliage.scale.setScalar(1.15 + j * .13); plant.add(foliage);
      }
      this.plants.push({ group: plant, key, angle: (i % 2 ? 1 : -1) * .12, phase: i }); this.group.add(plant);
    });

    // Sparse edge mushrooms, clear of every legend and key hit target.
    const mushroomStem = new THREE.CylinderGeometry(.025, .038, .28, 7);
    const mushroomCap = new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2);
    const cream = new THREE.MeshStandardMaterial({ color: '#e0cc99', roughness: .9 });
    const rust = new THREE.MeshStandardMaterial({ color: '#ab754d', roughness: .78 });
    for (const [x, z, scale] of [[-8.7, 2.8, 1], [-8.45, 3.3, .65], [8.45, -2.4, .7]]) {
      const plant = new THREE.Group(); plant.position.set(x, .59, z); plant.scale.setScalar(scale);
      const stem = new THREE.Mesh(mushroomStem, cream); stem.position.y = .14;
      const cap = new THREE.Mesh(mushroomCap, rust); cap.scale.set(.2, .11, .2); cap.position.y = .27;
      plant.add(stem, cap); this.group.add(plant);
    }
    this.pollen = new ParticlePool(this.group, context.quality.particles, new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#e5d791' }), .1, 1.2);
    this.bounds.set(new THREE.Vector3(-10.15, 0, -4.3), new THREE.Vector3(9.65, 2.1, 4.5));
  }

  private wood(color: string, seed: number) {
    return surfaceMaterial({ color, roughness: .7, metalness: 0, envMapIntensity: .25 }, 'grown-wood', WOOD_SURFACE, { uSeed: { value: seed } }, 'uniform float uSeed;');
  }
  protected override onPress(key: KeyBody, reduced: boolean) {
    if (!reduced) this.pollen.burst(key.x, key.restY + .2, key.z + .33, this.quality.level === 'low' ? 2 : 4, .7, .5, .018);
  }
  protected override tick(delta: number, reduced: boolean) {
    for (const { mesh, key } of this.moss) mesh.scale.y = 1 - Math.max(0, key.state.displacement) * .52;
    for (const plant of this.plants) {
      let heat = plant.key.state.heat + this.rewardAt(plant.key);
      for (const key of this.keys) if (Math.abs(key.z - plant.key.z) < 1.2 && Math.abs(key.x - plant.key.x) < 1.4) heat = Math.max(heat, key.state.heat * .6);
      plant.group.rotation.z = plant.angle + (reduced ? 0 : Math.sin(this.time * 1.3 + plant.phase) * .035 + Math.sin(this.time * 13 + plant.phase) * heat * .18);
      plant.group.scale.y = 1 - plant.key.state.displacement * .2;
    }
    if (!reduced && this.time > this.nextPollen) {
      this.nextPollen = this.time + 2.4;
      const plant = this.plants[Math.floor(this.time * 7) % this.plants.length];
      this.pollen.burst(plant.group.position.x, 1.1, plant.group.position.z, 1, .16, .2, .012);
    }
    const moving = this.pollen.update(delta);
    return !reduced || moving;
  }
  protected override clear() { this.pollen.clear(); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.pollen.setLimit(quality.particles); }
  override diagnostics() { return { particles: this.pollen.active, flames: 0, waves: 0 }; }
}
