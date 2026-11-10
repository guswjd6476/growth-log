import { useEffect, useState, type ReactNode } from 'react';

export function Card({ title, extra, children, className = '' }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <section className={`bg-white dark:bg-[#1b1d21] rounded-[28px] p-5 shadow-[0_6px_24px_rgba(61,139,245,0.08)] dark:shadow-none ${className}`}>
            {(title || extra) && (
                <div className="flex items-center justify-between gap-2 mb-3">
                    {title && <h2 className="text-[17px] font-bold">{title}</h2>}
                    {extra}
                </div>
            )}
            {children}
        </section>
    );
}

export function PageTitle({ children, sub, extra }: { children: ReactNode; sub?: ReactNode; extra?: ReactNode }) {
    return (
        <div className="flex items-end justify-between gap-2 px-1 pt-7 pb-5">
            <div>
                <h1 className="text-[28px] font-extrabold tracking-tight">{children}</h1>
                {sub && <p className="text-[15px] text-[#6b7684] dark:text-[#9aa1aa] mt-1">{sub}</p>}
            </div>
            {extra}
        </div>
    );
}

type BtnKind = 'primary' | 'accent' | 'soft' | 'ghost' | 'danger';
const BTN: Record<BtnKind, string> = {
    primary: 'bg-brand text-white active:brightness-95',
    accent: 'bg-accent text-[#191f28] active:brightness-95',
    soft: 'bg-brand-soft text-brand dark:bg-[#1d2c44]',
    ghost: 'bg-[#f2f4f6] text-[#4e5968] dark:bg-[#26292e] dark:text-[#c5cad1]',
    danger: 'bg-[#ffeeee] text-[#e42939] dark:bg-[#3a1d20]',
};
export function Btn({
    kind = 'primary',
    small,
    className = '',
    ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; small?: boolean }) {
    return (
        <button
            type="button"
            {...p}
            className={`${BTN[kind]} ${small ? 'px-4 py-2 text-[14px]' : 'px-5 py-3 text-[16px]'} rounded-full font-bold disabled:opacity-40 transition ${className}`}
        />
    );
}

export const inputCls =
    'w-full rounded-2xl bg-[#f2f4f6] dark:bg-[#26292e] px-3 py-2.5 outline-none focus:ring-2 focus:ring-brand/40 placeholder:text-[#b0b8c1]';

export function Empty({ children }: { children: ReactNode }) {
    return <p className="text-sm text-[#8b95a1] text-center py-6">{children}</p>;
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
    return (
        <div className={`h-2.5 rounded-full bg-[#f2f4f6] dark:bg-[#26292e] overflow-hidden ${className}`}>
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} />
        </div>
    );
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[13px] font-semibold ${
                active ? 'bg-brand text-white' : 'bg-white border border-[#e5e8eb] text-[#4e5968] dark:bg-[#1b1d21] dark:border-[#33363b] dark:text-[#c5cad1]'
            }`}
        >
            {children}
        </button>
    );
}

// 아래에서 올라오는 입력 창
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto bg-white dark:bg-[#1b1d21] rounded-t-[32px] sm:rounded-[32px] p-6 safe-bottom"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[18px] font-bold">{title}</h3>
                    <button type="button" aria-label="닫기" onClick={onClose} className="text-2xl leading-none text-[#8b95a1] px-2">
                        ×
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

// 이유를 물어보는 창 (포기·취소 기록)
export function useAsk() {
    const [ask, setAsk] = useState<{ title: string; placeholder?: string; resolve: (v: string | null) => void } | null>(null);
    const [text, setText] = useState('');
    const open = (title: string, placeholder?: string) =>
        new Promise<string | null>((resolve) => {
            setText('');
            setAsk({ title, placeholder, resolve });
        });
    const close = (v: string | null) => {
        ask?.resolve(v);
        setAsk(null);
    };
    const node = (
        <Sheet open={!!ask} onClose={() => close(null)} title={ask?.title}>
            <input autoFocus className={inputCls} value={text} placeholder={ask?.placeholder} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && close(text.trim())} />
            <div className="flex gap-2 mt-4">
                <Btn kind="ghost" className="flex-1" onClick={() => close(null)}>
                    그만두기
                </Btn>
                <Btn className="flex-1" onClick={() => close(text.trim())}>
                    확인
                </Btn>
            </div>
        </Sheet>
    );
    return { ask: open, node };
}

// "진행중" 같은 작은 파란 딱지
export function Badge({ children }: { children: ReactNode }) {
    return <span className="inline-block align-middle rounded-lg bg-brand text-white text-[12px] font-bold px-2 py-0.5">{children}</span>;
}

export const label = 'block text-[13px] font-semibold text-[#6b7684] dark:text-[#9aa1aa] mb-1.5 mt-3';
