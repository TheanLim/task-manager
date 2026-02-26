import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TMSTabBar } from './TMSTabBar';
import type { TimeManagementSystemHandler } from '../handlers';

// ── Mock registry ─────────────────────────────────────────────────────────────

vi.mock('../registry', () => ({
  getAllTMSHandlers: vi.fn(),
}));

import { getAllTMSHandlers } from '../registry';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHandler(id: string, displayName: string, description = `${displayName} description`): TimeManagementSystemHandler {
  return {
    id,
    displayName,
    description,
    stateSchema: {} as any,
    stateVersion: 1,
    getInitialState: () => ({}),
    validateState: () => ({}),
    migrateState: () => ({}),
    onActivate: () => ({}),
    onDeactivate: () => ({}),
    getOrderedTasks: (tasks) => tasks,
    onTaskCreated: () => ({}),
    onTaskCompleted: () => ({}),
    onTaskDeleted: () => ({}),
    reduce: () => ({}),
    getViewComponent: () => { throw new Error('not implemented'); },
  } as unknown as TimeManagementSystemHandler;
}

const MOCK_HANDLERS = [
  makeHandler('standard', 'Review Queue', 'Standard mode'),
  makeHandler('dit', 'DIT', 'Do It Tomorrow'),
  makeHandler('fvp', 'FVP', 'Final Version Perfected'),
  makeHandler('af4', 'AF4', 'Autofocus 4'),
];

beforeEach(() => {
  vi.mocked(getAllTMSHandlers).mockReturnValue(MOCK_HANDLERS);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TMSTabBar', () => {
  describe('rendering', () => {
    it('renders one tab per handler from getAllTMSHandlers()', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(MOCK_HANDLERS.length);
      expect(screen.getByText('Review Queue')).toBeTruthy();
      expect(screen.getByText('DIT')).toBeTruthy();
      expect(screen.getByText('FVP')).toBeTruthy();
      expect(screen.getByText('AF4')).toBeTruthy();
    });

    it('active tab has aria-selected="true" and bg-primary classes', () => {
      render(
        <TMSTabBar
          activeSystemId="dit"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      expect(activeTab).toBeTruthy();
      expect(activeTab!.className).toContain('bg-primary');
      // The active tab should be the DIT one
      expect(activeTab!.textContent).toContain('DIT');
    });

    it('inactive tabs have aria-selected="false"', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      const inactiveTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'false');
      expect(inactiveTabs).toHaveLength(MOCK_HANDLERS.length - 1);
    });

    it('inactive tab with saved state shows "resumed" pill', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
          resumedSystemId="dit"
        />
      );
      expect(screen.getByText('resumed')).toBeTruthy();
    });

    it('does not show "resumed" pill when resumedSystemId is not set', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      expect(screen.queryByText('resumed')).toBeNull();
    });

    it('DIT tab shows amber dot when inboxCount > 0', () => {
      const { container } = render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
          inboxCount={3}
        />
      );
      // Amber dot should be present in the DIT tab
      const amberDot = container.querySelector('.bg-amber-500');
      expect(amberDot).not.toBeNull();
    });

    it('DIT tab does not show amber dot when inboxCount is 0', () => {
      const { container } = render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
          inboxCount={0}
        />
      );
      const amberDot = container.querySelector('.bg-amber-500');
      expect(amberDot).toBeNull();
    });

    it('DIT tab does not show amber dot when inboxCount is not provided', () => {
      const { container } = render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const amberDot = container.querySelector('.bg-amber-500');
      expect(amberDot).toBeNull();
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowRight moves focus to next tab', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      // Focus the first tab (standard)
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[1]);
    });

    it('ArrowLeft moves focus to previous tab', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      // Focus the second tab
      tabs[1].focus();
      fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('ArrowRight on last tab wraps to first', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      const lastTab = tabs[tabs.length - 1];
      lastTab.focus();
      fireEvent.keyDown(lastTab, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('ArrowLeft on first tab wraps to last', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'ArrowLeft' });
      expect(document.activeElement).toBe(tabs[tabs.length - 1]);
    });

    it('Home jumps to first tab', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      tabs[2].focus();
      fireEvent.keyDown(tabs[2], { key: 'Home' });
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('End jumps to last tab', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      tabs[0].focus();
      fireEvent.keyDown(tabs[0], { key: 'End' });
      expect(document.activeElement).toBe(tabs[tabs.length - 1]);
    });

    it('Enter on focused tab calls onSwitch with that system id', () => {
      const onSwitch = vi.fn();
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={onSwitch}
        />
      );
      const tabs = screen.getAllByRole('tab');
      // Focus the DIT tab (index 1)
      tabs[1].focus();
      fireEvent.keyDown(tabs[1], { key: 'Enter' });
      expect(onSwitch).toHaveBeenCalledWith('dit');
    });

    it('Space on focused tab calls onSwitch with that system id', () => {
      const onSwitch = vi.fn();
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={onSwitch}
        />
      );
      const tabs = screen.getAllByRole('tab');
      // Focus the FVP tab (index 2)
      tabs[2].focus();
      fireEvent.keyDown(tabs[2], { key: ' ' });
      expect(onSwitch).toHaveBeenCalledWith('fvp');
    });
  });

  describe('click interaction', () => {
    it('clicking a tab calls onSwitch with that system id', () => {
      const onSwitch = vi.fn();
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={onSwitch}
        />
      );
      const tabs = screen.getAllByRole('tab');
      fireEvent.click(tabs[1]); // DIT tab
      expect(onSwitch).toHaveBeenCalledWith('dit');
    });
  });

  describe('accessibility', () => {
    it('has role="tablist" on the container', () => {
      render(
        <TMSTabBar
          activeSystemId="standard"
          onSwitch={vi.fn()}
        />
      );
      expect(screen.getByRole('tablist')).toBeTruthy();
    });

    it('active tab has tabIndex=0 and inactive tabs have tabIndex=-1', () => {
      render(
        <TMSTabBar
          activeSystemId="fvp"
          onSwitch={vi.fn()}
        />
      );
      const tabs = screen.getAllByRole('tab');
      const activeTab = tabs.find(t => t.getAttribute('aria-selected') === 'true');
      const inactiveTabs = tabs.filter(t => t.getAttribute('aria-selected') === 'false');
      expect(activeTab!.getAttribute('tabindex')).toBe('0');
      inactiveTabs.forEach(t => expect(t.getAttribute('tabindex')).toBe('-1'));
    });
  });
});
