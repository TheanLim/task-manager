import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDialog } from './TaskDialog';
import { Task, Priority } from '@/types';

describe('TaskDialog', () => {
  it('should render create mode when no task provided', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} />
    );

    expect(screen.getByText('Create New Task')).toBeInTheDocument();
    expect(screen.getByText('Create Task')).toBeInTheDocument();
  });

  it('should render edit mode when task provided', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const task: Task = {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: null,
      columnId: null,
      description: 'Test Task',
      notes: 'Test notes',
      assignee: 'John',
      priority: Priority.HIGH,
      tags: ['urgent'],
      dueDate: new Date().toISOString(),
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} task={task} />
    );

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
  });

  it('should validate empty task description', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} />
    );

    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid task data', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} />
    );

    const descriptionInput = screen.getByLabelText(/description/i);
    const notesInput = screen.getByLabelText(/notes/i);
    const assigneeInput = screen.getByLabelText(/assignee/i);

    fireEvent.change(descriptionInput, { target: { value: 'New Task' } });
    fireEvent.change(notesInput, { target: { value: 'Task notes' } });
    fireEvent.change(assigneeInput, { target: { value: 'John' } });

    const submitButton = screen.getByText('Create Task');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        description: 'New Task',
        notes: 'Task notes',
        assignee: 'John',
        priority: Priority.NONE,
        tags: [],
        dueDate: null
      });
    });
  });

  it('should add and remove tags', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} />
    );

    const tagInput = screen.getByPlaceholderText(/add tag/i);
    const addButton = screen.getByText('Add');

    // Add a tag
    fireEvent.change(tagInput, { target: { value: 'urgent' } });
    fireEvent.click(addButton);

    expect(screen.getByText('urgent')).toBeInTheDocument();

    // Remove the tag
    const removeButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('svg') && btn.closest('div')?.textContent?.includes('urgent')
    );
    if (removeButton) {
      fireEvent.click(removeButton);
    }

    expect(screen.queryByText('urgent')).not.toBeInTheDocument();
  });

  it('should call onOpenChange when cancel is clicked', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <TaskDialog open={true} onOpenChange={onOpenChange} onSubmit={onSubmit} />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
