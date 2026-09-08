/** One immediate, non-queued hero gesture. Repeated requests never extend it. */
export class Signature {
  kind: 'enter' | 'space' = 'enter';
  starts = 0;
  allowed = true;
  private elapsed = Infinity;
  constructor(readonly duration = 1.15, readonly cooldown = .2) {}
  get active() { return this.elapsed < this.duration; }
  get progress() { return Math.min(1, this.elapsed / this.duration); }
  get envelope() { return this.active ? Math.sin(Math.PI * this.progress) : 0; }
  start(code: string, reduced: boolean) {
    if (!this.allowed || reduced || (code !== 'Enter' && code !== 'Space') || this.elapsed < this.duration + this.cooldown) return false;
    this.kind = code === 'Enter' ? 'enter' : 'space';
    this.elapsed = 0;
    this.starts++;
    return true;
  }
  update(delta: number, reduced: boolean) { this.elapsed = reduced ? Infinity : this.elapsed + delta; return this.active; }
  reset() { this.elapsed = Infinity; }
  diagnostics() { return { active: this.active, kind: this.kind, progress: this.progress, starts: this.starts, queued: 0 as const }; }
}
