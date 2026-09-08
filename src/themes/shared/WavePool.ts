import * as THREE from 'three';

export class WavePool {
  private readonly waves: { mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number; strength: number; radius: number }[];
  private cursor = 0;
  private limit: number;
  active = 0;

  constructor(parent: THREE.Group, capacity: number, color: string, private readonly duration = .65) {
    this.limit = capacity;
    const geometry = new THREE.RingGeometry(.975, 1, 56);
    this.waves = Array.from({ length: capacity }, () => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0, side: THREE.DoubleSide }));
      mesh.rotation.x = -Math.PI / 2; mesh.visible = false; parent.add(mesh);
      return { mesh, age: 2, strength: .2, radius: 1.3 };
    });
  }
  emit(x: number, y: number, z: number, radius = 1.3, strength = .3) {
    const wave = this.waves[this.cursor++ % this.limit];
    wave.mesh.position.set(x, y, z);
    wave.age = 0; wave.radius = radius; wave.strength = strength;
  }
  update(delta: number) {
    this.active = 0;
    this.waves.forEach((wave, i) => {
      wave.age += delta;
      const t = wave.age / this.duration;
      wave.mesh.visible = i < this.limit && t < 1;
      if (!wave.mesh.visible) return;
      this.active++;
      const radius = .15 + (1 - (1 - t) ** 2) * wave.radius;
      wave.mesh.scale.set(radius, radius, 1);
      wave.mesh.material.opacity = (1 - t) ** 2 * wave.strength;
    });
    return this.active > 0;
  }
  setLimit(limit: number) { this.limit = Math.min(limit, this.waves.length); for (let i = this.limit; i < this.waves.length; i++) this.waves[i].age = 2; }
  clear() { this.active = 0; for (const wave of this.waves) { wave.age = 2; wave.mesh.visible = false; } }
}
