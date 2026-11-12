import type { Book, Data, Habit, Session, Task } from './types';
import { addDays, daysBetween, lastDays, parseDay, weekStart, yearKey } from './date';
import { knownCount, passedDays, wordStreak } from './vocab';

// 루틴(요일별 고정 할 일)을 그날 할 일로 깔아준다. 바뀐 게 없으면 같은 객체를 돌려준다.
export function ensureRoutineTasks(data: Data, day: string): Data {
    const dow = parseDay(day).getDay();
    const missing = data.routines.filter(
        (r) =>
            r.since <= day &&
            r.days.includes(dow) &&
            !data.tasks.some((t) => t.routineId === r.id && t.date === day),
    );
    if (!missing.length) return data;
    const added: Task[] = missing.map((r) => ({
        id: `r-${r.id}-${day}`, // 기기마다 같은 id → 동기화 때 겹치지 않음
        title: r.title,
        date: day,
        done: false,
        category: r.category,
        planMin: r.planMin,
        routineId: r.id,
        time: r.time,
        endTime: r.endTime,
        createdAt: new Date().toISOString(),
    }));
    return { ...data, tasks: [...data.tasks, ...added] };
}

// 시간 있는 일은 시간 순으로 먼저, 나머지는 그대로
export const byTime = (a: Task, b: Task) => (a.time ?? '99').localeCompare(b.time ?? '99');
export const timeLabel = (t: { time?: string; endTime?: string }) => (t.time ? `⏰ ${t.time}${t.endTime ? `~${t.endTime}` : ''}` : '');

// ── 습관 ──
export const habitWeekCount = (h: Habit, day: string) => {
    const start = weekStart(day);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => h.checks[d]).length;
};

// 연속 기록: 매일 습관은 연속 일수, 주 n회 습관은 목표를 채운 연속 주 수
export function habitStreak(h: Habit, day: string): number {
    if (h.perWeek >= 7) {
        let d = h.checks[day] ? day : addDays(day, -1);
        let n = 0;
        while (h.checks[d]) {
            n++;
            d = addDays(d, -1);
        }
        return n;
    }
    let wk = weekStart(day);
    if (habitWeekCount(h, wk) < h.perWeek) wk = addDays(wk, -7); // 이번 주는 아직 진행 중
    let n = 0;
    while (habitWeekCount(h, wk) >= h.perWeek) {
        n++;
        wk = addDays(wk, -7);
    }
    return n;
}

export const habitRate = (h: Habit, days: string[]) => {
    const live = days.filter((d) => d >= h.createdAt.slice(0, 10));
    if (!live.length) return 0;
    const target = (live.length * Math.min(h.perWeek, 7)) / 7;
    return Math.min(1, live.filter((d) => h.checks[d]).length / target);
};

// ── 공부 시간 ──
export const minutesOn = (sessions: Session[], day: string) =>
    sessions.filter((s) => s.date === day).reduce((a, s) => a + s.minutes, 0);

export const minutesBySubject = (sessions: Session[], days: string[]) => {
    const set = new Set(days);
    const out: Record<string, number> = {};
    for (const s of sessions) if (set.has(s.date)) out[s.subject] = (out[s.subject] ?? 0) + s.minutes;
    return out;
};

// 계획 대비 실제: 과목별 계획 분과 실제 분, 할 일 계획·완료
export function planVsActual(data: Data, day: string) {
    const plan = data.plans[day] ?? {};
    const actual = minutesBySubject(data.sessions, [day]);
    const subjects = [...new Set([...Object.keys(plan), ...Object.keys(actual)])];
    const rows = subjects.map((s) => ({ subject: s, plan: plan[s] ?? 0, actual: actual[s] ?? 0 }));
    const planMin = rows.reduce((a, r) => a + r.plan, 0);
    const actualMin = rows.reduce((a, r) => a + Math.min(r.actual, r.plan || r.actual), 0);
    const tasks = data.tasks.filter((t) => t.date === day && !t.canceled);
    const done = tasks.filter((t) => t.done).length;
    // 지킨 정도: 공부 계획(넘친 시간은 빼고)과 할 일 완료를 반반
    const parts: number[] = [];
    if (planMin) parts.push(actualMin / planMin);
    if (tasks.length) parts.push(done / tasks.length);
    const rate = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null;
    return { rows, planMin, actualMin: rows.reduce((a, r) => a + r.actual, 0), tasks: tasks.length, done, rate };
}

// ── 방치 알림 (탐험형) ──
export const staleBooks = (books: Book[], day: string, staleDays: number) =>
    books.filter((b) => b.status === 'reading' && daysBetween(b.lastTouched, day) >= staleDays);

export const staleTasks = (tasks: Task[], day: string) =>
    tasks.filter((t) => !t.done && !t.canceled && ((t.moved ?? 0) >= 3 || (t.date && daysBetween(t.date, day) >= 7)));

export const readingCount = (books: Book[]) => books.filter((b) => b.status === 'reading').length;

// ── 게임 요소 ──
export function xpOf(data: Data) {
    const tasks = data.tasks.filter((t) => t.done).length * 10;
    const habits = data.habits.reduce((a, h) => a + Object.keys(h.checks).length, 0) * 5;
    const study = Math.floor(data.sessions.reduce((a, s) => a + s.minutes, 0) / 5);
    const pages = Math.floor(data.books.reduce((a, b) => a + b.current, 0) / 5);
    const books = data.books.filter((b) => b.status === 'done').length * 100;
    return tasks + habits + study + pages + books;
}

// 레벨 n 에 필요한 누적 경험치: 50·(n-1)²
export const levelOf = (xp: number) => {
    const level = Math.floor(Math.sqrt(xp / 50)) + 1;
    const cur = 50 * (level - 1) ** 2;
    const next = 50 * level ** 2;
    return { level, progress: (xp - cur) / (next - cur), toNext: next - xp };
};

export function badges(data: Data, day: string) {
    const totalMin = data.sessions.reduce((a, s) => a + s.minutes, 0);
    const doneBooks = data.books.filter((b) => b.status === 'done').length;
    const bestStreak = Math.max(0, ...data.habits.map((h) => habitStreak(h, day)));
    const list = [
        { name: '첫 완독', ok: doneBooks >= 1 },
        { name: '5권 완독', ok: doneBooks >= 5 },
        { name: '20권 완독', ok: doneBooks >= 20 },
        { name: '공부 10시간', ok: totalMin >= 600 },
        { name: '공부 100시간', ok: totalMin >= 6000 },
        { name: '7일 연속', ok: bestStreak >= 7 },
        { name: '30일 연속', ok: bestStreak >= 30 },
        { name: '할 일 100개', ok: data.tasks.filter((t) => t.done).length >= 100 },
        { name: '회고 4주', ok: Object.keys(data.reviews).length >= 4 },
    ];
    return list;
}

export function records(data: Data, day: string) {
    const byDay: Record<string, number> = {};
    for (const s of data.sessions) byDay[s.date] = (byDay[s.date] ?? 0) + s.minutes;
    const best = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
    const thisWeek = lastDays(7, day).reduce((a, d) => a + (byDay[d] ?? 0), 0);
    const lastWeek = lastDays(7, addDays(day, -7)).reduce((a, d) => a + (byDay[d] ?? 0), 0);
    return { bestDay: best ? { day: best[0], min: best[1] } : null, thisWeek, lastWeek };
}

// 주마다 바뀌는 챌린지
const CHALLENGES = [
    '이번 주는 하루 한 번 15분 집중을 7일 채우기',
    '안 읽던 분야의 책 한 권 시작하기',
    '아이디어 캡처 10개 모으기',
    '매일 공부 과목을 바꿔 가며 해 보기',
    '책 메모에 반박 질문 3개 남기기',
    '아침 첫 30분은 휴대폰 없이 공부',
    '미뤄 둔 할 일 3개 끝내거나 정식으로 포기하기',
    '배운 것 하나를 누군가에게 설명해 보기',
];
export const weeklyChallenge = (day: string) => {
    const n = Math.floor(parseDay(weekStart(day)).getTime() / (7 * 86400000));
    return CHALLENGES[((n % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
};

// 책 메모에 띄울 생각 질문 (토론형 독서)
export const BOOK_QUESTIONS = [
    '이 주장에 반박한다면 어떤 근거를 댈까?',
    '저자가 일부러 빼놓은 관점은 무엇일까?',
    '이 내용을 내 일에 바로 써 본다면?',
    '정반대 결론을 내린 사람은 어떻게 말할까?',
    '이 책을 한 문장으로 줄이면?',
    '전에 읽은 책과 부딪히는 지점은?',
    '이게 틀렸다면 어떤 일이 일어나야 할까?',
];

// ── 연결 (#태그) ──
export const tagsIn = (text: string) => [...new Set((text.match(/#[^\s#.,!?)]+/g) ?? []).map((t) => t.slice(1)))];

export interface TagItem {
    source: '캡처' | '책 메모' | '일기' | '할 일';
    text: string;
    date: string;
    sub?: string;
}
export function tagIndex(data: Data) {
    const map: Record<string, TagItem[]> = {};
    const add = (text: string, item: TagItem) => tagsIn(text).forEach((t) => (map[t] ??= []).push(item));
    data.captures.forEach((c) => add(c.text, { source: '캡처', text: c.text, date: c.date }));
    data.books.forEach((b) =>
        b.notes.forEach((n) => add(n.text, { source: '책 메모', text: n.text, date: n.date, sub: b.title })),
    );
    Object.entries(data.days).forEach(([d, l]) => l.line && add(l.line, { source: '일기', text: l.line, date: d }));
    data.tasks.forEach((t) => add(t.title, { source: '할 일', text: t.title, date: t.date ?? t.createdAt.slice(0, 10) }));
    return map;
}

// ── 연간 장부 (계획형) ──
export function yearLedger(data: Data, year: string) {
    const inYear = (d?: string | null) => !!d && yearKey(d) === year;
    return {
        books: data.books.filter((b) => b.status === 'done' && inYear(b.finishedAt)),
        studyMin: data.sessions.filter((s) => inYear(s.date)).reduce((a, s) => a + s.minutes, 0),
        tasksDone: data.tasks.filter((t) => t.done && inYear(t.doneAt)).length,
        habitChecks: data.habits.reduce((a, h) => a + Object.keys(h.checks).filter((d) => inYear(d)).length, 0),
        dropped: [
            ...data.books.filter((b) => b.status === 'dropped' && inYear(b.lastTouched)).map((b) => `책 · ${b.title}`),
            ...data.tasks.filter((t) => t.canceled && inYear(t.date)).map((t) => `할 일 · ${t.title}`),
            ...data.goals.filter((g) => g.dropped && g.key.startsWith(year)).map((g) => `목표 · ${g.title}`),
        ],
    };
}

// ── 내보내기 ──
export const toCSV = (rows: Record<string, unknown>[]) => {
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const cell = (v: unknown) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // 엑셀이 한글을 깨지 않게 BOM
    return '﻿' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
};

// ── 기기 간 동기화 ──
// 두 기기 기록 합치기: 같은 id면 이 기기 것을 쓰고, 습관 체크는 양쪽 다 살린다
// shortcut: 다른 기기에서 지운 항목이 이 기기에 남아 있으면 되살아남, 항목마다 수정 시각을 두면 해결
export function mergeData(local: Data, remote: Data): Data {
    const byId = <T extends { id: string }>(r: T[], l: T[]) => [...new Map([...r, ...l].map((x) => [x.id, x])).values()];
    const habits = byId(remote.habits, local.habits).map((h) => {
        const r = remote.habits.find((x) => x.id === h.id);
        return r ? { ...h, checks: { ...r.checks, ...h.checks } } : h;
    });
    return {
        ...remote,
        ...local,
        tasks: byId(remote.tasks, local.tasks),
        routines: byId(remote.routines, local.routines),
        habits,
        sessions: byId(remote.sessions, local.sessions),
        books: byId(remote.books, local.books),
        goals: byId(remote.goals, local.goals),
        captures: byId(remote.captures, local.captures),
        plans: { ...remote.plans, ...local.plans },
        days: { ...remote.days, ...local.days },
        reviews: { ...remote.reviews, ...local.reviews },
        words: { ...remote.words, ...local.words },
        wordLog: { ...remote.wordLog, ...local.wordLog },
    };
}

// ── 공부 메이트 ──
// 메이트에게 올리는 오늘 요약. 할 일 제목은 shareTasks 를 켰을 때만 넣는다
export interface MateSummary {
    name: string;
    day: string; // 이 요약을 만든 날
    streak: number; // 공부(집중 기록)나 할 일 완료가 이어진 날 수
    last: string; // 연속이 끝난 날 (오늘 또는 어제여야 살아 있음)
    todayMin: number;
    weekMin: number;
    done: number;
    total: number;
    tasks?: { title: string; done: boolean }[];
    words?: MateWords; // 예전 버전 앱이 올린 요약엔 없음
    books?: MateBooks; // shareBooks 를 켰을 때만
}

// 메이트에게 보이는 책장: 읽는 중인 책과 최근 완독 책(독후감 포함)
export interface MateBooks {
    yearDone: number;
    reading: { title: string; author?: string; cover?: string; pct: number }[];
    done: { title: string; author?: string; cover?: string; rating?: number; review?: string; finishedAt?: string }[];
}

// 요약은 매번 통째로 올라가니 개수와 독후감 길이를 줄여 둔다
function mateBooks(data: Data, day: string): MateBooks {
    const pick = ({ title, author, cover }: Book) => ({ title, author, cover });
    return {
        yearDone: data.books.filter((b) => b.status === 'done' && b.finishedAt?.startsWith(day.slice(0, 4))).length,
        reading: data.books
            .filter((b) => b.status === 'reading')
            .slice(0, 5)
            .map((b) => ({ ...pick(b), pct: b.pages > 0 ? Math.min(100, Math.round((b.current / b.pages) * 100)) : 0 })),
        done: data.books
            .filter((b) => b.status === 'done')
            .sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))
            .slice(0, 6)
            .map((b) => ({ ...pick(b), rating: b.rating, review: b.review?.slice(0, 300), finishedAt: b.finishedAt })),
    };
}

// 메이트끼리 비교하는 영단어 기록
export interface MateWords {
    known: number; // 외운 단어
    days: number; // 통과한 DAY
    today: number; // 오늘 푼 문제
    week: number; // 이번 주 푼 문제
    streak: number;
    last: string;
}

function mateWords(data: Data, day: string): MateWords {
    const log = data.wordLog;
    const wk = weekStart(day);
    return {
        known: knownCount(data),
        days: passedDays(data).size,
        today: log[day]?.count ?? 0,
        week: Object.entries(log).reduce((a, [d, l]) => a + (d >= wk && d <= day ? l.count : 0), 0),
        streak: wordStreak(log, day),
        last: log[day] ? day : addDays(day, -1),
    };
}

export function mateSummary(data: Data, day: string): MateSummary {
    const active = new Set([...data.sessions.filter((s) => s.minutes > 0).map((s) => s.date), ...data.tasks.flatMap((t) => (t.done && t.doneAt ? [t.doneAt] : []))]);
    const last = active.has(day) ? day : addDays(day, -1);
    let streak = 0;
    for (let d = last; active.has(d); d = addDays(d, -1)) streak++;
    const wk = weekStart(day);
    const todays = data.tasks.filter((t) => t.date === day && !t.canceled);
    return {
        name: data.settings.nickname.trim() || '이름 없음',
        day,
        streak,
        last,
        todayMin: minutesOn(data.sessions, day),
        weekMin: data.sessions.filter((s) => s.date >= wk && s.date <= day).reduce((a, s) => a + s.minutes, 0),
        done: todays.filter((t) => t.done).length,
        total: todays.length,
        ...(data.settings.shareTasks ? { tasks: todays.map((t) => ({ title: t.title, done: t.done })) } : {}),
        words: mateWords(data, day),
        ...(data.settings.shareBooks ? { books: mateBooks(data, day) } : {}),
    };
}

// 메이트가 며칠 전에 올린 요약을 오늘 기준으로 맞춘다 (날이 바뀌면 오늘 칸은 비우고, 연속은 어제까지 했을 때만)
export function mateToday(s: MateSummary, day: string): MateSummary {
    const streak = s.last >= addDays(day, -1) ? s.streak : 0;
    const sameWeek = weekStart(s.day) === weekStart(day);
    const w = s.words && {
        ...s.words,
        streak: s.words.last >= addDays(day, -1) ? s.words.streak : 0,
        ...(s.day === day ? {} : { today: 0, week: sameWeek ? s.words.week : 0 }),
    };
    if (s.day === day) return { ...s, streak, ...(w && { words: w }) };
    return { ...s, streak, todayMin: 0, done: 0, total: 0, tasks: s.tasks && [], weekMin: sameWeek ? s.weekMin : 0, ...(w && { words: w }) };
}

// 읽고 싶은 책 목표: 그 책을 다 읽으면 걸린 목표를 달성으로 (d 를 직접 고친다)
export function finishBookGoals(d: Data, bookId: string, day: string) {
    d.goals.forEach((g) => {
        if (g.bookId !== bookId || g.done || g.dropped) return;
        g.done = true;
        g.history.push({ date: day, text: '책을 다 읽어서 달성' });
    });
}
