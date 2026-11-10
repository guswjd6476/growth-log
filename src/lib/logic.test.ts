import { describe, expect, it } from 'vitest';
import { emptyData } from './store';
import {
    ensureRoutineTasks,
    habitStreak,
    levelOf,
    mergeData,
    planVsActual,
    staleBooks,
    tagIndex,
    tagsIn,
    toCSV,
} from './logic';
import { addDays, weekStart } from './date';
import { localNow, reminders, timerDone } from '../../supabase/functions/_shared/reminders';
import type { Book, Habit } from './types';

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
