import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  // ─── Catch-up policy toggle ─────────────────────────────────────────
  // [PM §9.2 Decision 7, R7 AC 4, R7 AC 5]

  describe('Catch-up policy toggle', () => {
    const scheduledTriggerTypes = [
      { type: 'scheduled_interval', schedule: { kind: 'interval', intervalMinutes: 30 } },
      { type: 'scheduled_cron', schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] } },
      { type: 'scheduled_due_date_relative', schedule: { kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' } },
    ];

    it.each(scheduledTriggerTypes)(
      'renders catch-up policy toggle for $type',
      ({ type, schedule }) => {
        render(
          <ScheduleConfigPanel
            triggerType={type}
            schedule={schedule}
            onChange={vi.fn()}
            catchUpPolicy="catch_up_latest"
            onCatchUpPolicyChange={vi.fn()}
          />
        );

        expect(screen.getByLabelText('Run on catch-up')).toBeInTheDocument();
      }
    );

    it('toggle default state is checked when catchUpPolicy is catch_up_latest', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={vi.fn()}
        />
      );

      const toggle = screen.getByLabelText('Run on catch-up');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('toggling to "Skip if missed" calls onCatchUpPolicyChange with skip_missed', () => {
      const onCatchUpPolicyChange = vi.fn();
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={onCatchUpPolicyChange}
        />
      );

      const toggle = screen.getByLabelText('Run on catch-up');
      fireEvent.click(toggle);

      expect(onCatchUpPolicyChange).toHaveBeenCalledWith('skip_missed');
    });

    it('toggling from skip_missed back to catch_up_latest', () => {
      const onCatchUpPolicyChange = vi.fn();
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
          catchUpPolicy="skip_missed"
          onCatchUpPolicyChange={onCatchUpPolicyChange}
        />
      );

      const toggle = screen.getByLabelText('Run on catch-up');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
      fireEvent.click(toggle);

      expect(onCatchUpPolicyChange).toHaveBeenCalledWith('catch_up_latest');
    });

    it('displays helper text explaining catch-up behavior', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(
          "When disabled, this rule won't fire for missed schedules when the app reopens."
        )
      ).toBeInTheDocument();
    });
  });

  // ─── Template helper text ───────────────────────────────────────────
  // [QA §1.5, R8 AC 8]

  describe('Template helper text', () => {
    it('displays template helper text for scheduled_interval', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_interval"
          schedule={{ kind: 'interval', intervalMinutes: 30 }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Use \{\{date\}\}, \{\{day\}\}, \{\{weekday\}\}, \{\{month\}\} for dynamic titles/)
      ).toBeInTheDocument();
    });

    it('displays template helper text for scheduled_cron', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_cron"
          schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Use \{\{date\}\}, \{\{day\}\}, \{\{weekday\}\}, \{\{month\}\} for dynamic titles/)
      ).toBeInTheDocument();
    });

    it('displays template helper text for scheduled_due_date_relative', () => {
      render(
        <ScheduleConfigPanel
          triggerType="scheduled_due_date_relative"
          schedule={{ kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' }}
          onChange={vi.fn()}
          catchUpPolicy="catch_up_latest"
          onCatchUpPolicyChange={vi.fn()}
        />
      );

      expect(
        screen.getByText(/Use \{\{date\}\}, \{\{day\}\}, \{\{weekday\}\}, \{\{month\}\} for dynamic titles/)
      ).toBeInTheDocument();
    });

    it('does not display template helper text for non-scheduled triggers', () => {
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
});


// ─── One-time config [R7] ─────────────────────────────────────────────

describe('One-time config', () => {
  let dateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Fix "now" to 2025-03-10T12:00:00Z for deterministic tests
    dateSpy = vi.spyOn(Date, 'now').mockReturnValue(new Date('2025-03-10T12:00:00Z').getTime());
  });

  afterEach(() => {
    dateSpy.mockRestore();
  });

  it('renders date input and time pickers when scheduled_one_time selected', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Fire date')).toBeInTheDocument();
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
  });

  it('date input prevents past dates with min attribute set to today', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    const dateInput = screen.getByLabelText('Fire date');
    expect(dateInput).toHaveAttribute('min', '2025-03-10');
  });

  it('displays preview text with formatted date and time', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    // Preview uses toLocaleDateString/toLocaleTimeString — match the rendered output
    expect(screen.getByText(/On March 15, 2025 at/)).toBeInTheDocument();
  });

  it('shows past-time warning when selected datetime is in the past', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-09T10:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText('Selected time is in the past. The rule will fire immediately on save.')
    ).toBeInTheDocument();
  });

  it('does not show past-time warning when selected datetime is in the future', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.queryByText('Selected time is in the past. The rule will fire immediately on save.')
    ).not.toBeInTheDocument();
  });

  it('calls onChange with updated fireAt when date changes', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={onChange}
      />
    );

    const dateInput = screen.getByLabelText('Fire date');
    fireEvent.change(dateInput, { target: { value: '2025-03-20' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'one_time',
        fireAt: expect.stringContaining('2025-03-20'),
      })
    );
  });

  it('date input has aria-label "Fire date"', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Fire date')).toHaveAttribute('type', 'date');
  });

  it('preview time matches the picker hour (local time consistency)', () => {
    // Construct a fireAt where we know the local time: use buildFireAt logic
    // Create a date at local noon on March 15 by using Date constructor
    const localNoon = new Date(2025, 2, 15, 12, 0, 0); // March 15, 2025 12:00 local
    const fireAt = localNoon.toISOString();

    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt }}
        onChange={vi.fn()}
      />
    );

    // The picker should show hour=12, and the preview should say 12:00 PM
    expect(screen.getByText('On March 15, 2025 at 12:00 PM')).toBeInTheDocument();
  });

  it('min attribute uses local date, not UTC date', () => {
    dateSpy.mockReturnValue(new Date('2025-03-10T12:00:00Z').getTime());

    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt: '2025-03-15T15:00:00.000Z' }}
        onChange={vi.fn()}
      />
    );

    const dateInput = screen.getByLabelText('Fire date');
    // In jsdom (UTC), local date = UTC date = 2025-03-10
    expect(dateInput).toHaveAttribute('min', '2025-03-10');
  });

  it('isPast is false when fireAt is later today in local time', () => {
    // "now" is 10:00 local, fireAt is 11:50 local — should NOT be past
    const now = new Date(2025, 2, 10, 10, 0, 0); // March 10, 10:00 local
    dateSpy.mockReturnValue(now.getTime());

    const fireAtDate = new Date(2025, 2, 10, 11, 50, 0); // March 10, 11:50 local
    const fireAt = fireAtDate.toISOString();

    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.queryByText('Selected time is in the past. The rule will fire immediately on save.')
    ).not.toBeInTheDocument();
  });

  it('isPast is true when fireAt is earlier today in local time', () => {
    // "now" is 14:00 local, fireAt is 10:00 local — should be past
    const now = new Date(2025, 2, 10, 14, 0, 0); // March 10, 14:00 local
    dateSpy.mockReturnValue(now.getTime());

    const fireAtDate = new Date(2025, 2, 10, 10, 0, 0); // March 10, 10:00 local
    const fireAt = fireAtDate.toISOString();

    render(
      <ScheduleConfigPanel
        triggerType="scheduled_one_time"
        schedule={{ kind: 'one_time', fireAt }}
        onChange={vi.fn()}
      />
    );

    expect(
      screen.getByText('Selected time is in the past. The rule will fire immediately on save.')
    ).toBeInTheDocument();
  });
});

// ─── Cron expression toggle [R4] ──────────────────────────────────────

describe('Cron expression toggle', () => {
  it('renders Picker/Expression toggle when scheduled_cron selected', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    const radiogroup = screen.getByRole('radiogroup', { name: 'Input mode' });
    expect(radiogroup).toBeInTheDocument();
    expect(screen.getByLabelText('Picker')).toBeInTheDocument();
    expect(screen.getByLabelText('Expression')).toBeInTheDocument();
  });

  it('defaults to Picker mode', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    const pickerRadio = screen.getByLabelText('Picker');
    expect(pickerRadio).toBeChecked();
  });

  it('shows text input in Expression mode', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    expect(screen.getByLabelText('Cron expression')).toBeInTheDocument();
  });

  it('shows generated cron string when switching Picker → Expression', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    const input = screen.getByLabelText('Cron expression') as HTMLInputElement;
    expect(input.value).toBe('0 9 * * 1');
  });

  it('shows human-readable description for valid expression', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    expect(screen.getByText('Every Monday at 09:00')).toBeInTheDocument();
  });

  it('updates schedule state when valid expression entered', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    const input = screen.getByLabelText('Cron expression');
    fireEvent.change(input, { target: { value: '30 8 * * 1-5' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'cron',
        hour: 8,
        minute: 30,
        daysOfWeek: [1, 2, 3, 4, 5],
        daysOfMonth: [],
      })
    );
  });

  it('shows inline error for invalid expression in text-destructive', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    const input = screen.getByLabelText('Cron expression');
    fireEvent.change(input, { target: { value: '0 9 * 3 *' } });

    const errorEl = screen.getByText(/Month filtering is not supported/);
    expect(errorEl).toBeInTheDocument();
    expect(errorEl.className).toContain('text-destructive');
  });

  it('preserves config when switching Expression → Picker', () => {
    const onChange = vi.fn();
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 8, minute: 30, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] }}
        onChange={onChange}
      />
    );

    // Switch to Expression then back to Picker
    fireEvent.click(screen.getByLabelText('Expression'));
    fireEvent.click(screen.getByLabelText('Picker'));

    // Picker should still show the structured UI (tabs, hour/minute selects)
    expect(screen.getByLabelText('Hour')).toBeInTheDocument();
    expect(screen.getByLabelText('Minute')).toBeInTheDocument();
  });

  it('cron expression input has aria-label "Cron expression"', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Expression'));
    expect(screen.getByLabelText('Cron expression')).toHaveAttribute('type', 'text');
  });

  it('mode toggle uses role="radiogroup" with aria-label "Input mode"', () => {
    render(
      <ScheduleConfigPanel
        triggerType="scheduled_cron"
        schedule={{ kind: 'cron', hour: 9, minute: 0, daysOfWeek: [], daysOfMonth: [] }}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('radiogroup', { name: 'Input mode' })).toBeInTheDocument();
  });
});
