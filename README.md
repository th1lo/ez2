# ez2

Voice-to-text documentation tool for developers. Record an audio explanation, attach screenshots and typed annotations mid-recording, then get a clean markdown doc with all assets — no cloud, no configuration ceremony.

## What it does

1. **Record** — hit `r` to start, `r` again to stop. Live audiometer shows input level with low-latency response (~16ms chunks).
2. **Screenshot** — hit `s` mid-recording to trigger macOS region selection. The TUI suspends while you select, then resumes.
3. **Annotate** — hit `a` mid-recording to type a note. It embeds at the current timestamp.
4. **Transcribe** — Whisper runs locally after you stop recording (Metal GPU on Apple Silicon). The full transcript is displayed in the terminal when done.
5. **Output** — `./ez2-output/YYYY-MM-DD_HH-MM/transcript.md` with a `screenshots/` folder alongside.

## Requirements

- macOS (v1 is macOS-only)
- Node.js 20+
- Apple Silicon recommended (Whisper uses Metal; works on Intel with CPU fallback)

No Homebrew dependencies. PortAudio is bundled via `naudiodon`. Whisper runs via `smart-whisper` (downloads model on first run).

## Install

```sh
npm install
npm run build
```

Or run directly during development:

```sh
npm run dev
```

First run launches a setup wizard: pick your microphone, transcription language, and Whisper model size. Config is saved to `~/.config/ez2/config.json`.

## Hotkeys

| Key | Action |
|-----|--------|
| `r` | Start / stop recording |
| `s` | Capture screenshot (mid-recording) |
| `a` | Add text annotation (mid-recording) |
| `e` | Open settings |
| `q` | Quit |

## Output format

```
ez2-output/
  2024-03-15_14-30/
    transcript.md
    screenshots/
      screenshot-14-30-45.png
      screenshot-14-31-02.png
```

`transcript.md` contains the Whisper transcript with screenshot references and annotations embedded at their timestamps.

## Models

Whisper models are downloaded on first use to `~/.config/ez2/models/`. Recommended: `base.en` for English-only (fastest), `small` for multilingual.

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `tiny` | 75 MB | Fastest | Good |
| `tiny.en` | 75 MB | Fastest | Better (English) |
| `base` | 142 MB | Fast | Better |
| `base.en` | 142 MB | Fast | Best (English) |
| `small` | 466 MB | Moderate | Great |

## Stack

- **TUI**: [Ink](https://github.com/vadimdemedes/ink) 7 (React for terminals)
- **Audio**: [naudiodon](https://github.com/Streampunk/naudiodon) (PortAudio, no Homebrew)
- **Transcription**: [smart-whisper](https://github.com/farskid/smart-whisper) (Worker thread, Metal GPU)
- **Screenshot**: `screencapture -i` (macOS built-in)

## Settings

Re-run the setup wizard anytime with `e` from the main screen, or reset fully:

```sh
rm ~/.config/ez2/config.json && npm run dev
```
