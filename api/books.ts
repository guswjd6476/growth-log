// Vercel 서버 함수: 카카오 책 검색을 대신 불러 준다 (키를 브라우저에 노출하지 않으려고)
// Vercel 환경 변수 KAKAO_REST_KEY 가 있어야 한다. 없으면 501 → 앱이 Google 검색으로 넘어간다.
export async function GET(request: Request) {
    const key = process.env.KAKAO_REST_KEY;
    if (!key) return Response.json({ error: 'no key' }, { status: 501 });
    const q = new URL(request.url).searchParams.get('q')?.trim().slice(0, 100);
    if (!q) return Response.json([], { status: 400 });
    const isbn = /^[\d-]{10,17}$/.test(q);
    const url = `https://dapi.kakao.com/v3/search/book?size=12&query=${encodeURIComponent(isbn ? q.replace(/-/g, '') : q)}${isbn ? '&target=isbn' : ''}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return Response.json({ error: 'kakao' }, { status: 502 });
    const j = (await res.json()) as { documents: { title: string; authors: string[]; thumbnail: string; isbn: string }[] };
    // 카카오는 쪽수를 주지 않는다 → 0 (책을 열면 직접 입력)
    return Response.json(
        j.documents.map((d) => ({ title: d.title, author: d.authors.join(', ') || undefined, cover: d.thumbnail || undefined, isbn: d.isbn.split(' ').at(-1), pages: 0 })),
        { headers: { 'Cache-Control': 's-maxage=86400' } },
    );
}
