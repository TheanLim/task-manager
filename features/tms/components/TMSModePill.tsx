'use client';

import React, { useState } from 'react';
import { ChevronDown, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Task } from '@/types';
import { useTMSModeSelector } from '../hooks/useTMSModeSelector';
import { useTMSStore } from '../stores/tmsStore';
import { TMSModePopover } from './TMSModePopover';
import { ModeSwitchDialog } from './ModeSwitchDialog';
import { FVPProgressChip } from './FVPProgressChip';
import { FilteredBadge } from './FilteredBadge';
import { tmsCopy } from '../copy/tms-copy';

interface TMSModePillProps {
  scrollContainerRef: React.RefObject<HTMLElement>;
  filteredTasks?: Task[];
  hasActiveFilters?: boolean;
}

export function TMSModePill({
  scrollContainerRef,
  filteredTasks,
  hasActiveFilters = false,
}: TMSModePillProps) {
  const {
    activeSystem,
    isPopoverOpen,
    isConfirmDialogOpen,
    pendingSystemId,
    openModeSelector,
    closePopover,
    selectMode,
    confirmSwitch,
    cancelSwitch,
  } = useTMSModeSelector(scrollContainerRef);

  const tmsStoreState = useTMSStore((s) => s.state);

  // T-29: one-time migration tooltip — shown when user previously visited the Focus tab
  const [showMigrationTooltip, setShowMigrationTooltip] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('hadFocusTab') === 'true';
  });

  const dismissMigrationTooltip = () => {
    localStorage.removeItem('hadFocusTab');
    setShowMigrationTooltip(false);
  };

  const isActive = activeSystem !== 'none';
  const isFiltered = isActive && hasActiveFilters;

  // FVP progress data
  const fvpState = tmsStoreState.systemStates['fvp'] as
    | { dottedTasks?: string[]; snapshotTaskIds?: string[] }
    | undefined;
  const fvpProgress = fvpState?.dottedTasks?.length ?? 0;
  const fvpTotal = fvpState?.snapshotTaskIds?.length ?? 0;

  // Mode display name — maps store IDs to display strings
  const MODE_DISPLAY: Record<string, string> = {
    af4: 'AF4',
    dit: 'DIT',
    fvp: 'FVP',
    standard: 'Standard',
    none: '',
  };
  const modeDisplayName = MODE_DISPLAY[activeSystem] ?? activeSystem.toUpperCase();

  // Pill label
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768;
  const pillLabel = isActive ? modeDisplayName : tmsCopy.pill.idleLabel;

  // Aria label
  const ariaLabel = !isActive
    ? tmsCopy.pill.ariaLabel.idle
    : isFiltered
      ? tmsCopy.pill.ariaLabel.activeFiltered(modeDisplayName)
      : tmsCopy.pill.ariaLabel.active(modeDisplayName);

  // Icon: narrow + filtered → FilterIcon; otherwise ChevronDown
  const showFilterIcon = isNarrow && isFiltered;

  function handleClick() {
    if (isConfirmDialogOpen) return;
    if (isPopoverOpen) {
      closePopover();
    } else {
      openModeSelector();
    }
  }

  return (
    <>
      <TMSModePopover
        open={isPopoverOpen}
        activeSystem={activeSystem}
        onSelect={(id) => selectMode(id, filteredTasks)}
        onClose={closePopover}
      >
        <div className="relative">
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={isPopoverOpen}
            aria-label={ariaLabel}
            aria-disabled={isConfirmDialogOpen ? 'true' : undefined}
            onClick={handleClick}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 py-1 rounded-md text-sm font-medium',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              'focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900',
              isActive
                ? 'bg-blue-950 text-blue-300 border border-blue-700 hover:bg-blue-900'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200',
              isConfirmDialogOpen && 'pointer-events-none opacity-50',
            )}
          >
            <span>{pillLabel}</span>
            {showFilterIcon ? (
              <Filter size={12} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} aria-hidden="true" />
            )}
          </button>

          {showMigrationTooltip && (
            <div
              role="tooltip"
              className="absolute top-full left-0 mt-2 z-50 w-64 rounded-md bg-zinc-800 border border-zinc-700 p-3 text-xs text-zinc-200 shadow-lg"
            >
              <p>{tmsCopy.migrationTooltip}</p>
              <button
                onClick={dismissMigrationTooltip}
                className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 underline"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </TMSModePopover>

      {activeSystem === 'fvp' && (
        <FVPProgressChip
          progress={fvpProgress}
          total={fvpTotal}
          isFiltered={isFiltered}
        />
      )}

      {isActive && hasActiveFilters && <FilteredBadge />}

      <ModeSwitchDialog
        open={isConfirmDialogOpen}
        fromMode={modeDisplayName}
        toMode={pendingSystemId ? (MODE_DISPLAY[pendingSystemId] ?? pendingSystemId.toUpperCase()) : ''}
        fvpProgress={activeSystem === 'fvp' ? fvpProgress : undefined}
        fvpTotal={activeSystem === 'fvp' ? fvpTotal : undefined}
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </>
  );
}
