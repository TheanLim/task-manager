interface PriorityBadgeProps {
  priority: 'high' | 'medium' | 'low' | 'none';
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  if (priority === 'none') return null;

  const styles: Record<Exclude<typeof priority, 'none'>, string> = {
    high: 'bg-destructive/20 text-destructive border border-destructive/30 text-xs rounded-full px-2 py-0.5',
    medium: 'bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs rounded-full px-2 py-0.5',
    low: 'bg-muted text-muted-foreground border border-border text-xs rounded-full px-2 py-0.5',
  };

  const labels: Record<Exclude<typeof priority, 'none'>, string> = {
    high: 'High',
    medium: 'Med',
    low: 'Low',
  };

  return (
    <span className={styles[priority]}>
      {labels[priority]}
    </span>
  );
}
