export type Route = 'today' | 'tasks' | 'focus' | 'books' | 'more' | 'habits' | 'goals' | 'journal' | 'stats' | 'settings' | 'mates';
export const go = (r: Route) => (location.hash = `#/${r}`);
