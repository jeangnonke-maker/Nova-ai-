import fs from 'node:fs';
import type { MusicMood } from '../../src/types/film';

/**
 * Generates a deterministic 24kHz 16-bit stereo WAV ambient film score
 * locally on the server with zero external paid APIs.
 */
export function writeAmbientMusicWav(
  outputPath: string,
  durationSec: number,
  mood: MusicMood,
): void {
  const sampleRate = 24000;
  const numChannels = 2;
  const bitsPerSample = 16;
  const totalSamples = Math.max(sampleRate, Math.round(durationSec * sampleRate));
  const dataByteLength = totalSamples * numChannels * (bitsPerSample / 8);

  const buffer = Buffer.alloc(44 + dataByteLength);

  // RIFF/WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataByteLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataByteLength, 40);

  if (mood === 'none') {
    fs.writeFileSync(outputPath, buffer);
    return;
  }

  // Harmonic chord progressions per cinema mood (Hz)
  const progressions: Record<Exclude<MusicMood, 'none'>, number[][]> = {
    noir: [
      [146.83, 220.0, 261.63, 329.63], // Dm9
      [130.81, 196.0, 246.94, 293.66], // Cmaj7
      [116.54, 174.61, 220.0, 261.63], // Bbmaj7
      [110.0, 164.81, 220.0, 277.18], // A7sus/add
    ],
    drama: [
      [174.61, 220.0, 261.63, 349.23], // Fmaj
      [130.81, 196.0, 261.63, 329.63], // Cmaj
      [146.83, 220.0, 261.63, 349.23], // Dm7
      [196.0, 246.94, 293.66, 392.0], // G
    ],
    suspense: [
      [110.0, 164.81, 233.08, 311.13], // Am b5 / tension
      [103.83, 155.56, 220.0, 293.66],
      [98.0, 146.83, 207.65, 293.66],
      [110.0, 164.81, 220.0, 329.63],
    ],
  };

  const chords = progressions[mood];
  const chordDurationSec = 4.0;

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const chordIndex = Math.floor(t / chordDurationSec) % chords.length;
    const nextChordIndex = (chordIndex + 1) % chords.length;
    const chordPhase = (t % chordDurationSec) / chordDurationSec;
    const crossfade = chordPhase > 0.8 ? (chordPhase - 0.8) / 0.2 : 0;

    const currentChord = chords[chordIndex];
    const nextChord = chords[nextChordIndex];

    let sampleL = 0;
    let sampleR = 0;

    for (let n = 0; n < currentChord.length; n++) {
      const f1 = currentChord[n];
      const f2 = nextChord[n];
      const freq = f1 * (1 - crossfade) + f2 * crossfade;
      const harmonic =
        Math.sin(2 * Math.PI * freq * t) * 0.65 +
        Math.sin(2 * Math.PI * (freq * 0.5) * t) * 0.35;
      const pan = 0.5 + (n % 2 === 0 ? -0.18 : 0.18);
      sampleL += harmonic * (1 - pan);
      sampleR += harmonic * pan;
    }

    // Gentle breathing LFO + pulse for suspense
    const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.22 * t);
    const pulse =
      mood === 'suspense'
        ? 0.8 + 0.2 * Math.pow(Math.abs(Math.sin(Math.PI * 1.0 * t)), 3)
        : 1.0;

    // Fade-in (1.2s) and fade-out (1.5s)
    const fadeIn = Math.min(1, t / 1.2);
    const fadeOut = Math.min(1, Math.max(0, (durationSec - t) / 1.5));
    const gain = 0.18 * lfo * pulse * fadeIn * fadeOut;

    const valL = Math.max(-1, Math.min(1, sampleL * gain));
    const valR = Math.max(-1, Math.min(1, sampleR * gain));

    const offset = 44 + i * 4;
    buffer.writeInt16LE(Math.round(valL * 32767), offset);
    buffer.writeInt16LE(Math.round(valR * 32767), offset + 2);
  }

  fs.writeFileSync(outputPath, buffer);
}
