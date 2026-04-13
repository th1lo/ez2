/**
 * Whisper transcription child process.
 * Receives { wavPath, modelPath } via IPC from parent, sends { segments } or { error }.
 *
 * Run via child_process.fork so the parent can suppress this process's stderr,
 * which ggml/Metal uses to emit noisy-but-benign allocator warnings.
 */
import { readFileSync } from 'fs';
import { Whisper } from 'smart-whisper';

interface WorkerInput {
  wavPath: string;
  modelPath: string;
  language: string;
}

interface TranscribeSegment {
  from: number;
  to: number;
  text: string;
}

interface WorkerOutput {
  segments?: TranscribeSegment[];
  error?: string;
}

process.on('message', async (msg: WorkerInput) => {
  try {
    const { wavPath, modelPath, language = 'auto' } = msg;

    const wavBuf = readFileSync(wavPath);
    const pcm = wavToFloat32(wavBuf);

    const whisper = new Whisper(modelPath, { gpu: true });

    const task = await whisper.transcribe(pcm, {
      language,
      format: 'simple',
    });

    const segments = await task.result as TranscribeSegment[];

    await whisper.free();

    process.send!({ segments } satisfies WorkerOutput);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.send!({ error: message } satisfies WorkerOutput);
  }
});

/** Convert 16-bit signed PCM WAV (with 44-byte RIFF header) to Float32Array. */
function wavToFloat32(buf: Buffer): Float32Array {
  const WAV_HEADER_BYTES = 44;
  const pcmBuf = buf.subarray(WAV_HEADER_BYTES);
  const samples = pcmBuf.length >> 1; // 2 bytes per 16-bit sample
  const float32 = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    float32[i] = pcmBuf.readInt16LE(i * 2) / 32768;
  }
  return float32;
}
