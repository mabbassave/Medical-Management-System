import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import {
  initSocket,
  getIO,
  notificationService,
  CriticalVitalsNotification,
} from './socket';

export {
  initSocket,
  getIO,
  notificationService,
  CriticalVitalsNotification,
};

export const setup = (server: HttpServer, allowedOrigins?: string[]): SocketIOServer => {
  return initSocket(server, allowedOrigins);
};

export const sendAlertToUser = (userId: string, message: string): void => {
  notificationService.sendAlertToUser(userId, message);
};

export class SocketService {
  public static setup(server: HttpServer, allowedOrigins?: string[]): SocketIOServer {
    return initSocket(server, allowedOrigins);
  }

  public static sendAlertToUser(userId: string, message: string): void {
    notificationService.sendAlertToUser(userId, message);
  }

  public static emitCriticalVitals(payload: CriticalVitalsNotification): void {
    notificationService.emitCriticalVitals(payload);
  }

  public static getIO(): SocketIOServer | null {
    return getIO();
  }
}
