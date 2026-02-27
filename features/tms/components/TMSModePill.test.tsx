import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TMSModePill } from './TMSModePill';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Controllable state for useTMSModeSelector
const mockOpenModeSelector = vi.fn();
const mockClosePopover = vi.fn();
const mockSelectMode = vi.fn();
const mockConfirmSwitch = vi.fn();
const mockCancelSwitch = vi.fn();

let mockSelectorState = {
  activeSystem: 'none' as string,
  isPopoverOpen: false,
  isConfirmDialogOpen: false,
  pendingSystemId: null as string | null,
  openModeSelector: mockOpenModeSelector,
  closePopover: mockClosePopover,
  selectMode: mockSelectMode,
  confirmSwitch: mockConfirmSwitch,
  cancelSwitch: mockCancelSwitch,
};

vi.mock('../hooks/useTMSModeSelector', () => ({
  useTMSModeSelector: () => mockSelectorState,
}));

// Controllable state for useTMSStore
let mockTMSStoreState = {
  activeSystem: 'none' as string,
  systemStates: {} as Record<string, unknown>,
  systemStateVersions: {} as Record<string, number>,
};

vi.mock('../stores/tmsStore', () => ({
  useTMSStore: (selector: (s: { state: typeof mockTMSStoreState }) => unknown) =>
    selector({ state: mockTMSStoreState }),
}));

// Stub child components to keep tests focused on TMSModePill logic
vi.mock('./TMSModePopover', () => ({
  TMSModePopover: ({
    open,
    children,
    onSelect,
    onClose,
  }: {
    open: boolean;
    children: React.ReactNode;
    onSelect: (id: string) => void;
    onClose: () => void;
  }) => (
    <div data-testid="tms-mode-popover" data-open={String(open)}>
      {children}
    </div>
  ),
}));

vi.mock('./ModeSwitchDialog', () => ({
  ModeSwitchDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="mode-switch-dialog" /> : null,
}));

vi.mock('./FVPProgressChip', () => ({
  FVPProgressChip: ({ progress, total }: { progress: number; total: number }) => (
    <div data-testid="fvp-progress-chip">{`${progress}/${total}`}</div>
  ),
}));

vi.mock('./FilteredBadge', () => ({
  FilteredBadge: () => <div data-testid="filtered-badge" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

import React from 'react';

function makeScrollRef(): React.RefObject<HTMLElement> {
  return { current: null };
}

function renderPill(props: Partial<Parameters<typeof TMSModePill>[0]> = {}) {
  return render(
    <TMSModePill scrollContainerRef={makeScrollRef()} {...props} />,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TMSModePill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockSelectorState = {
      activeSystem: 'none',
      isPopoverOpen: false,
      isConfirmDialogOpen: false,
      pendingSystemId: null,
      openModeSelector: mockOpenModeSelector,
      closePopover: mockClosePopover,
      selectMode: mockSelectMode,
      confirmSwitch: mockConfirmSwitch,
      cancelSwitch: mockCancelSwitch,
    };
    mockTMSStoreState = {
      activeSystem: 'none',
      systemStates: {},
      systemStateVersions: {},
    };
  });

  // ── Idle state ─────────────────────────────────────────────────────────────

  it('idle state renders label "Review"', () => {
    renderPill();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('idle state has aria-label containing "Open review mode selector"', () => {
    renderPill();
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', 'Open review mode selector');
  });

  // ── Active AF4 state ───────────────────────────────────────────────────────

  it('active AF4 state renders label "AF4"', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill();
    expect(screen.getByText('AF4')).toBeInTheDocument();
  });

  it('active AF4 state has aria-label containing "AF4 mode active"', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill();
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('AF4 mode active');
  });

  // ── Active FVP + filters ───────────────────────────────────────────────────

  it('active FVP + filters active: aria-label contains "filtered"', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'fvp' };
    renderPill({ hasActiveFilters: true });
    const btn = screen.getByRole('button');
    expect(btn.getAttribute('aria-label')).toContain('filtered');
  });

  // ── aria-haspopup ──────────────────────────────────────────────────────────

  it('aria-haspopup="listbox" is always present', () => {
    renderPill();
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('aria-haspopup="listbox" present when active', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill();
    expect(screen.getByRole('button')).toHaveAttribute('aria-haspopup', 'listbox');
  });

  // ── aria-expanded ──────────────────────────────────────────────────────────

  it('aria-expanded="false" when popover is closed', () => {
    renderPill();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('aria-expanded="true" when popover is open', () => {
    mockSelectorState = { ...mockSelectorState, isPopoverOpen: true };
    renderPill();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  // ── Clicking pill opens popover ────────────────────────────────────────────

  it('clicking pill calls openModeSelector when popover is closed', () => {
    renderPill();
    fireEvent.click(screen.getByRole('button'));
    expect(mockOpenModeSelector).toHaveBeenCalledTimes(1);
  });

  it('clicking pill calls closePopover when popover is already open', () => {
    mockSelectorState = { ...mockSelectorState, isPopoverOpen: true };
    renderPill();
    fireEvent.click(screen.getByRole('button'));
    expect(mockClosePopover).toHaveBeenCalledTimes(1);
    expect(mockOpenModeSelector).not.toHaveBeenCalled();
  });

  // ── ModeSwitchDialog ───────────────────────────────────────────────────────

  it('ModeSwitchDialog renders when isConfirmDialogOpen=true', () => {
    mockSelectorState = {
      ...mockSelectorState,
      activeSystem: 'fvp',
      isConfirmDialogOpen: true,
      pendingSystemId: 'af4',
    };
    renderPill();
    expect(screen.getByTestId('mode-switch-dialog')).toBeInTheDocument();
  });

  it('ModeSwitchDialog does not render when isConfirmDialogOpen=false', () => {
    renderPill();
    expect(screen.queryByTestId('mode-switch-dialog')).not.toBeInTheDocument();
  });

  // ── FVPProgressChip ────────────────────────────────────────────────────────

  it('FVPProgressChip renders only when activeSystem === "fvp"', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'fvp' };
    renderPill();
    expect(screen.getByTestId('fvp-progress-chip')).toBeInTheDocument();
  });

  it('FVPProgressChip does not render when activeSystem is "af4"', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill();
    expect(screen.queryByTestId('fvp-progress-chip')).not.toBeInTheDocument();
  });

  it('FVPProgressChip does not render when activeSystem is "none"', () => {
    renderPill();
    expect(screen.queryByTestId('fvp-progress-chip')).not.toBeInTheDocument();
  });

  // ── FilteredBadge ──────────────────────────────────────────────────────────

  it('FilteredBadge renders when mode is active AND hasActiveFilters=true', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill({ hasActiveFilters: true });
    expect(screen.getByTestId('filtered-badge')).toBeInTheDocument();
  });

  it('FilteredBadge does not render when mode is active but hasActiveFilters=false', () => {
    mockSelectorState = { ...mockSelectorState, activeSystem: 'af4' };
    renderPill({ hasActiveFilters: false });
    expect(screen.queryByTestId('filtered-badge')).not.toBeInTheDocument();
  });

  it('FilteredBadge does not render when activeSystem="none"', () => {
    renderPill({ hasActiveFilters: true });
    expect(screen.queryByTestId('filtered-badge')).not.toBeInTheDocument();
  });

  // ── Disabled state ─────────────────────────────────────────────────────────

  it('when isConfirmDialogOpen=true, pill has aria-disabled="true"', () => {
    mockSelectorState = {
      ...mockSelectorState,
      activeSystem: 'fvp',
      isConfirmDialogOpen: true,
      pendingSystemId: 'af4',
    };
    renderPill();
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
  });

  it('when isConfirmDialogOpen=true, pill has pointer-events-none class', () => {
    mockSelectorState = {
      ...mockSelectorState,
      activeSystem: 'fvp',
      isConfirmDialogOpen: true,
      pendingSystemId: 'af4',
    };
    renderPill();
    expect(screen.getByRole('button').className).toContain('pointer-events-none');
  });

  it('when isConfirmDialogOpen=true, clicking pill does not call openModeSelector', () => {
    mockSelectorState = {
      ...mockSelectorState,
      activeSystem: 'fvp',
      isConfirmDialogOpen: true,
      pendingSystemId: 'af4',
    };
    renderPill();
    fireEvent.click(screen.getByRole('button'));
    expect(mockOpenModeSelector).not.toHaveBeenCalled();
  });

  it('when isConfirmDialogOpen=false, pill does not have aria-disabled', () => {
    renderPill();
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
  });

  // ── Migration tooltip (T-29) ───────────────────────────────────────────────

  it('migration tooltip renders when hadFocusTab localStorage key is present', () => {
    localStorage.setItem('hadFocusTab', 'true');
    renderPill();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it('migration tooltip does not render when hadFocusTab key is absent', () => {
    renderPill();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('migration tooltip is hidden after dismissal and key is removed', () => {
    localStorage.setItem('hadFocusTab', 'true');
    renderPill();
    fireEvent.click(screen.getByRole('button', { name: /got it/i }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(localStorage.getItem('hadFocusTab')).toBeNull();
  });
});
