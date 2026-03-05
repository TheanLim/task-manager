import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExecutionLogFilterBar } from './ExecutionLogFilterBar';
import type { ExecutionLogFilters, OutcomeFilter, DateRangeFilter } from '../services/preview/logFilterService';

const defaultFilters: ExecutionLogFilters = {
  ruleIds: [],
  projectIds: [],
  outcome: 'all',
  dateRange: '7d',
};

describe('ExecutionLogFilterBar', () => {
  it('renders Rule, Project, Outcome, Date filter buttons', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Rule')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Outcome')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
  });

  it('active filter button shows accent border', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    const filtersWithActiveRule: ExecutionLogFilters = {
      ...defaultFilters,
      ruleIds: ['rule-1'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithActiveRule}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const ruleButton = screen.getByText('Rule').closest('button');
    expect(ruleButton).toHaveClass('border-accent-brand');
    expect(ruleButton).toHaveClass('text-accent-brand');
  });

  it('Rule filter button shows badge with count when rules selected', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    const filtersWithTwoRules: ExecutionLogFilters = {
      ...defaultFilters,
      ruleIds: ['rule-1', 'rule-2'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithTwoRules}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('Project filter button shows badge with count when projects selected', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    const filtersWithProjects: ExecutionLogFilters = {
      ...defaultFilters,
      projectIds: ['project-1', 'project-2', 'project-3'],
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithProjects}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('"Clear filters" button only visible when hasActiveFilters is true', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    // Test with no active filters
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={20}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();

    // Test with active filters
    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, ruleIds: ['rule-1'] }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('clicking "Clear filters" calls onClearFilters', async () => {
    const user = userEvent.setup();
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    const filtersWithActive: ExecutionLogFilters = {
      ...defaultFilters,
      ruleIds: ['rule-1'],
      outcome: 'fired',
    };

    render(
      <ExecutionLogFilterBar
        filters={filtersWithActive}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const clearButton = screen.getByText('Clear filters');
    await user.click(clearButton);

    expect(mockHandlers.onClearFilters).toHaveBeenCalledTimes(1);
  });

  it('outcome dropdown shows all/fired/skipped/error options', async () => {
    const user = userEvent.setup();
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const outcomeButton = screen.getByText('Outcome');
    await user.click(outcomeButton);

    expect(screen.getByText('All outcomes')).toBeInTheDocument();
    // Use getAllByText since there are multiple elements with "Fired" (badge and menu item)
    expect(screen.getAllByText('Fired').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Skipped').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Error').length).toBeGreaterThan(0);
  });

  it('selecting outcome calls onSetOutcome', async () => {
    const user = userEvent.setup();
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const outcomeButton = screen.getByText('Outcome');
    await user.click(outcomeButton);

    // Get all elements with "Fired" and click the first one
    const firedOptions = screen.getAllByText('Fired');
    await user.click(firedOptions[0]);

    expect(mockHandlers.onSetOutcome).toHaveBeenCalledWith('fired');
  });

  it('date range dropdown shows 24h/7d/30d/all options', async () => {
    const user = userEvent.setup();
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={10}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const dateButton = screen.getByText('Date');
    await user.click(dateButton);

    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();
    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('shows "Showing {filtered} entries (filtered from {total} total)" count text', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    render(
      <ExecutionLogFilterBar
        filters={defaultFilters}
        hasActiveFilters={false}
        filteredCount={15}
        totalCount={42}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Showing 15 entries (filtered from 42 total)')).toBeInTheDocument();
  });

  it('outcome filter shows correct badge colors', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    // Test fired outcome
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'fired' }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const firedBadge = screen.getByText('Fired');
    expect(firedBadge).toHaveClass('text-emerald-600');

    // Test skipped outcome
    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'skipped' }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const skippedBadge = screen.getByText('Skipped');
    expect(skippedBadge).toHaveClass('text-amber-600');

    // Test error outcome
    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, outcome: 'error' }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    const errorBadge = screen.getByText('Error');
    expect(errorBadge).toHaveClass('text-destructive');
  });

  it('date range filter shows correct label', () => {
    const mockHandlers = {
      onSetRuleIds: vi.fn(),
      onSetProjectIds: vi.fn(),
      onSetOutcome: vi.fn(),
      onSetDateRange: vi.fn(),
      onClearFilters: vi.fn(),
    };

    // Test 24h label
    const { rerender } = render(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, dateRange: '24h' }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Last 24 hours')).toBeInTheDocument();

    // Test all time label
    rerender(
      <ExecutionLogFilterBar
        filters={{ ...defaultFilters, dateRange: 'all' }}
        hasActiveFilters={true}
        filteredCount={5}
        totalCount={20}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('All time')).toBeInTheDocument();
  });
});