import React, { useState } from 'react';
import { Box, Text } from 'ink';
import { MicSelection } from './MicSelection.js';
import { ModelDownload } from './ModelDownload.js';
import { LanguageSelection } from './LanguageSelection.js';
import { writeConfig, type Config, type Mic } from '../config.js';

type Step = 'mic' | 'language' | 'model' | 'done';

interface FirstRunWizardProps {
  onComplete?: () => void;
  initialConfig?: Config;
}

export function FirstRunWizard({ onComplete, initialConfig }: FirstRunWizardProps) {
  const [step, setStep] = useState<Step>('mic');
  const [mic, setMic] = useState<Mic | null>(initialConfig?.mic ?? null);
  const [language, setLanguage] = useState<string>(initialConfig?.language ?? 'auto');

  const handleMicComplete = (device: Mic) => {
    setMic(device);
    setStep('language');
  };

  const handleLanguageComplete = (lang: string) => {
    setLanguage(lang);
    setStep('model');
  };

  const handleModelComplete = (modelName: string) => {
    if (!mic) return;
    writeConfig({ mic, model: modelName, language });
    setStep('done');
    setTimeout(() => onComplete?.(), 600);
  };

  const stepDone = (s: Step) => {
    const order: Step[] = ['mic', 'language', 'model', 'done'];
    return order.indexOf(step) > order.indexOf(s);
  };

  const stepActive = (s: Step) => step === s;

  const stepColor = (s: Step) =>
    stepDone(s) ? 'green' : stepActive(s) ? 'cyan' : 'gray';

  const stepIcon = (s: Step) => (stepDone(s) ? '[+]' : stepActive(s) ? '[>]' : '[ ]');

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      {/* Brand header */}
      <Box>
        <Text bold color="cyan">ez2 </Text>
        <Text dimColor>— {initialConfig ? 'settings' : 'first-run setup'}</Text>
      </Box>

      {/* Step indicator */}
      <Box gap={2}>
        <Text color={stepColor('mic')}>{stepIcon('mic')} Microphone</Text>
        <Text color={stepColor('language')}>{stepIcon('language')} Language</Text>
        <Text color={stepColor('model')}>{stepIcon('model')} Whisper model</Text>
      </Box>

      {/* Step content */}
      {step === 'mic' && <MicSelection onComplete={handleMicComplete} initialDeviceId={initialConfig?.mic.deviceId} />}
      {step === 'language' && <LanguageSelection onComplete={handleLanguageComplete} initialLanguage={initialConfig?.language} />}
      {step === 'model' && <ModelDownload onComplete={handleModelComplete} initialModelName={initialConfig?.model} />}
      {step === 'done' && (
        <Box>
          <Text color="green">[+] Setup complete — loading ez2…</Text>
        </Box>
      )}
    </Box>
  );
}
