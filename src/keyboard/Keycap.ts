import * as THREE from 'three';
import type { KeyDefinition } from './layout';
import type { KeyboardPreset } from './presets';
import { legendGeometry } from './legends';

export class Keycap {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly glow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly ring: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  private travel = 0;
  private velocity = 0;
  private light = 0;
  private wasPressed = false;
  private pressVersion = 0;
  private pulseAge = Infinity;
  private readonly restY: number;
  private effect!: KeyboardPreset['effect'];
  private readonly effectColor = new THREE.Color();

  constructor(
    readonly definition: KeyDefinition,
    index: number,
    geometry: THREE.BufferGeometry,
    materials: THREE.Material[],
    legendMaterial: THREE.Material,
    centerX: number,
    centerZ: number,
    glowTexture: THREE.Texture,
    glowGeometry: THREE.PlaneGeometry,
    ringGeometry: THREE.ShapeGeometry,
  ) {
    this.restY = 0.87 + (5.25 - definition.z) * 0.018;
    this.group.position.set(definition.x + definition.width / 2 - centerX, this.restY, definition.z - centerZ);
    this.group.name = definition.code;
    this.mesh = new THREE.Mesh(geometry, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.userData.code = definition.code;
    this.group.add(this.mesh);
    const legend = new THREE.Mesh(legendGeometry(definition, index), legendMaterial);
    legend.renderOrder = 1;
    this.group.add(legend);
    if (definition.code === 'KeyF' || definition.code === 'KeyJ') {
      const homing = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.028), materials[1]);
      homing.position.set(0, 0.444, 0.23);
      this.group.add(homing);
    }
    this.glow = new THREE.Mesh(glowGeometry, new THREE.MeshBasicMaterial({
      map: glowTexture, transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.glow.scale.set(definition.width + 0.32, 1.32, 1);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(this.group.position.x, 0.872, this.group.position.z);
    this.glow.visible = false;
    this.ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.447;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  setEffect(effect: KeyboardPreset['effect'], blend: number) {
    this.effect = effect;
    const index = Math.floor(this.definition.x / 3 + this.definition.z) % effect.colors.length;
    this.effectColor.set(effect.colors[index]);
    this.glow.material.color.lerp(this.effectColor, blend);
    this.ring.material.color.copy(this.glow.material.color);
  }

  clearEffects(pressVersion: number, pressed = false) {
    this.pressVersion = pressVersion;
    this.wasPressed = pressed;
    this.travel = pressed ? -0.205 : 0;
    this.velocity = 0;
    this.group.position.y = this.restY + this.travel;
    this.pulseAge = Infinity;
    this.light = this.effect.idleOpacity;
    this.glow.material.opacity = this.light;
    this.glow.visible = this.light > 0.003;
    this.ring.visible = false;
    this.ring.material.opacity = 0;
  }

  /** Mutate transforms and preallocated effects; React never drives frames. */
  update(delta: number, pressed: boolean, reducedMotion: boolean, pressVersion: number) {
    const freshPress = pressVersion !== this.pressVersion;
    this.pressVersion = pressVersion;
    if (freshPress && !reducedMotion) this.pulseAge = 0;
    if (reducedMotion) this.pulseAge = Infinity;
    const target = pressed ? (reducedMotion ? -0.095 : -0.205) : 0;
    if (reducedMotion) {
      this.travel = target;
      this.velocity = 0;
    } else {
      if (freshPress || (pressed && !this.wasPressed)) {
        this.travel = Math.min(this.travel, -0.13);
        this.velocity = 0;
      }
      if (pressed) {
        this.travel += (target - this.travel) * (1 - Math.exp(-85 * delta));
        this.velocity = 0;
      } else {
        const steps = Math.max(1, Math.ceil(delta / (1 / 120)));
        const step = delta / steps;
        for (let i = 0; i < steps; i++) {
          this.velocity += (-850 * this.travel - 46 * this.velocity) * step;
          this.travel += this.velocity * step;
        }
        if (Math.abs(this.travel) < 0.0001 && Math.abs(this.velocity) < 0.001) {
          this.travel = 0;
          this.velocity = 0;
        }
      }
    }
    const baseLight = pressed ? this.effect.holdOpacity : this.effect.idleOpacity;
    this.light = reducedMotion ? baseLight : this.light + (baseLight - this.light) * (1 - Math.exp(-(pressed ? 45 : 12) * delta));
    const progress = Math.min(this.pulseAge / this.effect.duration, 1);
    const envelope = (1 - progress) ** 2;
    this.glow.material.opacity = this.light + envelope * this.effect.pulseOpacity;
    this.glow.visible = this.glow.material.opacity > 0.003;
    this.ring.visible = progress < 1;
    this.ring.material.opacity = this.effect.ringOpacity * envelope;
    const spread = 1 + this.effect.spread * (1 - (1 - progress) ** 3);
    this.ring.scale.set((this.definition.width + 0.015) * spread, 1.015 * spread, 1);
    if (this.pulseAge < this.effect.duration) this.pulseAge += delta;
    this.group.position.y = this.restY + this.travel;
    this.wasPressed = pressed;
    return Math.abs(this.travel - target) > 0.0001 || Math.abs(this.velocity) > 0.001 || Math.abs(this.light - baseLight) > 0.003 || progress < 1;
  }
}
