// Reads text aloud with the browser's built-in speech synthesis.
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export const useSpeech = () => {
  const location = useLocation();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== 'undefined'
      && 'speechSynthesis' in window
      && typeof SpeechSynthesisUtterance !== 'undefined'
  );
  const [message, setMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (isSupported) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  const speak = useCallback((text: string, lang: 'en' | 'ur', englishFallback?: string) => {
    if (!isSupported || !text.trim()) return;
    window.speechSynthesis.cancel();
    setMessage(null);

    const voices = window.speechSynthesis.getVoices();
    const matchingVoice = voices.find((voice) => voice.lang.toLowerCase().startsWith(lang));
    const fallbackToEnglish = lang === 'ur' && !matchingVoice;
    const voice = fallbackToEnglish
      ? voices.find((candidate) => candidate.lang.toLowerCase().startsWith('en'))
      : matchingVoice;
    const utterance = new SpeechSynthesisUtterance(
      fallbackToEnglish && englishFallback ? englishFallback : text
    );
    utterance.lang = voice?.lang || (fallbackToEnglish ? 'en-US' : lang === 'ur' ? 'ur-PK' : 'en-US');
    if (voice) utterance.voice = voice;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (event.error === 'not-allowed' || event.error === 'audio-busy') {
        setMessage('Allow browser audio after interacting with the page, then try again.');
      }
    };
    if (fallbackToEnglish) {
      setMessage('No Urdu voice is available in this browser; this summary will be read in English.');
    }

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      setMessage('Browser speech could not start. Please interact with the page and try again.');
    }
  }, [isSupported]);

  // Stop playback when leaving the current route or unmounting.
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported, location.pathname]);

  return { speak, stop, isSpeaking, isSupported, message };
};
