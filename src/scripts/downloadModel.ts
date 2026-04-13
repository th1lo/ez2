import { manager } from 'smart-whisper';

async function main() {
  console.log('Downloading tiny model...');
  const name = await manager.download('tiny');
  console.log('Downloaded:', name);
  console.log('Models:', manager.list());
}

main().catch(console.error);
