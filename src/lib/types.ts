export type Mode = 'plan' | 'explore'; // 계획형(ISTJ식) / 탐험형(ENTP식)

export interface Task {
    id: string;
    title: string;
    date: string | null; // 하기로 한 날 (null 이면 언젠가)
    due?: string | null; // 마감일
    time?: string; // 시작 'HH:MM'
    endTime?: string; // 끝 'HH:MM'
    done: boolean;
    doneAt?: string;
    canceled?: string; // 취소 사유 (포기 기록)
    category?: string;
    planMin?: number; // 예상 시간
    goalId?: string;
    routineId?: string; // 루틴에서 자동으로 생긴 할 일
    moved?: number; // 내일로 미룬 횟수
    createdAt: string;
}

export interface Routine {
    id: string;
    title: string;
    days: number[]; // 0=일 ~ 6=토
    time?: string; // 알바 같은 고정 일정의 시작·끝 'HH:MM'
    endTime?: string;
    category?: string;
    planMin?: number;
    since: string; // 이날부터 자동 생성
}

export interface HabitCheck {
    note?: string;
    late?: boolean; // 나중에 채운 기록
}

export interface Habit {
    id: string;
    name: string;
    perWeek: number; // 7 이면 매일
    reminder?: string; // 'HH:MM'
    category?: string;
    checks: Record<string, HabitCheck>;
    archived?: boolean;
    createdAt: string;
}

export interface Session {
    id: string;
    subject: string;
    date: string;
    start: string; // ISO
    minutes: number;
    kind: 'pomodoro' | 'stopwatch' | 'manual';
}

export interface TimerState {
    kind: 'pomodoro' | 'stopwatch';
    subject: string;
    startedAt: number; // ms
    phase: 'focus' | 'break';
    focusMin: number;
    breakMin: number;
    round: number;
}

export type BookStatus = 'want' | 'reading' | 'paused' | 'done' | 'dropped';
export interface BookNote {
    id: string;
    kind: 'quote' | 'memo' | 'question';
    page?: number;
    text: string;
    date: string;
}
export interface Book {
    id: string;
    title: string;
    author?: string;
    cover?: string;
    isbn?: string;
    pages: number;
    current: number;
    status: BookStatus;
    rating?: number;
    startedAt?: string;
    finishedAt?: string;
    dropReason?: string;
    lastTouched: string;
    notes: BookNote[];
    progress: { date: string; page: number }[];
}

export type GoalPeriod = 'year' | 'month' | 'week';
export interface Goal {
    id: string;
    title: string;
    period: GoalPeriod;
    key: string; // '2026' | '2026-11' | 주 시작일
    done: boolean;
    dropped?: string; // 포기 사유
    note?: string;
    history: { date: string; text: string }[]; // 변경 이력
    createdAt: string;
}

export interface Capture {
    id: string;
    text: string;
    date: string;
    status: 'inbox' | 'task' | 'kept' | 'archived';
}

export interface DayLog {
    line?: string;
    mood?: number; // 1~5
}

// 영단어 간격 복습: 맞히면 lv 이 올라 복습 간격이 늘고, 틀리면 0 으로
export interface WordState {
    lv: number;
    due: string; // 다음 복습일
    wrong: number; // 누적 틀린 횟수
}
export interface WordLog {
    days: number[]; // 이날 테스트 통과한 DAY (0부터)
    count: number; // 이날 푼 문제 수
}

export interface Settings {
    mode: Mode;
    theme: 'system' | 'light' | 'dark';
    wipLimit: number; // 동시에 읽는 책·진행 목표 수 제한
    closeHour: number; // 마감 점검 시각
    staleDays: number; // 이만큼 그대로면 방치 알림
    focusMin: number;
    breakMin: number;
    subjects: string[];
    categories: string[];
    lastBackup?: string;
    notify: boolean;
    nickname: string; // 메이트에게 보이는 이름
    shareTasks: boolean; // 메이트에게 오늘 할 일 목록도 보여 줌
}

export interface Data {
    version: 1;
    tasks: Task[];
    routines: Routine[];
    habits: Habit[];
    sessions: Session[];
    timer: TimerState | null;
    plans: Record<string, Record<string, number>>; // 날짜 → 과목 → 계획 분
    books: Book[];
    goals: Goal[];
    captures: Capture[];
    days: Record<string, DayLog>;
    reviews: Record<string, Record<string, string>>; // 주 시작일 → 질문 → 답
    words: Record<string, WordState>; // 영단어 → 암기 상태
    wordLog: Record<string, WordLog>; // 날짜 → 그날 영단어 공부
    settings: Settings;
}
