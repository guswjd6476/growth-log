import { useState } from 'react';
import type { Habit, Task } from '../lib/types';
import { cancelTask, deleteTask, moveTask, moveTomorrow, restoreTask, toggleHabit, toggleTask } from '../lib/actions';
import { habitStreak, habitWeekCount } from '../lib/logic';
import { addDays, shortDay, today } from '../lib/date';
import { Btn, inputCls, Sheet, useAsk } from './ui';
import { useData } from '../lib/store';

export function Check({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={on}
            aria-label={label}
            onClick={onClick}
            className={`size-6 shrink-0 rounded-full border-2 flex items-center justify-center text-white text-xs transition ${
                on ? 'bg-brand border-brand' : 'border-[#d1d6db] dark:border-[#4e5968]'
            }`}
        >
            {on && '✓'}
        </button>
    );
}

export function TaskRow({ t }: { t: Task }) {
    const [open, setOpen] = useState(false);
    const { ask, node } = useAsk();
    const goals = useData().goals;
    const goal = goals.find((g) => g.id === t.goalId);
    const day = today();
    const overdue = !t.done && !t.canceled && t.date && t.date < day;
    const meta = [
        t.category,
        t.planMin && `${t.planMin}분`,
        t.due && `마감 ${shortDay(t.due)}`,
        goal && `🎯 ${goal.title}`,
        t.routineId && '루틴',
        (t.moved ?? 0) >= 2 && `${t.moved}번 미룸`,
    ].filter(Boolean);

    return (
        <li className="flex items-start gap-3 py-2.5">
            <Check on={t.done} onClick={() => toggleTask(t.id)} label={t.title} />
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setOpen(true)}>
                <div className={`text-[15px] ${t.done || t.canceled ? 'line-through text-[#b0b8c1]' : ''}`}>{t.title}</div>
                {(meta.length > 0 || overdue || t.canceled) && (
                    <div className="text-[12px] text-[#8b95a1] mt-0.5 flex flex-wrap gap-x-2">
                        {overdue && <span className="text-[#e42939]">{shortDay(t.date!)}에 하기로 했던 일</span>}
                        {t.canceled && <span>포기: {t.canceled}</span>}
                        {meta.map((m) => (
                            <span key={String(m)}>{m}</span>
                        ))}
                    </div>
                )}
            </button>
            <Sheet open={open} onClose={() => setOpen(false)} title={t.title}>
                <div className="grid grid-cols-2 gap-2">
                    <Btn kind="soft" onClick={() => (moveTask(t.id, today()), setOpen(false))}>
                        오늘 하기
                    </Btn>
                    <Btn kind="soft" onClick={() => (moveTomorrow(t.id), setOpen(false))}>
                        내일로
                    </Btn>
                    <Btn kind="ghost" onClick={() => (moveTask(t.id, addDays(day, 7)), setOpen(false))}>
                        다음 주로
                    </Btn>
                    <Btn kind="ghost" onClick={() => (moveTask(t.id, null), setOpen(false))}>
                        언젠가로
                    </Btn>
                    {t.canceled ? (
                        <Btn kind="ghost" onClick={() => (restoreTask(t.id), setOpen(false))}>
                            포기 취소
                        </Btn>
                    ) : (
                        <Btn
                            kind="ghost"
                            onClick={async () => {
                                const r = await ask('왜 그만두나요?', '예: 우선순위가 바뀜');
                                if (r !== null) {
                                    cancelTask(t.id, r);
                                    setOpen(false);
                                }
                            }}
                        >
                            포기하기
                        </Btn>
                    )}
                    <Btn kind="danger" onClick={() => confirm('완전히 지울까요? 기록에서도 사라집니다.') && deleteTask(t.id)}>
                        삭제
                    </Btn>
                </div>
                <p className="text-[12px] text-[#8b95a1] mt-3">포기한 일은 지우지 않고 사유와 함께 남습니다. 통계의 연간 장부에서 볼 수 있어요.</p>
            </Sheet>
            {node}
        </li>
    );
}

export function HabitRow({ h, day = today() }: { h: Habit; day?: string }) {
    const streak = habitStreak(h, day);
    const week = habitWeekCount(h, day);
    const done = !!h.checks[day];
    return (
        <li className="flex items-center gap-3 py-2.5">
            <Check on={done} onClick={() => toggleHabit(h.id, day)} label={h.name} />
            <div className="min-w-0 flex-1">
                <div className="text-[15px]">{h.name}</div>
                <div className="text-[12px] text-[#8b95a1]">
                    {h.perWeek >= 7 ? '매일' : `주 ${h.perWeek}회 · 이번 주 ${week}/${h.perWeek}`}
                    {h.reminder && ` · ⏰ ${h.reminder}`}
                </div>
            </div>
            {streak > 0 && (
                <span className="text-[13px] font-bold text-[#f04452]">
                    🔥 {streak}
                    {h.perWeek >= 7 ? '일' : '주'}
                </span>
            )}
        </li>
    );
}

// 한 줄 입력 + 추가 버튼
export function QuickAdd({ placeholder, onAdd, button = '추가' }: { placeholder: string; onAdd: (text: string) => void; button?: string }) {
    const [text, setText] = useState('');
    const submit = () => {
        const v = text.trim();
        if (!v) return;
        onAdd(v);
        setText('');
    };
    return (
        <form
            className="flex gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                submit();
            }}
        >
            <input className={inputCls} value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
            <Btn type="submit" className="shrink-0">
                {button}
            </Btn>
        </form>
    );
}
