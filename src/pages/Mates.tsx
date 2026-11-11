import { useEffect, useState } from 'react';
import { update, useData } from '../lib/store';
import { today } from '../lib/date';
import { mateSummary, mateToday, type MateSummary, type MateWords } from '../lib/logic';
import { go } from '../lib/nav';
import { sb, syncNow, syncUserId } from '../lib/sync';
import { Btn, Card, Chip, Empty, inputCls, label, PageTitle } from '../components/ui';
import type { Settings } from '../lib/types';

type Row = { user_id: string; code: string; summary: MateSummary };

export default function MatesPage() {
    const data = useData();
    const s = data.settings;
    const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((d) => void (d.settings[k] = v));
    const [rows, setRows] = useState<Row[] | null>(null);
    const [input, setInput] = useState('');
    const [msg, setMsg] = useState('');
    const me = syncUserId();
    const day = today();

    const load = async () => {
        const { data: r, error } = await sb!.from('mate_profiles').select('user_id, code, summary');
        if (error) return setMsg('불러오지 못했어요. 인터넷 연결을 확인해 주세요.');
        setRows(r as Row[]);
    };
    useEffect(() => {
        syncNow().then(load); // 동기화 때 내 요약(과 초대 코드)이 처음 만들어진다
    }, []);

    const add = async () => {
        const code = input.trim();
        if (!code) return;
        const { data: ok, error } = await sb!.rpc('add_mate', { p_code: code });
        if (error) return setMsg('잠시 뒤 다시 해 주세요.');
        setMsg(ok ? '메이트가 됐어요!' : '그 코드를 찾지 못했어요.');
        if (ok) {
            setInput('');
            load();
        }
    };
    const remove = async (r: Row) => {
        if (!confirm(`${r.summary.name}님과 메이트를 끊을까요?`)) return;
        const { error } = await sb!.rpc('remove_mate', { p_mate: r.user_id });
        if (error) return setMsg('잠시 뒤 다시 해 주세요.');
        load();
    };

    const myCode = rows?.find((r) => r.user_id === me)?.code;
    // 내 카드는 서버 것이 아니라 지금 기록으로 바로 그린다
    const people = [
        { row: null as Row | null, s: mateSummary(data, day) },
        ...(rows ?? []).filter((r) => r.user_id !== me && r.summary.day).map((r) => ({ row: r as Row | null, s: mateToday(r.summary, day) })),
    ].sort((a, b) => b.s.weekMin - a.s.weekMin);

    return (
        <>
            <PageTitle sub="서로 오늘 얼마나 했는지 보며 같이 공부해요">공부 메이트</PageTitle>
            <div className="space-y-3">
                <Card title="내 정보">
                    <label className={label}>메이트에게 보이는 이름</label>
                    <input className={inputCls} value={s.nickname} maxLength={20} placeholder="예: 현정" onChange={(e) => set('nickname', e.target.value)} />
                    <div className="flex items-center justify-between mt-4">
                        <span className="text-[14px]">오늘 할 일 목록도 보여 주기</span>
                        {s.shareTasks ? (
                            <Btn small kind="ghost" onClick={() => set('shareTasks', false)}>
                                끄기
                            </Btn>
                        ) : (
                            <Btn small onClick={() => set('shareTasks', true)}>
                                켜기
                            </Btn>
                        )}
                    </div>
                    <p className="text-[12px] text-[#8b95a1] mt-2">
                        {s.shareTasks ? '메이트가 오늘 할 일 제목과 완료 여부를 볼 수 있어요.' : '지금은 공부 시간·연속일·할 일 개수·영단어 기록만 보여요.'} 일기·습관·독서 기록은 보이지 않아요.
                    </p>
                </Card>

                <Card title="메이트 맺기">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-[13px] text-[#8b95a1]">내 초대 코드</div>
                            <div className="text-[22px] font-bold tracking-widest">{myCode ?? '…'}</div>
                        </div>
                        {myCode && (
                            <Btn small kind="soft" onClick={() => navigator.clipboard?.writeText(myCode).then(() => setMsg('코드를 복사했어요. 친구에게 보내 주세요.'))}>
                                복사
                            </Btn>
                        )}
                    </div>
                    <div className="flex gap-2 mt-4">
                        <input className={inputCls} value={input} placeholder="친구 코드 입력" maxLength={8} onChange={(e) => setInput(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === 'Enter' && add()} />
                        <Btn kind="accent" onClick={add} className="shrink-0">
                            맺기
                        </Btn>
                    </div>
                    {msg && <p className="text-[13px] text-[#6b7684] mt-2">{msg}</p>}
                </Card>

                <WordRace people={people} />

                <Card title="이번 주 순위">
                    {rows && people.length === 1 && <Empty>아직 메이트가 없어요. 초대 코드를 친구에게 보내 보세요.</Empty>}
                    <ul className="space-y-3">
                        {people.map(({ row, s: p }, i) => (
                            <li key={row?.user_id ?? 'me'} className="rounded-xl bg-[#f9fafb] dark:bg-[#26292e] p-3">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 text-center font-bold text-[#8b95a1]">{i + 1}</span>
                                    <span className="flex-1 font-semibold">
                                        {p.name}
                                        {!row && <span className="ml-1.5 text-[11px] rounded-full bg-brand-soft text-brand px-2 py-0.5">나</span>}
                                    </span>
                                    <span className="text-[13px] font-semibold text-[#c27c00]">🔥 {p.streak}일</span>
                                    {row && (
                                        <button type="button" aria-label={`${p.name} 메이트 끊기`} onClick={() => remove(row)} className="text-[#b0b8c1] px-1">
                                            ×
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-2 text-center text-[12px] text-[#6b7684] dark:text-[#9aa1aa]">
                                    <div>
                                        오늘 <b className="block text-[15px] text-[#191f28] dark:text-white">{p.todayMin}분</b>
                                    </div>
                                    <div>
                                        할 일 <b className="block text-[15px] text-[#191f28] dark:text-white">{p.done}/{p.total}</b>
                                    </div>
                                    <div>
                                        이번 주 <b className="block text-[15px] text-[#191f28] dark:text-white">{p.weekMin}분</b>
                                    </div>
                                </div>
                                {p.tasks && p.tasks.length > 0 && (
                                    <ul className="mt-2 space-y-1 text-[13px]">
                                        {p.tasks.map((t, j) => (
                                            <li key={j} className={t.done ? 'line-through text-[#b0b8c1]' : ''}>
                                                {t.done ? '✅' : '⬜'} {t.title}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </>
    );
}

type Metric = Exclude<keyof MateWords, 'last'>;
const METRICS: [Metric, string, string][] = [
    ['known', '외운 단어', '개'],
    ['week', '이번 주 푼 문제', '문제'],
    ['days', '통과 DAY', 'DAY'],
];

// 영단어 대결: 고른 기준으로 순위, 1등과의 차이를 막대로
function WordRace({ people }: { people: { row: Row | null; s: MateSummary }[] }) {
    const [m, setM] = useState<Metric>('known');
    const [, name, unit] = METRICS.find(([k]) => k === m)!;
    const val = (p: MateSummary) => p.words?.[m] ?? 0;
    const list = [...people].sort((a, b) => val(b.s) - val(a.s));
    const top = Math.max(1, val(list[0].s));
    const myRank = list.findIndex((p) => !p.row);
    const gap = val(list[0].s) - val(list[myRank].s);
    const lead = list.length > 1 ? val(list[0].s) - val(list[1].s) : 0;

    return (
        <Card title="🔤 영단어 대결" extra={<button type="button" className="text-sm text-brand font-semibold" onClick={() => go('words')}>공부하기</button>}>
            <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
                {METRICS.map(([k, l]) => (
                    <Chip key={k} active={m === k} onClick={() => setM(k)}>
                        {l}
                    </Chip>
                ))}
            </div>
            {list.length > 1 && (
                <p className="text-[14px] mb-3">
                    {gap > 0 ? `1등까지 ${gap}${unit} 남았어요 💪` : lead > 0 ? `내가 1등! 2등과 ${lead}${unit} 차이 👑` : '공동 1등이에요! 한 발 앞서 볼까요?'}
                </p>
            )}
            <ul className="space-y-2.5">
                {list.map(({ row, s: p }, i) => (
                    <li key={row?.user_id ?? 'me'}>
                        <div className="flex items-center gap-2 text-[14px]">
                            <span className="w-6 text-center">{['🥇', '🥈', '🥉'][i] ?? i + 1}</span>
                            <span className="flex-1 font-semibold truncate">
                                {p.name}
                                {!row && <span className="ml-1.5 text-[11px] rounded-full bg-brand-soft text-brand px-2 py-0.5">나</span>}
                            </span>
                            {(p.words?.streak ?? 0) > 0 && <span className="text-[12px] text-[#c27c00]">🔥{p.words!.streak}일</span>}
                            <b>
                                {val(p)}
                                <span className="text-[12px] font-normal text-[#8b95a1]">{unit}</span>
                            </b>
                        </div>
                        <div className="ml-8 mt-1 h-2 rounded-full bg-[#f2f4f6] dark:bg-[#26292e] overflow-hidden">
                            <div className={`h-full rounded-full ${row ? 'bg-[#b0b8c1]' : 'bg-brand'}`} style={{ width: `${(val(p) / top) * 100}%` }} />
                        </div>
                        {!p.words && <div className="ml-8 text-[11px] text-[#b0b8c1] mt-0.5">앱을 새로 열면 기록이 올라와요</div>}
                    </li>
                ))}
            </ul>
            <p className="text-[12px] text-[#8b95a1] mt-3">{name} 기준 · 외운 단어는 테스트에서 맞힌 단어예요</p>
        </Card>
    );
}
