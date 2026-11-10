export type Route = 'today' | 'tasks' | 'focus' | 'books' | 'more' | 'habits' | 'goals' | 'journal' | 'stats' | 'settings';
export const go = (r: Route) => (location.hash = `#/${r}`);
