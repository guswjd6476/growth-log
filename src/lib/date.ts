// 날짜는 모두 기기 시간 기준 'YYYY-MM-DD' 문자열로 다룬다
const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayKey();

export const parseDay = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number) => {
    const d = parseDay(key);
    d.setDate(d.getDate() + n);
    return dayKey(d);
};

export const daysBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000);

// 한 주는 월요일부터
export const weekStart = (key: string) => {
    const dow = (parseDay(key).getDay() + 6) % 7;
    return addDays(key, -dow);
};

export const monthKey = (key: string) => key.slice(0, 7);
export const yearKey = (key: string) => key.slice(0, 4);

export const lastDays = (n: number, end = today()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
export const weekdayName = (key: string) => WEEKDAY[parseDay(key).getDay()];
export const shortDay = (key: string) => `${Number(key.slice(5, 7))}/${Number(key.slice(8))}`;

export const fmtMin = (min: number) => {
    const m = Math.round(min);
    if (m < 60) return `${m}분`;
    return `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`;
};

// 목표 기간의 키: 올해 '2026', 이번 달 '2026-11', 이번 주 그 주 시작일
export const keyOf = (p: 'year' | 'month' | 'week', day: string) => (p === 'year' ? yearKey(day) : p === 'month' ? monthKey(day) : weekStart(day));
