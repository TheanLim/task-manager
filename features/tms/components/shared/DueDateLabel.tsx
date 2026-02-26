import { format, isToday, isPast, isSameYear } from 'date-fns';
import { Calendar } from 'lucide-react';

interface DueDateLabelProps {
  dueDate: string | null | undefined;
}

export function DueDateLabel({ dueDate }: DueDateLabelProps) {
  if (!dueDate) return null;

  const date = new Date(dueDate);
  const now = new Date();

  const dateStr = isSameYear(date, now)
    ? format(date, 'MMM d')
    : format(date, 'MMM d, yyyy');

  let className: string;
  if (isToday(date)) {
    className = 'text-xs text-amber-500 flex items-center gap-1 font-medium';
  } else if (isPast(date)) {
    className = 'text-xs text-destructive flex items-center gap-1 font-medium';
  } else {
    className = 'text-xs text-muted-foreground flex items-center gap-1';
  }

  return (
    <span className={className}>
      <Calendar className="h-3 w-3" />
      {dateStr}
    </span>
  );
}
