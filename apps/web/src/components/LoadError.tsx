import { Button } from './ui/Button';

interface LoadErrorProps {
  /** What failed, e.g. "Couldn't load events". */
  title: string;
  /** What happened and what to do next. */
  message: string;
  onRetry: () => void;
}

/**
 * A failed load with a way to try again. role="alert" makes screen readers announce it
 * as soon as it appears, so if a retry fails too, the new card is announced again.
 */
export function LoadError({ title, message, onRetry }: LoadErrorProps) {
  return (
    <div role="alert" className="rounded-xl border-2 border-rule bg-stock p-7">
      <p className="text-[17px] font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-mute">{message}</p>
      <Button variant="dark" onClick={onRetry} className="mt-4 text-sm">
        Try again
      </Button>
    </div>
  );
}
