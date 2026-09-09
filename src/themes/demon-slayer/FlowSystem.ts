import * as THREE from 'three';
import { TrailPath, trailPoint, type TrailChain } from './TrailPath';
import type { Point3 } from './SlashGeometry';

const STEPS = 16, LANES = 8, ROWS = 9 * (STEPS + 1), VERTICES = ROWS * (LANES + 1);
const vertexShader = `
attribute vec3 sunPosition; attribute vec2 flow;
varying vec2 vUv; varying vec2 vFlow;
uniform float uMix;
void main(){ vUv=uv; vFlow=flow; gl_Position=projectionMatrix*modelViewMatrix*vec4(mix(position,sunPosition,uMix),1.); }
`;
const fragmentShader = `
varying vec2 vUv; varying vec2 vFlow;
uniform float uNow; uniform float uLife; uniform float uMix;
void main(){
 float s=vFlow.x, v=vUv.y, age=clamp((uNow-vFlow.y)/uLife,0.,1.);
 float moving=s*3.2-uNow*8.;
 float lane=v+sin(moving)*.055+sin(s*9.-uNow*5.)*.025;
 vec3 water=vec3(.035,.22,.43);
 water=mix(water,vec3(.04,.47,.73),smoothstep(.04,.12,lane));
 water=mix(water,vec3(.26,.79,.9),smoothstep(.4,.44,lane));
 water=mix(water,vec3(.09,.56,.78),smoothstep(.67,.71,lane));
 water=mix(water,vec3(.91,.99,.98),smoothstep(.84,.91,lane));
 float vein=1.-smoothstep(.009,.03,abs(lane-(.27+.055*sin(moving*1.3))));
 water=mix(water,vec3(.92,1.,.98),vein*.9);
 vec2 cell=vec2(fract(s*1.4-uNow*2.2)-.5,(v-.81)*3.);
 float ring=length(cell);
 water=mix(water,vec3(.93,1.,.99),smoothstep(.09,.12,ring)*(1.-smoothstep(.18,.23,ring))*.8);
 float brush=sin(s*39.+v*17.-uNow*3.)*.07;
 vec3 fire=mix(vec3(.65,.065,.06),vec3(.98,.29,.045),smoothstep(.06,.2,lane+brush));
 fire=mix(fire,vec3(1.,.71,.13),smoothstep(.37,.49,lane));
 fire=mix(fire,vec3(1.,.96,.74),smoothstep(.58,.67,lane));
 fire=mix(fire,vec3(.97,.24,.04),smoothstep(.81,.96,lane+brush));
 float splits=step(.6,v)*step(v,.89)*smoothstep(.86,.98,sin(s*43.+v*19.));
 float edge=smoothstep(0.,.025,v)*(1.-smoothstep(.975,1.,v));
 float alpha=(1.-smoothstep(.52,1.,age))*edge*(1.-splits*uMix*.85)*.94;
 if(alpha<.01)discard;
 gl_FragColor=vec4(mix(water,fire,uMix),alpha);
 #include <colorspace_fragment>
}`;

interface Ribbon { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; water: Float32Array; sun: Float32Array; flow: Float32Array }

/** Two persistent ribbons: growing chain and one retiring chain. Never spawn a ribbon per key. */
export class FlowSystem {
  readonly path = new TrailPath();
  private readonly ribbons: Ribbon[];
  private readonly p: Point3 = { x: 0, y: 0, z: 0 };
  private readonly before: Point3 = { x: 0, y: 0, z: 0 };
  private readonly after: Point3 = { x: 0, y: 0, z: 0 };
  private low = false;
  active = 0;
  constructor(parent: THREE.Group) {
    this.ribbons = Array.from({ length: 2 }, (_, n) => {
      const water = new Float32Array(VERTICES * 3), sun = new Float32Array(VERTICES * 3), flow = new Float32Array(VERTICES * 2), uv = new Float32Array(VERTICES * 2), indices: number[] = [];
      for (let row = 0; row < ROWS; row++) for (let lane = 0; lane <= LANES; lane++) {
        const index = row * (LANES + 1) + lane;
        uv.set([row / (ROWS - 1), lane / LANES], index * 2);
        if (row % (STEPS + 1) < STEPS && lane < LANES) { const b = index + LANES + 1; indices.push(index, b, index + 1, index + 1, b, b + 1); }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(water, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('sunPosition', new THREE.BufferAttribute(sun, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('flow', new THREE.BufferAttribute(flow, 2).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.setDrawRange(0, 0);
      const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: { uNow: { value: 0 }, uLife: { value: 1 }, uMix: { value: 0 } }, transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(geometry, material); mesh.name = `breath-flow-${n}`; mesh.renderOrder = 3; mesh.frustumCulled = false; mesh.visible = false; parent.add(mesh);
      return { mesh, water, sun, flow };
    });
  }
  append(code: string, point: Point3, at: number) { this.path.append(code, point, at); }
  setLow(low: boolean) { this.low = low; this.path.setLow(low); }
  clear() { this.path.clear(); this.active = 0; this.ribbons.forEach(ribbon => { ribbon.mesh.visible = false; }); }
  update(delta: number, now: number, mix: number, energy: number, disabled: boolean) {
    if (disabled) { this.clear(); return false; }
    this.path.update(now, delta); this.active = 0;
    this.ribbons.forEach((ribbon, index) => {
      const chain = index === 0 ? this.path.current : this.path.retiring;
      ribbon.mesh.visible = chain.points.length > 1;
      if (!ribbon.mesh.visible) return;
      this.active++;
      this.write(ribbon, chain, now, energy);
      const u = ribbon.mesh.material.uniforms; u.uNow.value = now / 1000; u.uLife.value = this.path.life / 1000; u.uMix.value = mix;
    });
    return this.active > 0;
  }
  private write(ribbon: Ribbon, chain: TrailChain, now: number, energy: number) {
    const steps = this.low ? 8 : STEPS;
    for (let segment = 0; segment < chain.points.length - 1; segment++) {
      const a = chain.points[segment], b = chain.points[segment + 1];
      for (let i = 0; i <= STEPS; i++) {
        if (this.low && i % 2 === 1) {
          const row = (segment * (STEPS + 1) + i) * (LANES + 1);
          for (const buffer of [ribbon.water, ribbon.sun]) buffer.copyWithin(row * 3, (row - LANES - 1) * 3, row * 3);
          ribbon.flow.copyWithin(row * 2, (row - LANES - 1) * 2, row * 2);
          continue;
        }
        const t = Math.min(Math.floor(i * steps / STEPS) / steps, Math.max(0, Math.min(1, (chain.head - a.s) / (b.s - a.s))));
        const s = a.s + (b.s - a.s) * t;
        const taper = Math.sqrt(Math.max(0, Math.min(1, (s - chain.points[0].s) / .65, (chain.head - s) / .48)));
        const age = now - (a.at + (b.at - a.at) * t);
        const width = (.44 + energy * .09) * taper * (1 - Math.min(1, age / this.path.life) * .35);
        for (const sun of [false, true]) {
          trailPoint(chain, segment, t, now, sun, this.p);
          trailPoint(chain, segment, Math.max(0, t - .002), now, sun, this.before);
          trailPoint(chain, segment, Math.min(1, t + .002), now, sun, this.after);
          const dx = this.after.x - this.before.x, dz = this.after.z - this.before.z, length = Math.hypot(dx, dz) || 1;
          const buffer = sun ? ribbon.sun : ribbon.water;
          for (let lane = 0; lane <= LANES; lane++) {
            const side = lane / LANES * 2 - 1, vertex = (segment * (STEPS + 1) + i) * (LANES + 1) + lane;
            const tooth = sun ? Math.max(0, Math.sin(s * 37)) ** 6 * .52 + Math.max(0, Math.sin(s * 21)) ** 5 * .25 : .035 * Math.sin(s * 26);
            const w = width * (sun ? .57 : 1) * side * (1 + tooth * (side > 0 ? 1 : .12));
            buffer[vertex * 3] = this.p.x - dz / length * w;
            buffer[vertex * 3 + 1] = this.p.y - dx / length * w * .65 + Math.sin(lane / LANES * Math.PI) * .045 * Math.sin(Math.PI * t) ** 2;
            buffer[vertex * 3 + 2] = this.p.z + dx / length * w;
            if (!sun) { ribbon.flow[vertex * 2] = s; ribbon.flow[vertex * 2 + 1] = (a.at + (b.at - a.at) * t) / 1000; }
          }
        }
      }
    }
    for (const name of ['position', 'sunPosition', 'flow']) ribbon.mesh.geometry.getAttribute(name).needsUpdate = true;
    ribbon.mesh.geometry.setDrawRange(0, (chain.points.length - 1) * STEPS * LANES * 6);
  }
  diagnostics() {
    const chain = this.path.current, anchors = chain.points;
    let error = 0;
    for (let segment = 0; segment < anchors.length - 1; segment++) {
      if (anchors[segment].s > chain.head) break;
      const offset = (segment * (STEPS + 1) * (LANES + 1) + LANES / 2) * 3;
      for (const buffer of [this.ribbons[0].water, this.ribbons[0].sun]) error = Math.max(error, Math.hypot(buffer[offset] - anchors[segment].x, buffer[offset + 1] - anchors[segment].y, buffer[offset + 2] - anchors[segment].z));
    }
    return { activeFlows: this.active, pathPoints: anchors.length, pathLength: anchors.length > 1 ? anchors.at(-1)!.s - anchors[0].s : 0, headDistance: chain.head, maxAnchorError: error };
  }
  samples() {
    const count = Math.max(0, this.path.current.points.length - 1) * (STEPS + 1), ribbon = this.ribbons[0];
    const sample = (buffer: Float32Array) => Array.from({ length: count }, (_, row) => {
      const offset = (row * (LANES + 1) + LANES / 2) * 3;
      return [buffer[offset], buffer[offset + 1], buffer[offset + 2]];
    });
    return { anchors: this.path.current.points.map(p => ({ code: p.code, x: p.x, y: p.y, z: p.z })), water: sample(ribbon.water), sun: sample(ribbon.sun) };
  }
}
