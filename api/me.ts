import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const authBase = 'https://ep-ancient-dawn-a17owzjq.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth';
const jwks = createRemoteJWKSet(new URL(authBase + '/.well-known/jwks.json'));

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const databaseUrl = process.env.DATABASE_URL;
  if (!token) return res.status(401).json({ ok: false, error: 'Sign in required' });
  if (!databaseUrl) return res.status(503).json({ ok: false, error: 'Database not configured' });

  try {
    const { payload } = await jwtVerify(token, jwks);
    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const displayName = typeof payload.name === 'string' ? payload.name.trim() : '';
    if (!id || !email) return res.status(401).json({ ok: false, error: 'Invalid identity token' });

    // Owner access comes only from a server-side allowlist, never from profile input.
    const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const explicitlyUnverified = payload.email_verified === false || payload.emailVerified === false;
    const isConfiguredOwner = Boolean(configuredOwnerEmail && email === configuredOwnerEmail && !explicitlyUnverified);
    const sql = neon(databaseUrl);

    // First sign-in creates a pending profile automatically. Existing permissions are
    // preserved for ordinary accounts; the configured owner is always bootstrapped safely.
    const rows = await sql`
      insert into public.user_profiles
        (id, email, display_name, role, approval_status, updated_at, last_login_at)
      values
        (${id}, ${email}, ${displayName || email}, ${isConfiguredOwner ? 'owner' : 'student'},
         ${isConfiguredOwner ? 'approved' : 'pending'}, now(), now())
      on conflict (id) do update set
        email = excluded.email,
        display_name = coalesce(nullif(public.user_profiles.display_name, ''), excluded.display_name),
        role = case when ${isConfiguredOwner} then 'owner' else public.user_profiles.role end,
        approval_status = case when ${isConfiguredOwner} then 'approved' else public.user_profiles.approval_status end,
        updated_at = now(),
        last_login_at = now()
      returning id, email, display_name, role, approval_status
    `;

    if (!rows.length) return res.status(500).json({ ok: false, error: 'Could not create academy profile' });
    const profile = rows[0] as {id:string;email:string;display_name:string;role:string;approval_status:string};
    const storedRole = ['owner', 'tutor', 'student'].includes(profile.role) ? profile.role : 'student';
    // A stale database owner role cannot bypass the configured owner email.
    const role = isConfiguredOwner && profile.approval_status === 'approved'
      ? 'owner'
      : storedRole === 'owner'
        ? 'student'
        : profile.approval_status === 'approved' && storedRole === 'tutor'
          ? 'tutor'
          : 'student';
    return res.status(200).json({
      ok: true,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.display_name,
        role,
        approved: isConfiguredOwner || profile.approval_status === 'approved'
      }
    });
  } catch (error) {
    // Keep database/auth details out of public responses.
    return res.status(503).json({ ok: false, error: 'Unable to load or create your academy account. Check the academy database configuration.' });
  }
}
