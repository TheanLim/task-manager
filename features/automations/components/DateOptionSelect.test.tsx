import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DateOptionSelect } from './DateOptionSelect';

describe('DateOptionSelect', () => {
  it('renders with placeholder when no value selected', () => {
    const onChange = vi.fn();
    render(<DateOptionSelect value={null} onChange={onChange} />);
    
    expect(screen.getByText('Select date...')).toBeInTheDocument();
  });

  it('renders with selected value', () => {
    const onChange = vi.fn();
    render(<DateOptionSelect value="tomorrow" onChange={onChange} />);
    
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('renders with next weekday value', () => {
    const onChange = vi.fn();
    render(<DateOptionSelect value="next_monday" onChange={onChange} />);
    
    expect(screen.getByText('Next Monday')).toBeInTheDocument();
  });

  it('renders with monthly value', () => {
    const onChange = vi.fn();
    render(<DateOptionSelect value="day_of_month_15" onChange={onChange} />);
    
    expect(screen.getByText('15th of month')).toBeInTheDocument();
  });

  it('renders with nth weekday value', () => {
    const onChange = vi.fn();
    render(<DateOptionSelect value="first_monday_of_month" onChange={onChange} />);
    
    expect(screen.getByText('1st Monday of month')).toBeInTheDocument();
  });

  it('reveals month and day pickers when specific_date is selected', () => {
    const onChange = vi.fn();
    const onSpecificMonthChange = vi.fn();
    const onSpecificDayChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="specific_date"
        onChange={onChange}
        specificMonth={null}
        specificDay={null}
        onSpecificMonthChange={onSpecificMonthChange}
        onSpecificDayChange={onSpecificDayChange}
      />
    );
    
    // Should show month and day selects
    expect(screen.getAllByRole('combobox')).toHaveLength(3); // main select + month + day
    expect(screen.getByText('Month...')).toBeInTheDocument();
    expect(screen.getByText('Day...')).toBeInTheDocument();
  });

  it('displays selected month and day when provided', () => {
    const onChange = vi.fn();
    const onSpecificMonthChange = vi.fn();
    const onSpecificDayChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="specific_date"
        onChange={onChange}
        specificMonth={3}
        specificDay={15}
        onSpecificMonthChange={onSpecificMonthChange}
        onSpecificDayChange={onSpecificDayChange}
      />
    );
    
    expect(screen.getByText('March')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('shows month target toggle for day_of_month options', () => {
    const onChange = vi.fn();
    const onMonthTargetChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="day_of_month_15"
        onChange={onChange}
        monthTarget="this_month"
        onMonthTargetChange={onMonthTargetChange}
      />
    );
    
    expect(screen.getByText('of')).toBeInTheDocument();
    expect(screen.getByText('this month')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2); // main select + month target
  });

  it('shows month target toggle for nth weekday of month options', () => {
    const onChange = vi.fn();
    const onMonthTargetChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="first_monday_of_month"
        onChange={onChange}
        monthTarget="next_month"
        onMonthTargetChange={onMonthTargetChange}
      />
    );
    
    expect(screen.getByText('of')).toBeInTheDocument();
    expect(screen.getByText('next month')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });

  it('shows month target toggle for last_day_of_month option', () => {
    const onChange = vi.fn();
    const onMonthTargetChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="last_day_of_month"
        onChange={onChange}
        monthTarget="this_month"
        onMonthTargetChange={onMonthTargetChange}
      />
    );
    
    expect(screen.getByText('of')).toBeInTheDocument();
    expect(screen.getByText('this month')).toBeInTheDocument();
  });

  it('does not show month target toggle for relative date options', () => {
    const onChange = vi.fn();
    const onMonthTargetChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="tomorrow"
        onChange={onChange}
        monthTarget="this_month"
        onMonthTargetChange={onMonthTargetChange}
      />
    );
    
    expect(screen.queryByText('of')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1); // only main select
  });

  it('does not show month target toggle for next weekday options', () => {
    const onChange = vi.fn();
    const onMonthTargetChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="next_monday"
        onChange={onChange}
        monthTarget="this_month"
        onMonthTargetChange={onMonthTargetChange}
      />
    );
    
    expect(screen.queryByText('of')).not.toBeInTheDocument();
  });

  it('does not show specific date pickers when callbacks are not provided', () => {
    const onChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="specific_date"
        onChange={onChange}
        specificMonth={3}
        specificDay={15}
      />
    );
    
    // Should only show main select
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });

  it('does not show month target toggle when callback is not provided', () => {
    const onChange = vi.fn();
    
    render(
      <DateOptionSelect
        value="day_of_month_15"
        onChange={onChange}
        monthTarget="this_month"
      />
    );
    
    expect(screen.queryByText('of')).not.toBeInTheDocument();
  });
});
