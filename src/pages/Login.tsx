import { useState } from 'react';
import { sb, sendCode, syncNow, verifyCode } from '../lib/sync';
import { enablePush } from '../lib/push';
import { getData } from '../lib/store';
import { Btn, inputCls } from '../components/ui';

// 앱을 켜면 먼저 보이는 화면. 메일로 받은 6자리 코드로 로그인한다
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [step, setStep] = useState<'email' | 'code'>('email');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);

    const run = async (fn: () => Promise<void>, fail: string) => {
        setBusy(true);
        setMsg('');
        try {
            await fn();
        } catch {
            setMsg(fail);
        }
        setBusy(false);
    };
    const send = () =>
        run(async () => {
            await sendCode(email.trim());
            setStep('code');
        }, '코드를 보내지 못했어요. 이메일을 확인하거나 잠시 뒤 다시 해 주세요.');
    const verify = () =>
        run(async () => {
            await verifyCode(email.trim(), code.trim());
            await syncNow();
            // 알림을 켜 둔 기록이면 앱이 닫혀도 오게
            if (getData().settings.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted') await enablePush().catch(() => {});
        }, '코드가 맞지 않거나 시간이 지났어요.');

    return (
        <div className="min-h-dvh safe-top flex items-center">
            <main className="mx-auto w-full max-w-sm px-4">
                <div className="text-center mb-8">
                    <img src="/icon-192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto mb-3" />
                    <h1 className="text-[24px] font-bold">성장일지</h1>
                    <p className="text-[14px] text-[#8b95a1] mt-1">공부·독서·습관을 한곳에서</p>
                </div>
                {!sb ? (
                    <p className="text-[14px] text-[#e42939] text-center">서버 설정이 안 돼 있어요. 관리자에게 Supabase 환경 변수를 확인해 달라고 해 주세요.</p>
                ) : step === 'email' ? (
                    <form className="space-y-2" onSubmit={(e) => (e.preventDefault(), send())}>
                        <input type="email" required autoComplete="email" className={inputCls} placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Btn type="submit" className="w-full" disabled={busy}>
                            로그인 코드 받기
                        </Btn>
                        <p className="text-[12px] text-[#8b95a1] text-center">처음이면 자동으로 가입돼요. 이 기기에 있던 기록도 합쳐서 올려요.</p>
                    </form>
                ) : (
                    <form className="space-y-2" onSubmit={(e) => (e.preventDefault(), verify())}>
                        <p className="text-[14px] text-center">
                            <b>{email}</b>로 보낸 6자리 코드를 넣어 주세요
                        </p>
                        <input inputMode="numeric" autoComplete="one-time-code" className={`${inputCls} text-center tracking-[0.3em]`} placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)} />
                        <Btn type="submit" className="w-full" disabled={busy || !code.trim()}>
                            로그인
                        </Btn>
                        <div className="flex justify-between text-[12px] text-[#8b95a1]">
                            <button type="button" className="underline" onClick={() => (setStep('email'), setCode(''))}>
                                이메일 다시 입력
                            </button>
                            <button type="button" className="underline" disabled={busy} onClick={send}>
                                코드 다시 받기
                            </button>
                        </div>
                    </form>
                )}
                {msg && <p className="text-[13px] text-[#e42939] mt-3 text-center">{msg}</p>}
            </main>
        </div>
    );
}
