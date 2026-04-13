import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface TextInputProps {
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function TextInput({ placeholder = '', onSubmit, onCancel }: TextInputProps) {
  const [value, setValue] = useState('');

  useInput((input, key) => {
    if (key.return) {
      onSubmit(value.trim());
      return;
    }
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }
    // Accept printable characters only
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box>
      <Text color="yellow">▶ </Text>
      <Text>{value || <Text dimColor>{placeholder}</Text>}</Text>
      <Text color="yellow">█</Text>
    </Box>
  );
}
