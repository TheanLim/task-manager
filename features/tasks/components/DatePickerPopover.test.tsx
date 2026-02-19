import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePickerPopover } from './DatePickerPopover';

// Mock the Calendar component since it has complex internal state
vi.mock('@/components/ui/calendar', () => ({
  Calendar: ({ onSelect }: any) => (
    <div data-testid="calendar">
      <button onClick={() => onSelect(new Date('2025-06-15T00:00:00.000Z'))}>
        Pick June 15
      </button>
    </div>
  ),
}));

describe('DatePickerPopover', () => {
  it('renders the trigger content', () => {
    render(
      <DatePickerPopover
        value={null}
        onChange={vi.fn()}
        trigger={<button>Set date</button>}
      />
    );
    expect(screen.getByText('Set date')).toBeInTheDocument();
  });

  it('shows calendar when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value={null}
        onChange={vi.fn()}
        trigger={<button>Set date</button>}
      />
    );

    await user.click(screen.getByText('Set date'));
    expect(screen.getByTestId('calendar')).toBeInTheDocument();
  });

  it('calls onChange with ISO string when a date is selected', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value={null}
        onChange={onChange}
        trigger={<button>Set date</button>}
      />
    );

    await user.click(screen.getByText('Set date'));
    await user.click(screen.getByText('Pick June 15'));
    expect(onChange).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows "Clear date" button when value is set', async () => {
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value="2025-03-01T00:00:00.000Z"
        onChange={vi.fn()}
        trigger={<button>Mar 1</button>}
      />
    );

    await user.click(screen.getByText('Mar 1'));
    expect(screen.getByText('Clear date')).toBeInTheDocument();
  });

  it('does not show "Clear date" button when value is null', async () => {
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value={null}
        onChange={vi.fn()}
        trigger={<button>Set date</button>}
      />
    );

    await user.click(screen.getByText('Set date'));
    expect(screen.queryByText('Clear date')).not.toBeInTheDocument();
  });

  it('calls onChange with null when "Clear date" is clicked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value="2025-03-01T00:00:00.000Z"
        onChange={onChange}
        trigger={<button>Mar 1</button>}
      />
    );

    await user.click(screen.getByText('Mar 1'));
    await user.click(screen.getByText('Clear date'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('calls onTriggerClick when trigger wrapper is clicked', async () => {
    const onTriggerClick = vi.fn();
    const user = userEvent.setup();
    render(
      <DatePickerPopover
        value={null}
        onChange={vi.fn()}
        trigger={<button>Set date</button>}
        onTriggerClick={onTriggerClick}
      />
    );

    await user.click(screen.getByText('Set date'));
    expect(onTriggerClick).toHaveBeenCalled();
  });
});
