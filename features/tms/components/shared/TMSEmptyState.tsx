import React from 'react';
import { Button } from '@/components/ui/button';

interface TMSEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function TMSEmptyState({ icon, title, description, action }: TMSEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-[240px]">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
