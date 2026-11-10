import { useSyncExternalStore } from 'react';
import { createClient, type Session } from '@supabase/supabase-js';
import { emptyData, getData, normalize, replaceAll, subscribe } from './store';
import { mateSummary, mergeData } from './logic';
import { today } from './date';
import type { Data } from './types';

// 로그인하면 기록 전체를 Supabase 한 줄(user_data)에 올리고 내려받는다.
// 키가 없으면 sb = null → 지금처럼 이 기기 안에서만 쓴다.
// 환경 변수가 없으면 이 앱의 Supabase 를 쓴다. 공개용 키라 코드에 둬도 된다 (데이터는 RLS 로 본인 것만 보임)
const env = import.meta.env;
const url = (env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://zgqmzucqboluhyhcdevr.supabase.co') as string;
const key = (env.VITE_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_FrmthbiSFai3642G0fGg6A_lTeQxSo5') as string;
export const sb = url && key ? createClient(url, key) : null;

// base: 마지막으로 맞춘 서버 버전(updated_at), dirty: 아직 못 올린 변경이 있음
const META = 'growth-log:sync';
let meta: { base: string | null; dirty: boolean } = (() => {
    try {
        return JSON.parse(localStorage.getItem(META) ?? '') ?? { base: null, dirty: false };
    } catch {
        return { base: null, dirty: false };
    }
})();
const saveMeta = () => {
    try {
        localStorage.setItem(META, JSON.stringify(meta));
    } catch {
        // 저장 공간 문제는 store 가 이미 알려 준다
    }
};

let session: Session | null = null;
// loading: 저장된 로그인 확인 전, off: 로그인 안 됨
let status: { state: 'loading' | 'off' | 'idle' | 'syncing' | 'error'; at?: string } = { state: sb ? 'loading' : 'off' };
const listeners = new Set<() => void>();
const setStatus = (s: typeof status) => {
    status = s;
    listeners.forEach((l) => l());
};
export const useSync = () =>
    useSyncExternalStore(
        (l) => (listeners.add(l), () => listeners.delete(l)),
        () => status,
    );
export const syncEmail = () => session?.user.email ?? null;
export const syncUserId = () => session?.user.id ?? null;

let applying = false;
function apply(d: Data) {
    applying = true;
    replaceAll(d);
    applying = false;
}

// 한 번에 하나만 돌고, 도는 중에 또 부르면 끝나고 한 번 더
let running: Promise<void> | null = null;
let again = false;
function sync(): Promise<void> {
    if (!sb || !session) return Promise.resolve();
    if (running) {
        again = true;
        return running;
    }
    running = (async () => {
        setStatus({ ...status, state: 'syncing' });
        try {
            do {
                again = false;
                await pullThenPush();
            } while (again);
            await publishSummary().catch(() => {}); // 메이트 요약은 실패해도 다음 동기화 때 다시
            setStatus({ state: 'idle', at: new Date().toISOString() });
        } catch {
            setStatus({ ...status, state: 'error' });
        } finally {
            running = null;
        }
    })();
    return running;
}

async function pullThenPush() {
    const { data: row, error } = await sb!.from('user_data').select('data, updated_at').maybeSingle();
    if (error) throw error;
    if (row && row.updated_at !== meta.base) {
        const remote = normalize(row.data as Partial<Data>);
        // 처음 맞출 때(base 없음)는 설정을 서버 쪽으로
        apply(meta.dirty ? { ...mergeData(getData(), remote), ...(meta.base ? {} : { settings: remote.settings }) } : remote);
        meta.base = row.updated_at;
        saveMeta();
    }
    if (!meta.dirty && row) return;
    const wasDirty = meta.dirty;
    meta.dirty = false; // 올리는 사이 생긴 변경은 다시 dirty 가 된다
    const { data: t, error: e2 } = await sb!.rpc('save_data', { p_data: getData(), p_base: meta.base });
    if (e2) {
        meta.dirty = wasDirty || meta.dirty;
        saveMeta();
        throw e2;
    }
    if (t) meta.base = t as string;
    else {
        // 그 사이 다른 기기가 올렸다 → 다시 받아서 합치고 올린다
        meta.dirty = true;
        again = true;
    }
    saveMeta();
}

// 메이트에게 보일 오늘 요약 (mate_profiles). 바뀐 게 없으면 안 올린다
let lastSummary = '';
async function publishSummary() {
    const summary = mateSummary(getData(), today());
    const json = JSON.stringify(summary);
    if (json === lastSummary) return;
    const { error } = await sb!.from('mate_profiles').upsert({ user_id: session!.user.id, summary, updated_at: new Date().toISOString() });
    if (error) throw error;
    lastSummary = json;
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function startSync() {
    if (!sb) return;
    subscribe(() => {
        if (applying) return;
        meta.dirty = true;
        saveMeta();
        clearTimeout(timer);
        timer = setTimeout(sync, 1500);
    });
    sb.auth.onAuthStateChange((event, s) => {
        const was = session;
        session = s;
        if (!s) return setStatus({ state: 'off' });
        if (event === 'SIGNED_IN' && !was) {
            if (!meta.base) meta.dirty = true; // 이 기기의 기록도 합쳐서 올린다
            setTimeout(sync); // 이 콜백 안에서 바로 supabase 를 부르면 멈출 수 있어서 한 박자 뒤에
        } else if (event === 'INITIAL_SESSION') setTimeout(sync);
        else if (status.state === 'off') setStatus({ state: 'idle' });
    });
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && sync());
    addEventListener('online', () => sync());
}

export const syncNow = sync;

export async function sendCode(email: string) {
    const { error } = await sb!.auth.signInWithOtp({ email });
    if (error) throw error;
}
export async function verifyCode(email: string, token: string) {
    const { error } = await sb!.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw error;
}
// 서버에 다 올린 뒤에만 로그아웃하고 이 기기 기록을 비운다 (다음 계정과 섞이지 않게). 못 올렸으면 false
export async function signOut() {
    if (meta.dirty) await sync();
    if (meta.dirty) return false;
    await sb!.auth.signOut();
    meta = { base: null, dirty: false };
    lastSummary = '';
    saveMeta();
    apply(emptyData());
    return true;
}
