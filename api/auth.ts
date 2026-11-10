// 구글·카카오·네이버 로그인 (Vercel 서버 함수)
// /api/auth?p=kakao → 그 회사 로그인 화면 → 다시 /api/auth?code=… → Supabase 일회용 로그인 토큰을 만들어 /#login=토큰 으로 돌려보낸다
// 메일은 보내지 않는다. 필요한 Vercel 환경 변수: SUPABASE_SERVICE_ROLE_KEY 와 쓰는 회사의 키 (README)
import { createClient } from '@supabase/supabase-js';

const PROVIDERS = {
    google: {
        auth: 'https://accounts.google.com/o/oauth2/v2/auth',
        token: 'https://oauth2.googleapis.com/token',
        me: 'https://openidconnect.googleapis.com/v1/userinfo',
        scope: 'openid email',
        id: 'GOOGLE_CLIENT_ID',
        secret: 'GOOGLE_CLIENT_SECRET',
    },
    kakao: { auth: 'https://kauth.kakao.com/oauth/authorize', token: 'https://kauth.kakao.com/oauth/token', me: 'https://kapi.kakao.com/v2/user/me', scope: '', id: 'KAKAO_REST_KEY', secret: 'KAKAO_CLIENT_SECRET' },
    naver: { auth: 'https://nid.naver.com/oauth2.0/authorize', token: 'https://nid.naver.com/oauth2.0/token', me: 'https://openapi.naver.com/v1/nid/me', scope: '', id: 'NAVER_CLIENT_ID', secret: 'NAVER_CLIENT_SECRET' },
} as const;
type P = keyof typeof PROVIDERS;

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://zgqmzucqboluhyhcdevr.supabase.co';
const DOMAIN = '@users.growth-log.example'; // 메일이 없는 계정용 가짜 주소 (메일을 보내지 않음)

const back = (origin: string, hash: string) =>
    new Response(null, { status: 302, headers: { Location: `${origin}/#${hash}`, 'Set-Cookie': 'auth_state=; Path=/api/auth; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });

// 회사마다 다른 사용자 정보 → Supabase 계정 이메일
// 구글은 확인된 메일만 그대로 쓴다. 카카오·네이버 메일은 확인 안 된 연락처일 수 있어 남의 계정을 가로챌 수 있으므로 고유 id 로만
export function emailOf(p: P, me: any): string | null {
    if (p === 'google') return me.email && me.email_verified ? String(me.email).toLowerCase() : me.sub ? `google_${me.sub}${DOMAIN}` : null;
    if (p === 'kakao') return me.id ? `kakao_${me.id}${DOMAIN}` : null;
    return me.response?.id ? `naver_${me.response.id}${DOMAIN}` : null;
}

export async function GET(request: Request) {
    const u = new URL(request.url);
    const origin = u.origin;
    const redirect = `${origin}/api/auth`;

    // 1) 시작: 그 회사 로그인 화면으로
    const start = u.searchParams.get('p') as P | null;
    if (start) {
        const cfg = PROVIDERS[start];
        if (!cfg || !process.env[cfg.id]) return back(origin, `login-error=${start}`);
        const state = `${start}.${crypto.randomUUID()}`;
        const q = new URLSearchParams({ response_type: 'code', client_id: process.env[cfg.id]!, redirect_uri: redirect, state });
        if (cfg.scope) q.set('scope', cfg.scope);
        return new Response(null, {
            status: 302,
            headers: { Location: `${cfg.auth}?${q}`, 'Set-Cookie': `auth_state=${state}; Path=/api/auth; Max-Age=600; HttpOnly; Secure; SameSite=Lax` },
        });
    }

    // 2) 돌아옴: 위조 방지 확인 → 토큰 교환 → 사용자 정보
    const code = u.searchParams.get('code');
    const state = u.searchParams.get('state') ?? '';
    const cookie = /(?:^|;\s*)auth_state=([^;]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
    const p = state.split('.')[0] as P;
    const cfg = PROVIDERS[p];
    if (!code || !cfg || !cookie || cookie !== state) return back(origin, `login-error=${p || 'state'}`);
    try {
        const body = new URLSearchParams({ grant_type: 'authorization_code', client_id: process.env[cfg.id]!, redirect_uri: redirect, code, state });
        if (process.env[cfg.secret]) body.set('client_secret', process.env[cfg.secret]!);
        const tok = await fetch(cfg.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        const t = (await tok.json()) as { access_token?: string };
        if (!t.access_token) throw new Error(`token ${tok.status}`);
        const me = await (await fetch(cfg.me, { headers: { Authorization: `Bearer ${t.access_token}` } })).json();
        const email = emailOf(p, me);
        if (!email) throw new Error('no id');

        // 3) Supabase 계정 만들기(처음이면) → 일회용 로그인 토큰 (메일 안 보냄)
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
        if (!key) throw new Error('no service key');
        const admin = createClient(SUPABASE_URL, key, { auth: { persistSession: false } }).auth.admin;
        await admin.createUser({ email, email_confirm: true, user_metadata: { provider: p } }); // 이미 있으면 오류 → 무시
        const { data, error } = await admin.generateLink({ type: 'magiclink', email });
        if (error || !data.properties?.hashed_token) throw error ?? new Error('no link');
        return back(origin, `login=${data.properties.hashed_token}`);
    } catch (e) {
        console.error('login 실패', p, (e as Error).message);
        return back(origin, `login-error=${p}`);
    }
}
