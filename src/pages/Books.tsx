import { useState } from 'react';
import { uid, update, useData } from '../lib/store';
import { shortDay, today } from '../lib/date';
import { BOOK_QUESTIONS, readingCount } from '../lib/logic';
import { Bar, Btn, Card, Chip, Empty, inputCls, label, PageTitle, Sheet, useAsk } from '../components/ui';
import type { Book, BookNote, BookStatus } from '../lib/types';

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
            <AddBookSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => setOpenId(id)} />
            {open && <BookSheet b={open} onClose={() => setOpenId(null)} />}
        </>
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

// 카카오(우리 서버 함수) → Google 도서 순으로 찾는다. 둘 다 안 되면 직접 입력
async function searchBooks(q: string): Promise<Found[]> {
    try {
        const r = await fetch(`/api/books?q=${encodeURIComponent(q)}`);
        if (r.ok) return await r.json();
    } catch {
        // 로컬 개발이나 서버 함수가 없을 때 → Google 로
    }
    const query = /^[\d-]{10,17}$/.test(q.trim()) ? `isbn:${q.replace(/-/g, '')}` : q;
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=12`);
    if (!res.ok) throw new Error('검색 실패');
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

function AddBookSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
    const [q, setQ] = useState('');
    const [found, setFound] = useState<Found[]>([]);
    const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
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
            setFound(await searchBooks(q));
            setState('idle');
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
        });

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
