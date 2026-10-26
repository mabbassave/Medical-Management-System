import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const COOKIE_SESSION = 'cookie-session';

export interface User {
  id: string;
  name?: string;
  username?: string;
  fullName?: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  role: string;
  status?: string;
  patientId?: string;
  doctorId?: string;
  doctorVerificationStatus?: 'verified' | 'not_applicable';
  specialty?: string;
  licenseNumber?: string;
  authProvider?: string;
  faceEnrollmentStatus?: string;
  faceEnrollmentAvailable?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  sessionVerified: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      sessionVerified: false,
      login: (user, token) => set({ user, token, sessionVerified: true }),
      logout: () => set({ user: null, token: null, sessionVerified: false }),
    }),
    {
      name: 'auth-storage', // key used in localStorage
      version: 1,
      // Old frontend builds persisted a fake token and could lock users out of public auth pages.
      migrate: () => ({ user: null, token: null, sessionVerified: false }),
      partialize: ({ user, token }) => ({ user, token }),
    }
  )
);
