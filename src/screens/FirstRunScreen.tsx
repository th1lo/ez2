import React from 'react';
import { Box, Text, useInput } from 'ink';
import { exit } from 'process';

export function FirstRunScreen() {
  useInput((input) => {
    if (input === 'q') {
      exit(0);
    }
  });

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">
        ez2
      </Text>
      <Text dimColor>First-run setup — coming soon</Text>
      <Box marginTop={1}>
        <Text dimColor>Press </Text>
        <Text color="yellow">q</Text>
        <Text dimColor> to quit</Text>
      </Box>
    </Box>
  );
}
