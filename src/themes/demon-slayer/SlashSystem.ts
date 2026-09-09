import * as THREE from 'three';
import { DEMON_SLAYER as C } from './config';
import { SLASH_LANES, SLASH_SEGMENTS, writeSlash, type Point3, type SlashForm } from './SlashGeometry';

interface Slash {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  water: THREE.BufferAttribute; sun: THREE.BufferAttribute;
  age: number; life: number; mode: SlashForm; transition: boolean; reduced: boolean;
  echo: boolean;
}

const vertexShader = `
  attribute vec3 sunPosition; varying vec2 vUv;
  uniform float uMorph; uniform float uAge; uniform float uReduced;
  void main() {
    vUv=uv; vec3 p=mix(position,sunPosition,uMorph);
    p.y+=sin(uv.x*51.-uAge*19.)*sin(uv.x*3.14159)*.018*uMorph*(1.-uReduced);
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;
const fragmentShader = `
  varying vec2 vUv;
  uniform vec3 uDeep; uniform vec3 uWater; uniform vec3 uLight; uniform vec3 uFoam;
  uniform vec3 uRed; uniform vec3 uFire; uniform vec3 uGold; uniform vec3 uCore;
  uniform float uMorph; uniform float uAge; uniform float uLife; uniform float uOpacity; uniform float uReduced; uniform float uTransition;
  void main() {
    float u=vUv.x, v=vUv.y;
    float lane=v+sin(u*18.-uAge*3.)*.045+sin(u*37.+v*5.)*.016;
    // Opaque, cel-painted strata: indigo undercut, blue body, cyan crest, white foam.
    vec3 water=uDeep;
    water=mix(water,uWater,smoothstep(.06,.1,lane));
    water=mix(water,uLight,smoothstep(.47,.51,lane));
    water=mix(water,uWater,smoothstep(.63,.66,lane));
    water=mix(water,uFoam,smoothstep(.84,.9,lane));
    float vein=abs(lane-(.27+.065*sin(u*24.-uAge*5.)));
    water=mix(water,uFoam,(1.-smoothstep(.013,.024,vein))*.92);
    // Broken curl-shaped foam pockets with blue centers, not generic sparkles.
    vec2 cell=vec2(fract(u*4.-uAge*.38)-.5,(v-.81)*2.5);
    float ring=length(cell*vec2(1.,1.2));
    float foamRing=smoothstep(.105,.14,ring)*(1.-smoothstep(.21,.24,ring));
    water=mix(water,uFoam,foamRing*.9);
    float brush=sin(u*91.+v*15.)*.055+sin(u*147.-v*12.)*.027;
    vec3 fire=mix(uRed,uFire,smoothstep(.04,.18,v+brush));
    fire=mix(fire,uGold,smoothstep(.34,.5,lane));
    fire=mix(fire,uCore,smoothstep(.55,.69,lane));
    fire=mix(fire,uFire,smoothstep(.78,.94,v+brush));
    float cut=step(.54,u)*step(.48,v)*step(v,.79)*step(.97,sin(u*117.+v*11.));
    float age=max(0.,uAge/uLife);
    float reveal=1.-smoothstep(uAge/(uReduced>.5?.015:.065),uAge/(uReduced>.5?.015:.065)+.15,u);
    float fade=mix(pow(max(0.,1.-age),.6),min(1.,max(0.,1.-age)*7.),uTransition);
    float edge=smoothstep(0.,.018,v)*(1.-smoothstep(.98,1.,v));
    float alpha=fade*reveal*edge*uOpacity*(1.-cut*uMorph*.82);
    if(alpha<.008) discard;
    float heat=smoothstep(0.,.12,uMorph-(abs(u-.52)*.9+abs(v-.5)*.28));
    vec3 pigment=mix(water,fire,heat);
    pigment=mix(pigment,uCore,(1.-abs(heat*2.-1.))*.6);
    gl_FragColor=vec4(pigment,alpha);
    #include <colorspace_fragment>
  }`;

/** Bounded multi-lane brush meshes. No texture fetch, postprocessing, DOM overlay or strike allocation on GPU. */
export class SlashSystem {
  private readonly slots: Slash[];
  private readonly transition: Slash;
  private cursor = 0;
  private limit = C.trail.maxSlashes as number;
  private transitionSerial = -1;
  active = 0;
  emitted = 0;
  transitions = 0;
  waterCount = 0;
  sunCount = 0;

  constructor(parent: THREE.Group) {
    this.slots = Array.from({ length: C.trail.maxSlashes }, () => this.create(parent));
    this.transition = this.create(parent);
  }

  private create(parent: THREE.Group): Slash {
    const geometry = new THREE.BufferGeometry(), vertices = (SLASH_SEGMENTS + 1) * (SLASH_LANES + 1);
    const water = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const sun = new THREE.BufferAttribute(new Float32Array(vertices * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const uv = new Float32Array(vertices * 2), indices: number[] = [];
    for (let i = 0; i <= SLASH_SEGMENTS; i++) for (let lane = 0; lane <= SLASH_LANES; lane++) {
      const index = i * (SLASH_LANES + 1) + lane;
      uv.set([i / SLASH_SEGMENTS, lane / SLASH_LANES], index * 2);
      if (i < SLASH_SEGMENTS && lane < SLASH_LANES) { const b = index + SLASH_LANES + 1; indices.push(index, b, index + 1, index + 1, b, b + 1); }
    }
    geometry.setAttribute('position', water); geometry.setAttribute('sunPosition', sun); geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uDeep: { value: new THREE.Color(C.water.deep) }, uWater: { value: new THREE.Color(C.water.body) }, uLight: { value: new THREE.Color(C.water.light) }, uFoam: { value: new THREE.Color(C.water.foam) },
        uRed: { value: new THREE.Color(C.sun.edge) }, uFire: { value: new THREE.Color(C.sun.body) }, uGold: { value: new THREE.Color(C.sun.light) }, uCore: { value: new THREE.Color(C.sun.core) },
        uMorph: { value: 0 }, uAge: { value: 2 }, uLife: { value: 1 }, uOpacity: { value: 1 }, uReduced: { value: 0 }, uTransition: { value: 0 },
      }, vertexShader, fragmentShader, transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false,
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 3; parent.add(mesh);
    return { mesh, water, sun, age: 2, life: 1, mode: 'water', transition: false, reduced: false, echo: false };
  }

  private fill(slot: Slash, from: Point3, to: Point3, mode: SlashForm, width: number, energy: number, reduced: boolean, life: number, anchors?: readonly Point3[]) {
    writeSlash(slot.water.array as Float32Array, from, to, 'water', width, energy, anchors);
    writeSlash(slot.sun.array as Float32Array, from, to, 'sun', width * 1.12, energy, anchors);
    slot.water.needsUpdate = slot.sun.needsUpdate = true;
    slot.age = 0; slot.life = life; slot.mode = mode; slot.reduced = reduced; slot.echo = false; slot.mesh.visible = true;
  }

  emit(from: Point3, to: Point3, mode: SlashForm, energy: number, reduced: boolean, scale = 1, anchors?: readonly Point3[]) {
    // Keep one legible leading cut, with quiet short echoes instead of repeated beads.
    if (anchors && anchors.length > 1) for (const previous of this.slots) if (previous.mesh.visible) { previous.echo = true; previous.life = Math.min(previous.life, previous.age + .18); }
    const slot = this.slots[this.cursor++ % (reduced ? 1 : this.limit)];
    const width = (mode === 'water' ? .51 : .45) * (1 + energy * .26) * scale * (reduced ? .7 : 1);
    this.fill(slot, from, to, mode, width, energy, reduced, reduced ? .13 : mode === 'water' ? C.trail.lifetime : C.trail.sunLifetime, anchors);
    this.emitted++; if (mode === 'water') this.waterCount++; else this.sunCount++;
  }

  awaken(serial: number, reduced: boolean) {
    if (serial === this.transitionSerial || reduced) return;
    this.transitionSerial = serial; this.transitions++;
    this.fill(this.transition, { x: -4, y: 1.55, z: -2.7 }, { x: 4.2, y: 1.55, z: -2.7 }, 'water', .77, 1, false, C.transitionMs / 1000 + .12);
    this.transition.transition = true;
  }

  update(delta: number, mix: number, reduced: boolean, off = false) {
    this.active = 0;
    const update = (slot: Slash, visible: boolean) => {
      slot.age += delta; slot.mesh.visible = visible && slot.age < slot.life && !off;
      const u = slot.mesh.material.uniforms;
      u.uAge.value = slot.age; u.uLife.value = slot.life; u.uReduced.value = Number(reduced);
      u.uMorph.value = slot.transition ? mix : slot.mode === 'sun' ? 1 : mix * .6;
      u.uOpacity.value = slot.echo ? .26 : .96; u.uTransition.value = Number(slot.transition);
      if (slot.mesh.visible) this.active++;
    };
    this.slots.forEach((slot, i) => update(slot, i < this.limit && (!reduced || slot.reduced)));
    update(this.transition, !reduced);
    return this.active > 0;
  }
  setLow(low: boolean) { this.limit = low ? C.trail.lowSlashes : C.trail.maxSlashes; }
  clear() { this.active = 0; for (const slot of [...this.slots, this.transition]) { slot.age = 2; slot.mesh.visible = false; } }
  diagnostics() { return { active: this.active, capacity: this.limit, emitted: this.emitted, water: this.waterCount, sun: this.sunCount, transitions: this.transitions }; }
}
