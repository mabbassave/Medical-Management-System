import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
  type JWTVerifyGetKey,
} from 'jose';
import { env } from '../config/env';
import { UserModel, type IUserDocument } from '../database/schemas/User.schema';

export type OAuthProvider = 'google' | 'apple';

export interface OAuthIdentity {
  provider: OAuthProvider;
  subject: string;
  email: string;
  displayName?: string;
}

export interface OAuthTransaction {
  state: string;
  nonce: string;
}

export interface OAuthStatePayload {
  nonce: string;
  clientOrigin?: string;
  role?: 'patient' | 'doctor';
  flow?: 'login' | 'register';
  exp: number;
  salt: string;
}

interface ProviderClaims {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  given_name?: unknown;
  nonce?: unknown;
  exp?: unknown;
  iat?: unknown;
  iss?: unknown;
  aud?: unknown;
}

interface TokenResponse {
  id_token?: unknown;
  error?: unknown;
}

const GOOGLE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs')
);
const APPLE_JWKS = createRemoteJWKSet(
  new URL('https://appleid.apple.com/auth/keys')
);
const OAUTH_TRANSACTION_MAX_AGE_SECONDS = 10 * 60;
const SAFE_GOOGLE_ERROR_CODES = new Set([
  'access_denied',
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'invalid_scope',
  'redirect_uri_mismatch',
  'temporarily_unavailable',
  'unauthorized_client',
  'unsupported_grant_type',
  'unsupported_response_type',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
]);

const safeGoogleExchangeErrorCode = (value: unknown): string => {
  if (typeof value === 'string' && SAFE_GOOGLE_ERROR_CODES.has(value)) return value;
  return 'unrecognized_provider_error';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface GoogleExchangeFailureMetadata {
  httpStatus: string | number;
  providerCode: string;
  idTokenPresent: boolean;
  category: string;
}

const inspectGoogleExchangeFailure = (error: unknown): GoogleExchangeFailureMetadata => {
  let httpStatus: string | number = 'unknown';
  let providerCode = 'unrecognized_provider_error';
  let category = 'unexpected';
  let idTokenPresent = false;

  if (isRecord(error)) {
    const response = isRecord(error.response) ? error.response : undefined;
    const responseData = response && isRecord(response.data) ? response.data : undefined;
    const errorData = isRecord(error.data) ? error.data : undefined;
    const data = responseData || errorData;

    if (typeof response?.status === 'number') httpStatus = response.status;
    else if (typeof error.status === 'number') httpStatus = error.status;

    if (data) {
      idTokenPresent = typeof data.id_token === 'string' && data.id_token.length > 0;
      providerCode = safeGoogleExchangeErrorCode(data.error);
    }

    const code = typeof error.code === 'string' ? error.code : '';
    const cause = isRecord(error.cause) ? error.cause : undefined;
    const causeCode = typeof cause?.code === 'string' ? cause.code : '';
    const networkCode = code || causeCode;

    if (providerCode !== 'unrecognized_provider_error') {
      category = 'google_oauth_rejected';
    } else if (/^(ERR_TLS|CERT_|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE)/.test(networkCode)) {
      category = 'tls';
    } else if (['ETIMEDOUT', 'TimeoutError', 'ESOCKETTIMEDOUT'].includes(networkCode)) {
      category = 'timeout';
    } else if (
      ['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH'].includes(
        networkCode
      )
    ) {
      category = 'network';
    } else if (typeof httpStatus === 'number') {
      category = 'provider_http_error';
    }
  }

  return { httpStatus, providerCode, idTokenPresent, category };
};

export const googleExchangeFailureDetails = (error: unknown): string => {
  const { httpStatus, providerCode, idTokenPresent, category } = inspectGoogleExchangeFailure(error);
  return `http_status=${httpStatus}, provider_code=${providerCode}, id_token_present=${idTokenPresent}, category=${category}`;
};

const providerConfig = (provider: OAuthProvider) => {
  if (provider === 'google') {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      throw new Error('google_not_configured');
    }
    return {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    };
  }
  if (!env.APPLE_CLIENT_ID || !env.APPLE_TEAM_ID || !env.APPLE_KEY_ID || !env.APPLE_PRIVATE_KEY) {
    throw new Error('apple_not_configured');
  }
  return {
    clientId: env.APPLE_CLIENT_ID,
    redirectUri: env.APPLE_REDIRECT_URI,
  };
};

export const signOAuthState = (payload: OAuthStatePayload): string => {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString('base64url');
  const signature = createHmac('sha256', env.JWT_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
};

export const parseAndVerifyOAuthState = (stateString: string | undefined): OAuthStatePayload | null => {
  if (!stateString || typeof stateString !== 'string') return null;
  const parts = stateString.split('.');
  if (parts.length !== 2) return null;
  const [data, signature] = parts;
  const expectedSig = createHmac('sha256', env.JWT_SECRET).update(data).digest('base64url');
  const expectedBytes = Buffer.from(expectedSig);
  const receivedBytes = Buffer.from(signature);
  if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthStatePayload;
    if (typeof payload.nonce !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.role !== undefined && payload.role !== 'patient' && payload.role !== 'doctor') return null;
    if (payload.flow !== undefined && payload.flow !== 'login' && payload.flow !== 'register') return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

export const createOAuthTransaction = (
  clientOrigin?: string,
  role?: 'patient' | 'doctor',
  flow: 'login' | 'register' = 'login'
): OAuthTransaction => {
  const nonce = randomBytes(32).toString('base64url');
  if (!clientOrigin && !role) {
    return {
      state: randomBytes(32).toString('base64url'),
      nonce,
    };
  }
  const exp = Date.now() + OAUTH_TRANSACTION_MAX_AGE_SECONDS * 1000;
  const salt = randomBytes(16).toString('base64url');
  const state = signOAuthState({ nonce, clientOrigin, role, flow, exp, salt });
  return {
    state,
    nonce,
  };
};


export const verifyOAuthState = (expected: string | undefined, received: string | undefined): boolean => {
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
};

export const getGoogleOAuthClient = (redirectUri?: string): OAuth2Client => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('google_not_configured');
  }
  return new OAuth2Client({
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: redirectUri || env.GOOGLE_REDIRECT_URI,
  });
};

export const oauthTransactionMaxAgeSeconds = OAUTH_TRANSACTION_MAX_AGE_SECONDS;

export const buildAuthorizationUrl = (
  provider: OAuthProvider,
  transaction: OAuthTransaction,
  redirectUri?: string
): string => {
  if (provider === 'google') {
    const client = getGoogleOAuthClient(redirectUri);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      state: transaction.state,
      nonce: transaction.nonce,
      prompt: 'select_account',
      include_granted_scopes: true,
    });
  }

  const config = providerConfig(provider);
  const endpoint = 'https://appleid.apple.com/auth/authorize';
  const url = new URL(endpoint);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri || config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'form_post');
  url.searchParams.set('scope', 'openid email name');
  url.searchParams.set('state', transaction.state);
  url.searchParams.set('nonce', transaction.nonce);
  return url.toString();
};


const appleClientSecret = async (): Promise<string> => {
  const privateKey = await importPKCS8(env.APPLE_PRIVATE_KEY, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.APPLE_KEY_ID, typ: 'JWT' })
    .setIssuer(env.APPLE_TEAM_ID)
    .setSubject(env.APPLE_CLIENT_ID)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
};

const exchangeAuthorizationCode = async (
  provider: OAuthProvider,
  code: string,
  redirectUri?: string
): Promise<string> => {
  if (provider === 'google') {
    const client = getGoogleOAuthClient(redirectUri);
    try {
      const { tokens, res } = await client.getToken(code);
      if (!tokens.id_token) {
        console.error(
          `[OAuth] Google authorization code exchange returned no ID token ` +
            `(http_status=${res?.status ?? 'unknown'}, provider_code=none, id_token_present=false, category=unexpected_response).`
        );
        throw new Error('google_identity_token_missing');
      }
      console.info(
        `[OAuth] Google authorization code exchange completed ` +
          `(http_status=${res?.status ?? 'unknown'}, provider_code=none, id_token_present=true, category=success).`
      );
      return tokens.id_token;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'google_identity_token_missing') {
        throw error;
      }
      const diagnostics = inspectGoogleExchangeFailure(error);
      console.error(
        `[OAuth] Google authorization code exchange failed ` +
          `(http_status=${diagnostics.httpStatus}, provider_code=${diagnostics.providerCode}, ` +
          `id_token_present=${diagnostics.idTokenPresent}, category=${diagnostics.category}).`
      );
      if (diagnostics.providerCode === 'invalid_client') {
        throw new Error('google_client_invalid');
      }
      if (diagnostics.providerCode === 'unauthorized_client') {
        throw new Error('google_client_unauthorized');
      }
      if (diagnostics.providerCode === 'redirect_uri_mismatch') {
        throw new Error('google_redirect_mismatch');
      }
      throw new Error('google_code_exchange_failed');
    }
  }

  const config = providerConfig(provider);
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    redirect_uri: redirectUri || config.redirectUri,
    client_secret: await appleClientSecret(),
  });

  const endpoint = 'https://appleid.apple.com/auth/token';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`${provider}_code_exchange_failed`);
  }
  const tokenResponse = (await response.json()) as TokenResponse;
  if (typeof tokenResponse.id_token !== 'string' || !tokenResponse.id_token) {
    throw new Error(`${provider}_identity_token_missing`);
  }
  return tokenResponse.id_token;
};

export const verifyProviderIdentityToken = async (
  provider: OAuthProvider,
  identityToken: string,
  expectedNonce: string,
  clientId: string,
  getKey?: JWTVerifyGetKey
): Promise<OAuthIdentity> => {
  let claims: ProviderClaims;

  if (provider === 'google' && !getKey) {
    const client = new OAuth2Client({ clientId });
    try {
      const ticket = await client.verifyIdToken({
        idToken: identityToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new Error('google_identity_claims_invalid');
      }
      claims = payload as ProviderClaims;
    } catch (error) {
      if (error instanceof Error && error.message === 'google_identity_claims_invalid') {
        throw error;
      }
      throw new Error('google_identity_claims_invalid');
    }
  } else {
    const issuer =
      provider === 'google'
        ? ['https://accounts.google.com', 'accounts.google.com']
        : 'https://appleid.apple.com';
    const keyResolver = getKey || (provider === 'google' ? GOOGLE_JWKS : APPLE_JWKS);
    const { payload } = await jwtVerify(identityToken, keyResolver, {
      issuer,
      audience: clientId,
      algorithms: ['RS256'],
      maxTokenAge: '10m',
      clockTolerance: '2m',
    });
    claims = payload as ProviderClaims;
  }

  if (
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    typeof claims.exp !== 'number' ||
    claims.exp <= Math.floor(Date.now() / 1000) ||
    typeof claims.iat !== 'number' ||
    typeof claims.nonce !== 'string' ||
    !verifyOAuthState(expectedNonce, claims.nonce)
  ) {
    throw new Error(`${provider}_identity_claims_invalid`);
  }

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (
    (provider === 'google' && !email) ||
    (email && claims.email_verified !== true && claims.email_verified !== 'true')
  ) {
    throw new Error(`${provider}_identity_claims_invalid`);
  }
  const displayName = [claims.name, claims.given_name].find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0
  )?.trim();

  return { provider, subject: claims.sub, email, displayName };
};

export const verifyAuthorizationCode = async (
  provider: OAuthProvider,
  code: string,
  nonce: string,
  redirectUri?: string
): Promise<OAuthIdentity> => {
  const { clientId } = providerConfig(provider);
  const identityToken = await exchangeAuthorizationCode(provider, code, redirectUri);
  return verifyProviderIdentityToken(provider, identityToken, nonce, clientId);
};

const safeUsernameBase = (name: string | undefined, email: string): string => {
  const normalizedName = (name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
  return normalizedName || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 72) || 'patient';
};

const findAvailableUsername = async (base: string): Promise<string> => {
  let candidate = base;
  for (let suffix = 1; await UserModel.exists({ username: candidate }); suffix += 1) {
    candidate = `${base.slice(0, 72)}_${suffix}`;
  }
  return candidate;
};

const findOAuthSubjectUser = (identity: OAuthIdentity): Promise<IUserDocument | null> =>
  identity.provider === 'google'
    ? UserModel.findOne({
        $or: [
          { googleSubject: identity.subject },
          { authProvider: 'google', providerSubject: identity.subject },
        ],
      })
    : UserModel.findOne({
        authProvider: identity.provider,
        providerSubject: identity.subject,
      });

export const findOrCreateOAuthUser = async (
  identity: OAuthIdentity,
  preferredRole?: 'patient' | 'doctor',
  flow: 'login' | 'register' = 'login'
): Promise<{ user: IUserDocument; created: boolean }> => {
  const normalizedEmail = (identity.email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('oauth_email_unavailable');
  }

  const subjectUser = await findOAuthSubjectUser(identity);
  const emailUser = await UserModel.findOne({ email: normalizedEmail });
  if (subjectUser && emailUser && subjectUser._id.toString() !== emailUser._id.toString()) {
    throw new Error('oauth_account_conflict');
  }
  const existingUser = subjectUser || emailUser;

  if (existingUser && flow === 'register') {
    throw new Error('oauth_already_registered');
  }

  // Existing accounts sign in without applying new registration choices.
  if (existingUser) {
    if (
      identity.provider === 'google' &&
      existingUser.googleSubject &&
      existingUser.googleSubject !== identity.subject
    ) {
      throw new Error('oauth_account_conflict');
    }
    existingUser.isEmailVerified = true;
    if (identity.provider === 'google' && !existingUser.googleSubject) {
      existingUser.googleSubject = identity.subject;
    }
    if (!existingUser.providerSubject && existingUser.authProvider === identity.provider) {
      existingUser.providerSubject = identity.subject;
    }
    existingUser.lastLoginAt = new Date();
    if (existingUser.role === 'doctor') existingUser.doctorVerificationStatus = 'verified';
    await existingUser.save();
    return { user: existingUser, created: false };
  }

  const role: 'patient' | 'doctor' = preferredRole === 'doctor' ? 'doctor' : 'patient';
  const username = await findAvailableUsername(
    safeUsernameBase(identity.displayName, normalizedEmail)
  );

  const user = new UserModel({
    username,
    fullName: identity.displayName,
    email: normalizedEmail,
    authProvider: identity.provider,
    providerSubject: identity.subject,
    ...(identity.provider === 'google' ? { googleSubject: identity.subject } : {}),
    status: 'active',
    isEmailVerified: true,
    isPhoneVerified: false,
    faceEnrollmentStatus: 'not_enrolled',
    role,
    doctorVerificationStatus: role === 'doctor' ? 'verified' : 'not_applicable',
    lastLoginAt: new Date(),
  });

  try {
    await user.save();
    return { user, created: true };
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    ) {
      const racedSubjectUser = await findOAuthSubjectUser(identity);
      const racedEmailUser = await UserModel.findOne({ email: normalizedEmail });
      if (
        racedSubjectUser &&
        racedEmailUser &&
        racedSubjectUser._id.toString() !== racedEmailUser._id.toString()
      ) {
        throw new Error('oauth_account_conflict');
      }
      const racedUser = racedSubjectUser || racedEmailUser;
      if (racedUser) {
        if (flow === 'register') {
          throw new Error('oauth_already_registered');
        }
        if (
          identity.provider === 'google' &&
          racedUser.googleSubject &&
          racedUser.googleSubject !== identity.subject
        ) {
          throw new Error('oauth_account_conflict');
        }
        if (identity.provider === 'google' && !racedUser.googleSubject) {
          racedUser.googleSubject = identity.subject;
        }
        if (!racedUser.providerSubject && racedUser.authProvider === identity.provider) {
          racedUser.providerSubject = identity.subject;
        }
        racedUser.lastLoginAt = new Date();
        if (racedUser.role === 'doctor') racedUser.doctorVerificationStatus = 'verified';
        await racedUser.save();
        return { user: racedUser, created: false };
      }
      throw new Error('oauth_account_conflict');
    }
    throw error;
  }
};

export const createApplicationSessionToken = (
  user: IUserDocument,
  linkedId?: string
): string => JwtService.generateToken(user._id.toString(), user.role, linkedId);

import { JwtService } from './JwtService';
