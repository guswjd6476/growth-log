import { useState } from 'react';
import { refreshDay, uid, update, useData } from '../lib/store';
import { addTask } from '../lib/actions';
import { addDays, shortDay, today, weekdayName } from '../lib/date';
import { Btn, Card, Chip, Empty, inputCls, label, PageTitle, Sheet } from '../components/ui';
import { TaskRow } from '../components/items';
import type { Task } from '../lib/types';

type Filter = 'today' | 'upcoming' | 'someday' | 'done' | 'dropped' | 'routine';
const FILTERS: [Filter, string][] = [
    ['today', '오늘·밀린 일'],
    ['upcoming', '예정'],
    ['someday', '언젠가'],
    ['done', '완료'],
    ['dropped', '포기'],
    ['routine', '루틴'],
];
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function TasksPage() {
    const data = useData();
    const day = today();
    const [filter, setFilter] = useState<Filter>('today');
    const [cat, setCat] = useState<string | null>(null);
    const [adding, setAdding] = useState(false);

    const pick = (t: Task) => {
        if (cat && t.category !== cat) return false;
        switch (filter) {
            case 'today':
                return !!t.date && t.date <= day && !t.done && !t.canceled;
            case 'upcoming':
                return !!t.date && t.date > day && !t.done && !t.canceled;
            case 'someday':
                return !t.date && !t.done && !t.canceled;
            case 'done':
                return t.done;
            case 'dropped':
                return !!t.canceled;
            default:
                return false;
        }
    };
    const list = data.tasks
        .filter(pick)
        .sort((a, b) => (filter === 'done' ? (b.doneAt ?? '').localeCompare(a.doneAt ?? '') : (a.date ?? '9').localeCompare(b.date ?? '9')));

    // 예정은 날짜별로 묶어서
    const groups = filter === 'upcoming' ? [...new Set(list.map((t) => t.date!))] : [null];

    return (
        <>
            <PageTitle sub="밀린 일은 오늘로 모아서 보여 줘요" extra={<Btn onClick={() => setAdding(true)}>+ 추가</Btn>}>
                할 일
            </PageTitle>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {FILTERS.map(([f, l]) => (
                    <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
                        {l}
                    </Chip>
                ))}
            </div>
            {filter !== 'routine' && (
                <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4">
                    <Chip active={!cat} onClick={() => setCat(null)}>
                        전체
                    </Chip>
                    {data.settings.categories.map((c) => (
                        <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
                            {c}
                        </Chip>
                    ))}
                </div>
            )}

            {filter === 'routine' ? (
                <Routines />
            ) : (
                <div className="space-y-3">
                    {groups.map((g) => {
                        const items = g ? list.filter((t) => t.date === g) : list;
                        return (
                            <Card key={g ?? 'all'} title={g ? `${shortDay(g)} ${weekdayName(g)}` : undefined}>
                                {items.length ? (
                                    <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                                        {items.map((t) => (
                                            <TaskRow key={t.id} t={t} />
                                        ))}
                                    </ul>
                                ) : (
                                    <Empty>비어 있어요</Empty>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
            <AddTaskSheet open={adding} onClose={() => setAdding(false)} defaultDate={filter === 'someday' ? null : day} />
        </>
    );
}

function AddTaskSheet({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate: string | null }) {
    const data = useData();
    const day = today();
    const [f, setF] = useState({ title: '', date: defaultDate ?? '', due: '', category: '', planMin: '', goalId: '' });
    const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
    const goals = data.goals.filter((g) => !g.done && !g.dropped);
    const save = () => {
        if (!f.title.trim()) return;
        addTask({
            title: f.title.trim(),
            date: f.date || null,
            due: f.due || null,
            category: f.category || undefined,
            planMin: Number(f.planMin) || undefined,
            goalId: f.goalId || undefined,
        });
        setF({ ...f, title: '' });
        onClose();
    };
    return (
        <Sheet open={open} onClose={onClose} title="할 일 추가">
            <input autoFocus className={inputCls} placeholder="무엇을 할까요?" value={f.title} onChange={set('title')} onKeyDown={(e) => e.key === 'Enter' && save()} />
            <label className={label}>언제 할까요</label>
            <div className="flex gap-2 flex-wrap">
                {[
                    ['오늘', day],
                    ['내일', addDays(day, 1)],
                    ['언젠가', ''],
                ].map(([l, v]) => (
                    <Chip key={l} active={f.date === v} onClick={() => setF({ ...f, date: v })}>
                        {l}
                    </Chip>
                ))}
                <input type="date" className={`${inputCls} !w-auto !py-1.5`} value={f.date} onChange={set('date')} />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className={label}>마감일</label>
                    <input type="date" className={inputCls} value={f.due} onChange={set('due')} />
                </div>
                <div>
                    <label className={label}>예상 시간(분)</label>
                    <input type="number" inputMode="numeric" className={inputCls} value={f.planMin} onChange={set('planMin')} />
                </div>
                <div>
                    <label className={label}>분류</label>
                    <select className={inputCls} value={f.category} onChange={set('category')}>
                        <option value="">없음</option>
                        {data.settings.categories.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className={label}>목표</label>
                    <select className={inputCls} value={f.goalId} onChange={set('goalId')}>
                        <option value="">없음</option>
                        {goals.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.title}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <Btn className="w-full mt-5" onClick={save} disabled={!f.title.trim()}>
                추가
            </Btn>
        </Sheet>
    );
}

// 요일마다 자동으로 생기는 할 일
function Routines() {
    const data = useData();
    const [title, setTitle] = useState('');
    const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [planMin, setPlanMin] = useState('');
    const [category, setCategory] = useState('');
    const add = () => {
        if (!title.trim() || !days.length) return;
        update((d) => {
            d.routines.push({ id: uid(), title: title.trim(), days, planMin: Number(planMin) || undefined, category: category || undefined, since: today() });
        });
        refreshDay(); // 오늘 요일이면 바로 오늘 할 일에
        setTitle('');
    };
    return (
        <div className="space-y-3">
            <Card title="루틴 만들기">
                <input className={inputCls} placeholder="예: 영어 단어 30개" value={title} onChange={(e) => setTitle(e.target.value)} />
                <div className="flex gap-1.5 mt-3">
                    {DAYS.map((l, i) => (
                        <button
                            key={l}
                            type="button"
                            aria-pressed={days.includes(i)}
                            onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}
                            className={`flex-1 py-2 rounded-xl text-[14px] font-semibold ${days.includes(i) ? 'bg-brand text-white' : 'bg-[#f2f4f6] dark:bg-[#26292e] text-[#8b95a1]'}`}
                        >
                            {l}
                        </button>
                    ))}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <input type="number" inputMode="numeric" className={inputCls} placeholder="예상 분" value={planMin} onChange={(e) => setPlanMin(e.target.value)} />
                    <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)}>
                        <option value="">분류 없음</option>
                        {data.settings.categories.map((c) => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>
                </div>
                <Btn className="w-full mt-3" onClick={add} disabled={!title.trim() || !days.length}>
                    루틴 추가
                </Btn>
                <p className="text-[12px] text-[#8b95a1] mt-2">고른 요일마다 그날 할 일에 자동으로 들어갑니다.</p>
            </Card>
            <Card title="내 루틴">
                {data.routines.length ? (
                    <ul className="divide-y divide-[#f2f4f6] dark:divide-[#26292e]">
                        {data.routines.map((r) => (
                            <li key={r.id} className="flex items-center gap-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[15px]">{r.title}</div>
                                    <div className="text-[12px] text-[#8b95a1]">
                                        {r.days.length === 7 ? '매일' : r.days.map((i) => DAYS[i]).join('·')}
                                        {r.planMin && ` · ${r.planMin}분`}
                                        {r.category && ` · ${r.category}`}
                                    </div>
                                </div>
                                <Btn small kind="ghost" onClick={() => confirm('루틴을 지울까요? 이미 생긴 할 일은 남습니다.') && update((d) => void (d.routines = d.routines.filter((x) => x.id !== r.id)))}>
                                    삭제
                                </Btn>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Empty>아침 루틴, 요일별 공부 시간표를 만들어 보세요</Empty>
                )}
            </Card>
        </div>
    );
}
