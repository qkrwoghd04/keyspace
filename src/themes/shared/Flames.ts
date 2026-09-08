import * as THREE from 'three';
import type { KeyBody } from './BaseRuntime';

/** Three tapered ribbons form each flame in object space, not screen space. */
export class Flames {
  readonly mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly flare: THREE.InstancedBufferAttribute;
  private readonly anchors: { x: number; y: number; z: number }[];
  private readonly time = { value: 0 };

  constructor(parent: THREE.Group, anchors: { x: number; y: number; z: number }[]) {
    this.anchors = anchors;
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let ribbon = 0; ribbon < 3; ribbon++) {
      const offset = positions.length / 3, angle = ribbon * Math.PI / 3;
      for (let step = 0; step <= 8; step++) {
        const t = step / 8, width = .16 * (1 - t) ** .8;
        for (const side of [-1, 1]) {
          positions.push(side * width * Math.cos(angle), t, side * width * Math.sin(angle));
          uvs.push(side === -1 ? 0 : 1, t);
        }
        if (step < 8) { const i = offset + step * 2; indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    this.flare = new THREE.InstancedBufferAttribute(new Float32Array(anchors.length), 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aFlare', this.flare);
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time }, side: THREE.DoubleSide, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `attribute float aFlare; uniform float uTime; varying vec2 vUv; varying float vFlare;
        void main() {
          vUv=uv; vFlare=aFlare;
          vec3 p=position;
          float phase=instanceMatrix[3].x*4.13 + instanceMatrix[3].z*7.7;
          p.x += sin(uTime*5.2 + phase + uv.y*5.) * .1 * uv.y*uv.y;
          p.z += cos(uTime*3.7 + phase + uv.y*4.) * .07 * uv.y*uv.y;
          p.y *= .86 + .14*sin(phase+uTime*3.) + aFlare*.75;
          p.xz *= (.85+.2*sin(phase*.7))*(1.+aFlare*.35);
          gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.);
        }`,
      fragmentShader: `varying vec2 vUv; varying float vFlare;
        void main() {
          float center=1.-abs(vUv.x*2.-1.);
          float alpha=pow(center,.7)*pow(1.-vUv.y,.65)*.66;
          if(alpha<.035) discard;
          vec3 color=mix(vec3(1.,.075,.008),vec3(1.,.53,.055),pow(center,2.)*(1.-vUv.y));
          color=mix(color,vec3(1.,.88,.42),pow(center,8.)*pow(1.-vUv.y,3.));
          gl_FragColor=vec4(color*(1.+vFlare*.28),alpha);
        }`,
    });
    this.mesh = new THREE.InstancedMesh(geometry, material, anchors.length);
    const matrix = new THREE.Matrix4();
    anchors.forEach((anchor, i) => { matrix.makeTranslation(anchor.x, anchor.y, anchor.z); this.mesh.setMatrixAt(i, matrix); });
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }

  update(time: number, keys: readonly KeyBody[], reduced: boolean) {
    this.time.value = reduced ? 0 : time;
    for (let i = 0; i < this.mesh.count; i++) {
      let heat = 0;
      const anchor = this.anchors[i];
      for (const key of keys) {
        const dx = Math.max(0, Math.abs(anchor.x - key.x) - key.definition.width / 2), dz = anchor.z - key.z;
        const distance = dx * dx + dz * dz;
        if (distance < .65) heat = Math.max(heat, key.state.heat * (1 - distance / .65));
      }
      this.flare.setX(i, reduced ? heat * .12 : heat);
    }
    this.flare.needsUpdate = true;
  }

  setLimit(limit: number) { this.mesh.count = Math.min(this.anchors.length, limit); }
}
