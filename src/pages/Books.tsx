import { useState } from 'react';
import { uid, update, useData } from '../lib/store';
import { keyOf, shortDay, today } from '../lib/date';
import { BOOK_QUESTIONS, finishBookGoals, readingCount } from '../lib/logic';
import { Bar, Btn, Card, Chip, Empty, inputCls, label, PageTitle, Sheet, useAsk } from '../components/ui';
import type { Book, BookNote, BookStatus, Data, GoalPeriod } from '../lib/types';

const STATUS: [BookStatus, string][] = [
    ['reading', '읽는 중'],
    ['want', '읽고 싶은'],
    ['paused', '보류'],
    ['done', '완독'],
    ['dropped', '포기'],
];

export default function BooksPage() {
    const data = useData();
    const [tab, setTab] = useState<BookStatus>('reading');
    const [adding, setAdding] = useState(false);
    const [openId, setOpenId] = useState<string | null>(null);
    const list = data.books.filter((b) => b.status === tab).sort((a, b) => b.lastTouched.localeCompare(a.lastTouched));
    const open = data.books.find((b) => b.id === openId) ?? null;

    return (
        <>
            <PageTitle sub={`올해 완독 ${data.books.filter((b) => b.status === 'done' && b.finishedAt?.startsWith(today().slice(0, 4))).length}권`} extra={<Btn onClick={() => setAdding(true)}>+ 책 추가</Btn>}>
                독서
            </PageTitle>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                {STATUS.map(([s, l]) => (
                    <Chip key={s} active={tab === s} onClick={() => setTab(s)}>
                        {l} {data.books.filter((b) => b.status === s).length}
                    </Chip>
                ))}
            </div>
            {tab === 'reading' && readingCount(data.books) > data.settings.wipLimit && (
                <p className="text-[13px] text-[#e42939] mb-3 px-1">동시에 읽는 책이 한도({data.settings.wipLimit}권)를 넘었어요. 하나를 끝내거나 보류해 보세요.</p>
            )}
            {tab === 'done' && list.length > 0 ? (
                <Shelf books={list} onOpen={setOpenId} />
            ) : (
            <div className="space-y-2">
                {list.length ? (
                    list.map((b) => (
                        <button key={b.id} type="button" onClick={() => setOpenId(b.id)} className="w-full text-left">
                            <Card className="flex gap-3">
                                <Cover b={b} />
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-[15px] truncate">{b.title}</div>
                                    <div className="text-[13px] text-[#8b95a1] truncate">{b.author}</div>
                                    {b.status !== 'want' && b.pages > 0 && (
                                        <>
                                            <Bar value={b.current / b.pages} className="mt-2" />
                                            <div className="text-[12px] text-[#8b95a1] mt-1">
                                                {b.current}/{b.pages}쪽 · {Math.round((b.current / b.pages) * 100)}%{b.rating ? ` · ${'★'.repeat(b.rating)}` : ''}
                                            </div>
                                        </>
                                    )}
                                    {b.dropReason && <div className="text-[12px] text-[#8b95a1] mt-1">포기: {b.dropReason}</div>}
                                    {goalOf(data, b.id) && <div className="text-[12px] text-brand font-semibold mt-1">🎯 {PERIOD_LABEL[goalOf(data, b.id)!.period]} 읽기 목표</div>}
                                </div>
                            </Card>
                        </button>
                    ))
                ) : (
                    <Card>
                        <Empty>책이 없어요</Empty>
                    </Card>
                )}
            </div>
            )}
            <AddBookSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => setOpenId(id)} />
            {open && <BookSheet b={open} onClose={() => setOpenId(null)} />}
        </>
    );
}

const PERIOD_LABEL: Record<GoalPeriod, string> = { week: '이번 주', month: '이번 달', year: '올해' };
// 이 책에 걸린, 아직 진행 중인 목표
const goalOf = (d: Data, bookId: string) => d.goals.find((g) => g.bookId === bookId && !g.done && !g.dropped);

// 다 읽은 책 표지를 연도별로 나열
function Shelf({ books, onOpen }: { books: Book[]; onOpen: (id: string) => void }) {
    const years = new Map<string, Book[]>();
    [...books]
        .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
        .forEach((b) => {
            const y = (b.finishedAt ?? b.lastTouched).slice(0, 4);
            years.set(y, [...(years.get(y) ?? []), b]);
        });
    return (
        <div className="space-y-5">
            {[...years].map(([y, list]) => (
                <section key={y}>
                    <h2 className="text-[15px] font-bold mb-2 px-1">
                        {y}년 <span className="text-[#8b95a1] font-semibold">{list.length}권</span>
                    </h2>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {list.map((b) => (
                            <button key={b.id} type="button" onClick={() => onOpen(b.id)} className="text-left" aria-label={b.title}>
                                {b.cover ? (
                                    <img src={b.cover} alt="" loading="lazy" className="w-full aspect-[2/3] rounded-lg object-cover bg-[#f2f4f6] shadow-sm" />
                                ) : (
                                    <div className="w-full aspect-[2/3] rounded-lg bg-brand-soft dark:bg-[#1d2c44] p-2 flex items-center text-[12px] font-semibold leading-4 text-brand line-clamp-5 shadow-sm">{b.title}</div>
                                )}
                                <div className="text-[12px] font-semibold mt-1 truncate">{b.title}</div>
                                <div className="text-[11px] text-[#8b95a1] h-4">
                                    {b.rating ? <span className="text-[#ffb400]">{'★'.repeat(b.rating)}</span> : null}
                                    {b.review ? ' ✍️' : ''}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

function Cover({ b }: { b: Book }) {
    return b.cover ? (
        <img src={b.cover} alt="" className="w-12 h-[68px] rounded-md object-cover shrink-0 bg-[#f2f4f6]" />
    ) : (
        <div className="w-12 h-[68px] rounded-md shrink-0 bg-brand-soft dark:bg-[#1d2c44] flex items-center justify-center text-xl">📘</div>
    );
}

interface Found {
    title: string;
    author?: string;
    cover?: string;
    isbn?: string;
    pages: number;
}

// 카카오(Supabase 함수 → Vercel 함수) → Google 도서 → Open Library 순으로 찾는다. 다 안 되면 직접 입력
// Google 은 키 없이 쓰면 하루 사용량이 금방 바닥나서(429) 예비로만 쓴다
const SB_URL = (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zgqmzucqboluhyhcdevr.supabase.co') as string;
async function searchBooks(q: string): Promise<Found[]> {
    for (const url of [`${SB_URL}/functions/v1/books?q=${encodeURIComponent(q)}`, `/api/books?q=${encodeURIComponent(q)}`]) {
        try {
            const r = await fetch(url);
            if (r.ok) return await r.json();
        } catch {
            // 다음 방법으로
        }
    }
    const isbn = /^[\d-]{10,17}$/.test(q.trim()) ? q.replace(/-/g, '') : null;
    try {
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(isbn ? `isbn:${isbn}` : q)}&maxResults=12`);
        if (res.ok) {
            const j = await res.json();
            return (j.items ?? []).map((it: { volumeInfo: Record<string, any> }) => {
                const v = it.volumeInfo;
                return {
                    title: v.title + (v.subtitle ? `: ${v.subtitle}` : ''),
                    author: v.authors?.join(', '),
                    cover: v.imageLinks?.thumbnail?.replace('http://', 'https://'),
                    isbn: v.industryIdentifiers?.find((x: { type: string }) => x.type === 'ISBN_13')?.identifier,
                    pages: v.pageCount ?? 0,
                };
            });
        }
    } catch {
        // Open Library 로
    }
    const res = await fetch(`https://openlibrary.org/search.json?${isbn ? `isbn=${isbn}` : `q=${encodeURIComponent(q)}`}&limit=12&fields=title,author_name,cover_i,isbn,number_of_pages_median`);
    if (!res.ok) throw new Error('검색 실패');
    const j = (await res.json()) as { docs: { title: string; author_name?: string[]; cover_i?: number; isbn?: string[]; number_of_pages_median?: number }[] };
    return j.docs.map((d) => ({
        title: d.title,
        author: d.author_name?.join(', '),
        cover: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : undefined,
        isbn: d.isbn?.find((x) => x.length === 13),
        pages: d.number_of_pages_median ?? 0,
    }));
}

function AddBookSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
    const [q, setQ] = useState('');
    const [found, setFound] = useState<Found[]>([]);
    const [state, setState] = useState<'idle' | 'loading' | 'error' | 'empty'>('idle');
    const [manual, setManual] = useState({ title: '', author: '', pages: '' });

    const add = (f: Found, status: BookStatus) => {
        const id = uid();
        update((d) => {
            d.books.push({ id, ...f, current: 0, status, startedAt: status === 'reading' ? today() : undefined, lastTouched: today(), notes: [], progress: [] });
        });
        onClose();
        onAdded(id);
    };
    const search = async () => {
        if (!q.trim()) return;
        setState('loading');
        try {
            const r = await searchBooks(q);
            setFound(r);
            setState(r.length ? 'idle' : 'empty');
        } catch {
            setState('error');
        }
    };

    return (
        <Sheet open={open} onClose={onClose} title="책 추가">
            <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), search())}>
                <input className={inputCls} placeholder="제목, 저자, ISBN" value={q} onChange={(e) => setQ(e.target.value)} />
                <Btn type="submit" className="shrink-0" disabled={state === 'loading'}>
                    검색
                </Btn>
            </form>
            {state === 'loading' && <p className="text-[13px] text-[#8b95a1] mt-2">찾는 중…</p>}
            {state === 'empty' && <p className="text-[13px] text-[#8b95a1] mt-2">찾는 책이 없어요. 제목을 짧게 바꿔 보거나 아래에 직접 적어 주세요.</p>}
            {state === 'error' && <p className="text-[13px] text-[#e42939] mt-2">검색이 안 돼요. 아래에 직접 적어 주세요.</p>}
            <ul className="mt-3 space-y-2">
                {found.map((f, i) => (
                    <li key={i} className="flex gap-3 items-center">
                        <Cover b={{ cover: f.cover } as Book} />
                        <div className="min-w-0 flex-1">
                            <div className="text-[14px] font-semibold line-clamp-2">{f.title}</div>
                            <div className="text-[12px] text-[#8b95a1] truncate">
                                {f.author} {f.pages ? `· ${f.pages}쪽` : ''}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Btn small onClick={() => add(f, 'reading')}>
                                읽기 시작
                            </Btn>
                            <Btn small kind="ghost" onClick={() => add(f, 'want')}>
                                찜
                            </Btn>
                        </div>
                    </li>
                ))}
            </ul>
            <label className={label}>직접 입력</label>
            <input className={inputCls} placeholder="제목" value={manual.title} onChange={(e) => setManual({ ...manual, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2 mt-2">
                <input className={inputCls} placeholder="저자" value={manual.author} onChange={(e) => setManual({ ...manual, author: e.target.value })} />
                <input type="number" inputMode="numeric" className={inputCls} placeholder="전체 쪽수" value={manual.pages} onChange={(e) => setManual({ ...manual, pages: e.target.value })} />
            </div>
            <Btn
                kind="soft"
                className="w-full mt-3"
                disabled={!manual.title.trim()}
                onClick={() => {
                    add({ title: manual.title.trim(), author: manual.author.trim() || undefined, pages: Number(manual.pages) || 0 }, 'reading');
                    setManual({ title: '', author: '', pages: '' });
                }}
            >
                읽기 시작
            </Btn>
        </Sheet>
    );
}

function BookSheet({ b, onClose }: { b: Book; onClose: () => void }) {
    const data = useData();
    const day = today();
    const [page, setPage] = useState(String(b.current || ''));
    const [kind, setKind] = useState<BookNote['kind']>('memo');
    const [text, setText] = useState('');
    const [notePage, setNotePage] = useState('');
    const [question] = useState(() => BOOK_QUESTIONS[Math.floor(Math.random() * BOOK_QUESTIONS.length)]);
    const { ask, node } = useAsk();
    const edit = (fn: (x: Book) => void) =>
        update((d) => {
            const x = d.books.find((y) => y.id === b.id)!;
            fn(x);
            x.lastTouched = day;
            if (x.status === 'done') finishBookGoals(d, x.id, day);
        });
    const goal = goalOf(data, b.id);
    const setGoal = (period: GoalPeriod) =>
        update((d) => {
            d.goals.push({ id: uid(), title: `📚 『${b.title}』 읽기`, period, key: keyOf(period, day), done: false, bookId: b.id, history: [{ date: day, text: '읽고 싶은 책에서 만듦' }], createdAt: new Date().toISOString() });
        });
    const clearGoal = () => update((d) => void (d.goals = d.goals.filter((g) => g.id !== goal?.id)));

    const savePage = () => {
        const p = Math.max(0, Math.min(Number(page) || 0, b.pages || Infinity));
        edit((x) => {
            x.current = p;
            x.progress.push({ date: day, page: p });
            if (x.status !== 'reading' && x.status !== 'done') x.status = 'reading';
            if (x.pages && p >= x.pages) {
                x.status = 'done';
                x.finishedAt = day;
            }
        });
    };
    const setStatus = async (s: BookStatus) => {
        if (s === 'reading' && b.status !== 'reading' && readingCount(data.books) >= data.settings.wipLimit && !confirm(`이미 ${readingCount(data.books)}권을 읽는 중이에요. 그래도 시작할까요?`)) return;
        if (s === 'dropped') {
            const r = await ask('왜 그만두나요?', '예: 기대와 달랐음');
            if (r === null) return;
            edit((x) => {
                x.status = 'dropped';
                x.dropReason = r || '사유 없음';
            });
            return;
        }
        edit((x) => {
            x.status = s;
            if (s === 'reading') x.startedAt ??= day;
            if (s === 'done') {
                x.finishedAt = day;
                if (x.pages) x.current = x.pages;
            }
            x.dropReason = undefined;
        });
    };
    const addNote = () => {
        if (!text.trim()) return;
        edit((x) => x.notes.unshift({ id: uid(), kind, text: text.trim(), page: Number(notePage) || undefined, date: day }));
        setText('');
        setNotePage('');
    };

    return (
        <Sheet open onClose={onClose} title={b.title}>
            <div className="flex gap-3">
                <Cover b={b} />
                <div className="text-[13px] text-[#6b7684] space-y-0.5">
                    <div>{b.author}</div>
                    {b.startedAt && <div>시작 {shortDay(b.startedAt)}</div>}
                    {b.finishedAt && <div>완독 {shortDay(b.finishedAt)}</div>}
                    <div className="flex gap-0.5 text-[20px]">
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" aria-label={`별 ${n}개`} onClick={() => edit((x) => void (x.rating = n))} className={n <= (b.rating ?? 0) ? 'text-[#ffb400]' : 'text-[#d1d6db]'}>
                                ★
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <label className={label}>어디까지 읽었나요</label>
            <div className="flex gap-2 items-center">
                <input type="number" inputMode="numeric" className={inputCls} value={page} onChange={(e) => setPage(e.target.value)} />
                <span className="text-[14px] text-[#8b95a1] shrink-0">/ {b.pages || '?'}쪽</span>
                <Btn className="shrink-0" onClick={savePage}>
                    저장
                </Btn>
            </div>
            {!b.pages && (
                <input type="number" inputMode="numeric" className={`${inputCls} mt-2`} placeholder="전체 쪽수 입력" onBlur={(e) => Number(e.target.value) > 0 && edit((x) => void (x.pages = Number(e.target.value)))} />
            )}

            <div className="flex gap-1.5 flex-wrap mt-4">
                {STATUS.filter(([s]) => s !== b.status).map(([s, l]) => (
                    <Btn key={s} small kind={s === 'dropped' ? 'danger' : 'ghost'} onClick={() => setStatus(s)}>
                        {l}(으)로
                    </Btn>
                ))}
            </div>

            {b.status !== 'done' && b.status !== 'dropped' && (
                <>
                    <label className={label}>읽기 목표</label>
                    {goal ? (
                        <div className="flex items-center justify-between rounded-xl bg-brand-soft dark:bg-[#1d2c44] px-3 py-2.5">
                            <span className="text-[14px] text-brand font-semibold">🎯 {PERIOD_LABEL[goal.period]} 안에 읽기</span>
                            <button type="button" className="text-[13px] text-[#8b95a1]" onClick={clearGoal}>
                                목표 빼기
                            </button>
                        </div>
                    ) : (
                        <div className="flex gap-1.5">
                            {(['week', 'month', 'year'] as const).map((p) => (
                                <Chip key={p} onClick={() => setGoal(p)}>
                                    {PERIOD_LABEL[p]}
                                </Chip>
                            ))}
                        </div>
                    )}
                </>
            )}

            <label className={label}>독후감</label>
            <textarea
                key={b.id}
                className={`${inputCls} min-h-[140px] leading-6`}
                defaultValue={b.review ?? ''}
                placeholder={b.status === 'done' ? '다 읽고 나서 남은 생각, 기억하고 싶은 것, 누구에게 권하고 싶은지' : '읽으면서 써 두고, 다 읽으면 마무리해요'}
                onBlur={(e) => e.target.value.trim() !== (b.review ?? '') && edit((x) => void (x.review = e.target.value.trim() || undefined))}
            />
            <p className="text-[12px] text-[#8b95a1] mt-1">입력창을 벗어나면 저장돼요</p>

            <label className={label}>메모</label>
            <div className="flex gap-1.5 mb-2">
                {(
                    [
                        ['quote', '밑줄'],
                        ['memo', '생각'],
                        ['question', '질문'],
                    ] as const
                ).map(([k, l]) => (
                    <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
                        {l}
                    </Chip>
                ))}
            </div>
            {kind === 'question' && <p className="text-[13px] text-brand mb-2">💭 {question}</p>}
            <textarea className={`${inputCls} min-h-[80px]`} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === 'quote' ? '마음에 든 문장' : '#태그를 붙이면 기록 탭에서 모아 볼 수 있어요'} />
            <div className="flex gap-2 mt-2">
                <input type="number" inputMode="numeric" className={`${inputCls} !w-24`} placeholder="쪽" value={notePage} onChange={(e) => setNotePage(e.target.value)} />
                <Btn className="flex-1" kind="soft" onClick={addNote} disabled={!text.trim()}>
                    메모 남기기
                </Btn>
            </div>
            <ul className="mt-3 space-y-2">
                {b.notes.map((n) => (
                    <li key={n.id} className="rounded-xl bg-[#f9fafb] dark:bg-[#26292e] p-3 text-[14px]">
                        <div className="text-[12px] text-[#8b95a1] mb-1 flex justify-between">
                            <span>
                                {n.kind === 'quote' ? '밑줄' : n.kind === 'question' ? '질문' : '생각'}
                                {n.page ? ` · ${n.page}쪽` : ''} · {shortDay(n.date)}
                            </span>
                            <button type="button" aria-label="메모 삭제" onClick={() => confirm('메모를 지울까요?') && edit((x) => void (x.notes = x.notes.filter((y) => y.id !== n.id)))}>
                                ×
                            </button>
                        </div>
                        <p className={`whitespace-pre-wrap ${n.kind === 'quote' ? 'italic' : ''}`}>{n.text}</p>
                    </li>
                ))}
                {!b.notes.length && <Empty>아직 메모가 없어요</Empty>}
            </ul>
            <Btn kind="ghost" small className="mt-4" onClick={() => confirm('책을 완전히 지울까요? 메모도 사라집니다.') && (update((d) => void (d.books = d.books.filter((x) => x.id !== b.id))), onClose())}>
                책 삭제
            </Btn>
            {node}
        </Sheet>
    );
}
