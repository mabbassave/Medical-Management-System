import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ShieldAlert } from 'lucide-react';
import api from '../../shared/services/api';
import { COOKIE_SESSION, useAuthStore } from '../../store/authStore';
import { Spinner } from '../atoms/Spinner';
import { getRoleHomeRoute } from '../../shared/utils/roleRoutes';

const failureMessages: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. You can try again whenever you are ready.',
  invalid_callback: 'The sign-in response could not be verified. Please start again.',
  account_conflict: 'An account already uses this email with another sign-in method. Sign in using that method first.',
  already_registered: 'This user is already registered. Please log in.',
  email_unavailable: 'Google did not provide a verified email address for this account. Check your Google account and try again.',
  database_unavailable: 'We could not reach the account database. Your sign-in was not completed; please try again later.',
  not_configured: 'This sign-in provider is not configured on the server yet.',
  invalid_role: 'Choose Patient or Doctor before continuing with Google.',
  google_redirect_mismatch: 'Google rejected the callback URL. In Google Cloud Console, add http://localhost:5000/api/auth/google/callback as an authorized redirect URI.',
  google_client_invalid: 'Google rejected the OAuth client. Check that the Client ID and Client Secret belong to the same Web application client, then restart the backend.',
  google_client_unauthorized: 'This Google OAuth client is not authorized for the requested sign-in. Check the client type and consent-screen configuration.',
  google_access_restricted: 'Google policy blocks this account from signing in. Check the consent screen test-user list or organization access policy.',
  google_request_invalid: 'Google rejected the sign-in request. Check the OAuth client configuration and requested scopes.',
  google_exchange_failed: 'Google could not verify the sign-in request. Confirm the server client ID and secret belong to the same OAuth client and that the registered callback URL is exact.',
  google_identity_rejected: 'Google returned identity details that could not be verified. Please retry, or contact support if this keeps happening.',
  account_creation_failed: 'Google sign-in was verified, but Medivanta could not create or find the account.',
  profile_setup_failed: 'Your account was verified, but Medivanta could not finish setting up its profile.',
  session_creation_failed: 'Your account was verified, but Medivanta could not start a secure session. Please try again.',
  provider_error: 'The identity provider could not complete sign-in. Please try again.',
};

interface SessionResponse {
  user?: {
    id: string;
    username?: string;
    fullName?: string;
    name?: string;
    email: string;
    role: string;
    patientId?: string;
    doctorId?: string;
    doctorVerificationStatus?: 'verified' | 'not_applicable';
    specialty?: string;
    licenseNumber?: string;
    faceEnrollmentStatus?: string;
    faceEnrollmentAvailable?: boolean;
  };
}

export const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const status = searchParams.get('status');
  const enrollFaceAfterSignup = searchParams.get('enroll_face') === '1';
  const reason = searchParams.get('reason') || 'provider_error';
  const error = status === 'success'
    ? sessionError
    : failureMessages[reason] || failureMessages.provider_error;

  useEffect(() => {
    if (status !== 'success') return;

    let active = true;
    api.get('/auth/session', { skipToast: true })
      .then((response) => {
        if (!active) return;
        const { user } = response as SessionResponse;
        if (!user) throw new Error('The server did not return the authenticated account.');
        const destination = getRoleHomeRoute(user.role);
        if (!destination) {
          throw new Error('Your account role could not be confirmed. Please contact support.');
        }
        login(user, COOKIE_SESSION);
        toast.success(enrollFaceAfterSignup ? 'Account created successfully.' : 'Welcome Back!');
        if (enrollFaceAfterSignup) {
          navigate('/face-enrollment-prompt', { replace: true });
          return;
        }
        navigate(destination, { replace: true });
      })
      .catch((caught: unknown) => {
        if (!active) return;
        const message = caught instanceof Error
          ? caught.message
          : 'Unable to complete sign-in. Please try again.';
        setSessionError(message);
      });

    return () => {
      active = false;
    };
  }, [enrollFaceAfterSignup, login, navigate, status]);

  if (!error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#171B1A] px-5 text-white">
        <div role="status" className="flex items-center gap-3 text-sm text-white/75">
          <Spinner size="sm" />
          Verifying Google sign-in…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#171B1A] px-5 text-white">
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#202725] p-8 text-center shadow-2xl">
        <ShieldAlert className="mx-auto mb-4 h-9 w-9 text-[#CFE0FF]" aria-hidden="true" />
        <h1 className="mb-3 text-2xl font-semibold">Sign-in could not be completed</h1>
        <p role="alert" className="mb-7 text-sm leading-6 text-white/65">{error}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="rounded-xl bg-[#CFE0FF] px-5 py-3 text-sm font-semibold text-[#171B1A] hover:bg-[#DCE7FF]" to="/login">
            Log in
          </Link>
          <Link className="rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white hover:bg-white/5" to="/register">
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
};
