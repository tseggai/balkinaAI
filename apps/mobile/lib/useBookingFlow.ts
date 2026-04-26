// Booking flow date helpers — extracted from index.tsx for reuse and testability

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Quick-pick date buttons shown after service selection */
export function getDateButtons(): string[] {
  return ['Today', 'Tomorrow', 'Next Week', 'Pick a date'];
}

/** Monday through Sunday of next week */
export function getNextWeekDays(): string[] {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ...
  const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysUntilNextMonday + i);
    days.push(`${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
  }
  return days;
}

/** Extended date range — 2 weeks out */
export function getPickDateDays(): string[] {
  const today = new Date();
  const days: string[] = [];
  for (let i = 2; i <= 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(`${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
  }
  return days;
}

/** Convert a date button label ("Today", "Tomorrow", "Wed Mar 15") to YYYY-MM-DD */
export function parseDateLabel(label: string): string {
  const today = new Date();
  if (label === 'Today') {
    return today.toISOString().split('T')[0]!;
  }
  if (label === 'Tomorrow') {
    const d = new Date(today);
    d.setDate(today.getDate() + 1);
    return d.toISOString().split('T')[0]!;
  }
  // Parse "Wed Mar 15" style — search up to 30 days out
  for (let i = 2; i <= 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const check = `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
    if (check === label) return d.toISOString().split('T')[0]!;
  }
  return today.toISOString().split('T')[0]!;
}

/** Format YYYY-MM-DD as human-readable (e.g. "Thursday, March 19, 2026") */
export function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/** All valid date button labels (for matching user taps) */
export function getAllDateLabels(): string[] {
  return [...getDateButtons(), ...getNextWeekDays(), ...getPickDateDays()];
}
