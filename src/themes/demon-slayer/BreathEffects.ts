import * as THREE from 'three';
import type { EffectIntensity } from '../../challenge/types';
import type { QualitySettings } from '../types';
import { ParticlePool } from '../shared/ParticlePool';
import { DEMON_SLAYER as C } from './config';
import type { BreathController } from './BreathController';
import type { Point3 } from './SlashGeometry';
import { SlashSystem } from './SlashSystem';
import { FlowSystem } from './FlowSystem';
import { trailPoint } from './TrailPath';

/** Input memory and small impact accents have independent budgets. */
export class BreathEffects {
  readonly slashes: SlashSystem;
  readonly flow: FlowSystem;
  private readonly foam: ParticlePool;
  private readonly bubbles: ParticlePool;
  private readonly embers: ParticlePool;
  private readonly recent: string[] = [];
  private sinceEmission = Infinity;
  private sinceFoam = Infinity;
  private intensity: EffectIntensity = 'full';
  private low = false;
  private get sparse() { return this.low || this.intensity === 'low'; }
  private anchor: Point3 | null = null;
  private readonly crest: Point3 = { x: 0, y: 0, z: 0 };
  constructor(parent: THREE.Group, private readonly controller?: BreathController) {
    this.slashes = new SlashSystem(parent); this.flow = new FlowSystem(parent);
    this.foam = new ParticlePool(parent, 36, new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: C.water.foam, transparent: true, opacity: .9, depthWrite: false }), -1.8, 2.8);
    this.bubbles = new ParticlePool(parent, 18, new THREE.TorusGeometry(1, .28, 4, 9), new THREE.MeshBasicMaterial({ color: C.water.foam, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }), -.45, 3);
    this.embers = new ParticlePool(parent, 18, new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ color: C.sun.light, transparent: true, opacity: .8, depthWrite: false, toneMapped: false }), .18, 3);
  }
  strike(code: string, point: Point3, reduced: boolean, atMs = performance.now()) {
    if (this.intensity === 'off') return;
    this.recent.push(code); if (this.recent.length > this.flow.path.limit) this.recent.shift();
    this.anchor = point;
    if (!reduced && code !== 'SoftwareCommit') this.flow.append(code, point, atMs);
    if (this.sinceEmission < (this.low || this.intensity === 'low' ? .05 : .024)) return;
    const visual = this.controller?.visual(), form = (visual?.mix ?? 0) > .55 ? 'sun' : 'water';
    this.slashes.emit({ x: point.x - .28, y: point.y, z: point.z + .08 }, point, form, 0, reduced, .32);
    this.sinceEmission = 0;
    if (!reduced) {
      if (form === 'water') this.foam.burst(point.x, point.y, point.z, 1, .36, .12, .045);
      else this.embers.burst(point.x, point.y, point.z, 2, .45, .16, .035);
      const points = this.flow.path.current.points;
      if (points.length > 2 && form === 'water') {
        const a = points.at(-3)!, b = points.at(-2)!, c = points.at(-1)!;
        const ux = b.x - a.x, uz = b.z - a.z, vx = c.x - b.x, vz = c.z - b.z;
        const turn = (ux * vx + uz * vz) / (Math.hypot(ux, uz) * Math.hypot(vx, vz));
        if (turn < .65) {
          this.foam.burst(b.x, b.y + .08, b.z, this.low ? 1 : 3, .2, .15, .08);
          this.bubbles.burst(b.x, b.y + .08, b.z, 1, .15, .12, .075);
        }
      }
    }
  }
  update(delta: number, reduced: boolean) {
    this.sinceEmission += delta; this.sinceFoam += delta;
    const visual = this.controller?.visual(), now = performance.now(), sun = (visual?.mix ?? 0) > .55;
    if (visual?.phase === 'awakening' && this.intensity !== 'off') this.slashes.awaken(visual.serial, reduced);
    const flowing = this.flow.update(delta, now, visual?.mix ?? 0, visual?.energy ?? 0, reduced || this.intensity === 'off');
    const chain = this.flow.path.current;
    if (chain.points.length > 1 && this.sinceFoam >= (this.low || this.intensity === 'low' ? .12 : .055) && now - chain.points.at(-1)!.at < 220) {
      let segment = Math.max(0, chain.points.length - 2);
      while (segment > 0 && chain.points[segment].s > chain.head) segment--;
      const a = chain.points[segment], b = chain.points[segment + 1];
      const t = Math.max(0, Math.min(1, (chain.head - a.s) / (b.s - a.s)));
      trailPoint(chain, segment, t, now, sun, this.crest);
      const distance = Math.hypot(b.x - a.x, b.z - a.z) || 1, direction = { x: (b.x - a.x) / distance, z: (b.z - a.z) / distance };
      if (sun) this.embers.burst(this.crest.x, this.crest.y, this.crest.z, this.low ? 1 : 2, .4, .08, .035, direction);
      else {
        this.foam.burst(this.crest.x, this.crest.y + .06, this.crest.z, this.low ? 1 : 2, .22, .1, .07, direction);
        this.bubbles.burst(this.crest.x, this.crest.y + .05, this.crest.z, 1, .15, .1, .065);
      }
      this.sinceFoam = 0;
    }
    if (reduced || this.intensity === 'off') { this.foam.clear(); this.bubbles.clear(); this.embers.clear(); }
    const moving = this.slashes.update(delta, visual?.mix ?? 0, reduced, this.intensity === 'off');
    const foam = this.foam.update(delta), bubbles = this.bubbles.update(delta), embers = this.embers.update(delta);
    return flowing || moving || foam || bubbles || embers;
  }
  setIntensity(value: EffectIntensity) { this.intensity = value; this.applyLimits(); if (value === 'off') this.clear(); }
  setQuality(quality: QualitySettings) {
    this.low = quality.level === 'low'; this.applyLimits();
  }
  private applyLimits() {
    this.slashes.setLow(this.sparse); this.flow.setLow(this.sparse);
    this.foam.setLimit(this.sparse ? 14 : 36); this.bubbles.setLimit(this.sparse ? 7 : 18); this.embers.setLimit(this.sparse ? 7 : 18);
  }
  clear() { this.slashes.clear(); this.flow.clear(); this.foam.clear(); this.bubbles.clear(); this.embers.clear(); this.recent.length = 0; this.sinceEmission = this.sinceFoam = Infinity; }
  diagnostics() { return { waves: this.slashes.active + this.flow.active, particles: this.foam.active + this.bubbles.active + this.embers.active, flames: this.embers.active,
    recentKeys: [...this.recent], trail: import.meta.env.DEV ? this.flow.samples() : undefined, mechanism: { connectedTrails: this.flow.active, links: this.flow.path.links, ...this.slashes.diagnostics(), ...this.flow.diagnostics(), foam: this.foam.active, bubbles: this.bubbles.active, embers: this.embers.active,
      phase: this.controller?.state.phase ?? 'water', morph: this.controller?.visual().mix ?? 0, anchorX: this.anchor?.x ?? 0, anchorY: this.anchor?.y ?? 0, anchorZ: this.anchor?.z ?? 0 } }; }
}
