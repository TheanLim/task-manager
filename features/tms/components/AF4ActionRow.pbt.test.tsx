/**
 * Property-based tests for AF4ActionRow.
 * Feature: tms-inline-interactions, Property 4: Each AF4 button dispatches the correct action
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AF4ActionRow } from './AF4ActionRow';
import type { Task } from '@/types';

afterEach(() => cleanup());

function makeTask(id: string, description: string): Task {
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

// Arbitrary for a valid task description (non-empty, reasonable length)
const taskDescriptionArb = fc.string({ minLength: 1, maxLength: 100 });
const taskIdArb = fc.string({ minLength: 1, maxLength: 20 });

describe('AF4ActionRow — property-based tests', () => {
  // Feature: tms-inline-interactions, Property 4: Each AF4 button dispatches the correct action
  it('for any task, clicking Made Progress calls onMadeProgress exactly once', () => {
    fc.assert(
      fc.property(taskIdArb, taskDescriptionArb, (id, description) => {
        const onMadeProgress = vi.fn();
        const task = makeTask(id, description);
        render(
          <AF4ActionRow
            task={task}
            onMadeProgress={onMadeProgress}
            onDone={vi.fn()}
            onSkip={vi.fn()}
            onFlag={vi.fn()}
          />
        );
        fireEvent.click(screen.getByRole('button', { name: /made progress/i }));
        expect(onMadeProgress).toHaveBeenCalledOnce();
        cleanup();
      }),
      { numRuns: 50 },
    );
  });

  it('for any task, clicking Done calls onDone exactly once', () => {
    fc.assert(
      fc.property(taskIdArb, taskDescriptionArb, (id, description) => {
        const onDone = vi.fn();
        const task = makeTask(id, description);
        render(
          <AF4ActionRow
            task={task}
            onMadeProgress={vi.fn()}
            onDone={onDone}
            onSkip={vi.fn()}
            onFlag={vi.fn()}
          />
        );
        fireEvent.click(screen.getByRole('button', { name: /done/i }));
        expect(onDone).toHaveBeenCalledOnce();
        cleanup();
      }),
      { numRuns: 50 },
    );
  });

  it('for any task, aria-labels contain the task description', () => {
    fc.assert(
      fc.property(taskIdArb, taskDescriptionArb, (id, description) => {
        const task = makeTask(id, description);
        render(
          <AF4ActionRow
            task={task}
            onMadeProgress={vi.fn()}
            onDone={vi.fn()}
            onSkip={vi.fn()}
            onFlag={vi.fn()}
          />
        );
        const buttons = screen.getAllByRole('button');
        const allLabelsContainDescription = buttons.every((btn) => {
          const label = btn.getAttribute('aria-label') ?? '';
          return label.includes(description);
        });
        expect(allLabelsContainDescription).toBe(true);
        cleanup();
      }),
      { numRuns: 50 },
    );
  });
});
