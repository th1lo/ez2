import { createRequire } from 'module';

const require = createRequire(import.meta.url);

interface AudioIOOptions {
  inOptions: {
    channelCount: number;
    sampleFormat: number;
    sampleRate: number;
    deviceId: number;
    closeOnError: boolean;
    framesPerBuffer?: number;
  };
}

interface PortAudioModule {
  AudioIO: new (opts: AudioIOOptions) => NodeJS.ReadableStream & { start(): void; quit(): void };
  SampleFormat16Bit: number;
}

export interface AudioRecorderOptions {
  deviceId: number;
  sampleRate?: number;
  onChunk: (buf: Buffer) => void;
  onLevel: (rms: number) => void;
  onError?: (err: Error) => void;
}

const LEVEL_THROTTLE_MS = 16; // ~60fps

/**
 * Wraps naudiodon AudioIO as a simple start/pause/resume/stop service.
 * Pause gates chunk + level callbacks without closing the PortAudio stream.
 * RMS is computed from 16-bit signed PCM and normalized to 0–1.
 */
export class AudioRecorder {
  private readonly opts: Required<AudioRecorderOptions>;
  private stream: (NodeJS.ReadableStream & { start(): void; quit(): void }) | null = null;
  private paused = false;
  private lastLevelAt = 0;
  private _stopped = false;

  constructor(opts: AudioRecorderOptions) {
    this.opts = {
      sampleRate: 16000,
      onError: (err) => console.error('[recorder]', err),
      ...opts,
    };
  }

  start(): void {
    if (this.stream) return;

    const portAudio = require('naudiodon') as PortAudioModule;

    const ai = new portAudio.AudioIO({
      inOptions: {
        channelCount: 1,
        sampleFormat: portAudio.SampleFormat16Bit,
        sampleRate: this.opts.sampleRate,
        deviceId: this.opts.deviceId,
        closeOnError: false,
        framesPerBuffer: 256, // ~16ms at 16kHz — small buffer for responsive meter
      },
    });

    ai.on('data', (buf: Buffer) => {
      if (this.paused || this._stopped) return;

      this.opts.onChunk(buf);

      const now = Date.now();
      if (now - this.lastLevelAt >= LEVEL_THROTTLE_MS) {
        this.lastLevelAt = now;
        this.opts.onLevel(computeRms(buf));
      }
    });

    ai.on('error', (err: Error) => {
      this.opts.onError(err);
    });

    this.stream = ai;
    ai.start();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this._stopped = true;
      if (!this.stream) {
        resolve();
        return;
      }
      // quit() stops the stream; give the event loop one tick to drain
      this.stream.quit();
      setImmediate(resolve);
    });
  }
}

/** Compute RMS from a 16-bit signed PCM buffer, normalized 0–1. */
function computeRms(buf: Buffer): number {
  if (buf.length < 2) return 0;

  const samples = buf.length >> 1; // 2 bytes per sample
  let sumSq = 0;

  for (let i = 0; i < buf.length - 1; i += 2) {
    const sample = buf.readInt16LE(i) / 32768;
    sumSq += sample * sample;
  }

  return Math.sqrt(sumSq / samples);
}
