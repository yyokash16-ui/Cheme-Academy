import { neon } from '@neondatabase/serverless';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(503).json({ ok: false, database: 'not_configured' });
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`select current_database() as database, now() as checked_at`;
    return res.status(200).json({
      ok: true,
      database: rows[0]?.database ?? 'connected',
      checkedAt: rows[0]?.checked_at ?? null
    });
  } catch {
    // Do not expose connection details or provider error messages publicly.
    return res.status(503).json({ ok: false, database: 'connection_failed' });
  }
}
