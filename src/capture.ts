import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Launch macOS screencapture in interactive (-i) mode and save the result as a PNG.
 * Resolves with the saved file path, rejects if the user cancels (exit 1) or an error occurs.
 */
export function captureScreenshot(sessionDir: string, label: string): Promise<string> {
  const fileName = `screenshot-${label}.png`;
  const filePath = join(sessionDir, 'screenshots', fileName);

  return new Promise((resolve, reject) => {
    // -i = interactive crosshair selector, -x = no sound
    const proc = spawn('screencapture', ['-i', '-x', filePath], { stdio: 'inherit' });

    proc.on('error', (err) => reject(err));

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(filePath);
      } else {
        reject(new Error(`screencapture exited with code ${code} (user may have cancelled)`));
      }
    });
  });
}
