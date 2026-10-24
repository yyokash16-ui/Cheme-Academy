import { ensureAcademySchema } from './_lib/schema';
import { neon } from '@neondatabase/serverless';

type LiveClassRow = {
  id: string;
  title: string;
  description: string;
  starts_at: string;
  duration_minutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  meeting_url: string | null;
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
    await ensureAcademySchema(sql);
    const rows = await sql`
      select id, title, description, starts_at, duration_minutes, status, meeting_url
      from live_classes
      where status = 'scheduled' and starts_at >= now()
      order by starts_at asc
      limit 100
    ` as LiveClassRow[];

    return res.status(200).json({
      ok: true,
      classes: rows.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        startsAt: item.starts_at,
        durationMinutes: item.duration_minutes,
        status: item.status,
        meetingUrl: item.meeting_url
      }))
    });
  } catch {
    return res.status(503).json({ ok: false, error: 'Unable to load live classes' });
  }
}
