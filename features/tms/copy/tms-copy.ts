/**
 * All UI strings for the TMS feature.
 * Centralised here so copy changes don't require hunting across components.
 */

export const tmsCopy = {
  // ── Progress chip ──────────────────────────────────────────────────────────
  fvpProgress: (n: number, total: number) => `FVP — ${n} of ${total}`,
  fvpProgressNarrow: (n: number, total: number) => `FVP ${n}/${total}`,

  // ── Confirmation dialog ────────────────────────────────────────────────────
  confirmDialog: {
    title: (toMode: string) => `Switch to ${toMode}?`,

    /** Shown when leaving an active FVP session. */
    fvpBody: (progress: number, total: number) =>
      `You are ${progress} of ${total} through your FVP session. Switching modes will discard your current session snapshot.`,

    /** Shown when switching TO FVP from another mode. */
    toFvpBody: (fromMode: string) =>
      `Your ${fromMode} session will end. FVP will take a snapshot of your current task list when it starts.`,

    /** Generic body for all other mode switches. */
    genericBody: (fromMode: string) =>
      `Your ${fromMode} session will end. Any unsaved progress will be lost.`,

    confirmButton: (toMode: string) => `Switch to ${toMode}`,
    cancelButton: 'Cancel',
  },

  // ── Screen-reader announcements ────────────────────────────────────────────
  srAnnouncements: {
    activated: {
      AF4: 'AF4 mode activated. Tasks are now sorted by attention.',
      DIT: 'DIT mode activated. Tasks are sorted by today\'s priority.',
      FVP: 'FVP mode activated. Your task list has been snapshotted for this session.',
      Standard: 'Standard mode activated.',
      none: 'Review mode ended.',
    } as Record<'AF4' | 'DIT' | 'FVP' | 'Standard' | 'none', string>,
    exited: 'Review mode ended.',
  },

  // ── Mode selector popover ──────────────────────────────────────────────────
  popover: {
    options: {
      None: {
        name: 'None',
        description: 'No active review mode. Tasks appear in their default order.',
      },
      AF4: {
        name: 'AF4',
        description: 'Autofocus 4 — surface the task that needs your attention most.',
      },
      DIT: {
        name: 'DIT',
        description: 'Do It Tomorrow — plan today\'s priority tasks.',
      },
      FVP: {
        name: 'FVP',
        description:
          'Final Version Perfected — compare tasks pairwise. A snapshot is taken at session start so your candidate list stays stable.',
      },
      Standard: {
        name: 'Standard',
        description: 'Work through tasks in their current order without special sorting.',
      },
    } as Record<'None' | 'AF4' | 'DIT' | 'FVP' | 'Standard', { name: string; description: string }>,
  },

  // ── Mode pill ──────────────────────────────────────────────────────────────
  pill: {
    idleLabel: 'Review',
    activeLabel: (mode: string) => mode,
    ariaLabel: {
      idle: 'Open review mode selector',
      active: (mode: string) => `${mode} mode active. Open mode selector`,
      activeFiltered: (mode: string) => `${mode} mode active, filtered. Open mode selector`,
    },
  },

  // ── Inline notices ─────────────────────────────────────────────────────────
  inlineNotices: {
    viewChanged: 'View changed while a review mode is active. Your session continues.',
    queueComplete: 'Queue complete. Great work! Review mode has been reset.',
    noFvpCandidates:
      'All FVP candidates are outside the current filter. Clear filters or end the session.',
  },

  // ── Nudge banner (Phase 2) ─────────────────────────────────────────────────
  nudgeBanner: {
    message: 'Review Queue has moved. Select a review mode from the toolbar to get started.',
    ctaLabel: 'Take me there →',
    dismissAriaLabel: 'Dismiss this notice',
  },

  // ── Phase 3 migration tooltip ──────────────────────────────────────────────
  migrationTooltip: 'Review Queue moved here. Select a mode to start a session.',
} as const;
