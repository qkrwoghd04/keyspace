/** A tiny, locally synthesized switch sound. No audio files or network requests. */
export class SwitchSound {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled) this.unlock();
  }

  private unlock(): void {
    if (!this.enabled) return;
    try {
      const AudioContextConstructor = window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextConstructor) return;
      if (!this.context || this.context.state === 'closed') {
        this.context = new AudioContextConstructor();
        this.noise = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * 0.035), this.context.sampleRate);
        const channel = this.noise.getChannelData(0);
        for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch {
      // Sound is optional; audio restrictions must never interrupt typing.
    }
  }

  play(code: string, release = false): void {
    if (!this.enabled) return;
    this.unlock();
    const context = this.context;
    if (!context || context.state !== 'running' || !this.noise) return;
    const now = context.currentTime;
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    const transient = context.createBufferSource();
    const body = context.createOscillator();
    const bodyEnvelope = context.createGain();
    const wide = code === 'Space' || code === 'Enter' || code === 'Backspace';

    output.gain.setValueAtTime(release ? 0.025 : 0.055, now);
    output.gain.exponentialRampToValueAtTime(0.0001, now + (release ? 0.026 : 0.052));
    output.connect(context.destination);
    filter.type = 'bandpass';
    filter.frequency.value = release ? 2400 : wide ? 1150 : 1550;
    filter.Q.value = 0.7;
    filter.connect(output);
    transient.buffer = this.noise;
    transient.connect(filter);
    transient.start(now);

    body.type = 'sine';
    body.frequency.setValueAtTime(wide ? 270 : 380, now);
    body.frequency.exponentialRampToValueAtTime(wide ? 110 : 145, now + 0.035);
    bodyEnvelope.gain.setValueAtTime(release ? 0.2 : 0.7, now);
    bodyEnvelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
    body.connect(bodyEnvelope).connect(output);
    body.start(now);
    body.stop(now + 0.055);
    body.onended = () => {
      transient.disconnect();
      filter.disconnect();
      body.disconnect();
      bodyEnvelope.disconnect();
      output.disconnect();
    };
  }

  dispose(): void {
    this.enabled = false;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.noise = null;
  }
}
