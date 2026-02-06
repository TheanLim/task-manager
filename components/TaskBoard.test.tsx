import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskBoard } from './TaskBoard';
import { Task, Section, Priority } from '@/types';

describe('TaskBoard', () => {
  const mockSections: Section[] = [
    {
      id: 'sec-1',
      projectId: 'project-1',
      name: 'To Do',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sec-2',
      projectId: 'project-1',
      name: 'In Progress',
      order: 1,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sec-3',
      projectId: 'project-1',
      name: 'Done',
      order: 2,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'project-1',
      description: 'Task in To Do',
      completed: false,
      priority: Priority.HIGH,
      tags: [],
      order: 0,
      sectionId: 'sec-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task,
    {
      id: 'task-2',
      projectId: 'project-1',
      description: 'Task in Progress',
      completed: false,
      priority: Priority.MEDIUM,
      tags: ['urgent'],
      order: 1,
      sectionId: 'sec-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Task,
  ];

  const mockOnTaskClick = vi.fn();
  const mockOnTaskComplete = vi.fn();
  const mockOnTaskMove = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all sections', () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
        onTaskMove={mockOnTaskMove}
      />
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('should display tasks in correct sections', () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
        onTaskMove={mockOnTaskMove}
      />
    );

    expect(screen.getByText('Task in To Do')).toBeInTheDocument();
    expect(screen.getByText('Task in Progress')).toBeInTheDocument();
  });

  it('should show task count for each section', () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
        onTaskMove={mockOnTaskMove}
      />
    );

    const badges = screen.getAllByText(/^[0-9]+$/);
    expect(badges.length).toBeGreaterThan(0);
  });

  it('should show empty state for sections with no tasks', () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
        onTaskMove={mockOnTaskMove}
      />
    );

    expect(screen.getByText('No tasks in this section')).toBeInTheDocument();
  });

  it('should render drag handles for all tasks', () => {
    render(
      <TaskBoard
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={mockOnTaskClick}
        onTaskComplete={mockOnTaskComplete}
        onTaskMove={mockOnTaskMove}
      />
    );

    // Check for draggable elements
    const draggableElements = screen.getAllByRole('button', { name: /Task/i });
    expect(draggableElements.length).toBeGreaterThan(0);
  });
});
