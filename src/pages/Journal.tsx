import { useMemo, useState } from 'react';
import { update, useData } from '../lib/store';
import { addCapture, addTask, setDayLine } from '../lib/actions';
import { addDays, fmtMin, lastDays, shortDay, today, weekStart, weekdayName } from '../lib/date';
import { planVsActual, tagIndex } from '../lib/logic';
import { Btn, Card, Chip, Empty, inputCls, PageTitle } from '../components/ui';
import { QuickAdd } from '../components/items';

type Tab = 'inbox' | 'diary' | 'review' | 'tags';
const MOODS = ['😫', '😕', '🙂', '😊', '🤩'];

export default function JournalPage() {
    const [tab, setTab] = useState<Tab>('inbox');
    return (
        <>
            <PageTitle>기록</PageTitle>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                {(
                    [
                        ['inbox', '캡처함'],
                        ['diary', '일기'],
                        ['review', '주간 회고'],
                        ['tags', '#연결'],
                    ] as const
                ).map(([t, l]) => (
                    <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
                        {l}
                    </Chip>
                ))}
            </div>
            {tab === 'inbox' && <Inbox />}
            {tab === 'diary' && <Diary />}
            {tab === 'review' && <Review />}
            {tab === 'tags' && <Tags />}
        </>
    );
}

function Inbox() {
    const data = useData();
    const [kept, setKept] = useState(false);
    const list = data.captures.filter((c) => (kept ? c.status === 'kept' : c.status === 'inbox'));
    const setStatus = (id: string, status: 'task' | 'kept' | 'archived') => update((d) => void (d.captures.find((c) => c.id === id)!.status = status));
    return (
        <div className="space-y-3">
            <Card>
                <QuickAdd placeholder="떠오른 생각 (#태그)" button="담기" onAdd={addCapture} />
                <p className="text-[12px] text-[#8b95a1] mt-2">일단 담고, 나중에 할 일로 바꾸거나 아이디어로 보관하세요.</p>
            </Card>
            <div className="flex gap-2">
                <Chip active={!kept} onClick={() => setKept(false)}>
                    정리 전 {data.captures.filter((c) => c.status === 'inbox').length}
                </Chip>
                <Chip active={kept} onClick={() => setKept(true)}>
                    아이디어 보관 {data.captures.filter((c) => c.status === 'kept').length}
                </Chip>
            </div>
            <Card>
                {list.length ? (
                    <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                        {list.map((c) => (
                            <li key={c.id} className="py-3">
                                <p className="text-[15px] whitespace-pre-wrap">{c.text}</p>
                                <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[12px] text-[#8b95a1] flex-1">{shortDay(c.date)}</span>
                                    <Btn
                                        small
                                        kind="soft"
                                        onClick={() => {
                                            addTask({ title: c.text, date: null });
                                            setStatus(c.id, 'task');
                                        }}
                                    >
                                        할 일로
                                    </Btn>
                                    {!kept && (
                                        <Btn small kind="ghost" onClick={() => setStatus(c.id, 'kept')}>
                                            보관
                                        </Btn>
                                    )}
                                    <Btn small kind="ghost" onClick={() => setStatus(c.id, 'archived')}>
                                        버리기
                                    </Btn>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Empty>{kept ? '보관한 아이디어가 없어요' : '깨끗해요 ✨'}</Empty>
                )}
            </Card>
        </div>
    );
}

function Diary() {
    const data = useData();
    const [day, setDay] = useState(today());
    const cur = data.days[day] ?? {};
    const [text, setText] = useState(cur.line ?? '');
    const pickDay = (d: string) => {
        setDay(d);
        setText(data.days[d]?.line ?? '');
    };
    const past = Object.entries(data.days)
        .filter(([, l]) => l.line || l.mood)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 60);
    return (
        <div className="space-y-3">
            <Card>
                <div className="flex items-center gap-2 mb-2">
                    <input type="date" className={`${inputCls} !w-auto !py-1.5`} value={day} max={today()} onChange={(e) => e.target.value && pickDay(e.target.value)} />
                    <div className="flex gap-1">
                        {MOODS.map((e, i) => (
                            <button key={e} type="button" aria-label={`기분 ${i + 1}`} onClick={() => setDayLine(day, text, i + 1)} className={`text-[20px] rounded-lg px-1 ${cur.mood === i + 1 ? 'bg-brand-soft dark:bg-[#1d2c44]' : 'opacity-40'}`}>
                                {e}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea className={`${inputCls} min-h-[100px]`} value={text} placeholder="이날 있었던 일, 배운 것 (#태그)" onChange={(e) => setText(e.target.value)} />
                <Btn className="w-full mt-2" kind="soft" onClick={() => setDayLine(day, text)}>
                    저장
                </Btn>
            </Card>
            <Card title="지난 기록">
                {past.length ? (
                    <ul className="space-y-3">
                        {past.map(([d, l]) => (
                            <li key={d}>
                                <button type="button" className="text-left w-full" onClick={() => pickDay(d)}>
                                    <div className="text-[12px] text-[#8b95a1]">
                                        {shortDay(d)} {weekdayName(d)} {l.mood ? MOODS[l.mood - 1] : ''}
                                    </div>
                                    <p className="text-[14px] whitespace-pre-wrap">{l.line}</p>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Empty>아직 기록이 없어요</Empty>
                )}
            </Card>
        </div>
    );
}

const PLAN_Q = ['계획을 얼마나 지켰나? 못 지킨 이유는?', '다음 주에 꼭 지킬 한 가지', '루틴에서 빼거나 바꿀 것'];
const EXPLORE_Q = ['이번 주 새로 알게 된 것', '서로 연결된 아이디어', '다음 주에 실험해 볼 것'];

function Review() {
    const data = useData();
    const [wk, setWk] = useState(() => weekStart(today()));
    const days = lastDays(7, addDays(wk, 6)).filter((d) => d <= today());
    const qs = data.settings.mode === 'plan' ? PLAN_Q : EXPLORE_Q;
    const answers = data.reviews[wk] ?? {};
    const studyMin = data.sessions.filter((s) => days.includes(s.date)).reduce((a, s) => a + s.minutes, 0);
    const done = data.tasks.filter((t) => t.done && t.doneAt && days.includes(t.doneAt)).length;
    const rates = days.map((d) => planVsActual(data, d).rate).filter((r): r is number => r !== null);
    const avg = rates.length ? Math.round((rates.reduce((a, b) => a + b, 0) / rates.length) * 100) : null;
    const save = (q: string, v: string) => update((d) => void ((d.reviews[wk] ??= {})[q] = v));
    // 다른 모드에서 쓴 답도 보이게
    const allQs = [...qs, ...Object.keys(answers).filter((q) => !qs.includes(q))];
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
                <button type="button" aria-label="지난주" className="px-3 text-xl" onClick={() => setWk(addDays(wk, -7))}>
                    ‹
                </button>
                <span className="font-semibold">
                    {shortDay(wk)} ~ {shortDay(addDays(wk, 6))}
                </span>
                <button type="button" aria-label="다음 주" className="px-3 text-xl" disabled={addDays(wk, 7) > today()} onClick={() => setWk(addDays(wk, 7))}>
                    ›
                </button>
            </div>
            <Card>
                <div className="grid grid-cols-3 text-center">
                    <div>
                        <div className="text-[12px] text-[#8b95a1]">공부</div>
                        <div className="font-bold">{fmtMin(studyMin)}</div>
                    </div>
                    <div>
                        <div className="text-[12px] text-[#8b95a1]">끝낸 할 일</div>
                        <div className="font-bold">{done}개</div>
                    </div>
                    <div>
                        <div className="text-[12px] text-[#8b95a1]">계획 지킴</div>
                        <div className="font-bold">{avg === null ? '-' : `${avg}%`}</div>
                    </div>
                </div>
            </Card>
            {allQs.map((q) => (
                <Card key={`${wk}-${q}`} title={q}>
                    <textarea className={`${inputCls} min-h-[70px]`} defaultValue={answers[q] ?? ''} onBlur={(e) => e.target.value !== (answers[q] ?? '') && save(q, e.target.value)} />
                </Card>
            ))}
        </div>
    );
}

function Tags() {
    const data = useData();
    const index = useMemo(() => tagIndex(data), [data]);
    const tags = Object.entries(index).sort((a, b) => b[1].length - a[1].length);
    const [sel, setSel] = useState<string | null>(null);
    const items = sel ? [...(index[sel] ?? [])].sort((a, b) => b.date.localeCompare(a.date)) : [];
    return (
        <div className="space-y-3">
            <Card title="태그" extra={<span className="text-[12px] text-[#8b95a1]">캡처·책 메모·일기·할 일의 #태그</span>}>
                {tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                        {tags.map(([t, list]) => (
                            <Chip key={t} active={sel === t} onClick={() => setSel(sel === t ? null : t)}>
                                #{t} {list.length}
                            </Chip>
                        ))}
                    </div>
                ) : (
                    <Empty>기록에 #태그를 붙이면 여기서 서로 연결돼요</Empty>
                )}
            </Card>
            {sel && (
                <Card title={`#${sel}`}>
                    <ul className="space-y-3">
                        {items.map((it, i) => (
                            <li key={i}>
                                <div className="text-[12px] text-[#8b95a1]">
                                    {it.source}
                                    {it.sub && ` · ${it.sub}`} · {shortDay(it.date)}
                                </div>
                                <p className="text-[14px] whitespace-pre-wrap">{it.text}</p>
                            </li>
                        ))}
                    </ul>
                    {/* 같이 붙은 다른 태그 = 연결된 생각 */}
                    <Related index={index} tag={sel} onPick={setSel} />
                </Card>
            )}
        </div>
    );
}

function Related({ index, tag, onPick }: { index: ReturnType<typeof tagIndex>; tag: string; onPick: (t: string) => void }) {
    const texts = new Set(index[tag].map((i) => i.text));
    const rel = Object.entries(index)
        .filter(([t, list]) => t !== tag && list.some((i) => texts.has(i.text)))
        .map(([t]) => t);
    if (!rel.length) return null;
    return (
        <div className="mt-4">
            <div className="text-[12px] text-[#8b95a1] mb-1.5">함께 나온 태그</div>
            <div className="flex flex-wrap gap-1.5">
                {rel.map((t) => (
                    <Chip key={t} onClick={() => onPick(t)}>
                        #{t}
                    </Chip>
                ))}
            </div>
        </div>
    );
}
