/** Suppress intermediate IME values and deduplicate compositionend + final input. */
export class CompositionGate {
  composing = false;
  private committed = '';
  begin() { this.composing = true; }
  reset(value = '') { this.composing = false; this.committed = value.normalize('NFC'); }
  input(value: string, nativeComposing = false) {
    if (this.composing || nativeComposing) return null;
    return this.accept(value);
  }
  end(value: string) { this.composing = false; return this.accept(value); }
  private accept(value: string) {
    const normalized = value.normalize('NFC');
    if (normalized === this.committed) return null;
    this.committed = normalized;
    return normalized;
  }
}
