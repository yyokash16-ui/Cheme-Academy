import { ensureAcademySchema } from './_lib/schema.ts';
import { isConfiguredOwnerEmail, resolveAccountRole } from './_lib/account-access.ts';
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

  let payload: any;
  try {
    ({ payload } = await jwtVerify(token, jwks));
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid session' });
  }

  try {
    const id = typeof payload.sub === 'string' ? payload.sub : '';
    if (!id) return res.status(401).json({ ok: false, error: 'Invalid identity token' });

    const sql = neon(databaseUrl);
    await ensureAcademySchema(sql);

    // Do not depend on optional email claims in the JWT. Resolve the verified session
    // subject against Neon Auth's own user table, then use that server-side identity
    // consistently for owner matching and the academy profile.
    const identities = await sql`
      select id::text as id, lower(email) as email, name,
             "emailVerified" as email_verified
      from neon_auth."user"
      where id::text = ${id}
      limit 1
    `;
    if (!identities.length || typeof identities[0].email !== 'string') {
      return res.status(401).json({ ok: false, error: 'Your sign-in identity could not be matched. Sign out and sign in again.' });
    }
    const email = String(identities[0].email).trim().toLowerCase();
    const emailVerified = identities[0].email_verified === true;
    const displayName = typeof identities[0].name === 'string'
      ? identities[0].name.trim()
      : (typeof payload.name === 'string' ? payload.name.trim() : '');
    const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
    const hasOwnerAccess = emailVerified && isConfiguredOwnerEmail(email, configuredOwnerEmail);
    // Keep an existing owner's profile ID stable so academy content ownership links
    // remain valid if the auth user ID changes. A database role alone never grants
    // owner access; the authenticated email must match the server-only setting.
    const existingOwner = hasOwnerAccess ? await sql`
      select id from public.user_profiles
      where lower(email) = ${email}
      limit 1
    ` : [];

    // First sign-in creates a pending profile automatically. Existing permissions are
    // preserved for ordinary accounts; the configured owner is always bootstrapped safely.
    let rows: any[];
    if (hasOwnerAccess && existingOwner.length > 0 && String(existingOwner[0].id) !== id) {
      // Preserve the owner profile ID so existing course/class ownership references remain valid.
      rows = await sql`
        update public.user_profiles
        set display_name = coalesce(nullif(display_name, ''), ${displayName || email}),
            role = 'owner', approval_status = 'approved',
            updated_at = now(), last_login_at = now()
        where id = ${String(existingOwner[0].id)}
          and lower(email) = ${email}
        returning id, email, display_name, role, approval_status
      `;
    } else {
      rows = await sql`
        insert into public.user_profiles
          (id, email, display_name, role, approval_status, updated_at, last_login_at)
        values
          (${id}, ${email}, ${displayName || email}, ${hasOwnerAccess ? 'owner' : 'student'},
           ${hasOwnerAccess ? 'approved' : 'pending'}, now(), now())
        on conflict (id) do update set
          email = excluded.email,
          display_name = coalesce(nullif(user_profiles.display_name, ''), excluded.display_name),
          role = case when ${hasOwnerAccess} then 'owner' when user_profiles.role = 'owner' then 'student' else user_profiles.role end,
          approval_status = case when ${hasOwnerAccess} then 'approved' when user_profiles.role = 'owner' then 'pending' else user_profiles.approval_status end,
          updated_at = now(),
          last_login_at = now()
        returning id, email, display_name, role, approval_status
      `;
    }

    if (!rows.length) return res.status(500).json({ ok: false, error: 'Could not create academy profile' });
    const profile = rows[0] as {id:string;email:string;display_name:string;role:string;approval_status:string};
    const role = resolveAccountRole({
      identityEmail: email,
      emailVerified,
      configuredOwnerEmail,
      storedRole: profile.role,
      approvalStatus: profile.approval_status
    });
    return res.status(200).json({
      ok: true,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.display_name,
        role,
        // Every authenticated account receives the standard learning experience.
        // The database status is kept separately for the owner's review queue.
        approved: true,
        reviewPending: !hasOwnerAccess && profile.approval_status === 'pending'
      }
    });
  } catch (error) {
    // Keep database/auth details out of public responses.
    return res.status(503).json({ ok: false, error: 'Unable to load or create your academy account. Check the academy database configuration.' });
  }
}
