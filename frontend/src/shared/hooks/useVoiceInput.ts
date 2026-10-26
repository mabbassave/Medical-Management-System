// Captures speech with the browser's built-in speech recognition.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVoiceStore } from '../../store/voiceStore';

interface SpeechAlternative {
  transcript: string;
}

interface SpeechResult {
  isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternative;
}

interface SpeechResultList {
  readonly length: number;
  [index: number]: SpeechResult;
}

interface SpeechRecognitionEventLike extends Event {
  results: SpeechResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorLike extends Event {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}

export const useVoiceInput = () => {
  const language = useVoiceStore((state) => state.language);
  const setLanguage = useVoiceStore((state) => state.setLanguage);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const listeningRef = useRef(false);
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageNotice, setLanguageNotice] = useState<string | null>(null);
  const speechWindow = typeof window === 'undefined' ? null : window as SpeechRecognitionWindow;
  const Recognition = speechWindow?.SpeechRecognition || speechWindow?.webkitSpeechRecognition;
  const isSupported = Boolean(Recognition);

  const stop = useCallback(() => {
    if (!listeningRef.current) return;
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    // Ignore repeated starts; the page's button toggles to stop instead.
    if (!Recognition || listeningRef.current) return;
    const recognition = new Recognition();
    recognition.lang = language === 'ur' ? 'ur-PK' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return;
      const parts: string[] = [];
      for (let index = 0; index < event.results.length; index += 1) {
        parts.push(event.results[index][0].transcript);
      }
      setTranscript(parts.join(' ').trim());
    };
    recognition.onerror = (event) => {
      if (recognitionRef.current !== recognition) return;
      console.warn('[SpeechRecognition] Error code:', event.error);

      const messages: Record<string, string> = {
        'not-allowed': 'Microphone permission is blocked. Allow the microphone in your browser settings and try again.',
        'service-not-allowed': 'Microphone permission is blocked. Allow the microphone in your browser settings and try again.',
        'no-speech': "No speech was heard. Speak after 'Listening...' appears and check your microphone.",
        'audio-capture': 'No microphone was found. Please connect a microphone.',
        network: 'The speech service could not be reached. Check your internet connection.',
        'language-not-supported': 'This language is not supported by your browser. Try English.',
      };

      if (event.error === 'aborted') {
        setError(null);
      } else if (event.error === 'language-not-supported' && language === 'ur') {
        setLanguage('en');
        setError(null);
        setLanguageNotice('Urdu is not supported by this browser. Switched to English.');
      } else {
        setError(
          messages[event.error]
          || `Speech could not be recognized (code: ${event.error}). Please try again.`
        );
      }
      listeningRef.current = false;
      setIsListening(false);
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) {
        listeningRef.current = false;
        setIsListening(false);
      }
    };

    setTranscript('');
    setError(null);
    setLanguageNotice(null);
    setIsListening(true);
    listeningRef.current = true;
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      listeningRef.current = false;
      setIsListening(false);
      setError('The microphone could not start. Please try again.');
    }
  }, [Recognition, language]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
  }, []);

  return { start, stop, isListening, transcript, isSupported, error, languageNotice };
};
