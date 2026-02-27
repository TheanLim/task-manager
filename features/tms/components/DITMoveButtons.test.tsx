/**
 * Tests for DITMoveButtons component.
 * Feature: tms-inline-interactions, Properties 13 and 14
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DITMoveButtons } from './DITMoveButtons';
import type { Task } from '@/types';
import type { DITState } from '../handlers/DITHandler';

function makeTask(id = 'task-1'): Task {
  return {
    id,
    description: 'Test task',
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

function makeDITState(overrides: Partial<DITState> = {}): DITState {
  return {
    todayTasks: [],
    tomorrowTasks: [],
    lastDayChange: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const defaultHandlers = () => ({
  onMoveToToday: vi.fn(),
  onMoveToTomorrow: vi.fn(),
  onMoveToInbox: vi.fn(),
});

describe('DITMoveButtons', () => {
  // ── Property 13: button visibility based on schedule state ────────────────

  it('shows Today and Tomorrow buttons when task is unscheduled', () => {
    const task = makeTask();
    render(<DITMoveButtons task={task} ditState={makeDITState()} {...defaultHandlers()} />);
    expect(screen.getByRole('button', { name: /move to today/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /move to tomorrow/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /move to inbox/i })).toBeNull();
  });

  it('hides Today button and shows Inbox when task is in todayTasks', () => {
    const task = makeTask('t1');
    render(
      <DITMoveButtons
        task={task}
        ditState={makeDITState({ todayTasks: ['t1'] })}
        {...defaultHandlers()}
      />
    );
    expect(screen.queryByRole('button', { name: /move to today/i })).toBeNull();
    expect(screen.getByRole('button', { name: /move to tomorrow/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /move to inbox/i })).toBeTruthy();
  });

  it('hides Tomorrow button and shows Inbox when task is in tomorrowTasks', () => {
    const task = makeTask('t1');
    render(
      <DITMoveButtons
        task={task}
        ditState={makeDITState({ tomorrowTasks: ['t1'] })}
        {...defaultHandlers()}
      />
    );
    expect(screen.getByRole('button', { name: /move to today/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /move to tomorrow/i })).toBeNull();
    expect(screen.getByRole('button', { name: /move to inbox/i })).toBeTruthy();
  });

  it('hides both Today and Tomorrow and shows Inbox when task is in both lists', () => {
    const task = makeTask('t1');
    render(
      <DITMoveButtons
        task={task}
        ditState={makeDITState({ todayTasks: ['t1'], tomorrowTasks: ['t1'] })}
        {...defaultHandlers()}
      />
    );
    expect(screen.queryByRole('button', { name: /move to today/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /move to tomorrow/i })).toBeNull();
    expect(screen.getByRole('button', { name: /move to inbox/i })).toBeTruthy();
  });

  // ── Dispatch calls ────────────────────────────────────────────────────────

  it('clicking Today calls onMoveToToday with task id', () => {
    const handlers = defaultHandlers();
    const task = makeTask('t1');
    render(<DITMoveButtons task={task} ditState={makeDITState()} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /move to today/i }));
    expect(handlers.onMoveToToday).toHaveBeenCalledWith('t1');
  });

  it('clicking Tomorrow calls onMoveToTomorrow with task id', () => {
    const handlers = defaultHandlers();
    const task = makeTask('t1');
    render(<DITMoveButtons task={task} ditState={makeDITState()} {...handlers} />);
    fireEvent.click(screen.getByRole('button', { name: /move to tomorrow/i }));
    expect(handlers.onMoveToTomorrow).toHaveBeenCalledWith('t1');
  });

  it('clicking Inbox calls onMoveToInbox with task id', () => {
    const handlers = defaultHandlers();
    const task = makeTask('t1');
    render(
      <DITMoveButtons
        task={task}
        ditState={makeDITState({ todayTasks: ['t1'] })}
        {...handlers}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /move to inbox/i }));
    expect(handlers.onMoveToInbox).toHaveBeenCalledWith('t1');
  });

  // ── Property 14: aria-labels present ─────────────────────────────────────

  it('all rendered buttons have aria-label attributes', () => {
    const task = makeTask('t1');
    const { container } = render(
      <DITMoveButtons task={task} ditState={makeDITState()} {...defaultHandlers()} />
    );
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn.getAttribute('aria-label')).toBeTruthy();
    });
  });
});
