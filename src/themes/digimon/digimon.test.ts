import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import Digimon from '../animation/digimon';
import { DataPackets } from './DataPackets';
import { KeyboardInput } from '../../input/KeyboardInput';
import { LOW_QUALITY, STANDARD_QUALITY } from '../types';
import { THEMES } from '../registry';
import { disposeObject } from '../../keyboard/KeyboardModel';

function setup() {
  const texture = new THREE.Texture(), input = new KeyboardInput(), model = new Digimon({ legendTexture: texture, quality: STANDARD_QUALITY });
  const key = (code: string, reduced = false) => { input.press(code); input.release(code); model.update(.016, input, reduced); };
  const advance = (seconds: number, reduced = false) => { for (let time = 0; time < seconds; time += .016) model.update(.016, input, reduced); };
  const cleanup = () => { model.dispose(); input.dispose(); texture.dispose(); };
  return { input, model, key, advance, cleanup };
}

describe('Digimon replacement', () => {
  it('keeps fourteen themes and removes the retired theme entry', () => {
    expect(THEMES).toHaveLength(14);
    expect(THEMES.find(t => t.id === 'digimon')?.name).toBe('디지몬');
    expect(THEMES.some(t => String(t.id) === 'demon-slayer')).toBe(false);
  });
  it('keeps each evolution until reset, rejects queued gestures and caps at WarGreymon', () => {
    const { model, input, key, advance, cleanup } = setup();
    key('Enter'); advance(.65);
    expect(model.diagnostics().mechanism).toMatchObject({ form: 'greymon', armorVisible: true });
    expect(Number(model.diagnostics().mechanism!.partnerScale)).toBeGreaterThan(1.1);
    for (let i = 0; i < 2000; i++) { input.press('Enter'); input.release('Enter'); }
    model.update(.016, input, false);
    expect(model.diagnostics().signature!.starts).toBe(1);
    advance(8);
    expect(model.diagnostics().mechanism).toMatchObject({ form: 'greymon', stage: 1, armorVisible: true });
    key('Enter'); advance(.65);
    expect(model.diagnostics().mechanism).toMatchObject({ form: 'metalgreymon', stage: 2, cyberVisible: true, warriorVisible: false });
    advance(.8); key('Enter'); advance(.65);
    expect(model.diagnostics().mechanism).toMatchObject({ form: 'wargreymon', stage: 3, final: true, cyberVisible: false, warriorVisible: true });
    advance(20); key('Enter'); advance(2);
    expect(model.diagnostics().mechanism!.form).toBe('wargreymon');
    expect(model.diagnostics().signature!.queued).toBe(0);
    model.reset(input);
    expect(model.diagnostics().mechanism).toMatchObject({ form: 'agumon', stage: 0, final: false, armorVisible: false, cyberVisible: false, warriorVisible: false });
    cleanup();
  });
  it('uses bounded fire, twin missiles and Gaia Force without creating new geometry', () => {
    const { model, key, advance, cleanup } = setup();
    const geometryIds = () => { const ids: string[] = []; model.group.traverse(object => { if (object instanceof THREE.Mesh) ids.push(object.geometry.uuid); }); return ids; };
    const initial = geometryIds();
    for (let stage = 0; stage < 4; stage++) {
      if (stage) { key('Enter'); advance(1.4); }
      key('Space'); advance(.2);
      const effects = model.diagnostics();
      expect(effects.mechanism!.stage).toBe(stage);
      expect(effects.mechanism!.missiles).toBe(stage === 2 ? 2 : 0);
      expect(effects.mechanism!.gaiaVisible).toBe(stage === 3);
      if (stage < 2) expect(effects.flames).toBeGreaterThan(0);
      else expect(effects.flames).toBe(0);
      expect(effects.particles).toBeLessThanOrEqual(80);
      advance(1.3);
      expect(model.diagnostics().mechanism).toMatchObject({ missiles: 0, gaiaVisible: false });
    }
    expect(geometryIds()).toEqual(initial); cleanup();
  });
  it('cancels pending evolution on reset or reduced motion and clears final-stage attacks', () => {
    const { model, input, key, advance, cleanup } = setup();
    key('Enter'); advance(.2); model.reset(input); advance(2);
    expect(model.diagnostics().mechanism!.stage).toBe(0);
    key('Enter'); advance(.2); advance(2, true); advance(2);
    expect(model.diagnostics().mechanism!.stage).toBe(0);
    for (let i = 0; i < 3; i++) { key('Enter'); advance(1.4); }
    key('Space'); advance(.4);
    expect(model.diagnostics().mechanism!.gaiaVisible).toBe(true);
    advance(.1, true);
    expect(model.diagnostics().mechanism).toMatchObject({ stage: 3, gaiaVisible: false });
    model.setChallengeActive(true);
    expect(model.diagnostics()).toMatchObject({ waves: 0, particles: 0, mechanism: { stage: 0, warriorVisible: false, gaiaVisible: false, missiles: 0 } });
    cleanup();
  });
  it('bounds 2000 packets with the same GPU object and expires every packet', () => {
    const group = new THREE.Group(), packets = new DataPackets(group), id = packets.mesh.geometry.uuid;
    for (let i = 0; i < 2000; i++) packets.emit(i % 8, 1.5, i % 3);
    packets.update(.016, false); expect(packets.active).toBe(48); expect(packets.mesh.geometry.uuid).toBe(id);
    packets.setLow(true); packets.update(.016, false); expect(packets.active).toBe(18);
    packets.update(.8, false); expect(packets.active).toBe(0); disposeObject(group);
  });
  it('keeps low quality, reduced motion and Challenge bounded', () => {
    const { model, input, key, advance, cleanup } = setup();
    model.setQuality(LOW_QUALITY);
    for (let i = 0; i < 100; i++) key(i % 2 ? 'KeyA' : 'KeyJ');
    expect(Number(model.diagnostics().mechanism!.packets)).toBeLessThanOrEqual(18);
    key('Space'); expect(model.diagnostics().particles).toBeLessThanOrEqual(30);
    model.reset(input); key('Enter', true); advance(2, true);
    expect(model.diagnostics()).toMatchObject({ particles: 0, waves: 0, signature: { active: false }, mechanism: { armorVisible: false } });
    model.setChallengeActive(true); key('Enter');
    expect(model.diagnostics()).toMatchObject({ particles: 0, waves: 0, signature: { active: false } }); cleanup();
  });
  it('keeps Challenge free of reactions and restores Playground evolution', () => {
    const { model, key, advance, cleanup } = setup();
    model.setChallengeActive(true); key('Enter');
    key('KeyA');
    advance(.05);
    expect(model.diagnostics().mechanism!.energy).toBe(0);
    expect(model.diagnostics().signature!.active).toBe(false);
    expect(model.diagnostics().recentKeys).toEqual([]);
    model.setChallengeActive(false); key('Enter'); advance(.7);
    expect(model.diagnostics().mechanism!.form).toBe('greymon'); cleanup();
  });
});
