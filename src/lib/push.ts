import { sb, syncEmail } from './sync';

// 앱이 닫혀 있어도 오는 알림: 이 기기 구독을 서버(push_subs)에 올리면 서버가 1분마다 보낸다.
// 로그인해서 기록이 서버에 있어야 쓸 수 있다.
const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const FLAG = 'growth-log:push';

export const pushAvailable = () => !!(sb && vapid && syncEmail() && 'serviceWorker' in navigator && 'PushManager' in window);

// 켜져 있으면 앱 안 알림은 끈다 (같은 알림이 두 번 오지 않게)
export const pushOn = () => {
    try {
        return localStorage.getItem(FLAG) === '1';
    } catch {
        return false;
    }
};
const setFlag = (on: boolean) => {
    try {
        if (on) localStorage.setItem(FLAG, '1');
        else localStorage.removeItem(FLAG);
    } catch {
        // 플래그를 못 쓰면 앱 안 알림이 같이 올 뿐이다
    }
};

export async function enablePush() {
    if (!pushAvailable()) return false;
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapid }));
    const { error } = await sb!.from('push_subs').upsert({ endpoint: sub.endpoint, sub: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (error) throw error;
    setFlag(true);
    return true;
}

export async function disablePush() {
    setFlag(false);
    const sub = await (await navigator.serviceWorker?.getRegistration())?.pushManager.getSubscription();
    if (!sub) return;
    await sb?.from('push_subs').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
}
