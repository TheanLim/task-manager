import { Filter } from 'lucide-react';

export function FilteredBadge() {
  return (
    <span className="hidden md:inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
      <Filter size={12} />
      Filtered
    </span>
  );
}
