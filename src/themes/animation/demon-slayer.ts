import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { EffectIntensity, JudgmentEvent } from '../../challenge/types';
import type { KeyboardInput } from '../../input/KeyboardInput';
import type { KeyBody } from '../shared/BaseRuntime';
import { curvedTube, fracturedSolid } from '../shared/geometry';
import { surfaceMaterial } from '../shared/material';
import { AnimationRuntime } from './AnimationRuntime';
import { BreathEffects } from '../demon-slayer/BreathEffects';
import { box, part } from './parts';

/** Lacquer, ceramic and a structural sword rail, drawn through with water-breathing arcs. */
export default class DemonSlayer extends AnimationRuntime {
  private readonly flow = { value: 0 };
  readonly nativeChallengeEffects = true;
  private readonly breathing: BreathEffects;
  private readonly relief: THREE.Mesh[] = [];
  private softwareSequence = 0;

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'TANJIRO / flow into flame';
    const lacquer = surfaceMaterial({ color: '#173e42', roughness: .34, clearcoat: .5, metalness: .12 }, 'slayer-restrained-lacquer',
      'float tile=mod(floor(vKsPosition.x*2.)+floor(vKsPosition.z*2.)+floor(vKsPosition.y*2.),2.); diffuseColor.rgb*=mix(.88,1.04,tile);');
    const black = new THREE.MeshStandardMaterial({ color: '#172c34', roughness: .52, metalness: .18 });
    const brass = new THREE.MeshStandardMaterial({ color: '#ba9b58', roughness: .36, metalness: .7 });
    const ceramic = [new THREE.MeshStandardMaterial({ color: '#e0eced', roughness: .61 }), new THREE.MeshStandardMaterial({ color: '#3998a0', roughness: .64 }), new THREE.MeshStandardMaterial({ color: '#294953', roughness: .48 })];
    box(this.group, [17.7, .67, 7.22], lacquer, [0, .44, 0], .19);
    box(this.group, [16.8, .14, 6.58], black, [0, .83, 0], .08);
    for (const z of [-3.35, 3.35]) box(this.group, [17.25, .065, .09], brass, [0, .72, z]);
    const water = surfaceMaterial({ color: '#316c78', roughness: .28, metalness: .25, emissive: '#123d42', emissiveIntensity: .15 }, 'slayer-carved-wave',
      'float line=sin(vKsPosition.x*3.-uFlow*1.1+vKsPosition.y*5.); diffuseColor.rgb*=.85+line*.12;', { uFlow: this.flow }, 'uniform float uFlow;');
    for (let layer = 0; layer < 2; layer++) {
      const points = Array.from({ length: 21 }, (_, i) => new THREE.Vector3(-8.8 + i * .88, .31 + layer * .13 + Math.sin(i * .72 + layer) * .1, 3.7 + layer * .08));
      this.relief.push(part(this.group, curvedTube(points, .11), water));
    }
    // The sword rail is geometry, with a wrapped hilt and a metal guard, not a logo.
    const steel = new THREE.MeshStandardMaterial({ color: '#b5d4ce', roughness: .18, metalness: .9 });
    const blade = new THREE.Shape(); blade.moveTo(-6.8, -.12); blade.lineTo(7.65, -.06); blade.lineTo(8.5, .13); blade.lineTo(7.25, .25); blade.lineTo(-6.8, .14); blade.closePath();
    const edge = part(this.group, new THREE.ExtrudeGeometry(blade, { depth: .055, bevelEnabled: false }), steel, 0, 1.05, -3.78);
    edge.rotation.x = -Math.PI / 2;
    const handle = part(this.group, new THREE.CylinderGeometry(.19, .19, 2.45, 16), lacquer, -8, 1.04, -3.8); handle.rotation.z = Math.PI / 2;
    const guard = part(this.group, new THREE.TorusGeometry(.38, .065, 8, 24), brass, -6.75, 1.04, -3.8); guard.rotation.y = Math.PI / 2;
    for (const x of [-9.2, -6.82]) { const band = part(this.group, new THREE.CylinderGeometry(.21, .21, .13, 16), brass, x, 1.04, -3.8); band.rotation.z = Math.PI / 2; }
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, fracturedSolid(definition.width - .11, .9, .42, 33, .015, 20, .25));
      const dark = definition.tone === 'gray';
      this.addKey(definition, i, geometries.get(definition.width)!, ceramic[definition.tone === 'orange' ? 1 : dark ? 2 : 0], .94, .42, dark ? '#e4f1f0' : '#304b55');
    });
    this.breathing = new BreathEffects(this.group, context.breath);
    this.breathing.setQuality(context.quality);
    this.bounds.set(new THREE.Vector3(-10.5, 0, -5.8), new THREE.Vector3(10.5, 3.9, 5.8));
  }
  protected override onStrike(key: KeyBody, reduced: boolean, atMs?: number) {
    const point = { x: key.x, y: key.restY + .53, z: key.z };
    this.breathing.strike(key.definition.code, point, reduced, atMs);
    // Enter/Space retain their bounded gesture contract without a screen-wide splash.
    this.signature.start(key.definition.code, reduced);
  }
  protected override tick(delta: number, reduced: boolean) {
    this.flow.value = this.time;
    this.relief.forEach((mesh, i) => { mesh.position.y = reduced ? 0 : Math.sin(this.time * 1.3 + i) * .018; });
    return this.breathing.update(delta, reduced) || !reduced;
  }
  override onChallengeEvent(event: JudgmentEvent) {
    if (event.type === 'finished') {
      // Completion is an accent, not a physical Enter edge in the input trail.
      const key = this.keys.find(key => key.definition.code === 'Enter');
      if (key) this.breathing.strike('SoftwareCommit', { x: key.x, y: key.restY + .53, z: key.z }, false);
      this.signature.reset(); this.signature.allowed = true; this.signature.start('Enter', false);
      this.signature.allowed = !this.challengeActive;
      return;
    }
    if (event.type === 'correct' && !event.code) {
      const key = this.keys.find(key => key.definition.code === 'Space');
      if (key) this.breathing.strike('SoftwareCommit', { x: key.x, y: key.restY + .53, z: key.z }, false);
      return;
    }
    super.onChallengeEvent(event);
  }
  override update(delta: number, input: KeyboardInput, reduced: boolean) {
    const sequence = this.context.breath?.softwareSequence ?? 0;
    if (sequence !== this.softwareSequence && !this.challengeActive) {
      const key = this.keys.find(key => key.definition.code === 'Space');
      if (key) this.breathing.strike('SoftwareCommit', { x: key.x, y: key.restY + .53, z: key.z }, reduced);
    }
    this.softwareSequence = sequence;
    return super.update(delta, input, reduced);
  }
  override reset(input: KeyboardInput) { this.softwareSequence = this.context.breath?.softwareSequence ?? 0; super.reset(input); }
  setEffectIntensity(value: EffectIntensity) { this.breathing.setIntensity(value); }
  protected override clear() { this.breathing.clear(); }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.breathing.setQuality(quality); }
  override diagnostics() { return { ...super.diagnostics(), ...this.breathing.diagnostics() }; }
}
