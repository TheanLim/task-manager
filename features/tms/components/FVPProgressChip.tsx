import { tmsCopy } from '../copy/tms-copy';

interface FVPProgressChipProps {
  progress: number;
  total: number;
  isFiltered: boolean;
}

export function FVPProgressChip({ progress, total, isFiltered }: FVPProgressChipProps) {
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      aria-label={`FVP progress: ${progress} of ${total}`}
      className="hidden md:inline-flex items-center gap-1 min-w-[96px] text-xs text-zinc-300"
    >
      {tmsCopy.fvpProgress(progress, total)}
      {isFiltered && <span>(filtered)</span>}
    </span>
  );
}
