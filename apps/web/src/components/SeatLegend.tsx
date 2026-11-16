// The key under the seat map. The swatches are smaller copies of the seat button's three
// looks (see seatClasses in SectionMap.tsx), so keep them in step if the seats change.
const swatch = "block size-4 rounded-t-[6px] rounded-b-[2px]";

const items = [
  { label: "Available", look: "border-2 border-seat" },
  { label: "Your pick", look: "border-2 border-seat-picked bg-marigold" },
  { label: "Taken", look: "bg-sold" },
] as const;

export function SeatLegend() {
  return (
    <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-mute">
      {items.map(({ label, look }) => (
        <li key={label} className="flex items-center gap-2">
          <span aria-hidden="true" className={`${swatch} ${look}`} />
          {label}
        </li>
      ))}
    </ul>
  );
}
