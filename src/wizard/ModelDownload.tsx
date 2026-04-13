import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { Spinner } from '../components/Spinner.js';

/** smart-whisper stores models here */
const SMART_WHISPER_MODELS_DIR = join(homedir(), '.smart-whisper', 'models');
const BASE_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main';

interface ModelOption {
  name: string;
  label: string;
  sizeMB: number;
  quality: string;
  fileName: string;
  url: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  {
    name: 'tiny',
    label: 'Tiny',
    sizeMB: 75,
    quality: 'Fast, good enough for most use',
    fileName: 'tiny.bin',
    url: `${BASE_URL}/ggml-tiny.bin`,
  },
  {
    name: 'base',
    label: 'Base',
    sizeMB: 142,
    quality: 'Better accuracy, still quick',
    fileName: 'base.bin',
    url: `${BASE_URL}/ggml-base.bin`,
  },
  {
    name: 'small',
    label: 'Small',
    sizeMB: 466,
    quality: 'High accuracy, slower on older machines',
    fileName: 'small.bin',
    url: `${BASE_URL}/ggml-small.bin`,
  },
];

interface ProgressState {
  receivedBytes: number;
  totalBytes: number;
  speed: number; // bytes/sec
}

interface ModelDownloadProps {
  onComplete: (modelName: string) => void;
  initialModelName?: string;
}

type State =
  | { kind: 'picking'; cursor: number }
  | { kind: 'downloading'; model: ModelOption; progress: ProgressState }
  | { kind: 'done'; modelName: string }
  | { kind: 'error'; message: string };

export function ModelDownload({ onComplete, initialModelName }: ModelDownloadProps) {
  const initialCursor = initialModelName
    ? Math.max(0, MODEL_OPTIONS.findIndex((m) => m.name === initialModelName))
    : 0;
  const [state, setState] = useState<State>({ kind: 'picking', cursor: initialCursor });

  const startDownload = useCallback(async (model: ModelOption) => {
    mkdirSync(SMART_WHISPER_MODELS_DIR, { recursive: true });
    const destPath = join(SMART_WHISPER_MODELS_DIR, model.fileName);

    // Skip download if already on disk
    if (existsSync(destPath)) {
      setState({ kind: 'done', modelName: model.name });
      setTimeout(() => onComplete(model.name), 400);
      return;
    }

    setState({
      kind: 'downloading',
      model,
      progress: { receivedBytes: 0, totalBytes: model.sizeMB * 1024 * 1024, speed: 0 },
    });

    try {

      const res = await fetch(model.url);
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const contentLength = res.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : model.sizeMB * 1024 * 1024;

      const stream = createWriteStream(destPath);
      let receivedBytes = 0;
      let lastMark = Date.now();
      let lastBytes = 0;

      await new Promise<void>((resolve, reject) => {
        const readable = Readable.fromWeb(res.body as import('stream/web').ReadableStream<Uint8Array>);

        readable.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          stream.write(chunk);

          const now = Date.now();
          const elapsed = (now - lastMark) / 1000;
          if (elapsed >= 0.25) {
            const speed = (receivedBytes - lastBytes) / elapsed;
            lastMark = now;
            lastBytes = receivedBytes;
            setState({
              kind: 'downloading',
              model,
              progress: { receivedBytes, totalBytes, speed },
            });
          }
        });

        readable.on('end', () => {
          stream.end();
          stream.on('finish', resolve);
        });

        readable.on('error', reject);
        stream.on('error', reject);
      });

      setState({ kind: 'done', modelName: model.name });
      setTimeout(() => onComplete(model.name), 400);
    } catch (err) {
      setState({ kind: 'error', message: String(err) });
    }
  }, [onComplete]);

  useInput((input, key) => {
    if (state.kind !== 'picking') return;

    if (key.upArrow) {
      setState({ kind: 'picking', cursor: Math.max(0, state.cursor - 1) });
    } else if (key.downArrow) {
      setState({ kind: 'picking', cursor: Math.min(MODEL_OPTIONS.length - 1, state.cursor + 1) });
    } else if (key.return) {
      startDownload(MODEL_OPTIONS[state.cursor]!);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold color="cyan">
          Select Whisper model
        </Text>
        {state.kind === 'picking' && (
          <Text dimColor>Use ↑↓ to navigate · Enter to download</Text>
        )}
      </Box>

      {state.kind === 'picking' && (
        <Box flexDirection="column">
          {MODEL_OPTIONS.map((opt, idx) => {
            const selected = idx === state.cursor;
            return (
              <Box key={opt.name} flexDirection="column" marginBottom={0}>
                <Box>
                  <Text color={selected ? 'cyan' : undefined}>
                    {selected ? '▶ ' : '  '}
                    <Text bold={selected}>{opt.label}</Text>
                    {'  '}
                  </Text>
                  <Text dimColor>{opt.sizeMB} MB</Text>
                </Box>
                {selected && (
                  <Box marginLeft={4}>
                    <Text dimColor>{opt.quality}</Text>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {state.kind === 'downloading' && (
        <DownloadProgress model={state.model} progress={state.progress} />
      )}

      {state.kind === 'done' && (
        <Box>
          <Text color="green">[✔] {state.modelName} downloaded</Text>
        </Box>
      )}

      {state.kind === 'error' && (
        <Box flexDirection="column" gap={1}>
          <Text color="red">[✖] Download failed</Text>
          <Text dimColor>{state.message}</Text>
        </Box>
      )}
    </Box>
  );
}

interface DownloadProgressProps {
  model: ModelOption;
  progress: ProgressState;
}

const BAR_WIDTH = 30;

function DownloadProgress({ model, progress }: DownloadProgressProps) {
  const { receivedBytes, totalBytes, speed } = progress;
  const pct = totalBytes > 0 ? Math.min(1, receivedBytes / totalBytes) : 0;
  const filled = Math.round(pct * BAR_WIDTH);
  const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
  const mbReceived = (receivedBytes / 1024 / 1024).toFixed(1);
  const mbTotal = (totalBytes / 1024 / 1024).toFixed(0);
  const pctStr = (pct * 100).toFixed(0).padStart(3);
  const speedStr =
    speed > 1024 * 1024
      ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
      : `${(speed / 1024).toFixed(0)} KB/s`;

  return (
    <Box flexDirection="column" gap={0}>
      <Box>
        <Spinner />
        <Text> Downloading {model.label}…</Text>
      </Box>
      <Box>
        <Text color="cyan">{bar}</Text>
        <Text> {pctStr}%</Text>
      </Box>
      <Box>
        <Text dimColor>
          {mbReceived} / {mbTotal} MB
        </Text>
        {speed > 0 && (
          <Text dimColor>  {speedStr}</Text>
        )}
      </Box>
    </Box>
  );
}
