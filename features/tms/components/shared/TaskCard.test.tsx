import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { Priority } from '@/types';
import type { Task } from '@/types';

// Mock shadcn Checkbox minimally
vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ onClick, checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      data-testid="task-checkbox"
      checked={checked ?? false}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      onClick={onClick}
      readOnly={!onCheckedChange}
      {...props}
    />
  ),
}));

const makeTask = (overrides?: Partial<Task>): Task => ({
  id: 'task-1',
  projectId: 'p1',
  parentTaskId: null,
  sectionId: null,
  description: 'Test task description',
  notes: '',
  assignee: '',
  priority: Priority.NONE,
  tags: [],
  dueDate: null,
  completed: false,
  completedAt: null,
  order: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe('TaskCard', () => {
  describe('variants', () => {
    it('variant="current" renders bg-[#131a19] and border-primary classes', () => {
      const { container } = render(
        <TaskCard task={makeTask()} variant="current" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-[#131a19]');
      expect(card.className).toContain('border-primary');
    });

    it('variant="flagged" renders before:bg-amber-500 accent bar classes', () => {
      const { container } = render(
        <TaskCard task={makeTask()} variant="flagged" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('before:bg-amber-500');
      expect(card.className).toContain('bg-[#1a1510]');
    });

    it('variant="attention" renders before:bg-primary accent bar classes', () => {
      const { container } = render(
        <TaskCard task={makeTask()} variant="attention" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('before:bg-primary');
      expect(card.className).toContain('bg-[#0f1a19]');
    });

    it('variant="default" renders bg-card and border-border classes', () => {
      const { container } = render(
        <TaskCard task={makeTask()} variant="default" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('bg-card');
      expect(card.className).toContain('border-border');
    });

    it('variant="completed" renders opacity-60', () => {
      const { container } = render(
        <TaskCard task={makeTask({ completed: true })} variant="completed" />
      );
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('opacity-60');
    });
  });

  describe('dotted prop', () => {
    it('dotted={true} renders the teal dot indicator', () => {
      const { container } = render(
        <TaskCard task={makeTask()} dotted={true} />
      );
      // dot: w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5
      const dot = container.querySelector('.bg-primary.rounded-full.w-2.h-2');
      expect(dot).not.toBeNull();
    });

    it('dotted={false} does not render the dot indicator', () => {
      const { container } = render(
        <TaskCard task={makeTask()} dotted={false} />
      );
      const dot = container.querySelector('.bg-primary.rounded-full.w-2.h-2');
      expect(dot).toBeNull();
    });
  });

  describe('actions slot', () => {
    it('renders actions below task text separated by border', () => {
      const { getByTestId, container } = render(
        <TaskCard
          task={makeTask()}
          actions={<button data-testid="action-btn">Do something</button>}
        />
      );
      expect(getByTestId('action-btn')).toBeTruthy();
      // The actions wrapper should have border-t border-border mt-3 pt-3
      const actionsWrapper = container.querySelector('.border-t.border-border.mt-3.pt-3');
      expect(actionsWrapper).not.toBeNull();
    });

    it('does not render actions wrapper when actions prop is not provided', () => {
      const { container } = render(<TaskCard task={makeTask()} />);
      const actionsWrapper = container.querySelector('.border-t.border-border.mt-3.pt-3');
      expect(actionsWrapper).toBeNull();
    });
  });

  describe('keyboard interactions', () => {
    it('Enter key on card calls onClick', () => {
      const onClick = vi.fn();
      const { container } = render(
        <TaskCard task={makeTask()} onClick={onClick} />
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('Space key on card calls onComplete', () => {
      const onComplete = vi.fn();
      const { container } = render(
        <TaskCard task={makeTask()} onComplete={onComplete} />
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.keyDown(card, { key: ' ' });
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('Enter key does not call onClick when onClick is not provided', () => {
      // Should not throw
      const { container } = render(<TaskCard task={makeTask()} />);
      const card = container.firstChild as HTMLElement;
      expect(() => fireEvent.keyDown(card, { key: 'Enter' })).not.toThrow();
    });
  });

  describe('checkbox', () => {
    it('checkbox onClick stops propagation', () => {
      const onClick = vi.fn();
      render(<TaskCard task={makeTask()} onClick={onClick} />);
      const checkbox = screen.getByTestId('task-checkbox');
      fireEvent.click(checkbox);
      // Card's onClick should NOT be called because checkbox stops propagation
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('touch target', () => {
    it('min-h-[44px] touch target is present on the card', () => {
      const { container } = render(<TaskCard task={makeTask()} />);
      const card = container.firstChild as HTMLElement;
      expect(card.className).toContain('min-h-[44px]');
    });
  });

  describe('accessibility', () => {
    it('has role="article"', () => {
      render(<TaskCard task={makeTask()} />);
      expect(screen.getByRole('article')).toBeTruthy();
    });
  });

  describe('task text', () => {
    it('renders task description', () => {
      render(<TaskCard task={makeTask({ description: 'My important task' })} />);
      expect(screen.getByText('My important task')).toBeTruthy();
    });

    it('applies line-through when task is completed', () => {
      const { container } = render(
        <TaskCard task={makeTask({ completed: true })} />
      );
      const textEl = container.querySelector('.line-through');
      expect(textEl).not.toBeNull();
    });
  });
});
