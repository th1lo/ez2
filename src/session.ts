import { mkdirSync, writeFileSync, openSync, writeSync, closeSync } from 'fs';
import { join, resolve } from 'path';

/** WAV RIFF header for 16kHz, 1 channel, 16-bit PCM */
function buildWavHeader(dataByteLength: number): Buffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8); // 32000
  const blockAlign = numChannels * (bitsPerSample / 8);            // 2
  const chunkSize = 36 + dataByteLength;                           // RIFF chunk size

  const header = Buffer.alloc(44);
  let off = 0;

  // RIFF chunk descriptor
  header.write('RIFF', off); off += 4;
  header.writeUInt32LE(chunkSize, off); off += 4;
  header.write('WAVE', off); off += 4;

  // fmt sub-chunk
  header.write('fmt ', off); off += 4;
  header.writeUInt32LE(16, off); off += 4;          // PCM sub-chunk size
  header.writeUInt16LE(1, off); off += 2;            // AudioFormat: PCM
  header.writeUInt16LE(numChannels, off); off += 2;
  header.writeUInt32LE(sampleRate, off); off += 4;
  header.writeUInt32LE(byteRate, off); off += 4;
  header.writeUInt16LE(blockAlign, off); off += 2;
  header.writeUInt16LE(bitsPerSample, off); off += 2;

  // data sub-chunk
  header.write('data', off); off += 4;
  header.writeUInt32LE(dataByteLength, off);

  return header;
}

export type SessionAnnotation =
  | { type: 'text'; timestampMs: number; text: string }
  | { type: 'screenshot'; timestampMs: number; filePath: string };

export interface SessionMeta {
  sessionId: string;
  startedAt: string;
  durationMs: number;
  wavPath: string;
  annotations: SessionAnnotation[];
}

export class Session {
  readonly sessionId: string;
  readonly sessionDir: string;
  readonly wavPath: string;
  readonly metaPath: string;

  private readonly startedAt: Date;
  private readonly chunks: Buffer[] = [];
  private totalBytes = 0;
  readonly annotations: SessionAnnotation[] = [];

  constructor(outputDir: string) {
    this.startedAt = new Date();
    this.sessionId = formatSessionId(this.startedAt);

    const base = resolve(outputDir);
    this.sessionDir = join(base, this.sessionId);
    this.wavPath = join(this.sessionDir, 'recording.wav');
    this.metaPath = join(this.sessionDir, 'session.json');

    mkdirSync(join(this.sessionDir, 'screenshots'), { recursive: true });
  }

  addPcmChunk(buf: Buffer): void {
    this.chunks.push(buf);
    this.totalBytes += buf.length;
  }

  addAnnotation(text: string, elapsedMs: number): void {
    this.annotations.push({ type: 'text', timestampMs: elapsedMs, text });
  }

  addScreenshot(filePath: string, elapsedMs: number): void {
    this.annotations.push({ type: 'screenshot', timestampMs: elapsedMs, filePath });
  }

  finalize(durationMs: number): void {
    // Write WAV file
    const header = buildWavHeader(this.totalBytes);
    const fd = openSync(this.wavPath, 'w');
    try {
      writeSync(fd, header);
      for (const chunk of this.chunks) {
        writeSync(fd, chunk);
      }
    } finally {
      closeSync(fd);
    }

    // Write session metadata
    const meta: SessionMeta = {
      sessionId: this.sessionId,
      startedAt: this.startedAt.toISOString(),
      durationMs,
      wavPath: this.wavPath,
      annotations: this.annotations,
    };
    writeFileSync(this.metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }
}

function formatSessionId(d: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `_${pad(d.getHours())}-${pad(d.getMinutes())}`
  );
}
