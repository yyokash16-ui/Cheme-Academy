import { neon } from '@neondatabase/serverless';

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'students' | 'tutors';
  created_at: string;
};

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return res.status(503).json({ ok: false, error: 'Database not configured' });
  }

  try {
    const sql = neon(databaseUrl);
    const rows = await sql`
      select id, title, body, audience, created_at
      from announcements
      where published = true and audience = 'all'
      order by created_at desc
      limit 100
    ` as AnnouncementRow[];

    return res.status(200).json({
      ok: true,
      announcements: rows.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        audience: item.audience,
        createdAt: item.created_at
      }))
    });
  } catch {
    return res.status(503).json({ ok: false, error: 'Unable to load announcements' });
  }
}
