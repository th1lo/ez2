import { writeFileSync } from 'fs';
import { join, relative } from 'path';
import type { Session, SessionAnnotation } from './session.js';

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Assemble a markdown document from a session's transcription and annotations.
 * Writes transcript.md to the session directory and returns the file path.
 */
export function assembleMarkdown(session: Session, transcription: string): string {
  const lines: string[] = [];

  lines.push(`# ez2 session: ${session.sessionId}`);
  lines.push('');
  lines.push(`**Date:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`);
  lines.push('');

  // Transcription section
  lines.push('## Transcription');
  lines.push('');
  lines.push(transcription || '_No speech detected._');
  lines.push('');

  // Annotations + screenshots interleaved by timestamp
  const annotations: SessionAnnotation[] = [...session.annotations].sort(
    (a, b) => a.timestampMs - b.timestampMs,
  );

  if (annotations.length > 0) {
    lines.push('## Annotations');
    lines.push('');

    for (const annotation of annotations) {
      const ts = formatTimestamp(annotation.timestampMs);
      if (annotation.type === 'text') {
        lines.push(`**[${ts}]** ${annotation.text}`);
        lines.push('');
      } else {
        // Make path relative to session dir for portability
        const relPath = relative(session.sessionDir, annotation.filePath);
        lines.push(`**[${ts}]** Screenshot`);
        lines.push('');
        lines.push(`![screenshot at ${ts}](${relPath})`);
        lines.push('');
      }
    }
  }

  const markdown = lines.join('\n');
  const outputPath = join(session.sessionDir, 'transcript.md');
  writeFileSync(outputPath, markdown, 'utf-8');

  return outputPath;
}
