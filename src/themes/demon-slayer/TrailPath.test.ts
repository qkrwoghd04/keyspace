import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { TrailPath, trailPoint } from './TrailPath';
import { FlowSystem } from './FlowSystem';
import { BreathEffects } from './BreathEffects';
import { disposeObject } from '../../keyboard/KeyboardModel';

describe('living input path', () => {
  it('retains ordered distant keys before decoration throttling', () => {
    const group = new THREE.Group(), effects = new BreathEffects(group);
    for (let i = 0; i < 10; i++) effects.strike(`key${i}`, { x: i % 2 ? 8 : -8, y: 1.47, z: i / 10 }, false, i * 24);
    expect(effects.flow.path.current.points).toHaveLength(10);
    expect(effects.flow.path.links).toBe(9);
    expect(effects.slashes.emitted).toBe(1);
    effects.strike('SoftwareCommit', { x: 0, y: 1.47, z: 2 }, false, 245);
    expect(effects.flow.path.current.points).toHaveLength(10);
    effects.setIntensity('off'); effects.strike('key', { x: 2, y: 1, z: 1 }, false, 250);
    expect(effects.flow.path.current.points).toHaveLength(0); disposeObject(group);
  });
  it('caps points, retains absolute distance and removes expired input memory', () => {
    const path = new TrailPath();
    for (let i = 0; i < 20; i++) path.append(String(i), { x: i % 10, y: 1.47, z: i % 2 }, i * 30);
    expect(path.current.points).toHaveLength(10); expect(path.current.points[0].s).toBeGreaterThan(0);
    const s = path.current.points.at(-1)!.s;
    path.append('repeat', path.current.points.at(-1)!, 580);
    expect(path.current.points).toHaveLength(10); expect(path.current.points.at(-1)!.s).toBe(s);
    path.update(700, .12); expect(path.current.head).toBe(s);
    path.setLow(true); path.update(700, .01); expect(path.current.points).toHaveLength(6);
    path.update(1280, .58); expect(path.current.points).toHaveLength(0);
  });
  it('keeps only one retiring chain after a 700ms gap', () => {
    const path = new TrailPath();
    path.append('a', { x: 0, y: 1, z: 0 }, 0); path.append('s', { x: 1, y: 1, z: 0 }, 80);
    path.append('d', { x: 2, y: 1, z: 0 }, 800);
    expect(path.current.points).toHaveLength(1); expect(path.retiring.points).toHaveLength(2);
    path.update(1080, .28); expect(path.retiring.points).toHaveLength(0);
  });
  it('anchors every segment in both forms and keeps old sections stable when appending', () => {
    const path = new TrailPath(), p = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 6; i++) path.append(String(i), { x: i % 2 ? 6 : -6, y: 1.47, z: i - 3 }, i * 50);
    for (let i = 0; i < 5; i++) for (const sun of [false, true]) {
      expect(trailPoint(path.current, i, 0, 400, sun, p)).toMatchObject({ x: path.current.points[i].x, y: 1.47, z: path.current.points[i].z });
      const b = path.current.points[i + 1]; trailPoint(path.current, i, 1, 400, sun, p);
      expect(p.x).toBeCloseTo(b.x); expect(p.y).toBeCloseTo(b.y); expect(p.z).toBeCloseTo(b.z);
    }
    path.current.head = path.current.points[2].s;
    const water = { ...trailPoint(path.current, 1, .5, 400, false, p) }, sun = { ...trailPoint(path.current, 1, .5, 400, true, p) };
    expect(Math.hypot(water.x - sun.x, water.z - sun.z)).toBeGreaterThan(1);
    path.append('new', { x: 7, y: 1.47, z: 3 }, 450);
    expect(trailPoint(path.current, 1, .5, 450, false, p)).toEqual(water);
  });
  it('uses two persistent GPU buffers for 2000 inputs and has truthful geometry samples', () => {
    const group = new THREE.Group(), flow = new FlowSystem(group), ids = group.children.map(mesh => (mesh as THREE.Mesh).geometry.uuid);
    for (let i = 0; i < 2000; i++) {
      flow.append(String(i), { x: i % 10 - 5, y: 1.47, z: i % 2 }, i * 20);
      flow.update(.02, i * 20, i % 2, .5, false);
    }
    flow.update(.12, 40100, 0, .5, false);
    expect(group.children.map(mesh => (mesh as THREE.Mesh).geometry.uuid)).toEqual(ids);
    expect(flow.active).toBe(1); expect(flow.diagnostics().maxAnchorError).toBeLessThan(.00001);
    const samples = flow.samples(); expect(samples.anchors).toHaveLength(10);
    expect(samples.water.flat().every(Number.isFinite)).toBe(true); expect(samples.water).not.toEqual(samples.sun);
    flow.update(1.1, 41200, 0, 0, false); expect(flow.active).toBe(0);
    flow.clear(); disposeObject(group);
  });
});
