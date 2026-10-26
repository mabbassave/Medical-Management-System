import { io, Socket } from 'socket.io-client';
import api from './api';

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const apiBaseUrl = api.defaults.baseURL || '';
const socketUrl = configuredSocketUrl
  ? new URL(configuredSocketUrl).origin
  : apiBaseUrl.startsWith('/')
    ? ''
    : apiBaseUrl.replace(/\/api\/?$/, '');

export const socket: Socket = io(socketUrl, {
  autoConnect: Boolean(socketUrl),
  withCredentials: true,
  transports: ['websocket', 'polling'],
});

export default socket;
