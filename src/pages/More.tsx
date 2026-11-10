import { go, type Route } from '../lib/nav';
import { useData } from '../lib/store';
import { badges, levelOf, xpOf } from '../lib/logic';
import { today } from '../lib/date';
import { Bar, Card, PageTitle } from '../components/ui';

const ITEMS: [Route, string, string, string][] = [
    ['habits', '🔥', '습관', '매일·주 n회 체크, 연속 기록, 잔디'],
    ['goals', '🎯', '목표', '연·월·주 목표와 진행률, 변경 이력'],
    ['journal', '📝', '기록', '캡처함, 일기, 주간 회고, #태그 연결'],
    ['stats', '📊', '통계', '공부 시간, 습관 달성률, 독서량, 연간 장부'],
    ['settings', '⚙️', '설정', '모드, 과목·분류, 알림, 백업·내보내기'],
];

export default function MorePage() {
    const data = useData();
    const xp = xpOf(data);
    const lv = levelOf(xp);
    const got = badges(data, today()).filter((b) => b.ok);
    return (
        <>
            <PageTitle>더보기</PageTitle>
            <div className="space-y-3">
                <Card>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-[13px] text-[#8b95a1]">경험치 {xp}</div>
                            <div className="text-[22px] font-bold">Lv.{lv.level}</div>
                        </div>
                        <div className="text-[13px] text-[#8b95a1]">배지 {got.length}개</div>
                    </div>
                    <Bar value={lv.progress} className="mt-2" />
                    {got.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {got.map((b) => (
                                <span key={b.name} className="text-[12px] rounded-full bg-[#fff6e0] text-[#c27c00] px-2.5 py-1 font-semibold">
                                    🏅 {b.name}
                                </span>
                            ))}
                        </div>
                    )}
                </Card>
                <Card className="!p-2">
                    <ul>
                        {ITEMS.map(([r, icon, name, desc]) => (
                            <li key={r}>
                                <button type="button" onClick={() => go(r)} className="w-full flex items-center gap-3 p-3 rounded-xl active:bg-[#f2f4f6] dark:active:bg-[#26292e] text-left">
                                    <span className="text-[22px]">{icon}</span>
                                    <span className="flex-1">
                                        <span className="block text-[15px] font-semibold">{name}</span>
                                        <span className="block text-[12px] text-[#8b95a1]">{desc}</span>
                                    </span>
                                    <span className="text-[#b0b8c1]">›</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Card>
            </div>
        </>
    );
}
