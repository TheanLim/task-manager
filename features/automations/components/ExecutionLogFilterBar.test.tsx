import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionLogFilterBar } from './ExecutionLogFilterBar';
import type { ExecutionLogFilters, OutcomeFilter, DateRangeFilter } from '../services/preview/logFilterService';

// Polyfill ResizeObserver for jsdom (required by cmdk)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
  Element.prototype.scrollIntoView = vi.fn();
});

const defaultFilters: ExecutionLogFilters = {
  ruleIds: [],
  projectIds: [],
  outcome: 'all',
  dateRange: '7d',
};

const mockHandlersBase = {
  onSetRuleIds: vi.fn(),
  onSetProjectIds: vi.fn(),
  onSetOutcome: vi.fn(),
  onSetDateRange: vi.fn(),
  onClearFilters: vi.fn(),
};

const testRules = [
  { id: 'r-1', name: 'Auto-archive completed' },
  { id: 'r-2', name: 'Escalate blockers' },
];

const testProjects = [
  { id: 'p-1', name: 'Backend Rewrite' },
  { id: 'p-2', name: 'Design System' },
];

describe('ExecutionLogFilterBar', () => {
  it('renders Rule, Project, Outcome, Date filter buttons', () => {
    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Outcome')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('active filter button shows accent border', () => {
    const filtersWithActiveRule: ExecutionLogFilters = {
      ...defaultFilters,
      ruleIds: ['rule-1'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithActiveRule}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    const ruleButton = screen.getByText('Rule').closest('button');
    expect(ruleButton).toHaveClass('border-accent-brand');
    expect(ruleButton).toHaveClass('text-accent-brand');
  });

  it('Rule filter button shows badge with count when rules selected', () => {
    const filtersWithTwoRules: ExecutionLogFilters = {
      ...defaultFilters,
      ruleIds: ['rule-1', 'rule-2'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithTwoRules}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('Project filter button shows badge with count when projects selected', () => {
    const filtersWithProjects: ExecutionLogFilters = {
      ...defaultFilters,
      projectIds: ['project-1', 'project-2', 'project-3'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithProjects}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('"Clear filters" button only visible when hasActiveFilters is true', () => {
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={20}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, ruleIds: ['rule-1'] }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clicking "Clear filters" calls onClearFilters', async () => {
    const user = userEvent.setup();
    const handlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, ruleIds: ['rule-1'], outcome: 'fired' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...handlers}
      />
    );

    await user.click(screen.getByText('Clear filters'));
    expect(handlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('outcome dropdown shows all/fired/skipped/error options', async () => {
    const user = userEvent.setup();

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    await user.click(screen.getByText('Outcome'));

    expect(screen.getByText('All outcomes')).toBeInTheDocument();
    expect(screen.getAllByText('Fired').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
  });

  it('selecting outcome calls onSetOutcome', async () => {
    const user = userEvent.setup();
    const handlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...handlers}
      />
    );

    await user.click(screen.getByText('Outcome'));
    const firedOptions = screen.getAllByText('Fired');
    await user.click(firedOptions[0]);

    expect(handlers.onSetOutcome).toHaveBeenCalledWith('fired');
  });

  it('date range dropdown shows 24h/7d/all options', async () => {
    const user = userEvent.setup();

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    await user.click(screen.getByText('Date'));

    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    expect(screen.getAllByText('Last 7 days').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('shows "Showing {filtered} entries (filtered from {total} total)" count text', () => {
    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={15}
        totalCount={42}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Showing 15 entries (filtered from 42 total)')).toBeInTheDocument();
  });

  it('outcome filter shows correct badge colors', () => {
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'fired' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Fired')).toHaveClass('text-emerald-600');

    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'skipped' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Skipped')).toHaveClass('text-amber-600');

    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'error' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Error')).toHaveClass('text-destructive');
  });

  it('date range filter shows correct label', () => {
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, dateRange: '24h' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();

    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, dateRange: 'all' }}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  // --- New tests for real data props ---

  it('renders actual rule names in Rule filter popover', async () => {
    const user = userEvent.setup();

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    await user.click(screen.getByText('Rule'));

    expect(screen.getByText('Auto-archive completed')).toBeInTheDocument();
    expect(screen.getByText('Escalate blockers')).toBeInTheDocument();
  });

  it('renders actual project names in Project filter popover', async () => {
    const user = userEvent.setup();

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    await user.click(screen.getByText('Project'));

    expect(screen.getByText('Backend Rewrite')).toBeInTheDocument();
    expect(screen.getByText('Design System')).toBeInTheDocument();
  });

  it('does NOT render hardcoded mock data', async () => {
    const user = userEvent.setup();

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        allRules={testRules}
        allProjects={testProjects}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlersBase}
      />
    );

    // Open Rule popover
    await user.click(screen.getByText('Rule'));
    expect(screen.queryByText('Move overdue tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete Friday tasks')).not.toBeInTheDocument();
    expect(screen.queryByText('Archive old tasks')).not.toBeInTheDocument();

    // Close and open Project popover
    await user.click(screen.getByText('Rule'));
    await user.click(screen.getByText('Project'));
    expect(screen.queryByText('Personal')).not.toBeInTheDocument();
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
    expect(screen.queryByText('Side Projects')).not.toBeInTheDocument();
  });
});
