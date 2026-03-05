import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScopeChangeConfirmDialog } from './ScopeChangeConfirmDialog';

describe('ScopeChangeConfirmDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const twoProjects = [
    { id: 'p1', name: 'Project Alpha' },
    { id: 'p2', name: 'Project Beta' },
  ];

  const sixProjects = [
    { id: 'p1', name: 'Project Alpha' },
    { id: 'p2', name: 'Project Beta' },
    { id: 'p3', name: 'Project Gamma' },
    { id: 'p4', name: 'Project Delta' },
    { id: 'p5', name: 'Project Epsilon' },
    { id: 'p6', name: 'Project Zeta' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog with title "Change rule scope?" when open', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Change rule scope?')).toBeInTheDocument();
  });

  it('does not render dialog content when open is false', () => {
    render(
      <ScopeChangeConfirmDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByText('Change rule scope?')).not.toBeInTheDocument();
  });

  it('shows removed project count in body text', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(
      screen.getByText(/This rule is currently active in 2 projects/)
    ).toBeInTheDocument();
  });

  it('shows list of removed project names', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('shows max 4 project names then "… and N more"', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={sixProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    expect(screen.getByText('Project Delta')).toBeInTheDocument();
    expect(screen.queryByText('Project Epsilon')).not.toBeInTheDocument();
    expect(screen.queryByText('Project Zeta')).not.toBeInTheDocument();
    expect(screen.getByText('… and 2 more')).toBeInTheDocument();
  });

  it('does not show "… and N more" when 4 or fewer projects', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.queryByText(/… and/)).not.toBeInTheDocument();
  });

  it('shows consequence text', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(
      screen.getByText('In-flight automations in those projects will stop.')
    ).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('renders "Save anyway" button that calls onConfirm', async () => {
    const user = userEvent.setup();
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /save anyway/i });
    await user.click(saveBtn);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
  });

  it('"Save anyway" button has destructive styling', () => {
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={twoProjects}
        onConfirm={mockOnConfirm}
      />
    );

    const saveBtn = screen.getByRole('button', { name: /save anyway/i });
    expect(saveBtn.className).toContain('bg-destructive');
  });

  it('shows exactly 4 projects when removedProjects has exactly 4', () => {
    const fourProjects = sixProjects.slice(0, 4);
    render(
      <ScopeChangeConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        removedProjects={fourProjects}
        onConfirm={mockOnConfirm}
      />
    );

    expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
    expect(screen.getByText('Project Gamma')).toBeInTheDocument();
    expect(screen.getByText('Project Delta')).toBeInTheDocument();
    expect(screen.queryByText(/… and/)).not.toBeInTheDocument();
  });
});
