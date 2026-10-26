import { createServer, type Server } from 'http';
import express, { type Request } from 'express';
import cookieParser from 'cookie-parser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createFaceVerificationRateLimiter,
  ensureFaceVerificationClientIdentity,
  faceVerificationIpRateLimiter,
  faceVerificationRateLimiter,
  ensureFaceVerificationConfigured,
  validateFaceVerificationInput,
} from '../../src/presentation/middlewares/rateLimit.middleware';
import { AppError } from '../../src/domain/errors/AppError';
import { faceEmbeddingService } from '../../src/infrastructure/biometrics/FaceEmbeddingService';
import { env } from '../../src/infrastructure/config/env';

const originalFaceSetting = env.FACE_ENROLLMENT_ENABLED;
const originalEncryptionKey = env.BIOMETRIC_ENCRYPTION_KEY;

describe('Face Login request rate limiting', () => {
  let server: Server | undefined;

  afterEach(async () => {
    env.FACE_ENROLLMENT_ENABLED = originalFaceSetting;
    env.BIOMETRIC_ENCRYPTION_KEY = originalEncryptionKey;
    vi.restoreAllMocks();
    if (!server?.listening) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => error ? reject(error) : resolve());
    });
    server = undefined;
  });

  it('requires the real local worker to report ready before allowing Face Login', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    const ensureReady = vi.spyOn(faceEmbeddingService, 'ensureReady').mockResolvedValue(undefined);
    const next = vi.fn();

    await ensureFaceVerificationConfigured({} as Request, {} as express.Response, next);

    expect(ensureReady).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it('returns the actual worker startup failure instead of reporting the provider as unconfigured', async () => {
    env.FACE_ENROLLMENT_ENABLED = true;
    env.BIOMETRIC_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
    const workerError = new AppError(503, 'Local face models did not start. Check the model files and Python setup.');
    vi.spyOn(faceEmbeddingService, 'ensureReady').mockRejectedValue(workerError);
    const next = vi.fn();

    await ensureFaceVerificationConfigured({} as Request, {} as express.Response, next);

    expect(next).toHaveBeenCalledWith(workerError);
  });

  it('does not count invalid requests, returns the actual retry delay, and allows attempts after reset', async () => {
    const app = express();
    app.use((req: Request, _res, next) => {
      req.body = { consent: req.header('x-test-consent') };
      if (req.header('x-test-camera') === 'valid') {
        Object.defineProperty(req, 'file', {
          value: { buffer: Buffer.from('test camera image') },
        });
      }
      next();
    });
    app.post(
      '/face-verify',
      validateFaceVerificationInput,
      createFaceVerificationRateLimiter(2, 100)
    );
    app.use((error: AppError, _req: Request, res: express.Response, _next: express.NextFunction) => {
      res.status(error.statusCode).json({ message: error.message });
    });
    app.post('/face-verify', (_req, res) => res.status(200).json({ verified: true }));

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server?.once('error', reject);
      server?.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
    const url = `http://127.0.0.1:${address.port}/face-verify`;
    const validHeaders = {
      'x-test-camera': 'valid',
      'x-test-consent': 'true',
    };

    const invalid = await fetch(url, { method: 'POST' });
    expect(invalid.status).toBe(400);

    expect((await fetch(url, { method: 'POST', headers: validHeaders })).status).toBe(200);
    expect((await fetch(url, { method: 'POST', headers: validHeaders })).status).toBe(200);

    const limited = await fetch(url, { method: 'POST', headers: validHeaders });
    expect(limited.status).toBe(429);
    const limitBody = await limited.json() as { message: string; retryAfterSeconds: number };
    const retryAfterHeader = Number(limited.headers.get('retry-after'));
    expect(retryAfterHeader).toBe(limitBody.retryAfterSeconds);
    expect(limitBody.retryAfterSeconds).toBeGreaterThan(0);
    expect(limitBody.message).toContain(`retry in ${limitBody.retryAfterSeconds} seconds`);

    await new Promise((resolve) => setTimeout(resolve, retryAfterHeader * 1000 + 100));
    expect((await fetch(url, { method: 'POST', headers: validHeaders })).status).toBe(200);
  });

  it('keeps browser limits separate for clients sharing one IP while retaining the IP-wide ceiling', async () => {
    const app = express();
    app.use(cookieParser());
    app.use((req: Request, _res, next) => {
      req.body = { consent: 'true' };
      Object.defineProperty(req, 'file', {
        value: { buffer: Buffer.from('test camera image') },
      });
      next();
    });
    app.post(
      '/face-verify',
      validateFaceVerificationInput,
      ensureFaceVerificationClientIdentity,
      faceVerificationIpRateLimiter,
      faceVerificationRateLimiter,
      (_req, res) => res.status(200).json({ accepted: true })
    );

    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server?.once('error', reject);
      server?.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port.');
    const url = `http://127.0.0.1:${address.port}/face-verify`;
    const request = async (cookie?: string) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: cookie ? { cookie } : undefined,
      });
      const setCookie = response.headers.get('set-cookie');
      return {
        response,
        cookie: cookie ?? setCookie?.split(';', 1)[0],
      };
    };

    let browserCookie: string | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await request(browserCookie);
      browserCookie = result.cookie;
      expect(result.response.status).toBe(200);
    }
    expect(browserCookie).toMatch(/^face_verify_attempt=/);
    expect((await request(browserCookie)).response.status).toBe(429);

    expect((await request()).response.status).toBe(200);
  });
});
