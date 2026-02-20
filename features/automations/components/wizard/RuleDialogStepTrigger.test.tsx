import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleDialogStepTrigger } from './RuleDialogStepTrigger';
import type { TriggerConfig } from '../../services/configTypes';
import type { Section } from '@/lib/schemas';

describe('RuleDialogStepTrigger', () => {
  const mockSections: Section[] = [
    { id: 'section-1', projectId: 'project-1', name: 'To Do', order: 0, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
    { id: 'section-2', projectId: 'project-1', name: 'Done', order: 1, collapsed: false, createdAt: '2024-01-01', updatedAt: '2024-01-01' },
  ];

  const defaultProps = {
    trigger: { type: null, sectionId: null } as TriggerConfig,
    onTriggerChange: vi.fn(),
    sections: mockSections,
  };

  describe('one-time trigger option', () => {
    it('renders "at a specific date and time" as 4th radio option in Scheduled category', () => {
      render(<RuleDialogStepTrigger {...defaultProps} />);

      // The Scheduled category should contain the one-time option
      expect(screen.getByText('at a specific date and time')).toBeInTheDocument();

      // Verify it's a radio button
      const radio = screen.getByDisplayValue('scheduled_one_time');
      expect(radio).toBeInTheDocument();
      expect(radio).toHaveAttribute('type', 'radio');
    });

    it('calls onTriggerChange with scheduled_one_time when selected', () => {
      const onTriggerChange = vi.fn();
      render(
        <RuleDialogStepTrigger
          {...defaultProps}
          onTriggerChange={onTriggerChange}
        />
      );

      const radio = screen.getByDisplayValue('scheduled_one_time');
      fireEvent.click(radio);

      expect(onTriggerChange).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'scheduled_one_time',
          sectionId: null,
          schedule: { kind: 'one_time', fireAt: '' },
        })
      );
    });

    it('reveals ScheduleConfigPanel when scheduled_one_time is selected', () => {
      const trigger: TriggerConfig = {
        type: 'scheduled_one_time',
        sectionId: null,
        schedule: { kind: 'one_time', fireAt: '' },
      };

      render(
        <RuleDialogStepTrigger
          {...defaultProps}
          trigger={trigger}
        />
      );

      // The one-time config should render date and time pickers
      expect(screen.getByLabelText('Fire date')).toBeInTheDocument();
    });

    it('lists scheduled_one_time as the 4th scheduled trigger option', () => {
      render(<RuleDialogStepTrigger {...defaultProps} />);

      // Get all radio inputs within the Scheduled category
      const allRadios = screen.getAllByRole('radio');
      const scheduledRadioValues = allRadios
        .filter((r) => (r as HTMLInputElement).name === 'trigger')
        .map((r) => (r as HTMLInputElement).value)
        .filter((v) => v.startsWith('scheduled_'));

      // scheduled_one_time should be the 4th scheduled option
      expect(scheduledRadioValues).toContain('scheduled_one_time');
      expect(scheduledRadioValues.indexOf('scheduled_one_time')).toBe(3);
    });
  });
});
