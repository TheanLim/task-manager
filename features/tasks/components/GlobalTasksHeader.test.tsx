'use client';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { GlobalTasksHeader } from './GlobalTasksHeader';

// Mock useAppStore
vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    globalTasksDisplayMode: 'nested',
    setGlobalTasksDisplayMode: vi.fn(),
    autoHideThreshold: 'show-all',
    setAutoHideThreshold: vi.fn(),
    showRecentlyCompleted: false,
    setShowRecentlyCompleted: vi.fn(),
  }),
}));

// Mock useMediaQuery
vi.mock('@/app/hooks/useMediaQuery', () => ({
  useMediaQuery: () => false,
}));

// Mock useTMSModeSelector used by TMSModePill
vi.mock('@/features/tms/hooks/useTMSModeSelector', () => ({
  useTMSModeSelector: () => ({
    activeSystem: 'none',
    isPopoverOpen: false,
    isConfirmDialogOpen: false,
    pendingSystemId: null,
    openModeSelector: vi.fn(),
    closePopover: vi.fn(),
    selectMode: vi.fn(),
    confirmSwitch: vi.fn(),
    cancelSwitch: vi.fn(),
  }),
}));

// Mock useTMSStore used by TMSModePill
vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: (selector: any) => selector({
    state: { activeSystem: 'none', systemStates: {}, systemStateVersions: {} },
  }),
}));

function makeScrollRef(): React.RefObject<HTMLElement> {
  return { current: null };
}

describe('GlobalTasksHeader', () => {
  it('renders the Add Task button', () => {
    render(<GlobalTasksHeader onAddTask={vi.fn()} scrollContainerRef={makeScrollRef()} />);
    expect(screen.getByRole('button', { name: /add task/i })).toBeInTheDocument();
  });

  it('Add Task button has yellow accent-brand styling', () => {
    render(<GlobalTasksHeader onAddTask={vi.fn()} scrollContainerRef={makeScrollRef()} />);
    const btn = screen.getByRole('button', { name: /add task/i });
    expect(btn.className).toMatch(/bg-accent-brand/);
  });

  it('calls onAddTask when Add Task button is clicked', () => {
    const onAddTask = vi.fn();
    render(<GlobalTasksHeader onAddTask={onAddTask} scrollContainerRef={makeScrollRef()} />);
    fireEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(onAddTask).toHaveBeenCalledTimes(1);
  });

  it('renders TMSModePill in the toolbar', () => {
    render(<GlobalTasksHeader onAddTask={vi.fn()} scrollContainerRef={makeScrollRef()} />);
    // TMSModePill renders a button with aria-haspopup="listbox"
    expect(screen.getByRole('button', { name: /review/i })).toBeInTheDocument();
  });

  it('does not render a Review Queue button (removed in T-07)', () => {
    render(<GlobalTasksHeader onAddTask={vi.fn()} scrollContainerRef={makeScrollRef()} />);
    expect(screen.queryByRole('button', { name: /review queue/i })).not.toBeInTheDocument();
  });
});
