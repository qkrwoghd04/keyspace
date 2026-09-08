import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { fracturedSolid } from '../shared/geometry';
import { surfaceMaterial } from '../shared/material';
import { AnimationRuntime } from './AnimationRuntime';
import { Actuator, actuatorPose } from './Actuator';
import { box, easeWindow, part, rod } from './parts';

export default class Evangelion extends AnimationRuntime {
  private readonly modules: { state: Actuator; plate: THREE.Group; piston: THREE.Mesh; latch: THREE.Group; pose: ReturnType<typeof actuatorPose> }[] = [];
  private readonly doors: THREE.Group[] = [];
  private readonly indicators: THREE.MeshBasicMaterial[] = [];
  private bayOpen = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'EVANGELION / armored launch gantry';
    this.stiffness = 850; this.damping = 43;
    const shell = new THREE.MeshStandardMaterial({ color: '#62507f', roughness: .52, metalness: .52 });
    const inset = new THREE.MeshStandardMaterial({ color: '#242d31', roughness: .67, metalness: .4 });
    const steel = new THREE.MeshStandardMaterial({ color: '#859495', roughness: .27, metalness: .83 });
    const lime = new THREE.MeshStandardMaterial({ color: '#9cab52', roughness: .5, metalness: .34 });
    const warning = surfaceMaterial({ color: '#aa9b55', roughness: .68, metalness: .18 }, 'hangar-caution',
      'float stripe=step(.5,fract((vKsPosition.x+vKsPosition.y)*2.8)); diffuseColor.rgb*=mix(.12,1.,stripe);');
    box(this.group, [19.5, .31, 8.4], inset, [0, .25, 0], .12);
    box(this.group, [17, .4, 6.62], steel, [0, .61, 0], .08);
    box(this.group, [16.8, .21, 6.5], inset, [0, .89, 0], .04);
    for (const side of [-1, 1]) {
      box(this.group, [1.15, 1.1, 7.4], shell, [side * 9.02, .89, -.14], .14);
      box(this.group, [.15, .16, 7.65], lime, [side * 9.59, 1.21, -.14], .025);
      box(this.group, [1.03, 3.15, .92], shell, [side * 8.75, 1.97, -3.82], .12);
      box(this.group, [.24, 2.65, .1], lime, [side * 8.75, 2.15, -3.28], .01);
      rod(this.group, new THREE.Vector3(side * 9.16, .55, -2.96), new THREE.Vector3(side * 7.58, 3.6, -3.74), .16, steel);
      const door = new THREE.Group(); door.position.set(side * 4.16, 2.7, -4.14); this.group.add(door); this.doors.push(door);
      box(door, [8.12, 1.27, .29], inset, [0, 0, 0], .04);
      box(door, [7.75, .84, .1], shell, [0, -.05, .2], .03);
      box(door, [7.86, .14, .1], warning, [0, -.56, .27], 0);
      for (let i = 0; i < 4; i++) box(door, [.09, .93, .08], lime, [-3.22 + i * 2.1, -.01, .28], .01);
    }
    box(this.group, [19.12, .48, 1.05], shell, [0, 3.63, -3.91], .07);
    box(this.group, [17.35, .1, .14], lime, [0, 3.7, -3.31], .02);
    for (let i = 0; i < 6; i++) {
      const indicator = new THREE.MeshBasicMaterial({ color: '#718649' }); this.indicators.push(indicator);
      box(this.group, [.24, .12, .08], indicator, [-.92 + i * .37, 3.6, -3.34], .015);
    }
    for (const x of [-6.18, -2.06, 2.06, 6.18]) {
      const plate = new THREE.Group(); plate.position.set(x, .92, 3.58); this.group.add(plate);
      box(plate, [3.77, .82, .24], shell, [0, 0, .28], .085);
      box(plate, [3.51, .13, .08], warning, [0, -.25, .44], 0);
      box(plate, [.23, .58, .05], lime, [-1.53, .015, .44], .02);
      const sleeve = part(this.group, new THREE.CylinderGeometry(.145, .145, .49, 12), inset, x, .64, 4.12);
      sleeve.castShadow = true;
      const piston = part(this.group, new THREE.CylinderGeometry(.066, .066, .52, 12), steel, x, .91, 4.12);
      part(this.group, new THREE.CylinderGeometry(.17, .17, .09, 12), steel, x, .84, 4.12);
      const latch = new THREE.Group(); latch.position.set(x + 1.24, 1.19, 4.12); this.group.add(latch);
      box(latch, [.49, .13, .18], lime, [0, 0, 0], .025);
      box(latch, [.12, .28, .18], inset, [.18, -.11, 0], .02);
      this.modules.push({ state: new Actuator(), plate, piston, latch, pose: actuatorPose(Infinity) });
    }
    const geometries = new Map<number, THREE.BufferGeometry>();
    const caps = [new THREE.MeshStandardMaterial({ color: '#b6b9ad', roughness: .64, metalness: .12 }), new THREE.MeshStandardMaterial({ color: '#504665', roughness: .58, metalness: .34 }), lime];
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, fracturedSolid(definition.width - .11, .9, .39, 733, .01, 12, .17));
      this.addKey(definition, i, geometries.get(definition.width)!, caps[definition.tone === 'orange' ? 2 : definition.tone === 'gray' ? 1 : 0], 1.08, .39, definition.tone === 'gray' ? '#d4d7bd' : '#3b4641');
    });
    this.bounds.set(new THREE.Vector3(-10.6, 0, -4.85), new THREE.Vector3(10.6, 4.2, 4.5));
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    if (this.signature.start(key.definition.code, reduced)) this.modules.forEach(module => module.state.reset());
    if (!reduced && !this.signature.active) this.modules[Math.min(3, Math.max(0, Math.floor((key.x + 8.2) / 4.1)))].state.start();
  }
  protected override tick(delta: number, reduced: boolean) {
    const p = this.signature.progress, launch = this.signature.kind === 'enter';
    this.bayOpen = !reduced && this.signature.active && launch ? easeWindow(p, .21, .46) * (1 - easeWindow(p, .72, .98)) : 0;
    this.doors.forEach((door, i) => { door.position.x = (i ? 1 : -1) * (4.16 + this.bayOpen * 1.27); });
    this.modules.forEach((module, i) => {
      module.state.update(delta);
      const age = this.signature.active ? p * 1.15 - (launch ? i * .08 : 0) : module.state.age;
      module.pose = actuatorPose(reduced ? Infinity : age);
      const { latch, piston, armor } = module.pose;
      module.latch.rotation.z = -latch * .83;
      module.piston.position.y = .91 + piston * .22;
      module.plate.position.y = .92 + armor * .13;
      module.plate.position.z = 3.58 + armor * .24;
      module.plate.rotation.x = -armor * .34;
    });
    this.indicators.forEach((material, i) => {
      const lit = this.signature.active ? i <= Math.floor(p * 6) : reduced ? i === 0 : i === Math.floor(this.time * .7) % 6;
      material.color.set(lit ? this.signature.active && !launch ? '#e7a45a' : '#b8d478' : '#43513b');
    });
    return !reduced || this.modules.some(module => module.state.active);
  }
  protected override clear() { this.modules.forEach(module => module.state.reset()); this.bayOpen = 0; }
  override diagnostics() {
    return { ...super.diagnostics(), mechanism: { bayOpen: this.bayOpen, activeModules: this.modules.filter(module => module.state.active).length, latch: Math.max(...this.modules.map(module => module.pose.latch)), piston: Math.max(...this.modules.map(module => module.pose.piston)), armor: Math.max(...this.modules.map(module => module.pose.armor)), interlock: 'latch → piston → armor' } };
  }
}
