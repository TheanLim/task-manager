import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DryRunDialog } from './DryRunDialog';
import type { DryRunResult } from '../../services/rules/dryRunService';

describe('DryRunDialog', () => {
  const resultWithTasks: DryRunResult = {
    matchingTasks: [
      { id: '1', name: 'Fix login bug' },
      { id: '2', name: 'Update documentation' },
      { id: '3', name: 'Refactor auth module' },
    ],
    actionDescription: 'Move to Done',
    totalCount: 3,
  };

  const emptyResult: DryRunResult = {
    matchingTasks: [],
    actionDescription: 'Move to Done',
    totalCount: 0,
  };

  it('renders with "This rule would affect N tasks" header', () => {
    render(
      <DryRunDialog open onOpenChange={() => {}} result={resultWithTasks} />
    );

    expect(
      screen.getByText('This rule would affect 3 tasks')
    ).toBeInTheDocument();
  });

  it('shows scrollable list with task names and action description', () => {
    render(
      <DryRunDialog open onOpenChange={() => {}} result={resultWithTasks} />
    );

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();
    expect(screen.getByText('Update documentation')).toBeInTheDocument();
    expect(screen.getByText('Refactor auth module')).toBeInTheDocument();
    expect(screen.getByText(/Move to Done/)).toBeInTheDocument();
  });

  it('shows "This rule would not affect any tasks right now." for zero matches', () => {
    render(
      <DryRunDialog open onOpenChange={() => {}} result={emptyResult} />
    );

    expect(
      screen.getByText('This rule would not affect any tasks right now.')
    ).toBeInTheDocument();
  });

  it('has close button and is accessible with role="dialog" and aria-label', () => {
    render(
      <DryRunDialog open onOpenChange={() => {}} result={resultWithTasks} />
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-label', 'Dry run preview');

    // Close button (the X from shadcn DialogContent)
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <DryRunDialog open onOpenChange={onOpenChange} result={resultWithTasks} />
    );

    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders singular "task" when totalCount is 1', () => {
    const singleResult: DryRunResult = {
      matchingTasks: [{ id: '1', name: 'Solo task' }],
      actionDescription: 'Archive',
      totalCount: 1,
    };

    render(
      <DryRunDialog open onOpenChange={() => {}} result={singleResult} />
    );

    expect(
      screen.getByText('This rule would affect 1 task')
    ).toBeInTheDocument();
  });
});
