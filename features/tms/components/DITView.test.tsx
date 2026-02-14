import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DITView } from './DITView';
import { useTMSStore } from '@/features/tms/stores/tmsStore';
import { Task, Priority, TimeManagementSystem } from '@/types';

// Mock the TMS store
vi.mock('@/features/tms/stores/tmsStore', () => ({
  useTMSStore: vi.fn(),
}));

describe('DITView', () => {
  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'project-1',
      description: 'Task in Today',
      completed: false,
      priority: Priority.HIGH,
      tags: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      projectId: 'project-1',
      description: 'Task in Tomorrow',
      completed: false,
      priority: Priority.MEDIUM,
      tags: [],
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      projectId: 'project-1',
      description: 'Unscheduled Task',
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
  const mockMoveToToday = vi.fn();
  const mockMoveToTomorrow = vi.fn();
  const mockRemoveFromSchedule = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useTMSStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      state: {
        activeSystem: TimeManagementSystem.DIT,
        dit: {
          todayTasks: ['task-1'],
          tomorrowTasks: ['task-2'],
          lastDayChange: new Date().toISOString(),
        },
        af4: {
          markedTasks: [],
          markedOrder: [],
        },
        fvp: {
          dottedTasks: [],
          currentX: null,
          selectionInProgress: false,
        },
      },
      moveToToday: mockMoveToToday,
      moveToTomorrow: mockMoveToTomorrow,
      removeFromSchedule: mockRemoveFromSchedule,
    });
  });

  it('should render Today, Tomorrow, and Unscheduled sections', () => {
    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Unscheduled')).toBeInTheDocument();
  });

  it('should display tasks in correct sections', () => {
    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(screen.getByText('Task in Today')).toBeInTheDocument();
    expect(screen.getByText('Task in Tomorrow')).toBeInTheDocument();
    expect(screen.getByText('Unscheduled Task')).toBeInTheDocument();
  });

  it('should show correct task counts', () => {
    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    // Use getAllByText since there are multiple "1 tasks" badges
    const taskCounts = screen.getAllByText('1 tasks');
    expect(taskCounts).toHaveLength(3); // Today, Tomorrow, Unscheduled
  });

  it('should render drag handles for all tasks', () => {
    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    // Check for draggable elements (they have role="button" with aria-roledescription="draggable")
    const draggableElements = screen.getAllByRole('button', { name: /Task/i });
    expect(draggableElements.length).toBeGreaterThan(0);
  });

  it('should show empty state when no tasks in Today', () => {
    (useTMSStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      state: {
        activeSystem: TimeManagementSystem.DIT,
        dit: {
          todayTasks: [],
          tomorrowTasks: ['task-2'],
          lastDayChange: new Date().toISOString(),
        },
        af4: { markedTasks: [], markedOrder: [] },
        fvp: { dottedTasks: [], currentX: null, selectionInProgress: false },
      },
      moveToToday: mockMoveToToday,
      moveToTomorrow: mockMoveToTomorrow,
      removeFromSchedule: mockRemoveFromSchedule,
    });

    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(
      screen.getByText(/No tasks scheduled for today/i)
    ).toBeInTheDocument();
  });

  it('should show empty state when no tasks in Tomorrow', () => {
    (useTMSStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      state: {
        activeSystem: TimeManagementSystem.DIT,
        dit: {
          todayTasks: ['task-1'],
          tomorrowTasks: [],
          lastDayChange: new Date().toISOString(),
        },
        af4: { markedTasks: [], markedOrder: [] },
        fvp: { dottedTasks: [], currentX: null, selectionInProgress: false },
      },
      moveToToday: mockMoveToToday,
      moveToTomorrow: mockMoveToTomorrow,
      removeFromSchedule: mockRemoveFromSchedule,
    });

    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    expect(
      screen.getByText(/No tasks scheduled for tomorrow/i)
    ).toBeInTheDocument();
  });

  it('should show move buttons for tasks', () => {
    render(
      <DITView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
      />
    );

    // Tomorrow tasks should have "Move to Today" button
    // Today tasks should have "Move to Tomorrow" button
    const moveToTodayButton = screen.getByRole('button', { name: 'Move to Today' });
    const moveToTomorrowButton = screen.getByRole('button', { name: 'Move to Tomorrow' });
    
    expect(moveToTodayButton).toBeInTheDocument();
    expect(moveToTomorrowButton).toBeInTheDocument();
  });
});
