import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LandingEmptyState } from './LandingEmptyState';

describe('LandingEmptyState', () => {
  it('renders heading, description, and hint', () => {
    render(<LandingEmptyState onNewProject={vi.fn()} onImport={vi.fn()} />);

    expect(screen.getByText('Welcome to Tasks')).toBeInTheDocument();
    expect(
      screen.getByText('Create a project to organize your tasks, or import existing data')
    ).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText(/keyboard shortcuts/i)).toBeInTheDocument();
  });

  it('renders FolderOpen icon', () => {
    const { container } = render(
      <LandingEmptyState onNewProject={vi.fn()} onImport={vi.fn()} />
    );
    // lucide-react renders an svg with the class lucide-folder-open
    const svg = container.querySelector('svg.lucide-folder-open');
    expect(svg).toBeInTheDocument();
  });

  it('calls onNewProject when "Create Project" is clicked', async () => {
    const onNewProject = vi.fn();
    render(<LandingEmptyState onNewProject={onNewProject} onImport={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(onNewProject).toHaveBeenCalledOnce();
  });

  it('calls onImport when "Import from JSON" is clicked', async () => {
    const onImport = vi.fn();
    render(<LandingEmptyState onNewProject={vi.fn()} onImport={onImport} />);

    await userEvent.click(screen.getByRole('button', { name: 'Import from JSON' }));
    expect(onImport).toHaveBeenCalledOnce();
  });

  it('renders two action buttons', () => {
    render(<LandingEmptyState onNewProject={vi.fn()} onImport={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import from JSON' })).toBeInTheDocument();
  });
});
