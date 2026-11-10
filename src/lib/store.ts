import { useSyncExternalStore } from 'react';
import type { Data } from './types';
import { ensureRoutineTasks } from './logic';
import { today } from './date';

// 모든 기록은 이 기기 안(localStorage)에 저장한다. 오프라인에서도 그대로 쓴다.
// 로그인하면 sync.ts 가 이 기록을 서버와 맞춘다
const KEY = 'growth-log:v1';

export const emptyData = (): Data => ({
    version: 1,
    tasks: [],
    routines: [],
    habits: [],
    sessions: [],
    timer: null,
    plans: {},
    books: [],
    goals: [],
    captures: [],
    days: {},
    reviews: {},
    settings: {
        mode: 'plan',
        theme: 'system',
        wipLimit: 3,
        closeHour: 22,
        staleDays: 14,
        focusMin: 25,
        breakMin: 5,
        subjects: ['영어', '자격증', '독서', '코딩'],
        categories: ['공부', '독서', '건강', '일'],
        notify: false,
    },
});

// 예전에 저장한 데이터에 새 칸이 없어도 기본값으로 채운다
export const normalize = (raw: Partial<Data>): Data => {
    const base = emptyData();
    return { ...base, ...raw, settings: { ...base.settings, ...(raw.settings ?? {}) } } as Data;
};

function load(): Data {
    try {
        const s = localStorage.getItem(KEY);
        return s ? normalize(JSON.parse(s)) : emptyData();
    } catch {
        return emptyData();
    }
}

let state: Data = ensureRoutineTasks(load(), today());
const listeners = new Set<() => void>();
let saveError = '';

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
        saveError = '';
    } catch {
        saveError = '저장 공간이 부족하거나 저장할 수 없습니다. 설정에서 백업 파일을 내려받아 주세요.';
    }
}

export const getSaveError = () => saveError;

// 고칠 때는 복사본을 바꿔서 넘긴다: update(d => { d.tasks.push(...) })
export function update(fn: (d: Data) => void) {
    const next = structuredClone(state);
    fn(next);
    state = next;
    save();
    listeners.forEach((l) => l());
}

export function replaceAll(d: Data) {
    state = ensureRoutineTasks(normalize(d), today());
    save();
    listeners.forEach((l) => l());
}

// 날짜가 바뀌면 오늘 루틴 할 일을 깔아준다
export function refreshDay() {
    const next = ensureRoutineTasks(state, today());
    if (next !== state) {
        state = next;
        save();
        listeners.forEach((l) => l());
    }
}

export const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
};

export const useData = () => useSyncExternalStore(subscribe, () => state);
export const getData = () => state;

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
