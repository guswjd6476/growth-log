import { useEffect, useRef, useState } from 'react';
import { update, useData } from '../lib/store';
import { lastDays, today, weekdayName } from '../lib/date';
import { Bar, Btn, Card, Chip, Empty, inputCls, PageTitle } from '../components/ui';
import {
    ALL_WORDS,
    choices,
    dayName,
    dueWords,
    finishTest,
    grade,
    knownCount,
    PASS,
    passedDays,
    PER_DAY,
    sameSpelling,
    shuffle,
    todayDays,
    WORD_DAYS,
    wordStreak,
    wrongWords,
    type Word,
} from '../lib/vocab';
import type { WordState } from '../lib/types';

type TestMode = 'choice' | 'spell';
type View =
    | { k: 'home' }
    | { k: 'day'; n: number }
    | { k: 'wrong' }
    | { k: 'cards'; title: string; words: Word[]; days: number[] }
    | { k: 'test'; title: string; words: Word[]; days: number[]; mode: TestMode };

const speak = (w: string) => {
    if (typeof speechSynthesis === 'undefined') return;
    speechSynthesis.cancel();
    speechSynthesis.speak(Object.assign(new SpeechSynthesisUtterance(w), { lang: 'en-US' }));
};
const wordsOf = (days: number[]) => days.flatMap((i) => WORD_DAYS[i]);
const titleOf = (days: number[]) => days.map(dayName).join(' · ');
const REVIEW_MAX = 50; // 복습 한 번에 최대 문제 수

export default function WordsPage() {
    const [view, setView] = useState<View>({ k: 'home' });
    const [round, setRound] = useState(0); // 같은 단어로 다시 볼 때도 테스트를 새로 시작
    const home = () => setView({ k: 'home' });
    useEffect(() => window.scrollTo(0, 0), [view]);

    switch (view.k) {
        case 'home':
            return <Home go={setView} />;
        case 'day':
            return <DayView n={view.n} go={setView} back={home} />;
        case 'wrong':
            return <WrongView go={setView} back={home} />;
        case 'cards':
            return <Cards key={view.title} {...view} back={home} toTest={(mode) => setView({ ...view, k: 'test', mode })} />;
        case 'test':
            return <Test key={round} {...view} back={home} again={(words, days) => (setRound(round + 1), setView({ ...view, words, days }))} />;
    }
}

function StudyButtons({ title, words, days, go }: { title: string; words: Word[]; days: number[]; go: (v: View) => void }) {
    return (
        <div className="grid grid-cols-3 gap-2 mt-4">
            <Btn kind="soft" small onClick={() => go({ k: 'cards', title, words, days })}>
                암기 카드
            </Btn>
            <Btn small onClick={() => go({ k: 'test', title, words, days, mode: 'choice' })}>
                객관식 테스트
            </Btn>
            <Btn small onClick={() => go({ k: 'test', title, words, days, mode: 'spell' })}>
                스펠링 테스트
            </Btn>
        </div>
    );
}

function Home({ go }: { go: (v: View) => void }) {
    const data = useData();
    const day = today();
    const passed = passedDays(data);
    const mine = todayDays(data, day);
    const doneToday = mine.length > 0 && mine.every((i) => passed.has(i));
    const ahead = WORD_DAYS.map((_, i) => i).filter((i) => !passed.has(i)).slice(0, PER_DAY);
    const due = dueWords(data, day);
    const known = knownCount(data);
    const wrong = wrongWords(data).length;
    const left = WORD_DAYS.length - passed.size;
    const [hide, setHide] = useState(false);

    return (
        <>
            <PageTitle sub={`워드마스터 수능 2000 · 하루 ${PER_DAY} DAY`}>영단어</PageTitle>
            <div className="space-y-3">
                <Card title="오늘의 학습" extra={<span className="text-sm text-[#8b95a1]">{passed.size}/{WORD_DAYS.length} DAY 통과</span>}>
                    {mine.length === 0 ? (
                        <Empty>2000단어를 모두 통과했어요! 복습만 이어가요 🎓</Empty>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                {mine.map((i) => (
                                    <div key={i} className={`flex-1 rounded-2xl p-3 ${passed.has(i) ? 'bg-brand text-white' : 'bg-brand-soft dark:bg-[#1d2c44]'}`}>
                                        <div className="text-[17px] font-bold">{dayName(i)}</div>
                                        <div className="text-[12px] opacity-80">{passed.has(i) ? '통과 ✓' : `${WORD_DAYS[i].length}단어`}</div>
                                    </div>
                                ))}
                            </div>
                            <Bar value={passed.size / WORD_DAYS.length} className="mt-3" />
                            <div className="text-[12px] text-[#8b95a1] mt-1">
                                {left > 0 ? `하루 ${PER_DAY} DAY면 ${Math.ceil(left / PER_DAY)}일 뒤 완주` : '완주!'} · 테스트 {PASS * 100}% 이상이면 통과
                            </div>
                            {doneToday ? (
                                <div className="mt-4 text-center">
                                    <div className="font-bold">오늘 목표 완료 🎉</div>
                                    {ahead.length > 0 && (
                                        <Btn kind="ghost" small className="mt-2" onClick={() => go({ k: 'cards', title: titleOf(ahead), words: wordsOf(ahead), days: ahead })}>
                                            다음 {titleOf(ahead)} 미리 하기
                                        </Btn>
                                    )}
                                </div>
                            ) : (
                                <StudyButtons title={titleOf(mine)} words={wordsOf(mine.filter((i) => !passed.has(i)))} days={mine.filter((i) => !passed.has(i))} go={go} />
                            )}
                        </>
                    )}
                </Card>

                {mine.length > 0 && (
                    <Card
                        title={`오늘의 단어 ${wordsOf(mine).length}개`}
                        extra={
                            <Chip active={hide} onClick={() => setHide(!hide)}>
                                뜻 가리기
                            </Chip>
                        }
                    >
                        <WordList words={wordsOf(mine)} hide={hide} />
                    </Card>
                )}

                <Card title="오늘 복습" extra={<span className="text-sm text-[#8b95a1]">1·3·7·14·30일 간격</span>}>
                    {due.length ? (
                        <>
                            <div className="text-[15px]">
                                잊어버릴 때가 된 단어 <b className="text-brand">{due.length}개</b>
                            </div>
                            <Btn className="w-full mt-3" onClick={() => go({ k: 'test', title: '오늘 복습', words: shuffle(due).slice(0, REVIEW_MAX), days: [], mode: 'choice' })}>
                                복습 테스트{due.length > REVIEW_MAX ? ` (${REVIEW_MAX}개씩)` : ''}
                            </Btn>
                        </>
                    ) : (
                        <Empty>오늘 복습할 단어가 없어요</Empty>
                    )}
                </Card>

                <Card title="내 기록">
                    <div className="grid grid-cols-3 text-center">
                        <div>
                            <div className="text-[22px] font-bold">🔥{wordStreak(data.wordLog, day)}</div>
                            <div className="text-[12px] text-[#8b95a1]">일 연속</div>
                        </div>
                        <div>
                            <div className="text-[22px] font-bold">{known}</div>
                            <div className="text-[12px] text-[#8b95a1]">외운 단어 / {ALL_WORDS.length}</div>
                        </div>
                        <button type="button" onClick={() => go({ k: 'wrong' })}>
                            <div className="text-[22px] font-bold text-[#e42939]">{wrong}</div>
                            <div className="text-[12px] text-[#8b95a1] underline">오답노트 ›</div>
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 mt-4 text-center">
                        {lastDays(7, day).map((d) => (
                            <div key={d}>
                                <div className={`mx-auto size-8 rounded-full grid place-items-center text-[12px] font-bold ${data.wordLog[d] ? 'bg-brand text-white' : 'bg-[#f2f4f6] dark:bg-[#26292e] text-[#b0b8c1]'}`}>
                                    {data.wordLog[d]?.days.length ? data.wordLog[d].days.length : data.wordLog[d] ? '✓' : ''}
                                </div>
                                <div className="text-[11px] text-[#8b95a1] mt-1">{weekdayName(d)}</div>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="전체 DAY">
                    <div className="grid grid-cols-5 gap-2">
                        {WORD_DAYS.map((ws, i) => {
                            const k = ws.filter(([w]) => (data.words[w]?.lv ?? 0) > 0).length;
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => go({ k: 'day', n: i })}
                                    className={`rounded-2xl py-2 text-center ${passed.has(i) ? 'bg-brand text-white' : 'bg-[#f2f4f6] dark:bg-[#26292e]'}`}
                                >
                                    <div className="text-[16px] font-bold leading-tight">{String(i + 1).padStart(2, '0')}</div>
                                    <div className="text-[10px] opacity-70">{passed.has(i) ? '통과' : `${k}/${ws.length}`}</div>
                                </button>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </>
    );
}

function stateLabel(s?: WordState) {
    if (!s) return ['새 단어', 'text-[#b0b8c1]'];
    if (s.lv === 0) return ['헷갈림', 'text-[#e42939]'];
    if (s.lv >= 4) return ['완벽', 'text-brand'];
    return ['외움', 'text-[#00a86b]'];
}

// hide: 뜻을 가리고, 누르면 그 단어만 보여 준다
function WordList({ words, hide = false }: { words: Word[]; hide?: boolean }) {
    const data = useData();
    const [open, setOpen] = useState<Set<string>>(new Set());
    return (
        <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
            {words.map(([w, m]) => {
                const s = data.words[w];
                const [l, cls] = stateLabel(s);
                return (
                    <li key={w}>
                        <button type="button" className="w-full flex items-center gap-3 py-2.5 text-left" onClick={() => (speak(w), setOpen(new Set(open).add(w)))}>
                            <span className="min-w-0 flex-1">
                                <span className="block font-semibold text-[15px]">{w}</span>
                                <span className="block text-[13px] text-[#8b95a1]">{hide && !open.has(w) ? '눌러서 뜻 보기' : m}</span>
                            </span>
                            <span className={`text-[12px] font-bold shrink-0 ${cls}`}>
                                {l}
                                {s?.wrong ? ` · ${s.wrong}번 틀림` : ''}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
}

const BackBtn = ({ back }: { back: () => void }) => (
    <Btn kind="ghost" small onClick={back}>
        ‹ 영단어
    </Btn>
);

function DayView({ n, go, back }: { n: number; go: (v: View) => void; back: () => void }) {
    const passed = passedDays(useData()).has(n);
    const words = WORD_DAYS[n];
    return (
        <>
            <PageTitle sub={passed ? '통과한 DAY · 단어를 누르면 발음' : '단어를 누르면 발음'} extra={<BackBtn back={back} />}>
                {dayName(n)}
            </PageTitle>
            <Card>
                <StudyButtons title={dayName(n)} words={words} days={[n]} go={go} />
            </Card>
            <Card className="mt-3 !py-1">
                <WordList words={words} />
            </Card>
        </>
    );
}

function WrongView({ go, back }: { go: (v: View) => void; back: () => void }) {
    const words = wrongWords(useData());
    return (
        <>
            <PageTitle sub="지금 틀린 단어와 3번 이상 틀린 단어" extra={<BackBtn back={back} />}>
                오답노트
            </PageTitle>
            {words.length ? (
                <>
                    <Card>
                        <StudyButtons title="오답노트" words={words} days={[]} go={go} />
                    </Card>
                    <Card className="mt-3 !py-1">
                        <WordList words={words} />
                    </Card>
                </>
            ) : (
                <Card>
                    <Empty>틀린 단어가 없어요</Empty>
                </Card>
            )}
        </>
    );
}

// 암기 카드: 눌러서 뜻 확인, 모르면 뒤로 보내 다시. 기록은 남기지 않고 테스트로 확인한다
function Cards({ title, words, back, toTest }: { title: string; words: Word[]; back: () => void; toTest: (m: TestMode) => void }) {
    const [queue, setQueue] = useState(() => shuffle(words));
    const [shown, setShown] = useState(false);
    const [reverse, setReverse] = useState(false);
    const cur = queue[0];
    const next = (known: boolean) => (setQueue(known ? queue.slice(1) : [...queue.slice(1), cur]), setShown(false));

    return (
        <>
            <PageTitle sub={`암기 카드 · ${words.length}단어`} extra={<BackBtn back={back} />}>
                {title}
            </PageTitle>
            <div className="flex gap-2 pb-3 items-center">
                <Chip active={reverse} onClick={() => (setReverse(!reverse), setShown(false))}>
                    뜻 → 영어
                </Chip>
                {cur && <span className="ml-auto text-[13px] text-[#8b95a1]">{queue.length}개 남음</span>}
            </div>
            <Bar value={1 - queue.length / words.length} className="mb-3" />
            {cur ? (
                <>
                    <button type="button" onClick={() => setShown(true)} className="w-full min-h-64 rounded-[28px] bg-white dark:bg-[#1b1d21] p-6 flex flex-col items-center justify-center text-center gap-3">
                        <div className={reverse ? 'text-[20px] font-bold' : 'text-[32px] font-bold'}>{reverse ? cur[1] : cur[0]}</div>
                        {shown ? (
                            <div className={reverse ? 'text-[30px] font-bold text-brand' : 'text-[18px] text-brand font-semibold'}>{reverse ? cur[0] : cur[1]}</div>
                        ) : (
                            <div className="text-[13px] text-[#b0b8c1]">눌러서 {reverse ? '영어' : '뜻'} 보기</div>
                        )}
                    </button>
                    <div className="flex justify-center mt-2">
                        <Btn kind="ghost" small onClick={() => speak(cur[0])}>
                            🔊 발음
                        </Btn>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                        <Btn kind="soft" onClick={() => next(false)}>
                            몰라요 (다시)
                        </Btn>
                        <Btn onClick={() => next(true)}>알아요</Btn>
                    </div>
                </>
            ) : (
                <Card className="text-center py-8">
                    <div className="text-[40px]">💪</div>
                    <div className="text-[17px] font-bold mt-2">다 외웠어요! 이제 테스트로 확인해요</div>
                    <div className="grid grid-cols-2 gap-2 mt-5">
                        <Btn onClick={() => toTest('choice')}>객관식 테스트</Btn>
                        <Btn onClick={() => toTest('spell')}>스펠링 테스트</Btn>
                    </div>
                </Card>
            )}
        </>
    );
}

// 테스트: 처음 답만 채점해서 간격 복습에 반영. 단어 테스트(days 있음)는 PASS 이상이면 그 DAY 통과
function Test({
    title,
    words,
    days,
    mode,
    back,
    again,
}: {
    title: string;
    words: Word[];
    days: number[];
    mode: TestMode;
    back: () => void;
    again: (words: Word[], days: number[]) => void;
}) {
    const [qs] = useState(() => shuffle(words).map((w) => ({ w, opts: mode === 'choice' ? choices(w, 1) : [] })));
    const [i, setI] = useState(0);
    const [answer, setAnswer] = useState<{ ok: boolean; picked: string } | null>(null);
    const [typed, setTyped] = useState('');
    const [wrong, setWrong] = useState<Word[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const day = today();
    const q = qs[i];
    const finished = i >= qs.length;
    const score = (qs.length - wrong.length) / qs.length;
    const pass = score >= PASS;

    useEffect(() => {
        if (finished) update((d) => finishTest(d, day, qs.length, pass ? days : []));
        else if (mode === 'spell') inputRef.current?.focus();
    }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

    const next = () => (setI(i + 1), setAnswer(null), setTyped(''));
    const submit = (picked: string) => {
        if (answer) return;
        const ok = mode === 'choice' ? picked === q.w[1] : sameSpelling(picked, q.w[0]);
        update((d) => grade(d, q.w[0], ok, day));
        setAnswer({ ok, picked });
        if (!ok) setWrong([...wrong, q.w]);
        if (mode === 'spell') speak(q.w[0]);
        if (ok) setTimeout(next, 600);
    };

    if (finished)
        return (
            <>
                <PageTitle sub={mode === 'choice' ? '객관식 결과' : '스펠링 결과'} extra={<BackBtn back={back} />}>
                    {title}
                </PageTitle>
                <Card className="text-center py-6">
                    <div className="text-[40px]">{pass ? '🎉' : '😤'}</div>
                    <div className={`text-[40px] font-bold ${pass ? 'text-brand' : 'text-[#e42939]'}`}>{Math.round(score * 100)}점</div>
                    <div className="text-[14px] text-[#8b95a1]">
                        {qs.length}문제 중 {qs.length - wrong.length}개 맞힘
                    </div>
                    {days.length > 0 && (
                        <div className="mt-2 font-bold">{pass ? `${titleOf(days)} 통과!` : `${PASS * 100}점 이상이면 통과예요. 다시 도전!`}</div>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-5">
                        {wrong.length > 0 ? (
                            <Btn kind="soft" onClick={() => again(wrong, [])}>
                                틀린 것만 다시
                            </Btn>
                        ) : (
                            <Btn kind="soft" onClick={back}>
                                영단어 홈
                            </Btn>
                        )}
                        {days.length > 0 && !pass ? <Btn onClick={() => again(wordsOf(days), days)}>다시 테스트</Btn> : <Btn onClick={back}>완료</Btn>}
                    </div>
                </Card>
                {wrong.length > 0 && (
                    <Card title="틀린 단어" className="mt-3">
                        <WordList words={wrong} />
                    </Card>
                )}
            </>
        );

    return (
        <>
            <PageTitle sub={mode === 'choice' ? '뜻 고르기' : '뜻 보고 영어 쓰기'} extra={<BackBtn back={back} />}>
                {title}
            </PageTitle>
            <div className="flex justify-between text-[13px] text-[#8b95a1] mb-1.5">
                <span>
                    {i + 1} / {qs.length}
                </span>
                <span className="text-[#e42939]">틀림 {wrong.length}</span>
            </div>
            <Bar value={i / qs.length} className="mb-3" />
            <div className="rounded-[28px] bg-white dark:bg-[#1b1d21] p-6 min-h-40 flex flex-col items-center justify-center text-center gap-2">
                {mode === 'choice' ? (
                    <>
                        <div className="text-[32px] font-bold">{q.w[0]}</div>
                        <button type="button" className="text-[13px] text-[#8b95a1]" onClick={() => speak(q.w[0])}>
                            🔊 발음
                        </button>
                    </>
                ) : (
                    <>
                        <div className="text-[20px] font-bold">{q.w[1]}</div>
                        {answer && <div className={`text-[28px] font-bold ${answer.ok ? 'text-brand' : 'text-[#e42939]'}`}>{q.w[0]}</div>}
                    </>
                )}
            </div>

            {mode === 'choice' ? (
                <div className="grid gap-2 mt-3">
                    {q.opts.map((o) => {
                        const cls = !answer ? 'bg-white dark:bg-[#1b1d21]' : o === q.w[1] ? 'bg-brand text-white' : o === answer.picked ? 'bg-[#ffeeee] text-[#e42939] dark:bg-[#3a1d20]' : 'bg-white dark:bg-[#1b1d21] opacity-50';
                        return (
                            <button key={o} type="button" onClick={() => submit(o)} className={`rounded-2xl p-4 text-left text-[15px] font-semibold ${cls}`}>
                                {o}
                            </button>
                        );
                    })}
                    {!answer && (
                        <button type="button" onClick={() => submit('')} className="text-[13px] text-[#8b95a1] py-2">
                            모르겠어요
                        </button>
                    )}
                </div>
            ) : (
                <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (answer) next();
                        else submit(typed);
                    }}
                >
                    <input
                        ref={inputRef}
                        className={inputCls}
                        value={typed}
                        onChange={(e) => setTyped(e.target.value)}
                        readOnly={!!answer}
                        autoCapitalize="off"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="영어 단어 입력"
                    />
                    {!answer && <Btn type="submit">확인</Btn>}
                </form>
            )}
            {answer && !answer.ok && (
                <Btn className="w-full mt-3" onClick={next}>
                    다음
                </Btn>
            )}
        </>
    );
}
