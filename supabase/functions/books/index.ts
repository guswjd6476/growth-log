// 카카오 책 검색을 대신 불러 준다 (키를 앱에 넣지 않으려고). 키: supabase secrets 의 KAKAO_REST_KEY
// 배포: supabase functions deploy books --no-verify-jwt
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type' };

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const key = Deno.env.get('KAKAO_REST_KEY');
    if (!key) return Response.json({ error: 'no key' }, { status: 501, headers: CORS });
    const q = new URL(req.url).searchParams.get('q')?.trim().slice(0, 100);
    if (!q) return Response.json([], { status: 400, headers: CORS });
    const isbn = /^[\d-]{10,17}$/.test(q);
    const url = `https://dapi.kakao.com/v3/search/book?size=12&query=${encodeURIComponent(isbn ? q.replace(/-/g, '') : q)}${isbn ? '&target=isbn' : ''}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return Response.json({ error: 'kakao', status: res.status }, { status: 502, headers: CORS });
    const j = (await res.json()) as { documents: { title: string; authors: string[]; thumbnail: string; isbn: string }[] };
    // 카카오는 쪽수를 주지 않는다 → 0 (책을 열면 직접 입력)
    return Response.json(
        j.documents.map((d) => ({ title: d.title, author: d.authors.join(', ') || undefined, cover: d.thumbnail || undefined, isbn: d.isbn.split(' ').at(-1), pages: 0 })),
        { headers: { ...CORS, 'Cache-Control': 'public, max-age=86400' } },
    );
});
