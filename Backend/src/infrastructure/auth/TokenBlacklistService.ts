import { redisClient } from '../config/redis';

export class TokenBlacklistService {
  public static async blacklistToken(token: string, expiryInSeconds: number): Promise<void> {
    if (expiryInSeconds <= 0) return;
    try {
      await redisClient.set(`blacklist:${token}`, 'blacklisted', 'EX', Math.floor(expiryInSeconds));
    } catch (error: unknown) {
      console.warn('[TokenBlacklistService] Could not blacklist token in Redis.');
      throw error;
    }
  }

  public static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await redisClient.exists(`blacklist:${token}`);
      return result === 1;
    } catch {
      console.warn('[TokenBlacklistService] Could not check token blacklist in Redis.');
      return false;
    }
  }
}
