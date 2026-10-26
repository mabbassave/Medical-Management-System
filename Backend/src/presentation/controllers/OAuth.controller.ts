import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { JwtService } from '../../infrastructure/auth/JwtService';
import {
  buildAuthorizationUrl,
  createOAuthTransaction,
  findOrCreateOAuthUser,
  oauthTransactionMaxAgeSeconds,
  parseAndVerifyOAuthState,
  verifyAuthorizationCode,
  verifyOAuthState,
  type OAuthProvider,
} from '../../infrastructure/auth/OAuthService';
import { env } from '../../infrastructure/config/env';
import { ensureUserProfile } from '../../infrastructure/database/UserProfileLinker';

const providerCookieName = (provider: OAuthProvider) => `oauth_${provider}`;
const isOAuthRole = (value: unknown): value is 'patient' | 'doctor' =>
  value === 'patient' || value === 'doctor';
const allowedClientOrigins = (): Set<string> => {
  const clientUrl = new URL(env.CLIENT_URL);
  const origins = new Set([clientUrl.origin]);
  if (env.isDevelopment && ['localhost', '127.0.0.1'].includes(clientUrl.hostname)) {
    const loopbackAlias = new URL(clientUrl);
    loopbackAlias.hostname = clientUrl.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
    origins.add(loopbackAlias.origin);
  }
  return origins;
};

const defaultClientOrigin = () => new URL(env.CLIENT_URL).origin;

const clientOriginForRequest = (req: Request): string => {
  const requestOrigin = req.get('origin');
  const referer = req.get('referer');
  try {
    const origin = requestOrigin || (referer ? new URL(referer).origin : undefined);
    if (!origin || !allowedClientOrigins().has(origin)) return defaultClientOrigin();
    if (env.isDevelopment && origin !== defaultClientOrigin()) return defaultClientOrigin();
    return origin;
  } catch {
    return defaultClientOrigin();
  }
};

const providerFailureUrl = (
  provider: OAuthProvider,
  reason: string,
  clientOrigin = defaultClientOrigin()
) =>
  `${clientOrigin}/auth/callback?provider=${provider}&status=error&reason=${encodeURIComponent(reason)}`;
const providerSuccessUrl = (
  provider: OAuthProvider,
  clientOrigin = defaultClientOrigin(),
  enrollFace = false
) =>
  `${clientOrigin}/auth/callback?provider=${provider}&status=success${enrollFace ? '&enroll_face=1' : ''}`;

const safeOAuthFailureCode = (error: unknown): string => {
  const allowedCodes = new Set([
    'apple_not_configured',
    'apple_code_exchange_failed',
    'apple_identity_token_missing',
    'apple_identity_claims_invalid',
    'google_not_configured',
    'google_code_exchange_failed',
    'google_client_invalid',
    'google_client_unauthorized',
    'google_redirect_mismatch',
    'google_identity_token_missing',
    'google_identity_claims_invalid',
    'oauth_account_conflict',
    'oauth_email_unavailable',
    'oauth_invalid_role',
  ]);
  if (error instanceof Error && allowedCodes.has(error.message)) return error.message;
  if (typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string') {
    const safeErrorNames = new Set([
      'MongoBulkWriteError',
      'MongoNetworkError',
      'MongoNotConnectedError',
      'MongoServerError',
      'MongoServerSelectionError',
      'ValidationError',
    ]);
    if (safeErrorNames.has(error.name)) return error.name;
  }
  return 'unexpected_error';
};

const safeProviderErrorCode = (value: unknown): string => {
  const safeCodes = new Set([
    'access_denied',
    'admin_policy_enforced',
    'consent_required',
    'disallowed_useragent',
    'interaction_required',
    'invalid_client',
    'invalid_grant',
    'invalid_request',
    'invalid_scope',
    'login_required',
    'org_internal',
    'redirect_uri_mismatch',
    'request_denied',
    'server_error',
    'temporarily_unavailable',
    'unauthorized_client',
    'user_cancelled_authorize',
    'unsupported_response_type',
  ]);
  return typeof value === 'string' && safeCodes.has(value) ? value : 'unrecognized_provider_error';
};

const callbackFailureReason = (
  provider: OAuthProvider,
  stage: string,
  error: unknown
): string => {
  if (error instanceof Error) {
    if (error.message === 'oauth_account_conflict') return 'account_conflict';
    if (error.message === 'oauth_email_unavailable') return 'email_unavailable';
    if (error.message === `${provider}_not_configured`) return 'not_configured';
    if (error.message === 'google_client_invalid') return 'google_client_invalid';
    if (error.message === 'google_client_unauthorized') return 'google_client_unauthorized';
    if (error.message === 'google_redirect_mismatch') return 'google_redirect_mismatch';
    if (
      error.message === 'google_code_exchange_failed' ||
      error.message === 'google_identity_token_missing'
    ) {
      return 'google_exchange_failed';
    }
    if (error.message === 'google_identity_claims_invalid') return 'google_identity_rejected';
  }

  if (stage === 'account_linking') return 'account_creation_failed';
  if (stage === 'profile_linking') return 'profile_setup_failed';
  if (stage === 'session_creation') return 'session_creation_failed';
  return 'provider_error';
};

const providerCallbackFailureReason = (provider: OAuthProvider, code: string): string => {
  if (code === 'access_denied' || code === 'user_cancelled_authorize') return 'cancelled';
  if (provider !== 'google') return 'provider_error';

  if (code === 'redirect_uri_mismatch') return 'google_redirect_mismatch';
  if (code === 'invalid_client') return 'google_client_invalid';
  if (code === 'unauthorized_client') return 'google_client_unauthorized';
  if (code === 'admin_policy_enforced' || code === 'org_internal') return 'google_access_restricted';
  if (code === 'invalid_request' || code === 'invalid_scope') return 'google_request_invalid';
  return 'provider_error';
};

const cookieOptions = (provider: OAuthProvider) => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax' as const,
  path: `/api/auth/${provider}`,
  maxAge: oauthTransactionMaxAgeSeconds * 1000,
});

const clearTransactionCookie = (res: Response, provider: OAuthProvider) => {
  res.clearCookie(providerCookieName(provider), {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: `/api/auth/${provider}`,
  });
};

const transactionFromCookie = (
  value: unknown
): { state: string; nonce: string; clientOrigin?: string; role?: 'patient' | 'doctor' } | null => {
  if (typeof value !== 'string') return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as {
      state?: unknown;
      nonce?: unknown;
      clientOrigin?: unknown;
      role?: unknown;
    };
    if (typeof decoded.state !== 'string' || typeof decoded.nonce !== 'string') return null;
    const clientOrigin =
      typeof decoded.clientOrigin === 'string' && allowedClientOrigins().has(decoded.clientOrigin)
        ? decoded.clientOrigin
        : undefined;
    const role = decoded.role === 'doctor' ? 'doctor' : decoded.role === 'patient' ? 'patient' : undefined;
    return { state: decoded.state, nonce: decoded.nonce, clientOrigin, role };
  } catch {
    return null;
  }
};

export class OAuthController {
  public getProviders = (_req: Request, res: Response): void => {
    res.status(200).json({
      success: true,
      providers: {
        google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
        apple: Boolean(env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY),
      },
    });
  };

  public start = (provider: OAuthProvider) => (req: Request, res: Response): void => {
    const clientOrigin = clientOriginForRequest(req);
    try {
      const requestedRole = req.query?.role;
      const requestedFlow = req.query?.flow;
      if (
        (provider === 'google' && !isOAuthRole(requestedRole)) ||
        (requestedRole !== undefined && !isOAuthRole(requestedRole)) ||
        (requestedFlow !== undefined && requestedFlow !== 'login' && requestedFlow !== 'register')
      ) {
        throw new Error('oauth_invalid_role');
      }
      const preferredRole = isOAuthRole(requestedRole) ? requestedRole : undefined;
      const flow = requestedFlow === 'register' ? 'register' : 'login';
      const transaction = {
        ...createOAuthTransaction(clientOrigin, preferredRole, flow),
        clientOrigin,
        role: preferredRole,
        flow,
      };
      const authorizationUrl = buildAuthorizationUrl(provider, transaction);
      res.cookie(
        providerCookieName(provider),
        Buffer.from(JSON.stringify(transaction)).toString('base64url'),
        cookieOptions(provider)
      );
      res.redirect(302, authorizationUrl);
    } catch (error) {
      const reason =
        error instanceof Error && error.message === `${provider}_not_configured`
          ? 'not_configured'
          : error instanceof Error && error.message === 'oauth_invalid_role'
            ? 'invalid_role'
            : 'provider_error';
      console.error(
        `[OAuth] ${provider} sign-in could not start (${reason}; code=${safeOAuthFailureCode(error)}).`
      );
      res.redirect(302, providerFailureUrl(provider, reason, clientOrigin));
    }
  };

  public callback = (provider: OAuthProvider) =>
    async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
      const cookieName = providerCookieName(provider);
      const transaction = transactionFromCookie(req.cookies?.[cookieName]);
      clearTransactionCookie(res, provider);

      // Support both GET (query parameters) and POST (form_post body)
      const paramState =
        typeof req.query.state === 'string'
          ? req.query.state
          : typeof req.body?.state === 'string'
            ? req.body.state
            : undefined;
      const paramCode =
        typeof req.query.code === 'string'
          ? req.query.code
          : typeof req.body?.code === 'string'
            ? req.body.code
            : undefined;
      const paramError =
        typeof req.query.error === 'string'
          ? req.query.error
          : typeof req.body?.error === 'string'
            ? req.body.error
            : undefined;
      const paramUser = req.query.user ?? req.body?.user;

      // The signature binds the nonce, client origin, and selected role to this OAuth attempt.
      const signedState = parseAndVerifyOAuthState(paramState);
      const clientOrigin =
        signedState?.clientOrigin && allowedClientOrigins().has(signedState.clientOrigin)
          ? signedState.clientOrigin
          : transaction?.clientOrigin && allowedClientOrigins().has(transaction.clientOrigin)
            ? transaction.clientOrigin
            : defaultClientOrigin();

      // If the provider returned an error, handle and redirect with the specific provider error reason first
      if (paramError) {
        const reason = providerCallbackFailureReason(provider, safeProviderErrorCode(paramError));
        console.warn(
          `[OAuth] ${provider} sign-in ended by provider (reason=${reason}, code=${safeProviderErrorCode(paramError)}).`
        );
        res.redirect(302, providerFailureUrl(provider, reason, clientOrigin));
        return;
      }

      if (!paramCode) {
        console.warn(
          `[OAuth] ${provider} callback rejected: authorization_code_missing (category=invalid_callback, has_state=${Boolean(paramState)}).`
        );
        res.redirect(302, providerFailureUrl(provider, 'invalid_callback', clientOrigin));
        return;
      }

      if (!paramState) {
        console.warn(`[OAuth] ${provider} callback rejected: state_missing (category=invalid_callback).`);
        res.redirect(302, providerFailureUrl(provider, 'invalid_callback', clientOrigin));
        return;
      }

      if (!signedState) {
        console.warn(
          `[OAuth] ${provider} callback rejected: state_signature_invalid_or_expired (category=invalid_callback, has_cookie=${Boolean(transaction)}).`
        );
        res.redirect(302, providerFailureUrl(provider, 'invalid_callback', clientOrigin));
        return;
      }

      const nonce = signedState.nonce;
      if (!nonce) {
        console.warn(`[OAuth] ${provider} callback rejected: nonce_missing (category=invalid_callback).`);
        res.redirect(302, providerFailureUrl(provider, 'invalid_callback', clientOrigin));
        return;
      }

      if (provider === 'google' && !isOAuthRole(signedState.role)) {
        console.warn(
          `[OAuth] ${provider} callback rejected: role_missing_or_invalid (category=invalid_callback).`
        );
        res.redirect(302, providerFailureUrl(provider, 'invalid_callback', clientOrigin));
        return;
      }

      const cookieMatches = transaction ? verifyOAuthState(transaction.state, paramState) : null;
      console.info(
        `[OAuth] ${provider} callback state verified (category=state_verified, hmac_valid=true, cookie_present=${Boolean(transaction)}, cookie_matches=${cookieMatches ?? 'n/a'}).`
      );

      let stage = 'code_exchange_or_identity_validation';
      try {
        const identity = await verifyAuthorizationCode(
          provider,
          paramCode,
          nonce
        );
        if (provider === 'apple') {
          identity.displayName = this.appleDisplayName(paramUser) || identity.displayName;
        }
        const preferredRole = signedState?.role;
        const flow = signedState?.flow ?? 'login';
        stage = 'account_linking';
        const { user, created } = await findOrCreateOAuthUser(identity, preferredRole, flow);

        stage = 'profile_linking';
        const linkedId = await ensureUserProfile(user);

        stage = 'session_creation';
        const token = JwtService.generateToken(user._id.toString(), user.role, linkedId);
        res.cookie('token', token, {
          httpOnly: true,
          secure: env.isProduction,
          sameSite: env.isProduction ? 'strict' : 'lax',
          maxAge: 24 * 60 * 60 * 1000,
        });
        res.redirect(
          302,
          providerSuccessUrl(
            provider,
            clientOrigin,
            created && flow === 'register' && env.FACE_ENROLLMENT_ENABLED
          )
        );
      } catch (error) {
        if (error instanceof Error && error.message === 'oauth_account_conflict') {
          console.warn(`[OAuth] ${provider} sign-in rejected (account_conflict).`);
          res.redirect(302, providerFailureUrl(provider, 'account_conflict', clientOrigin));
          return;
        }
        if (error instanceof Error && error.message === 'oauth_already_registered') {
          console.info(`[OAuth] ${provider} registration rejected (already_registered).`);
          res.redirect(302, providerFailureUrl(provider, 'already_registered', clientOrigin));
          return;
        }

        if (mongoose.connection.readyState !== 1 || this.isDatabaseConnectionError(error)) {
          console.error(`[OAuth] ${provider} callback failed (stage=${stage}, code=database_unavailable).`);
          res.redirect(302, providerFailureUrl(provider, 'database_unavailable', clientOrigin));
          return;
        }

        const reason = callbackFailureReason(provider, stage, error);
        console.error(
          `[OAuth] ${provider} callback failed (stage=${stage}, reason=${reason}, code=${safeOAuthFailureCode(error)}).`
        );
        res.redirect(302, providerFailureUrl(provider, reason, clientOrigin));
      }
    };

  private isDatabaseConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return /MongoNetworkError|MongoServerSelectionError|MongoNotConnectedError|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/.test(
      `${error.name} ${error.message}`
    );
  }

  private appleDisplayName(value: unknown): string | null {
    if (typeof value !== 'string' || value.length > 4096) return null;
    try {
      const appleUser = JSON.parse(value) as {
        name?: { firstName?: unknown; lastName?: unknown };
      };
      const parts = [appleUser.name?.firstName, appleUser.name?.lastName]
        .filter((part): part is string => typeof part === 'string')
        .map((part) => part.trim())
        .filter(Boolean);
      return parts.length ? parts.join(' ').slice(0, 80) : null;
    } catch {
      return null;
    }
  }
}
