import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisClient } = vi.hoisted(() => ({
  redisClient: {
    set: vi.fn(),
    exists: vi.fn(),
  },
}));

vi.mock('../../src/infrastructure/config/redis', () => ({ redisClient }));

import { TokenBlacklistService } from '../../src/infrastructure/auth/TokenBlacklistService';

describe('TokenBlacklistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects blacklist writes when Redis is unavailable', async () => {
    const error = new Error('Redis unavailable');
    redisClient.set.mockRejectedValue(error);

    await expect(TokenBlacklistService.blacklistToken('session-token', 60)).rejects.toBe(error);
  });

  it('rejects blacklist lookups when Redis is unavailable instead of failing open', async () => {
    const error = new Error('Redis unavailable');
    redisClient.exists.mockRejectedValue(error);

    await expect(TokenBlacklistService.isTokenBlacklisted('session-token')).rejects.toBe(error);
  });
});
