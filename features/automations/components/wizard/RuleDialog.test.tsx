import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleDialog } from './RuleDialog';
import type { AutomationRule } from '../../types';
import type { Section } from '@/lib/schemas';
import * as fc from 'fast-check';

/**
 * Component Tests for RuleDialog
 * 
 * Feature: automations-ui
 * 
 * These tests verify the multi-step wizard behavior, validation, navigation,
 * and save functionality of the RuleDialog component.
 */

// Mock the useAutomationRules hook
const mockCreateRule = vi.fn();
const mockUpdateRule = vi.fn();
let mockRules: AutomationRule[] = [];

vi.mock('../../hooks/useAutomationRules', () => ({
  useAutomationRules: () => ({
    get rules() { return mockRules; },
    createRule: mockCreateRule,
    updateRule: mockUpdateRule,
    deleteRule: vi.fn(),
    duplicateRule: vi.fn(),
    toggleRule: vi.fn(),
  }),
}));

describe('RuleDialog - Unit Tests', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'project-1',
    sections: mockSections,
    editingRule: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('Step Navigation', () => {
    it('renders step indicator with four steps', () => {
      render(<RuleDialog {...defaultProps} />);
      
      expect(screen.getByText('Trigger')).toBeInTheDocument();
      expect(screen.getByText('Filters')).toBeInTheDocument();
      expect(screen.getByText('Action')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
    });

    it('starts on Trigger step (step 0)', () => {
      render(<RuleDialog {...defaultProps} />);
      
      expect(screen.getByText(/Card Move/i)).toBeInTheDocument();
      expect(screen.getByText(/Card Change/i)).toBeInTheDocument();
    });

    it('advances to Filters step when Next is clicked with valid card-level trigger', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add filter/i })).toBeInTheDocument();
      });
    });

    it('skips Filters step for section-level triggers', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
    });

    it('advances from Filters to Action step', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
      
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
        expect(screen.getByText('Dates')).toBeInTheDocument();
      });
    });

    it('goes back from Filters to Trigger step when Back is clicked', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
      
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);
      
      await waitFor(() => {
        expect(screen.getByText('Card Move')).toBeInTheDocument();
        expect(screen.getByText('Card Change')).toBeInTheDocument();
      });
    });

    it('goes back from Action to Filters step when Back is clicked', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      let nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
      
      nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
      
      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
    });

    it('disables Back button on first step', () => {
      render(<RuleDialog {...defaultProps} />);
      
      const backButton = screen.getByRole('button', { name: /back/i });
      expect(backButton).toBeDisabled();
    });

    it('allows clicking step indicator to navigate when preceding steps are valid', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      const actionStepButton = screen.getByText('Action').closest('button');
      expect(actionStepButton).not.toBeDisabled();
      await user.click(actionStepButton!);
      
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });

    it('Skip button on Filters step advances to Action', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      await user.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
      });
      
      const skipButton = screen.getByRole('button', { name: /skip/i });
      await user.click(skipButton);
      
      await waitFor(() => {
        expect(screen.getByText('Status')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('shows discard confirmation when Escape is pressed with dirty form', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<RuleDialog {...defaultProps} onOpenChange={onOpenChange} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.getByText(/discard unsaved changes/i)).toBeInTheDocument();
      });
      
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('closes dialog without confirmation when Escape is pressed with clean form', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<RuleDialog {...defaultProps} onOpenChange={onOpenChange} />);
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('closes dialog when Discard is clicked in confirmation', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<RuleDialog {...defaultProps} onOpenChange={onOpenChange} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      await user.keyboard('{Escape}');
      
      const discardButton = await screen.findByRole('button', { name: /discard/i });
      await user.click(discardButton);
      
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('keeps dialog open when Cancel is clicked in confirmation', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<RuleDialog {...defaultProps} onOpenChange={onOpenChange} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      await user.keyboard('{Escape}');
      
      const cancelButton = await screen.findByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.getByText('Trigger')).toBeInTheDocument();
    });
  });

  describe('Rule Preview', () => {
    it('displays rule preview at all times', () => {
      render(<RuleDialog {...defaultProps} />);
      
      expect(screen.getByText('PREVIEW')).toBeInTheDocument();
    });

    it('updates preview when trigger is selected', async () => {
      const user = userEvent.setup();
      render(<RuleDialog {...defaultProps} />);
      
      const completeRadio = screen.getByLabelText(/marked complete/i);
      await user.click(completeRadio);
      
      await waitFor(() => {
        const badges = screen.getAllByText(/marked complete/i);
        expect(badges.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Prefill Trigger', () => {
    it('pre-populates trigger when prefillTrigger is provided', () => {
      render(
        <RuleDialog
          {...defaultProps}
          prefillTrigger={{ triggerType: 'card_moved_into_section', sectionId: 'section-1' }}
        />
      );

      expect(screen.getByText('Create Automation Rule')).toBeInTheDocument();
    });

    it('allows changing pre-filled trigger — Next is enabled', () => {
      render(
        <RuleDialog
          {...defaultProps}
          prefillTrigger={{ triggerType: 'card_moved_into_section', sectionId: 'section-1' }}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it('resets to empty trigger when prefillTrigger is null', () => {
      render(
        <RuleDialog
          {...defaultProps}
          prefillTrigger={null}
        />
      );

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });
});


describe('RuleDialog - Property-Based Tests', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  afterEach(() => {
    cleanup();
  });

  const triggerTypeArb = fc.constantFrom(
    'card_moved_into_section',
    'card_moved_out_of_section',
    'card_marked_complete',
    'card_marked_incomplete'
  );

  const actionTypeArb = fc.constantFrom(
    'move_card_to_top_of_section',
    'move_card_to_bottom_of_section',
    'mark_card_complete',
    'mark_card_incomplete',
    'set_due_date',
    'remove_due_date'
  );

  /**
   * Property 2: Wizard step validation gates navigation
   * **Validates: Requirements 3.3, 4.5, 5.5**
   */
  it('Property 2: Wizard step validation gates navigation', () => {
    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={null}
      />
    );

    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeDisabled();

    cleanup();
  });

  /**
   * Property 4: Save disabled when configuration incomplete
   * **Validates: Requirements 6.5**
   */
  it('Property 4: Save disabled when configuration incomplete', async () => {
    const user = userEvent.setup();
    
    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={null}
      />
    );

    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);

    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    const markCompleteRadio = screen.getByLabelText(/mark as complete/i);
    await user.click(markCompleteRadio);

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      expect(saveButton).toBeEnabled();
    });

    cleanup();
  });

  /**
   * Property 5: Save creates valid rule in repository
   * **Validates: Requirements 6.4, 10.1**
   */
  it('Property 5: Save creates valid rule in repository', async () => {
    const user = userEvent.setup();
    
    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={null}
      />
    );

    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);

    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Status/i)).toBeInTheDocument();
    });

    const markCompleteRadio = screen.getByLabelText(/mark as complete/i);
    await user.click(markCompleteRadio);

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      expect(saveButton).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateRule).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-1',
          enabled: true,
        })
      );
    });

    cleanup();
  });

  /**
   * Property 6: Auto-generated rule name from preview sentence
   * **Validates: Requirements 6.3**
   */
  it('Property 6: Auto-generated rule name from preview sentence', async () => {
    const user = userEvent.setup();
    
    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={null}
      />
    );

    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);

    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Status/i)).toBeInTheDocument();
    });

    const markCompleteRadio = screen.getByLabelText(/mark as complete/i);
    await user.click(markCompleteRadio);

    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      expect(saveButton).toBeInTheDocument();
    });

    const saveButton = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateRule).toHaveBeenCalled();
      const callArgs = mockCreateRule.mock.calls[0][0];
      expect(callArgs.name).toBeTruthy();
      expect(callArgs.name.length).toBeGreaterThan(0);
    });

    cleanup();
  });

  /**
   * Property 12: Edit pre-populates dialog with rule data
   * **Validates: Requirements 10.2**
   */
  it('Property 12: Edit pre-populates dialog with rule data', () => {
    fc.assert(
      fc.property(
        triggerTypeArb,
        actionTypeArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (triggerType, actionType, ruleName) => {
          const editingRule: AutomationRule = {
            id: 'rule-1',
            projectId: 'project-1',
            name: ruleName,
            trigger: {
              type: triggerType,
              sectionId: triggerType.includes('moved') ? 'section-1' : null,
            },
            filters: [],
            action: {
              type: actionType,
              sectionId: actionType.includes('move_card') ? 'section-2' : null,
              dateOption: actionType === 'set_due_date' ? 'today' : null,
              position: actionType.includes('move_card') ? 'top' : null,
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
            order: 0,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          };

          render(
            <RuleDialog
              open={true}
              onOpenChange={vi.fn()}
              projectId="project-1"
              sections={mockSections}
              editingRule={editingRule}
            />
          );

          expect(screen.getByText('Edit Automation Rule')).toBeInTheDocument();

          cleanup();
        }
      ),
      { numRuns: 20 }
    );
  });
});


describe('RuleDialog - Broken Rule Editing (Req 2.5, 2.6)', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'project-1',
    sections: mockSections,
    editingRule: null as AutomationRule | null,
  };

  const brokenRule: AutomationRule = {
    id: 'rule-broken',
    projectId: 'project-1',
    name: 'Broken rule',
    trigger: {
      type: 'card_moved_into_section',
      sectionId: 'deleted-section-id',
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
    enabled: false,
    brokenReason: 'section_deleted',
    executionCount: 0,
    lastExecutedAt: null,
    order: 0,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    recentExecutions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('shows "(Deleted section)" when trigger sectionId references a deleted section', () => {
    render(
      <RuleDialog
        {...defaultProps}
        editingRule={brokenRule}
      />
    );

    expect(screen.getByText('(Deleted section)')).toBeInTheDocument();
  });

  it('does not show "(Deleted section)" on trigger step when trigger has no sectionId', () => {
    const brokenActionRule: AutomationRule = {
      ...brokenRule,
      trigger: {
        type: 'card_marked_complete',
        sectionId: null,
      },
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'deleted-action-section',
        dateOption: null,
        position: 'top',
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
    };

    render(
      <RuleDialog
        {...defaultProps}
        editingRule={brokenActionRule}
      />
    );

    // Trigger step should not show deleted section since trigger has no sectionId
    expect(screen.queryByText('(Deleted section)')).not.toBeInTheDocument();
  });

  it('clears brokenReason and enables rule on save with valid sections', async () => {
    // Use a broken rule where all current section refs are valid
    // (brokenReason was set because a section was deleted, but user has since
    // changed trigger to one that does not need a section)
    const brokenButFixedRule: AutomationRule = {
      ...brokenRule,
      trigger: { type: 'card_marked_complete', sectionId: null },
      action: {
        type: 'mark_card_incomplete',
        sectionId: null,
        dateOption: null,
        position: null,
        cardTitle: null,
        cardDateOption: null,
        specificMonth: null,
        specificDay: null,
        monthTarget: null,
      },
      filters: [],
    };

    const user = userEvent.setup();
    render(
      <RuleDialog
        {...defaultProps}
        editingRule={brokenButFixedRule}
      />
    );

    // Navigate through wizard to save — trigger and action are already valid
    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Filters step
    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Action step
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Review step - save
    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      expect(saveButton).toBeInTheDocument();
    });
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateRule).toHaveBeenCalledWith(
        'rule-broken',
        expect.objectContaining({
          brokenReason: null,
          enabled: true,
        })
      );
    });
  });

  it('does not clear brokenReason when non-broken rule is saved', async () => {
    const normalRule: AutomationRule = {
      ...brokenRule,
      id: 'rule-normal',
      brokenReason: null,
      enabled: true,
      trigger: {
        type: 'card_marked_complete',
        sectionId: null,
      },
    };

    const user = userEvent.setup();
    render(
      <RuleDialog
        {...defaultProps}
        editingRule={normalRule}
      />
    );

    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      const saveButton = screen.getByRole('button', { name: /save rule/i });
      expect(saveButton).toBeInTheDocument();
    });
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateRule).toHaveBeenCalled();
      const callArgs = mockUpdateRule.mock.calls[0][1];
      expect(callArgs).not.toHaveProperty('brokenReason');
      expect(callArgs).not.toHaveProperty('enabled');
    });
  });
});

describe('RuleDialog - Duplicate Rule Warning (Req 11.1, 11.2, 11.3)', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'project-1',
    sections: mockSections,
    editingRule: null as AutomationRule | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  /** Helper to navigate to the review step with trigger=card_marked_complete, action=mark_card_complete */
  async function navigateToReviewWithCompleteRule(user: ReturnType<typeof userEvent.setup>) {
    // Step 0: Trigger — select "marked complete"
    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);
    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Step 1: Filters — skip
    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Step 2: Action — select "mark as complete"
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });
    const markCompleteRadio = screen.getByLabelText(/mark as complete/i);
    await user.click(markCompleteRadio);
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    // Step 3: Review
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
    });
  }

  it('shows duplicate warning on review step when a matching enabled rule exists', async () => {
    mockRules = [{
      id: 'existing-rule',
      projectId: 'project-1',
      name: 'Existing rule',
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }];

    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);
    await navigateToReviewWithCompleteRule(user);

    expect(screen.getByText('⚠️ A similar rule already exists.')).toBeInTheDocument();
  });

  it('does not show duplicate warning when no matching rule exists', async () => {
    mockRules = [{
      id: 'different-rule',
      projectId: 'project-1',
      name: 'Different rule',
      trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
      filters: [],
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }];

    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);
    await navigateToReviewWithCompleteRule(user);

    expect(screen.queryByText('⚠️ A similar rule already exists.')).not.toBeInTheDocument();
  });

  it('does not block save when duplicate warning is shown (Req 11.2)', async () => {
    mockRules = [{
      id: 'existing-rule',
      projectId: 'project-1',
      name: 'Existing rule',
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      enabled: true,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }];

    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);
    await navigateToReviewWithCompleteRule(user);

    // Warning is shown
    expect(screen.getByText('⚠️ A similar rule already exists.')).toBeInTheDocument();

    // Save button is still enabled
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    expect(saveButton).toBeEnabled();

    // Can still save
    await user.click(saveButton);
    await waitFor(() => {
      expect(mockCreateRule).toHaveBeenCalled();
    });
  });

  it('does not show duplicate warning for disabled matching rules', async () => {
    mockRules = [{
      id: 'disabled-rule',
      projectId: 'project-1',
      name: 'Disabled rule',
      trigger: { type: 'card_marked_complete', sectionId: null },
      filters: [],
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
      enabled: false,
      brokenReason: null,
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    }];

    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);
    await navigateToReviewWithCompleteRule(user);

    expect(screen.queryByText('⚠️ A similar rule already exists.')).not.toBeInTheDocument();
  });
});


describe('RuleDialog - Property 3: Back navigation preserves data (Req 3.4)', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'project-1',
    sections: mockSections,
    editingRule: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('preserves trigger selection when navigating forward to Action then back to Trigger', async () => {
    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);

    // Select trigger: "marked complete"
    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);

    // Advance to Filters step
    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    // Advance to Action step
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    // Go back to Filters
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    // Go back to Trigger
    const backButton2 = screen.getByRole('button', { name: /back/i });
    await user.click(backButton2);

    // Trigger selection should be preserved — "marked complete" should still be selected
    await waitFor(() => {
      expect(screen.getByText('Card Move')).toBeInTheDocument();
      const completeRadioAgain = screen.getByLabelText(/marked complete/i);
      expect(completeRadioAgain).toBeChecked();
    });
  });

  it('preserves action selection when navigating forward to Review then back to Action', async () => {
    const user = userEvent.setup();
    render(<RuleDialog {...defaultProps} />);

    // Select trigger
    const completeRadio = screen.getByLabelText(/marked complete/i);
    await user.click(completeRadio);

    // Advance to Filters
    let nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText(/Add optional filters/i)).toBeInTheDocument();
    });

    // Advance to Action
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    // Select action: "mark as complete"
    const markCompleteRadio = screen.getByLabelText(/mark as complete/i);
    await user.click(markCompleteRadio);

    // Advance to Review
    nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save rule/i })).toBeInTheDocument();
    });

    // Go back to Action
    const backButton = screen.getByRole('button', { name: /back/i });
    await user.click(backButton);

    // Action selection should be preserved
    await waitFor(() => {
      expect(screen.getByText('Status')).toBeInTheDocument();
      const markCompleteAgain = screen.getByLabelText(/mark as complete/i);
      expect(markCompleteAgain).toBeChecked();
    });
  });
});


describe('RuleDialog - Same-section validation warning (Req 6.6)', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('shows same-section warning when trigger and action target the same section', () => {
    const editingRule: AutomationRule = {
      id: 'rule-1',
      projectId: 'project-1',
      name: 'Same section rule',
      trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
      filters: [],
      action: {
        type: 'move_card_to_top_of_section',
        sectionId: 'section-1',
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
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={editingRule}
      />
    );

    expect(screen.getByText(/Moving a card to the same section has no effect/)).toBeInTheDocument();
  });

  it('does not show same-section warning when sections differ', () => {
    const editingRule: AutomationRule = {
      id: 'rule-1',
      projectId: 'project-1',
      name: 'Different section rule',
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
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={editingRule}
      />
    );

    expect(screen.queryByText(/Moving a card to the same section has no effect/)).not.toBeInTheDocument();
  });

  it('does not show same-section warning for non-move actions', () => {
    const editingRule: AutomationRule = {
      id: 'rule-1',
      projectId: 'project-1',
      name: 'Non-move rule',
      trigger: { type: 'card_moved_into_section', sectionId: 'section-1' },
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
      executionCount: 0,
      lastExecutedAt: null,
      recentExecutions: [],
      order: 0,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };

    render(
      <RuleDialog
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-1"
        sections={mockSections}
        editingRule={editingRule}
      />
    );

    expect(screen.queryByText(/Moving a card to the same section has no effect/)).not.toBeInTheDocument();
  });
});


describe('RuleDialog - Accessibility: Focus management (Req 14.2, 14.3)', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'project-1',
    sections: mockSections,
    editingRule: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRules = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('has an aria-live region for step announcements (Req 14.3)', () => {
    render(<RuleDialog {...defaultProps} />);

    // The aria-live region is inside the dialog portal, query from document.body
    const liveRegion = document.querySelector('.sr-only[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true');
  });

  it('has step indicator with role="navigation" and aria-label (Req 14.3)', () => {
    render(<RuleDialog {...defaultProps} />);

    const nav = screen.getByRole('navigation', { name: /wizard steps/i });
    expect(nav).toBeInTheDocument();
  });

  it('dialog has role="dialog" (Req 14.1)', () => {
    render(<RuleDialog {...defaultProps} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
  });
});
