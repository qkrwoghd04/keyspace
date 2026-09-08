import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_VOICES, SwitchSound } from './SwitchSound';

class Param {
  value = 0;
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  linearRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
  cancelScheduledValues = vi.fn();
}
class Node {
  gain = new Param(); threshold = new Param(); knee = new Param(); ratio = new Param(); attack = new Param(); release = new Param();
  connect(node: unknown) { return node; }
  disconnect = vi.fn();
}
class Source extends Node { buffer: unknown; onended: (() => void) | null = null; start = vi.fn(); stop = vi.fn(); }
class Context {
  state = 'running'; currentTime = 0; sampleRate = 24000; destination = new Node();
  createGain = () => new Node(); createDynamicsCompressor = () => new Node(); createWaveShaper = () => new Node();
  createBufferSource = () => new Source();
  createBuffer = (_channels: number, length: number, sampleRate: number) => ({ duration: length / sampleRate, copyToChannel: vi.fn() });
  resume = vi.fn(async () => { this.state = 'running'; });
  suspend = vi.fn(async () => { this.state = 'suspended'; });
  close = vi.fn(async () => { this.state = 'closed'; });
}

describe('bounded optional audio engine', () => {
  let sound: SwitchSound;
  beforeEach(() => { vi.stubGlobal('AudioContext', Context); sound = new SwitchSound(); });
  afterEach(() => { sound.dispose(); vi.unstubAllGlobals(); });

  it('stays silent and uninitialized by default', () => {
    sound.play('KeyA'); sound.setProfile('inferno');
    expect(sound.diagnostics()).toMatchObject({ enabled: false, state: 'not-created', voices: 0, buffers: 0 });
  });

  it('caps channels under a simultaneous burst and disconnects every source on reset', () => {
    sound.setEnabled(true);
    for (let i = 0; i < 2000; i++) sound.play('KeyA');
    expect(sound.diagnostics().voices).toBe(MAX_VOICES);
    expect(sound.diagnostics().sources).toBeLessThanOrEqual(MAX_VOICES * 2);
    sound.stopAll();
    expect(sound.diagnostics()).toMatchObject({ voices: 0, sources: 0 });
  });

  it('keeps mute and volume while switching material and bounds the buffer cache', () => {
    sound.setEnabled(true); sound.setVolume(.27); sound.play('KeyA'); sound.setProfile('jelly');
    expect(sound.diagnostics()).toMatchObject({ enabled: true, volume: .27, profile: 'jelly', sources: 0, voices: 0, buffers: 12 });
    sound.setEnabled(false); sound.setProfile('glass'); sound.play('Enter');
    expect(sound.diagnostics()).toMatchObject({ enabled: false, volume: .27, profile: 'glass', sources: 0 });
    sound.setProfile('jelly'); expect(sound.diagnostics().buffers).toBe(18);
  });

  it('stops and suspends in a hidden tab, then waits for an interaction', () => {
    sound.setEnabled(true); sound.play('Space'); sound.setHidden(true); sound.play('KeyA');
    expect(sound.diagnostics()).toMatchObject({ state: 'suspended', sources: 0 });
    sound.setHidden(false); expect(sound.diagnostics().state).toBe('suspended');
    sound.play('KeyA'); expect(sound.diagnostics().state).toBe('running');
  });

  it('can reconnect after disposal without duplicating channels or buffers', () => {
    sound.setEnabled(true); sound.dispose(); sound.setEnabled(true); sound.play('KeyA');
    expect(sound.diagnostics()).toMatchObject({ voices: 1, buffers: 6 });
  });
});
