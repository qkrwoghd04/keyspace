import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { puddingSolid } from '../shared/geometry';
import { ParticlePool } from '../shared/ParticlePool';
import { AnimationRuntime } from './AnimationRuntime';
import { box, ellipsoid, gearGeometry, painted, part } from './parts';

/** The keyboard is a walking boiler-house: gears, shutters, stacks and legs have real joints. */
export default class Howl extends AnimationRuntime {
  private readonly gears: THREE.Mesh[] = [];
  private readonly gearEnergy = new Float32Array(8);
  private readonly windows: { material: THREE.MeshStandardMaterial; shutters: THREE.Group[]; heat: number }[] = [];
  private readonly stacks: THREE.Group[] = [];
  private readonly legs: { upper: THREE.Group; knee: THREE.Group; energy: number }[] = [];
  private readonly fire: THREE.Mesh;
  private readonly smoke: ParticlePool;
  private nextSmoke = 0;
  private steam = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'HOWL / walking boiler-house';
    const iron = painted('#4b6263'), copper = painted('#9e674a'), wood = painted('#79604b', true), plaster = painted('#b8b09a'), roof = painted('#6d7771');
    const brass = new THREE.MeshStandardMaterial({ color: '#ad8b4a', roughness: .54, metalness: .6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#293b39', roughness: .9 });
    box(this.group, [17.6, .91, 7.1], iron, [0, 1.38, 0], .35);
    ellipsoid(this.group, 1, [7.7, .55, 3.04], copper, [0, 1.17, 0]);
    box(this.group, [16.9, .13, 6.42], dark, [0, 1.89, 0], .09);
    for (let i = 0; i < 6; i++) {
      const patch = box(this.group, [2.65, .58, .06], i % 2 ? copper : wood, [-7.05 + i * 2.8, 1.41, 3.49], .025);
      patch.rotation.z = (i % 3 - 1) * .032;
    }
    const rivetGeometry = new THREE.SphereGeometry(.041, 7, 5);
    const rivets = new THREE.InstancedMesh(rivetGeometry, brass, 48), matrix = new THREE.Matrix4();
    for (let i = 0; i < 48; i++) { matrix.makeTranslation(-8.15 + (i % 24) * .705, i < 24 ? 1.67 : 1.12, 3.54); rivets.setMatrixAt(i, matrix); } this.group.add(rivets);
    const gearSizes = [.59, .38, .51, .37, .67, .4, .52, .32];
    for (let i = 0; i < gearSizes.length; i++) {
      const gear = part(this.group, gearGeometry(gearSizes[i], i % 2 ? 11 : 15), i % 2 ? iron : brass, -7.45 + i * 2.13, i % 2 ? 1.19 : 1.4, 3.62);
      this.gears.push(gear);
      const axle = part(this.group, new THREE.CylinderGeometry(.09, .09, .25, 10), dark, gear.position.x, gear.position.y, 3.66); axle.rotation.x = Math.PI / 2;
    }
    const houseLocations = [{ x: -5.7, h: 1.17, w: 2.3 }, { x: -1.7, h: 1.8, w: 2.9 }, { x: 3.0, h: 1.28, w: 2.2 }];
    houseLocations.forEach(({ x, h, w }, i) => {
      const home = new THREE.Group(); home.position.set(x, 1.55, -3.78); home.rotation.z = (i - 1) * .045; this.group.add(home);
      box(home, [w, h, 1.35], i === 1 ? plaster : wood, [0, h / 2, 0], .04);
      for (const side of [-1, 1]) box(home, [.075, h + .04, .12], copper, [side * w * .43, h / 2, .72]);
      const roofShape = new THREE.Shape(); roofShape.moveTo(-w * .58, 0); roofShape.lineTo(.07, .67); roofShape.lineTo(w * .58, 0); roofShape.closePath();
      const roofMesh = part(home, new THREE.ExtrudeGeometry(roofShape, { depth: 1.72, bevelEnabled: false }), roof, 0, h, -.86);
      roofMesh.rotation.y = .02 * (i - 1);
      for (let row = 0; row < 3; row++) for (const side of [-1, 1]) {
        const slat = box(home, [w * .5, .025, 1.76], copper, [side * w * .25, h + .5 - row * .19, 0], 0);
        slat.rotation.z = -side * .46;
      }
      const pane = new THREE.MeshStandardMaterial({ color: '#c59b55', emissive: '#d78b35', emissiveIntensity: .45, roughness: .5 });
      box(home, [.68, .74, .055], dark, [0, h * .5, .705], .025);
      box(home, [.5, .56, .07], pane, [0, h * .5, .74], .015);
      box(home, [.045, .6, .025], brass, [0, h * .5, .79], 0);
      box(home, [.53, .045, .025], brass, [0, h * .5, .79], 0);
      const shutters: THREE.Group[] = [];
      for (const side of [-1, 1]) {
        const shutter = new THREE.Group(); shutter.position.set(side * .38, h * .5, .75); home.add(shutter);
        box(shutter, [.3, .73, .07], wood, [-side * .15, 0, 0], .018);
        for (let slat = 0; slat < 4; slat++) box(shutter, [.3, .035, .025], copper, [-side * .15, -.22 + slat * .15, .052], 0);
        shutters.push(shutter);
      }
      this.windows.push({ material: pane, shutters, heat: 0 });
    });
    for (let i = 0; i < 3; i++) {
      const stack = new THREE.Group(); stack.position.set([-7.65, .6, 6.0][i], [2.9, 3.6, 2.7][i], -3.83); stack.rotation.z = [.07, -.1, .14][i]; this.group.add(stack); this.stacks.push(stack);
      const lowerLength = stack.position.y - 1.4;
      part(stack, new THREE.CylinderGeometry(.26, .38, lowerLength, 12), i % 2 ? iron : copper, 0, -lowerLength / 2, 0);
      part(stack, new THREE.CylinderGeometry(.42, .42, .18, 12), brass, 0, -lowerLength, 0);
      part(stack, new THREE.CylinderGeometry(.24, .32, 1.1, 12), i % 2 ? iron : copper, 0, .15, 0);
      for (const y of [-.22, .55]) part(stack, new THREE.CylinderGeometry(.33, .33, .13, 12), brass, 0, y, 0);
      part(stack, new THREE.ConeGeometry(.45, .19, 12), iron, 0, .84, 0);
      part(stack, new THREE.CylinderGeometry(.15, .15, .18, 12), dark, 0, .69, 0);
    }
    for (const x of [-6.7, 6.7]) for (const z of [-2.5, 3.2]) {
      const upper = new THREE.Group(); upper.position.set(x, 1.08, z); this.group.add(upper);
      ellipsoid(upper, .22, [1, 1, 1], brass, [0, 0, 0]);
      part(upper, new THREE.CylinderGeometry(.11, .15, .52, 10), iron, 0, -.27, 0);
      const knee = new THREE.Group(); knee.position.y = -.49; upper.add(knee);
      ellipsoid(knee, .17, [1, 1, 1], copper, [0, 0, 0]);
      part(knee, new THREE.CylinderGeometry(.09, .12, .43, 10), brass, .04, -.2, 0);
      box(knee, [.66, .15, .92], dark, [.05, -.41, .15], .05);
      this.legs.push({ upper, knee, energy: 0 });
    }
    // A warm furnace face is part of the boiler, constructed entirely from geometry.
    box(this.group, [1.27, .71, .18], dark, [0, 1.42, 3.64], .15);
    this.fire = ellipsoid(this.group, .32, [1.1, 1.1, .2], new THREE.MeshBasicMaterial({ color: '#df863f' }), [0, 1.42, 3.76]);
    for (const x of [-.1, .1]) ellipsoid(this.group, .046, [1, 1.2, .45], new THREE.MeshBasicMaterial({ color: '#f3e5b7' }), [x, 1.49, 3.84]);
    const caps = [painted('#d7ceb5'), painted('#846c56', true), painted('#a97145')], geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .15, .84, .37, .16));
      this.addKey(definition, i, geometries.get(definition.width)!, caps[definition.tone === 'orange' ? 2 : definition.tone === 'gray' ? 1 : 0], 1.99, .37, definition.tone === 'gray' ? '#edddba' : '#514c3c');
    });
    this.smoke = new ParticlePool(this.group, context.quality.particles, new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#b8c2b6', transparent: true, opacity: .18, depthWrite: false }), .23, .8);
    this.bounds.set(new THREE.Vector3(-9.1, -.04, -4.9), new THREE.Vector3(9.1, 5.35, 4.1));
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    const zone = Math.min(7, Math.max(0, Math.floor((key.x + 8.2) / 2.05)));
    this.gearEnergy[zone] = 1;
    this.windows[zone % this.windows.length].heat = 1;
    this.legs[zone % this.legs.length].energy = 1;
    this.steam = Math.min(1, this.steam + .25);
    if (this.signature.start(key.definition.code, reduced)) {
      this.gearEnergy.fill(1); this.windows.forEach(window => { window.heat = 1; });
      this.stacks.forEach(stack => this.smoke.burst(stack.position.x, stack.position.y + .85, stack.position.z, 4, .45, .2, .18));
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    this.steam *= Math.exp(-5 * delta);
    const hero = this.signature.envelope, walk = this.signature.kind === 'enter' ? hero : 0;
    this.gears.forEach((gear, i) => {
      this.gearEnergy[i] *= Math.exp(-6 * delta);
      if (!reduced) gear.rotation.z = (gear.rotation.z + delta * (i % 2 ? -1 : 1) * (.06 + this.gearEnergy[i] * 3.2 + hero * 1.6)) % (Math.PI * 2);
    });
    this.windows.forEach((window, i) => {
      window.heat *= Math.exp(-4.5 * delta);
      window.material.emissiveIntensity = .38 + window.heat * .9 + hero * .7;
      window.shutters.forEach((shutter, side) => { shutter.rotation.y = (side ? -1 : 1) * (.27 + (reduced ? 0 : window.heat * .75 + hero * .55 + Math.sin(this.time * .8 + i) * .015)); });
    });
    this.stacks.forEach((stack, i) => { stack.rotation.z = [.07, -.1, .14][i] + (reduced ? 0 : Math.sin(this.time * 8 + i) * this.steam * .035 + Math.sin(this.time * 4 + i) * hero * .06); });
    this.legs.forEach((leg, i) => {
      leg.energy *= Math.exp(-6 * delta);
      const phase = this.time * 9 + (i % 2) * Math.PI;
      leg.upper.rotation.x = reduced ? 0 : Math.sin(this.time * .8 + i) * .018 + Math.sin(phase) * (leg.energy * .06 + walk * .23);
      leg.knee.rotation.x = reduced ? 0 : Math.max(0, Math.cos(phase)) * (walk * .34 + leg.energy * .065);
    });
    this.fire.scale.y = 1.1 + (reduced ? 0 : Math.sin(this.time * 5) * .055 + this.steam * .2 + hero * .22);
    if (!reduced && this.time > this.nextSmoke) {
      const stack = this.stacks[Math.floor(this.time) % this.stacks.length];
      this.smoke.burst(stack.position.x, stack.position.y + .85, stack.position.z, 1, .25, .08, .15);
      this.nextSmoke = this.time + .95;
    }
    const smoke = this.smoke.update(delta);
    return !reduced || this.steam > .002 || this.windows.some(window => window.heat > .002) || smoke;
  }
  protected override clear() { this.gearEnergy.fill(0); this.steam = 0; this.windows.forEach(window => { window.heat = 0; }); this.legs.forEach(leg => { leg.energy = 0; }); this.smoke.clear(); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.smoke.setLimit(quality.particles); }
  override diagnostics() { return { ...super.diagnostics(), particles: this.smoke.active, mechanism: { gearAngle: this.gears[0].rotation.z, gearEnergy: Math.max(...this.gearEnergy), windowHeat: Math.max(...this.windows.map(window => window.heat)), chimneyTilt: this.stacks[0].rotation.z, legAngle: this.legs[0].upper.rotation.x, legEnergy: Math.max(...this.legs.map(leg => leg.energy)), steam: this.steam } }; }
}
