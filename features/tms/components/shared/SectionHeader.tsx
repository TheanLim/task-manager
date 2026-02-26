import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface SectionHeaderProps {
  icon?: React.ReactNode;
  title: string;
  count?: number;
  countVariant?: 'default' | 'secondary' | 'amber' | 'slate';
  hint?: string;
  rightSlot?: React.ReactNode;
  className?: string;
  titleClassName?: string;
}

const countVariantClasses: Record<NonNullable<SectionHeaderProps['countVariant']>, string> = {
  default:   'bg-[rgba(13,148,136,0.12)] text-teal-400 border border-[rgba(13,148,136,0.2)] text-[11px] font-semibold',
  secondary: 'bg-muted text-muted-foreground border-transparent text-[11px] font-semibold',
  amber:     'bg-[rgba(245,158,11,0.12)] text-amber-500 border border-[rgba(245,158,11,0.2)] text-[11px] font-semibold',
  slate:     'bg-[rgba(100,116,139,0.12)] text-slate-500 border border-[rgba(100,116,139,0.2)] text-[11px] font-semibold',
};

export function SectionHeader({
  icon,
  title,
  count,
  countVariant = 'default',
  hint,
  rightSlot,
  className,
  titleClassName,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-2 mb-3', className)}>
      {icon}
      <h3 className={cn("text-[13px] font-bold text-muted-foreground uppercase tracking-[0.6px]", titleClassName)}>{title}</h3>
      {count !== undefined && (
        <Badge className={countVariantClasses[countVariant]}>
          {count}
        </Badge>
      )}
      {hint && (
        <span className="text-xs text-muted-foreground ml-1">{hint}</span>
      )}
      {rightSlot && <div className="ml-auto">{rightSlot}</div>}
    </div>
  );
}
