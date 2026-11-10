// 지금 보낼 알림 [중복 방지 키, 문구]. 앱(열려 있을 때)과 서버 푸시가 같이 쓴다.
// Deno 서버 함수에서도 돌아야 해서 다른 파일을 import 하지 않는다.
interface RemindData {
    habits: { id: string; name: string; archived?: boolean; reminder?: string; checks: Record<string, unknown> }[];
    tasks: { date: string | null; done: boolean; canceled?: string }[];
    settings: { closeHour: number };
}

// day: 'YYYY-MM-DD', hm: 'HH:MM' (사용자 시간대 기준)
export function reminders(d: RemindData, day: string, hm: string): [string, string][] {
    const msgs: [string, string][] = [];
    d.habits.forEach((h) => !h.archived && h.reminder === hm && !h.checks[day] && msgs.push([`habit:${h.id}:${day}`, `⏰ ${h.name} 할 시간이에요`]));
    if (hm === `${String(d.settings.closeHour).padStart(2, '0')}:00`) {
        const left = d.tasks.filter((t) => t.date === day && !t.done && !t.canceled).length;
        if (left) msgs.push([`close:${day}`, `🌙 오늘 못 끝낸 할 일 ${left}개를 정리해 주세요`]);
    }
    return msgs;
}

// 뽀모도로 단계가 (now - 1분, now] 사이에 끝났으면 문구 (서버가 1분마다 확인)
export function timerDone(t: { kind: string; subject: string; startedAt: number; phase: string; focusMin: number; breakMin: number } | null, now: number): string | null {
    if (!t || t.kind !== 'pomodoro') return null;
    const end = t.startedAt + (t.phase === 'focus' ? t.focusMin : t.breakMin) * 60000;
    if (end > now || end <= now - 60000) return null;
    return t.phase === 'focus' ? `${t.subject} ${t.focusMin}분 집중 끝! 쉬어요` : '쉬는 시간 끝, 다시 집중!';
}

// 시간대에 맞춘 날짜와 시각
export function localNow(now: Date, tz: string) {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .formatToParts(now)
            .map((x) => [x.type, x.value]),
    );
    return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
