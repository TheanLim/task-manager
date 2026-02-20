import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleDialogStepReview } from './RuleDialogStepReview';
import type { TriggerConfig, ActionConfig } from '../../services/preview/rulePreviewService';
import type { Section } from '@/lib/schemas';

describe('RuleDialogStepReview', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
    action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    filters: [],
    ruleName: '',
    onRuleNameChange: vi.fn(),
    onFiltersChange: vi.fn(),
    sections: mockSections,
    onNavigateToStep: vi.fn(),
    onSave: vi.fn(),
    isSaveDisabled: false,
  };

  it('renders WHEN and THEN blocks with correct descriptions', () => {
    render(<RuleDialogStepReview {...defaultProps} />);

    expect(screen.getByText('WHEN')).toBeInTheDocument();
    expect(screen.getByText('THEN')).toBeInTheDocument();
    expect(screen.getByText(/moved into section To Do/i)).toBeInTheDocument();
    expect(screen.getByText(/mark as complete/i)).toBeInTheDocument();
  });

  it('applies correct category color borders to WHEN block', () => {
    const { container } = render(<RuleDialogStepReview {...defaultProps} />);
    
    // Card move trigger should have blue border
    const whenCard = container.querySelector('.border-l-blue-500');
    expect(whenCard).toBeInTheDocument();
  });

  it('applies correct category color borders to THEN block for move action', () => {
    const props = {
      ...defaultProps,
      action: { type: 'move_card_to_top_of_section' as const, sectionId: 'section-2', dateOption: null, position: 'top' as const, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    const { container } = render(<RuleDialogStepReview {...props} />);
    
    // Move action should have sky border
    const thenCard = container.querySelector('.border-l-sky-500');
    expect(thenCard).toBeInTheDocument();
  });

  it('applies correct category color borders to THEN block for status action', () => {
    const { container } = render(<RuleDialogStepReview {...defaultProps} />);
    
    // Status action should have emerald border
    const thenCard = container.querySelector('.border-l-emerald-500');
    expect(thenCard).toBeInTheDocument();
  });

  it('applies correct category color borders to THEN block for date action', () => {
    const props = {
      ...defaultProps,
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'today' as const, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    const { container } = render(<RuleDialogStepReview {...props} />);
    
    // Date action should have amber border
    const thenCard = container.querySelector('.border-l-amber-500');
    expect(thenCard).toBeInTheDocument();
  });

  it('calls onNavigateToStep(0) when WHEN block is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();
    
    render(<RuleDialogStepReview {...defaultProps} onNavigateToStep={onNavigateToStep} />);
    
    const whenBlock = screen.getByText('WHEN').closest('div')?.parentElement;
    expect(whenBlock).toBeInTheDocument();
    
    await user.click(whenBlock!);
    expect(onNavigateToStep).toHaveBeenCalledWith(0);
  });

  it('calls onNavigateToStep(2) when THEN block is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();
    
    render(<RuleDialogStepReview {...defaultProps} onNavigateToStep={onNavigateToStep} />);
    
    const thenBlock = screen.getByText('THEN').closest('div')?.parentElement;
    expect(thenBlock).toBeInTheDocument();
    
    await user.click(thenBlock!);
    expect(onNavigateToStep).toHaveBeenCalledWith(2);
  });

  it('does not render IF block when no filters are configured', () => {
    render(<RuleDialogStepReview {...defaultProps} />);
    
    expect(screen.queryByText('IF')).not.toBeInTheDocument();
  });

  it('renders IF block with filter badges when filters are configured', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'in_section' as const, sectionId: 'section-2' },
        { type: 'has_due_date' as const },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('IF')).toBeInTheDocument();
    expect(screen.getByText('in "In Progress"')).toBeInTheDocument();
    expect(screen.getByText('with a due date')).toBeInTheDocument();
  });

  it('renders section filter badges with correct descriptions', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'in_section' as const, sectionId: 'section-3' },
        { type: 'not_in_section' as const, sectionId: 'section-1' },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('in "Done"')).toBeInTheDocument();
    expect(screen.getByText('not in "To Do"')).toBeInTheDocument();
  });

  it('renders date presence filter badges with correct descriptions', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'has_due_date' as const },
        { type: 'no_due_date' as const },
        { type: 'is_overdue' as const },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('with a due date')).toBeInTheDocument();
    expect(screen.getByText('without a due date')).toBeInTheDocument();
    expect(screen.getByText('that is overdue')).toBeInTheDocument();
  });

  it('renders positive date range filter badges with correct descriptions', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'due_today' as const },
        { type: 'due_tomorrow' as const },
        { type: 'due_this_week' as const },
        { type: 'due_next_week' as const },
        { type: 'due_this_month' as const },
        { type: 'due_next_month' as const },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('due today')).toBeInTheDocument();
    expect(screen.getByText('due tomorrow')).toBeInTheDocument();
    expect(screen.getByText('due this week')).toBeInTheDocument();
    expect(screen.getByText('due next week')).toBeInTheDocument();
    expect(screen.getByText('due this month')).toBeInTheDocument();
    expect(screen.getByText('due next month')).toBeInTheDocument();
  });

  it('renders negative date range filter badges with correct descriptions', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'not_due_today' as const },
        { type: 'not_due_tomorrow' as const },
        { type: 'not_due_this_week' as const },
        { type: 'not_due_next_week' as const },
        { type: 'not_due_this_month' as const },
        { type: 'not_due_next_month' as const },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('not due today')).toBeInTheDocument();
    expect(screen.getByText('not due tomorrow')).toBeInTheDocument();
    expect(screen.getByText('not due this week')).toBeInTheDocument();
    expect(screen.getByText('not due next week')).toBeInTheDocument();
    expect(screen.getByText('not due this month')).toBeInTheDocument();
    expect(screen.getByText('not due next month')).toBeInTheDocument();
  });

  it('renders comparison filter badges with correct descriptions', () => {
    const props = {
      ...defaultProps,
      filters: [
        { type: 'due_in_less_than' as const, value: 3, unit: 'days' as const },
        { type: 'due_in_more_than' as const, value: 7, unit: 'working_days' as const },
        { type: 'due_in_exactly' as const, value: 5, unit: 'days' as const },
        { type: 'due_in_between' as const, minValue: 2, maxValue: 10, unit: 'working_days' as const },
      ],
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText('due in less than 3 days')).toBeInTheDocument();
    expect(screen.getByText('due in more than 7 working days')).toBeInTheDocument();
    expect(screen.getByText('due in exactly 5 days')).toBeInTheDocument();
    expect(screen.getByText('due in 2-10 working days')).toBeInTheDocument();
  });

  it('calls onFiltersChange when filter X button is clicked', async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    const props = {
      ...defaultProps,
      filters: [
        { type: 'has_due_date' as const },
        { type: 'due_today' as const },
      ],
      onFiltersChange,
    };
    render(<RuleDialogStepReview {...props} />);
    
    const removeButtons = screen.getAllByLabelText('Remove filter');
    expect(removeButtons).toHaveLength(2);
    
    await user.click(removeButtons[0]);
    
    expect(onFiltersChange).toHaveBeenCalledWith([{ type: 'due_today' }]);
  });

  it('calls onNavigateToStep(1) when IF block is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();
    const props = {
      ...defaultProps,
      filters: [{ type: 'has_due_date' as const }],
      onNavigateToStep,
    };
    render(<RuleDialogStepReview {...props} />);
    
    const ifBlock = screen.getByText('IF').closest('div')?.parentElement;
    expect(ifBlock).toBeInTheDocument();
    
    await user.click(ifBlock!);
    expect(onNavigateToStep).toHaveBeenCalledWith(1);
  });

  it('applies purple border to IF block', () => {
    const props = {
      ...defaultProps,
      filters: [{ type: 'has_due_date' as const }],
    };
    const { container } = render(<RuleDialogStepReview {...props} />);
    
    const ifCard = container.querySelector('.border-l-purple-500');
    expect(ifCard).toBeInTheDocument();
  });

  it('renders multiple arrows when filters are present', () => {
    const props = {
      ...defaultProps,
      filters: [{ type: 'has_due_date' as const }],
    };
    const { container } = render(<RuleDialogStepReview {...props} />);
    
    // Should have 3 arrows: WHEN -> IF, IF -> THEN
    const arrows = container.querySelectorAll('svg');
    expect(arrows.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onNavigateToStep(2) when THEN block is clicked (with filters)', async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();
    const props = {
      ...defaultProps,
      filters: [{ type: 'has_due_date' as const }],
      onNavigateToStep,
    };
    render(<RuleDialogStepReview {...props} />);
    
    const thenBlock = screen.getByText('THEN').closest('div')?.parentElement;
    expect(thenBlock).toBeInTheDocument();
    
    await user.click(thenBlock!);
    expect(onNavigateToStep).toHaveBeenCalledWith(2);
  });

  it('renders rule name input with placeholder from preview', () => {
    render(<RuleDialogStepReview {...defaultProps} />);
    
    const input = screen.getByLabelText(/rule name/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('placeholder', expect.stringContaining('moved into'));
  });

  it('calls onRuleNameChange when user types in name input', async () => {
    const user = userEvent.setup();
    const onRuleNameChange = vi.fn();
    
    render(<RuleDialogStepReview {...defaultProps} onRuleNameChange={onRuleNameChange} />);
    
    const input = screen.getByLabelText(/rule name/i);
    await user.type(input, 'My Custom Rule');
    
    expect(onRuleNameChange).toHaveBeenCalled();
  });

  it('displays custom rule name when provided', () => {
    const props = { ...defaultProps, ruleName: 'My Custom Rule' };
    render(<RuleDialogStepReview {...props} />);
    
    const input = screen.getByLabelText(/rule name/i) as HTMLInputElement;
    expect(input.value).toBe('My Custom Rule');
  });

  it('renders Save Rule button', () => {
    render(<RuleDialogStepReview {...defaultProps} />);
    
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    expect(saveButton).toBeInTheDocument();
  });

  it('calls onSave when Save Rule button is clicked', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    
    render(<RuleDialogStepReview {...defaultProps} onSave={onSave} />);
    
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    await user.click(saveButton);
    
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('disables Save Rule button when isSaveDisabled is true', () => {
    const props = { ...defaultProps, isSaveDisabled: true };
    render(<RuleDialogStepReview {...props} />);
    
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables Save Rule button when isSaveDisabled is false', () => {
    render(<RuleDialogStepReview {...defaultProps} />);
    
    const saveButton = screen.getByRole('button', { name: /save rule/i });
    expect(saveButton).toBeEnabled();
  });

  it('renders move action with position and section', () => {
    const props = {
      ...defaultProps,
      action: { type: 'move_card_to_bottom_of_section' as const, sectionId: 'section-3', dateOption: null, position: 'bottom' as const, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/move to bottom of Done/i)).toBeInTheDocument();
  });

  it('renders set due date action with date option', () => {
    const props = {
      ...defaultProps,
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'tomorrow' as const, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/set due date to tomorrow/i)).toBeInTheDocument();
  });

  it('renders next working day correctly', () => {
    const props = {
      ...defaultProps,
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'next_working_day' as const, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/set due date to next working day/i)).toBeInTheDocument();
  });

  it('shows placeholder when trigger section is missing', () => {
    const props = {
      ...defaultProps,
      trigger: { type: 'card_moved_into_section' as const, sectionId: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/moved into section ___/i)).toBeInTheDocument();
  });

  it('shows placeholder when action section is missing', () => {
    const props = {
      ...defaultProps,
      action: { type: 'move_card_to_top_of_section' as const, sectionId: null, dateOption: null, position: 'top' as const, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/move to top of ___/i)).toBeInTheDocument();
  });

  it('renders card change trigger with emerald border', () => {
    const props = {
      ...defaultProps,
      trigger: { type: 'card_marked_complete' as const, sectionId: null },
    };
    const { container } = render(<RuleDialogStepReview {...props} />);
    
    const whenCard = container.querySelector('.border-l-emerald-500');
    expect(whenCard).toBeInTheDocument();
  });

  it('renders arrow between WHEN and THEN blocks', () => {
    const { container } = render(<RuleDialogStepReview {...defaultProps} />);
    
    // Check for ArrowDown icon (lucide-react renders as svg)
    const arrow = container.querySelector('svg');
    expect(arrow).toBeInTheDocument();
  });

  it('applies hover effect classes to clickable blocks', () => {
    const { container } = render(<RuleDialogStepReview {...defaultProps} />);
    
    const cards = container.querySelectorAll('.cursor-pointer');
    expect(cards.length).toBe(2); // WHEN and THEN blocks
  });

  it('displays helper text for rule name input', () => {
    render(<RuleDialogStepReview {...defaultProps} />);
    
    expect(screen.getByText(/leave blank to use the auto-generated name/i)).toBeInTheDocument();
  });

  describe('one-time trigger review', () => {
    const oneTimeTrigger: TriggerConfig = {
      type: 'scheduled_one_time',
      sectionId: null,
      schedule: { kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' },
    };

    const oneTimeAction: typeof defaultProps.action = {
      type: 'mark_card_complete' as const,
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    };

    it('renders "ON" card label instead of "EVERY" for one-time triggers', () => {
      render(
        <RuleDialogStepReview
          {...defaultProps}
          trigger={oneTimeTrigger}
          action={oneTimeAction}
        />
      );

      expect(screen.getByText('ON')).toBeInTheDocument();
      expect(screen.queryByText('EVERY')).not.toBeInTheDocument();
      expect(screen.queryByText('WHEN')).not.toBeInTheDocument();
    });

    it('renders amber border on the ON card for one-time triggers', () => {
      const { container } = render(
        <RuleDialogStepReview
          {...defaultProps}
          trigger={oneTimeTrigger}
          action={oneTimeAction}
        />
      );

      const amberCard = container.querySelector('.border-l-amber-500');
      expect(amberCard).toBeInTheDocument();
    });

    it('renders one-time trigger description with "On" prefix and formatted date', () => {
      render(
        <RuleDialogStepReview
          {...defaultProps}
          trigger={oneTimeTrigger}
          action={oneTimeAction}
        />
      );

      // describeSchedule returns "On Mar 15, 2025 at 15:00" for this fireAt
      expect(screen.getByText(/On Mar 15, 2025 at 15:00/)).toBeInTheDocument();
    });

    it('renders preview sentence with "On" prefix for one-time triggers', () => {
      render(
        <RuleDialogStepReview
          {...defaultProps}
          trigger={oneTimeTrigger}
          action={oneTimeAction}
        />
      );

      // The preview placeholder should contain the one-time description
      const input = screen.getByLabelText(/rule name/i);
      expect(input).toHaveAttribute('placeholder', expect.stringContaining('On Mar 15, 2025'));
    });

    it('renders "EVERY" card label for recurring scheduled triggers', () => {
      const cronTrigger: TriggerConfig = {
        type: 'scheduled_cron',
        sectionId: null,
        schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] },
      };

      render(
        <RuleDialogStepReview
          {...defaultProps}
          trigger={cronTrigger}
          action={oneTimeAction}
        />
      );

      expect(screen.getByText('EVERY')).toBeInTheDocument();
      expect(screen.queryByText('ON')).not.toBeInTheDocument();
    });
  });
});
