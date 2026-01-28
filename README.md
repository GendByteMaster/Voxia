# Voxia

**Voxia** is a premium Text-to-Speech (TTS) application built with React, TypeScript, and Tailwind CSS v4. It features a modern "Dark Glass" aesthetic and smooth animations powered by Framer Motion.

![Voxia App Icon](/public/voxia_icon.svg)

## App Icon (Apple HIG)

- The icon artwork is full-bleed with 90-degree corners; iOS applies its own rounded mask, so the source asset should not include rounded corners or inset artwork.
- The icon is fully opaque; avoid transparent regions to prevent unintended backgrounds.
- The source artboard is 1024x1024 to align with App Store icon requirements.

## Features

- **High-Fidelity Text-to-Speech**: Utilizes the Web Speech API for native voice synthesis.
- **Premium UI**: Dark mode with glassmorphism effects (`backdrop-filter`, radial gradients).
- **Custom Controls**:
  - Animated Voice Dropdown.
  - Playback Speed Slider.
  - Dynamic Waveform Visualizer.
- **Hotkeys**:
  - `Ctrl + Enter`: Toggle Play / Pause.
  - `Escape`: Stop playback immediately.
- **Responsive Layout**: Optimized for desktop and mobile devices.

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion 12](https://www.framer.com/motion/)
- **Language**: TypeScript

## Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run development server**:
    ```bash
    npm run dev
    ```

3.  **Build for production**:
    ```bash
    npm run build
    ```

## Backend (optional)

Voxia ships with a FastAPI backend that uses `edge-tts` to generate neural TTS audio. The frontend can switch between browser-native voices and the backend engine.

1.  **Install backend dependencies**:
    ```bash
    cd backend
    python -m venv venv
    ./venv/Scripts/activate
    pip install -r requirements.txt
    ```

2.  **Run the API**:
    ```bash
    python main.py
    ```

3.  **Use it in the UI**:
    - Toggle **Engine** to **Neural / XTTS**.
    - Ensure the API is reachable at `http://localhost:8000` (update `src/api/tts.ts` if you use a different host/port).

### API Endpoints

- `GET /health`: Service status and model loaded flag.
- `GET /speakers`: Returns available voice IDs and friendly names.
- `POST /tts`: Generates audio and returns an MP3 blob.
  - Body: `{ "text": "...", "language": "ru", "speaker_wav": "ru-RU-DmitryNeural", "speed": 1.0 }`
  - Output files are stored in `backend/output` while the server runs.

## Project Structure

- `src/components`: Reusable UI components (VoiceControls, PlaybackControl, TextInput).
- `src/App.tsx`: Main application logic and state management.
- `src/index.css`: Global styles and Tailwind configuration.
- `backend`: FastAPI service for neural TTS and voice listing.

## License

MIT
