import api from './api';

export type OAuthProvider = 'google' | 'apple';

export const beginOAuth = (
  provider: OAuthProvider,
  role?: 'patient' | 'doctor',
  flow: 'login' | 'register' = 'login'
): void => {
  const apiBaseUrl = api.defaults.baseURL;
  if (!apiBaseUrl) {
    throw new Error('Authentication server URL is not configured.');
  }

  const base = apiBaseUrl.replace(/\/+$/, '');
  const url = new URL(`${base}/auth/${provider}`);
  if (role) {
    url.searchParams.set('role', role);
  }
  url.searchParams.set('flow', flow);
  window.location.assign(url.toString());
};
