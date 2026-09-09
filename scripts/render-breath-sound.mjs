import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { synthesizeSound } = await server.ssrLoadModule('/src/input/soundProfiles.ts');
  const { synthesizeAwakening } = await server.ssrLoadModule('/src/themes/demon-slayer/sound.ts');
  const rate = 48000, samples = new Float32Array(rate * 9), timeline = [], metrics = [];
  const insert = (signal, at) => { const offset = Math.round(at * rate); signal.forEach((value, i) => { samples[offset + i] += value * .325; }); };
  for (const [mode, at] of [['water', 0], ['sun', 4.5]]) {
    timeline.push({ mode, startsAtSeconds: at, description: 'character, Space, Enter, short flowing burst' });
    for (const [i, key] of ['character', 'space', 'enter'].entries()) {
      const sound = synthesizeSound('demon-slayer', key, false, rate, mode);
      insert(sound, at + .2 + i * .48); insert(synthesizeSound('demon-slayer', key, true, rate, mode), at + .28 + i * .48);
      let energy = 0, peak = 0; for (const value of sound) { energy += value * value; peak = Math.max(peak, Math.abs(value)); }
      metrics.push({ mode, key, peak, rms: Math.sqrt(energy / sound.length), duration: sound.length / rate });
    }
    for (let i = 0; i < 16; i++) insert(synthesizeSound('demon-slayer', 'character', false, rate, mode), at + 2 + i * .085);
  }
  insert(synthesizeAwakening(rate), 3.8); timeline.push({ mode: 'awakening', startsAtSeconds: 3.8, duration: .28 });
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  await mkdir('artifacts/breath', { recursive: true });
  await writeFile('artifacts/breath/sound-comparison.wav', wav);
  await writeFile('artifacts/breath/sound-report.json', JSON.stringify({ timeline, metrics, note: 'Synthesized source preview at 50% master gain, not an acoustic or post-compressor recording. Listening review separate.' }, null, 2));
  console.log(JSON.stringify({ seconds: 9, metrics }));
} finally { await server.close(); }
