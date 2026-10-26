import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { JwtService, type JwtPayload } from '../auth/JwtService';
import { TokenBlacklistService } from '../auth/TokenBlacklistService';
import { env } from '../config/env';

let io: SocketIOServer | null = null;

export interface CriticalVitalsNotification {
  patientId: string;
  status: string;
  flaggedParams?: string[];
  message?: string;
  summary: string;
  analysis?: any;
  recordedAt?: Date | string;
}

const tokenFromCookieHeader = (header: string | undefined): string | null => {
  const tokenCookie = header
    ?.split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('token='));
  if (!tokenCookie) return null;
  try {
    return decodeURIComponent(tokenCookie.slice('token='.length));
  } catch {
    return null;
  }
};

/**
 * Initializes Socket.io with the HTTP server and shared CORS settings.
 */
export const initSocket = (
  httpServer: HttpServer,
  allowedOrigins: string[] = []
): SocketIOServer => {
  const originsSet = new Set(allowedOrigins.filter(Boolean));

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (origin, callback) => {
        const isLocalDevelopment =
          env.isDevelopment &&
          typeof origin === 'string' &&
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (!origin || originsSet.has(origin) || isLocalDevelopment) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin is not allowed by CORS'));
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket, next) => {
    const token = tokenFromCookieHeader(socket.handshake.headers.cookie);
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      if (await TokenBlacklistService.isTokenBlacklisted(token)) {
        next(new Error('Unauthorized'));
        return;
      }
      const user = JwtService.verifyToken(token);
      if (!user.userId || !user.role) {
        next(new Error('Unauthorized'));
        return;
      }
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;
    const userId = user.userId;
    const role = user.role.toLowerCase().trim();

    socket.on('join', (userId: string) => {
      if (userId === user.userId) {
        socket.join(userId);
      }
    });

    socket.on('join-role', (role: string) => {
      if (typeof role === 'string' && role.toLowerCase().trim() === user.role.toLowerCase()) {
        socket.join(role.toLowerCase().trim());
      }
    });

    socket.on('join-room', (room: string) => {
      if (room === userId || (typeof room === 'string' && room.toLowerCase().trim() === role)) {
        socket.join(room);
      }
    });
  });

  return io;
};

/**
 * Returns the active Socket.io instance.
 */
export const getIO = (): SocketIOServer | null => {
  return io;
};

/**
 * Notification service for real-time alerting.
 */
export const notificationService = {
  /**
   * Emits "critical-vitals" event to doctor and admin rooms.
   */
  emitCriticalVitals: (payload: CriticalVitalsNotification): void => {
    if (!io) {
      console.warn('⚠️ [Socket.io] Cannot emit critical-vitals: Socket.io has not been initialized.');
      return;
    }

    const eventPayload = {
      ...payload,
      summary: payload.summary || payload.message || 'Critical vitals detected',
      recordedAt: payload.recordedAt || new Date().toISOString(),
    };

    // Emit to doctor and admin rooms
    io.to('doctor')
      .to('doctors')
      .to('admin')
      .to('admins')
      .emit('critical-vitals', eventPayload);
  },

  /**
   * Sends an alert notification to a specific user.
   */
  sendAlertToUser: (userId: string, message: string): void => {
    if (!io) {
      console.warn('⚠️ [Socket.io] Cannot send alert: Socket.io has not been initialized.');
      return;
    }
    io.to(userId).emit('notification', message);
  },
};
