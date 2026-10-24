import { ensureAcademySchema } from './_lib/schema';
import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const authBase = 'https://ep-ancient-dawn-a17owzjq.neonauth.ap-southeast-1.aws.neon.tech/neondb/auth';
const jwks = createRemoteJWKSet(new URL(authBase + '/.well-known/jwks.json'));

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const databaseUrl = process.env.DATABASE_URL;
  const configuredOwnerEmail = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (!databaseUrl) return res.status(503).json({ ok: false, error: 'Database not configured' });
  if (!configuredOwnerEmail) return res.status(503).json({ ok: false, error: 'Owner account is not configured yet' });

  const header = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ ok: false, error: 'Sign in required' });
  try {
    const { payload } = await jwtVerify(token, jwks);
    const userId = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const explicitlyUnverified = payload.email_verified === false || payload.emailVerified === false;
    if (!userId || !email) return res.status(401).json({ ok: false, error: 'Invalid identity token' });
    if (email !== configuredOwnerEmail || explicitlyUnverified) return res.status(403).json({ ok: false, error: 'Owner permission required' });

    const sql = neon(databaseUrl);
    await ensureAcademySchema(sql);
    const owners = await sql`select id from public.user_profiles where id = ${userId} and lower(email) = ${email} and role = 'owner' and approval_status = 'approved' limit 1`;
    if (!owners.length) return res.status(403).json({ ok: false, error: 'Owner permission required' });
    const ownerId = String(owners[0].id);

    if (req.method === 'GET') {
      const [users, courses, classes, lessons, announcements, enrollments] = await Promise.all([
        sql`select id,email,display_name,role,approval_status,created_at,last_login_at from public.user_profiles order by created_at desc limit 500`,
        sql`select id,title,slug,description,subject_area,level,status,access_type,created_at from public.courses order by created_at desc limit 200`,
        sql`select lc.id,lc.title,lc.description,lc.starts_at,lc.duration_minutes,lc.status,lc.meeting_url,lc.tutor_user_id,up.display_name as tutor_name from public.live_classes lc left join public.user_profiles up on up.id=lc.tutor_user_id order by lc.starts_at desc limit 200`,
        sql`select l.id,l.title,l.description,l.video_url,l.resource_url,l.status,c.title as course_title from public.lessons l join public.courses c on c.id=l.course_id order by l.created_at desc limit 300`,
        sql`select id,title,body,audience,published,created_at from public.announcements order by created_at desc limit 200`,
        sql`select er.id,er.student_user_id,er.course_id,er.status,er.created_at,up.display_name as student_name,up.email as student_email,c.title as course_title from public.enrollment_requests er join public.user_profiles up on up.id=er.student_user_id join public.courses c on c.id=er.course_id order by er.created_at desc limit 300`
      ]);
      return res.status(200).json({ ok: true, users, courses, classes, lessons, announcements, enrollments });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'set-user-access') {
      const id = String(body.id || ''), status = String(body.status || ''), role = String(body.role || 'student');
      // Only the configured owner can own the portal. Other accounts may be students or tutors.
      if (!id || !['approved','rejected','suspended','pending'].includes(status) || !['student','tutor'].includes(role)) {
        return res.status(400).json({ ok: false, error: 'Choose a valid account status and learner/tutor access level' });
      }
      if (id === ownerId) return res.status(400).json({ ok: false, error: 'Owner access cannot be changed from this screen' });
      const updated = await sql`
        update public.user_profiles
        set role = ${role}, approval_status = ${status}, approved_by = ${ownerId},
            approved_at = case when ${status} = 'approved' then now() else null end,
            updated_at = now()
        where id = ${id} and lower(email) <> ${configuredOwnerEmail}
        returning id
      `;
      if (!updated.length) return res.status(404).json({ ok: false, error: 'Account not found or cannot be changed' });
      return res.status(200).json({ ok: true });
    }
    if (action === 'create-course') {
      const title=String(body.title||'').trim(), description=String(body.description||'').trim(), subject=String(body.subject||'Chemical Engineering').trim(), level=String(body.level||'undergraduate').trim(), access=String(body.access||'approval_required'), status=String(body.status||'draft');
      if (!title || !['draft','published','archived'].includes(status) || !['approval_required','free','paid'].includes(access)) return res.status(400).json({ ok: false, error: 'Provide a title and valid course status/access type' });
      const slug=title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)+'-'+Date.now().toString(36);
      await sql`insert into public.courses(title,slug,description,subject_area,level,status,access_type,created_by) values(${title},${slug},${description},${subject},${level},${status},${access},${ownerId})`;
      return res.status(201).json({ ok: true });
    }
    if (action === 'create-class') {
      const title=String(body.title||'').trim(), description=String(body.description||'').trim(), starts=String(body.startsAt||''), meeting=String(body.meetingUrl||'').trim(), tutor=String(body.tutorId||'').trim(), duration=Number(body.duration||60);
      if (!title || !starts || !Number.isFinite(Date.parse(starts)) || !Number.isInteger(duration) || duration<1) return res.status(400).json({ ok: false, error: 'A title, valid start time and positive duration are required' });
      if (meeting && !/^https:\/\//i.test(meeting)) return res.status(400).json({ ok: false, error: 'Meeting URL must use HTTPS' });
      if (tutor) { const valid=await sql`select id from public.user_profiles where id=${tutor} and role='tutor' and approval_status='approved' limit 1`; if (!valid.length) return res.status(400).json({ ok: false, error: 'Choose an approved tutor' }); }
      await sql`insert into public.live_classes(title,description,starts_at,duration_minutes,meeting_url,tutor_user_id,status) values(${title},${description},${starts},${duration},${meeting||null},${tutor||null},'scheduled')`;
      return res.status(201).json({ ok: true });
    }
    if (action === 'create-announcement') {
      const title=String(body.title||'').trim(), message=String(body.body||'').trim(), audience=String(body.audience||'all'), published=body.published===true;
      if (!title || !message || !['all','students','tutors'].includes(audience)) return res.status(400).json({ ok: false, error: 'Title, message and a valid audience are required' });
      await sql`insert into public.announcements(title,body,audience,published,created_by) values(${title},${message},${audience},${published},${ownerId})`;
      return res.status(201).json({ ok: true });
    }
    if (action === 'set-course-status') {
      const id=String(body.id||''), status=String(body.status||'');
      if (!id || !['draft','published','archived'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid course status' });
      await sql`update public.courses set status=${status},updated_at=now() where id=${id}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'set-class-status') {
      const id=String(body.id||''), status=String(body.status||'');
      if (!id || !['scheduled','completed','cancelled'].includes(status)) return res.status(400).json({ ok: false, error: 'Invalid class status' });
      await sql`update public.live_classes set status=${status} where id=${id}`;
      return res.status(200).json({ ok: true });
    }
    if (action === 'set-announcement-published') {
      const id=String(body.id||''), published=body.published===true;
      if (!id) return res.status(400).json({ ok: false, error: 'Announcement id is required' });
      await sql`update public.announcements set published=${published} where id=${id}`;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: 'Unknown owner action' });
  } catch {
    return res.status(503).json({ ok: false, error: 'Owner request failed. Check the academy database configuration.' });
  }
}
