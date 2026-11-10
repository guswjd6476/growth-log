// 1분마다 pg_cron 이 부른다: 구독한 기기마다 지금 보낼 알림(습관·마감 점검·뽀모도로)을 푸시로 보낸다
// 배포: supabase functions deploy remind --no-verify-jwt  (대신 CRON_SECRET 헤더로 막는다)
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
import { localNow, reminders, timerDone } from '../_shared/reminders.ts';

const env = (k: string) => {
    const v = Deno.env.get(k);
    if (!v) throw new Error(`${k} 없음`);
    return v;
};
webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));

Deno.serve(async (req) => {
    if (req.headers.get('x-cron-secret') !== env('CRON_SECRET')) return new Response('unauthorized', { status: 401 });
    // shortcut: 매번 전체 구독·기록을 읽음, 사용자가 수백 명을 넘으면 알림 시각만 따로 저장해 골라 읽기
    const [subs, rows] = await Promise.all([db.from('push_subs').select('endpoint, user_id, sub, tz'), db.from('user_data').select('user_id, data')]);
    if (subs.error || rows.error) return Response.json({ error: subs.error ?? rows.error }, { status: 500 });
    const byUser = new Map(rows.data.map((r) => [r.user_id, r.data]));
    const now = new Date();
    let sent = 0;
    await Promise.all(
        subs.data.map(async (s) => {
            const d = byUser.get(s.user_id);
            if (!d?.settings?.notify) return;
            const { day, hm } = localNow(now, s.tz);
            const bodies = reminders(d, day, hm).map(([, b]) => b);
            const t = timerDone(d.timer, now.getTime());
            if (t) bodies.push(t);
            for (const body of bodies) {
                try {
                    await webpush.sendNotification(s.sub, JSON.stringify({ body }));
                    sent++;
                } catch (e) {
                    const code = (e as { statusCode?: number }).statusCode;
                    // 기기에서 구독이 사라졌으면 지운다
                    if (code === 404 || code === 410) await db.from('push_subs').delete().eq('endpoint', s.endpoint);
                    else console.error('push 실패', code, (e as Error).message);
                    return;
                }
            }
        }),
    );
    return Response.json({ sent });
});
