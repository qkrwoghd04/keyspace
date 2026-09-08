import * as THREE from 'three';
import { BOARD_WIDTH, type KeyDefinition } from '../../keyboard/layout';
import { legendGeometry } from '../../keyboard/legends';
import { disposeObject } from '../../keyboard/KeyboardModel';
import type { KeyboardInput } from '../../input/KeyboardInput';
import type { QualitySettings, ThemeContext, ThemeDiagnostics, ThemeRuntime } from '../types';
import { KeyState } from './KeyState';
import type { JudgmentEvent } from '../../challenge/types';

export interface KeyBody {
  definition: KeyDefinition;
  index: number;
  group: THREE.Group;
  mesh: THREE.Mesh;
  state: KeyState;
  x: number;
  z: number;
  restY: number;
}

/** Shared layout and gesture sampling, not shared art direction. */
export abstract class BaseRuntime implements ThemeRuntime {
  readonly group = new THREE.Group();
  readonly hitTargets: THREE.Mesh[] = [];
  readonly bounds = new THREE.Box3();
  protected readonly keys: KeyBody[] = [];
  protected quality: QualitySettings;
  protected time = 0;
  protected stiffness = 760;
  protected damping = 39;
  protected challengeActive = false;
  protected rewardTier = 0;
  protected rewardPulse = 0;
  protected rewardOrigin: { x: number; z: number } | null = null;
  private disposed = false;
  private readonly legends = new Map<string, THREE.MeshStandardMaterial>();

  constructor(protected readonly context: ThemeContext) { this.quality = context.quality; }

  protected addKey(definition: KeyDefinition, index: number, geometry: THREE.BufferGeometry, material: THREE.Material, restY: number, top: number, ink: string, dome: number | ((x: number, z: number) => number) = 0): KeyBody {
    const group = new THREE.Group();
    const x = definition.x + definition.width / 2 - BOARD_WIDTH / 2;
    const z = definition.z - 2.625;
    group.position.set(x, restY, z);
    group.name = definition.code;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.code = definition.code;
    group.add(mesh);
    let legendMaterial = this.legends.get(ink);
    if (!legendMaterial) {
      legendMaterial = new THREE.MeshStandardMaterial({ map: this.context.legendTexture, color: ink, roughness: .85, metalness: 0, transparent: true, alphaTest: .08, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
      this.legends.set(ink, legendMaterial);
    }
    const geometryLegend = legendGeometry(definition, index, 8);
    const position = geometryLegend.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i), z = position.getZ(i);
      const y = typeof dome === 'function' ? dome(x, z) : top - dome * ((x / definition.width) ** 2 + (z / .46) ** 2);
      position.setXYZ(i, x, y + .008, z);
    }
    geometryLegend.computeVertexNormals();
    const legend = new THREE.Mesh(geometryLegend, legendMaterial);
    legend.renderOrder = 2;
    group.add(legend);
    this.group.add(group);
    this.hitTargets.push(mesh);
    const key = { definition, index, group, mesh, state: new KeyState(definition.code), x, z, restY };
    this.keys.push(key);
    return key;
  }

  protected pose(key: KeyBody, reduced: boolean) {
    key.group.position.y = key.restY - key.state.displacement * (reduced ? .09 : .2);
  }
  protected onPress(_key: KeyBody, _reduced: boolean): void {}
  protected onRelease(_key: KeyBody, _reduced: boolean): void {}
  protected tick(_delta: number, _reduced: boolean): boolean { return false; }
  protected clear(): void {}
  setChallengeActive(active: boolean) {
    if (active === this.challengeActive) return;
    this.challengeActive = active; this.rewardTier = this.rewardPulse = 0; this.rewardOrigin = null; this.clear();
  }
  onChallengeEvent(event: JudgmentEvent) {
    if (event.type === 'correct') {
      this.rewardTier = event.tier; this.rewardPulse = 1;
      const key = this.keys.find(key => key.definition.code === event.code);
      if (key) { this.rewardOrigin = { x: key.x, z: key.z }; this.onPress(key, false); }
    } else if (event.type === 'combo') this.rewardTier = event.tier;
    else if (event.type === 'error' || event.type === 'reset') { this.rewardTier = this.rewardPulse = 0; this.rewardOrigin = null; if (event.type === 'reset') this.clear(); }
  }
  protected rewardAt(key: KeyBody) {
    if (!this.rewardOrigin) return 0;
    const distance = Math.hypot(key.x - this.rewardOrigin.x, key.z - this.rewardOrigin.z);
    return this.rewardPulse * this.rewardTier * .2 * Math.max(0, 1 - distance / 3.5);
  }

  update(delta: number, input: KeyboardInput, reduced: boolean) {
    if (!reduced) this.time += delta;
    this.rewardPulse = reduced ? 0 : this.rewardPulse * Math.exp(-4.5 * delta);
    let moving = false;
    for (const key of this.keys) {
      moving = key.state.update(delta, input, reduced, this.stiffness, this.damping) || moving;
      if (key.state.fresh && !this.challengeActive) this.onPress(key, reduced);
      if (key.state.released && !this.challengeActive) this.onRelease(key, reduced);
      this.pose(key, reduced);
    }
    return this.tick(delta, reduced) || moving || this.rewardPulse > .002;
  }

  reset(input: KeyboardInput) {
    this.rewardTier = this.rewardPulse = 0; this.rewardOrigin = null;
    for (const key of this.keys) { key.state.reset(input); this.pose(key, true); }
    this.clear();
  }
  setQuality(quality: QualitySettings) { this.quality = quality; }
  diagnostics(): ThemeDiagnostics { return { particles: 0, flames: 0, waves: 0 }; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    disposeObject(this.group, new Set([this.context.legendTexture]));
    this.group.clear();
    this.keys.length = this.hitTargets.length = 0;
  }
}
