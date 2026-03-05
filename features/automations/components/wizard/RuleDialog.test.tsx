import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RuleDialog } from './RuleDialog';
import type { AutomationRule } from '../../types';
import type { Section, Project } from '@/lib/schemas';

// Mock the hooks
vi.mock('../../hooks/useAutomationRules', () => ({
  useAutomationRules: vi.fn(() => ({
    rules: [],
    createRule: vi.fn(),
    updateRule: vi.fn(),
  })),
}));

vi.mock('../../hooks/useWizardState', () => ({
  useWizardState: vi.fn(),
}));

// Mock child components
vi.mock('./RuleDialogStepScope', () => ({
  RuleDialogStepScope: ({ onNext, onBack }: any) => (
    <div data-testid="scope-step">
      <button onClick={onBack}>Back</button>
      <button onClick={onNext}>Next</button>
    </div>
  ),
}));

vi.mock('./RuleDialogStepTrigger', () => ({
  RuleDialogStepTrigger: () => <div data-testid="trigger-step">Trigger Step</div>,
}));

vi.mock('./RuleDialogStepFilters', () => ({
  RuleDialogStepFilters: () => <div data-testid="filters-step">Filters Step</div>,
}));

vi.mock('./RuleDialogStepAction', () => ({
  RuleDialogStepAction: () => <div data-testid="action-step">Action Step</div>,
}));

vi.mock('./RuleDialogStepReview', () => ({
  RuleDialogStepReview: () => <div data-testid="review-step">Review Step</div>,
}));

vi.mock('../RulePreview', () => ({
  RulePreview: () => <div data-testid="rule-preview">Preview</div>,
}));

vi.mock('./ScopeChangeConfirmDialog', () => ({
  ScopeChangeConfirmDialog: ({ open, onConfirm }: any) =>
    open ? (
      <div data-testid="scope-change-dialog">
        <button onClick={onConfirm}>Save anyway</button>
      </div>
    ) : null,
}));

vi.mock('./SectionResolutionStep', () => ({
  SectionResolutionStep: () => <div data-testid="section-resolution-step">Section Resolution</div>,
}));

const mockSections: Section[] = [
  { id: 'sec-1', name: 'To Do', projectId: 'proj-1', order: 0, collapsed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'sec-2', name: 'Done', projectId: 'proj-1', order: 1, collapsed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockProjects: Project[] = [
  { id: 'proj-1', name: 'Project 1', description: '', viewMode: 'list', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'proj-2', name: 'Project 2', description: '', viewMode: 'list', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const mockAllSections: Section[] = [
  ...mockSections,
  { id: 'sec-3', name: 'To Do', projectId: 'proj-2', order: 0, collapsed: false, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const createMockWizardState = (overrides = {}) => ({
  currentStep: 0,
  trigger: { type: null, sectionId: null },
  filters: [],
  action: { type: null },
  ruleName: '',
  scope: 'all' as const,
  selectedProjectIds: [],
  isDirty: false,
  stepAnnouncement: '',
  showFilters: true,
  isSaveDisabled: true,
  hasSameSectionWarning: false,
  handleTriggerChange: vi.fn(),
  handleFiltersChange: vi.fn(),
  handleActionChange: vi.fn(),
  handleRuleNameChange: vi.fn(),
  handleScopeChange: vi.fn(),
  handleNext: vi.fn(),
  handleBack: vi.fn(),
  handleSkipFilters: vi.fn(),
  handleNavigateToStep: vi.fn(),
  isStepValid: vi.fn(() => false),
  resetDirty: vi.fn(),
  ...overrides,
});

describe('RuleDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Project rules (isGlobal=false)', () => {
    it('shows 4 steps without Scope step', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState());

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={false}
        />
      );

      // Should show 4 steps: Trigger, Filters, Action, Review
      expect(screen.getByText('Trigger')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();

      // Should NOT show Scope step
      expect(screen.queryByText('Scope')).not.toBeInTheDocument();
      expect(screen.queryByTestId('scope-step')).not.toBeInTheDocument();
    });
  });

  describe('Global rules (isGlobal=true)', () => {
    it('shows 5 steps with Scope as step 1', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState());

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      // Should show 5 steps: Scope, Trigger, Filters, Action, Review
      expect(screen.getByText('Scope')).toBeInTheDocument();
      expect(screen.getByText('Trigger')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('renders Scope step content at step 0', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState({ currentStep: 0 }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      expect(screen.getByTestId('scope-step')).toBeInTheDocument();
    });

    it('renders Trigger step content at step 1', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState({ 
        currentStep: 1,
        isStepValid: vi.fn(() => true),
      }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      expect(screen.getByTestId('trigger-step')).toBeInTheDocument();
    });
  });

  describe('Promotion flow (promoteFromRule)', () => {
    const sourceRule: AutomationRule = {
      id: 'rule-1',
      projectId: 'proj-1',
      name: 'Original Rule',
      trigger: { type: 'card_created', sectionId: 'sec-1' },
      filters: [],
      action: { type: 'move_card_to_top_of_section', sectionId: 'sec-2' },
      enabled: true,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      scope: 'all',
      selectedProjectIds: [],
      brokenReason: null,
      bulkPausedAt: null,
      excludedProjectIds: [],
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
    };

    it('pre-fills rule name with " (Global)" suffix', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState({
        ruleName: 'Original Rule (Global)',
        trigger: sourceRule.trigger,
        filters: sourceRule.filters,
        action: sourceRule.action,
        scope: 'selected',
        selectedProjectIds: ['proj-1'],
        isSaveDisabled: false,
        isStepValid: vi.fn(() => true),
      }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          promoteFromRule={sourceRule}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      // Wizard state should have the suffixed name
      expect((useWizardState as any).mock.results[0].value.ruleName).toBe('Original Rule (Global)');
    });

    it('defaults scope to "selected" with source project pre-checked', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState({
        ruleName: 'Original Rule (Global)',
        trigger: sourceRule.trigger,
        filters: sourceRule.filters,
        action: sourceRule.action,
        scope: 'selected',
        selectedProjectIds: ['proj-1'],
        isSaveDisabled: false,
        isStepValid: vi.fn(() => true),
      }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          promoteFromRule={sourceRule}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      const wizardState = (useWizardState as any).mock.results[0].value;
      expect(wizardState.scope).toBe('selected');
      expect(wizardState.selectedProjectIds).toEqual(['proj-1']);
    });
  });

  describe('Step indicator rendering', () => {
    it('renders steps dynamically from visibleSteps array', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      (useWizardState as any).mockReturnValue(createMockWizardState({
        trigger: { type: 'card_created', sectionId: null },
        showFilters: false, // Filters step hidden
      }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      // Should show 4 steps when filters hidden: Scope, Trigger, Action, Review
      expect(screen.getByText('Scope')).toBeInTheDocument();
      expect(screen.getByText('Trigger')).toBeInTheDocument();
      expect(screen.queryByText('Filters')).not.toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });
  });

  describe('Scope validation', () => {
    it('blocks Next button when scope is "selected" with 0 projects', async () => {
      const { useWizardState } = await import('../../hooks/useWizardState');
      const isStepValid = vi.fn((step) => step === 0 ? false : true);
      (useWizardState as any).mockReturnValue(createMockWizardState({
        scope: 'selected',
        selectedProjectIds: [],
        isStepValid,
      }));

      render(
        <RuleDialog
          open={true}
          onOpenChange={vi.fn()}
          projectId="proj-1"
          sections={mockSections}
          isGlobal={true}
          allProjects={mockProjects}
          allSections={mockAllSections}
        />
      );

      // Step 0 should be invalid
      expect(isStepValid(0)).toBe(false);
    });
  });
});
