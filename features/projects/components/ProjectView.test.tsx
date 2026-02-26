'use client';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectView } from './ProjectView';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => 'list' }),
}));

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  description: '',
  color: '#000',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Mock stores
vi.mock('@/stores/dataStore', () => ({
  useDataStore: () => ({
    tasks: [],
    updateProject: vi.fn(),
    updateTask: vi.fn(),
    deleteProject: vi.fn(),
    getSectionsByProjectId: () => [],
    getProjectById: () => mockProject,
  }),
  automationRuleRepository: {
    findByProjectId: () => [],
    subscribe: () => () => {},
  },
}));

vi.mock('@/stores/appStore', () => ({
  useAppStore: () => ({
    setProjectTab: vi.fn(),
    getProjectTab: () => 'list',
  }),
}));

vi.mock('@/features/tasks/hooks/useFilteredTasks', () => ({
  useFilteredTasks: (tasks: unknown[]) => tasks,
}));

// Stub heavy child components
vi.mock('@/features/projects/components/ProjectTabs', () => ({
  ProjectTabs: ({ children }: { children: Record<string, React.ReactNode> }) => (
    <div>{children.list}</div>
  ),
}));
vi.mock('@/features/tasks/components/TaskList', () => ({
  TaskList: () => <div data-testid="task-list" />,
}));
vi.mock('@/features/sharing/components/ShareButton', () => ({
  ShareButton: () => <button>Share Project</button>,
}));
vi.mock('@/components/InlineEditable', () => ({
  InlineEditable: ({ value }: { value: string }) => <span>{value}</span>,
}));
vi.mock('@/features/automations/components/wizard/RuleDialog', () => ({
  RuleDialog: () => null,
}));

describe('ProjectView', () => {
  const defaultProps = {
    projectId: 'proj-1',
    selectedTaskId: null,
    onTaskClick: vi.fn(),
    onSubtaskButtonClick: vi.fn(),
    onNewTask: vi.fn(),
    onTaskComplete: vi.fn(),
    onShowToast: vi.fn(),
  };

  it('renders the Share Project button', () => {
    render(<ProjectView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /share project/i })).toBeInTheDocument();
  });

  it('renders the New Task button in the project header', () => {
    render(<ProjectView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
  });

  it('New Task button has yellow accent-brand styling', () => {
    render(<ProjectView {...defaultProps} />);
    const btn = screen.getByRole('button', { name: /new task/i });
    expect(btn.className).toMatch(/bg-accent-brand/);
  });

  it('calls onNewTask when New Task button is clicked', () => {
    const onNewTask = vi.fn();
    render(<ProjectView {...defaultProps} onNewTask={onNewTask} />);
    fireEvent.click(screen.getByRole('button', { name: /new task/i }));
    expect(onNewTask).toHaveBeenCalledTimes(1);
  });

  it('New Task button is positioned to the right of Share Project button', () => {
    render(<ProjectView {...defaultProps} />);
    const shareBtn = screen.getByRole('button', { name: /share project/i });
    const newTaskBtn = screen.getByRole('button', { name: /new task/i });
    // Both in same container; New Task comes after Share in DOM order
    expect(shareBtn.parentElement).toBe(newTaskBtn.parentElement);
    const buttons = Array.from(shareBtn.parentElement!.querySelectorAll('button'));
    expect(buttons.indexOf(newTaskBtn)).toBeGreaterThan(buttons.indexOf(shareBtn));
  });
});
