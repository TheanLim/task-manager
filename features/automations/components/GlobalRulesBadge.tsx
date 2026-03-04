'use client';

import { Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GlobalRulesBadgeProps {
  className?: string;
}

/**
 * Sky-colored badge indicating a rule is global (applies to all projects).
 * Used in RuleCard, GlobalRuleCard, and execution log rows.
 */
export function GlobalRulesBadge({ className }: GlobalRulesBadgeProps) {
  return (
    <Badge
      variant="secondary"
      aria-label="Global rule — applies to all projects"
      className={cn(
        'bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800 shrink-0',
        className
      )}
    >
      <Globe className="w-3 h-3 mr-1" aria-hidden="true" />
      Global
    </Badge>
  );
}
