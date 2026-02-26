/**
 * TaskRow trailingSlot prop — TDD test
 *
 * trailingSlot renders inline in the name cell, right before the
 * reinsert / view-details buttons. Used by DIT for move buttons.
 *
 * Written BEFORE implementation — must FAIL first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { Task, Priority } from '@/types';
import { useDataStore } from '@/stores/dataStore';

vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn(),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: null,
    sectionId: null,
    parentTaskId: null,
    description: 'Test task',
    notes: '',
    assignee: '',
    priority: 'none' as Priority,
    tags: [],
    dueDate: null,
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    lastActionAt: null,
    ...overrides,
  };
}

const baseProps = {
  onComplete: vi.fn(),
  onClick: vi.fn(),
  onViewSubtasks: vi.fn(),
  columnOrder: ['dueDate', 'priority'] as any[],
};

function renderInTable(ui: React.ReactElement) {
  return render(<table><tbody>{ui}</tbody></table>);
}

beforeEach(() => {
  vi.clearAllMocks();
  (useDataStore as any).mockReturnValue({
    getSubtasks: vi.fn(() => []),
    updateTask: vi.fn(),
  });
});

describe('TaskRow trailingSlot prop', () => {
  it('renders trailingSlot content in the name cell', () => {
    renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        trailingSlot={<button data-testid="dit-move">→ Tomorrow</button>}
      />,
    );
    expect(screen.getByTestId('dit-move')).toBeInTheDocument();
  });

  it('trailingSlot is inside the first td (name cell)', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        trailingSlot={<button data-testid="dit-move">→ Tomorrow</button>}
      />,
    );
    const firstTd = container.querySelector('tr[data-task-id="task-1"] > td:first-child')!;
    expect(firstTd.querySelector('[data-testid="dit-move"]')).not.toBeNull();
  });

  it('does not render trailingSlot when prop is not provided', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} />,
    );
    expect(container.querySelector('[data-testid="dit-move"]')).toBeNull();
  });

  it('trailingSlot buttons stop propagation (do not trigger row click)', () => {
    const onClick = vi.fn();
    const onMove = vi.fn();
    renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        onClick={onClick}
        trailingSlot={
          <button
            data-testid="dit-move"
            onClick={(e) => { e.stopPropagation(); onMove(); }}
          >
            → Tomorrow
          </button>
        }
      />,
    );
    fireEvent.click(screen.getByTestId('dit-move'));
    expect(onMove).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('trailingSlot shows on hover (has group-hover opacity classes)', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        trailingSlot={<button>→ Tomorrow</button>}
      />,
    );
    // The wrapper div should have opacity-0 group-hover:opacity-100
    const wrapper = container.querySelector('[data-slot="trailing"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain('opacity-0');
    expect(wrapper!.className).toContain('group-hover:opacity-100');
  });
});
