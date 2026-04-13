import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Spinner } from '../components/Spinner.js';
// naudiodon has no TS types — import via require interop
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

interface PortAudioDevice {
  id: number;
  name: string;
  maxInputChannels: number;
  maxOutputChannels: number;
  hostAPIName: string;
}

interface DeviceOption {
  name: string;
  deviceId: number;
}

interface MicSelectionProps {
  onComplete: (device: DeviceOption) => void;
  initialDeviceId?: number;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; devices: DeviceOption[]; cursor: number }
  | { kind: 'error'; message: string };

export function MicSelection({ onComplete, initialDeviceId }: MicSelectionProps) {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    // Enumerate on next tick so the loading state renders first
    const id = setTimeout(() => {
      try {
        const portAudio = require('naudiodon') as { getDevices: () => PortAudioDevice[] };
        const all = portAudio.getDevices();
        const inputs: DeviceOption[] = all
          .filter((d) => d.maxInputChannels > 0)
          .map((d) => ({ name: d.name, deviceId: d.id }));

        if (inputs.length === 0) {
          setState({ kind: 'error', message: 'No input devices found. Connect a microphone and retry.' });
        } else {
          const initialCursor = initialDeviceId != null
            ? Math.max(0, inputs.findIndex((d) => d.deviceId === initialDeviceId))
            : 0;
          setState({ kind: 'ready', devices: inputs, cursor: initialCursor });
        }
      } catch (err) {
        setState({ kind: 'error', message: String(err) });
      }
    }, 80);
    return () => clearTimeout(id);
  }, []);

  useInput((input, key) => {
    if (state.kind !== 'ready') return;

    if (key.upArrow) {
      setState({ ...state, cursor: Math.max(0, state.cursor - 1) });
    } else if (key.downArrow) {
      setState({ ...state, cursor: Math.min(state.devices.length - 1, state.cursor + 1) });
    } else if (key.return) {
      onComplete(state.devices[state.cursor]!);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      {/* Header */}
      <Box flexDirection="column">
        <Text bold color="cyan">
          Select microphone
        </Text>
        <Text dimColor>Use ↑↓ to navigate · Enter to confirm</Text>
      </Box>

      {/* Body */}
      {state.kind === 'loading' && (
        <Box>
          <Spinner />
          <Text dimColor> Detecting audio devices…</Text>
        </Box>
      )}

      {state.kind === 'error' && (
        <Box>
          <Text color="red">✖ {state.message}</Text>
        </Box>
      )}

      {state.kind === 'ready' && (
        <Box flexDirection="column">
          {state.devices.map((device, idx) => {
            const selected = idx === state.cursor;
            return (
              <Box key={device.deviceId}>
                <Text color={selected ? 'cyan' : undefined}>
                  {selected ? '▶ ' : '  '}
                  {device.name}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
