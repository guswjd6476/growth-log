import { uid, update } from './store';
import { addDays, today } from './date';
import type { Task } from './types';

export function addTask(t: Partial<Task> & { title: string }) {
    update((d) => {
        d.tasks.push({ id: uid(), date: today(), done: false, createdAt: new Date().toISOString(), ...t });
    });
}

export function toggleTask(id: string) {
    update((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (!t) return;
        t.done = !t.done;
        t.doneAt = t.done ? today() : undefined;
    });
}

export function moveTask(id: string, date: string | null) {
    update((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (!t) return;
        if (t.date && date && date > t.date) t.moved = (t.moved ?? 0) + 1;
        t.date = date;
    });
}

export const moveTomorrow = (id: string) => moveTask(id, addDays(today(), 1));

export function cancelTask(id: string, reason: string) {
    update((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) t.canceled = reason || '사유 없음';
    });
}

export function restoreTask(id: string) {
    update((d) => {
        const t = d.tasks.find((x) => x.id === id);
        if (t) t.canceled = undefined;
    });
}

export function deleteTask(id: string) {
    update((d) => {
        d.tasks = d.tasks.filter((x) => x.id !== id);
    });
}

// 습관 체크. 지난 날을 채우면 '나중에 채움'으로 표시하고 사유를 남긴다
export function toggleHabit(id: string, day: string, note?: string) {
    update((d) => {
        const h = d.habits.find((x) => x.id === id);
        if (!h) return;
        if (h.checks[day]) delete h.checks[day];
        else h.checks[day] = day < today() ? { late: true, note } : {};
    });
}

export function addCapture(text: string) {
    update((d) => {
        d.captures.unshift({ id: uid(), text, date: today(), status: 'inbox' });
    });
}

export function addSession(subject: string, minutes: number, kind: 'pomodoro' | 'stopwatch' | 'manual', date = today()) {
    if (minutes < 1) return;
    update((d) => {
        d.sessions.push({ id: uid(), subject, date, start: new Date().toISOString(), minutes: Math.round(minutes), kind });
    });
}

export function setDayLine(day: string, line: string, mood?: number) {
    update((d) => {
        d.days[day] = { ...(d.days[day] ?? {}), line, ...(mood ? { mood } : {}) };
    });
}
