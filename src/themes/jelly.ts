import * as THREE from 'three';
import { KEYS } from '../keyboard/layout';
import { BaseRuntime, type KeyBody } from './shared/BaseRuntime';
import { puddingSolid } from './shared/geometry';
import { ParticlePool } from './shared/ParticlePool';
import type { QualitySettings, ThemeContext } from './types';

export default class Jelly extends BaseRuntime {
  private readonly droplets: ParticlePool;
  private readonly ripples = new Float32Array(KEYS.length);
  private readonly rippleTimes = new Float32Array(KEYS.length);

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'JELLY / fruit pudding';
    this.stiffness = 300; this.damping = 18;
    const material = (color: string, thickness = .7) => new THREE.MeshPhysicalMaterial({
      color, roughness: .17, metalness: 0, transmission: .38, thickness, ior: 1.37,
      clearcoat: .65, clearcoatRoughness: .16, specularIntensity: .7, envMapIntensity: .7, attenuationColor: color, attenuationDistance: 1.25,
    });
    const tray = new THREE.Mesh(puddingSolid(17.55, 7.2, .67, .33), material('#f1b3a0', .95));
    tray.position.y = .08; tray.castShadow = tray.receiveShadow = true; this.group.add(tray);
    const base = new THREE.Mesh(puddingSolid(16.95, 6.7, .24, .115), new THREE.MeshStandardMaterial({ color: '#d7927e', roughness: .42 }));
    base.position.y = .16; this.group.add(base);
    const materials = { ivory: material('#efa675'), gray: material('#ddad48'), orange: material('#aec563') };
    const geometries = new Map<number, THREE.BufferGeometry>();
    const bubbleGeometry = new THREE.SphereGeometry(.023, 8, 5);
    const bubbleMaterial = new THREE.MeshStandardMaterial({ color: '#fff1d1', roughness: .15, metalness: .15 });
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .13, .87, .65, .25));
      const key = this.addKey(definition, i, geometries.get(definition.width)!, materials[definition.tone], .76 + (5.25 - definition.z) * .009, .65, '#73452e', .025);
      if (i % 6 === 0) for (let j = 0; j < 2; j++) {
        const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
        bubble.position.set((j - .5) * .24, .22 + j * .17, .18);
        key.group.add(bubble);
      }
    });
    this.droplets = new ParticlePool(this.group, context.quality.particles, new THREE.SphereGeometry(1, 8, 6), material('#ffb986', .06), -2.5, 1.5);
    this.bounds.set(new THREE.Vector3(-9, 0, -3.75), new THREE.Vector3(9, 1.9, 3.8));
  }

  protected override pose(key: KeyBody, reduced: boolean) {
    const squeeze = THREE.MathUtils.clamp(key.state.displacement, -.2, 1);
    const ripple = reduced ? 0 : this.ripples[key.index] * Math.sin((this.time - this.rippleTimes[key.index]) * 28);
    key.group.position.y = key.restY - squeeze * .025 + ripple * .15;
    key.group.scale.set(1 + squeeze * .07 / key.definition.width, 1 - squeeze * .4 + ripple, 1 + squeeze * .06);
    key.group.rotation.z = ripple * .35;
  }
  protected override onPress(key: KeyBody, reduced: boolean) {
    if (reduced) return;
    this.droplets.burst(key.x + key.definition.width * .3, key.restY + .45, key.z + .34, 2, .85, .17, .045);
    for (const neighbor of this.keys) {
      if (neighbor === key || neighbor.state.down) continue;
      const dx = Math.max(0, Math.abs(neighbor.x - key.x) - (key.definition.width + neighbor.definition.width) * .3);
      const distance = Math.hypot(dx, neighbor.z - key.z);
      const reach = 1.25 + this.rewardTier * .55;
      if (distance < reach) {
        this.ripples[neighbor.index] = (.035 + this.rewardTier * .012) * (1 - distance / reach);
        this.rippleTimes[neighbor.index] = this.time;
      }
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    let rippling = false;
    for (let i = 0; i < this.ripples.length; i++) {
      this.ripples[i] = reduced ? 0 : this.ripples[i] * Math.exp(-10 * delta);
      rippling = rippling || this.ripples[i] > .0001;
    }
    return this.droplets.update(delta) || rippling;
  }
  protected override clear() { this.droplets.clear(); this.ripples.fill(0); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.droplets.setLimit(quality.particles); }
  override diagnostics() { return { particles: this.droplets.active, flames: 0, waves: 0 }; }
}
