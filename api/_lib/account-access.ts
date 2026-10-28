export type AccountRole = 'student' | 'tutor' | 'owner';
export type AccountStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function isConfiguredOwnerEmail(identityEmail: unknown, configuredOwnerEmail: unknown): boolean {
  const configured = normalizeEmail(configuredOwnerEmail);
  return configured.length > 0 && normalizeEmail(identityEmail) === configured;
}

export function isVerifiedConfiguredOwner(
  identityEmail: unknown,
  emailVerified: unknown,
  configuredOwnerEmail: unknown
): boolean {
  return emailVerified === true && isConfiguredOwnerEmail(identityEmail, configuredOwnerEmail);
}

export function resolveAccountRole(input: {
  identityEmail: unknown;
  emailVerified: unknown;
  configuredOwnerEmail: unknown;
  storedRole: unknown;
  approvalStatus: unknown;
}): AccountRole {
  if (
    isVerifiedConfiguredOwner(input.identityEmail, input.emailVerified, input.configuredOwnerEmail) &&
    input.storedRole === 'owner' &&
    input.approvalStatus === 'approved'
  ) return 'owner';

  if (input.approvalStatus === 'approved' && input.storedRole === 'tutor') return 'tutor';
  return 'student';
}

export function canManageOwnerPortal(input: {
  identityEmail: unknown;
  emailVerified: unknown;
  configuredOwnerEmail: unknown;
  profileRole: unknown;
  approvalStatus: unknown;
}): boolean {
  return isVerifiedConfiguredOwner(input.identityEmail, input.emailVerified, input.configuredOwnerEmail) &&
    input.profileRole === 'owner' &&
    input.approvalStatus === 'approved';
}

export function normalizeReviewDecision(input: {
  targetEmail: unknown;
  configuredOwnerEmail: unknown;
  status: unknown;
  role: unknown;
}): { status: AccountStatus; role: Exclude<AccountRole, 'owner'> } | null {
  if (!input.targetEmail || isConfiguredOwnerEmail(input.targetEmail, input.configuredOwnerEmail)) return null;
  if (!['pending', 'approved', 'rejected', 'suspended'].includes(String(input.status))) return null;
  if (!['student', 'tutor'].includes(String(input.role))) return null;
  return {
    status: input.status as AccountStatus,
    role: input.role as Exclude<AccountRole, 'owner'>
  };
}

export function accountForReview(authUser: {
  id: unknown;
  email: unknown;
  name?: unknown;
  createdAt?: unknown;
}, profile?: {
  id?: unknown;
  displayName?: unknown;
  role?: unknown;
  approvalStatus?: unknown;
  lastLoginAt?: unknown;
} | null) {
  const email = normalizeEmail(authUser.email);
  const storedRole: AccountRole = ['student', 'tutor', 'owner'].includes(String(profile?.role))
    ? profile?.role as AccountRole
    : 'student';
  const status: AccountStatus = ['pending', 'approved', 'rejected', 'suspended'].includes(String(profile?.approvalStatus))
    ? profile?.approvalStatus as AccountStatus
    : 'pending';
  const profileName = typeof profile?.displayName === 'string' ? profile.displayName.trim() : '';
  const authName = typeof authUser.name === 'string' ? authUser.name.trim() : '';

  return {
    id: typeof profile?.id === 'string' ? profile.id : String(authUser.id),
    auth_id: String(authUser.id),
    email,
    display_name: profileName || authName || email,
    role: storedRole === 'owner' ? 'student' : storedRole,
    approval_status: status,
    created_at: authUser.createdAt ?? null,
    last_login_at: profile?.lastLoginAt ?? null
  };
}
