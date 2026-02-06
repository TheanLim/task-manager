import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectList } from './ProjectList';
import { Project, ViewMode } from '@/types';

// Mock Next.js router
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn()
  })
}));

describe('ProjectList', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Test Project 1',
      description: 'First test project',
      viewMode: ViewMode.LIST,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'project-2',
      name: 'Test Project 2',
      description: 'Second test project',
      viewMode: ViewMode.BOARD,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];

  it('should render empty state when no projects', () => {
    const onProjectSelect = vi.fn();
    const onNewProject = vi.fn();

    render(
      <ProjectList
        projects={[]}
        activeProjectId={null}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
      />
    );

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('Create Project')).toBeInTheDocument();
  });

  it('should render list of projects', () => {
    const onProjectSelect = vi.fn();
    const onNewProject = vi.fn();

    render(
      <ProjectList
        projects={mockProjects}
        activeProjectId={null}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
      />
    );

    expect(screen.getByText('Test Project 1')).toBeInTheDocument();
    expect(screen.getByText('Test Project 2')).toBeInTheDocument();
    expect(screen.getByText('First test project')).toBeInTheDocument();
  });

  it('should call onProjectSelect when project is clicked', () => {
    const onProjectSelect = vi.fn();
    const onNewProject = vi.fn();

    render(
      <ProjectList
        projects={mockProjects}
        activeProjectId={null}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
      />
    );

    fireEvent.click(screen.getByText('Test Project 1'));
    expect(onProjectSelect).toHaveBeenCalledWith('project-1');
    expect(mockPush).toHaveBeenCalledWith('/?project=project-1');
  });

  it('should call onNewProject when create button is clicked', () => {
    const onProjectSelect = vi.fn();
    const onNewProject = vi.fn();

    render(
      <ProjectList
        projects={[]}
        activeProjectId={null}
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
      />
    );

    fireEvent.click(screen.getByText('Create Project'));
    expect(onNewProject).toHaveBeenCalled();
  });

  it('should highlight active project', () => {
    const onProjectSelect = vi.fn();
    const onNewProject = vi.fn();

    const { container } = render(
      <ProjectList
        projects={mockProjects}
        activeProjectId="project-1"
        onProjectSelect={onProjectSelect}
        onNewProject={onNewProject}
      />
    );

    const activeCard = screen.getByText('Test Project 1').closest('div');
    expect(activeCard).toHaveClass('bg-accent');
  });
});
