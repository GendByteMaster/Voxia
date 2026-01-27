# Voxia

**Voxia** is a premium Text-to-Speech (TTS) application built with React, TypeScript, and Tailwind CSS v4. It features a modern "Dark Glass" aesthetic and smooth animations powered by Framer Motion.

![Voxia App Icon](/public/voxia_icon.svg)

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

## Project Structure

- `src/components`: Reusable UI components (VoiceControls, PlaybackControl, TextInput).
- `src/App.tsx`: Main application logic and state management.
- `src/index.css`: Global styles and Tailwind configuration.

## License

MIT
