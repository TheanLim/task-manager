'use client';

import { useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { getAllTMSHandlers } from '../registry';
import type { TimeManagementSystemHandler } from '../handlers';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TMSTabBarProps {
  activeSystemId: string;
  onSwitch: (systemId: string) => void;
  /** Amber dot on the DIT tab when inbox has tasks */
  inboxCount?: number;
}

// ── System icons (inline SVG-like indicators) ─────────────────────────────────

const SYSTEM_ICONS: Record<string, string> = {
  none: '◎',
  dit:  '☀',
  af4:  '↻',
  fvp:  '◆',
};

// ── Stagger entrance variants ─────────────────────────────────────────────────

const tabBarVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
};

const tabItemVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 28 } as const,
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────────

export function TMSTabBar({
  activeSystemId,
  onSwitch,
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
    <motion.div
      role="tablist"
      aria-label="Time management systems"
      className="flex gap-1 bg-card border border-border rounded-xl p-1 mb-4 overflow-x-auto scrollbar-none"
      variants={tabBarVariants}
      initial="hidden"
      animate="visible"
    >
      {handlers.map((handler: TimeManagementSystemHandler, index: number) => {
        const isActive = handler.id === activeSystemId;
        const showInboxDot = handler.id === 'dit' && inboxCount > 0;
        const icon = SYSTEM_ICONS[handler.id] || '•';

        return (
          <motion.button
            key={handler.id}
            ref={(el) => { tabRefs.current[index] = el; }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSwitch(handler.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            title={handler.description}
            variants={tabItemVariants}
            {...(!isActive && {
              whileHover: { scale: 1.03 },
              whileTap: { scale: 0.97 },
            })}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={[
              'relative flex items-center gap-2 px-4 py-2.5 min-w-fit rounded-lg cursor-pointer z-[1]',
              'transition-colors motion-safe:duration-150',
              isActive
                ? 'text-white'
                : 'text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            {/* Animated active background pill */}
            {isActive && (
              <motion.span
                layoutId="tms-tab-active"
                className="absolute inset-0 rounded-lg bg-accent-brand shadow-[0_2px_12px_hsl(var(--accent-brand)/0.25)]"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            {/* Icon — springs on active */}
            <motion.span
              className={`relative text-sm ${isActive ? 'opacity-90' : 'opacity-50'}`}
              aria-hidden="true"
              animate={isActive ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={isActive
                ? { duration: 0.4, ease: 'easeInOut' }
                : { duration: 0.15 }
              }
              key={`icon-${handler.id}-${isActive}`}
            >
              {icon}
            </motion.span>

            {/* Name */}
            <span className="relative text-sm font-semibold whitespace-nowrap">{handler.displayName}</span>

            {/* DIT inbox amber dot */}
            {showInboxDot && (
              <span className="relative w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-label="Inbox has tasks" />
            )}

            {/* Description — hidden on mobile */}
            <span className={`relative text-[10px] font-normal hidden lg:inline whitespace-nowrap ${isActive ? 'opacity-75' : 'opacity-50'}`}>
              {handler.description}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
