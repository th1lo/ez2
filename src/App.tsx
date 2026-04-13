import React, { useState } from 'react';
import { join } from 'path';
import { readConfig } from './config.js';
import { RecordingScreen } from './screens/RecordingScreen.js';
import { FirstRunWizard } from './wizard/FirstRunWizard.js';

const DEFAULT_OUTPUT_DIR = join(process.cwd(), 'ez2-output');

export function App() {
  const [showSettings, setShowSettings] = useState(false);
  // Incrementing this key forces RecordingScreen to remount with fresh config after settings save.
  const [configVersion, setConfigVersion] = useState(0);

  const config = readConfig();

  if (!config && !showSettings) {
    // No config yet — first-run wizard
    return <FirstRunWizard onComplete={() => setConfigVersion((v) => v + 1)} />;
  }

  if (showSettings) {
    return (
      <FirstRunWizard
        initialConfig={config ?? undefined}
        onComplete={() => {
          setShowSettings(false);
          setConfigVersion((v) => v + 1);
        }}
      />
    );
  }

  if (!config) {
    // Should not happen — wizard always writes config before calling onComplete
    return null;
  }

  const outputDir = config.outputDir ?? DEFAULT_OUTPUT_DIR;

  return (
    <RecordingScreen
      key={configVersion}
      config={config}
      outputDir={outputDir}
      onOpenSettings={() => setShowSettings(true)}
    />
  );
}
