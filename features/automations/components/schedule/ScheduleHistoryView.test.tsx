import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleHistoryView } from './ScheduleHistoryView';
import type { ExecutionLogEntry } from '../../types';

function createEntry(overrides?: Partial<ExecutionLogEntry>): ExecutionLogEntry {
  return {
    timestamp: '2024-01-15T10:00:00Z',
    triggerDescription: 'Every Monday at 09:00',
    actionDescription: 'Moved to This Week',
    taskName: 'Aggregated',
    matchCount: 5,
    details: ['Task A', 'Task B', 'Task C', 'Task D', 'Task E'],
    executionType: 'scheduled',
    ...overrides,
  };
}

describe('ScheduleHistoryView', () => {
  it('renders aggregated entries with timestamp, execution type badge, and match count', () => {
    const entries: ExecutionLogEntry[] = [
      createEntry({ executionType: 'scheduled', matchCount: 5 }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    // Expand the log
    const toggle = screen.getByRole('button', { name: /recent activity/i });
    expect(toggle).toBeInTheDocument();
  });

  it('shows execution type badges after expanding', async () => {
    const user = userEvent.setup();
    const entries: ExecutionLogEntry[] = [
      createEntry({ executionType: 'scheduled', matchCount: 3 }),
      createEntry({ executionType: 'catch-up', matchCount: 2, timestamp: '2024-01-14T10:00:00Z' }),
      createEntry({ executionType: 'manual', matchCount: 1, timestamp: '2024-01-13T10:00:00Z' }),
      createEntry({ executionType: 'skipped', matchCount: 0, timestamp: '2024-01-12T10:00:00Z' }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    expect(screen.getByText('⚡ Scheduled')).toBeInTheDocument();
    expect(screen.getByText('🔄 Catch-up')).toBeInTheDocument();
    expect(screen.getByText('🔧 Manual')).toBeInTheDocument();
    expect(screen.getByText('⏭️ Skipped')).toBeInTheDocument();
  });

  it('clicking entry expands to show details array (task names)', async () => {
    const user = userEvent.setup();
    const entries: ExecutionLogEntry[] = [
      createEntry({
        matchCount: 3,
        details: ['Fix login bug', 'Update docs', 'Refactor auth'],
      }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    // Expand the log section
    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    // Task names should not be visible yet (collapsed entry)
    expect(screen.queryByText('Fix login bug')).not.toBeInTheDocument();

    // Click the entry to expand it
    const entryButton = screen.getByRole('button', { name: /3 tasks/i });
    await user.click(entryButton);

    // Now task names should be visible
    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Update docs')).toBeInTheDocument();
    expect(screen.getByText('Refactor auth')).toBeInTheDocument();
  });

  it('displays entries in reverse chronological order', async () => {
    const user = userEvent.setup();
    const entries: ExecutionLogEntry[] = [
      createEntry({ timestamp: '2024-01-13T10:00:00Z', executionType: 'scheduled', matchCount: 1 }),
      createEntry({ timestamp: '2024-01-15T10:00:00Z', executionType: 'catch-up', matchCount: 3 }),
      createEntry({ timestamp: '2024-01-14T10:00:00Z', executionType: 'manual', matchCount: 2 }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    const badges = screen.getAllByTestId('execution-type-badge');
    // Most recent first: catch-up (Jan 15), manual (Jan 14), scheduled (Jan 13)
    expect(badges[0]).toHaveTextContent('🔄 Catch-up');
    expect(badges[1]).toHaveTextContent('🔧 Manual');
    expect(badges[2]).toHaveTextContent('⚡ Scheduled');
  });

  it('shows match count in entry', async () => {
    const user = userEvent.setup();
    const entries: ExecutionLogEntry[] = [
      createEntry({ matchCount: 12 }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    expect(screen.getByText(/12 tasks/)).toBeInTheDocument();
  });

  it('shows "No activity yet" when entries is empty', async () => {
    const user = userEvent.setup();
    render(<ScheduleHistoryView entries={[]} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('limits displayed details to 10 task names', async () => {
    const user = userEvent.setup();
    const details = Array.from({ length: 15 }, (_, i) => `Task ${i + 1}`);
    const entries: ExecutionLogEntry[] = [
      createEntry({ matchCount: 15, details }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    const entryButton = screen.getByRole('button', { name: /15 tasks/i });
    await user.click(entryButton);

    // First 10 should be visible
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByText(`Task ${i}`)).toBeInTheDocument();
    }
    // 11th should not be visible
    expect(screen.queryByText('Task 11')).not.toBeInTheDocument();
    // Should show "+5 more" indicator
    expect(screen.getByText(/\+5 more/)).toBeInTheDocument();
  });

  it('collapses expanded entry on second click', async () => {
    const user = userEvent.setup();
    const entries: ExecutionLogEntry[] = [
      createEntry({ matchCount: 2, details: ['Task A', 'Task B'] }),
    ];
    render(<ScheduleHistoryView entries={entries} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    const entryButton = screen.getByRole('button', { name: /2 tasks/i });
    await user.click(entryButton);
    expect(screen.getByText('Task A')).toBeInTheDocument();

    // Click again to collapse
    await user.click(entryButton);
    expect(screen.queryByText('Task A')).not.toBeInTheDocument();
  });
});


describe('ScheduleHistoryView — relative time auto-refresh', () => {
  it('updates relative timestamps after 30 seconds without collapse/expand', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    try {
      // Create an entry timestamped 10 seconds ago
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
      const entries: ExecutionLogEntry[] = [
        createEntry({ timestamp: tenSecondsAgo, matchCount: 1 }),
      ];

      render(<ScheduleHistoryView entries={entries} />);
      await user.click(screen.getByRole('button', { name: /recent activity/i }));

      // Initially should show "Just now" (10s < 60s threshold)
      expect(screen.getByText('Just now')).toBeInTheDocument();

      // Advance time by 60 seconds — now the entry is 70s old → "1m ago"
      vi.advanceTimersByTime(60_000);

      // The 30s interval should have triggered a re-render
      // Wait for React to process the state update
      await vi.waitFor(() => {
        expect(screen.getByText('1m ago')).toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
