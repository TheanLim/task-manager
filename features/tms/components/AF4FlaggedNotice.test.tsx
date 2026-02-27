/**
 * Tests for AF4FlaggedNotice component.
 * Feature: tms-inline-interactions, Properties 22, 23, and 24
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AF4FlaggedNotice } from './AF4FlaggedNotice';
import type { Task } from '@/types';

function makeTask(id: string, description = `Task ${id}`): Task {
  return {
    id,
    description,
    completed: false,
    projectId: null,
    parentTaskId: null,
    sectionId: null,
    priority: 'none' as const,
    notes: '',
    assignee: '',
    tags: [],
    dueDate: null,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastActionAt: null,
  };
}

describe('AF4FlaggedNotice', () => {
  // ── Property 24: not rendered when empty ──────────────────────────────────

  it('renders nothing when dismissedTaskIds is empty', () => {
    const { container } = render(
      <AF4FlaggedNotice dismissedTaskIds={[]} tasks={[]} onResolve={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  // ── Property 22: count matches dismissed task count ───────────────────────

  it('shows count of 1 flagged task', () => {
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1')]}
        onResolve={vi.fn()}
      />
    );
    expect(screen.getByText(/1 flagged task need/i)).toBeTruthy();
  });

  it('shows count of 3 flagged tasks', () => {
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1', 't2', 't3']}
        tasks={[makeTask('t1'), makeTask('t2'), makeTask('t3')]}
        onResolve={vi.fn()}
      />
    );
    expect(screen.getByText(/3 flagged tasks need/i)).toBeTruthy();
  });

  // ── Resolve toggle ────────────────────────────────────────────────────────

  it('resolution panel is hidden by default', () => {
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1', 'Buy milk')]}
        onResolve={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: /abandon/i })).toBeNull();
  });

  it('clicking Resolve expands the resolution panel', () => {
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1', 'Buy milk')]}
        onResolve={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /resolve flagged tasks/i }));
    expect(screen.getByRole('button', { name: /abandon: buy milk/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-enter: buy milk/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /defer: buy milk/i })).toBeTruthy();
  });

  // ── Property 23: resolution buttons dispatch correct actions ──────────────

  it('clicking Abandon calls onResolve with abandon', () => {
    const onResolve = vi.fn();
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1', 'Buy milk')]}
        onResolve={onResolve}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /resolve flagged tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: /abandon: buy milk/i }));
    expect(onResolve).toHaveBeenCalledWith('t1', 'abandon');
  });

  it('clicking Re-enter calls onResolve with re-enter', () => {
    const onResolve = vi.fn();
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1', 'Buy milk')]}
        onResolve={onResolve}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /resolve flagged tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: /re-enter: buy milk/i }));
    expect(onResolve).toHaveBeenCalledWith('t1', 're-enter');
  });

  it('clicking Defer calls onResolve with defer', () => {
    const onResolve = vi.fn();
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1']}
        tasks={[makeTask('t1', 'Buy milk')]}
        onResolve={onResolve}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /resolve flagged tasks/i }));
    fireEvent.click(screen.getByRole('button', { name: /defer: buy milk/i }));
    expect(onResolve).toHaveBeenCalledWith('t1', 'defer');
  });

  it('lists all flagged tasks in the resolution panel', () => {
    render(
      <AF4FlaggedNotice
        dismissedTaskIds={['t1', 't2']}
        tasks={[makeTask('t1', 'Task Alpha'), makeTask('t2', 'Task Beta')]}
        onResolve={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /resolve flagged tasks/i }));
    expect(screen.getByText('Task Alpha')).toBeTruthy();
    expect(screen.getByText('Task Beta')).toBeTruthy();
  });
});
