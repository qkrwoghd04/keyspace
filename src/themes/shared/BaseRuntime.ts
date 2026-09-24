import * as THREE from 'three';
import { BOARD_WIDTH, type KeyDefinition } from '../../keyboard/layout';
import { legendGeometry } from '../../keyboard/legends';
import { disposeObject } from '../../keyboard/KeyboardModel';
import type { KeyboardInput } from '../../input/KeyboardInput';
import type { QualitySettings, ThemeContext, ThemeDiagnostics, ThemeRuntime } from '../types';
import { KeyState } from './KeyState';

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
    this.challengeActive = active; this.clear();
  }

  update(delta: number, input: KeyboardInput, reduced: boolean) {
    if (!reduced && !this.challengeActive) this.time += delta;
    let moving = false;
    for (const key of this.keys) {
      moving = key.state.update(delta, input, reduced, this.stiffness, this.damping) || moving;
      if (key.state.fresh && !this.challengeActive) this.onPress(key, reduced);
      if (key.state.released && !this.challengeActive) this.onRelease(key, reduced);
      this.pose(key, reduced);
    }
    return this.tick(delta, reduced || this.challengeActive) || moving;
  }

  reset(input: KeyboardInput) {
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
