import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { puddingSolid } from '../shared/geometry';
import { ParticlePool } from '../shared/ParticlePool';
import { AnimationRuntime } from './AnimationRuntime';
import { RibbonPool } from './RibbonPool';
import { box, cel, celGradient, ellipsoid, part } from './parts';

/** A hinged field Pokédex, mechanical capture capsule and a locally modeled companion. */
export default class Pokemon extends AnimationRuntime {
  private readonly companion = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly ears: THREE.Group[] = [];
  private readonly tail = new THREE.Group();
  private readonly ballLid = new THREE.Group();
  private readonly scanner: THREE.Mesh;
  private readonly display: THREE.MeshBasicMaterial;
  private readonly cheeks: THREE.MeshBasicMaterial;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly sparks: ParticlePool;
  private readonly charge: RibbonPool;
  private energy = 0;
  private looking = 0;
  private ballOpen = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'POKEMON / field companion terminal';
    const gradient = celGradient();
    const red = cel('#b83835', gradient), lightRed = cel('#e5634a', gradient), ivory = cel('#f1e8c9', gradient), charcoal = cel('#303f43', gradient), yellow = cel('#efc344', gradient);
    const black = cel('#293138', gradient), cheek = this.cheeks = new THREE.MeshBasicMaterial({ color: '#d45439' });
    box(this.group, [17.6, .72, 7.05], red, [0, .55, 0], .28);
    box(this.group, [16.85, .18, 6.5], charcoal, [0, .96, 0], .12);
    box(this.group, [3.65, .86, 7.05], lightRed, [-10.7, .58, 0], .3);
    for (const z of [-2.8, 2.8]) { const hinge = part(this.group, new THREE.CylinderGeometry(.25, .25, 1.1, 14), charcoal, -8.78, .88, z); hinge.rotation.x = Math.PI / 2; }
    box(this.group, [2.92, .14, 3.12], charcoal, [-10.7, 1.07, -1.3], .15);
    this.display = new THREE.MeshBasicMaterial({ color: '#749f82' });
    box(this.group, [2.52, .04, 2.7], this.display, [-10.7, 1.16, -1.3], .04);
    this.scanner = box(this.group, [2.4, .012, .045], new THREE.MeshBasicMaterial({ color: '#d2eeb2' }), [-10.7, 1.194, -1.3], 0);
    const pixel = new THREE.BoxGeometry(.16, .018, .16), pixelInk = new THREE.MeshBasicMaterial({ color: '#294d44' });
    const sprite = ['0100010', '0110110', '1111111', '1101011', '1111111', '0111110', '0011100', '0110110'];
    sprite.forEach((row, z) => [...row].forEach((bit, x) => { if (bit === '1') part(this.group, pixel, pixelInk, -11.27 + x * .185, 1.2, -2.02 + z * .185); }));
    const lensRim = part(this.group, new THREE.CylinderGeometry(.33, .33, .12, 24), ivory, -11.65, 1.08, -3.05);
    const lens = part(this.group, new THREE.CylinderGeometry(.24, .24, .15, 24), new THREE.MeshBasicMaterial({ color: '#5db4bc' }), lensRim.position.x, 1.15, -3.05);
    lens.castShadow = false;
    for (let i = 0; i < 3; i++) part(this.group, new THREE.CylinderGeometry(.075, .075, .04, 12), cel(['#f4c955', '#77a871', '#519db0'][i], gradient), -10.88 + i * .28, 1.05, -3.05);
    // An oversized raised cross-control and speaker slits give the annex a device silhouette.
    box(this.group, [.74, .12, .22], charcoal, [-11.7, 1.1, 2.62], .02);
    box(this.group, [.22, .12, .74], charcoal, [-11.7, 1.1, 2.62], .02);
    for (let i = 0; i < 4; i++) box(this.group, [.035, .018, .6], charcoal, [-10.02 + i * .18, 1.035, 2.65], 0);
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .13, .87, .46, .14));
      this.addKey(definition, i, geometries.get(definition.width)!, definition.tone === 'orange' ? yellow : definition.tone === 'gray' ? lightRed : ivory, 1.04, .46, definition.tone === 'gray' ? '#fff0d5' : '#3a4845');
    });
    const dock = new THREE.Group(); dock.position.set(6.55, 1.14, -3.9); this.group.add(dock);
    part(dock, new THREE.CylinderGeometry(.84, 1.02, .28, 24), charcoal, 0, -.05, 0);
    const ball = new THREE.Group(); ball.position.y = .68; dock.add(ball);
    part(ball, new THREE.SphereGeometry(.64, 28, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), ivory);
    ball.add(this.ballLid);
    part(this.ballLid, new THREE.SphereGeometry(.64, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), red);
    const seam = part(ball, new THREE.TorusGeometry(.64, .035, 8, 32), charcoal); seam.rotation.x = Math.PI / 2;
    const button = part(ball, new THREE.CylinderGeometry(.155, .155, .1, 20), charcoal, 0, 0, .63); button.rotation.x = Math.PI / 2;
    const latch = part(ball, new THREE.CylinderGeometry(.09, .09, .12, 20), ivory, 0, 0, .66); latch.rotation.x = Math.PI / 2;

    this.companion.position.set(-10.6, 1.1, 1.1); this.group.add(this.companion);
    ellipsoid(this.companion, .52, [.82, 1.08, .75], yellow, [0, .56, 0]);
    this.head.position.y = 1.15; this.companion.add(this.head);
    ellipsoid(this.head, .51, [1.08, .95, .85], yellow, [0, 0, .08]);
    for (const side of [-1, 1]) {
      const ear = new THREE.Group(); ear.position.set(side * .3, .33, 0); ear.rotation.z = -side * .17; this.head.add(ear); this.ears.push(ear);
      ellipsoid(ear, .2, [.62, 2.12, .52], yellow, [0, .34, 0]);
      ellipsoid(ear, .15, [.57, 1.04, .53], black, [0, .65, 0]);
      const eye = ellipsoid(this.head, .072, [.9, 1.18, .45], black, [side * .19, .075, .467]); this.eyes.push(eye);
      ellipsoid(this.head, .018, [1, 1, 1], ivory, [side * .19 - .01, .102, .493]);
      ellipsoid(this.head, .1, [1, .8, .38], cheek, [side * .37, -.09, .397]);
      ellipsoid(this.companion, .18, [.57, 1.16, .57], yellow, [side * .39, .62, .04]);
      ellipsoid(this.companion, .17, [1, .6, 1.6], yellow, [side * .22, .12, .2]);
    }
    ellipsoid(this.head, .027, [1, .6, 1], black, [0, -.025, .51]);
    this.tail.position.set(.25, .48, -.23); this.companion.add(this.tail);
    const bolt = new THREE.Shape(); bolt.moveTo(0, 0); bolt.lineTo(.28, .35); bolt.lineTo(.14, .44); bolt.lineTo(.63, .97); bolt.lineTo(.98, .72); bolt.lineTo(.55, .36); bolt.lineTo(.64, .22); bolt.lineTo(.17, -.04); bolt.closePath();
    part(this.tail, new THREE.ExtrudeGeometry(bolt, { depth: .09, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 1 }), yellow);
    this.sparks = new ParticlePool(this.group, context.quality.particles, new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#f7d878' }), -.9, 1.6);
    this.charge = new RibbonPool(this.group, 2);
    this.bounds.set(new THREE.Vector3(-12.7, 0, -5.1), new THREE.Vector3(9.1, 4.35, 3.95));
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    this.energy = Math.min(1, this.energy + .35); this.looking = Math.atan2(key.x + 10.6, key.z - 1.1) * .38;
    if (this.signature.start(key.definition.code, reduced) && this.signature.kind === 'space') {
      this.charge.emit({ x: -11.05, y: 2.7, z: 1.5 }, { x: -9.25, y: 2.3, z: .75 }, '#ecc34a', .06, .42, .75, true, .3);
      this.charge.emit({ x: -10.9, y: 2, z: .8 }, { x: -9.2, y: 2.6, z: 1.1 }, '#f4e5a8', .055, .32, .85, true, -.4);
      this.sparks.burst(-10.5, 2.3, 1.1, 12, 1, .75, .045);
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    this.energy *= Math.exp(-7 * delta);
    const hero = this.signature.envelope, entered = this.signature.kind === 'enter';
    this.ballOpen = reduced ? 0 : entered ? hero : 0;
    this.ballLid.rotation.x = -this.ballOpen * 1.05; this.ballLid.position.set(0, this.ballOpen * .28, -this.ballOpen * .23);
    this.companion.position.y = 1.1 + (reduced ? 0 : Math.sin(this.time * 2) * .018 + this.energy * .16 + hero * (entered ? .32 : .06));
    this.companion.scale.y = 1 + (reduced ? 0 : Math.sin(this.time * 2) * .012 - this.energy * .07);
    this.head.rotation.y = reduced ? 0 : this.head.rotation.y + (this.looking - this.head.rotation.y) * (1 - Math.exp(-7 * delta));
    this.head.rotation.z = reduced ? 0 : this.energy * .08;
    this.ears.forEach((ear, i) => { ear.rotation.z = (i ? -1 : 1) * (.17 + (reduced ? 0 : Math.sin(this.time * 3 + i) * .025 + this.energy * .35 - hero * .14)); });
    this.tail.rotation.y = reduced ? 0 : Math.sin(this.time * 12) * this.energy * .5 + Math.sin(this.time * 2) * .03;
    this.eyes.forEach(eye => { eye.scale.y = !reduced && this.time % 5.8 > 5.64 ? .15 : 1.18; });
    this.cheeks.color.setRGB(.67 + this.energy * .2 + hero * .12, .18 + hero * .25, .1);
    this.display.color.setRGB(.23 + this.energy * .13, .45 + this.energy * .22, .32 + this.energy * .12);
    this.scanner.position.z = -2.54 + (reduced ? .5 : (this.time * .19 + this.energy * .2) % 1) * 2.45;
    const sparks = this.sparks.update(delta), charge = this.charge.update(delta, reduced);
    return !reduced || this.energy > .002 || sparks || charge;
  }
  protected override clear() { this.energy = 0; this.looking = 0; this.ballOpen = 0; this.sparks.clear(); this.charge.clear(); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.sparks.setLimit(quality.particles); }
  override diagnostics() { return { ...super.diagnostics(), particles: this.sparks.active, waves: this.charge.active, mechanism: { companionEnergy: this.energy, companionY: this.companion.position.y, companionLook: this.head.rotation.y, ballOpen: this.ballOpen, scanZ: this.scanner.position.z } }; }
}
