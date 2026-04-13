import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface Language {
  code: string;
  label: string;
}

const LANGUAGES: Language[] = [
  { code: 'auto', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'German' },
  { code: 'fr', label: 'French' },
  { code: 'es', label: 'Spanish' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ru', label: 'Russian' },
  { code: 'zh', label: 'Chinese' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'ar', label: 'Arabic' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'pl', label: 'Polish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'uk', label: 'Ukrainian' },
];

interface LanguageSelectionProps {
  onComplete: (languageCode: string) => void;
  initialLanguage?: string;
}

export function LanguageSelection({ onComplete, initialLanguage }: LanguageSelectionProps) {
  const [cursor, setCursor] = useState(() => {
    if (!initialLanguage) return 0;
    const idx = LANGUAGES.findIndex((l) => l.code === initialLanguage);
    return idx >= 0 ? idx : 0;
  });

  useInput((_input, key) => {
    if (key.upArrow) {
      setCursor((c) => Math.max(0, c - 1));
    } else if (key.downArrow) {
      setCursor((c) => Math.min(LANGUAGES.length - 1, c + 1));
    } else if (key.return) {
      onComplete(LANGUAGES[cursor]!.code);
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text bold color="cyan">Select transcription language</Text>
        <Text dimColor>Use {'\u2191'}{'\u2193'} to navigate · Enter to confirm</Text>
      </Box>

      <Box flexDirection="column">
        {LANGUAGES.map((lang, idx) => {
          const selected = idx === cursor;
          return (
            <Box key={lang.code}>
              <Text color={selected ? 'cyan' : undefined}>
                {selected ? '▶ ' : '  '}
                <Text bold={selected}>{lang.label}</Text>
                {lang.code !== 'auto' && (
                  <Text dimColor>  {lang.code}</Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
