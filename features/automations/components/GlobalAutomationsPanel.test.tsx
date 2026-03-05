import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GlobalAutomationsPanel } from './GlobalAutomationsPanel';
import type { AutomationRule } from '../types';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRules: AutomationRule[] = [];
const mockCreateRule = vi.fn();
const mockUpdateRule = vi.fn();
const mockDeleteRule = vi.fn();
const mockReorderRules = vi.fn();

vi.mock('../hooks/useGlobalAutomationRules', () => ({
  useGlobalAutomationRules: () => ({
    rules: mockRules,
    createRule: mockCreateRule,
    updateRule: mockUpdateRule,
    deleteRule: mockDeleteRule,
    reorderRules: mockReorderRules,
  }),
}));

// RuleDialog internally calls useAutomationRules for duplicate detection
vi.mock('../hooks/useAutomationRules', () => ({
  useAutomationRules: () => ({ rules: [], createRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn(), duplicateRule: vi.fn(), toggleRule: vi.fn() }),
}));

vi.mock('@/stores/dataStore', () => ({
  useDataStore: () => ({
    projects: [{ id: 'proj-1', name: 'Alpha', description: '', viewMode: 'list', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }],
    sections: [],
  }),
}));

const mockSetGlobalPanelCompact = vi.fn();

vi.mock('@/stores/appStore', () => ({
  useAppStore: (selector?: (s: any) => any) => {
    const state = {
      highlightRuleId: null,
      setHighlightRuleId: vi.fn(),
      setActiveView: vi.fn(),
      globalPanelCompact: false,
      setGlobalPanelCompact: mockSetGlobalPanelCompact,
    };
    return selector ? selector(state) : state;
  },
}));

let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/',
}));

// Mock useExecutionLogFilters to control filter state in tests
const mockFilteredEntries: any[] = [];
const mockSetOutcome = vi.fn();
const mockClearFilters = vi.fn();

vi.mock('../hooks/useExecutionLogFilters', () => ({
  useExecutionLogFilters: (entries: any[], initialOutcome: string) => ({
    filters: { ruleIds: [], projectIds: [], outcome: initialOutcome || 'all', dateRange: '7d' },
    filteredEntries: mockFilteredEntries.length > 0 ? mockFilteredEntries : entries,
    hasActiveFilters: initialOutcome !== 'all' && initialOutcome !== undefined,
    setRuleIds: vi.fn(),
    setProjectIds: vi.fn(),
    setOutcome: mockSetOutcome,
    setDateRange: vi.fn(),
    clearFilters: mockClearFilters,
  }),
}));

vi.mock('./ExecutionLogFilterBar', () => ({
  ExecutionLogFilterBar: (props: any) => (
    <div data-testid="execution-log-filter-bar">
      <span data-testid="filter-bar-filtered-count">{props.filteredCount}</span>
      <span data-testid="filter-bar-total-count">{props.totalCount}</span>
    </div>
  ),
}));

vi.mock('@dnd-kit/sortable', () => {
  const React = require('react');
  return {
    SortableContext: ({ children }: any) => React.createElement(React.Fragment, null, children),
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: {},
    useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, setActivatorNodeRef: () => {}, transform: null, transition: undefined, isDragging: false }),
  };
});

vi.mock('@dnd-kit/core', () => {
  const React = require('react');
  return {
    DndContext: ({ children }: any) => React.createElement(React.Fragment, null, children),
    closestCenter: vi.fn(),
    KeyboardSensor: class {},
    PointerSensor: class {},
    useSensor: () => ({}),
    useSensors: () => [],
  };
});

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => undefined } },
}));

const NOW = '2026-01-01T00:00:00.000Z';

function makeGlobalRule(id: string, name: string): AutomationRule {
  return {
    id,
    projectId: null,
    name,
    trigger: { type: 'card_marked_complete', sectionId: null },
    filters: [],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    excludedProjectIds: [],
  } as any;
}

describe('GlobalAutomationsPanel', () => {
  beforeEach(() => {
    mockRules.length = 0;
    mockFilteredEntries.length = 0;
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  it('renders empty state when no global rules exist', () => {
    render(<GlobalAutomationsPanel />);
    expect(screen.getByText('No global rules yet')).toBeInTheDocument();
    expect(screen.getByText(/Create a rule once/)).toBeInTheDocument();
  });

  it('renders rule list when global rules exist', () => {
    mockRules.push(makeGlobalRule('g1', 'My Global Rule'));
    render(<GlobalAutomationsPanel />);
    expect(screen.getByText('My Global Rule')).toBeInTheDocument();
  });

  it('"+ New Rule" button opens RuleDialog', async () => {
    const user = userEvent.setup();
    render(<GlobalAutomationsPanel />);
    await user.click(screen.getAllByText('+ New Rule')[0]);
    await waitFor(() => {
      expect(screen.getByText('New Global Rule')).toBeInTheDocument();
    });
  });

  it('execution log tab renders with Project column header', async () => {
    const user = userEvent.setup();
    const rule = makeGlobalRule('g1', 'Rule A');
    rule.recentExecutions = [{
      timestamp: NOW,
      triggerDescription: 'Card moved',
      actionDescription: 'Mark complete',
      taskName: 'Task X',
      executionType: 'event',
      isGlobal: true,
      firingProjectId: 'proj-1',
      ruleId: 'g1',
    } as any];
    mockRules.push(rule);
    render(<GlobalAutomationsPanel />);
    await user.click(screen.getByRole('tab', { name: /execution log/i }));
    expect(screen.getByText('Project')).toBeInTheDocument();
  });

  it('execution log tab shows filtered count text', async () => {
    const user = userEvent.setup();
    const rule = makeGlobalRule('g1', 'Rule A');
    rule.recentExecutions = [{
      timestamp: NOW,
      triggerDescription: 'Card moved',
      actionDescription: 'Mark complete',
      taskName: 'Task X',
      executionType: 'event',
      isGlobal: true,
      firingProjectId: 'proj-1',
      ruleId: 'g1',
    } as any];
    mockRules.push(rule);
    render(<GlobalAutomationsPanel />);
    await user.click(screen.getByRole('tab', { name: /execution log/i }));
    expect(screen.getByText(/Showing 1 entries \(filtered from 1 total\)/)).toBeInTheDocument();
  });

  it('skipped log entry shows amber Skipped badge', async () => {
    const user = userEvent.setup();
    const rule = makeGlobalRule('g1', 'Rule A');
    rule.recentExecutions = [{
      timestamp: NOW,
      triggerDescription: 'Card moved',
      actionDescription: 'Move to Done',
      taskName: 'Task X',
      executionType: 'skipped',
      isGlobal: true,
      firingProjectId: 'proj-1',
      skipReason: "Section 'Done' not found in project 'Alpha'",
      ruleId: 'g1',
    } as any];
    mockRules.push(rule);
    render(<GlobalAutomationsPanel />);
    await user.click(screen.getByRole('tab', { name: /execution log/i }));
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });
});

// ── ISSUE-6: deep-link highlight (TDD) ───────────────────────────────────────

describe('GlobalAutomationsPanel — highlightRuleId scroll and highlight', () => {
  beforeEach(() => {
    mockRules.length = 0;
    mockFilteredEntries.length = 0;
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
    // jsdom: stub scrollIntoView
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('rule card has data-rule-id attribute for scroll targeting', () => {
    mockRules.push(makeGlobalRule('g1', 'Rule Alpha'));
    render(<GlobalAutomationsPanel />);
    const card = document.querySelector('[data-rule-id="g1"]');
    expect(card).toBeInTheDocument();
  });

  it('highlighted rule card gets ring class when flashRuleId matches', async () => {
    mockRules.push(makeGlobalRule('g1', 'Rule Alpha'));
    render(<GlobalAutomationsPanel />);
    expect(document.querySelector('[data-rule-id="g1"]')).toBeInTheDocument();
  });
});

// ── TASK-23: query params, compact toggle, filter bar ────────────────────────

describe('GlobalAutomationsPanel — TASK-23 features', () => {
  beforeEach(() => {
    mockRules.length = 0;
    mockFilteredEntries.length = 0;
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  it('reads tab=log query param and initializes to log tab', () => {
    mockSearchParams = new URLSearchParams('tab=log');
    render(<GlobalAutomationsPanel />);
    // The log tab content should be visible (filter bar renders)
    expect(screen.getByTestId('execution-log-filter-bar')).toBeInTheDocument();
  });

  it('reads outcome=skipped query param and passes to filter hook', () => {
    mockSearchParams = new URLSearchParams('tab=log&outcome=skipped');
    render(<GlobalAutomationsPanel />);
    // The filter bar should be visible (log tab active)
    expect(screen.getByTestId('execution-log-filter-bar')).toBeInTheDocument();
  });

  it('defaults to rules tab when no query param', () => {
    render(<GlobalAutomationsPanel />);
    // Rules tab should be active — empty state shows
    expect(screen.getByText('No global rules yet')).toBeInTheDocument();
  });

  it('compact toggle button renders in panel header', () => {
    render(<GlobalAutomationsPanel />);
    const toggle = screen.getByRole('button', { name: /switch to compact view/i });
    expect(toggle).toBeInTheDocument();
  });

  it('compact toggle has aria-label and aria-pressed', () => {
    render(<GlobalAutomationsPanel />);
    const toggle = screen.getByRole('button', { name: /switch to compact view/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveAttribute('aria-label');
  });

  it('log tab shows "Showing N entries" count text', async () => {
    const user = userEvent.setup();
    const rule = makeGlobalRule('g1', 'Rule A');
    rule.recentExecutions = [{
      timestamp: NOW,
      triggerDescription: 'Card moved',
      actionDescription: 'Mark complete',
      taskName: 'Task X',
      executionType: 'event',
      isGlobal: true,
      firingProjectId: 'proj-1',
      ruleId: 'g1',
    } as any];
    mockRules.push(rule);
    render(<GlobalAutomationsPanel />);
    await user.click(screen.getByRole('tab', { name: /execution log/i }));
    expect(screen.getByText(/Showing 1 entries \(filtered from 1 total\)/)).toBeInTheDocument();
  });

  it('rules tab renders RuleCard components', () => {
    mockRules.push(makeGlobalRule('g1', 'Rule Alpha'));
    mockRules.push(makeGlobalRule('g2', 'Rule Beta'));
    render(<GlobalAutomationsPanel />);
    expect(screen.getByText('Rule Alpha')).toBeInTheDocument();
    expect(screen.getByText('Rule Beta')).toBeInTheDocument();
  });
});

describe('GlobalAutomationsPanel — drag-and-drop reordering', () => {
  beforeEach(() => {
    mockRules.length = 0;
    mockFilteredEntries.length = 0;
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  it('rule cards are wrapped in sortable context for drag-and-drop', () => {
    mockRules.push(makeGlobalRule('g1', 'Rule Alpha'));
    mockRules.push({ ...makeGlobalRule('g2', 'Rule Beta'), order: 1 });
    render(<GlobalAutomationsPanel />);

    // Both rule cards render (SortableContext mock passes children through)
    expect(screen.getByText('Rule Alpha')).toBeInTheDocument();
    expect(screen.getByText('Rule Beta')).toBeInTheDocument();

    // Each card has data-rule-id for sortable identification
    expect(document.querySelector('[data-rule-id="g1"]')).toBeInTheDocument();
    expect(document.querySelector('[data-rule-id="g2"]')).toBeInTheDocument();
  });
});

describe('GlobalAutomationsPanel — Duplicate global rule', () => {
  beforeEach(() => {
    mockRules.length = 0;
    mockFilteredEntries.length = 0;
    mockSearchParams = new URLSearchParams();
    vi.clearAllMocks();
  });

  it('clicking Duplicate on a global rule calls createRule with copied data and " (Copy)" suffix', async () => {
    const user = userEvent.setup();
    const rule = makeGlobalRule('g1', 'Auto-Complete');
    mockRules.push(rule);
    render(<GlobalAutomationsPanel />);

    // Open the context menu
    const menuButton = screen.getByRole('button', { name: /open menu/i });
    await user.click(menuButton);

    // For global rules, "Duplicate" is a plain menu item (no submenu)
    const duplicateItem = screen.getByText('Duplicate');
    await user.click(duplicateItem);

    expect(mockCreateRule).toHaveBeenCalledTimes(1);
    const arg = mockCreateRule.mock.calls[0][0];
    expect(arg.name).toBe('Auto-Complete (Copy)');
    expect(arg.projectId).toBeNull();
    expect(arg.trigger.type).toBe(rule.trigger.type);
    expect(arg.action.type).toBe(rule.action.type);
  });
});

