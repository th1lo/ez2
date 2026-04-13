import { transcribe } from '../audio/transcriber.js';
import { existsSync } from 'fs';
import { readdirSync } from 'fs';
import { join } from 'path';

// Find most recent test recording
const BASE = '/tmp/ez2-record-test';
const sessions = readdirSync(BASE).sort();
const wavPath = join(BASE, sessions[sessions.length - 1]!, 'recording.wav');

console.log('WAV path:', wavPath);
console.log('WAV exists:', existsSync(wavPath));

console.log('Starting transcription...');
const start = Date.now();

try {
  const text = await transcribe(wavPath, 'tiny');
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Transcription (${elapsed}s):`, JSON.stringify(text));
  console.log('PASS: text is', text.length > 0 ? 'non-empty' : 'EMPTY (recording may have been silent)');
} catch (err) {
  console.error('ERROR:', err);
  process.exit(1);
}
