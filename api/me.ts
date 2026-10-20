import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(new URL('https://ep-ancient-dawn-a17owzjq.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth/.well-known/jwks.json'));

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
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!id || !email) return res.status(401).json({ ok: false, error: 'Invalid identity token' });
    const sql = neon(databaseUrl);
    const rows = await sql`
      select id, email, display_name, role, approval_status
      from public.user_profiles
      where id = ${id} and lower(email) = ${email}
      limit 1
    `;
    if (!rows.length) return res.status(403).json({ ok: false, error: 'No academy profile is assigned to this account' });
    const profile = rows[0] as {id:string;email:string;display_name:string;role:string;approval_status:string};
    const role = profile.approval_status === 'approved' && ['owner','tutor','student'].includes(profile.role) ? profile.role : 'student';
    return res.status(200).json({ ok: true, profile: { id: profile.id, email: profile.email, name: profile.display_name, role, approved: profile.approval_status === 'approved' } });
  } catch {
    return res.status(401).json({ ok: false, error: 'Session could not be verified' });
  }
}
