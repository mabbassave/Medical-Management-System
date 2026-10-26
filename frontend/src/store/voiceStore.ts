// Stores voice preferences shared by the speech controls.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type VoiceLanguage = 'en' | 'ur';

interface VoiceState {
  language: VoiceLanguage;
  autoAlerts: boolean;
  setLanguage: (language: VoiceLanguage) => void;
  setAutoAlerts: (enabled: boolean) => void;
}

export const useVoiceStore = create<VoiceState>()(
  persist(
    (set) => ({
      language: 'en',
      autoAlerts: false,
      setLanguage: (language) => set({ language }),
      setAutoAlerts: (autoAlerts) => set({ autoAlerts }),
    }),
    { name: 'voice-preferences' }
  )
);
