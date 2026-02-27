/**
 * Property-based tests for DITMoveButtons.
 * Feature: tms-inline-interactions, Property 13: DIT move buttons shown based on task schedule state
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DITMoveButtons } from './DITMoveButtons';
import type { Task } from '@/types';
import type { DITState } from '../handlers/DITHandler';

afterEach(() => cleanup());

function makeTask(id: string): Task {
  return {
    id,
    description: `Task ${id}`,
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

const taskIdArb = fc.string({ minLength: 1, maxLength: 20 });
const taskIdListArb = fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 10 });

describe('DITMoveButtons — property-based tests', () => {
  // Feature: tms-inline-interactions, Property 13
  it('for any task not in todayTasks, Today button is shown', () => {
    fc.assert(
      fc.property(taskIdArb, taskIdListArb, taskIdListArb, (taskId, todayIds, tomorrowIds) => {
        // Ensure taskId is NOT in todayTasks
        const todayTasks = todayIds.filter((id) => id !== taskId);
        const ditState: DITState = {
          todayTasks,
          tomorrowTasks: tomorrowIds,
          lastDayChange: '2024-01-01T00:00:00.000Z',
        };
        const task = makeTask(taskId);
        render(
          <DITMoveButtons
            task={task}
            ditState={ditState}
            onMoveToToday={vi.fn()}
            onMoveToTomorrow={vi.fn()}
            onMoveToInbox={vi.fn()}
          />
        );
        expect(screen.queryByRole('button', { name: /move to today/i })).not.toBeNull();
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('for any task in todayTasks, Today button is NOT shown', () => {
    fc.assert(
      fc.property(taskIdArb, taskIdListArb, (taskId, otherIds) => {
        const ditState: DITState = {
          todayTasks: [taskId, ...otherIds.filter((id) => id !== taskId)],
          tomorrowTasks: [],
          lastDayChange: '2024-01-01T00:00:00.000Z',
        };
        const task = makeTask(taskId);
        render(
          <DITMoveButtons
            task={task}
            ditState={ditState}
            onMoveToToday={vi.fn()}
            onMoveToTomorrow={vi.fn()}
            onMoveToInbox={vi.fn()}
          />
        );
        expect(screen.queryByRole('button', { name: /move to today/i })).toBeNull();
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('for any task in todayTasks or tomorrowTasks, Inbox button is shown', () => {
    fc.assert(
      fc.property(taskIdArb, fc.boolean(), (taskId, inToday) => {
        const ditState: DITState = {
          todayTasks: inToday ? [taskId] : [],
          tomorrowTasks: inToday ? [] : [taskId],
          lastDayChange: '2024-01-01T00:00:00.000Z',
        };
        const task = makeTask(taskId);
        render(
          <DITMoveButtons
            task={task}
            ditState={ditState}
            onMoveToToday={vi.fn()}
            onMoveToTomorrow={vi.fn()}
            onMoveToInbox={vi.fn()}
          />
        );
        expect(screen.queryByRole('button', { name: /move to inbox/i })).not.toBeNull();
        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('for any task not scheduled, Inbox button is NOT shown', () => {
    fc.assert(
      fc.property(taskIdArb, taskIdListArb, taskIdListArb, (taskId, todayIds, tomorrowIds) => {
        const todayTasks = todayIds.filter((id) => id !== taskId);
        const tomorrowTasks = tomorrowIds.filter((id) => id !== taskId);
        const ditState: DITState = {
          todayTasks,
          tomorrowTasks,
          lastDayChange: '2024-01-01T00:00:00.000Z',
        };
        const task = makeTask(taskId);
        render(
          <DITMoveButtons
            task={task}
            ditState={ditState}
            onMoveToToday={vi.fn()}
            onMoveToTomorrow={vi.fn()}
            onMoveToInbox={vi.fn()}
          />
        );
        expect(screen.queryByRole('button', { name: /move to inbox/i })).toBeNull();
        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
