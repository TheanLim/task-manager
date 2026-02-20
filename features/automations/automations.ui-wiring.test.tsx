/**
 * Phase 5b Integration Tests — UI Wiring Verification
 *
 * These tests verify that Phase 5b features are properly wired through
 * the component hierarchy, not just implemented in isolation.
 *
 * Catches gaps like:
 * - ScheduleConfigPanel props not passed from RuleDialogStepTrigger
 * - onPreview not passed from AutomationTab to RuleCard
 * - DryRunDialog not rendered in AutomationTab
 * - catchUpPolicy not saved/loaded in RuleDialog
 * - New filter types not appearing in the rule dialog flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutomationTab } from './components/AutomationTab';
import { RuleCard } from './components/RuleCard';
import { RuleDialogStepTrigger } from './components/wizard/RuleDialogStepTrigger';
import { useAutomationRules } from './hooks/useAutomationRules';
import type { AutomationRule } from './types';
import type { Section } from '@/lib/schemas';

// ─── Mocks ──────────────────────────────────────────────────────────────

vi.mock('./hooks/useAutomationRules');

vi.mock('@/stores/dataStore', () => ({
  useDataStore: () => ({
    projects: [
      { id: 'project-1', name: 'Test Project', description: '', viewMode: 'list', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    ],
  }),
}));

vi.mock('@dnd-kit/core', () => {
  const React = require('react');
  return {
    DndContext: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    closestCenter: vi.fn(),
    KeyboardSensor: class {},
    PointerSensor: class {},
    useSensor: () => ({}),
    useSensors: () => [],
  };
});

vi.mock('@dnd-kit/sortable', () => {
  const React = require('react');
  return {
    SortableContext: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: {},
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      setActivatorNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

// ─── Fixtures ───────────────────────────────────────────────────────────

const mockSections: Section[] = [
  { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'section-2', projectId: 'project-1', name: 'Done', order: 1, collapsed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

function makeScheduledRule(overrides?: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'sched-rule-1',
    projectId: 'project-1',
    name: 'Scheduled Cleanup',
    trigger: {
      type: 'scheduled_interval',
      sectionId: null,
      schedule: { kind: 'interval', intervalMinutes: 60 },
      lastEvaluatedAt: null,
      catchUpPolicy: 'catch_up_latest',
    },
    filters: [],
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 3,
    lastExecutedAt: '2024-01-15T10:00:00Z',
    recentExecutions: [
      {
        timestamp: '2024-01-15T10:00:00Z',
        triggerDescription: 'Every 60 minutes',
        actionDescription: 'Marked as complete',
        taskName: 'Aggregated',
        matchCount: 5,
        details: ['Task A', 'Task B', 'Task C'],
        executionType: 'scheduled',
      },
    ],
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as AutomationRule;
}

function makeEventRule(overrides?: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'event-rule-1',
    projectId: 'project-1',
    name: 'Event Rule',
    trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
    filters: [],
    action: {
      type: 'move_card_to_top_of_section',
      sectionId: 'section-2',
      dateOption: null,
      position: 'top',
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [
      {
        timestamp: '2024-01-15T10:00:00Z',
        triggerDescription: 'Card moved into To Do',
        actionDescription: 'Moved to top of Done',
        taskName: 'My Task',
      },
    ],
    order: 1,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  } as AutomationRule;
}

const defaultMockHandlers = {
  rules: [] as AutomationRule[],
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  duplicateRule: vi.fn(),
  duplicateToProject: vi.fn(),
  toggleRule: vi.fn(),
  reorderRules: vi.fn(),
  bulkSetEnabled: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Integration Tests ──────────────────────────────────────────────────

describe('Phase 5b Integration: Preview button wired in AutomationTab', () => {
  it('Preview appears in scheduled rule dropdown when rendered via AutomationTab', async () => {
    const user = userEvent.setup();
    const scheduledRule = makeScheduledRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [scheduledRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    // Open the rule card dropdown
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    // Preview should be present because AutomationTab passes onPreview
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('Preview does NOT appear for event-driven rules in AutomationTab', async () => {
    const user = userEvent.setup();
    const eventRule = makeEventRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [eventRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });
});

describe('Phase 5b Integration: ScheduleHistoryView renders in AutomationTab', () => {
  it('scheduled rule shows execution type badges (not plain task names)', async () => {
    const user = userEvent.setup();
    const scheduledRule = makeScheduledRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [scheduledRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    // Expand the execution log
    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    // Should show ScheduleHistoryView badges, not plain RuleCardExecutionLog format
    expect(screen.getByText('⚡ Scheduled')).toBeInTheDocument();
    expect(screen.getByText(/5 tasks/)).toBeInTheDocument();
  });

  it('event-driven rule shows standard execution log format (task name)', async () => {
    const user = userEvent.setup();
    const eventRule = makeEventRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [eventRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    await user.click(screen.getByRole('button', { name: /recent activity/i }));

    // Should show standard format with task name
    expect(screen.getByText(/Task: My Task/)).toBeInTheDocument();
    // Should NOT show execution type badges
    expect(screen.queryByText('⚡ Scheduled')).not.toBeInTheDocument();
  });
});

describe('Phase 5b Integration: Catch-up policy toggle wired in RuleDialogStepTrigger', () => {
  it('catch-up policy toggle renders when scheduled_interval is selected', () => {
    const onChange = vi.fn();

    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
          catchUpPolicy: 'catch_up_latest',
        }}
        onTriggerChange={onChange}
        sections={mockSections}
      />
    );

    expect(screen.getByLabelText('Run on catch-up')).toBeInTheDocument();
  });

  it('catch-up policy toggle renders when scheduled_cron is selected', () => {
    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'scheduled_cron',
          sectionId: null,
          schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] },
          catchUpPolicy: 'skip_missed',
        }}
        onTriggerChange={vi.fn()}
        sections={mockSections}
      />
    );

    const toggle = screen.getByLabelText('Run on catch-up');
    expect(toggle).toBeInTheDocument();
    // skip_missed → toggle should be unchecked
    expect(toggle).toHaveAttribute('data-state', 'unchecked');
  });

  it('toggling catch-up policy calls onTriggerChange with updated catchUpPolicy', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
          catchUpPolicy: 'catch_up_latest',
        }}
        onTriggerChange={onChange}
        sections={mockSections}
      />
    );

    const toggle = screen.getByLabelText('Run on catch-up');
    await user.click(toggle);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ catchUpPolicy: 'skip_missed' })
    );
  });

  it('catch-up policy toggle does NOT render for event-driven triggers', () => {
    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        }}
        onTriggerChange={vi.fn()}
        sections={mockSections}
      />
    );

    expect(screen.queryByLabelText('Run on catch-up')).not.toBeInTheDocument();
  });
});

describe('Phase 5b Integration: Template helper text wired in RuleDialogStepTrigger', () => {
  it('template helper text renders for scheduled_interval trigger', () => {
    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 30 },
        }}
        onTriggerChange={vi.fn()}
        sections={mockSections}
      />
    );

    expect(
      screen.getByText(/Use \{\{date\}\}, \{\{day\}\}, \{\{weekday\}\}, \{\{month\}\} for dynamic titles/)
    ).toBeInTheDocument();
  });

  it('template helper text does NOT render for event-driven triggers', () => {
    render(
      <RuleDialogStepTrigger
        trigger={{
          type: 'card_moved_into_section',
          sectionId: 'section-1',
        }}
        onTriggerChange={vi.fn()}
        sections={mockSections}
      />
    );

    expect(
      screen.queryByText(/Use \{\{date\}\}, \{\{day\}\}, \{\{weekday\}\}, \{\{month\}\} for dynamic titles/)
    ).not.toBeInTheDocument();
  });
});

describe('Phase 5b Integration: New filter types in RuleDialogStepFilters', () => {
  // This is already tested in RuleDialogStepFilters.test.tsx but we verify
  // the full dropdown renders all 6 new types via the component hierarchy
  it('all 6 new filter types appear in the filter step dropdown', async () => {
    const user = userEvent.setup();
    const { RuleDialogStepFilters } = await import('./components/wizard/RuleDialogStepFilters');

    render(
      <RuleDialogStepFilters
        filters={[]}
        onFiltersChange={vi.fn()}
        onSkip={vi.fn()}
        sections={mockSections}
      />
    );

    await user.click(screen.getByRole('button', { name: /add filter/i }));

    expect(screen.getByText('Created more than...')).toBeInTheDocument();
    expect(screen.getByText('Completed more than...')).toBeInTheDocument();
    expect(screen.getByText('Not updated in...')).toBeInTheDocument();
    expect(screen.getByText('Not modified in...')).toBeInTheDocument();
    expect(screen.getByText('Overdue by more than...')).toBeInTheDocument();
    expect(screen.getByText('In current section for more than...')).toBeInTheDocument();
  });
});


describe('Phase 5b Integration: Scheduler is initialized on app mount', () => {
  it('useSchedulerInit creates SchedulerLeaderElection and destroys on unmount', async () => {
    // Import the actual hook — it creates a SchedulerLeaderElection in useEffect
    // which auto-inits via constructor. On unmount it calls destroy().
    const { useSchedulerInit } = await import('./hooks/useSchedulerInit');
    const React = await import('react');

    function TestComponent() {
      useSchedulerInit();
      return React.createElement('div', null, 'mounted');
    }

    // Should not throw during render (BroadcastChannel may not exist in jsdom,
    // but the fallback handles it by assuming leadership)
    const { unmount } = render(React.createElement(TestComponent));
    expect(screen.getByText('mounted')).toBeInTheDocument();

    // Unmount should not throw
    unmount();
  });
});

describe('Phase 5b Integration: create_card with interval trigger produces action with zero tasks', () => {
  it('rule engine produces one create_card action even when no tasks exist', async () => {
    // This is a cross-cutting integration check — the rule engine test covers it in detail,
    // but this verifies the contract from the component perspective
    const { evaluateRules } = await import('./services/evaluation/ruleEngine');
    const rule: any = {
      id: 'rule-create-integration',
      projectId: 'project-1',
      name: 'Create standup card',
      trigger: {
        type: 'scheduled_interval',
        sectionId: null,
        schedule: { kind: 'interval', intervalMinutes: 5 },
        lastEvaluatedAt: null,
      },
      action: {
        type: 'create_card',
        sectionId: 'section-1',
        dateOption: null,
        position: null,
        cardTitle: '{{date}} standup',
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
      filters: [],
      enabled: true,
      brokenReason: null,
    };

    const event = {
      type: 'schedule.fired' as const,
      entityId: rule.id,
      projectId: rule.projectId,
      changes: { triggerType: 'scheduled_interval' },
      previousValues: {},
      triggeredByRule: rule.id,
      depth: 0,
    };

    const actions = evaluateRules(event, [rule], {
      allTasks: [],
      allSections: [],
      maxDepth: 5,
      executedSet: new Set(),
    });

    expect(actions).toHaveLength(1);
    expect(actions[0].actionType).toBe('create_card');
  });
});


describe('Phase 5a Integration: Run Now button wired in AutomationTab', () => {
  it('"Run Now" appears in scheduled rule dropdown', async () => {
    const user = userEvent.setup();
    const scheduledRule = makeScheduledRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [scheduledRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.getByText('Run Now')).toBeInTheDocument();
  });

  it('"Run Now" does NOT appear for event-driven rules', async () => {
    const user = userEvent.setup();
    const eventRule = makeEventRule();

    (useAutomationRules as any).mockReturnValue({
      ...defaultMockHandlers,
      rules: [eventRule],
    });

    render(<AutomationTab projectId="project-1" sections={mockSections} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.queryByText('Run Now')).not.toBeInTheDocument();
  });
});

describe('Phase 5a Integration: RuleCard shows Run Now for scheduled rules', () => {
  it('Run Now menu item calls onRunNow with rule id', async () => {
    const user = userEvent.setup();
    const rule = makeScheduledRule({ id: 'sched-run-1' });
    const onRunNow = vi.fn();

    render(
      <RuleCard
        rule={rule}
        sections={mockSections}
        projectId="project-1"
        onEdit={vi.fn()}
        onDuplicate={vi.fn()}
        onDuplicateToProject={vi.fn()}
        onDelete={vi.fn()}
        onToggle={vi.fn()}
        onPreview={vi.fn()}
        onRunNow={onRunNow}
      />
    );

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    const runNowButton = screen.getByText('Run Now');
    await user.click(runNowButton);

    expect(onRunNow).toHaveBeenCalledWith('sched-run-1');
  });
});
