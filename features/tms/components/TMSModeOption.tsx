import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { tmsCopy } from '../copy/tms-copy';

interface TMSModeOptionProps {
  id: 'none' | 'af4' | 'dit' | 'fvp' | 'standard';
  isSelected: boolean;
  isFocused: boolean;
  keyHint: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}

const DISPLAY_NAME_MAP: Record<TMSModeOptionProps['id'], 'None' | 'AF4' | 'DIT' | 'FVP' | 'Standard'> = {
  none: 'None',
  af4: 'AF4',
  dit: 'DIT',
  fvp: 'FVP',
  standard: 'Standard',
};

const ACCENT_COLOR_MAP: Record<TMSModeOptionProps['id'], string> = {
  af4: 'bg-violet-500',
  dit: 'bg-amber-500',
  fvp: 'bg-blue-500',
  standard: 'bg-emerald-500',
  none: 'bg-zinc-500',
};

export function TMSModeOption({
  id,
  isSelected,
  isFocused,
  keyHint,
  onSelect,
  onFocus,
}: TMSModeOptionProps) {
  const displayName = DISPLAY_NAME_MAP[id];
  const { name, description } = tmsCopy.popover.options[displayName];
  const accentColor = ACCENT_COLOR_MAP[id];

  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        'flex items-center gap-3 px-3 py-2 cursor-pointer select-none rounded',
        isFocused && 'bg-zinc-800',
      )}
      onClick={() => onSelect(id)}
      onMouseEnter={() => onFocus(id)}
    >
      {/* Colored dot — visible only when selected */}
      <span
        className={cn(
          'shrink-0 w-2 h-2 rounded-full',
          isSelected ? accentColor : 'bg-transparent',
        )}
      />

      {/* Name + description */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-100">{name}</div>
        <div className="text-xs text-zinc-400 truncate">{description}</div>
      </div>

      {/* Key hint or checkmark */}
      {isSelected ? (
        <Check size={14} className="text-blue-400 shrink-0" />
      ) : (
        <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded shrink-0">
          {keyHint}
        </span>
      )}
    </div>
  );
}
