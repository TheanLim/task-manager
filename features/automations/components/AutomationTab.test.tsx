import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AutomationTab } from './AutomationTab';
import { useAutomationRules } from '../hooks/useAutomationRules';
import type { Section } from '@/lib/schemas';

// Mock the useAutomationRules hook
vi.mock('../hooks/useAutomationRules');

// Mock @dnd-kit/core — provide a passthrough DndContext for jsdom
vi.mock('@dnd-kit/core', () => {
  const React = require('react');
  return {
    DndContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    closestCenter: vi.fn(),
    KeyboardSensor: class {},
    PointerSensor: class {},
    useSensor: () => ({}),
    useSensors: () => [],
  };
});

// Mock @dnd-kit/sortable
vi.mock('@dnd-kit/sortable', () => {
  const React = require('react');
  return {
    SortableContext: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
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

// Mock sections for testing
const mockSections: Section[] = [
  { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// Helper to create mock rules
function createMockRule(id: string, name: string) {
  return {
    id,
    projectId: 'project-1',
    name,
    trigger: {
      type: 'card_moved_into_section' as const,
      sectionId: 'section-1',
    },
    action: {
      type: 'move_card_to_top_of_section' as const,
      sectionId: 'section-2',
      dateOption: null,
      position: 'top' as const,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 5,
    lastExecutedAt: '2024-01-15T10:30:00Z',
    order: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };
}

describe('AutomationTab', () => {
  const mockHandlers = {
    rules: [],
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
    duplicateRule: vi.fn(),
    toggleRule: vi.fn(),
    reorderRules: vi.fn(),
    bulkSetEnabled: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAutomationRules as any).mockReturnValue(mockHandlers);
  });

  describe('empty state', () => {
    it('renders empty state when no rules exist', () => {
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules: [],
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('Automate repetitive work')).toBeInTheDocument();
      expect(screen.getByText(/Create rules to move cards, set dates/)).toBeInTheDocument();
      expect(screen.getByText('+ Create your first rule')).toBeInTheDocument();
    });

    it('opens RuleDialog when CTA button is clicked', async () => {
      const user = userEvent.setup();
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules: [],
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      const ctaButton = screen.getByText('+ Create your first rule');
      await user.click(ctaButton);

      // Dialog should open (check for dialog title)
      await waitFor(() => {
        expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
      });
    });
  });

  describe('rule list', () => {
    it('renders rule list header with "+ New Rule" button when rules exist', () => {
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('Automation Rules')).toBeInTheDocument();
      expect(screen.getByText('+ New Rule')).toBeInTheDocument();
    });

    it('renders all rule cards', () => {
      const rules = [
        createMockRule('rule-1', 'Test Rule 1'),
        createMockRule('rule-2', 'Test Rule 2'),
        createMockRule('rule-3', 'Test Rule 3'),
      ];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('Test Rule 1')).toBeInTheDocument();
      expect(screen.getByText('Test Rule 2')).toBeInTheDocument();
      expect(screen.getByText('Test Rule 3')).toBeInTheDocument();
    });

    it('renders rules sorted by order field', () => {
      const rules = [
        { ...createMockRule('rule-a', 'Rule C (order 2)'), order: 2 },
        { ...createMockRule('rule-b', 'Rule A (order 0)'), order: 0 },
        { ...createMockRule('rule-c', 'Rule B (order 1)'), order: 1 },
      ];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      const headings = screen.getAllByRole('heading', { level: 3 });
      // Filter to just rule name headings (skip the "Automation Rules" h2)
      const ruleNames = headings.map((h) => h.textContent);
      expect(ruleNames).toEqual(['Rule A (order 0)', 'Rule B (order 1)', 'Rule C (order 2)']);
    });

    it('opens RuleDialog when "+ New Rule" button is clicked', async () => {
      const user = userEvent.setup();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      const newRuleButton = screen.getByText('+ New Rule');
      await user.click(newRuleButton);

      await waitFor(() => {
        expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
      });
    });
  });

  describe('edit functionality', () => {
    it('opens RuleDialog in edit mode when Edit is clicked', async () => {
      const user = userEvent.setup();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open the actions menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Click Edit
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      // Dialog should open in edit mode
      await waitFor(() => {
        expect(screen.getByText('Edit Automation Rule')).toBeInTheDocument();
      });
    });
  });

  describe('duplicate functionality', () => {
    it('calls duplicateRule when "In this project" is clicked in Duplicate submenu', async () => {
      const user = userEvent.setup();
      const duplicateRule = vi.fn();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        duplicateRule,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open the actions menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Click Duplicate submenu trigger
      const duplicateTrigger = screen.getByText('Duplicate');
      await user.click(duplicateTrigger);

      // Click "In this project" — use pointer for Radix submenu items in jsdom
      const inThisProject = await screen.findByText('In this project');
      await user.pointer({ target: inThisProject, keys: '[MouseLeft]' });

      expect(duplicateRule).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('delete functionality', () => {
    it('shows confirmation dialog when Delete is clicked', async () => {
      const user = userEvent.setup();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open the actions menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Click Delete
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Delete this automation?')).toBeInTheDocument();
        expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
      });
    });

    it('calls deleteRule when deletion is confirmed', async () => {
      const user = userEvent.setup();
      const deleteRule = vi.fn();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        deleteRule,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open the actions menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Click Delete
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      // Confirm deletion
      await waitFor(() => {
        expect(screen.getByText('Delete this automation?')).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(confirmButton);

      expect(deleteRule).toHaveBeenCalledWith('rule-1');
    });

    it('does not call deleteRule when deletion is cancelled', async () => {
      const user = userEvent.setup();
      const deleteRule = vi.fn();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        deleteRule,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open the actions menu
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // Click Delete
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      // Cancel deletion
      await waitFor(() => {
        expect(screen.getByText('Delete this automation?')).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(deleteRule).not.toHaveBeenCalled();
    });
  });

  describe('toggle functionality', () => {
    it('calls toggleRule when switch is toggled', async () => {
      const user = userEvent.setup();
      const toggleRule = vi.fn();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        toggleRule,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      const switchElement = screen.getByRole('switch');
      await user.click(switchElement);

      expect(toggleRule).toHaveBeenCalledWith('rule-1');
    });
  });

  describe('max rules warning badge', () => {
    it('shows warning badge when rule count >= 10', () => {
      const rules = Array.from({ length: 10 }, (_, i) => createMockRule(`rule-${i}`, `Rule ${i}`));
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('10 rules')).toBeInTheDocument();
      expect(screen.getByTitle('Consider reviewing and consolidating your rules')).toBeInTheDocument();
    });

    it('does not show warning badge when rule count < 10', () => {
      const rules = Array.from({ length: 9 }, (_, i) => createMockRule(`rule-${i}`, `Rule ${i}`));
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.queryByText('9 rules')).not.toBeInTheDocument();
    });
  });

  describe('bulk enable/disable toggle', () => {
    it('shows "Disable all" when any rules are enabled', () => {
      const rules = [
        createMockRule('rule-1', 'Rule 1'),
        { ...createMockRule('rule-2', 'Rule 2'), enabled: false },
      ];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('Disable all')).toBeInTheDocument();
    });

    it('shows "Enable all" when all rules are disabled', () => {
      const rules = [
        { ...createMockRule('rule-1', 'Rule 1'), enabled: false },
        { ...createMockRule('rule-2', 'Rule 2'), enabled: false },
      ];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('Enable all')).toBeInTheDocument();
    });

    it('calls bulkSetEnabled(false) when "Disable all" is clicked', async () => {
      const user = userEvent.setup();
      const bulkSetEnabled = vi.fn();
      const rules = [createMockRule('rule-1', 'Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        bulkSetEnabled,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      await user.click(screen.getByText('Disable all'));

      expect(bulkSetEnabled).toHaveBeenCalledWith(false);
    });

    it('calls bulkSetEnabled(true) when "Enable all" is clicked', async () => {
      const user = userEvent.setup();
      const bulkSetEnabled = vi.fn();
      const rules = [{ ...createMockRule('rule-1', 'Rule 1'), enabled: false }];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
        bulkSetEnabled,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      await user.click(screen.getByText('Enable all'));

      expect(bulkSetEnabled).toHaveBeenCalledWith(true);
    });

    it('does not show bulk toggle in empty state', () => {
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules: [],
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.queryByText('Disable all')).not.toBeInTheDocument();
      expect(screen.queryByText('Enable all')).not.toBeInTheDocument();
    });
  });

  describe('dialog state management', () => {
    it('resets editingRuleId when dialog is closed', async () => {
      const user = userEvent.setup();
      const rules = [createMockRule('rule-1', 'Test Rule 1')];
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      // Open edit dialog
      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Edit Automation Rule')).toBeInTheDocument();
      });

      // Close dialog by pressing Escape
      await user.keyboard('{Escape}');

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText('Edit Automation Rule')).not.toBeInTheDocument();
      });

      // Open new rule dialog - should be in create mode
      const newRuleButton = screen.getByText('+ New Rule');
      await user.click(newRuleButton);

      await waitFor(() => {
        expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
      });
    });
  });

  describe('max rules warning toast (Req 9.1, 9.2)', () => {
    it('shows warning badge when rule count >= 10 (Req 9.3 — observable indicator)', () => {
      const rules = Array.from({ length: 10 }, (_, i) => createMockRule(`rule-${i}`, `Rule ${i}`));
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.getByText('10 rules')).toBeInTheDocument();
      expect(screen.getByTitle('Consider reviewing and consolidating your rules')).toBeInTheDocument();
    });

    it('does not block rule creation at the limit — "+ New Rule" button remains enabled (Req 9.2)', () => {
      const rules = Array.from({ length: 12 }, (_, i) => createMockRule(`rule-${i}`, `Rule ${i}`));
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      const newRuleButton = screen.getByText('+ New Rule');
      expect(newRuleButton).toBeInTheDocument();
      expect(newRuleButton).not.toBeDisabled();
    });

    it('does not show warning badge below threshold', () => {
      const rules = Array.from({ length: 9 }, (_, i) => createMockRule(`rule-${i}`, `Rule ${i}`));
      (useAutomationRules as any).mockReturnValue({
        ...mockHandlers,
        rules,
      });

      render(<AutomationTab projectId="project-1" sections={mockSections} />);

      expect(screen.queryByTitle('Consider reviewing and consolidating your rules')).not.toBeInTheDocument();
    });
  });
});
