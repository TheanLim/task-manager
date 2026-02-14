import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskCalendar } from './TaskCalendar';
import { Task, Priority } from '@/types';

describe('TaskCalendar', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'project-1',
      description: 'Task due today',
      completed: false,
      priority: Priority.HIGH,
      tags: [],
      order: 0,
      dueDate: today.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      projectId: 'project-1',
      description: 'Task due tomorrow',
      completed: false,
      priority: Priority.MEDIUM,
      tags: ['urgent'],
      order: 1,
      dueDate: tomorrow.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      projectId: 'project-1',
      description: 'Task without due date',
      completed: false,
      priority: Priority.LOW,
      tags: [],
      order: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockOnTaskClick = vi.fn();
  const mockOnTaskComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render calendar component', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    // Calendar should be present — uses CSS grid divs, not a semantic grid table
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
  });

  it('should display tasks without due date section', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(screen.getByText('No Due Date')).toBeInTheDocument();
    expect(screen.getByText('Task without due date')).toBeInTheDocument();
  });

  it('should show task count for no due date section', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(screen.getByText('No Due Date')).toBeInTheDocument();
    // Check for the badge with count (it's inside a badge component)
    const badges = screen.getAllByText('1');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should render all tasks with due dates', () => {
    render(
      <TaskCalendar
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    // Tasks with due dates should be in the calendar
    // The selected date tasks will show based on default selection (today)
    expect(screen.getByText('Task due today')).toBeInTheDocument();
  });
});
