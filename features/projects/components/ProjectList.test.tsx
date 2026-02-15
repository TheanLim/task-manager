import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fc from 'fast-check';
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
  }),
  useSearchParams: () => ({
    get: vi.fn(() => null)
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

    expect(screen.getByText('Start your first project')).toBeInTheDocument();
    expect(screen.getByText('Create a project to organize your tasks and track progress')).toBeInTheDocument();
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
    expect(screen.getByText('All Tasks')).toBeInTheDocument(); // New Tasks section
    expect(screen.getByText('Projects')).toBeInTheDocument(); // Projects header
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
    expect(mockPush).toHaveBeenCalledWith('/?project=project-1&tab=list');
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

    const activeItem = screen.getByText('Test Project 1').closest('.cursor-pointer');
    expect(activeItem).toHaveClass('border-l-accent-brand');
    expect(activeItem).toHaveClass('bg-accent/50');
  });

  // Feature: warm-industrial-redesign, Property 4: Project Dot Indicator Presence
  // **Validates: Requirements 3.2**
  it('should have exactly one dot indicator per project for any list of projects', () => {
    const projectArb = fc.record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 50 }),
      description: fc.string({ maxLength: 100 }),
      viewMode: fc.constantFrom('list' as ViewMode, 'board' as ViewMode, 'calendar' as ViewMode),
      createdAt: fc.constant(new Date().toISOString()),
      updatedAt: fc.constant(new Date().toISOString()),
    });

    fc.assert(
      fc.property(fc.array(projectArb, { minLength: 0, maxLength: 20 }), (projects) => {
        const { container } = render(
          <ProjectList
            projects={projects}
            activeProjectId={null}
            onProjectSelect={vi.fn()}
            onNewProject={vi.fn()}
          />
        );

        const dots = container.querySelectorAll('.rounded-full.w-1\\.5.h-1\\.5');
        expect(dots.length).toBe(projects.length);
      }),
      { numRuns: 100 }
    );
  });
});
