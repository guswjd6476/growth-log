import { useState } from 'react';
import { uid, update, useData } from '../lib/store';
import { addTask } from '../lib/actions';
import { addDays, monthKey, shortDay, today, weekStart, yearKey } from '../lib/date';
import { Bar, Btn, Card, Chip, Empty, inputCls, PageTitle, Sheet, useAsk } from '../components/ui';
import { QuickAdd, TaskRow } from '../components/items';
import type { Goal, GoalPeriod } from '../lib/types';

const PERIODS: [GoalPeriod, string][] = [
    ['year', '올해'],
    ['month', '이번 달'],
    ['week', '이번 주'],
];
const keyOf = (p: GoalPeriod, day: string) => (p === 'year' ? yearKey(day) : p === 'month' ? monthKey(day) : weekStart(day));
const shift = (p: GoalPeriod, key: string, n: number) => {
    if (p === 'week') return addDays(key, 7 * n);
    if (p === 'year') return String(Number(key) + n);
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const keyLabel = (p: GoalPeriod, key: string) => (p === 'year' ? `${key}년` : p === 'month' ? `${key.slice(0, 4)}년 ${Number(key.slice(5))}월` : `${shortDay(key)} 주`);

export default function GoalsPage() {
    const data = useData();
    const [period, setPeriod] = useState<GoalPeriod>('month');
    const [key, setKey] = useState(() => keyOf('month', today()));
    const [openId, setOpenId] = useState<string | null>(null);
    const list = data.goals.filter((g) => g.period === period && g.key === key);
    const active = data.goals.filter((g) => !g.done && !g.dropped && g.key === keyOf(g.period, today())).length;
    const open = data.goals.find((g) => g.id === openId);

    return (
        <>
            <PageTitle sub="목표를 할 일로 쪼개면 진행률이 자동으로 올라가요">목표</PageTitle>
            <div className="flex gap-2 pb-3">
                {PERIODS.map(([p, l]) => (
                    <Chip
                        key={p}
                        active={period === p}
                        onClick={() => {
                            setPeriod(p);
                            setKey(keyOf(p, today()));
                        }}
                    >
                        {l}
                    </Chip>
                ))}
            </div>
            <div className="flex items-center justify-between mb-3 px-1">
                <button type="button" aria-label="이전" className="px-3 py-1 text-xl" onClick={() => setKey(shift(period, key, -1))}>
                    ‹
                </button>
                <span className="font-semibold">{keyLabel(period, key)}</span>
                <button type="button" aria-label="다음" className="px-3 py-1 text-xl" onClick={() => setKey(shift(period, key, 1))}>
                    ›
                </button>
            </div>
            {active > data.settings.wipLimit * 2 && <p className="text-[13px] text-[#e42939] mb-3 px-1">지금 진행 중인 목표가 {active}개예요. 너무 많으면 하나도 못 끝낼 수 있어요.</p>}
            <div className="space-y-2">
                <Card>
                    <QuickAdd
                        placeholder={`${keyLabel(period, key)} 목표`}
                        onAdd={(title) =>
                            update((d) => {
                                d.goals.push({ id: uid(), title, period, key, done: false, history: [{ date: today(), text: '만듦' }], createdAt: new Date().toISOString() });
                            })
                        }
                    />
                </Card>
                {list.length ? (
                    list.map((g) => <GoalItem key={g.id} g={g} onOpen={() => setOpenId(g.id)} />)
                ) : (
                    <Card>
                        <Empty>목표가 없어요</Empty>
                    </Card>
                )}
            </div>
            {open && <GoalSheet g={open} onClose={() => setOpenId(null)} />}
        </>
    );
}

function useGoalProgress(g: Goal) {
    const tasks = useData().tasks.filter((t) => t.goalId === g.id && !t.canceled);
    const done = tasks.filter((t) => t.done).length;
    return { tasks, done, rate: g.done ? 1 : tasks.length ? done / tasks.length : 0 };
}

function GoalItem({ g, onOpen }: { g: Goal; onOpen: () => void }) {
    const p = useGoalProgress(g);
    return (
        <button type="button" className="w-full text-left" onClick={onOpen}>
            <Card>
                <div className="flex items-center gap-2">
                    <span className={`flex-1 font-semibold ${g.done || g.dropped ? 'line-through text-[#b0b8c1]' : ''}`}>
                        {g.done && '✅ '}
                        {g.title}
                    </span>
                    <span className="text-[13px] text-[#8b95a1]">
                        {p.done}/{p.tasks.length}
                    </span>
                </div>
                <Bar value={p.rate} className="mt-2" />
                {g.dropped && <div className="text-[12px] text-[#8b95a1] mt-1">포기: {g.dropped}</div>}
            </Card>
        </button>
    );
}

function GoalSheet({ g, onClose }: { g: Goal; onClose: () => void }) {
    const p = useGoalProgress(g);
    const [title, setTitle] = useState(g.title);
    const [note, setNote] = useState(g.note ?? '');
    const { ask, node } = useAsk();
    const edit = (text: string, fn: (x: Goal) => void) =>
        update((d) => {
            const x = d.goals.find((y) => y.id === g.id)!;
            fn(x);
            x.history.push({ date: today(), text });
        });

    return (
        <Sheet open onClose={onClose} title="목표">
            <input
                className={`${inputCls} font-semibold`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => title.trim() && title !== g.title && edit(`이름 변경: ${g.title} → ${title.trim()}`, (x) => void (x.title = title.trim()))}
            />
            <textarea className={`${inputCls} mt-2 min-h-[60px]`} placeholder="왜 이 목표를? 어떻게 되면 성공?" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (g.note ?? '') && update((d) => void (d.goals.find((y) => y.id === g.id)!.note = note))} />

            <div className="mt-4 font-semibold text-[15px]">할 일로 쪼개기</div>
            <div className="mt-2">
                <QuickAdd placeholder="이 목표를 위한 할 일 (언젠가 목록에 들어가요)" onAdd={(t) => addTask({ title: t, goalId: g.id, date: null })} />
            </div>
            <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                {p.tasks.map((t) => (
                    <TaskRow key={t.id} t={t} />
                ))}
            </ul>

            <div className="flex gap-2 mt-4">
                <Btn className="flex-1" kind={g.done ? 'ghost' : 'primary'} onClick={() => edit(g.done ? '완료 취소' : '완료', (x) => void (x.done = !x.done))}>
                    {g.done ? '완료 취소' : '달성!'}
                </Btn>
                {g.dropped ? (
                    <Btn className="flex-1" kind="ghost" onClick={() => edit('포기 취소', (x) => void (x.dropped = undefined))}>
                        포기 취소
                    </Btn>
                ) : (
                    <Btn
                        className="flex-1"
                        kind="ghost"
                        onClick={async () => {
                            const r = await ask('왜 그만두나요?');
                            if (r !== null) edit(`포기: ${r || '사유 없음'}`, (x) => void (x.dropped = r || '사유 없음'));
                        }}
                    >
                        포기
                    </Btn>
                )}
                <Btn kind="danger" onClick={() => confirm('목표를 지울까요? 연결된 할 일은 남습니다.') && (update((d) => void (d.goals = d.goals.filter((x) => x.id !== g.id))), onClose())}>
                    삭제
                </Btn>
            </div>

            <div className="mt-5 text-[13px] font-semibold text-[#6b7684]">변경 이력</div>
            <ul className="mt-1 text-[13px] text-[#8b95a1] space-y-0.5">
                {[...g.history].reverse().map((h, i) => (
                    <li key={i}>
                        {shortDay(h.date)} · {h.text}
                    </li>
                ))}
            </ul>
            {node}
        </Sheet>
    );
}
