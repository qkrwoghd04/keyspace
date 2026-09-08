import type { ThemeId } from '../themes/types';
import { soundKeyClass, synthesizeSound, type SoundKeyClass } from './soundProfiles';

export const MAX_VOICES = 16;
interface Voice { gain: GainNode; source: AudioBufferSourceNode | null; retiring: AudioBufferSourceNode | null; startedAt: number }

/** One optional audio engine. Samples and channel gains are reused across strikes. */
export class SwitchSound {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private voices: Voice[] = [];
  private readonly sources = new Set<AudioBufferSourceNode>();
  private enabled = false;
  private hidden = false;
  private volume = .5;
  private profile: ThemeId = 'studio';

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled) this.unlock();
    else {
      this.stopAll();
      if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0));
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume * .65, this.context.currentTime, .008);
  }

  setProfile(profile: ThemeId) {
    if (profile === this.profile) return;
    this.stopAll();
    this.profile = profile;
    if (this.context) this.prepare();
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (hidden) {
      this.stopAll();
      if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
    }
    // Resumption waits for the next actual interaction; it never starts an ambient sound.
  }

  private unlock() {
    if (!this.enabled || this.hidden) return;
    try {
      const Constructor = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return;
      if (!this.context || this.context.state === 'closed') {
        const context = this.context = new Constructor();
        this.master = context.createGain();
        this.master.gain.value = this.volume * .65;
        this.compressor = context.createDynamicsCompressor();
        this.compressor.threshold.value = -14;
        this.compressor.knee.value = 6;
        this.compressor.ratio.value = 16;
        this.compressor.attack.value = .001;
        this.compressor.release.value = .055;
        this.limiter = context.createWaveShaper();
        const curve = new Float32Array(4096);
        for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = Math.tanh(x * 1.5) * .5; }
        this.limiter.curve = curve;
        this.limiter.oversample = '2x';
        this.master.connect(this.compressor).connect(this.limiter).connect(context.destination);
        this.voices = Array.from({ length: MAX_VOICES }, () => {
          const gain = context.createGain(); gain.connect(this.master!);
          return { gain, source: null, retiring: null, startedAt: -Infinity };
        });
        this.prepare();
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // A blocked optional AudioContext must never interrupt native text editing.
    }
  }

  private bufferKey(keyClass: SoundKeyClass, release: boolean) { return this.profile + ':' + keyClass + ':' + Number(release); }

  private prepare() {
    const context = this.context;
    if (!context || context.state === 'closed') return;
    for (const keyClass of ['character', 'space', 'enter'] as const) for (const release of [false, true]) {
      const key = this.bufferKey(keyClass, release);
      if (this.buffers.has(key)) continue;
      const samples = synthesizeSound(this.profile, keyClass, release, context.sampleRate);
      const buffer = context.createBuffer(1, samples.length, context.sampleRate);
      buffer.copyToChannel(samples, 0);
      this.buffers.set(key, buffer);
    }
  }

  play(code: string, release = false) {
    if (!this.enabled || this.hidden || this.volume === 0) return;
    this.unlock();
    const context = this.context;
    if (!context || context.state !== 'running' || !this.voices.length) return;
    const buffer = this.buffers.get(this.bufferKey(soundKeyClass(code), release));
    if (!buffer) return;
    const now = context.currentTime;
    let voice = this.voices.find(slot => !slot.source);
    if (!voice) voice = this.voices.reduce((oldest, slot) => slot.startedAt < oldest.startedAt ? slot : oldest);
    let start = now;
    let envelope = true;
    if (voice.source) {
      if (voice.startedAt > now) {
        // A burst can replace a not-yet-started strike. Discard it immediately
        // instead of queuing arbitrarily many sources behind the same channel.
        start = voice.startedAt;
        this.discard(voice.source);
        envelope = false;
      } else {
        if (voice.retiring) this.discard(voice.retiring);
        // The incoming source starts only after the stolen voice's 5ms fade.
        start += .005;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, start);
        voice.retiring = voice.source;
        try { voice.source.stop(start); } catch { /* Already ended. */ }
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(voice.gain);
    if (envelope) {
      voice.gain.gain.setValueAtTime(0, start);
      voice.gain.gain.linearRampToValueAtTime(1, start + .001);
    }
    voice.source = source; voice.startedAt = start;
    this.sources.add(source);
    const slot = voice;
    source.onended = () => {
      source.disconnect(); this.sources.delete(source);
      if (slot.source === source) slot.source = null;
      if (slot.retiring === source) slot.retiring = null;
    };
    source.start(start);
    source.stop(start + buffer.duration);
  }

  private discard(source: AudioBufferSourceNode) {
    source.onended = null;
    try { source.stop(); } catch { /* Already ended. */ }
    source.disconnect();
    this.sources.delete(source);
  }

  stopAll() {
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Sources may have finished between events. */ }
      source.disconnect();
    }
    this.sources.clear();
    for (const voice of this.voices) {
      voice.source = voice.retiring = null;
      if (this.context) { voice.gain.gain.cancelScheduledValues(this.context.currentTime); voice.gain.gain.setValueAtTime(0, this.context.currentTime); }
    }
  }

  diagnostics() {
    return { enabled: this.enabled, volume: this.volume, profile: this.profile, voices: this.voices.filter(voice => voice.source).length, sources: this.sources.size, buffers: this.buffers.size, state: this.context?.state ?? 'not-created' };
  }

  dispose() {
    this.stopAll();
    this.enabled = false;
    for (const voice of this.voices) voice.gain.disconnect();
    this.voices = [];
    this.master?.disconnect(); this.compressor?.disconnect(); this.limiter?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = this.master = this.compressor = this.limiter = null;
    this.buffers.clear();
  }
}
