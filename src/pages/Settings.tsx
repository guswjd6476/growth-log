import { useState } from 'react';
import { emptyData, getData, replaceAll, update, useData } from '../lib/store';
import { daysBetween, today } from '../lib/date';
import { toCSV } from '../lib/logic';
import { Btn, Card, Chip, inputCls, label, PageTitle } from '../components/ui';
import type { Settings } from '../lib/types';
import { sb, sendCode, signOut, syncEmail, syncNow, useSync, verifyCode } from '../lib/sync';
import { disablePush, enablePush, pushAvailable, pushOn } from '../lib/push';

function download(name: string, text: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function SettingsPage() {
    const data = useData();
    const s = data.settings;
    const set = <K extends keyof Settings>(k: K, v: Settings[K]) => update((d) => void (d.settings[k] = v));
    const [importMsg, setImportMsg] = useState('');
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone;
    const backupAge = s.lastBackup ? daysBetween(s.lastBackup, today()) : null;

    const backup = () => {
        download(`성장일지-백업-${today()}.json`, JSON.stringify(getData(), null, 2), 'application/json');
        set('lastBackup', today());
    };
    const restore = async (file: File) => {
        try {
            const parsed = JSON.parse(await file.text());
            if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.tasks)) throw new Error();
            if (!confirm('지금 기록을 백업 파일 내용으로 바꿀까요? 지금 기록은 사라집니다.')) return;
            replaceAll(parsed);
            setImportMsg('불러왔어요.');
        } catch {
            setImportMsg('성장일지 백업 파일이 아니에요.');
        }
    };
    const csv = () => {
        const d = getData();
        download(`공부기록-${today()}.csv`, toCSV(d.sessions.map((x) => ({ 날짜: x.date, 과목: x.subject, 분: x.minutes, 방식: x.kind }))), 'text/csv');
        download(
            `독서기록-${today()}.csv`,
            toCSV(d.books.map((b) => ({ 제목: b.title, 저자: b.author ?? '', 상태: b.status, 읽은쪽: b.current, 전체쪽: b.pages, 별점: b.rating ?? '', 시작: b.startedAt ?? '', 완독: b.finishedAt ?? '', 포기사유: b.dropReason ?? '', 메모수: b.notes.length }))),
            'text/csv',
        );
        download(
            `할일-${today()}.csv`,
            toCSV(d.tasks.map((t) => ({ 할일: t.title, 날짜: t.date ?? '', 마감: t.due ?? '', 분류: t.category ?? '', 완료: t.done ? 'O' : '', 완료일: t.doneAt ?? '', 포기사유: t.canceled ?? '', 미룬횟수: t.moved ?? 0 }))),
            'text/csv',
        );
        download(`습관체크-${today()}.csv`, toCSV(d.habits.flatMap((h) => Object.entries(h.checks).map(([date, c]) => ({ 습관: h.name, 날짜: date, 나중에채움: c.late ? 'O' : '', 메모: c.note ?? '' })))), 'text/csv');
    };
    const enableNotify = async () => {
        if (typeof Notification === 'undefined') return alert(isIOS ? '아이폰은 홈 화면에 추가한 뒤 그 앱에서 켜 주세요.' : '이 브라우저는 알림을 지원하지 않아요.');
        const p = await Notification.requestPermission();
        set('notify', p === 'granted');
        if (p !== 'granted') return alert('알림이 허용되지 않았어요. 휴대폰 설정에서 허용해 주세요.');
        await enablePush().catch(() => alert('앱을 닫았을 때 오는 알림은 켜지 못했어요. 앱을 열어 둔 동안만 알려 줘요.'));
    };
    const disableNotify = () => {
        set('notify', false);
        disablePush().catch(() => {});
    };

    return (
        <>
            <PageTitle>설정</PageTitle>
            <div className="space-y-3">
                {!standalone && (
                    <Card title="📲 앱처럼 설치하기">
                        <p className="text-[14px] text-[#4e5968] dark:text-[#c5cad1] leading-6">
                            {isIOS ? (
                                <>
                                    Safari 아래쪽 <b>공유 버튼(□↑)</b> → <b>홈 화면에 추가</b>를 누르세요. 홈 화면 아이콘으로 열면 전체 화면으로 열리고 알림도 받을 수 있어요.
                                </>
                            ) : (
                                <>
                                    Chrome 오른쪽 위 <b>⋮ 메뉴</b> → <b>앱 설치</b>(또는 홈 화면에 추가)를 누르세요.
                                </>
                            )}
                        </p>
                    </Card>
                )}

                <Card title="사용 방식">
                    <label className={label}>모드</label>
                    <div className="flex gap-2">
                        <Chip active={s.mode === 'plan'} onClick={() => set('mode', 'plan')}>
                            계획형 (ISTJ식)
                        </Chip>
                        <Chip active={s.mode === 'explore'} onClick={() => set('mode', 'explore')}>
                            탐험형 (ENTP식)
                        </Chip>
                    </div>
                    <p className="text-[12px] text-[#8b95a1] mt-1.5">
                        {s.mode === 'plan' ? '계획 대비 실제, 루틴, 마감 점검을 앞에 보여 줘요.' : '빠른 캡처, 할 일 뽑기, 방치 알림, 챌린지를 앞에 보여 줘요.'}
                    </p>
                    <label className={label}>화면</label>
                    <div className="flex gap-2">
                        {(
                            [
                                ['system', '기기 설정'],
                                ['light', '밝게'],
                                ['dark', '어둡게'],
                            ] as const
                        ).map(([v, l]) => (
                            <Chip key={v} active={s.theme === v} onClick={() => set('theme', v)}>
                                {l}
                            </Chip>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-2">
                        <NumField label="동시에 읽는 책 한도" value={s.wipLimit} onChange={(v) => set('wipLimit', Math.max(1, v))} />
                        <NumField label="하루 마감 시각(시)" value={s.closeHour} onChange={(v) => set('closeHour', Math.min(23, Math.max(0, v)))} />
                        <NumField label="방치 알림 (일)" value={s.staleDays} onChange={(v) => set('staleDays', Math.max(1, v))} />
                        <NumField label="뽀모도로 집중(분)" value={s.focusMin} onChange={(v) => set('focusMin', Math.max(1, v))} />
                        <NumField label="뽀모도로 휴식(분)" value={s.breakMin} onChange={(v) => set('breakMin', Math.max(1, v))} />
                    </div>
                </Card>

                {sb && <SyncCard />}

                <Card title="과목·분류">
                    <ListField label="공부 과목 (쉼표로 구분)" value={s.subjects} onChange={(v) => set('subjects', v)} />
                    <ListField label="할 일·습관 분류" value={s.categories} onChange={(v) => set('categories', v)} />
                </Card>

                <Card title="알림">
                    <div className="flex items-center justify-between">
                        <span className="text-[14px]">습관 알림 · 마감 점검 · 뽀모도로</span>
                        {s.notify ? (
                            <Btn small kind="ghost" onClick={disableNotify}>
                                끄기
                            </Btn>
                        ) : (
                            <Btn small onClick={enableNotify}>
                                켜기
                            </Btn>
                        )}
                    </div>
                    <p className="text-[12px] text-[#8b95a1] mt-2">
                        {s.notify && pushOn() ? '앱을 닫아도 알려 줘요.' : pushAvailable() ? '켜면 앱을 닫아도 알려 줘요.' : '앱을 열어 둔 동안 알려 줘요. 동기화에 로그인하면 앱을 닫아도 알려 줘요.'}
                    </p>
                </Card>

                <Card title="백업·내보내기">
                    <p className="text-[13px] text-[#6b7684] mb-3">
                        기록은 이 기기 안에만 저장돼요. 휴대폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업해 주세요.
                        {backupAge === null ? ' 아직 백업한 적이 없어요.' : ` 마지막 백업 ${backupAge}일 전.`}
                    </p>
                    {(backupAge === null || backupAge >= 7) && (data.tasks.length > 0 || data.sessions.length > 0) && <p className="text-[13px] text-[#e42939] mb-3">일주일이 넘었어요. 백업을 권해요.</p>}
                    <div className="grid grid-cols-2 gap-2">
                        <Btn onClick={backup}>백업 파일 받기</Btn>
                        <label className="bg-brand-soft text-brand dark:bg-[#1d2c44] px-4 py-2.5 rounded-xl font-semibold text-center cursor-pointer text-[15px]">
                            백업 불러오기
                            <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
                        </label>
                        <Btn kind="ghost" className="col-span-2" onClick={csv}>
                            엑셀용 CSV 내보내기 (공부·독서·할 일·습관)
                        </Btn>
                    </div>
                    {importMsg && <p className="text-[13px] mt-2">{importMsg}</p>}
                </Card>

                <Card>
                    <Btn kind="danger" className="w-full" onClick={() => confirm('모든 기록을 지울까요? 되돌릴 수 없어요.') && confirm('정말 지울까요? 백업을 먼저 받는 걸 권해요.') && replaceAll(emptyData())}>
                        모든 기록 지우기
                    </Btn>
                </Card>
            </div>
        </>
    );
}

function NumField({ label: l, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label className={label}>{l}</label>
            <input type="number" inputMode="numeric" className={inputCls} defaultValue={value} onBlur={(e) => Number(e.target.value) !== value && onChange(Number(e.target.value) || 0)} />
        </div>
    );
}

function ListField({ label: l, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
    return (
        <div>
            <label className={label}>{l}</label>
            <input
                className={inputCls}
                defaultValue={value.join(', ')}
                onBlur={(e) => {
                    const v = [...new Set(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))];
                    if (v.length && v.join() !== value.join()) onChange(v);
                }}
            />
        </div>
    );
}

function SyncCard() {
    const st = useSync();
    const email = syncEmail();
    const [input, setInput] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setMsg('');
        try {
            await fn();
        } catch {
            setMsg(step === 'email' ? '코드를 보내지 못했어요. 이메일을 확인하거나 잠시 뒤 다시 해 주세요.' : '코드가 맞지 않거나 시간이 지났어요.');
        }
        setBusy(false);
    };

    if (email)
        return (
            <Card title="🔄 기기 간 동기화">
                <p className="text-[14px]">{email}</p>
                <p className="text-[12px] text-[#8b95a1] mt-1">
                    {st.state === 'syncing' ? '맞추는 중…' : st.state === 'error' ? '동기화하지 못했어요. 인터넷이 되면 다시 해요.' : st.at ? `마지막 동기화 ${new Date(st.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}` : '연결됨'}
                </p>
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <Btn kind="soft" onClick={() => syncNow()} disabled={st.state === 'syncing'}>
                        지금 동기화
                    </Btn>
                    <Btn kind="ghost" onClick={() => confirm('로그아웃할까요? 이 기기의 기록은 그대로 남아요.') && disablePush().catch(() => {}).then(signOut)}>
                        로그아웃
                    </Btn>
                </div>
            </Card>
        );

    return (
        <Card title="🔄 기기 간 동기화">
            <p className="text-[13px] text-[#6b7684]">이메일로 로그인하면 휴대폰·컴퓨터 어디서나 같은 기록을 써요. 지금 이 기기의 기록도 합쳐서 올려요.</p>
            {step === 'email' ? (
                <form className="flex gap-2 mt-3" onSubmit={(e) => (e.preventDefault(), run(async () => (await sendCode(input.trim()), setStep('code'))))}>
                    <input type="email" required autoComplete="email" className={inputCls} placeholder="이메일" value={input} onChange={(e) => setInput(e.target.value)} />
                    <Btn type="submit" className="shrink-0" disabled={busy}>
                        코드 받기
                    </Btn>
                </form>
            ) : (
                <form
                    className="flex gap-2 mt-3"
                    onSubmit={(e) => (
                        e.preventDefault(),
                        run(async () => {
                            await verifyCode(input.trim(), code.trim());
                            await syncNow();
                            // 알림을 켜 둔 기기면 앱이 닫혀도 오게
                            if (getData().settings.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') await enablePush().catch(() => {});
                        })
                    )}
                >
                    <input inputMode="numeric" autoComplete="one-time-code" className={inputCls} placeholder="메일로 온 6자리 코드" value={code} onChange={(e) => setCode(e.target.value)} />
                    <Btn type="submit" className="shrink-0" disabled={busy || !code.trim()}>
                        확인
                    </Btn>
                </form>
            )}
            {step === 'code' && (
                <button type="button" className="text-[12px] text-[#8b95a1] mt-2 underline" onClick={() => setStep('email')}>
                    이메일 다시 입력
                </button>
            )}
            {msg && <p className="text-[13px] text-[#e42939] mt-2">{msg}</p>}
        </Card>
    );
}
