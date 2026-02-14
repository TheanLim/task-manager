import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectDialog } from './ProjectDialog';
import { Project, ViewMode } from '@/types';

describe('ProjectDialog', () => {
  it('should render create mode when no project provided', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  it('should render edit mode when project provided', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();
    const project: Project = {
      id: 'project-1',
      name: 'Test Project',
      description: 'Test description',
      viewMode: ViewMode.LIST,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
        project={project}
      />
    );

    expect(screen.getByText('Edit Project')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Project')).toBeInTheDocument();
  });

  it('should validate empty project name', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/cannot be empty/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should submit valid project data', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(nameInput, { target: { value: 'New Project' } });
    fireEvent.change(descriptionInput, { target: { value: 'Project description' } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'Project description',
        viewMode: ViewMode.LIST
      });
    });
  });

  it('should call onOpenChange when cancel is clicked', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should validate project name length', async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <ProjectDialog
        open={true}
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      />
    );

    const nameInput = screen.getByLabelText(/name/i);
    fireEvent.change(nameInput, { target: { value: 'a'.repeat(201) } });

    const submitButton = screen.getByText('Create Project');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/cannot exceed 200 characters/i)).toBeInTheDocument();
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
