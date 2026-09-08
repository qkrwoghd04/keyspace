import * as THREE from 'three';
import { random } from './random';

/** Fixed storage and one instanced draw call. A burst never allocates GPU resources. */
export class ParticlePool {
  readonly mesh: THREE.InstancedMesh;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly sizes: Float32Array;
  private readonly dummy = new THREE.Object3D();
  private readonly rng = random(3417);
  private cursor = 0;
  private limit: number;
  active = 0;

  constructor(parent: THREE.Group, capacity: number, geometry: THREE.BufferGeometry, material: THREE.Material, private readonly gravity = -2, private readonly damping = .6) {
    this.limit = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.velocities = new Float32Array(capacity * 3);
    this.ages = new Float32Array(capacity).fill(2);
    this.lifetimes = new Float32Array(capacity);
    this.sizes = new Float32Array(capacity);
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    parent.add(this.mesh);
    this.clear();
  }

  setLimit(limit: number) {
    this.limit = Math.min(limit, this.ages.length);
    this.mesh.count = this.limit;
    for (let i = this.limit; i < this.ages.length; i++) this.ages[i] = 2;
  }

  burst(x: number, y: number, z: number, count: number, speed = 1, spread = .25, size = .05) {
    for (let j = 0; j < Math.min(count, this.limit); j++) {
      const i = this.cursor++ % this.limit, offset = i * 3;
      this.positions[offset] = x + (this.rng() - .5) * spread;
      this.positions[offset + 1] = y;
      this.positions[offset + 2] = z + (this.rng() - .5) * spread;
      this.velocities[offset] = (this.rng() - .5) * speed;
      this.velocities[offset + 1] = (.3 + this.rng() * .7) * speed;
      this.velocities[offset + 2] = (this.rng() - .5) * speed;
      this.ages[i] = 0;
      this.lifetimes[i] = .35 + this.rng() * .8;
      this.sizes[i] = size * (.5 + this.rng() * .7);
    }
  }

  update(delta: number, attraction?: { x: number; y: number; z: number; force: number }) {
    this.active = 0;
    for (let i = 0; i < this.limit; i++) {
      const offset = i * 3;
      this.ages[i] += delta;
      const progress = this.ages[i] / this.lifetimes[i];
      if (progress >= 1 || !Number.isFinite(progress)) {
        this.dummy.scale.setScalar(0);
      } else {
        this.active++;
        if (attraction) {
          this.velocities[offset] += (attraction.x - this.positions[offset]) * attraction.force * delta;
          this.velocities[offset + 1] += (attraction.y - this.positions[offset + 1]) * attraction.force * delta;
          this.velocities[offset + 2] += (attraction.z - this.positions[offset + 2]) * attraction.force * delta;
        }
        this.velocities[offset + 1] += this.gravity * delta;
        for (let axis = 0; axis < 3; axis++) {
          this.velocities[offset + axis] *= Math.exp(-this.damping * delta);
          this.positions[offset + axis] += this.velocities[offset + axis] * delta;
        }
        this.dummy.position.fromArray(this.positions, offset);
        this.dummy.rotation.set(progress * 3 + i, progress + i * .2, progress * 2);
        this.dummy.scale.setScalar(this.sizes[i] * Math.min(1, (1 - progress) * 3));
      }
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = this.active > 0;
    return this.active > 0;
  }

  clear() {
    this.ages.fill(2);
    this.active = 0;
    this.mesh.visible = false;
  }
}
