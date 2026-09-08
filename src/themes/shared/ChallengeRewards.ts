import * as THREE from 'three';
import { disposeObject } from '../../keyboard/KeyboardModel';
import type { JudgmentEvent, EffectIntensity } from '../../challenge/types';
import type { QualitySettings, ThemeId, ThemeRuntime } from '../types';
import { RibbonPool, type Point3 } from '../animation/RibbonPool';
import { ParticlePool } from './ParticlePool';
import { WavePool } from './WavePool';

type Style = 'edge' | 'prism' | 'fire' | 'ice' | 'jelly' | 'bloom' | 'orbit' | 'water' | 'charge' | 'print' | 'steam' | 'mechanical';
const PROFILES: Record<ThemeId, { style: Style; color: string; secondary: string }> = {
  studio: { style: 'edge', color: '#d18a4c', secondary: '#e7c99a' },
  dark: { style: 'edge', color: '#9ca8bd', secondary: '#556e91' },
  glass: { style: 'prism', color: '#bce8f2', secondary: '#f1ead1' },
  neon: { style: 'print', color: '#bb85eb', secondary: '#69d6d4' },
  inferno: { style: 'fire', color: '#ff9c39', secondary: '#e94a16' },
  glacier: { style: 'ice', color: '#bceafa', secondary: '#78aebd' },
  jelly: { style: 'jelly', color: '#f2bd82', secondary: '#c9d68c' },
  grove: { style: 'bloom', color: '#d6ad77', secondary: '#93aa59' },
  orbit: { style: 'orbit', color: '#b4ccf5', secondary: '#859eca' },
  'demon-slayer': { style: 'water', color: '#68bdc7', secondary: '#dbefe4' },
  pokemon: { style: 'charge', color: '#f5d570', secondary: '#dd9654' },
  'spider-verse': { style: 'print', color: '#d22c68', secondary: '#2d9fb2' },
  howl: { style: 'steam', color: '#e1c590', secondary: '#adbfaf' },
  evangelion: { style: 'mechanical', color: '#accb70', secondary: '#937bb6' },
};
function blossom() {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, r = .57 + .43 * Math.cos(a * 5), x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shape.lineTo(x, y); else shape.moveTo(x, y); }
  return new THREE.ExtrudeGeometry(shape, { depth: .16, bevelEnabled: false });
}

/** Only translates engine events into finite, world-space rewards. Never scores. */
export class ChallengeRewards {
  readonly group = new THREE.Group();
  private readonly profile;
  private readonly points = new Map<string, Point3>();
  private readonly particles: ParticlePool;
  private readonly ribbons: RibbonPool;
  private readonly waves: WavePool;
  private readonly halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private intensity: EffectIntensity = 'low';
  private quality: QualitySettings;
  private tier = 0;
  private cooldown = 0;
  private finale = 0;
  private last: Point3 | null = null;
  private bursts = 0;
  private finales = 0;
  private readonly top: number;

  constructor(theme: ThemeId, model: ThemeRuntime, quality: QualitySettings) {
    this.profile = PROFILES[theme]; this.quality = quality;
    this.group.name = `${theme} / judgment rewards`;
    model.group.updateMatrixWorld(true);
    for (const mesh of model.hitTargets) {
      mesh.geometry.computeBoundingBox();
      const point = new THREE.Vector3(0, (mesh.geometry.boundingBox?.max.y ?? .4) + .035, 0);
      mesh.localToWorld(point); model.group.worldToLocal(point);
      this.points.set(mesh.userData.code, { x: point.x, y: point.y, z: point.z });
    }
    this.top = Math.min(...[...this.points.values()].map(point => point.y));
    const { style, color } = this.profile;
    const geometry = style === 'bloom' ? blossom() : style === 'jelly' || style === 'steam' ? new THREE.SphereGeometry(1, 8, 6) : style === 'print' || style === 'mechanical' ? new THREE.BoxGeometry(.8, .15, 1.4) : new THREE.OctahedronGeometry(1, 0);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: style === 'steam' ? .35 : .8, depthWrite: false, toneMapped: false });
    this.particles = new ParticlePool(this.group, 64, geometry, material, style === 'steam' ? .3 : style === 'orbit' ? 0 : -1.6, 2);
    this.ribbons = new RibbonPool(this.group, 6);
    this.waves = new WavePool(this.group, 3, color, .65);
    this.halo = new THREE.Mesh(new THREE.RingGeometry(.993, 1, 96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.halo.rotation.x = -Math.PI / 2; this.halo.position.set(0, this.top - .08, 0); this.halo.scale.set(8.25, 3.3, 1); this.halo.visible = false; this.group.add(this.halo);
    model.group.add(this.group); this.setQuality(quality);
  }
  setQuality(quality: QualitySettings) { this.quality = quality; this.particles.setLimit(quality.level === 'low' ? 24 : 64); this.ribbons.setLimit(quality.level === 'low' ? 3 : 6); }
  setIntensity(intensity: EffectIntensity) { this.intensity = intensity; if (intensity === 'off') this.clear(); }
  receive(event: JudgmentEvent) {
    if (event.type === 'reset') { this.clear(); return true; }
    if (event.type === 'error') { this.tier = 0; this.last = null; this.halo.visible = false; return true; }
    if (event.type === 'combo') { this.tier = event.tier; return true; }
    if (this.intensity === 'off') return false;
    const strong = this.intensity === 'full', scale = strong ? 1 : .5;
    if (event.type === 'finished') {
      if (this.finale > 0) return false;
      this.finale = 1.4; this.finales++;
      const count = strong && this.quality.level === 'standard' ? 10 : 4;
      for (const x of [-6.6, 0, 6.6]) this.particles.burst(x, this.top, 2.85, count, .7, 1.7, this.profile.style === 'bloom' ? .19 : .075);
      this.ribbons.emit({ x: -8, y: this.top, z: 3.05 }, { x: 8, y: this.top, z: 3.05 }, this.profile.color, .035 * scale, .23, 1.1, this.profile.style === 'print', -.45);
      if (event.personalBest) this.ribbons.emit({ x: 8, y: this.top, z: -3 }, { x: -8, y: this.top, z: -3 }, this.profile.secondary, .035 * scale, .35, 1.2, this.profile.style === 'print', -.35);
      return true;
    }
    this.tier = event.tier;
    if (this.cooldown > 0) return false;
    // Software keyboards may commit text without a physical KeyboardEvent.code.
    // Keep the judgment reward local without inventing a physical key press.
    const point = this.points.get(event.code ?? '') ?? this.points.get('Space');
    if (!point) return false;
    this.cooldown = strong ? .035 : .075; this.bursts++;
    const { style, color, secondary } = this.profile, tier = event.tier;
    const count = style === 'bloom' && tier >= 2 ? 2 : 1 + Math.min(3, tier);
    const size = (style === 'bloom' && tier >= 2 ? .13 : style === 'steam' ? .09 : .035) * scale;
    this.particles.burst(point.x, point.y, point.z + .35, count, style === 'ice' ? .32 : .42, .45, size);
    if (style === 'jelly' || style === 'prism') this.waves.emit(point.x, point.y - .12, point.z, .45 + tier * .22, .16 * scale);
    if (tier >= 2 && this.last && Math.hypot(point.x - this.last.x, point.z - this.last.z) > .08) {
      const lift = style === 'fire' || style === 'water' ? .4 : style === 'ice' || style === 'mechanical' ? .025 : .12;
      this.ribbons.emit(this.last, point, tier === 3 ? secondary : color, (style === 'fire' ? .08 : .025) * scale, lift, .45 + tier * .08, style === 'print' || style === 'mechanical', style === 'water' ? .25 : 0);
    }
    if (style === 'charge' && tier >= 1) this.ribbons.emit({ x: point.x - .2, y: point.y, z: point.z }, { x: point.x + .35, y: point.y + .15, z: point.z + .2 }, color, .015, .11, .28, true, -.08);
    this.last = point;
    return true;
  }
  update(delta: number, reduced: boolean) {
    this.cooldown = Math.max(0, this.cooldown - delta); this.finale = Math.max(0, this.finale - delta);
    if (reduced || this.intensity === 'off') { this.clear(); return false; }
    const a = this.particles.update(delta), b = this.ribbons.update(delta), c = this.waves.update(delta);
    this.halo.visible = this.profile.style === 'orbit' && (this.tier >= 3 || this.finale > 0);
    this.halo.material.opacity = this.intensity === 'full' ? .42 : .2;
    return a || b || c || this.finale > 0;
  }
  clear() { this.tier = this.cooldown = this.finale = 0; this.last = null; this.particles.clear(); this.ribbons.clear(); this.waves.clear(); this.halo.visible = false; }
  diagnostics() { return { style: this.profile.style, tier: this.tier, bursts: this.bursts, finales: this.finales, particles: this.particles.active, ribbons: this.ribbons.active, waves: this.waves.active, stableRing: this.halo.visible, intensity: this.intensity }; }
  dispose() { this.group.removeFromParent(); disposeObject(this.group); this.group.clear(); }
}
