import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ScheduleConfigPanel } from './ScheduleConfigPanel';

describe('ScheduleConfigPanel', () => {
  describe('Interval config', () => {
    it('renders number input and unit select', () => {
      const onChange = vi.fn();
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={onChange}
        />
      );

      expect(screen.getByLabelText('Interval value')).toBeInTheDocument();
      expect(screen.getByLabelText('Interval unit')).toBeInTheDocument();
      expect(screen.getByText('Minimum: 5 minutes. Maximum: 7 days.')).toBeInTheDocument();
    });

    it('displays helper text', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
        />
      );
      expect(screen.getByText(/Minimum: 5 minutes/)).toBeInTheDocument();
    });
  });

  describe('Cron config', () => {
    it('renders tabs for Daily, Weekly, Monthly', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('Daily')).toBeInTheDocument();
      expect(screen.getByText('Weekly')).toBeInTheDocument();
      expect(screen.getByText('Monthly')).toBeInTheDocument();
    });

    it('renders time picker with hour and minute selects', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Hour')).toBeInTheDocument();
      expect(screen.getByLabelText('Minute')).toBeInTheDocument();
    });

    it('renders day-of-week toggles on Weekly tab with role="switch"', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 5], daysOfMonth: [] }}
          onChange={vi.fn()}
        />
      );

      // Click Weekly tab
      fireEvent.click(screen.getByText('Weekly'));

      const switches = screen.getAllByRole('switch');
      expect(switches).toHaveLength(7);

      // Mon (index 1) and Fri (index 5) should be checked
      expect(switches[1]).toHaveAttribute('aria-checked', 'true');
      expect(switches[5]).toHaveAttribute('aria-checked', 'true');
      expect(switches[0]).toHaveAttribute('aria-checked', 'false');
    });

    it('renders day-of-week group with aria-label', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }}
          onChange={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText('Weekly'));
      expect(screen.getByRole('group', { name: 'Days of week' })).toBeInTheDocument();
    });

    it('renders Weekdays quick-select button', () => {
      const onChange = vi.fn();
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }}
          onChange={onChange}
        />
      );

      // Already on weekly tab since daysOfWeek is non-empty
      expect(screen.getByText('Weekdays')).toBeInTheDocument();
    });
  });

  describe('Due-date-relative config', () => {
    it('renders number input, unit select, and direction select', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_due_date_relative"
          schedule={{ kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' }}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByLabelText('Offset value')).toBeInTheDocument();
      expect(screen.getByText('due date')).toBeInTheDocument();
    });
  });

  it('returns null for unknown trigger type', () => {
    const { container } = render(
      <ScheduleConfigPanel
        triggerType="card_moved_into_section"
        schedule={{ kind: 'interval' }}
        onChange={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });
});
