import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionLogTable } from './ExecutionLogTable';
import type { EnrichedLogEntry } from '../services/preview/logFilterService';

vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '2 minutes ago',
}));

function makeEntry(overrides: Partial<EnrichedLogEntry> = {}): EnrichedLogEntry {
  return {
    id: 'entry-1',
    timestamp: '2025-01-15T10:00:00.000Z',
    triggerDescription: 'Card moved',
    actionDescription: 'Marked complete',
    taskName: 'Fix the bug',
    executionType: 'event',
    ruleId: 'rule-1',
    ruleName: 'My Rule',
    firingProjectId: 'proj-1',
    projectName: 'My Project',
    ...overrides,
  };
}

describe('ExecutionLogTable', () => {
  it('renders table with column headers', () => {
    render(<ExecutionLogTable entries={[]} />);

    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders entries with correct data in each column', () => {
    const entry = makeEntry();
    render(<ExecutionLogTable entries={[entry]} />);

    expect(screen.getByText('2 minutes ago')).toBeInTheDocument();
    expect(screen.getByText('My Rule')).toBeInTheDocument();
    expect(screen.getByText('My Project')).toBeInTheDocument();
    expect(screen.getByText('Fix the bug')).toBeInTheDocument();
  });

  it('shows "Fired" badge for event execution type', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'event' })]} />);
    expect(screen.getByText('Fired')).toBeInTheDocument();
  });

  it('shows "Fired" badge for scheduled execution type', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'scheduled' })]} />);
    expect(screen.getByText('Fired')).toBeInTheDocument();
  });

  it('shows "Skipped" badge for skipped type with amber styling', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'skipped' })]} />);
    const badge = screen.getByText('Skipped');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-amber');
  });

  it('shows "Error" badge for error type', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'error' })]} />);
    const badge = screen.getByText('Error');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('text-destructive');
  });

  it('skipped rows have amber background tint class', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'skipped' })]} />);
    const rows = screen.getAllByRole('button', { name: /my rule/i });
    const rowDiv = rows.find(el => el.getAttribute('tabindex') === '0');
    expect(rowDiv?.className).toContain('bg-amber-50/30');
  });

  it('error rows have destructive background tint class', () => {
    render(<ExecutionLogTable entries={[makeEntry({ executionType: 'error' })]} />);
    const rows = screen.getAllByRole('button', { name: /my rule/i });
    const rowDiv = rows.find(el => el.getAttribute('tabindex') === '0');
    expect(rowDiv?.className).toContain('bg-destructive/5');
  });

  it('clicking a row expands detail with skip reason', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({
      executionType: 'skipped',
      skipReason: 'Section not found in project',
    });
    render(<ExecutionLogTable entries={[entry]} />);

    expect(screen.queryByText('Section not found in project')).not.toBeInTheDocument();

    const row = screen.getByText('My Rule').closest('[role="button"]')!;
    await user.click(row);

    expect(screen.getByText('Section not found in project')).toBeInTheDocument();
  });

  it('expanded detail shows action links', async () => {
    const user = userEvent.setup();
    const entry = makeEntry({ skipReason: 'Some reason' });
    render(<ExecutionLogTable entries={[entry]} />);

    const row = screen.getByText('My Rule').closest('[role="button"]')!;
    await user.click(row);

    expect(screen.getByText('Go to project →')).toBeInTheDocument();
    expect(screen.getByText('Edit rule →')).toBeInTheDocument();
  });

  it('"Load more" button appears when hasMore is true', () => {
    render(
      <ExecutionLogTable entries={[makeEntry()]} hasMore remainingCount={42} />
    );
    expect(screen.getByText('Load more — 42 remaining')).toBeInTheDocument();
  });

  it('"Load more" button calls onLoadMore when clicked', async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <ExecutionLogTable
        entries={[makeEntry()]}
        hasMore
        remainingCount={10}
        onLoadMore={onLoadMore}
      />
    );

    await user.click(screen.getByText('Load more — 10 remaining'));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it('empty state shows when isEmpty is true', () => {
    render(<ExecutionLogTable entries={[]} isEmpty />);
    expect(screen.getByText('No entries match your filters')).toBeInTheDocument();
  });

  it('empty state "Clear filters" button calls onClearFilters', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<ExecutionLogTable entries={[]} isEmpty onClearFilters={onClearFilters} />);

    await user.click(screen.getByText('Clear filters'));
    expect(onClearFilters).toHaveBeenCalledOnce();
  });

  it('falls back to ruleId when ruleName is missing', () => {
    render(
      <ExecutionLogTable
        entries={[makeEntry({ ruleName: undefined, ruleId: 'rule-fallback' })]}
      />
    );
    expect(screen.getByText('rule-fallback')).toBeInTheDocument();
  });

  it('falls back to firingProjectId when projectName is missing', () => {
    render(
      <ExecutionLogTable
        entries={[makeEntry({ projectName: undefined, firingProjectId: 'proj-fallback' })]}
      />
    );
    expect(screen.getByText('proj-fallback')).toBeInTheDocument();
  });

  it('shows dash when taskName is empty', () => {
    render(
      <ExecutionLogTable entries={[makeEntry({ taskName: '' })]} />
    );
    // The task column should show the dash fallback
    const cells = screen.getAllByText('—');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });
});
