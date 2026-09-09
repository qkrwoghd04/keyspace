import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { slashPoint, writeSlash, SLASH_SEGMENTS, SLASH_LANES } from './SlashGeometry';
import { SlashSystem } from './SlashSystem';
import { disposeObject } from '../../keyboard/KeyboardModel';
const from = { x: -3, y: 1.47, z: .3 }, to = { x: 2, y: 1.47, z: -.2 };

describe('world-space painted slashes', () => {
  it('anchors both different forms at both actual key positions', () => {
    for (const form of ['water', 'sun'] as const) {
      expect(slashPoint(0, from, to, form)).toEqual(from);
      for (const key of ['x', 'y', 'z'] as const) expect(slashPoint(1, from, to, form)[key]).toBeCloseTo(to[key]);
    }
    const water = slashPoint(.45, from, to, 'water'), sun = slashPoint(.45, from, to, 'sun');
    expect(Math.hypot(water.x - sun.x, water.z - sun.z)).toBeGreaterThan(.6);
  });
  it('uses broad tapering multi-lane geometry with different positions, not recolored lines', () => {
    const water = new Float32Array((SLASH_SEGMENTS + 1) * (SLASH_LANES + 1) * 3), sun = new Float32Array(water.length);
    writeSlash(water, from, to, 'water', .4, .5); writeSlash(sun, from, to, 'sun', .4, .5);
    expect(water.every(Number.isFinite)).toBe(true); expect(sun.every(Number.isFinite)).toBe(true);
    const row = 32 * (SLASH_LANES + 1) * 3, end = row + SLASH_LANES * 3;
    expect(Math.hypot(water[row] - water[end], water[row + 1] - water[end + 1], water[row + 2] - water[end + 2])).toBeGreaterThan(.75);
    expect(water).not.toEqual(sun);
  });
  it('pools 2000 strikes without new GPU resources and clears all finite lifetimes', () => {
    const group = new THREE.Group(), system = new SlashSystem(group);
    const original = group.children.map(child => (child as THREE.Mesh).geometry.uuid);
    for (let i = 0; i < 2000; i++) system.emit(from, to, i % 2 ? 'water' : 'sun', 1, false);
    system.update(.04, 0, false); expect(system.active).toBe(6);
    expect(group.children.map(child => (child as THREE.Mesh).geometry.uuid)).toEqual(original);
    system.setLow(true); system.update(.05, 0, false); expect(system.active).toBe(3);
    system.awaken(4, false); system.awaken(4, false); expect(system.transitions).toBe(1);
    system.update(2, 1, false); expect(system.active).toBe(0);
    system.emit(from, to, 'water', 0, true); system.update(.04, 0, true); expect(system.active).toBe(1);
    system.update(.1, 0, true); expect(system.active).toBe(0); disposeObject(group);
  });
});
