import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { RuleCard } from './RuleCard';
import type { AutomationRule } from '../types';
import type { Section } from '@/lib/schemas';
import type { DryRunResult } from '../services/rules/dryRunService';

// Mock useDataStore for ProjectPickerDialog
vi.mock('@/stores/dataStore', () => ({
  useDataStore: () => ({
    projects: [
      { id: 'project-1', name: 'Current Project', description: '', viewMode: 'list', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'project-2', name: 'Other Project', description: '', viewMode: 'list', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
    ],
  }),
}));

// Mock @dnd-kit/sortable — useSortable returns stubs for jsdom
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    setActivatorNodeRef: () => {},
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

// Mock sections for testing
const mockSections: Section[] = [
  { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// Helper to create a mock rule
function createMockRule(overrides?: Partial<AutomationRule>): AutomationRule {
  return {
    id: 'rule-1',
    projectId: 'project-1',
    name: 'Test Rule',
    trigger: {
      type: 'card_moved_into_section',
      sectionId: 'section-1',
    },
    action: {
      type: 'move_card_to_top_of_section',
      sectionId: 'section-2',
      dateOption: null,
      position: 'top',
    },
    enabled: true,
    brokenReason: null,
    executionCount: 5,
    lastExecutedAt: '2024-01-15T10:30:00Z',
    recentExecutions: [],
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('RuleCard', () => {
  const mockHandlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDuplicateToProject: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
  };

  const defaultProps = {
    ...mockHandlers,
    sections: mockSections,
    projectId: 'project-1',
  };

  it('renders rule name', () => {
    const rule = createMockRule({ name: 'My Automation Rule' });
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    expect(screen.getByText('My Automation Rule')).toBeInTheDocument();
  });

  it('renders natural language description via RulePreview', () => {
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    // RulePreview should render the trigger and action
    expect(screen.getByText(/When a card/)).toBeInTheDocument();
  });

  it('renders trigger and action type badges', () => {
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    expect(screen.getByText('moved into section')).toBeInTheDocument();
    expect(screen.getByText('move to top of section')).toBeInTheDocument();
  });

  it('renders execution stats', () => {
    const rule = createMockRule({ executionCount: 10 });
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    expect(screen.getByText(/Ran 10 times/)).toBeInTheDocument();
    expect(screen.getByText(/Last fired/)).toBeInTheDocument();
  });

  it('renders "time" singular when executionCount is 1', () => {
    const rule = createMockRule({ executionCount: 1 });
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    expect(screen.getByText(/Ran 1 time/)).toBeInTheDocument();
  });

  it('renders "Never" when lastExecutedAt is null', () => {
    const rule = createMockRule({ lastExecutedAt: null });
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    expect(screen.getByText(/Last fired Never/)).toBeInTheDocument();
  });

  it('renders enabled switch with correct aria-label', () => {
    const rule = createMockRule({ name: 'Test Automation' });
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const switchElement = screen.getByRole('switch', { name: 'Enable rule Test Automation' });
    expect(switchElement).toBeInTheDocument();
    expect(switchElement).toBeChecked();
  });

  it('calls onToggle when switch is clicked', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const switchElement = screen.getByRole('switch');
    await user.click(switchElement);
    
    expect(mockHandlers.onToggle).toHaveBeenCalledWith('rule-1');
  });

  it('renders actions menu with Edit, Duplicate submenu, Delete options', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);
    
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('calls onEdit when Edit is clicked', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);
    
    const editButton = screen.getByText('Edit');
    await user.click(editButton);
    
    expect(mockHandlers.onEdit).toHaveBeenCalledWith('rule-1');
  });

  it('calls onDuplicate when "In this project" is clicked in Duplicate submenu', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);
    
    // Click the Duplicate submenu trigger to open submenu
    const duplicateTrigger = screen.getByText('Duplicate');
    await user.click(duplicateTrigger);

    // Click "In this project" in the submenu — use pointer for Radix submenu items in jsdom
    const inThisProject = await screen.findByText('In this project');
    await user.pointer({ target: inThisProject, keys: '[MouseLeft]' });
    
    expect(mockHandlers.onDuplicate).toHaveBeenCalledWith('rule-1');
  });

  it('shows "To another project..." option in Duplicate submenu', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);
    
    const duplicateTrigger = screen.getByText('Duplicate');
    await user.click(duplicateTrigger);

    const toAnotherProject = await screen.findByText('To another project...');
    expect(toAnotherProject).toBeInTheDocument();
  });

  it('opens ProjectPickerDialog and calls onDuplicateToProject on project selection (Req 7.3)', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    const duplicateTrigger = screen.getByText('Duplicate');
    await user.click(duplicateTrigger);

    const toAnotherProject = await screen.findByText('To another project...');
    await user.pointer({ target: toAnotherProject, keys: '[MouseLeft]' });

    // ProjectPickerDialog should open — "Other Project" should be visible (excludes current)
    const otherProject = await screen.findByText('Other Project');
    expect(otherProject).toBeInTheDocument();

    await user.click(otherProject);

    expect(mockHandlers.onDuplicateToProject).toHaveBeenCalledWith('rule-1', 'project-2');
  });

  it('calls onDelete when Delete is clicked', async () => {
    const user = userEvent.setup();
    const rule = createMockRule();
    render(<RuleCard rule={rule} {...defaultProps} />);
    
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);
    
    const deleteButton = screen.getByText('Delete');
    await user.click(deleteButton);
    
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('rule-1');
  });

  it('renders RuleCardExecutionLog with "Recent activity" text', () => {
    const rule = createMockRule({
      recentExecutions: [
        {
          timestamp: '2024-01-15T10:00:00Z',
          triggerDescription: 'Card moved into To Do',
          actionDescription: 'Moved to top of In Progress',
          taskName: 'My Task',
        },
      ],
    });
    render(<RuleCard rule={rule} {...defaultProps} />);

    expect(screen.getByText('Recent activity')).toBeInTheDocument();
  });

  describe('drag handle', () => {
    it('renders a GripVertical drag handle with correct aria-label', () => {
      const rule = createMockRule();
      render(<RuleCard rule={rule} {...defaultProps} />);

      const handle = screen.getByLabelText('Drag to reorder');
      expect(handle).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('renders with reduced opacity when disabled', () => {
      const rule = createMockRule({ enabled: false });
      const { container } = render(<RuleCard rule={rule} {...defaultProps} />);
      
      const card = container.querySelector('.opacity-60');
      expect(card).toBeInTheDocument();
    });

    it('renders "Paused" badge when disabled', () => {
      const rule = createMockRule({ enabled: false });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      expect(screen.getByText('Paused')).toBeInTheDocument();
    });

    it('switch is unchecked when disabled', () => {
      const rule = createMockRule({ enabled: false });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      const switchElement = screen.getByRole('switch');
      expect(switchElement).not.toBeChecked();
    });
  });

  describe('broken state', () => {
    it('renders warning icon when brokenReason is set', () => {
      const rule = createMockRule({ brokenReason: 'section_deleted' });
      const { container } = render(<RuleCard rule={rule} {...defaultProps} />);
      
      // AlertTriangle icon should be present (check for the SVG with specific class)
      const icon = container.querySelector('.lucide-triangle-alert');
      expect(icon).toBeInTheDocument();
    });

    it('shows tooltip with broken reason message on hover', async () => {
      const user = userEvent.setup();
      const rule = createMockRule({ brokenReason: 'section_deleted' });
      const { container } = render(<RuleCard rule={rule} {...defaultProps} />);
      
      const icon = container.querySelector('.lucide-triangle-alert');
      expect(icon).toBeInTheDocument();
      
      if (icon) {
        await user.hover(icon);
        
        // Tooltip should appear - use getAllByText since tooltip may be duplicated in DOM
        const tooltips = await screen.findAllByText('This rule references a deleted section');
        expect(tooltips.length).toBeGreaterThan(0);
      }
    });
  });

  describe('time formatting', () => {
    it('formats recent execution as "Just now"', () => {
      const now = new Date();
      const rule = createMockRule({ lastExecutedAt: now.toISOString() });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      expect(screen.getByText(/Last fired Just now/)).toBeInTheDocument();
    });

    it('formats execution in minutes', () => {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const rule = createMockRule({ lastExecutedAt: fiveMinutesAgo.toISOString() });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      expect(screen.getByText(/Last fired 5m ago/)).toBeInTheDocument();
    });

    it('formats execution in hours', () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const rule = createMockRule({ lastExecutedAt: twoHoursAgo.toISOString() });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      expect(screen.getByText(/Last fired 2h ago/)).toBeInTheDocument();
    });

    it('formats execution in days', () => {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const rule = createMockRule({ lastExecutedAt: threeDaysAgo.toISOString() });
      render(<RuleCard rule={rule} {...defaultProps} />);
      
      expect(screen.getByText(/Last fired 3d ago/)).toBeInTheDocument();
    });
  });

  describe('Preview button for scheduled rules', () => {
    function createScheduledRule(overrides?: Partial<AutomationRule>): AutomationRule {
      return createMockRule({
        trigger: {
          type: 'scheduled_cron',
          sectionId: null,
          schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] },
          lastEvaluatedAt: null,
          catchUpPolicy: 'catch_up_latest',
        },
        ...overrides,
      });
    }

    it('"Preview" button appears in dropdown for scheduled rules', async () => {
      const user = userEvent.setup();
      const rule = createScheduledRule();
      const onPreview = vi.fn();
      render(<RuleCard rule={rule} {...defaultProps} onPreview={onPreview} />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('"Preview" button does NOT appear for event-driven rules', async () => {
      const user = userEvent.setup();
      const rule = createMockRule(); // event-driven trigger
      const onPreview = vi.fn();
      render(<RuleCard rule={rule} {...defaultProps} onPreview={onPreview} />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      expect(screen.queryByText('Preview')).not.toBeInTheDocument();
    });

    it('clicking "Preview" calls onPreview with rule id', async () => {
      const user = userEvent.setup();
      const rule = createScheduledRule({ id: 'sched-rule-1' });
      const onPreview = vi.fn();
      render(<RuleCard rule={rule} {...defaultProps} onPreview={onPreview} />);

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      const previewButton = screen.getByText('Preview');
      await user.click(previewButton);

      expect(onPreview).toHaveBeenCalledWith('sched-rule-1');
    });
  });

  describe('ScheduleHistoryView for scheduled rules', () => {
    it('renders ScheduleHistoryView instead of RuleCardExecutionLog for scheduled rules', async () => {
      const user = userEvent.setup();
      const rule = createMockRule({
        trigger: {
          type: 'scheduled_interval',
          sectionId: null,
          schedule: { kind: 'interval', intervalMinutes: 60 },
          lastEvaluatedAt: null,
          catchUpPolicy: 'catch_up_latest',
        },
        recentExecutions: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            triggerDescription: 'Every 60 minutes',
            actionDescription: 'Moved to top of In Progress',
            taskName: 'Aggregated',
            matchCount: 5,
            details: ['Task A', 'Task B'],
            executionType: 'scheduled',
          },
        ],
      });
      render(<RuleCard rule={rule} {...defaultProps} />);

      // Expand the log
      await user.click(screen.getByRole('button', { name: /recent activity/i }));

      // Should show execution type badge (ScheduleHistoryView behavior)
      expect(screen.getByText('⚡ Scheduled')).toBeInTheDocument();
      expect(screen.getByText(/5 tasks/)).toBeInTheDocument();
    });

    it('renders standard RuleCardExecutionLog for event-driven rules', async () => {
      const user = userEvent.setup();
      const rule = createMockRule({
        recentExecutions: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            triggerDescription: 'Card moved into To Do',
            actionDescription: 'Moved to top of In Progress',
            taskName: 'My Task',
          },
        ],
      });
      render(<RuleCard rule={rule} {...defaultProps} />);

      // Expand the log
      await user.click(screen.getByRole('button', { name: /recent activity/i }));

      // Should show standard format with task name (RuleCardExecutionLog behavior)
      expect(screen.getByText(/Task: My Task/)).toBeInTheDocument();
    });
  });

  describe('Property 11: Rule card renders correct visual state', () => {
    it('validates Requirements 9.2, 9.3, 9.4, 14.4', () => {
      fc.assert(
        fc.property(
          // Generate random automation rules with varying states
          fc.record({
            id: fc.hexaString({ minLength: 8, maxLength: 16 }),
            projectId: fc.hexaString({ minLength: 8, maxLength: 16 }),
            name: fc.string({ minLength: 3, maxLength: 30 }).map(s => s.trim() || 'Test Rule'),
            enabled: fc.boolean(),
            brokenReason: fc.oneof(fc.constant(null), fc.constant('section_deleted')),
            executionCount: fc.nat({ max: 1000 }),
            lastExecutedAt: fc.oneof(
              fc.constant(null),
              fc.date({ min: new Date('2024-01-01'), max: new Date() }).map(d => d.toISOString())
            ),
          }),
          (ruleData) => {
            const rule = createMockRule(ruleData as any);
            const { container } = render(
              <RuleCard rule={rule} {...defaultProps} />
            );

            // Assert: name is present (check heading exists with the name)
            const heading = container.querySelector('h3');
            expect(heading).toBeInTheDocument();
            expect(heading?.textContent).toBe(rule.name);

            // Assert: description is present (RulePreview renders)
            expect(screen.getByText(/When a card/)).toBeInTheDocument();

            // Assert: correct opacity for disabled state
            if (!rule.enabled) {
              const card = container.querySelector('.opacity-60');
              expect(card).toBeInTheDocument();
              expect(screen.getByText('Paused')).toBeInTheDocument();
            }

            // Assert: warning icon for broken state
            if (rule.brokenReason !== null) {
              const icon = container.querySelector('.lucide-triangle-alert');
              expect(icon).toBeInTheDocument();
            }

            // Assert: aria-label contains rule name
            const switchElement = screen.getByRole('switch');
            expect(switchElement).toHaveAttribute('aria-label', `Enable rule ${rule.name}`);

            // Cleanup for next iteration
            container.remove();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

describe('RuleCard — "Last fired" auto-refresh', () => {
  function createMockRuleForTimer(lastExecutedAt: string): AutomationRule {
    return {
      id: 'rule-timer',
      projectId: 'proj-1',
      name: 'Timer Test Rule',
      trigger: { type: 'card_moved_into_section', sectionId: 'section-1' } as any,
      filters: [],
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      enabled: true,
      brokenReason: null,
      executionCount: 1,
      lastExecutedAt,
      recentExecutions: [],
      order: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const defaultProps = {
    sections: [{ id: 'section-1', projectId: 'proj-1', name: 'Done', order: 0, collapsed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] as Section[],
    projectId: 'proj-1',
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDuplicateToProject: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
  };

  it('updates "Last fired" text after 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      const tenSecondsAgo = new Date(Date.now() - 10_000).toISOString();
      const rule = createMockRuleForTimer(tenSecondsAgo);

      render(<RuleCard rule={rule} {...defaultProps} />);

      // Initially "Just now" (10s < 60s)
      expect(screen.getByText(/Last fired Just now/)).toBeInTheDocument();

      // Advance 60s — now 70s old → "1m ago"
      vi.advanceTimersByTime(60_000);

      await vi.waitFor(() => {
        expect(screen.getByText(/Last fired 1m ago/)).toBeInTheDocument();
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('RuleCard — one-time scheduled trigger (Task 14)', () => {
  const mockHandlers = {
    onEdit: vi.fn(),
    onDuplicate: vi.fn(),
    onDuplicateToProject: vi.fn(),
    onDelete: vi.fn(),
    onToggle: vi.fn(),
    onPreview: vi.fn(),
    onRunNow: vi.fn(),
    onReschedule: vi.fn(),
  };

  const defaultProps = {
    ...mockHandlers,
    sections: mockSections,
    projectId: 'project-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createOneTimeRule(overrides?: Partial<AutomationRule>): AutomationRule {
    return createMockRule({
      trigger: {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
        lastEvaluatedAt: null,
        catchUpPolicy: 'catch_up_latest',
      },
      ...overrides,
    });
  }

  it('enabled one-time rule shows "Next run" line with "Fires on" description', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-03-10T15:00:00.000Z'));

    const rule = createOneTimeRule({ enabled: true });
    render(<RuleCard rule={rule} {...defaultProps} />);

    expect(screen.getByText(/Fires on Mar 15, 2025/)).toBeInTheDocument();
  });

  it('fired (disabled) one-time rule shows "Fired" badge', () => {
    const rule = createOneTimeRule({ enabled: false });
    render(<RuleCard rule={rule} {...defaultProps} />);

    expect(screen.getByText('Fired')).toBeInTheDocument();
  });

  it('fired (disabled) one-time rule shows "Fired on" in next run line', () => {
    const rule = createOneTimeRule({ enabled: false });
    render(<RuleCard rule={rule} {...defaultProps} />);

    expect(screen.getByText(/Fired on Mar 15, 2025/)).toBeInTheDocument();
  });

  it('fired one-time rule does NOT show "Fired" badge when enabled', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-03-10T15:00:00.000Z'));

    const rule = createOneTimeRule({ enabled: true });
    render(<RuleCard rule={rule} {...defaultProps} />);

    expect(screen.queryByText('Fired')).not.toBeInTheDocument();
  });

  it('dropdown menu for fired one-time rule includes "Reschedule" option', async () => {
    const user = userEvent.setup();
    const rule = createOneTimeRule({ enabled: false });
    render(<RuleCard rule={rule} {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.getByText('Reschedule')).toBeInTheDocument();
  });

  it('"Reschedule" does NOT appear for enabled one-time rules', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2025-03-10T15:00:00.000Z'));

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const rule = createOneTimeRule({ enabled: true });
    render(<RuleCard rule={rule} {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.queryByText('Reschedule')).not.toBeInTheDocument();
  });

  it('"Reschedule" does NOT appear for non-one-time rules', async () => {
    const user = userEvent.setup();
    const rule = createMockRule({ enabled: false }); // event-driven, disabled
    render(<RuleCard rule={rule} {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    expect(screen.queryByText('Reschedule')).not.toBeInTheDocument();
  });

  it('clicking "Reschedule" calls onReschedule with rule id', async () => {
    const user = userEvent.setup();
    const rule = createOneTimeRule({ id: 'one-time-rule-1', enabled: false });
    render(<RuleCard rule={rule} {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    const rescheduleButton = screen.getByText('Reschedule');
    await user.click(rescheduleButton);

    expect(mockHandlers.onReschedule).toHaveBeenCalledWith('one-time-rule-1');
  });
});
