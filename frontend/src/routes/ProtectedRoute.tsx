// Redirects guests and authenticated users to the correct route groups.
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../shared/services/api';
import { COOKIE_SESSION, useAuthStore, type User } from '../store/authStore';
import { getRoleHomeRoute, normalizeAppRole } from '../shared/utils/roleRoutes';
import { Spinner } from '../components/atoms/Spinner';

interface ProtectedRouteProps {
  children: React.ReactElement;
  allowedRoles?: string[];
}

interface SessionResponse {
  user?: User;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { token, user, sessionVerified, login, logout } = useAuthStore();
  const [sessionError, setSessionError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token || sessionVerified) return;
    let active = true;

    api.get('/auth/session', { skipToast: true })
      .then((response) => {
        const currentUser = (response as SessionResponse).user;
        if (!currentUser || typeof currentUser.role !== 'string') {
          throw new Error('The server did not return a valid authenticated profile.');
        }
        if (active) login(currentUser, token || COOKIE_SESSION);
      })
      .catch(() => {
        if (active && useAuthStore.getState().token) setSessionError(true);
      });

    return () => {
      active = false;
    };
  }, [login, retry, sessionVerified, token]);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  if (!sessionVerified) {
    if (sessionError) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-background px-5">
          <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
            <h1 className="text-lg font-semibold text-textPrimary">Could not verify your session</h1>
            <p className="mt-2 text-sm text-textSecondary">
              Your dashboard remains unavailable until Medivanta confirms your account.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSessionError(false);
                  setRetry((attempt) => attempt + 1);
                }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold text-textPrimary"
              >
                Sign out
              </button>
            </div>
          </section>
        </main>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" role="status" aria-label="Verifying session">
        <Spinner size="lg" />
      </div>
    );
  }

  const role = normalizeAppRole(user?.role);
  if (!role) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-5">
        <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-lg">
          <h1 className="text-lg font-semibold text-textPrimary">Account role unavailable</h1>
          <p className="mt-2 text-sm text-textSecondary">
            Medivanta could not identify an authorized dashboard for this account. Sign out and contact support.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-textPrimary"
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHomeRoute(role) || '/'} replace />;
  }

  return children;
};

// Keeps authenticated users out of public authentication pages.
export const GuestRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { token, user } = useAuthStore();
  if (token) {
    return <Navigate to={getRoleHomeRoute(user?.role) || '/dashboard'} replace />;
  }
  return children;
};
