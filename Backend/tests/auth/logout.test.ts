import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from '../../src/presentation/controllers/Auth.controller';
import { TokenBlacklistService } from '../../src/infrastructure/auth/TokenBlacklistService';

describe('AuthController logout', () => {
  it('clears the session cookie but reports failure if Redis cannot revoke the session', async () => {
    const error = new Error('Redis unavailable');
    const blacklist = vi
      .spyOn(TokenBlacklistService, 'blacklistToken')
      .mockRejectedValue(error);
    const clearCookie = vi.fn();
    const response = { clearCookie } as unknown as Response;
    const next = vi.fn();

    try {
      await new AuthController().logout(
        { cookies: { token: 'opaque-session-token' } } as Request,
        response,
        next
      );

      expect(clearCookie).toHaveBeenCalledWith('token', {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
      });
      expect(next).toHaveBeenCalledWith(error);
    } finally {
      blacklist.mockRestore();
    }
  });
});
