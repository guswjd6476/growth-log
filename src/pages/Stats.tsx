import { useState } from 'react';
import { useData } from '../lib/store';
import { fmtMin, lastDays, shortDay, today, weekdayName, yearKey } from '../lib/date';
import { badges, habitRate, minutesBySubject, minutesOn, planVsActual, records, yearLedger } from '../lib/logic';
import { Bar, Card, Chip, Empty, PageTitle } from '../components/ui';

// 막대 그래프 (값 하나씩, 위에 숫자)
function Bars({ items, unit = (v: number) => String(v) }: { items: { label: string; value: number; sub?: string }[]; unit?: (v: number) => string }) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return (
        <div className="flex items-end gap-1 h-36" role="img" aria-label={items.map((i) => `${i.label} ${unit(i.value)}`).join(', ')}>
            {items.map((i, k) => (
                <div key={k} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    <div className="text-[10px] text-[#8b95a1] tabular-nums mb-0.5 truncate">{i.value ? unit(i.value) : ''}</div>
                    <div className="w-full max-w-6 rounded-t-md bg-brand" style={{ height: `${(i.value / max) * 100}%`, minHeight: i.value ? 3 : 0 }} />
                    <div className="text-[10px] text-[#8b95a1] mt-1 truncate">{i.label}</div>
                </div>
            ))}
        </div>
    );
}

export default function StatsPage() {
    const data = useData();
    const day = today();
    const [range, setRange] = useState<7 | 14 | 30>(7);
    const days = lastDays(range);
    const total = days.reduce((a, d) => a + minutesOn(data.sessions, d), 0);
    const bySub = Object.entries(minutesBySubject(data.sessions, days)).sort((a, b) => b[1] - a[1]);
    const rec = records(data, day);
    const plan = lastDays(14).map((d) => ({ d, r: planVsActual(data, d).rate }));
    const [year, setYear] = useState(yearKey(day));
    const ledger = yearLedger(data, year);
    const years = [...new Set([yearKey(day), ...data.sessions.map((s) => yearKey(s.date)), ...data.books.map((b) => b.finishedAt && yearKey(b.finishedAt)).filter(Boolean)])].sort().reverse() as string[];

    // 최근 12개월 완독
    const months = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - 11 + i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    return (
        <>
            <PageTitle>통계</PageTitle>
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <Card>
                        <div className="text-[12px] text-[#8b95a1]">이번 7일 공부</div>
                        <div className="text-[20px] font-bold">{fmtMin(rec.thisWeek)}</div>
                        <div className={`text-[12px] ${rec.thisWeek >= rec.lastWeek ? 'text-[#00a661]' : 'text-[#e42939]'}`}>
                            지난 7일보다 {rec.thisWeek >= rec.lastWeek ? '+' : '−'}
                            {fmtMin(Math.abs(rec.thisWeek - rec.lastWeek))}
                        </div>
                    </Card>
                    <Card>
                        <div className="text-[12px] text-[#8b95a1]">최고 기록 (하루)</div>
                        <div className="text-[20px] font-bold">{rec.bestDay ? fmtMin(rec.bestDay.min) : '-'}</div>
                        <div className="text-[12px] text-[#8b95a1]">{rec.bestDay ? shortDay(rec.bestDay.day) : '기록을 쌓아 보세요'}</div>
                    </Card>
                </div>

                <Card
                    title={`공부 시간 · ${fmtMin(total)}`}
                    extra={
                        <div className="flex gap-1">
                            {([7, 14, 30] as const).map((r) => (
                                <Chip key={r} active={range === r} onClick={() => setRange(r)}>
                                    {r}일
                                </Chip>
                            ))}
                        </div>
                    }
                >
                    <Bars items={days.map((d) => ({ label: range === 7 ? weekdayName(d) : String(Number(d.slice(8))), value: minutesOn(data.sessions, d) }))} unit={(v) => (v >= 60 ? `${(v / 60).toFixed(1)}h` : `${v}m`)} />
                    {bySub.length > 0 && (
                        <ul className="mt-4 space-y-2">
                            {bySub.map(([s, m]) => (
                                <li key={s}>
                                    <div className="flex justify-between text-[13px]">
                                        <span>{s}</span>
                                        <span className="tabular-nums text-[#6b7684]">
                                            {fmtMin(m)} · {Math.round((m / total) * 100)}%
                                        </span>
                                    </div>
                                    <Bar value={m / total} className="mt-1" />
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <Card title="계획 지킴 (14일)">
                    {plan.some((p) => p.r !== null) ? (
                        <Bars items={plan.map((p) => ({ label: String(Number(p.d.slice(8))), value: p.r === null ? 0 : Math.round(p.r * 100) }))} unit={(v) => `${v}%`} />
                    ) : (
                        <Empty>공부 계획이나 할 일이 있는 날만 계산돼요</Empty>
                    )}
                </Card>

                <Card title="습관 달성률 (30일)">
                    {data.habits.filter((h) => !h.archived).length ? (
                        <ul className="space-y-2">
                            {data.habits
                                .filter((h) => !h.archived)
                                .map((h) => {
                                    const r = habitRate(h, lastDays(30));
                                    return (
                                        <li key={h.id}>
                                            <div className="flex justify-between text-[13px]">
                                                <span>{h.name}</span>
                                                <span className="tabular-nums text-[#6b7684]">{Math.round(r * 100)}%</span>
                                            </div>
                                            <Bar value={r} className="mt-1" />
                                        </li>
                                    );
                                })}
                        </ul>
                    ) : (
                        <Empty>습관이 없어요</Empty>
                    )}
                </Card>

                <Card title="월별 완독">
                    <Bars items={months.map((m) => ({ label: `${Number(m.slice(5))}월`, value: data.books.filter((b) => b.status === 'done' && b.finishedAt?.startsWith(m)).length }))} unit={(v) => `${v}권`} />
                </Card>

                <Card
                    title="연간 장부"
                    extra={
                        <select className="bg-transparent text-[14px] font-semibold" value={year} onChange={(e) => setYear(e.target.value)} aria-label="연도">
                            {years.map((y) => (
                                <option key={y}>{y}</option>
                            ))}
                        </select>
                    }
                >
                    <div className="grid grid-cols-2 gap-y-3 text-[14px]">
                        <div>
                            <div className="text-[12px] text-[#8b95a1]">완독</div>
                            <b>{ledger.books.length}권</b>
                        </div>
                        <div>
                            <div className="text-[12px] text-[#8b95a1]">공부</div>
                            <b>{fmtMin(ledger.studyMin)}</b>
                        </div>
                        <div>
                            <div className="text-[12px] text-[#8b95a1]">끝낸 할 일</div>
                            <b>{ledger.tasksDone}개</b>
                        </div>
                        <div>
                            <div className="text-[12px] text-[#8b95a1]">습관 체크</div>
                            <b>{ledger.habitChecks}번</b>
                        </div>
                    </div>
                    {ledger.books.length > 0 && (
                        <>
                            <div className="text-[13px] font-semibold mt-4 mb-1">읽은 책</div>
                            <ol className="text-[13px] text-[#4e5968] dark:text-[#c5cad1] list-decimal pl-5 space-y-0.5">
                                {ledger.books.map((b) => (
                                    <li key={b.id}>
                                        {b.title} {b.rating ? '★'.repeat(b.rating) : ''} <span className="text-[#8b95a1]">{b.finishedAt && shortDay(b.finishedAt)}</span>
                                    </li>
                                ))}
                            </ol>
                        </>
                    )}
                    {ledger.dropped.length > 0 && (
                        <>
                            <div className="text-[13px] font-semibold mt-4 mb-1">그만둔 것 {ledger.dropped.length}</div>
                            <ul className="text-[13px] text-[#8b95a1] space-y-0.5">
                                {ledger.dropped.map((x, i) => (
                                    <li key={i}>{x}</li>
                                ))}
                            </ul>
                        </>
                    )}
                </Card>

                <Card title="배지">
                    <div className="grid grid-cols-3 gap-2">
                        {badges(data, day).map((b) => (
                            <div key={b.name} className={`rounded-xl p-2 text-center text-[12px] font-semibold ${b.ok ? 'bg-[#fff6e0] text-[#c27c00]' : 'bg-[#f2f4f6] dark:bg-[#26292e] text-[#b0b8c1]'}`}>
                                {b.ok ? '🏅' : '🔒'}
                                <div>{b.name}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </>
    );
}
