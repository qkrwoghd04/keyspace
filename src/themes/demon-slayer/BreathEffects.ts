import * as THREE from 'three';
import type { EffectIntensity } from '../../challenge/types';
import type { QualitySettings } from '../types';
import { ParticlePool } from '../shared/ParticlePool';
import { DEMON_SLAYER as C } from './config';
import type { BreathController } from './BreathController';
import { slashPoint, type Point3 } from './SlashGeometry';
import { SlashSystem } from './SlashSystem';

/** Recent-key routing, foam and embers, separate from both key mechanics and performance rules. */
export class BreathEffects {
  readonly slashes: SlashSystem;
  private readonly foam: ParticlePool;
  private readonly bubbles: ParticlePool;
  private readonly embers: ParticlePool;
  private last: { point: Point3; at: number } | null = null;
  private readonly recent: string[] = [];
  private readonly path: Point3[] = [];
  private sinceEmission = Infinity;
  private intensity: EffectIntensity = 'full';
  private low = false;
  private links = 0;
  private anchor: Point3 | null = null;

  constructor(parent: THREE.Group, private readonly controller?: BreathController) {
    this.slashes = new SlashSystem(parent);
    this.foam = new ParticlePool(parent, 36, new THREE.SphereGeometry(1, 7, 5), new THREE.MeshBasicMaterial({ color: C.water.foam, transparent: true, opacity: .9, depthWrite: false }), -1.8, 2.8);
    this.bubbles = new ParticlePool(parent, 18, new THREE.TorusGeometry(1, .28, 4, 9), new THREE.MeshBasicMaterial({ color: C.water.foam, transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }), -.45, 3);
    this.embers = new ParticlePool(parent, 18, new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ color: C.sun.light, transparent: true, opacity: .8, depthWrite: false, toneMapped: false }), .18, 3);
  }

  strike(code: string, point: Point3, reduced: boolean) {
    const now = performance.now();
    if (this.last && now - this.last.at > C.trail.gapMs) { this.last = null; this.recent.length = 0; }
    this.recent.push(code); if (this.recent.length > 7) this.recent.shift();
    const previous = this.last;
    this.last = { point, at: now }; this.anchor = point;
    if (this.intensity === 'off' || this.sinceEmission < (this.low || this.intensity === 'low' ? .05 : .024)) return;
    const visual = this.controller?.visual(), form = (visual?.mix ?? 0) > .55 ? 'sun' : 'water', energy = visual?.energy ?? 0;
    const distance = previous ? Math.hypot(previous.point.x - point.x, previous.point.z - point.z) : Infinity;
    const connected = !reduced && previous && distance > .08 && distance < C.trail.maxDistance;
    if (!connected) this.path.length = 0;
    if (!this.path.length && connected) this.path.push(previous.point);
    this.path.push(point); if (this.path.length > 4) this.path.shift();
    // Keep an active cut local even when the typist alternates distant clusters.
    while (this.path.length > 2 && this.path.slice(1).reduce((length, next, i) => length + Math.hypot(next.x - this.path[i].x, next.z - this.path[i].z), 0) > 9) this.path.shift();
    const from = connected ? this.path[0] : { x: point.x - (reduced ? .48 : 1.2), y: point.y, z: point.z + (reduced ? .15 : .45) };
    if (connected) this.links++;
    this.slashes.emit(from, point, form, energy, reduced, this.intensity === 'low' ? .85 : 1, connected ? this.path : undefined);
    this.sinceEmission = 0;
    if (!reduced) {
      const count = this.low || this.intensity === 'low' ? 1 : 3;
      if (form === 'water') {
        const crest = slashPoint(.56, from, point, form, energy, this.path);
        this.foam.burst(crest.x, crest.y + .1, crest.z, count + 1, .43, .26, .075);
        this.foam.burst(point.x, point.y, point.z, count, .68, .26, .055);
        this.bubbles.burst(crest.x, crest.y + .1, crest.z, 1, .28, .4, .062);
      } else {
        const tip = slashPoint(.74, from, point, form, energy);
        this.embers.burst(tip.x, tip.y + .05, tip.z, count + 1, .54, .32, .032);
      }
    }
  }

  update(delta: number, reduced: boolean) {
    this.sinceEmission += delta;
    const visual = this.controller?.visual();
    if (visual?.phase === 'awakening' && this.intensity !== 'off') this.slashes.awaken(visual.serial, reduced);
    if (reduced || this.intensity === 'off') { this.foam.clear(); this.bubbles.clear(); this.embers.clear(); }
    const moving = this.slashes.update(delta, visual?.mix ?? 0, reduced, this.intensity === 'off');
    const foam = this.foam.update(delta), bubbles = this.bubbles.update(delta), embers = this.embers.update(delta);
    return moving || foam || bubbles || embers;
  }
  setIntensity(value: EffectIntensity) { this.intensity = value; if (value === 'off') this.clear(); }
  setQuality(quality: QualitySettings) {
    this.low = quality.level === 'low'; this.slashes.setLow(this.low);
    this.foam.setLimit(this.low ? 14 : 36); this.bubbles.setLimit(this.low ? 7 : 18); this.embers.setLimit(this.low ? 7 : 18);
  }
  clear() { this.slashes.clear(); this.foam.clear(); this.bubbles.clear(); this.embers.clear(); this.last = null; this.recent.length = this.path.length = 0; this.sinceEmission = Infinity; }
  diagnostics() { return { waves: this.slashes.active, particles: this.foam.active + this.bubbles.active + this.embers.active, flames: this.embers.active,
    recentKeys: [...this.recent], mechanism: { connectedTrails: this.slashes.active, links: this.links, ...this.slashes.diagnostics(), foam: this.foam.active, bubbles: this.bubbles.active, embers: this.embers.active,
      phase: this.controller?.state.phase ?? 'water', morph: this.controller?.visual().mix ?? 0, anchorX: this.anchor?.x ?? 0, anchorY: this.anchor?.y ?? 0, anchorZ: this.anchor?.z ?? 0 } }; }
}
