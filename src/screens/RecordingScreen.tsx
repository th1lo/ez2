import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { AudioRecorder } from '../audio/recorder.js';
import { Session } from '../session.js';
import { transcribe as transcribeAudio } from '../audio/transcriber.js';
import { captureScreenshot } from '../capture.js';
import { assembleMarkdown } from '../assemble.js';
import { Spinner } from '../components/Spinner.js';
import { TextInput } from '../components/TextInput.js';
import type { Config } from '../config.js';

type RecordingState =
  | 'READY'
  | 'RECORDING'
  | 'PAUSED'
  | 'CAPTURING'
  | 'ANNOTATING'
  | 'SAVING'
  | 'SAVED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'TRANSCRIBE_ERROR'
  | 'ASSEMBLING'
  | 'ASSEMBLED'
  | 'ERROR';

const VU_WIDTH = 24;
const VU_FILLED = '█';
const VU_EMPTY = '░';

function buildVuBar(level: number): string {
  // Apply a mild log scale so quiet speech still shows movement
  const scaled = Math.min(1, Math.pow(level * 3, 0.6));
  const filled = Math.round(scaled * VU_WIDTH);
  return VU_FILLED.repeat(filled) + VU_EMPTY.repeat(VU_WIDTH - filled);
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface RecordingScreenProps {
  config: Config;
  outputDir: string;
  onOpenSettings?: () => void;
}

export function RecordingScreen({ config, outputDir, onOpenSettings }: RecordingScreenProps) {
  const [recordState, setRecordState] = useState<RecordingState>('READY');
  const [vuLevel, setVuLevel] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [savedPath, setSavedPath] = useState('');
  const [transcription, setTranscription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [lastScreenshot, setLastScreenshot] = useState('');
  const [lastAnnotation, setLastAnnotation] = useState('');
  const [assembledPath, setAssembledPath] = useState('');

  const preAnnotationStateRef = useRef<RecordingState>('RECORDING');
  const { stdout } = useStdout();

  const recorderRef = useRef<AudioRecorder | null>(null);
  const sessionRef = useRef<Session | null>(null);

  // Timer — counts elapsed recording time (pauses when paused)
  const timerStartRef = useRef<number>(0);
  const accumulatedRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    timerStartRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - timerStartRef.current));
    }, 100);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    accumulatedRef.current += Date.now() - timerStartRef.current;
  }, []);

  // Decay VU toward 0 when paused/not active
  useEffect(() => {
    if (recordState !== 'RECORDING') {
      const id = setInterval(() => setVuLevel((v) => Math.max(0, v * 0.85)), 50);
      return () => clearInterval(id);
    }
  }, [recordState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const handleStart = useCallback(() => {
    if (recordState !== 'READY') return;

    const session = new Session(outputDir);
    sessionRef.current = session;

    const recorder = new AudioRecorder({
      deviceId: config.mic.deviceId,
      onChunk: (buf) => session.addPcmChunk(buf),
      onLevel: (rms) => setVuLevel(rms),
      onError: (err) => {
        setErrorMsg(err.message);
        setRecordState('ERROR');
      },
    });
    recorderRef.current = recorder;

    try {
      recorder.start();
      setRecordState('RECORDING');
      startTimer();
    } catch (err) {
      setErrorMsg(String(err));
      setRecordState('ERROR');
    }
  }, [recordState, config, outputDir, startTimer]);

  const handlePause = useCallback(() => {
    if (recordState !== 'RECORDING') return;
    recorderRef.current?.pause();
    pauseTimer();
    setRecordState('PAUSED');
  }, [recordState, pauseTimer]);

  const handleResume = useCallback(() => {
    if (recordState !== 'PAUSED') return;
    recorderRef.current?.resume();
    startTimer();
    setRecordState('RECORDING');
  }, [recordState, startTimer]);

  const handleStop = useCallback(async () => {
    if (recordState !== 'RECORDING' && recordState !== 'PAUSED') return;
    setRecordState('SAVING');

    if (recordState === 'RECORDING') pauseTimer();

    const finalMs = accumulatedRef.current;
    await recorderRef.current?.stop();
    sessionRef.current?.finalize(finalMs);

    setSavedPath(sessionRef.current?.sessionDir ?? '');
    setRecordState('SAVED');
  }, [recordState, pauseTimer]);

  const handleAssemble = useCallback(async () => {
    if (recordState !== 'TRANSCRIBED') return;
    const session = sessionRef.current;
    if (!session) return;

    setRecordState('ASSEMBLING');
    try {
      const path = assembleMarkdown(session, transcription);
      setAssembledPath(path);
      setRecordState('ASSEMBLED');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setRecordState('TRANSCRIBED');
    }
  }, [recordState, transcription]);

  const handleAnnotate = useCallback(() => {
    if (recordState !== 'RECORDING' && recordState !== 'PAUSED') return;
    preAnnotationStateRef.current = recordState;
    setRecordState('ANNOTATING');
  }, [recordState]);

  const handleAnnotationSubmit = useCallback((text: string) => {
    if (text) {
      const elapsed = accumulatedRef.current + (preAnnotationStateRef.current === 'RECORDING' ? Date.now() - timerStartRef.current : 0);
      sessionRef.current?.addAnnotation(text, elapsed);
      setLastAnnotation(text.length > 40 ? text.slice(0, 40) + '…' : text);
    }
    setRecordState(preAnnotationStateRef.current);
  }, []);

  const handleAnnotationCancel = useCallback(() => {
    setRecordState(preAnnotationStateRef.current);
  }, []);

  const handleCapture = useCallback(async () => {
    if (recordState !== 'RECORDING' && recordState !== 'PAUSED') return;
    const session = sessionRef.current;
    if (!session) return;

    const preCaptureState = recordState;
    setRecordState('CAPTURING');

    // Clear terminal so screencapture crosshair is unobstructed
    stdout.write('\x1B[2J\x1B[H');

    const label = String(Date.now());
    try {
      const filePath = await captureScreenshot(session.sessionDir, label);
      session.addScreenshot(filePath, accumulatedRef.current + (preCaptureState === 'RECORDING' ? Date.now() - timerStartRef.current : 0));
      setLastScreenshot(filePath.split('/').pop() ?? filePath);
    } catch {
      // User cancelled or error — silently ignore
    }

    setRecordState(preCaptureState);
  }, [recordState, stdout]);

  const handleTranscribe = useCallback(async () => {
    if (recordState !== 'SAVED') return;
    const session = sessionRef.current;
    if (!session) return;

    setRecordState('TRANSCRIBING');
    try {
      const text = await transcribeAudio(session.wavPath, config.model, config.language ?? 'auto');
      setTranscription(text || '(no speech detected)');
      setRecordState('TRANSCRIBED');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setRecordState('TRANSCRIBE_ERROR');
    }
  }, [recordState, config.model]);

  useInput((input, key) => {
    if (recordState === 'READY' && input === 'e') {
      onOpenSettings?.();
      return;
    }
    if (recordState === 'READY' && input === 's') {
      handleStart();
    } else if (recordState === 'RECORDING' && input === 'p') {
      handlePause();
    } else if (recordState === 'PAUSED' && input === 's') {
      handleResume();
    } else if ((recordState === 'RECORDING' || recordState === 'PAUSED') && input === 'a') {
      handleAnnotate();
    } else if ((recordState === 'RECORDING' || recordState === 'PAUSED') && input === 'c') {
      void handleCapture();
    } else if ((recordState === 'RECORDING' || recordState === 'PAUSED') && input === 'q') {
      void handleStop();
    } else if (recordState === 'SAVED' && input === 't') {
      void handleTranscribe();
    } else if (recordState === 'TRANSCRIBED' && input === 'm') {
      void handleAssemble();
    } else if (
      (recordState === 'SAVED' ||
        recordState === 'TRANSCRIBED' ||
        recordState === 'TRANSCRIBE_ERROR' ||
        recordState === 'ASSEMBLED' ||
        recordState === 'ERROR' ||
        recordState === 'READY') &&
      input === 'q'
    ) {
      process.exit(0);
    }

    // Suppress unused key warning for other keys
    void key;
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      {/* Brand */}
      <Box>
        <Text bold color="cyan">ez2</Text>
        <Text dimColor>  voice documentation</Text>
      </Box>

      {/* State indicator */}
      <StateBar state={recordState} />

      {/* VU meter + timer */}
      <Box gap={2} alignItems="center">
        <Text color={recordState === 'RECORDING' ? 'cyan' : 'gray'}>
          {buildVuBar(vuLevel)}
        </Text>
        <Text color={recordState === 'RECORDING' ? 'white' : 'gray'}>
          {formatElapsed(elapsedMs)}
        </Text>
      </Box>

      {/* Annotation prompt */}
      {recordState === 'ANNOTATING' && (
        <Box flexDirection="column" gap={1}>
          <Text dimColor>Type annotation, Enter to save, Esc to cancel:</Text>
          <TextInput
            placeholder="add a note…"
            onSubmit={handleAnnotationSubmit}
            onCancel={handleAnnotationCancel}
          />
        </Box>
      )}

      {/* Annotation flash */}
      {lastAnnotation !== '' && (recordState === 'RECORDING' || recordState === 'PAUSED') && (
        <Text color="green">[#] {lastAnnotation}</Text>
      )}

      {/* Screenshot flash */}
      {lastScreenshot !== '' && (recordState === 'RECORDING' || recordState === 'PAUSED') && (
        <Text color="cyan">[+] {lastScreenshot}</Text>
      )}

      {/* Result / transcription / error panels */}
      {recordState === 'SAVED' && (
        <Box flexDirection="column">
          <Text color="green">[✔] {savedPath}</Text>
        </Box>
      )}

      {recordState === 'TRANSCRIBING' && (
        <Box gap={1}>
          <Spinner />
          <Text> Transcribing…</Text>
        </Box>
      )}

      {recordState === 'TRANSCRIBED' && (
        <Box flexDirection="column" gap={1}>
          <Text color="green">[✔] Transcription</Text>
          <Box borderStyle="round" borderColor="cyan" paddingX={1}>
            <Text wrap="wrap">{transcription}</Text>
          </Box>
        </Box>
      )}

      {recordState === 'ASSEMBLING' && (
        <Box gap={1}>
          <Spinner />
          <Text> Assembling…</Text>
        </Box>
      )}

      {recordState === 'ASSEMBLED' && (
        <Box flexDirection="column" gap={1}>
          <Text color="green">[✔] transcript.md</Text>
          <Text dimColor>{assembledPath}</Text>
        </Box>
      )}

      {(recordState === 'TRANSCRIBE_ERROR' || recordState === 'ERROR') && (
        <Box flexDirection="column">
          <Text color="red">[✖] {errorMsg}</Text>
        </Box>
      )}

      {/* Hotkey footer */}
      <HotkeyFooter state={recordState} />
    </Box>
  );
}

function StateBar({ state }: { state: RecordingState }) {
  const labels: Record<RecordingState, { label: string; color: string }> = {
    READY:            { label: '[ ] READY',         color: 'gray' },
    RECORDING:        { label: '[●] REC',            color: 'red' },
    PAUSED:           { label: '[‖] PAUSED',         color: 'yellow' },
    CAPTURING:        { label: '[+] CAPTURING',      color: 'cyan' },
    ANNOTATING:       { label: '[#] ANNOTATING',     color: 'yellow' },
    SAVING:           { label: '[~] SAVING',         color: 'cyan' },
    SAVED:            { label: '[✔] SAVED',          color: 'green' },
    TRANSCRIBING:     { label: '[~] TRANSCRIBING',   color: 'cyan' },
    TRANSCRIBED:      { label: '[✔] TRANSCRIBED',    color: 'green' },
    TRANSCRIBE_ERROR: { label: '[✖] TRANSCRIBE ERR', color: 'red' },
    ASSEMBLING:       { label: '[~] ASSEMBLING',     color: 'cyan' },
    ASSEMBLED:        { label: '[✔] ASSEMBLED',      color: 'green' },
    ERROR:            { label: '[✖] ERROR',          color: 'red' },
  };
  const { label, color } = labels[state];
  return <Text color={color}>{label}</Text>;
}

function HotkeyFooter({ state }: { state: RecordingState }) {
  if (state === 'SAVING' || state === 'TRANSCRIBING' || state === 'CAPTURING' || state === 'ANNOTATING' || state === 'ASSEMBLING') return null;

  let keys: Array<{ key: string; label: string; active: boolean }> = [];

  if (state === 'READY') {
    keys = [
      { key: 's', label: 'start', active: true },
      { key: 'e', label: 'settings', active: true },
      { key: 'q', label: 'quit', active: true },
    ];
  } else if (state === 'RECORDING') {
    keys = [
      { key: 'p', label: 'pause', active: true },
      { key: 'a', label: 'annotate', active: true },
      { key: 'c', label: 'screenshot', active: true },
      { key: 'q', label: 'stop+save', active: true },
    ];
  } else if (state === 'PAUSED') {
    keys = [
      { key: 's', label: 'resume', active: true },
      { key: 'a', label: 'annotate', active: true },
      { key: 'c', label: 'screenshot', active: true },
      { key: 'q', label: 'stop+save', active: true },
    ];
  } else if (state === 'SAVED') {
    keys = [
      { key: 't', label: 'transcribe', active: true },
      { key: 'q', label: 'quit', active: true },
    ];
  } else if (state === 'TRANSCRIBED') {
    keys = [
      { key: 'm', label: 'assemble doc', active: true },
      { key: 'q', label: 'quit', active: true },
    ];
  } else if (state === 'ASSEMBLED' || state === 'TRANSCRIBE_ERROR' || state === 'ERROR') {
    keys = [{ key: 'q', label: 'quit', active: true }];
  }

  if (keys.length === 0) return null;

  return (
    <Box gap={3}>
      {keys.map(({ key, label, active }) => (
        <Box key={key}>
          <Text color={active ? 'yellow' : 'gray'}>{key}</Text>
          <Text dimColor={!active}> {label}</Text>
        </Box>
      ))}
    </Box>
  );
}
