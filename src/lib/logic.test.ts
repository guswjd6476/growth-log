import { describe, expect, it } from 'vitest';
import { emptyData } from './store';
import { choices, dueWords, finishTest, grade, passedDays, sameSpelling, todayDays, wordStreak } from './vocab';
import {
    byTime,
    ensureRoutineTasks,
    timeLabel,
    habitStreak,
    levelOf,
    mateSummary,
    mateToday,
    mergeData,
    finishBookGoals,
    planVsActual,
    staleBooks,
    tagIndex,
    tagsIn,
    toCSV,
} from './logic';
import { addDays, weekStart } from './date';
import { localNow, reminders, timerDone } from '../../supabase/functions/_shared/reminders';
import type { Book, Habit, Task } from './types';

const habit = (perWeek: number, days: string[]): Habit => ({
    id: 'h',
    name: '운동',
    perWeek,
    checks: Object.fromEntries(days.map((d) => [d, {}])),
    createdAt: '2026-01-01T00:00:00Z',
});

describe('습관 연속 기록', () => {
    it('매일 습관: 오늘 안 했으면 어제까지 이어진 날 수', () => {
        expect(habitStreak(habit(7, ['2026-11-08', '2026-11-09', '2026-11-10']), '2026-11-10')).toBe(3);
        expect(habitStreak(habit(7, ['2026-11-08', '2026-11-09']), '2026-11-10')).toBe(2);
        expect(habitStreak(habit(7, ['2026-11-07']), '2026-11-10')).toBe(0);
    });
    it('주 3회 습관: 목표를 채운 연속 주 (이번 주는 진행 중이면 빼고)', () => {
        const w = weekStart('2026-11-10'); // 11/9 월
        const prev = addDays(w, -7);
        const days = [prev, addDays(prev, 2), addDays(prev, 4), w];
        expect(habitStreak(habit(3, days), '2026-11-10')).toBe(1);
    });
});

describe('루틴', () => {
    it('그날 요일 루틴만 한 번씩 깔고, 다시 불러도 늘지 않음', () => {
        const d = emptyData();
        d.routines.push({ id: 'r', title: '영어 단어', days: [2], since: '2026-11-01' }); // 화
        const a = ensureRoutineTasks(d, '2026-11-10'); // 화요일
        expect(a.tasks).toHaveLength(1);
        expect(ensureRoutineTasks(a, '2026-11-10')).toBe(a);
        expect(ensureRoutineTasks(d, '2026-11-11').tasks).toHaveLength(0);
    });
    it('고정 일정은 시간도 함께 깔리고, 시간 순으로 정렬', () => {
        const d = emptyData();
        d.routines.push({ id: 'job', title: '카페 알바', days: [2], time: '18:00', endTime: '22:00', since: '2026-11-01' });
        const [t] = ensureRoutineTasks(d, '2026-11-10').tasks;
        expect(t).toMatchObject({ time: '18:00', endTime: '22:00' });
        expect(timeLabel(t)).toBe('⏰ 18:00~22:00');
        const tasks = [{ title: '시간 없음' }, t, { title: '아침', time: '09:30' }] as Task[];
        expect(tasks.sort(byTime).map((x) => x.title)).toEqual(['아침', '카페 알바', '시간 없음']);
    });
});

describe('계획 대비 실제', () => {
    it('넘친 공부 시간은 지킨 비율에 넣지 않음, 할 일과 반반', () => {
        const d = emptyData();
        d.plans['2026-11-10'] = { 영어: 60, 코딩: 60 };
        d.sessions.push(
            { id: '1', subject: '영어', date: '2026-11-10', start: '', minutes: 90, kind: 'manual' },
            { id: '2', subject: '코딩', date: '2026-11-10', start: '', minutes: 30, kind: 'manual' },
        );
        d.tasks.push(
            { id: 'a', title: 'x', date: '2026-11-10', done: true, createdAt: '' },
            { id: 'b', title: 'y', date: '2026-11-10', done: false, createdAt: '' },
        );
        const r = planVsActual(d, '2026-11-10');
        expect(r.planMin).toBe(120);
        expect(r.actualMin).toBe(120);
        expect(r.rate).toBeCloseTo((90 / 120 + 0.5) / 2);
    });
    it('계획도 할 일도 없으면 비율 없음', () => {
        expect(planVsActual(emptyData(), '2026-11-10').rate).toBeNull();
    });
});

it('방치된 책: 읽는 중인데 n일 넘게 그대로', () => {
    const b = (lastTouched: string, status: Book['status'] = 'reading') =>
        ({ id: lastTouched, title: 't', pages: 100, current: 1, status, lastTouched, notes: [], progress: [] }) as Book;
    const list = [b('2026-10-20'), b('2026-11-05'), b('2026-10-01', 'done')];
    expect(staleBooks(list, '2026-11-10', 14).map((x) => x.id)).toEqual(['2026-10-20']);
});

it('레벨: 0 → 1레벨, 50 → 2레벨, 200 → 3레벨', () => {
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(49).level).toBe(1);
    expect(levelOf(50).level).toBe(2);
    expect(levelOf(200).level).toBe(3);
});

it('태그: 문장 부호 앞에서 끊고 여러 기록을 묶음', () => {
    expect(tagsIn('오늘 #습관, #독서법 정리. #습관')).toEqual(['습관', '독서법']);
    const d = emptyData();
    d.captures.push({ id: 'c', text: '#습관 아이디어', date: '2026-11-10', status: 'inbox' });
    d.days['2026-11-09'] = { line: '#습관 지킴' };
    expect(tagIndex(d)['습관']).toHaveLength(2);
});

it('CSV: 쉼표·따옴표 감싸기, 한글용 BOM', () => {
    expect(toCSV([{ a: '1,2', b: 'x"y' }])).toBe('﻿a,b\n"1,2","x""y"');
});

describe('동기화 합치기', () => {
    it('양쪽 항목을 모두 살리고, 같은 id는 이 기기 것, 습관 체크는 합친다', () => {
        const local = emptyData();
        const remote = emptyData();
        local.tasks = [{ id: 'a', title: '이 기기 수정', date: null, done: true, createdAt: '' }, { id: 'b', title: 'B', date: null, done: false, createdAt: '' }];
        remote.tasks = [{ id: 'a', title: '옛날', date: null, done: false, createdAt: '' }, { id: 'c', title: 'C', date: null, done: false, createdAt: '' }];
        local.habits = [habit(7, ['2026-11-10'])];
        remote.habits = [habit(7, ['2026-11-09'])];
        remote.days = { '2026-11-09': { line: '어제' } };
        const m = mergeData(local, remote);
        expect(m.tasks.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
        expect(m.tasks.find((t) => t.id === 'a')!.title).toBe('이 기기 수정');
        expect(Object.keys(m.habits[0].checks).sort()).toEqual(['2026-11-09', '2026-11-10']);
        expect(m.days['2026-11-09'].line).toBe('어제');
    });
    it('두 기기가 같은 날 루틴을 깔아도 하나만 남는다', () => {
        const base = { ...emptyData(), routines: [{ id: 'r', title: '영어', days: [0, 1, 2, 3, 4, 5, 6], since: '2026-01-01' }] };
        const a = ensureRoutineTasks(base, '2026-11-10');
        const b = ensureRoutineTasks(base, '2026-11-10');
        expect(mergeData(a, b).tasks).toHaveLength(1);
    });
});

describe('알림', () => {
    it('습관 알림 시각과 마감 점검 시각에 문구를 만든다', () => {
        const d = { ...emptyData(), habits: [{ ...habit(7, []), reminder: '07:30' }], tasks: [{ id: 't', title: 'x', date: '2026-11-10', done: false, createdAt: '' }] };
        expect(reminders(d, '2026-11-10', '07:30')).toHaveLength(1);
        expect(reminders(d, '2026-11-10', '07:31')).toHaveLength(0);
        expect(reminders(d, '2026-11-10', '22:00')[0][1]).toContain('1개');
        d.habits[0].checks['2026-11-10'] = {};
        expect(reminders(d, '2026-11-10', '07:30')).toHaveLength(0);
    });
    it('뽀모도로는 끝난 그 1분 안에만 알린다', () => {
        const t = { kind: 'pomodoro', subject: '영어', startedAt: 0, phase: 'focus', focusMin: 25, breakMin: 5 };
        expect(timerDone(t, 25 * 60000)).toContain('집중 끝');
        expect(timerDone(t, 25 * 60000 - 1)).toBeNull();
        expect(timerDone(t, 26 * 60000)).toBeNull();
    });
    it('시간대에 맞춘 날짜·시각', () => {
        expect(localNow(new Date('2026-11-10T15:05:00Z'), 'Asia/Seoul')).toEqual({ day: '2026-11-11', hm: '00:05' });
    });
});

describe('공부 메이트 요약', () => {
    const day = '2026-11-11'; // 수요일
    const base = () => {
        const d = emptyData();
        d.settings.nickname = '현정';
        d.sessions = [
            { id: 's1', subject: '영어', date: '2026-11-09', start: '', minutes: 30, kind: 'manual' },
            { id: 's2', subject: '영어', date: day, start: '', minutes: 20, kind: 'manual' },
            { id: 's3', subject: '영어', date: '2026-11-01', start: '', minutes: 99, kind: 'manual' }, // 지난주
        ];
        d.tasks = [
            { id: 't1', title: '단어', date: day, done: true, doneAt: day, createdAt: '' },
            { id: 't2', title: '문법', date: day, done: false, createdAt: '' },
            { id: 't3', title: '취소', date: day, done: false, canceled: '바빠서', createdAt: '' },
            { id: 't4', title: '어제', date: '2026-11-10', done: true, doneAt: '2026-11-10', createdAt: '' },
        ];
        return d;
    };
    it('숫자만 올리고, 켜야 할 일 제목을 넣는다', () => {
        const s = mateSummary(base(), day);
        expect(s).toMatchObject({ name: '현정', streak: 3, last: day, todayMin: 20, weekMin: 50, done: 1, total: 2 });
        expect(s.tasks).toBeUndefined();
        const d = base();
        d.settings.shareTasks = true;
        expect(mateSummary(d, day).tasks).toEqual([{ title: '단어', done: true }, { title: '문법', done: false }]);
    });
    it('오늘 아직 안 했으면 어제까지 연속', () => {
        const d = base();
        d.sessions = d.sessions.filter((s) => s.date !== day);
        d.tasks = d.tasks.filter((t) => t.id !== 't1');
        expect(mateSummary(d, day)).toMatchObject({ streak: 2, last: '2026-11-10' });
    });
    it('날이 지난 요약: 오늘 칸은 비우고, 이틀 넘게 쉬면 연속 0', () => {
        const d = base();
        d.settings.shareTasks = true;
        const s = mateSummary(d, day);
        expect(mateToday(s, day)).toEqual(s);
        expect(mateToday(s, '2026-11-12')).toMatchObject({ streak: 3, todayMin: 0, total: 0, weekMin: 50, tasks: [] });
        expect(mateToday(s, '2026-11-13').streak).toBe(0);
        expect(mateToday(s, '2026-11-16').weekMin).toBe(0); // 다음 주
    });
    it('독서 기록은 켰을 때만, 완독은 최근 순으로', () => {
        const d = base();
        const bk = (id: string, status: 'reading' | 'done' | 'want', finishedAt?: string) =>
            ({ id, title: id, pages: 200, current: 50, status, finishedAt, review: 'x'.repeat(500), lastTouched: day, notes: [], progress: [] });
        d.books = [bk('a', 'done', '2025-12-01'), bk('b', 'done', '2026-11-01'), bk('c', 'reading'), bk('d', 'want')];
        expect(mateSummary(d, day).books).toBeUndefined();
        d.settings.shareBooks = true;
        const b = mateSummary(d, day).books!;
        expect(b.yearDone).toBe(1);
        expect(b.reading).toEqual([{ title: 'c', author: undefined, cover: undefined, pct: 25 }]);
        expect(b.done.map((x) => x.title)).toEqual(['b', 'a']);
        expect(b.done[0].review).toHaveLength(300);
    });
    it('영단어 기록도 올리고, 날이 지나면 오늘 칸을 비운다', () => {
        const d = base();
        d.words = { a: { lv: 1, due: day, wrong: 0 }, b: { lv: 0, due: day, wrong: 2 } };
        d.wordLog = { [addDays(day, -1)]: { days: [0], count: 40 }, [day]: { days: [1], count: 50 } };
        const s = mateSummary(d, day);
        expect(s.words).toMatchObject({ known: 1, days: 2, today: 50, streak: 2, last: day });
        expect(mateToday(s, addDays(day, 1)).words).toMatchObject({ today: 0, streak: 2 });
        expect(mateToday(s, addDays(day, 3)).words!.streak).toBe(0);
        expect(mateToday({ ...s, words: undefined }, day).words).toBeUndefined(); // 예전 앱 요약
    });
});

describe('워드마스터 단어', () => {
    it('50일 × 40단어, 빈 칸 없음', async () => {
        const days = (await import('../data/wordmaster.json')).default as string[][][];
        expect(days.length).toBe(50);
        expect(days.every((d) => d.length === 40 && d.every(([w, m]) => w && m))).toBe(true);
        expect(days[0][0]).toEqual(['provide', '공급하다, 준비하다']);
    });
    it('동기화 때 단어 기록을 합친다', () => {
        const a = { ...emptyData(), words: { cat: { lv: 1, due: '2026-11-12', wrong: 0 } } };
        const b = { ...emptyData(), words: { fox: { lv: 0, due: '2026-11-12', wrong: 1 } } };
        expect(Object.keys(mergeData(a, b).words).sort()).toEqual(['cat', 'fox']);
    });
});

describe('영단어 공부', () => {
    const D = '2026-11-11';
    it('하루 2 DAY: 통과 안 한 것부터, 오늘 통과한 건 오늘 목록에 남음', () => {
        const d = emptyData();
        expect(todayDays(d, D)).toEqual([0, 1]);
        finishTest(d, D, 80, [0, 1]);
        expect(todayDays(d, D)).toEqual([0, 1]);
        expect(todayDays(d, '2026-11-12')).toEqual([2, 3]);
        finishTest(d, D, 10, []); // 통과 못 한 테스트는 DAY 를 안 남김
        expect(passedDays(d).size).toBe(2);
    });
    it('간격 복습: 맞히면 간격이 늘고 틀리면 내일 다시, 복습일 전엔 안 오름', () => {
        const d = emptyData();
        grade(d, 'cat', true, D);
        expect(d.words.cat).toEqual({ lv: 1, due: '2026-11-12', wrong: 0 });
        grade(d, 'cat', true, D); // 같은 날 또 맞혀도 그대로
        expect(d.words.cat.lv).toBe(1);
        grade(d, 'cat', true, '2026-11-12');
        expect(d.words.cat).toEqual({ lv: 2, due: '2026-11-15', wrong: 0 });
        grade(d, 'cat', false, '2026-11-15');
        expect(d.words.cat).toEqual({ lv: 0, due: '2026-11-16', wrong: 1 });
        expect(dueWords(d, '2026-11-16')).toHaveLength(0); // 'cat' 은 단어장에 없는 단어
    });
    it('연속 학습일, 보기 4개, 스펠링 비교', () => {
        const log = { '2026-11-09': { days: [], count: 1 }, '2026-11-10': { days: [0], count: 1 } };
        expect(wordStreak(log, D)).toBe(2);
        expect(wordStreak(log, '2026-11-13')).toBe(0);
        const o = choices(['provide', '공급하다, 준비하다'], 1);
        expect(new Set(o).size).toBe(4);
        expect(o).toContain('공급하다, 준비하다');
        expect(sameSpelling(' Provide ', 'provide')).toBe(true);
    });
});

describe('읽고 싶은 책 목표', () => {
    it('그 책의 진행 중 목표만 달성으로 바꾼다', () => {
        const d = emptyData();
        const g = (id: string, bookId?: string, dropped?: string) => ({ id, title: id, period: 'month' as const, key: '2026-11', done: false, bookId, dropped, history: [], createdAt: '' });
        d.goals = [g('a', 'b1'), g('b', 'b2'), g('c', 'b1', '포기'), g('d')];
        finishBookGoals(d, 'b1', '2026-11-12');
        expect(d.goals.map((x) => x.done)).toEqual([true, false, false, false]);
        expect(d.goals[0].history[0].date).toBe('2026-11-12');
    });
});
