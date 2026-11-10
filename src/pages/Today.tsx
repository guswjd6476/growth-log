import { useState } from 'react';
import { useData, update } from '../lib/store';
import { addDays, fmtMin, shortDay, today, weekStart, weekdayName } from '../lib/date';
import { addCapture, addTask, cancelTask, moveTomorrow, setDayLine } from '../lib/actions';
import { habitWeekCount, levelOf, mateSummary, mateToday, planVsActual, readingCount, staleBooks, staleTasks, weeklyChallenge, xpOf } from '../lib/logic';
import { Badge, Bar, Btn, Card, Empty, inputCls, useAsk } from '../components/ui';
import { HabitRow, QuickAdd, TaskRow } from '../components/items';
import { go } from '../lib/nav';

export default function TodayPage() {
    const data = useData();
    const day = today();
    const mode = data.settings.mode;
    const tasks = data.tasks.filter((t) => t.date && t.date <= day && (t.date === day || (!t.done && !t.canceled)));
    const habits = data.habits.filter((h) => !h.archived && (h.perWeek >= 7 || h.checks[day] || habitWeekCount(h, day) < h.perWeek));
    const lv = levelOf(xpOf(data));
    const streak = mateToday(mateSummary(data, day), day).streak;

    return (
        <>
            <div className="flex items-start justify-between gap-2 px-1 pt-7">
                <div>
                    <h1 className="text-[28px] font-extrabold tracking-tight">
                        {mode === 'plan' ? '오늘의 계획' : '오늘 뭐 해볼까?'} <Badge>{shortDay(day)} {weekdayName(day)}</Badge>
                    </h1>
                    <p className="text-[15px] text-[#6b7684] dark:text-[#9aa1aa] mt-1">
                        {streak ? `${streak}일째 이어서 성장 중이에요.` : '공부하거나 할 일을 끝내면 출석이 찍혀요.'}
                    </p>
                </div>
                <ModeSwitch />
            </div>
            <WeekStamps />

            <div className="space-y-3">
                {mode === 'explore' && (
                    <Card>
                        <QuickAdd placeholder="떠오른 생각을 바로 적기 (#태그)" button="담기" onAdd={addCapture} />
                        <p className="text-[12px] text-[#8b95a1] mt-2">
                            정리는 나중에 ·{' '}
                            <button type="button" className="underline" onClick={() => go('journal')}>
                                캡처함 {data.captures.filter((c) => c.status === 'inbox').length}개
                            </button>
                        </p>
                    </Card>
                )}

                <CloseCheck />

                {mode === 'plan' ? <PlanCard /> : <ExploreCards />}

                <Card title="할 일" extra={<span className="text-sm text-[#8b95a1]">{tasks.filter((t) => t.done).length}/{tasks.filter((t) => !t.canceled).length}</span>}>
                    <QuickAdd placeholder="오늘 할 일 추가" onAdd={(title) => addTask({ title })} />
                    {tasks.length ? (
                        <ul className="mt-1 divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                            {tasks.filter((t) => !t.canceled).map((t) => (
                                <TaskRow key={t.id} t={t} />
                            ))}
                        </ul>
                    ) : (
                        <Empty>오늘 할 일이 없어요</Empty>
                    )}
                </Card>

                <Card title="습관" extra={<button type="button" className="text-sm text-brand font-semibold" onClick={() => go('habits')}>관리</button>}>
                    {habits.length ? (
                        <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                            {habits.map((h) => (
                                <HabitRow key={h.id} h={h} />
                            ))}
                        </ul>
                    ) : (
                        <Empty>
                            <button type="button" className="text-brand font-semibold" onClick={() => go('habits')}>
                                습관 만들기
                            </button>
                        </Empty>
                    )}
                </Card>

                <DayLine />

                {mode === 'plan' && (
                    <Card>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold">Lv.{lv.level}</span>
                            <span className="text-[#8b95a1]">다음 레벨까지 {lv.toNext}</span>
                        </div>
                        <Bar value={lv.progress} className="mt-2" />
                    </Card>
                )}
                {readingCount(data.books) > data.settings.wipLimit && (
                    <p className="text-[13px] text-[#e42939] px-1">
                        읽는 중인 책이 {readingCount(data.books)}권이에요. 정한 한도({data.settings.wipLimit}권)를 넘었어요.
                    </p>
                )}
            </div>
        </>
    );
}

// 출석체크처럼 이번 주 7일: 공부했거나 할 일을 끝낸 날은 도장
function WeekStamps() {
    const data = useData();
    const day = today();
    const start = weekStart(day);
    const did = (d: string) => data.sessions.some((s) => s.date === d && s.minutes > 0) || data.tasks.some((t) => t.done && t.doneAt === d);
    return (
        <ol className="grid grid-cols-7 gap-1 px-1 pt-6 pb-6">
            {Array.from({ length: 7 }, (_, i) => addDays(start, i)).map((d) => {
                const on = did(d);
                const isToday = d === day;
                return (
                    <li key={d} className="flex flex-col items-center gap-1.5 relative" aria-label={`${shortDay(d)} ${on ? '출석' : '기록 없음'}`}>
                        {isToday && <span className="absolute -top-3.5 text-brand text-[10px]">▼</span>}
                        <span
                            className={`w-11 h-11 rounded-full grid place-items-center text-[22px] border-[3px] ${
                                on ? 'bg-[#fde7a3] border-brand' : isToday ? 'bg-white dark:bg-[#1b1d21] border-brand' : 'bg-white dark:bg-[#1b1d21] border-white dark:border-[#1b1d21]'
                            }`}
                        >
                            <span className={on ? '' : 'grayscale opacity-30'}>🐣</span>
                        </span>
                        <span className={`text-[12px] font-bold ${isToday ? 'text-brand' : on ? 'text-brand/50' : 'text-[#8b95a1]'}`}>
                            {on && !isToday ? '완료' : isToday ? '오늘' : weekdayName(d)}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

function ModeSwitch() {
    const mode = useData().settings.mode;
    return (
        <div className="flex shrink-0 rounded-full bg-white/80 dark:bg-[#1b1d21] p-1 text-[12px] font-bold">
            {(
                [
                    ['plan', '계획형'],
                    ['explore', '탐험형'],
                ] as const
            ).map(([m, l]) => (
                <button
                    key={m}
                    type="button"
                    onClick={() => update((d) => void (d.settings.mode = m))}
                    className={`px-3 py-1 rounded-full ${mode === m ? 'bg-brand text-white' : 'text-[#8b95a1]'}`}
                >
                    {l}
                </button>
            ))}
        </div>
    );
}

// 계획형: 계획 대비 실제
function PlanCard() {
    const data = useData();
    const day = today();
    const p = planVsActual(data, day);
    return (
        <Card title="계획 대비 실제" extra={<button type="button" className="text-sm text-brand font-semibold" onClick={() => go('focus')}>공부 계획</button>}>
            {p.rate === null ? (
                <Empty>집중 탭에서 오늘 공부 계획을 세우거나 할 일을 추가하면 지킨 정도가 나와요</Empty>
            ) : (
                <>
                    <div className="flex items-end gap-2">
                        <span className="text-[32px] font-bold tabular-nums leading-none">{Math.round(p.rate * 100)}%</span>
                        <span className="text-sm text-[#8b95a1] mb-1">지킴</span>
                    </div>
                    <div className="text-[13px] text-[#6b7684] mt-2">
                        공부 {fmtMin(p.actualMin)} / 계획 {fmtMin(p.planMin)} · 할 일 {p.done}/{p.tasks}
                    </div>
                    <div className="mt-3 space-y-2">
                        {p.rows.map((r) => (
                            <div key={r.subject}>
                                <div className="flex justify-between text-[13px]">
                                    <span>{r.subject}</span>
                                    <span className="tabular-nums text-[#6b7684]">
                                        {fmtMin(r.actual)} / {r.plan ? fmtMin(r.plan) : '계획 없음'}
                                    </span>
                                </div>
                                <Bar value={r.plan ? r.actual / r.plan : 1} className="mt-1" />
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Card>
    );
}

// 탐험형: 랜덤 뽑기, 방치 알림, 챌린지, 레벨
function ExploreCards() {
    const data = useData();
    const day = today();
    const [pick, setPick] = useState<string | null>(null);
    const open = data.tasks.filter((t) => t.date && t.date <= day && !t.done && !t.canceled);
    const lv = levelOf(xpOf(data));
    const books = staleBooks(data.books, day, data.settings.staleDays);
    const tasks = staleTasks(data.tasks, day);
    const { ask, node } = useAsk();

    return (
        <>
            <Card>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[13px] text-[#8b95a1]">레벨</div>
                        <div className="text-[22px] font-bold">Lv.{lv.level}</div>
                    </div>
                    <Btn kind="soft" disabled={!open.length} onClick={() => setPick(open[Math.floor(Math.random() * open.length)].title)}>
                        🎲 할 일 뽑기
                    </Btn>
                </div>
                <Bar value={lv.progress} className="mt-3" />
                {pick && <div className="mt-3 rounded-xl bg-brand-soft dark:bg-[#1d2c44] p-3 text-[15px] font-semibold">👉 지금은 이거: {pick}</div>}
                <div className="mt-3 text-[13px] text-[#6b7684]">🏁 이번 주 챌린지: {weeklyChallenge(day)}</div>
            </Card>

            {(books.length > 0 || tasks.length > 0) && (
                <Card title="손 놓은 것들">
                    <ul className="space-y-3">
                        {books.map((b) => (
                            <li key={b.id} className="text-[14px]">
                                📖 <b>{b.title}</b> · {shortDay(b.lastTouched)} 이후 그대로
                                <div className="flex gap-2 mt-1.5">
                                    <Btn small kind="soft" onClick={() => go('books')}>
                                        계속 읽기
                                    </Btn>
                                    <Btn small kind="ghost" onClick={() => update((d) => void (d.books.find((x) => x.id === b.id)!.status = 'paused'))}>
                                        보류
                                    </Btn>
                                    <Btn
                                        small
                                        kind="ghost"
                                        onClick={async () => {
                                            const r = await ask('왜 그만두나요?', '예: 지금 관심사가 아님');
                                            if (r !== null)
                                                update((d) => {
                                                    const x = d.books.find((y) => y.id === b.id)!;
                                                    x.status = 'dropped';
                                                    x.dropReason = r || '사유 없음';
                                                    x.lastTouched = day;
                                                });
                                        }}
                                    >
                                        포기
                                    </Btn>
                                </div>
                            </li>
                        ))}
                        {tasks.map((t) => (
                            <li key={t.id} className="text-[14px]">
                                ✅ <b>{t.title}</b> · {(t.moved ?? 0) >= 3 ? `${t.moved}번 미룸` : `${shortDay(t.date!)}부터 밀림`}
                                <div className="flex gap-2 mt-1.5">
                                    <Btn small kind="ghost" onClick={async () => {
                                        const r = await ask('왜 그만두나요?');
                                        if (r !== null) cancelTask(t.id, r);
                                    }}>
                                        정식으로 포기
                                    </Btn>
                                </div>
                            </li>
                        ))}
                    </ul>
                    {node}
                </Card>
            )}
        </>
    );
}

// 마감 점검: 정한 시각이 지나면 못 끝낸 일을 내일로 / 포기
function CloseCheck() {
    const data = useData();
    const day = today();
    const { ask, node } = useAsk();
    if (new Date().getHours() < data.settings.closeHour) return null;
    const left = data.tasks.filter((t) => t.date === day && !t.done && !t.canceled);
    if (!left.length) return null;
    return (
        <Card title={`🌙 하루 마감 · 남은 할 일 ${left.length}개`}>
            <ul className="space-y-2">
                {left.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 text-[14px]">
                        <span className="flex-1 min-w-0 truncate">{t.title}</span>
                        <Btn small kind="soft" onClick={() => moveTomorrow(t.id)}>
                            내일로
                        </Btn>
                        <Btn
                            small
                            kind="ghost"
                            onClick={async () => {
                                const r = await ask('왜 그만두나요?');
                                if (r !== null) cancelTask(t.id, r);
                            }}
                        >
                            포기
                        </Btn>
                    </li>
                ))}
            </ul>
            <Btn kind="ghost" small className="mt-3 w-full" onClick={() => left.forEach((t) => moveTomorrow(t.id))}>
                모두 내일로
            </Btn>
            {node}
        </Card>
    );
}

function DayLine() {
    const data = useData();
    const day = today();
    const cur = data.days[day] ?? {};
    const [text, setText] = useState(cur.line ?? '');
    return (
        <Card title="오늘 한 줄">
            <div className="flex gap-1.5 mb-2">
                {['😫', '😕', '🙂', '😊', '🤩'].map((e, i) => (
                    <button
                        key={e}
                        type="button"
                        aria-label={`기분 ${i + 1}`}
                        onClick={() => setDayLine(day, text, i + 1)}
                        className={`text-[22px] rounded-xl px-1.5 ${cur.mood === i + 1 ? 'bg-brand-soft dark:bg-[#1d2c44]' : 'opacity-50'}`}
                    >
                        {e}
                    </button>
                ))}
            </div>
            <textarea
                className={`${inputCls} min-h-[70px]`}
                value={text}
                placeholder="오늘 배운 것, 느낀 것 (#태그로 연결)"
                onChange={(e) => setText(e.target.value)}
                onBlur={() => text !== (cur.line ?? '') && setDayLine(day, text)}
            />
        </Card>
    );
}
