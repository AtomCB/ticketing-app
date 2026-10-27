const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const month = new Intl.DateTimeFormat('en-US', { month: 'short' });
const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
const fullDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

export const formatPrice = (cents: number) => currency.format(cents / 100);

export function dateParts(iso: string) {
  const date = new Date(iso);
  return {
    month: month.format(date),
    day: date.getDate(),
    weekday: weekday.format(date),
    time: time.format(date),
    full: fullDate.format(date),
  };
}
