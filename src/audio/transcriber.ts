import { fork } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { manager } from 'smart-whisper';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, 'whisperWorker.js');

interface TranscribeSegment {
  from: number;
  to: number;
  text: string;
}

interface WorkerOutput {
  segments?: TranscribeSegment[];
  error?: string;
}

/**
 * Transcribe a WAV file using Whisper in a forked child process.
 *
 * We use fork (not Worker threads) so we can suppress the child's stderr —
 * ggml/Metal emits hundreds of noisy-but-benign allocator warnings to fd 2
 * that would otherwise flood the terminal during transcription.
 *
 * Returns the full transcription as a single string.
 */
const TRANSCRIBE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function transcribe(wavPath: string, modelName: string, language = 'auto'): Promise<string> {
  return new Promise((resolve, reject) => {
    let modelPath: string;
    try {
      modelPath = manager.resolve(modelName);
    } catch {
      reject(new Error(`Model '${modelName}' not found. Run ez2 setup to download it.`));
      return;
    }

    // In dev (tsx), use the .ts source; in production use the compiled .js.
    const workerSrc = WORKER_PATH.endsWith('.js') && !WORKER_PATH.includes('/dist/')
      ? WORKER_PATH.replace(/\.js$/, '.ts')
      : WORKER_PATH;

    const child = fork(workerSrc, [], {
      execArgv: ['--import', 'tsx/esm'],
      // 'ignore' redirects child stderr to /dev/null, suppressing ggml's native Metal
      // allocator warnings which otherwise flood the terminal during transcription.
      stdio: ['inherit', 'inherit', 'ignore', 'ipc'],
    });

    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill();
      fn();
    };

    const timer = setTimeout(() => {
      settle(() => reject(new Error('Transcription timed out after 5 minutes')));
    }, TRANSCRIBE_TIMEOUT_MS);

    child.send({ wavPath, modelPath, language });

    child.on('message', (msg: WorkerOutput) => {
      if (msg.error) {
        settle(() => reject(new Error(msg.error)));
      } else if (msg.segments) {
        const text = msg.segments
          .map((s) => s.text.trim())
          .filter(Boolean)
          .join(' ');
        settle(() => resolve(text));
      } else {
        settle(() => reject(new Error('Whisper child returned unexpected output')));
      }
    });

    child.on('error', (err) => {
      settle(() => reject(err));
    });

    child.on('exit', (code, signal) => {
      if (!settled) {
        const desc = signal ? `signal ${signal}` : `code ${code}`;
        settle(() => reject(new Error(`Whisper process exited (${desc}) without returning a result`)));
      }
    });
  });
}
