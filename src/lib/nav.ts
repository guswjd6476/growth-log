export type Route = 'today' | 'tasks' | 'focus' | 'books' | 'more' | 'habits' | 'goals' | 'journal' | 'stats' | 'settings' | 'mates' | 'words';
export const go = (r: Route) => (location.hash = `#/${r}`);
