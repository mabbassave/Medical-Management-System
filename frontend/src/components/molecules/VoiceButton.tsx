// Adds speech playback and a shared language switch to report summaries.
import React from 'react';
import { Square, Volume2 } from 'lucide-react';
import { useSpeech } from '../../shared/hooks/useSpeech';
import { useVoiceStore } from '../../store/voiceStore';

interface VoiceButtonProps {
  text: string;
  englishText?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({ text, englishText }) => {
  const language = useVoiceStore((state) => state.language);
  const setLanguage = useVoiceStore((state) => state.setLanguage);
  const { speak, stop, isSpeaking, isSupported, message } = useSpeech();

  if (!isSupported) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-label={isSpeaking ? 'Stop speaking summary' : 'Listen to summary'}
        onClick={() => (isSpeaking ? stop() : speak(text, language, englishText))}
        className="inline-flex items-center gap-1.5 rounded-md border border-voicePrimary/20 bg-surface px-3 py-1.5 text-sm font-medium text-voicePrimary hover:bg-voicePrimary/10 focus:outline-none focus:ring-2 focus:ring-voicePrimary/20"
      >
        {isSpeaking ? <Square className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        {isSpeaking ? 'Stop' : 'Listen'}
      </button>
      <div className="inline-flex rounded-md border border-textPrimary/10 p-0.5" aria-label="Summary language">
        <button
          type="button"
          aria-pressed={language === 'en'}
          onClick={() => setLanguage('en')}
          className={`rounded px-2 py-1 text-xs ${language === 'en' ? 'bg-voicePrimary text-surface' : 'text-textPrimary hover:bg-background'}`}
        >
          English
        </button>
        <button
          type="button"
          aria-pressed={language === 'ur'}
          onClick={() => setLanguage('ur')}
          className={`rounded px-2 py-1 text-xs ${language === 'ur' ? 'bg-voicePrimary text-surface' : 'text-textPrimary hover:bg-background'}`}
        >
          اردو
        </button>
      </div>
      {message && <p role="status" className="w-full text-xs text-textPrimary/70">{message}</p>}
    </div>
  );
};
