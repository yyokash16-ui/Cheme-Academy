import { ensureAcademySchema } from './_lib/schema';
import { neon } from '@neondatabase/serverless';

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  subject_area: string | null;
  level: string | null;
  access_type: string;
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
      select id, title, slug, description, subject_area, level, access_type
      from courses
      where status = 'published'
      order by title asc
      limit 100
    ` as CourseRow[];

    return res.status(200).json({
      ok: true,
      courses: rows.map((course) => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.subject_area,
        level: course.level,
        accessType: course.access_type
      }))
    });
  } catch {
    return res.status(503).json({ ok: false, error: 'Unable to load courses' });
  }
}
