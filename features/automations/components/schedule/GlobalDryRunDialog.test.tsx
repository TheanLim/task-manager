import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalDryRunDialog } from './GlobalDryRunDialog';
import type { AutomationRule } from '../../types';
import type { Task, Section } from '@/lib/schemas';
import type { GlobalDryRunSummary } from '../../services/preview/rulePreviewService';

// Mock data that we can control
let mockHookReturnValue = {
  summary: null as GlobalDryRunSummary | null,
  isRunning: false,
  isStale: false,
  showCountWarning: false,
  run: vi.fn(),
  reset: vi.fn(),
};

// Mock the hook
vi.mock('../../hooks/useGlobalDryRun', () => ({
  useGlobalDryRun: () => mockHookReturnValue,
}));

// Mock icons
vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
  AlertTriangle: () => <span data-testid="alert-triangle-icon" />,
  Eye: () => <span data-testid="eye-icon" />,
}));

// Mock shadcn components
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="dialog" data-open={open}>
      {children}
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  ),
  DialogContent: ({ children, className, ...props }: any) => (
    <div data-testid="dialog-content" className={className} {...props}>
      {children}
    </div>
  ),
  DialogHeader: ({ children }: any) => (
    <div data-testid="dialog-header">{children}</div>
  ),
  DialogTitle: ({ children }: any) => (
    <div data-testid="dialog-title">{children}</div>
  ),
  DialogDescription: ({ children }: any) => (
    <div data-testid="dialog-description">{children}</div>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>
      {children}
    </span>
  ),
}));

describe('GlobalDryRunDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock data
    mockHookReturnValue = {
      summary: null,
      isRunning: false,
      isStale: false,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };
  });

  const mockRule: AutomationRule = {
    id: 'rule-1',
    name: 'Test Rule',
    trigger: { type: 'card_moved_into_section', sectionId: 'section-1', sectionName: 'Todo' },
    action: { 
      type: 'move_card_to_top_of_section', 
      sectionId: 'section-1',
      sectionName: 'Todo',
      dateOption: null,
      position: 'top',
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null
    },
    projectId: null,
    excludedProjectIds: [],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as AutomationRule;

  const mockProjects = [
    { id: 'project-1', name: 'Project 1' },
    { id: 'project-2', name: 'Project 2' },
  ];

  const mockTasks: Task[] = [
    {
      id: 'task-1',
      projectId: 'project-1',
      parentTaskId: null,
      sectionId: 'section-1',
      description: 'Test Task 1',
      notes: '',
      assignee: '',
      priority: 'none',
      tags: [],
      dueDate: null,
      completed: false,
      completedAt: null,
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSections: Section[] = [
    {
      id: 'section-1',
      projectId: 'project-1',
      name: 'Todo',
      order: 0,
      collapsed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockSummary: GlobalDryRunSummary = {
    projectResults: {
      'project-1': [
        {
          task: {
            id: 'task-1',
            projectId: 'project-1',
            parentTaskId: null,
            sectionId: 'section-1',
            description: 'Test Task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          outcome: 'fire' as const,
        },
        {
          task: {
            id: 'task-2',
            projectId: 'project-1',
            parentTaskId: null,
            sectionId: 'section-1',
            description: 'Another Task',
            notes: '',
            assignee: '',
            priority: 'none',
            tags: [],
            dueDate: null,
            completed: false,
            completedAt: null,
            order: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          outcome: 'skip' as const,
          skipReason: 'Task does not match filter',
        },
      ],
    },
    totalFire: 1,
    totalSkip: 1,
    runAt: new Date().toISOString(),
  };

  it('renders loading skeleton when isRunning is true', () => {
    mockHookReturnValue = {
      summary: null,
      isRunning: true,
      isStale: false,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={() => {}}
        rule={mockRule}
        projects={mockProjects}
        allTasks={[]}
        allSections={[]}
      />
    );

    // Should show loading skeleton
    const loadingElement = screen.getByLabelText('Running dry-run...');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders summary when data is loaded', () => {
    mockHookReturnValue = {
      summary: mockSummary,
      isRunning: false,
      isStale: false,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={() => {}}
        rule={mockRule}
        projects={mockProjects}
        allTasks={mockTasks}
        allSections={mockSections}
      />
    );

    // Should show summary bar with counts
    expect(screen.getByText('Scope: 2 projects')).toBeInTheDocument();
    // There are multiple "1 fire" elements (summary bar and project badge)
    expect(screen.getAllByText('1 fire').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 skip').length).toBeGreaterThan(0);
  });

  it('shows stale warning when isStale is true', () => {
    mockHookReturnValue = {
      summary: mockSummary,
      isRunning: false,
      isStale: true,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={() => {}}
        rule={mockRule}
        projects={mockProjects}
        allTasks={mockTasks}
        allSections={mockSections}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Results may be stale. Task data may have changed.')).toBeInTheDocument();
  });

  it('shows count warning when showCountWarning is true and no summary', () => {
    mockHookReturnValue = {
      summary: null,
      isRunning: false,
      isStale: false,
      showCountWarning: true,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={() => {}}
        rule={mockRule}
        projects={mockProjects}
        allTasks={mockTasks}
        allSections={mockSections}
      />
    );

    expect(screen.getByText('Large scope detected')).toBeInTheDocument();
  });

  it('shows project results', () => {
    mockHookReturnValue = {
      summary: mockSummary,
      isRunning: false,
      isStale: false,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={() => {}}
        rule={mockRule}
        projects={mockProjects}
        allTasks={mockTasks}
        allSections={mockSections}
      />
    );

    // Should show project results
    expect(screen.getByText('Project 1')).toBeInTheDocument();
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('calls onOpenChange when dialog is closed', async () => {
    const onOpenChange = vi.fn();
    const user = userEvent.setup();

    mockHookReturnValue = {
      summary: mockSummary,
      isRunning: false,
      isStale: false,
      showCountWarning: false,
      run: vi.fn(),
      reset: vi.fn(),
    };

    render(
      <GlobalDryRunDialog
        open={true}
        onOpenChange={onOpenChange}
        rule={mockRule}
        projects={mockProjects}
        allTasks={mockTasks}
        allSections={mockSections}
      />
    );

    // Find and click close button
    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});