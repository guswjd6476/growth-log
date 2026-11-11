import DAYS from '../data/wordmaster.json';
import type { Data, WordLog } from './types';
import { addDays } from './date';

export type Word = [string, string]; // [영단어, 뜻]
export const WORD_DAYS = DAYS as Word[][];
export const ALL_WORDS = WORD_DAYS.flat();
export const PER_DAY = 2; // 하루 2 DAY
export const PASS = 0.8; // 테스트 통과 기준
const GAP = [1, 1, 3, 7, 14, 30, 60]; // lv 별 다음 복습까지 날 수

export const dayName = (i: number) => `DAY ${String(i + 1).padStart(2, '0')}`;
export const shuffle = <T>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

export const passedDays = (d: Data) => new Set(Object.values(d.wordLog).flatMap((l) => l.days));

// 오늘 할 DAY: 오늘 통과한 것 + 아직 통과 못 한 DAY 중 앞에서부터, 합쳐 PER_DAY 개
export function todayDays(d: Data, day: string): number[] {
    const done = d.wordLog[day]?.days ?? [];
    const passed = passedDays(d);
    const rest = WORD_DAYS.map((_, i) => i).filter((i) => !passed.has(i));
    return [...done, ...rest].slice(0, Math.max(PER_DAY, done.length));
}

// 한 문제 채점. 복습일 전에 또 맞힌 건 레벨을 올리지 않는다 (같은 날 여러 번 풀어 레벨 부풀리기 방지)
export function grade(d: Data, w: string, ok: boolean, day: string) {
    const s = d.words[w];
    if (ok && s && s.due > day) return;
    const lv = ok ? Math.min((s?.lv ?? 0) + 1, GAP.length - 1) : 0;
    d.words[w] = { lv, due: addDays(day, GAP[lv]), wrong: (s?.wrong ?? 0) + (ok ? 0 : 1) };
}

// 테스트 한 번 끝: 문제 수 기록, 통과했으면 DAY 기록
export function finishTest(d: Data, day: string, count: number, passDays: number[]) {
    const l: WordLog = d.wordLog[day] ?? { days: [], count: 0 };
    d.wordLog[day] = { days: [...new Set([...l.days, ...passDays])], count: l.count + count };
}

export const dueWords = (d: Data, day: string) => ALL_WORDS.filter(([w]) => d.words[w] && d.words[w].due <= day);
export const knownCount = (d: Data) => Object.values(d.words).filter((s) => s.lv > 0).length;
// 오답노트: 지금 틀린 상태(lv 0)이거나 3번 이상 틀린 단어, 많이 틀린 순
export const wrongWords = (d: Data) =>
    ALL_WORDS.filter(([w]) => d.words[w]?.wrong && (d.words[w].lv === 0 || d.words[w].wrong >= 3)).sort((a, b) => d.words[b[0]].wrong - d.words[a[0]].wrong);

export function wordStreak(log: Record<string, WordLog>, day: string) {
    let d = log[day] ? day : addDays(day, -1);
    let n = 0;
    while (log[d]) (n++, (d = addDays(d, -1)));
    return n;
}

// 보기 4개: 정답 + 다른 단어 뜻 3개
export function choices(w: Word, key: 0 | 1): string[] {
    const out = new Set([w[key]]);
    while (out.size < 4) out.add(ALL_WORDS[Math.floor(Math.random() * ALL_WORDS.length)][key]);
    return shuffle([...out]);
}

export const sameSpelling = (typed: string, w: string) => typed.trim().toLowerCase() === w.trim().toLowerCase();
