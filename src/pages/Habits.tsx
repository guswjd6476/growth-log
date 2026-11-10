import { useState } from 'react';
import { uid, update, useData } from '../lib/store';
import { toggleHabit } from '../lib/actions';
import { lastDays, shortDay, today, weekdayName } from '../lib/date';
import { habitRate, habitStreak } from '../lib/logic';
import { Btn, Card, Empty, inputCls, label, PageTitle, Sheet, useAsk } from '../components/ui';
import type { Habit } from '../lib/types';

export default function HabitsPage() {
    const data = useData();
    const [adding, setAdding] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const list = data.habits.filter((h) => !!h.archived === showArchived);
    return (
        <>
            <PageTitle sub="지난 칸을 눌러 빠뜨린 날을 채울 수 있어요" extra={<Btn onClick={() => setAdding(true)}>+ 습관</Btn>}>
                습관
            </PageTitle>
            <div className="space-y-3">
                {list.length ? list.map((h) => <HabitCard key={h.id} h={h} />) : (
                    <Card>
                        <Empty>{showArchived ? '보관한 습관이 없어요' : '물 마시기, 운동, 영어 단어처럼 작게 시작해 보세요'}</Empty>
                    </Card>
                )}
                <button type="button" className="text-[13px] text-[#8b95a1] underline px-1" onClick={() => setShowArchived(!showArchived)}>
                    {showArchived ? '진행 중인 습관 보기' : '보관한 습관 보기'}
                </button>
            </div>
            <AddHabit open={adding} onClose={() => setAdding(false)} />
        </>
    );
}

function HabitCard({ h }: { h: Habit }) {
    const day = today();
    const days = lastDays(35);
    const { ask, node } = useAsk();
    const tap = async (d: string) => {
        // 지난 날을 새로 채울 때는 사유를 남긴다 (정확한 기록)
        if (d < day && !h.checks[d]) {
            const r = await ask(`${shortDay(d)} ${weekdayName(d)} 기록 채우기`, '예: 했는데 체크를 깜빡함');
            if (r === null) return;
            toggleHabit(h.id, d, r || undefined);
        } else toggleHabit(h.id, d);
    };
    const late = Object.entries(h.checks).filter(([, c]) => c.late).length;
    return (
        <Card
            title={h.name}
            extra={
                <div className="flex gap-1">
                    <Btn small kind="ghost" onClick={() => update((d) => void (d.habits.find((x) => x.id === h.id)!.archived = !h.archived))}>
                        {h.archived ? '되살리기' : '보관'}
                    </Btn>
                    <Btn small kind="ghost" onClick={() => confirm('습관과 기록을 모두 지울까요?') && update((d) => void (d.habits = d.habits.filter((x) => x.id !== h.id)))}>
                        삭제
                    </Btn>
                </div>
            }
        >
            <div className="flex gap-4 text-[13px] text-[#6b7684] mb-3">
                <span>{h.perWeek >= 7 ? '매일' : `주 ${h.perWeek}회`}</span>
                <span>🔥 {habitStreak(h, day)}{h.perWeek >= 7 ? '일' : '주'} 연속</span>
                <span>30일 {Math.round(habitRate(h, lastDays(30)) * 100)}%</span>
                {h.reminder && <span>⏰ {h.reminder}</span>}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                    const c = h.checks[d];
                    return (
                        <button
                            key={d}
                            type="button"
                            aria-label={`${shortDay(d)} ${c ? '함' : '안 함'}`}
                            disabled={d > day}
                            onClick={() => tap(d)}
                            title={c?.note}
                            className={`aspect-square rounded-lg text-[11px] font-semibold ${
                                c ? (c.late ? 'bg-brand/50 text-white' : 'bg-brand text-white') : 'bg-[#f2f4f6] dark:bg-[#26292e] text-[#b0b8c1]'
                            } ${d === day ? 'ring-2 ring-[#191f28] dark:ring-white' : ''}`}
                        >
                            {Number(d.slice(8))}
                        </button>
                    );
                })}
            </div>
            {late > 0 && <p className="text-[12px] text-[#8b95a1] mt-2">연한 칸은 나중에 채운 기록이에요 ({late}일)</p>}
            {node}
        </Card>
    );
}

function AddHabit({ open, onClose }: { open: boolean; onClose: () => void }) {
    const data = useData();
    const [f, setF] = useState({ name: '', perWeek: 7, reminder: '', category: '' });
    const save = () => {
        if (!f.name.trim()) return;
        update((d) => {
            d.habits.push({ id: uid(), name: f.name.trim(), perWeek: f.perWeek, reminder: f.reminder || undefined, category: f.category || undefined, checks: {}, createdAt: new Date().toISOString() });
        });
        setF({ ...f, name: '' });
        onClose();
    };
    return (
        <Sheet open={open} onClose={onClose} title="습관 만들기">
            <input autoFocus className={inputCls} placeholder="예: 영어 단어 20개" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <label className={label}>얼마나 자주</label>
            <div className="grid grid-cols-4 gap-1.5">
                {[7, 5, 3, 1].map((n) => (
                    <button
                        key={n}
                        type="button"
                        onClick={() => setF({ ...f, perWeek: n })}
                        className={`py-2 rounded-xl text-[14px] font-semibold ${f.perWeek === n ? 'bg-brand text-white' : 'bg-[#f2f4f6] dark:bg-[#26292e] text-[#6b7684]'}`}
                    >
                        {n === 7 ? '매일' : `주 ${n}회`}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className={label}>알림 시각</label>
                    <input type="time" className={inputCls} value={f.reminder} onChange={(e) => setF({ ...f, reminder: e.target.value })} />
                </div>
                <div>
                    <label className={label}>분류</label>
                    <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                        <option value="">없음</option>
                        {data.settings.categories.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                </div>
            </div>
            <Btn className="w-full mt-5" onClick={save} disabled={!f.name.trim()}>
                만들기
            </Btn>
        </Sheet>
    );
}
