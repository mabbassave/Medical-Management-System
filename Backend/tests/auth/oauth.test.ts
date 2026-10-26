import { beforeAll, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { generateKeyPair, SignJWT, type KeyLike } from 'jose';
import type { Request, Response } from 'express';
import * as OAuthService from '../../src/infrastructure/auth/OAuthService';
import {
  createOAuthTransaction,
  googleExchangeFailureDetails,
  verifyOAuthState,
  verifyProviderIdentityToken,
} from '../../src/infrastructure/auth/OAuthService';
import { OAuthController } from '../../src/presentation/controllers/OAuth.controller';
import { env, validateEnv } from '../../src/infrastructure/config/env';
import { JwtService } from '../../src/infrastructure/auth/JwtService';
import { UserModel } from '../../src/infrastructure/database/schemas/User.schema';
import { PatientModel } from '../../src/infrastructure/database/schemas/Patient.schema';

describe('OAuth transaction and identity-token verification', () => {
  let privateKey: KeyLike;
  let publicKey: KeyLike;
  const nonce = 'oauth-test-nonce';
  const now = Math.floor(Date.now() / 1000);

  beforeAll(async () => {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
  });

  const signToken = (
    provider: 'google' | 'apple',
    overrides: Record<string, unknown> = {},
    exp = now + 60
  ) =>
    new SignJWT({
      sub: 'provider-subject-123',
      nonce,
      email: 'person@example.com',
      email_verified: true,
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(provider === 'google' ? 'https://accounts.google.com' : 'https://appleid.apple.com')
      .setAudience('test-client-id')
      .setIssuedAt(now)
      .setExpirationTime(exp)
      .sign(privateKey);

  const testKeyResolver = async () => publicKey;

  it('creates high-entropy state and nonce values and compares state safely', () => {
    const transaction = createOAuthTransaction();
    expect(transaction.state).toHaveLength(43);
    expect(transaction.nonce).toHaveLength(43);
    expect(verifyOAuthState(transaction.state, transaction.state)).toBe(true);
    expect(verifyOAuthState(transaction.state, 'different-state')).toBe(false);
    expect(verifyOAuthState(undefined, transaction.state)).toBe(false);
  });

  it('logs only allowlisted Google exchange error diagnostics', () => {
    expect(
      googleExchangeFailureDetails({
        response: { status: 401, data: { error: 'invalid_client', error_description: 'sensitive detail' } },
      })
    ).toBe(
      'http_status=401, provider_code=invalid_client, id_token_present=false, category=google_oauth_rejected'
    );
    expect(
      googleExchangeFailureDetails({
        code: 'ETIMEDOUT',
        response: { status: 503, data: { error: 'private-provider-error', id_token: 'private-token' } },
      })
    ).toBe(
      'http_status=503, provider_code=unrecognized_provider_error, id_token_present=true, category=timeout'
    );
    expect(
      googleExchangeFailureDetails({
        code: 'ERR_TLS_CERT_ALTNAME_INVALID',
        message: 'private hostname and certificate data',
      })
    ).toBe(
      'http_status=unknown, provider_code=unrecognized_provider_error, id_token_present=false, category=tls'
    );
    expect(
      googleExchangeFailureDetails({
        code: 'ECONNRESET',
        message: 'private network detail',
      })
    ).toBe(
      'http_status=unknown, provider_code=unrecognized_provider_error, id_token_present=false, category=network'
    );
  });

  it('verifies a Google signature and returns only trusted identity claims', async () => {
    const token = await signToken('google', { given_name: 'Sample' });
    await expect(
      verifyProviderIdentityToken('google', token, nonce, 'test-client-id', testKeyResolver)
    ).resolves.toEqual({
      provider: 'google',
      subject: 'provider-subject-123',
      email: 'person@example.com',
      displayName: 'Sample',
    });
  });

  it('does not substitute an email prefix when Google omits a name claim', async () => {
    const token = await signToken('google', { name: undefined, given_name: undefined });
    await expect(
      verifyProviderIdentityToken('google', token, nonce, 'test-client-id', testKeyResolver)
    ).resolves.toMatchObject({
      provider: 'google',
      email: 'person@example.com',
      displayName: undefined,
    });
  });

  it('rejects an identity token with a different audience', async () => {
    const token = await signToken('google');
    await expect(
      verifyProviderIdentityToken('google', token, nonce, 'different-client-id', testKeyResolver)
    ).rejects.toThrow();
  });

  it('rejects a token with an invalid issuer', async () => {
    const token = await new SignJWT({
      sub: 'provider-subject-123',
      nonce,
      email: 'person@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://attacker.example')
      .setAudience('test-client-id')
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign(privateKey);
    await expect(
      verifyProviderIdentityToken('google', token, nonce, 'test-client-id', testKeyResolver)
    ).rejects.toThrow();
  });

  it('rejects nonce mismatch and unverified Google email claims', async () => {
    const wrongNonce = await signToken('google', { nonce: 'wrong-nonce' });
    const unverifiedEmail = await signToken('google', { email_verified: false });

    await expect(
      verifyProviderIdentityToken('google', wrongNonce, nonce, 'test-client-id', testKeyResolver)
    ).rejects.toThrow('google_identity_claims_invalid');
    await expect(
      verifyProviderIdentityToken('google', unverifiedEmail, nonce, 'test-client-id', testKeyResolver)
    ).rejects.toThrow('google_identity_claims_invalid');
  });

  it('rejects expired tokens and signatures from an untrusted key', async () => {
    const expired = await signToken('google', {}, now - 1);
    const signedByAnotherKey = await new SignJWT({
      sub: 'provider-subject-123',
      nonce,
      email: 'person@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://accounts.google.com')
      .setAudience('test-client-id')
      .setIssuedAt(now)
      .setExpirationTime(now + 60)
      .sign((await generateKeyPair('RS256')).privateKey);

    await expect(
      verifyProviderIdentityToken('google', expired, nonce, 'test-client-id', testKeyResolver)
    ).rejects.toThrow();
    await expect(
      verifyProviderIdentityToken('google', signedByAnotherKey, nonce, 'test-client-id', testKeyResolver)
    ).rejects.toThrow();
  });

  it('allows a verified returning Apple subject when Apple omits its email claim', async () => {
    const token = await signToken('apple', {
      iss: undefined,
      email: undefined,
      email_verified: undefined,
    });
    await expect(
      verifyProviderIdentityToken('apple', token, nonce, 'test-client-id', testKeyResolver)
    ).resolves.toMatchObject({
      provider: 'apple',
      subject: 'provider-subject-123',
      email: '',
    });
  });

  it('reports unconfigured provider credentials without redirecting to an identity provider', () => {
    const controller = new OAuthController();
    const originalClientId = env.GOOGLE_CLIENT_ID;
    const originalClientSecret = env.GOOGLE_CLIENT_SECRET;
    const response = {
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      get: () => undefined,
      query: { role: 'patient' },
    } as unknown as Request;

    try {
      env.GOOGLE_CLIENT_ID = 'configured-client-id';
      env.GOOGLE_CLIENT_SECRET = '';
      controller.start('google')(request, response);

      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=not_configured')
      );
    } finally {
      env.GOOGLE_CLIENT_ID = originalClientId;
      env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  });

  it('keeps an incomplete Google configuration non-fatal and uses the configured callback URI unchanged', () => {
    const previousProcessValues = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      redirectUri: process.env.GOOGLE_REDIRECT_URI,
    };
    const originalEnvValues = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    };

    try {
      process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      delete process.env.GOOGLE_CLIENT_SECRET;
      process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';
      expect(validateEnv()).toMatchObject({
        GOOGLE_CLIENT_ID: 'test-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: '',
        GOOGLE_REDIRECT_URI: 'http://localhost:5000/api/auth/google/callback',
      });

      env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
      env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';

      const cookie = vi.fn();
      const redirect = vi.fn();
      const response = { cookie, redirect } as unknown as Response;
      const request = {
        get: () => undefined,
        hostname: '127.0.0.1',
        query: { role: 'patient' },
      } as unknown as Request;

      new OAuthController().start('google')(request, response);

      const authorizationUrl = new URL(redirect.mock.calls[0][1]);
      expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
        'http://localhost:5000/api/auth/google/callback'
      );
      expect(cookie).toHaveBeenCalledWith(
        'oauth_google',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/api/auth/google',
        })
      );
    } finally {
      if (previousProcessValues.clientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = previousProcessValues.clientId;
      if (previousProcessValues.clientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
      else process.env.GOOGLE_CLIENT_SECRET = previousProcessValues.clientSecret;
      if (previousProcessValues.redirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI;
      else process.env.GOOGLE_REDIRECT_URI = previousProcessValues.redirectUri;

      env.GOOGLE_CLIENT_ID = originalEnvValues.clientId;
      env.GOOGLE_CLIENT_SECRET = originalEnvValues.clientSecret;
      env.GOOGLE_REDIRECT_URI = originalEnvValues.redirectUri;
    }
  });

  it('canonicalizes allowed development loopback aliases to the configured client origin', () => {
    const controller = new OAuthController();
    const originalClientId = env.GOOGLE_CLIENT_ID;
    const originalClientSecret = env.GOOGLE_CLIENT_SECRET;
    const response = {
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      get: (name: string) =>
        name.toLowerCase() === 'referer' ? 'http://127.0.0.1:5173/register' : undefined,
      query: { role: 'patient' },
    } as unknown as Request;

    try {
      env.GOOGLE_CLIENT_ID = '';
      env.GOOGLE_CLIENT_SECRET = '';
      controller.start('google')(request, response);

      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringMatching(/^http:\/\/localhost:5173\/auth\/callback\?/)
      );
    } finally {
      env.GOOGLE_CLIENT_ID = originalClientId;
      env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    }
  });

  it('rejects callbacks with invalid state before exchanging codes or setting sessions', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {
        oauth_google: Buffer.from(JSON.stringify(transaction)).toString('base64url'),
      },
      query: { state: 'attacker-state', code: 'untrusted-code' },
    } as unknown as Request;

    await controller.callback('google')(request, response, vi.fn());

    expect(response.clearCookie).toHaveBeenCalled();
    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('reason=invalid_callback')
    );
  });

  it('rejects role values other than patient or doctor before starting OAuth', () => {
    const response = {
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      get: () => undefined,
      query: { role: 'admin' },
    } as unknown as Request;

    new OAuthController().start('google')(request, response);

    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('reason=invalid_role')
    );
  });

  it('reports provider cancellation without exchanging an authorization code', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {
        oauth_google: Buffer.from(JSON.stringify(transaction)).toString('base64url'),
      },
      query: { state: transaction.state, error: 'access_denied' },
    } as unknown as Request;
    const exchange = vi.spyOn(OAuthService, 'verifyAuthorizationCode');

    await controller.callback('google')(request, response, vi.fn());

    expect(exchange).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('reason=cancelled')
    );
    exchange.mockRestore();
  });

  it('uses the role in signed OAuth state and preserves an existing Google account role', async () => {
    const controller = new OAuthController();
    const signedTransaction = createOAuthTransaction('http://localhost:5173', 'doctor');
    const cookieTransaction = {
      ...signedTransaction,
      role: 'patient',
    };
    const existingUser = {
      _id: { toString: () => 'existing-google-user' },
      role: 'patient',
      email: 'existing@example.com',
      linkedId: 'existing-patient-profile',
      save: vi.fn().mockResolvedValue(undefined),
    };
    const patientProfile = {
      patientId: 'existing-patient-profile',
      email: 'existing@example.com',
      userId: existingUser._id,
      save: vi.fn().mockResolvedValue(undefined),
    };
    const identity = {
      provider: 'google' as const,
      subject: 'existing-google-subject',
      email: 'existing@example.com',
      displayName: 'Existing User',
    };
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {
        oauth_google: Buffer.from(JSON.stringify(cookieTransaction)).toString('base64url'),
      },
      query: { state: signedTransaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const verify = vi.spyOn(OAuthService, 'verifyAuthorizationCode').mockResolvedValue(identity);
    const findOrCreate = vi
      .spyOn(OAuthService, 'findOrCreateOAuthUser')
      .mockResolvedValue({ user: existingUser as never, created: false });
    const findPatient = vi.spyOn(PatientModel, 'findOne').mockResolvedValue(patientProfile as never);
    const createToken = vi.spyOn(JwtService, 'generateToken').mockReturnValue('session-token');

    try {
      await controller.callback('google')(request, response, vi.fn());

      expect(findOrCreate).toHaveBeenCalledWith(identity, 'doctor', 'login');
      expect(createToken).toHaveBeenCalledWith(
        'existing-google-user',
        'patient',
        'existing-patient-profile'
      );
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('status=success')
      );
    } finally {
      verify.mockRestore();
      findOrCreate.mockRestore();
      findPatient.mockRestore();
      createToken.mockRestore();
    }
  });

  it('returns an explicit already-registered result for a Google registration attempt', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient', 'register');
    const response = {
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {
        oauth_google: Buffer.from(JSON.stringify({
          ...transaction,
          clientOrigin: 'http://localhost:5173',
          role: 'patient',
          flow: 'register',
        })).toString('base64url'),
      },
      query: { state: transaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const identity = {
      provider: 'google' as const,
      subject: 'registered-google-subject',
      email: 'registered@example.com',
      displayName: 'Existing User',
    };
    const verify = vi.spyOn(OAuthService, 'verifyAuthorizationCode').mockResolvedValue(identity);
    const findOrCreate = vi
      .spyOn(OAuthService, 'findOrCreateOAuthUser')
      .mockRejectedValue(new Error('oauth_already_registered'));

    try {
      await controller.callback('google')(request, response, vi.fn());

      expect(findOrCreate).toHaveBeenCalledWith(identity, 'patient', 'register');
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=already_registered')
      );
    } finally {
      verify.mockRestore();
      findOrCreate.mockRestore();
    }
  });

  it('logs safe Google callback error codes without logging unrecognized provider details', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {},
      query: { state: transaction.state, error: 'redirect_uri_mismatch' },
    } as unknown as Request;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      await controller.callback('google')(request, response, vi.fn());
      expect(warning).toHaveBeenCalledWith(
        '[OAuth] google sign-in ended by provider (reason=google_redirect_mismatch, code=redirect_uri_mismatch).'
      );
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=google_redirect_mismatch')
      );

      warning.mockClear();
      request.query = {
        state: transaction.state,
        error: 'private-provider-detail-with-sensitive-data',
      } as Request['query'];
      await controller.callback('google')(request, response, vi.fn());

      expect(warning).toHaveBeenCalledWith(
        '[OAuth] google sign-in ended by provider (reason=provider_error, code=unrecognized_provider_error).'
      );
      expect(warning.mock.calls.flat().join(' ')).not.toContain(
        'private-provider-detail-with-sensitive-data'
      );
    } finally {
      warning.mockRestore();
    }
  });

  it('returns a safe, actionable reason for Google token-exchange failures', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {},
      query: { state: transaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const originalReadyState = mongoose.connection.readyState;
    const verify = vi
      .spyOn(OAuthService, 'verifyAuthorizationCode')
      .mockRejectedValue(new Error('google_code_exchange_failed'));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      mongoose.connection.readyState = 1;
      await controller.callback('google')(request, response, vi.fn());

      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=google_exchange_failed')
      );
      expect(errorLog).toHaveBeenCalledWith(
        '[OAuth] google callback failed (stage=code_exchange_or_identity_validation, reason=google_exchange_failed, code=google_code_exchange_failed).'
      );
    } finally {
      mongoose.connection.readyState = originalReadyState;
      verify.mockRestore();
      errorLog.mockRestore();
    }
  });

  it('maps Google invalid_client exchange rejection to a credential-specific failure', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {},
      query: { state: transaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const verify = vi
      .spyOn(OAuthService, 'verifyAuthorizationCode')
      .mockRejectedValue(new Error('google_client_invalid'));
    const originalReadyState = mongoose.connection.readyState;
    try {
      mongoose.connection.readyState = 1;
      await controller.callback('google')(request, response, vi.fn());
      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=google_client_invalid')
      );
    } finally {
      mongoose.connection.readyState = originalReadyState;
      verify.mockRestore();
    }
  });

  it('maps Google unauthorized_client exchange rejection to an authorization-specific failure', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {},
      query: { state: transaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const verify = vi
      .spyOn(OAuthService, 'verifyAuthorizationCode')
      .mockRejectedValue(new Error('google_client_unauthorized'));
    const originalReadyState = mongoose.connection.readyState;
    try {
      mongoose.connection.readyState = 1;
      await controller.callback('google')(request, response, vi.fn());
      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=google_client_unauthorized')
      );
    } finally {
      mongoose.connection.readyState = originalReadyState;
      verify.mockRestore();
    }
  });

  it('maps Google redirect_uri_mismatch exchange rejection to a redirect-specific failure', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {},
      query: { state: transaction.state, code: 'one-time-code' },
    } as unknown as Request;
    const verify = vi
      .spyOn(OAuthService, 'verifyAuthorizationCode')
      .mockRejectedValue(new Error('google_redirect_mismatch'));
    const originalReadyState = mongoose.connection.readyState;
    try {
      mongoose.connection.readyState = 1;
      await controller.callback('google')(request, response, vi.fn());
      expect(response.cookie).not.toHaveBeenCalled();
      expect(response.redirect).toHaveBeenCalledWith(
        302,
        expect.stringContaining('reason=google_redirect_mismatch')
      );
    } finally {
      mongoose.connection.readyState = originalReadyState;
      verify.mockRestore();
    }
  });

  it('does not issue a session when MongoDB is unavailable', async () => {
    const controller = new OAuthController();
    const transaction = createOAuthTransaction('http://localhost:5173', 'patient');
    const response = {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
      redirect: vi.fn(),
    } as unknown as Response;
    const request = {
      cookies: {
        oauth_google: Buffer.from(JSON.stringify(transaction)).toString('base64url'),
      },
      query: { state: transaction.state, code: 'valid-shaped-code' },
    } as unknown as Request;
    const identity = {
      provider: 'google' as const,
      subject: 'provider-subject',
      email: 'patient@example.com',
      displayName: 'Patient',
    };
    const verify = vi.spyOn(OAuthService, 'verifyAuthorizationCode').mockResolvedValue(identity);
    const persist = vi
      .spyOn(OAuthService, 'findOrCreateOAuthUser')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    await controller.callback('google')(request, response, vi.fn());

    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith(
      302,
      expect.stringContaining('reason=database_unavailable')
    );
    verify.mockRestore();
    persist.mockRestore();
  });

  it('signs and verifies HMAC OAuth state tokens, rejecting invalid signatures', () => {
    const payload = {
      nonce: 'test-nonce-123',
      clientOrigin: 'http://localhost:5173',
      role: 'doctor' as const,
      exp: Date.now() + 60000,
      salt: 'test-salt',
    };
    const token = OAuthService.signOAuthState(payload);
    expect(typeof token).toBe('string');

    const verified = OAuthService.parseAndVerifyOAuthState(token);
    expect(verified).not.toBeNull();
    expect(verified?.nonce).toBe('test-nonce-123');
    expect(verified?.role).toBe('doctor');

    // Tampered signature
    const parts = token.split('.');
    const tampered = `${parts[0]}.tamperedsignature`;
    expect(OAuthService.parseAndVerifyOAuthState(tampered)).toBeNull();

    // Expired state
    const expiredToken = OAuthService.signOAuthState({ ...payload, exp: Date.now() - 1000 });
    expect(OAuthService.parseAndVerifyOAuthState(expiredToken)).toBeNull();

    const invalidRoleToken = OAuthService.signOAuthState(
      { ...payload, role: 'admin' } as unknown as OAuthService.OAuthStatePayload
    );
    expect(OAuthService.parseAndVerifyOAuthState(invalidRoleToken)).toBeNull();
  });

  it('generates a Google OAuth authorization URL when credentials are configured', () => {
    const origId = env.GOOGLE_CLIENT_ID;
    const origSecret = env.GOOGLE_CLIENT_SECRET;
    try {
      env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
      env.GOOGLE_CLIENT_SECRET = 'test-client-secret';

      const transaction = { state: 'test-state-abc', nonce: 'test-nonce-xyz' };
      const urlString = OAuthService.buildAuthorizationUrl('google', transaction, 'http://localhost:5000/api/auth/google/callback');
      const url = new URL(urlString);

      expect(url.hostname).toBe('accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id.apps.googleusercontent.com');
      expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:5000/api/auth/google/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('state')).toBe('test-state-abc');
      expect(url.searchParams.get('scope')).toContain('openid');
      expect(url.searchParams.get('scope')).toContain('email');
      expect(url.searchParams.get('scope')).toContain('profile');
    } finally {
      env.GOOGLE_CLIENT_ID = origId;
      env.GOOGLE_CLIENT_SECRET = origSecret;
    }
  });

  describe('findOrCreateOAuthUser registration, repeat login, and role preservation', () => {
    it('creates a new patient user with normalized email and not_applicable doctor status', async () => {
      const findOne = vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
      const exists = vi.spyOn(UserModel, 'exists').mockResolvedValue(null as never);
      const saveSpy = vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(undefined as never);

      try {
        const { user, created } = await OAuthService.findOrCreateOAuthUser(
          {
            provider: 'google',
            subject: 'new-google-patient-123',
            email: '  NEW_PATIENT@Example.COM  ',
            displayName: 'Jane Doe',
          },
          'patient'
        );

        expect(created).toBe(true);
        expect(user.role).toBe('patient');
        expect(user.doctorVerificationStatus).toBe('not_applicable');
        expect(user.email).toBe('new_patient@example.com');
        expect(user.fullName).toBe('Jane Doe');
        expect(user.isEmailVerified).toBe(true);
        expect(user.authProvider).toBe('google');
        expect(user.providerSubject).toBe('new-google-patient-123');
        expect(user.googleSubject).toBe('new-google-patient-123');
        expect(saveSpy).toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
        exists.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('creates a new doctor user with normalized email and immediate clinical access', async () => {
      const findOne = vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
      const exists = vi.spyOn(UserModel, 'exists').mockResolvedValue(null as never);
      const saveSpy = vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(undefined as never);

      try {
        const { user, created } = await OAuthService.findOrCreateOAuthUser(
          {
            provider: 'google',
            subject: 'new-google-doctor-456',
            email: 'Dr.Smith@Hospital.org',
            displayName: 'Dr Alice Smith',
          },
          'doctor'
        );

        expect(created).toBe(true);
        expect(user.role).toBe('doctor');
        expect(user.doctorVerificationStatus).toBe('verified');
        expect(user.email).toBe('dr.smith@hospital.org');
        expect(user.fullName).toBe('Dr Alice Smith');
        expect(user.isEmailVerified).toBe(true);
        expect(user.authProvider).toBe('google');
        expect(user.providerSubject).toBe('new-google-doctor-456');
        expect(user.googleSubject).toBe('new-google-doctor-456');
      } finally {
        findOne.mockRestore();
        exists.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('does not store an email prefix as a Google user name when no name claim exists', async () => {
      const findOne = vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);
      const exists = vi.spyOn(UserModel, 'exists').mockResolvedValue(null as never);
      const saveSpy = vi.spyOn(UserModel.prototype, 'save').mockResolvedValue(undefined as never);

      try {
        const { user } = await OAuthService.findOrCreateOAuthUser({
          provider: 'google',
          subject: 'google-without-name',
          email: 'member.name@example.com',
        });

        expect(user.fullName).toBeUndefined();
        expect(user.email).toBe('member.name@example.com');
      } finally {
        findOne.mockRestore();
        exists.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('signs into existing Google user on repeat login without creating duplicate and preserves role', async () => {
      const existingUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'repeat@example.com',
        role: 'doctor',
        doctorVerificationStatus: 'verified',
        providerSubject: 'repeat-subj-789',
        authProvider: 'google',
        googleSubject: 'repeat-subj-789',
        fullName: 'Original Doctor Name',
        isEmailVerified: true,
        save: vi.fn().mockResolvedValue(undefined),
      };
      const findOne = vi.spyOn(UserModel, 'findOne').mockResolvedValue(existingUser as never);

      try {
        const { user, created } = await OAuthService.findOrCreateOAuthUser(
          {
            provider: 'google',
            subject: 'repeat-subj-789',
            email: 'repeat@example.com',
            displayName: 'Dr Repeat',
          },
          'patient' // User chose patient on UI, but existing role is doctor
        );

        expect(created).toBe(false);
        expect(user.role).toBe('doctor'); // Role MUST be preserved
        expect(user.fullName).toBe('Original Doctor Name');
        expect(user.doctorVerificationStatus).toBe('verified');
        expect(existingUser.save).toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
      }
    });

    it('links existing email/password account and preserves existing account role', async () => {
      const existingAccount = {
        _id: new mongoose.Types.ObjectId(),
        email: 'registered_via_password@example.com',
        role: 'doctor',
        authProvider: 'password',
        providerSubject: undefined,
        isEmailVerified: false,
        save: vi.fn().mockResolvedValue(undefined),
      };
      // 1st call for providerSubject -> null; 2nd call for normalized email -> existingAccount
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingAccount as never);

      try {
        const { user, created } = await OAuthService.findOrCreateOAuthUser(
          {
            provider: 'google',
            subject: 'google-subj-linked',
            email: 'REGISTERED_VIA_PASSWORD@example.com',
            displayName: 'Dr Password User',
          },
          'patient' // Attempting to select patient role should NOT overwrite doctor role
        );

        expect(created).toBe(false);
        expect(user.role).toBe('doctor'); // Role preserved!
        expect(user.isEmailVerified).toBe(true);
        expect(user.googleSubject).toBe('google-subj-linked');
        expect(user.fullName).toBeUndefined();
        expect(existingAccount.save).toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
      }
    });

    it('rejects Google registration when the normalized email already exists without changing that account', async () => {
      const existingAccount = {
        _id: new mongoose.Types.ObjectId(),
        email: 'registered@example.com',
        role: 'doctor',
        fullName: 'Existing Doctor',
        authProvider: 'password',
        googleSubject: undefined,
        providerSubject: undefined,
        save: vi.fn().mockResolvedValue(undefined),
      };
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingAccount as never);

      try {
        await expect(
          OAuthService.findOrCreateOAuthUser(
            {
              provider: 'google',
              subject: 'new-google-subject',
              email: ' REGISTERED@EXAMPLE.COM ',
              displayName: 'New Registration Name',
            },
            'patient',
            'register'
          )
        ).rejects.toThrow('oauth_already_registered');
        expect(existingAccount.role).toBe('doctor');
        expect(existingAccount.fullName).toBe('Existing Doctor');
        expect(existingAccount.googleSubject).toBeUndefined();
        expect(existingAccount.save).not.toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
      }
    });

    it('rejects Google registration when the Google provider ID already exists', async () => {
      const existingAccount = {
        _id: new mongoose.Types.ObjectId(),
        email: 'existing@example.com',
        role: 'doctor',
        googleSubject: 'existing-google-subject',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(existingAccount as never)
        .mockResolvedValueOnce(null);

      try {
        await expect(
          OAuthService.findOrCreateOAuthUser(
            {
              provider: 'google',
              subject: 'existing-google-subject',
              email: 'new@example.com',
              displayName: 'Changed Registration Name',
            },
            'patient',
            'register'
          )
        ).rejects.toThrow('oauth_already_registered');
        expect(existingAccount.role).toBe('doctor');
        expect(existingAccount.save).not.toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
      }
    });

    it('rejects Google login when the verified email and Google ID belong to different accounts', async () => {
      const googleAccount = {
        _id: new mongoose.Types.ObjectId(),
        email: 'old-address@example.com',
        role: 'doctor',
        googleSubject: 'bound-google-subject',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const emailAccount = {
        _id: new mongoose.Types.ObjectId(),
        email: 'current-address@example.com',
        role: 'patient',
        authProvider: 'password',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(googleAccount as never)
        .mockResolvedValueOnce(emailAccount as never);

      try {
        await expect(
          OAuthService.findOrCreateOAuthUser({
            provider: 'google',
            subject: 'bound-google-subject',
            email: 'current-address@example.com',
            displayName: 'Changed Name',
          })
        ).rejects.toThrow('oauth_account_conflict');
        expect(googleAccount.save).not.toHaveBeenCalled();
        expect(emailAccount.save).not.toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
      }
    });

    it('handles race condition duplicate-key error (code 11000) gracefully', async () => {
      const racedUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'race@example.com',
        role: 'patient',
        authProvider: 'google',
        providerSubject: undefined,
        save: vi.fn().mockResolvedValue(undefined),
      };

      // 1st findOne (by subject): null
      // 2nd findOne (by email): null
      // save() fails with 11000 duplicate key
      // 3rd findOne (in catch block for raced user): returns racedUser
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(racedUser as never)
        .mockResolvedValueOnce(racedUser as never);
      const exists = vi.spyOn(UserModel, 'exists').mockResolvedValue(null as never);
      const saveSpy = vi.spyOn(UserModel.prototype, 'save').mockRejectedValue({ code: 11000 });

      try {
        const { user, created } = await OAuthService.findOrCreateOAuthUser(
          {
            provider: 'google',
            subject: 'race-subj-999',
            email: 'race@example.com',
            displayName: 'Race User',
          },
          'patient'
        );

        expect(created).toBe(false);
        expect(user.email).toBe('race@example.com');
        expect(racedUser.providerSubject).toBe('race-subj-999');
        expect(racedUser.save).toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
        exists.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('rejects concurrent duplicate registration after MongoDB reports duplicate key', async () => {
      const racedUser = {
        _id: new mongoose.Types.ObjectId(),
        email: 'race@example.com',
        role: 'doctor',
        fullName: 'Existing Doctor',
        googleSubject: 'existing-google-subject',
        providerSubject: 'existing-google-subject',
        save: vi.fn().mockResolvedValue(undefined),
      };
      const findOne = vi
        .spyOn(UserModel, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(racedUser as never)
        .mockResolvedValueOnce(racedUser as never);
      const exists = vi.spyOn(UserModel, 'exists').mockResolvedValue(null as never);
      const saveSpy = vi.spyOn(UserModel.prototype, 'save').mockRejectedValue({ code: 11000 });

      try {
        await expect(
          OAuthService.findOrCreateOAuthUser(
            {
              provider: 'google',
              subject: 'racing-google-subject',
              email: 'race@example.com',
              displayName: 'Registration Name',
            },
            'patient',
            'register'
          )
        ).rejects.toThrow('oauth_already_registered');
        expect(racedUser.role).toBe('doctor');
        expect(racedUser.fullName).toBe('Existing Doctor');
        expect(racedUser.save).not.toHaveBeenCalled();
      } finally {
        findOne.mockRestore();
        exists.mockRestore();
        saveSpy.mockRestore();
      }
    });

    it('rejects OAuth user creation if no email is provided', async () => {
      const findOne = vi.spyOn(UserModel, 'findOne').mockResolvedValue(null);

      try {
        await expect(
          OAuthService.findOrCreateOAuthUser({
            provider: 'google',
            subject: 'no-email-subj',
            email: '',
            displayName: 'No Email User',
          })
        ).rejects.toThrow('oauth_email_unavailable');
      } finally {
        findOne.mockRestore();
      }
    });
  });
});
