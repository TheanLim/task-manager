import { useRef, useCallback } from 'react';
import { getAllTMSHandlers } from '../registry';
import type { TimeManagementSystemHandler } from '../handlers';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TMSTabBarProps {
  activeSystemId: string;
  onSwitch: (systemId: string) => void;
  /** Shows "resumed" pill on this tab */
  resumedSystemId?: string;
  /** Amber dot on the DIT tab when inbox has tasks */
  inboxCount?: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TMSTabBar({
  activeSystemId,
  onSwitch,
  resumedSystemId,
  inboxCount = 0,
}: TMSTabBarProps) {
  const handlers = getAllTMSHandlers();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const count = handlers.length;
      let next: number | null = null;

      switch (e.key) {
        case 'ArrowRight':
          next = (index + 1) % count;
          break;
        case 'ArrowLeft':
          next = (index - 1 + count) % count;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = count - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSwitch(handlers[index].id);
          return;
        default:
          return;
      }

      if (next !== null) {
        e.preventDefault();
        tabRefs.current[next]?.focus();
      }
    },
    [handlers, onSwitch],
  );

  return (
    <div
      role="tablist"
      aria-label="Time management systems"
      className="flex gap-1 bg-card border border-border rounded-[14px] p-[5px] mb-6 overflow-x-auto scrollbar-none"
    >
      {handlers.map((handler: TimeManagementSystemHandler, index: number) => {
        const isActive = handler.id === activeSystemId;
        const isResumed = resumedSystemId === handler.id;
        const showInboxDot = handler.id === 'dit' && inboxCount > 0;

        return (
          <button
            key={handler.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSwitch(handler.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            title={handler.description}
            className={[
              'flex flex-col items-center px-4 py-3 min-w-fit transition-colors motion-safe:duration-150',
              isActive
                ? 'bg-primary text-white rounded-[10px] shadow-[0_2px_12px_rgba(13,148,136,0.25)]'
                : 'bg-transparent text-muted-foreground rounded-[10px] hover:bg-muted hover:text-foreground',
            ].join(' ')}
          >
            {/* Name row */}
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-semibold">{handler.displayName}</span>

              {/* "Resumed" pill */}
              {isResumed && (
                <span className="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 ml-1">
                  resumed
                </span>
              )}

              {/* DIT inbox amber dot */}
              {showInboxDot && (
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-label="Inbox has tasks" />
              )}
            </span>

            {/* Description — hidden on mobile */}
            <span className={`text-[10px] font-normal hidden sm:block mt-0.5 leading-tight ${isActive ? 'opacity-85' : 'opacity-70'}`}>
              {handler.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}
