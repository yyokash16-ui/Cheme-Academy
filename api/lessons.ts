import { neon } from '@neondatabase/serverless';

type LessonRow = {
  id: string;
  title: string;
  description: string | null;
  subject_area: string | null;
  video_url: string | null;
  resource_url: string | null;
  sort_order: number;
  course_title: string;
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
      select l.id, l.title, l.description, l.video_url, l.resource_url,
             l.sort_order, c.title as course_title, c.subject_area
      from lessons l
      inner join courses c on c.id = l.course_id
      where l.status = 'published' and c.status = 'published'
      order by c.title asc, l.sort_order asc
      limit 200
    ` as LessonRow[];

    return res.status(200).json({
      ok: true,
      lessons: rows.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        subject: lesson.subject_area || lesson.course_title,
        courseTitle: lesson.course_title,
        videoUrl: lesson.video_url,
        resourceUrl: lesson.resource_url,
        sortOrder: lesson.sort_order
      }))
    });
  } catch {
    return res.status(503).json({ ok: false, error: 'Unable to load lessons' });
  }
}
