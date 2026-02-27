'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NoticeAction {
  label: string;
  onClick: () => void;
  variant: 'secondary' | 'ghost-destructive';
}

interface TMSInlineNoticeProps {
  variant: 'info' | 'warning' | 'success';
  message: string;
  autoDismiss?: number;
  onDismiss?: () => void;
  actions?: NoticeAction[];
}

const VARIANT_CONFIG = {
  info: {
    role: 'status' as const,
    ariaLive: 'polite' as const,
    container: 'bg-blue-950/40 border border-blue-700/50 text-blue-200',
    message: 'text-blue-100',
  },
  warning: {
    role: 'alert' as const,
    ariaLive: 'assertive' as const,
    container: 'bg-amber-950/40 border border-amber-700/50 text-amber-200',
    message: 'text-amber-100',
  },
  success: {
    role: 'status' as const,
    ariaLive: 'polite' as const,
    container: 'bg-green-950/40 border border-green-700/50 text-green-200',
    message: 'text-green-100',
  },
} as const;

const ACTION_CLASSES: Record<NoticeAction['variant'], string> = {
  secondary: 'border border-amber-600 text-amber-300 hover:bg-amber-950/50',
  'ghost-destructive': 'border border-zinc-600 text-zinc-300 hover:bg-zinc-800/50',
};

export function TMSInlineNotice({
  variant,
  message,
  autoDismiss,
  onDismiss,
  actions,
}: TMSInlineNoticeProps) {
  const config = VARIANT_CONFIG[variant];

  useEffect(() => {
    if (autoDismiss == null || onDismiss == null) return;
    const id = setTimeout(onDismiss, autoDismiss);
    return () => clearTimeout(id);
  }, [autoDismiss, onDismiss]);

  return (
    <div
      role={config.role}
      aria-live={config.ariaLive}
      className={cn(
        'flex items-start gap-2 rounded-md px-3 py-2 text-sm',
        'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 duration-200',
        config.container,
      )}
    >
      <span className={cn('flex-1', config.message)}>{message}</span>

      {actions && actions.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                ACTION_CLASSES[action.variant],
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
