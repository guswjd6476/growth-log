import { useEffect, useState } from 'react';
import { getData, update, useData } from '../lib/store';
import { addSession } from '../lib/actions';
import { pushOn } from '../lib/push';
import { addDays, fmtMin, today } from '../lib/date';
import { minutesBySubject } from '../lib/logic';
import { Bar, Btn, Card, Chip, Empty, inputCls, PageTitle } from '../components/ui';
import type { TimerState } from '../lib/types';

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
const clock = (sec: number) => `${pad(sec / 60)}:${pad(sec % 60)}`;

function notify(body: string) {
    if (!getData().settings.notify || pushOn() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    navigator.serviceWorker?.getRegistration().then((r) => {
        if (r) r.showNotification('성장일지', { body, icon: '/icon-192.png' });
        else new Notification('성장일지', { body });
    });
}

// 뽀모도로 단계가 끝났으면 기록하고 다음 단계로 (앱을 다시 열었을 때도 맞춰 줌)
function advance(t: TimerState) {
    const elapsed = (Date.now() - t.startedAt) / 1000;
    const limit = (t.phase === 'focus' ? t.focusMin : t.breakMin) * 60;
    if (t.kind !== 'pomodoro' || elapsed < limit) return;
    if (t.phase === 'focus') addSession(t.subject, t.focusMin, 'pomodoro');
    update((d) => {
        d.timer = { ...t, phase: t.phase === 'focus' ? 'break' : 'focus', startedAt: t.startedAt + limit * 1000, round: t.phase === 'break' ? t.round + 1 : t.round };
    });
    notify(t.phase === 'focus' ? `${t.subject} ${t.focusMin}분 집중 끝! 쉬어요` : '쉬는 시간 끝, 다시 집중!');
}

export default function FocusPage() {
    const data = useData();
    const t = data.timer;
    const s = data.settings;
    const [subject, setSubject] = useState(s.subjects[0] ?? '공부');
    const [, setNow] = useState(0);

    useEffect(() => {
        if (!t) return;
        const id = setInterval(() => {
            setNow(Date.now());
            const cur = getData().timer;
            if (cur) advance(cur);
        }, 1000);
        return () => clearInterval(id);
    }, [t]);

    const start = (kind: TimerState['kind'], focusMin = s.focusMin) =>
        update((d) => void (d.timer = { kind, subject, startedAt: Date.now(), phase: 'focus', focusMin, breakMin: s.breakMin, round: 1 }));

    const stop = () => {
        if (!t) return;
        const min = (Date.now() - t.startedAt) / 60000;
        // 뽀모도로 중간에 멈추면 집중한 만큼만 기록
        if (t.phase === 'focus') addSession(t.subject, min, t.kind);
        update((d) => void (d.timer = null));
    };

    const elapsed = t ? (Date.now() - t.startedAt) / 1000 : 0;
    const limit = t ? (t.phase === 'focus' ? t.focusMin : t.breakMin) * 60 : 0;
    const shown = t?.kind === 'pomodoro' ? Math.max(0, limit - elapsed) : elapsed;

    return (
        <>
            <PageTitle sub="공부한 시간은 과목별로 자동 기록돼요">집중</PageTitle>
            <div className="space-y-3">
                <Card>
                    {!t && (
                        <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                            {s.subjects.map((x) => (
                                <Chip key={x} active={subject === x} onClick={() => setSubject(x)}>
                                    {x}
                                </Chip>
                            ))}
                        </div>
                    )}
                    <div className="text-center py-4">
                        {t && (
                            <div className="text-[14px] text-[#6b7684]">
                                {t.subject} · {t.kind === 'pomodoro' ? `${t.round}번째 ${t.phase === 'focus' ? '집중' : '휴식'}` : '스톱워치'}
                            </div>
                        )}
                        <div className={`text-[64px] font-bold tabular-nums tracking-tight ${t?.phase === 'break' ? 'text-[#00a661]' : ''}`}>{clock(t ? shown : s.focusMin * 60)}</div>
                        {t?.kind === 'pomodoro' && <Bar value={elapsed / limit} className="mx-6" />}
                    </div>
                    {t ? (
                        <Btn kind="danger" className="w-full" onClick={stop}>
                            그만하고 기록
                        </Btn>
                    ) : (
                        <div className="grid grid-cols-3 gap-2">
                            <Btn onClick={() => start('pomodoro')}>{s.focusMin}분 집중</Btn>
                            <Btn kind="soft" onClick={() => start('pomodoro', 15)}>
                                짧게 15분
                            </Btn>
                            <Btn kind="ghost" onClick={() => start('stopwatch')}>
                                스톱워치
                            </Btn>
                        </div>
                    )}
                </Card>
                <TodayPlan />
                <ManualAdd />
                <TodaySessions />
            </div>
        </>
    );
}

// 오늘 과목별 공부 계획 (계획 대비 실제의 기준)
function TodayPlan() {
    const data = useData();
    const [tomorrow, setTomorrow] = useState(false);
    const day = tomorrow ? addDays(today(), 1) : today();
    const plan = data.plans[day] ?? {};
    const actual = minutesBySubject(data.sessions, [day]);
    const setPlan = (subject: string, min: number) =>
        update((d) => {
            const p = (d.plans[day] ??= {});
            if (min > 0) p[subject] = min;
            else delete p[subject];
        });
    const copyYesterday = () =>
        update((d) => {
            const prev = Object.keys(d.plans).filter((k) => k < day).sort().at(-1);
            if (prev) d.plans[day] = { ...d.plans[prev] };
        });
    return (
        <Card title={`${tomorrow ? '내일' : '오늘'} 공부 계획`} extra={<Btn small kind="ghost" onClick={copyYesterday}>지난 계획 복사</Btn>}>
            <div className="flex gap-2 mb-3">
                <Chip active={!tomorrow} onClick={() => setTomorrow(false)}>
                    오늘
                </Chip>
                <Chip active={tomorrow} onClick={() => setTomorrow(true)}>
                    내일
                </Chip>
            </div>
            <ul className="space-y-3">
                {data.settings.subjects.map((sub) => (
                    <li key={sub}>
                        <div className="flex items-center gap-2">
                            <span className="flex-1 text-[15px]">{sub}</span>
                            <span className="text-[13px] text-[#8b95a1] tabular-nums">{fmtMin(actual[sub] ?? 0)} /</span>
                            <input
                                type="number"
                                inputMode="numeric"
                                aria-label={`${sub} 계획 분`}
                                className={`${inputCls} !w-20 !py-1.5 text-right`}
                                value={plan[sub] ?? ''}
                                placeholder="0"
                                onChange={(e) => setPlan(sub, Number(e.target.value))}
                            />
                            <span className="text-[13px] text-[#8b95a1]">분</span>
                        </div>
                        {plan[sub] ? <Bar value={(actual[sub] ?? 0) / plan[sub]} className="mt-1.5" /> : null}
                    </li>
                ))}
            </ul>
        </Card>
    );
}

function ManualAdd() {
    const data = useData();
    const [subject, setSubject] = useState(data.settings.subjects[0] ?? '');
    const [min, setMin] = useState('');
    const [date, setDate] = useState(today());
    return (
        <Card title="직접 기록하기">
            <div className="grid grid-cols-2 gap-2">
                <select className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="과목">
                    {data.settings.subjects.map((x) => (
                        <option key={x}>{x}</option>
                    ))}
                </select>
                <input type="number" inputMode="numeric" className={inputCls} placeholder="분" value={min} onChange={(e) => setMin(e.target.value)} />
                <input type="date" className={`${inputCls} col-span-2`} value={date} max={today()} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
            </div>
            <Btn
                kind="soft"
                className="w-full mt-2"
                disabled={!(Number(min) > 0)}
                onClick={() => {
                    addSession(subject, Number(min), 'manual', date);
                    setMin('');
                }}
            >
                기록 추가
            </Btn>
        </Card>
    );
}

function TodaySessions() {
    const data = useData();
    const list = data.sessions.filter((s) => s.date === today()).reverse();
    return (
        <Card title="오늘 기록" extra={<span className="text-sm text-[#8b95a1]">{fmtMin(list.reduce((a, s) => a + s.minutes, 0))}</span>}>
            {list.length ? (
                <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                    {list.map((s) => (
                        <li key={s.id} className="flex items-center gap-2 py-2 text-[14px]">
                            <span className="flex-1">
                                {s.subject} <span className="text-[#8b95a1] text-[12px]">{s.kind === 'pomodoro' ? '뽀모도로' : s.kind === 'stopwatch' ? '스톱워치' : '직접'}</span>
                            </span>
                            <span className="tabular-nums">{fmtMin(s.minutes)}</span>
                            <button type="button" aria-label="기록 삭제" className="text-[#b0b8c1] px-2" onClick={() => confirm('이 기록을 지울까요?') && update((d) => void (d.sessions = d.sessions.filter((x) => x.id !== s.id)))}>
                                ×
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <Empty>아직 기록이 없어요</Empty>
            )}
        </Card>
    );
}
