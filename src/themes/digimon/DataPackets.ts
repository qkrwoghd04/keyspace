import * as THREE from 'three';

/** Fixed-size packet pool. Each admission captures its real key origin. */
export class DataPackets {
  readonly mesh: THREE.InstancedMesh;
  private readonly positions = new Float32Array(48 * 3);
  private readonly ages = new Float32Array(48).fill(1);
  private readonly dummy = new THREE.Object3D();
  private cursor = 0;
  private limit = 48;
  active = 0;
  emitted = 0;
  constructor(parent: THREE.Group) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: '#86a86e', transparent: true, opacity: .83 }), 48);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.count = 0;
    parent.add(this.mesh);
  }
  emit(x: number, y: number, z: number) {
    const index = this.cursor++ % this.limit;
    this.positions.set([x, y, z], index * 3); this.ages[index] = 0; this.emitted++;
  }
  setLow(low: boolean) { this.limit = low ? 18 : 48; for (let i = this.limit; i < 48; i++) this.ages[i] = 1; }
  clear() { this.ages.fill(1); this.active = this.mesh.count = 0; }
  update(delta: number, reduced: boolean) {
    if (reduced) { this.clear(); return false; }
    let count = 0;
    for (let i = 0; i < this.limit; i++) {
      const t = this.ages[i] += delta / .72;
      if (t >= 1) continue;
      const p = 1 - (1 - t) ** 2, offset = i * 3;
      this.dummy.position.set(
        THREE.MathUtils.lerp(this.positions[offset], 10.3, p),
        THREE.MathUtils.lerp(this.positions[offset + 1], 1.45, p) + Math.sin(Math.PI * t) * .65,
        THREE.MathUtils.lerp(this.positions[offset + 2], -.35, p),
      );
      this.dummy.rotation.set(t * 3, t * 4, 0);
      this.dummy.scale.setScalar(.10 * Math.sin(Math.PI * Math.min(1, t + .15)));
      this.dummy.updateMatrix(); this.mesh.setMatrixAt(count++, this.dummy.matrix);
    }
    this.active = this.mesh.count = count; this.mesh.instanceMatrix.needsUpdate = true;
    return count > 0;
  }
}
