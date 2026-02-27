/**
 * Property-based tests for AF4FlaggedNotice.
 * Feature: tms-inline-interactions, Property 22: Flagged notice count matches dismissed task count
 */

import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AF4FlaggedNotice } from './AF4FlaggedNotice';
import type { Task } from '@/types';

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

const taskIdArb = fc.string({ minLength: 1, maxLength: 15 });

describe('AF4FlaggedNotice — property-based tests', () => {
  // Feature: tms-inline-interactions, Property 22
  it('for any non-empty dismissed list, the notice shows the correct count', () => {
    fc.assert(
      fc.property(
        fc.array(taskIdArb, { minLength: 1, maxLength: 10 }).map((ids) => [...new Set(ids)]),
        (dismissedIds) => {
          const tasks = dismissedIds.map(makeTask);
          render(
            <AF4FlaggedNotice
              dismissedTaskIds={dismissedIds}
              tasks={tasks}
              onResolve={vi.fn()}
            />
          );
          const count = dismissedIds.length;
          const singular = count === 1 ? 'task' : 'tasks';
          // The notice text contains the count
          const noticeText = screen.getByText(new RegExp(`${count} flagged ${singular}`, 'i'));
          expect(noticeText).toBeTruthy();
          cleanup();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: tms-inline-interactions, Property 24
  it('for any empty dismissed list, the notice is not rendered', () => {
    fc.assert(
      fc.property(fc.constant([]), (_dismissedIds) => {
        const { container } = render(
          <AF4FlaggedNotice dismissedTaskIds={[]} tasks={[]} onResolve={vi.fn()} />
        );
        expect(container.firstChild).toBeNull();
        cleanup();
      }),
      { numRuns: 10 },
    );
  });
});
