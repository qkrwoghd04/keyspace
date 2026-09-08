import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false } });
try {
  const { SOUND_PROFILES, synthesizeSound } = await server.ssrLoadModule('/src/input/soundProfiles.ts');
  const ids = Object.keys(SOUND_PROFILES), rate = 48000, slotDuration = 1.8;
  const samples = new Float32Array(Math.ceil(rate * slotDuration * ids.length));
  const timeline = [];
  ids.forEach((id, index) => {
    timeline.push({ theme: id, startsAtSeconds: index * slotDuration, keys: ['character', 'space', 'enter'] });
    ['character', 'space', 'enter'].forEach((key, keyIndex) => {
      for (const release of [false, true]) {
        const sound = synthesizeSound(id, key, release, rate);
        const offset = Math.floor((index * slotDuration + keyIndex * .44 + (release ? .08 : 0)) * rate);
        sound.forEach((value, i) => { samples[offset + i] += value * .65; });
      }
    });
  });
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((value, i) => wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2));
  await mkdir('artifacts/audio', { recursive: true });
  await writeFile('artifacts/audio/material-comparison.wav', wav);
  await writeFile('artifacts/audio/timeline.json', JSON.stringify(timeline, null, 2));
  console.log(`Rendered ${ids.length} original synthesis profiles, ${samples.length / rate}s. Listening review is separate.`);
} finally { await server.close(); }
