import { useEffect, useState } from 'react';
import { getData, getSaveError, refreshDay, useData } from './lib/store';
import { today } from './lib/date';
import { go, type Route } from './lib/nav';
import { pushOn } from './lib/push';
import { reminders } from '../supabase/functions/_shared/reminders';
import TodayPage from './pages/Today';
import TasksPage from './pages/Tasks';
import FocusPage from './pages/Focus';
import BooksPage from './pages/Books';
import MorePage from './pages/More';
import HabitsPage from './pages/Habits';
import GoalsPage from './pages/Goals';
import JournalPage from './pages/Journal';
import StatsPage from './pages/Stats';
import SettingsPage from './pages/Settings';
import LoginPage from './pages/Login';
import MatesPage from './pages/Mates';
import { syncEmail, useSync } from './lib/sync';

const PAGES: Record<Route, () => React.JSX.Element> = {
    today: TodayPage,
    tasks: TasksPage,
    focus: FocusPage,
    books: BooksPage,
    more: MorePage,
    habits: HabitsPage,
    goals: GoalsPage,
    journal: JournalPage,
    stats: StatsPage,
    settings: SettingsPage,
    mates: MatesPage,
};
const TABS: { route: Route; label: string; icon: string }[] = [
    { route: 'today', label: '오늘', icon: '☀️' },
    { route: 'tasks', label: '할 일', icon: '✅' },
    { route: 'focus', label: '집중', icon: '⏱️' },
    { route: 'books', label: '독서', icon: '📚' },
    { route: 'more', label: '더보기', icon: '☰' },
];
const MORE: Route[] = ['more', 'habits', 'goals', 'journal', 'stats', 'settings', 'mates'];

const readRoute = (): Route => {
    const r = location.hash.replace('#/', '') as Route;
    return r in PAGES ? r : 'today';
};

function useTheme() {
    const theme = useData().settings.theme;
    useEffect(() => {
        const mq = matchMedia('(prefers-color-scheme: dark)');
        const apply = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mq.matches));
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, [theme]);
}

// 앱이 열려 있는 동안: 날짜가 바뀌면 루틴을 깔고, 습관 알림·마감 점검 알림을 띄운다
// 푸시가 켜져 있으면 서버가 보내므로 여기선 띄우지 않는다
function useTicker() {
    useEffect(() => {
        const sent = new Set<string>();
        const tick = async () => {
            refreshDay();
            const d = getData();
            if (!d.settings.notify || pushOn() || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
            const now = new Date();
            const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const msgs = reminders(d, today(), hm);
            for (const [key, body] of msgs) {
                if (sent.has(key)) continue;
                sent.add(key);
                const reg = await navigator.serviceWorker?.getRegistration();
                if (reg) reg.showNotification('성장일지', { body, icon: '/icon-192.png' });
                else new Notification('성장일지', { body });
            }
        };
        tick();
        const id = setInterval(tick, 20000);
        const onVis = () => document.visibilityState === 'visible' && tick();
        document.addEventListener('visibilitychange', onVis);
        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', onVis);
        };
    }, []);
}

export default function App() {
    const [route, setRoute] = useState<Route>(readRoute);
    useTheme();
    useTicker();
    useEffect(() => {
        const on = () => {
            setRoute(readRoute());
            window.scrollTo(0, 0);
        };
        window.addEventListener('hashchange', on);
        return () => window.removeEventListener('hashchange', on);
    }, []);
    useData(); // 저장 오류 문구를 다시 그리려고 구독
    const saveError = getSaveError();
    const Page = PAGES[route];
    const activeTab = MORE.includes(route) ? 'more' : route;
    const sync = useSync();
    if (sync.state === 'loading') return null; // 저장된 로그인 확인 중 (잠깐)
    if (!syncEmail()) return <LoginPage />;

    return (
        <div className="min-h-dvh safe-top">
            <main className="mx-auto max-w-xl px-4 pb-28">
                {saveError && <div className="mt-3 rounded-xl bg-[#ffeeee] text-[#e42939] text-sm p-3">{saveError}</div>}
                <Page />
            </main>
            <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#1b1d21]/95 backdrop-blur rounded-t-[28px] shadow-[0_-4px_24px_rgba(61,139,245,0.10)] dark:shadow-none safe-bottom">
                <div className="mx-auto max-w-xl grid grid-cols-5">
                    {TABS.map((t) => (
                        <button
                            key={t.route}
                            type="button"
                            onClick={() => go(t.route)}
                            aria-current={activeTab === t.route ? 'page' : undefined}
                            className={`flex flex-col items-center gap-1 pt-3 pb-1 text-[11px] font-bold ${
                                activeTab === t.route ? 'text-brand' : 'text-[#b0b8c1] grayscale opacity-70'
                            }`}
                        >
                            <span className="text-[20px] leading-none">{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}
