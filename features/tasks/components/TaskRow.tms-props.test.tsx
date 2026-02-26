/**
 * TaskRow TMS integration props — TDD tests
 *
 * Tests for the new props that allow TMS views to reuse TaskRow:
 *   - tmsVariant: applies system-specific CSS classes to the <tr>
 *   - leadingSlot: renders content before the checkbox (e.g. FVP dot)
 *   - actionsSlot: renders an inline actions row below the task (e.g. AF4 buttons)
 *
 * Written BEFORE implementation — these must FAIL first.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { Task, Priority } from '@/types';
import { useDataStore } from '@/stores/dataStore';

// Mock the data store
vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── tmsVariant tests ──────────────────────────────────────────────────────────

describe('TaskRow tmsVariant prop', () => {
  it('applies no TMS class when tmsVariant is undefined (default behavior)', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).not.toContain('tms-');
  });

  it('applies tms-af4-current class when tmsVariant is "current"', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} tmsVariant="current" />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).toContain('tms-af4-current');
  });

  it('applies tms-fvp-dotted-row class when tmsVariant is "dotted"', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} tmsVariant="dotted" />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).toContain('tms-fvp-dotted-row');
  });

  it('applies tms-af4-dismissed class when tmsVariant is "flagged"', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} tmsVariant="flagged" />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).toContain('tms-af4-dismissed');
  });

  it('applies tms-std-attention class when tmsVariant is "attention"', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} tmsVariant="attention" />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).toContain('tms-std-attention');
  });
});

// ── leadingSlot tests ─────────────────────────────────────────────────────────

describe('TaskRow leadingSlot prop', () => {
  it('renders leadingSlot content before the checkbox', () => {
    renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        leadingSlot={<span data-testid="fvp-dot" className="bg-accent-brand rounded-full w-2.5 h-2.5" />}
      />,
    );
    expect(screen.getByTestId('fvp-dot')).toBeInTheDocument();
  });

  it('does not render leadingSlot wrapper when prop is not provided', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} />,
    );
    expect(container.querySelector('[data-testid="fvp-dot"]')).toBeNull();
  });

  it('leadingSlot appears in the name cell (first td)', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        leadingSlot={<span data-testid="leading-indicator" />}
      />,
    );
    const firstTd = container.querySelector('tr[data-task-id="task-1"] > td:first-child')!;
    expect(firstTd.querySelector('[data-testid="leading-indicator"]')).not.toBeNull();
  });
});

// ── actionsSlot tests ─────────────────────────────────────────────────────────

describe('TaskRow actionsSlot prop', () => {
  it('renders actionsSlot as an extra row below the task row', () => {
    renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        actionsSlot={
          <div data-testid="tms-actions">
            <button>Made progress</button>
            <button>Done</button>
          </div>
        }
      />,
    );
    expect(screen.getByTestId('tms-actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Made progress' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  it('does not render actions row when actionsSlot is not provided', () => {
    const { container } = renderInTable(
      <TaskRow task={makeTask()} {...baseProps} />,
    );
    expect(container.querySelector('[data-testid="tms-actions"]')).toBeNull();
  });

  it('actionsSlot row spans all columns', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        columnOrder={['dueDate', 'priority', 'tags'] as any[]}
        actionsSlot={<div data-testid="tms-actions">Actions</div>}
      />,
    );
    // The actions row should have a td with colSpan = 1 (name) + 3 (data cols) = 4
    const actionsTd = container.querySelector('[data-testid="tms-actions"]')?.closest('td');
    expect(actionsTd).not.toBeNull();
    // colSpan should cover all columns
    expect(actionsTd!.getAttribute('colspan')).toBe('4');
  });

  it('clicking inside actionsSlot does not trigger row onClick', () => {
    const onClick = vi.fn();
    renderInTable(
      <TaskRow
        task={makeTask()}
        {...baseProps}
        onClick={onClick}
        actionsSlot={
          <div data-testid="tms-actions">
            <button onClick={(e) => e.stopPropagation()}>AF4 Action</button>
          </div>
        }
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'AF4 Action' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ── Combined usage (simulating real TMS scenarios) ────────────────────────────

describe('TaskRow TMS combined usage', () => {
  it('FVP scenario: dotted variant + leading dot indicator', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask({ description: 'FVP dotted task' })}
        {...baseProps}
        tmsVariant="dotted"
        leadingSlot={<span data-testid="fvp-dot" className="bg-accent-brand rounded-full" />}
      />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    expect(tr.className).toContain('tms-fvp-dotted-row');
    expect(screen.getByTestId('fvp-dot')).toBeInTheDocument();
    expect(screen.getByText('FVP dotted task')).toBeInTheDocument();
  });

  it('AF4 scenario: current variant + action buttons', () => {
    const onMadeProgress = vi.fn();
    renderInTable(
      <TaskRow
        task={makeTask({ description: 'AF4 current task' })}
        {...baseProps}
        tmsVariant="current"
        actionsSlot={
          <div data-testid="tms-actions">
            <button onClick={(e) => { e.stopPropagation(); onMadeProgress(); }}>
              Made progress
            </button>
          </div>
        }
      />,
    );
    expect(screen.getByText('AF4 current task')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Made progress' }));
    expect(onMadeProgress).toHaveBeenCalled();
  });

  it('existing behavior is preserved when no TMS props are passed', () => {
    const { container } = renderInTable(
      <TaskRow
        task={makeTask({ description: 'Normal task', dueDate: '2024-12-31T00:00:00.000Z' })}
        {...baseProps}
      />,
    );
    const tr = container.querySelector('tr[data-task-id="task-1"]')!;
    // No TMS classes
    expect(tr.className).not.toContain('tms-');
    // Normal rendering
    expect(screen.getByText('Normal task')).toBeInTheDocument();
    expect(screen.getByLabelText('Mark as complete')).toBeInTheDocument();
  });
});
