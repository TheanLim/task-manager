import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskList } from './TaskList';
import { Task, Section, Priority, ViewMode } from '@/types';

describe('TaskList', () => {
  const mockSections: Section[] = [
    {
      id: 'section-1',
      projectId: 'project-1',
      name: 'To Do',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'section-2',
      projectId: 'project-1',
      name: 'In Progress',
      order: 1,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Task 1',
      notes: '',
      assignee: 'John',
      priority: Priority.HIGH,
      tags: ['urgent'],
      dueDate: new Date().toISOString(),
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'task-2',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-2',
      description: 'Task 2',
      notes: '',
      assignee: '',
      priority: Priority.NONE,
      tags: [],
      dueDate: null,
      completed: true,
      completedAt: new Date().toISOString(),
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  it('should render empty state when no tasks', () => {
    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={[]}
        sections={[]}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    expect(screen.getByText('No tasks — press n to create one')).toBeInTheDocument();
  });

  it('should render tasks grouped by sections', () => {
    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    expect(screen.getByText('To Do')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('should call onTaskClick when task is clicked', () => {
    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    // Click the chevron button to open task details
    const chevronButtons = screen.getAllByLabelText('View details');
    fireEvent.click(chevronButtons[0]);
    expect(onTaskClick).toHaveBeenCalledWith('task-1');
  });

  it('should display task properties', () => {
    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    // Assignee is now in an InlineEditable component
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('should show completed tasks with line-through', () => {
    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={mockTasks}
        sections={mockSections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    const task2 = screen.getByText('Task 2');
    expect(task2).toHaveClass('line-through');
  });

  it('should render subtasks when parent is expanded', () => {
    const taskWithSubtask: Task = {
      ...mockTasks[0],
      id: 'parent-task'
    };

    const subtask: Task = {
      ...mockTasks[0],
      id: 'subtask-1',
      parentTaskId: 'parent-task',
      description: 'Subtask 1'
    };

    const onTaskClick = vi.fn();
    const onTaskComplete = vi.fn();
    const onAddTask = vi.fn();

    render(
      <TaskList
        tasks={[taskWithSubtask, subtask]}
        sections={mockSections}
        onTaskClick={onTaskClick}
        onTaskComplete={onTaskComplete}
        onAddTask={onAddTask}
      />
    );

    // Parent task should be visible
    expect(screen.getByText('Task 1')).toBeInTheDocument();
    
    // Subtask should not be visible initially (it's collapsed by default)
    // Note: In the actual implementation, subtasks are collapsed by default in TaskRow
    expect(screen.queryByText('Subtask 1')).not.toBeInTheDocument();
  });

  describe('default sort by last action time (initialSortByProject)', () => {
    const singleSection: Section[] = [
      {
        id: 'section-1',
        projectId: 'project-1',
        name: 'To Do',
        order: 0,
        collapsed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const tasksWithLastAction: Task[] = [
      {
        id: 'task-newest',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: 'section-1',
        description: 'Newest Action',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastActionAt: '2025-06-15T00:00:00.000Z',
      },
      {
        id: 'task-oldest',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: 'section-1',
        description: 'Oldest Action',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 1,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastActionAt: '2025-01-10T00:00:00.000Z',
      },
      {
        id: 'task-null',
        projectId: 'project-1',
        parentTaskId: null,
        sectionId: 'section-1',
        description: 'Null Action (uses createdAt)',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 2,
        createdAt: '2024-06-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        lastActionAt: null,
      },
    ];

    it('should sort by effective last action time ascending when showReinsertButton is true and no column sort', () => {
      render(
        <TaskList
          tasks={tasksWithLastAction}
          sections={singleSection}
          onTaskClick={vi.fn()}
          onTaskComplete={vi.fn()}
          onAddTask={vi.fn()}
          initialSortByProject={true}
          showReinsertButton={true}
        />
      );

      // All three task descriptions should be present
      expect(screen.getByText('Null Action (uses createdAt)')).toBeInTheDocument();
      expect(screen.getByText('Oldest Action')).toBeInTheDocument();
      expect(screen.getByText('Newest Action')).toBeInTheDocument();

      // Verify ascending order by effective last action time:
      // Null Action (createdAt 2024-06-01) < Oldest Action (2025-01-10) < Newest Action (2025-06-15)
      const nullEl = screen.getByText('Null Action (uses createdAt)');
      const oldestEl = screen.getByText('Oldest Action');
      const newestEl = screen.getByText('Newest Action');

      // Use DOM order: earlier in document = rendered first
      const positions = [nullEl, oldestEl, newestEl].map(el => {
        // compareDocumentPosition bit 4 = DOCUMENT_POSITION_FOLLOWING
        return el;
      });
      // nullEl should come before oldestEl, oldestEl before newestEl
      expect(nullEl.compareDocumentPosition(oldestEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(oldestEl.compareDocumentPosition(newestEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('should use order-based sort when initialSortByProject is false and no column sort', () => {
      render(
        <TaskList
          tasks={tasksWithLastAction}
          sections={singleSection}
          onTaskClick={vi.fn()}
          onTaskComplete={vi.fn()}
          onAddTask={vi.fn()}
          initialSortByProject={false}
        />
      );

      // Order-based: order 0 (Newest Action), 1 (Oldest Action), 2 (Null Action)
      const newestEl = screen.getByText('Newest Action');
      const oldestEl = screen.getByText('Oldest Action');
      const nullEl = screen.getByText('Null Action (uses createdAt)');

      expect(newestEl.compareDocumentPosition(oldestEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(oldestEl.compareDocumentPosition(nullEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
