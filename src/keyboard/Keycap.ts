import * as THREE from 'three';
import type { KeyDefinition } from './layout';
import { legendGeometry } from './legends';
import { roundedPlate } from './geometry';

export class Keycap {
  readonly group = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly glow: THREE.Mesh<THREE.ShapeGeometry, THREE.MeshBasicMaterial>;
  private travel = 0;
  private velocity = 0;
  private light = 0;
  private wasPressed = false;
  private readonly restY: number;

  constructor(
    readonly definition: KeyDefinition,
    index: number,
    geometry: THREE.BufferGeometry,
    materials: THREE.Material[],
    legendMaterial: THREE.Material,
    centerX: number,
    centerZ: number,
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
    const glowMaterial = new THREE.MeshBasicMaterial({color: '#e9974c', transparent: true, opacity: 0, depthWrite: false});
    this.glow = new THREE.Mesh(roundedPlate(definition.width + 0.025, 1.005, 0.13), glowMaterial);
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.set(this.group.position.x, 0.870, this.group.position.z);
    this.glow.visible = false;
  }

  /** Mutate only the object transform; React is not in the animation loop. */
  update(delta: number, pressed: boolean, reducedMotion: boolean) {
    const target = pressed ? (reducedMotion ? -0.095 : -0.205) : 0;
    if (reducedMotion) {
      this.travel = target;
      this.velocity = 0;
      this.light = pressed ? 0.30 : 0;
    } else {
      if (pressed && !this.wasPressed) {
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
      this.light += ((pressed ? 0.34 : 0) - this.light) * (1 - Math.exp(-(pressed ? 45 : 12) * delta));
    }
    this.group.position.y = this.restY + this.travel;
    this.glow.material.opacity = this.light;
    this.glow.visible = this.light > 0.003;
    this.wasPressed = pressed;
    return Math.abs(this.travel - target) > 0.0001 || Math.abs(this.velocity) > 0.001 || (!pressed && this.light > 0.003);
  }
}
