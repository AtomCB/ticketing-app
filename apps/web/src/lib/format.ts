// Date formatting shared by the event list and (later) the event page.
// Times are shown in the viewer's own time zone; see the note in BUILD_PLAN.md
// about venue time zones if you ever want "8 PM in Chicago" instead.
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const month = new Intl.DateTimeFormat('en-US', { month: 'short' });
const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' });

/** Splits an ISO timestamp into the pieces the ticket card displays. */
export function eventDateParts(iso: string) {
  const date = new Date(iso);
  return {
    weekdayAndTime: `${weekday.format(date)}, ${time.format(date)}`, // "Monday, 8:00 PM"
    month: month.format(date), // "Nov"
    day: day.format(date), // "2"
  };
}
