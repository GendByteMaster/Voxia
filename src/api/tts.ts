const API_BASE = 'http://localhost:8000';

export interface Speaker {
    id: string;
    name: string;
    preview_url?: string;
    language?: string;
}

export const ttsApi = {
    async checkHealth(): Promise<boolean> {
        try {
            const res = await fetch(`${API_BASE}/health`);
            const data = await res.json();
            return data.status === 'ok';
        } catch (e) {
            return false;
        }
    },

    async getSpeakers(): Promise<Speaker[]> {
        const res = await fetch(`${API_BASE}/speakers`);
        if (!res.ok) throw new Error('Failed to fetch speakers');
        return res.json();
    },

    async generateSpeech(text: string, speaker_wav: string, language: string = 'en', speed: number = 1.0): Promise<Blob> {
        const res = await fetch(`${API_BASE}/tts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text,
                speaker_wav,
                language,
                speed,
            }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'TTS Generation failed');
        }

        return res.blob();
    }
};
