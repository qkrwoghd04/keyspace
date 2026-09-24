import * as THREE from 'three';
import { KEYS } from '../../keyboard/layout';
import type { QualitySettings, ThemeContext } from '../types';
import type { KeyBody } from '../shared/BaseRuntime';
import { puddingSolid } from '../shared/geometry';
import { ParticlePool } from '../shared/ParticlePool';
import { createPartner, PARTNER_FORMS } from '../digimon/Partner';
import { DataPackets } from '../digimon/DataPackets';
import { AnimationRuntime } from './AnimationRuntime';
import { box, cel, celGradient, ellipsoid, part } from './parts';

const AGUMON = ['00001110000', '00011111000', '00110111100', '00111111110', '00011111100', '00111110000', '01111111000', '11011111110', '00011111111', '00011001100', '00111011100'];
const GREYMON = ['01000001000', '01111111000', '01111111100', '00110111110', '00111111111', '00011111100', '00111110000', '01111111000', '11011111110', '00011001100', '00111011100'];
const METALGREYMON = ['01000001000', '01111111000', '01101111100', '00111111110', '11110111111', '11111111100', '11111110110', '01101111110', '11011111110', '00011001100', '00111011100'];
const WARGREYMON = ['00010001000', '00111011100', '00111111100', '11110101111', '11111111111', '01111111110', '11011111011', '11011111011', '01011011010', '00011011000', '00111011100'];
const SPRITES = [AGUMON, GREYMON, METALGREYMON, WARGREYMON];
const SKILLS = ['baby-flame', 'mega-flame', 'giga-destroyer', 'gaia-force'];
const SCALES = [1, 1.23, 1.23, 1.23];

/** A cream/orange adventure terminal, LCD Digivice and an evolving partner dock. */
export default class Digimon extends AnimationRuntime {
  private readonly partner: ReturnType<typeof createPartner>;
  private readonly packets: DataPackets;
  private readonly fire: ParticlePool;
  private readonly rings: THREE.Mesh[] = [];
  private readonly bars: THREE.Mesh[] = [];
  private readonly pixelSprite: THREE.InstancedMesh;
  private readonly screen: THREE.MeshBasicMaterial;
  private readonly pulse: THREE.MeshBasicMaterial;
  private readonly missiles: THREE.Group[] = [];
  private readonly gaia: THREE.Mesh;
  private readonly fireMaterial = new THREE.MeshBasicMaterial({ color: '#e99439' });
  private energy = 0;
  private partnerScale = 1;
  private look = 0;
  private stage = 0;
  private pendingStage = 0;
  private readonly recent: string[] = [];
  private readonly evolvedColor = new THREE.Color('#e38b35');
  private readonly screenHighlight = new THREE.Color('#d1dca6');

  constructor(context: ThemeContext) {
    super(context);
    this.group.name = 'DIGIMON / digital partner';
    const gradient = celGradient();
    const ivory = cel('#ede7d4', gradient), orange = cel('#d77e32', gradient), rubber = cel('#464c43', gradient), sage = cel('#a4ac87', gradient);
    const metal = new THREE.MeshStandardMaterial({ color: '#a5a795', roughness: .48, metalness: .62 });
    box(this.group, [18.3, .66, 7.5], rubber, [0, .44, 0], .22);
    box(this.group, [18.1, .55, 7.38], ivory, [0, .72, 0], .22);
    box(this.group, [16.86, .12, 6.5], rubber, [0, 1.03, 0], .05);
    for (const side of [-1, 1]) {
      box(this.group, [.42, .62, 7.35], orange, [side * 8.92, .72, 0], .1);
      for (const z of [-3.38, 3.38]) {
        part(this.group, new THREE.CylinderGeometry(.12, .12, .03, 12), metal, side * 8.63, 1.018, z);
        box(this.group, [.13, .016, .024], rubber, [side * 8.63, 1.04, z], 0);
      }
    }
    // Raised rear rail: an actual LCD, three buttons and a small speaker.
    box(this.group, [17.1, .54, 1.65], orange, [0, .84, -4.13], .18);
    box(this.group, [4.8, .22, 1.55], rubber, [-4.7, 1.17, -4.15], .12);
    this.screen = new THREE.MeshBasicMaterial({ color: '#b4c08d' });
    box(this.group, [4.4, .025, 1.21], this.screen, [-4.7, 1.3, -4.15], .04);
    this.pixelSprite = new THREE.InstancedMesh(new THREE.BoxGeometry(.072, .012, .072), new THREE.MeshBasicMaterial({ color: '#3e523c' }), 121);
    this.pixelSprite.position.set(-6.08, 1.33, -4.64); this.group.add(this.pixelSprite); this.drawSprite();
    const barMaterial = new THREE.MeshBasicMaterial({ color: '#526744' });
    for (let i = 0; i < 6; i++) this.bars.push(box(this.group, [.25, .014, .22 + i * .11], barMaterial, [-4.5 + i * .4, 1.33, -4.06], 0));
    for (let i = 0; i < 3; i++) part(this.group, new THREE.CylinderGeometry(.25, .29, .1, 20), i === 2 ? ivory : rubber, -.5 + i * .78, 1.16, -4.15);
    for (let i = 0; i < 7; i++) box(this.group, [.05, .012, .8], rubber, [4.8 + i * .2, 1.118, -4.15], 0);
    // Front recessed badge: the eight-ray crest of courage as a physical inset.
    const crest = new THREE.Group(); crest.position.set(0, .98, 3.47); this.group.add(crest);
    for (let i = 0; i < 8; i++) { const ray = box(crest, [.035, .025, .19], orange, [Math.sin(i * Math.PI / 4) * .2, 0, Math.cos(i * Math.PI / 4) * .2], 0); ray.rotation.y = i * Math.PI / 4; }
    part(crest, new THREE.CylinderGeometry(.085, .085, .025, 12), orange);
    const geometries = new Map<number, THREE.BufferGeometry>();
    KEYS.forEach((definition, i) => {
      if (!geometries.has(definition.width)) geometries.set(definition.width, puddingSolid(definition.width - .13, .87, .42, .09));
      const special = definition.code === 'Enter' || definition.code === 'Escape';
      this.addKey(definition, i, geometries.get(definition.width)!, special ? orange : definition.tone === 'gray' ? sage : ivory, 1.07, .42, special ? '#fff2d3' : '#39443b');
    });
    // The asymmetrical right dock reads as a Digivice, with orange grips and a data port.
    const dock = new THREE.Group(); dock.position.set(10.4, .5, -.3); this.group.add(dock);
    ellipsoid(dock, 1, [1.85, .47, 2.05], rubber, [0, 0, 0]);
    ellipsoid(dock, 1, [1.73, .38, 1.96], ivory, [0, .23, 0]);
    for (const side of [-1, 1]) box(dock, [.34, .5, 2.35], orange, [side * 1.54, .3, 0], .14);
    part(dock, new THREE.CylinderGeometry(1.27, 1.36, .14, 48), rubber, 0, .61, 0);
    part(dock, new THREE.CylinderGeometry(1.13, 1.13, .04, 48), sage, 0, .7, 0);
    for (let i = 0; i < 3; i++) part(dock, new THREE.CylinderGeometry(.14, .17, .1, 16), rubber, -.48 + i * .48, .49, 1.55);
    this.partner = createPartner(gradient); this.partner.root.position.set(10.4, 1.23, -.3); this.partner.root.rotation.y = -.45; this.group.add(this.partner.root);
    this.pulse = new THREE.MeshBasicMaterial({ color: '#bedca0', transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 3; i++) {
      const ring = part(this.group, new THREE.TorusGeometry(1.38 + i * .14, .024, 6, 48, Math.PI * 1.75), this.pulse, 10.4, 1.6 + i * .7, -.3);
      ring.rotation.x = Math.PI / 2; ring.visible = false; ring.castShadow = false; this.rings.push(ring);
    }
    this.packets = new DataPackets(this.group);
    this.fire = new ParticlePool(this.group, 32, new THREE.IcosahedronGeometry(1, 0), this.fireMaterial, -.9, 3.5);
    // Every attack object is allocated once, including the final-stage energy sphere.
    for (let i = 0; i < 2; i++) {
      const missile = new THREE.Group();
      const body = part(missile, new THREE.CylinderGeometry(.12, .12, .4, 10), metal); body.rotation.x = Math.PI / 2;
      const tip = part(missile, new THREE.ConeGeometry(.12, .23, 10), orange, 0, 0, .3); tip.rotation.x = Math.PI / 2;
      part(missile, new THREE.IcosahedronGeometry(.13, 0), this.fireMaterial, 0, 0, -.27);
      missile.visible = false; missile.rotation.y = -.45; this.group.add(missile); this.missiles.push(missile);
    }
    this.gaia = part(this.group, new THREE.IcosahedronGeometry(.65, 2), new THREE.MeshBasicMaterial({ color: '#f6c75e' }), 10.1, 5.1, 0);
    this.gaia.visible = false; this.gaia.castShadow = false;
    this.bounds.set(new THREE.Vector3(-9.3, 0, -5.12), new THREE.Vector3(12.8, 5.95, 4));
    this.setQuality(context.quality);
  }
  private drawSprite() {
    const matrix = new THREE.Matrix4(); let index = 0;
    SPRITES[this.stage].forEach((row, z) => [...row].forEach((bit, x) => {
      if (bit === '1') { matrix.makeTranslation(x * .084, 0, z * .084); this.pixelSprite.setMatrixAt(index++, matrix); }
    }));
    this.pixelSprite.count = index; this.pixelSprite.instanceMatrix.needsUpdate = true;
  }
  private showStage(stage: number) {
    this.stage = stage;
    this.partner.dinosaur.visible = stage < 3;
    this.partner.warrior.root.visible = stage === 3;
    this.partner.armor.visible = this.partner.stripes.visible = stage === 1 || stage === 2;
    this.partner.cyber.forEach(group => { group.visible = stage === 2; });
    this.partner.skin.color.set('#efb84f').lerp(this.evolvedColor, stage > 0 ? 1 : 0);
    this.drawSprite();
  }
  protected override onStrike(key: KeyBody, reduced: boolean) {
    this.energy = Math.min(1, this.energy + .22); this.look = THREE.MathUtils.clamp((key.x - 5) * .025, -.4, .1);
    this.recent.push(key.definition.code); if (this.recent.length > 8) this.recent.shift();
    if (!reduced) this.packets.emit(key.x, key.restY + .48, key.z);
    if (this.signature.start(key.definition.code, reduced)) {
      if (this.signature.kind === 'enter') this.pendingStage = Math.min(3, this.stage + 1);
      else if (this.stage < 2) {
        this.fireMaterial.color.set(this.stage === 0 ? '#e99439' : '#e47827');
        this.fire.burst(9.9, this.stage === 0 ? 2.98 : 3.45, .5, this.sparse ? 8 : this.stage === 0 ? 20 : 30, this.stage === 0 ? 1.5 : 2.1, .2, this.stage === 0 ? .16 : .24, { x: -.6, z: .65 });
      }
    }
  }
  protected override tick(delta: number, reduced: boolean) {
    const disabled = reduced;
    this.energy *= Math.exp(-3.5 * delta);
    if (disabled) { this.signature.reset(); this.pendingStage = this.stage; }
    const entering = this.signature.active && this.signature.kind === 'enter';
    if (!disabled && this.pendingStage > this.stage && this.signature.progress >= .4) this.showStage(this.pendingStage);
    this.partnerScale = disabled ? SCALES[this.stage] : THREE.MathUtils.damp(this.partnerScale, SCALES[this.stage], 8, delta);
    this.partner.root.scale.setScalar(this.partnerScale);
    this.partner.root.position.y = 1.23 + (disabled ? 0 : Math.sin(this.time * 2) * .025 + this.energy * .06);
    this.partner.head.rotation.y = disabled ? 0 : THREE.MathUtils.damp(this.partner.head.rotation.y, this.look, 8, delta);
    this.partner.head.rotation.x = disabled ? 0 : -this.energy * .09;
    this.partner.tail.rotation.y = disabled ? 0 : Math.sin(this.time * 2.5) * (.08 + this.energy * .16);
    this.partner.arms.forEach((arm, i) => { arm.rotation.x = disabled ? 0 : Math.sin(this.time * 3 + i) * .035 - this.energy * .18; });
    this.partner.eyes.forEach(eye => { eye.scale.y = !disabled && this.time % 6 > 5.85 ? .15 : 1.34; });
    this.partner.jaw.position.y = -.26 - (!disabled && this.signature.active && this.signature.kind === 'space' ? this.signature.envelope * .1 : 0);
    const attack = !disabled && this.signature.active && this.signature.kind === 'space';
    const progress = this.signature.progress, charge = attack ? this.signature.envelope : 0;
    this.partner.wings.forEach((wing, i) => { wing.rotation.y = (i ? -1 : 1) * (.2 + (disabled ? 0 : Math.sin(this.time * 2) * .07)); });
    this.partner.warrior.head.rotation.y = disabled ? 0 : this.look * .5;
    this.partner.warrior.arms.forEach(arm => { arm.rotation.x = -charge * 2.3 - (disabled ? 0 : this.energy * .08); });
    this.partner.warrior.shields.forEach((shield, i) => { shield.rotation.y = (i ? -1 : 1) * (.55 + charge * .2); });
    this.missiles.forEach((missile, i) => {
      missile.visible = attack && this.stage === 2 && progress < .9;
      missile.position.set(10.1 + (i - .5) * .5 - progress * 1.1, 2.75 + progress * .25, .48 + progress * 1.8);
    });
    this.gaia.visible = attack && this.stage === 3;
    const launch = Math.max(0, (progress - .55) / .45);
    this.gaia.position.set(10.1 - launch * 1.7, 5.1 - launch * 1.9, .1 + launch * 1.8);
    this.gaia.scale.setScalar(attack ? Math.min(1, progress / .35) * Math.min(1, (1 - progress) * 5) : 0);
    this.gaia.rotation.y = this.time * 1.8;
    this.bars.forEach((bar, i) => { bar.visible = i < 1 + Math.ceil(this.energy * 5); });
    this.screen.color.set('#b4c08d').lerp(this.screenHighlight, this.energy * .4);
    const hero = entering && !disabled ? this.signature.envelope : 0;
    this.pulse.opacity = hero * .8;
    this.rings.forEach((ring, i) => { ring.visible = hero > .01; ring.rotation.z = this.time * (i % 2 ? -2 : 2); ring.position.y = 1.4 + i * .65 + hero * .6; ring.scale.setScalar(.85 + hero * .25); });
    const packets = this.packets.update(delta, disabled);
    if (disabled) this.fire.clear();
    const fire = this.fire.update(delta);
    return !disabled || this.energy > .002 || packets || fire;
  }
  private get sparse() { return this.quality.level === 'low'; }
  override setQuality(quality: QualitySettings) { super.setQuality(quality); this.packets.setLow(this.sparse); this.fire.setLimit(this.sparse ? 12 : 32); }
  protected override clear() {
    this.energy = this.look = this.pendingStage = 0; this.partnerScale = 1;
    this.signature.reset(); this.packets.clear(); this.fire.clear(); this.recent.length = 0;
    this.showStage(0); this.partner.root.scale.setScalar(1); this.gaia.visible = false;
    this.rings.forEach(ring => { ring.visible = false; }); this.missiles.forEach(missile => { missile.visible = false; });
  }
  override diagnostics() { return { ...super.diagnostics(), particles: this.packets.active + this.fire.active, flames: this.fire.active, waves: this.rings.filter(r => r.visible).length, recentKeys: [...this.recent], mechanism: { form: PARTNER_FORMS[this.stage], stage: this.stage, final: this.stage === 3, skill: SKILLS[this.stage], energy: this.energy, evolution: this.stage / 3, packets: this.packets.active, emitted: this.packets.emitted, armorVisible: this.stage > 0, cyberVisible: this.partner.cyber[0].visible, warriorVisible: this.partner.warrior.root.visible, missiles: this.missiles.filter(missile => missile.visible).length, gaiaVisible: this.gaia.visible, partnerScale: this.partner.root.scale.x } }; }
}
