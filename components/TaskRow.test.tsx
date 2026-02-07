import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskRow } from './TaskRow';
import { Task, Priority } from '@/types';
import { useDataStore } from '@/stores/dataStore';

// Mock the data store
vi.mock('@/stores/dataStore', () => ({
  useDataStore: vi.fn()
}));

describe('TaskRow Component', () => {
  const mockTask: Task = {
    id: 'task-1',
    projectId: 'project-1',
    sectionId: 'section-1',
    parentTaskId: null,
    description: 'Test task',
    notes: '',
    assignee: 'John Doe',
    priority: Priority.HIGH,
    tags: ['tag1', 'tag2', 'tag3'],
    dueDate: '2024-12-31T00:00:00.000Z',
    completed: false,
    completedAt: null,
    order: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  const mockOnComplete = vi.fn();
  const mockOnClick = vi.fn();
  const mockOnViewSubtasks = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useDataStore as any).mockReturnValue({
      getSubtasks: vi.fn(() => [])
    });
  });

  // Helper to render TaskRow within a table
  const renderTaskRow = (props: any) => {
    return render(
      <table>
        <tbody>
          <TaskRow {...props} />
        </tbody>
      </table>
    );
  };

  describe('Basic Rendering', () => {
    it('should render task description', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.getByText('Test task')).toBeInTheDocument();
    });

    it('should render completion tick button', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const tickButton = screen.getByLabelText('Mark as complete');
      expect(tickButton).toBeInTheDocument();
    });

    it('should render Details button', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.getByLabelText('View details')).toBeInTheDocument();
    });
  });

  describe('Completion Status', () => {
    it('should show green tick button when task is completed', () => {
      const completedTask = { ...mockTask, completed: true };
      renderTaskRow({
        task: completedTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const tickButton = screen.getByLabelText('Mark as incomplete');
      expect(tickButton).toHaveClass('bg-green-500');
    });

    it('should show gray tick button when task is incomplete', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const tickButton = screen.getByLabelText('Mark as complete');
      expect(tickButton).toHaveClass('border-gray-300');
    });

    it('should call onComplete when tick button is clicked', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const tickButton = screen.getByLabelText('Mark as complete');
      fireEvent.click(tickButton);

      expect(mockOnComplete).toHaveBeenCalledWith('task-1');
    });

    it('should show strikethrough text when task is completed', () => {
      const completedTask = { ...mockTask, completed: true };
      renderTaskRow({
        task: completedTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const taskText = screen.getByText('Test task');
      expect(taskText).toHaveClass('line-through');
    });
  });

  describe('Task Interaction', () => {
    it('should call onClick when task name is clicked', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const taskName = screen.getByText('Test task');
      fireEvent.click(taskName);

      expect(mockOnClick).toHaveBeenCalledWith('task-1');
    });

    it('should call onClick when Details button is clicked', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const detailsButton = screen.getByLabelText('View details');
      fireEvent.click(detailsButton);

      expect(mockOnClick).toHaveBeenCalledWith('task-1');
    });
  });

  describe('Configurable Columns', () => {
    it('should display due date when present', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      // Check for the date text (format may vary based on timezone)
      expect(screen.getByText(/Dec 3[01]/)).toBeInTheDocument();
    });

    it('should display priority badge when not NONE', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.getByText('high')).toBeInTheDocument();
    });

    it('should not display priority badge when priority is NONE', () => {
      const taskWithNoPriority = { ...mockTask, priority: Priority.NONE };
      renderTaskRow({
        task: taskWithNoPriority,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.queryByText('none')).not.toBeInTheDocument();
    });

    it('should display assignee when present', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should display tags with overflow indicator', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      // Should show first 2 tags
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      
      // Should show +1 for the third tag
      expect(screen.getByText('+1')).toBeInTheDocument();
    });
  });

  describe('Subtasks Functionality', () => {
    const mockSubtasks: Task[] = [
      {
        id: 'subtask-1',
        projectId: 'project-1',
        sectionId: 'section-1',
        parentTaskId: 'task-1',
        description: 'Subtask 1',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        id: 'subtask-2',
        projectId: 'project-1',
        sectionId: 'section-1',
        parentTaskId: 'task-1',
        description: 'Subtask 2',
        notes: '',
        assignee: '',
        priority: Priority.NONE,
        tags: [],
        dueDate: null,
        completed: false,
        completedAt: null,
        order: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ];

    beforeEach(() => {
      (useDataStore as any).mockReturnValue({
        getSubtasks: vi.fn(() => mockSubtasks)
      });
    });

    it('should show expand/collapse button when task has subtasks', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.getByLabelText('Expand subtasks')).toBeInTheDocument();
    });

    it('should toggle subtask visibility when expand/collapse button is clicked', () => {
      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      const expandButton = screen.getByLabelText('Expand subtasks');
      
      // Subtasks should not be visible initially
      expect(screen.queryByText('Subtask 1')).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(expandButton);

      // Subtasks should now be visible
      expect(screen.getByText('Subtask 1')).toBeInTheDocument();
      expect(screen.getByText('Subtask 2')).toBeInTheDocument();

      // Button label should change
      expect(screen.getByLabelText('Collapse subtasks')).toBeInTheDocument();
    });

    it('should not show expand/collapse button when task has no subtasks', () => {
      (useDataStore as any).mockReturnValue({
        getSubtasks: vi.fn(() => [])
      });

      renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks
      });

      expect(screen.queryByLabelText('Expand subtasks')).not.toBeInTheDocument();
    });
  });

  describe('Drag and Drop', () => {
    it('should be draggable when draggable prop is true', () => {
      const mockOnDragStart = vi.fn();
      
      const { container } = renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks,
        draggable: true,
        onDragStart: mockOnDragStart
      });

      // The draggable attribute is on the tr element
      const draggableRow = container.querySelector('[draggable="true"]');
      expect(draggableRow).toBeInTheDocument();
    });

    it('should not be draggable when draggable prop is false', () => {
      const { container } = renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks,
        draggable: false
      });

      // The draggable attribute should be false
      const draggableRow = container.querySelector('[draggable="false"]');
      expect(draggableRow).toBeInTheDocument();
    });
  });

  describe('Depth and Indentation', () => {
    it('should apply indentation based on depth', () => {
      const { container } = renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks,
        depth: 2
      });

      // Find the task name cell's inner div which has the padding
      const taskNameCell = screen.getByText('Test task').closest('div');
      expect(taskNameCell).toHaveStyle({ paddingLeft: '48px' }); // 2 * 24px
    });

    it('should not apply indentation when depth is 0', () => {
      const { container } = renderTaskRow({
        task: mockTask,
        onComplete: mockOnComplete,
        onClick: mockOnClick,
        onViewSubtasks: mockOnViewSubtasks,
        depth: 0
      });

      // Find the task name cell's inner div which has the padding
      const taskNameCell = screen.getByText('Test task').closest('div');
      expect(taskNameCell).toHaveStyle({ paddingLeft: '0' });
    });
  });
});
