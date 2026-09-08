import * as THREE from 'three';

export interface Point3 { x: number; y: number; z: number }
interface Ribbon { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; positions: THREE.BufferAttribute; age: number; lifetime: number }

/** Fixed 3D ribbons with depth testing, curved paths and no per-strike GPU allocation. */
export class RibbonPool {
  private readonly ribbons: Ribbon[];
  private cursor = 0;
  private limit: number;
  active = 0;
  constructor(parent: THREE.Object3D, capacity: number) {
    this.limit = capacity;
    this.ribbons = Array.from({ length: capacity }, () => {
      const geometry = new THREE.BufferGeometry();
      const positions = new THREE.BufferAttribute(new Float32Array(33 * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage);
      const uvs = new Float32Array(33 * 2 * 2), indices: number[] = [];
      for (let i = 0; i <= 32; i++) {
        uvs.set([i / 32, 0, i / 32, 1], i * 4);
        if (i < 32) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      geometry.setAttribute('position', positions); geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); geometry.setIndex(indices);
      const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uColor: { value: new THREE.Color() }, uAge: { value: 2 }, uLife: { value: 1 }, uInk: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: `uniform vec3 uColor; uniform float uAge; uniform float uLife; uniform float uInk; varying vec2 vUv;
          void main(){float edge=1.-abs(vUv.y*2.-1.); float fade=pow(max(0.,1.-uAge/uLife),.7);
            float head=1.-smoothstep(uAge*8.,uAge*8.+.12,vUv.x);
            float foam=pow(edge,5.)*(.5+.5*sin(vUv.x*42.+uAge*4.));
            vec3 color=mix(uColor,vec3(.91,.98,1.),foam*(1.-uInk)*.85);
            gl_FragColor=vec4(color,fade*head*smoothstep(0.,.16,edge)); }`,
      });
      const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.frustumCulled = false; parent.add(mesh);
      return { mesh, positions, age: 2, lifetime: 1 };
    });
  }
  emit(from: Point3, to: Point3, color: THREE.ColorRepresentation, width = .15, lift = .45, lifetime = .75, ink = false, bend = 0) {
    const ribbon = this.ribbons[this.cursor++ % this.limit];
    const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length, nz = dx / length;
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, arc = Math.sin(t * Math.PI);
      const x = from.x + dx * t + nx * arc * bend, y = from.y + (to.y - from.y) * t + arc * lift, z = from.z + dz * t + nz * arc * bend;
      const w = width * (.04 + Math.sin(t * Math.PI) ** .55);
      for (let side = 0; side < 2; side++) {
        const s = side ? 1 : -1;
        ribbon.positions.setXYZ(i * 2 + side, x + nx * w * s, y + w * s * .38, z + nz * w * s);
      }
    }
    ribbon.positions.needsUpdate = true;
    ribbon.age = 0; ribbon.lifetime = Math.min(1.2, lifetime);
    ribbon.mesh.material.uniforms.uColor.value.set(color);
    ribbon.mesh.material.uniforms.uInk.value = Number(ink);
    ribbon.mesh.visible = true;
  }
  update(delta: number, reduced = false) {
    this.active = 0;
    this.ribbons.forEach((ribbon, i) => {
      ribbon.age += delta;
      ribbon.mesh.visible = !reduced && i < this.limit && ribbon.age < ribbon.lifetime;
      if (ribbon.mesh.visible) this.active++;
      ribbon.mesh.material.uniforms.uAge.value = ribbon.age;
      ribbon.mesh.material.uniforms.uLife.value = ribbon.lifetime;
    });
    return this.active > 0;
  }
  setLimit(limit: number) { this.limit = Math.max(1, Math.min(limit, this.ribbons.length)); }
  clear() { this.active = 0; for (const ribbon of this.ribbons) { ribbon.age = 2; ribbon.mesh.visible = false; } }
}
