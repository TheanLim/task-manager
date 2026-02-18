import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RuleDialogStepReview } from './RuleDialogStepReview';
import type { TriggerConfig, ActionConfig } from '../services/rulePreviewService';
import type { Section } from '@/lib/schemas';

describe('RuleDialogStepReview', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'In Progress', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-3', projectId: 'project-1', name: 'Done', order: 2, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    trigger: { type: 'card_moved_into_section' as const, sectionId: 'section-1' },
    action: { type: 'mark_card_complete' as const, sectionId: null, dateOption: null, position: null },
    ruleName: '',
    onRuleNameChange: vi.fn(),
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
      action: { type: 'move_card_to_top_of_section' as const, sectionId: 'section-2', dateOption: null, position: 'top' as const },
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
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'today' as const, position: null },
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

  it('calls onNavigateToStep(1) when THEN block is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToStep = vi.fn();
    
    render(<RuleDialogStepReview {...defaultProps} onNavigateToStep={onNavigateToStep} />);
    
    const thenBlock = screen.getByText('THEN').closest('div')?.parentElement;
    expect(thenBlock).toBeInTheDocument();
    
    await user.click(thenBlock!);
    expect(onNavigateToStep).toHaveBeenCalledWith(1);
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
      action: { type: 'move_card_to_bottom_of_section' as const, sectionId: 'section-3', dateOption: null, position: 'bottom' as const },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/move to bottom of Done/i)).toBeInTheDocument();
  });

  it('renders set due date action with date option', () => {
    const props = {
      ...defaultProps,
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'tomorrow' as const, position: null },
    };
    render(<RuleDialogStepReview {...props} />);
    
    expect(screen.getByText(/set due date to tomorrow/i)).toBeInTheDocument();
  });

  it('renders next working day correctly', () => {
    const props = {
      ...defaultProps,
      action: { type: 'set_due_date' as const, sectionId: null, dateOption: 'next_working_day' as const, position: null },
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
      action: { type: 'move_card_to_top_of_section' as const, sectionId: null, dateOption: null, position: 'top' as const },
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
});
