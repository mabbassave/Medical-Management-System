export type AppRole = 'admin' | 'doctor' | 'nurse' | 'patient';
const APP_ROLES: readonly AppRole[] = ['admin', 'doctor', 'nurse', 'patient'];

export const normalizeAppRole = (role: unknown): AppRole | null => {
  if (typeof role !== 'string') return null;
  const normalized = role.toLowerCase();
  return APP_ROLES.find((allowedRole) => allowedRole === normalized) || null;
};

export const getRoleHomeRoute = (role: unknown): string | null => {
  const normalized = normalizeAppRole(role);
  if (!normalized) return null;
  return normalized === 'patient' ? '/portal' : '/dashboard';
};
